const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
    },
    icon: {
      type: String,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    level: {
      type: Number,
      default: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
    },
    isGlobal: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    attributes: [
      {
        name: {
          type: String,
          required: true,
        },
        values: [String],
        isRequired: {
          type: Boolean,
          default: false,
        },
        isFilterable: {
          type: Boolean,
          default: true,
        },
      },
    ],
    metaTitle: String,
    metaDescription: String,
    metaKeywords: [String],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for subcategories
categorySchema.virtual('subcategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent',
});

// Virtual for products
categorySchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'category',
});

// Generate slug from name before saving
categorySchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Update level based on parent
categorySchema.pre('save', async function(next) {
  if (this.parent) {
    try {
      const parentCategory = await this.constructor.findById(this.parent);
      if (parentCategory) {
        this.level = parentCategory.level + 1;
      }
    } catch (error) {
      return next(error);
    }
  } else {
    this.level = 1;
  }
  next();
});

// Indexes for efficient querying
categorySchema.index({ slug: 1 });
categorySchema.index({ parent: 1 });
categorySchema.index({ shop: 1, isActive: 1 });
categorySchema.index({ name: 'text', description: 'text' });

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;