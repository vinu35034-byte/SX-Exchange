import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useSession } from '../../contexts/SessionContext';
import { ApiUtils } from '../../services/api';
import { Button } from "@/components/ui/button";
import { adminTheme } from '../../styles/adminTheme';
import { 
  ShieldCheckIcon,
  UserGroupIcon,
  ChartBarIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowUpTrayIcon,
  BellIcon,
  CurrencyDollarIcon,
  ShareIcon,
  DocumentTextIcon,
  TrophyIcon,
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  ArrowTrendingUpIcon,
  PhotoIcon
} from "@heroicons/react/24/outline";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { admin, logoutAdmin } = useAdminAuth();
  const { sessionStatus, sessionToken } = useSession();
  const [loading, setLoading] = useState(false);
  const [vipStats, setVipStats] = useState(null);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Fetch dashboard statistics on component mount
  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setStatsLoading(true);
        
        try {
          // Try the main stats method first
          const stats = await ApiUtils.get('/admin/dashboard/stats');
          setDashboardStats(stats);
        } catch (error) {
          console.warn('Main stats failed, trying simple counts:', error);
          
          // If main stats fail, try the simple counts method
          const simpleCounts = await ApiUtils.get('/admin/dashboard/simple-counts');
          
          // Merge with any basic data we can get
          const fallbackStats = {
            totalUsers: 0,
            activeUsers: 0,
            tradingVolume: 0,
            todayTrades: 0,
            successfulTrades: 0,
            pendingKyc: 0,
            ...simpleCounts
          };
          
          setDashboardStats(fallbackStats);
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        // Set empty stats as final fallback
        setDashboardStats({
          totalUsers: 0,
          activeUsers: 0,
          totalDeposits: 0,
          depositVolume: 0,
          totalWithdrawals: 0,
          withdrawalVolume: 0,
          pendingKyc: 0,
          tradingVolume: 0,
          todayTrades: 0,
          successfulTrades: 0
        });
      } finally {
        setStatsLoading(false);
      }
    };

    fetchDashboardStats();
  }, []);

  // Fetch VIP statistics on component mount - DISABLED until endpoint is implemented
  // useEffect(() => {
  //   const fetchVIPStats = async () => {
  //     try {
  //       const stats = await ApiUtils.get('/admin/rewards/statistics');
  //       setVipStats(stats);
  //     } catch (error) {
  //       // VIP stats endpoint may not be implemented yet - fail silently
  //       if (error.message && error.message.includes('404')) {
  //         console.info('VIP statistics endpoint not available - skipping VIP stats');
  //       } else {
  //         console.error('Error fetching VIP stats:', error);
  //       }
  //       setVipStats(null);
  //     }
  //   };
  //   
  //   fetchVIPStats();
  // }, []);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logoutAdmin();
      navigate('/u/login'); // Redirect back to admin login
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshDashboardData = async () => {
    try {
      setStatsLoading(true);
      
      // Fetch dashboard stats (required)
      const dashboardStatsData = await ApiUtils.get('/admin/dashboard/stats');
      setDashboardStats(dashboardStatsData);
      
      // VIP stats temporarily disabled until endpoint is implemented
      // try {
      //   const vipStatsData = await ApiUtils.get('/admin/rewards/statistics');
      //   setVipStats(vipStatsData);
      // } catch (vipError) {
      //   // VIP stats endpoint may not be implemented yet - fail silently
      //   if (vipError.message && vipError.message.includes('404')) {
      //     console.info('VIP statistics endpoint not available during refresh');
      //   } else {
      //     console.error('Error fetching VIP stats during refresh:', vipError);
      //   }
      //   setVipStats(null);
      // }
    } catch (error) {
      console.error('Error refreshing dashboard data:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const getDashboardStatsDisplay = () => {
    // Show loading state
    if (statsLoading) {
      return [
        { title: 'Total Users', value: '...', change: '', icon: UserGroupIcon, color: 'blue' },
        { title: 'Trading Volume', value: '...', change: '', icon: BanknotesIcon, color: 'green' },
        { title: 'Total Deposits', value: '...', change: '', icon: ChartBarIcon, color: 'purple' },
        { title: 'Total Withdrawals', value: '...', change: '', icon: ChartBarIcon, color: 'purple' },
        { title: 'Pending KYC', value: '...', change: '', icon: ExclamationTriangleIcon, color: 'orange' }
      ];
    }

    // Use real data if available, otherwise show default values
    const stats = dashboardStats || {};
    
    // Calculate correct deposit and withdrawal counts from status breakdowns
    const completedDeposits = stats.depositsByStatus?.approved || stats.totalDeposits || 0;
    const pendingDeposits = stats.depositsByStatus?.pending || stats.pendingDeposits || 0;
    const completedWithdrawals = stats.withdrawalsByStatus?.completed || stats.totalWithdrawals || 0;
    const pendingWithdrawals = stats.withdrawalsByStatus?.pending || stats.pendingWithdrawals || 0;

    const baseStats = [
      { 
        title: 'Total Users', 
        value: stats.totalUsers?.toLocaleString() || '0', 
        change: stats.activeUsers ? `${stats.activeUsers} active` : '+0%', 
        icon: UserGroupIcon, 
        color: 'blue' 
      },
      { 
        title: 'Trading Volume', 
        value: stats.tradingVolume ? `$${(stats.tradingVolume / 1000).toFixed(1)}K` : '$0', 
        change: stats.todayTrades ? `${stats.todayTrades} trades today` : '+0 trades', 
        icon: BanknotesIcon, 
        color: 'green' 
      },
      { 
        title: 'Completed Deposits', 
        value: completedDeposits.toString(), 
        change: pendingDeposits ? `${pendingDeposits} pending` : 'No pending', 
        icon: ChartBarIcon, 
        color: 'purple' 
      },
      { 
        title: 'Completed Withdrawals', 
        value: completedWithdrawals.toString(), 
        change: pendingWithdrawals ? `${pendingWithdrawals} pending` : 'No pending', 
        icon: ChartBarIcon, 
        color: 'purple' 
      },
      { 
        title: 'Pending KYC', 
        value: stats.pendingKyc?.toString() || '0', 
        change: 'Review needed', 
        icon: ExclamationTriangleIcon, 
        color: 'orange' 
      }
    ];

    // Add VIP stats if available
    if (vipStats) {
      const vipUserCount = vipStats.userStats.vipUsersByLevel.reduce((total, level) => {
        return total + (level._id > 0 ? level.count : 0);
      }, 0);
      
      baseStats.push({
        title: 'VIP Users',
        value: vipUserCount.toString(),
        change: '+VIP',
        icon: TrophyIcon,
        color: 'gold'
      });
    }

    return baseStats;
  };

  const displayStats = getDashboardStatsDisplay();  const quickActions = [
    { title: 'Banner Manager', description: 'Upload and manage home page banner slides', icon: PhotoIcon, onClick: () => navigate('/u/banners'), priority: true },
    { title: 'Cache Management', description: 'Monitor and manage system cache performance', icon: CogIcon, onClick: () => navigate('/u/cache'), priority: true },
    { title: 'Fund Management', description: 'Sweep user funds to master wallet', icon: BanknotesIcon, onClick: () => navigate('/u/fund-management'), priority: true },
    { title: 'Telegram Support', description: 'Manage help center topics and Telegram support contacts', icon: ChatBubbleLeftRightIcon, onClick: () => navigate('/u/telegram-support'), priority: true },
    { title: 'Copy Trading', description: 'Manage traders and distribute passive income', icon: ArrowTrendingUpIcon, onClick: () => navigate('/u/copy-trading') },
    { title: 'Token Management', description: 'Add, edit, and control cryptocurrency tokens', icon: CurrencyDollarIcon, onClick: () => navigate('/u/tokens') },
    { title: 'Special Tokens', description: 'Create simulated tokens with live price movements', icon: SparklesIcon, onClick: () => navigate('/u/special-tokens') },
    { title: 'Trading Controls', description: 'Configure buy/sell permissions and fees for all tokens', icon: CogIcon, onClick: () => navigate('/u/trading-controls') },
    { title: 'KYC Management', description: 'Review and approve user KYC submissions', icon: ShieldCheckIcon, onClick: () => navigate('/u/kyc') },
    { title: 'VIP Management', description: 'Manage VIP levels, rewards, and upgrade requirements', icon: TrophyIcon, onClick: () => navigate('/u/vip') },
    { title: 'Referral Manager', description: 'Set custom referral codes and manage referrals', icon: ShareIcon, onClick: () => navigate('/u/referrals') },
    { title: 'Notification Manager', description: 'Send notifications to users and manage notification history', icon: BellIcon, onClick: () => navigate('/u/notifications') },
    { title: 'Deposit Management', description: 'Approve/reject user deposits', icon: BanknotesIcon, onClick: () => navigate('/u/deposits') },
    { title: 'Transaction History', description: 'View all deposits & withdrawals with export', icon: DocumentTextIcon, onClick: () => navigate('/u/transactions') },
    { title: 'All Transactions', description: 'Unified view of all system transactions', icon: CurrencyDollarIcon, onClick: () => navigate('/u/all-transactions') },
    { title: 'Withdrawal Management', description: 'Approve/reject user withdrawals', icon: ArrowUpTrayIcon, onClick: () => navigate('/u/withdrawals') },
    { title: 'Manage Users', description: 'View and manage user accounts', icon: UserGroupIcon, onClick: () => navigate('/u/users') },
    { title: 'Staking Management', description: 'Monitor and control staking rewards and pools', icon: ChartBarIcon, onClick: () => navigate('/u/staking') },
  ];

  const recentActivity = [
    { type: 'user', message: 'New user registration: john@example.com', time: '2 minutes ago', status: 'success' },
    { type: 'trade', message: 'Large trade executed: $50,000 BTC/USD', time: '5 minutes ago', status: 'info' },
    { type: 'alert', message: 'High volume trading detected', time: '10 minutes ago', status: 'warning' },
    { type: 'system', message: 'System backup completed successfully', time: '15 minutes ago', status: 'success' },
  ];

  if (!admin) {
    return (
      <div className={`min-h-screen ${adminTheme.primary} flex items-center justify-center`}>
        <div className={`${adminTheme.textPrimary} text-center`}>
          <ExclamationTriangleIcon className="w-16 h-16 mx-auto mb-4 text-amber-400" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className={`${adminTheme.textSecondary} mb-4`}>You must be logged in as an admin to access this page.</p>
          <Button onClick={() => navigate('/u/login')} className={adminTheme.buttonPrimary}>
            Go to Admin Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${adminTheme.primary} ${adminTheme.textPrimary}`}>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className={`text-3xl font-bold ${adminTheme.textPrimary}`}>
              Admin Dashboard
            </h1>
            <p className={`${adminTheme.textSecondary} mt-1`}>
              Welcome back, {admin.username}!
              {admin.isSuperAdmin && <span className="ml-2 px-2 py-1 bg-[#FCD535]/20 text-[#FCD535] text-xs rounded-full">Super Admin</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={refreshDashboardData}
              className={`${adminTheme.buttonPrimary} text-sm`}
              disabled={statsLoading}
            >
              {statsLoading ? 'Refreshing...' : 'Refresh Data'}
            </Button>
            <Button 
              onClick={handleLogout}
              className={adminTheme.buttonSecondary}
              disabled={loading}
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4 mr-2" />
              {loading ? 'Logging out...' : 'Logout'}
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {displayStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className={`${adminTheme.card} ${adminTheme.border} rounded-xl p-6 ${adminTheme.hover} transition-colors ${adminTheme.shadow}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-[#FCD535]/10 rounded-lg">
                    <Icon className="w-6 h-6 text-[#FCD535]" />
                  </div>
                  <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                    stat.change.startsWith('+') ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
                  }`}>
                    {stat.change}
                  </span>
                </div>
                <h3 className={`text-2xl font-bold ${adminTheme.textPrimary} mb-1`}>{stat.value}</h3>
                <p className={`${adminTheme.textSecondary} text-sm`}>{stat.title}</p>
              </div>
            );
          })}
        </div>

        {/* Detailed Financial Summary */}
        {dashboardStats && (
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 mb-8 ${adminTheme.shadow}`}>
            <h2 className={`text-xl font-bold ${adminTheme.textPrimary} mb-6`}>Financial Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Deposit Summary */}
              <div className={`${adminTheme.surface} rounded-xl p-4`}>
                <h3 className={`font-semibold ${adminTheme.textPrimary} mb-3 flex items-center`}>
                  <BanknotesIcon className="w-5 h-5 mr-2 text-green-400" />
                  Deposits
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className={`${adminTheme.textSecondary} text-sm`}>Completed:</span>
                    <span className={`${adminTheme.textPrimary} font-medium`}>{dashboardStats.depositsByStatus?.approved || dashboardStats.totalDeposits || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${adminTheme.textSecondary} text-sm`}>Pending:</span>
                    <span className="text-amber-400 font-medium">{dashboardStats.depositsByStatus?.pending || dashboardStats.pendingDeposits || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${adminTheme.textSecondary} text-sm`}>Volume:</span>
                    <span className={`${adminTheme.textPrimary} font-medium`}>${(dashboardStats.depositVolume || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Withdrawal Summary */}
              <div className={`${adminTheme.surface} rounded-xl p-4`}>
                <h3 className={`font-semibold ${adminTheme.textPrimary} mb-3 flex items-center`}>
                  <ArrowUpTrayIcon className="w-5 h-5 mr-2 text-red-400" />
                  Withdrawals
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className={`${adminTheme.textSecondary} text-sm`}>Completed:</span>
                    <span className={`${adminTheme.textPrimary} font-medium`}>{dashboardStats.withdrawalsByStatus?.completed || dashboardStats.totalWithdrawals || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${adminTheme.textSecondary} text-sm`}>Pending:</span>
                    <span className="text-amber-400 font-medium">{dashboardStats.withdrawalsByStatus?.pending || dashboardStats.pendingWithdrawals || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${adminTheme.textSecondary} text-sm`}>Volume:</span>
                    <span className={`${adminTheme.textPrimary} font-medium`}>${(dashboardStats.withdrawalVolume || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Trading Summary */}
              <div className={`${adminTheme.surface} rounded-xl p-4`}>
                <h3 className={`font-semibold ${adminTheme.textPrimary} mb-3 flex items-center`}>
                  <ChartBarIcon className="w-5 h-5 mr-2 text-blue-500" />
                  Trading
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className={`${adminTheme.textSecondary} text-sm`}>Today's Trades:</span>
                    <span className={`${adminTheme.textPrimary} font-medium`}>{dashboardStats.todayTrades || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${adminTheme.textSecondary} text-sm`}>Successful:</span>
                    <span className="text-emerald-400 font-medium">{dashboardStats.successfulTrades || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${adminTheme.textSecondary} text-sm`}>Est. Volume:</span>
                    <span className={`${adminTheme.textPrimary} font-medium`}>${(dashboardStats.tradingVolume || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* User Summary */}
              <div className={`${adminTheme.surface} rounded-xl p-4`}>
                <h3 className={`font-semibold ${adminTheme.textPrimary} mb-3 flex items-center`}>
                  <UserGroupIcon className="w-5 h-5 mr-2 text-[#FCD535]" />
                  Users
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className={`${adminTheme.textSecondary} text-sm`}>Total:</span>
                    <span className={`${adminTheme.textPrimary} font-medium`}>{dashboardStats.totalUsers || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${adminTheme.textSecondary} text-sm`}>Active (24h):</span>
                    <span className="text-emerald-400 font-medium">{dashboardStats.activeUsers || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${adminTheme.textSecondary} text-sm`}>Pending KYC:</span>
                    <span className="text-amber-400 font-medium">{dashboardStats.pendingKyc || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 ${adminTheme.shadow}`}>
          <h2 className={`text-xl font-bold ${adminTheme.textPrimary} mb-6`}>Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={`w-full ${adminTheme.surface} ${adminTheme.hover} ${adminTheme.border} rounded-xl p-4 text-left transition-all duration-300 group hover:scale-105 ${adminTheme.shadow}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-linear-to-r from-[#FCD535]/20 to-green-500/20 rounded-lg group-hover:from-[#FCD535]/30 group-hover:to-green-500/30 transition-all">
                      <Icon className="w-5 h-5 text-[#FCD535]" />
                    </div>
                  </div>
                  <h3 className={`font-semibold ${adminTheme.textPrimary} mb-1`}>{action.title}</h3>
                  <p className={`${adminTheme.textSecondary} text-sm`}>{action.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
