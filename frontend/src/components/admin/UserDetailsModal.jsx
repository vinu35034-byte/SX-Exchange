import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { adminTheme } from '../../styles/adminTheme';
import { ApiUtils } from '../../services/api';
import {
  XMarkIcon,
  UserIcon,
  BanknotesIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  TagIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ChartBarIcon
} from "@heroicons/react/24/outline";
import toast from 'react-hot-toast';

const UserDetailsModal = ({ user, isOpen, onClose, onUserUpdate }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [banReason, setBanReason] = useState('');
  const [userTags, setUserTags] = useState([]);
  const [newTag, setNewTag] = useState('');

  // Fetch detailed user information
  const fetchUserDetails = async () => {
    try {
      setLoading(true);
      const data = await ApiUtils.get(`/admin/users/${user._id}`);
      setUserDetails(data.data);
      setUserTags(data.data.tags || []);
    } catch (error) {
      console.error('Error fetching user details:', error);
      toast.error('Failed to fetch user details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      fetchUserDetails();
    }
  }, [isOpen, user]);

  const handleUserAction = async (action, reason = '') => {
    try {
      let endpoint = '';
      let body = {};

      switch (action) {
        case 'ban':
          endpoint = `/admin/users/${user._id}/ban`;
          body = { reason: reason || 'Banned by admin' };
          break;
        case 'unban':
          endpoint = `/admin/users/${user._id}/unban`;
          break;
        case 'activate':
          endpoint = `/admin/users/${user._id}/activate`;
          break;
        case 'deactivate':
          endpoint = `/admin/users/${user._id}/deactivate`;
          break;
        default:
          throw new Error('Invalid action');
      }

      await ApiUtils.post(endpoint, body);
      toast.success(`User ${action}ed successfully`);
      fetchUserDetails();
      onUserUpdate();
    } catch (error) {
      console.error(`Error ${action}ing user:`, error);
      toast.error(`Failed to ${action} user`);
    }
  };

  const handleKYCUpdate = async (status, reason = '') => {
    try {
      await ApiUtils.put(`/admin/users/${user._id}/kyc`, { 
        kycStatus: status, 
        rejectionReason: reason 
      });
      toast.success('KYC status updated successfully');
      fetchUserDetails();
      onUserUpdate();
    } catch (error) {
      console.error('Error updating KYC:', error);
      toast.error('Failed to update KYC status');
    }
  };

  const handleTagsUpdate = async () => {
    try {
      await ApiUtils.put(`/admin/users/${user._id}/tags`, { tags: userTags });
      toast.success('Tags updated successfully');
      fetchUserDetails();
      onUserUpdate();
    } catch (error) {
      console.error('Error updating tags:', error);
      toast.error('Failed to update tags');
    }
  };

  const addTag = () => {
    if (newTag && !userTags.includes(newTag)) {
      setUserTags([...userTags, newTag]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove) => {
    setUserTags(userTags.filter(tag => tag !== tagToRemove));
  };

  if (!isOpen || !user) return null;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: UserIcon },
    { id: 'transactions', label: 'Transactions', icon: BanknotesIcon },
    { id: 'activity', label: 'Activity', icon: ChartBarIcon },
    { id: 'security', label: 'Security', icon: ShieldCheckIcon }
  ];

  const StatusBadge = ({ user }) => {
    if (user.banReason) {
      return (
        <span className="px-3 py-1 text-sm font-medium bg-red-500/20 text-red-400 rounded-full">
          Banned
        </span>
      );
    }
    if (!user.isActive) {
      return (
        <span className="px-3 py-1 text-sm font-medium bg-gray-500/20 text-gray-400 rounded-full">
          Inactive
        </span>
      );
    }
    return (
      <span className="px-3 py-1 text-sm font-medium bg-green-500/20 text-green-400 rounded-full">
        Active
      </span>
    );
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className={`${adminTheme.surface} rounded-xl p-6`}>
        <h3 className={`text-lg font-semibold ${adminTheme.textPrimary} mb-4`}>
          Basic Information
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm ${adminTheme.textSecondary} mb-1`}>Username</label>
            <p className={`${adminTheme.textPrimary} font-medium`}>
              {userDetails?.user?.username || 'Not set'}
            </p>
          </div>
          <div>
            <label className={`block text-sm ${adminTheme.textSecondary} mb-1`}>Email</label>
            <p className={`${adminTheme.textPrimary} font-medium`}>
              {userDetails?.user?.email}
            </p>
          </div>
          <div>
            <label className={`block text-sm ${adminTheme.textSecondary} mb-1`}>Status</label>
            <StatusBadge user={userDetails?.user || user} />
          </div>
          <div>
            <label className={`block text-sm ${adminTheme.textSecondary} mb-1`}>VIP Level</label>
            <p className={`${adminTheme.textPrimary} font-medium`}>
              {userDetails?.user?.vipLevel > 0 ? `VIP ${userDetails.user.vipLevel}` : 'Regular'}
            </p>
          </div>
          <div>
            <label className={`block text-sm ${adminTheme.textSecondary} mb-1`}>Registered</label>
            <p className={`${adminTheme.textPrimary} font-medium`}>
              {new Date(userDetails?.user?.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div>
            <label className={`block text-sm ${adminTheme.textSecondary} mb-1`}>Last Login</label>
            <p className={`${adminTheme.textPrimary} font-medium`}>
              {userDetails?.user?.lastLogin ? new Date(userDetails.user.lastLogin).toLocaleDateString() : 'Never'}
            </p>
          </div>
        </div>
      </div>

      {/* Balances */}
      <div className={`${adminTheme.surface} rounded-xl p-6`}>
        <h3 className={`text-lg font-semibold ${adminTheme.textPrimary} mb-4`}>
          Account Balances
        </h3>
        {userDetails?.user?.balances && Object.keys(userDetails.user.balances).length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(userDetails.user.balances).map(([currency, amount]) => (
              <div key={currency} className={`${adminTheme.card} ${adminTheme.border} rounded-lg p-4`}>
                <div className="flex items-center justify-between">
                  <span className={`${adminTheme.textSecondary} text-sm`}>{currency}</span>
                  <CurrencyDollarIcon className="w-5 h-5 text-green-400" />
                </div>
                <p className={`text-xl font-bold ${adminTheme.textPrimary} mt-1`}>
                  {Number(amount).toFixed(6)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className={`${adminTheme.textSecondary}`}>No balances found</p>
        )}
      </div>

      {/* Actions */}
      <div className={`${adminTheme.surface} rounded-xl p-6`}>
        <h3 className={`text-lg font-semibold ${adminTheme.textPrimary} mb-4`}>
          Quick Actions
        </h3>
        <div className="flex flex-wrap gap-3">
          {userDetails?.user?.banReason ? (
            <Button
              onClick={() => handleUserAction('unban')}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircleIcon className="w-4 h-4 mr-2" />
              Unban User
            </Button>
          ) : (
            <Button
              onClick={() => {
                const reason = prompt('Enter ban reason:');
                if (reason) handleUserAction('ban', reason);
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <XCircleIcon className="w-4 h-4 mr-2" />
              Ban User
            </Button>
          )}
          
          <Button
            onClick={() => handleUserAction(userDetails?.user?.isActive ? 'deactivate' : 'activate')}
            className={`${userDetails?.user?.isActive ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'} text-white`}
          >
            {userDetails?.user?.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
        
        {userDetails?.user?.banReason && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className={`${adminTheme.textSecondary} text-sm`}>Ban Reason:</p>
            <p className="text-red-400">{userDetails.user.banReason}</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderTransactions = () => (
    <div className="space-y-6">
      <div className={`${adminTheme.surface} rounded-xl p-6`}>
        <h3 className={`text-lg font-semibold ${adminTheme.textPrimary} mb-4`}>
          Recent Transactions
        </h3>
        {userDetails?.transactions && userDetails.transactions.length > 0 ? (
          <div className="space-y-3">
            {userDetails.transactions.slice(0, 10).map((transaction, index) => (
              <div key={index} className={`${adminTheme.card} ${adminTheme.border} rounded-lg p-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      transaction.type === 'deposit' ? 'bg-green-500/20' :
                      transaction.type === 'withdrawal' ? 'bg-red-500/20' :
                      'bg-blue-500/20'
                    }`}>
                      {transaction.type === 'deposit' ? (
                        <ArrowDownIcon className="w-4 h-4 text-green-400" />
                      ) : transaction.type === 'withdrawal' ? (
                        <ArrowUpIcon className="w-4 h-4 text-red-400" />
                      ) : (
                        <BanknotesIcon className="w-4 h-4 text-blue-400" />
                      )}
                    </div>
                    <div>
                      <p className={`font-medium ${adminTheme.textPrimary}`}>
                        {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                      </p>
                      <p className={`text-sm ${adminTheme.textSecondary}`}>
                        {new Date(transaction.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${
                      transaction.type === 'deposit' ? 'text-green-400' :
                      transaction.type === 'withdrawal' ? 'text-red-400' :
                      adminTheme.textPrimary
                    }`}>
                      {transaction.type === 'withdrawal' ? '-' : '+'}
                      {transaction.amount} {transaction.currency}
                    </p>
                    <p className={`text-sm ${adminTheme.textSecondary}`}>
                      ${transaction.usdValue?.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={`${adminTheme.textSecondary}`}>No transactions found</p>
        )}
      </div>
    </div>
  );

  const renderActivity = () => (
    <div className="space-y-6">
      <div className={`${adminTheme.surface} rounded-xl p-6`}>
        <h3 className={`text-lg font-semibold ${adminTheme.textPrimary} mb-4`}>
          Account Statistics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-lg p-4 text-center`}>
            <BanknotesIcon className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className={`text-2xl font-bold ${adminTheme.textPrimary}`}>
              ${(userDetails?.user?.totalDeposits || 0).toLocaleString()}
            </p>
            <p className={`text-sm ${adminTheme.textSecondary}`}>Total Deposits</p>
          </div>
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-lg p-4 text-center`}>
            <ArrowUpIcon className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className={`text-2xl font-bold ${adminTheme.textPrimary}`}>
              ${(userDetails?.user?.totalWithdrawals || 0).toLocaleString()}
            </p>
            <p className={`text-sm ${adminTheme.textSecondary}`}>Total Withdrawals</p>
          </div>
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-lg p-4 text-center`}>
            <ChartBarIcon className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <p className={`text-2xl font-bold ${adminTheme.textPrimary}`}>
              ${(userDetails?.user?.tradeVolume || 0).toLocaleString()}
            </p>
            <p className={`text-sm ${adminTheme.textSecondary}`}>Trade Volume</p>
          </div>
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-lg p-4 text-center`}>
            <ClockIcon className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <p className={`text-2xl font-bold ${adminTheme.textPrimary}`}>
              {userDetails?.user?.loginCount || 0}
            </p>
            <p className={`text-sm ${adminTheme.textSecondary}`}>Login Count</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecurity = () => (
    <div className="space-y-6">
      {/* KYC Status */}
      <div className={`${adminTheme.surface} rounded-xl p-6`}>
        <h3 className={`text-lg font-semibold ${adminTheme.textPrimary} mb-4`}>
          KYC Verification
        </h3>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className={`${adminTheme.textPrimary} font-medium`}>
              Current Status: {userDetails?.user?.kycStatus || 'not_started'}
            </p>
            {userDetails?.user?.kycRejectionReason && (
              <p className="text-red-400 text-sm mt-1">
                Rejection Reason: {userDetails.user.kycRejectionReason}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => handleKYCUpdate('approved')}
              className="bg-green-600 hover:bg-green-700 text-white text-sm"
            >
              Approve
            </Button>
            <Button
              onClick={() => {
                const reason = prompt('Enter rejection reason:');
                if (reason) handleKYCUpdate('rejected', reason);
              }}
              className="bg-red-600 hover:bg-red-700 text-white text-sm"
            >
              Reject
            </Button>
          </div>
        </div>
      </div>

      {/* Tags Management */}
      <div className={`${adminTheme.surface} rounded-xl p-6`}>
        <h3 className={`text-lg font-semibold ${adminTheme.textPrimary} mb-4`}>
          User Tags
        </h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {userTags.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm"
            >
              <TagIcon className="w-3 h-3" />
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="ml-1 hover:text-red-400"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Add new tag..."
            className={`flex-1 ${adminTheme.input} rounded-lg`}
            onKeyPress={(e) => e.key === 'Enter' && addTag()}
          />
          <Button onClick={addTag} className={adminTheme.buttonPrimary}>
            Add Tag
          </Button>
          <Button onClick={handleTagsUpdate} className={adminTheme.buttonSecondary}>
            Save Tags
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden`}>
        {/* Header */}
        <div className={`${adminTheme.surface} p-6 border-b ${adminTheme.border} flex items-center justify-between`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#FCD535]/20 rounded-full flex items-center justify-center">
              <span className="text-[#FCD535] font-semibold text-lg">
                {(user.username || user.email).charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className={`text-2xl font-bold ${adminTheme.textPrimary}`}>
                {user.username || 'No username'}
              </h2>
              <p className={`${adminTheme.textSecondary}`}>{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-600/50 rounded-lg">
            <XMarkIcon className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className={`${adminTheme.surface} border-b ${adminTheme.border}`}>
          <div className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                    activeTab === tab.id
                      ? `${adminTheme.textPrimary} border-b-2 border-[#FCD535]`
                      : `${adminTheme.textSecondary} hover:${adminTheme.textPrimary}`
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-[#FCD535]/30 border-t-[#FCD535] rounded-full animate-spin mx-auto mb-4"></div>
                <p className={adminTheme.textSecondary}>Loading user details...</p>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'transactions' && renderTransactions()}
              {activeTab === 'activity' && renderActivity()}
              {activeTab === 'security' && renderSecurity()}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDetailsModal;
