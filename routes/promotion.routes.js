const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// Import controllers (to be implemented)
const {
  getPromotions,
  getPromotionById,
  createPromotion,
  updatePromotion,
  deletePromotion,
  validateCoupon,
  getActivePromotions,
  getShopPromotions,
  applyPromotion
} = require('../controllers/promotion.controller');

// Routes
router.route('/')
  .get(getPromotions)
  .post(protect, authorize('admin', 'vendor'), createPromotion);

router.route('/:id')
  .get(getPromotionById)
  .put(protect, authorize('admin', 'vendor'), updatePromotion)
  .delete(protect, authorize('admin', 'vendor'), deletePromotion);

router.route('/coupon/validate')
  .post(validateCoupon);

router.route('/active')
  .get(getActivePromotions);

router.route('/shop/:shopId')
  .get(getShopPromotions);

router.route('/apply')
  .post(protect, applyPromotion);

module.exports = router;