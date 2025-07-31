const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    deliveryPersonnel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled'],
      default: 'assigned',
    },
    type: {
      type: String,
      enum: ['shop', 'global'],
      required: true,
    },
    startTime: Date,
    endTime: Date,
    estimatedDeliveryTime: Date,
    actualDeliveryTime: Date,
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
      lastUpdated: Date,
    },
    route: [
      {
        location: {
          type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
          },
          coordinates: [Number],
        },
        timestamp: Date,
      },
    ],
    notes: String,
    deliveryProof: {
      image: String,
      signature: String,
      timestamp: Date,
      notes: String,
    },
    failureReason: String,
    rating: {
      score: {
        type: Number,
        min: 1,
        max: 5,
      },
      comment: String,
      timestamp: Date,
    },
    earnings: {
      amount: Number,
      currency: {
        type: String,
        default: 'USD',
      },
      paid: {
        type: Boolean,
        default: false,
      },
      paidDate: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for geospatial queries
deliverySchema.index({ 'location': '2dsphere' });
deliverySchema.index({ order: 1, deliveryPersonnel: 1 }, { unique: true });

const Delivery = mongoose.model('Delivery', deliverySchema);

module.exports = Delivery;