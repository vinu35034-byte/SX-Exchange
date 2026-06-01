import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTrading } from '../../contexts/TradingContext';
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, RotateCcw, Play, ChevronUp } from 'lucide-react';
import { getCryptoLogoUrl } from '../../utils/logoService';
import { showToast } from '../../utils/toast';
import { demoTrading, ApiUtils } from '../../services/api';
import CandlestickChart from '../charts/CandlestickChart';
import Menu from '../Menu';

const DEMO_INITIAL_BALANCE = 100000;

const DemoTrade = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useUserAuth();
  const { isDarkMode } = useTheme();
  const { prices, tickers, currentPair, setCurrentPair } = useTrading();

  // ─── State ───────────────────────────────────────────────────────────────
  const [demoAccount, setDemoAccount] = useState(null);
  const [demoBalances, setDemoBalances] = useState({});
  const [demoStats, setDemoStats] = useState(null);
  const [demoOrders, setDemoOrders] = useState([]);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [orderSide, setOrderSide] = useState('buy');
  const [orderAmount, setOrderAmount] = useState('');
  const [amountInputType, setAmountInputType] = useState('usdt'); // 'token' or 'usdt'
  const [orderPercentage, setOrderPercentage] = useState(0);

  const [availableTokens, setAvailableTokens] = useState([]);
  const [specialTokens, setSpecialTokens] = useState([]);
  const [tokensLoaded, setTokensLoaded] = useState(false);

  const [selectedTimeframe, setSelectedTimeframe] = useState('1m');
  const [showChart, setShowChart] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState('trade');

  // Simulated real-time price
  const [simulatedPrice, setSimulatedPrice] = useState(null);

  // ─── Initialize pair from URL params ─────────────────────────────────────
  useEffect(() => {
    const pairParam = searchParams.get('pair');
    if (pairParam) {
      setCurrentPair(pairParam);
    } else if (!currentPair) {
      setCurrentPair('BTC/USDT');
    }
  }, [searchParams]);

  // ─── Fetch demo account ─────────────────────────────────────────────────
  const fetchDemoAccount = useCallback(async () => {
    try {
      const res = await demoTrading.getAccount();
      if (res.success) {
        setDemoAccount(res.data);
        setDemoBalances(res.data.balances || {});
      }
    } catch (err) {
      console.error('Failed to load demo account:', err);
    } finally {
      setLoadingAccount(false);
    }
  }, []);

  const fetchDemoStats = useCallback(async () => {
    try {
      const res = await demoTrading.getStats();
      if (res.success) {
        setDemoStats(res.data);
      }
    } catch (err) {
      console.error('Failed to load demo stats:', err);
    }
  }, []);

  const fetchDemoOrders = useCallback(async () => {
    try {
      const res = await demoTrading.getTrades({ limit: 20 });
      if (res.success) {
        setDemoOrders(res.data.trades || []);
      }
    } catch (err) {
      console.error('Failed to load demo orders:', err);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchDemoAccount();
      fetchDemoStats();
      fetchDemoOrders();
    }
  }, [user]);

  // ─── Fetch available tokens ──────────────────────────────────────────────
  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const [markRes, specialRes] = await Promise.all([
          ApiUtils.get('/market/tickers'),
          ApiUtils.get('/market/special-tokens')
        ]);

        const marketTokens = [];
        if (markRes.success && markRes.data) {
          const list = Array.isArray(markRes.data) ? markRes.data : markRes.data.data || [];
          list.forEach(t => {
            if (t.pair || t.symbol) {
              marketTokens.push({
                pair: t.pair || `${t.symbol}/USDT`,
                symbol: t.symbol || t.pair?.split('/')[0],
                price: t.lastPrice || t.price || 0,
                change24h: t.change24h || 0,
                isSpecial: false
              });
            }
          });
        }

        const sTokens = [];
        if (specialRes.success && specialRes.data) {
          const list = Array.isArray(specialRes.data) ? specialRes.data : specialRes.data.tokens || [];
          list.forEach(t => {
            sTokens.push(t);
            marketTokens.push({
              pair: `${t.symbol}/USDT`,
              symbol: t.symbol,
              price: t.currentPrice || 0,
              change24h: 0,
              isSpecial: true,
              logoUrl: t.logoUrl
            });
          });
        }

        setAvailableTokens(marketTokens);
        setSpecialTokens(sTokens);
        setTokensLoaded(true);
      } catch (err) {
        console.error('Error fetching tokens:', err);
        setTokensLoaded(true);
      }
    };
    fetchTokens();
  }, []);

  // ─── Real-time price simulation ──────────────────────────────────────────
  const basePairPrice = useMemo(() => {
    if (!currentPair) return 0;
    const base = currentPair.split('/')[0];
    const special = specialTokens.find(t => t.symbol === base);
    if (special?.currentPrice) return special.currentPrice;
    if (prices[currentPair]) return prices[currentPair];
    const token = availableTokens.find(t => t.pair === currentPair);
    return token?.price || 0;
  }, [currentPair, specialTokens, prices, availableTokens]);

  useEffect(() => {
    if (!basePairPrice || basePairPrice === 0) return;
    const interval = setInterval(() => {
      const fluctuation = (Math.random() - 0.5) * 0.002;
      setSimulatedPrice(basePairPrice * (1 + fluctuation));
    }, 1000);
    return () => clearInterval(interval);
  }, [basePairPrice]);

  const currentPairPrice = simulatedPrice && simulatedPrice > 0 ? simulatedPrice : basePairPrice;

  // ─── Balance helpers ─────────────────────────────────────────────────────
  const getAvailableBalance = useCallback((currency) => {
    const b = demoBalances[currency];
    return b ? (b.available || b.total || 0) : 0;
  }, [demoBalances]);

  const getTokenAmount = useCallback(() => {
    if (!orderAmount || !currentPairPrice || currentPairPrice === 0) return 0;
    const val = parseFloat(orderAmount);
    if (isNaN(val)) return 0;
    return amountInputType === 'usdt' ? val / currentPairPrice : val;
  }, [orderAmount, currentPairPrice, amountInputType]);

  const getUSDTValue = useCallback(() => {
    if (!orderAmount || !currentPairPrice) return 0;
    const val = parseFloat(orderAmount);
    if (isNaN(val)) return 0;
    return amountInputType === 'usdt' ? val : val * currentPairPrice;
  }, [orderAmount, currentPairPrice, amountInputType]);

  const getMaxTradeAmount = useCallback(() => {
    if (!currentPair) return 0;
    const [baseCurrency, quoteCurrency] = currentPair.split('/');
    if (orderSide === 'buy') {
      const usdtBal = getAvailableBalance(quoteCurrency);
      return amountInputType === 'usdt' ? usdtBal : (currentPairPrice > 0 ? usdtBal / currentPairPrice : 0);
    }
    return getAvailableBalance(baseCurrency);
  }, [currentPair, orderSide, amountInputType, getAvailableBalance, currentPairPrice]);

  // ─── Place demo order ────────────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (!user) { navigate('/signin'); return; }
    if (!orderAmount || parseFloat(orderAmount) <= 0) {
      showToast.warning(t('trade.invalidAmount'));
      return;
    }

    const tokenAmount = getTokenAmount();
    const usdtValue = getUSDTValue();
    if (tokenAmount <= 0) {
      showToast.warning(t('trade.invalidTradingAmount'));
      return;
    }

    const [baseCurrency, quoteCurrency] = currentPair.split('/');
    const requiredCurrency = orderSide === 'buy' ? quoteCurrency : baseCurrency;
    const requiredAmount = orderSide === 'buy' ? usdtValue : tokenAmount;
    const available = getAvailableBalance(requiredCurrency);

    if (available + 1e-6 < requiredAmount) {
      showToast.error(t('trade.insufficientBalance', { currency: requiredCurrency, required: requiredAmount.toFixed(2), available: available.toFixed(2) }));
      return;
    }

    try {
      setLoadingOrder(true);
      const res = await demoTrading.placeOrder({
        pair: currentPair,
        side: orderSide,
        type: 'market',
        amount: tokenAmount,
        usdtValue,
        marketPrice: currentPairPrice
      });

      if (res.success) {
        const displayAmount = res.data?.amount || tokenAmount;
        const displayValue = res.data?.totalValue || usdtValue;

        showToast.success(t(orderSide === 'buy' ? 'trade.purchased' : 'trade.sold', { amount: formatNum(displayAmount), symbol: baseCurrency, value: formatNum(displayValue) }));

        // Update balances from response
        if (res.data?.balances) {
          setDemoBalances(res.data.balances);
        }

        // Reset form
        setOrderAmount('');
        setOrderPercentage(0);

        // Refresh data
        setTimeout(() => {
          fetchDemoAccount();
          fetchDemoStats();
          fetchDemoOrders();
        }, 300);
      } else {
        showToast.error(res.error || t('trade.failedToPlaceOrder'));
      }
    } catch (err) {
      showToast.error(err.message || t('trade.failedToPlaceOrder'));
    } finally {
      setLoadingOrder(false);
    }
  };

  // ─── Reset demo account ──────────────────────────────────────────────────
  const handleResetAccount = async () => {
    try {
      setResetting(true);
      const res = await demoTrading.resetAccount();
      if (res.success) {
        showToast.success(t('trade.demoAccountReset'));
        setDemoBalances(res.data?.balances || { USDT: { available: DEMO_INITIAL_BALANCE, locked: 0, total: DEMO_INITIAL_BALANCE } });
        setDemoOrders([]);
        fetchDemoStats();
        fetchDemoAccount();
      }
    } catch (err) {
      showToast.error(t('trade.failedToResetDemo'));
    } finally {
      setResetting(false);
    }
  };

  const handlePercentageClick = (pct) => {
    setOrderPercentage(pct);
    const max = getMaxTradeAmount();
    if (max > 0) {
      setOrderAmount((max * pct / 100).toFixed(2));
    }
  };

  const handlePairChange = (pair) => {
    setCurrentPair(pair);
    setOrderAmount('');
    setOrderPercentage(0);
    navigate(`/demo-trade?pair=${encodeURIComponent(pair)}`, { replace: true });
  };

  const formatNum = (n, d = 2) => {
    if (!n || isNaN(n)) return '0.00';
    return parseFloat(n).toFixed(d);
  };

  const formatPrice = (p) => {
    if (!p || isNaN(p)) return '0.00';
    if (p >= 1000) return parseFloat(p).toFixed(2);
    if (p >= 1) return parseFloat(p).toFixed(4);
    return parseFloat(p).toFixed(6);
  };

  // ─── Computed values ─────────────────────────────────────────────────────
  const pnl = demoStats ? demoStats.totalProfitLoss : 0;
  const pnlPct = demoStats ? demoStats.pnlPercentage : 0;
  const totalEquity = demoStats ? demoStats.totalEquity : (demoBalances?.USDT?.available || DEMO_INITIAL_BALANCE);

  // ─── Render ──────────────────────────────────────────────────────────────
  if (loadingAccount) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-sm">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  const [baseCurrency, quoteCurrency] = (currentPair || 'BTC/USDT').split('/');

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0a0a0f]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-white/60 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white">{currentPair || 'BTC/USDT'}</h1>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-linear-to-r bg-[#0052FF]/10 text-[#0052FF] rounded-full border border-[#0052FF]/30">
                  DEMO
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-white/60">{t('trade.demoMode')}</span>
                <span className="text-white/40">•</span>
                <span className={`font-mono ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  P&L: ${formatNum(pnl)} ({pnlPct >= 0 ? '+' : ''}{formatNum(pnlPct)}%)
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleResetAccount}
            disabled={resetting}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 text-white/70 rounded-lg border border-white/10 transition-colors"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </button>
        </div>
      </div>

      {/* Demo Account Summary Bar */}
      <div className="px-4 py-3 bg-linear-to-r from-yellow-500/5 via-orange-500/5 to-yellow-500/5 border-b border-yellow-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider">{t('copyTrading.totalInvested')}</p>
              <p className="text-lg font-bold text-white font-mono">${formatNum(totalEquity)}</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider">{t('asset.usdt')}</p>
              <p className="text-sm font-semibold text-white font-mono">${formatNum(getAvailableBalance('USDT'))}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/40 uppercase tracking-wider">{t('copyTrading.portfolio')}</p>
            <p className="text-sm font-semibold text-white font-mono">{demoStats?.totalTrades || 0}</p>
          </div>
        </div>
      </div>

      {/* Token Selector */}
      <div className="px-4 py-2 border-b border-white/5 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {(availableTokens.length > 0 ? availableTokens.slice(0, 15) : [
            { pair: 'BTC/USDT', symbol: 'BTC', price: 117500 },
            { pair: 'ETH/USDT', symbol: 'ETH', price: 3200 },
            { pair: 'BNB/USDT', symbol: 'BNB', price: 580 },
            { pair: 'SOL/USDT', symbol: 'SOL', price: 180 }
          ]).map((token) => (
            <button
              key={token.pair}
              onClick={() => handlePairChange(token.pair)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                currentPair === token.pair
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 border border-transparent'
              }`}
            >
              <img
                src={token.logoUrl || getCryptoLogoUrl(token.symbol)}
                alt={token.symbol}
                className="w-4 h-4 rounded-full"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              {token.symbol}
            </button>
          ))}
        </div>
      </div>

      {/* Price Display */}
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-white font-mono">${formatPrice(currentPairPrice)}</p>
            <p className="text-xs text-white/40">{t('trade.price')}</p>
          </div>
          <button
            onClick={() => setShowChart(!showChart)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-white/60 rounded-lg transition-colors"
          >
            {showChart ? <ChevronUp className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
            {showChart ? t('trade.orderBook') : t('trade.marketData')}
          </button>
        </div>
      </div>

      {/* Chart (toggle) */}
      {showChart && (
        <div className="px-4 py-3 border-b border-white/5">
          <div className="h-62.5 bg-white/5 rounded-lg overflow-hidden">
            <CandlestickChart
              pair={currentPair}
              timeframe={selectedTimeframe}
              height={250}
            />
          </div>
          <div className="flex gap-1 mt-2">
            {['1m', '5m', '15m', '1h', '4h', '1d'].map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={`px-2 py-1 text-xs rounded ${
                  selectedTimeframe === tf
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mobile Tab Switcher */}
      <div className="flex border-b border-white/5">
        {[
          { id: 'trade', label: t('trade.tradeTab') },
          { id: 'holdings', label: t('trade.holdingsTab') },
          { id: 'history', label: t('trade.historyTab') }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setMobileActiveTab(tab.id)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              mobileActiveTab === tab.id
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Trade Tab ────────────────────────────────────────────── */}
      {mobileActiveTab === 'trade' && (
        <div className="px-4 py-4">
          {/* Buy / Sell Toggle */}
          <div className="flex mb-4 bg-white/5 rounded-lg p-0.5">
            <button
              onClick={() => { setOrderSide('buy'); setOrderAmount(''); setOrderPercentage(0); }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-md transition-all ${
                orderSide === 'buy'
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {t('trade.buyTitle')}
            </button>
            <button
              onClick={() => { setOrderSide('sell'); setOrderAmount(''); setOrderPercentage(0); setAmountInputType('token'); }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-md transition-all ${
                orderSide === 'sell'
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {t('trade.sellTitle')}
            </button>
          </div>

          {/* Amount Input */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-white/50">
                {t('trade.amountInCurrency', { currency: amountInputType === 'usdt' ? 'USDT' : baseCurrency })}
              </span>
              {orderSide === 'buy' && (
                <button
                  onClick={() => setAmountInputType(amountInputType === 'token' ? 'usdt' : 'token')}
                  className="text-xs text-white/40 hover:text-white/70 transition-colors"
                >
                  ⇄ {amountInputType === 'token' ? 'USDT' : baseCurrency}
                </button>
              )}
            </div>
            <input
              type="number"
              value={orderAmount}
              onChange={(e) => setOrderAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2.5 bg-white/5 border-b border-white/10 text-white text-sm font-mono focus:outline-none focus:border-white/30 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            {/* Conversion preview */}
            {orderAmount && currentPairPrice > 0 && (
              <div className="mt-1.5 text-xs text-white/40">
                {amountInputType === 'usdt'
                  ? `≈ ${getTokenAmount().toFixed(6)} ${baseCurrency}`
                  : `≈ ${getUSDTValue().toFixed(2)} USDT`}
              </div>
            )}
          </div>

          {/* Total / You Receive */}
          <div className="border-t border-white/10 pt-3 pb-3 mb-4">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-white/50">{orderSide === 'sell' ? t('trade.youReceive') : t('trade.total')}</span>
              <span className="text-white font-mono">
                {orderAmount ? `${getUSDTValue().toFixed(2)} USDT` : '0.00 USDT'}
              </span>
            </div>
            {orderAmount && orderSide === 'buy' && (
              <div className="flex justify-between text-xs">
                <span className="text-white/50">{t('trade.youGet')}</span>
                <span className="text-white font-mono">
                  {getTokenAmount().toFixed(6)} {baseCurrency}
                </span>
              </div>
            )}
          </div>

          {/* Available Balance */}
          <div className="text-xs text-white/50 mb-4">
            <div className="flex justify-between items-center mb-1">
              <span>{t('trade.available')}</span>
              <span className="font-mono text-white/70">
                {orderSide === 'buy'
                  ? `${formatNum(getAvailableBalance(quoteCurrency))} ${quoteCurrency}`
                  : `${getAvailableBalance(baseCurrency).toFixed(6)} ${baseCurrency}`}
              </span>
            </div>
          </div>

          {/* Percentage Buttons */}
          <div className="grid grid-cols-4 gap-1 mb-5">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                onClick={() => handlePercentageClick(pct)}
                className={`py-1.5 text-xs font-medium transition-colors ${
                  orderPercentage === pct
                    ? 'bg-white/20 text-white'
                    : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* Place Order Button */}
          <Button
            onClick={handlePlaceOrder}
            disabled={loadingOrder || !orderAmount || parseFloat(orderAmount) <= 0}
            className={`w-full py-3 font-bold text-sm transition-colors ${
              orderSide === 'buy'
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-red-500 text-white hover:bg-red-600'
            } ${loadingOrder ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loadingOrder ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border border-white border-t-transparent animate-spin rounded-full" />
                {t('trade.placingOrder')}
              </div>
            ) : (
              t(orderSide === 'buy' ? 'trade.buySymbolDemo' : 'trade.sellSymbolDemo', { symbol: baseCurrency })
            )}
          </Button>

          {/* Demo notice */}
          <p className="text-center text-[10px] text-white/30 mt-3">
            {t('trade.demoDisclaimer')}
          </p>
        </div>
      )}

      {/* ─── Holdings Tab ─────────────────────────────────────────── */}
      {mobileActiveTab === 'holdings' && (
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white/80">{t('trade.demoHoldings')}</h3>
            <button onClick={fetchDemoStats} className="text-white/40 hover:text-white/60">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 bg-white/5 rounded-lg">
              <p className="text-[10px] text-white/40 uppercase">{t('trade.totalEquity')}</p>
              <p className="text-lg font-bold font-mono text-white">${formatNum(totalEquity)}</p>
            </div>
            <div className="p-3 bg-white/5 rounded-lg">
              <p className="text-[10px] text-white/40 uppercase">{t('trade.pnlLabel')}</p>
              <p className={`text-lg font-bold font-mono ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {pnl >= 0 ? '+' : ''}${formatNum(pnl)}
              </p>
              <p className={`text-[10px] font-mono ${pnlPct >= 0 ? 'text-green-400/60' : 'text-red-400/60'}`}>
                {pnlPct >= 0 ? '+' : ''}{formatNum(pnlPct)}%
              </p>
            </div>
            <div className="p-3 bg-white/5 rounded-lg">
              <p className="text-[10px] text-white/40 uppercase">{t('trade.winRateLabel')}</p>
              <p className="text-lg font-bold font-mono text-white">{demoStats?.winRate || 0}%</p>
            </div>
            <div className="p-3 bg-white/5 rounded-lg">
              <p className="text-[10px] text-white/40 uppercase">{t('trade.totalTradesLabel')}</p>
              <p className="text-lg font-bold font-mono text-white">{demoStats?.totalTrades || 0}</p>
            </div>
          </div>

          {/* Holdings List */}
          <h4 className="text-xs font-semibold text-white/60 uppercase mb-2">{t('asset.assets')}</h4>
          <div className="space-y-2">
            {Object.entries(demoBalances).map(([currency, bal]) => {
              const amount = bal?.available || bal?.total || 0;
              if (amount <= 0) return null;
              return (
                <div key={currency} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-2">
                    <img
                      src={getCryptoLogoUrl(currency)}
                      alt={currency}
                      className="w-8 h-8 rounded-full"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div>
                      <p className="text-sm font-semibold text-white">{currency}</p>
                      <p className="text-[10px] text-white/40">{t('trade.demoBalance')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-white">
                      {currency === 'USDT' ? formatNum(amount) : amount.toFixed(6)}
                    </p>
                    {currency !== 'USDT' && (
                      <p className="text-[10px] text-white/40 font-mono">
                        ≈ ${formatNum(amount * (prices[`${currency}/USDT`] || 0))}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            {Object.keys(demoBalances).length === 0 && (
              <div className="text-center py-8 text-white/30 text-sm">{t('trade.noHoldingsYet')}</div>
            )}
          </div>
        </div>
      )}

      {/* ─── History Tab ──────────────────────────────────────────── */}
      {mobileActiveTab === 'history' && (
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white/80">{t('trade.demoTradeHistory')}</h3>
            <button onClick={fetchDemoOrders} className="text-white/40 hover:text-white/60">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {demoOrders.length > 0 ? demoOrders.map((trade) => (
              <div key={trade.tradeId || trade._id} className="p-3 bg-white/5 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                      trade.side === 'buy'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {trade.side?.toUpperCase()}
                    </span>
                    <span className="text-sm font-semibold text-white">{trade.pair}</span>
                  </div>
                  <span className="text-[10px] text-white/40">
                    {new Date(trade.executedAt || trade.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/50">
                    {parseFloat(trade.amount).toFixed(6)} @ ${formatPrice(trade.price)}
                  </span>
                  <span className="text-white font-mono">${formatNum(trade.totalValue)}</span>
                </div>
                {trade.side === 'sell' && trade.profitLoss !== undefined && trade.profitLoss !== 0 && (
                  <div className="mt-1 text-right">
                    <span className={`text-xs font-mono ${trade.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {trade.profitLoss >= 0 ? '+' : ''}${formatNum(trade.profitLoss)} ({trade.profitLossPercent >= 0 ? '+' : ''}{formatNum(trade.profitLossPercent)}%)
                    </span>
                  </div>
                )}
              </div>
            )) : (
              <div className="text-center py-12 text-white/30 text-sm">
                <Play className="w-8 h-8 mx-auto mb-2 text-white/20" />
                {t('trade.noDemoTrades')}
              </div>
            )}
          </div>
        </div>
      )}

      <Menu />
    </div>
  );
};

export default DemoTrade;
