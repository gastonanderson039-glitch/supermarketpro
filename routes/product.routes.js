const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// Public routes
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);

// Protected routes
router.post('/', protect, authorize('vendor', 'staff', 'admin'), productController.createProduct);
router.put('/:id', protect, authorize('vendor', 'staff', 'admin'), productController.updateProduct);
router.delete('/:id', protect, authorize('vendor', 'admin'), productController.deleteProduct);

// Stock management
router.patch('/:id/stock', protect, authorize('vendor', 'staff', 'admin'), productController.updateStock);

// Discount management
router.post('/:id/discount', protect, authorize('vendor', 'admin'), productController.addDiscount);

module.exports = router;