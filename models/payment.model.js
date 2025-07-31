const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    method: {
      type: String,
      enum: ['cash', 'card', 'paypal', 'bank_transfer', 'wallet'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded'],
      default: 'pending',
    },
    transactionId: {
      type: String,
    },
    provider: {
      type: String,
      enum: ['stripe', 'paypal', 'cash', 'bank', 'platform_wallet'],
      required: true,
    },
    paymentDetails: {
      type: mongoose.Schema.Types.Mixed,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
    },
    platformFee: {
      type: Number,
      default: 0,
    },
    shopAmount: {
      type: Number,
      required: true,
    },
    refunds: [
      {
        amount: {
          type: Number,
          required: true,
        },
        reason: String,
        status: {
          type: String,
          enum: ['pending', 'processed', 'failed'],
          default: 'pending',
        },
        transactionId: String,
        processedAt: Date,
        processedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      },
    ],
    payoutStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    payoutDate: Date,
    payoutReference: String,
    billingAddress: {
      name: String,
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    invoiceUrl: String,
    receiptUrl: String,
    notes: String,
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
paymentSchema.index({ order: 1 }, { unique: true });
paymentSchema.index({ customer: 1 });
paymentSchema.index({ shop: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ transactionId: 1 });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;