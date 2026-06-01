import React, { useState, useEffect } from 'react';
import Spinner from './common/Spinner';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Coins, TrendingUp, Lock, Unlock,
  X, CheckCircle, RefreshCw, Loader2
} from 'lucide-react';
import { useUserAuth } from '../contexts/UserAuthContext';
import { stakingApi, userAuth } from '../services/api';
import { getCryptoLogoUrl, getCryptoFallbackUrls } from '../utils/logoService';
import showToast from '../utils/toast';
import toast from 'react-hot-toast';
import Menu from './Menu';
import { useTranslation } from 'react-i18next';

const Staking = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useUserAuth();
  const { t } = useTranslation();

  const [stakingPools, setStakingPools]     = useState([]);
  const [userPositions, setUserPositions]   = useState([]);
  const [stakingStats, setStakingStats]     = useState({});
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [activeTab, setActiveTab]           = useState('pools'); // 'pools' | 'positions'
  const [selectedPool, setSelectedPool]     = useState(null);
  const [stakeAmount, setStakeAmount]       = useState('');
  const [isStaking, setIsStaking]           = useState(false);
  const [showStakeSheet, setShowStakeSheet] = useState(false);
  const [showUnstakeSheet, setShowUnstakeSheet] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [processing, setProcessing]         = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) { navigate('/signin'); return; }
    if (user) fetchStakingData();
  }, [isAuthenticated, navigate, user]);

  const fetchStakingData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const authTest = await userAuth.checkAuth();
      if (!authTest?.user) { navigate('/signin'); return; }

      const [poolsData, positionsData] = await Promise.all([
        stakingApi.user.getPools().catch(() => ({ pools: [] })),
        stakingApi.user.getPositions().catch(() => ({ positions: [] })),
      ]);

      const pools     = poolsData?.data || poolsData?.pools || poolsData || [];
      const positions = positionsData?.data?.positions || positionsData?.positions || positionsData || [];
      const summary   = positionsData?.data?.summary || {};

      if (!summary.totalStaked && Array.isArray(positions)) {
        const calc = { totalStaked: 0, totalRewards: 0, activePositions: 0 };
        positions.forEach(p => {
          if (p.status === 'active') {
            calc.totalStaked   += p.amount || p.stakedAmount || 0;
            calc.totalRewards  += (p.totalRewardsEarned || 0) - (p.totalRewardsClaimed || 0) + (p.pendingRewards || 0);
            calc.activePositions++;
          }
        });
        setStakingStats(calc);
      } else {
        setStakingStats(summary);
      }

      setStakingPools(Array.isArray(pools) ? pools : []);
      setUserPositions(Array.isArray(positions) ? positions : []);
    } catch (err) {
      if (err.message?.includes('Session expired') || err.message?.includes('not authenticated')) {
        navigate('/signin');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStakingData(true);
  };

  const handleStake = async () => {
    if (!selectedPool || !stakeAmount || isStaking) return;
    const loadingToast = showToast.loading(t('staking.stakingTokens'));
    try {
      setIsStaking(true);
      const authCheck = await userAuth.checkAuth();
      if (!authCheck?.user) { showToast.error(t('staking.sessionExpired')); navigate('/signin'); return; }

      const response = await stakingApi.user.stake({
        poolId: selectedPool.id,
        amount: parseFloat(stakeAmount)
      });

      if (response.success || response.staked) {
        showToast.success(t('staking.successfullyStaked', {
          amount: stakeAmount,
          symbol: selectedPool.symbol || selectedPool.tokenSymbol
        }));
        setShowStakeSheet(false);
        setStakeAmount('');
        setSelectedPool(null);
        fetchStakingData(true);
      } else {
        showToast.error(response.message || t('staking.failedToStake'));
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || t('staking.failedToStake');
      if (msg.includes('User not found') || msg.includes('unauthorized')) {
        navigate('/signin');
      } else {
        showToast.error(msg);
      }
    } finally {
      setIsStaking(false);
      toast.dismiss(loadingToast);
    }
  };

  const handleUnstake = async () => {
    if (!selectedPosition || processing) return;
    if (getDaysRemaining(selectedPosition.canUnstakeAt) > 0) {
      showToast.error(t('staking.positionStillLocked', { n: getDaysRemaining(selectedPosition.canUnstakeAt) }));
      return;
    }
    const loadingToast = showToast.loading(t('staking.processingUnstaking'));
    try {
      setProcessing(true);
      const response = await stakingApi.user.unstake({
        positionId: selectedPosition.id || selectedPosition._id
      });
      if (response.success || response.unstaked) {
        const amount = response.amount || selectedPosition.amount || selectedPosition.stakedAmount;
        const token  = response.token  || selectedPosition.symbol || selectedPosition.tokenSymbol;
        showToast.success(t('staking.successfullyUnstaked', { amount, token }));
        setShowUnstakeSheet(false);
        setSelectedPosition(null);
        fetchStakingData(true);
      } else {
        showToast.error(response.message || t('staking.failedToUnstake'));
      }
    } catch (err) {
      showToast.error(err.response?.data?.message || err.message || t('staking.failedToUnstake'));
    } finally {
      setProcessing(false);
      toast.dismiss(loadingToast);
    }
  };

  /* ─── Helpers ─── */
  const getDaysRemaining = (ts) => {
    if (!ts) return 0;
    return Math.max(0, Math.ceil((new Date(ts).getTime() - Date.now()) / 86400000));
  };

  const fmt = (n, d = 2) => (isNaN(n) || !n) ? '0.00' : parseFloat(n).toFixed(d);

  const CoinLogo = ({ symbol }) => {
    const url = getCryptoLogoUrl(symbol);
    const fallbacks = getCryptoFallbackUrls(symbol);
    return (
      <div className="relative w-9 h-9 shrink-0">
        <img
          src={url}
          alt={symbol}
          className="w-9 h-9 rounded-full object-cover"
          onError={(e) => {
            const idx = parseInt(e.target.dataset.fi || '0');
            const next = idx + 1;
            if (next < fallbacks.length) {
              e.target.dataset.fi = next;
              e.target.src = fallbacks[next];
            } else {
              e.target.style.display = 'none';
              e.target.nextElementSibling.style.display = 'flex';
            }
          }}
        />
        <div
          className="w-9 h-9 rounded-full bg-[#F0F5FF] items-center justify-center text-xs font-bold text-[#0052FF]"
          style={{ display: 'none' }}
        >
          {symbol?.slice(0, 2)}
        </div>
      </div>
    );
  };

  if (loading) return <Spinner />;

  const sortedPools = [...stakingPools].sort((a, b) =>
    (b.lockPeriod || b.lockPeriodDays || 0) - (a.lockPeriod || a.lockPeriodDays || 0)
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full max-w-md mx-auto px-4 py-6 pb-32">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 text-[#555555] hover:text-[#0052FF] rounded-lg hover:bg-[#F0F5FF] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-[#111111]">{t('staking.title')}</h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-[#888888] hover:text-[#0052FF] rounded-lg hover:bg-[#F0F5FF] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats strip */}
        {(stakingStats.totalStaked > 0 || stakingStats.totalRewards > 0) && (
          <div className="flex gap-3 mb-5">
            <div className="flex-1 bg-[#F0F5FF] rounded-xl px-4 py-3">
              <p className="text-xs text-[#888888] mb-0.5">{t('staking.totalStaked')}</p>
              <p className="text-base font-bold text-[#111111]">${fmt(stakingStats.totalStaked)}</p>
            </div>
            <div className="flex-1 bg-[#F0F5FF] rounded-xl px-4 py-3">
              <p className="text-xs text-[#888888] mb-0.5">{t('staking.rewardsLabel')}</p>
              <p className="text-base font-bold text-green-600">${fmt(stakingStats.totalRewards)}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {[
            { key: 'pools',     label: t('staking.availablePools') },
            { key: 'positions', label: userPositions.length
                ? `${t('staking.myPositions')} (${userPositions.length})`
                : t('staking.myPositions') },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'bg-[#0052FF] text-white'
                  : 'bg-[#F0F5FF] text-[#0052FF]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Pools ── */}
        {activeTab === 'pools' && (
          sortedPools.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#F0F5FF] flex items-center justify-center">
                <Coins className="w-8 h-8 text-[#0052FF]" />
              </div>
              <p className="text-[#111111] font-semibold mb-1">{t('staking.noPoolsAvailable')}</p>
              <p className="text-[#888888] text-sm">{t('staking.noPoolsDesc')}</p>
            </div>
          ) : (
            <div>
              {sortedPools.map((pool) => {
                const symbol   = pool.symbol || pool.tokenSymbol;
                const isFull   = pool.totalPoolLimit && (pool.currentTotalStaked || 0) >= pool.totalPoolLimit;
                const inactive = !pool.isActive;
                return (
                  <div key={pool.id} className="flex items-center justify-between py-4 border-b border-[#F0F0F0] last:border-0">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <CoinLogo symbol={symbol} />
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#111111] truncate">{pool.name}</span>
                          {inactive
                            ? <span className="text-xs font-medium text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-md">{t('staking.inactive')}</span>
                            : isFull
                            ? <span className="text-xs font-medium text-[#888888] bg-[#F4F4F4] px-1.5 py-0.5 rounded-md">{t('staking.full')}</span>
                            : <span className="text-xs font-medium text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded-md">{t('staking.active')}</span>
                          }
                        </div>
                        <span className="text-xs text-[#AAAAAA]">
                          {symbol} · {t('common.min')} ${fmt(pool.minimumStake || pool.minStake || 0)} · {t('staking.dLock', { n: pool.lockPeriod || pool.lockPeriodDays || 0 })}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 ml-3 shrink-0">
                      <span className="text-sm font-bold text-green-600">{pool.apy || pool.apr || 0}% {t('staking.apy')}</span>
                      <button
                        disabled={inactive || isFull}
                        onClick={() => { setSelectedPool(pool); setShowStakeSheet(true); }}
                        className="text-xs font-semibold text-white px-3 py-1 rounded-full disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 100%)' }}
                      >
                        {t('staking.stakeAction')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── Positions ── */}
        {activeTab === 'positions' && (
          userPositions.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#F0F5FF] flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-[#0052FF]" />
              </div>
              <p className="text-[#111111] font-semibold mb-1">{t('staking.noPositionsYet')}</p>
              <p className="text-[#888888] text-sm mb-5">{t('staking.stakeToStart')}</p>
              <button
                onClick={() => setActiveTab('pools')}
                className="text-white text-sm font-semibold px-6 py-3 rounded-xl"
                style={{ background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 100%)' }}
              >
                {t('staking.browsePoolsBtn')}
              </button>
            </div>
          ) : (
            <div>
              {userPositions.map((pos) => {
                const symbol      = pos.symbol || pos.tokenSymbol;
                const daysLeft    = getDaysRemaining(pos.canUnstakeAt);
                const canUnstake  = daysLeft === 0;
                const pending     = pos.pendingRewards || 0;
                const earned      = pos.totalRewardsEarned || pos.totalEarned || 0;
                return (
                  <div key={pos.id || pos._id} className="py-4 border-b border-[#F0F0F0] last:border-0">
                    {/* Row 1: logo + name + lock badge */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <CoinLogo symbol={symbol} />
                        <div>
                          <p className="text-sm font-semibold text-[#111111]">{pos.poolName || symbol}</p>
                          <p className="text-xs text-[#AAAAAA]">{symbol} · {pos.lockedApy || pos.apy || 0}% {t('staking.apy')}</p>
                        </div>
                      </div>
                      {canUnstake
                        ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-500/10 px-2 py-0.5 rounded-md">
                            <CheckCircle className="w-3 h-3" /> {t('staking.unlocked')}
                          </span>
                        : <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0052FF] bg-[#0052FF]/10 px-2 py-0.5 rounded-md">
                            <Lock className="w-3 h-3" /> {t('staking.dLeft', { n: daysLeft })}
                          </span>
                      }
                    </div>

                    {/* Row 2: stats */}
                    <div className="flex items-center gap-4 ml-12 text-xs text-[#888888] mb-2.5">
                      <span>{t('staking.stakedLabel')} <span className="font-semibold text-[#111111]">{fmt(pos.amount || pos.stakedAmount, 4)}</span></span>
                      <span>{t('staking.pendingLabel')} <span className="font-semibold text-green-600">+{fmt(pending, 4)}</span></span>
                      <span>{t('staking.earnedLabel')} <span className="font-semibold text-green-600">+{fmt(earned, 4)}</span></span>
                    </div>

                    {/* Row 3: unstake button */}
                    <div className="ml-12">
                      {canUnstake ? (
                        <button
                          onClick={() => { setSelectedPosition(pos); setShowUnstakeSheet(true); }}
                          className="text-xs font-semibold text-white px-4 py-1.5 rounded-full"
                          style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
                        >
                          {t('staking.unstakeAction')}
                        </button>
                      ) : (
                        <span className="text-xs text-[#AAAAAA]">
                          {daysLeft === 1
                            ? t('staking.unlocksInDays', { n: daysLeft })
                            : t('staking.unlocksInDays', { n: daysLeft })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      <Menu />

      {/* ── Stake Bottom Sheet ── */}
      {showStakeSheet && selectedPool && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowStakeSheet(false); setStakeAmount(''); setSelectedPool(null); }} />
          <div className="relative bg-white rounded-t-3xl shadow-2xl w-full">
            <div className="flex flex-col px-5 pt-5 pb-28">
              <div className="w-10 h-1 bg-[#E0E0E0] rounded-full mx-auto mb-5" />
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-[#111111]">
                  {t('staking.stakeSymbol', { symbol: selectedPool.symbol || selectedPool.tokenSymbol })}
                </h2>
                <button onClick={() => { setShowStakeSheet(false); setStakeAmount(''); setSelectedPool(null); }}>
                  <X className="w-5 h-5 text-[#888888]" />
                </button>
              </div>

              {/* Pool info */}
              <div className="flex items-center gap-3 mb-4">
                <CoinLogo symbol={selectedPool.symbol || selectedPool.tokenSymbol} />
                <div>
                  <p className="text-sm font-semibold text-[#111111]">{selectedPool.name}</p>
                  <p className="text-xs text-[#888888]">{selectedPool.symbol || selectedPool.tokenSymbol}</p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {[
                  { label: t('staking.apy'),          value: `${selectedPool.apy || selectedPool.apr || 0}%`, valueClass: 'text-green-600' },
                  { label: t('staking.lockPeriod'),    value: `${selectedPool.lockPeriod || selectedPool.lockPeriodDays || 0} days` },
                  { label: t('staking.minStake'),      value: `$${fmt(selectedPool.minimumStake || selectedPool.minStake || 0)}`, valueClass: 'text-[#0052FF]' },
                  { label: t('staking.totalStaked'),   value: `$${fmt(selectedPool.currentTotalStaked || selectedPool.totalStaked || 0)}` },
                ].map(({ label, value, valueClass }) => (
                  <div key={label} className="flex justify-between py-2 border-b border-[#F0F0F0] last:border-0">
                    <span className="text-xs text-[#888888]">{label}</span>
                    <span className={`text-xs font-semibold ${valueClass || 'text-[#111111]'}`}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Amount input */}
              <div className="mb-5">
                <label className="text-xs text-[#888888] mb-1.5 block">{t('staking.amountToStake')}</label>
                <div className="flex items-center border-b-2 border-[#0052FF] pb-1">
                  <input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder={`${t('common.min')}. ${selectedPool.minimumStake || selectedPool.minStake || 0}`}
                    className="flex-1 bg-transparent text-base font-semibold text-[#111111] outline-none placeholder-[#DDDDDD] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    min={selectedPool.minimumStake || selectedPool.minStake || 0}
                    step="0.01"
                  />
                  <span className="text-xs font-semibold text-[#888888]">{selectedPool.symbol || selectedPool.tokenSymbol}</span>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowStakeSheet(false); setStakeAmount(''); setSelectedPool(null); }}
                  disabled={isStaking}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-[#555555] bg-[#F4F4F4] disabled:opacity-50"
                >
                  {t('staking.cancel')}
                </button>
                <button
                  onClick={handleStake}
                  disabled={!stakeAmount || parseFloat(stakeAmount) < (selectedPool.minimumStake || selectedPool.minStake || 0) || isStaking}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 100%)' }}
                >
                  {isStaking
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('staking.stakingEllipsis')}</>
                    : t('staking.stakeNow')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Unstake Bottom Sheet ── */}
      {showUnstakeSheet && selectedPosition && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowUnstakeSheet(false); setSelectedPosition(null); }} />
          <div className="relative bg-white rounded-t-3xl shadow-2xl w-full">
            <div className="flex flex-col px-5 pt-5 pb-28">
              <div className="w-10 h-1 bg-[#E0E0E0] rounded-full mx-auto mb-5" />
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-[#111111]">
                  {t('staking.unstakeSymbol', { symbol: selectedPosition.symbol || selectedPosition.tokenSymbol })}
                </h2>
                <button onClick={() => { setShowUnstakeSheet(false); setSelectedPosition(null); }}>
                  <X className="w-5 h-5 text-[#888888]" />
                </button>
              </div>

              {/* Position info */}
              <div className="flex items-center gap-3 mb-4">
                <CoinLogo symbol={selectedPosition.symbol || selectedPosition.tokenSymbol} />
                <div>
                  <p className="text-sm font-semibold text-[#111111]">{selectedPosition.poolName || selectedPosition.poolId?.name}</p>
                  <p className="text-xs text-[#888888]">
                    {t('staking.stakedInfo', {
                      amount: fmt(selectedPosition.amount || selectedPosition.stakedAmount, 4),
                      symbol: selectedPosition.symbol || selectedPosition.tokenSymbol
                    })}
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-5">
                {[
                  { label: t('staking.stakedLabel'),    value: fmt(selectedPosition.amount || selectedPosition.stakedAmount, 4) },
                  { label: t('staking.pendingRewards'), value: fmt(selectedPosition.pendingRewards || 0, 4), valueClass: 'text-green-600' },
                  { label: t('staking.totalEarned'),    value: fmt(selectedPosition.totalRewardsEarned || 0, 4), valueClass: 'text-green-600' },
                ].map(({ label, value, valueClass }) => (
                  <div key={label} className="flex justify-between py-2 border-b border-[#F0F0F0] last:border-0">
                    <span className="text-xs text-[#888888]">{label}</span>
                    <span className={`text-xs font-semibold ${valueClass || 'text-[#111111]'}`}>{value}</span>
                  </div>
                ))}
              </div>

              {getDaysRemaining(selectedPosition.canUnstakeAt) > 0 && (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl mb-5">
                  <Lock className="w-4 h-4 text-red-400 shrink-0" />
                  <p className="text-xs text-red-500 font-medium">
                    {getDaysRemaining(selectedPosition.canUnstakeAt) === 1
                      ? t('staking.stillLockedFor', { n: getDaysRemaining(selectedPosition.canUnstakeAt) })
                      : t('staking.stillLockedForPlural', { n: getDaysRemaining(selectedPosition.canUnstakeAt) })}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowUnstakeSheet(false); setSelectedPosition(null); }}
                  disabled={processing}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-[#555555] bg-[#F4F4F4] disabled:opacity-50"
                >
                  {t('staking.cancel')}
                </button>
                {getDaysRemaining(selectedPosition.canUnstakeAt) === 0 ? (
                  <button
                    onClick={handleUnstake}
                    disabled={processing}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
                  >
                    {processing
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('staking.processing')}</>
                      : <><Unlock className="w-4 h-4" /> {t('staking.unstake')}</>}
                  </button>
                ) : (
                  <div className="flex-1 py-3 rounded-xl text-sm font-semibold text-center text-[#888888] bg-[#F4F4F4]">
                    <Lock className="w-4 h-4 inline mr-1" />
                    {t('staking.lockedBadge')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staking;
