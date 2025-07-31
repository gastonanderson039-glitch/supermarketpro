const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// Import controllers (to be implemented)
const {
  getSettings,
  getSettingByKey,
  updateSetting,
  updateMultipleSettings,
  getPublicSettings,
  getSettingsByGroup
} = require('../controllers/setting.controller');

// Routes
router.route('/')
  .get(protect, authorize('admin'), getSettings)
  .put(protect, authorize('admin'), updateMultipleSettings);

router.route('/public')
  .get(getPublicSettings);

router.route('/group/:group')
  .get(protect, authorize('admin'), getSettingsByGroup);

router.route('/:key')
  .get(protect, authorize('admin'), getSettingByKey)
  .put(protect, authorize('admin'), updateSetting);

module.exports = router;