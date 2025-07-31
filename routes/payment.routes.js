const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// Import controllers (to be implemented)
const {
  getPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  processPayment,
  refundPayment,
  getPaymentMethods,
  createPaymentIntent,
  verifyPayment,
  getPaymentsByOrder,
  getPaymentsByShop,
  getPaymentsByCustomer
} = require('../controllers/payment.controller');

// Routes
router.route('/')
  .get(protect, authorize('admin', 'vendor'), getPayments)
  .post(protect, createPayment);

router.route('/:id')
  .get(protect, getPaymentById)
  .put(protect, authorize('admin'), updatePayment);

router.route('/:id/process')
  .post(protect, processPayment);

router.route('/:id/refund')
  .post(protect, authorize('admin', 'vendor'), refundPayment);

router.route('/methods')
  .get(getPaymentMethods);

router.route('/intent')
  .post(protect, createPaymentIntent);

router.route('/verify')
  .post(protect, verifyPayment);

router.route('/order/:orderId')
  .get(protect, getPaymentsByOrder);

router.route('/shop/:shopId')
  .get(protect, authorize('admin', 'vendor', 'staff'), getPaymentsByShop);

router.route('/customer')
  .get(protect, getPaymentsByCustomer);

module.exports = router;