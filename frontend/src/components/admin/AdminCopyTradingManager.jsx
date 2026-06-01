import React, { useState, useEffect } from 'react';
import { ApiUtils } from '../../services/api';
import { showToast } from '../../utils/toast';
import { Plus, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
const LoadingSpinner = ({ size }) => <div className={`${size === 'sm' ? 'w-4 h-4 border' : 'w-6 h-6 border-2'} border-gray-300 border-t-blue-500 rounded-full animate-spin`} />;
import { getCryptoLogoUrl, getCryptoFallbackUrls } from '../../utils/logoService';

const AdminCopyTradingManager = () => {
  const [activeTab, setActiveTab] = useState('traders');
  const [traders, setTraders] = useState([]);
  const [stats, setStats] = useState(null);
  const [followers, setFollowers] = useState([]);
  const [followerStats, setFollowerStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [tradersPerPage] = useState(10);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showExecuteTradeModal, setShowExecuteTradeModal] = useState(false);
  const [selectedTrader, setSelectedTrader] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [executing, setExecuting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    profileImage: '',
    winRate: 50,
    totalFollowers: 0,
    commissionPercentage: 20,
    platformFeePercentage: 10,
    followerCommissionPercentage: 70
  });

  const [coins, setCoins] = useState([]);
  const [tradeFormData, setTradeFormData] = useState({
    traderId: '',
    selectedCoins: [], // Array of selected coins
    profitLossPercentage: 0
  });
  const [transactions, setTransactions] = useState([]);
  const [transactionStats, setTransactionStats] = useState(null);
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionsPerPage] = useState(50);
  const [totalTransactionPages, setTotalTransactionPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'traders') {
      setCurrentPage(1);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'transactions') {
      loadData();
    }
  }, [transactionPage]);

  useEffect(() => {
    if (activeTab === 'traders') {
      setCurrentPage(1);
    }
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'traders') {
        const response = await ApiUtils.get('/copy-trading/admin/traders?limit=1000');
        setTraders(response.data || []);
      } else if (activeTab === 'stats') {
        const response = await ApiUtils.get('/copy-trading/admin/stats');
        setStats(response.data);
      } else if (activeTab === 'followers') {
        const response = await ApiUtils.get('/copy-trading/admin/followers?limit=100');
        setFollowers(response.data?.relationships || []);
        setFollowerStats(response.data?.stats || null);
      } else if (activeTab === 'execute-trade') {
        // Load both traders and coins for trade execution
        const [tradersRes, coinsRes] = await Promise.all([
          ApiUtils.get('/copy-trading/admin/traders?limit=1000'),
          ApiUtils.get('/market/tickers')
        ]);
        setTraders(tradersRes.data || []);
        
        // Transform ticker data to match expected format
        const tickers = coinsRes.data || [];
        const transformedCoins = tickers.map((ticker, index) => {
          const [baseSymbol, quoteSymbol] = ticker.pair.split('/');
          const priceChange = ticker.lastPrice - ticker.openPrice;
          const priceChangePercent = ticker.openPrice > 0 ? 
            ((ticker.lastPrice - ticker.openPrice) / ticker.openPrice) * 100 : 0;
          
          return {
            id: ticker._id || `${ticker.pair}-${index}`, // Ensure unique ID
            symbol: baseSymbol,
            name: baseSymbol, // You might want to fetch coin names from /market/coins if needed
            image: getCryptoLogoUrl(baseSymbol),
            current_price: ticker.lastPrice,
            price_change_percentage_24h: priceChangePercent,
            pair: ticker.pair
          };
        });
        
        console.log('Transformed coins:', transformedCoins);
        setCoins(transformedCoins);
      } else if (activeTab === 'transactions') {
        const response = await ApiUtils.get(`/copy-trading/admin/all-transactions?page=${transactionPage}&limit=${transactionsPerPage}`);
        setTransactions(response.data || []);
        setTransactionStats(response.stats || null);
        setTotalTransactionPages(response.pagination?.pages || 1);
        setTotalTransactions(response.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      showToast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTrader = async (e) => {
    e.preventDefault();
    try {
      // Validate percentages
      const total = formData.commissionPercentage + formData.platformFeePercentage + formData.followerCommissionPercentage;
      if (total > 100) {
        showToast.error('Total percentages cannot exceed 100%');
        return;
      }

      await ApiUtils.post('/copy-trading/admin/traders/create', formData);
      showToast.success('Trader created successfully');
      setShowCreateModal(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error creating trader:', error);
      showToast.error(error.response?.data?.message || 'Failed to create trader');
    }
  };

  const handleEditTrader = async (e) => {
    e.preventDefault();
    try {
      if (!selectedTrader) return;

      // Validate percentages
      const total = formData.commissionPercentage + formData.platformFeePercentage + formData.followerCommissionPercentage;
      if (total > 100) {
        showToast.error('Total percentages cannot exceed 100%');
        return;
      }

      setUpdating(true);
      await ApiUtils.put(`/copy-trading/admin/traders/${selectedTrader._id}`, formData);
      
      showToast.success('Trader updated successfully');
      setShowEditModal(false);
      setSelectedTrader(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error updating trader:', error);
      showToast.error(error.response?.data?.message || 'Failed to update trader');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteTrader = async () => {
    try {
      if (!selectedTrader) return;

      setDeleting(true);
      await ApiUtils.delete(`/copy-trading/admin/traders/${selectedTrader._id}`);
      
      showToast.success('Trader deleted successfully');
      setShowDeleteModal(false);
      setSelectedTrader(null);
      loadData();
    } catch (error) {
      console.error('Error deleting trader:', error);
      showToast.error(error.response?.data?.message || 'Failed to delete trader');
    } finally {
      setDeleting(false);
    }
  };

  const fetchCoins = async () => {
    try {
      const response = await ApiUtils.get('/market/tickers');
      setCoins(response.data || []);
    } catch (error) {
      console.error('Error fetching coins:', error);
      showToast.error('Failed to load coins');
    }
  };

  const handleExecuteTrade = async (e) => {
    e.preventDefault();
    
    if (!tradeFormData.traderId) {
      showToast.error('Please select a trader');
      return;
    }
    
    if (tradeFormData.selectedCoins.length === 0) {
      showToast.error('Please select at least one coin');
      return;
    }
    
    if (tradeFormData.profitLossPercentage === 0) {
      showToast.error('Please enter profit/loss percentage');
      return;
    }
    
    try {
      setExecuting(true);
      console.log('Sending trade execution request:', {
        traderId: tradeFormData.traderId,
        selectedCoins: tradeFormData.selectedCoins,
        profitLossPercentage: tradeFormData.profitLossPercentage
      });
      const response = await ApiUtils.post('/copy-trading/admin/execute-trade', {
        traderId: tradeFormData.traderId,
        coins: tradeFormData.selectedCoins.map(coin => ({
          symbol: coin.symbol,
          name: coin.name,
          image: coin.image,
          currentPrice: parseFloat(coin.currentPrice)
        })),
        totalProfitLossPercentage: parseFloat(tradeFormData.profitLossPercentage)
      });
      
      console.log('Full response:', response);
      console.log('Response data:', response.data);
      
      // Handle different response structures
      const result = response.data?.data || response.data || {};
      
      console.log('Result object:', result);
      
      showToast.success(
        `Trade executed! ${result.successCount || 0} followers processed. Total P/L distributed: $${(result.totalProfitLossDistributed || 0).toFixed(2)}`
      );
      setShowExecuteTradeModal(false);
      resetTradeForm();
    } catch (error) {
      console.error('Error executing trade:', error);
      showToast.error(error.response?.data?.message || 'Failed to execute trade');
    } finally {
      setExecuting(false);
    }
  };

  const resetTradeForm = () => {
    setTradeFormData({
      traderId: '',
      selectedCoins: [],
      profitLossPercentage: 0
    });
  };

  const handleCoinSelect = (coin) => {
    const isSelected = tradeFormData.selectedCoins.some(c => c.symbol === coin.symbol);
    if (isSelected) {
      // Remove coin
      setTradeFormData({
        ...tradeFormData,
        selectedCoins: tradeFormData.selectedCoins.filter(c => c.symbol !== coin.symbol)
      });
    } else {
      // Add coin
      setTradeFormData({
        ...tradeFormData,
        selectedCoins: [...tradeFormData.selectedCoins, {
          symbol: coin.symbol,
          name: coin.name,
          image: coin.image,
          currentPrice: coin.current_price || 0
        }]
      });
    }
  };

  const calculateSellPrice = () => {
    const { currentPrice, profitLossPercentage } = tradeFormData;
    if (!currentPrice || profitLossPercentage === 0) return 0;
    return currentPrice * (1 + profitLossPercentage / 100);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      bio: '',
      profileImage: '',
      winRate: 50,
      totalFollowers: 0,
      commissionPercentage: 20,
      platformFeePercentage: 10,
      followerCommissionPercentage: 70
    });
  };

  return (
    <div className="min-h-screen w-full bg-[#181A20] text-[#EAECEF] p-4 md:p-8">
      {/* Background Gradient */}
      <div className="fixed inset-0 opacity-40 pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-linear-to-br from-purple-500/20 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-linear-to-tl from-purple-500/10 to-transparent rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-black text-[#FCD535] mb-2">Copy Trading Manager</h1>
          <p className="text-[#EAECEF]/60 text-sm md:text-base">Manage traders and distribute passive income</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-[#333A47] overflow-x-auto">
          <button
            onClick={() => setActiveTab('traders')}
            className={`px-4 py-3 font-medium text-sm transition-all whitespace-nowrap ${
              activeTab === 'traders'
                ? 'text-[#FCD535] border-b-2 border-[#FCD535]'
                : 'text-[#EAECEF]/60 hover:text-[#EAECEF]'
            }`}
          >
            Traders
          </button>
          <button
            onClick={() => setActiveTab('followers')}
            className={`px-4 py-3 font-medium text-sm transition-all whitespace-nowrap ${
              activeTab === 'followers'
                ? 'text-[#FCD535] border-b-2 border-[#FCD535]'
                : 'text-[#EAECEF]/60 hover:text-[#EAECEF]'
            }`}
          >
            Followers
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-3 font-medium text-sm transition-all whitespace-nowrap ${
              activeTab === 'stats'
                ? 'text-[#FCD535] border-b-2 border-[#FCD535]'
                : 'text-[#EAECEF]/60 hover:text-[#EAECEF]'
            }`}
          >
            Statistics
          </button>
          <button
            onClick={() => setActiveTab('execute-trade')}
            className={`px-4 py-3 font-medium text-sm transition-all whitespace-nowrap ${
              activeTab === 'execute-trade'
                ? 'text-[#FCD535] border-b-2 border-[#FCD535]'
                : 'text-[#EAECEF]/60 hover:text-[#EAECEF]'
            }`}
          >
            Execute Trade
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-3 font-medium text-sm transition-all whitespace-nowrap ${
              activeTab === 'transactions'
                ? 'text-[#FCD535] border-b-2 border-[#FCD535]'
                : 'text-[#EAECEF]/60 hover:text-[#EAECEF]'
            }`}
          >
            Transactions
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'traders' && (
          <div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mb-6 px-6 py-2 bg-[#FCD535] hover:bg-[#E6C228] text-black rounded-lg transition-colors flex items-center gap-2 font-semibold"
            >
              <Plus size={20} /> Create Trader
            </button>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="md" />
              </div>
            ) : traders.length === 0 ? (
              <div className="bg-[#1F2937] border border-[#333A47] rounded-xl p-12 text-center">
                <p className="text-[#EAECEF]/60">No traders created yet</p>
              </div>
            ) : (
              <>
                {/* Pagination Info */}
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-[#EAECEF]/60">
                    Showing {((currentPage - 1) * tradersPerPage) + 1} to {Math.min(currentPage * tradersPerPage, traders.length)} of {traders.length} traders
                  </p>
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#333A47]">
                        <th className="text-left px-6 py-4 font-semibold text-[#EAECEF]/80">Trader</th>
                        <th className="text-left px-6 py-4 font-semibold text-[#EAECEF]/80">Win Rate</th>
                        <th className="text-left px-6 py-4 font-semibold text-[#EAECEF]/80">Followers</th>
                        <th className="text-left px-6 py-4 font-semibold text-[#EAECEF]/80">Status</th>
                        <th className="text-left px-6 py-4 font-semibold text-[#EAECEF]/80">Distributed</th>
                        <th className="text-left px-6 py-4 font-semibold text-[#EAECEF]/80">Earned</th>
                        <th className="text-right px-6 py-4 font-semibold text-[#EAECEF]/80">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {traders.slice((currentPage - 1) * tradersPerPage, currentPage * tradersPerPage).map((trader) => (
                        <tr key={trader._id} className="border-b border-[#333A47] hover:bg-[#1F2937]/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {trader.profileImage && (
                                <img
                                  src={trader.profileImage}
                                  alt={trader.name}
                                  className="w-10 h-10 rounded-full"
                                />
                              )}
                              <div>
                                <p className="font-semibold text-[#EAECEF]">{trader.name}</p>
                                <p className="text-xs text-[#EAECEF]/60">{trader.bio}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-[#EAECEF]">{trader.winRate}%</td>
                          <td className="px-6 py-4 text-[#EAECEF]">{trader.totalFollowers}</td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${trader.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                              {trader.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[#EAECEF]">${trader.totalDistributed?.toFixed(2) || '0.00'}</td>
                          <td className="px-6 py-4 text-[#EAECEF]">${trader.totalEarned?.toFixed(2) || '0.00'}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setSelectedTrader(trader);
                                  setShowDeleteModal(true);
                                }}
                                className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-xs font-medium"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4">
                  {traders.slice((currentPage - 1) * tradersPerPage, currentPage * tradersPerPage).map((trader) => (
                    <div
                      key={trader._id}
                      className="bg-[#1F2937] border border-[#333A47] hover:border-[#FCD535]/30 rounded-xl p-4 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-3">
                            {trader.profileImage && (
                              <img
                                src={trader.profileImage}
                                alt={trader.name}
                                className="w-10 h-10 rounded-full shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <h3 className="text-base font-bold text-[#EAECEF] truncate">{trader.name}</h3>
                              <p className="text-xs text-[#EAECEF]/60 truncate">{trader.bio}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mb-2 text-xs">
                            <div>
                              <p className="text-[#EAECEF]/60">Win Rate</p>
                              <p className="font-semibold text-[#EAECEF]">{trader.winRate}%</p>
                            </div>
                            <div>
                              <p className="text-[#EAECEF]/60">Followers</p>
                              <p className="font-semibold text-[#EAECEF]">{trader.totalFollowers}</p>
                            </div>
                            <div>
                              <p className="text-[#EAECEF]/60">Status</p>
                              <p className={`font-semibold ${trader.isActive ? 'text-emerald-400' : 'text-red-400'}`}>
                                {trader.isActive ? 'Active' : 'Inactive'}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-[#EAECEF]/60">Distributed:</p>
                              <p className="text-white font-semibold">${trader.totalDistributed?.toFixed(2) || '0.00'}</p>
                            </div>
                            <div>
                              <p className="text-[#EAECEF]/60">Earned:</p>
                              <p className="text-white font-semibold">${trader.totalEarned?.toFixed(2) || '0.00'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                {traders.length > tradersPerPage && (
                  <div className="mt-6 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-[#1F2937] border border-[#333A47] hover:border-[#FCD535] text-[#EAECEF] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      Previous
                    </button>
                    
                    <div className="flex items-center gap-2">
                      {Array.from({ length: Math.ceil(traders.length / tradersPerPage) }, (_, i) => i + 1).map(pageNum => (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-10 h-10 rounded-lg text-sm font-semibold transition-colors ${
                            currentPage === pageNum
                              ? 'bg-[#FCD535] text-black'
                              : 'bg-[#1F2937] border border-[#333A47] hover:border-[#FCD535] text-[#EAECEF]'
                          }`}
                        >
                          {pageNum}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(traders.length / tradersPerPage)))}
                      disabled={currentPage === Math.ceil(traders.length / tradersPerPage)}
                      className="px-4 py-2 bg-[#1F2937] border border-[#333A47] hover:border-[#FCD535] text-[#EAECEF] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'followers' && (
          <div>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="md" />
              </div>
            ) : (
              <>
                {/* Follower Stats Summary */}
                {followerStats && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-[#1F2937] border border-[#333A47] rounded-xl p-4">
                      <p className="text-[#EAECEF]/60 text-xs mb-2 font-semibold">Active Followers</p>
                      <p className="text-2xl md:text-3xl font-bold text-emerald-400">{followerStats.activeCount || 0}</p>
                    </div>
                    <div className="bg-[#1F2937] border border-[#333A47] rounded-xl p-4">
                      <p className="text-[#EAECEF]/60 text-xs mb-2 font-semibold">Total Invested</p>
                      <p className="text-2xl md:text-3xl font-bold text-blue-400">${followerStats.totalInvested?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div className="bg-[#1F2937] border border-[#333A47] rounded-xl p-4">
                      <p className="text-[#EAECEF]/60 text-xs mb-2 font-semibold">Current Balance</p>
                      <p className="text-2xl md:text-3xl font-bold text-[#FCD535]">${followerStats.totalCurrentBalance?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div className="bg-[#1F2937] border border-[#333A47] rounded-xl p-4">
                      <p className="text-[#EAECEF]/60 text-xs mb-2 font-semibold">Total Returns</p>
                      <p className="text-2xl md:text-3xl font-bold text-emerald-400">${followerStats.totalReturns?.toFixed(2) || '0.00'}</p>
                    </div>
                  </div>
                )}

                {/* Follower Relationships Table */}
                <div className="bg-[#1F2937] border border-[#333A47] rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-[#333A47]">
                    <h3 className="text-lg font-bold text-[#EAECEF]">
                      Follower Tracking - Who Follows Whom
                    </h3>
                    <p className="text-[#EAECEF]/60 text-sm mt-1">
                      Monitor all user-trader relationships and investment details
                    </p>
                  </div>

                  {followers.length === 0 ? (
                    <div className="p-8 text-center text-[#EAECEF]/60">
                      No follower relationships found
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-[#181A20]">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-[#EAECEF]/80">User</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-[#EAECEF]/80">Trader</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-[#EAECEF]/80">Initial</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-[#EAECEF]/80">Current</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-[#EAECEF]/80">Returns</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-[#EAECEF]/80">P/L</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-[#EAECEF]/80">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-[#EAECEF]/80">Since</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#333A47]">
                          {followers.map((follower) => {
                            const profitLoss = follower.currentBalance - follower.initialAmount;
                            const profitLossPercent = ((profitLoss / follower.initialAmount) * 100).toFixed(2);
                            return (
                              <tr key={follower._id} className="hover:bg-[#181A20]/50 transition-colors">
                                <td className="px-4 py-3">
                                  <div>
                                    <p className="text-sm font-medium text-[#EAECEF]">
                                      {follower.user?.fullName || follower.user?.username || 'N/A'}
                                    </p>
                                    <p className="text-xs text-[#EAECEF]/60">{follower.user?.email}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    {follower.trader?.profileImage && (
                                      <img
                                        src={follower.trader.profileImage}
                                        alt={follower.trader.name}
                                        className="w-8 h-8 rounded-full object-cover"
                                      />
                                    )}
                                    <div>
                                      <p className="text-sm font-medium text-[#EAECEF]">{follower.trader?.name || 'N/A'}</p>
                                      {follower.trader?.winRate && (
                                        <p className="text-xs text-emerald-400">{follower.trader.winRate}% Win</p>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-[#EAECEF]">
                                  ${follower.initialAmount?.toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-sm font-semibold text-[#FCD535]">
                                  ${follower.currentBalance?.toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-sm text-emerald-400">
                                  ${follower.totalReturns?.toFixed(2) || '0.00'}
                                </td>
                                <td className="px-4 py-3">
                                  <div className={`text-sm font-semibold ${profitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {profitLoss >= 0 ? '+' : ''}${profitLoss.toFixed(2)}
                                    <span className="text-xs ml-1">({profitLossPercent}%)</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                                    follower.isActive
                                      ? 'bg-emerald-500/20 text-emerald-400'
                                      : 'bg-red-500/20 text-red-400'
                                  }`}>
                                    {follower.isActive ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-[#EAECEF]/60">
                                  {new Date(follower.followedDate).toLocaleDateString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="md" />
              </div>
            ) : stats ? (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-[#1F2937] border border-[#333A47] rounded-xl p-4">
                    <p className="text-[#EAECEF]/60 text-xs mb-2 font-semibold">Total Traders</p>
                    <p className="text-2xl md:text-3xl font-bold text-[#EAECEF]">{stats.totalTraders}</p>
                  </div>
                  <div className="bg-[#1F2937] border border-[#333A47] rounded-xl p-4">
                    <p className="text-[#EAECEF]/60 text-xs mb-2 font-semibold">Total Followers</p>
                    <p className="text-2xl md:text-3xl font-bold text-[#EAECEF]">{stats.totalFollowers}</p>
                  </div>
                  <div className="bg-[#1F2937] border border-[#333A47] rounded-xl p-4">
                    <p className="text-[#EAECEF]/60 text-xs mb-2 font-semibold">Total Transactions</p>
                    <p className="text-2xl md:text-3xl font-bold text-[#EAECEF]">{stats.totalTransactions}</p>
                  </div>
                  <div className="bg-[#1F2937] border border-[#333A47] rounded-xl p-4">
                    <p className="text-[#EAECEF]/60 text-xs mb-2 font-semibold">Total Distributed</p>
                    <p className="text-2xl md:text-3xl font-bold text-emerald-400">${stats.totalDistributed?.toFixed(2)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Top Traders by Followers */}
                  <div className="bg-[#1F2937] border border-[#333A47] rounded-xl p-4 md:p-6">
                    <h3 className="text-base md:text-lg font-bold text-[#EAECEF] mb-4 flex items-center gap-2">
                      <TrendingUp size={18} /> Top Traders by Performance
                    </h3>
                    <div className="space-y-2">
                      {stats.topTraders?.map((trader, idx) => (
                        <div
                          key={trader._id}
                          className="flex items-center justify-between p-3 md:p-4 bg-[#181A20]/50 rounded-lg text-sm"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-[#EAECEF]/60 font-semibold w-6">#{idx + 1}</span>
                            <span className="text-[#EAECEF]">{trader.name}</span>
                          </div>
                          <div className="flex gap-4 md:gap-8 text-xs md:text-sm">
                            <div className="text-right">
                              <p className="text-[#EAECEF]/60">Followers</p>
                              <p className="text-[#EAECEF]">{trader.totalFollowers}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[#EAECEF]/60">Distributed</p>
                              <p className="text-emerald-400">${trader.totalDistributed?.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Followers Breakdown by Trader */}
                  <div className="bg-[#1F2937] border border-[#333A47] rounded-xl p-4 md:p-6">
                    <h3 className="text-base md:text-lg font-bold text-[#EAECEF] mb-4 flex items-center gap-2">
                      <TrendingUp size={18} /> Active Followers by Trader
                    </h3>
                    <div className="space-y-2">
                      {stats.followersByTrader?.length > 0 ? (
                        stats.followersByTrader.map((item, idx) => (
                          <div
                            key={item.traderId}
                            className="flex items-center justify-between p-3 md:p-4 bg-[#181A20]/50 rounded-lg text-sm"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-[#EAECEF]/60 font-semibold w-6">#{idx + 1}</span>
                              <span className="text-[#EAECEF]">{item.traderName}</span>
                            </div>
                            <div className="flex gap-4 md:gap-8 text-xs md:text-sm">
                              <div className="text-right">
                                <p className="text-[#EAECEF]/60">Followers</p>
                                <p className="text-[#FCD535] font-semibold">{item.activeFollowers}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[#EAECEF]/60">Total Invested</p>
                                <p className="text-blue-400">${item.totalInvested?.toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-[#EAECEF]/60 text-sm text-center py-4">No follower data available</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Execute Trade Tab */}
        {activeTab === 'execute-trade' && (
          <div className="max-w-4xl">
            <div className="bg-[#1F2937] border border-[#333A47] rounded-xl p-6">
              <h2 className="text-xl font-bold text-[#EAECEF] mb-6">Execute Trade</h2>
              
              <form onSubmit={handleExecuteTrade} className="space-y-6">
                {/* Trader Selection */}
                <div>
                  <label className="block text-sm font-semibold text-[#EAECEF]/80 mb-2">Select Trader *</label>
                  <select
                    required
                    value={tradeFormData.traderId}
                    onChange={(e) => setTradeFormData({ ...tradeFormData, traderId: e.target.value })}
                    className="w-full px-4 py-3 bg-[#181A20] border border-[#333A47] rounded-lg text-[#EAECEF] focus:outline-none focus:border-[#FCD535]"
                  >
                    <option value="">Choose a trader...</option>
                    {traders.map(trader => (
                      <option key={trader._id} value={trader._id}>
                        {trader.name} ({trader.totalFollowers} followers)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Coin Selection */}
                <div>
                  <label className="block text-sm font-semibold text-[#EAECEF]/80 mb-2">Select Coin *</label>
                  {coins.length === 0 ? (
                    <div className="text-center py-8">
                      <LoadingSpinner size="sm" />
                      <p className="text-[#EAECEF]/60 text-sm mt-2">Loading coins...</p>
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto bg-[#181A20] border border-[#333A47] rounded-lg">
                      {coins.map((coin) => {
                        const isSelected = tradeFormData.selectedCoins.some(c => c.symbol === coin.symbol);
                        return (
                          <button
                            key={coin.id}
                            type="button"
                            onClick={() => handleCoinSelect(coin)}
                            className={`w-full px-4 py-3 flex items-center justify-between hover:bg-[#1F2937] transition-colors border-b border-[#333A47] last:border-b-0 ${
                              isSelected ? 'bg-[#1F2937] border-l-4 border-l-[#FCD535]' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {/* Checkbox */}
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                isSelected ? 'bg-[#FCD535] border-[#FCD535]' : 'border-[#333A47]'
                              }`}>
                                {isSelected && (
                                  <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <div className="relative">
                              <img 
                                src={coin.image} 
                                alt={coin.name} 
                                className="w-8 h-8 rounded-full object-cover"
                                onError={(e) => {
                                  const fallbackUrls = getCryptoFallbackUrls(coin.symbol);
                                  const currentIndex = parseInt(e.target.dataset.fallbackIndex || '0');
                                  const nextIndex = currentIndex + 1;
                                  
                                  if (nextIndex < fallbackUrls.length) {
                                    e.target.dataset.fallbackIndex = nextIndex.toString();
                                    e.target.src = fallbackUrls[nextIndex];
                                  } else {
                                    e.target.style.display = 'none';
                                    e.target.nextElementSibling.style.display = 'flex';
                                  }
                                }}
                              />
                              <div 
                                className="w-8 h-8 bg-linear-to-br from-cyan-500/20 to-purple-500/20 rounded-full items-center justify-center hidden"
                                style={{ display: 'none' }}
                              >
                                <span className="text-cyan-400 font-bold text-xs">
                                  {coin.symbol?.substring(0, 2)}
                                </span>
                              </div>
                            </div>
                            <div className="text-left">
                              <p className="text-[#EAECEF] font-semibold">{coin.name}</p>
                              <p className="text-[#EAECEF]/60 text-xs uppercase">{coin.symbol}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[#EAECEF] font-semibold">${coin.current_price?.toFixed(2)}</p>
                            <p className={`text-xs ${coin.price_change_percentage_24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {coin.price_change_percentage_24h >= 0 ? '+' : ''}{coin.price_change_percentage_24h?.toFixed(2)}%
                            </p>
                          </div>
                        </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Selected Coins Display */}
                {tradeFormData.selectedCoins.length > 0 && (
                  <div className="bg-[#181A20] border border-[#333A47] rounded-lg p-4">
                    <p className="text-xs text-[#EAECEF]/60 mb-3">Selected Coins ({tradeFormData.selectedCoins.length})</p>
                    <div className="grid grid-cols-2 gap-2">
                      {tradeFormData.selectedCoins.map((coin, index) => (
                        <div key={index} className="flex items-center gap-2 bg-[#1F2937] rounded-lg p-2">
                          <div className="relative">
                            <img 
                              src={coin.image} 
                              alt={coin.name} 
                              className="w-8 h-8 rounded-full object-cover"
                              onError={(e) => {
                                const fallbackUrls = getCryptoFallbackUrls(coin.symbol);
                                const currentIndex = parseInt(e.target.dataset.fallbackIndex || '0');
                                const nextIndex = currentIndex + 1;
                                
                                if (nextIndex < fallbackUrls.length) {
                                  e.target.dataset.fallbackIndex = nextIndex.toString();
                                  e.target.src = fallbackUrls[nextIndex];
                                } else {
                                  e.target.style.display = 'none';
                                  e.target.nextElementSibling.style.display = 'flex';
                                }
                              }}
                            />
                            <div 
                              className="w-8 h-8 bg-linear-to-br from-cyan-500/20 to-purple-500/20 rounded-full items-center justify-center hidden"
                              style={{ display: 'none' }}
                            >
                              <span className="text-cyan-400 font-bold text-xs">
                                {coin.symbol?.substring(0, 2)}
                              </span>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[#EAECEF] font-semibold text-sm truncate">{coin.symbol}</p>
                            <p className="text-[#EAECEF]/60 text-xs">${coin.currentPrice?.toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Profit/Loss Percentage */}
                <div>
                  <label className="block text-sm font-semibold text-[#EAECEF]/80 mb-2">
                    Total Profit/Loss Percentage *
                    <span className="text-xs text-[#EAECEF]/60 ml-2">(Will be randomly distributed across selected coins)</span>
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={tradeFormData.profitLossPercentage}
                    onChange={(e) => setTradeFormData({ ...tradeFormData, profitLossPercentage: e.target.value })}
                    className="w-full px-4 py-3 bg-[#181A20] border border-[#333A47] rounded-lg text-[#EAECEF] focus:outline-none focus:border-[#FCD535]"
                    placeholder="e.g., 5 for +5% profit, -3 for -3% loss"
                  />
                </div>

                {/* Trade Preview */}
                {tradeFormData.selectedCoins.length > 0 && tradeFormData.profitLossPercentage !== 0 && (
                  <div className="bg-linear-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-4">
                    <p className="text-xs text-[#EAECEF]/60 mb-3 font-semibold">Trade Summary</p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[#EAECEF]/60 text-sm">Selected Coins:</span>
                        <span className="text-[#EAECEF] font-semibold">{tradeFormData.selectedCoins.length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#EAECEF]/60 text-sm">Total P/L:</span>
                        <span className={`font-bold text-lg ${tradeFormData.profitLossPercentage >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {tradeFormData.profitLossPercentage >= 0 ? '+' : ''}{tradeFormData.profitLossPercentage}%
                        </span>
                      </div>
                      <div className="pt-2 border-t border-white/10">
                        <p className="text-xs text-[#EAECEF]/60 text-center">
                          {tradeFormData.profitLossPercentage >= 0 ? '📈' : '📉'} 
                          Each coin will receive a random portion of the total {Math.abs(tradeFormData.profitLossPercentage)}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={executing}
                    className="flex-1 px-6 py-3 bg-[#FCD535] hover:bg-[#E6C228] text-black rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {executing ? (
                      <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : 'Execute Trade'}
                  </button>
                  <button
                    type="button"
                    onClick={resetTradeForm}
                    className="px-6 py-3 bg-[#1F2937] hover:bg-[#181A20] text-[#EAECEF] border border-[#333A47] rounded-lg font-semibold transition-colors"
                  >
                    Reset
                  </button>
                </div>

                {/* Warning */}
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <p className="text-red-400 text-sm">
                    ⚠️ <strong>Warning:</strong> Executing a trade will:
                  </p>
                  <ul className="text-red-400/80 text-xs mt-2 ml-4 space-y-1">
                    <li>• Create BUY and SELL transactions for all active followers</li>
                    <li>• Distribute profit/loss to all followers based on their investment</li>
                    <li>• Automatically unfollow all followers after execution</li>
                    <li>• Update all follower USDT balances immediately</li>
                  </ul>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div>
            <h2 className="text-xl font-bold text-[#EAECEF] mb-6">Copy Trading Transactions</h2>
            
            {loading ? (
              <LoadingSpinner />
            ) : transactions.length === 0 ? (
              <div className="text-center py-12 text-[#EAECEF]/60">
                <p>No transactions found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#1F2937] border-b border-[#333A47]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#EAECEF]/80 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#EAECEF]/80 uppercase">User</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#EAECEF]/80 uppercase">Trader</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#EAECEF]/80 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#EAECEF]/80 uppercase">Coin</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-[#EAECEF]/80 uppercase">Amount</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-[#EAECEF]/80 uppercase">P/L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#333A47]">
                    {transactions.map((tx) => (
                      <tr key={tx._id} className="hover:bg-[#1F2937]/50">
                        <td className="px-4 py-3 text-sm text-[#EAECEF]/80">
                          {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#EAECEF]">
                          {tx.user?.username || tx.user?.email || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#EAECEF]">
                          {tx.trader?.name || 'N/A'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            tx.type === 'trade' 
                              ? tx.trade?.tradeType === 'BUY' 
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-red-500/20 text-red-400'
                              : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {tx.type === 'trade' ? tx.trade?.tradeType : tx.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#EAECEF]">
                          {tx.trade?.coin?.symbol || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-[#EAECEF]">
                          ${tx.amount?.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {tx.trade?.profitLossAmount !== undefined && tx.trade?.profitLossAmount !== 0 ? (
                            <span className={`font-semibold ${tx.trade.profitLossAmount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {tx.trade.profitLossAmount >= 0 ? '+' : ''}${tx.trade.profitLossAmount?.toFixed(2)}
                              <span className="text-xs ml-1">({tx.trade.profitLossPercentage >= 0 ? '+' : ''}{tx.trade.profitLossPercentage}%)</span>
                            </span>
                          ) : (
                            <span className="text-[#EAECEF]/40">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination Controls */}
                {totalTransactionPages > 1 && (
                  <div className="flex items-center justify-between mt-6 px-4">
                    <div className="text-sm text-[#EAECEF]/60">
                      Showing {((transactionPage - 1) * transactionsPerPage) + 1} to {Math.min(transactionPage * transactionsPerPage, totalTransactions)} of {totalTransactions} transactions
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setTransactionPage(prev => Math.max(1, prev - 1))}
                        disabled={transactionPage === 1}
                        className="px-3 py-2 bg-[#1F2937] border border-[#333A47] rounded-lg text-[#EAECEF] text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#374151] transition-colors"
                      >
                        Previous
                      </button>
                      <div className="flex items-center gap-1">
                        {[...Array(Math.min(5, totalTransactionPages))].map((_, idx) => {
                          let pageNum;
                          if (totalTransactionPages <= 5) {
                            pageNum = idx + 1;
                          } else if (transactionPage <= 3) {
                            pageNum = idx + 1;
                          } else if (transactionPage >= totalTransactionPages - 2) {
                            pageNum = totalTransactionPages - 4 + idx;
                          } else {
                            pageNum = transactionPage - 2 + idx;
                          }
                          
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setTransactionPage(pageNum)}
                              className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                                transactionPage === pageNum
                                  ? 'bg-[#FCD535] text-black'
                                  : 'bg-[#1F2937] border border-[#333A47] text-[#EAECEF] hover:bg-[#374151]'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => setTransactionPage(prev => Math.min(totalTransactionPages, prev + 1))}
                        disabled={transactionPage === totalTransactionPages}
                        className="px-3 py-2 bg-[#1F2937] border border-[#333A47] rounded-lg text-[#EAECEF] text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#374151] transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Create Trader Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur flex items-center justify-center z-50 p-4">
            <div className="bg-[#1F2937] border border-[#333A47] rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-[#EAECEF] mb-4">Create Trader</h2>
              <form onSubmit={handleCreateTrader} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#EAECEF]/80 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-[#181A20] border border-[#333A47] rounded-lg text-[#EAECEF] focus:outline-none focus:border-[#FCD535] text-sm"
                    placeholder="Trader name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#EAECEF]/80 mb-1">Bio</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    className="w-full px-3 py-2 bg-[#181A20] border border-[#333A47] rounded-lg text-[#EAECEF] focus:outline-none focus:border-[#FCD535] resize-none text-sm"
                    placeholder="Trader biography"
                    rows="2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#EAECEF]/80 mb-1">Profile Image URL</label>
                  <input
                    type="text"
                    value={formData.profileImage}
                    onChange={(e) => setFormData({ ...formData, profileImage: e.target.value })}
                    className="w-full px-3 py-2 bg-[#181A20] border border-[#333A47] rounded-lg text-[#EAECEF] focus:outline-none focus:border-[#FCD535] text-sm"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#EAECEF]/80 mb-1">Win Rate (%) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    value={formData.winRate}
                    onChange={(e) => setFormData({ ...formData, winRate: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#181A20] border border-[#333A47] rounded-lg text-[#EAECEF] focus:outline-none focus:border-[#FCD535] text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#EAECEF]/80 mb-1">Initial Followers Count</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.totalFollowers}
                    onChange={(e) => setFormData({ ...formData, totalFollowers: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-[#181A20] border border-[#333A47] rounded-lg text-[#EAECEF] focus:outline-none focus:border-[#FCD535] text-sm"
                    placeholder="Set custom follower count (optional)"
                  />
                  <p className="text-xs text-[#EAECEF]/60 mt-1">Set a custom follower count to display for this trader</p>
                </div>

                <div className="space-y-2 text-xs">
                  <p className="text-[#EAECEF]/80 font-semibold">Commission Split (≤ 100%)</p>
                  <div>
                    <label className="text-[#EAECEF]/70 flex items-center justify-between">
                      Trader: {formData.commissionPercentage}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={formData.commissionPercentage}
                      onChange={(e) => setFormData({ ...formData, commissionPercentage: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[#EAECEF]/70 flex items-center justify-between">
                      Platform Fee: {formData.platformFeePercentage}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={formData.platformFeePercentage}
                      onChange={(e) => setFormData({ ...formData, platformFeePercentage: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[#EAECEF]/70 flex items-center justify-between">
                      Follower: {formData.followerCommissionPercentage}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={formData.followerCommissionPercentage}
                      onChange={(e) =>
                        setFormData({ ...formData, followerCommissionPercentage: parseFloat(e.target.value) })
                      }
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-[#333A47]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      resetForm();
                    }}
                    className="flex-1 px-4 py-2 bg-[#333A47] hover:bg-[#3A4250] text-[#EAECEF] rounded-lg transition-colors text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-[#FCD535] hover:bg-[#E6C228] text-black rounded-lg transition-colors font-semibold text-sm"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Trader Confirmation Modal */}
        {showDeleteModal && selectedTrader && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur flex items-center justify-center z-50 p-4">
            <div className="bg-[#1F2937] border border-[#333A47] rounded-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-red-400 mb-2">Delete Trader</h2>
              <p className="text-[#EAECEF]/60 text-sm mb-4">
                Are you sure you want to delete this trader?
              </p>

              <div className="bg-[#181A20]/50 border border-[#333A47] rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3 mb-2">
                  {selectedTrader.profileImage && (
                    <img
                      src={selectedTrader.profileImage}
                      alt={selectedTrader.name}
                      className="w-12 h-12 rounded-full"
                    />
                  )}
                  <div>
                    <p className="font-semibold text-[#EAECEF]">{selectedTrader.name}</p>
                    <p className="text-xs text-[#EAECEF]/60">{selectedTrader.bio}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mt-3 pt-3 border-t border-[#333A47]">
                  <div>
                    <p className="text-[#EAECEF]/60">Followers</p>
                    <p className="font-semibold text-[#EAECEF]">{selectedTrader.totalFollowers || 0}</p>
                  </div>
                  <div>
                    <p className="text-[#EAECEF]/60">Win Rate</p>
                    <p className="font-semibold text-[#EAECEF]">{selectedTrader.winRate}%</p>
                  </div>
                </div>
              </div>

              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-400 font-semibold mb-1">⚠️ Warning</p>
                <p className="text-xs text-red-400/80">
                  This action cannot be undone. The trader will be permanently deleted from the database.
                  {selectedTrader.totalFollowers > 0 && (
                    <span className="block mt-2 font-semibold">
                      Note: This trader has {selectedTrader.totalFollowers} followers. Make sure all followers have unfollowed before deletion.
                    </span>
                  )}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedTrader(null);
                  }}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-[#333A47] hover:bg-[#3A4250] text-[#EAECEF] rounded-lg transition-colors text-sm font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteTrader}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <XCircle size={16} /> Delete Trader
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCopyTradingManager;
