import React, { useState, useEffect } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { Button } from "@/components/ui/button";
import { 
  Eye,
  Play,
  Pause,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  User,
  Calendar,
  Hash,
  AlertTriangle,
  Filter,
  Search
} from "lucide-react";
import { ApiUtils } from '../../../services/api';
import { showToast } from '../../../utils/toast';

const DepositMonitoring = () => {
  const { isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [monitoringStatus, setMonitoringStatus] = useState(null);
  const [pendingDeposits, setPendingDeposits] = useState([]);
  const [recentDeposits, setRecentDeposits] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadMonitoringData();
    // Poll for updates every 30 seconds
    const interval = setInterval(loadMonitoringData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadMonitoringData = async () => {
    try {
      setLoading(true);
      
      const [statusRes, pendingRes, recentRes] = await Promise.all([
        ApiUtils.get('/admin/deposit-monitoring/status'),
        ApiUtils.get('/admin/deposit-monitoring/pending'),
        ApiUtils.get('/admin/deposit-monitoring/recent?limit=20')
      ]);

      setMonitoringStatus(statusRes);
      setPendingDeposits(pendingRes.deposits || []);
      setRecentDeposits(recentRes.deposits || []);
    } catch (error) {
      console.error('Error loading monitoring data:', error);
      showToast.error('Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  };

  const handleStartStopMonitoring = async () => {
    try {
      const endpoint = monitoringStatus?.isRunning 
        ? '/admin/deposit-monitoring/stop'
        : '/admin/deposit-monitoring/start';
      
      const result = await ApiUtils.post(endpoint);
      setMonitoringStatus(result);
      
      showToast.success(
        monitoringStatus?.isRunning 
          ? 'Deposit monitoring stopped'
          : 'Deposit monitoring started'
      );
    } catch (error) {
      console.error('Error toggling monitoring:', error);
      showToast.error('Failed to toggle monitoring');
    }
  };

  const handleApproveDeposit = async (depositId) => {
    try {
      await ApiUtils.post(`/admin/deposit-monitoring/approve/${depositId}`);
      showToast.success('Deposit approved successfully');
      loadMonitoringData(); // Refresh data
    } catch (error) {
      console.error('Error approving deposit:', error);
      showToast.error('Failed to approve deposit');
    }
  };

  const handleRejectDeposit = async (depositId) => {
    try {
      await ApiUtils.post(`/admin/deposit-monitoring/reject/${depositId}`);
      showToast.success('Deposit rejected');
      loadMonitoringData(); // Refresh data
    } catch (error) {
      console.error('Error rejecting deposit:', error);
      showToast.error('Failed to reject deposit');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'text-yellow-500 bg-yellow-500/10';
      case 'approved': return 'text-green-500 bg-green-500/10';
      case 'rejected': return 'text-red-500 bg-red-500/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return Clock;
      case 'approved': return CheckCircle;
      case 'rejected': return XCircle;
      default: return AlertTriangle;
    }
  };

  const filteredDeposits = recentDeposits.filter(deposit => {
    const matchesFilter = filter === 'all' || deposit.status === filter;
    const matchesSearch = !searchTerm || 
      deposit.user?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deposit.txHash?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deposit.depositAddress?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-lg">Loading monitoring data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Monitoring Status */}
      <div className={`p-6 rounded-xl border ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              monitoringStatus?.isRunning ? 'bg-green-500/10' : 'bg-red-500/10'
            }`}>
              <Eye className={`w-5 h-5 ${
                monitoringStatus?.isRunning ? 'text-green-500' : 'text-red-500'
              }`} />
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Deposit Monitoring
              </h3>
              <p className={`text-sm ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Status: {monitoringStatus?.isRunning ? 'Active' : 'Stopped'}
              </p>
            </div>
          </div>
          
          <Button 
            onClick={handleStartStopMonitoring}
            className={`flex items-center gap-2 ${
              monitoringStatus?.isRunning 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-green-500 hover:bg-green-600'
            }`}
          >
            {monitoringStatus?.isRunning ? (
              <>
                <Pause className="w-4 h-4" />
                Stop Monitoring
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Monitoring
              </>
            )}
          </Button>
        </div>

        {monitoringStatus && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {monitoringStatus.lastRun ? new Date(monitoringStatus.lastRun).toLocaleTimeString() : 'Never'}
              </p>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Last Run
              </p>
            </div>
            
            <div className="text-center">
              <p className={`text-2xl font-bold text-yellow-500`}>
                {pendingDeposits.length}
              </p>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Pending Approvals
              </p>
            </div>
            
            <div className="text-center">
              <p className={`text-2xl font-bold text-green-500`}>
                {recentDeposits.filter(d => d.status === 'approved').length}
              </p>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Approved Today
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Pending Deposits */}
      {pendingDeposits.length > 0 && (
        <div className={`p-6 rounded-xl border ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <h3 className={`text-lg font-semibold ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Pending Approvals ({pendingDeposits.length})
            </h3>
          </div>

          <div className="space-y-4">
            {pendingDeposits.map((deposit) => (
              <div
                key={deposit._id}
                className={`p-4 rounded-lg border ${
                  isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-500" />
                        <span className={`font-medium ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {deposit.user?.username || 'Unknown User'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-500" />
                        <span className={`font-semibold text-green-500`}>
                          ${deposit.amount} USDT
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <Hash className="w-3 h-3" />
                        <code className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          {deposit.txHash}
                        </code>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {new Date(deposit.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleApproveDeposit(deposit._id)}
                      size="sm"
                      className="bg-green-500 hover:bg-green-600 text-white"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleRejectDeposit(deposit._id)}
                      size="sm"
                      variant="outline"
                      className="text-red-500 border-red-500 hover:bg-red-500 hover:text-white"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className={`p-4 rounded-xl border ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className={`px-3 py-2 rounded-lg border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="all">All Deposits</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2 flex-1">
            <Search className="w-4 h-4" />
            <input
              type="text"
              placeholder="Search by user, transaction hash, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`flex-1 px-3 py-2 rounded-lg border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
          </div>
          
          <Button onClick={loadMonitoringData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Recent Deposits */}
      <div className={`p-6 rounded-xl border ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <h3 className={`text-lg font-semibold mb-4 ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}>
          Recent Deposits ({filteredDeposits.length})
        </h3>

        {filteredDeposits.length === 0 ? (
          <div className="text-center py-8">
            <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              No deposits found matching your criteria
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDeposits.map((deposit) => {
              const StatusIcon = getStatusIcon(deposit.status);
              const statusColor = getStatusColor(deposit.status);
              
              return (
                <div
                  key={deposit._id}
                  className={`p-4 rounded-lg border ${
                    isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${statusColor}`}>
                        <StatusIcon className="w-4 h-4" />
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-4 mb-1">
                          <span className={`font-medium ${
                            isDarkMode ? 'text-white' : 'text-gray-900'
                          }`}>
                            {deposit.user?.username || 'Unknown User'}
                          </span>
                          <span className="font-semibold text-green-500">
                            ${deposit.amount} USDT
                          </span>
                        </div>
                        
                        <div className="text-xs space-y-1">
                          <code className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            {deposit.txHash}
                          </code>
                          <div className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {new Date(deposit.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                      {deposit.status.charAt(0).toUpperCase() + deposit.status.slice(1)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DepositMonitoring;
