const Delivery = require('../models/delivery.model');
const Order = require('../models/order.model');
const User = require('../models/user.model');
const Shop = require('../models/shop.model');

// @desc    Get all deliveries
// @route   GET /api/delivery
// @access  Private
exports.getDeliveries = async (req, res) => {
  try {
    const { 
      status, 
      type, 
      deliveryPersonnel, 
      order,
      page = 1,
      limit = 10,
      sort = '-createdAt'
    } = req.query;
    
    // Build query
    const query = {};
    
    if (status) query.status = status;
    if (type) query.type = type;
    
    // Filter by user role
    if (req.user.role === 'admin') {
      // Admin can see all deliveries
      if (deliveryPersonnel) query.deliveryPersonnel = deliveryPersonnel;
    } else if (req.user.role === 'vendor' || req.user.role === 'staff') {
      // Vendor/staff can only see deliveries for their shop
      const shopIds = req.user.shops.map(shop => shop.shop);
      
      // Get orders for these shops
      const orders = await Order.find({ shop: { $in: shopIds } }).select('_id');
      const orderIds = orders.map(order => order._id);
      
      query.order = { $in: orderIds };
      
      if (deliveryPersonnel) query.deliveryPersonnel = deliveryPersonnel;
    } else if (req.user.role === 'delivery' || req.user.role === 'global_delivery') {
      // Delivery personnel can only see their assigned deliveries
      query.deliveryPersonnel = req.user._id;
    } else {
      // Customers can only see deliveries for their orders
      const customerOrders = await Order.find({ customer: req.user._id }).select('_id');
      const customerOrderIds = customerOrders.map(order => order._id);
      
      query.order = { $in: customerOrderIds };
    }
    
    // Add specific order filter if provided
    if (order) query.order = order;
    
    // Count total deliveries
    const total = await Delivery.countDocuments(query);
    
    // Get deliveries
    const deliveries = await Delivery.find(query)
      .populate('order', 'orderNumber status customer shop')
      .populate('deliveryPersonnel', 'name email phone avatar')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    res.status(200).json({
      status: 'success',
      count: deliveries.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: deliveries,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get delivery by ID
// @route   GET /api/delivery/:id
// @access  Private
exports.getDeliveryById = async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id)
      .populate('order', 'orderNumber status customer shop items shippingAddress scheduledDelivery')
      .populate('deliveryPersonnel', 'name email phone avatar deliveryPersonnelDetails');
    
    if (!delivery) {
      return res.status(404).json({
        status: 'fail',
        message: 'Delivery not found',
      });
    }
    
    // Check if user has permission to view this delivery
    if (req.user.role === 'customer') {
      const order = await Order.findById(delivery.order._id);
      if (order.customer.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to access this delivery',
        });
      }
    } else if (req.user.role === 'vendor' || req.user.role === 'staff') {
      const order = await Order.findById(delivery.order._id);
      const hasAccess = req.user.shops.some(shop => 
        shop.shop.toString() === order.shop.toString() && 
        (shop.role === 'owner' || shop.role === 'staff')
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to access this delivery',
        });
      }
    } else if (req.user.role === 'delivery' || req.user.role === 'global_delivery') {
      if (delivery.deliveryPersonnel._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to access this delivery',
        });
      }
    }
    
    res.status(200).json({
      status: 'success',
      data: delivery,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create new delivery
// @route   POST /api/delivery
// @access  Private (Admin, Vendor, Staff)
exports.createDelivery = async (req, res) => {
  try {
    const { 
      order: orderId, 
      deliveryPersonnel, 
      type, 
      estimatedDeliveryTime,
      notes
    } = req.body;
    
    // Check if order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        status: 'fail',
        message: 'Order not found',
      });
    }
    
    // Check if delivery already exists for this order
    const existingDelivery = await Delivery.findOne({ order: orderId });
    if (existingDelivery) {
      return res.status(400).json({
        status: 'fail',
        message: 'Delivery already exists for this order',
      });
    }
    
    // Check if user has permission to create delivery for this order
    if (req.user.role !== 'admin') {
      const hasAccess = req.user.shops.some(shop => 
        shop.shop.toString() === order.shop.toString() && 
        (shop.role === 'owner' || shop.role === 'staff')
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to create delivery for this order',
        });
      }
    }
    
    // Check if delivery personnel exists and is active
    if (deliveryPersonnel) {
      const personnel = await User.findById(deliveryPersonnel);
      if (!personnel || !personnel.isActive) {
        return res.status(404).json({
          status: 'fail',
          message: 'Delivery personnel not found or inactive',
        });
      }
      
      // Check if delivery personnel has the correct role
      if (type === 'shop' && !personnel.isShopDelivery(order.shop)) {
        return res.status(400).json({
          status: 'fail',
          message: 'Selected personnel is not assigned to this shop',
        });
      }
      
      if (type === 'global' && personnel.role !== 'global_delivery') {
        return res.status(400).json({
          status: 'fail',
          message: 'Selected personnel is not a global delivery person',
        });
      }
    }
    
    // Create delivery
    const delivery = await Delivery.create({
      order: orderId,
      deliveryPersonnel,
      type,
      status: 'assigned',
      estimatedDeliveryTime,
      notes
    });
    
    // Update order with delivery info
    await Order.findByIdAndUpdate(orderId, {
      deliveryPersonnel,
      deliveryType: type,
      status: 'processing',
      $push: {
        statusHistory: {
          status: 'processing',
          note: 'Delivery assigned',
          updatedBy: req.user._id,
        },
      },
    });
    
    res.status(201).json({
      status: 'success',
      data: delivery,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update delivery
// @route   PUT /api/delivery/:id
// @access  Private (Admin, Vendor, Staff, Delivery)
exports.updateDelivery = async (req, res) => {
  try {
    const { 
      deliveryPersonnel, 
      estimatedDeliveryTime,
      notes
    } = req.body;
    
    // Find delivery
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      return res.status(404).json({
        status: 'fail',
        message: 'Delivery not found',
      });
    }
    
    // Check if user has permission to update this delivery
    if (req.user.role !== 'admin') {
      const order = await Order.findById(delivery.order);
      
      if (req.user.role === 'vendor' || req.user.role === 'staff') {
        const hasAccess = req.user.shops.some(shop => 
          shop.shop.toString() === order.shop.toString() && 
          (shop.role === 'owner' || shop.role === 'staff')
        );
        
        if (!hasAccess) {
          return res.status(403).json({
            status: 'fail',
            message: 'Not authorized to update this delivery',
          });
        }
      } else if (req.user.role === 'delivery' || req.user.role === 'global_delivery') {
        if (delivery.deliveryPersonnel.toString() !== req.user._id.toString()) {
          return res.status(403).json({
            status: 'fail',
            message: 'Not authorized to update this delivery',
          });
        }
        
        // Delivery personnel can only update notes and location
        if (deliveryPersonnel) {
          return res.status(403).json({
            status: 'fail',
            message: 'Delivery personnel cannot reassign deliveries',
          });
        }
      }
    }
    
    // Update delivery
    const updatedDelivery = await Delivery.findByIdAndUpdate(
      req.params.id,
      {
        deliveryPersonnel,
        estimatedDeliveryTime,
        notes
      },
      { new: true, runValidators: true }
    );
    
    // If delivery personnel changed, update order as well
    if (deliveryPersonnel && deliveryPersonnel !== delivery.deliveryPersonnel.toString()) {
      await Order.findByIdAndUpdate(delivery.order, {
        deliveryPersonnel,
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: updatedDelivery,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete delivery
// @route   DELETE /api/delivery/:id
// @access  Private (Admin, Vendor)
exports.deleteDelivery = async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      return res.status(404).json({
        status: 'fail',
        message: 'Delivery not found',
      });
    }
    
    // Check if user has permission to delete this delivery
    if (req.user.role !== 'admin') {
      const order = await Order.findById(delivery.order);
      
      const hasAccess = req.user.shops.some(shop => 
        shop.shop.toString() === order.shop.toString() && 
        shop.role === 'owner'
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to delete this delivery',
        });
      }
    }
    
    // Only allow deletion if delivery is in assigned status
    if (delivery.status !== 'assigned') {
      return res.status(400).json({
        status: 'fail',
        message: 'Cannot delete delivery that is already in progress',
      });
    }
    
    await delivery.deleteOne();
    
    // Update order to remove delivery info
    await Order.findByIdAndUpdate(delivery.order, {
      deliveryPersonnel: null,
      status: 'confirmed',
      $push: {
        statusHistory: {
          status: 'confirmed',
          note: 'Delivery assignment cancelled',
          updatedBy: req.user._id,
        },
      },
    });
    
    res.status(200).json({
      status: 'success',
      message: 'Delivery deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Assign delivery to personnel
// @route   POST /api/delivery/:id/assign
// @access  Private (Admin, Vendor, Staff)
exports.assignDelivery = async (req, res) => {
  try {
    const { deliveryPersonnel, type } = req.body;
    
    // Find delivery
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      return res.status(404).json({
        status: 'fail',
        message: 'Delivery not found',
      });
    }
    
    // Check if user has permission to assign this delivery
    if (req.user.role !== 'admin') {
      const order = await Order.findById(delivery.order);
      
      const hasAccess = req.user.shops.some(shop => 
        shop.shop.toString() === order.shop.toString() && 
        (shop.role === 'owner' || shop.role === 'staff')
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to assign this delivery',
        });
      }
    }
    
    // Check if delivery personnel exists and is active
    const personnel = await User.findById(deliveryPersonnel);
    if (!personnel || !personnel.isActive) {
      return res.status(404).json({
        status: 'fail',
        message: 'Delivery personnel not found or inactive',
      });
    }
    
    // Check if delivery personnel has the correct role
    const order = await Order.findById(delivery.order);
    
    if (type === 'shop' && !personnel.isShopDelivery(order.shop)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Selected personnel is not assigned to this shop',
      });
    }
    
    if (type === 'global' && personnel.role !== 'global_delivery') {
      return res.status(400).json({
        status: 'fail',
        message: 'Selected personnel is not a global delivery person',
      });
    }
    
    // Update delivery
    const updatedDelivery = await Delivery.findByIdAndUpdate(
      req.params.id,
      {
        deliveryPersonnel,
        type,
        status: 'assigned',
      },
      { new: true }
    );
    
    // Update order
    await Order.findByIdAndUpdate(delivery.order, {
      deliveryPersonnel,
      deliveryType: type,
      $push: {
        statusHistory: {
          status: order.status,
          note: 'Delivery personnel reassigned',
          updatedBy: req.user._id,
        },
      },
    });
    
    res.status(200).json({
      status: 'success',
      data: updatedDelivery,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update delivery status
// @route   PUT /api/delivery/:id/status
// @access  Private (Admin, Vendor, Staff, Delivery)
exports.updateDeliveryStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    // Find delivery
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      return res.status(404).json({
        status: 'fail',
        message: 'Delivery not found',
      });
    }
    
    // Check if user has permission to update this delivery status
    if (req.user.role !== 'admin') {
      const order = await Order.findById(delivery.order);
      
      if (req.user.role === 'vendor' || req.user.role === 'staff') {
        const hasAccess = req.user.shops.some(shop => 
          shop.shop.toString() === order.shop.toString() && 
          (shop.role === 'owner' || shop.role === 'staff')
        );
        
        if (!hasAccess) {
          return res.status(403).json({
            status: 'fail',
            message: 'Not authorized to update this delivery status',
          });
        }
      } else if (req.user.role === 'delivery' || req.user.role === 'global_delivery') {
        if (delivery.deliveryPersonnel.toString() !== req.user._id.toString()) {
          return res.status(403).json({
            status: 'fail',
            message: 'Not authorized to update this delivery status',
          });
        }
      }
    }
    
    // Update delivery status
    const updatedDelivery = await Delivery.findByIdAndUpdate(
      req.params.id,
      {
        status,
        ...(status === 'picked_up' && { startTime: Date.now() }),
        ...(status === 'delivered' && { endTime: Date.now(), actualDeliveryTime: Date.now() }),
      },
      { new: true }
    );
    
    // Update order status based on delivery status
    const order = await Order.findById(delivery.order);
    let orderStatus = order.status;
    
    if (status === 'picked_up') {
      orderStatus = 'out_for_delivery';
    } else if (status === 'delivered') {
      orderStatus = 'delivered';
      
      // Update delivery personnel stats
      if (delivery.deliveryPersonnel) {
        await User.findByIdAndUpdate(delivery.deliveryPersonnel, {
          $inc: { 'deliveryPersonnelDetails.completedDeliveries': 1 }
        });
      }
    } else if (status === 'failed') {
      orderStatus = 'processing';
    }
    
    // Update order
    await Order.findByIdAndUpdate(order._id, {
      status: orderStatus,
      ...(status === 'delivered' && { actualDeliveryTime: Date.now() }),
      $push: {
        statusHistory: {
          status: orderStatus,
          note: notes || `Delivery status updated to ${status}`,
          updatedBy: req.user._id,
        },
      },
    });
    
    res.status(200).json({
      status: 'success',
      data: updatedDelivery,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update delivery location
// @route   PUT /api/delivery/:id/location
// @access  Private (Delivery)
exports.updateDeliveryLocation = async (req, res) => {
  try {
    const { coordinates } = req.body;
    
    // Find delivery
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      return res.status(404).json({
        status: 'fail',
        message: 'Delivery not found',
      });
    }
    
    // Check if user is the assigned delivery personnel
    if (delivery.deliveryPersonnel.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to update this delivery location',
      });
    }
    
    // Update delivery location
    const updatedDelivery = await Delivery.findByIdAndUpdate(
      req.params.id,
      {
        location: {
          type: 'Point',
          coordinates,
          lastUpdated: Date.now(),
        },
        $push: {
          route: {
            location: {
              type: 'Point',
              coordinates,
            },
            timestamp: Date.now(),
          },
        },
      },
      { new: true }
    );
    
    // Also update delivery personnel location
    await User.findByIdAndUpdate(req.user._id, {
      'deliveryPersonnelDetails.currentLocation': {
        type: 'Point',
        coordinates,
        lastUpdated: Date.now(),
      },
    });
    
    res.status(200).json({
      status: 'success',
      data: updatedDelivery,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Upload delivery proof
// @route   POST /api/delivery/:id/proof
// @access  Private (Delivery)
exports.uploadDeliveryProof = async (req, res) => {
  try {
    const { image, signature, notes } = req.body;
    
    // Find delivery
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      return res.status(404).json({
        status: 'fail',
        message: 'Delivery not found',
      });
    }
    
    // Check if user is the assigned delivery personnel
    if (delivery.deliveryPersonnel.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to upload proof for this delivery',
      });
    }
    
    // Update delivery with proof
    const updatedDelivery = await Delivery.findByIdAndUpdate(
      req.params.id,
      {
        deliveryProof: {
          image,
          signature,
          notes,
          timestamp: Date.now(),
        },
        status: 'delivered',
        endTime: Date.now(),
        actualDeliveryTime: Date.now(),
      },
      { new: true }
    );
    
    // Update order status
    await Order.findByIdAndUpdate(delivery.order, {
      status: 'delivered',
      actualDeliveryTime: Date.now(),
      $push: {
        statusHistory: {
          status: 'delivered',
          note: 'Delivery completed with proof',
          updatedBy: req.user._id,
        },
      },
    });
    
    // Update delivery personnel stats
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'deliveryPersonnelDetails.completedDeliveries': 1 }
    });
    
    res.status(200).json({
      status: 'success',
      data: updatedDelivery,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get delivery personnel
// @route   GET /api/delivery/personnel
// @access  Private (Admin, Vendor, Staff)
exports.getDeliveryPersonnel = async (req, res) => {
  try {
    const { shop, type } = req.query;
    
    // Build query
    const query = {
      isActive: true,
    };
    
    if (type === 'global') {
      query.role = 'global_delivery';
    } else if (type === 'shop') {
      query.role = 'delivery';
      
      if (shop) {
        query['shops.shop'] = shop;
        query['shops.role'] = 'delivery';
        query['shops.isActive'] = true;
      } else if (req.user.role === 'vendor' || req.user.role === 'staff') {
        // Get all shops the user has access to
        const shopIds = req.user.shops
          .filter(s => s.role === 'owner' || s.role === 'staff')
          .map(s => s.shop);
        
        query['shops.shop'] = { $in: shopIds };
        query['shops.role'] = 'delivery';
        query['shops.isActive'] = true;
      }
    } else {
      query.role = { $in: ['delivery', 'global_delivery'] };
    }
    
    // Get delivery personnel
    const personnel = await User.find(query)
      .select('name email phone avatar role deliveryPersonnelDetails shops')
      .populate('shops.shop', 'name');
    
    res.status(200).json({
      status: 'success',
      count: personnel.length,
      data: personnel,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get available delivery personnel
// @route   GET /api/delivery/personnel/available
// @access  Private (Admin, Vendor, Staff)
exports.getAvailableDeliveryPersonnel = async (req, res) => {
  try {
    const { shop, type, latitude, longitude, maxDistance = 10 } = req.query;
    
    // Build query
    const query = {
      isActive: true,
      'deliveryPersonnelDetails.isAvailable': true,
    };
    
    if (type === 'global') {
      query.role = 'global_delivery';
    } else if (type === 'shop') {
      query.role = 'delivery';
      
      if (shop) {
        query['shops.shop'] = shop;
        query['shops.role'] = 'delivery';
        query['shops.isActive'] = true;
      } else if (req.user.role === 'vendor' || req.user.role === 'staff') {
        // Get all shops the user has access to
        const shopIds = req.user.shops
          .filter(s => s.role === 'owner' || s.role === 'staff')
          .map(s => s.shop);
        
        query['shops.shop'] = { $in: shopIds };
        query['shops.role'] = 'delivery';
        query['shops.isActive'] = true;
      }
    } else {
      query.role = { $in: ['delivery', 'global_delivery'] };
    }
    
    // Add geospatial query if coordinates provided
    if (latitude && longitude) {
      query['deliveryPersonnelDetails.currentLocation'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: parseFloat(maxDistance) * 1000, // Convert km to meters
        },
      };
    }
    
    // Get available delivery personnel
    const personnel = await User.find(query)
      .select('name email phone avatar role deliveryPersonnelDetails shops')
      .populate('shops.shop', 'name');
    
    res.status(200).json({
      status: 'success',
      count: personnel.length,
      data: personnel,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};