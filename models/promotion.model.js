const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Promotion name is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Promotion description is required'],
    },
    type: {
      type: String,
      enum: ['coupon', 'flash_sale', 'bundle', 'discount', 'free_shipping'],
      required: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true, // Allow null values to not conflict with uniqueness
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed_amount', 'free_item', 'buy_x_get_y'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: function() {
        return ['percentage', 'fixed_amount'].includes(this.discountType);
      },
      min: 0,
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
    },
    isGlobal: {
      type: Boolean,
      default: false,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    minimumPurchase: {
      type: Number,
      default: 0,
    },
    maximumDiscount: {
      type: Number,
      default: 0,
    },
    usageLimit: {
      perCustomer: {
        type: Number,
        default: 0, // 0 means unlimited
      },
      total: {
        type: Number,
        default: 0, // 0 means unlimited
      },
    },
    currentUsage: {
      type: Number,
      default: 0,
    },
    applicableProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    applicableCategories: [
      {
        type: String,
      },
    ],
    excludedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    customerGroups: [
      {
        type: String,
        enum: ['all', 'new', 'returning', 'vip'],
      },
    ],
    buyXGetY: {
      buyQuantity: {
        type: Number,
        min: 1,
      },
      getQuantity: {
        type: Number,
        min: 1,
      },
      freeProduct: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    },
    image: {
      type: String,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure promotion code is unique if provided
promotionSchema.pre('save', async function(next) {
  if (this.code) {
    const existingPromotion = await this.constructor.findOne({ 
      code: this.code,
      _id: { $ne: this._id } // Exclude current document when updating
    });
    
    if (existingPromotion) {
      const error = new Error('Promotion code already exists');
      error.statusCode = 400;
      return next(error);
    }
  }
  next();
});

// Index for efficient querying
promotionSchema.index({ code: 1 });
promotionSchema.index({ shop: 1, isActive: 1 });
promotionSchema.index({ startDate: 1, endDate: 1 });

const Promotion = mongoose.model('Promotion', promotionSchema);

module.exports = Promotion;