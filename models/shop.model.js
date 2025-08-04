const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    description: {
      type: String,
      required: true
    },
    logo: {
      type: String,
      default: ''
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String
    },
    contactInfo: {
      email: String,
      phone: String
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    staff: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      role: {
        type: String,
        enum: ['manager', 'cashier', 'inventory_manager', 'other']
      },
      permissions: [String]
    }],
    deliveryPersonnel: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      vehicleType: String,
      isAvailable: {
        type: Boolean,
        default: true
      }
    }],
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active'
    },
    categories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    }],
    paymentMethods: {
      cash: { type: Boolean, default: true },
      card: { type: Boolean, default: false },
      mobileMoney: { type: Boolean, default: false }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for products
shopSchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'shop'
});

// Indexes
shopSchema.index({ name: 'text', description: 'text' });
shopSchema.index({ owner: 1 });
shopSchema.index({ status: 1 });

const Shop = mongoose.model('Shop', shopSchema);

module.exports = Shop;