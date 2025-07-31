const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    transactions: [
      {
        type: {
          type: String,
          enum: ['credit', 'debit', 'refund', 'adjustment', 'bonus', 'withdrawal'],
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
        description: {
          type: String,
          required: true,
        },
        reference: {
          model: {
            type: String,
            enum: ['Order', 'Payment', 'Refund', 'Withdrawal', 'Deposit'],
          },
          id: {
            type: mongoose.Schema.Types.ObjectId,
          },
        },
        status: {
          type: String,
          enum: ['pending', 'completed', 'failed', 'cancelled'],
          default: 'completed',
        },
        metadata: {
          type: Map,
          of: mongoose.Schema.Types.Mixed,
        },
        balanceAfter: {
          type: Number,
          required: true,
        },
        processedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    withdrawalSettings: {
      minAmount: {
        type: Number,
        default: 10,
      },
      maxAmount: {
        type: Number,
        default: 1000,
      },
      processingFee: {
        type: Number,
        default: 0,
      },
      processingTime: {
        type: String,
        default: '3-5 business days',
      },
      paymentMethods: [
        {
          type: {
            type: String,
            enum: ['bank_transfer', 'paypal', 'stripe', 'other'],
          },
          isDefault: {
            type: Boolean,
            default: false,
          },
          details: {
            type: Map,
            of: String,
          },
        },
      ],
    },
    pendingWithdrawals: {
      type: Number,
      default: 0,
    },
    lastWithdrawal: Date,
    lastDeposit: Date,
  },
  {
    timestamps: true,
  }
);

// Add transaction method
walletSchema.methods.addTransaction = async function(transactionData) {
  const { type, amount, description, reference, metadata, processedBy } = transactionData;
  
  // Calculate new balance
  let newBalance = this.balance;
  
  if (type === 'credit' || type === 'refund' || type === 'bonus') {
    newBalance += amount;
  } else if (type === 'debit' || type === 'withdrawal') {
    if (amount > this.balance) {
      throw new Error('Insufficient balance');
    }
    newBalance -= amount;
  } else if (type === 'adjustment') {
    // Adjustment can be positive or negative
    newBalance += amount;
    if (newBalance < 0) {
      throw new Error('Adjustment would result in negative balance');
    }
  }
  
  // Create transaction
  const transaction = {
    type,
    amount,
    description,
    reference,
    metadata,
    processedBy,
    balanceAfter: newBalance,
    createdAt: new Date(),
  };
  
  // Add transaction to array
  this.transactions.push(transaction);
  
  // Update balance
  this.balance = newBalance;
  
  // Update last withdrawal or deposit date
  if (type === 'withdrawal') {
    this.lastWithdrawal = new Date();
  } else if (type === 'credit' || type === 'bonus') {
    this.lastDeposit = new Date();
  }
  
  // Save wallet
  await this.save();
  
  return transaction;
};

// Static method to get or create wallet
walletSchema.statics.getOrCreate = async function(userId) {
  let wallet = await this.findOne({ user: userId });
  
  if (!wallet) {
    wallet = new this({
      user: userId,
      balance: 0,
    });
    await wallet.save();
  }
  
  return wallet;
};

// Indexes for efficient querying
walletSchema.index({ user: 1 }, { unique: true });
walletSchema.index({ balance: 1 });
walletSchema.index({ 'transactions.createdAt': -1 });
walletSchema.index({ 'transactions.type': 1 });
walletSchema.index({ 'transactions.status': 1 });
walletSchema.index({ 'transactions.reference.model': 1, 'transactions.reference.id': 1 });

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;