import React, { useState, useEffect } from 'react';
import { User, Users, Link, Search, Plus, Trash2, Edit3, Copy, Check, DollarSign, TrendingUp, Award, Settings, Save } from 'lucide-react';
import { adminTheme } from '../../styles/adminTheme';
import { ApiUtils } from '../../services/api';

const AdminReferralManager = () => {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({});
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCustomCodeModal, setShowCustomCodeModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [customCode, setCustomCode] = useState('');
  const [copiedCode, setCopiedCode] = useState('');
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'stats', 'settings'

  useEffect(() => {
    fetchUsersWithReferralCodes();
    fetchReferralStats();
    fetchReferralSettings();
  }, [currentPage, activeTab]);

  // Debounce search term to prevent API call on every keystroke
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchUsersWithReferralCodes();
    }, 500);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  const fetchUsersWithReferralCodes = async () => {
    if (activeTab !== 'users') return;
    
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: currentPage, limit: 20, search: searchTerm });
      const data = await ApiUtils.get(`referrals/admin/users-with-codes?${params}`);
      setUsers(data.users);
      setTotalPages(data.pagination.pages);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchReferralStats = async () => {
    try {
      const statsData = await ApiUtils.get('referrals/admin/stats');
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch referral stats:', err);
    }
  };

  const fetchReferralSettings = async () => {
    try {
      const settingsData = await ApiUtils.get('referrals/admin/settings');
      setSettings(settingsData);
    } catch (err) {
      console.error('Failed to fetch referral settings:', err);
    }
  };

  const handleSetCustomCode = async (userId, code) => {
    try {
      const result = await ApiUtils.post('referrals/admin/set-custom-code', { userId, referralCode: code });
      setSuccess(`Custom referral code "${result.referralCode}" set successfully!`);
      setShowCustomCodeModal(false);
      setSelectedUser(null);
      setCustomCode('');
      fetchUsersWithReferralCodes();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveCode = async (userId) => {
    if (!confirm('Are you sure you want to remove this referral code?')) {
      return;
    }

    try {
      await ApiUtils.post('referrals/admin/remove-code', { userId });
      setSuccess('Referral code removed successfully!');
      fetchUsersWithReferralCodes();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(type);
      setTimeout(() => setCopiedCode(''), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const openCustomCodeModal = (user) => {
    setSelectedUser(user);
    setCustomCode(user.referralCode || '');
    setShowCustomCodeModal(true);
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchTerm('');
    setError('');
  };

  const handleUpdateSettings = async (updatedSettings) => {
    try {
      setSettingsLoading(true);
      await ApiUtils.put('referrals/admin/settings', updatedSettings);
      setSettings(updatedSettings);
      setSuccess('Referral settings updated successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSettingsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${adminTheme.primary} flex items-center justify-center`}>
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#FCD535]"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${adminTheme.primary}`}>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 ${adminTheme.shadow}`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className={`p-3 ${adminTheme.accent} rounded-xl ${adminTheme.shadow}`}>
                <Users className="w-8 h-8 text-[#FCD535]" />
              </div>
              <div>
                <h1 className={`text-3xl font-bold ${adminTheme.textPrimary}`}>Referral System Manager</h1>
                <p className={`${adminTheme.textSecondary} mt-1`}>Manage referral codes, track performance, and configure settings</p>
              </div>
            </div>
            <div className="flex items-center space-x-4 text-sm text-[#FCD535]">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4" />
                <span>{stats.totalUsers || 0} total users</span>
              </div>
              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4" />
                <span>${stats.totalRewards || 0} distributed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl ${adminTheme.shadow}`}>
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => handleTabChange('users')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'users'
                  ? 'text-[#FCD535] border-b-2 border-[#FCD535] bg-[#FCD535]/10'
                  : `${adminTheme.textSecondary} hover:text-[#FCD535]`
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              User Management
            </button>
            <button
              onClick={() => handleTabChange('stats')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'stats'
                  ? 'text-[#FCD535] border-b-2 border-[#FCD535] bg-[#FCD535]/10'
                  : `${adminTheme.textSecondary} hover:text-[#FCD535]`
              }`}
            >
              <TrendingUp className="w-4 h-4 inline mr-2" />
              Statistics
            </button>
            <button
              onClick={() => handleTabChange('settings')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'text-[#FCD535] border-b-2 border-[#FCD535] bg-[#FCD535]/10'
                  : `${adminTheme.textSecondary} hover:text-[#FCD535]`
              }`}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              Settings
            </button>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className={`${adminTheme.successBg} border rounded-xl p-4`}>
            <div className="flex">
              <Check className="h-5 w-5 text-emerald-400" />
              <div className="ml-3">
                <p className="text-sm font-medium text-emerald-400">{success}</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className={`${adminTheme.dangerBg} border rounded-xl p-4`}>
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm font-medium text-red-400">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        {activeTab === 'users' && (
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-4 ${adminTheme.shadow}`}>
            <div className="relative">
              <Search className={`absolute left-3 top-3 h-4 w-4 ${adminTheme.textSecondary}`} />
              <input
                type="text"
                placeholder="Search by username, email, or referral code..."
                value={searchTerm}
                onChange={handleSearch}
                className={`w-full pl-10 pr-4 py-2 ${adminTheme.surface} ${adminTheme.border} rounded-lg focus:ring-2 focus:ring-[#FCD535] focus:border-transparent ${adminTheme.textPrimary}`}
              />
            </div>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'users' && (
          <UsersTab 
            users={users}
            adminTheme={adminTheme}
            formatDate={formatDate}
            copiedCode={copiedCode}
            copyToClipboard={copyToClipboard}
            openCustomCodeModal={openCustomCodeModal}
            handleRemoveCode={handleRemoveCode}
          />
        )}

        {activeTab === 'stats' && (
          <StatsTab 
            stats={stats}
            adminTheme={adminTheme}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab 
            settings={settings}
            adminTheme={adminTheme}
            onUpdateSettings={handleUpdateSettings}
            loading={settingsLoading}
            setSettingsLoading={setSettingsLoading}
            setSuccess={setSuccess}
            setError={setError}
          />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-4 ${adminTheme.shadow}`}>
            <div className="flex justify-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1 text-sm ${adminTheme.border} rounded disabled:opacity-50 ${adminTheme.textPrimary} ${adminTheme.hover}`}
              >
                Previous
              </button>
              <span className={`px-3 py-1 text-sm ${adminTheme.textPrimary}`}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={`px-3 py-1 text-sm ${adminTheme.border} rounded disabled:opacity-50 ${adminTheme.textPrimary} ${adminTheme.hover}`}
              >
                Next
              </button>
            </div>
          </div>
        )}

      {/* Custom Code Modal */}
      {showCustomCodeModal && (
        <div className={`fixed inset-0 ${adminTheme.modalOverlay} flex items-center justify-center z-50`}>
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 w-full max-w-md ${adminTheme.shadow}`}>
            <h3 className={`text-lg font-medium ${adminTheme.textPrimary} mb-4`}>
              Set Custom Referral Code
            </h3>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${adminTheme.textPrimary} mb-1`}>
                  User
                </label>
                <p className={`text-sm ${adminTheme.textPrimary}`}>{selectedUser?.username} ({selectedUser?.email})</p>
              </div>
              <div>
                <label className={`block text-sm font-medium ${adminTheme.textPrimary} mb-1`}>
                  Referral Code
                </label>
                <input
                  type="text"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                  placeholder="Enter 4-12 alphanumeric characters"
                  className={`w-full px-3 py-2 ${adminTheme.border} rounded-lg focus:ring-2 focus:ring-[#FCD535] focus:border-transparent ${adminTheme.surface} ${adminTheme.textPrimary}`}
                  maxLength="12"
                />
                <p className={`text-xs ${adminTheme.textSecondary} mt-1`}>
                  Must be 4-12 characters long, letters and numbers only
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowCustomCodeModal(false);
                    setSelectedUser(null);
                    setCustomCode('');
                  }}
                  className={`px-4 py-2 text-sm font-medium ${adminTheme.textSecondary} ${adminTheme.surface} ${adminTheme.border} rounded-lg hover:bg-gray-600/20 transition-colors`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSetCustomCode(selectedUser._id, customCode)}
                  disabled={!customCode || customCode.length < 4}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#FCD535] rounded-lg hover:bg-[#E6C228] disabled:opacity-50 transition-colors"
                >
                  Set Code
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

// Users Tab Component
const UsersTab = ({ users, adminTheme, formatDate, copiedCode, copyToClipboard, openCustomCodeModal, handleRemoveCode }) => (
  <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl ${adminTheme.shadow} overflow-hidden`}>
    <table className={`min-w-full divide-y ${adminTheme.border}`}>
      <thead className={`${adminTheme.surface}`}>
        <tr>
          <th className={`px-6 py-3 text-left text-xs font-medium ${adminTheme.textSecondary} uppercase tracking-wider`}>
            User
          </th>
          <th className={`px-6 py-3 text-left text-xs font-medium ${adminTheme.textSecondary} uppercase tracking-wider`}>
            Referral Code
          </th>
          <th className={`px-6 py-3 text-left text-xs font-medium ${adminTheme.textSecondary} uppercase tracking-wider`}>
            Referral Link
          </th>
          <th className={`px-6 py-3 text-left text-xs font-medium ${adminTheme.textSecondary} uppercase tracking-wider`}>
            Stats
          </th>
          <th className={`px-6 py-3 text-left text-xs font-medium ${adminTheme.textSecondary} uppercase tracking-wider`}>
            Actions
          </th>
        </tr>
      </thead>
      <tbody className={`${adminTheme.card} divide-y ${adminTheme.border}`}>
        {users.map((user) => (
          <tr key={user._id} className={`${adminTheme.hover} transition-colors`}>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="flex items-center">
                <div className="shrink-0 h-10 w-10">
                  <div className="h-10 w-10 rounded-full bg-[#FCD535]/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-[#FCD535]" />
                  </div>
                </div>
                <div className="ml-4">
                  <div className={`text-sm font-medium ${adminTheme.textPrimary}`}>{user.username}</div>
                  <div className={`text-sm ${adminTheme.textSecondary}`}>{user.email}</div>
                  <div className={`text-xs ${adminTheme.textSecondary} opacity-70`}>
                    Joined {formatDate(user.createdAt)}
                  </div>
                </div>
              </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-1 text-xs font-medium bg-[#FCD535]/10 text-[#FCD535] rounded">
                  {user.referralCode}
                </span>
                <button
                  onClick={() => copyToClipboard(user.referralCode, `code-${user._id}`)}
                  className={`p-1 ${adminTheme.textSecondary} hover:text-[#FCD535] transition-colors`}
                >
                  {copiedCode === `code-${user._id}` ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="flex items-center space-x-2">
                <Link className={`h-3 w-3 ${adminTheme.textSecondary}`} />
                <span className={`text-xs ${adminTheme.textSecondary} max-w-xs truncate`}>
                  {user.referralLink}
                </span>
                <button
                  onClick={() => copyToClipboard(user.referralLink, `link-${user._id}`)}
                  className={`p-1 ${adminTheme.textSecondary} hover:text-[#FCD535] transition-colors`}
                >
                  {copiedCode === `link-${user._id}` ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            </td>
            <td className={`px-6 py-4 whitespace-nowrap text-sm ${adminTheme.textPrimary}`}>
              <div className="space-y-1">
                <div>Total: {user.referralStats?.totalReferrals || 0}</div>
                <div>Successful: {user.referralStats?.successfulReferrals || 0}</div>
                <div>Pending: {user.referralStats?.pendingReferrals || 0}</div>
                <div className="text-emerald-400">Trading Bonuses: {user.tradingBonusStats?.totalBonuses || 0}</div>
              </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
              <button
                onClick={() => openCustomCodeModal(user)}
                className="text-[#FCD535] hover:text-[#E6C228] transition-colors"
              >
                <Edit3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleRemoveCode(user._id)}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Stats Tab Component
const StatsTab = ({ stats, adminTheme }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 ${adminTheme.shadow}`}>
      <div className="flex items-center">
        <div className={`p-3 ${adminTheme.accent} rounded-xl ${adminTheme.shadow}`}>
          <Users className="w-6 h-6 text-[#FCD535]" />
        </div>
        <div className="ml-4">
          <div className={`text-2xl font-bold ${adminTheme.textPrimary}`}>
            {stats.totalUsers || 0}
          </div>
          <div className={`text-sm ${adminTheme.textSecondary}`}>Total Users</div>
        </div>
      </div>
    </div>

    <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 ${adminTheme.shadow}`}>
      <div className="flex items-center">
        <div className={`p-3 ${adminTheme.accent} rounded-xl ${adminTheme.shadow}`}>
          <Link className="w-6 h-6 text-[#FCD535]" />
        </div>
        <div className="ml-4">
          <div className={`text-2xl font-bold ${adminTheme.textPrimary}`}>
            {stats.successfulReferrals || 0}
          </div>
          <div className={`text-sm ${adminTheme.textSecondary}`}>Successful Referrals</div>
        </div>
      </div>
    </div>

    <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 ${adminTheme.shadow}`}>
      <div className="flex items-center">
        <div className={`p-3 ${adminTheme.accent} rounded-xl ${adminTheme.shadow}`}>
          <DollarSign className="w-6 h-6 text-emerald-400" />
        </div>
        <div className="ml-4">
          <div className={`text-2xl font-bold text-emerald-400`}>
            ${stats.totalRewards || 0}
          </div>
          <div className={`text-sm ${adminTheme.textSecondary}`}>Total Rewards Paid</div>
        </div>
      </div>
    </div>

    <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 ${adminTheme.shadow}`}>
      <div className="flex items-center">
        <div className={`p-3 ${adminTheme.accent} rounded-xl ${adminTheme.shadow}`}>
          <TrendingUp className="w-6 h-6 text-blue-500" />
        </div>
        <div className="ml-4">
          <div className={`text-2xl font-bold text-blue-500`}>
            ${stats.tradingBonuses || 0}
          </div>
          <div className={`text-sm ${adminTheme.textSecondary}`}>Trading Bonuses</div>
        </div>
      </div>
    </div>

    <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 ${adminTheme.shadow}`}>
      <div className="flex items-center">
        <div className={`p-3 ${adminTheme.accent} rounded-xl ${adminTheme.shadow}`}>
          <Award className="w-6 h-6 text-yellow-400" />
        </div>
        <div className="ml-4">
          <div className={`text-2xl font-bold text-yellow-400`}>
            {stats.activeReferrers || 0}
          </div>
          <div className={`text-sm ${adminTheme.textSecondary}`}>Active Referrers</div>
        </div>
      </div>
    </div>

    <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 ${adminTheme.shadow}`}>
      <div className="flex items-center">
        <div className={`p-3 ${adminTheme.accent} rounded-xl ${adminTheme.shadow}`}>
          <DollarSign className="w-6 h-6 text-[#FCD535]" />
        </div>
        <div className="ml-4">
          <div className={`text-2xl font-bold ${adminTheme.textPrimary}`}>
            ${stats.averageReward || 0}
          </div>
          <div className={`text-sm ${adminTheme.textSecondary}`}>Average Reward</div>
        </div>
      </div>
    </div>
  </div>
);

// Settings Tab Component
const SettingsTab = ({ settings, adminTheme, onUpdateSettings, loading, setSettingsLoading, setSuccess, setError }) => {
  const [formData, setFormData] = useState({
    // General settings
    trackingEnabled: true,
    appName: 'CryptoTrader',
    defaultReferrerReward: 5,
    defaultRefereeReward: 2,
    minimumDepositAmount: 10,
    maxReferralsPerUser: 100,
    
    // Trading bonus settings
    'multiLevelTradingBonus.enabled': true,
    tradingBonusLevels: [],
    minimumTradingVolume: 100,
    ...settings
  });

  useEffect(() => {
    if (settings && Object.keys(settings).length > 0) {
      // Convert legacy level percentages to new format
      const levels = [];
      const legacyLevels = settings.multiLevelTradingBonus?.defaultLevelPercentages;
      
      if (legacyLevels) {
        Object.keys(legacyLevels).forEach(levelKey => {
          const levelNumber = parseInt(levelKey.replace('level', ''));
          const percentage = legacyLevels[levelKey];
          if (percentage > 0) {
            levels.push({ level: levelNumber, percentage: percentage });
          }
        });
      }
      
      setFormData(prev => ({
        ...prev,
        // General settings
        trackingEnabled: settings.trackingEnabled,
        appName: settings.appName,
        defaultReferrerReward: settings.defaultReferrerReward,
        defaultRefereeReward: settings.defaultRefereeReward,
        minimumDepositAmount: settings.minimumDepositAmount,
        maxReferralsPerUser: settings.maxReferralsPerUser,
        
        // Trading bonus settings
        'multiLevelTradingBonus.enabled': settings.multiLevelTradingBonus?.enabled,
        tradingBonusLevels: levels.length > 0 ? levels : [
          { level: 1, percentage: 0 }, // Start with 0 - admin must configure
          { level: 2, percentage: 0 },
          { level: 3, percentage: 0 },
          { level: 4, percentage: 0 }
        ],
        minimumTradingVolume: settings.minimumTradingVolume
      }));
    }
  }, [settings]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addTradingLevel = () => {
    const maxLevel = Math.max(...formData.tradingBonusLevels.map(l => l.level), 0);
    const newLevel = Math.min(maxLevel + 1, 100);
    
    if (newLevel <= 100 && !formData.tradingBonusLevels.find(l => l.level === newLevel)) {
      setFormData(prev => ({
        ...prev,
        tradingBonusLevels: [...prev.tradingBonusLevels, { level: newLevel, percentage: 0 }]
      }));
    }
  };

  const removeTradingLevel = (levelToRemove) => {
    setFormData(prev => ({
      ...prev,
      tradingBonusLevels: prev.tradingBonusLevels.filter(l => l.level !== levelToRemove)
    }));
  };

  const updateTradingLevel = (level, field, value) => {
    setFormData(prev => ({
      ...prev,
      tradingBonusLevels: prev.tradingBonusLevels.map(l => 
        l.level === level ? { ...l, [field]: value } : l
      )
    }));
  };

  const sortedLevels = [...formData.tradingBonusLevels].sort((a, b) => a.level - b.level);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Convert dynamic levels back to backend format
    const levelPercentages = {};
    formData.tradingBonusLevels.forEach(level => {
      levelPercentages[`level${level.level}`] = level.percentage;
    });
    
    // Transform form data to match backend model structure
    const settingsToUpdate = {
      trackingEnabled: formData.trackingEnabled,
      appName: formData.appName,
      defaultReferrerReward: formData.defaultReferrerReward,
      defaultRefereeReward: formData.defaultRefereeReward,
      minimumDepositAmount: formData.minimumDepositAmount,
      maxReferralsPerUser: formData.maxReferralsPerUser,
      multiLevelTradingBonus: {
        enabled: formData['multiLevelTradingBonus.enabled'],
        defaultLevelPercentages: levelPercentages
      },
      minimumTradingVolume: formData.minimumTradingVolume
    };
    
    onUpdateSettings(settingsToUpdate);
  };

  return (
    <div className="space-y-6">
      {/* Direct Referral Settings */}
      <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 ${adminTheme.shadow}`}>
        <div className="flex items-center gap-3 mb-6">
          <div className={`p-3 ${adminTheme.accent} rounded-xl ${adminTheme.shadow}`}>
            <Users className="w-6 h-6 text-[#FCD535]" />
          </div>
          <div>
            <h3 className={`text-xl font-bold ${adminTheme.textPrimary}`}>Direct Referral Settings</h3>
            <p className={`text-sm ${adminTheme.textSecondary}`}>Configure Level 1 direct referral rewards</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={`block text-sm font-medium ${adminTheme.textPrimary} mb-2`}>
                Referral System Status
              </label>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => handleInputChange('trackingEnabled', !formData.trackingEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.trackingEnabled ? 'bg-[#FCD535]' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.trackingEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className={`text-sm ${adminTheme.textPrimary}`}>
                  {formData.trackingEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium ${adminTheme.textPrimary} mb-2`}>
                App Name
              </label>
              <input
                type="text"
                value={formData.appName || ''}
                onChange={(e) => handleInputChange('appName', e.target.value)}
                className={`w-full px-3 py-2 ${adminTheme.border} rounded-lg focus:ring-2 focus:ring-[#FCD535] focus:border-transparent ${adminTheme.surface} ${adminTheme.textPrimary}`}
                placeholder="Your App Name"
              />
            </div>

            <div>
              <label className={`block text-sm font-medium ${adminTheme.textPrimary} mb-2`}>
                Direct Referral Reward (USDT)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.defaultReferrerReward || ''}
                onChange={(e) => handleInputChange('defaultReferrerReward', parseFloat(e.target.value) || 0)}
                className={`w-full px-3 py-2 ${adminTheme.border} rounded-lg focus:ring-2 focus:ring-[#FCD535] focus:border-transparent ${adminTheme.surface} ${adminTheme.textPrimary}`}
                placeholder="5.00"
              />
            </div>

            <div>
              <label className={`block text-sm font-medium ${adminTheme.textPrimary} mb-2`}>
                Referee Welcome Bonus (USDT)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.defaultRefereeReward || ''}
                onChange={(e) => handleInputChange('defaultRefereeReward', parseFloat(e.target.value) || 0)}
                className={`w-full px-3 py-2 ${adminTheme.border} rounded-lg focus:ring-2 focus:ring-[#FCD535] focus:border-transparent ${adminTheme.surface} ${adminTheme.textPrimary}`}
                placeholder="2.00"
              />
              <p className={`text-xs ${adminTheme.textSecondary} mt-1`}>
                Bonus given to new users who complete referral requirements
              </p>
            </div>

            <div>
              <label className={`block text-sm font-medium ${adminTheme.textPrimary} mb-2`}>
                Minimum Deposit (USDT)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.minimumDepositAmount || ''}
                onChange={(e) => handleInputChange('minimumDepositAmount', parseFloat(e.target.value) || 0)}
                className={`w-full px-3 py-2 ${adminTheme.border} rounded-lg focus:ring-2 focus:ring-[#FCD535] focus:border-transparent ${adminTheme.surface} ${adminTheme.textPrimary}`}
                placeholder="10.00"
              />
            </div>

            <div>
              <label className={`block text-sm font-medium ${adminTheme.textPrimary} mb-2`}>
                Maximum Referrals
              </label>
              <input
                type="number"
                min="1"
                value={formData.maxReferralsPerUser || ''}
                onChange={(e) => handleInputChange('maxReferralsPerUser', parseInt(e.target.value) || 0)}
                className={`w-full px-3 py-2 ${adminTheme.border} rounded-lg focus:ring-2 focus:ring-[#FCD535] focus:border-transparent ${adminTheme.surface} ${adminTheme.textPrimary}`}
                placeholder="100"
              />
            </div>
          </div>
        </form>
      </div>

      {/* Trading Bonus Settings */}
      <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 ${adminTheme.shadow}`}>
        <div className="flex items-center gap-3 mb-6">
          <div className={`p-3 ${adminTheme.accent} rounded-xl ${adminTheme.shadow}`}>
            <TrendingUp className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h3 className={`text-xl font-bold ${adminTheme.textPrimary}`}>Multi-Level Trading Bonus Settings</h3>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className={`block text-sm font-medium ${adminTheme.textPrimary} mb-2`}>
              Trading Bonus System
            </label>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => handleInputChange('multiLevelTradingBonus.enabled', !formData['multiLevelTradingBonus.enabled'])}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData['multiLevelTradingBonus.enabled'] ? 'bg-emerald-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData['multiLevelTradingBonus.enabled'] ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-sm ${adminTheme.textPrimary}`}>
                {formData['multiLevelTradingBonus.enabled'] ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          {formData['multiLevelTradingBonus.enabled'] && (
            <>
              {/* Dynamic Trading Levels */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className={`text-lg font-semibold ${adminTheme.textPrimary}`}>Trading Bonus Levels</h4>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs ${adminTheme.textSecondary}`}>
                      {formData.tradingBonusLevels.filter(l => l.percentage > 0).length} active levels
                    </span>
                    <button
                      type="button"
                      onClick={addTradingLevel}
                      disabled={formData.tradingBonusLevels.length >= 100}
                      className="px-4 py-2 bg-[#FCD535] hover:bg-[#E6C228] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Level
                    </button>
                  </div>
                </div>

                <div className="grid gap-4">
                  {sortedLevels.map((levelData) => (
                    <div key={levelData.level} className={`${adminTheme.surface} rounded-lg p-4 border ${adminTheme.border}`}>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${adminTheme.textPrimary} min-w-15`}>
                              Level {levelData.level}
                            </span>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={levelData.level}
                              onChange={(e) => {
                                const newLevel = parseInt(e.target.value) || 1;
                                if (newLevel >= 1 && newLevel <= 100 && !formData.tradingBonusLevels.find(l => l.level === newLevel && l.level !== levelData.level)) {
                                  updateTradingLevel(levelData.level, 'level', newLevel);
                                }
                              }}
                              className={`w-20 px-2 py-1 text-sm ${adminTheme.border} rounded focus:ring-2 focus:ring-[#FCD535] focus:border-transparent ${adminTheme.surface} ${adminTheme.textPrimary}`}
                            />
                          </div>
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              max="100"
                              value={levelData.percentage}
                              onChange={(e) => updateTradingLevel(levelData.level, 'percentage', parseFloat(e.target.value) || 0)}
                              className={`flex-1 px-3 py-2 ${adminTheme.border} rounded-lg focus:ring-2 focus:ring-[#FCD535] focus:border-transparent ${adminTheme.surface} ${adminTheme.textPrimary}`}
                              placeholder="0.0"
                            />
                            <span className={`text-sm ${adminTheme.textSecondary} min-w-5`}>%</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeTradingLevel(levelData.level)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {formData.tradingBonusLevels.length === 0 && (
                  <div className="text-center py-8">
                    <div className={`text-sm ${adminTheme.textSecondary} mb-4`}>
                      No trading bonus levels configured
                    </div>
                    <button
                      type="button"
                      onClick={addTradingLevel}
                      className="px-4 py-2 bg-[#FCD535] hover:bg-[#E6C228] text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 mx-auto"
                    >
                      <Plus className="w-4 h-4" />
                      Add First Level
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${adminTheme.textPrimary} mb-2`}>
                    Minimum Trading Volume (USDT)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.minimumTradingVolume || ''}
                    onChange={(e) => handleInputChange('minimumTradingVolume', parseFloat(e.target.value) || 0)}
                    className={`w-full px-3 py-2 ${adminTheme.border} rounded-lg focus:ring-2 focus:ring-[#FCD535] focus:border-transparent ${adminTheme.surface} ${adminTheme.textPrimary}`}
                    placeholder="100.00"
                  />
                  <p className={`text-xs ${adminTheme.textSecondary} mt-1`}>
                    Minimum volume required to trigger trading bonuses
                  </p>
                </div>
              </div>

              {/* Bonus Preview */}
              <div className={`${adminTheme.surface} rounded-lg p-4 border ${adminTheme.border}`}>
                <h4 className={`text-lg font-semibold ${adminTheme.textPrimary} mb-3`}>Bonus Structure Preview</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {formData.tradingBonusLevels && formData.tradingBonusLevels
                    .filter(levelData => levelData.percentage > 0)
                    .sort((a, b) => a.level - b.level)
                    .map((levelData, index) => (
                    <div key={levelData.level} className="text-center">
                      <div className={`text-sm ${adminTheme.textSecondary}`}>Level {levelData.level}</div>
                      <div className={`text-lg font-bold ${
                        index === 0 ? 'text-[#FCD535]' :
                        index === 1 ? 'text-blue-500' :
                        index === 2 ? 'text-emerald-400' :
                        index === 3 ? 'text-yellow-400' :
                        'text-pink-400'
                      }`}>
                        {levelData.percentage}%
                      </div>
                    </div>
                  ))}
                </div>
                {(!formData.tradingBonusLevels || formData.tradingBonusLevels.filter(l => l.percentage > 0).length === 0) && (
                  <div className={`text-center py-4 ${adminTheme.textSecondary}`}>
                    No bonus levels configured. Add levels above to see preview.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-between items-center">
        <button
          onClick={async () => {
            try {
              setSettingsLoading(true);
              await ApiUtils.post('referrals/admin/refresh-multilevel-counts');
              setSuccess('Multilevel referral counts refreshed successfully!');
              setTimeout(() => setSuccess(''), 3000);
            } catch (err) {
              setError(err.message);
            } finally {
              setSettingsLoading(false);
            }
          }}
          disabled={loading}
          className={`px-4 py-2 text-sm font-medium text-yellow-400 bg-yellow-600/20 border border-yellow-500/30 rounded-lg hover:bg-yellow-600/30 disabled:opacity-50 transition-colors flex items-center gap-2`}
        >
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
          ) : (
            <Users className="w-4 h-4" />
          )}
          {loading ? 'Refreshing...' : 'Refresh Multilevel Counts'}
        </button>
        
        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`px-6 py-3 text-sm font-medium text-white bg-linear-to-r from-[#FCD535] to-green-500 rounded-lg hover:from-[#E6C228] hover:to-green-600 disabled:opacity-50 transition-colors flex items-center gap-2 ${adminTheme.shadow}`}
        >
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            <Save className="w-4 h-4" />
          )}
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

export default AdminReferralManager;
