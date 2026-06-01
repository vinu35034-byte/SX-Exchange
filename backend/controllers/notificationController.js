const notificationService = require('../utils/notificationService');
const { sessionManager } = require('../config/session');
const { createLogger } = require('../utils/logger');

const logger = createLogger('notification-controller');

class NotificationController {
  /**
   * Get user notifications
   */
  async getUserNotifications(req, res) {
    try {
      const userId = req.user._id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      // Log notification access
      logger.info('User notifications accessed', {
        userId: userId.toString(),
        sessionId: req.sessionID,
        page,
        limit,
        timestamp: new Date().toISOString()
      });

      const result = await notificationService.getUserNotifications(userId, page, limit);

      // Add session activity info
      const sessionInfo = {
        lastActivity: req.session?.user?.lastActivity,
        sessionActive: true,
        accessedAt: new Date(),
        sessionId: req.sessionID
      };

      res.json({
        success: true,
        message: 'Notifications retrieved successfully',
        data: result,
        session: sessionInfo
      });
    } catch (error) {
      logger.error('Error getting user notifications:', {
        error: error.message,
        userId: req.user._id.toString(),
        sessionId: req.sessionID,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to get notifications',
        sessionInfo: {
          errorAt: new Date(),
          sessionId: req.sessionID
        }
      });
    }
  }

  /**
   * Get admin notifications
   */
  async getAdminNotifications(req, res) {
    try {
      const adminId = req.admin._id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      // Log admin notification access
      logger.info('Admin notifications accessed', {
        adminId: adminId.toString(),
        sessionId: req.sessionID,
        page,
        limit,
        timestamp: new Date().toISOString()
      });

      const result = await notificationService.getAdminNotifications(adminId, page, limit);

      res.json({
        success: true,
        message: 'Notifications retrieved successfully',
        data: result,
        sessionInfo: {
          accessedAt: new Date(),
          sessionId: req.sessionID,
          adminId
        }
      });
    } catch (error) {
      logger.error('Error getting admin notifications:', {
        error: error.message,
        adminId: req.admin._id.toString(),
        sessionId: req.sessionID,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to get notifications',
        sessionInfo: {
          errorAt: new Date(),
          sessionId: req.sessionID
        }
      });
    }
  }

  /**
   * Get user unread count
   */
  async getUserUnreadCount(req, res) {
    try {
      const userId = req.user._id;
      
      // Log unread count request
      logger.info('User unread count requested', {
        userId: userId.toString(),
        sessionId: req.sessionID,
        timestamp: new Date().toISOString()
      });

      const count = await notificationService.getUnreadCount('user', userId);

      res.json({
        success: true,
        message: 'Unread count retrieved successfully',
        data: { count },
        sessionInfo: {
          accessedAt: new Date(),
          sessionId: req.sessionID
        }
      });
    } catch (error) {
      logger.error('Error getting user unread count:', {
        error: error.message,
        userId: req.user._id.toString(),
        sessionId: req.sessionID,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to get unread count',
        sessionInfo: {
          errorAt: new Date(),
          sessionId: req.sessionID
        }
      });
    }
  }

  /**
   * Get admin unread count
   */
  async getAdminUnreadCount(req, res) {
    try {
      const adminId = req.admin._id;
      
      // Log admin unread count request
      logger.info('Admin unread count requested', {
        adminId: adminId.toString(),
        sessionId: req.sessionID,
        timestamp: new Date().toISOString()
      });

      const count = await notificationService.getUnreadCount('admin', adminId);

      res.json({
        success: true,
        message: 'Unread count retrieved successfully',
        data: { count },
        sessionInfo: {
          accessedAt: new Date(),
          sessionId: req.sessionID,
          adminId
        }
      });
    } catch (error) {
      logger.error('Error getting admin unread count:', {
        error: error.message,
        adminId: req.admin._id.toString(),
        sessionId: req.sessionID,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to get unread count',
        sessionInfo: {
          errorAt: new Date(),
          sessionId: req.sessionID
        }
      });
    }
  }

  /**
   * Mark user notification as read
   */
  async markUserNotificationAsRead(req, res) {
    try {
      const userId = req.user._id;
      const notificationId = req.params.notificationId;

      const notification = await notificationService.markAsRead(notificationId, 'user', userId);

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.json({
        success: true,
        message: 'Notification marked as read',
        data: notification
      });
    } catch (error) {
      console.error('Error marking user notification as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read'
      });
    }
  }

  /**
   * Mark admin notification as read
   */
  async markAdminNotificationAsRead(req, res) {
    try {
      const adminId = req.admin._id;
      const notificationId = req.params.notificationId;

      const notification = await notificationService.markAsRead(notificationId, 'admin', adminId);

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.json({
        success: true,
        message: 'Notification marked as read',
        data: notification
      });
    } catch (error) {
      console.error('Error marking admin notification as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read'
      });
    }
  }

  /**
   * Mark all user notifications as read
   */
  async markAllUserNotificationsAsRead(req, res) {
    try {
      const userId = req.user._id;
      const result = await notificationService.markAllAsRead('user', userId);

      res.json({
        success: true,
        message: 'All notifications marked as read',
        data: { modifiedCount: result.modifiedCount }
      });
    } catch (error) {
      console.error('Error marking all user notifications as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as read'
      });
    }
  }

  /**
   * Mark all admin notifications as read
   */
  async markAllAdminNotificationsAsRead(req, res) {
    try {
      const adminId = req.admin._id;
      const result = await notificationService.markAllAsRead('admin', adminId);

      res.json({
        success: true,
        message: 'All notifications marked as read',
        data: { modifiedCount: result.modifiedCount }
      });
    } catch (error) {
      console.error('Error marking all admin notifications as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as read'
      });
    }
  }

  /**
   * Delete user notification
   */
  async deleteUserNotification(req, res) {
    try {
      const userId = req.user._id;
      const notificationId = req.params.notificationId;

      const notification = await notificationService.deleteNotification(notificationId, 'user', userId);

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.json({
        success: true,
        message: 'Notification deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting user notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete notification'
      });
    }
  }

  /**
   * Delete admin notification
   */
  async deleteAdminNotification(req, res) {
    try {
      const adminId = req.admin._id;
      const notificationId = req.params.notificationId;

      const notification = await notificationService.deleteNotification(notificationId, 'admin', adminId);

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.json({
        success: true,
        message: 'Notification deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting admin notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete notification'
      });
    }
  }

  /**
   * Send notification to user(s) - Admin only
   */
  async sendNotificationToUsers(req, res) {
    try {
      const { title, message, type, priority, sendToAll, userId } = req.body;
      const senderId = req.admin._id;

      // Validation
      if (!title || !message) {
        return res.status(400).json({
          success: false,
          message: 'Title and message are required'
        });
      }

      if (!sendToAll && !userId) {
        return res.status(400).json({
          success: false,
          message: 'Either sendToAll must be true or userId must be provided'
        });
      }

      const notifications = await notificationService.sendAdminNotification({
        senderId,
        title,
        message,
        type: type || 'system',
        priority: priority || 'medium',
        sendToAll: sendToAll || false,
        userId
      });

      res.json({
        success: true,
        message: 'Notification sent successfully',
        data: {
          count: notifications.length,
          notifications
        }
      });
    } catch (error) {
      console.error('Error sending notification to users:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to send notification'
      });
    }
  }

  /**
   * Get all sent notifications - Admin only
   */
  async getAdminSentNotifications(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const filters = {
        type: req.query.type,
        priority: req.query.priority,
        search: req.query.search
      };

      const result = await notificationService.getAdminSentNotifications(page, limit, filters);

      res.json({
        success: true,
        message: 'Sent notifications retrieved successfully',
        data: result
      });
    } catch (error) {
      console.error('Error getting admin sent notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get sent notifications'
      });
    }
  }

  /**
   * Delete sent notification - Admin only
   */
  async deleteAdminSentNotification(req, res) {
    try {
      const notificationId = req.params.notificationId;

      const notification = await notificationService.deleteAdminSentNotification(notificationId);

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.json({
        success: true,
        message: 'Notification deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting admin sent notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete notification'
      });
    }
  }

  /**
   * Get all users for notification targeting - Admin only
   */
  async getAllUsers(req, res) {
    try {
      const User = require('../models/user');
      const users = await User.find({ isActive: true })
        .select('username email createdAt')
        .sort({ username: 1 });

      res.json({
        success: true,
        message: 'Users retrieved successfully',
        data: { users }
      });
    } catch (error) {
      console.error('Error getting all users:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get users'
      });
    }
  }
}

module.exports = new NotificationController();
