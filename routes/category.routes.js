const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// Import controllers (to be implemented)
const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getSubcategories,
  getCategoryProducts
} = require('../controllers/category.controller');

// Routes
router.route('/')
  .get(getCategories)
  .post(protect, authorize('admin', 'vendor'), createCategory);

router.route('/:id')
  .get(getCategoryById)
  .put(protect, authorize('admin', 'vendor'), updateCategory)
  .delete(protect, authorize('admin'), deleteCategory);

router.route('/:id/subcategories')
  .get(getSubcategories);

router.route('/:id/products')
  .get(getCategoryProducts);

module.exports = router;