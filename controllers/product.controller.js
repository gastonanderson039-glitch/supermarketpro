const Product = require('../models/product.model');
const Shop = require('../models/shop.model');

// @desc    Get all products (with pagination and filtering)
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    
    // Build filter object
    const filter = { isActive: true };
    
    if (req.query.shop) {
      filter.shop = req.query.shop;
    }
    
    if (req.query.category) {
      filter.category = req.query.category;
    }
    
    if (req.query.subcategory) {
      filter.subcategory = req.query.subcategory;
    }
    
    if (req.query.minPrice && req.query.maxPrice) {
      filter.price = {
        $gte: parseFloat(req.query.minPrice),
        $lte: parseFloat(req.query.maxPrice),
      };
    } else if (req.query.minPrice) {
      filter.price = { $gte: parseFloat(req.query.minPrice) };
    } else if (req.query.maxPrice) {
      filter.price = { $lte: parseFloat(req.query.maxPrice) };
    }
    
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }
    
    // Execute query
    const products = await Product.find(filter)
      .populate('shop', 'name logo')
      .skip(skip)
      .limit(limit)
      .sort(req.query.sort || '-createdAt');
    
    // Get total count
    const total = await Product.countDocuments(filter);
    
    res.status(200).json({
      status: 'success',
      results: products.length,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get product by ID
// @route   GET /api/products/:id
// @access  Public
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('shop', 'name logo address contactInfo');
    
    if (!product) {
      return res.status(404).json({
        status: 'fail',
        message: 'Product not found',
      });
    }
    
    // Check if product is active or user is authorized to view
    if (
      !product.isActive &&
      (!req.user ||
        (req.user.role !== 'admin' &&
         req.user.shopId?.toString() !== product.shop._id.toString()))
    ) {
      return res.status(404).json({
        status: 'fail',
        message: 'Product not found',
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create a new product
// @route   POST /api/products
// @access  Private/Vendor/Staff
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      comparePrice,
      images,
      category,
      subcategory,
      tags,
      stock,
      unit,
      attributes,
      barcode,
      sku,
      weight,
      dimensions,
      lowStockThreshold,
    } = req.body;
    
    // Get shop ID from user or request body
    const shopId = req.body.shop || req.user.shopId;
    
    if (!shopId) {
      return res.status(400).json({
        status: 'fail',
        message: 'Shop ID is required',
      });
    }
    
    // Check if shop exists and user is authorized
    const shop = await Shop.findById(shopId);
    
    if (!shop) {
      return res.status(404).json({
        status: 'fail',
        message: 'Shop not found',
      });
    }
    
    // Check if user is authorized to add products to this shop
    const isOwner = shop.owners.some(owner => owner.toString() === req.user._id.toString());
    const isStaff = shop.staff.some(staff => staff.toString() === req.user._id.toString());
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwner && !isStaff && !isAdmin) {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to add products to this shop',
      });
    }
    
    // Create new product
    const product = await Product.create({
      name,
      description,
      shop: shopId,
      price,
      comparePrice,
      images,
      category,
      subcategory,
      tags,
      stock,
      unit,
      attributes,
      barcode,
      sku,
      weight,
      dimensions,
      lowStockThreshold,
    });
    
    res.status(201).json({
      status: 'success',
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Vendor/Staff
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        status: 'fail',
        message: 'Product not found',
      });
    }
    
    // Check if user is authorized to update this product
    const shop = await Shop.findById(product.shop);
    
    if (!shop) {
      return res.status(404).json({
        status: 'fail',
        message: 'Shop not found',
      });
    }
    
    const isOwner = shop.owners.some(owner => owner.toString() === req.user._id.toString());
    const isStaff = shop.staff.some(staff => staff.toString() === req.user._id.toString());
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwner && !isStaff && !isAdmin) {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to update this product',
      });
    }
    
    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      status: 'success',
      data: updatedProduct,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Vendor/Admin
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        status: 'fail',
        message: 'Product not found',
      });
    }
    
    // Check if user is authorized to delete this product
    const shop = await Shop.findById(product.shop);
    
    if (!shop) {
      return res.status(404).json({
        status: 'fail',
        message: 'Shop not found',
      });
    }
    
    const isOwner = shop.owners.some(owner => owner.toString() === req.user._id.toString());
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to delete this product',
      });
    }
    
    await product.deleteOne();
    
    res.status(200).json({
      status: 'success',
      message: 'Product deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update product stock
// @route   PATCH /api/products/:id/stock
// @access  Private/Vendor/Staff
exports.updateStock = async (req, res) => {
  try {
    const { stock } = req.body;
    
    if (stock === undefined) {
      return res.status(400).json({
        status: 'fail',
        message: 'Stock value is required',
      });
    }
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        status: 'fail',
        message: 'Product not found',
      });
    }
    
    // Check if user is authorized to update this product
    const shop = await Shop.findById(product.shop);
    
    if (!shop) {
      return res.status(404).json({
        status: 'fail',
        message: 'Shop not found',
      });
    }
    
    const isOwner = shop.owners.some(owner => owner.toString() === req.user._id.toString());
    const isStaff = shop.staff.some(staff => staff.toString() === req.user._id.toString());
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwner && !isStaff && !isAdmin) {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to update this product',
      });
    }
    
    // Update stock
    product.stock = stock;
    await product.save();
    
    res.status(200).json({
      status: 'success',
      data: {
        _id: product._id,
        name: product.name,
        stock: product.stock,
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

// @desc    Add product discount
// @route   POST /api/products/:id/discount
// @access  Private/Vendor
exports.addDiscount = async (req, res) => {
  try {
    const { type, value, startDate, endDate } = req.body;
    
    if (!type || !value || !startDate || !endDate) {
      return res.status(400).json({
        status: 'fail',
        message: 'All discount fields are required',
      });
    }
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        status: 'fail',
        message: 'Product not found',
      });
    }
    
    // Check if user is authorized to update this product
    const shop = await Shop.findById(product.shop);
    
    if (!shop) {
      return res.status(404).json({
        status: 'fail',
        message: 'Shop not found',
      });
    }
    
    const isOwner = shop.owners.some(owner => owner.toString() === req.user._id.toString());
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to add discounts to this product',
      });
    }
    
    // Add discount
    const discount = {
      type,
      value,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive: true,
    };
    
    product.discounts.push(discount);
    await product.save();
    
    res.status(200).json({
      status: 'success',
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};