const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const requireUserAuth = require('../middlewares/requireUserAuth');

// All routes require user authentication
router.use(requireUserAuth);

// Get user notifications
router.get('/', notificationController.getUserNotifications);

// Get unread count
router.get('/unread-count', notificationController.getUserUnreadCount);

// Mark notification as read
router.put('/:notificationId/read', notificationController.markUserNotificationAsRead);

// Mark all notifications as read
router.put('/mark-all-read', notificationController.markAllUserNotificationsAsRead);

// Delete notification
router.delete('/:notificationId', notificationController.deleteUserNotification);

module.exports = router;
