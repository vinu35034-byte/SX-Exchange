import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { adminTheme } from '../../styles/adminTheme';
import { ApiUtils } from '../../services/api';
import {
  UserGroupIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
  TrashIcon,
  ShieldCheckIcon,
  BanknotesIcon,
  KeyIcon,
  TagIcon,
  StarIcon,
  EyeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  FunnelIcon
} from "@heroicons/react/24/outline";
import UserDetailsModal from './UserDetailsModal';
import BalanceUpdateModal from './BalanceUpdateModal';
import PasswordResetModal from './PasswordResetModal';
import BulkActionsModal from './BulkActionsModal';
import toast from 'react-hot-toast';

const AdminUserManager = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [specialUsers, setSpecialUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Pagination & Search
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    kycStatus: 'all',
    vipLevel: 'all',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  
  // Modals & Selection
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showBalanceUpdate, setShowBalanceUpdate] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Statistics
  const [userStats, setUserStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    bannedUsers: 0,
    vipUsers: 0,
    kycPendingUsers: 0
  });

  // Fetch users with pagination and filters
  const fetchUsers = async (page = 1, search = '', filterParams = filters) => {
    try {
      setLoading(page === 1);
      setRefreshing(page !== 1);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search,
        ...filterParams
      });

      const data = await ApiUtils.get(`admin/users?${params}`);

      if (data.success) {
        setUsers(data.data.users);
        setCurrentPage(data.data.pagination.currentPage);
        setTotalPages(data.data.pagination.totalPages);
        setTotalUsers(data.data.pagination.totalUsers);
      } else {
        toast.error(data.message || 'Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch special users for quick access panel
  const fetchSpecialUsers = async () => {
    try {
      const data = await ApiUtils.get('admin/users/special');

      if (data.success) {
        setSpecialUsers(data.data);
      }
    } catch (error) {
      console.error('Error fetching special users:', error);
    }
  };

  // Fetch user statistics
  const fetchUserStats = async () => {
    try {
      const data = await ApiUtils.get('admin/users/stats');

      if (data.success) {
        setUserStats(data.data.summary);
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchUsers();
    fetchSpecialUsers();
    fetchUserStats();
  }, []);

  // Handle search with debounce
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchTerm !== '' || currentPage !== 1) {
        fetchUsers(1, searchTerm, filters);
      }
    }, 500);

    return () => clearTimeout(delayedSearch);
  }, [searchTerm]);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    fetchUsers(1, searchTerm, newFilters);
  };

  // Handle pagination
  const handlePageChange = (page) => {
    fetchUsers(page, searchTerm, filters);
  };

  // Quick user actions
  const handleUserAction = async (userId, action, data = {}) => {
    try {
      let endpoint = '';
      let method = 'PUT';
      let body = {};

      switch (action) {
        case 'ban':
          endpoint = `admin/users/${userId}/ban`;
          method = 'POST';
          body = { reason: data.reason || 'Banned by admin' };
          break;
        case 'unban':
          endpoint = `admin/users/${userId}/unban`;
          method = 'POST';
          body = {};
          break;
        case 'activate':
          endpoint = `admin/users/${userId}/activate`;
          method = 'POST';
          body = {};
          break;
        case 'deactivate':
          endpoint = `admin/users/${userId}/deactivate`;
          method = 'POST';
          body = {};
          break;
        case 'addSpecialTag':
          endpoint = `admin/users/${userId}/special`;
          method = 'POST';
          body = {};
          break;
        case 'removeSpecialTag':
          endpoint = `admin/users/${userId}/special`;
          method = 'DELETE';
          body = {};
          break;
        case 'delete':
          endpoint = `admin/users/${userId}/delete`;
          method = 'POST';
          body = {};
          break;
        default:
          throw new Error('Invalid action');
      }

      let result;
      if (method === 'POST') {
        result = await ApiUtils.post(endpoint, body);
      } else if (method === 'DELETE') {
        result = await ApiUtils.delete(endpoint);
      } else {
        result = await ApiUtils.put(endpoint, body);
      }

      if (result.success) {
        toast.success(`User ${action}ed successfully`);
        fetchUsers(currentPage, searchTerm, filters);
        fetchSpecialUsers();
        fetchUserStats();
      } else {
        toast.error(result.message || `Failed to ${action} user`);
      }
    } catch (error) {
      console.error(`Error ${action}ing user:`, error);
      toast.error(`Failed to ${action} user`);
    }
  };

  // Handle user selection
  const handleUserSelection = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Select all users on current page
  const handleSelectAll = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(user => user._id));
    }
  };

  // Status badge component
  const StatusBadge = ({ user }) => {
    if (user.banReason) {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-red-500/20 text-red-400 rounded-full">
          Banned
        </span>
      );
    }
    if (!user.isActive) {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-gray-500/20 text-gray-400 rounded-full">
          Inactive
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs font-medium bg-green-500/20 text-green-400 rounded-full">
        Active
      </span>
    );
  };

  // KYC status badge
  const KYCBadge = ({ status }) => {
    const badges = {
      approved: { color: 'green', text: 'Verified' },
      pending: { color: 'yellow', text: 'Pending' },
      rejected: { color: 'red', text: 'Rejected' },
      not_started: { color: 'gray', text: 'Not Started' }
    };
    
    const badge = badges[status] || badges.not_started;
    
    return (
      <span className={`px-2 py-1 text-xs font-medium bg-${badge.color}-500/20 text-${badge.color}-400 rounded-full`}>
        {badge.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${adminTheme.primary} ${adminTheme.textPrimary} p-6`}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <ArrowPathIcon className="w-12 h-12 animate-spin mx-auto mb-4 text-[#FCD535]" />
            <p className={adminTheme.textSecondary}>Loading users...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${adminTheme.primary} ${adminTheme.textPrimary}`}>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/u/dashboard')}
              className={`${adminTheme.buttonSecondary} p-2`}
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <div>
              <h1 className={`text-3xl font-bold ${adminTheme.textPrimary} flex items-center gap-3`}>
                <UserGroupIcon className="w-8 h-8 text-[#FCD535]" />
                User Management
              </h1>
              <p className={`${adminTheme.textSecondary} mt-1`}>
                Manage all user accounts, permissions, and activities
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              onClick={() => fetchUsers(currentPage, searchTerm, filters)}
              disabled={refreshing}
              className={`${adminTheme.buttonSecondary} text-sm`}
            >
              <ArrowPathIcon className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {selectedUsers.length > 0 && (
              <Button
                onClick={() => setShowBulkActions(true)}
                className={`${adminTheme.buttonPrimary} text-sm`}
              >
                Bulk Actions ({selectedUsers.length})
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-xl p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`${adminTheme.textSecondary} text-sm`}>Total Users</p>
                <p className={`text-2xl font-bold ${adminTheme.textPrimary}`}>
                  {userStats.totalUsers.toLocaleString()}
                </p>
              </div>
              <UserGroupIcon className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-xl p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`${adminTheme.textSecondary} text-sm`}>Active</p>
                <p className={`text-2xl font-bold text-green-400`}>
                  {userStats.activeUsers.toLocaleString()}
                </p>
              </div>
              <CheckCircleIcon className="w-8 h-8 text-green-400" />
            </div>
          </div>
          
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-xl p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`${adminTheme.textSecondary} text-sm`}>Banned</p>
                <p className={`text-2xl font-bold text-red-400`}>
                  {userStats.bannedUsers.toLocaleString()}
                </p>
              </div>
              <XCircleIcon className="w-8 h-8 text-red-400" />
            </div>
          </div>
          
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-xl p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`${adminTheme.textSecondary} text-sm`}>VIP Users</p>
                <p className={`text-2xl font-bold text-yellow-400`}>
                  {userStats.vipUsers.toLocaleString()}
                </p>
              </div>
              <StarIcon className="w-8 h-8 text-yellow-400" />
            </div>
          </div>
          
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-xl p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`${adminTheme.textSecondary} text-sm`}>KYC Pending</p>
                <p className={`text-2xl font-bold text-amber-400`}>
                  {userStats.kycPendingUsers.toLocaleString()}
                </p>
              </div>
              <ExclamationTriangleIcon className="w-8 h-8 text-amber-400" />
            </div>
          </div>
        </div>

        {/* Special Users Quick Access Panel */}
        {specialUsers.length > 0 && (
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 mb-6`}>
            <h2 className={`text-xl font-bold ${adminTheme.textPrimary} mb-4 flex items-center gap-2`}>
              <StarIcon className="w-6 h-6 text-yellow-400" />
              Special Users - Quick Access
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {specialUsers.slice(0, 6).map((user) => (
                <div
                  key={user._id}
                  className={`${adminTheme.surface} rounded-xl p-4 ${adminTheme.hover} transition-all cursor-pointer`}
                  onClick={() => {
                    setSelectedUser(user);
                    setShowUserDetails(true);
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className={`font-semibold ${adminTheme.textPrimary}`}>
                        {user.username || user.email}
                      </h3>
                      <p className={`${adminTheme.textSecondary} text-sm`}>
                        ${(user.totalDeposits || 0).toLocaleString()} total deposits
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {user.vipLevel > 0 && (
                        <span className="text-yellow-400 text-xs bg-yellow-400/20 px-2 py-1 rounded-full">
                          VIP {user.vipLevel}
                        </span>
                      )}
                      <StatusBadge user={user} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`${adminTheme.textSecondary} text-xs`}>
                      Last activity: {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUserAction(user._id, user.tags?.includes('special') ? 'removeSpecialTag' : 'addSpecialTag');
                      }}
                      className="text-yellow-400 hover:text-yellow-300 transition-colors"
                    >
                      <StarIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 mb-6`}>
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search users by email, username, or referral code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 ${adminTheme.input} rounded-lg`}
              />
            </div>
            
            {/* Filter Toggle */}
            <Button
              onClick={() => setShowFilters(!showFilters)}
              className={`${adminTheme.buttonSecondary} flex items-center gap-2`}
            >
              <AdjustmentsHorizontalIcon className="w-4 h-4" />
              Filters
            </Button>
          </div>
          
          {/* Filter Options */}
          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-600">
              <div>
                <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className={`w-full ${adminTheme.input} rounded-lg`}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="banned">Banned</option>
                </select>
              </div>
              
              <div>
                <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                  KYC Status
                </label>
                <select
                  value={filters.kycStatus}
                  onChange={(e) => handleFilterChange('kycStatus', e.target.value)}
                  className={`w-full ${adminTheme.input} rounded-lg`}
                >
                  <option value="all">All KYC</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                  <option value="not_started">Not Started</option>
                </select>
              </div>
              
              <div>
                <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                  VIP Level
                </label>
                <select
                  value={filters.vipLevel}
                  onChange={(e) => handleFilterChange('vipLevel', e.target.value)}
                  className={`w-full ${adminTheme.input} rounded-lg`}
                >
                  <option value="all">All VIP</option>
                  <option value="0">Regular (0)</option>
                  <option value="1">VIP 1</option>
                  <option value="2">VIP 2</option>
                  <option value="3">VIP 3</option>
                  <option value="4">VIP 4</option>
                  <option value="5">VIP 5</option>
                </select>
              </div>
              
              <div>
                <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                  Sort By
                </label>
                <select
                  value={`${filters.sortBy}-${filters.sortOrder}`}
                  onChange={(e) => {
                    const [sortBy, sortOrder] = e.target.value.split('-');
                    handleFilterChange('sortBy', sortBy);
                    handleFilterChange('sortOrder', sortOrder);
                  }}
                  className={`w-full ${adminTheme.input} rounded-lg`}
                >
                  <option value="createdAt-desc">Newest First</option>
                  <option value="createdAt-asc">Oldest First</option>
                  <option value="totalDeposits-desc">Highest Deposits</option>
                  <option value="tradeVolume-desc">Highest Volume</option>
                  <option value="lastLogin-desc">Recent Activity</option>
                  <option value="email-asc">Email A-Z</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Users Table */}
        <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${adminTheme.surface}`}>
                <tr>
                  <th className="p-4 text-left">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === users.length && users.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-600 bg-gray-700 text-[#FCD535]"
                    />
                  </th>
                  <th className={`p-4 text-left font-semibold ${adminTheme.textPrimary}`}>User</th>
                  <th className={`p-4 text-left font-semibold ${adminTheme.textPrimary}`}>Status</th>
                  <th className={`p-4 text-left font-semibold ${adminTheme.textPrimary}`}>KYC</th>
                  <th className={`p-4 text-left font-semibold ${adminTheme.textPrimary}`}>VIP</th>
                  <th className={`p-4 text-left font-semibold ${adminTheme.textPrimary}`}>Balance</th>
                  <th className={`p-4 text-left font-semibold ${adminTheme.textPrimary}`}>Activity</th>
                  <th className={`p-4 text-left font-semibold ${adminTheme.textPrimary}`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id} className={`border-t ${adminTheme.border} ${adminTheme.hover}`}>
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user._id)}
                        onChange={() => handleUserSelection(user._id)}
                        className="rounded border-gray-600 bg-gray-700 text-[#FCD535]"
                      />
                    </td>
                    
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#FCD535]/20 rounded-full flex items-center justify-center">
                          <span className="text-[#FCD535] font-semibold">
                            {(user.username || user.email).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className={`font-semibold ${adminTheme.textPrimary}`}>
                            {user.username || 'No username'}
                          </p>
                          <p className={`${adminTheme.textSecondary} text-sm`}>
                            {user.email}
                          </p>
                          {user.tags?.includes('special') && (
                            <span className="inline-flex items-center gap-1 text-xs text-yellow-400">
                              <StarIcon className="w-3 h-3" />
                              Special
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    
                    <td className="p-4">
                      <StatusBadge user={user} />
                    </td>
                    
                    <td className="p-4">
                      <KYCBadge status={user.kycStatus} />
                    </td>
                    
                    <td className="p-4">
                      {user.vipLevel > 0 ? (
                        <span className="text-yellow-400 font-semibold">
                          VIP {user.vipLevel}
                        </span>
                      ) : (
                        <span className={adminTheme.textSecondary}>Regular</span>
                      )}
                    </td>
                    
                    <td className="p-4">
                      <div className="text-sm">
                        {user.balances && Object.keys(user.balances).length > 0 ? (
                          Object.entries(user.balances).slice(0, 2).map(([currency, amount]) => (
                            <div key={currency} className={adminTheme.textPrimary}>
                              {amount.toFixed(2)} {currency}
                            </div>
                          ))
                        ) : (
                          <span className={adminTheme.textSecondary}>No balance</span>
                        )}
                      </div>
                    </td>
                    
                    <td className="p-4">
                      <div className="text-sm">
                        <p className={adminTheme.textPrimary}>
                          ${(user.totalDeposits || 0).toLocaleString()}
                        </p>
                        <p className={`${adminTheme.textSecondary} text-xs`}>
                          Last: {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                        </p>
                      </div>
                    </td>
                    
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowUserDetails(true);
                          }}
                          className="p-1 hover:bg-blue-500/20 rounded text-blue-400 hover:text-blue-300"
                          title="View Details"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowBalanceUpdate(true);
                          }}
                          className="p-1 hover:bg-green-500/20 rounded text-green-400 hover:text-green-300"
                          title="Update Balance"
                        >
                          <BanknotesIcon className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowPasswordReset(true);
                          }}
                          className="p-1 hover:bg-yellow-500/20 rounded text-yellow-400 hover:text-yellow-300"
                          title="Reset Password"
                        >
                          <KeyIcon className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => handleUserAction(user._id, user.tags?.includes('special') ? 'removeSpecialTag' : 'addSpecialTag')}
                          className={`p-1 hover:bg-opacity-20 rounded transition-colors ${
                            user.tags?.includes('special') 
                              ? 'hover:bg-gray-500 text-gray-400 hover:text-gray-300' 
                              : 'hover:bg-yellow-500 text-yellow-400 hover:text-yellow-300'
                          }`}
                          title={user.tags?.includes('special') ? 'Remove from Special Users' : 'Add to Special Users'}
                        >
                          <StarIcon className={`w-4 h-4 ${user.tags?.includes('special') ? 'fill-current' : ''}`} />
                        </button>
                        
                        <button
                          onClick={() => handleUserAction(user._id, user.isActive ? 'deactivate' : 'activate')}
                          className={`p-1 hover:bg-opacity-20 rounded transition-colors ${
                            user.isActive 
                              ? 'hover:bg-red-500 text-red-400 hover:text-red-300'
                              : 'hover:bg-green-500 text-green-400 hover:text-green-300'
                          }`}
                          title={user.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {user.isActive ? <XCircleIcon className="w-4 h-4" /> : <CheckCircleIcon className="w-4 h-4" />}
                        </button>
                        
                        <button
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete user ${user.email}? This action cannot be undone.`)) {
                              handleUserAction(user._id, 'delete');
                            }
                          }}
                          className="p-1 hover:bg-red-600/20 rounded text-red-500 hover:text-red-400"
                          title="Delete User"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={`${adminTheme.surface} p-4 flex items-center justify-between`}>
              <div className={`${adminTheme.textSecondary} text-sm`}>
                Showing {users.length} of {totalUsers.toLocaleString()} users
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`${adminTheme.buttonSecondary} p-2`}
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </Button>
                
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(5, totalPages))].map((_, index) => {
                    const page = Math.max(1, currentPage - 2) + index;
                    if (page > totalPages) return null;
                    
                    return (
                      <Button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`px-3 py-1 text-sm ${
                          page === currentPage 
                            ? adminTheme.buttonPrimary 
                            : adminTheme.buttonSecondary
                        }`}
                      >
                        {page}
                      </Button>
                    );
                  })}
                </div>
                
                <Button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`${adminTheme.buttonSecondary} p-2`}
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showUserDetails && selectedUser && (
        <div className={`fixed inset-0 ${adminTheme.modalOverlay} flex items-center justify-center z-50 p-4`}>
          <UserDetailsModal
            user={selectedUser}
            isOpen={showUserDetails}
            onClose={() => {
              setShowUserDetails(false);
              setSelectedUser(null);
            }}
            onUserUpdate={() => {
              fetchUsers(currentPage, searchTerm, filters);
              fetchSpecialUsers();
              fetchUserStats();
            }}
          />
        </div>
      )}

      {showBulkActions && (
        <div className={`fixed inset-0 ${adminTheme.modalOverlay} flex items-center justify-center z-50 p-4`}>
          <BulkActionsModal
            selectedUsers={users.filter(user => selectedUsers.includes(user._id))}
            isOpen={showBulkActions}
            onClose={() => {
              setShowBulkActions(false);
              setSelectedUsers([]);
            }}
            onBulkAction={() => {
              fetchUsers(currentPage, searchTerm, filters);
              fetchSpecialUsers();
              fetchUserStats();
              setSelectedUsers([]);
            }}
          />
        </div>
      )}

      {showBalanceUpdate && selectedUser && (
        <div className={`fixed inset-0 ${adminTheme.modalOverlay} flex items-center justify-center z-50 p-4`}>
          <BalanceUpdateModal
            user={selectedUser}
            isOpen={showBalanceUpdate}
            onClose={() => {
              setShowBalanceUpdate(false);
              setSelectedUser(null);
            }}
            onBalanceUpdate={() => {
              fetchUsers(currentPage, searchTerm, filters);
            }}
          />
        </div>
      )}

      {showPasswordReset && selectedUser && (
        <div className={`fixed inset-0 ${adminTheme.modalOverlay} flex items-center justify-center z-50 p-4`}>
          <PasswordResetModal
            user={selectedUser}
            isOpen={showPasswordReset}
            onClose={() => {
              setShowPasswordReset(false);
              setSelectedUser(null);
            }}
            onPasswordReset={() => {
              fetchUsers(currentPage, searchTerm, filters);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default AdminUserManager;
