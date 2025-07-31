const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Shop name is required'],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      required: [true, 'Shop description is required'],
    },
    logo: {
      type: String,
      default: '',
    },
    coverImage: {
      type: String,
      default: '',
    },
    owners: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    staff: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    deliveryPersonnel: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
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
      },
    ],
    categories: [
      {
        type: String,
        trim: true,
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended'],
      default: 'pending',
    },
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
    deliveryZones: [
      {
        name: String,
        fee: Number,
        estimatedTime: String,
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
    },
    stripeAccountId: String,
    commissionRate: {
      type: Number,
      default: 10, // 10% commission
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for products
shopSchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'shop',
});

// Index for geospatial queries
shopSchema.index({ 'address.location': '2dsphere' });

const Shop = mongoose.model('Shop', shopSchema);

module.exports = Shop;