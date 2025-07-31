const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      trim: true,
    },
    comment: {
      type: String,
      required: [true, 'Review comment is required'],
    },
    images: [
      {
        type: String,
      },
    ],
    type: {
      type: String,
      enum: ['product', 'shop', 'delivery'],
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    vendorResponse: {
      comment: String,
      timestamp: Date,
    },
    isHelpful: {
      count: {
        type: Number,
        default: 0,
      },
      users: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
    },
    isReported: {
      type: Boolean,
      default: false,
    },
    reportReason: String,
  },
  {
    timestamps: true,
  }
);

// A user can only review a product once
reviewSchema.index({ user: 1, product: 1 }, { unique: true, sparse: true });
reviewSchema.index({ user: 1, shop: 1 }, { unique: true, sparse: true });

// Update product rating after review is saved
reviewSchema.post('save', async function () {
  if (this.type === 'product' && this.product) {
    const Product = this.model('Product');
    const product = await Product.findById(this.product);
    
    if (product) {
      const reviews = await this.model('Review').find({ product: this.product });
      const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = totalRating / reviews.length;
      
      await Product.findByIdAndUpdate(this.product, {
        rating: averageRating,
        totalReviews: reviews.length,
      });
    }
  } else if (this.type === 'shop' && this.shop) {
    const Shop = this.model('Shop');
    const shop = await Shop.findById(this.shop);
    
    if (shop) {
      const reviews = await this.model('Review').find({ shop: this.shop });
      const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = totalRating / reviews.length;
      
      await Shop.findByIdAndUpdate(this.shop, {
        rating: averageRating,
        totalReviews: reviews.length,
      });
    }
  }
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;