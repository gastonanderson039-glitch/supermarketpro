const Wallet = require('../models/wallet.model');
const User = require('../models/user.model');
const Shop = require('../models/shop.model');

// @desc    Get wallet
// @route   GET /api/wallet
// @access  Private
exports.getWallet = async (req, res) => {
  try {
    // Find or create wallet
    let wallet = await Wallet.findOne({ user: req.user._id });
    
    if (!wallet) {
      wallet = await Wallet.create({
        user: req.user._id,
        balance: 0,
      });
    }
    
    // Get recent transactions
    const transactions = await wallet.getRecentTransactions(10);
    
    res.status(200).json({
      status: 'success',
      data: {
        wallet,
        transactions,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get wallet balance
// @route   GET /api/wallet/balance
// @access  Private
exports.getWalletBalance = async (req, res) => {
  try {
    // Find or create wallet
    let wallet = await Wallet.findOne({ user: req.user._id });
    
    if (!wallet) {
      wallet = await Wallet.create({
        user: req.user._id,
        balance: 0,
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        balance: wallet.balance,
        currency: wallet.currency,
        pendingBalance: wallet.pendingBalance,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Add funds to wallet
// @route   POST /api/wallet/add-funds
// @access  Private
exports.addFunds = async (req, res) => {
  try {
    const { 
      amount, 
      method, 
      transactionId,
      notes
    } = req.body;
    
    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Amount must be greater than 0',
      });
    }
    
    // Find or create wallet
    let wallet = await Wallet.findOne({ user: req.user._id });
    
    if (!wallet) {
      wallet = await Wallet.create({
        user: req.user._id,
        balance: 0,
      });
    }
    
    // Add transaction
    const transaction = await wallet.addTransaction({
      type: 'deposit',
      amount,
      method: method || 'card',
      status: 'completed',
      reference: transactionId,
      notes,
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        wallet,
        transaction,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Withdraw funds from wallet
// @route   POST /api/wallet/withdraw
// @access  Private
exports.withdrawFunds = async (req, res) => {
  try {
    const { 
      amount, 
      method, 
      accountDetails,
      notes
    } = req.body;
    
    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Amount must be greater than 0',
      });
    }
    
    // Find wallet
    const wallet = await Wallet.findOne({ user: req.user._id });
    
    if (!wallet) {
      return res.status(404).json({
        status: 'fail',
        message: 'Wallet not found',
      });
    }
    
    // Check if wallet has enough balance
    if (wallet.balance < amount) {
      return res.status(400).json({
        status: 'fail',
        message: 'Insufficient balance',
      });
    }
    
    // Check if withdrawal method is provided
    if (!method) {
      return res.status(400).json({
        status: 'fail',
        message: 'Withdrawal method is required',
      });
    }
    
    // Check if account details are provided
    if (!accountDetails) {
      return res.status(400).json({
        status: 'fail',
        message: 'Account details are required',
      });
    }
    
    // Add transaction
    const transaction = await wallet.addTransaction({
      type: 'withdrawal',
      amount: -amount,
      method,
      status: 'pending',
      accountDetails,
      notes,
    });
    
    // Update pending balance
    wallet.pendingBalance += amount;
    await wallet.save();
    
    res.status(200).json({
      status: 'success',
      data: {
        wallet,
        transaction,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get wallet transactions
// @route   GET /api/wallet/transactions
// @access  Private
exports.getTransactions = async (req, res) => {
  try {
    const { 
      type, 
      status, 
      startDate, 
      endDate,
      page = 1,
      limit = 10,
      sort = '-createdAt'
    } = req.query;
    
    // Find wallet
    const wallet = await Wallet.findOne({ user: req.user._id });
    
    if (!wallet) {
      return res.status(404).json({
        status: 'fail',
        message: 'Wallet not found',
      });
    }
    
    // Build query
    const query = { wallet: wallet._id };
    
    if (type) query.type = type;
    if (status) query.status = status;
    
    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    // Get transactions
    const transactions = await wallet.getTransactions(query, page, limit, sort);
    
    res.status(200).json({
      status: 'success',
      data: transactions,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get transaction by ID
// @route   GET /api/wallet/transactions/:id
// @access  Private
exports.getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find wallet
    const wallet = await Wallet.findOne({ user: req.user._id });
    
    if (!wallet) {
      return res.status(404).json({
        status: 'fail',
        message: 'Wallet not found',
      });
    }
    
    // Get transaction
    const transaction = await wallet.getTransactionById(id);
    
    if (!transaction) {
      return res.status(404).json({
        status: 'fail',
        message: 'Transaction not found',
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: transaction,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update withdrawal settings
// @route   PUT /api/wallet/withdrawal-settings
// @access  Private
exports.updateWithdrawalSettings = async (req, res) => {
  try {
    const { 
      defaultMethod, 
      bankAccount, 
      paypal,
      autoWithdrawal
    } = req.body;
    
    // Find user
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found',
      });
    }
    
    // Update withdrawal settings
    user.withdrawalSettings = {
      ...user.withdrawalSettings,
      defaultMethod: defaultMethod || user.withdrawalSettings?.defaultMethod,
      bankAccount: bankAccount || user.withdrawalSettings?.bankAccount,
      paypal: paypal || user.withdrawalSettings?.paypal,
      autoWithdrawal: autoWithdrawal !== undefined ? autoWithdrawal : user.withdrawalSettings?.autoWithdrawal,
    };
    
    await user.save();
    
    res.status(200).json({
      status: 'success',
      data: user.withdrawalSettings,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get withdrawal settings
// @route   GET /api/wallet/withdrawal-settings
// @access  Private
exports.getWithdrawalSettings = async (req, res) => {
  try {
    // Find user
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found',
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: user.withdrawalSettings || {},
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Transfer funds to another user
// @route   POST /api/wallet/transfer
// @access  Private
exports.transferFunds = async (req, res) => {
  try {
    const { 
      recipient, 
      amount, 
      notes
    } = req.body;
    
    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Amount must be greater than 0',
      });
    }
    
    // Validate recipient
    if (!recipient) {
      return res.status(400).json({
        status: 'fail',
        message: 'Recipient is required',
      });
    }
    
    // Check if recipient exists
    const recipientUser = await User.findById(recipient);
    
    if (!recipientUser) {
      return res.status(404).json({
        status: 'fail',
        message: 'Recipient not found',
      });
    }
    
    // Find sender wallet
    const senderWallet = await Wallet.findOne({ user: req.user._id });
    
    if (!senderWallet) {
      return res.status(404).json({
        status: 'fail',
        message: 'Wallet not found',
      });
    }
    
    // Check if sender has enough balance
    if (senderWallet.balance < amount) {
      return res.status(400).json({
        status: 'fail',
        message: 'Insufficient balance',
      });
    }
    
    // Find or create recipient wallet
    let recipientWallet = await Wallet.findOne({ user: recipient });
    
    if (!recipientWallet) {
      recipientWallet = await Wallet.create({
        user: recipient,
        balance: 0,
      });
    }
    
    // Add transaction to sender wallet
    const senderTransaction = await senderWallet.addTransaction({
      type: 'transfer',
      amount: -amount,
      status: 'completed',
      recipient,
      notes,
    });
    
    // Add transaction to recipient wallet
    const recipientTransaction = await recipientWallet.addTransaction({
      type: 'transfer',
      amount,
      status: 'completed',
      sender: req.user._id,
      notes,
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        wallet: senderWallet,
        transaction: senderTransaction,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};