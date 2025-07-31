const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// Import controllers (to be implemented)
const {
  getWallet,
  addFunds,
  withdrawFunds,
  getTransactions,
  getTransactionById,
  updateWithdrawalSettings,
  getWithdrawalSettings,
  getWalletBalance,
  transferFunds
} = require('../controllers/wallet.controller');

// Routes
router.route('/')
  .get(protect, getWallet);

router.route('/balance')
  .get(protect, getWalletBalance);

router.route('/add-funds')
  .post(protect, addFunds);

router.route('/withdraw')
  .post(protect, withdrawFunds);

router.route('/transactions')
  .get(protect, getTransactions);

router.route('/transactions/:id')
  .get(protect, getTransactionById);

router.route('/withdrawal-settings')
  .get(protect, getWithdrawalSettings)
  .put(protect, updateWithdrawalSettings);

router.route('/transfer')
  .post(protect, transferFunds);

module.exports = router;