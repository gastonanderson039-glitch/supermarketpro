const express = require('express');
const router = express.Router();
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus
} = require('../controllers/category.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// Public routes
router.get('/', getCategories);
router.get('/:id', getCategory);

// Protected admin routes
router.post('/', createCategory);
router.put('/:id', protect, authorize('admin'), updateCategory);
router.delete('/:id', protect, authorize('admin'), deleteCategory);
router.patch('/:id/status', protect, authorize('admin'), toggleCategoryStatus);

module.exports = router;