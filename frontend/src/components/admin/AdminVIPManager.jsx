import React, { useState, useEffect } from 'react';
import { useSession } from '../../contexts/SessionContext';
import { Button } from "@/components/ui/button";
import {
  Crown,
  Star,
  Diamond,
  Trophy,
  Gift,
  Plus,
  Edit,
  Trash2,
  Eye,
  BarChart3,
  Users,
  DollarSign,
  Calendar,
  Award,
  TrendingUp,
  Clock,
  RefreshCw,
  Target,
  Settings,
  Save
} from 'lucide-react';
import { ApiUtils } from '../../services/api';
import { adminTheme } from '../../styles/adminTheme';
const AdminVIPManager = () => {
  const { sessionStatus, sessionToken } = useSession();
  const [activeTab, setActiveTab] = useState('levels');
  const [vipLevels, setVipLevels] = useState([]);
  const [allRewards, setAllRewards] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Modal states
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [editingLevel, setEditingLevel] = useState(null);
  const [showUserVIPModal, setShowUserVIPModal] = useState(false);
  
  // Form data
  const [levelForm, setLevelForm] = useState({
    level: '',
    name: '',
    minimumLevel1Referrals: '',
    minimumTotalReferrals: '',
    dailyReward: '',
    oneTimeUpgradeReward: '',
    currency: 'USDT',
    requirements: {
      description: '',
      additionalConditions: []
    },
    benefits: {
      description: '',
      features: []
    }
  });

  const [userVIPForm, setUserVIPForm] = useState({
    userId: '',
    vipLevel: ''
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [rewardFilters, setRewardFilters] = useState({
    status: '',
    rewardType: '',
    userId: ''
  });

  // Generate updated requirements description for the new referral system
  const getUpdatedRequirements = (level) => {
    if (level.level === 0) {
      return "Default level for all new users. No referrals required.";
    }
    
    const level1Req = level.minimumLevel1Referrals || 0;
    const totalReq = level.minimumTotalReferrals || 0;
    
    if (level1Req > 0 && totalReq > 0) {
      return `Requires ${level1Req} direct referrals and ${totalReq} total referrals across all levels (Level 1 + Level 2 + Level 3)`;
    } else if (level1Req > 0) {
      return `Requires ${level1Req} direct referrals (Level 1 only)`;
    } else if (totalReq > 0) {
      return `Requires ${totalReq} total referrals across all levels (Level 1 + Level 2 + Level 3)`;
    } else {
      return "No specific referral requirements set";
    }
  };

  // Update all VIP level requirements to use new referral system descriptions
  const updateAllRequirements = async () => {
    if (!confirm('Update all VIP level requirements descriptions to match the new multi-level referral system?')) return;
    
    try {
      setLoading(true);
      
      // Update each VIP level with new requirements description
      const updatePromises = vipLevels.map(async (level) => {
        const updatedDescription = getUpdatedRequirements(level);
        return ApiUtils.post('/rewards/admin/levels', {
          ...level,
          requirements: {
            ...level.requirements,
            description: updatedDescription
          }
        });
      });
      
      await Promise.all(updatePromises);
      setSuccess('All VIP level requirements updated successfully');
      loadVIPLevels();
    } catch (error) {
      setError('Failed to update requirements: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Load data
  const loadVIPLevels = async () => {
    try {
      setLoading(true);
      const data = await ApiUtils.get('/rewards/admin/levels');
      setVipLevels(data.vipLevels);
    } catch (error) {
      setError('Failed to load VIP levels: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadRewards = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ 
        page, 
        limit: 20 
      });
      if (rewardFilters.status) params.append('status', rewardFilters.status);
      if (rewardFilters.rewardType) params.append('rewardType', rewardFilters.rewardType);
      if (rewardFilters.userId) params.append('userId', rewardFilters.userId);
      
      const data = await ApiUtils.get(`/rewards/admin/rewards?${params}`);
      setAllRewards(data.rewards);
      setCurrentPage(data.pagination.page);
      setTotalPages(data.pagination.pages);
    } catch (error) {
      setError('Failed to load rewards: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const data = await ApiUtils.get('/rewards/admin/statistics');
      setStatistics(data);
    } catch (error) {
      setError('Failed to load statistics: ' + error.message);
    }
  };

  useEffect(() => {
    if (activeTab === 'levels') {
      loadVIPLevels();
    } else if (activeTab === 'rewards') {
      loadRewards();
    } else if (activeTab === 'statistics') {
      loadStatistics();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'rewards') {
      loadRewards(currentPage);
    }
  }, [rewardFilters]);

  // Handle level form
  const handleLevelForm = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setLevelForm(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setLevelForm(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleArrayField = (field, value, action = 'add') => {
    const [parent, child] = field.split('.');
    setLevelForm(prev => {
      const currentArray = prev[parent][child] || [];
      if (action === 'add' && value.trim()) {
        return {
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: [...currentArray, value.trim()]
          }
        };
      } else if (action === 'remove') {
        return {
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: currentArray.filter((item, index) => index !== value)
          }
        };
      }
      return prev;
    });
  };

  const openLevelModal = (level = null) => {
    if (level) {
      setEditingLevel(level);
      setLevelForm({
        level: level.level,
        name: level.name,
        minimumLevel1Referrals: level.minimumLevel1Referrals || 0,
        minimumTotalReferrals: level.minimumTotalReferrals || 0,
        dailyReward: level.dailyReward,
        oneTimeUpgradeReward: level.oneTimeUpgradeReward,
        currency: level.currency,
        requirements: level.requirements || { description: '', additionalConditions: [] },
        benefits: level.benefits || { description: '', features: [] }
      });
    } else {
      setEditingLevel(null);
      setLevelForm({
        level: '',
        name: '',
        minimumLevel1Referrals: '',
        minimumTotalReferrals: '',
        dailyReward: '',
        oneTimeUpgradeReward: '',
        currency: 'USDT',
        requirements: { description: '', additionalConditions: [] },
        benefits: { description: '', features: [] }
      });
    }
    setShowLevelModal(true);
  };

  const saveLevelForm = async () => {
    try {
      setLoading(true);
      await ApiUtils.post('/rewards/admin/levels', {
        ...levelForm,
        level: parseInt(levelForm.level),
        minimumLevel1Referrals: parseInt(levelForm.minimumLevel1Referrals),
        minimumTotalReferrals: parseInt(levelForm.minimumTotalReferrals),
        dailyReward: parseFloat(levelForm.dailyReward),
        oneTimeUpgradeReward: parseFloat(levelForm.oneTimeUpgradeReward)
      });
      
      setSuccess('VIP level saved successfully');
      setShowLevelModal(false);
      loadVIPLevels();
    } catch (error) {
      setError('Failed to save VIP level: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteLevel = async (level) => {
    if (!confirm(`Are you sure you want to delete VIP level ${level}?`)) return;
    
    try {
      setLoading(true);
      await ApiUtils.delete(`/rewards/admin/levels/${level}`);
      setSuccess('VIP level deleted successfully');
      loadVIPLevels();
    } catch (error) {
      setError('Failed to delete VIP level: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const setUserVIPLevel = async () => {
    try {
      setLoading(true);
      await ApiUtils.post('/rewards/admin/set-user-level', { 
        userId: userVIPForm.userId, 
        vipLevel: parseInt(userVIPForm.vipLevel) 
      });
      setSuccess('User VIP level updated successfully');
      setShowUserVIPModal(false);
      setUserVIPForm({ userId: '', vipLevel: '' });
    } catch (error) {
      setError('Failed to set user VIP level: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const createAllDailyRewards = async () => {
    if (!confirm('Create daily rewards for all eligible VIP users?')) return;
    
    try {
      setLoading(true);
      const result = await ApiUtils.post('/rewards/admin/create-daily-rewards');
      setSuccess(result.message);
    } catch (error) {
      setError('Failed to create daily rewards: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const expireOldRewards = async () => {
    if (!confirm('Expire all old unclaimed rewards?')) return;
    
    try {
      setLoading(true);
      const result = await ApiUtils.post('/rewards/admin/expire-rewards');
      setSuccess(result.message);
      if (activeTab === 'rewards') loadRewards();
    } catch (error) {
      setError('Failed to expire old rewards: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getVIPIcon = (level) => {
    switch (level) {
      case 0: return <Award className="w-5 h-5 text-yellow-500" />;
      case 1: return <Star className="w-5 h-5 text-gray-400" />;
      case 2: return <Crown className="w-5 h-5 text-yellow-500" />;
      case 3: return <Diamond className="w-5 h-5 text-blue-500" />;
      case 4: return <Trophy className="w-5 h-5 text-[#FCD535]" />;
      default: return <Gift className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Clear messages
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  return (
    <div className="min-h-screen bg-[#181A20] text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">VIP Management</h1>
          <p className="text-[#EAECEF]/60">Manage VIP levels, rewards, and user privileges</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={updateAllRequirements}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Update Requirements
          </Button>
          <Button 
            onClick={createAllDailyRewards}
            disabled={loading}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Create Daily Rewards
          </Button>
          <Button 
            onClick={expireOldRewards}
            disabled={loading}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold"
          >
            <Clock className="w-4 h-4 mr-2" />
            Expire Old Rewards
          </Button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-[#1F2128] backdrop-blur-md rounded-lg border border-[#333A47]">
        <nav className="flex space-x-1 p-1">
          {[
            { id: 'levels', label: 'VIP Levels', icon: Crown },
            { id: 'rewards', label: 'Rewards', icon: Gift },
            { id: 'statistics', label: 'Statistics', icon: BarChart3 },
            { id: 'settings', label: 'Settings', icon: Settings }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-linear-to-r from-[#FCD535] to-green-500 text-white'
                  : 'text-[#EAECEF]/60 hover:text-white hover:bg-[#333A47]'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'levels' && (
        <div className="space-y-6">

          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-white">VIP Levels</h2>
            <Button
              onClick={() => openLevelModal()}
              className="bg-linear-to-r from-[#FCD535] to-green-500 hover:from-[#E6C228] hover:to-green-600 text-white px-4 py-2 rounded-lg font-semibold"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add VIP Level
            </Button>
          </div>

          {vipLevels.length === 0 ? (
            <div className="bg-[#1F2128] backdrop-blur-md rounded-lg border border-[#333A47] text-center py-12">
              <Crown className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No VIP Levels Found</h3>
              <p className="text-[#EAECEF]/60 mb-4">Create your first VIP level to get started</p>
              <Button
                onClick={() => openLevelModal()}
                className="bg-linear-to-r from-[#FCD535] to-green-500 hover:from-[#E6C228] hover:to-green-600 text-white px-4 py-2 rounded-lg font-semibold"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create VIP Level
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {vipLevels.map((level) => (
                <div key={level._id} className="bg-[#1F2128] backdrop-blur-md rounded-lg border border-[#333A47] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {getVIPIcon(level.level)}
                      <div>
                        <h3 className="text-lg font-semibold text-white">{level.name}</h3>
                        <p className="text-[#EAECEF]/60">VIP Level {level.level}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => openLevelModal(level)}
                        size="sm"
                        className="bg-[#333A47] hover:bg-[#3F4654] text-[#EAECEF]/60 hover:text-white border border-[#4A5263] hover:border-[#5A6273] px-3 py-1 rounded"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      {level.level > 0 && (
                        <Button
                          onClick={() => deleteLevel(level.level)}
                          size="sm"
                          className="bg-[#333A47] hover:bg-[#3F4654] text-red-400 hover:text-red-300 border border-[#4A5263] hover:border-[#5A6273] px-3 py-1 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-[#EAECEF]/40">Level 1 Referrals:</span>
                      <p className="text-white font-medium">{level.minimumLevel1Referrals || 0}</p>
                    </div>
                    <div>
                      <span className="text-[#EAECEF]/40">Total Referrals:</span>
                      <p className="text-white font-medium">{level.minimumTotalReferrals || 0}</p>
                    </div>
                    <div>
                      <span className="text-[#EAECEF]/40">Daily Reward:</span>
                      <p className="text-white font-medium">${level.dailyReward} {level.currency}</p>
                    </div>
                    <div>
                      <span className="text-[#EAECEF]/40">Upgrade Reward:</span>
                      <p className="text-white font-medium">${level.oneTimeUpgradeReward} {level.currency}</p>
                    </div>
                  </div>

                  {(level.requirements?.description || level.minimumLevel1Referrals > 0 || level.minimumTotalReferrals > 0) && (
                    <div className="mt-4">
                      <span className="text-[#EAECEF]/40">Requirements:</span>
                      <p className="text-[#EAECEF]/60 text-sm mt-1">{getUpdatedRequirements(level)}</p>
                      <div className="mt-2 text-xs text-[#EAECEF]/40">
                        <span className="inline-block mr-4">🔗 Multi-level referral tracking</span>
                        <span className="inline-block">📊 Level 1 + Level 2 + Level 3 combined</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'rewards' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-white">All Rewards</h2>
            <Button
              onClick={() => setShowUserVIPModal(true)}
              className="bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-4 py-2 rounded-lg font-semibold"
            >
              <Users className="w-4 h-4 mr-2" />
              Set User VIP Level
            </Button>
          </div>

          {/* Filters */}
          <div className="bg-[#1F2128] backdrop-blur-md rounded-lg border border-[#333A47] p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#EAECEF]/60 mb-2">
                  Status
                </label>
                <select
                  value={rewardFilters.status}
                  onChange={(e) => setRewardFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#252A33] border border-[#333A47] rounded-lg text-[#EAECEF] focus:ring-2 focus:ring-[#FCD535] focus:border-transparent"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="claimed">Claimed</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#EAECEF]/60 mb-2">
                  Reward Type
                </label>
                <select
                  value={rewardFilters.rewardType}
                  onChange={(e) => setRewardFilters(prev => ({ ...prev, rewardType: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#252A33] border border-[#333A47] rounded-lg text-[#EAECEF] focus:ring-2 focus:ring-[#FCD535] focus:border-transparent"
                >
                  <option value="">All Types</option>
                  <option value="daily">Daily</option>
                  <option value="upgrade">Upgrade</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#EAECEF]/60 mb-2">
                  User ID
                </label>
                <input
                  type="text"
                  value={rewardFilters.userId}
                  onChange={(e) => setRewardFilters(prev => ({ ...prev, userId: e.target.value }))}
                  placeholder="Filter by User ID"
                  className="w-full px-3 py-2 bg-[#252A33] border border-[#333A47] rounded-lg text-[#EAECEF] placeholder-[#EAECEF]/40 focus:ring-2 focus:ring-[#FCD535] focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Rewards Table */}
          <div className="bg-[#1F2128] backdrop-blur-md rounded-lg border border-[#333A47] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-[#333A47]">
                <thead className="bg-[#181A20]/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#EAECEF]/60 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#EAECEF]/60 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#EAECEF]/60 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#EAECEF]/60 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#EAECEF]/60 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-[#1F2128]/30 divide-y divide-[#333A47]">
                  {allRewards.map((reward) => (
                    <tr key={reward._id} className="hover:bg-[#252A33]/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-[#EAECEF]">
                            {reward.user?.username || 'Unknown'}
                          </div>
                          <div className="text-sm text-[#EAECEF]/60">
                            VIP {reward.user?.vipLevel || 0}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          {reward.rewardType}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[#EAECEF]">
                        ${reward.amount} {reward.currency}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border ${
                          reward.status === 'claimed' 
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                            : reward.status === 'expired'
                            ? 'bg-red-500/20 text-red-300 border-red-500/30'
                            : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                        }`}>
                          {reward.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[#EAECEF]/60">
                        {formatDate(reward.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-[#1F2128] px-4 py-3 flex items-center justify-between border-t border-[#333A47]">
                <div className="flex-1 flex justify-between">
                  <Button
                    onClick={() => loadRewards(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="bg-[#252A33] hover:bg-[#2E3339] text-[#EAECEF]/60 hover:text-[#EAECEF] border border-[#333A47] hover:border-[#3D4556] px-4 py-2 rounded"
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-[#EAECEF]/60">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    onClick={() => loadRewards(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="bg-[#252A33] hover:bg-[#2E3339] text-[#EAECEF]/60 hover:text-[#EAECEF] border border-[#333A47] hover:border-[#3D4556] px-4 py-2 rounded"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'statistics' && statistics && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-white">VIP Statistics</h2>
          
          {/* User Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-linear-to-br from-[#1F2128] to-[#252A33] backdrop-blur-md rounded-lg border border-[#333A47] p-6">
              <div className="flex items-center">
                <Users className="w-8 h-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-[#EAECEF]/60">Total Users</p>
                  <p className="text-2xl font-bold text-[#EAECEF]">
                    {statistics.userStats.totalUsers.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-linear-to-br from-[#1F2128] to-[#252A33] backdrop-blur-md rounded-lg border border-[#333A47] p-6">
              <div className="flex items-center">
                <Crown className="w-8 h-8 text-yellow-400" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-[#EAECEF]/60">VIP Users</p>
                  <p className="text-2xl font-bold text-[#EAECEF]">
                    {statistics.userStats.vipUsersByLevel
                      .filter(level => level._id > 0)
                      .reduce((sum, level) => sum + level.count, 0)
                      .toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-linear-to-br from-[#1F2128] to-[#252A33] backdrop-blur-md rounded-lg border border-[#333A47] p-6">
              <div className="flex items-center">
                <Calendar className="w-8 h-8 text-emerald-400" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-[#EAECEF]/60">Today's Rewards</p>
                  <p className="text-2xl font-bold text-[#EAECEF]">
                    {statistics.todayRewards}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* VIP Level Distribution */}
          <div className="bg-linear-to-br from-[#1F2128] to-[#252A33] backdrop-blur-md rounded-lg border border-[#333A47] p-6">
            <h3 className="text-lg font-semibold text-[#EAECEF] mb-4">VIP Level Distribution</h3>
            <div className="space-y-4">
              {statistics.userStats.vipUsersByLevel.map((level) => (
                <div key={level._id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getVIPIcon(level._id)}
                    <span className="font-medium text-[#EAECEF]">VIP Level {level._id}</span>
                  </div>
                  <span className="text-lg font-bold text-[#EAECEF]">{level.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-[#EAECEF]">VIP System Settings</h2>
          
          {/* System Configuration */}
          <div className="bg-linear-to-br from-[#1F2128] to-[#252A33] backdrop-blur-md rounded-lg border border-[#333A47] p-6">
            <h3 className="text-lg font-semibold text-[#EAECEF] mb-4">Multi-Level Referral Configuration</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#EAECEF]/60 mb-2">
                    Referral Tracking Depth
                  </label>
                  <select className="w-full px-3 py-2 bg-[#252A33] border border-[#333A47] rounded-lg text-[#EAECEF] focus:ring-2 focus:ring-[#FCD535] focus:border-transparent">
                    <option value="3">3 Levels (Current)</option>
                    <option value="2">2 Levels</option>
                    <option value="4">4 Levels</option>
                    <option value="5">5 Levels</option>
                  </select>
                  <p className="text-xs text-[#EAECEF]/40 mt-1">How deep the referral chain tracking goes</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[#EAECEF]/60 mb-2">
                    VIP Level Update Frequency
                  </label>
                  <select className="w-full px-3 py-2 bg-[#252A33] border border-[#333A47] rounded-lg text-[#EAECEF] focus:ring-2 focus:ring-[#FCD535] focus:border-transparent">
                    <option value="realtime">Real-time (Current)</option>
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                  </select>
                  <p className="text-xs text-[#EAECEF]/40 mt-1">When VIP levels are recalculated</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#EAECEF]/60 mb-2">
                    Daily Reward Expiry (Hours)
                  </label>
                  <input
                    type="number"
                    defaultValue="24"
                    min="1"
                    max="72"
                    className="w-full px-3 py-2 bg-[#252A33] border border-[#333A47] rounded-lg text-[#EAECEF] placeholder-[#EAECEF]/40 focus:ring-2 focus:ring-[#FCD535] focus:border-transparent"
                  />
                  <p className="text-xs text-[#EAECEF]/40 mt-1">Hours before unclaimed rewards expire</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[#EAECEF]/60 mb-2">
                    Upgrade Reward Auto-Claim
                  </label>
                  <select className="w-full px-3 py-2 bg-[#252A33] border border-[#333A47] rounded-lg text-[#EAECEF] focus:ring-2 focus:ring-[#FCD535] focus:border-transparent">
                    <option value="manual">Manual Claim (Current)</option>
                    <option value="auto">Auto Claim</option>
                  </select>
                  <p className="text-xs text-[#EAECEF]/40 mt-1">Whether upgrade rewards are auto-claimed</p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-[#333A47]">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-semibold text-[#EAECEF]">System Status</h4>
                  <p className="text-xs text-[#EAECEF]/40">Multi-level VIP system is active and operational</p>
                </div>
                <div className="flex gap-3">
                  <Button className="bg-[#FCD535] hover:bg-[#E6C228] text-[#181A20] hover:text-[#181A20] border border-[#FCD535] hover:border-[#E6C228] px-4 py-2 rounded">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Recalculate All VIP Levels
                  </Button>
                  <Button className="bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-4 py-2 rounded-lg font-semibold">
                    <Save className="w-4 h-4 mr-2" />
                    Save Settings
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          {/* System Information */}
          <div className="bg-linear-to-br from-[#1F2128] to-[#252A33] backdrop-blur-md rounded-lg border border-[#333A47] p-6">
            <h3 className="text-lg font-semibold text-[#EAECEF] mb-4">System Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-green-400 mb-3">Recent Changes</h4>
                <ul className="text-sm text-[#EAECEF]/60 space-y-2">
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    <span>Updated to multi-level referral system</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    <span>Removed deposit requirements</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-[#FCD535] rounded-full"></span>
                    <span>Enhanced notification system</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                    <span>Added transaction logging</span>
                  </li>
                </ul>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold text-blue-400 mb-3">Database Schema</h4>
                <div className="text-xs text-[#EAECEF]/60 space-y-1 font-mono bg-[#1F2128]/50 p-3 rounded">
                  <div>• minimumLevel1Referrals (new)</div>
                  <div>• minimumTotalReferrals (new)</div>
                  <div className="text-red-400">• minimumReferrals (removed)</div>
                  <div className="text-red-400">• minimumReferralDeposits (removed)</div>
                  <div>• dailyReward (unchanged)</div>
                  <div>• oneTimeUpgradeReward (unchanged)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIP Level Modal */}
      {showLevelModal && (
        <div className={`fixed inset-0 ${adminTheme.modalOverlay} flex items-center justify-center z-50`}>
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto ${adminTheme.shadow}`}>
            <h2 className={`text-xl font-bold ${adminTheme.textPrimary} mb-4`}>
              {editingLevel ? 'Edit VIP Level' : 'Create VIP Level'}
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#EAECEF]/60 mb-2">
                    Level
                  </label>
                  <input
                    type="number"
                    value={levelForm.level}
                    onChange={(e) => handleLevelForm('level', e.target.value)}
                    min="0"
                    className="w-full px-3 py-2 bg-[#252A33] border border-[#333A47] rounded-lg text-[#EAECEF] placeholder-[#EAECEF]/40 focus:ring-2 focus:ring-[#FCD535] focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[#EAECEF]/60 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={levelForm.name}
                    onChange={(e) => handleLevelForm('name', e.target.value)}
                    className="w-full px-3 py-2 bg-[#252A33] border border-[#333A47] rounded-lg text-[#EAECEF] placeholder-[#EAECEF]/40 focus:ring-2 focus:ring-[#FCD535] focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#EAECEF]/60 mb-2">
                    Level 1 Referrals (Direct)
                  </label>
                  <input
                    type="number"
                    value={levelForm.minimumLevel1Referrals}
                    onChange={(e) => handleLevelForm('minimumLevel1Referrals', e.target.value)}
                    min="0"
                    placeholder="Number of direct referrals required"
                    className="w-full px-3 py-2 bg-[#252A33] border border-[#333A47] rounded-lg text-[#EAECEF] placeholder-[#EAECEF]/40 focus:ring-2 focus:ring-[#FCD535] focus:border-transparent"
                  />
                  <p className="text-xs text-[#EAECEF]/40 mt-1">Direct referrals only (Level 1)</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[#EAECEF]/60 mb-2">
                    Total Referrals (Multi-Level)
                  </label>
                  <input
                    type="number"
                    value={levelForm.minimumTotalReferrals}
                    onChange={(e) => handleLevelForm('minimumTotalReferrals', e.target.value)}
                    min="0"
                    placeholder="Total referrals across all levels"
                    className="w-full px-3 py-2 bg-[#252A33] border border-[#333A47] rounded-lg text-[#EAECEF] placeholder-[#EAECEF]/40 focus:ring-2 focus:ring-[#FCD535] focus:border-transparent"
                  />
                  <p className="text-xs text-[#EAECEF]/40 mt-1">Level 1 + Level 2 + Level 3 combined</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#EAECEF]/60 mb-2">
                    Daily Reward
                  </label>
                  <input
                    type="number"
                    value={levelForm.dailyReward}
                    onChange={(e) => handleLevelForm('dailyReward', e.target.value)}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 bg-[#252A33] border border-[#333A47] rounded-lg text-[#EAECEF] placeholder-[#EAECEF]/40 focus:ring-2 focus:ring-[#FCD535] focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[#EAECEF]/60 mb-2">
                    Upgrade Reward
                  </label>
                  <input
                    type="number"
                    value={levelForm.oneTimeUpgradeReward}
                    onChange={(e) => handleLevelForm('oneTimeUpgradeReward', e.target.value)}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 bg-[#252A33] border border-[#333A47] rounded-lg text-[#EAECEF] placeholder-[#EAECEF]/40 focus:ring-2 focus:ring-[#FCD535] focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[#EAECEF]/60 mb-2">
                    Currency
                  </label>
                  <select
                    value={levelForm.currency}
                    onChange={(e) => handleLevelForm('currency', e.target.value)}
                    className="w-full px-3 py-2 bg-[#252A33] border border-[#333A47] rounded-lg text-[#EAECEF] focus:ring-2 focus:ring-[#FCD535] focus:border-transparent"
                  >
                    <option value="USDT">USDT</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#EAECEF]/60 mb-2">
                  Requirements Description
                </label>
                <textarea
                  value={levelForm.requirements.description}
                  onChange={(e) => handleLevelForm('requirements.description', e.target.value)}
                  rows="2"
                  className="w-full px-3 py-2 bg-[#252A33] border border-[#333A47] rounded-lg text-[#EAECEF] placeholder-[#EAECEF]/40 focus:ring-2 focus:ring-[#FCD535] focus:border-transparent"
                />
              </div>

              {/* Multi-level Referral Explanation */}
              <div className="bg-[#252A33]/50 rounded-lg p-4 border border-[#333A47]">
                <h4 className="text-sm font-semibold text-[#EAECEF] mb-2">🔗 Multi-Level Referral System</h4>
                <div className="text-xs text-[#EAECEF]/60 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    <span><strong>Level 1:</strong> Direct referrals (User → Referral)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    <span><strong>Level 2:</strong> Referrals of Level 1 users</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                    <span><strong>Level 3:</strong> Referrals of Level 2 users</span>
                  </div>
                  <div className="mt-3 p-2 bg-[#1F2128] rounded text-xs">
                    <strong>Example:</strong> User A → User B (L1) → User C (L2) → User D (L3)<br/>
                    For User A: Level 1 = 1 (User B), Total = 3 (B + C + D)
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#EAECEF]/60 mb-2">
                  Benefits Description
                </label>
                <textarea
                  value={levelForm.benefits.description}
                  onChange={(e) => handleLevelForm('benefits.description', e.target.value)}
                  rows="2"
                  className="w-full px-3 py-2 bg-[#252A33] border border-[#333A47] rounded-lg text-[#EAECEF] placeholder-[#EAECEF]/40 focus:ring-2 focus:ring-[#FCD535] focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                onClick={() => setShowLevelModal(false)}
                className="bg-[#252A33] hover:bg-[#2E3339] text-[#EAECEF]/60 hover:text-[#EAECEF] border border-[#333A47] hover:border-[#3D4556] px-4 py-2 rounded"
              >
                Cancel
              </Button>
              <Button
                onClick={saveLevelForm}
                disabled={loading}
                className="bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-4 py-2 rounded-lg font-semibold"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save Level
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Set User VIP Level Modal */}
      {showUserVIPModal && (
        <div className={`fixed inset-0 ${adminTheme.modalOverlay} flex items-center justify-center z-50`}>
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-lg p-6 w-full max-w-md ${adminTheme.shadow}`}>
            <h2 className={`text-xl font-bold ${adminTheme.textPrimary} mb-4`}>Set User VIP Level</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#EAECEF]/60 mb-2">
                  User ID
                </label>
                <input
                  type="text"
                  value={userVIPForm.userId}
                  onChange={(e) => setUserVIPForm(prev => ({ ...prev, userId: e.target.value }))}
                  placeholder="Enter User ID"
                  className="w-full px-3 py-2 bg-[#252A33] border border-[#333A47] rounded-lg text-[#EAECEF] placeholder-[#EAECEF]/40 focus:ring-2 focus:ring-[#FCD535] focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#EAECEF]/60 mb-2">
                  VIP Level
                </label>
                <select
                  value={userVIPForm.vipLevel}
                  onChange={(e) => setUserVIPForm(prev => ({ ...prev, vipLevel: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#252A33] border border-[#333A47] rounded-lg text-[#EAECEF] focus:ring-2 focus:ring-[#FCD535] focus:border-transparent"
                >
                  <option value="">Select VIP Level</option>
                  {vipLevels.map((level) => (
                    <option key={level.level} value={level.level}>
                      VIP {level.level} - {level.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                onClick={() => setShowUserVIPModal(false)}
                className="bg-[#252A33] hover:bg-[#2E3339] text-[#EAECEF]/60 hover:text-[#EAECEF] border border-[#333A47] hover:border-[#3D4556] px-4 py-2 rounded"
              >
                Cancel
              </Button>
              <Button
                onClick={setUserVIPLevel}
                disabled={loading || !userVIPForm.userId || !userVIPForm.vipLevel}
                className="bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-4 py-2 rounded-lg font-semibold"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                Set VIP Level
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVIPManager;
