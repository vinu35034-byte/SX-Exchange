import { ApiUtils } from './api';

class NotificationService {
  constructor() {
    this.subscribers = [];
  }

  /**
   * Subscribe to notification updates
   */
  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
    };
  }

  /**
   * Notify all subscribers
   */
  notify(data) {
    this.subscribers.forEach(callback => callback(data));
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(page = 1, limit = 20) {
    try {
      const response = await ApiUtils.get(`/notifications?page=${page}&limit=${limit}`);
      return response; // Return full response to match the expected format
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get admin notifications
   */
  async getAdminNotifications(page = 1, limit = 20) {
    try {
      const response = await ApiUtils.get(`/admin/notifications?page=${page}&limit=${limit}`);
      return response; // Return full response to match the expected format
    } catch (error) {
      console.error('Error fetching admin notifications:', error);
      throw error;
    }
  }

  /**
   * Get user unread count
   */
  async getUserUnreadCount() {
    try {
      const response = await ApiUtils.get('/notifications/unread-count');
      
      // Handle different response formats
      let count = 0;
      
      if (response && typeof response === 'object') {
        // Check for full API response format (most likely)
        if (response.data && typeof response.data.count === 'number') {
          count = response.data.count;
        }
        // Check for direct count property (fallback)
        else if (typeof response.count === 'number') {
          count = response.count;
        }
        // Check for nested data.count format (alternative)
        else if (response.data && response.data.data && typeof response.data.data.count === 'number') {
          count = response.data.data.count;
        }
        // If response format is unexpected, return 0
      }
      
      return count;
    } catch (error) {
      // Return a fallback value instead of throwing
      return 0;
    }
  }

  /**
   * Get admin unread count
   */
  async getAdminUnreadCount() {
    try {
      const response = await ApiUtils.get('/admin/notifications/unread-count');
      
      // Handle different response formats
      let count = 0;
      
      if (response && typeof response === 'object') {
        // Check for full API response format (most likely)
        if (response.data && typeof response.data.count === 'number') {
          count = response.data.count;
        }
        // Check for direct count property (fallback)
        else if (typeof response.count === 'number') {
          count = response.count;
        }
        // Check for nested data.count format (alternative)
        else if (response.data && response.data.data && typeof response.data.data.count === 'number') {
          count = response.data.data.count;
        }
        // If response format is unexpected, return 0
      }
      
      return count;
    } catch (error) {
      console.error('Error fetching admin unread count:', error);
      // Return a fallback value instead of throwing
      return 0;
    }
  }

  /**
   * Mark user notification as read
   */
  async markUserNotificationAsRead(notificationId) {
    try {
      const response = await ApiUtils.put(`/notifications/${notificationId}/read`);
      this.notify({ type: 'notification_read', notificationId });
      return response.data;
    } catch (error) {
      console.error('Error marking user notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark admin notification as read
   */
  async markAdminNotificationAsRead(notificationId) {
    try {
      const response = await ApiUtils.put(`/admin/notifications/${notificationId}/read`);
      this.notify({ type: 'notification_read', notificationId });
      return response.data;
    } catch (error) {
      console.error('Error marking admin notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all user notifications as read
   */
  async markAllUserNotificationsAsRead() {
    try {
      const response = await ApiUtils.put('/notifications/mark-all-read');
      this.notify({ type: 'all_notifications_read' });
      return response.data;
    } catch (error) {
      console.error('Error marking all user notifications as read:', error);
      throw error;
    }
  }

  /**
   * Mark all admin notifications as read
   */
  async markAllAdminNotificationsAsRead() {
    try {
      const response = await ApiUtils.put('/admin/notifications/mark-all-read');
      this.notify({ type: 'all_notifications_read' });
      return response.data;
    } catch (error) {
      console.error('Error marking all admin notifications as read:', error);
      throw error;
    }
  }

  /**
   * Delete user notification
   */
  async deleteUserNotification(notificationId) {
    try {
      const response = await ApiUtils.delete(`/notifications/${notificationId}`);
      this.notify({ type: 'notification_deleted', notificationId });
      return response.data;
    } catch (error) {
      console.error('Error deleting user notification:', error);
      throw error;
    }
  }

  /**
   * Delete admin notification
   */
  async deleteAdminNotification(notificationId) {
    try {
      const response = await ApiUtils.delete(`/admin/notifications/${notificationId}`);
      this.notify({ type: 'notification_deleted', notificationId });
      return response.data;
    } catch (error) {
      console.error('Error deleting admin notification:', error);
      throw error;
    }
  }

  /**
   * Start polling for new notifications
   */
  startPolling(userType = 'user', interval = 30000) {
    this.stopPolling(); // Stop any existing polling

    this.pollingInterval = setInterval(async () => {
      try {
        // getUnreadCount methods now handle errors internally and return fallback values
        const count = userType === 'admin' 
          ? await this.getAdminUnreadCount()
          : await this.getUserUnreadCount();
        
        // Only notify if we got a valid count (including zero)
        if (count !== undefined && count !== null) {
          this.notify({ type: 'unread_count_updated', count });
        }
      } catch (error) {
        console.error('Error polling for notifications:', error);
        // Don't send any updates if we encountered an error
      }
    }, interval);
  }

  /**
   * Stop polling for notifications
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
}

export default new NotificationService();
