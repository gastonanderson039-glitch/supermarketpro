const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        name: String,
        slug: String,
        image: String,
        variant: {
          name: String,
          option: String,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        unit: String,
        unitValue: Number,
        price: {
          type: Number,
          required: true,
        },
        originalPrice: Number,
        discount: Number,
        discountType: {
          type: String,
          enum: ['percentage', 'fixed'],
        },
        tax: {
          rate: Number,
          amount: Number,
        },
        totalPrice: {
          type: Number,
          required: true,
        },
        notes: String,
        isReviewed: {
          type: Boolean,
          default: false,
        },
      },
    ],
    subtotal: {
      type: Number,
      required: true,
    },
    tax: {
      type: Number,
      default: 0,
    },
    taxDetails: [
      {
        name: String,
        rate: Number,
        amount: Number,
      },
    ],
    deliveryFee: {
      type: Number,
      default: 0,
    },
    packagingFee: {
      type: Number,
      default: 0,
    },
    serviceFee: {
      type: Number,
      default: 0,
    },
    tip: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    discountDetails: [
      {
        type: {
          type: String,
          enum: ['coupon', 'promotion', 'loyalty', 'referral'],
        },
        code: String,
        amount: Number,
        description: String,
      },
    ],
    total: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'paypal', 'bank_transfer', 'wallet'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'authorized', 'paid', 'partially_paid', 'failed', 'refunded', 'partially_refunded'],
      default: 'pending',
    },
    paymentDetails: {
      transactionId: String,
      provider: String,
      amount: Number,
      date: Date,
      cardLast4: String,
      cardBrand: String,
      receiptUrl: String,
    },
    status: {
      type: String,
      enum: [
        'pending', 
        'confirmed', 
        'processing', 
        'ready_for_pickup',
        'out_for_delivery',
        'delivered', 
        'completed',
        'cancelled', 
        'refunded',
        'returned',
        'failed'
      ],
      default: 'pending',
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: [
            'pending', 
            'confirmed', 
            'processing', 
            'ready_for_pickup',
            'out_for_delivery',
            'delivered', 
            'completed',
            'cancelled', 
            'refunded',
            'returned',
            'failed'
          ],
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        note: String,
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        location: {
          type: {
            type: String,
            enum: ['Point'],
          },
          coordinates: [Number],
        },
        attachments: [
          {
            type: String,
            url: String,
            description: String,
          },
        ],
      },
    ],
    fulfillmentType: {
      type: String,
      enum: ['delivery', 'pickup'],
      default: 'delivery',
    },
    shippingAddress: {
      name: String,
      phone: String,
      street: String,
      apartment: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
      location: {
        type: {
          type: String,
          enum: ['Point'],
        },
        coordinates: [Number],
      },
      instructions: String,
    },
    billingAddress: {
      name: String,
      phone: String,
      street: String,
      apartment: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    pickupDetails: {
      location: {
        name: String,
        address: String,
        instructions: String,
      },
      contactPerson: {
        name: String,
        phone: String,
      },
      code: String,
    },
    deliveryPersonnel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    deliveryType: {
      type: String,
      enum: ['shop', 'global'],
      default: 'shop',
    },
    deliveryZone: {
      name: String,
      fee: Number,
    },
    scheduledDelivery: {
      date: Date,
      timeSlot: String,
      isScheduled: {
        type: Boolean,
        default: false,
      },
    },
    estimatedDeliveryTime: {
      min: Number, // in minutes
      max: Number, // in minutes
    },
    actualDeliveryTime: Date,
    notes: {
      customer: String,
      shop: String,
      delivery: String,
      internal: String,
    },
    invoiceUrl: String,
    receiptUrl: String,
    qrCode: String,
    ratings: {
      product: {
        rating: {
          type: Number,
          min: 1,
          max: 5,
        },
        comment: String,
        date: Date,
      },
      delivery: {
        rating: {
          type: Number,
          min: 1,
          max: 5,
        },
        comment: String,
        date: Date,
      },
      shop: {
        rating: {
          type: Number,
          min: 1,
          max: 5,
        },
        comment: String,
        date: Date,
      },
    },
    cancellation: {
      reason: String,
      initiatedBy: {
        type: String,
        enum: ['customer', 'shop', 'system', 'delivery'],
      },
      date: Date,
      refundAmount: Number,
      refundStatus: {
        type: String,
        enum: ['pending', 'processed', 'failed'],
      },
    },
    return: {
      reason: String,
      items: [
        {
          product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
          },
          quantity: Number,
          reason: String,
        },
      ],
      status: {
        type: String,
        enum: ['requested', 'approved', 'rejected', 'completed'],
      },
      refundAmount: Number,
      date: Date,
    },
    source: {
      type: String,
      enum: ['web', 'mobile_app', 'in_store', 'phone', 'third_party'],
      default: 'web',
    },
    deviceInfo: {
      type: String,
      ip: String,
      userAgent: String,
      location: String,
    },
    isGuestOrder: {
      type: Boolean,
      default: false,
    },
    guestDetails: {
      name: String,
      email: String,
      phone: String,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    commissionAmount: {
      type: Number,
      default: 0,
    },
    shopEarnings: {
      type: Number,
      default: 0,
    },
    deliveryEarnings: {
      type: Number,
      default: 0,
    },
    platformEarnings: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Generate order number before saving
orderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    // Find the latest order to increment the counter
    const latestOrder = await this.constructor.findOne({}, {}, { sort: { 'createdAt': -1 } });
    let counter = 1;
    
    if (latestOrder && latestOrder.orderNumber) {
      const latestCounter = parseInt(latestOrder.orderNumber.substr(-4));
      if (!isNaN(latestCounter)) {
        counter = latestCounter + 1;
      }
    }
    
    this.orderNumber = `ORD-${year}${month}${day}-${counter.toString().padStart(4, '0')}`;
  }
  
  // Calculate shop earnings and platform commission if not set
  if (this.isNew || this.isModified('total') || this.isModified('commissionAmount')) {
    if (!this.commissionAmount) {
      // Get shop commission rate
      const Shop = mongoose.model('Shop');
      const shop = await Shop.findById(this.shop);
      
      if (shop) {
        const commissionRate = shop.commissionRate || 10; // Default 10%
        this.commissionAmount = (this.total * commissionRate) / 100;
      }
    }
    
    // Calculate shop earnings
    this.shopEarnings = this.total - this.commissionAmount - (this.deliveryEarnings || 0);
    
    // Calculate platform earnings
    this.platformEarnings = this.commissionAmount;
  }
  
  next();
});

// Virtual for payment
orderSchema.virtual('payment', {
  ref: 'Payment',
  localField: '_id',
  foreignField: 'order',
  justOne: true,
});

// Virtual for delivery
orderSchema.virtual('delivery', {
  ref: 'Delivery',
  localField: '_id',
  foreignField: 'order',
  justOne: true,
});

// Indexes for efficient querying
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ customer: 1 });
orderSchema.index({ shop: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ deliveryPersonnel: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'scheduledDelivery.date': 1 });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;