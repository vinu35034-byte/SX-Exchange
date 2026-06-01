import React, { useState, useEffect } from 'react';
import { Bell, Send, User, Users, Search, Eye, EyeOff, Trash2, Filter, Calendar, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { adminTheme } from '../../styles/adminTheme';
import { ApiUtils } from '../../services/api';

const AdminNotificationManager = () => {
  const [notifications, setNotifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSendModal, setShowSendModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [notificationData, setNotificationData] = useState({
    title: '',
    message: '',
    type: 'info',
    priority: 'medium',
    sendToAll: false
  });
  const [filters, setFilters] = useState({
    type: 'all',
    priority: 'all',
    status: 'all'
  });

  useEffect(() => {
    fetchNotifications();
    fetchUsers();
  }, []);

  const fetchNotifications = async () => {
    try {
      const data = await ApiUtils.get('admin/notifications/sent');
      setNotifications(data.data?.notifications || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await ApiUtils.get('admin/notifications/users');
      setUsers(data.data?.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const handleSendNotification = async (e) => {
    e.preventDefault();
    
    if (!notificationData.title.trim() || !notificationData.message.trim()) {
      setError('Title and message are required');
      return;
    }

    if (!notificationData.sendToAll && !selectedUser) {
      setError('Please select a user or choose to send to all users');
      return;
    }

    try {
      setSending(true);
      setError('');

      const payload = {
        title: notificationData.title.trim(),
        message: notificationData.message.trim(),
        type: notificationData.type,
        priority: notificationData.priority,
        sendToAll: notificationData.sendToAll,
        userId: notificationData.sendToAll ? null : selectedUser
      };

      const response = await ApiUtils.post('admin/notifications/send', payload);

      setSuccess('Notification sent successfully!');
      setShowSendModal(false);
      resetForm();
      fetchNotifications();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setNotificationData({
      title: '',
      message: '',
      type: 'info',
      priority: 'medium',
      sendToAll: false
    });
    setSelectedUser('');
  };

  const handleDeleteNotification = async (notificationId) => {
    if (!window.confirm('Are you sure you want to delete this notification?')) {
      return;
    }

    try {
      await ApiUtils.delete(`admin/notifications/sent/${notificationId}`);

      setSuccess('Notification deleted successfully');
      fetchNotifications();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const getNotificationIconColor = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getNotificationTypeColor = (type) => {
    switch (type) {
      case 'success':
        return 'bg-green-500/10 text-green-500';
      case 'error':
        return 'bg-red-500/10 text-red-500';
      case 'warning':
        return 'bg-yellow-500/10 text-yellow-500';
      default:
        return 'bg-blue-500/10 text-blue-500';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500/10 text-red-400';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-400';
      case 'low':
        return 'bg-green-500/10 text-green-400';
      default:
        return 'bg-gray-500/10 text-gray-400';
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    const matchesSearch = !searchTerm || 
      notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notification.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notification.recipientId?.username?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filters.type === 'all' || notification.type === filters.type;
    const matchesPriority = filters.priority === 'all' || notification.priority === filters.priority;
    
    return matchesSearch && matchesType && matchesPriority;
  });

  const filteredUsers = users.filter(user => 
    !searchTerm || 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className={`${adminTheme.background} min-h-screen`}>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FCD535]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${adminTheme.background} min-h-screen`}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 ${adminTheme.shadow}`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className={`p-3 ${adminTheme.accent} rounded-xl ${adminTheme.shadow}`}>
                <Bell className="w-8 h-8 text-[#FCD535]" />
              </div>
              <div>
                <h1 className={`text-3xl font-bold ${adminTheme.textPrimary}`}>Notification Manager</h1>
                <p className={`${adminTheme.textSecondary} mt-1`}>Send notifications to users and manage notification history</p>
              </div>
            </div>
            <button
              onClick={() => setShowSendModal(true)}
              className={`flex items-center space-x-2 px-6 py-3 ${adminTheme.buttonPrimary} rounded-xl transition-all duration-200 hover:scale-105`}
            >
              <Send className="w-5 h-5" />
              <span>Send Notification</span>
            </button>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className={`${adminTheme.successBg} border rounded-xl p-4`}>
            <div className="flex">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              <div className="ml-3">
                <p className="text-sm font-medium text-emerald-400">{success}</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className={`${adminTheme.dangerBg} border rounded-xl p-4`}>
            <div className="flex">
              <XCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm font-medium text-red-400">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 ${adminTheme.shadow}`}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Search</label>
              <div className="relative">
                <Search className={`absolute left-3 top-3 h-4 w-4 ${adminTheme.textSecondary}`} />
                <input
                  type="text"
                  placeholder="Search notifications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 ${adminTheme.surface} ${adminTheme.border} rounded-lg focus:ring-2 focus:ring-[#FCD535] focus:border-transparent ${adminTheme.textPrimary}`}
                />
              </div>
            </div>
            
            <div>
              <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Type</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({...filters, type: e.target.value})}
                className={`w-full px-3 py-2 ${adminTheme.surface} ${adminTheme.border} rounded-lg ${adminTheme.textPrimary} focus:ring-2 focus:ring-[#FCD535]`}
              >
                <option value="all">All Types</option>
                <option value="info">Info</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>
            
            <div>
              <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Priority</label>
              <select
                value={filters.priority}
                onChange={(e) => setFilters({...filters, priority: e.target.value})}
                className={`w-full px-3 py-2 ${adminTheme.surface} ${adminTheme.border} rounded-lg ${adminTheme.textPrimary} focus:ring-2 focus:ring-[#FCD535]`}
              >
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notifications Table */}
        <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl ${adminTheme.shadow} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className={`min-w-full divide-y ${adminTheme.border}`}>
              <thead className={`${adminTheme.surface}`}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${adminTheme.textSecondary} uppercase tracking-wider`}>
                    Notification
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${adminTheme.textSecondary} uppercase tracking-wider`}>
                    Recipient
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${adminTheme.textSecondary} uppercase tracking-wider`}>
                    Type
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${adminTheme.textSecondary} uppercase tracking-wider`}>
                    Priority
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${adminTheme.textSecondary} uppercase tracking-wider`}>
                    Date
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${adminTheme.textSecondary} uppercase tracking-wider`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className={`${adminTheme.card} divide-y ${adminTheme.border}`}>
                {filteredNotifications.length === 0 ? (
                  <tr>
                    <td colSpan="6" className={`px-6 py-8 text-center ${adminTheme.textSecondary}`}>
                      <Bell className={`w-12 h-12 mx-auto mb-4 ${adminTheme.textSecondary}`} />
                      <p>No notifications found</p>
                      <p className="text-sm">Sent notifications will appear here</p>
                    </td>
                  </tr>
                ) : (
                  filteredNotifications.map((notification) => (
                    <tr key={notification._id} className={`${adminTheme.hover} transition-colors`}>
                      <td className="px-6 py-4">
                        <div className="flex items-start space-x-3">
                          {getNotificationIcon(notification.type)}
                          <div>
                            <div className={`text-sm font-medium ${adminTheme.textPrimary}`}>
                              {notification.title}
                            </div>
                            <div className={`text-sm ${adminTheme.textSecondary} mt-1`}>
                              {notification.message.length > 100 
                                ? `${notification.message.substring(0, 100)}...` 
                                : notification.message}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          {notification.relatedData?.sendToAll ? (
                            <div className="flex items-center space-x-2">
                              <Users className="w-4 h-4 text-[#FCD535]" />
                              <span className={`text-sm ${adminTheme.textPrimary}`}>All Users</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <User className="w-4 h-4 text-[#FCD535]" />
                              <div>
                                <div className={`text-sm font-medium ${adminTheme.textPrimary}`}>
                                  {notification.recipientId?.username || 'Unknown'}
                                </div>
                                <div className={`text-xs ${adminTheme.textSecondary}`}>
                                  {notification.recipientId?.email || ''}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getNotificationTypeColor(notification.type)}`}>
                          {notification.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getPriorityColor(notification.priority)}`}>
                          {notification.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-sm ${adminTheme.textPrimary}`}>
                          {new Date(notification.createdAt).toLocaleDateString()}
                        </div>
                        <div className={`text-xs ${adminTheme.textSecondary}`}>
                          {new Date(notification.createdAt).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleDeleteNotification(notification._id)}
                          className={`p-2 ${adminTheme.textSecondary} hover:text-red-400 transition-colors`}
                          title="Delete notification"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Send Notification Modal */}
        {showSendModal && (
          <div className={`fixed inset-0 ${adminTheme.modalOverlay} flex items-center justify-center z-50 p-4`}>
            <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto ${adminTheme.shadow}`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className={`text-xl font-bold ${adminTheme.textPrimary}`}>Send Notification</h3>
                <button
                  onClick={() => {
                    setShowSendModal(false);
                    resetForm();
                    setError('');
                  }}
                  className={`${adminTheme.textSecondary} hover:text-white transition-colors`}
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSendNotification} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                    Title *
                  </label>
                  <input
                    type="text"
                    value={notificationData.title}
                    onChange={(e) => setNotificationData({...notificationData, title: e.target.value})}
                    className={`w-full px-3 py-2 ${adminTheme.surface} ${adminTheme.border} rounded-lg focus:ring-2 focus:ring-[#FCD535] focus:border-transparent ${adminTheme.textPrimary}`}
                    placeholder="Enter notification title"
                    required
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                    Message *
                  </label>
                  <textarea
                    value={notificationData.message}
                    onChange={(e) => setNotificationData({...notificationData, message: e.target.value})}
                    className={`w-full px-3 py-2 ${adminTheme.surface} ${adminTheme.border} rounded-lg focus:ring-2 focus:ring-[#FCD535] focus:border-transparent ${adminTheme.textPrimary}`}
                    rows="4"
                    placeholder="Enter notification message"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                      Type
                    </label>
                    <select
                      value={notificationData.type}
                      onChange={(e) => setNotificationData({...notificationData, type: e.target.value})}
                      className={`w-full px-3 py-2 ${adminTheme.surface} ${adminTheme.border} rounded-lg ${adminTheme.textPrimary} focus:ring-2 focus:ring-[#FCD535]`}
                    >
                      <option value="info">Info</option>
                      <option value="success">Success</option>
                      <option value="warning">Warning</option>
                      <option value="error">Error</option>
                    </select>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                      Priority
                    </label>
                    <select
                      value={notificationData.priority}
                      onChange={(e) => setNotificationData({...notificationData, priority: e.target.value})}
                      className={`w-full px-3 py-2 ${adminTheme.surface} ${adminTheme.border} rounded-lg ${adminTheme.textPrimary} focus:ring-2 focus:ring-[#FCD535]`}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={notificationData.sendToAll}
                      onChange={(e) => setNotificationData({...notificationData, sendToAll: e.target.checked})}
                      className={`rounded ${adminTheme.surface} ${adminTheme.border} text-[#FCD535] focus:ring-[#FCD535]`}
                    />
                    <span className={`text-sm font-medium ${adminTheme.textSecondary}`}>
                      Send to all users
                    </span>
                  </label>
                </div>

                {!notificationData.sendToAll && (
                  <div>
                    <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                      Select User *
                    </label>
                    <select
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      className={`w-full px-3 py-2 ${adminTheme.surface} ${adminTheme.border} rounded-lg ${adminTheme.textPrimary} focus:ring-2 focus:ring-[#FCD535]`}
                      required={!notificationData.sendToAll}
                    >
                      <option value="">Select a user</option>
                      {filteredUsers.map((user) => (
                        <option key={user._id} value={user._id}>
                          {user.username} ({user.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSendModal(false);
                      resetForm();
                      setError('');
                    }}
                    className={`px-4 py-2 ${adminTheme.buttonSecondary} rounded-lg transition-colors`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className={`px-4 py-2 ${adminTheme.buttonPrimary} rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2`}
                  >
                    {sending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Send Notification</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminNotificationManager;
