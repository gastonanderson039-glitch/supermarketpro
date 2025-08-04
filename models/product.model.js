const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    // Basic product info
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true
    },
    description: String,

    // Shop relationship
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: true
    },

    // Pricing
    price: {
      type: Number,
      required: true,
      min: 0
    },
    comparePrice: Number, // Original price for showing discounts
    costPrice: Number,   // What the shop paid

    // Inventory
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    sku: String,         // Stock keeping unit
    barcode: String,

    // Media
    images: [{
      url: String,
      alt: String
    }],

    // Organization
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    tags: [String],

    // Product status
    isActive: {
      type: Boolean,
      default: true
    },
    isFeatured: Boolean,
    isBestseller: Boolean,

    // Variants
    options: [{
      name: String,      // e.g. "Color", "Size"
      values: [String]   // e.g. ["Red", "Blue"], ["S", "M", "L"]
    }],
    images: [{
      url: String,
      alt: String
    }],
    variants: [{
      options: {         // e.g. {Color: "Red", Size: "M"}
        type: Map,
        of: String
      },
      price: Number,
      stock: Number,
      sku: String
    }],

    // Analytics
    views: {
      type: Number,
      default: 0
    },
    sales: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Auto-generate slug
productSchema.pre('save', async function (next) {
  if (!this.slug) {
    let baseSlug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    let slug = baseSlug;
    let counter = 1;

    // Check for uniqueness
    while (await Product.exists({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    this.slug = slug;
  }

  next();
});


// Virtual for reviews
productSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'product'
});

// Indexes for faster queries
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ shop: 1 });
productSchema.index({ category: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ isBestseller: 1 });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;