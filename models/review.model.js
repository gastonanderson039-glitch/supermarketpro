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
    deliveryPersonnel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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
        url: {
          type: String,
          required: true,
        },
        caption: String,
      },
    ],
    type: {
      type: String,
      enum: ['product', 'shop', 'delivery'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'hidden'],
      default: 'pending',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedPurchase: {
      type: Boolean,
      default: false,
    },
    moderationNotes: String,
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    moderatedAt: Date,
    vendorResponse: {
      comment: String,
      timestamp: Date,
      respondedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    },
    isHelpful: {
      count: {
        type: Number,
        default: 0,
      },
      users: [
        {
          user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
          },
          helpful: {
            type: Boolean,
            default: true,
          },
          timestamp: {
            type: Date,
            default: Date.now,
          },
        },
      ],
    },
    isReported: {
      type: Boolean,
      default: false,
    },
    reports: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        reason: {
          type: String,
          enum: ['inappropriate', 'spam', 'offensive', 'irrelevant', 'false_information', 'other'],
        },
        details: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
          default: 'pending',
        },
      },
    ],
    attributes: [
      {
        name: {
          type: String,
          required: true,
        },
        value: {
          type: Number,
          min: 1,
          max: 5,
        },
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    language: {
      type: String,
      default: 'en',
    },
    visibility: {
      type: String,
      enum: ['public', 'private', 'unlisted'],
      default: 'public',
    },
    featured: {
      type: Boolean,
      default: false,
    },
    editHistory: [
      {
        previousComment: String,
        previousRating: Number,
        editedAt: {
          type: Date,
          default: Date.now,
        },
        editedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        reason: String,
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// A user can only review a product once per order
reviewSchema.index({ user: 1, product: 1, order: 1 }, { unique: true, sparse: true });
reviewSchema.index({ user: 1, shop: 1, order: 1 }, { unique: true, sparse: true });
reviewSchema.index({ user: 1, deliveryPersonnel: 1, order: 1 }, { unique: true, sparse: true });

// Update product rating after review is saved
reviewSchema.post('save', async function () {
  if (this.type === 'product' && this.product) {
    const Product = this.model('Product');
    const product = await Product.findById(this.product);
    
    if (product) {
      const reviews = await this.model('Review').find({ 
        product: this.product,
        status: 'approved',
        visibility: 'public'
      });
      
      if (reviews.length > 0) {
        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = totalRating / reviews.length;
        
        await Product.findByIdAndUpdate(this.product, {
          rating: averageRating,
          totalReviews: reviews.length,
        });
      }
    }
  } else if (this.type === 'shop' && this.shop) {
    const Shop = this.model('Shop');
    const shop = await Shop.findById(this.shop);
    
    if (shop) {
      const reviews = await this.model('Review').find({ 
        shop: this.shop,
        status: 'approved',
        visibility: 'public'
      });
      
      if (reviews.length > 0) {
        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = totalRating / reviews.length;
        
        await Shop.findByIdAndUpdate(this.shop, {
          rating: averageRating,
          totalReviews: reviews.length,
        });
      }
    }
  } else if (this.type === 'delivery' && this.deliveryPersonnel) {
    const User = this.model('User');
    const deliveryPerson = await User.findById(this.deliveryPersonnel);
    
    if (deliveryPerson && deliveryPerson.deliveryPersonnelDetails) {
      const reviews = await this.model('Review').find({ 
        deliveryPersonnel: this.deliveryPersonnel,
        status: 'approved',
        visibility: 'public'
      });
      
      if (reviews.length > 0) {
        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = totalRating / reviews.length;
        
        await User.findByIdAndUpdate(this.deliveryPersonnel, {
          'deliveryPersonnelDetails.ratings.average': averageRating,
          'deliveryPersonnelDetails.ratings.count': reviews.length,
        });
      }
    }
  }
  
  // Update order if review is associated with an order
  if (this.order) {
    const Order = this.model('Order');
    const order = await Order.findById(this.order);
    
    if (order) {
      if (this.type === 'product') {
        await Order.findByIdAndUpdate(this.order, {
          'ratings.product.rating': this.rating,
          'ratings.product.comment': this.comment,
          'ratings.product.date': new Date(),
        });
        
        // Mark the specific item as reviewed
        if (this.product) {
          await Order.findOneAndUpdate(
            { _id: this.order, 'items.product': this.product },
            { 'items.$.isReviewed': true }
          );
        }
      } else if (this.type === 'shop') {
        await Order.findByIdAndUpdate(this.order, {
          'ratings.shop.rating': this.rating,
          'ratings.shop.comment': this.comment,
          'ratings.shop.date': new Date(),
        });
      } else if (this.type === 'delivery') {
        await Order.findByIdAndUpdate(this.order, {
          'ratings.delivery.rating': this.rating,
          'ratings.delivery.comment': this.comment,
          'ratings.delivery.date': new Date(),
        });
      }
    }
  }
});

// Indexes for efficient querying
reviewSchema.index({ product: 1, status: 1 });
reviewSchema.index({ shop: 1, status: 1 });
reviewSchema.index({ deliveryPersonnel: 1, status: 1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ featured: 1 });
reviewSchema.index({ isReported: 1 });

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;