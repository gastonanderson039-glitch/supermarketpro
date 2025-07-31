const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    sessionId: {
      type: String,
      sparse: true,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        shop: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Shop',
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
          default: 1,
        },
        variant: {
          name: String,
          option: String,
        },
        price: {
          type: Number,
          required: true,
        },
        totalPrice: {
          type: Number,
          required: true,
        },
        notes: String,
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    shops: [
      {
        shop: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Shop',
          required: true,
        },
        subtotal: {
          type: Number,
          default: 0,
        },
        tax: {
          type: Number,
          default: 0,
        },
        deliveryFee: {
          type: Number,
          default: 0,
        },
        packagingFee: {
          type: Number,
          default: 0,
        },
        discount: {
          type: Number,
          default: 0,
        },
        total: {
          type: Number,
          default: 0,
        },
        couponCode: String,
        deliveryType: {
          type: String,
          enum: ['delivery', 'pickup'],
          default: 'delivery',
        },
        deliveryAddress: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User.addresses',
        },
        scheduledDelivery: {
          date: Date,
          timeSlot: String,
        },
        notes: String,
      },
    ],
    subtotal: {
      type: Number,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
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
    discount: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    coupons: [
      {
        code: String,
        type: {
          type: String,
          enum: ['percentage', 'fixed_amount', 'free_delivery'],
        },
        value: Number,
        shop: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Shop',
        },
        isGlobal: {
          type: Boolean,
          default: false,
        },
        appliedAmount: Number,
      },
    ],
    status: {
      type: String,
      enum: ['active', 'checkout_started', 'converted', 'abandoned', 'expired'],
      default: 'active',
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    checkoutStarted: Date,
    convertedToOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    convertedAt: Date,
    recoveryEmailSent: {
      type: Boolean,
      default: false,
    },
    recoveryEmailSentAt: Date,
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    device: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'other'],
    },
    userAgent: String,
    ipAddress: String,
  },
  {
    timestamps: true,
  }
);

// Ensure either user or sessionId is provided
cartSchema.pre('save', function(next) {
  if (!this.user && !this.sessionId) {
    return next(new Error('Either user or sessionId must be provided'));
  }
  next();
});

// Calculate totals before saving
cartSchema.pre('save', function(next) {
  // Calculate item totals
  this.items.forEach(item => {
    item.totalPrice = item.price * item.quantity;
  });
  
  // Group items by shop
  const shopItems = {};
  this.items.forEach(item => {
    const shopId = item.shop.toString();
    if (!shopItems[shopId]) {
      shopItems[shopId] = [];
    }
    shopItems[shopId].push(item);
  });
  
  // Update shops array with calculated totals
  this.shops = Object.keys(shopItems).map(shopId => {
    const items = shopItems[shopId];
    const shopSubtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    
    // Find existing shop entry or create new one
    const existingShop = this.shops.find(s => s.shop.toString() === shopId);
    
    return {
      ...(existingShop || { shop: shopId }),
      subtotal: shopSubtotal,
      total: shopSubtotal - (existingShop?.discount || 0) + (existingShop?.tax || 0) + (existingShop?.deliveryFee || 0) + (existingShop?.packagingFee || 0),
    };
  });
  
  // Calculate cart totals
  this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  this.total = this.subtotal + this.tax + this.deliveryFee + this.packagingFee + this.serviceFee - this.discount;
  
  // Update last activity
  this.lastActivity = new Date();
  
  next();
});

// Static method to get or create cart
cartSchema.statics.getOrCreate = async function(identifier) {
  const query = {};
  
  if (identifier.userId) {
    query.user = identifier.userId;
  } else if (identifier.sessionId) {
    query.sessionId = identifier.sessionId;
  } else {
    throw new Error('Either userId or sessionId must be provided');
  }
  
  let cart = await this.findOne(query);
  
  if (!cart) {
    cart = new this(query);
    await cart.save();
  }
  
  return cart;
};

// Static method to merge guest cart with user cart
cartSchema.statics.mergeGuestCart = async function(sessionId, userId) {
  const guestCart = await this.findOne({ sessionId });
  
  if (!guestCart) {
    return null;
  }
  
  let userCart = await this.findOne({ user: userId });
  
  if (!userCart) {
    // If user doesn't have a cart, convert guest cart to user cart
    guestCart.user = userId;
    guestCart.sessionId = undefined;
    await guestCart.save();
    return guestCart;
  }
  
  // Merge items from guest cart to user cart
  guestCart.items.forEach(guestItem => {
    const existingItem = userCart.items.find(
      item => 
        item.product.toString() === guestItem.product.toString() && 
        JSON.stringify(item.variant || {}) === JSON.stringify(guestItem.variant || {})
    );
    
    if (existingItem) {
      existingItem.quantity += guestItem.quantity;
      existingItem.totalPrice = existingItem.price * existingItem.quantity;
    } else {
      userCart.items.push(guestItem);
    }
  });
  
  // Save user cart and remove guest cart
  await userCart.save();
  await this.deleteOne({ _id: guestCart._id });
  
  return userCart;
};

// Indexes for efficient querying
cartSchema.index({ user: 1 });
cartSchema.index({ sessionId: 1 });
cartSchema.index({ status: 1 });
cartSchema.index({ lastActivity: 1 });
cartSchema.index({ 'items.product': 1 });
cartSchema.index({ 'shops.shop': 1 });

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;