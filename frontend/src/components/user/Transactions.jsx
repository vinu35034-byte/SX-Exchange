import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserAuth } from '../../contexts/UserAuthContext';
import {
  ArrowLeft,
  Clock,
  RefreshCw,
  TrendingUp,
  Gift,
  Users,
  Award,
  Plus,
  Minus,
  CheckCircle,
  XCircle,
  Eye,
  Search,
} from 'lucide-react';
import { ApiUtils } from '../../services/api';
import showToast from '../../utils/toast';
import Menu from '../Menu';
import Spinner from '../common/Spinner';

const Transactions = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useUserAuth();

  const [transactions, setTransactions] = useState([]);
  const [rewardHistory, setRewardHistory] = useState([]);
  const [copyTradingTransactions, setCopyTradingTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const filterOptions = [
    { value: 'all',          label: 'All' },
    { value: 'copy_trading', label: 'Copy Trading' },
    { value: 'deposits',     label: 'Deposits' },
    { value: 'withdrawals',  label: 'Sends' },
    { value: 'rewards',      label: 'Rewards' },
    { value: 'referral',     label: 'Referral' },
    { value: 'vip',          label: 'VIP' },
    { value: 'trading',      label: 'Trading' },
  ];

  /* ─── Data fetching ─── */
  const fetchCopyTradingTransactions = async () => {
    try {
      const response = await ApiUtils.get('/copy-trading/my-transactions-history?limit=100');
      const txs = response.data || [];
      const groups = {};
      const nonTradeTxs = [];

      txs.forEach(tx => {
        if (tx.type === 'trade' && tx.trade?.coin?.symbol && tx.trade?.tradeType) {
          const key = `${tx.trader?._id || 'unknown'}_${tx.trade.coin.symbol}`;
          if (!groups[key]) groups[key] = { buy: [], sell: [], date: new Date(tx.createdAt) };
          if (tx.trade.tradeType === 'BUY') groups[key].buy.push(tx);
          else if (tx.trade.tradeType === 'SELL') groups[key].sell.push(tx);
          const d = new Date(tx.createdAt);
          if (d < groups[key].date) groups[key].date = d;
        } else {
          nonTradeTxs.push(tx);
        }
      });

      const sorted = [];
      Object.values(groups).forEach(g => {
        g.buy.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        g.sell.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        sorted.push(...g.sell, ...g.buy);
      });

      const all = [...sorted, ...nonTradeTxs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setCopyTradingTransactions(all);
    } catch (e) {
      console.error('Error fetching copy trading transactions:', e);
    }
  };

  const fetchRewardHistory = async () => {
    try {
      const response = await ApiUtils.get('/rewards/reward-history?limit=50');
      setRewardHistory(response.rewards || []);
    } catch (e) {
      console.error('Error fetching reward history:', e);
    }
  };

  const fetchTransactions = async (pageNum = 1) => {
    try {
      const response = await ApiUtils.get(`/user/transactions?page=${pageNum}&limit=20`);
      const txs = response.transactions || [];
      if (pageNum === 1) setTransactions(txs);
      else setTransactions(prev => [...prev, ...txs]);
      setHasMore(txs.length === 20);
    } catch (e) {
      console.error('Error fetching transactions:', e);
      if (pageNum === 1) setTransactions([]);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchCopyTradingTransactions(), fetchRewardHistory(), fetchTransactions(1)]);
      setPage(1);
    } catch (e) {
      showToast.error('Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  };

  const loadMore = async () => {
    if (!hasMore || loading) return;
    const next = page + 1;
    await fetchTransactions(next);
    setPage(next);
  };

  useEffect(() => {
    if (!isAuthenticated()) { navigate('/signin'); return; }
    setLoading(true);
    Promise.all([fetchCopyTradingTransactions(), fetchRewardHistory(), fetchTransactions(1)])
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  /* ─── Build combined list ─── */
  const getCombined = () => {
    const combined = [];

    copyTradingTransactions.forEach(tx => {
      let title = 'Copy Trading';
      let isPositive = false;
      if (tx.type === 'follow') { title = 'Follow Trader'; isPositive = false; }
      else if (tx.type === 'unfollow') { title = 'Unfollow Trader'; isPositive = true; }
      else if (tx.type === 'trade') {
        if (tx.trade?.tradeType === 'BUY') { title = `Buy ${tx.trade.coin?.symbol || ''}`; isPositive = false; }
        else if (tx.trade?.tradeType === 'SELL') { title = `Sell ${tx.trade.coin?.symbol || ''}`; isPositive = true; }
      } else if (tx.type === 'passive_income' || tx.type === 'admin_distribution') {
        title = 'Copy Trading Income'; isPositive = true;
      }
      combined.push({
        id: tx._id, type: 'copy_trading', title,
        amount: tx.displayAmount || tx.amount,
        displaySign: tx.displaySign, currency: 'USDT',
        status: tx.status || 'completed', date: tx.createdAt,
        icon: Users, category: 'copy_trading', isPositive,
        tradeData: tx.trade, traderName: tx.trader?.name,
      });
    });

    rewardHistory.forEach(r => {
      combined.push({
        id: r._id, type: 'vip_reward',
        title: r.rewardType === 'daily' ? 'Daily VIP Reward' : 'VIP Upgrade Reward',
        amount: r.amount, currency: r.currency,
        status: r.status, date: r.createdAt,
        icon: Gift, category: 'vip', isPositive: true,
      });
    });

    transactions.forEach(tx => {
      let title = tx.type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Transaction';
      let icon = Clock;
      let category = 'general';
      let isPositive = true;

      if (tx.type === 'referral_reward') { title = 'Referral Reward'; icon = Users; category = 'referral'; }
      else if (tx.type === 'trading_bonus') { title = 'Trading Bonus'; icon = TrendingUp; category = 'trading'; }
      else if (tx.type === 'deposit') { title = 'Deposit'; icon = Plus; category = 'deposits'; }
      else if (tx.type === 'withdrawal') { title = 'Send'; icon = Minus; category = 'withdrawals'; isPositive = false; }
      else if (tx.type === 'trade_buy') { title = `Buy ${tx.symbol || ''}`; icon = TrendingUp; category = 'trading'; isPositive = false; }
      else if (tx.type === 'trade_sell') { title = `Sell ${tx.symbol || ''}`; icon = TrendingUp; category = 'trading'; }

      combined.push({
        id: tx._id || tx.transactionId, type: tx.type, title,
        amount: tx.amount, currency: tx.currency || 'USDT',
        status: tx.status || 'completed', date: tx.createdAt || tx.date,
        icon, category, isPositive,
      });
    });

    return combined.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const getFiltered = () => {
    let list = getCombined();
    if (selectedFilter !== 'all') {
      if (selectedFilter === 'rewards') {
        list = list.filter(tx => ['vip', 'referral', 'trading'].includes(tx.category));
      } else {
        list = list.filter(tx => tx.category === selectedFilter || tx.type === selectedFilter);
      }
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(tx => tx.title.toLowerCase().includes(q) || tx.currency.toLowerCase().includes(q));
    }
    return list;
  };

  /* ─── Helpers ─── */
  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const formatTime = (d) =>
    new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const getStatusConfig = (status) => {
    const map = {
      completed: { color: 'text-green-500 bg-green-500/10', icon: <CheckCircle className="w-3 h-3" />, label: 'Completed' },
      claimed:   { color: 'text-green-500 bg-green-500/10', icon: <CheckCircle className="w-3 h-3" />, label: 'Claimed' },
      pending:   { color: 'text-[#0052FF] bg-[#0052FF]/10', icon: <Clock className="w-3 h-3" />,       label: 'Pending' },
      processing:{ color: 'text-blue-500 bg-blue-500/10',   icon: <Eye className="w-3 h-3" />,          label: 'Processing' },
      failed:    { color: 'text-red-500 bg-red-500/10',     icon: <XCircle className="w-3 h-3" />,      label: 'Failed' },
      expired:   { color: 'text-red-500 bg-red-500/10',     icon: <XCircle className="w-3 h-3" />,      label: 'Expired' },
    };
    return map[status] || { color: 'text-[#888888] bg-[#F4F4F4]', icon: <Clock className="w-3 h-3" />, label: status };
  };

  const getTypeIcon = (tx) => {
    if (tx.category === 'deposits')     return <Plus className="w-4 h-4 text-green-500" />;
    if (tx.category === 'withdrawals')  return <Minus className="w-4 h-4 text-red-400" />;
    if (tx.category === 'vip')          return <Award className="w-4 h-4 text-[#0052FF]" />;
    if (tx.category === 'referral')     return <Users className="w-4 h-4 text-[#0052FF]" />;
    if (tx.category === 'trading')      return <TrendingUp className="w-4 h-4 text-[#0052FF]" />;
    if (tx.category === 'copy_trading') return <Users className="w-4 h-4 text-[#0052FF]" />;
    return <Gift className="w-4 h-4 text-[#0052FF]" />;
  };

  const filtered = getFiltered();

  if (!isAuthenticated()) return null;

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full max-w-md mx-auto px-4 py-6 pb-24">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 text-[#555555] hover:text-[#0052FF] rounded-lg hover:bg-[#F0F5FF] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-[#111111]">Transactions</h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-[#888888] hover:text-[#0052FF] rounded-lg hover:bg-[#F0F5FF] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AAAAAA]" />
          <input
            type="text"
            placeholder="Search transactions…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-[#F6F6F6] rounded-xl text-sm text-[#111111] placeholder-[#AAAAAA] focus:outline-none"
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
          {filterOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSelectedFilter(opt.value)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                selectedFilter === opt.value
                  ? 'bg-[#0052FF] text-white'
                  : 'bg-[#F0F5FF] text-[#0052FF]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#F0F5FF] flex items-center justify-center">
              <Clock className="w-8 h-8 text-[#0052FF]" />
            </div>
            <p className="text-[#111111] font-semibold mb-1">No transactions yet</p>
            <p className="text-[#888888] text-sm">Your transaction history will appear here</p>
          </div>
        ) : (
          <div className="space-y-0">
            {filtered.map((tx, i) => {
              const sc = getStatusConfig(tx.status);
              return (
                <div
                  key={`${tx.id}-${i}`}
                  className="flex items-center justify-between py-4 border-b border-[#F0F0F0] last:border-0"
                >
                  {/* Left */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
                      {getTypeIcon(tx)}
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-sm font-semibold text-[#111111] truncate">{tx.title}</span>
                      <span className="text-xs text-[#AAAAAA]">
                        {formatDate(tx.date)} · {formatTime(tx.date)}
                      </span>
                      {/* Trade P/L detail */}
                      {tx.tradeData?.profitLossAmount !== undefined && tx.tradeData.profitLossAmount !== 0 && (
                        <span className={`text-xs ${tx.tradeData.profitLossAmount >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                          P/L {tx.tradeData.profitLossAmount >= 0 ? '+' : ''}${tx.tradeData.profitLossAmount.toFixed(2)}
                          {tx.tradeData.profitLossPercentage !== undefined && (
                            <> ({tx.tradeData.profitLossPercentage >= 0 ? '+' : ''}{tx.tradeData.profitLossPercentage}%)</>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right */}
                  <div className="text-right ml-3 shrink-0">
                    <p className={`text-base font-bold ${tx.isPositive ? 'text-green-500' : 'text-[#111111]'}`}>
                      {tx.category === 'copy_trading' && tx.displaySign
                        ? `${tx.displaySign}${Math.abs(tx.amount).toLocaleString()}`
                        : `${tx.isPositive ? '+' : '-'}${Math.abs(tx.amount).toLocaleString()}`
                      }
                      <span className="text-xs font-medium text-[#888888] ml-1">{tx.currency}</span>
                    </p>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-md mt-1 ${sc.color}`}>
                      {sc.icon}
                      {sc.label}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Load more */}
            {hasMore && (
              <button
                onClick={loadMore}
                className="w-full py-4 text-sm text-[#0052FF] font-semibold text-center"
              >
                Load more
              </button>
            )}
          </div>
        )}
      </div>

      <Menu />
    </div>
  );
};

export default Transactions;
