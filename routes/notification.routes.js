const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// Import controllers (to be implemented)
const {
  getNotifications,
  getNotificationById,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
  sendPushNotification,
  updateNotificationPreferences,
  getNotificationPreferences
} = require('../controllers/notification.controller');

// Routes
router.route('/')
  .get(protect, getNotifications)
  .post(protect, authorize('admin', 'vendor', 'staff'), createNotification);

router.route('/:id')
  .get(protect, getNotificationById)
  .put(protect, markAsRead)
  .delete(protect, deleteNotification);

router.route('/read/all')
  .put(protect, markAllAsRead);

router.route('/unread/count')
  .get(protect, getUnreadCount);

router.route('/push')
  .post(protect, authorize('admin', 'vendor'), sendPushNotification);

router.route('/preferences')
  .get(protect, getNotificationPreferences)
  .put(protect, updateNotificationPreferences);

module.exports = router;