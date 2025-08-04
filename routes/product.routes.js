const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsByShop,
  getProductsByCategory,
  toggleProductStatus,
  updateInventory,
  getFeaturedProducts,
  getBestsellerProducts
} = require('../controllers/product.controller');
const { protect, authorize } = require('../middleware/auth');

// Public routes
router.get('/', getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/bestsellers', getBestsellerProducts);
router.get('/:id', getProduct);
router.get('/shops/:shopId', getProductsByShop);
router.get('/categories/:categoryId', getProductsByCategory);

// Protected routes
router.post('/', protect, authorize('vendor', 'admin'), createProduct);
router.put('/:id', protect, authorize('vendor', 'admin'), updateProduct);
router.put('/:id/status', protect, authorize('vendor', 'admin'), toggleProductStatus);
router.put('/:id/inventory', protect, authorize('vendor', 'admin'), updateInventory);
router.delete('/:id', protect, authorize('vendor', 'admin'), deleteProduct);

module.exports = router;