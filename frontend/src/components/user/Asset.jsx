import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { useUserProfile } from '../../contexts/UserProfileContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTrading } from '../../contexts/TradingContext';
import {
  ChevronDown,
  Search,
} from "lucide-react";
import { IoIosEye, IoIosEyeOff } from "react-icons/io";
import { MdOutlineSettings, MdShowChart } from "react-icons/md";
                                      import { getCryptoLogoUrl, getSpecialTokenPlaceholder } from '../../utils/logoService';
import { ApiUtils } from '../../services/api';
import Menu from '../Menu';
import Spinner from '../common/Spinner';

const meshBg = { background: '#FFFFFF' };

const Asset = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user, isAuthenticated } = useUserAuth();
  const { profileData, refreshProfile, loading: profileLoading } = useUserProfile();
  useTheme();
  const { tickers, tradingPairs } = useTrading();

  const [showBalance, setShowBalance] = useState(true);
  const [specialTokens, setSpecialTokens] = useState([]);
  const [valueCurrency, setValueCurrency] = useState('USDT');
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [holdingsTab, setHoldingsTab] = useState('crypto');

  const [activeAssetTab, setActiveAssetTab] = useState('overview');
  const [showChart, setShowChart] = useState(true);
  const [showAddFundsSheet, setShowAddFundsSheet] = useState(false);
  const [depositStep, setDepositStep] = useState(0); // 0=options, 1=coin, 2=chain
  const [showSendSheet, setShowSendSheet] = useState(false);
  const [showTransactionsSheet, setShowTransactionsSheet] = useState(false);
  const [hideSmallBalances, setHideSmallBalances] = useState(false);
  const [showTabMenu, setShowTabMenu] = useState(false);
  const [cryptoSearch, setCryptoSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const dropdownRef = useRef(null);
  const tabMenuRef = useRef(null);

  const userBalances = profileData?.balances || {};
  const loading = profileLoading;

  const fetchSpecialTokens = async () => {
    try {
      const response = await ApiUtils.get('/market/special-tokens');
      if (response && response.data) setSpecialTokens(response.data || []);
    } catch (error) {
      console.error('Failed to fetch special tokens:', error);
    }
  };

  const getTokenLogoUrl = (symbol) => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
    const specialToken = specialTokens.find(t => t.symbol === symbol);
    if (specialToken) {
      if (specialToken.logoUrl) {
        return specialToken.logoUrl.startsWith('http')
          ? specialToken.logoUrl
          : `${baseUrl}${specialToken.logoUrl}`;
      }
      return getSpecialTokenPlaceholder(symbol, specialToken.name);
    }
    return getCryptoLogoUrl(symbol);
  };

  const handleRefresh = async () => {
    try { await refreshProfile(); } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchSpecialTokens(); }, []);
  useEffect(() => { if (user && !profileData) refreshProfile(); }, [user, profileData]);
  useEffect(() => {
    if (location.state?.fromDeposit || location.state?.fromTrade || location.pathname === '/assets') handleRefresh();
  }, [location.state?.fromDeposit, location.state?.fromTrade, location.pathname]);
  useEffect(() => { if (isAuthenticated() && !loading) handleRefresh(); }, [isAuthenticated()]);
  useEffect(() => {
    if (!isAuthenticated()) return;
    const interval = setInterval(() => {
      refreshProfile().catch(e => console.error('Background refresh failed:', e));
    }, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated(), profileData]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setShowCurrencyDropdown(false);
      if (tabMenuRef.current && !tabMenuRef.current.contains(e.target))
        setShowTabMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getPortfolioData = () => {
    if (!userBalances || Object.keys(userBalances).length === 0) return [];
    return Object.entries(userBalances)
      .map(([symbol, balanceData]) => {
        let amount = 0;
        if (typeof balanceData === 'object' && balanceData !== null) {
          amount = parseFloat(balanceData.total || balanceData.available || 0);
        } else {
          amount = parseFloat(balanceData) || 0;
        }
        return { symbol, amount };
      })
      .filter(b => b.amount > 0)
      .map(({ symbol, amount }) => {
        const pairKey = `${symbol}/USDT`;
        const pairInfo = tradingPairs.find(p => p.symbol === pairKey);
        return {
          symbol,
          name: pairInfo?.baseName || symbol,
          amount: amount.toFixed(5),
          rawAmount: amount,
          logoUrl: getTokenLogoUrl(symbol),
        };
      })
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  };

  const portfolioData = getPortfolioData();

  // Compute total portfolio value in USDT
  const totalValueUSDT = portfolioData.reduce((sum, asset) => {
    if (asset.symbol === 'USDT') return sum + asset.rawAmount;
    const ticker = tickers?.[`${asset.symbol}/USDT`];
    const price = ticker?.last ? parseFloat(ticker.last) : 0;
    return sum + asset.rawAmount * price;
  }, 0);

  // Compute today's PNL in USDT
  const todayPNL = portfolioData.reduce((sum, asset) => {
    if (asset.symbol === 'USDT') return sum; // USDT itself has no PNL
    const ticker = tickers?.[`${asset.symbol}/USDT`];
    if (!ticker?.last) return sum;
    const price = parseFloat(ticker.last);
    const changePercent = ticker?.percentage ?? ticker?.change ?? 0;
    const currentValue = asset.rawAmount * price;
    const pnl = currentValue * changePercent / (100 + changePercent);
    return sum + pnl;
  }, 0);
  const pnlPositive = todayPNL >= 0;

  // Convert total to selected currency
  const getDisplayValue = () => {
    if (valueCurrency === 'USDT') return totalValueUSDT.toFixed(2);
    const rate = parseFloat(tickers?.[`${valueCurrency}/USDT`]?.last || 0);
    if (!rate) return '--';
    return (totalValueUSDT / rate).toFixed(6);
  };

  const currencies = ['USDT', 'BTC', 'ETH'];

  return (
    <>
    <div className="min-h-screen relative overflow-hidden" style={meshBg}>
      <div className="relative z-10 w-full max-w-md mx-auto px-4 pt-6 pb-24">

        {/* ── Top tab bar ── */}
        <div className="flex items-center mb-5">
          {[
            { value: 'overview', label: t('asset.tabOverview') },
            { value: 'fund',     label: t('asset.tabFund') },
            { value: 'spot',     label: t('asset.tabSpot') },
            { value: 'earn',     label: t('asset.tabEarn') },
          ].map((tab, idx, arr) => (
            <div key={tab.value} className="flex items-center">
              <button
                onClick={() => setActiveAssetTab(tab.value)}
                className={`py-1 text-sm font-semibold transition-colors duration-200 ${
                  activeAssetTab === tab.value ? 'text-[#0052FF]' : 'text-[#888888]'
                }`}
              >
                {tab.label}
              </button>
              {idx < arr.length - 1 && (
                <span className="mx-3 h-4 w-px bg-[#E0E0E0]" />
              )}
            </div>
          ))}
        </div>

        {/* ── Portfolio Card ── */}
        <div className="bg-[#0052FF] rounded-3xl p-5 mb-6 relative overflow-hidden shadow-xl">
          {/* Subtle decorative circles */}
          <div className="absolute -top-8 -right-8 w-36 h-36 bg-white/10 rounded-full" />
          <div className="absolute -bottom-10 -left-6 w-28 h-28 bg-white/10 rounded-full" />

          <div className="relative z-10">
            {/* Row 1: label + icons */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/70 text-sm font-medium">{t('asset.totalValue')}</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowChart(v => !v)}
                  className={`transition-colors ${showChart ? 'text-white' : 'text-white/40'}`}
                  title="Toggle chart"
                >
                  <MdShowChart className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowBalance(!showBalance)}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  {showBalance ? <IoIosEye className="w-5 h-5" /> : <IoIosEyeOff className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Row 2: amount + currency dropdown */}
            <div className="flex items-end gap-3 mb-3">
              <h2 className="text-4xl font-bold text-white leading-none">
                {showBalance ? getDisplayValue() : '••••••'}
              </h2>
              <div className="relative mb-0.5" ref={dropdownRef}>
                <button
                  onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                  className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-3 py-1 rounded-full transition-colors"
                >
                  {valueCurrency}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCurrencyDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showCurrencyDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-[#0052FF]/15 z-50 overflow-hidden min-w-22.5">
                    {currencies.map(c => (
                      <button
                        key={c}
                        onClick={() => { setValueCurrency(c); setShowCurrencyDropdown(false); }}
                        className={`w-full px-4 py-2.5 text-sm font-semibold text-left transition-colors ${
                          valueCurrency === c
                            ? 'bg-[#F0F5FF] text-[#0052FF]'
                            : 'text-[#111111] hover:bg-[#F4F4F4]'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Row 3: Today's PNL */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-white/60 text-xs">{t('asset.todaysPnl')}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                pnlPositive ? 'bg-green-400/20 text-green-300' : 'bg-red-400/20 text-red-300'
              }`}>
                {showBalance
                  ? `${pnlPositive ? '+' : ''}$${todayPNL.toFixed(2)}`
                  : '••••'}
              </span>
            </div>

            {/* Line chart */}
            {showChart && (
              <div className="w-full h-16 mt-1">
                <svg viewBox="0 0 300 60" className="w-full h-full" preserveAspectRatio="none" overflow="visible">
                  <defs>
                    <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.28)" />
                      <stop offset="70%" stopColor="rgba(255,255,255,0.06)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    </linearGradient>
                  </defs>
                  {/* Fill area */}
                  <path
                    d="M0,46 C12,44 22,53 38,49 C54,45 64,30 82,27 C98,24 110,37 130,33 C150,29 163,13 183,10 C200,7 214,20 230,16 C246,12 260,5 278,3 C287,2 294,2 300,2 L300,60 L0,60 Z"
                    fill="url(#chartFill)"
                  />
                  {/* Glow layer */}
                  <path
                    d="M0,46 C12,44 22,53 38,49 C54,45 64,30 82,27 C98,24 110,37 130,33 C150,29 163,13 183,10 C200,7 214,20 230,16 C246,12 260,5 278,3 C287,2 294,2 300,2"
                    fill="none"
                    stroke="rgba(255,255,255,0.35)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Main line */}
                  <path
                    d="M0,46 C12,44 22,53 38,49 C54,45 64,30 82,27 C98,24 110,37 130,33 C150,29 163,13 183,10 C200,7 214,20 230,16 C246,12 260,5 278,3 C287,2 294,2 300,2"
                    fill="none"
                    stroke="rgba(255,255,255,0.95)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Live dot */}
                  <circle cx="300" cy="2" r="6" fill="rgba(255,255,255,0.2)" />
                  <circle cx="300" cy="2" r="3" fill="white" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* ── Action buttons (outside card) ── */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <button
            onClick={() => setShowAddFundsSheet(true)}
            className="flex items-center justify-center bg-white border border-[#0052FF]/15 rounded-lg py-3 hover:bg-[#F0F5FF] transition-colors shadow-sm"
          >
            <span className="text-[#111111] text-xs font-semibold">{t('asset.addFundsBtn')}</span>
          </button>
          <button
            onClick={() => setShowSendSheet(true)}
            className="flex items-center justify-center bg-white border border-[#0052FF]/15 rounded-lg py-3 hover:bg-[#F0F5FF] transition-colors shadow-sm"
          >
            <span className="text-[#111111] text-xs font-semibold">{t('asset.sendBtn')}</span>
          </button>
          <button
            onClick={() => setShowTransactionsSheet(true)}
            className="flex items-center justify-center bg-white border border-[#0052FF]/15 rounded-lg py-3 hover:bg-[#F0F5FF] transition-colors shadow-sm"
          >
            <span className="text-[#111111] text-xs font-semibold">{t('asset.transactionBtn')}</span>
          </button>
        </div>

        {/* ── Crypto / Account tabs ── */}
        <div className="flex items-center border-b border-[#E5E5E5] mb-4">
          <div className="flex flex-1">
            {[
              { key: 'crypto', label: t('asset.cryptoTab') },
              { key: 'account', label: t('asset.accountTab') },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setHoldingsTab(tab.key)}
                className={`relative pb-2.5 pt-1 mr-6 text-sm font-semibold transition-colors duration-200 ${
                  holdingsTab === tab.key ? 'text-[#0052FF]' : 'text-[#888888]'
                }`}
              >
                {tab.label}
                <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full bg-[#0052FF] transition-all duration-300 ${
                  holdingsTab === tab.key ? 'w-full opacity-100' : 'w-0 opacity-0'
                }`} />
              </button>
            ))}
          </div>

          {/* search icon + settings menu */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowSearch(v => !v); setCryptoSearch(''); }}
              className={`flex items-center justify-center transition-colors ${showSearch ? 'text-[#0052FF]' : 'text-[#888888] hover:text-[#111111]'}`}
            >
              <Search className="w-4 h-4" />
            </button>
            <div className="relative flex items-center" ref={tabMenuRef}>
            <button
              onClick={() => setShowTabMenu(v => !v)}
              className="flex items-center justify-center text-[#AAAAAA] hover:text-[#555555] transition-colors"
            >
              <MdOutlineSettings className="w-4 h-4" />
            </button>
            {showTabMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-[#E5E5E5] z-50 min-w-50 p-3">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    onClick={() => setHideSmallBalances(v => !v)}
                    className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                      hideSmallBalances
                        ? 'bg-[#0052FF] border-[#0052FF]'
                        : 'border-[#CCCCCC] bg-white'
                    }`}
                  >
                    {hideSmallBalances && (
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span
                    onClick={() => setHideSmallBalances(v => !v)}
                    className="text-sm text-[#111111] font-medium"
                  >
                    {t('asset.hideSmallCrypto')}
                  </span>
                </label>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* ── CRYPTO tab: holdings list ── */}
        {holdingsTab === 'crypto' && (
          <div className="bg-white/70 backdrop-blur-xl border border-[#0052FF]/15 rounded-2xl px-4">
            {/* Search bar — shown only when toggled */}
            {showSearch && (
              <div className="py-3 border-b border-[#0052FF]/15">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#AAAAAA] pointer-events-none" />
                  <input
                    type="text"
                    value={cryptoSearch}
                    onChange={e => setCryptoSearch(e.target.value)}
                    placeholder={t('asset.searchCoin')}
                    autoFocus
                    className="w-full pl-9 pr-3 py-2 bg-[#F4F4F4] rounded-xl text-sm text-[#111111] placeholder-[#AAAAAA] focus:outline-none focus:ring-2 focus:ring-[#0052FF]/20"
                  />
                </div>
              </div>
            )}

            {loading ? (
              <Spinner />
            ) : (
              <div>
                {portfolioData.filter(asset => {
                  if (cryptoSearch && !asset.symbol.toLowerCase().includes(cryptoSearch.toLowerCase()) && !asset.name.toLowerCase().includes(cryptoSearch.toLowerCase())) return false;
                  if (!hideSmallBalances) return true;
                  const ticker = tickers?.[`${asset.symbol}/USDT`];
                  if (asset.symbol === 'USDT') return asset.rawAmount >= 1;
                  const price = ticker?.last ? parseFloat(ticker.last) : 0;
                  return asset.rawAmount * price >= 1;
                }).map((asset, index) => {
                  const ticker = tickers?.[`${asset.symbol}/USDT`];
                  const price = ticker?.last
                    ? `$${parseFloat(ticker.last).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
                    : '--';
                  const changePercent = ticker?.percentage ?? ticker?.change ?? null;
                  const isPositive = changePercent !== null ? changePercent >= 0 : true;
                  const changeStr = changePercent !== null
                    ? `${isPositive ? '+' : ''}${parseFloat(changePercent).toFixed(2)}%`
                    : '--';

                  return (
                    <div
                      key={`${asset.symbol}-${index}`}
                      className="py-3 hover:bg-[#F0F5FF]/60 transition-all duration-200 border-b border-[#0052FF]/15 last:border-b-0"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <img
                              src={asset.logoUrl}
                              alt={asset.name}
                              className="w-10 h-10 rounded-full object-cover"
                              onError={(e) => {
                                const specialToken = specialTokens.find(t => t.symbol === asset.symbol);
                                if (specialToken) {
                                  e.target.style.display = 'none';
                                  e.target.nextElementSibling.style.display = 'flex';
                                } else {
                                  import('../../utils/logoService').then(({ getCryptoFallbackUrls }) => {
                                    const fallbackUrls = getCryptoFallbackUrls(asset.symbol);
                                    const currentIndex = parseInt(e.target.dataset.fallbackIndex || '0');
                                    const nextIndex = currentIndex + 1;
                                    if (nextIndex < fallbackUrls.length) {
                                      e.target.dataset.fallbackIndex = nextIndex.toString();
                                      e.target.src = fallbackUrls[nextIndex];
                                    } else {
                                      e.target.style.display = 'none';
                                      e.target.nextElementSibling.style.display = 'flex';
                                    }
                                  });
                                }
                              }}
                            />
                            <div className="w-10 h-10 bg-[#0052FF]/12 rounded-full items-center justify-center" style={{ display: 'none' }}>
                              <span className="text-[#0052FF] font-bold text-xs">{asset.symbol.charAt(0)}</span>
                            </div>
                          </div>
                          <div>
                            <h4 className="font-semibold text-[#111111] text-sm">{asset.symbol}</h4>
                            <p className="text-[#888888] text-xs">
                              {showBalance ? `${asset.amount} ${asset.symbol}` : '****'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-[#111111] text-sm">{price}</p>
                          <p className={`text-xs font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                            {changeStr}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ACCOUNT tab ── */}
        {holdingsTab === 'account' && (
          <div className="bg-white/70 backdrop-blur-xl border border-[#0052FF]/15 rounded-2xl px-4">
            {[
              { value: 'overview', label: t('asset.tabOverview') },
              { value: 'fund',     label: t('asset.tabFund') },
              { value: 'spot',     label: t('asset.tabSpot') },
              { value: 'earn',     label: t('asset.tabEarn') },
            ].map(tab => (
              <div key={tab.value} className="flex items-center justify-between py-3 border-b border-[#0052FF]/15 last:border-b-0">
                <span className="text-sm font-semibold text-[#111111]">{tab.label}</span>
                <span className="text-sm font-semibold text-[#111111]">
                  {showBalance ? `$${totalValueUSDT.toFixed(2)}` : '****'}
                </span>
              </div>
            ))}
          </div>
        )}

      </div>

      <Menu />

      <style>{`
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>

    {/* ── Add Funds half-screen sheet ── */}
    {showAddFundsSheet && (
      <div className="fixed inset-0 z-100 flex flex-col justify-end">
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => { setShowAddFundsSheet(false); setDepositStep(0); }}
        />
        <div className="relative bg-white rounded-t-3xl shadow-2xl w-full" style={{ height: '50vh' }}>
          <div className="flex flex-col h-full px-5 pt-5 pb-8">
            {/* Handle */}
            <div className="w-10 h-1 bg-[#E0E0E0] rounded-full mx-auto mb-5" />

            {/* Header with optional back button */}
            <div className="flex items-center gap-3 mb-5">
              {depositStep > 0 && (
                <button
                  onClick={() => setDepositStep(s => s - 1)}
                  className="text-[#555555] hover:text-[#0052FF] p-1 rounded-lg hover:bg-[#F0F5FF] transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 5l-7 7 7 7" />
                  </svg>
                </button>
              )}
              <h3 className="text-base font-bold text-[#111111]">
                {depositStep === 0 && t('asset.addFundsBtn')}
                {depositStep === 1 && t('asset.selectCoin')}
                {depositStep === 2 && t('asset.selectNetworkTitle')}
              </h3>
            </div>

            {/* Step 0: options */}
            {depositStep === 0 && (
              <button
                onClick={() => setDepositStep(1)}
                className="w-full flex items-center gap-4 bg-[#F4F8FF] hover:bg-[#EBF2FF] transition-colors rounded-2xl px-4 py-4"
              >
                <div className="w-10 h-10 rounded-full bg-[#0052FF] flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M2 12h20" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-[#111111]">{t('asset.depositCrypto')}</p>
                  <p className="text-xs text-[#888888]">{t('asset.receiveCryptoDesc')}</p>
                </div>
              </button>
            )}

            {/* Step 1: coin selection — only USDT */}
            {depositStep === 1 && (
              <button
                onClick={() => setDepositStep(2)}
                className="w-full flex items-center gap-4 bg-[#F4F8FF] hover:bg-[#EBF2FF] transition-colors rounded-2xl px-4 py-4"
              >
                <img
                  src={getCryptoLogoUrl('USDT')}
                  alt="USDT"
                  className="w-10 h-10 rounded-full object-cover shrink-0"
                />
                <div className="text-left flex-1">
                  <p className="text-sm font-semibold text-[#111111]">USDT</p>
                  <p className="text-xs text-[#888888]">Tether</p>
                </div>
                <svg className="w-4 h-4 text-[#AAAAAA]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            )}

            {/* Step 2: chain selection */}
            {depositStep === 2 && (
              <div className="flex flex-col gap-3">
                {[
                  { network: 'BSC', label: 'BEP-20', desc: 'Binance Smart Chain' },
                  { network: 'TRC20', label: 'TRC-20', desc: 'TRON Network' },
                ].map(({ network, label, desc }) => (
                  <button
                    key={network}
                    onClick={() => {
                      setShowAddFundsSheet(false);
                      setDepositStep(0);
                      navigate('/deposit', { state: { network } });
                    }}
                    className="w-full flex items-center gap-4 bg-[#F4F8FF] hover:bg-[#EBF2FF] transition-colors rounded-2xl px-4 py-4"
                  >
                    <div className="text-left flex-1">
                      <p className="text-sm font-semibold text-[#111111]">{label}</p>
                      <p className="text-xs text-[#888888]">{desc}</p>
                    </div>
                    <svg className="w-4 h-4 text-[#AAAAAA]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* ── Transactions half-screen sheet ── */}
    {showTransactionsSheet && (
      <div className="fixed inset-0 z-100 flex flex-col justify-end">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowTransactionsSheet(false)} />
        <div className="relative bg-white rounded-t-3xl shadow-2xl w-full" style={{ height: '50vh' }}>
          <div className="flex flex-col h-full px-5 pt-5 pb-8">
            {/* Handle */}
            <div className="w-10 h-1 bg-[#E0E0E0] rounded-full mx-auto mb-6" />
            <h3 className="text-base font-bold text-[#111111] mb-5">{t('asset.transactionBtn')}</h3>
            <button
              onClick={() => { setShowTransactionsSheet(false); navigate('/transactions'); }}
              className="w-full flex items-center gap-4 bg-[#F4F8FF] hover:bg-[#EBF2FF] transition-colors rounded-2xl px-4 py-4"
            >
              <div className="w-10 h-10 rounded-full bg-[#0052FF] flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-[#111111]">{t('asset.transactionBtn')}</p>
                <p className="text-xs text-[#888888]">{t('asset.transactionDesc')}</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Send half-screen sheet ── */}
    {showSendSheet && (
      <div className="fixed inset-0 z-100 flex flex-col justify-end">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowSendSheet(false)} />
        <div className="relative bg-white rounded-t-3xl shadow-2xl w-full" style={{ height: '50vh' }}>
          <div className="flex flex-col h-full px-5 pt-5 pb-8">
            {/* Handle */}
            <div className="w-10 h-1 bg-[#E0E0E0] rounded-full mx-auto mb-6" />
            <h3 className="text-base font-bold text-[#111111] mb-5">{t('asset.sendBtn')}</h3>
            <button
              onClick={() => { setShowSendSheet(false); navigate('/withdraw'); }}
              className="w-full flex items-center gap-4 bg-[#F4F8FF] hover:bg-[#EBF2FF] transition-colors rounded-2xl px-4 py-4"
            >
              <div className="w-10 h-10 rounded-full bg-[#0052FF] flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-[#111111]">{t('asset.sendCrypto')}</p>
                <p className="text-xs text-[#888888]">{t('asset.transferCryptoDesc')}</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default Asset;
