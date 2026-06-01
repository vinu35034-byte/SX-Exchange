import React, { useState, useEffect } from 'react';
import Spinner from '../common/Spinner';
import { useNavigate } from 'react-router-dom';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { useTranslation } from 'react-i18next';
import { ApiUtils } from '../../services/api';
import { showToast } from '../../utils/toast';
import {
  ArrowLeft, Users, Gift, Copy, Share2,
  Check, Clock, DollarSign, Link, ChevronRight
} from 'lucide-react';
import Menu from '../Menu';

const Referrals = () => {
  const navigate  = useNavigate();
  const { user }  = useUserAuth();
  const { t }     = useTranslation();

  const [loading, setLoading]               = useState(true);
  const [referralData, setReferralData]     = useState(null);
  const [referralSettings, setReferralSettings] = useState(null);
  const [multilevelStats, setMultilevelStats]   = useState(null);
  const [copying, setCopying]               = useState(false);

  useEffect(() => {
    fetchReferralData();
    fetchReferralSettings();
    fetchMultilevelStats();
  }, []);

  const fetchReferralData = async () => {
    try {
      const response = await ApiUtils.get('/referrals/dashboard');
      setReferralData(response);
    } catch (error) {
      console.error('Error fetching referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReferralSettings = async () => {
    try {
      const response = await ApiUtils.get('/referrals/settings');
      setReferralSettings(response);
    } catch (error) {
      console.error('Error fetching referral settings:', error);
    }
  };

  const fetchMultilevelStats = async () => {
    try {
      const response = await ApiUtils.get('/referrals/stats');
      setMultilevelStats(response);
    } catch (error) {
      console.error('Error fetching multilevel stats:', error);
    }
  };

  const copyToClipboard = async (text, type) => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(text);
      showToast.success(`${type} copied!`);
    } catch {
      showToast.error(t('referrals.failedToCopy'));
    }
    setCopying(false);
  };

  const shareReferral = async () => {
    const rewardAmount = referralSettings?.defaultReferrerReward || 5;
    const appName      = referralSettings?.appName || 'CryptoTrader';
    if (navigator.share && referralData) {
      try {
        await navigator.share({
          title: `Join me on ${appName}!`,
          text: `Use my referral code ${referralData.referralCode} to get started and earn $${rewardAmount} USDT!`,
          url: referralData.referralLink
        });
      } catch { /* user cancelled */ }
    } else {
      copyToClipboard(referralData.referralLink, 'Referral link');
    }
  };

  if (loading) return <Spinner />;

  const rewardAmount    = referralSettings?.defaultReferrerReward || 5;
  const minDeposit      = referralSettings?.minimumDepositAmount  || 10;
  const stats           = referralData?.statistics || {};
  const directSuccess   = stats.successfulReferrals || 0;
  const directPending   = stats.pendingReferrals    || 0;
  const mlSuccess       = multilevelStats?.multiLevelStats?.totalSuccessfulReferrals
                        || multilevelStats?.totalSuccessfulMultiLevel
                        || stats.totalMultiLevelSuccessful || 0;
  const mlPending       = multilevelStats?.multiLevelStats?.totalPendingReferrals
                        || multilevelStats?.totalPendingMultiLevel
                        || stats.totalMultiLevelPending || 0;
  const totalSuccess    = directSuccess + mlSuccess;
  const directRewards   = stats.totalReferralRewards  || 0;
  const tradingBonuses  = stats.totalTradingBonuses   || 0;
  const totalEarnings   = (directRewards + tradingBonuses).toFixed(2);

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-24">

      {/* Blue hero header */}
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
            <h1 className="text-white font-bold text-lg">{t('referrals.referrals')}</h1>
            <div className="w-9" />
          </div>

          {/* Hero stats */}
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mb-4">
              <Gift className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-white font-bold text-2xl mb-1">{t('referrals.inviteFriendsEarn')}</h2>
            <p className="text-white/70 text-sm mb-6">
              {t('referrals.earnForEachFriend', { amount: rewardAmount, min: minDeposit })}
            </p>

            {/* Stats row */}
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-white font-bold text-2xl">{totalSuccess}</p>
                <p className="text-white/60 text-xs">{t('referrals.totalSuccessfulReferrals')}</p>
              </div>
              <div className="w-px bg-white/20" />
              <div className="text-center">
                <p className="text-white font-bold text-2xl">${totalEarnings}</p>
                <p className="text-white/60 text-xs">{t('referrals.totalEarnings')}</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Content */}
      <div className="w-full max-w-md mx-auto px-4 -mt-10">

        {/* Share card */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1 mb-2">
            {t('referrals.shareReferralLink')}
          </p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

            {/* Referral code row */}
            <button
              onClick={() => copyToClipboard(referralData?.referralCode, t('referrals.referralCodeCopied'))}
              disabled={copying}
              className="w-full flex items-center gap-3 px-4 py-4 border-b border-[#F0F0F0] hover:bg-[#FAFAFA] transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
                <Copy className="w-4 h-4 text-[#0052FF]" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-[#111111]">{t('referrals.copyCode')}</p>
                <p className="text-xs font-mono text-[#0052FF] tracking-wider">{referralData?.referralCode || '—'}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#AAAAAA] shrink-0" />
            </button>

            {/* Copy link row */}
            <button
              onClick={() => copyToClipboard(referralData?.referralLink, t('referrals.referralLinkCopied'))}
              disabled={copying}
              className="w-full flex items-center gap-3 px-4 py-4 border-b border-[#F0F0F0] hover:bg-[#FAFAFA] transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
                <Link className="w-4 h-4 text-[#0052FF]" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-[#111111]">{t('referrals.copyLink')}</p>
                <p className="text-xs text-[#888888] truncate">{referralData?.referralLink || '—'}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#AAAAAA] shrink-0" />
            </button>

            {/* Share row */}
            <button
              onClick={shareReferral}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-[#FAFAFA] transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
                <Share2 className="w-4 h-4 text-[#0052FF]" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-[#111111]">{t('referrals.shareReferralLink')}</p>
                <p className="text-xs text-[#888888]">{t('referrals.shareViaSocialMedia')}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#AAAAAA] shrink-0" />
            </button>

          </div>
        </div>

        {/* Statistics */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1 mb-2">
            {t('referrals.yourStatistics')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: t('referrals.successful'),  value: directSuccess, sub: t('referrals.direct'),     color: 'text-green-600', bg: 'bg-green-50',     icon: <Check className="w-4 h-4 text-green-500" /> },
              { label: t('referrals.pending'),      value: directPending, sub: t('referrals.direct'),     color: 'text-[#0052FF]', bg: 'bg-[#F0F5FF]',   icon: <Clock className="w-4 h-4 text-[#0052FF]" /> },
              { label: t('referrals.successful'),   value: mlSuccess,     sub: t('referrals.multiLevel'), color: 'text-green-600', bg: 'bg-green-50',     icon: <Users className="w-4 h-4 text-green-500" /> },
              { label: t('referrals.pending'),      value: mlPending,     sub: t('referrals.multiLevel'), color: 'text-[#0052FF]', bg: 'bg-[#F0F5FF]',   icon: <Clock className="w-4 h-4 text-[#0052FF]" /> },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm p-4">
                <div className={`w-8 h-8 rounded-xl ${item.bg} flex items-center justify-center mb-3`}>
                  {item.icon}
                </div>
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs font-semibold text-[#111111] mt-0.5">{item.label}</p>
                <p className="text-xs text-[#888888]">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Earnings */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1 mb-2">
            {t('referrals.yourEarnings')}
          </p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-4 border-b border-[#F0F0F0]">
              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4 text-green-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#111111]">{t('referrals.directReferralRewards')}</p>
                <p className="text-xs text-[#888888]">{t('referrals.fromSuccessfulDirectReferrals')}</p>
              </div>
              <p className="text-sm font-bold text-green-600">${directRewards} USDT</p>
            </div>
            <div className="flex items-center gap-3 px-4 py-4 border-b border-[#F0F0F0]">
              <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
                <Gift className="w-4 h-4 text-[#0052FF]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#111111]">{t('referrals.tradingBonuses')}</p>
                <p className="text-xs text-[#888888]">{t('referrals.multiLevelTradingCommissions')}</p>
              </div>
              <p className="text-sm font-bold text-[#0052FF]">${tradingBonuses} USDT</p>
            </div>
            <div className="flex items-center gap-3 px-4 py-4 bg-[#F0F5FF]/60">
              <div className="w-9 h-9 rounded-xl bg-[#0052FF] flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-[#111111]">{t('referrals.totalEarnings')}</p>
                <p className="text-xs text-[#888888]">{t('referrals.lifetimeReferralEarnings')}</p>
              </div>
              <p className="text-base font-bold text-[#0052FF]">${totalEarnings} USDT</p>
            </div>
          </div>
        </div>

        {/* Recent referrals */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1 mb-2">
            {t('referrals.recentReferrals')}
          </p>

          {(referralData?.recentReferrals?.successful?.length > 0 || referralData?.recentReferrals?.pending?.length > 0) ? (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {referralData.recentReferrals.successful?.map((ref, i) => (
                <div key={`s-${i}`} className="flex items-center gap-3 px-4 py-4 border-b border-[#F0F0F0]">
                  <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#111111]">{ref.referee?.username}</p>
                    <p className="text-xs text-[#888888]">
                      {t('referrals.completed', { date: new Date(ref.completedAt).toLocaleDateString() })}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-green-600">+${rewardAmount} USDT</p>
                </div>
              ))}
              {referralData.recentReferrals.pending?.map((ref, i) => (
                <div key={`p-${i}`} className="flex items-center gap-3 px-4 py-4 border-b border-[#F0F0F0] last:border-0">
                  <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-[#0052FF]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#111111]">{ref.referee?.username}</p>
                    <p className="text-xs text-[#888888]">
                      {t('referrals.signedUp', { date: new Date(ref.createdAt).toLocaleDateString() })}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-[#0052FF] bg-[#F0F5FF] px-2 py-1 rounded-lg">
                    {t('referrals.pending')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm px-4 py-10 text-center">
              <div className="w-14 h-14 bg-[#F0F5FF] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-7 h-7 text-[#0052FF]" />
              </div>
              <p className="text-sm font-bold text-[#111111] mb-1">{t('referrals.noReferralsYet')}</p>
              <p className="text-xs text-[#888888]">{t('referrals.startSharing')}</p>
            </div>
          )}
        </div>

      </div>

      <Menu />
    </div>
  );
};

export default Referrals;
