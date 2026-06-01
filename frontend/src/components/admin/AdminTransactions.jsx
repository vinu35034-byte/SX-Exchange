import React, { useState, useEffect } from 'react';
import { 
  Download, 
  FileText, 
  Filter, 
  RefreshCw,
  Search,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  ExternalLink
} from 'lucide-react';
import { adminTheme, adminNetworkColors, adminStatusColors } from '../../styles/adminTheme';
import { showToast } from '../../utils/toast';
import { ApiUtils } from '../../services/api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const AdminTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    type: 'all', // all, deposit, withdrawal
    status: 'all', // all, approved, rejected, completed
    network: 'all',
    dateFrom: '',
    dateTo: '',
    search: ''
  });

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, transactions]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      // Fetch deposits
      const depositsResponse = await ApiUtils.get('/admin/deposits/all');
      
      // Fetch withdrawals  
      const withdrawalsResponse = await ApiUtils.get('/admin/withdrawals/all');

      let allTransactions = [];

      if (depositsResponse.deposits) {
        const deposits = depositsResponse.deposits.map(deposit => {
          // Try multiple possible field names for transaction hash
          const hash = deposit.txHash || deposit.transactionHash || deposit.hash || 'N/A';
        
          return {
            ...deposit,
            type: 'deposit',
            transactionType: 'Deposit',
            username: deposit.userId?.username || 'Unknown',
            email: deposit.userId?.email || 'Unknown',
            transactionHash: hash
          };
        });
        allTransactions = [...allTransactions, ...deposits];
      }

      if (withdrawalsResponse.withdrawals) {
        const withdrawals = withdrawalsResponse.withdrawals.map(withdrawal => {
          // Try multiple possible field names for transaction hash
          const hash = withdrawal.txHash || withdrawal.transactionHash || withdrawal.hash || 'N/A';
         
          return {
            ...withdrawal,
            type: 'withdrawal',
            transactionType: 'Withdrawal',
            username: withdrawal.userId?.username || 'Unknown',
            email: withdrawal.userId?.email || 'Unknown',
            network: withdrawal.network || 'N/A',
            transactionHash: hash
          };
        });
        allTransactions = [...allTransactions, ...withdrawals];
      }

      // Sort by date (newest first)
      allTransactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      setTransactions(allTransactions);
      
      // Calculate stats
      calculateStats(allTransactions);

    } catch (err) {
      console.error('Error fetching transactions:', err);
      showToast.error('Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (transactionList) => {
    const stats = {
      total: transactionList.length,
      deposits: {
        total: 0,
        approved: 0,
        rejected: 0,
        amount: 0
      },
      withdrawals: {
        total: 0,
        approved: 0,
        rejected: 0,
        completed: 0,
        amount: 0
      }
    };

    transactionList.forEach(transaction => {
      if (transaction.type === 'deposit') {
        stats.deposits.total++;
        if (transaction.status === 'approved' || transaction.status === 'credited') {
          stats.deposits.approved++;
          stats.deposits.amount += transaction.amount || 0;
        } else if (transaction.status === 'rejected') {
          stats.deposits.rejected++;
        }
      } else if (transaction.type === 'withdrawal') {
        stats.withdrawals.total++;
        if (transaction.status === 'approved') {
          stats.withdrawals.approved++;
        } else if (transaction.status === 'rejected') {
          stats.withdrawals.rejected++;
        } else if (transaction.status === 'completed') {
          stats.withdrawals.completed++;
          stats.withdrawals.amount += transaction.amount || 0;
        }
      }
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

    // Network filter
    if (filters.network !== 'all') {
      filtered = filtered.filter(t => t.network === filters.network);
    }

    // Date filters
    if (filters.dateFrom) {
      filtered = filtered.filter(t => new Date(t.createdAt) >= new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
      filtered = filtered.filter(t => new Date(t.createdAt) <= new Date(filters.dateTo));
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(t => 
        t.username?.toLowerCase().includes(searchLower) ||
        t.email?.toLowerCase().includes(searchLower) ||
        t.transactionHash?.toLowerCase().includes(searchLower) ||
        t._id?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredTransactions(filtered);
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(20);
      doc.text('Transaction Report', 14, 22);
      
      // Date range
      doc.setFontSize(12);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 35);
      
      if (filters.dateFrom || filters.dateTo) {
        const dateRange = `Date Range: ${filters.dateFrom || 'All'} to ${filters.dateTo || 'All'}`;
        doc.text(dateRange, 14, 45);
      }

      // Prepare data for table
      const tableData = filteredTransactions.map(transaction => [
        transaction.transactionType,
        transaction.username,
        `$${transaction.amount?.toFixed(2) || '0.00'}`,
        transaction.network || 'N/A',
        transaction.status,
        new Date(transaction.createdAt).toLocaleDateString(),
        transaction.transactionHash?.substring(0, 20) + '...' || 'N/A'
      ]);

      // Add table
      doc.autoTable({
        head: [['Type', 'User', 'Amount', 'Network', 'Status', 'Date', 'Hash']],
        body: tableData,
        startY: filters.dateFrom || filters.dateTo ? 55 : 45,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [100, 50, 150] }
      });

      // Save the PDF
      doc.save(`transactions_${new Date().toISOString().split('T')[0]}.pdf`);
      showToast.success('PDF exported successfully! 📄');
      
    } catch (error) {
      console.error('Error exporting PDF:', error);
      showToast.error('Failed to export PDF');
    }
  };

  const getStatusColor = (status) => {
    return adminStatusColors[status] || adminStatusColors.pending;
  };

  const getNetworkColor = (network) => {
    if (network === 'BSC' || network === 'BEP20') return adminNetworkColors.BSC;
    if (network === 'TRC20') return adminNetworkColors.TRC20;
    if (network === 'ETH') return adminNetworkColors.ETH;
    return adminStatusColors.pending;
  };

  const formatAddress = (address) => {
    if (!address || address === 'N/A') return 'N/A';
    return `${address.substring(0, 8)}...${address.substring(address.length - 8)}`;
  };

  return (
    <div className={`min-h-screen ${adminTheme.primary} p-6`}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 ${adminTheme.shadow}`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className={`text-3xl font-bold ${adminTheme.textPrimary} mb-2`}>
                Transaction History
              </h1>
              <p className={`${adminTheme.textSecondary}`}>
                Complete record of all deposits and withdrawals
              </p>
            </div>
            
            {/* Export Buttons */}
            <div className="flex items-center space-x-3">
              <button
                onClick={exportToPDF}
                className={`flex items-center space-x-2 px-4 py-2 ${adminTheme.buttonDanger} rounded-xl text-sm transition-all duration-200 hover:scale-105`}
              >
                <FileText className="w-4 h-4" />
                <span>Export PDF</span>
              </button>
              <button
                onClick={fetchTransactions}
                className={`flex items-center space-x-2 px-4 py-2 ${adminTheme.buttonSecondary} rounded-xl text-sm transition-all duration-200 hover:scale-105`}
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className={`${adminTheme.surface} border ${adminTheme.border} rounded-xl p-4`}>
                <div className="flex items-center space-x-3">
                  <div className={`p-2 ${adminTheme.infoBg} rounded-lg border`}>
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={`text-sm ${adminTheme.textSecondary}`}>Total Transactions</p>
                    <p className={`text-lg font-bold ${adminTheme.textPrimary}`}>{stats.total}</p>
                  </div>
                </div>
              </div>
              
              <div className={`${adminTheme.surface} border ${adminTheme.border} rounded-xl p-4`}>
                <div className="flex items-center space-x-3">
                  <div className={`p-2 ${adminTheme.successBg} rounded-lg border`}>
                    <TrendingDown className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={`text-sm ${adminTheme.textSecondary}`}>Deposits</p>
                    <p className={`text-lg font-bold ${adminTheme.textPrimary}`}>
                      {stats.deposits.approved}/{stats.deposits.total}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className={`${adminTheme.surface} border ${adminTheme.border} rounded-xl p-4`}>
                <div className="flex items-center space-x-3">
                  <div className={`p-2 ${adminTheme.warningBg} rounded-lg border`}>
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={`text-sm ${adminTheme.textSecondary}`}>Withdrawals</p>
                    <p className={`text-lg font-bold ${adminTheme.textPrimary}`}>
                      {stats.withdrawals.completed}/{stats.withdrawals.total}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className={`${adminTheme.surface} border ${adminTheme.border} rounded-xl p-4`}>
                <div className="flex items-center space-x-3">
                  <div className={`p-2 ${adminTheme.successBg} rounded-lg border`}>
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={`text-sm ${adminTheme.textSecondary}`}>Total Volume</p>
                    <p className={`text-lg font-bold ${adminTheme.textPrimary}`}>
                      ${(stats.deposits.amount + stats.withdrawals.amount).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                Type
              </label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({...filters, type: e.target.value})}
                className={`w-full p-2 ${adminTheme.select} rounded-lg text-sm`}
              >
                <option value="all">All Types</option>
                <option value="deposit">Deposits</option>
                <option value="withdrawal">Withdrawals</option>
              </select>
            </div>
            
            <div>
              <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className={`w-full p-2 ${adminTheme.select} rounded-lg text-sm`}
              >
                <option value="all">All Status</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            
            <div>
              <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                Network
              </label>
              <select
                value={filters.network}
                onChange={(e) => setFilters({...filters, network: e.target.value})}
                className={`w-full p-2 ${adminTheme.select} rounded-lg text-sm`}
              >
                <option value="all">All Networks</option>
                <option value="BSC">BSC (BEP-20)</option>
                <option value="TRC20">TRC-20</option>
                <option value="ETH">Ethereum</option>
              </select>
            </div>
            
            <div>
              <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                From Date
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                className={`w-full p-2 ${adminTheme.input} rounded-lg text-sm`}
              />
            </div>
            
            <div>
              <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                To Date
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                className={`w-full p-2 ${adminTheme.input} rounded-lg text-sm`}
              />
            </div>
            
            <div>
              <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                Search
              </label>
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${adminTheme.textMuted}`} />
                <input
                  type="text"
                  placeholder="User, hash, ID..."
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                  className={`w-full pl-10 p-2 ${adminTheme.input} rounded-lg text-sm`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl overflow-hidden ${adminTheme.shadow}`}>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className={`w-6 h-6 ${adminTheme.textSecondary} animate-spin`} />
              <span className={`ml-2 ${adminTheme.textSecondary}`}>Loading transactions...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={adminTheme.tableHeader}>
                  <tr>
                    <th className="py-4 px-4 text-left">Type</th>
                    <th className="py-4 px-4 text-left">User</th>
                    <th className="py-4 px-4 text-left">Amount</th>
                    <th className="py-4 px-4 text-left">Network</th>
                    <th className="py-4 px-4 text-left">Status</th>
                    <th className="py-4 px-4 text-left">Date</th>
                    <th className="py-4 px-4 text-left">Transaction Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction._id} className={adminTheme.tableRow}>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          {transaction.type === 'deposit' ? (
                            <ArrowDown className="w-4 h-4 text-green-400" />
                          ) : (
                            <ArrowUp className="w-4 h-4 text-red-400" />
                          )}
                          <span className={`text-sm font-medium ${adminTheme.textPrimary} capitalize`}>
                            {transaction.transactionType}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <p className={`text-sm font-medium ${adminTheme.textPrimary}`}>
                            {transaction.username}
                          </p>
                          <p className={`text-xs ${adminTheme.textMuted}`}>
                            {transaction.email}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`text-sm font-semibold ${adminTheme.textPrimary}`}>
                          ${transaction.amount?.toFixed(2) || '0.00'} USDT
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-lg text-xs font-semibold border ${getNetworkColor(transaction.network)}`}>
                          {transaction.network || 'N/A'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-lg text-xs font-semibold border ${getStatusColor(transaction.status)}`}>
                          {transaction.status}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <p className={`text-sm ${adminTheme.textPrimary}`}>
                            {new Date(transaction.createdAt).toLocaleDateString()}
                          </p>
                          <p className={`text-xs ${adminTheme.textMuted}`}>
                            {new Date(transaction.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {transaction.transactionHash && transaction.transactionHash !== 'N/A' ? (
                          <a
                            href={`${import.meta.env.VITE_BSC_EXPLORER || 'https://bscscan.com'}/tx/${transaction.transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${adminTheme.textAccent} hover:text-[#E6C228] flex items-center space-x-1 transition-colors`}
                          >
                            <span className="font-mono text-xs">{formatAddress(transaction.transactionHash)}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className={`text-xs ${adminTheme.textMuted}`}>N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredTransactions.length === 0 && (
                <div className="text-center py-8">
                  <p className={`${adminTheme.textSecondary}`}>No transactions found matching your filters.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminTransactions;
