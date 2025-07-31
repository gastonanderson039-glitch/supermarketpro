const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// Import controllers (to be implemented)
const {
  getDeliveries,
  getDeliveryById,
  createDelivery,
  updateDelivery,
  deleteDelivery,
  assignDelivery,
  updateDeliveryStatus,
  updateDeliveryLocation,
  getDeliveryPersonnel,
  getAvailableDeliveryPersonnel,
  uploadDeliveryProof
} = require('../controllers/delivery.controller');

// Routes
router.route('/')
  .get(protect, getDeliveries)
  .post(protect, authorize('admin', 'vendor', 'staff'), createDelivery);

router.route('/:id')
  .get(protect, getDeliveryById)
  .put(protect, authorize('admin', 'vendor', 'staff', 'delivery', 'global_delivery'), updateDelivery)
  .delete(protect, authorize('admin', 'vendor'), deleteDelivery);

router.route('/:id/assign')
  .post(protect, authorize('admin', 'vendor', 'staff'), assignDelivery);

router.route('/:id/status')
  .put(protect, authorize('admin', 'vendor', 'staff', 'delivery', 'global_delivery'), updateDeliveryStatus);

router.route('/:id/location')
  .put(protect, authorize('delivery', 'global_delivery'), updateDeliveryLocation);

router.route('/:id/proof')
  .post(protect, authorize('delivery', 'global_delivery'), uploadDeliveryProof);

router.route('/personnel')
  .get(protect, authorize('admin', 'vendor', 'staff'), getDeliveryPersonnel);

router.route('/personnel/available')
  .get(protect, authorize('admin', 'vendor', 'staff'), getAvailableDeliveryPersonnel);

module.exports = router;