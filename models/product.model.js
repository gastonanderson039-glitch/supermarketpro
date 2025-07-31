const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: 0,
    },
    comparePrice: {
      type: Number,
      min: 0,
    },
    images: [
      {
        type: String,
      },
    ],
    category: {
      type: String,
      required: [true, 'Product category is required'],
    },
    subcategory: {
      type: String,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    stock: {
      type: Number,
      required: [true, 'Product stock is required'],
      min: 0,
      default: 0,
    },
    unit: {
      type: String,
      required: [true, 'Product unit is required'],
      enum: ['kg', 'g', 'l', 'ml', 'pcs', 'box', 'pack', 'bottle', 'can', 'other'],
      default: 'pcs',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
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
    attributes: {
      type: Map,
      of: String,
    },
    barcode: {
      type: String,
      trim: true,
    },
    sku: {
      type: String,
      trim: true,
    },
    weight: {
      value: Number,
      unit: {
        type: String,
        enum: ['kg', 'g'],
        default: 'g',
      },
    },
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
      unit: {
        type: String,
        enum: ['cm', 'in'],
        default: 'cm',
      },
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
    },
    discounts: [
      {
        type: {
          type: String,
          enum: ['percentage', 'fixed'],
        },
        value: Number,
        startDate: Date,
        endDate: Date,
        isActive: {
          type: Boolean,
          default: false,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for reviews
productSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'product',
});

// Index for text search
productSchema.index({ name: 'text', description: 'text', category: 'text', tags: 'text' });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;