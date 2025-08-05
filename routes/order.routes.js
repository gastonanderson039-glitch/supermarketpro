// routes/order.routes.js
const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrder,
  updateShopOrderStatus,
  getShopOrders,
  getCustomerOrders
} = require('../controllers/order.controller');
const { protect, authorize } = require('../middleware/auth');
// const advancedResults = require('../middleware/advancedResults');

router.post('/', protect, createOrder);
// router.get('/', protect, authorize('admin'), advancedResults(Order), getOrders);
router.get('/', protect, authorize('admin'), getOrders);
router.get('/:id', protect, getOrder);
router.put('/:orderId/status/:shopId', protect, authorize('admin', 'vendor'), updateShopOrderStatus);
router.get('/shop/:shopId', protect, getShopOrders);
router.get('/customer/:customerId', protect, getCustomerOrders);

module.exports = router;