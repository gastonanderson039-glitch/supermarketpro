const Order = require('../models/order.model');
const Product = require('../models/product.model');
const Shop = require('../models/shop.model');
const User = require('../models/user.model');

// @desc    Create a new order
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res) => {
  try {
    const {
      items,
      shopId,
      shippingAddress,
      paymentMethod,
      deliveryFee,
      scheduledDelivery,
      notes,
    } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'No order items',
      });
    }
    
    if (!shopId) {
      return res.status(400).json({
        status: 'fail',
        message: 'Shop ID is required',
      });
    }
    
    // Check if shop exists
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({
        status: 'fail',
        message: 'Shop not found',
      });
    }
    
    // Check if shop is active
    if (shop.status !== 'active') {
      return res.status(400).json({
        status: 'fail',
        message: 'Shop is not active',
      });
    }
    
    // Validate and calculate order items
    const orderItems = [];
    let subtotal = 0;
    
    for (const item of items) {
      const product = await Product.findById(item.productId);
      
      if (!product) {
        return res.status(404).json({
          status: 'fail',
          message: `Product not found: ${item.productId}`,
        });
      }
      
      if (!product.isActive) {
        return res.status(400).json({
          status: 'fail',
          message: `Product is not available: ${product.name}`,
        });
      }
      
      if (product.stock < item.quantity) {
        return res.status(400).json({
          status: 'fail',
          message: `Not enough stock for ${product.name}. Available: ${product.stock}`,
        });
      }
      
      // Calculate item price (considering discounts)
      let itemPrice = product.price;
      
      // Check for active discounts
      if (product.discounts && product.discounts.length > 0) {
        const now = new Date();
        const activeDiscount = product.discounts.find(
          d => d.isActive && new Date(d.startDate) <= now && new Date(d.endDate) >= now
        );
        
        if (activeDiscount) {
          if (activeDiscount.type === 'percentage') {
            itemPrice = itemPrice * (1 - activeDiscount.value / 100);
          } else if (activeDiscount.type === 'fixed') {
            itemPrice = Math.max(0, itemPrice - activeDiscount.value);
          }
        }
      }
      
      const itemTotal = itemPrice * item.quantity;
      subtotal += itemTotal;
      
      orderItems.push({
        product: product._id,
        name: product.name,
        quantity: item.quantity,
        price: itemPrice,
        totalPrice: itemTotal,
      });
      
      // Update product stock
      product.stock -= item.quantity;
      await product.save();
    }
    
    // Calculate total
    const tax = 0; // Can be calculated based on business logic
    const discount = 0; // Can be applied from coupons
    const total = subtotal + (deliveryFee || 0) + tax - discount;
    
    // Create order
    const order = await Order.create({
      customer: req.user._id,
      shop: shopId,
      items: orderItems,
      subtotal,
      tax,
      deliveryFee: deliveryFee || 0,
      discount,
      total,
      paymentMethod,
      shippingAddress,
      scheduledDelivery,
      notes,
      statusHistory: [
        {
          status: 'pending',
          timestamp: Date.now(),
          updatedBy: req.user._id,
        },
      ],
    });
    
    res.status(201).json({
      status: 'success',
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get all orders (with pagination and filtering)
// @route   GET /api/orders
// @access  Private
exports.getOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    
    // Build filter object based on user role
    let filter = {};
    
    if (req.user.role === 'customer') {
      // Customers can only see their own orders
      filter.customer = req.user._id;
    } else if (req.user.role === 'vendor' || req.user.role === 'staff') {
      // Vendors and staff can only see orders for their shop
      filter.shop = req.user.shopId;
    } else if (req.user.role === 'delivery') {
      // Delivery personnel can only see orders assigned to them
      filter.deliveryPersonnel = req.user._id;
    }
    // Admin can see all orders (no filter)
    
    // Additional filters
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.shop) {
      // Only admin can filter by shop
      if (req.user.role === 'admin') {
        filter.shop = req.query.shop;
      }
    }
    
    if (req.query.startDate && req.query.endDate) {
      filter.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate),
      };
    }
    
    // Execute query
    const orders = await Order.find(filter)
      .populate('customer', 'name email')
      .populate('shop', 'name')
      .populate('deliveryPersonnel', 'name')
      .skip(skip)
      .limit(limit)
      .sort('-createdAt');
    
    // Get total count
    const total = await Order.countDocuments(filter);
    
    res.status(200).json({
      status: 'success',
      results: orders.length,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: orders,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('shop', 'name logo contactInfo')
      .populate('deliveryPersonnel', 'name phone')
      .populate('items.product');
    
    if (!order) {
      return res.status(404).json({
        status: 'fail',
        message: 'Order not found',
      });
    }
    
    // Check if user is authorized to view this order
    const isCustomer = order.customer._id.toString() === req.user._id.toString();
    const isShopStaff = req.user.shopId && req.user.shopId.toString() === order.shop._id.toString();
    const isDeliveryPerson = order.deliveryPersonnel && 
                            order.deliveryPersonnel._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    
    if (!isCustomer && !isShopStaff && !isDeliveryPerson && !isAdmin) {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to view this order',
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update order status
// @route   PATCH /api/orders/:id/status
// @access  Private
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    
    if (!status) {
      return res.status(400).json({
        status: 'fail',
        message: 'Status is required',
      });
    }
    
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        status: 'fail',
        message: 'Order not found',
      });
    }
    
    // Check if user is authorized to update this order
    const isShopStaff = req.user.shopId && req.user.shopId.toString() === order.shop.toString();
    const isDeliveryPerson = order.deliveryPersonnel && 
                            order.deliveryPersonnel.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    
    if (!isShopStaff && !isDeliveryPerson && !isAdmin) {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to update this order',
      });
    }
    
    // Validate status transition
    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered', 'returned'],
      delivered: ['returned'],
      cancelled: [],
      returned: [],
    };
    
    if (!validTransitions[order.status].includes(status)) {
      return res.status(400).json({
        status: 'fail',
        message: `Cannot transition from ${order.status} to ${status}`,
      });
    }
    
    // Update order status
    order.status = status;
    order.statusHistory.push({
      status,
      timestamp: Date.now(),
      note: note || '',
      updatedBy: req.user._id,
    });
    
    // Handle cancelled orders (restore stock)
    if (status === 'cancelled') {
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
          product.stock += item.quantity;
          await product.save();
        }
      }
    }
    
    await order.save();
    
    res.status(200).json({
      status: 'success',
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Assign delivery personnel to order
// @route   PATCH /api/orders/:id/assign-delivery
// @access  Private/Vendor/Staff/Admin
exports.assignDelivery = async (req, res) => {
  try {
    const { deliveryPersonnelId, deliveryType } = req.body;
    
    if (!deliveryPersonnelId || !deliveryType) {
      return res.status(400).json({
        status: 'fail',
        message: 'Delivery personnel ID and type are required',
      });
    }
    
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        status: 'fail',
        message: 'Order not found',
      });
    }
    
    // Check if user is authorized to assign delivery
    const isShopStaff = req.user.shopId && req.user.shopId.toString() === order.shop.toString();
    const isAdmin = req.user.role === 'admin';
    
    if (!isShopStaff && !isAdmin) {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to assign delivery for this order',
      });
    }
    
    // Check if delivery personnel exists
    const deliveryPerson = await User.findById(deliveryPersonnelId);
    
    if (!deliveryPerson) {
      return res.status(404).json({
        status: 'fail',
        message: 'Delivery personnel not found',
      });
    }
    
    // Check if delivery personnel is valid
    if (deliveryPerson.role !== 'delivery') {
      return res.status(400).json({
        status: 'fail',
        message: 'Selected user is not a delivery personnel',
      });
    }
    
    // For shop delivery, check if delivery person belongs to the shop
    if (deliveryType === 'shop') {
      const shop = await Shop.findById(order.shop);
      
      if (!shop) {
        return res.status(404).json({
          status: 'fail',
          message: 'Shop not found',
        });
      }
      
      const isShopDelivery = shop.deliveryPersonnel.some(
        dp => dp.toString() === deliveryPersonnelId
      );
      
      if (!isShopDelivery) {
        return res.status(400).json({
          status: 'fail',
          message: 'Selected delivery personnel does not belong to this shop',
        });
      }
    }
    
    // Update order
    order.deliveryPersonnel = deliveryPersonnelId;
    order.deliveryType = deliveryType;
    
    await order.save();
    
    res.status(200).json({
      status: 'success',
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update payment status
// @route   PATCH /api/orders/:id/payment
// @access  Private/Vendor/Staff/Admin
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { paymentStatus, paymentDetails } = req.body;
    
    if (!paymentStatus) {
      return res.status(400).json({
        status: 'fail',
        message: 'Payment status is required',
      });
    }
    
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        status: 'fail',
        message: 'Order not found',
      });
    }
    
    // Check if user is authorized to update payment
    const isShopStaff = req.user.shopId && req.user.shopId.toString() === order.shop.toString();
    const isAdmin = req.user.role === 'admin';
    
    if (!isShopStaff && !isAdmin) {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to update payment for this order',
      });
    }
    
    // Update payment status
    order.paymentStatus = paymentStatus;
    
    if (paymentDetails) {
      order.paymentDetails = {
        ...order.paymentDetails,
        ...paymentDetails,
        date: paymentDetails.date || Date.now(),
      };
    }
    
    await order.save();
    
    res.status(200).json({
      status: 'success',
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};