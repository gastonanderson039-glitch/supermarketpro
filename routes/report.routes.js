const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// Import controllers (to be implemented)
const {
  getReports,
  getReportById,
  createReport,
  deleteReport,
  downloadReport,
  scheduleReport,
  updateSchedule,
  getScheduledReports,
  generateSalesReport,
  generateRevenueReport,
  generateProductReport,
  generateCustomerReport,
  generateInventoryReport
} = require('../controllers/report.controller');

// Routes
router.route('/')
  .get(protect, authorize('admin', 'vendor'), getReports)
  .post(protect, authorize('admin', 'vendor'), createReport);

router.route('/:id')
  .get(protect, authorize('admin', 'vendor'), getReportById)
  .delete(protect, authorize('admin', 'vendor'), deleteReport);

router.route('/:id/download')
  .get(protect, authorize('admin', 'vendor'), downloadReport);

router.route('/schedule')
  .post(protect, authorize('admin', 'vendor'), scheduleReport)
  .get(protect, authorize('admin', 'vendor'), getScheduledReports);

router.route('/schedule/:id')
  .put(protect, authorize('admin', 'vendor'), updateSchedule);

router.route('/generate/sales')
  .post(protect, authorize('admin', 'vendor'), generateSalesReport);

router.route('/generate/revenue')
  .post(protect, authorize('admin', 'vendor'), generateRevenueReport);

router.route('/generate/products')
  .post(protect, authorize('admin', 'vendor'), generateProductReport);

router.route('/generate/customers')
  .post(protect, authorize('admin', 'vendor'), generateCustomerReport);

router.route('/generate/inventory')
  .post(protect, authorize('admin', 'vendor'), generateInventoryReport);

module.exports = router;