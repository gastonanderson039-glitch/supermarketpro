const Notification = require('../models/notification.model');
const User = require('../models/user.model');

// @desc    Get all notifications for current user
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res) => {
  try {
    const { 
      isRead, 
      type,
      page = 1,
      limit = 10,
      sort = '-createdAt'
    } = req.query;
    
    // Build query
    const query = { recipient: req.user._id };
    
    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }
    
    if (type) {
      query.type = type;
    }
    
    // Count total notifications
    const total = await Notification.countDocuments(query);
    
    // Get notifications
    const notifications = await Notification.find(query)
      .populate('sender', 'name avatar')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    res.status(200).json({
      status: 'success',
      count: notifications.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: notifications,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get notification by ID
// @route   GET /api/notifications/:id
// @access  Private
exports.getNotificationById = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id)
      .populate('sender', 'name avatar');
    
    if (!notification) {
      return res.status(404).json({
        status: 'fail',
        message: 'Notification not found',
      });
    }
    
    // Check if user has permission to view this notification
    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to access this notification',
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: notification,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create new notification
// @route   POST /api/notifications
// @access  Private (Admin, Vendor, Staff)
exports.createNotification = async (req, res) => {
  try {
    const { 
      recipient, 
      type, 
      title, 
      message, 
      data, 
      reference,
      priority,
      actions
    } = req.body;
    
    // Check if recipient exists
    const user = await User.findById(recipient);
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'Recipient not found',
      });
    }
    
    // Check if user has permission to send notification to this recipient
    if (req.user.role === 'vendor' || req.user.role === 'staff') {
      // Vendor/staff can only send notifications to customers who have ordered from their shop
      // or to staff/delivery personnel of their shop
      
      // For simplicity, we'll just check if the recipient is a customer
      if (user.role === 'customer') {
        // In a real implementation, we would check if the customer has ordered from this vendor's shop
        // For now, we'll allow it
      } else {
        // Check if recipient is staff/delivery for the sender's shop
        const hasAccess = user.shops.some(shop => 
          req.user.shops.some(s => 
            s.shop.toString() === shop.shop.toString() && 
            s.role === 'owner'
          )
        );
        
        if (!hasAccess) {
          return res.status(403).json({
            status: 'fail',
            message: 'Not authorized to send notification to this recipient',
          });
        }
      }
    }
    
    // Create notification
    const notification = await Notification.create({
      recipient,
      sender: req.user._id,
      type,
      title,
      message,
      data,
      reference,
      priority: priority || 'normal',
      actions,
    });
    
    // In a real application, we would also send the notification via the appropriate channels
    // (email, push, SMS) based on the user's preferences
    
    res.status(201).json({
      status: 'success',
      data: notification,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({
        status: 'fail',
        message: 'Notification not found',
      });
    }
    
    // Check if user has permission to update this notification
    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to update this notification',
      });
    }
    
    // Update notification
    const updatedNotification = await Notification.findByIdAndUpdate(
      req.params.id,
      {
        isRead: true,
        readAt: Date.now(),
      },
      { new: true }
    );
    
    res.status(200).json({
      status: 'success',
      data: updatedNotification,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read/all
// @access  Private
exports.markAllAsRead = async (req, res) => {
  try {
    // Update all unread notifications for this user
    const result = await Notification.updateMany(
      { 
        recipient: req.user._id,
        isRead: false,
      },
      {
        isRead: true,
        readAt: Date.now(),
      }
    );
    
    res.status(200).json({
      status: 'success',
      message: `${result.modifiedCount} notifications marked as read`,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({
        status: 'fail',
        message: 'Notification not found',
      });
    }
    
    // Check if user has permission to delete this notification
    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to delete this notification',
      });
    }
    
    await notification.deleteOne();
    
    res.status(200).json({
      status: 'success',
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get unread notification count
// @route   GET /api/notifications/unread/count
// @access  Private
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    });
    
    res.status(200).json({
      status: 'success',
      data: { count },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Send push notification
// @route   POST /api/notifications/push
// @access  Private (Admin, Vendor)
exports.sendPushNotification = async (req, res) => {
  try {
    const { 
      recipients, 
      title, 
      message, 
      data, 
      type,
      reference,
      actions
    } = req.body;
    
    // Validate required fields
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Recipients array is required and must not be empty',
      });
    }
    
    if (!title || !message) {
      return res.status(400).json({
        status: 'fail',
        message: 'Title and message are required',
      });
    }
    
    // Check if recipients exist
    const users = await User.find({ _id: { $in: recipients } });
    
    if (users.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'No valid recipients found',
      });
    }
    
    // Check if user has permission to send notifications to these recipients
    if (req.user.role === 'vendor') {
      // Vendor can only send notifications to customers who have ordered from their shop
      // or to staff/delivery personnel of their shop
      
      // For simplicity, we'll just check if the recipients are customers
      // In a real implementation, we would check if the customers have ordered from this vendor's shop
      
      // Get shop IDs for this vendor
      const shopIds = req.user.shops
        .filter(s => s.role === 'owner')
        .map(s => s.shop.toString());
      
      // Check each recipient
      for (const user of users) {
        if (user.role === 'customer') {
          // For now, we'll allow it
          continue;
        }
        
        // Check if recipient is staff/delivery for the sender's shop
        const hasAccess = user.shops.some(shop => 
          shopIds.includes(shop.shop.toString())
        );
        
        if (!hasAccess) {
          return res.status(403).json({
            status: 'fail',
            message: `Not authorized to send notification to user ${user._id}`,
          });
        }
      }
    }
    
    // Create notifications
    const notifications = [];
    
    for (const recipientId of recipients) {
      const notification = await Notification.create({
        recipient: recipientId,
        sender: req.user._id,
        type: type || 'system',
        title,
        message,
        data,
        reference,
        actions,
        deliveryStatus: {
          push: {
            sent: true,
            sentAt: Date.now(),
          },
        },
      });
      
      notifications.push(notification);
    }
    
    // In a real application, we would also send the push notification
    // using a service like Firebase Cloud Messaging, OneSignal, etc.
    
    res.status(201).json({
      status: 'success',
      message: `${notifications.length} push notifications sent`,
      data: notifications,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get notification preferences
// @route   GET /api/notifications/preferences
// @access  Private
exports.getNotificationPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('preferences.notifications');
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found',
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: user.preferences.notifications,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update notification preferences
// @route   PUT /api/notifications/preferences
// @access  Private
exports.updateNotificationPreferences = async (req, res) => {
  try {
    const { 
      email, 
      push, 
      sms,
      orderUpdates,
      promotions,
      deliveryUpdates
    } = req.body;
    
    // Update user preferences
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        'preferences.notifications': {
          email: email !== undefined ? email : req.user.preferences?.notifications?.email,
          push: push !== undefined ? push : req.user.preferences?.notifications?.push,
          sms: sms !== undefined ? sms : req.user.preferences?.notifications?.sms,
          orderUpdates: orderUpdates !== undefined ? orderUpdates : req.user.preferences?.notifications?.orderUpdates,
          promotions: promotions !== undefined ? promotions : req.user.preferences?.notifications?.promotions,
          deliveryUpdates: deliveryUpdates !== undefined ? deliveryUpdates : req.user.preferences?.notifications?.deliveryUpdates,
        },
      },
      { new: true }
    ).select('preferences.notifications');
    
    res.status(200).json({
      status: 'success',
      data: user.preferences.notifications,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};