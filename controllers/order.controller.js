// controllers/order.controller.js
const Order = require('../models/order.model');
const ErrorResponse = require('../utils/errorResponse');
// const asyncHandler = require('../middleware/async');
const asyncHandler = require('../middleware/async.middleware');
const Shop = require('../models/shop.model');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
exports.createOrder = asyncHandler(async (req, res, next) => {
  const { items, shippingAddress, deliveryType, notes } = req.body;

  // Calculate order totals
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal + (req.body.tax || 0) + (req.body.deliveryFee || 0) - (req.body.discount || 0);

  const order = await Order.create({
    customer: req.user.id,
    shop: req.body.shop,
    items,
    subtotal,
    tax: req.body.tax || 0,
    deliveryFee: req.body.deliveryFee || 0,
    discount: req.body.discount || 0,
    total,
    paymentMethod: req.body.paymentMethod,
    shippingAddress,
    deliveryType,
    notes
  });

  res.status(201).json({
    success: true,
    data: order
  });
});

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
exports.getOrders = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
exports.getOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate('customer', 'name email')
    .populate('shop', 'name')
    .populate('items.product', 'name price');

  if (!order) {
    return next(new ErrorResponse(`Order not found with id of ${req.params.id}`, 404));
  }

  // Make sure user is order owner or admin
  if (order.customer.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`Not authorized to access this order`, 401));
  }

  res.status(200).json({
    success: true,
    data: order
  });
});

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
exports.updateOrderStatus = asyncHandler(async (req, res, next) => {
  let order = await Order.findById(req.params.id);

  if (!order) {
    return next(new ErrorResponse(`Order not found with id of ${req.params.id}`, 404));
  }

  // Check if user is shop owner or admin
  if (order.shop.toString() !== req.user.shop && req.user.role !== 'admin') {
    return next(new ErrorResponse(`Not authorized to update this order`, 401));
  }

  order = await Order.findByIdAndUpdate(req.params.id, {
    status: req.body.status
  }, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: order
  });
});

// @desc    Get orders for a shop
// @route   GET /api/orders/shop/:shopId
// @access  Private
exports.getShopOrders = asyncHandler(async (req, res, next) => {
  // Check if user owns the shop
  const shop = await Shop.findById(req.params.shopId)
  console.log("shop.staff", shop)
  console.log("shop.staff", shop.staff.some(opt => opt.user === req.user._id))
  if (!(shop.staff.some(opt => opt.user.toString() === req.user._id.toString())
    || req.user._id.toString() === shop.owner.toString())) {
    return next(new ErrorResponse(`Not authorized to access these orders`, 401));
  }

  const orders = await Order.find({ shop: req.params.shopId })
    .populate('customer', 'name email')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders
  });
});

// @desc    Get orders for a customer
// @route   GET /api/orders/customer/:customerId
// @access  Private
exports.getCustomerOrders = asyncHandler(async (req, res, next) => {
  // Check if user is the customer
  if (req.params.customerId !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`Not authorized to access these orders`, 401));
  }

  const orders = await Order.find({ customer: req.params.customerId })
    .populate('shop', 'name')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders
  });
});