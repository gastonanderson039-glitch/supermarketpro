const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// All order routes are protected
router.use(protect);

// Create order (all authenticated users)
router.post('/', orderController.createOrder);

// Get orders (all authenticated users, filtered by role)
router.get('/', orderController.getOrders);

// Get order by ID (authorized users only)
router.get('/:id', orderController.getOrderById);

// Update order status (shop staff, delivery, admin)
router.patch(
  '/:id/status',
  authorize('vendor', 'staff', 'delivery', 'admin'),
  orderController.updateOrderStatus
);

// Assign delivery personnel (shop staff, admin)
router.patch(
  '/:id/assign-delivery',
  authorize('vendor', 'staff', 'admin'),
  orderController.assignDelivery
);

// Update payment status (shop staff, admin)
router.patch(
  '/:id/payment',
  authorize('vendor', 'staff', 'admin'),
  orderController.updatePaymentStatus
);

module.exports = router;