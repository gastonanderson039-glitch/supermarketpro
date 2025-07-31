const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// Import controllers (to be implemented)
const {
  getInventory,
  getInventoryById,
  createInventory,
  updateInventory,
  deleteInventory,
  adjustStock,
  getLowStockItems,
  getInventoryByShop,
  getInventoryByProduct,
  getInventoryTransactions,
  importInventory,
  exportInventory
} = require('../controllers/inventory.controller');

// Routes
router.route('/')
  .get(protect, authorize('admin', 'vendor', 'staff'), getInventory)
  .post(protect, authorize('admin', 'vendor', 'staff'), createInventory);

router.route('/:id')
  .get(protect, authorize('admin', 'vendor', 'staff'), getInventoryById)
  .put(protect, authorize('admin', 'vendor', 'staff'), updateInventory)
  .delete(protect, authorize('admin', 'vendor'), deleteInventory);

router.route('/:id/adjust')
  .post(protect, authorize('admin', 'vendor', 'staff'), adjustStock);

router.route('/low-stock')
  .get(protect, authorize('admin', 'vendor', 'staff'), getLowStockItems);

router.route('/shop/:shopId')
  .get(protect, authorize('admin', 'vendor', 'staff'), getInventoryByShop);

router.route('/product/:productId')
  .get(protect, authorize('admin', 'vendor', 'staff'), getInventoryByProduct);

router.route('/:id/transactions')
  .get(protect, authorize('admin', 'vendor', 'staff'), getInventoryTransactions);

router.route('/import')
  .post(protect, authorize('admin', 'vendor'), importInventory);

router.route('/export')
  .get(protect, authorize('admin', 'vendor', 'staff'), exportInventory);

module.exports = router;