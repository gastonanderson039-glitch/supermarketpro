const Promotion = require('../models/promotion.model');
const Shop = require('../models/shop.model');
const Product = require('../models/product.model');
const Order = require('../models/order.model');

// @desc    Get all promotions
// @route   GET /api/promotions
// @access  Public
exports.getPromotions = async (req, res) => {
  try {
    const { 
      type, 
      isActive, 
      isGlobal, 
      shop,
      page = 1,
      limit = 10,
      sort = '-createdAt'
    } = req.query;
    
    // Build query
    const query = {};
    
    if (type) query.type = type;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (isGlobal !== undefined) query.isGlobal = isGlobal === 'true';
    if (shop) query.shop = shop;
    
    // Add date filter to only show current promotions
    const now = new Date();
    query.startDate = { $lte: now };
    query.endDate = { $gte: now };
    
    // Count total promotions
    const total = await Promotion.countDocuments(query);
    
    // Get promotions
    const promotions = await Promotion.find(query)
      .populate('shop', 'name logo')
      .populate('createdBy', 'name')
      .populate('applicableProducts', 'name price images')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    res.status(200).json({
      status: 'success',
      count: promotions.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: promotions,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get promotion by ID
// @route   GET /api/promotions/:id
// @access  Public
exports.getPromotionById = async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id)
      .populate('shop', 'name logo description')
      .populate('createdBy', 'name')
      .populate('applicableProducts', 'name price images description')
      .populate('buyXGetY.freeProduct', 'name price images description');
    
    if (!promotion) {
      return res.status(404).json({
        status: 'fail',
        message: 'Promotion not found',
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: promotion,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create new promotion
// @route   POST /api/promotions
// @access  Private (Admin, Vendor)
exports.createPromotion = async (req, res) => {
  try {
    const { 
      name, 
      description, 
      type, 
      code, 
      discountType, 
      discountValue,
      shop,
      isGlobal,
      startDate,
      endDate,
      isActive,
      minimumPurchase,
      maximumDiscount,
      usageLimit,
      applicableProducts,
      applicableCategories,
      excludedProducts,
      customerGroups,
      buyXGetY,
      image
    } = req.body;
    
    // Check if code already exists
    if (code) {
      const existingPromotion = await Promotion.findOne({ code });
      if (existingPromotion) {
        return res.status(400).json({
          status: 'fail',
          message: 'Promotion code already exists',
        });
      }
    }
    
    // Check if user has permission to create global promotion
    if (isGlobal && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Only admins can create global promotions',
      });
    }
    
    // Check if user has permission to create shop promotion
    if (shop && req.user.role === 'vendor') {
      const hasAccess = req.user.shops.some(s => 
        s.shop.toString() === shop && 
        s.role === 'owner'
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'You can only create promotions for your own shop',
        });
      }
    }
    
    // Create promotion
    const promotion = await Promotion.create({
      name,
      description,
      type,
      code,
      discountType,
      discountValue,
      shop,
      isGlobal: isGlobal || false,
      startDate,
      endDate,
      isActive: isActive !== undefined ? isActive : true,
      minimumPurchase,
      maximumDiscount,
      usageLimit,
      applicableProducts,
      applicableCategories,
      excludedProducts,
      customerGroups,
      buyXGetY,
      image,
      createdBy: req.user._id,
    });
    
    res.status(201).json({
      status: 'success',
      data: promotion,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update promotion
// @route   PUT /api/promotions/:id
// @access  Private (Admin, Vendor)
exports.updatePromotion = async (req, res) => {
  try {
    const { 
      name, 
      description, 
      type, 
      code, 
      discountType, 
      discountValue,
      shop,
      isGlobal,
      startDate,
      endDate,
      isActive,
      minimumPurchase,
      maximumDiscount,
      usageLimit,
      applicableProducts,
      applicableCategories,
      excludedProducts,
      customerGroups,
      buyXGetY,
      image
    } = req.body;
    
    // Find promotion
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) {
      return res.status(404).json({
        status: 'fail',
        message: 'Promotion not found',
      });
    }
    
    // Check if user has permission to update this promotion
    if (req.user.role !== 'admin') {
      if (promotion.isGlobal) {
        return res.status(403).json({
          status: 'fail',
          message: 'Only admins can update global promotions',
        });
      }
      
      if (promotion.shop) {
        const hasAccess = req.user.shops.some(s => 
          s.shop.toString() === promotion.shop.toString() && 
          s.role === 'owner'
        );
        
        if (!hasAccess) {
          return res.status(403).json({
            status: 'fail',
            message: 'You can only update promotions for your own shop',
          });
        }
      }
    }
    
    // Check if code already exists (if changed)
    if (code && code !== promotion.code) {
      const existingPromotion = await Promotion.findOne({ 
        code,
        _id: { $ne: req.params.id }
      });
      
      if (existingPromotion) {
        return res.status(400).json({
          status: 'fail',
          message: 'Promotion code already exists',
        });
      }
    }
    
    // Update promotion
    const updatedPromotion = await Promotion.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        type,
        code,
        discountType,
        discountValue,
        shop,
        isGlobal,
        startDate,
        endDate,
        isActive,
        minimumPurchase,
        maximumDiscount,
        usageLimit,
        applicableProducts,
        applicableCategories,
        excludedProducts,
        customerGroups,
        buyXGetY,
        image,
      },
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      status: 'success',
      data: updatedPromotion,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete promotion
// @route   DELETE /api/promotions/:id
// @access  Private (Admin, Vendor)
exports.deletePromotion = async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) {
      return res.status(404).json({
        status: 'fail',
        message: 'Promotion not found',
      });
    }
    
    // Check if user has permission to delete this promotion
    if (req.user.role !== 'admin') {
      if (promotion.isGlobal) {
        return res.status(403).json({
          status: 'fail',
          message: 'Only admins can delete global promotions',
        });
      }
      
      if (promotion.shop) {
        const hasAccess = req.user.shops.some(s => 
          s.shop.toString() === promotion.shop.toString() && 
          s.role === 'owner'
        );
        
        if (!hasAccess) {
          return res.status(403).json({
            status: 'fail',
            message: 'You can only delete promotions for your own shop',
          });
        }
      }
    }
    
    await promotion.deleteOne();
    
    res.status(200).json({
      status: 'success',
      message: 'Promotion deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Validate coupon
// @route   POST /api/promotions/coupon/validate
// @access  Public
exports.validateCoupon = async (req, res) => {
  try {
    const { code, shopId, cartTotal, products } = req.body;
    
    // Find promotion by code
    const promotion = await Promotion.findOne({ 
      code,
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    }).populate('applicableProducts', 'name price');
    
    if (!promotion) {
      return res.status(404).json({
        status: 'fail',
        message: 'Invalid or expired coupon code',
      });
    }
    
    // Check if promotion is applicable to this shop
    if (!promotion.isGlobal && promotion.shop && promotion.shop.toString() !== shopId) {
      return res.status(400).json({
        status: 'fail',
        message: 'This coupon is not applicable to this shop',
      });
    }
    
    // Check minimum purchase requirement
    if (promotion.minimumPurchase && cartTotal < promotion.minimumPurchase) {
      return res.status(400).json({
        status: 'fail',
        message: `Minimum purchase of ${promotion.minimumPurchase} required to use this coupon`,
        minimumPurchase: promotion.minimumPurchase,
      });
    }
    
    // Check if promotion has reached usage limit
    if (promotion.usageLimit.total > 0 && promotion.currentUsage >= promotion.usageLimit.total) {
      return res.status(400).json({
        status: 'fail',
        message: 'This coupon has reached its usage limit',
      });
    }
    
    // Check if products are applicable (if specified)
    let applicableAmount = cartTotal;
    
    if (promotion.applicableProducts && promotion.applicableProducts.length > 0) {
      const applicableProductIds = promotion.applicableProducts.map(p => p._id.toString());
      
      // Filter cart products that are applicable
      const applicableCartProducts = products.filter(p => 
        applicableProductIds.includes(p.productId)
      );
      
      if (applicableCartProducts.length === 0) {
        return res.status(400).json({
          status: 'fail',
          message: 'This coupon is not applicable to any products in your cart',
        });
      }
      
      // Calculate applicable amount
      applicableAmount = applicableCartProducts.reduce(
        (sum, p) => sum + (p.price * p.quantity),
        0
      );
    }
    
    // Calculate discount amount
    let discountAmount = 0;
    
    if (promotion.discountType === 'percentage') {
      discountAmount = (applicableAmount * promotion.discountValue) / 100;
    } else if (promotion.discountType === 'fixed_amount') {
      discountAmount = promotion.discountValue;
    } else if (promotion.discountType === 'free_shipping') {
      discountAmount = 0; // Handled separately in checkout
    }
    
    // Apply maximum discount if specified
    if (promotion.maximumDiscount && discountAmount > promotion.maximumDiscount) {
      discountAmount = promotion.maximumDiscount;
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        promotion: {
          _id: promotion._id,
          name: promotion.name,
          code: promotion.code,
          discountType: promotion.discountType,
          discountValue: promotion.discountValue,
        },
        discountAmount,
        applicableAmount,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get active promotions
// @route   GET /api/promotions/active
// @access  Public
exports.getActivePromotions = async (req, res) => {
  try {
    const { shop, type } = req.query;
    
    // Build query
    const query = {
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    };
    
    if (type) query.type = type;
    
    if (shop) {
      query.$or = [
        { shop },
        { isGlobal: true }
      ];
    } else {
      query.isGlobal = true;
    }
    
    // Get active promotions
    const promotions = await Promotion.find(query)
      .populate('shop', 'name logo')
      .sort('-createdAt');
    
    res.status(200).json({
      status: 'success',
      count: promotions.length,
      data: promotions,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get shop promotions
// @route   GET /api/promotions/shop/:shopId
// @access  Public
exports.getShopPromotions = async (req, res) => {
  try {
    const { shopId } = req.params;
    
    // Check if shop exists
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({
        status: 'fail',
        message: 'Shop not found',
      });
    }
    
    // Get active promotions for this shop
    const promotions = await Promotion.find({
      $or: [
        { shop: shopId },
        { isGlobal: true }
      ],
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    }).sort('-createdAt');
    
    res.status(200).json({
      status: 'success',
      count: promotions.length,
      data: promotions,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Apply promotion to order
// @route   POST /api/promotions/apply
// @access  Private
exports.applyPromotion = async (req, res) => {
  try {
    const { orderId, promotionId, code } = req.body;
    
    // Check if order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        status: 'fail',
        message: 'Order not found',
      });
    }
    
    // Check if user has permission to apply promotion to this order
    if (req.user.role === 'customer') {
      if (order.customer.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to apply promotion to this order',
        });
      }
    } else if (req.user.role === 'vendor' || req.user.role === 'staff') {
      const hasAccess = req.user.shops.some(shop => 
        shop.shop.toString() === order.shop.toString() && 
        (shop.role === 'owner' || shop.role === 'staff')
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to apply promotion to this order',
        });
      }
    }
    
    // Find promotion
    let promotion;
    
    if (promotionId) {
      promotion = await Promotion.findById(promotionId);
    } else if (code) {
      promotion = await Promotion.findOne({ code });
    } else {
      return res.status(400).json({
        status: 'fail',
        message: 'Promotion ID or code is required',
      });
    }
    
    if (!promotion) {
      return res.status(404).json({
        status: 'fail',
        message: 'Promotion not found',
      });
    }
    
    // Check if promotion is active and valid
    if (!promotion.isActive || 
        promotion.startDate > new Date() || 
        promotion.endDate < new Date()) {
      return res.status(400).json({
        status: 'fail',
        message: 'Promotion is not active or has expired',
      });
    }
    
    // Check if promotion is applicable to this shop
    if (!promotion.isGlobal && 
        promotion.shop && 
        promotion.shop.toString() !== order.shop.toString()) {
      return res.status(400).json({
        status: 'fail',
        message: 'This promotion is not applicable to this shop',
      });
    }
    
    // Check minimum purchase requirement
    if (promotion.minimumPurchase && order.subtotal < promotion.minimumPurchase) {
      return res.status(400).json({
        status: 'fail',
        message: `Minimum purchase of ${promotion.minimumPurchase} required to use this promotion`,
        minimumPurchase: promotion.minimumPurchase,
      });
    }
    
    // Check if promotion has reached usage limit
    if (promotion.usageLimit.total > 0 && 
        promotion.currentUsage >= promotion.usageLimit.total) {
      return res.status(400).json({
        status: 'fail',
        message: 'This promotion has reached its usage limit',
      });
    }
    
    // Calculate discount amount
    let discountAmount = 0;
    
    if (promotion.discountType === 'percentage') {
      discountAmount = (order.subtotal * promotion.discountValue) / 100;
    } else if (promotion.discountType === 'fixed_amount') {
      discountAmount = promotion.discountValue;
    } else if (promotion.discountType === 'free_shipping') {
      discountAmount = order.deliveryFee;
    }
    
    // Apply maximum discount if specified
    if (promotion.maximumDiscount && discountAmount > promotion.maximumDiscount) {
      discountAmount = promotion.maximumDiscount;
    }
    
    // Update order with discount
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        discount: discountAmount,
        total: order.subtotal + order.tax + order.deliveryFee - discountAmount,
        $push: {
          discountDetails: {
            type: 'promotion',
            code: promotion.code,
            amount: discountAmount,
            description: promotion.name,
          },
        },
      },
      { new: true }
    );
    
    // Increment promotion usage
    await Promotion.findByIdAndUpdate(
      promotion._id,
      { $inc: { currentUsage: 1 } }
    );
    
    res.status(200).json({
      status: 'success',
      data: {
        order: updatedOrder,
        discountAmount,
        promotion: {
          _id: promotion._id,
          name: promotion.name,
          code: promotion.code,
          discountType: promotion.discountType,
          discountValue: promotion.discountValue,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};