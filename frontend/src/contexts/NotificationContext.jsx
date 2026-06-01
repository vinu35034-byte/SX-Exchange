import React, { createContext, useContext, useState, useEffect } from 'react';
import notificationService from '../services/notificationService';
import { useUserAuth } from './UserAuthContext';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    // In development, provide a default context to handle HMR issues
    if (import.meta.env.DEV) {
      return {
        notifications: [],
        unreadCount: 0,
        loading: false,
        error: null,
        loadNotifications: () => Promise.resolve({ notifications: [], total: 0, hasMore: false }),
        loadUnreadCount: () => Promise.resolve(),
        markAsRead: () => Promise.resolve(),
        markAllAsRead: () => Promise.resolve(),
        deleteNotification: () => Promise.resolve(),
        refreshNotifications: () => Promise.resolve(),
        clearError: () => {}
      };
    }
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const authContext = useUserAuth();
  const { user, admin } = authContext || {}; // Defensive programming for HMR
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isAdmin = !!admin;
  const currentUser = admin || user;

  // Load notifications
  const loadNotifications = async (page = 1) => {
    if (!currentUser) return;

    try {
      setLoading(true);
      setError(null);

      const response = isAdmin 
        ? await notificationService.getAdminNotifications(page)
        : await notificationService.getUserNotifications(page);

      if (response.success) {
        if (page === 1) {
          setNotifications(response.data.notifications);
        } else {
          setNotifications(prev => [...prev, ...response.data.notifications]);
        }
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to load notifications');
      }
    } catch (err) {
      console.error('Error loading notifications:', err);
      setError(err.message || 'Failed to load notifications');
      // Don't throw the error, just return empty data
      return { notifications: [], total: 0, hasMore: false };
    } finally {
      setLoading(false);
    }
  };

  // Load unread count
  const loadUnreadCount = async () => {
    if (!currentUser) return;

    try {
      const count = isAdmin 
        ? await notificationService.getAdminUnreadCount()
        : await notificationService.getUserUnreadCount();
      
      setUnreadCount(count);
    } catch (err) {
      console.error('Error loading unread count:', err);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    if (!currentUser) return;

    try {
      await (isAdmin 
        ? notificationService.markAdminNotificationAsRead(notificationId)
        : notificationService.markUserNotificationAsRead(notificationId));

      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification._id === notificationId 
            ? { ...notification, isRead: true, readAt: new Date() }
            : notification
        )
      );

      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
      setError(err.message || 'Failed to mark notification as read');
      throw err;
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!currentUser) return;

    try {
      await (isAdmin 
        ? notificationService.markAllAdminNotificationsAsRead()
        : notificationService.markAllUserNotificationsAsRead());

      // Update local state
      setNotifications(prev => 
        prev.map(notification => ({
          ...notification,
          isRead: true,
          readAt: new Date()
        }))
      );

      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      setError(err.message || 'Failed to mark all notifications as read');
      throw err;
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    if (!currentUser) return;

    try {
      await (isAdmin 
        ? notificationService.deleteAdminNotification(notificationId)
        : notificationService.deleteUserNotification(notificationId));

      // Update local state
      const notification = notifications.find(n => n._id === notificationId);
      setNotifications(prev => prev.filter(n => n._id !== notificationId));

      // Update unread count if notification was unread
      if (notification && !notification.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
      setError(err.message || 'Failed to delete notification');
      throw err;
    }
  };

  // Refresh notifications
  const refreshNotifications = async () => {
    await Promise.all([
      loadNotifications(1),
      loadUnreadCount()
    ]);
  };

  // Clear error
  const clearError = () => {
    setError(null);
  };

  // Subscribe to notification service updates
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = notificationService.subscribe((data) => {
      if (data.type === 'unread_count_updated') {
        setUnreadCount(data.count);
      } else if (data.type === 'notification_read') {
        setNotifications(prev => 
          prev.map(notification => 
            notification._id === data.notificationId 
              ? { ...notification, isRead: true, readAt: new Date() }
              : notification
          )
        );
      } else if (data.type === 'all_notifications_read') {
        setNotifications(prev => 
          prev.map(notification => ({
            ...notification,
            isRead: true,
            readAt: new Date()
          }))
        );
        setUnreadCount(0);
      } else if (data.type === 'notification_deleted') {
        setNotifications(prev => prev.filter(n => n._id !== data.notificationId));
      }
    });

    return unsubscribe;
  }, [currentUser]);

  // Initialize notifications and start polling when user changes
  useEffect(() => {
    if (currentUser) {
      // Add a delay to prevent concurrent API calls with other contexts
      const timer = setTimeout(() => {
        refreshNotifications();
        notificationService.startPolling(isAdmin ? 'admin' : 'user');
      }, 200); // 200ms delay
      
      return () => {
        clearTimeout(timer);
        notificationService.stopPolling();
      };
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setError(null);
      notificationService.stopPolling();
    }
  }, [currentUser, isAdmin]);

  const value = {
    notifications,
    unreadCount,
    loading,
    error,
    loadNotifications,
    loadUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
    clearError
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
