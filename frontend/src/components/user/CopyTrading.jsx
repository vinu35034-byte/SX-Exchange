import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import Spinner from '../common/Spinner';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUserProfile } from '../../contexts/UserProfileContext';
import { ApiUtils } from '../../services/api';
import { showToast } from '../../utils/toast';
import {
  TrendingUp, Users, X, ArrowLeft, Activity,
} from 'lucide-react';
import Menu from '../Menu';

/* ─── Amount Input ─── */
const AmountInput = memo(({ userBalance, isDisabled, onChange, inputRef }) => {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const handleChange = useCallback((e) => {
    setValue(e.target.value);
    onChange(e.target.value);
  }, [onChange]);
  return (
    <div className="mb-3">
      <label className="block text-xs text-[#555555] mb-1.5 font-medium">{t('copyTrading.investmentAmount')}</label>
      <input
        ref={inputRef}
        type="number"
        value={value}
        onChange={handleChange}
        placeholder={t('copyTrading.enterAmountUsdt')}
        className="w-full bg-[#F5F7FA] rounded-xl px-4 py-3 text-sm text-[#111111] placeholder-[#AAAAAA] focus:outline-none focus:ring-2 focus:ring-[#0052FF]/30 border border-[#EEEEEE] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        min="50" step="0.01" max={userBalance}
        disabled={isDisabled} autoFocus
      />
      <p className="text-[11px] text-[#AAAAAA] mt-1">{t('copyTrading.minimumInvestment')}</p>
    </div>
  );
}, (p, n) => p.isDisabled === n.isDisabled);
AmountInput.displayName = 'AmountInput';

/* ─── Balance Summary ─── */
const BalanceSummary = memo(({ followAmount, userBalance, selectedTrader }) => {
  const { t } = useTranslation();
  if (!followAmount || parseFloat(followAmount) <= 0) return null;
  const amount = parseFloat(followAmount);
  const hasError = amount > userBalance;
  return (
    <>
      {hasError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3">
          <p className="text-xs text-red-600">
            ⚠️ {t('copyTrading.insufficientBalance', { balance: userBalance.toFixed(2), amount: amount.toFixed(2) })}
          </p>
        </div>
      )}
      {!hasError && (
        <div className="bg-[#F8FAFF] rounded-xl p-3 mb-3 space-y-2">
          {[
            { label: t('copyTrading.investment'), value: `$${amount.toFixed(2)}`, color: 'text-[#111111]' },
            { label: t('copyTrading.potentialEarnings'), value: `${selectedTrader?.followerCommissionPercentage}% of profits`, color: 'text-[#00A572]' },
            { label: t('copyTrading.remainingBalance'), value: `$${(userBalance - amount).toFixed(2)}`, color: 'text-[#0052FF]' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between text-xs">
              <span className="text-[#888888]">{label}</span>
              <span className={`font-semibold ${color}`}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
});
BalanceSummary.displayName = 'BalanceSummary';

/* ─── Follow Modal ─── */
const FollowModal = memo(({ selectedTrader, userBalance, followAmount, followingId, onClose, onFollow, onAmountChange, inputRef }) => {
  const { t } = useTranslation();
  if (!selectedTrader) return null;
  const amount = parseFloat(followAmount);
  const isFollowing = followingId === selectedTrader?._id;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center">
      <div className="bg-white w-full max-w-md rounded-t-3xl max-h-[85vh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-[#DDDDDD] rounded-full" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#F0F0F0]">
          <h2 className="text-base font-bold text-[#111111]">{t('copyTrading.followTraderTitle')}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F5F5F5] hover:bg-[#EEEEEE] transition-colors">
            <X size={16} color="#555" />
          </button>
        </div>
        <div className="p-5">
          {/* Trader info */}
          <div className="flex items-center gap-3 mb-4">
            {selectedTrader.profileImage ? (
              <img src={selectedTrader.profileImage} alt={selectedTrader.name} className="w-12 h-12 rounded-full ring-2 ring-[#0052FF]/20 shrink-0 object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#EEF3FF] flex items-center justify-center shrink-0">
                <Users size={20} color="#0052FF" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#111111]">{selectedTrader.name}</p>
              <p className="text-[11px] text-[#888888] truncate">{selectedTrader.bio}</p>
            </div>
          </div>
          {/* Stats */}
          <div className="bg-[#F8FAFF] rounded-2xl overflow-hidden mb-4">
            {[
              { label: t('copyTrading.returnRate'), value: `${selectedTrader.winRate}%`, color: 'text-[#00A572]' },
              { label: t('copyTrading.yourCommission'), value: `${selectedTrader.followerCommissionPercentage}%`, color: 'text-[#0052FF]' },
              { label: t('copyTrading.totalFollowers'), value: selectedTrader.totalFollowers || 0, color: 'text-[#111111]' },
              { label: t('copyTrading.availableBalance'), value: `$${userBalance.toFixed(2)}`, color: 'text-[#0052FF]' },
            ].map(({ label, value, color }, idx, arr) => (
              <div key={label} className={`flex items-center justify-between px-4 py-2.5 ${idx < arr.length - 1 ? 'border-b border-[#F0F0F0]' : ''}`}>
                <span className="text-xs text-[#888888]">{label}</span>
                <span className={`text-xs font-bold ${color}`}>{value}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#888888] leading-relaxed mb-4">
            {t('copyTrading.investmentDescription', { percent: selectedTrader.followerCommissionPercentage })}
          </p>
          <AmountInput userBalance={userBalance} isDisabled={isFollowing} onChange={onAmountChange} inputRef={inputRef} />
          <BalanceSummary followAmount={followAmount} userBalance={userBalance} selectedTrader={selectedTrader} />
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} disabled={isFollowing} className="flex-1 py-3 rounded-xl text-sm font-semibold text-[#555555] bg-[#F5F5F5] hover:bg-[#EEEEEE] disabled:opacity-50 transition-colors">
              {t('copyTrading.cancel')}
            </button>
            <button
              onClick={onFollow}
              disabled={!followAmount || amount <= 0 || amount > userBalance || isFollowing}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-[#0052FF] hover:bg-[#0041CC] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {isFollowing
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('copyTrading.following')}</>
                : <><TrendingUp size={14} />{t('copyTrading.follow')}</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}, (p, n) => (
  p.selectedTrader?._id === n.selectedTrader?._id &&
  p.followAmount === n.followAmount &&
  p.followingId === n.followingId
));
FollowModal.displayName = 'FollowModal';

/* ─── Available Traders ─── */
const AvailableTraders = ({ onFollowSuccess }) => {
  const { t } = useTranslation();
  const { profileData } = useUserProfile();
  const [traders, setTraders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrader, setSelectedTrader] = useState(null);
  const [followAmount, setFollowAmount] = useState('');
  const [followingId, setFollowingId] = useState(null);
  const inputRef = useRef(null);

  const userBalance = (() => {
    if (!profileData?.balances) return 0;
    const u = profileData.balances.USDT;
    if (!u) return 0;
    return typeof u === 'object' ? parseFloat(u.total || u.available || 0) : parseFloat(u) || 0;
  })();

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await ApiUtils.get('/copy-trading/traders/available?limit=20');
        setTraders(res.data || []);
      } catch { showToast.error(t('copyTrading.failedToLoadTraders')); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleFollowTrader = async () => {
    if (!selectedTrader) return;
    const amount = parseFloat(followAmount);
    if (!amount || amount <= 0 || isNaN(amount) || amount > userBalance) {
      showToast.error(t('copyTrading.insufficientBalance', { balance: userBalance.toFixed(2), amount: (amount||0).toFixed(2) }));
      return;
    }
    try {
      setFollowingId(selectedTrader._id);
      await ApiUtils.post('/copy-trading/follow', { traderId: selectedTrader._id, initialAmount: amount });
      showToast.success(t('copyTrading.successfullyFollowing'));
      setFollowAmount('');
      setSelectedTrader(null);
      onFollowSuccess();
    } catch (e) {
      showToast.error(e.response?.data?.message || e.message || t('copyTrading.failedToLoadTraders'));
    } finally { setFollowingId(null); }
  };

  const handleCloseModal = useCallback(() => { setSelectedTrader(null); setFollowAmount(''); }, []);
  const handleAmountChange = useCallback((v) => setFollowAmount(v), []);

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <>
      <FollowModal
        selectedTrader={selectedTrader} userBalance={userBalance}
        followAmount={followAmount} followingId={followingId}
        onClose={handleCloseModal} onFollow={handleFollowTrader}
        onAmountChange={handleAmountChange} inputRef={inputRef}
      />
      {traders.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-[#EEF3FF] flex items-center justify-center mx-auto mb-4">
            <Users size={28} color="#0052FF" />
          </div>
          <p className="text-[#111111] font-semibold mb-1">{t('copyTrading.noTradersAvailable')}</p>
          <p className="text-[#888888] text-sm">{t('copyTrading.checkBackLater')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-12 gap-1 px-4 py-2.5 bg-[#F8FAFF] border-b border-[#F0F0F0]">
            <div className="col-span-5 text-[10px] font-bold text-[#888888] uppercase tracking-wider">{t('copyTrading.trader')}</div>
            <div className="col-span-2 text-[10px] font-bold text-[#888888] uppercase tracking-wider text-center">{t('copyTrading.winRate')}</div>
            <div className="col-span-2 text-[10px] font-bold text-[#888888] uppercase tracking-wider text-center">{t('copyTrading.followers')}</div>
            <div className="col-span-3 text-[10px] font-bold text-[#888888] uppercase tracking-wider text-right">{t('copyTrading.action')}</div>
          </div>
          {traders.map((trader, idx) => (
            <div key={trader._id} className={`grid grid-cols-12 gap-1 px-4 py-3 ${idx < traders.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}>
              {/* Trader */}
              <div className="col-span-5 flex items-center gap-2 min-w-0">
                {trader.profileImage
                  ? <img src={trader.profileImage} alt={trader.name} className="w-9 h-9 rounded-full shrink-0 object-cover" />
                  : <div className="w-9 h-9 rounded-full bg-[#EEF3FF] flex items-center justify-center shrink-0"><Users size={14} color="#0052FF" /></div>
                }
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-[#111111] truncate">{trader.name}</p>
                  <p className="text-[10px] text-[#0052FF]">{t('copyTrading.commission', { percent: trader.followerCommissionPercentage })}</p>
                </div>
              </div>
              {/* Win Rate circle */}
              <div className="col-span-2 flex items-center justify-center">
                <div className="relative w-10 h-10">
                  <svg className="w-10 h-10 -rotate-90">
                    <circle cx="20" cy="20" r="16" stroke="#EEF3FF" strokeWidth="3" fill="none" />
                    <circle cx="20" cy="20" r="16" stroke="#00A572" strokeWidth="3" fill="none"
                      strokeDasharray={`${2 * Math.PI * 16}`}
                      strokeDashoffset={`${2 * Math.PI * 16 * (1 - trader.winRate / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-[#111111]">{trader.winRate}%</span>
                  </div>
                </div>
              </div>
              {/* Followers */}
              <div className="col-span-2 flex flex-col items-center justify-center">
                <Users size={13} color="#0052FF" />
                <span className="text-[11px] font-bold text-[#111111] mt-0.5">{trader.totalFollowers || 0}</span>
              </div>
              {/* Follow btn */}
              <div className="col-span-3 flex items-center justify-end">
                <button
                  onClick={() => setSelectedTrader(trader)}
                  className="px-3 py-1.5 bg-[#0052FF] text-white rounded-lg text-[11px] font-semibold hover:bg-[#0041CC] transition-colors"
                >
                  {t('copyTrading.follow')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export const MemoizedAvailableTraders = memo(AvailableTraders);

/* ─── Main CopyTrading ─── */
const CopyTrading = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('my-traders');
  const [followings, setFollowings] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [dashRes, followRes] = await Promise.all([
        ApiUtils.get('/copy-trading/dashboard'),
        ApiUtils.get('/copy-trading/my-followings'),
      ]);
      setDashboard(dashRes.data);
      setFollowings(followRes.data);
    } catch { showToast.error(t('copyTrading.failedToLoadData')); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <Spinner />;

  const roi = dashboard?.totalInvested > 0
    ? ((dashboard.totalReturns / dashboard.totalInvested) * 100).toFixed(2)
    : '0.00';

  const tabs = [
    { key: 'my-traders', label: t('copyTrading.myTraders', { n: followings.length }) },
    { key: 'portfolio',  label: t('copyTrading.portfolio') },
    { key: 'available',  label: t('copyTrading.find') },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FA]">

      {/* Blue hero */}
      <div className="bg-linear-to-br from-[#0052FF] to-[#0041CC]">
        <div className="w-full max-w-md mx-auto px-4 pt-6 pb-20">

          {/* Top bar */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-white font-bold text-lg">{t('copyTrading.copyTrading')}</h1>
            <div className="w-9" />
          </div>

          {/* Hero icon + subtitle */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mb-3">
              <Users className="w-7 h-7 text-white" />
            </div>
            <p className="text-white/70 text-sm">{t('copyTrading.followExpertTraders')}</p>
          </div>

          {/* Stats row */}
          {dashboard && (
            <div className="flex justify-center gap-6">
              <div className="text-center">
                <p className="text-white font-bold text-lg">${dashboard.totalInvested?.toFixed(0) || '0'}</p>
                <p className="text-white/60 text-xs">{t('copyTrading.totalInvested')}</p>
              </div>
              <div className="w-px bg-white/20" />
              <div className="text-center">
                <p className="text-white font-bold text-lg">${dashboard.totalReturns?.toFixed(0) || '0'}</p>
                <p className="text-white/60 text-xs">{t('copyTrading.totalReturns')}</p>
              </div>
              <div className="w-px bg-white/20" />
              <div className="text-center">
                <p className="text-white font-bold text-lg">{roi}%</p>
                <p className="text-white/60 text-xs">{t('copyTrading.roi')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="w-full max-w-md mx-auto px-4 -mt-10 pb-32">

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
          <div className="flex border-b border-[#F0F0F0]">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-3 text-[12px] font-semibold transition-colors ${
                  activeTab === tab.key
                    ? 'text-[#0052FF] border-b-2 border-[#0052FF] -mb-px'
                    : 'text-[#AAAAAA]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── My Traders ── */}
          {activeTab === 'my-traders' && (
            <div>
              {followings.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-16 h-16 rounded-full bg-[#EEF3FF] flex items-center justify-center mx-auto mb-4">
                    <Users size={28} color="#0052FF" />
                  </div>
                  <p className="text-[#111111] font-semibold mb-1">{t('copyTrading.noActiveTraders')}</p>
                  <p className="text-[#888888] text-sm mb-5">{t('copyTrading.startFollowing')}</p>
                  <button
                    onClick={() => setActiveTab('available')}
                    className="px-6 py-2.5 bg-[#0052FF] text-white rounded-xl text-sm font-semibold hover:bg-[#0041CC] transition-colors"
                  >
                    {t('copyTrading.findTraders')}
                  </button>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-1 px-4 py-2.5 bg-[#F8FAFF] border-b border-[#F0F0F0]">
                    <div className="col-span-4 text-[10px] font-bold text-[#888888] uppercase tracking-wider">{t('copyTrading.trader')}</div>
                    <div className="col-span-2 text-[10px] font-bold text-[#888888] uppercase tracking-wider text-right">{t('copyTrading.invested')}</div>
                    <div className="col-span-3 text-[10px] font-bold text-[#888888] uppercase tracking-wider text-right">{t('copyTrading.balance')}</div>
                    <div className="col-span-3 text-[10px] font-bold text-[#888888] uppercase tracking-wider text-right">{t('copyTrading.returns')}</div>
                  </div>
                  {followings.map((f, idx) => {
                    const pl = f.totalReturns || 0;
                    const pct = f.initialAmount > 0 ? ((pl / f.initialAmount) * 100).toFixed(1) : '0.0';
                    return (
                      <div key={f._id} className={`grid grid-cols-12 gap-1 px-4 py-3 ${idx < followings.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}>
                        <div className="col-span-4 flex items-center gap-2 min-w-0">
                          {f.trader?.profileImage
                            ? <img src={f.trader.profileImage} alt={f.trader.name} className="w-8 h-8 rounded-full shrink-0 object-cover" />
                            : <div className="w-8 h-8 rounded-full bg-[#EEF3FF] flex items-center justify-center shrink-0"><Users size={12} color="#0052FF" /></div>
                          }
                          <div className="min-w-0">
                            <p className="text-[12px] font-bold text-[#111111] truncate">{f.trader?.name}</p>
                            <p className="text-[9px] text-[#00A572] font-semibold">{f.trader?.winRate}%</p>
                          </div>
                        </div>
                        <div className="col-span-2 flex items-center justify-end">
                          <span className="text-[12px] font-semibold text-[#111111]">${f.initialAmount?.toFixed(0)}</span>
                        </div>
                        <div className="col-span-3 flex items-center justify-end">
                          <span className="text-[12px] font-semibold text-[#0052FF]">${f.currentBalance?.toFixed(0)}</span>
                        </div>
                        <div className="col-span-3 flex flex-col items-end justify-center">
                          <span className={`text-[12px] font-bold ${pl >= 0 ? 'text-[#00A572]' : 'text-red-500'}`}>
                            {pl >= 0 ? '+' : ''}${pl.toFixed(0)}
                          </span>
                          <span className={`text-[9px] ${pl >= 0 ? 'text-[#00A572]' : 'text-red-400'}`}>
                            {pl >= 0 ? '+' : ''}{pct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* ── Portfolio ── */}
          {activeTab === 'portfolio' && (
            <div>
              {followings.length === 0 ? (
                <p className="text-[#888888] text-sm text-center py-16">{t('copyTrading.noActiveInvestments')}</p>
              ) : (
                followings.map((f, idx) => {
                  const pl = (f.currentBalance || 0) - (f.initialAmount || 0);
                  const plPct = f.initialAmount > 0 ? ((pl / f.initialAmount) * 100).toFixed(2) : '0.00';
                  return (
                    <div key={f._id} className={`flex items-center gap-3 px-4 py-3.5 ${idx < followings.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}>
                      {f.trader?.profileImage
                        ? <img src={f.trader.profileImage} alt={f.trader.name} className="w-10 h-10 rounded-full shrink-0 object-cover" />
                        : <div className="w-10 h-10 rounded-full bg-[#EEF3FF] flex items-center justify-center shrink-0"><Users size={16} color="#0052FF" /></div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#111111]">{f.trader?.name}</p>
                        <p className="text-xs text-[#888888]">{t('copyTrading.investedAmount', { amount: f.initialAmount?.toFixed(2) })}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-[#0052FF]">${f.currentBalance?.toFixed(2)}</p>
                        <p className={`text-xs font-semibold ${pl >= 0 ? 'text-[#00A572]' : 'text-red-500'}`}>
                          {pl >= 0 ? '+' : ''}${pl.toFixed(2)} ({plPct}%)
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── Find Traders ── */}
          {activeTab === 'available' && (
            <div className="p-0">
              <MemoizedAvailableTraders onFollowSuccess={fetchData} />
            </div>
          )}
        </div>

        {/* Active traders count card */}
        {dashboard && (
          <div className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[#EEF3FF] flex items-center justify-center">
                <Activity className="w-4 h-4 text-[#0052FF]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#111111]">{t('copyTrading.activeTraders')}</p>
                <p className="text-xs text-[#888888]">{t('copyTrading.currentlyFollowing', 'Currently following')}</p>
              </div>
            </div>
            <span className="text-xl font-extrabold text-[#0052FF]">{dashboard.activeFollowings || 0}</span>
          </div>
        )}

      </div>
      <Menu />
    </div>
  );
};

export default CopyTrading;
