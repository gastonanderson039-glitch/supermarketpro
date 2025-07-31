const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// Import controllers (to be implemented)
const {
  getDashboardStats,
  getSalesAnalytics,
  getProductAnalytics,
  getCustomerAnalytics,
  getShopAnalytics,
  getDeliveryAnalytics,
  getRevenueAnalytics,
  getInventoryAnalytics,
  getCustomAnalytics
} = require('../controllers/analytics.controller');

// Routes
router.route('/dashboard')
  .get(protect, authorize('admin', 'vendor', 'staff'), getDashboardStats);

router.route('/sales')
  .get(protect, authorize('admin', 'vendor', 'staff'), getSalesAnalytics);

router.route('/products')
  .get(protect, authorize('admin', 'vendor', 'staff'), getProductAnalytics);

router.route('/customers')
  .get(protect, authorize('admin', 'vendor'), getCustomerAnalytics);

router.route('/shops')
  .get(protect, authorize('admin'), getShopAnalytics);

router.route('/delivery')
  .get(protect, authorize('admin', 'vendor', 'staff'), getDeliveryAnalytics);

router.route('/revenue')
  .get(protect, authorize('admin', 'vendor'), getRevenueAnalytics);

router.route('/inventory')
  .get(protect, authorize('admin', 'vendor', 'staff'), getInventoryAnalytics);

router.route('/custom')
  .post(protect, authorize('admin', 'vendor'), getCustomAnalytics);

module.exports = router;