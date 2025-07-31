const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

// Import controllers (to be implemented)
const {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  applyCoupon,
  removeCoupon,
  getCartSummary,
  mergeGuestCart,
  saveCart,
  getSavedCarts,
  loadSavedCart
} = require('../controllers/cart.controller');

// Routes
router.route('/')
  .get(getCart)
  .post(addToCart)
  .delete(clearCart);

router.route('/items/:itemId')
  .put(updateCartItem)
  .delete(removeCartItem);

router.route('/coupon')
  .post(applyCoupon)
  .delete(removeCoupon);

router.route('/summary')
  .get(getCartSummary);

router.route('/merge')
  .post(protect, mergeGuestCart);

router.route('/save')
  .post(protect, saveCart);

router.route('/saved')
  .get(protect, getSavedCarts);

router.route('/saved/:cartId')
  .post(protect, loadSavedCart);

module.exports = router;