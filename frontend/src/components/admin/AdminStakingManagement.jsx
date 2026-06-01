import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Users, 
  TrendingUp, 
  DollarSign, 
  Calendar,
  Settings,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  Coins,
  Lock,
  Unlock,
  Gift
} from 'lucide-react';
import { adminTheme } from '../../styles/adminTheme';
import { ApiUtils } from '../../services/api';

const AdminStakingManagement = () => {
  const [stakingPools, setStakingPools] = useState([]);
  const [stakingPositions, setStakingPositions] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pools');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPool, setSelectedPool] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [processing, setProcessing] = useState(false);
  
  const [poolForm, setPoolForm] = useState({
    name: '',
    symbol: '',
    description: '',
    apy: '',
    minimumStake: '',
    maximumStake: '',
    lockPeriod: '',
    totalPoolLimit: '',
    rewardToken: '',
    rewardDistributionType: 'daily',
    isVipOnly: false,
    requiredVipLevel: '',
    earlyUnstakePenalty: '',
    endDate: '',
    iconUrl: ''
  });

  useEffect(() => {
    fetchStakingData();
  }, []);

  const fetchStakingData = async () => {
    try {
      setLoading(true);
      
      // Fetch staking data with better error handling
      let poolsData, positionsData, analyticsData;
      
      try {
        poolsData = await ApiUtils.get('admin/staking/pools');
      } catch (error) {
        console.error('🔍 Pools API error:', error);
        poolsData = { pools: [] };
      }
      
      try {
        positionsData = await ApiUtils.get('admin/staking/positions');
      } catch (error) {
        console.error('🔍 Positions API error:', error);
        positionsData = { positions: [] };
      }
      
      try {
        analyticsData = await ApiUtils.get('admin/staking/analytics');
      } catch (error) {
        console.error('🔍 Analytics API error:', error);
        analyticsData = {};
      }

      // Extract data from nested structure
      const pools = poolsData?.data?.pools || poolsData?.pools || poolsData || [];
      const positions = positionsData?.data?.positions || positionsData?.positions || positionsData || [];
      const analytics = analyticsData?.data || analyticsData || {};

      setStakingPools(Array.isArray(pools) ? pools : []);
      setStakingPositions(Array.isArray(positions) ? positions : []);
      setAnalytics(analytics);

    } catch (error) {
      alert(`Failed to load staking data: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePool = async (e) => {
    e.preventDefault();
    if (processing) return;

    try {
      setProcessing(true);
      
      const poolData = {
        ...poolForm,
        apy: parseFloat(poolForm.apy),
        minimumStake: parseFloat(poolForm.minimumStake),
        maximumStake: poolForm.maximumStake ? parseFloat(poolForm.maximumStake) : null,
        lockPeriod: parseInt(poolForm.lockPeriod),
        totalPoolLimit: poolForm.totalPoolLimit ? parseFloat(poolForm.totalPoolLimit) : null,
        requiredVipLevel: poolForm.requiredVipLevel ? parseInt(poolForm.requiredVipLevel) : null,
        earlyUnstakePenalty: poolForm.earlyUnstakePenalty ? parseFloat(poolForm.earlyUnstakePenalty) : 0,
        endDate: poolForm.endDate || null
      };

      const response = await ApiUtils.post('admin/staking/pools', poolData);

      if (response.success || response.pools) {
        setShowCreateModal(false);
        resetPoolForm();
        fetchStakingData();
      } else {
        console.error('Failed to create pool:', response.message || 'Unknown error');
      }

    } catch (error) {
      console.error('Error creating pool:', error);
      alert(`Failed to create pool: ${error.message || 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdatePool = async (e) => {
    e.preventDefault();
    if (processing || !selectedPool) return;

    try {
      setProcessing(true);
      
      const poolData = {
        ...poolForm,
        apy: parseFloat(poolForm.apy),
        minimumStake: parseFloat(poolForm.minimumStake),
        maximumStake: poolForm.maximumStake ? parseFloat(poolForm.maximumStake) : null,
        totalPoolLimit: poolForm.totalPoolLimit ? parseFloat(poolForm.totalPoolLimit) : null,
        requiredVipLevel: poolForm.requiredVipLevel ? parseInt(poolForm.requiredVipLevel) : null,
        earlyUnstakePenalty: poolForm.earlyUnstakePenalty ? parseFloat(poolForm.earlyUnstakePenalty) : 0,
        endDate: poolForm.endDate || null
      };

      const response = await ApiUtils.put(`admin/staking/pools/${selectedPool._id}`, poolData);

      if (response.success || response.pool) {
        setShowEditModal(false);
        setSelectedPool(null);
        resetPoolForm();
        fetchStakingData();
      } else {
        console.error('Failed to update pool:', response.message || 'Unknown error');
      }

    } catch (error) {
      console.error('Error updating pool:', error);
      alert(`Failed to update pool: ${error.message || 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleDeletePool = async (poolId) => {
    if (!confirm('Are you sure you want to delete this staking pool?')) return;

    try {
      const response = await ApiUtils.delete(`admin/staking/pools/${poolId}`);

      if (response.success || response.deleted) {
        fetchStakingData();
      } else {
        console.error('Failed to delete pool:', response.message || 'Unknown error');
      }

    } catch (error) {
      console.error('Error deleting pool:', error);
      alert(`Failed to delete pool: ${error.message || 'Unknown error'}`);
    }
  };

  const handleProcessRewards = async (poolId = null) => {
    if (!confirm('Process rewards for all eligible positions?')) return;

    try {
      setProcessing(true);
      
      const endpoint = poolId ? `admin/staking/rewards/process?poolId=${poolId}` : 'admin/staking/rewards/process';
      const response = await ApiUtils.post(endpoint, {});

      if (response.success || response.processedPositions !== undefined) {
        fetchStakingData();
        const processedCount = response.processedPositions || response.data?.processedPositions || 0;
        const totalRewards = response.totalRewardsDistributed || response.data?.totalRewardsDistributed || 0;
        alert(`Processed ${processedCount} positions, distributed ${totalRewards} rewards`);
      } else {
        console.error('Failed to process rewards:', response.message || 'Unknown error');
      }

    } catch (error) {
      console.error('Error processing rewards:', error);
      alert(`Failed to process rewards: ${error.message || 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleForceUnstake = async (positionId) => {
    if (!confirm('Are you sure you want to force unstake this position? This action cannot be undone.')) return;

    try {
      setProcessing(true);
      
      const response = await ApiUtils.post(`admin/staking/force-unstake/${positionId}`, {});

      if (response.success || response.unstaked) {
        fetchStakingData();
        alert('Position force unstaked successfully');
      } else {
        console.error('Failed to force unstake position:', response.message || 'Unknown error');
        alert(`Failed to force unstake position: ${response.message || 'Unknown error'}`);
      }

    } catch (error) {
      console.error('Error force unstaking position:', error);
      alert(`Failed to force unstake position: ${error.message || 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };

  const resetPoolForm = () => {
    setPoolForm({
      name: '',
      symbol: '',
      description: '',
      apy: '',
      minimumStake: '',
      maximumStake: '',
      lockPeriod: '',
      totalPoolLimit: '',
      rewardToken: '',
      rewardDistributionType: 'daily',
      isVipOnly: false,
      requiredVipLevel: '',
      earlyUnstakePenalty: '',
      endDate: '',
      iconUrl: ''
    });
  };

  const openEditModal = (pool) => {
    setSelectedPool(pool);
    setPoolForm({
      name: pool.name,
      symbol: pool.symbol,
      description: pool.description || '',
      apy: pool.apy.toString(),
      minimumStake: pool.minimumStake.toString(),
      maximumStake: pool.maximumStake?.toString() || '',
      lockPeriod: pool.lockPeriod.toString(),
      totalPoolLimit: pool.totalPoolLimit?.toString() || '',
      rewardToken: pool.rewardToken,
      rewardDistributionType: pool.rewardDistributionType,
      isVipOnly: pool.isVipOnly,
      requiredVipLevel: pool.requiredVipLevel?.toString() || '',
      earlyUnstakePenalty: pool.earlyUnstakePenalty?.toString() || '',
      endDate: pool.endDate ? new Date(pool.endDate).toISOString().split('T')[0] : '',
      iconUrl: pool.iconUrl || ''
    });
    setShowEditModal(true);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(num || 0);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredPools = Array.isArray(stakingPools) ? stakingPools.filter(pool => {
    const matchesSearch = pool.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         pool.symbol?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && pool.isActive) ||
                         (statusFilter === 'inactive' && !pool.isActive);
    return matchesSearch && matchesStatus;
  }) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-[#FCD535]" />
          <p className={adminTheme.textSecondary}>Loading staking management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${adminTheme.primary}`}>
      {/* Header */}
      <div className={`${adminTheme.card} border-b ${adminTheme.border} p-6`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-2xl font-bold mb-2 ${adminTheme.textPrimary}`}>Staking Management</h1>
            <p className={adminTheme.textSecondary}>Manage staking pools and monitor user positions</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleProcessRewards()}
              disabled={processing}
              className={`${adminTheme.buttonSecondary} px-4 py-2 rounded-lg flex items-center gap-2`}
            >
              <Gift className="w-4 h-4" />
              Process Rewards
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className={`${adminTheme.buttonPrimary} px-4 py-2 rounded-lg flex items-center gap-2`}
            >
              <Plus className="w-4 h-4" />
              Create Pool
            </button>
          </div>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-4 gap-6 mt-6">
          <div className={`${adminTheme.surface} ${adminTheme.border} border rounded-lg p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`${adminTheme.textMuted} text-sm`}>Total Pools</p>
                <p className={`text-2xl font-bold ${adminTheme.textPrimary}`}>{analytics?.overview?.totalPools || 0}</p>
              </div>
              <Coins className="w-8 h-8 text-[#FCD535]" />
            </div>
          </div>
          <div className={`${adminTheme.surface} ${adminTheme.border} border rounded-lg p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`${adminTheme.textMuted} text-sm`}>Total Value Locked</p>
                <p className={`text-2xl font-bold ${adminTheme.textPrimary}`}>${formatNumber(analytics?.overview?.totalValueLocked || 0)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-emerald-400" />
            </div>
          </div>
          <div className={`${adminTheme.surface} ${adminTheme.border} border rounded-lg p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`${adminTheme.textMuted} text-sm`}>Total Participants</p>
                <p className={`text-2xl font-bold ${adminTheme.textPrimary}`}>{analytics?.overview?.totalParticipants || 0}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className={`${adminTheme.surface} ${adminTheme.border} border rounded-lg p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`${adminTheme.textMuted} text-sm`}>Total Rewards Paid</p>
                <p className={`text-2xl font-bold ${adminTheme.textPrimary}`}>${formatNumber(analytics?.rewardSummary?.totalRewards || 0)}</p>
              </div>
              <Gift className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className={`${adminTheme.surface} border-b ${adminTheme.border}`}>
        <div className="flex">
          <button
            onClick={() => setActiveTab('pools')}
            className={`px-6 py-4 font-medium border-b-2 transition-colors ${
              activeTab === 'pools'
                ? 'border-[#FCD535] text-[#FCD535]'
                : `border-transparent ${adminTheme.textSecondary} hover:${adminTheme.textPrimary}`
            }`}
          >
            Staking Pools
          </button>
          <button
            onClick={() => setActiveTab('positions')}
            className={`px-6 py-4 font-medium border-b-2 transition-colors ${
              activeTab === 'positions'
                ? 'border-[#FCD535] text-[#FCD535]'
                : `border-transparent ${adminTheme.textSecondary} hover:${adminTheme.textPrimary}`
            }`}
          >
            User Positions
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-4 font-medium border-b-2 transition-colors ${
              activeTab === 'analytics'
                ? 'border-[#FCD535] text-[#FCD535]'
                : `border-transparent ${adminTheme.textSecondary} hover:${adminTheme.textPrimary}`
            }`}
          >
            Analytics
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'pools' && (
          <div>
            {/* Filters */}
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1">
                <Search className={`w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 ${adminTheme.textMuted}`} />
                <input
                  type="text"
                  placeholder="Search pools..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 ${adminTheme.input} border rounded-lg focus:outline-none`}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`px-4 py-2 ${adminTheme.select} border rounded-lg focus:outline-none`}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Pools Table */}
            <div className={`${adminTheme.surface} ${adminTheme.border} border rounded-lg overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={`${adminTheme.tableHeader}`}>
                    <tr>
                      <th className={`px-6 py-4 text-left font-medium ${adminTheme.textSecondary}`}>Pool</th>
                      <th className={`px-6 py-4 text-left font-medium ${adminTheme.textSecondary}`}>APY</th>
                      <th className={`px-6 py-4 text-left font-medium ${adminTheme.textSecondary}`}>TVL</th>
                      <th className={`px-6 py-4 text-left font-medium ${adminTheme.textSecondary}`}>Participants</th>
                      <th className={`px-6 py-4 text-left font-medium ${adminTheme.textSecondary}`}>Lock Period</th>
                      <th className={`px-6 py-4 text-left font-medium ${adminTheme.textSecondary}`}>Status</th>
                      <th className={`px-6 py-4 text-right font-medium ${adminTheme.textSecondary}`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${adminTheme.border}`}>
                    {filteredPools.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-12 text-center">
                          <div className="text-center">
                            <Coins className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                            <p className={`text-lg font-medium ${adminTheme.textSecondary}`}>No staking pools found</p>
                            <p className={`text-sm ${adminTheme.textMuted}`}>
                              {searchTerm || statusFilter !== 'all' 
                                ? 'Try adjusting your search or filters' 
                                : 'Create your first staking pool to get started'
                              }
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredPools.map((pool) => (
                        <tr key={pool._id} className={`${adminTheme.hover} transition-colors`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-[#FCD535]/20 rounded-lg flex items-center justify-center">
                                <span className="font-bold text-[#FCD535]">
                                  {pool.symbol?.charAt(0) || '?'}
                                </span>
                              </div>
                              <div>
                                <p className={`font-medium ${adminTheme.textPrimary}`}>{pool.name || 'Unknown Pool'}</p>
                                <p className={`text-sm ${adminTheme.textMuted}`}>{pool.symbol || 'N/A'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-emerald-400 font-medium">{formatNumber(pool.apy || 0)}%</span>
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <p className={`font-medium ${adminTheme.textPrimary}`}>${formatNumber(pool.currentTotalStaked || 0)}</p>
                              {pool.totalPoolLimit && (
                                <p className={`text-sm ${adminTheme.textMuted}`}>
                                  of ${formatNumber(pool.totalPoolLimit)}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`font-medium ${adminTheme.textPrimary}`}>{pool.totalParticipants || 0}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-sm ${
                              (pool.lockPeriod || 0) === 0
                                ? adminTheme.successBg
                                : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
                            }`}>
                              {(pool.lockPeriod || 0) === 0 ? 'Flexible' : `${pool.lockPeriod || 0} days`}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-sm ${
                              pool.isActive
                                ? adminTheme.successBg
                                : 'bg-gray-500/10 border-gray-500/20 text-gray-400'
                            }`}>
                              {pool.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openEditModal(pool)}
                                className={`p-2 ${adminTheme.hover} rounded-lg transition-colors`}
                                title="Edit Pool"
                              >
                                <Edit3 className={`w-4 h-4 ${adminTheme.textSecondary}`} />
                              </button>
                              <button
                                onClick={() => handleProcessRewards(pool._id)}
                                className={`p-2 ${adminTheme.hover} rounded-lg transition-colors`}
                                title="Process Rewards"
                              >
                                <Gift className={`w-4 h-4 ${adminTheme.textSecondary}`} />
                              </button>
                              <button
                                onClick={() => handleDeletePool(pool._id)}
                                className={`p-2 ${adminTheme.hover} rounded-lg transition-colors text-red-400`}
                                title="Delete Pool"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'positions' && (
          <div>
            {/* Positions Table */}
            <div className={`${adminTheme.surface} ${adminTheme.border} border rounded-lg overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={`${adminTheme.tableHeader}`}>
                    <tr>
                      <th className={`px-6 py-4 text-left font-medium ${adminTheme.textSecondary}`}>User</th>
                      <th className={`px-6 py-4 text-left font-medium ${adminTheme.textSecondary}`}>Pool</th>
                      <th className={`px-6 py-4 text-left font-medium ${adminTheme.textSecondary}`}>Amount</th>
                      <th className={`px-6 py-4 text-left font-medium ${adminTheme.textSecondary}`}>Rewards</th>
                      <th className={`px-6 py-4 text-left font-medium ${adminTheme.textSecondary}`}>Status</th>
                      <th className={`px-6 py-4 text-left font-medium ${adminTheme.textSecondary}`}>Staked Date</th>
                      <th className={`px-6 py-4 text-right font-medium ${adminTheme.textSecondary}`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${adminTheme.border}`}>
                    {stakingPositions.map((position) => (
                      <tr key={position._id} className={`${adminTheme.hover} transition-colors`}>
                        <td className="px-6 py-4">
                          <div>
                            <p className={`font-medium ${adminTheme.textPrimary}`}>{position.userId?.email}</p>
                            <p className={`text-sm ${adminTheme.textMuted}`}>
                              {position.userId?.username || 'N/A'}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className={`font-medium ${adminTheme.textPrimary}`}>{position.poolId?.name}</p>
                            <p className={`text-sm ${adminTheme.textMuted}`}>{position.symbol}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className={`font-medium ${adminTheme.textPrimary}`}>{formatNumber(position.amount)} {position.symbol}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-emerald-400">
                              {formatNumber(position.pendingRewards)}
                            </p>
                            <p className={`text-sm ${adminTheme.textMuted}`}>
                              Claimed: {formatNumber(position.totalRewardsClaimed)}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-sm ${
                            position.status === 'active'
                              ? adminTheme.successBg
                              : position.status === 'unstaked'
                              ? 'bg-gray-500/10 border-gray-500/20 text-gray-400'
                              : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
                          }`}>
                            {position.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className={`font-medium ${adminTheme.textPrimary}`}>{formatDate(position.stakedAt)}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {/* View position details */}}
                              className={`p-2 ${adminTheme.hover} rounded-lg transition-colors`}
                              title="View Details"
                            >
                              <Eye className={`w-4 h-4 ${adminTheme.textSecondary}`} />
                            </button>
                            {position.status === 'active' && (
                              <button
                                onClick={() => {/* Force unstake */}}
                                className={`p-2 ${adminTheme.hover} rounded-lg transition-colors text-red-400`}
                                title="Force Unstake"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Top Pools by TVL */}
            <div className={`${adminTheme.surface} ${adminTheme.border} border rounded-lg p-6`}>
              <h3 className={`text-lg font-bold mb-4 ${adminTheme.textPrimary}`}>Top Pools by TVL</h3>
              <div className="space-y-4">
                {analytics.topPools?.map((pool, index) => (
                  <div key={pool._id} className={`flex items-center justify-between p-4 ${adminTheme.card} rounded-lg`}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-[#FCD535]">#{index + 1}</span>
                      <div>
                        <p className={`font-medium ${adminTheme.textPrimary}`}>{pool.name}</p>
                        <p className={`text-sm ${adminTheme.textMuted}`}>{pool.symbol}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${adminTheme.textPrimary}`}>${formatNumber(pool.currentTotalStaked)}</p>
                      <p className={`text-sm ${adminTheme.textMuted}`}>{pool.apy}% APY</p>
                    </div>
                  </div>
                )) || <p className={adminTheme.textMuted}>No data available</p>}
              </div>
            </div>

            {/* Position Statistics */}
            <div className={`${adminTheme.surface} ${adminTheme.border} border rounded-lg p-6`}>
              <h3 className={`text-lg font-bold mb-4 ${adminTheme.textPrimary}`}>Position Statistics</h3>
              <div className="grid grid-cols-3 gap-4">
                {analytics.positionsByStatus?.map((stat) => (
                  <div key={stat._id} className={`text-center p-4 ${adminTheme.card} rounded-lg`}>
                    <p className={`text-2xl font-bold ${adminTheme.textPrimary}`}>{stat.count}</p>
                    <p className={`text-sm ${adminTheme.textMuted} capitalize`}>{stat._id} Positions</p>
                    <p className={`text-sm ${adminTheme.textMuted}`}>
                      ${formatNumber(stat.totalAmount)}
                    </p>
                  </div>
                )) || <p className={adminTheme.textMuted}>No data available</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Pool Modal */}
      {showCreateModal && (
        <div className={`fixed inset-0 ${adminTheme.modalOverlay} flex items-center justify-center z-50 p-4`}>
          <div className={`${adminTheme.modalContent} rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto`}>
            <h3 className={`text-xl font-bold mb-6 ${adminTheme.textPrimary}`}>Create Staking Pool</h3>
            
            <form onSubmit={handleCreatePool} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${adminTheme.textMuted} mb-2`}>
                    Pool Name *
                  </label>
                  <input
                    type="text"
                    value={poolForm.name}
                    onChange={(e) => setPoolForm(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full p-3 ${adminTheme.input} border rounded-lg focus:outline-none`}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${adminTheme.textMuted} mb-2`}>
                    Symbol *
                  </label>
                  <input
                    type="text"
                    value={poolForm.symbol}
                    onChange={(e) => setPoolForm(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                    className={`w-full p-3 ${adminTheme.input} border rounded-lg focus:outline-none`}
                    required
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${adminTheme.textMuted} mb-2`}>
                  Description
                </label>
                <textarea
                  value={poolForm.description}
                  onChange={(e) => setPoolForm(prev => ({ ...prev, description: e.target.value }))}
                  className={`w-full p-3 ${adminTheme.textarea} border rounded-lg focus:outline-none`}
                  rows="3"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${adminTheme.textMuted} mb-2`}>
                    APY (%) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={poolForm.apy}
                    onChange={(e) => setPoolForm(prev => ({ ...prev, apy: e.target.value }))}
                    className={`w-full p-3 ${adminTheme.input} border rounded-lg focus:outline-none`}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${adminTheme.textMuted} mb-2`}>
                    Min Stake *
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={poolForm.minimumStake}
                    onChange={(e) => setPoolForm(prev => ({ ...prev, minimumStake: e.target.value }))}
                    className={`w-full p-3 ${adminTheme.input} border rounded-lg focus:outline-none`}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${adminTheme.textMuted} mb-2`}>
                    Lock Period (days) *
                  </label>
                  <input
                    type="number"
                    value={poolForm.lockPeriod}
                    onChange={(e) => setPoolForm(prev => ({ ...prev, lockPeriod: e.target.value }))}
                    className={`w-full p-3 ${adminTheme.input} border rounded-lg focus:outline-none`}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${adminTheme.textMuted} mb-2`}>
                    Max Stake (optional)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={poolForm.maximumStake}
                    onChange={(e) => setPoolForm(prev => ({ ...prev, maximumStake: e.target.value }))}
                    className={`w-full p-3 ${adminTheme.input} border rounded-lg focus:outline-none`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${adminTheme.textMuted} mb-2`}>
                    Pool Limit (optional)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={poolForm.totalPoolLimit}
                    onChange={(e) => setPoolForm(prev => ({ ...prev, totalPoolLimit: e.target.value }))}
                    className={`w-full p-3 ${adminTheme.input} border rounded-lg focus:outline-none`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${adminTheme.textMuted} mb-2`}>
                    Reward Token
                  </label>
                  <input
                    type="text"
                    value={poolForm.rewardToken}
                    onChange={(e) => setPoolForm(prev => ({ ...prev, rewardToken: e.target.value.toUpperCase() }))}
                    className={`w-full p-3 ${adminTheme.input} border rounded-lg focus:outline-none`}
                    placeholder="Same as pool symbol"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${adminTheme.textMuted} mb-2`}>
                    Early Unstake Penalty (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={poolForm.earlyUnstakePenalty}
                    onChange={(e) => setPoolForm(prev => ({ ...prev, earlyUnstakePenalty: e.target.value }))}
                    className={`w-full p-3 ${adminTheme.input} border rounded-lg focus:outline-none`}
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={poolForm.isVipOnly}
                    onChange={(e) => setPoolForm(prev => ({ ...prev, isVipOnly: e.target.checked }))}
                    className="rounded border-[#333A47]"
                  />
                  <span className={`text-sm ${adminTheme.textMuted}`}>VIP Only</span>
                </label>
                {poolForm.isVipOnly && (
                  <input
                    type="number"
                    value={poolForm.requiredVipLevel}
                    onChange={(e) => setPoolForm(prev => ({ ...prev, requiredVipLevel: e.target.value }))}
                    placeholder="Required VIP Level"
                    className={`w-32 p-2 ${adminTheme.input} border rounded-lg focus:outline-none`}
                  />
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetPoolForm();
                  }}
                  className={`flex-1 ${adminTheme.buttonSecondary} py-3 rounded-lg font-medium`}
                  disabled={processing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className={`flex-1 ${adminTheme.buttonPrimary} py-3 rounded-lg font-medium disabled:opacity-50`}
                >
                  {processing ? 'Creating...' : 'Create Pool'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Pool Modal */}
      {showEditModal && selectedPool && (
        <div className={`fixed inset-0 ${adminTheme.modalOverlay} flex items-center justify-center z-50 p-4`}>
          <div className={`${adminTheme.modalContent} rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto`}>
            <h3 className={`text-xl font-bold mb-6 ${adminTheme.textPrimary}`}>Edit Staking Pool</h3>
            
            <form onSubmit={handleUpdatePool} className="space-y-4">
              {/* Same form fields as create modal */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${adminTheme.textMuted} mb-2`}>
                    Pool Name *
                  </label>
                  <input
                    type="text"
                    value={poolForm.name}
                    onChange={(e) => setPoolForm(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full p-3 ${adminTheme.input} border rounded-lg focus:outline-none`}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${adminTheme.textMuted} mb-2`}>
                    APY (%) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={poolForm.apy}
                    onChange={(e) => setPoolForm(prev => ({ ...prev, apy: e.target.value }))}
                    className={`w-full p-3 ${adminTheme.input} border rounded-lg focus:outline-none`}
                    required
                  />
                </div>
              </div>

              {/* Add remaining form fields similar to create modal */}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedPool(null);
                    resetPoolForm();
                  }}
                  className={`flex-1 ${adminTheme.buttonSecondary} py-3 rounded-lg font-medium`}
                  disabled={processing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className={`flex-1 ${adminTheme.buttonPrimary} py-3 rounded-lg font-medium disabled:opacity-50`}
                >
                  {processing ? 'Updating...' : 'Update Pool'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStakingManagement;
