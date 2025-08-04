const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

// Protect routes - Authentication middleware
exports.protect = async (req, res, next) => {
  let token;
    console.log("here")
  // Check if token exists in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Check if token exists
    console.log("token",token)
  if (!token) {
    return res.status(401).json({
      status: 'fail',
      message: 'Not authorized to access this route',
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists
    const user = await User.findById(decoded.id);
    console.log("user")
    if (!user) {
      return res.status(401).json({
        status: 'fail',
        message: 'The user belonging to this token no longer exists',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        status: 'fail',
        message: 'Your account has been deactivated. Please contact support.',
      });
    }

    // Grant access to protected route
    req.user = user;
    console.log("auth")
    next();
  } catch (error) {
    console.log(error)
    return res.status(401).json({
      status: 'fail',
      message: 'Not authorized to access this route',
    });
  }
};

// Role-based authorization middleware
exports.authorize = (...roles) => {
  console.log("here 2")
  return (req, res, next) => {
    console.log(req.user)
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'fail',
        message: `Role (${req.user.role}) is not authorized to access this route`,
      });
    }
    next();
  };
};

// Shop owner or staff authorization middleware
exports.authorizeShopAccess = async (req, res, next) => {
  try {
    const shopId = req.params.shopId || req.body.shopId;
    
    if (!shopId) {
      return res.status(400).json({
        status: 'fail',
        message: 'Shop ID is required',
      });
    }

    // Check if user is admin (admins have access to all shops)
    if (req.user.role === 'admin') {
      return next();
    }

    // For vendors and staff, check if they belong to the shop
    const Shop = require('../models/shop.model');
    const shop = await Shop.findById(shopId);

    if (!shop) {
      return res.status(404).json({
        status: 'fail',
        message: 'Shop not found',
      });
    }

    // Check if user is an owner or staff member of the shop
    const isOwner = shop.owners.some(owner => owner.toString() === req.user._id.toString());
    const isStaff = shop.staff.some(staff => staff.toString() === req.user._id.toString());

    if (!isOwner && !isStaff) {
      return res.status(403).json({
        status: 'fail',
        message: 'You are not authorized to access this shop',
      });
    }

    // Add shop to request object
    req.shop = shop;
    next();
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};