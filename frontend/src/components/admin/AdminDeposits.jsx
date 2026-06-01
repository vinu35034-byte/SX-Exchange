import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  ExternalLink, 
  Play, 
  Pause,
  BarChart3,
  Clock,
  DollarSign,
  Users,
  Plus,
  TestTube,
  Search,
  Eye,
  Shield,
  Activity,
  TrendingUp,
  Database,
  AlertTriangle
} from 'lucide-react';
import { ApiUtils } from '../../services/api';
import { adminTheme, adminNetworkColors, adminStatusColors } from '../../styles/adminTheme';
import { showToast } from '../../utils/toast';

const AdminDeposits = () => {
  const [pendingDeposits, setPendingDeposits] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [crediting, setCrediting] = useState('');
  const [rejecting, setRejecting] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [monitoringStatus, setMonitoringStatus] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState('all');
  
  // Test deposit creation states
  const [showTestDepositModal, setShowTestDepositModal] = useState(false);
  const [testDepositForm, setTestDepositForm] = useState({
    userId: '',
    amount: '25'
  });
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [creatingTestDeposit, setCreatingTestDeposit] = useState(false);

  // Manual verification states
  const [showManualDepositModal, setShowManualDepositModal] = useState(false);
  const [manualDepositForm, setManualDepositForm] = useState({
    userId: '',
    txHash: '',
    amount: '',
    network: 'BEP20',
    notes: ''
  });
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [creatingManualDeposit, setCreatingManualDeposit] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch pending deposit requests (user submitted)
      const pendingData = await ApiUtils.get('/admin/deposits/requests');
      setPendingDeposits(pendingData.deposits);

      // Fetch statistics
      const statsData = await ApiUtils.get('/admin/deposits/stats');
      setStats(statsData);

    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const creditDeposit = async (transactionId) => {
    try {
      setCrediting(transactionId);
      
      // Find the deposit to get the amount
      const deposit = pendingDeposits.find(d => d._id === transactionId);
      if (!deposit) {
        throw new Error('Deposit not found');
      }
      
      const data = await ApiUtils.post(`/admin/deposits/approve/${transactionId}`, {
        confirmedAmount: deposit.amount,
        blockConfirmations: 12
      });

      // Remove from pending list
      setPendingDeposits(prev => 
        prev.filter(deposit => deposit._id !== transactionId)
      );

      // Show success message
      showToast.success('Deposit approved successfully! 🎉');
      
      // Refresh data
      fetchData();

    } catch (err) {
      console.error('Error approving deposit:', err);
      showToast.error('Failed to approve deposit: ' + err.message);
    } finally {
      setCrediting('');
    }
  };

  const rejectDeposit = async (transactionId, reason) => {
    try {
      setRejecting(transactionId);
      
      await ApiUtils.post(`/admin/deposits/reject-request/${transactionId}`, {
        rejectionReason: reason
      });

      // Remove from pending list
      setPendingDeposits(prev => 
        prev.filter(deposit => deposit._id !== transactionId)
      );

      // Show success message
      showToast.success('Deposit rejected successfully ✓');
      
      // Close modal and refresh data
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedTransaction(null);
      fetchData();

    } catch (err) {
      console.error('Error rejecting deposit:', err);
      showToast.error('Failed to reject deposit: ' + err.message);
    } finally {
      setRejecting('');
    }
  };

  const openRejectModal = (transaction) => {
    setSelectedTransaction(transaction);
    setShowRejectModal(true);
  };

  const handleRejectSubmit = () => {
    if (selectedTransaction && rejectReason.trim()) {
      rejectDeposit(selectedTransaction._id, rejectReason);
    }
  };

  const toggleMonitoring = async (action) => {
    try {
      await ApiUtils.post('/admin/deposits/monitoring', { action });
      setMonitoringStatus(action === 'start');
      showToast.success(`Monitoring ${action === 'start' ? 'started' : 'stopped'} successfully ✓`);
    } catch (err) {
      showToast.error('Failed to toggle monitoring: ' + err.message);
    }
  };

  const getNetworkInfo = (network) => {
    const bscExplorer = import.meta.env.VITE_BSC_EXPLORER || 'https://bscscan.com';
    
    const info = {
      BEP20: {
        name: 'Binance Smart Chain (BEP20)',
        color: adminNetworkColors.BEP20,
        explorer: `${bscExplorer}/tx/`
      },
      BSC: {
        name: 'Binance Smart Chain (BSC)',
        color: adminNetworkColors.BSC,
        explorer: `${bscExplorer}/tx/`
      }
    };
    return info[network] || { name: network, color: 'bg-[#333A47]/10 border-[#333A47]/20 text-[#EAECEF]/60', explorer: '#' };
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const filteredDeposits = selectedNetwork === 'all' 
    ? pendingDeposits 
    : pendingDeposits.filter(deposit => deposit.network === selectedNetwork);

  const handleTestDepositChange = (e) => {
    const { name, value } = e.target;
    setTestDepositForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const searchDebounceRef = React.useRef(null);

  const searchUsers = async (query) => {
    setUserSearch(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    // Debounce: cancel previous timer and set a new one
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const data = await ApiUtils.get(`/admin/deposits/search-users?search=${encodeURIComponent(query)}`);
        setSearchResults(data.users || []);
      } catch (err) {
        console.error('Error searching users:', err);
        setSearchResults([]);
      }
    }, 400);
  };

  const createTestDeposit = async () => {
    if (!testDepositForm.userId || !testDepositForm.amount) {
      showToast.error('Please select a user and enter an amount');
      return;
    }

    try {
      setCreatingTestDeposit(true);
      
      await ApiUtils.post('/admin/deposits/create-test-deposit', testDepositForm);

      showToast.success('Test deposit created successfully! 🧪');
      
      // Close modal and refresh data
      setShowTestDepositModal(false);
      setTestDepositForm({ userId: '', amount: '25' });
      setUserSearch('');
      setSearchResults([]);
      fetchData();

    } catch (err) {
      showToast.error('Failed to create test deposit: ' + err.message);
    } finally {
      setCreatingTestDeposit(false);
    }
  };

  const selectUser = (user) => {
    setTestDepositForm(prev => ({
      ...prev,
      userId: user._id
    }));
    setUserSearch(`${user.username} (${user.email})`);
    setSearchResults([]);
  };

  // Manual verification functions
  const handleManualDepositChange = (e) => {
    const { name, value } = e.target;
    setManualDepositForm(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear verification result when form changes
    if (name === 'txHash' || name === 'network') {
      setVerificationResult(null);
    }
  };

  const selectUserForManual = (user) => {
    setManualDepositForm(prev => ({
      ...prev,
      userId: user._id
    }));
    setUserSearch(`${user.username} (${user.email})`);
    setSearchResults([]);
  };

  const verifyTransactionOnBlockchain = async () => {
    if (!manualDepositForm.txHash || !manualDepositForm.network) {
      showToast.error('Please enter transaction hash and select network');
      return;
    }

    try {
      setVerifying(true);
      
      const data = await ApiUtils.post('/admin/deposits/verify-transaction', {
        txHash: manualDepositForm.txHash,
        network: manualDepositForm.network
      });

      setVerificationResult(data.verification);

    } catch (err) {
      showToast.error('Verification failed: ' + err.message);
      setVerificationResult({ valid: false, error: err.message });
    } finally {
      setVerifying(false);
    }
  };

  const createManualDeposit = async () => {
    if (!manualDepositForm.userId || !manualDepositForm.txHash || !manualDepositForm.amount) {
      showToast.error('Please fill in all required fields');
      return;
    }

    try {
      setCreatingManualDeposit(true);
      
      await ApiUtils.post('/admin/deposits/create-manual', manualDepositForm);

      showToast.success('Manual deposit created successfully! 📝');
      
      // Close modal and refresh data
      setShowManualDepositModal(false);
      setManualDepositForm({
        userId: '',
        txHash: '',
        amount: '',
        network: 'BEP20',
        notes: ''
      });
      setUserSearch('');
      setSearchResults([]);
      setVerificationResult(null);
      fetchData();

    } catch (err) {
      showToast.error('Failed to create manual deposit: ' + err.message);
    } finally {
      setCreatingManualDeposit(false);
    }
  };

  return (
    <div className={`min-h-screen ${adminTheme.primary}`}>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header Section */}
        <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 ${adminTheme.shadow}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`p-3 ${adminTheme.accent} rounded-xl ${adminTheme.shadow}`}>
                <Database className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className={`text-3xl font-bold ${adminTheme.textPrimary}`}>Deposit Management</h1>
                <p className={`${adminTheme.textSecondary} mt-1`}>Monitor and manage all deposit transactions</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
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
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className={`${adminTheme.card} ${adminTheme.border} rounded-xl p-6 ${adminTheme.shadow} hover:scale-105 transition-transform duration-200`}>
              <div className="flex items-center">
                <div className={`p-3 ${adminTheme.infoBg} rounded-xl border`}>
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div className="ml-4">
                  <p className={`text-sm font-medium ${adminTheme.textSecondary}`}>Total Addresses</p>
                  <p className={`text-2xl font-bold ${adminTheme.textPrimary}`}>{stats.totalAddresses}</p>
                </div>
              </div>
            </div>

            {stats.byStatus?.map((status) => (
              <div key={status._id} className={`${adminTheme.card} ${adminTheme.border} rounded-xl p-6 ${adminTheme.shadow} hover:scale-105 transition-transform duration-200`}>
                <div className="flex items-center">
                  <div className={`p-3 ${adminTheme.successBg} rounded-xl border`}>
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <div className="ml-4">
                    <p className={`text-sm font-medium ${adminTheme.textSecondary} capitalize`}>{status._id}</p>
                    <p className={`text-2xl font-bold ${adminTheme.textPrimary}`}>{status.count}</p>
                    <p className={`text-sm ${adminTheme.textMuted}`}>{status.totalAmount.toFixed(2)} USDT</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pending Deposits Section */}
        <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 ${adminTheme.shadow}`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className={`p-3 ${adminTheme.warningBg} rounded-xl border`}>
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h2 className={`text-xl font-bold ${adminTheme.textPrimary}`}>Pending Deposit Requests</h2>
                <p className={`${adminTheme.textSecondary}`}>User submitted deposits awaiting manual verification</p>
              </div>
            </div>
            <select
              value={selectedNetwork}
              onChange={(e) => setSelectedNetwork(e.target.value)}
              className={`px-4 py-2 ${adminTheme.input} rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FCD535]/50`}
            >
              <option value="all">All Networks</option>
              <option value="BEP20">BEP20</option>
            </select>
          </div>

          {filteredDeposits.length === 0 ? (
            <div className="text-center py-12">
              <div className={`w-20 h-20 mx-auto mb-4 ${adminTheme.surface} rounded-2xl flex items-center justify-center`}>
                <Clock className={`w-10 h-10 ${adminTheme.textMuted}`} />
              </div>
              <h3 className={`text-lg font-semibold ${adminTheme.textPrimary} mb-2`}>No pending deposit requests</h3>
              <p className={`${adminTheme.textSecondary} text-sm`}>
                User submitted deposit requests will appear here for manual verification
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className={adminTheme.tableHeader}>
                    <th className="text-left py-4 px-4 font-semibold">Date & Time</th>
                    <th className="text-left py-4 px-4 font-semibold">User Details</th>
                    <th className="text-left py-4 px-4 font-semibold">Network</th>
                    <th className="text-left py-4 px-4 font-semibold">Amount</th>
                    <th className="text-left py-4 px-4 font-semibold">Status</th>
                    <th className="text-left py-4 px-4 font-semibold">Transaction Hash</th>
                    <th className="text-left py-4 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeposits.map((deposit) => (
                    <tr key={deposit._id} className={adminTheme.tableRow}>
                      <td className={`py-4 px-4 text-sm ${adminTheme.tableCell}`}>
                        <div>
                          <div className="font-medium">{new Date(deposit.createdAt).toLocaleDateString()}</div>
                          <div className={adminTheme.textMuted}>{new Date(deposit.createdAt).toLocaleTimeString()}</div>
                        </div>
                      </td>
                      <td className={`py-4 px-4 text-sm ${adminTheme.tableCell}`}>
                        <div>
                          <div className="font-medium">{deposit.userId?.username}</div>
                          <div className={adminTheme.textMuted}>{deposit.userId?.email}</div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-lg text-xs font-semibold border ${getNetworkInfo(deposit.network).color}`}>
                          {deposit.network}
                        </span>
                      </td>
                      <td className={`py-4 px-4 text-sm font-bold ${adminTheme.textPrimary}`}>
                        <div className="flex items-center space-x-1">
                          <DollarSign className="w-4 h-4" />
                          <span>{deposit.amount.toFixed(2)}</span>
                          <span className={adminTheme.textMuted}>USDT</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm">
                        <span className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                          deposit.status === 'submitted' 
                            ? adminStatusColors.submitted
                            : adminStatusColors[deposit.status] || 'bg-[#333A47]/10 border-[#333A47]/20 text-[#EAECEF]/60'
                        }`}>
                          {deposit.status === 'submitted' ? 'Awaiting Review' : deposit.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm">
                        <a
                          href={`${getNetworkInfo(deposit.network).explorer}${deposit.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${adminTheme.textAccent} hover:text-[#E6C228] flex items-center space-x-1 transition-colors`}
                        >
                          <span className="font-mono">{formatAddress(deposit.txHash)}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => creditDeposit(deposit._id)}
                            disabled={crediting === deposit._id}
                            className={`flex items-center space-x-1 px-3 py-2 ${adminTheme.buttonSuccess} rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105`}
                          >
                            {crediting === deposit._id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedTransaction(deposit);
                              setShowRejectModal(true);
                            }}
                            disabled={rejecting === deposit._id}
                            className={`flex items-center space-x-1 px-3 py-2 ${adminTheme.buttonDanger} rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105`}
                          >
                            {rejecting === deposit._id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                            <span>Reject</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Network Statistics */}
        {stats?.byNetwork && (
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 ${adminTheme.shadow}`}>
            <div className="flex items-center space-x-4 mb-6">
              <div className={`p-3 ${adminTheme.infoBg} rounded-xl border`}>
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h2 className={`text-xl font-bold ${adminTheme.textPrimary}`}>Network Statistics</h2>
                <p className={`${adminTheme.textSecondary}`}>Deposits breakdown by network</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {stats.byNetwork.map((network) => (
                <div key={network._id} className={`${adminTheme.surface} border ${adminTheme.border} rounded-xl p-6 hover:scale-105 transition-transform duration-200`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-3 py-2 rounded-lg text-sm font-semibold border ${getNetworkInfo(network._id).color}`}>
                      {network._id}
                    </span>
                    <span className={`text-lg font-bold ${adminTheme.textPrimary}`}>{network.count} deposits</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <DollarSign className={`w-6 h-6 ${adminTheme.textAccent}`} />
                    <span className={`text-2xl font-bold ${adminTheme.textPrimary}`}>
                      {network.totalAmount.toFixed(2)} 
                    </span>
                    <span className={`${adminTheme.textSecondary}`}>USDT</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reject Deposit Modal */}
        {showRejectModal && (
          <div className={`fixed inset-0 flex items-center justify-center z-50 ${adminTheme.modalOverlay}`}>
            <div className={`${adminTheme.modalContent} rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4`}>
              <h2 className={`text-xl font-bold ${adminTheme.textPrimary} mb-4`}>Reject Deposit</h2>
              <p className={`text-sm ${adminTheme.textSecondary} mb-4`}>
                Are you sure you want to reject this deposit? Please provide a reason.
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className={`w-full p-3 ${adminTheme.textarea} rounded-xl text-sm mb-4`}
                rows="3"
                placeholder="Reason for rejection..."
              />
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className={`px-4 py-2 ${adminTheme.buttonSecondary} rounded-xl text-sm transition-all duration-200 hover:scale-105`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectSubmit}
                  disabled={rejecting}
                  className={`px-4 py-2 ${adminTheme.buttonDanger} rounded-xl text-sm flex items-center space-x-2 transition-all duration-200 hover:scale-105`}
                >
                  {rejecting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Reject Deposit</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Test Deposit Modal */}
        {showTestDepositModal && (
          <div className={`fixed inset-0 flex items-center justify-center z-50 ${adminTheme.modalOverlay}`}>
            <div className={`${adminTheme.modalContent} rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4`}>
              <h2 className={`text-xl font-bold ${adminTheme.textPrimary} mb-4`}>Create Test Deposit</h2>
              
              <div className="mb-4">
                <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                  Search and Select User
                </label>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => searchUsers(e.target.value)}
                  className={`w-full p-3 ${adminTheme.input} rounded-xl text-sm`}
                  placeholder="Search by username or email..."
                />
                
                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className={`mt-2 max-h-32 overflow-y-auto ${adminTheme.surface} border ${adminTheme.border} rounded-xl`}>
                    <ul>
                      {searchResults.map((user) => (
                        <li
                          key={user._id}
                          onClick={() => selectUser(user)}
                          className={`p-3 ${adminTheme.hover} cursor-pointer border-b ${adminTheme.border} last:border-b-0 flex justify-between items-center`}
                        >
                          <div>
                            <p className={`text-sm font-medium ${adminTheme.textPrimary}`}>{user.username}</p>
                            <p className={`text-xs ${adminTheme.textMuted}`}>{user.email}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${adminTheme.successBg} border`}>
                            Select
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                  Amount (USDT)
                </label>
                <input
                  type="number"
                  name="amount"
                  value={testDepositForm.amount}
                  onChange={handleTestDepositChange}
                  className={`w-full p-3 ${adminTheme.input} rounded-xl text-sm`}
                  placeholder="Enter amount (minimum $25)"
                  min="25"
                  step="any"
                />
              </div>

              <div className={`mb-6 p-4 ${adminTheme.infoBg} border rounded-xl`}>
                <p className={`text-sm font-medium ${adminTheme.textPrimary} mb-2`}>
                  How this works:
                </p>
                <ul className={`text-xs ${adminTheme.textSecondary} space-y-1`}>
                  <li>• Creates a test deposit transaction with "confirmed" status</li>
                  <li>• Shows up in pending deposits list</li>
                  <li>• Admin can then approve/reject to test the workflow</li>
                  <li>• User balance will be updated when approved</li>
                  <li>• Minimum deposit is $25 USDT</li>
                  <li>• Users without referrer get $1 bonus on first deposit ≥$25</li>
                </ul>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowTestDepositModal(false);
                    setTestDepositForm({ userId: '', amount: '25' });
                    setUserSearch('');
                    setSearchResults([]);
                  }}
                  className={`px-4 py-2 ${adminTheme.buttonSecondary} rounded-xl text-sm transition-all duration-200 hover:scale-105`}
                >
                  Cancel
                </button>
                <button
                  onClick={createTestDeposit}
                  disabled={creatingTestDeposit || !testDepositForm.userId || !testDepositForm.amount}
                  className={`px-4 py-2 ${adminTheme.buttonPrimary} rounded-xl text-sm flex items-center space-x-2 disabled:opacity-50 transition-all duration-200 hover:scale-105`}
                >
                  {creatingTestDeposit && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Create Test Deposit</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Manual Deposit Verification Modal */}
        {showManualDepositModal && (
          <div className={`fixed inset-0 flex items-center justify-center z-50 ${adminTheme.modalOverlay}`}>
            <div className={`${adminTheme.modalContent} rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4`}>
              <h2 className={`text-xl font-bold ${adminTheme.textPrimary} mb-4`}>Manual Deposit Verification</h2>
              
              <div className="mb-4">
                <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                  Transaction Hash
                </label>
                <input
                  type="text"
                  name="txHash"
                  value={manualDepositForm.txHash}
                  onChange={(e) => setManualDepositForm({ ...manualDepositForm, txHash: e.target.value })}
                  className={`w-full p-3 ${adminTheme.input} rounded-xl text-sm`}
                  placeholder="Enter transaction hash"
                />
              </div>

              <div className="mb-4">
                <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                  Amount (USDT)
                </label>
                <input
                  type="number"
                  name="amount"
                  value={manualDepositForm.amount}
                  onChange={(e) => setManualDepositForm({ ...manualDepositForm, amount: e.target.value })}
                  className={`w-full p-3 ${adminTheme.input} rounded-xl text-sm`}
                  placeholder="Enter amount (minimum $25)"
                  min="25"
                  step="any"
                />
              </div>

              <div className="mb-4">
                <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                  Network
                </label>
                <select
                  name="network"
                  value={manualDepositForm.network}
                  onChange={(e) => setManualDepositForm({ ...manualDepositForm, network: e.target.value })}
                  className={`w-full p-3 ${adminTheme.select} rounded-xl text-sm`}
                >
                  <option value="BEP20">BEP20</option>
                </select>
              </div>

              <div className="mb-4">
                <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={manualDepositForm.notes}
                  onChange={(e) => setManualDepositForm({ ...manualDepositForm, notes: e.target.value })}
                  className={`w-full p-3 ${adminTheme.textarea} rounded-xl text-sm`}
                  rows="3"
                  placeholder="Additional notes..."
                />
              </div>

              {/* Verification Result */}
              {verificationResult && (
                <div className={`mb-4 p-4 ${adminTheme.surface} border ${adminTheme.border} rounded-xl`}>
                  <p className={`text-sm font-medium ${adminTheme.textPrimary} mb-2`}>Verification Result:</p>
                  <pre className={`text-xs ${adminTheme.textSecondary} bg-[#252A33]/30 p-3 rounded-lg overflow-auto`}>
                    {JSON.stringify(verificationResult, null, 2)}
                  </pre>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowManualDepositModal(false);
                    setManualDepositForm({ userId: '', txHash: '', amount: '', network: 'BEP20', notes: '' });
                    setVerificationResult(null);
                  }}
                  className={`px-4 py-2 ${adminTheme.buttonSecondary} rounded-xl text-sm transition-all duration-200 hover:scale-105`}
                >
                  Cancel
                </button>
                <button
                  onClick={verifyTransactionOnBlockchain}
                  disabled={verifying}
                  className={`px-4 py-2 ${adminTheme.buttonWarning} rounded-xl text-sm flex items-center space-x-2 transition-all duration-200 hover:scale-105`}
                >
                  {verifying && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Verify Transaction</span>
                </button>
                <button
                  onClick={createManualDeposit}
                  disabled={creatingManualDeposit}
                  className={`px-4 py-2 ${adminTheme.buttonSuccess} rounded-xl text-sm flex items-center space-x-2 transition-all duration-200 hover:scale-105`}
                >
                  {creatingManualDeposit && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Create Manual Deposit</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDeposits;
