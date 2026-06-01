const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const requireAdminAuth = require('../middlewares/requireAdminAuth');

// All routes require admin authentication
router.use(requireAdminAuth);

// Get admin notifications (notifications sent TO admin)
router.get('/', notificationController.getAdminNotifications);

// Get admin sent notifications (notifications sent BY admin to users)
router.get('/sent', notificationController.getAdminSentNotifications);

// Get all users for notification targeting
router.get('/users', notificationController.getAllUsers);

// Send notification to user(s)
router.post('/send', notificationController.sendNotificationToUsers);

// Get unread count
router.get('/unread-count', notificationController.getAdminUnreadCount);

// Mark notification as read
router.put('/:notificationId/read', notificationController.markAdminNotificationAsRead);

// Mark all notifications as read
router.put('/mark-all-read', notificationController.markAllAdminNotificationsAsRead);

// Delete admin notification (received by admin)
router.delete('/:notificationId', notificationController.deleteAdminNotification);

// Delete sent notification (sent by admin to users)
router.delete('/sent/:notificationId', notificationController.deleteAdminSentNotification);

module.exports = router;
