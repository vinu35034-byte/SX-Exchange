import React, { useState, useEffect } from 'react';
import { 
  User, 
  Users, 
  Search, 
  Filter, 
  RefreshCw,
  Download,
  FileText,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Eye,
  Copy,
  Check
} from 'lucide-react';
import { ApiUtils } from '../../services/api';
import { adminTheme } from '../../styles/adminTheme';

const AdminAllTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    type: 'all',
    status: 'all',
    currency: 'all',
    direction: 'all',
    dateFrom: '',
    dateTo: ''
  });
  const [copiedId, setCopiedId] = useState('');

  useEffect(() => {
    fetchTransactions();
  }, [currentPage]);

  // Debounce search term to prevent API call on every keystroke
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchTransactions();
    }, 500);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  useEffect(() => {
    applyFilters();
  }, [filters, transactions]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      // Fetch from unified Transaction model API
      const data = await ApiUtils.get(`/admin/transactions?page=${currentPage}&limit=20&search=${searchTerm}`);
      setTransactions(data.transactions || []);
      setTotalPages(data.pagination?.pages || 1);
      
      // Calculate stats
      calculateStats(data.transactions || []);
      setError('');
    } catch (err) {
      setError(err.message);
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (transactionList) => {
    const stats = {
      total: transactionList.length,
      totalVolume: 0,
      deposits: {
        count: 0,
        volume: 0
      },
      withdrawals: {
        count: 0,
        volume: 0
      },
      referralRewards: {
        count: 0,
        volume: 0
      },
      tradingBonuses: {
        count: 0,
        volume: 0
      },
      byStatus: {
        pending: 0,
        completed: 0,
        failed: 0,
        cancelled: 0
      }
    };

    transactionList.forEach(transaction => {
      const amount = parseFloat(transaction.amount) || 0;
      stats.totalVolume += amount;
      
      // Count by type
      if (transaction.type === 'deposit') {
        stats.deposits.count++;
        stats.deposits.volume += amount;
      } else if (transaction.type === 'withdrawal') {
        stats.withdrawals.count++;
        stats.withdrawals.volume += amount;
      } else if (transaction.type === 'referral_reward') {
        stats.referralRewards.count++;
        stats.referralRewards.volume += amount;
      } else if (transaction.type === 'trading_bonus') {
        stats.tradingBonuses.count++;
        stats.tradingBonuses.volume += amount;
      }

      // Count by status
      stats.byStatus[transaction.status] = (stats.byStatus[transaction.status] || 0) + 1;
    });

    setStats(stats);
  };

  const applyFilters = () => {
    let filtered = [...transactions];

    // Type filter
    if (filters.type !== 'all') {
      filtered = filtered.filter(t => t.type === filters.type);
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(t => t.status === filters.status);
    }

    // Currency filter
    if (filters.currency !== 'all') {
      filtered = filtered.filter(t => t.currency === filters.currency);
    }

    // Direction filter
    if (filters.direction !== 'all') {
      filtered = filtered.filter(t => t.direction === filters.direction);
    }

    // Date filters
    if (filters.dateFrom) {
      filtered = filtered.filter(t => new Date(t.createdAt) >= new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
      filtered = filtered.filter(t => new Date(t.createdAt) <= new Date(filters.dateTo));
    }

    setFilteredTransactions(filtered);
  };

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(type);
      setTimeout(() => setCopiedId(''), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'deposit':
        return <ArrowDown className="w-4 h-4 text-emerald-400" />;
      case 'withdrawal':
        return <ArrowUp className="w-4 h-4 text-red-400" />;
      case 'referral_reward':
        return <Users className="w-4 h-4 text-blue-500" />;
      case 'trading_bonus':
        return <TrendingUp className="w-4 h-4 text-[#FCD535]" />;
      default:
        return <DollarSign className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      failed: 'bg-red-500/10 text-red-400 border-red-500/20',
      cancelled: 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded border ${statusStyles[status] || statusStyles.pending}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getDirectionBadge = (direction) => {
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded border ${
        direction === 'credit' 
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
          : 'bg-red-500/10 text-red-400 border-red-500/20'
      }`}>
        {direction === 'credit' ? 'Credit' : 'Debit'}
      </span>
    );
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
                <DollarSign className="w-8 h-8 text-[#FCD535]" />
              </div>
              <div>
                <h1 className={`text-3xl font-bold ${adminTheme.textPrimary}`}>All Transactions</h1>
                <p className={`${adminTheme.textSecondary} mt-1`}>Unified transaction history from the enhanced Transaction model with transactionId</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchTransactions}
                className={`flex items-center space-x-2 px-4 py-2 ${adminTheme.buttonSecondary} rounded-xl text-sm transition-all duration-200 hover:scale-105`}
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-4 ${adminTheme.shadow}`}>
            <div className="flex items-center">
              <div className={`p-3 ${adminTheme.accent} rounded-xl ${adminTheme.shadow}`}>
                <DollarSign className="w-6 h-6 text-[#FCD535]" />
              </div>
              <div className="ml-4">
                <div className={`text-2xl font-bold ${adminTheme.textPrimary}`}>
                  {stats.total || 0}
                </div>
                <div className={`text-sm ${adminTheme.textSecondary}`}>Total Transactions</div>
              </div>
            </div>
          </div>

          <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-4 ${adminTheme.shadow}`}>
            <div className="flex items-center">
              <div className={`p-3 ${adminTheme.accent} rounded-xl ${adminTheme.shadow}`}>
                <ArrowDown className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="ml-4">
                <div className={`text-2xl font-bold text-emerald-400`}>
                  {stats.deposits?.count || 0}
                </div>
                <div className={`text-sm ${adminTheme.textSecondary}`}>Deposits</div>
              </div>
            </div>
          </div>

          <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-4 ${adminTheme.shadow}`}>
            <div className="flex items-center">
              <div className={`p-3 ${adminTheme.accent} rounded-xl ${adminTheme.shadow}`}>
                <ArrowUp className="w-6 h-6 text-red-400" />
              </div>
              <div className="ml-4">
                <div className={`text-2xl font-bold text-red-400`}>
                  {stats.withdrawals?.count || 0}
                </div>
                <div className={`text-sm ${adminTheme.textSecondary}`}>Withdrawals</div>
              </div>
            </div>
          </div>

          <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-4 ${adminTheme.shadow}`}>
            <div className="flex items-center">
              <div className={`p-3 ${adminTheme.accent} rounded-xl ${adminTheme.shadow}`}>
                <TrendingUp className="w-6 h-6 text-blue-500" />
              </div>
              <div className="ml-4">
                <div className={`text-2xl font-bold text-blue-500`}>
                  ${stats.totalVolume?.toFixed(2) || '0.00'}
                </div>
                <div className={`text-sm ${adminTheme.textSecondary}`}>Total Volume</div>
              </div>
            </div>
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
              <XCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm font-medium text-red-400">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 ${adminTheme.shadow}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                Search
              </label>
              <div className="relative">
                <Search className={`absolute left-3 top-3 h-4 w-4 ${adminTheme.textSecondary}`} />
                <input
                  type="text"
                  placeholder="Search by transaction ID, user, hash..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className={`w-full pl-10 pr-4 py-2 ${adminTheme.surface} ${adminTheme.border} rounded-lg focus:ring-2 focus:ring-[#FCD535] focus:border-transparent ${adminTheme.textPrimary}`}
                />
              </div>
            </div>

            {/* Type Filter */}
            <div>
              <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                Type
              </label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({...filters, type: e.target.value})}
                className={`w-full p-2 ${adminTheme.surface} ${adminTheme.border} rounded-lg focus:ring-2 focus:ring-[#FCD535] focus:border-transparent ${adminTheme.textPrimary}`}
              >
                <option value="all">All Types</option>
                <option value="deposit">Deposits</option>
                <option value="withdrawal">Withdrawals</option>
                <option value="referral_reward">Referral Rewards</option>
                <option value="trading_bonus">Trading Bonuses</option>
                <option value="vip_reward">VIP Rewards</option>
                <option value="trade_buy">Token Purchases</option>
                <option value="trade_sell">Token Sales</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className={`w-full p-2 ${adminTheme.surface} ${adminTheme.border} rounded-lg focus:ring-2 focus:ring-[#FCD535] focus:border-transparent ${adminTheme.textPrimary}`}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Direction Filter */}
            <div>
              <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                Direction
              </label>
              <select
                value={filters.direction}
                onChange={(e) => setFilters({...filters, direction: e.target.value})}
                className={`w-full p-2 ${adminTheme.surface} ${adminTheme.border} rounded-lg focus:ring-2 focus:ring-[#FCD535] focus:border-transparent ${adminTheme.textPrimary}`}
              >
                <option value="all">All</option>
                <option value="credit">Credit</option>
                <option value="debit">Debit</option>
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                From Date
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                className={`w-full p-2 ${adminTheme.surface} ${adminTheme.border} rounded-lg focus:ring-2 focus:ring-[#FCD535] focus:border-transparent ${adminTheme.textPrimary}`}
              />
            </div>

            {/* Date To */}
            <div>
              <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                To Date
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                className={`w-full p-2 ${adminTheme.surface} ${adminTheme.border} rounded-lg focus:ring-2 focus:ring-[#FCD535] focus:border-transparent ${adminTheme.textPrimary}`}
              />
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl ${adminTheme.shadow} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className={`min-w-full divide-y ${adminTheme.border}`}>
              <thead className={`${adminTheme.surface}`}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${adminTheme.textSecondary} uppercase tracking-wider`}>
                    Transaction
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${adminTheme.textSecondary} uppercase tracking-wider`}>
                    User
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${adminTheme.textSecondary} uppercase tracking-wider`}>
                    Type
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${adminTheme.textSecondary} uppercase tracking-wider`}>
                    Amount
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${adminTheme.textSecondary} uppercase tracking-wider`}>
                    Direction
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${adminTheme.textSecondary} uppercase tracking-wider`}>
                    Status
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${adminTheme.textSecondary} uppercase tracking-wider`}>
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className={`${adminTheme.card} divide-y ${adminTheme.border}`}>
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction._id} className={`${adminTheme.hover} transition-colors`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm font-medium ${adminTheme.textPrimary}`}>
                            {transaction.transactionId || transaction._id.slice(-8)}
                          </span>
                          <button
                            onClick={() => copyToClipboard(transaction.transactionId || transaction._id, `txn-${transaction._id}`)}
                            className={`p-1 ${adminTheme.textSecondary} hover:text-[#FCD535] transition-colors`}
                          >
                            {copiedId === `txn-${transaction._id}` ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                        {transaction.subType && (
                          <div className={`text-xs ${adminTheme.textSecondary}`}>
                            {transaction.subType.replace('_', ' ')}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="shrink-0 h-8 w-8">
                          <div className="h-8 w-8 rounded-full bg-[#FCD535]/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-[#FCD535]" />
                          </div>
                        </div>
                        <div className="ml-3">
                          <div className={`text-sm font-medium ${adminTheme.textPrimary}`}>
                            {transaction.user?.username || 'Unknown'}
                          </div>
                          <div className={`text-xs ${adminTheme.textSecondary}`}>
                            {transaction.user?.email || ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {getTypeIcon(transaction.type)}
                        <span className={`text-sm font-medium ${adminTheme.textPrimary} capitalize`}>
                          {transaction.type.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${
                        transaction.direction === 'credit' ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {transaction.direction === 'credit' ? '+' : '-'}${transaction.amount} {transaction.currency}
                      </div>
                      {transaction.fee > 0 && (
                        <div className={`text-xs ${adminTheme.textSecondary}`}>
                          Fee: ${transaction.fee}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getDirectionBadge(transaction.direction)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(transaction.status)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${adminTheme.textSecondary}`}>
                      {formatDate(transaction.executedAt || transaction.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredTransactions.length === 0 && (
            <div className="text-center py-8">
              <p className={`${adminTheme.textSecondary}`}>No transactions found matching your criteria.</p>
            </div>
          )}
        </div>

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
      </div>
    </div>
  );
};

export default AdminAllTransactions;
