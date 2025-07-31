const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

// Protect routes
exports.protect = async (req, res, next) => {
  let token;

  // Check if token exists in headers
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    // Check if token exists in cookies
    token = req.cookies.token;
  }

  // Check if token exists
  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Not authorized to access this route',
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'User not found',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'Your account has been deactivated. Please contact support.',
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      status: 'error',
      message: 'Not authorized to access this route',
    });
  }
};

// Authorize by role
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: `Role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};

// Check shop ownership or staff status
exports.checkShopAccess = (accessLevel = 'owner') => {
  return async (req, res, next) => {
    const shopId = req.params.shopId || req.body.shopId;

    if (!shopId) {
      return res.status(400).json({
        status: 'error',
        message: 'Shop ID is required',
      });
    }

    // Admin has access to all shops
    if (req.user.role === 'admin') {
      return next();
    }

    let hasAccess = false;

    if (accessLevel === 'owner') {
      // Check if user is shop owner
      hasAccess = req.user.isShopOwner(shopId);
    } else if (accessLevel === 'staff') {
      // Check if user is shop staff or owner
      hasAccess = req.user.isShopStaff(shopId);
    } else if (accessLevel === 'delivery') {
      // Check if user is shop delivery personnel, staff, or owner
      hasAccess = req.user.isShopDelivery(shopId) || req.user.isShopStaff(shopId);
    }

    if (!hasAccess) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to access this shop',
      });
    }

    next();
  };
};

// Check product ownership
exports.checkProductAccess = async (req, res, next) => {
  try {
    const productId = req.params.productId || req.params.id;
    
    if (!productId) {
      return res.status(400).json({
        status: 'error',
        message: 'Product ID is required',
      });
    }

    // Admin has access to all products
    if (req.user.role === 'admin') {
      return next();
    }

    const Product = require('../models/product.model');
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    // Check if user is shop owner or staff
    const hasAccess = req.user.isShopStaff(product.shop);

    if (!hasAccess) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to access this product',
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// Check order access
exports.checkOrderAccess = async (req, res, next) => {
  try {
    const orderId = req.params.orderId || req.params.id;
    
    if (!orderId) {
      return res.status(400).json({
        status: 'error',
        message: 'Order ID is required',
      });
    }

    // Admin has access to all orders
    if (req.user.role === 'admin') {
      return next();
    }

    const Order = require('../models/order.model');
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found',
      });
    }

    // Customer can access their own orders
    if (req.user.role === 'customer' && order.customer.toString() === req.user._id.toString()) {
      return next();
    }

    // Shop owner/staff can access shop orders
    if (['vendor', 'staff'].includes(req.user.role) && req.user.isShopStaff(order.shop)) {
      return next();
    }

    // Delivery personnel can access assigned orders
    if (['delivery', 'global_delivery'].includes(req.user.role) && 
        order.deliveryPersonnel && 
        order.deliveryPersonnel.toString() === req.user._id.toString()) {
      return next();
    }

    return res.status(403).json({
      status: 'error',
      message: 'Not authorized to access this order',
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};