const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Shop name is required'],
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Shop description is required'],
    },
    shortDescription: {
      type: String,
      maxlength: [200, 'Short description cannot be more than 200 characters'],
    },
    logo: {
      type: String,
      default: '',
    },
    coverImage: {
      type: String,
      default: '',
    },
    gallery: [
      {
        type: String,
      },
    ],
    address: {
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
    },
    contactInfo: {
      email: String,
      phone: String,
      website: String,
      socialMedia: {
        facebook: String,
        instagram: String,
        twitter: String,
        linkedin: String,
      },
    },
    businessHours: [
      {
        day: {
          type: String,
          enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        },
        open: Boolean,
        openTime: String,
        closeTime: String,
        breaks: [
          {
            startTime: String,
            endTime: String,
          },
        ],
      },
    ],
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'closed_temporarily', 'closed_permanently'],
      default: 'pending',
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: ['pending', 'active', 'suspended', 'closed_temporarily', 'closed_permanently'],
        },
        reason: String,
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    featuredProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    deliveryZones: [
      {
        name: String,
        description: String,
        fee: Number,
        minOrderAmount: {
          type: Number,
          default: 0,
        },
        freeDeliveryThreshold: {
          type: Number,
          default: 0,
        },
        estimatedTime: String,
        polygon: {
          type: {
            type: String,
            enum: ['Polygon'],
            default: 'Polygon',
          },
          coordinates: {
            type: [[[Number]]],
            default: [[[0, 0], [0, 0], [0, 0], [0, 0]]],
          },
        },
        isActive: {
          type: Boolean,
          default: true,
        },
      },
    ],
    paymentMethods: {
      cash: {
        type: Boolean,
        default: true,
      },
      card: {
        type: Boolean,
        default: false,
      },
      paypal: {
        type: Boolean,
        default: false,
      },
      bankTransfer: {
        type: Boolean,
        default: false,
      },
      wallet: {
        type: Boolean,
        default: false,
      },
    },
    paymentSettings: {
      stripeAccountId: String,
      paypalEmail: String,
      bankDetails: {
        accountName: String,
        accountNumber: String,
        bankName: String,
        routingNumber: String,
      },
    },
    commissionRate: {
      type: Number,
      default: 10, // 10% commission
    },
    taxSettings: {
      taxRate: {
        type: Number,
        default: 0,
      },
      taxIncluded: {
        type: Boolean,
        default: false,
      },
      taxId: String,
    },
    orderSettings: {
      minimumOrderAmount: {
        type: Number,
        default: 0,
      },
      autoAcceptOrders: {
        type: Boolean,
        default: false,
      },
      preparationTime: {
        type: Number, // in minutes
        default: 30,
      },
      allowScheduledOrders: {
        type: Boolean,
        default: true,
      },
      maxScheduledDays: {
        type: Number,
        default: 7,
      },
      allowPickup: {
        type: Boolean,
        default: true,
      },
    },
    verificationDocuments: [
      {
        type: {
          type: String,
          enum: ['business_license', 'id_proof', 'address_proof', 'tax_document', 'other'],
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
        notes: String,
      },
    ],
    metrics: {
      totalOrders: {
        type: Number,
        default: 0,
      },
      totalSales: {
        type: Number,
        default: 0,
      },
      averageOrderValue: {
        type: Number,
        default: 0,
      },
      totalCustomers: {
        type: Number,
        default: 0,
      },
    },
    seo: {
      metaTitle: String,
      metaDescription: String,
      metaKeywords: [String],
    },
    isFeatureShop: {
      type: Boolean,
      default: false,
    },
    notifications: {
      email: {
        newOrder: {
          type: Boolean,
          default: true,
        },
        orderStatusChange: {
          type: Boolean,
          default: true,
        },
        lowStock: {
          type: Boolean,
          default: true,
        },
        reviews: {
          type: Boolean,
          default: true,
        },
      },
      push: {
        newOrder: {
          type: Boolean,
          default: true,
        },
        orderStatusChange: {
          type: Boolean,
          default: true,
        },
        lowStock: {
          type: Boolean,
          default: true,
        },
        reviews: {
          type: Boolean,
          default: true,
        },
      },
    },
    notificationEmails: [String],
    notificationPhones: [String],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Generate slug from name before saving
shopSchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Virtual for products
shopSchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'shop',
});

// Virtual for orders
shopSchema.virtual('orders', {
  ref: 'Order',
  localField: '_id',
  foreignField: 'shop',
});

// Virtual for reviews
shopSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'shop',
});

// Index for geospatial queries
shopSchema.index({ 'address.location': '2dsphere' });
shopSchema.index({ 'deliveryZones.polygon': '2dsphere' });

// Text index for search
shopSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Other indexes for efficient querying
shopSchema.index({ slug: 1 });
shopSchema.index({ status: 1 });
shopSchema.index({ categories: 1 });
shopSchema.index({ isFeatureShop: 1 });

const Shop = mongoose.model('Shop', shopSchema);

module.exports = Shop;