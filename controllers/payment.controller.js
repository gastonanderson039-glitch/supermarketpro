const Payment = require('../models/payment.model');
const Order = require('../models/order.model');
const User = require('../models/user.model');
const Shop = require('../models/shop.model');
const Setting = require('../models/setting.model');

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private (Admin, Vendor)
exports.getPayments = async (req, res) => {
  try {
    const { 
      status, 
      method, 
      provider,
      shop,
      customer,
      startDate,
      endDate,
      page = 1,
      limit = 10,
      sort = '-createdAt'
    } = req.query;
    
    // Build query
    const query = {};
    
    if (status) query.status = status;
    if (method) query.method = method;
    if (provider) query.provider = provider;
    
    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    // Filter by user role
    if (req.user.role === 'admin') {
      // Admin can see all payments
      if (shop) query.shop = shop;
      if (customer) query.customer = customer;
    } else if (req.user.role === 'vendor') {
      // Vendor can only see payments for their shops
      const shopIds = req.user.shops
        .filter(s => s.role === 'owner')
        .map(s => s.shop);
      
      query.shop = { $in: shopIds };
      
      if (customer) query.customer = customer;
    }
    
    // Count total payments
    const total = await Payment.countDocuments(query);
    
    // Get payments
    const payments = await Payment.find(query)
      .populate('order', 'orderNumber status')
      .populate('customer', 'name email')
      .populate('shop', 'name')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    res.status(200).json({
      status: 'success',
      count: payments.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: payments,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get payment by ID
// @route   GET /api/payments/:id
// @access  Private
exports.getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('order', 'orderNumber status items subtotal tax deliveryFee discount total')
      .populate('customer', 'name email phone')
      .populate('shop', 'name contactInfo');
    
    if (!payment) {
      return res.status(404).json({
        status: 'fail',
        message: 'Payment not found',
      });
    }
    
    // Check if user has permission to view this payment
    if (req.user.role === 'customer') {
      if (payment.customer._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to access this payment',
        });
      }
    } else if (req.user.role === 'vendor' || req.user.role === 'staff') {
      const hasAccess = req.user.shops.some(shop => 
        shop.shop.toString() === payment.shop._id.toString() && 
        (shop.role === 'owner' || shop.role === 'staff')
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to access this payment',
        });
      }
    }
    
    res.status(200).json({
      status: 'success',
      data: payment,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create new payment
// @route   POST /api/payments
// @access  Private
exports.createPayment = async (req, res) => {
  try {
    const { 
      order: orderId, 
      method, 
      provider,
      paymentDetails,
      billingAddress
    } = req.body;
    
    // Check if order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        status: 'fail',
        message: 'Order not found',
      });
    }
    
    // Check if payment already exists for this order
    const existingPayment = await Payment.findOne({ order: orderId });
    if (existingPayment) {
      return res.status(400).json({
        status: 'fail',
        message: 'Payment already exists for this order',
      });
    }
    
    // Check if user has permission to create payment for this order
    if (req.user.role === 'customer') {
      if (order.customer.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to create payment for this order',
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
          message: 'Not authorized to create payment for this order',
        });
      }
    }
    
    // Get shop commission rate
    const shop = await Shop.findById(order.shop);
    const commissionRate = shop ? shop.commissionRate : 10; // Default 10%
    
    // Calculate platform fee
    const platformFee = (order.total * commissionRate) / 100;
    
    // Calculate shop amount
    const shopAmount = order.total - platformFee;
    
    // Create payment
    const payment = await Payment.create({
      order: orderId,
      amount: order.total,
      currency: order.currency || 'USD',
      method,
      status: 'pending',
      provider,
      paymentDetails,
      customer: order.customer,
      shop: order.shop,
      platformFee,
      shopAmount,
      billingAddress,
    });
    
    res.status(201).json({
      status: 'success',
      data: payment,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update payment
// @route   PUT /api/payments/:id
// @access  Private (Admin)
exports.updatePayment = async (req, res) => {
  try {
    const { 
      status, 
      transactionId,
      paymentDetails,
      payoutStatus,
      payoutDate,
      payoutReference,
      notes
    } = req.body;
    
    // Find payment
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({
        status: 'fail',
        message: 'Payment not found',
      });
    }
    
    // Update payment
    const updatedPayment = await Payment.findByIdAndUpdate(
      req.params.id,
      {
        status,
        transactionId,
        paymentDetails,
        payoutStatus,
        payoutDate,
        payoutReference,
        notes
      },
      { new: true, runValidators: true }
    );
    
    // If status changed to 'completed', update order payment status
    if (status === 'completed' && payment.status !== 'completed') {
      await Order.findByIdAndUpdate(payment.order, {
        paymentStatus: 'paid',
        'paymentDetails.transactionId': transactionId,
        'paymentDetails.provider': payment.provider,
        'paymentDetails.amount': payment.amount,
        'paymentDetails.date': Date.now(),
      });
    } else if (status === 'refunded' && payment.status !== 'refunded') {
      await Order.findByIdAndUpdate(payment.order, {
        paymentStatus: 'refunded',
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: updatedPayment,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Process payment
// @route   POST /api/payments/:id/process
// @access  Private
exports.processPayment = async (req, res) => {
  try {
    const { 
      transactionId, 
      status,
      cardDetails,
      receiptUrl
    } = req.body;
    
    // Find payment
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({
        status: 'fail',
        message: 'Payment not found',
      });
    }
    
    // Check if user has permission to process this payment
    if (req.user.role === 'customer') {
      if (payment.customer.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to process this payment',
        });
      }
    } else if (req.user.role === 'vendor' || req.user.role === 'staff') {
      const hasAccess = req.user.shops.some(shop => 
        shop.shop.toString() === payment.shop.toString() && 
        (shop.role === 'owner' || shop.role === 'staff')
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to process this payment',
        });
      }
    }
    
    // Update payment
    const updatedPayment = await Payment.findByIdAndUpdate(
      req.params.id,
      {
        status: status || 'completed',
        transactionId,
        paymentDetails: {
          ...payment.paymentDetails,
          ...cardDetails,
          processedAt: Date.now(),
        },
        receiptUrl,
      },
      { new: true }
    );
    
    // Update order payment status
    const orderStatus = status === 'completed' ? 'confirmed' : 'pending';
    const paymentStatus = status === 'completed' ? 'paid' : status;
    
    await Order.findByIdAndUpdate(payment.order, {
      status: orderStatus,
      paymentStatus,
      'paymentDetails.transactionId': transactionId,
      'paymentDetails.provider': payment.provider,
      'paymentDetails.amount': payment.amount,
      'paymentDetails.date': Date.now(),
      ...(cardDetails && {
        'paymentDetails.cardLast4': cardDetails.cardLast4,
        'paymentDetails.cardBrand': cardDetails.cardBrand,
      }),
      receiptUrl,
      $push: {
        statusHistory: {
          status: orderStatus,
          note: `Payment ${status}`,
          updatedBy: req.user._id,
        },
      },
    });
    
    res.status(200).json({
      status: 'success',
      data: updatedPayment,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Refund payment
// @route   POST /api/payments/:id/refund
// @access  Private (Admin, Vendor)
exports.refundPayment = async (req, res) => {
  try {
    const { 
      amount, 
      reason,
      transactionId
    } = req.body;
    
    // Find payment
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({
        status: 'fail',
        message: 'Payment not found',
      });
    }
    
    // Check if payment is completed
    if (payment.status !== 'completed') {
      return res.status(400).json({
        status: 'fail',
        message: 'Only completed payments can be refunded',
      });
    }
    
    // Check if user has permission to refund this payment
    if (req.user.role === 'vendor') {
      const hasAccess = req.user.shops.some(shop => 
        shop.shop.toString() === payment.shop.toString() && 
        shop.role === 'owner'
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to refund this payment',
        });
      }
    }
    
    // Validate refund amount
    if (!amount || amount <= 0 || amount > payment.amount) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid refund amount',
      });
    }
    
    // Add refund to payment
    const updatedPayment = await Payment.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          refunds: {
            amount,
            reason,
            status: 'pending',
            transactionId,
            processedBy: req.user._id,
          },
        },
        status: amount === payment.amount ? 'refunded' : 'partially_refunded',
      },
      { new: true }
    );
    
    // Update order payment status
    const order = await Order.findById(payment.order);
    
    if (amount === payment.amount) {
      // Full refund
      await Order.findByIdAndUpdate(payment.order, {
        paymentStatus: 'refunded',
        status: 'refunded',
        $push: {
          statusHistory: {
            status: 'refunded',
            note: `Payment refunded: ${reason}`,
            updatedBy: req.user._id,
          },
        },
        cancellation: {
          reason,
          initiatedBy: req.user.role === 'admin' ? 'system' : 'shop',
          date: Date.now(),
          refundAmount: amount,
          refundStatus: 'pending',
        },
      });
    } else {
      // Partial refund
      await Order.findByIdAndUpdate(payment.order, {
        paymentStatus: 'partially_refunded',
        $push: {
          statusHistory: {
            status: order.status,
            note: `Payment partially refunded: ${reason}`,
            updatedBy: req.user._id,
          },
        },
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: updatedPayment,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get payment methods
// @route   GET /api/payments/methods
// @access  Public
exports.getPaymentMethods = async (req, res) => {
  try {
    // Get payment methods from settings
    const paymentSettings = await Setting.getByKey('payment_methods');
    
    // If no settings found, return default payment methods
    const methods = paymentSettings || {
      cash: {
        enabled: true,
        name: 'Cash on Delivery',
        icon: 'cash-icon',
      },
      card: {
        enabled: true,
        name: 'Credit/Debit Card',
        icon: 'card-icon',
        providers: ['stripe'],
      },
      paypal: {
        enabled: true,
        name: 'PayPal',
        icon: 'paypal-icon',
      },
    };
    
    res.status(200).json({
      status: 'success',
      data: methods,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create payment intent
// @route   POST /api/payments/intent
// @access  Private
exports.createPaymentIntent = async (req, res) => {
  try {
    const { orderId, paymentMethod } = req.body;
    
    // Check if order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        status: 'fail',
        message: 'Order not found',
      });
    }
    
    // Check if user has permission to create payment intent for this order
    if (req.user.role === 'customer') {
      if (order.customer.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to create payment intent for this order',
        });
      }
    }
    
    // Check if payment already exists for this order
    const existingPayment = await Payment.findOne({ order: orderId });
    if (existingPayment) {
      return res.status(400).json({
        status: 'fail',
        message: 'Payment already exists for this order',
      });
    }
    
    // In a real application, this would integrate with a payment gateway like Stripe
    // For now, just create a mock payment intent
    const paymentIntent = {
      id: `pi_${Math.random().toString(36).substring(2, 15)}`,
      amount: order.total,
      currency: order.currency || 'USD',
      status: 'requires_payment_method',
      client_secret: `pi_${Math.random().toString(36).substring(2, 15)}_secret_${Math.random().toString(36).substring(2, 15)}`,
      created: Date.now(),
    };
    
    // Create payment record
    const payment = await Payment.create({
      order: orderId,
      amount: order.total,
      currency: order.currency || 'USD',
      method: paymentMethod,
      status: 'pending',
      provider: paymentMethod === 'card' ? 'stripe' : paymentMethod,
      paymentDetails: {
        intentId: paymentIntent.id,
      },
      customer: order.customer,
      shop: order.shop,
      platformFee: order.commissionAmount || 0,
      shopAmount: order.shopEarnings || (order.total - (order.commissionAmount || 0)),
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        paymentIntent,
        paymentId: payment._id,
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

// @desc    Verify payment
// @route   POST /api/payments/verify
// @access  Private
exports.verifyPayment = async (req, res) => {
  try {
    const { paymentId, transactionId, status } = req.body;
    
    // Find payment
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        status: 'fail',
        message: 'Payment not found',
      });
    }
    
    // Check if user has permission to verify this payment
    if (req.user.role === 'customer') {
      if (payment.customer.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to verify this payment',
        });
      }
    }
    
    // Update payment status
    const updatedPayment = await Payment.findByIdAndUpdate(
      paymentId,
      {
        status: status || 'completed',
        transactionId,
      },
      { new: true }
    );
    
    // Update order payment status
    const orderStatus = status === 'completed' ? 'confirmed' : 'pending';
    const paymentStatus = status === 'completed' ? 'paid' : status;
    
    await Order.findByIdAndUpdate(payment.order, {
      status: orderStatus,
      paymentStatus,
      'paymentDetails.transactionId': transactionId,
      'paymentDetails.date': Date.now(),
      $push: {
        statusHistory: {
          status: orderStatus,
          note: `Payment ${status}`,
          updatedBy: req.user._id,
        },
      },
    });
    
    res.status(200).json({
      status: 'success',
      data: updatedPayment,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get payments by order
// @route   GET /api/payments/order/:orderId
// @access  Private
exports.getPaymentsByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Check if order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        status: 'fail',
        message: 'Order not found',
      });
    }
    
    // Check if user has permission to view payments for this order
    if (req.user.role === 'customer') {
      if (order.customer.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to view payments for this order',
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
          message: 'Not authorized to view payments for this order',
        });
      }
    }
    
    // Get payments for this order
    const payments = await Payment.find({ order: orderId })
      .populate('customer', 'name email')
      .populate('shop', 'name');
    
    res.status(200).json({
      status: 'success',
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get payments by shop
// @route   GET /api/payments/shop/:shopId
// @access  Private (Admin, Vendor, Staff)
exports.getPaymentsByShop = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { 
      status, 
      startDate, 
      endDate,
      page = 1,
      limit = 10,
      sort = '-createdAt'
    } = req.query;
    
    // Check if shop exists
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({
        status: 'fail',
        message: 'Shop not found',
      });
    }
    
    // Check if user has permission to view payments for this shop
    if (req.user.role === 'vendor' || req.user.role === 'staff') {
      const hasAccess = req.user.shops.some(shop => 
        shop.shop.toString() === shopId && 
        (shop.role === 'owner' || shop.role === 'staff')
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to view payments for this shop',
        });
      }
    }
    
    // Build query
    const query = { shop: shopId };
    
    if (status) query.status = status;
    
    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    // Count total payments
    const total = await Payment.countDocuments(query);
    
    // Get payments for this shop
    const payments = await Payment.find(query)
      .populate('order', 'orderNumber status')
      .populate('customer', 'name email')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    res.status(200).json({
      status: 'success',
      count: payments.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: payments,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get payments by customer
// @route   GET /api/payments/customer
// @access  Private
exports.getPaymentsByCustomer = async (req, res) => {
  try {
    const { 
      status, 
      startDate, 
      endDate,
      page = 1,
      limit = 10,
      sort = '-createdAt'
    } = req.query;
    
    // Build query
    const query = { customer: req.user._id };
    
    if (status) query.status = status;
    
    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    // Count total payments
    const total = await Payment.countDocuments(query);
    
    // Get payments for this customer
    const payments = await Payment.find(query)
      .populate('order', 'orderNumber status')
      .populate('shop', 'name')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    res.status(200).json({
      status: 'success',
      count: payments.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: payments,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};