const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
    },
    shortDescription: {
      type: String,
      maxlength: [200, 'Short description cannot be more than 200 characters'],
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
    costPrice: {
      type: Number,
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        alt: String,
        isDefault: {
          type: Boolean,
          default: false,
        },
        order: {
          type: Number,
          default: 0,
        },
      },
    ],
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
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
    unitValue: {
      type: Number,
      default: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isNew: {
      type: Boolean,
      default: true,
    },
    isBestseller: {
      type: Boolean,
      default: false,
    },
    isOnSale: {
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
    totalSales: {
      type: Number,
      default: 0,
    },
    attributes: [
      {
        name: {
          type: String,
          required: true,
        },
        value: {
          type: String,
          required: true,
        },
        visible: {
          type: Boolean,
          default: true,
        },
      },
    ],
    variants: [
      {
        name: String,
        options: [
          {
            name: String,
            price: Number,
            comparePrice: Number,
            stock: Number,
            sku: String,
            barcode: String,
            images: [String],
            isActive: {
              type: Boolean,
              default: true,
            },
          },
        ],
      },
    ],
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
        minQuantity: {
          type: Number,
          default: 1,
        },
        maxQuantity: Number,
        usageLimit: Number,
        currentUsage: {
          type: Number,
          default: 0,
        },
      },
    ],
    seo: {
      metaTitle: String,
      metaDescription: String,
      metaKeywords: [String],
    },
    nutritionalInfo: {
      calories: Number,
      protein: Number,
      carbohydrates: Number,
      fat: Number,
      fiber: Number,
      sugar: Number,
      sodium: Number,
      servingSize: String,
      ingredients: [String],
      allergens: [String],
    },
    shippingInfo: {
      weight: Number,
      dimensions: {
        length: Number,
        width: Number,
        height: Number,
      },
      shippingClass: String,
      requiresSpecialHandling: {
        type: Boolean,
        default: false,
      },
      isFragile: {
        type: Boolean,
        default: false,
      },
    },
    taxInfo: {
      taxable: {
        type: Boolean,
        default: true,
      },
      taxClass: String,
      taxRate: Number,
    },
    availability: {
      inStock: {
        type: Boolean,
        default: true,
      },
      availableFrom: Date,
      availableUntil: Date,
      backorderAllowed: {
        type: Boolean,
        default: false,
      },
      preorderAllowed: {
        type: Boolean,
        default: false,
      },
      estimatedDelivery: String,
    },
    relatedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    crossSellProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    upsellProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    warranty: {
      available: {
        type: Boolean,
        default: false,
      },
      duration: String,
      description: String,
    },
    returnable: {
      type: Boolean,
      default: true,
    },
    returnPeriod: {
      type: Number, // in days
      default: 30,
    },
    minimumOrderQuantity: {
      type: Number,
      default: 1,
    },
    maximumOrderQuantity: Number,
    viewCount: {
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

// Generate slug from name before saving
productSchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    // Add a random string to ensure uniqueness
    const randomString = Math.random().toString(36).substring(2, 8);
    this.slug = `${this.slug}-${randomString}`;
  }
  
  // Set availability.inStock based on stock
  if (this.isModified('stock')) {
    this.availability.inStock = this.stock > 0;
  }
  
  next();
});

// Virtual for reviews
productSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'product',
});

// Virtual for inventory
productSchema.virtual('inventory', {
  ref: 'Inventory',
  localField: '_id',
  foreignField: 'product',
  justOne: true,
});

// Index for text search
productSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Other indexes for efficient querying
productSchema.index({ slug: 1 });
productSchema.index({ shop: 1 });
productSchema.index({ category: 1 });
productSchema.index({ subcategory: 1 });
productSchema.index({ price: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ isNew: 1 });
productSchema.index({ isBestseller: 1 });
productSchema.index({ isOnSale: 1 });
productSchema.index({ 'availability.inStock': 1 });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;