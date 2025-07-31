const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    phone: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ['customer', 'vendor', 'admin', 'staff', 'delivery', 'global_delivery'],
      default: 'customer',
    },
    avatar: {
      type: String,
      default: '',
    },
    addresses: [
      {
        name: String,
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String,
        location: {
          type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
          },
          coordinates: {
            type: [Number],
            default: [0, 0],
          },
        },
        isDefault: {
          type: Boolean,
          default: false,
        },
        phone: String,
        instructions: String,
        type: {
          type: String,
          enum: ['home', 'work', 'other'],
          default: 'home',
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: String,
    verificationExpire: Date,
    shops: [
      {
        shop: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Shop',
        },
        role: {
          type: String,
          enum: ['owner', 'staff', 'delivery'],
          default: 'staff',
        },
        permissions: [String],
        isActive: {
          type: Boolean,
          default: true,
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    preferences: {
      language: {
        type: String,
        enum: ['en', 'fr', 'es', 'de', 'ar'],
        default: 'en',
      },
      currency: {
        type: String,
        default: 'USD',
      },
      darkMode: {
        type: Boolean,
        default: false,
      },
      notifications: {
        email: {
          type: Boolean,
          default: true,
        },
        push: {
          type: Boolean,
          default: true,
        },
        sms: {
          type: Boolean,
          default: false,
        },
        orderUpdates: {
          type: Boolean,
          default: true,
        },
        promotions: {
          type: Boolean,
          default: true,
        },
        deliveryUpdates: {
          type: Boolean,
          default: true,
        },
      },
    },
    deviceTokens: [
      {
        token: String,
        platform: {
          type: String,
          enum: ['ios', 'android', 'web'],
        },
        lastUsed: Date,
      },
    ],
    wishlist: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    savedCarts: [
      {
        name: String,
        items: [
          {
            product: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'Product',
            },
            quantity: Number,
            addedAt: {
              type: Date,
              default: Date.now,
            },
          },
        ],
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    deliveryPersonnelDetails: {
      isAvailable: {
        type: Boolean,
        default: false,
      },
      currentLocation: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point',
        },
        coordinates: {
          type: [Number],
          default: [0, 0],
        },
        lastUpdated: Date,
      },
      vehicle: {
        type: {
          type: String,
          enum: ['bicycle', 'motorcycle', 'car', 'van', 'truck', 'foot'],
        },
        licensePlate: String,
        color: String,
        model: String,
      },
      maxDeliveryDistance: {
        type: Number, // in kilometers
        default: 10,
      },
      ratings: {
        average: {
          type: Number,
          default: 0,
          min: 0,
          max: 5,
        },
        count: {
          type: Number,
          default: 0,
        },
      },
      completedDeliveries: {
        type: Number,
        default: 0,
      },
      bankDetails: {
        accountName: String,
        accountNumber: String,
        bankName: String,
        routingNumber: String,
      },
      identityVerified: {
        type: Boolean,
        default: false,
      },
      documents: [
        {
          type: {
            type: String,
            enum: ['id', 'license', 'insurance', 'vehicle_registration'],
          },
          url: String,
          verified: {
            type: Boolean,
            default: false,
          },
          uploadedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
    },
    lastLogin: Date,
    loginHistory: [
      {
        date: Date,
        ip: String,
        device: String,
        browser: String,
        location: String,
      },
    ],
    stripeCustomerId: String,
    paypalEmail: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for orders
userSchema.virtual('orders', {
  ref: 'Order',
  localField: '_id',
  foreignField: 'customer',
});

// Virtual for reviews
userSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'user',
});

// Encrypt password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Match password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Check if user is a shop owner
userSchema.methods.isShopOwner = function (shopId) {
  return this.shops.some(shop => 
    shop.shop.toString() === shopId.toString() && 
    shop.role === 'owner' && 
    shop.isActive
  );
};

// Check if user is a shop staff
userSchema.methods.isShopStaff = function (shopId) {
  return this.shops.some(shop => 
    shop.shop.toString() === shopId.toString() && 
    (shop.role === 'staff' || shop.role === 'owner') && 
    shop.isActive
  );
};

// Check if user is a shop delivery personnel
userSchema.methods.isShopDelivery = function (shopId) {
  return this.shops.some(shop => 
    shop.shop.toString() === shopId.toString() && 
    shop.role === 'delivery' && 
    shop.isActive
  );
};

// Indexes for efficient querying
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1 });
userSchema.index({ 'shops.shop': 1, 'shops.role': 1 });
userSchema.index({ 'deliveryPersonnelDetails.currentLocation': '2dsphere' });

const User = mongoose.model('User', userSchema);

module.exports = User;