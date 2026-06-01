import React, { useState, useEffect } from 'react';
import { adminTheme } from '../../styles/adminTheme';
import { ApiUtils } from '../../services/api';
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  ExternalLink,
  Clock,
  DollarSign,
  Users,
  AlertTriangle
} from 'lucide-react';

const AdminWithdrawals = () => {
  const [pendingWithdrawals, setPendingWithdrawals] = useState([]);
  const [allWithdrawals, setAllWithdrawals] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approving, setApproving] = useState('');
  const [rejecting, setRejecting] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [selectedNetwork, setSelectedNetwork] = useState('all');
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'all'
  
  // New states for transaction hash modal
  const [showTxHashModal, setShowTxHashModal] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [selectedWithdrawalForApproval, setSelectedWithdrawalForApproval] = useState(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch pending withdrawals
      const pendingData = await ApiUtils.get('/admin/withdrawals/pending');
      setPendingWithdrawals(pendingData.withdrawals);

      // Fetch all withdrawals (fixed route)
      const allData = await ApiUtils.get('/admin/withdrawals/all');
      setAllWithdrawals(allData.withdrawals || []);

      // Fetch statistics
      const statsData = await ApiUtils.get('/admin/withdrawals/stats');
      setStats(statsData);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const approveWithdrawal = async (withdrawalId, transactionHash = '') => {
    try {
      setApproving(withdrawalId);
      
      const data = await ApiUtils.post(`/admin/withdrawals/approve/${withdrawalId}`, {
        txHash: transactionHash
      });

      // Remove from pending list
      setPendingWithdrawals(prev => 
        prev.filter(withdrawal => withdrawal._id !== withdrawalId)
      );

      // Show success message
      if (transactionHash && transactionHash.trim()) {
        alert(`✅ Withdrawal completed successfully!\n\nTransaction Hash: ${transactionHash}\n\nThe withdrawal has been marked as completed and the user has been notified.`);
      } else {
        alert('✅ Withdrawal approved successfully!\n\nProcessing has been initiated. The system will simulate the blockchain transaction and notify the user when completed.');
      }
      
      // Refresh data
      fetchData();

    } catch (err) {
      alert('Failed to approve withdrawal: ' + err.message);
    } finally {
      setApproving('');
      setShowTxHashModal(false);
      setTxHash('');
      setSelectedWithdrawalForApproval(null);
    }
  };

  const openApprovalModal = (withdrawal) => {
    setSelectedWithdrawalForApproval(withdrawal);
    setShowTxHashModal(true);
  };

  const handleApprovalSubmit = () => {
    if (selectedWithdrawalForApproval) {
      approveWithdrawal(selectedWithdrawalForApproval._id, txHash.trim());
    }
  };

  const rejectWithdrawal = async (withdrawalId, reason) => {
    try {
      setRejecting(withdrawalId);
      
      const data = await ApiUtils.post(`/admin/withdrawals/reject/${withdrawalId}`, {
        reason
      });

      // Remove from pending list
      setPendingWithdrawals(prev => 
        prev.filter(withdrawal => withdrawal._id !== withdrawalId)
      );

      // Show success message
      alert(`Withdrawal rejected. ${data.refundedAmount} USDT refunded to user balance.`);
      
      // Close modal and refresh data
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedWithdrawal(null);
      fetchData();

    } catch (err) {
      alert('Failed to reject withdrawal: ' + err.message);
    } finally {
      setRejecting('');
    }
  };

  const openRejectModal = (withdrawal) => {
    setSelectedWithdrawal(withdrawal);
    setShowRejectModal(true);
  };

  const handleRejectSubmit = () => {
    if (selectedWithdrawal && rejectReason.trim()) {
      rejectWithdrawal(selectedWithdrawal._id, rejectReason);
    }
  };

  const getNetworkInfo = (network) => {
    const bscExplorer = import.meta.env.VITE_BSC_EXPLORER || 'https://bscscan.com';
    
    const info = {
      BEP20: {
        name: 'Binance Smart Chain (BEP20)',
        color: 'bg-yellow-100 text-yellow-800',
        explorer: `${bscExplorer}/address/`
      }
    };
    return info[network] || {};
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const filteredWithdrawals = () => {
    const withdrawals = activeTab === 'pending' ? pendingWithdrawals : allWithdrawals;
    return selectedNetwork === 'all' 
      ? withdrawals 
      : withdrawals.filter(withdrawal => withdrawal.network === selectedNetwork);
  };

  const currentWithdrawals = filteredWithdrawals();

  return (
    <div className={`min-h-screen ${adminTheme.primary}`}>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 ${adminTheme.shadow}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 ${adminTheme.accent} rounded-xl ${adminTheme.shadow}`}>
                <DollarSign className="w-8 h-8 text-[#FCD535]" />
              </div>
              <div>
                <h1 className={`text-3xl font-bold ${adminTheme.textPrimary}`}>Withdrawal Management</h1>
                <p className={`${adminTheme.textSecondary} mt-1`}>Review and process withdrawal requests</p>
                <p className={`${adminTheme.textSecondary} text-sm mt-1`}>
                  • Min: 25 USDT • Fee: 5% of withdrawal amount • Balance deducted: Withdrawal amount only
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchData}
                disabled={loading}
                className={`flex items-center space-x-2 px-4 py-2 ${adminTheme.buttonPrimary} rounded-xl transition-all duration-200 disabled:opacity-50 hover:scale-105`}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className={`${adminTheme.dangerBg} border rounded-xl px-4 py-3`}>
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className={`${adminTheme.card} ${adminTheme.border} rounded-xl p-6 ${adminTheme.shadow}`}>
              <div className="flex items-center">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <Clock className="w-6 h-6 text-yellow-500" />
                </div>
                <div className="ml-4">
                  <p className={`text-sm font-medium ${adminTheme.textSecondary}`}>Total Requests</p>
                  <p className={`text-2xl font-semibold ${adminTheme.textPrimary}`}>{stats.totalRequests}</p>
                </div>
              </div>
            </div>

            {stats.byStatus?.map((status) => (
              <div key={status._id} className={`${adminTheme.card} ${adminTheme.border} rounded-xl p-6 ${adminTheme.shadow}`}>
                <div className="flex items-center">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <DollarSign className="w-6 h-6 text-green-400" />
                  </div>
                  <div className="ml-4">
                    <p className={`text-sm font-medium ${adminTheme.textSecondary} capitalize`}>{status._id}</p>
                    <p className={`text-2xl font-semibold ${adminTheme.textPrimary}`}>{status.count}</p>
                    <p className={`text-sm ${adminTheme.textSecondary}`}>{status.totalAmount.toFixed(2)} USDT</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Network Filter */}
        <div className={`${adminTheme.card} ${adminTheme.border} rounded-xl p-6 ${adminTheme.shadow}`}>
          {/* Tab Navigation */}
          <div className="flex items-center space-x-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'pending'
                  ? 'bg-white dark:bg-gray-700 text-[#FCD535] dark:text-[#FCD535] shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Pending ({pendingWithdrawals.length})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-gray-700 text-[#FCD535] dark:text-[#FCD535] shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              All Withdrawals ({allWithdrawals.length})
            </button>
          </div>

          <div className="flex items-center space-x-4 mb-4">
            <h2 className={`text-lg font-semibold ${adminTheme.textPrimary}`}>
              {activeTab === 'pending' ? 'Pending Withdrawals' : 'All Withdrawals'}
            </h2>
            <select
              value={selectedNetwork}
              onChange={(e) => setSelectedNetwork(e.target.value)}
              className={`px-3 py-2 ${adminTheme.surface} ${adminTheme.border} rounded-md text-sm ${adminTheme.textPrimary}`}
            >
              <option value="all">All Networks</option>
              <option value="BEP20">BEP20</option>
            </select>
          </div>

        {currentWithdrawals.length === 0 ? (
          <div className={`text-center py-8 ${adminTheme.textSecondary}`}>
            <Clock className={`w-12 h-12 mx-auto mb-4 ${adminTheme.textSecondary}`} />
            <p>{activeTab === 'pending' ? 'No pending withdrawals' : 'No withdrawals found'}</p>
            <p className="text-sm">
              {activeTab === 'pending' ? 'User withdrawal requests will appear here for approval' : 'Withdrawal history will appear here'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className={`${adminTheme.border} border-b`}>
                  <th className={`text-left py-3 px-4 font-medium ${adminTheme.textSecondary}`}>Date</th>
                  <th className={`text-left py-3 px-4 font-medium ${adminTheme.textSecondary}`}>User</th>
                  <th className={`text-left py-3 px-4 font-medium ${adminTheme.textSecondary}`}>Network</th>
                  <th className={`text-left py-3 px-4 font-medium ${adminTheme.textSecondary}`}>Amount</th>
                  <th className={`text-left py-3 px-4 font-medium ${adminTheme.textSecondary}`}>Fee (5%)</th>
                  <th className={`text-left py-3 px-4 font-medium ${adminTheme.textSecondary}`}>Net Amount</th>
                  <th className={`text-left py-3 px-4 font-medium ${adminTheme.textSecondary}`}>Destination</th>
                  <th className={`text-left py-3 px-4 font-medium ${adminTheme.textSecondary}`}>Status</th>
                  {activeTab === 'pending' && (
                    <th className={`text-left py-3 px-4 font-medium ${adminTheme.textSecondary}`}>Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {currentWithdrawals.map((withdrawal) => (
                  <tr key={withdrawal._id} className={`${adminTheme.border} border-b ${adminTheme.hover} transition-colors`}>
                    <td className={`py-4 px-4 text-sm ${adminTheme.textPrimary}`}>
                      {new Date(withdrawal.createdAt).toLocaleString()}
                    </td>
                    <td className="py-4 px-4 text-sm">
                      <div>
                        <p className={`font-medium ${adminTheme.textPrimary}`}>{withdrawal.userId?.username}</p>
                        <p className={`${adminTheme.textSecondary}`}>{withdrawal.userId?.email}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-2 py-1 rounded text-xs ${getNetworkInfo(withdrawal.network).color}`}>
                        {withdrawal.network}
                      </span>
                    </td>
                    <td className={`py-4 px-4 text-sm font-medium ${adminTheme.textPrimary}`}>
                      ${withdrawal.amount.toFixed(2)} USDT
                    </td>
                    <td className={`py-4 px-4 text-sm ${adminTheme.textSecondary}`}>
                      ${withdrawal.fee.toFixed(2)} USDT
                    </td>
                    <td className="py-4 px-4 text-sm font-medium text-green-400">
                      ${withdrawal.netAmount.toFixed(2)} USDT
                    </td>
                    <td className="py-4 px-4 text-sm">
                      <div className="max-w-32">
                        <p className={`font-mono text-xs truncate ${adminTheme.textPrimary}`} title={withdrawal.withdrawalAddress}>
                          {formatAddress(withdrawal.withdrawalAddress)}
                        </p>
                        <button
                          onClick={() => navigator.clipboard.writeText(withdrawal.withdrawalAddress)}
                          className="text-blue-500 hover:text-blue-400 text-xs transition-colors"
                        >
                          Copy
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm">
                      <div className="flex flex-col space-y-1">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          withdrawal.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          withdrawal.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                          withdrawal.status === 'processing' ? 'bg-[#FCD535]/20 text-[#FCD535]' :
                          withdrawal.status === 'completed' ? 'bg-green-100 text-green-800' :
                          withdrawal.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {withdrawal.status}
                        </span>
                        {withdrawal.txHash && (
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-gray-500">TX:</span>
                            <button
                              onClick={() => navigator.clipboard.writeText(withdrawal.txHash)}
                              className="font-mono text-xs text-blue-500 hover:text-blue-400 truncate max-w-20"
                              title={withdrawal.txHash}
                            >
                              {withdrawal.txHash.substring(0, 8)}...
                            </button>
                            <ExternalLink className="w-3 h-3 text-gray-400" />
                          </div>
                        )}
                      </div>
                    </td>
                    {activeTab === 'pending' && (
                      <td className="py-4 px-4">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openApprovalModal(withdrawal)}
                            disabled={approving === withdrawal._id}
                            className="flex items-center space-x-1 px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {approving === withdrawal._id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => openRejectModal(withdrawal)}
                            disabled={rejecting === withdrawal._id}
                            className="flex items-center space-x-1 px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {rejecting === withdrawal._id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                            <span>Reject</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Network Statistics */}
      {stats?.byNetwork && (
        <div className={`${adminTheme.card} ${adminTheme.border} rounded-xl p-6 ${adminTheme.shadow}`}>
          <h2 className={`text-lg font-semibold ${adminTheme.textPrimary} mb-4`}>Network Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {stats.byNetwork.map((network) => (
              <div key={network._id} className={`${adminTheme.border} rounded-lg p-4 ${adminTheme.surface}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-1 rounded text-sm ${getNetworkInfo(network._id).color}`}>
                    {network._id}
                  </span>
                  <span className={`text-lg font-semibold ${adminTheme.textPrimary}`}>{network.count} withdrawals</span>
                </div>
                <p className="text-2xl font-bold text-red-400">
                  ${network.totalAmount.toFixed(2)} USDT
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reject Withdrawal Modal */}
      {showRejectModal && (
        <div className={`fixed inset-0 ${adminTheme.modalOverlay} flex items-center justify-center z-50`}>
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 max-w-md w-full mx-4 ${adminTheme.shadow}`}>
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-400 mr-2" />
              <h2 className={`text-lg font-semibold ${adminTheme.textPrimary}`}>Reject Withdrawal</h2>
            </div>
            
            {selectedWithdrawal && (
              <div className={`mb-4 p-3 ${adminTheme.surface} rounded-lg`}>
                <p className={`text-sm ${adminTheme.textSecondary}`}>
                  <strong>User:</strong> {selectedWithdrawal.userId?.username}
                </p>
                <p className={`text-sm ${adminTheme.textSecondary}`}>
                  <strong>Amount:</strong> ${selectedWithdrawal.amount.toFixed(2)} USDT ({selectedWithdrawal.network})
                </p>
                <p className={`text-sm ${adminTheme.textSecondary}`}>
                  <strong>Address:</strong> {formatAddress(selectedWithdrawal.withdrawalAddress)}
                </p>
              </div>
            )}
            
            <p className={`text-sm ${adminTheme.textSecondary} mb-4`}>
              Are you sure you want to reject this withdrawal? The funds will be returned to the user's balance. Please provide a reason.
            </p>
            
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className={`w-full p-3 ${adminTheme.border} rounded-md text-sm mb-4 ${adminTheme.surface} ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
              rows="3"
              placeholder="Reason for rejection (required)"
              required
            />
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setSelectedWithdrawal(null);
                }}
                className={`px-4 py-2 ${adminTheme.buttonSecondary} rounded-md text-sm transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={!rejectReason.trim() || rejecting}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {rejecting && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>Reject Withdrawal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Hash Modal */}
      {showTxHashModal && (
        <div className={`fixed inset-0 ${adminTheme.modalOverlay} flex items-center justify-center z-50`}>
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 max-w-md w-full mx-4 ${adminTheme.shadow}`}>
            <div className="flex items-center mb-4">
              <CheckCircle className="w-6 h-6 text-green-400 mr-2" />
              <h2 className={`text-lg font-semibold ${adminTheme.textPrimary}`}>Approve Withdrawal</h2>
            </div>
            
            {selectedWithdrawalForApproval && (
              <div className={`mb-4 p-3 ${adminTheme.surface} rounded-lg`}>
                <p className={`text-sm ${adminTheme.textSecondary}`}>
                  <strong>User:</strong> {selectedWithdrawalForApproval.userId?.username}
                </p>
                <p className={`text-sm ${adminTheme.textSecondary}`}>
                  <strong>Amount:</strong> ${selectedWithdrawalForApproval.amount.toFixed(2)} USDT ({selectedWithdrawalForApproval.network})
                </p>
                <p className={`text-sm ${adminTheme.textSecondary}`}>
                  <strong>Address:</strong> {formatAddress(selectedWithdrawalForApproval.withdrawalAddress)}
                </p>
                <p className={`text-sm ${adminTheme.textSecondary}`}>
                  <strong>Net Amount:</strong> ${selectedWithdrawalForApproval.netAmount.toFixed(2)} USDT
                </p>
              </div>
            )}
            
            <p className={`text-sm ${adminTheme.textSecondary} mb-4`}>
              Enter the transaction hash if you have already processed this withdrawal on the blockchain. 
              Leave blank if you want to approve without a transaction hash.
            </p>
            
            <div className="mb-4">
              <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                Transaction Hash (Optional)
              </label>
              <input
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                className={`w-full p-3 ${adminTheme.border} rounded-md text-sm ${adminTheme.surface} ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-green-500 font-mono`}
                placeholder="0x... or leave blank for automatic processing"
              />
              <p className={`text-xs ${adminTheme.textSecondary} mt-1`}>
                If provided, withdrawal will be marked as completed immediately
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowTxHashModal(false);
                  setTxHash('');
                  setSelectedWithdrawalForApproval(null);
                }}
                className={`px-4 py-2 ${adminTheme.buttonSecondary} rounded-md text-sm transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={handleApprovalSubmit}
                disabled={approving}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {approving && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{txHash.trim() ? 'Complete Withdrawal' : 'Approve Withdrawal'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default AdminWithdrawals;
