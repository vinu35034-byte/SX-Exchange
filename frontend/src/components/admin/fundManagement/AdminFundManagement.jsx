import React, { useState, useEffect } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { Button } from "@/components/ui/button";
import { 
  Wallet,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Eye,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Users,
  TrendingUp,
  Send,
  Activity,
  Shield,
  Zap
} from "lucide-react";
import { ApiUtils } from '../../../services/api';
import { showToast } from '../../../utils/toast';
import DepositMonitoring from './DepositMonitoring';
import FundSweeping from './FundSweeping';
import AddressBalances from './AddressBalances';

const AdminFundManagement = () => {
  const { isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState({
    masterWallet: null,
    monitoringStatus: null,
    sweepPreview: null
  });

  // Tab configuration
  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'monitoring', label: 'Deposit Monitoring', icon: Eye },
    { id: 'sweeping', label: 'Fund Sweeping', icon: ArrowUp },
    { id: 'balances', label: 'Address Balances', icon: Wallet }
  ];

  useEffect(() => {
    loadOverviewData();
  }, []);

  const loadOverviewData = async () => {
    try {
      setLoading(true);
      
      // Load master wallet info, monitoring status, and sweep preview
      const [masterWalletRes, monitoringRes, sweepPreviewRes] = await Promise.all([
        ApiUtils.get('/admin/fund-management/master-wallet'),
        ApiUtils.get('/admin/deposit-monitoring/status'),
        ApiUtils.get('/admin/fund-management/preview?minAmount=1')
      ]);

      setOverview({
        masterWallet: masterWalletRes,
        monitoringStatus: monitoringRes,
        sweepPreview: sweepPreviewRes.preview
      });
    } catch (error) {
      console.error('Error loading overview:', error);
      showToast.error('Failed to load fund management overview');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadOverviewData();
    showToast.success('Data refreshed');
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} p-6`}>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-3 text-lg">Loading fund management...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} p-6`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Fund Management
            </h1>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Monitor deposits and manage fund collection to master wallet
            </p>
          </div>
          <Button 
            onClick={handleRefresh}
            className="flex items-center gap-2"
            variant="outline"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-[#FCD535] text-[#FCD535] dark:text-[#FCD535]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab 
          overview={overview} 
          onRefresh={loadOverviewData}
          isDarkMode={isDarkMode}
        />
      )}
      {activeTab === 'monitoring' && <DepositMonitoring />}
      {activeTab === 'sweeping' && <FundSweeping />}
      {activeTab === 'balances' && <AddressBalances />}
    </div>
  );
};

// Overview Tab Component
const OverviewTab = ({ overview, onRefresh, isDarkMode }) => {
  const { masterWallet, monitoringStatus, sweepPreview } = overview;

  const stats = [
    {
      label: 'Master Wallet USDT',
      value: masterWallet?.balances?.USDT ? `$${masterWallet.balances.USDT.toFixed(2)}` : '$0.00',
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
    {
      label: 'Sweepable Amount',
      value: sweepPreview ? `$${sweepPreview.totalSweepable.toFixed(2)}` : '$0.00',
      icon: ArrowUp,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      label: 'Addresses with Funds',
      value: sweepPreview?.sweepableAddresses || 0,
      icon: Users,
      color: 'text-[#FCD535]',
      bgColor: 'bg-[#FCD535]/10'
    },
    {
      label: 'Monitoring Status',
      value: monitoringStatus?.isRunning ? 'Active' : 'Stopped',
      icon: Activity,
      color: monitoringStatus?.isRunning ? 'text-green-500' : 'text-red-500',
      bgColor: monitoringStatus?.isRunning ? 'bg-green-500/10' : 'bg-red-500/10'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className={`p-6 rounded-xl border ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {stat.label}
                  </p>
                  <p className={`text-2xl font-bold mt-1 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Master Wallet Info */}
      {masterWallet && (
        <div className={`p-6 rounded-xl border ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-blue-500" />
            <h3 className={`text-lg font-semibold ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Master Wallet
            </h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Address:
              </span>
              <code className={`text-sm font-mono px-2 py-1 rounded ${
                isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
              }`}>
                {masterWallet.address}
              </code>
            </div>
            
            <div className="flex items-center justify-between">
              <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                USDT Balance:
              </span>
              <span className={`text-sm font-semibold ${
                isDarkMode ? 'text-green-400' : 'text-green-600'
              }`}>
                ${masterWallet.balances.USDT.toFixed(6)} USDT
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                BNB Balance:
              </span>
              <span className={`text-sm font-semibold ${
                isDarkMode ? 'text-yellow-400' : 'text-yellow-600'
              }`}>
                {masterWallet.balances.BNB.toFixed(6)} BNB
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Sweep Preview */}
      {sweepPreview && (
        <div className={`p-6 rounded-xl border ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <h3 className={`text-lg font-semibold ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Sweep Preview
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {sweepPreview.totalAddresses}
              </p>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Total Addresses
              </p>
            </div>
            
            <div className="text-center">
              <p className={`text-2xl font-bold text-green-500`}>
                {sweepPreview.sweepableAddresses}
              </p>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                With Funds
              </p>
            </div>
            
            <div className="text-center">
              <p className={`text-2xl font-bold text-blue-500`}>
                ${sweepPreview.totalSweepable.toFixed(2)}
              </p>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Sweepable Amount
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className={`p-6 rounded-xl border ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <h3 className={`text-lg font-semibold mb-4 ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}>
          Quick Actions
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button 
            onClick={() => window.location.hash = '#monitoring'}
            className="flex items-center gap-2"
            variant="outline"
          >
            <Eye className="w-4 h-4" />
            Monitoring
          </Button>
          
          <Button 
            onClick={() => window.location.hash = '#sweeping'}
            className="flex items-center gap-2"
            variant="outline"
          >
            <ArrowUp className="w-4 h-4" />
            Sweep Funds
          </Button>
          
          <Button 
            onClick={() => window.location.hash = '#balances'}
            className="flex items-center gap-2"
            variant="outline"
          >
            <Wallet className="w-4 h-4" />
            View Balances
          </Button>
          
          <Button 
            onClick={onRefresh}
            className="flex items-center gap-2"
            variant="outline"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Data
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminFundManagement;
