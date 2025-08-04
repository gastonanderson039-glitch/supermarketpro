const Shop = require('../models/shop.model');
const User = require('../models/user.model');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async.middleware');


exports.getShops = asyncHandler(async (req, res, next) => {
  // Filtering
  let query;
  const reqQuery = { ...req.query };
  
  const removeFields = ['select', 'sort', 'page', 'limit'];
  removeFields.forEach(param => delete reqQuery[param]);

  let queryStr = JSON.stringify(reqQuery);
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

  query = Shop.find(JSON.parse(queryStr)).populate('owner', 'name email');

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
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await Shop.countDocuments();

  query = query.skip(startIndex).limit(limit);

  // Executing query
  const shops = await query;

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
    count: shops.length,
    pagination,
    data: shops
  });
});

// @desc    Get single shop
// @route   GET /api/shops/:id/detail
// @access  Public
exports.getShopById = asyncHandler(async (req, res, next) => {
  const shop = await Shop.findById(req.params.id)
    .populate('owner', 'name email')
    .populate('staff.user', 'name email role')
    .populate('deliveryPersonnel.user', 'name email');

  if (!shop) {
    return next(new ErrorResponse(`Shop not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: shop
  });
});

// @desc    Get vendor's shops
// @route   GET /api/shops/vendor
// @access  Private (Vendor)
exports.getVendorShops = asyncHandler(async (req, res, next) => {
  const shops = await Shop.find({ owner: req.user._id });

  res.status(200).json({
    success: true,
    count: shops.length,
    data: shops
  });
});

// @desc    Create new shop
// @route   POST /api/shops
// @access  Private (Vendor, Admin)
exports.createShop = asyncHandler(async (req, res, next) => {
  // Add owner to the request body
  req.body.owner = req.user.id;

  const shop = await Shop.create(req.body);

  // Update user role to vendor if not already
  if (req.user.role !== 'vendor') {
    await User.findByIdAndUpdate(req.user.id, { role: 'vendor' });
  }

  res.status(201).json({
    success: true,
    data: shop
  });
});

// @desc    Update shop
// @route   PUT /api/shops/:id
// @access  Private (Vendor, Admin)
exports.updateShop = asyncHandler(async (req, res, next) => {
  let shop = await Shop.findById(req.params.id);

  if (!shop) {
    return next(new ErrorResponse(`Shop not found with id of ${req.params.id}`, 404));
  }

  // Make sure user is shop owner or admin
  if (shop.owner.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`User ${req.user.id} is not authorized to update this shop`, 401));
  }

  shop = await Shop.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: shop
  });
});

// @desc    Delete shop
// @route   DELETE /api/shops/:id
// @access  Private (Admin)
exports.deleteShop = asyncHandler(async (req, res, next) => {
  const shop = await Shop.findById(req.params.id);

  if (!shop) {
    return next(new ErrorResponse(`Shop not found with id of ${req.params.id}`, 404));
  }

  await shop.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Add staff to shop
// @route   POST /api/shops/:id/staff
// @access  Private (Vendor, Admin)
exports.addStaff = asyncHandler(async (req, res, next) => {
  const shop = await Shop.findById(req.params.id);
  if (!shop) {
    return next(new ErrorResponse(`Shop not found with id of ${req.params.id}`, 404));
  }

  // Verify user exists
  const user = await User.findById(req.body.userId);
  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.body.userId}`, 404));
  }

  // Check if user is already staff
  const isAlreadyStaff = shop.staff.some(
    staff => staff.user.toString() === req.body.userId
  );
  if (isAlreadyStaff) {
    return next(new ErrorResponse(`User is already a staff member of this shop`, 400));
  }

  // Add staff with role and permissions
  shop.staff.push({
    user: req.body.userId,
    role: req.body.role || 'other',
    permissions: req.body.permissions || []
  });

  await shop.save();

  res.status(200).json({
    success: true,
    data: shop
  });
});

// @desc    Remove staff from shop
// @route   DELETE /api/shops/:id/staff/:userId
// @access  Private (Vendor, Admin)
exports.removeStaff = asyncHandler(async (req, res, next) => {
  const shop = await Shop.findById(req.params.id);
  if (!shop) {
    return next(new ErrorResponse(`Shop not found with id of ${req.params.id}`, 404));
  }

  // Check if user is staff
  const staffIndex = shop.staff.findIndex(
    staff => staff.user.toString() === req.params.userId
  );

  if (staffIndex === -1) {
    return next(new ErrorResponse(`User is not a staff member of this shop`, 400));
  }

  // Remove staff
  shop.staff.splice(staffIndex, 1);
  await shop.save();

  res.status(200).json({
    success: true,
    data: shop
  });
});