import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { useSession } from '../contexts/SessionContext';
import { useTranslation } from 'react-i18next';

const NotificationBell = () => {
  const { t } = useTranslation();
  const { sessionStatus } = useSession();
  const {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
    clearError
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleMarkAsRead = async (notificationId) => {
    try {
      await markAsRead(notificationId);
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await deleteNotification(notificationId);
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleRefresh = async () => {
    try {
      await refreshNotifications();
    } catch (err) {
      console.error('Error refreshing notifications:', err);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'deposit_detected':
      case 'deposit_confirmed':
      case 'deposit_new':
        return '💰';
      case 'withdrawal_requested':
      case 'withdrawal_approved':
      case 'withdrawal_rejected':
      case 'withdrawal_completed':
        return '💸';
      case 'system':
        return '⚙️';
      case 'security':
        return '🔒';
      default:
        return '📢';
    }
  };

  const getNotificationTypeColor = (type) => {
    switch (type) {
      case 'deposit_detected':
      case 'deposit_confirmed':
      case 'withdrawal_approved':
      case 'withdrawal_completed':
        return 'text-green-400';
      case 'withdrawal_rejected':
        return 'text-red-400';
      case 'deposit_new':
      case 'withdrawal_requested':
        return 'text-blue-400';
      case 'security':
        return 'text-orange-400';
      default:
        return 'text-text-muted';
    }
  };

  const formatTime = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));

    if (diffInMinutes < 1) return t('notifications.justNow');
    if (diffInMinutes < 60) return t('notifications.minutesAgo', { n: diffInMinutes });
    if (diffInMinutes < 1440) return t('notifications.hoursAgo', { n: Math.floor(diffInMinutes / 60) });
    return t('notifications.daysAgo', { n: Math.floor(diffInMinutes / 1440) });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-text-secondary hover:text-text-primary transition-colors duration-200"
        title={t('notifications.notifications')}
      >
        {/* Bell SVG Icon */}
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-card border border-default rounded-xl shadow-2xl z-50 max-h-96 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-default bg-card">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-heading">
                {t('notifications.notifications')}
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleRefresh}
                  className="text-text-muted hover:text-text-primary transition-colors p-1 rounded-md hover:bg-bg-tertiary"
                  title={t('notifications.refresh')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs text-brand-primary hover:text-brand-success transition-colors px-2 py-1 rounded-md bg-bg-tertiary"
                  >
                    {t('notifications.markAllRead')}
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-text-muted hover:text-text-primary transition-colors p-1 rounded-md hover:bg-bg-tertiary"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto">
            {error && (
              <div className="p-4 bg-red-900/50 border-b border-red-800">
                <p className="text-red-200 text-sm">{error}</p>
                <button
                  onClick={clearError}
                  className="text-xs text-red-300 hover:text-red-200 mt-1"
                >
                  {t('notifications.dismiss')}
                </button>
              </div>
            )}

            {loading && (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-text-muted text-sm mt-2">{t('notifications.loadingNotifications')}</p>
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="p-6 text-center">
                <div className="text-4xl mb-2">🔔</div>
                <p className="text-text-muted">{t('notifications.noNotificationsYet')}</p>
              </div>
            )}

            {!loading && notifications.length > 0 && (
              <div className="divide-y divide-border-default">
                {notifications.slice(0, 10).map((notification) => (
                  <div
                    key={notification._id}
                    className={`p-4 hover:bg-bg-tertiary transition-colors ${
                      !notification.isRead ? 'bg-slate-700/30 border-l-2 border-l-brand-primary' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="shrink-0 text-lg">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className={`text-sm font-medium ${
                              !notification.isRead ? 'text-text-primary' : 'text-text-secondary'
                            }`}>
                              {notification.title}
                            </h4>
                            <p className="text-xs text-text-muted mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-text-muted">
                                {formatTime(notification.createdAt)}
                              </span>
                              {notification.relatedData?.amount && (
                                <span className={`text-xs font-medium ${getNotificationTypeColor(notification.type)}`}>
                                  {notification.relatedData.amount} {notification.relatedData.currency}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-1 ml-2">
                            {!notification.isRead && (
                              <button
                                onClick={() => handleMarkAsRead(notification._id)}
                                className="text-xs text-brand-primary hover:text-brand-success transition-colors p-1 rounded-md hover:bg-bg-accent"
                                title={t('notifications.markAsRead')}
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(notification._id)}
                              className="text-xs text-red-400 hover:text-red-300 transition-colors p-1 rounded-md hover:bg-bg-accent"
                              title={t('notifications.delete')}
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {notifications.length > 10 && (
                  <div className="p-4 text-center border-t border-slate-700">
                    <span className="text-xs text-slate-400">
                      {t('notifications.showingOf', { n: 10, total: notifications.length })}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
