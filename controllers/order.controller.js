const Order = require('../models/order.model');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async.middleware');
const Shop = require('../models/shop.model');
const { v4: uuidv4 } = require('uuid');

// @desc    Create new order (single or multi-shop)
// @route   POST /api/orders
// @access  Private
exports.createOrder = asyncHandler(async (req, res, next) => {
  const { shopOrders, shippingAddress, deliveryType,
    paymentMethod, notes, tax, deliveryFee, discount } = req.body;

  // Validate shop orders
  if (!shopOrders || !Array.isArray(shopOrders) || shopOrders.length === 0) {
    return next(new ErrorResponse('Please provide at least one shop order', 400));
  }

  // Process each shop order
  const processedShopOrders = await Promise.all(shopOrders.map(async (shopOrder) => {
    const { shop, items } = shopOrder;

    // Calculate shop order totals
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = subtotal + (shopOrder.tax || 0) + (shopOrder.deliveryFee || 0) - (shopOrder.discount || 0);

    // Add totalPrice to each item
    console.log(items)
    const processedItems = items.map(item => ({
      product: item.productId,
      shop: shop, // Ensure each item has shop reference
      quantity: item.quantity,
      price: item.price,
      totalPrice: item.price * item.quantity,
    }));
    console.log(processedItems)
    return {
      shop,
      items: processedItems,
      subtotal,
      tax: tax || 0,
      deliveryFee: deliveryFee || 0,
      discount: discount || 0,
      total,
      shippingAddress,
      deliveryType
    };
  }));

  // Calculate grand total
  const grandTotal = processedShopOrders.reduce((sum, shopOrder) => sum + shopOrder.total, 0);

  const order = await Order.create({
    orderNumber: uuidv4(),
    customer: req.user.id,
    shopOrders: processedShopOrders,
    paymentMethod,
    notes,
    grandTotal
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
    .populate('shopOrders.shop', 'name')
    .populate('shopOrders.items.product', 'name price');

  if (!order) {
    return next(new ErrorResponse(`Order not found with id of ${req.params.id}`, 404));
  }

  console.log(order.customer)
  // Make sure user is order owner, shop staff, or admin
  const isCustomer = order?.customer?._id?.toString() === req?.user?._id?.toString();
  const isAdmin = req.user.role === 'admin';
  const isShopStaff = order.shopOrders.some(shopOrder =>
    req.user.shop && req.user.shop.toString() === shopOrder.shop.toString()
  );

  if (!isCustomer && !isAdmin && !isShopStaff) {
    return next(new ErrorResponse(`Not authorized to access this order`, 401));
  }

  res.status(200).json({
    success: true,
    data: order
  });
});

// @desc    Update order status for a specific shop
// @route   PUT /api/orders/:orderId/shop/:shopId/status
// @access  Private/ShopOwner/Admin
exports.updateShopOrderStatus = asyncHandler(async (req, res, next) => {
  const { orderId, shopId } = req.params;
  const { status } = req.body;

  const order = await Order.findById(orderId);
  console.log(orderId, shopId)
  console.log(status)
  console.log(order)
  if (!order) {
    return next(new ErrorResponse(`Order not found with id of ${orderId}`, 404));
  }

  // Find the shop order to update
  const shopOrder = order.shopOrders.find(so => so.shop.toString() === shopId);
  if (!shopOrder) {
    return next(new ErrorResponse(`Shop order not found in order ${orderId}`, 404));
  }

  // Check if user is shop owner/staff or admin
  const shop = await Shop.findById(shopId);
  const isAdmin = req.user.role === 'admin';
  const isShopOwner = shop.owner.toString() === req.user.id;
  const isShopStaff = shop.staff.some(staff => staff.user.toString() === req.user.id);

  if (!isAdmin && !isShopOwner && !isShopStaff) {
    return next(new ErrorResponse(`Not authorized to update this order`, 401));
  }

  // Update status
  shopOrder.status = status;

  // Save the order
  await order.save();

  res.status(200).json({
    success: true,
    data: order
  });
});

// @desc    Get orders for a shop
// @route   GET /api/orders/shop/:shopId
// @access  Private/ShopStaff
exports.getShopOrders = asyncHandler(async (req, res, next) => {
  const shopId = req.params.shopId;

  // Check if user owns or works at the shop
  const shop = await Shop.findById(shopId);
  const isShopOwner = shop.owner.toString() === req.user.id;
  const isShopStaff = shop.staff.some(staff => staff.user.toString() === req.user.id);
  const isAdmin = req.user.role === 'admin';

  if (!isShopOwner && !isShopStaff && !isAdmin) {
    return next(new ErrorResponse(`Not authorized to access these orders`, 401));
  }

  // Find orders that contain this shop
  const orders = await Order.find({ 'shopOrders.shop': shopId })
    .populate('customer', 'name email')
    .populate({ path: 'shopOrders.items.product', select: 'name images' })
    .sort('-createdAt');

  // Extract just the relevant shop orders
  const shopOrders = orders.map(order => {
    const shopOrder = order.shopOrders.find(so => so.shop.toString() === shopId);
    console.log(order._id)
    return {
      orderId: order._id,
      _id: order._id,
      orderNumber: order.orderNumber,
      customer: order.customer,
      createdAt: order.createdAt,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      ...shopOrder.toObject()
    };
  });

  res.status(200).json({
    success: true,
    count: shopOrders.length,
    data: shopOrders
  });
});

// @desc    Get orders for a customer
// @route   GET /api/orders/customer/:customerId
// @access  Private
exports.getCustomerOrders = asyncHandler(async (req, res, next) => {
  // Check if user is the customer or admin
  if (req.params.customerId !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`Not authorized to access these orders`, 401));
  }

  const orders = await Order.find({ customer: req.params.customerId })
    .populate('shopOrders.shop', 'name')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders
  });
});