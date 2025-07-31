const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// Admin routes
router.route('/')
  .get(protect, authorize('admin'), userController.getUsers)
  .post(protect, authorize('admin'), userController.createUser);

router.route('/:id')
  .get(protect, authorize('admin'), userController.getUserById)
  .put(protect, authorize('admin'), userController.updateUser)
  .delete(protect, authorize('admin'), userController.deleteUser);

// User address routes (for all authenticated users)
router.route('/address')
  .post(protect, userController.addAddress);

router.route('/address/:addressId')
  .put(protect, userController.updateAddress)
  .delete(protect, userController.deleteAddress);

module.exports = router;