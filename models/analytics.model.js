const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['shop', 'platform', 'product', 'category'],
      required: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'referenceModel',
    },
    referenceModel: {
      type: String,
      enum: ['Shop', 'Product'],
      required: function() {
        return this.type !== 'platform';
      },
    },
    date: {
      type: Date,
      required: true,
    },
    period: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly'],
      required: true,
    },
    metrics: {
      sales: {
        count: {
          type: Number,
          default: 0,
        },
        amount: {
          type: Number,
          default: 0,
        },
      },
      orders: {
        count: {
          type: Number,
          default: 0,
        },
        averageValue: {
          type: Number,
          default: 0,
        },
      },
      customers: {
        new: {
          type: Number,
          default: 0,
        },
        returning: {
          type: Number,
          default: 0,
        },
        total: {
          type: Number,
          default: 0,
        },
      },
      products: {
        viewed: {
          type: Number,
          default: 0,
        },
        sold: {
          type: Number,
          default: 0,
        },
        topSelling: [
          {
            productId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'Product',
            },
            count: Number,
            amount: Number,
          },
        ],
      },
      categories: [
        {
          name: String,
          count: Number,
          amount: Number,
        },
      ],
      revenue: {
        gross: {
          type: Number,
          default: 0,
        },
        net: {
          type: Number,
          default: 0,
        },
        platformFees: {
          type: Number,
          default: 0,
        },
        deliveryFees: {
          type: Number,
          default: 0,
        },
      },
      conversion: {
        rate: {
          type: Number,
          default: 0,
        },
        cartAbandonment: {
          type: Number,
          default: 0,
        },
      },
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient querying
analyticsSchema.index({ type: 1, referenceId: 1, date: 1, period: 1 }, { unique: true });

const Analytics = mongoose.model('Analytics', analyticsSchema);

module.exports = Analytics;