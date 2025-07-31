const Shop = require('../models/shop.model');
const User = require('../models/user.model');

// @desc    Get all shops (with pagination and filtering)
// @route   GET /api/shops
// @access  Public
exports.getShops = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    
    // Build filter object
    const filter = {};
    
    // Only show active shops to regular users
    if (!req.user || req.user.role !== 'admin') {
      filter.status = 'active';
    } else if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.category) {
      filter.categories = req.query.category;
    }
    
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } },
      ];
    }
    
    // Execute query
    const shops = await Shop.find(filter)
      .populate('owners', 'name email')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    
    // Get total count
    const total = await Shop.countDocuments(filter);
    
    res.status(200).json({
      status: 'success',
      results: shops.length,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: shops,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get shop by ID
// @route   GET /api/shops/:id
// @access  Public
exports.getShopById = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id)
      .populate('owners', 'name email')
      .populate('staff', 'name email')
      .populate('deliveryPersonnel', 'name email');
    
    if (!shop) {
      return res.status(404).json({
        status: 'fail',
        message: 'Shop not found',
      });
    }
    
    // If shop is not active and user is not admin or owner, don't show
    if (
      shop.status !== 'active' &&
      (!req.user || 
        (req.user.role !== 'admin' && 
         !shop.owners.some(owner => owner._id.toString() === req.user._id.toString())))
    ) {
      return res.status(404).json({
        status: 'fail',
        message: 'Shop not found',
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: shop,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create a new shop
// @route   POST /api/shops
// @access  Private/Vendor
exports.createShop = async (req, res) => {
  try {
    const {
      name,
      description,
      logo,
      coverImage,
      address,
      contactInfo,
      businessHours,
      categories,
    } = req.body;
    
    // Check if shop name already exists
    const shopExists = await Shop.findOne({ name });
    if (shopExists) {
      return res.status(400).json({
        status: 'fail',
        message: 'Shop name already exists',
      });
    }
    
    // Create new shop
    const shop = await Shop.create({
      name,
      description,
      logo,
      coverImage,
      owners: [req.user._id],
      address,
      contactInfo,
      businessHours,
      categories,
      status: 'pending', // New shops are pending until approved by admin
    });
    
    // Update user's shopId
    await User.findByIdAndUpdate(req.user._id, { shopId: shop._id });
    
    res.status(201).json({
      status: 'success',
      data: shop,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update shop
// @route   PUT /api/shops/:id
// @access  Private/Vendor/Admin
exports.updateShop = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    
    if (!shop) {
      return res.status(404).json({
        status: 'fail',
        message: 'Shop not found',
      });
    }
    
    // Check if user is authorized to update shop
    const isOwner = shop.owners.some(owner => owner.toString() === req.user._id.toString());
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to update this shop',
      });
    }
    
    // Update fields
    const {
      name,
      description,
      logo,
      coverImage,
      address,
      contactInfo,
      businessHours,
      categories,
      status,
      deliveryZones,
      paymentMethods,
      commissionRate,
    } = req.body;
    
    // Only admin can update status and commission rate
    if (status && !isAdmin) {
      return res.status(403).json({
        status: 'fail',
        message: 'Only admin can update shop status',
      });
    }
    
    if (commissionRate && !isAdmin) {
      return res.status(403).json({
        status: 'fail',
        message: 'Only admin can update commission rate',
      });
    }
    
    // Update shop
    const updatedShop = await Shop.findByIdAndUpdate(
      req.params.id,
      {
        name: name || shop.name,
        description: description || shop.description,
        logo: logo || shop.logo,
        coverImage: coverImage || shop.coverImage,
        address: address || shop.address,
        contactInfo: contactInfo || shop.contactInfo,
        businessHours: businessHours || shop.businessHours,
        categories: categories || shop.categories,
        status: status || shop.status,
        deliveryZones: deliveryZones || shop.deliveryZones,
        paymentMethods: paymentMethods || shop.paymentMethods,
        commissionRate: commissionRate || shop.commissionRate,
      },
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      status: 'success',
      data: updatedShop,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete shop
// @route   DELETE /api/shops/:id
// @access  Private/Admin
exports.deleteShop = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    
    if (!shop) {
      return res.status(404).json({
        status: 'fail',
        message: 'Shop not found',
      });
    }
    
    // Only admin can delete shops
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to delete shops',
      });
    }
    
    await shop.deleteOne();
    
    // Update users' shopId
    await User.updateMany(
      { shopId: shop._id },
      { $unset: { shopId: 1 } }
    );
    
    res.status(200).json({
      status: 'success',
      message: 'Shop deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Add shop staff
// @route   POST /api/shops/:id/staff
// @access  Private/Vendor
exports.addStaff = async (req, res) => {
  try {
    const { userId, role } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        status: 'fail',
        message: 'User ID is required',
      });
    }
    
    const shop = await Shop.findById(req.params.id);
    
    if (!shop) {
      return res.status(404).json({
        status: 'fail',
        message: 'Shop not found',
      });
    }
    
    // Check if user is authorized to add staff
    const isOwner = shop.owners.some(owner => owner.toString() === req.user._id.toString());
    
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to add staff to this shop',
      });
    }
    
    // Check if user exists
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found',
      });
    }
    
    // Check if user is already staff or owner
    if (
      shop.owners.includes(userId) ||
      shop.staff.includes(userId) ||
      (role === 'delivery' && shop.deliveryPersonnel.includes(userId))
    ) {
      return res.status(400).json({
        status: 'fail',
        message: 'User is already associated with this shop',
      });
    }
    
    // Add user to appropriate array based on role
    if (role === 'staff') {
      shop.staff.push(userId);
      user.role = 'staff';
    } else if (role === 'delivery') {
      shop.deliveryPersonnel.push(userId);
      user.role = 'delivery';
    } else if (role === 'vendor') {
      shop.owners.push(userId);
      user.role = 'vendor';
    } else {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid role. Must be staff, delivery, or vendor',
      });
    }
    
    // Update user's shopId
    user.shopId = shop._id;
    
    await shop.save();
    await user.save();
    
    res.status(200).json({
      status: 'success',
      data: shop,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Remove shop staff
// @route   DELETE /api/shops/:id/staff/:userId
// @access  Private/Vendor
exports.removeStaff = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const shop = await Shop.findById(req.params.id);
    
    if (!shop) {
      return res.status(404).json({
        status: 'fail',
        message: 'Shop not found',
      });
    }
    
    // Check if user is authorized to remove staff
    const isOwner = shop.owners.some(owner => owner.toString() === req.user._id.toString());
    
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to remove staff from this shop',
      });
    }
    
    // Check if user exists
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found',
      });
    }
    
    // Check if user is an owner (can't remove last owner)
    const isUserOwner = shop.owners.some(owner => owner.toString() === userId);
    
    if (isUserOwner && shop.owners.length === 1) {
      return res.status(400).json({
        status: 'fail',
        message: 'Cannot remove the last owner of the shop',
      });
    }
    
    // Remove user from appropriate array
    if (isUserOwner) {
      shop.owners = shop.owners.filter(owner => owner.toString() !== userId);
    } else if (shop.staff.includes(userId)) {
      shop.staff = shop.staff.filter(staff => staff.toString() !== userId);
    } else if (shop.deliveryPersonnel.includes(userId)) {
      shop.deliveryPersonnel = shop.deliveryPersonnel.filter(
        personnel => personnel.toString() !== userId
      );
    } else {
      return res.status(400).json({
        status: 'fail',
        message: 'User is not associated with this shop',
      });
    }
    
    // Update user's role and shopId
    user.role = 'customer';
    user.shopId = undefined;
    
    await shop.save();
    await user.save();
    
    res.status(200).json({
      status: 'success',
      data: shop,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};