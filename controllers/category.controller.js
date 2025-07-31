const Category = require('../models/category.model');
const Product = require('../models/product.model');

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
exports.getCategories = async (req, res) => {
  try {
    const { level, isGlobal, shop, isActive, parent } = req.query;
    
    // Build query
    const query = {};
    
    if (level) query.level = level;
    if (isGlobal !== undefined) query.isGlobal = isGlobal === 'true';
    if (shop) query.shop = shop;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (parent) {
      query.parent = parent === 'null' ? null : parent;
    }
    
    const categories = await Category.find(query)
      .populate('parent', 'name slug')
      .sort({ order: 1, name: 1 });
    
    res.status(200).json({
      status: 'success',
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get category by ID
// @route   GET /api/categories/:id
// @access  Public
exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate('parent', 'name slug');
    
    if (!category) {
      return res.status(404).json({
        status: 'fail',
        message: 'Category not found',
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create new category
// @route   POST /api/categories
// @access  Private (Admin, Vendor)
exports.createCategory = async (req, res) => {
  try {
    const { 
      name, 
      description, 
      parent, 
      image, 
      icon, 
      isActive, 
      shop, 
      isGlobal,
      attributes,
      metaTitle,
      metaDescription,
      metaKeywords,
      order
    } = req.body;
    
    // Create category
    const category = await Category.create({
      name,
      description,
      parent,
      image,
      icon,
      isActive: isActive !== undefined ? isActive : true,
      shop,
      isGlobal: isGlobal !== undefined ? isGlobal : false,
      attributes,
      metaTitle,
      metaDescription,
      metaKeywords,
      order: order || 0
    });
    
    res.status(201).json({
      status: 'success',
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private (Admin, Vendor)
exports.updateCategory = async (req, res) => {
  try {
    const { 
      name, 
      description, 
      parent, 
      image, 
      icon, 
      isActive, 
      shop, 
      isGlobal,
      attributes,
      metaTitle,
      metaDescription,
      metaKeywords,
      order
    } = req.body;
    
    // Find category
    let category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({
        status: 'fail',
        message: 'Category not found',
      });
    }
    
    // Check if user has permission to update
    if (req.user.role !== 'admin' && category.isGlobal) {
      return res.status(403).json({
        status: 'fail',
        message: 'Only admins can update global categories',
      });
    }
    
    if (req.user.role === 'vendor' && category.shop && category.shop.toString() !== req.user.shopId.toString()) {
      return res.status(403).json({
        status: 'fail',
        message: 'You can only update categories for your shop',
      });
    }
    
    // Update category
    category = await Category.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        parent,
        image,
        icon,
        isActive,
        shop,
        isGlobal,
        attributes,
        metaTitle,
        metaDescription,
        metaKeywords,
        order
      },
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      status: 'success',
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private (Admin)
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({
        status: 'fail',
        message: 'Category not found',
      });
    }
    
    // Check if category has subcategories
    const subcategories = await Category.find({ parent: req.params.id });
    
    if (subcategories.length > 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Cannot delete category with subcategories. Please delete or reassign subcategories first.',
      });
    }
    
    // Check if category has products
    const products = await Product.find({ category: req.params.id });
    
    if (products.length > 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Cannot delete category with products. Please delete or reassign products first.',
      });
    }
    
    await category.deleteOne();
    
    res.status(200).json({
      status: 'success',
      message: 'Category deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get subcategories
// @route   GET /api/categories/:id/subcategories
// @access  Public
exports.getSubcategories = async (req, res) => {
  try {
    const subcategories = await Category.find({ 
      parent: req.params.id,
      isActive: true 
    }).sort({ order: 1, name: 1 });
    
    res.status(200).json({
      status: 'success',
      count: subcategories.length,
      data: subcategories,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get category products
// @route   GET /api/categories/:id/products
// @access  Public
exports.getCategoryProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = '-createdAt', shop } = req.query;
    
    // Build query
    const query = { 
      category: req.params.id,
      isActive: true 
    };
    
    if (shop) {
      query.shop = shop;
    }
    
    // Get subcategories
    const subcategories = await Category.find({ parent: req.params.id });
    const subcategoryIds = subcategories.map(subcat => subcat._id);
    
    // Include products from subcategories
    const finalQuery = {
      $or: [
        { category: req.params.id },
        { subcategory: { $in: subcategoryIds } }
      ],
      isActive: true
    };
    
    if (shop) {
      finalQuery.shop = shop;
    }
    
    // Count total products
    const total = await Product.countDocuments(finalQuery);
    
    // Get products
    const products = await Product.find(finalQuery)
      .populate('shop', 'name slug logo')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    res.status(200).json({
      status: 'success',
      count: products.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
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