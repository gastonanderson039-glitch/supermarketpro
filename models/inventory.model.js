const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
    },
    currentStock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    initialStock: {
      type: Number,
      required: true,
      min: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
      min: 0,
    },
    sku: {
      type: String,
      trim: true,
    },
    barcode: {
      type: String,
      trim: true,
    },
    location: {
      aisle: String,
      shelf: String,
      bin: String,
    },
    costPrice: {
      type: Number,
      min: 0,
    },
    supplierInfo: {
      name: String,
      contactPerson: String,
      email: String,
      phone: String,
      leadTime: Number, // in days
    },
    transactions: [
      {
        type: {
          type: String,
          enum: ['purchase', 'sale', 'return', 'adjustment', 'transfer', 'loss', 'stocktake'],
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        date: {
          type: Date,
          default: Date.now,
        },
        reference: {
          model: {
            type: String,
            enum: ['Order', 'Purchase', 'StockAdjustment'],
          },
          id: {
            type: mongoose.Schema.Types.ObjectId,
          },
        },
        notes: String,
        performedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      },
    ],
    expiryDates: [
      {
        batch: String,
        quantity: {
          type: Number,
          required: true,
          min: 0,
        },
        expiryDate: {
          type: Date,
          required: true,
        },
        receivedDate: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    status: {
      type: String,
      enum: ['in_stock', 'low_stock', 'out_of_stock', 'discontinued'],
      default: 'in_stock',
    },
    lastStocktakeDate: Date,
    nextStocktakeDate: Date,
    autoReorder: {
      enabled: {
        type: Boolean,
        default: false,
      },
      threshold: {
        type: Number,
        min: 0,
      },
      quantity: {
        type: Number,
        min: 1,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for product and shop
inventorySchema.index({ product: 1, shop: 1 }, { unique: true });

// Update inventory status based on stock levels
inventorySchema.pre('save', function(next) {
  if (this.currentStock <= 0) {
    this.status = 'out_of_stock';
  } else if (this.currentStock <= this.lowStockThreshold) {
    this.status = 'low_stock';
  } else {
    this.status = 'in_stock';
  }
  next();
});

const Inventory = mongoose.model('Inventory', inventorySchema);

module.exports = Inventory;