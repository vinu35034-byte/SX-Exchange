import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  Check,
  Trash2,
  CheckCheck,
  Info,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import notificationService from '../services/notificationService';
import { useTranslation } from 'react-i18next';
import Spinner from './common/Spinner';

const NotificationModal = ({ isOpen, onClose, themeConfig }) => {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState('');

  // Load notifications when modal opens
  useEffect(() => {
    if (isOpen) {
      loadNotifications();
      loadUnreadCount();
    }
  }, [isOpen]);

  const loadNotifications = async (page = 1) => {
    try {
      setLoading(true);
      setError('');

      const response = await notificationService.getUserNotifications(page, 20);

      if (response.success) {
        setNotifications(response.data.notifications || []);
        setCurrentPage(response.data.currentPage || 1);
        setTotalPages(response.data.totalPages || 1);
      } else {
        setError(t('notifications.failedToLoad'));
      }
    } catch (error) {
      setError(t('notifications.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const count = await notificationService.getUserUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationService.markUserNotificationAsRead(notificationId);

      // Update local state
      setNotifications(prev =>
        prev.map(notification =>
          notification._id === notificationId
            ? { ...notification, read: true }
            : notification
        )
      );

      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllUserNotificationsAsRead();

      // Update local state
      setNotifications(prev =>
        prev.map(notification => ({ ...notification, read: true }))
      );

      // Reset unread count
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      await notificationService.deleteUserNotification(notificationId);

      // Update local state
      const notificationToDelete = notifications.find(n => n._id === notificationId);
      setNotifications(prev => prev.filter(n => n._id !== notificationId));

      // Update unread count if the deleted notification was unread
      if (notificationToDelete && !notificationToDelete.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getNotificationIcon = (type, title) => {
    // Check title/type for specific topics
    const lowerTitle = title?.toLowerCase() || '';

    // Deposit related
    if (lowerTitle.includes('deposit')) {
      return <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>;
    }

    // Withdrawal related
    if (lowerTitle.includes('withdraw')) {
      return <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4m16 0l-4-4m4 4l-4 4" />
      </svg>;
    }

    // Trade related
    if (lowerTitle.includes('trade') || lowerTitle.includes('order')) {
      return <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>;
    }

    // Security/KYC related
    if (lowerTitle.includes('security') || lowerTitle.includes('kyc') || lowerTitle.includes('verify')) {
      return <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>;
    }

    // Account related
    if (lowerTitle.includes('account') || lowerTitle.includes('profile')) {
      return <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>;
    }

    // Referral/Reward related
    if (lowerTitle.includes('referral') || lowerTitle.includes('reward') || lowerTitle.includes('bonus')) {
      return <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
      </svg>;
    }

    // Fall back to type-based icons
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
      default:
        return <Info className="w-4 h-4 text-cyan-400" />;
    }
  };



  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffInMinutes < 1) return t('notifications.justNow');
    if (diffInMinutes < 60) return t('notifications.minutesAgo', { n: diffInMinutes });
    if (diffInMinutes < 1440) return t('notifications.hoursAgo', { n: Math.floor(diffInMinutes / 60) });
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-[280px] mt-16 mr-0">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-linear-to-br from-[#0a0e1a] via-[#0f1419] to-[#0a0e1a] rounded-xl">
          {/* Animated Grid Pattern */}
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: `linear-gradient(rgba(56, 189, 248, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}></div>

          {/* Gradient Orbs */}
          <div className="absolute top-0 -left-20 w-40 h-40 bg-cyan-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
          <div className="absolute bottom-0 -right-20 w-40 h-40 bg-purple-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-blue-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>

          {/* Floating Particles */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-cyan-400 rounded-full opacity-50 animate-float"></div>
            <div className="absolute top-1/3 right-1/4 w-1 h-1 bg-purple-400 rounded-full opacity-40 animate-float animation-delay-1000"></div>
            <div className="absolute bottom-1/4 left-1/3 w-1.5 h-1.5 bg-blue-400 rounded-full opacity-60 animate-float animation-delay-2000"></div>
          </div>
        </div>

        {/* Content */}
        <div className="relative bg-linear-to-b from-[#0a0e1a] via-[#0f1419] to-[#0a0e1a] backdrop-blur-lg border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-[70vh] flex flex-col">
          {/* Header */}
          <div className="p-3 border-b border-white/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-cyan-500/10 rounded-lg">
                  <Bell className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">{t('notifications.notifications')}</h2>
                  {unreadCount > 0 && (
                    <p className="text-[10px] text-white/50">{t('notifications.unreadCount', { n: unreadCount })}</p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center hover:bg-white/5 transition-all duration-300 active:scale-95 rounded-lg border border-white/10 hover:border-cyan-400/50"
              >
                <X className="w-4 h-4 text-white/60 hover:text-cyan-400" />
              </button>
            </div>

            {/* Mark all as read button */}
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg text-white text-xs hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-300"
              >
                <CheckCheck className="w-3 h-3 text-cyan-400" />
                <span>{t('notifications.markAllRead')}</span>
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {loading ? (
              <Spinner />
            ) : error ? (
              <div className="p-8">
                <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                  <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-white/60 text-sm font-medium mb-1">{t('notifications.noNotificationsYet')}</p>
                <p className="text-xs text-white/40">{t('notifications.noNotificationsDescription')}</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {notifications.map((notification) => (
                  <div
                    key={notification._id}
                  className={`py-2 px-3 hover:bg-white/5 transition-all duration-300 ${
                      !notification.read ? 'bg-cyan-500/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0">
                        <div className="p-2 bg-cyan-500/10 rounded-lg">
                          {getNotificationIcon(notification.type, notification.title)}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h3 className={`text-xs mb-0.5 ${!notification.read ? 'text-white font-semibold' : 'text-white/90 font-medium'}`}>
                              {notification.title}
                            </h3>
                            <p className="text-[10px] text-white/60 mb-1.5 leading-relaxed">
                              {notification.message}
                            </p>
                            <p className="text-[10px] text-white/40">
                              {formatDate(notification.createdAt)}
                            </p>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-0.5 shrink-0">
                            {!notification.read && (
                              <button
                                onClick={() => handleMarkAsRead(notification._id)}
                                className="p-1 hover:bg-green-500/10 rounded-lg transition-all duration-300 active:scale-95 border border-transparent hover:border-green-500/20"
                                title={t('notifications.markAsRead')}
                              >
                                <Check className="w-3 h-3 text-green-400" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteNotification(notification._id)}
                              className="p-1 hover:bg-red-500/10 rounded-lg transition-all duration-300 active:scale-95 border border-transparent hover:border-red-500/20"
                              title={t('notifications.delete')}
                            >
                              <Trash2 className="w-3 h-3 text-red-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-white/10">
              <div className="flex justify-between items-center gap-3">
                <button
                  onClick={() => loadNotifications(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="flex-1 py-1.5 px-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg text-white text-xs font-medium hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300"
                >
                  {t('notifications.previous')}
                </button>
                <span className="text-xs text-white/60 font-medium whitespace-nowrap">
                  {t('notifications.pagination', { current: currentPage, total: totalPages })}
                </span>
                <button
                  onClick={() => loadNotifications(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="flex-1 py-1.5 px-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg text-white text-xs font-medium hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300"
                >
                  {t('notifications.next')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;
