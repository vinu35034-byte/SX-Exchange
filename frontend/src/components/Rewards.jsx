import React, { useState, useEffect } from 'react';
import Spinner from './common/Spinner';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Gift, Crown, Users, Clock,
  CheckCircle, XCircle, RefreshCw, Lock, Loader2
} from 'lucide-react';
import { useUserAuth } from '../contexts/UserAuthContext';
import showToast from '../utils/toast';
import { ApiUtils } from '../services/api';
import Menu from './Menu';
import { useTranslation } from 'react-i18next';

const Rewards = () => {
  const navigate   = useNavigate();
  const { isAuthenticated } = useUserAuth();
  const { t }      = useTranslation();

  const [dashboardData, setDashboardData] = useState(null);
  const [vipLevels, setVipLevels]         = useState([]);
  const [rewardHistory, setRewardHistory] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [claimLoading, setClaimLoading]   = useState(false);
  const [activeTab, setActiveTab]         = useState('overview'); // overview | levels | history

  /* ─── Data fetching ─── */
  const fetchDashboard = async () => {
    try {
      const res = await ApiUtils.get('/rewards/dashboard');
      setDashboardData(res);
    } catch (err) {
      if (err.message?.includes('Session expired')) { navigate('/signin'); return; }
      showToast.error(t('rewards.failedToLoadDashboard'));
    }
  };

  const fetchVIPLevels = async () => {
    try {
      const res = await ApiUtils.get('/rewards/levels');
      setVipLevels(res.vipLevels || []);
    } catch (err) {
      if (!err.message?.includes('Session expired')) showToast.error(t('rewards.failedToLoadLevels'));
    }
  };

  const fetchRewardHistory = async () => {
    try {
      const res = await ApiUtils.get('/rewards/reward-history?limit=20');
      setRewardHistory(res.rewards || []);
    } catch { /* non-critical */ }
  };

  const createDailyReward = async () => {
    try {
      const res = await ApiUtils.post('/rewards/daily-reward');
      if (res.success) { showToast.success(t('rewards.dailyRewardCreated')); fetchDashboard(); }
      else showToast.error(res.message || t('rewards.failedToCreateDailyReward'));
    } catch (err) {
      if (!err.message?.includes('Session expired')) showToast.error(t('rewards.failedToCreateDailyReward'));
    }
  };

  const claimReward = async (rewardId) => {
    setClaimLoading(true);
    try {
      const res = await ApiUtils.post(`/rewards/claim/${rewardId}`);
      if (res.success) {
        showToast.success(t('rewards.rewardClaimed', { amount: res.reward.amount, currency: res.reward.currency }));
        await fetchDashboard();
        await fetchRewardHistory();
      } else {
        showToast.error(res.message || t('rewards.failedToClaimReward'));
      }
    } catch (err) {
      if (!err.message?.includes('Session expired')) showToast.error(err.message || t('rewards.failedToClaimReward'));
    } finally {
      setClaimLoading(false);
    }
  };

  const upgradeLevel = async () => {
    try {
      const res = await ApiUtils.post('/rewards/update-level');
      if (res.success) {
        showToast.success(t('rewards.congratsUpgraded', { n: res.newLevel, reward: res.upgradeReward }));
        fetchDashboard();
      } else {
        showToast.error(res.message || t('rewards.failedToUpgradeVip'));
      }
    } catch (err) {
      if (!err.message?.includes('Session expired')) showToast.error(t('rewards.failedToUpgradeVip'));
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchVIPLevels(),
          isAuthenticated() ? fetchDashboard() : Promise.resolve(),
          isAuthenticated() ? fetchRewardHistory() : Promise.resolve(),
        ]);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated()) return;
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    const onExpired = () => { showToast.error(t('rewards.sessionExpiredRedirecting')); setTimeout(() => navigate('/signin'), 1500); };
    window.addEventListener('sessionExpired', onExpired);
    return () => window.removeEventListener('sessionExpired', onExpired);
  }, [navigate]);

  /* ─── Helpers ─── */
  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const vipColor = (level) => {
    const map = {
      0: '#CCA400', 1: '#9ca3af', 2: '#eab308', 3: '#3b82f6',
      4: '#a855f7', 5: '#22c55e', 6: '#ef4444', 7: '#6366f1',
      8: '#ec4899', 9: '#f97316', 10: '#06b6d4'
    };
    return map[level] ?? '#CCA400';
  };

  const VIPBadge = ({ level, size = 40 }) => (
    <div
      className="rounded-xl flex items-center justify-center font-bold text-white text-xs shrink-0"
      style={{ width: size, height: size, background: vipColor(level) }}
    >
      V{level}
    </div>
  );

  const progress = dashboardData?.progressToNext;
  const canUpgrade = progress?.level1Referrals && progress?.totalReferrals &&
    progress.level1Referrals.current >= progress.level1Referrals.required &&
    progress.totalReferrals.current >= progress.totalReferrals.required;

  /* ─── Not authenticated ─── */
  if (!isAuthenticated()) {
    return (
      <div className="min-h-screen bg-white">
        <div className="w-full max-w-md mx-auto px-4 py-6 pb-32">
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => navigate('/')} className="p-2 text-[#555555] hover:text-[#0052FF] rounded-lg hover:bg-[#F0F5FF]">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-[#111111]">{t('rewards.title')}</h1>
          </div>
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#F0F5FF] flex items-center justify-center">
              <Gift className="w-8 h-8 text-[#0052FF]" />
            </div>
            <p className="text-[#111111] font-semibold mb-1">{t('rewards.signInRequiredTitle')}</p>
            <p className="text-[#888888] text-sm mb-6">{t('rewards.signInToViewRewards')}</p>
            <button
              onClick={() => navigate('/signin')}
              className="text-white text-sm font-semibold px-6 py-3 rounded-xl"
              style={{ background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 100%)' }}
            >
              {t('rewards.signIn')}
            </button>
          </div>
        </div>
        <Menu />
      </div>
    );
  }

  if (loading) return <Spinner />;

  const d   = dashboardData;
  const lvl = d?.user?.vipLevel ?? 0;

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
            <h1 className="text-xl font-bold text-[#111111]">{t('rewards.title')}</h1>
          </div>
          <button
            onClick={() => { fetchDashboard(); fetchRewardHistory(); }}
            className="p-2 text-[#888888] hover:text-[#0052FF] rounded-lg hover:bg-[#F0F5FF] transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* VIP status strip */}
        {d && (
          <div className="flex items-center gap-3 bg-[#F0F5FF] rounded-2xl px-4 py-3 mb-5">
            <VIPBadge level={lvl} size={44} />
            <div className="flex-1">
              <p className="text-sm font-bold text-[#111111]">
                {d.currentLevelInfo?.name || t('rewards.vipLevel', { n: lvl })}
              </p>
              <p className="text-xs text-[#888888]">
                {t('rewards.directCount', { n: d.user.referralStats?.multiLevelStats?.level1Referrals ?? 0 })} ·{' '}
                {t('rewards.totalReferralCount', { n: d.user.referralStats?.multiLevelStats?.totalMultiLevelReferrals ?? 0 })}
              </p>
            </div>
            {d.currentLevelInfo?.dailyReward > 0 && (
              <div className="text-right">
                <p className="text-sm font-bold text-green-600">${d.currentLevelInfo.dailyReward}</p>
                <p className="text-xs text-[#888888]">{t('rewards.perMonth')}</p>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-0.5 scrollbar-hide">
          {[
            { key: 'overview', label: t('rewards.overviewTab') },
            { key: 'levels',   label: t('rewards.vipLevelsTab') },
            { key: 'history',  label: rewardHistory.length
                ? t('rewards.historyTabCount', { n: rewardHistory.length })
                : t('rewards.historyTab') },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeTab === tab.key ? 'bg-[#0052FF] text-white' : 'bg-[#F0F5FF] text-[#0052FF]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div>
            {/* Monthly Reward */}
            <div className="mb-1">
              <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-3">{t('rewards.monthlyRewardSection')}</p>
              {d?.currentLevelInfo?.dailyReward > 0 ? (
                <div>
                  {d.todaysReward ? (
                    d.todaysReward.status === 'pending' ? (
                      <button
                        onClick={() => claimReward(d.todaysReward._id)}
                        disabled={claimLoading}
                        className="w-full py-3.5 rounded-xl text-sm font-semibold text-white mb-3 flex items-center justify-center gap-2 disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
                      >
                        {claimLoading
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('rewards.claimingEllipsis')}</>
                          : <><Gift className="w-4 h-4" /> {t('rewards.claimMonthlyBtn', { amount: d.currentLevelInfo.dailyReward })}</>
                        }
                      </button>
                    ) : (
                      <div className="flex items-center gap-3 py-4 border-b border-[#F0F0F0] mb-3">
                        <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#111111]">{t('rewards.claimedThisMonth')}</p>
                          <p className="text-xs text-[#888888]">{t('rewards.comeBackNextMonth')}</p>
                        </div>
                        <span className="ml-auto text-sm font-bold text-green-600">${d.currentLevelInfo.dailyReward}</span>
                      </div>
                    )
                  ) : (
                    <button
                      onClick={createDailyReward}
                      className="w-full py-3.5 rounded-xl text-sm font-semibold text-white mb-3 flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 100%)' }}
                    >
                      <Gift className="w-4 h-4" /> {t('rewards.generateMonthlyReward')}
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 py-4 border-b border-[#F0F0F0] mb-3">
                  <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5 text-[#AAAAAA]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#111111]">{t('rewards.monthlyRewardsLocked')}</p>
                    <p className="text-xs text-[#888888]">{t('rewards.upgradeToUnlockMonthly')}</p>
                  </div>
                  <button
                    onClick={() => navigate('/referrals')}
                    className="ml-auto text-xs font-semibold text-[#0052FF] shrink-0"
                  >
                    {t('rewards.referLink')}
                  </button>
                </div>
              )}
            </div>

            {/* Pending / Unclaimed rewards */}
            {d?.unclaimedRewardsList?.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-3">{t('rewards.pendingRewardsHeading')}</p>
                {d.unclaimedRewardsList.map((reward) => (
                  <div key={reward._id} className="flex items-center justify-between py-4 border-b border-[#F0F0F0] last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                        <Gift className="w-4 h-4 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#111111] capitalize">
                          {reward.rewardType === 'daily'
                            ? t('rewards.rewardTypeDailyLabel')
                            : `${reward.rewardType} ${t('rewards.rewardTypeGenericLabel')}`}
                        </p>
                        {reward.expiresAt && (
                          <p className="text-xs text-red-400">{t('rewards.expiresDate', { date: formatDate(reward.expiresAt) })}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-green-600">${reward.amount}</span>
                      <button
                        onClick={() => claimReward(reward._id)}
                        disabled={claimLoading}
                        className="text-xs font-semibold text-white px-3 py-1.5 rounded-full disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
                      >
                        {claimLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : t('rewards.claimButton')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Progress to next level */}
            {d?.nextLevelInfo && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-3">
                  {t('rewards.progressTo', { name: d.nextLevelInfo.name })}
                </p>

                {progress ? (
                  <div className="space-y-4">
                    {/* Direct referrals bar */}
                    {progress.level1Referrals && (
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-[#888888]">{t('rewards.directReferralsLabel')}</span>
                          <span className="font-semibold text-[#111111]">
                            {progress.level1Referrals.current} / {progress.level1Referrals.required}
                          </span>
                        </div>
                        <div className="h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
                          <div
                            className="h-2 rounded-full bg-[#0052FF] transition-all duration-500"
                            style={{ width: `${Math.min(100, progress.level1Referrals.progress || 0)}%` }}
                          />
                        </div>
                        {progress.level1Referrals.remaining > 0 && (
                          <p className="text-xs text-[#AAAAAA] mt-1">
                            {t('rewards.moreNeeded', { n: progress.level1Referrals.remaining })}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Total referrals bar */}
                    {progress.totalReferrals && (
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-[#888888]">{t('rewards.totalReferralsLabel')}</span>
                          <span className="font-semibold text-[#111111]">
                            {progress.totalReferrals.current} / {progress.totalReferrals.required}
                          </span>
                        </div>
                        <div className="h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
                          <div
                            className="h-2 rounded-full bg-green-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, progress.totalReferrals.progress || 0)}%` }}
                          />
                        </div>
                        {progress.totalReferrals.remaining > 0 && (
                          <p className="text-xs text-[#AAAAAA] mt-1">
                            {t('rewards.moreNeeded', { n: progress.totalReferrals.remaining })}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Multi-level breakdown */}
                    {progress.breakdown && (
                      <div className="flex gap-3">
                        {[
                          { label: 'L1', val: progress.breakdown.level1, color: 'text-[#0052FF] bg-[#F0F5FF]' },
                          { label: 'L2', val: progress.breakdown.level2, color: 'text-green-600 bg-green-500/10' },
                          { label: 'L3', val: progress.breakdown.level3, color: 'text-purple-600 bg-purple-500/10' },
                        ].map(({ label, val, color }) => (
                          <div key={label} className={`flex-1 rounded-xl px-3 py-2 text-center ${color}`}>
                            <p className="text-base font-bold">{val || 0}</p>
                            <p className="text-xs opacity-70">{label}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upgrade reward info */}
                    <div className="flex items-center justify-between py-3 border-t border-[#F0F0F0]">
                      <div>
                        <p className="text-sm text-[#888888]">{t('rewards.upgradeRewardInfo')}</p>
                        <p className="text-xs text-[#AAAAAA]">{t('rewards.oneTimeOnReaching', { name: d.nextLevelInfo.name })}</p>
                      </div>
                      <span className="text-base font-bold text-[#0052FF]">
                        ${d.nextLevelInfo.oneTimeUpgradeReward || 0}
                      </span>
                    </div>

                    {canUpgrade && (
                      <button
                        onClick={upgradeLevel}
                        className="w-full py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
                        style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
                      >
                        <Crown className="w-4 h-4" /> {t('rewards.upgradeTo', { name: d.nextLevelInfo.name })}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 py-4">
                    <RefreshCw className="w-4 h-4 text-[#AAAAAA]" />
                    <p className="text-sm text-[#888888]">{t('rewards.progressEllipsis')}</p>
                    <button onClick={fetchDashboard} className="ml-auto text-xs text-[#0052FF] font-semibold">{t('rewards.refresh')}</button>
                  </div>
                )}
              </div>
            )}

            {/* Refer friends CTA */}
            <div className="flex items-center justify-between py-4 border-t border-[#F0F0F0]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-[#0052FF]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#111111]">{t('rewards.referFriends')}</p>
                  <p className="text-xs text-[#888888]">{t('rewards.earnForReferral')}</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/referrals')}
                className="text-xs font-semibold text-white px-4 py-2 rounded-full"
                style={{ background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 100%)' }}
              >
                {t('rewards.referNow')}
              </button>
            </div>
          </div>
        )}

        {/* ── VIP Levels ── */}
        {activeTab === 'levels' && (
          <div>
            {vipLevels
              .filter(level => {
                const isCurrent  = lvl === level.level;
                const isNext     = lvl + 1 === level.level;
                const isLocked   = lvl < level.level;
                return isCurrent || isNext || isLocked;
              })
              .map((level) => {
                const isCurrent  = lvl === level.level;
                const isUnlocked = lvl >= level.level;
                const isNext     = lvl + 1 === level.level;

                return (
                  <div key={level.level} className="flex items-start gap-3 py-4 border-b border-[#F0F0F0] last:border-0">
                    <VIPBadge level={level.level} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-[#111111]">{level.name}</span>
                        {isCurrent  && <span className="text-xs font-semibold text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded-md">{t('rewards.currentBadge')}</span>}
                        {isNext     && <span className="text-xs font-semibold text-[#0052FF] bg-[#F0F5FF] px-1.5 py-0.5 rounded-md">{t('rewards.nextBadge')}</span>}
                        {!isUnlocked && !isNext && <span className="inline-flex items-center gap-1 text-xs text-[#AAAAAA] bg-[#F4F4F4] px-1.5 py-0.5 rounded-md"><Lock className="w-2.5 h-2.5" /> {t('rewards.lockedBadge')}</span>}
                      </div>
                      <p className="text-xs text-[#AAAAAA]">
                        {t('rewards.directCount', { n: level.minimumLevel1Referrals || 0 })} · {t('rewards.totalReferralCount', { n: level.minimumTotalReferrals || 0 })}
                      </p>

                      {/* Progress bar for next level */}
                      {isNext && progress?.overall != null && (
                        <div className="mt-2">
                          <div className="h-1.5 bg-[#F0F0F0] rounded-full overflow-hidden">
                            <div
                              className="h-1.5 rounded-full bg-[#0052FF] transition-all duration-500"
                              style={{ width: `${Math.min(100, progress.overall || 0)}%` }}
                            />
                          </div>
                          <p className="text-xs text-[#AAAAAA] mt-0.5">{t('rewards.percentComplete', { n: Math.round(progress.overall || 0) })}</p>
                        </div>
                      )}

                      {/* Upgrade button */}
                      {isNext && canUpgrade && (
                        <button
                          onClick={upgradeLevel}
                          className="mt-2 text-xs font-semibold text-white px-3 py-1.5 rounded-full"
                          style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
                        >
                          {t('rewards.upgradeNow')}
                        </button>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-green-600">${level.dailyReward}<span className="text-xs font-normal text-[#888888]">{t('rewards.perMo')}</span></p>
                      <p className="text-xs text-[#AAAAAA]">{t('rewards.upgradeBonus', { n: level.oneTimeUpgradeReward || 0 })}</p>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* ── History ── */}
        {activeTab === 'history' && (
          rewardHistory.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#F0F5FF] flex items-center justify-center">
                <Clock className="w-8 h-8 text-[#0052FF]" />
              </div>
              <p className="text-[#111111] font-semibold mb-1">{t('rewards.noRewardHistory')}</p>
              <p className="text-[#888888] text-sm">{t('rewards.claimedRewardsWillAppear')}</p>
            </div>
          ) : (
            <div>
              {rewardHistory.map((reward) => {
                const sc = reward.status === 'claimed'
                  ? { color: 'text-green-600 bg-green-500/10', icon: <CheckCircle className="w-3 h-3" />, label: t('rewards.claimedStatus') }
                  : reward.status === 'expired'
                  ? { color: 'text-red-400 bg-red-500/10',     icon: <XCircle className="w-3 h-3" />,    label: t('rewards.expiredStatus') }
                  : { color: 'text-[#0052FF] bg-[#0052FF]/10', icon: <Clock className="w-3 h-3" />,      label: t('rewards.pendingStatus') };

                return (
                  <div key={reward._id} className="flex items-center justify-between py-4 border-b border-[#F0F0F0] last:border-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-[#111111] capitalize">
                        {reward.rewardType === 'daily'
                          ? t('rewards.rewardTypeDailyLabel')
                          : `${reward.rewardType} ${t('rewards.rewardTypeGenericLabel')}`}
                      </span>
                      <span className="text-xs text-[#AAAAAA]">{formatDate(reward.createdAt)}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-[#111111]">
                        +{reward.amount}
                        <span className="text-xs font-medium text-[#888888] ml-1">{reward.currency}</span>
                      </p>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-md mt-0.5 ${sc.color}`}>
                        {sc.icon} {sc.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      <Menu />
    </div>
  );
};

export default Rewards;
