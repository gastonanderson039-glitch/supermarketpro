const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shop.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// Public routes
router.get('/', shopController.getShops);
router.get('/:id', shopController.getShopById);

// Protected routes
router.post('/', protect, authorize('vendor', 'admin'), shopController.createShop);
router.put('/:id', protect, authorize('vendor', 'admin'), shopController.updateShop);
router.delete('/:id', protect, authorize('admin'), shopController.deleteShop);

// Staff management
router.post('/:id/staff', protect, authorize('vendor', 'admin'), shopController.addStaff);
router.delete('/:id/staff/:userId', protect, authorize('vendor', 'admin'), shopController.removeStaff);

module.exports = router;