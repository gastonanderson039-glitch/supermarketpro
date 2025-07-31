const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// Import controllers (to be implemented)
const {
  getReviews,
  getReviewById,
  createReview,
  updateReview,
  deleteReview,
  getProductReviews,
  getShopReviews,
  getDeliveryPersonnelReviews,
  getUserReviews,
  respondToReview,
  markReviewHelpful,
  reportReview,
  moderateReview,
  getReportedReviews,
  getFeaturedReviews
} = require('../controllers/review.controller');

// Routes
router.route('/')
  .get(getReviews)
  .post(protect, createReview);

router.route('/:id')
  .get(getReviewById)
  .put(protect, updateReview)
  .delete(protect, authorize('admin', 'vendor'), deleteReview);

router.route('/product/:productId')
  .get(getProductReviews);

router.route('/shop/:shopId')
  .get(getShopReviews);

router.route('/delivery/:deliveryPersonnelId')
  .get(getDeliveryPersonnelReviews);

router.route('/user')
  .get(protect, getUserReviews);

router.route('/:id/respond')
  .post(protect, authorize('admin', 'vendor', 'staff'), respondToReview);

router.route('/:id/helpful')
  .post(protect, markReviewHelpful);

router.route('/:id/report')
  .post(protect, reportReview);

router.route('/:id/moderate')
  .put(protect, authorize('admin', 'vendor'), moderateReview);

router.route('/reported')
  .get(protect, authorize('admin', 'vendor'), getReportedReviews);

router.route('/featured')
  .get(getFeaturedReviews);

module.exports = router;