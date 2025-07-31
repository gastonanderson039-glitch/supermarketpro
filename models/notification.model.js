const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    type: {
      type: String,
      enum: [
        'order_status', 
        'delivery_update', 
        'payment_status', 
        'promotion', 
        'stock_alert',
        'review', 
        'system', 
        'account',
        'shop_status'
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
    },
    reference: {
      model: {
        type: String,
        enum: ['Order', 'Product', 'Shop', 'User', 'Delivery', 'Promotion', 'Review'],
      },
      id: {
        type: mongoose.Schema.Types.ObjectId,
      },
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: Date,
    deliveryStatus: {
      email: {
        sent: {
          type: Boolean,
          default: false,
        },
        sentAt: Date,
      },
      push: {
        sent: {
          type: Boolean,
          default: false,
        },
        sentAt: Date,
      },
      sms: {
        sent: {
          type: Boolean,
          default: false,
        },
        sentAt: Date,
      },
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    expiresAt: Date,
    actions: [
      {
        label: String,
        url: String,
        type: {
          type: String,
          enum: ['link', 'button', 'action'],
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ 'reference.model': 1, 'reference.id': 1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;