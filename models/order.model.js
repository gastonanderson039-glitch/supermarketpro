const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
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
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        name: String,
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
        },
        totalPrice: {
          type: Number,
          required: true,
        },
      },
    ],
    subtotal: {
      type: Number,
      required: true,
    },
    tax: {
      type: Number,
      default: 0,
    },
    deliveryFee: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'paypal'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    paymentDetails: {
      transactionId: String,
      provider: String,
      amount: Number,
      date: Date,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
      default: 'pending',
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        note: String,
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      },
    ],
    shippingAddress: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    deliveryPersonnel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    deliveryType: {
      type: String,
      enum: ['shop', 'global'],
      default: 'shop',
    },
    scheduledDelivery: {
      date: Date,
      timeSlot: String,
    },
    notes: String,
    invoiceUrl: String,
    qrCode: String,
    isRated: {
      type: Boolean,
      default: false,
    },
    cancellationReason: String,
    returnReason: String,
  },
  {
    timestamps: true,
  }
);

// Generate order number before saving
orderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    // Find the latest order to increment the counter
    const latestOrder = await this.constructor.findOne({}, {}, { sort: { 'createdAt': -1 } });
    let counter = 1;
    
    if (latestOrder && latestOrder.orderNumber) {
      const latestCounter = parseInt(latestOrder.orderNumber.substr(-4));
      if (!isNaN(latestCounter)) {
        counter = latestCounter + 1;
      }
    }
    
    this.orderNumber = `ORD-${year}${month}${day}-${counter.toString().padStart(4, '0')}`;
  }
  next();
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;