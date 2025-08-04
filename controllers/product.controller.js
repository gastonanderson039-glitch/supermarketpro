const Product = require('../models/product.model');
const Shop = require('../models/shop.model');
const Category = require('../models/category.model');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async.middleware');

exports.getProducts = asyncHandler(async (req, res, next) => {
  // Advanced filtering, sorting, pagination
  let query;

  // Copy req.query
  const reqQuery = { ...req.query };

  // Fields to exclude
  const removeFields = ['select', 'sort', 'page', 'limit', 'search'];

  // Loop over removeFields and delete them from reqQuery
  removeFields.forEach(param => delete reqQuery[param]);

  // Create query string
  let queryStr = JSON.stringify(reqQuery);

  // Create operators ($gt, $gte, etc)
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

  // Finding resource
  query = Product.find(JSON.parse(queryStr))
    .populate('shop', 'name slug')
    .populate('category', 'name slug');

  // Search functionality
  if (req.query.search) {
    query = query.find({
      $or: [
        { name: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ]
    });
  }

  // Select fields
  if (req.query.select) {
    const fields = req.query.select.split(',').join(' ');
    query = query.select(fields);
  }

  // Sort
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-createdAt');
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 25;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await Product.countDocuments();

  query = query.skip(startIndex).limit(limit);

  // Executing query
  const products = await query;

  // Pagination result
  const pagination = {};
  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit
    };
  }

  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit
    };
  }

  res.status(200).json({
    success: true,
    count: products.length,
    pagination,
    data: products
  });
});

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
exports.getProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id)
    .populate('shop', 'name slug logo')
    .populate('category', 'name slug')
    .populate('reviews');

  if (!product) {
    return next(new ErrorResponse(`Product not found with id of ${req.params.id}`, 404));
  }

  // Increment view count
  product.views += 1;
  await product.save();

  res.status(200).json({
    success: true,
    data: product
  });
});

// @desc    Create new product
// @route   POST /api/products
// @access  Private (Vendor, Admin)
exports.createProduct = asyncHandler(async (req, res, next) => {
  // Verify shop exists and user is owner
  const shop = await Shop.findById(req.body.shop);
  if (!shop) {
    return next(new ErrorResponse(`Shop not found with id of ${req.body.shop}`, 404));
  }

  // Check if user is shop owner or admin
  if (shop.owner.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`User not authorized to add products to this shop`, 401));
  }

  // Verify category exists
  const category = await Category.findById(req.body.category);
  if (!category) {
    return next(new ErrorResponse(`Category not found with id of ${req.body.category}`, 404));
  }

  // Process variants if they exist
  if (req.body.variants && req.body.variants.length > 0) {
    console.log(req.body.variants)
    req.body.variants = JSON.parse(req.body.variants);
  }

  // Process options if they exist
  if (req.body.options && req.body.options.length > 0) {
    req.body.options = JSON.parse(req.body.options);
  }

  console.log("req.files", req.file)
  const images = req.files?.map(file => ({
    url: file.filename,
    alt: req.body.name || 'Product image'
  })) || [];
  req.body.images = images
  console.log("images", images)

  const product = await Product.create(req.body);

  res.status(201).json({
    success: true,
    data: product
  });
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Vendor, Admin)
exports.updateProduct = asyncHandler(async (req, res, next) => {
  let product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ErrorResponse(`Product not found with id of ${req.params.id}`, 404));
  }

  // Verify shop exists and user is owner
  const shop = await Shop.findById(product.shop);
  if (!shop) {
    return next(new ErrorResponse(`Shop not found`, 404));
  }

  // Check if user is shop owner or admin
  if (shop.owner.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`User not authorized to update this product`, 401));
  }

  // Parse JSON fields safely
  try {
    if (req.body.tags) {
      // Handle nested JSON string issue from the logs
      let tags = req.body.tags;
      while (typeof tags === 'string') {
        tags = JSON.parse(tags);
        if (Array.isArray(tags)) {
          tags = tags[0]; // Unwrap nested arrays
        }
      }
      req.body.tags = Array.isArray(tags) ? tags : [];
    }

    if (req.body.variants) {
      req.body.variants = typeof req.body.variants === 'string'
        ? JSON.parse(req.body.variants)
        : req.body.variants;
    }

    if (req.body.options) {
      req.body.options = typeof req.body.options === 'string'
        ? JSON.parse(req.body.options)
        : req.body.options;
    }
  } catch (error) {
    return next(new ErrorResponse(`Invalid JSON data format`, 400));
  }

  // Handle image updates
  console.log("req.files",req.files )
  if (req.files && req.files.length > 0) {
    const newImages = req.files.map(file => ({
      url: `/uploads/products/${file.filename}`,
      alt: req.body.name || 'Product image'
    }));

    // Combine with existing images not being removed
    const existingImages = req.body.existingImages
      ? typeof req.body.existingImages === 'string'
        ? JSON.parse(req.body.existingImages)
        : req.body.existingImages
      : product.images;

    const removedImages = req.body.removedImages
      ? typeof req.body.removedImages === 'string'
        ? JSON.parse(req.body.removedImages)
        : req.body.removedImages
      : [];

    const keptImages = existingImages.filter(img =>
      !removedImages.includes(img.url)
    );

    req.body.images = [...keptImages, ...newImages];
  } else if (req.body.existingImages || req.body.removedImages) {
    // Handle case where only existing images are being modified
    const existingImages = req.body.existingImages
      ? typeof req.body.existingImages === 'string'
        ? JSON.parse(req.body.existingImages)
        : req.body.existingImages
      : product.images;

    const removedImages = req.body.removedImages
      ? typeof req.body.removedImages === 'string'
        ? JSON.parse(req.body.removedImages)
        : req.body.removedImages
      : [];

    req.body.images = existingImages.filter(img =>
      !removedImages.includes(img.url)
    );
  }

  // Update product
  product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: product
  });
});

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Vendor, Admin)
exports.deleteProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ErrorResponse(`Product not found with id of ${req.params.id}`, 404));
  }

  // Verify shop exists and user is owner
  const shop = await Shop.findById(product.shop);
  if (!shop) {
    return next(new ErrorResponse(`Shop not found`, 404));
  }

  // Check if user is shop owner or admin
  if (shop.owner.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`User not authorized to delete this product`, 401));
  }

  // TODO: Delete associated images from storage

  await product.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get products by shop
// @route   GET /api/shops/:shopId/products
// @access  Public
exports.getProductsByShop = asyncHandler(async (req, res, next) => {
  const products = await Product.find({ shop: req.params.shopId })
    .populate('category', 'name slug');

  res.status(200).json({
    success: true,
    count: products.length,
    data: products
  });
});

// @desc    Get products by category
// @route   GET /api/categories/:categoryId/products
// @access  Public
exports.getProductsByCategory = asyncHandler(async (req, res, next) => {
  const products = await Product.find({ category: req.params.categoryId })
    .populate('shop', 'name slug');

  res.status(200).json({
    success: true,
    count: products.length,
    data: products
  });
});

// @desc    Toggle product active status
// @route   PUT /api/products/:id/status
// @access  Private (Vendor, Admin)
exports.toggleProductStatus = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ErrorResponse(`Product not found with id of ${req.params.id}`, 404));
  }

  // Verify shop exists and user is owner
  const shop = await Shop.findById(product.shop);
  if (!shop) {
    return next(new ErrorResponse(`Shop not found`, 404));
  }

  // Check if user is shop owner or admin
  if (shop.owner.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`User not authorized to update this product`, 401));
  }

  product.isActive = !product.isActive;
  await product.save();

  res.status(200).json({
    success: true,
    data: product
  });
});

// @desc    Update product inventory
// @route   PUT /api/products/:id/inventory
// @access  Private (Vendor, Admin)
exports.updateInventory = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ErrorResponse(`Product not found with id of ${req.params.id}`, 404));
  }

  // Verify shop exists and user is owner
  const shop = await Shop.findById(product.shop);
  if (!shop) {
    return next(new ErrorResponse(`Shop not found`, 404));
  }

  // Check if user is shop owner or admin
  if (shop.owner.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`User not authorized to update this product`, 401));
  }

  // Update main stock or variant stock
  if (req.body.variantId) {
    const variant = product.variants.id(req.body.variantId);
    if (!variant) {
      return next(new ErrorResponse(`Variant not found`, 404));
    }
    variant.stock = req.body.stock;
  } else {
    product.stock = req.body.stock;
  }

  await product.save();

  res.status(200).json({
    success: true,
    data: product
  });
});

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
exports.getFeaturedProducts = asyncHandler(async (req, res, next) => {
  const products = await Product.find({ isFeatured: true, isActive: true })
    .limit(10)
    .populate('shop', 'name slug')
    .populate('category', 'name slug');

  res.status(200).json({
    success: true,
    count: products.length,
    data: products
  });
});

// @desc    Get bestseller products
// @route   GET /api/products/bestsellers
// @access  Public
exports.getBestsellerProducts = asyncHandler(async (req, res, next) => {
  const products = await Product.find({ isBestseller: true, isActive: true })
    .sort('-sales')
    .limit(10)
    .populate('shop', 'name slug')
    .populate('category', 'name slug');

  res.status(200).json({
    success: true,
    count: products.length,
    data: products
  });
});