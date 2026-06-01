import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { useUserProfile } from '../../contexts/UserProfileContext';
import Menu from '../Menu';
import Spinner from '../common/Spinner';
import {
  ArrowLeft, RefreshCw, ChevronRight, LogOut,
  Wallet, TrendingUp, ArrowDownLeft, ArrowUpRight,
  Copy, Layers, Users, Settings,
  Gift, ShieldCheck, FileText
} from 'lucide-react';
import { getUserProfilePicture } from '../../utils/profilePictures';

const Profile = () => {
  const navigate  = useNavigate();
  const { t }     = useTranslation();
  const { user, logoutUser } = useUserAuth();
  const { profileData, loading: profileLoading, error: profileError, refreshProfile } = useUserProfile();

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing]         = useState(false);

  useEffect(() => {
    setInitialLoading(false);
  }, [user, profileError]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate('/signin');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const currentUser = profileData || user;
  const stableUserId = currentUser?._id || currentUser?.id || currentUser?.email;
  const { imageUrl, gradientClass, initials } = getUserProfilePicture(
    stableUserId,
    currentUser?.username || currentUser?.email || 'User'
  );

  const kycStatus = currentUser?.kycStatus;
  const kycLabel = kycStatus === 'approved' ? t('profile.kycVerified')
                 : kycStatus === 'pending'  ? t('profile.kycPending')
                 : t('profile.kycRequired');

  const sections = [
    {
      title: t('profile.sectionFinance'),
      items: [
        { icon: Wallet,        label: t('profile.assets'),   desc: t('profile.assetsDesc'),   route: '/asset' },
        { icon: ArrowDownLeft, label: t('profile.deposit'),  desc: t('profile.depositDesc'),  route: '/deposit' },
        { icon: ArrowUpRight,  label: t('profile.withdraw'), desc: t('profile.withdrawDesc'), route: '/withdraw' },
      ],
    },
    {
      title: t('profile.sectionTrading'),
      items: [
        { icon: TrendingUp, label: t('profile.trade'),       desc: t('profile.tradeDesc'),       route: '/trade' },
        { icon: Copy,       label: t('profile.copyTrading'), desc: t('profile.copyTradingDesc'), route: '/copy-trading' },
      ],
    },
    {
      title: t('profile.sectionEarn'),
      items: [
        { icon: Layers, label: t('profile.staking'),   desc: t('profile.stakingDesc'),   route: '/staking' },
        { icon: Gift,   label: t('nav.rewards'),       desc: t('profile.rewardsDesc'),   route: '/rewards' },
        { icon: Users,  label: t('profile.referrals'), desc: t('profile.referralsDesc'), route: '/referrals' },
      ],
    },
    {
      title: t('profile.sectionAccount'),
      items: [
        { icon: FileText, label: t('editProfile.editProfile'), desc: currentUser?.email || '',      route: '/edit-profile' },
        { icon: Settings, label: t('profile.settings'),        desc: t('profile.settingsDesc'),     route: '/settings' },
      ],
    },
  ];

  if (initialLoading || profileLoading) return <Spinner />;

  return (
    <div className="min-h-screen bg-[#F5F7FA]">

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
            <h1 className="text-white font-bold text-lg">{t('profile.heading')}</h1>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Avatar + info */}
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 rounded-full overflow-hidden mb-3 ring-4 ring-white/30 relative">
              <img
                src={imageUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'flex';
                }}
              />
              <div
                className={`w-full h-full bg-linear-to-br ${gradientClass} items-center justify-center absolute inset-0`}
                style={{ display: 'none' }}
              >
                <span className="text-white font-bold text-2xl tracking-wide">{initials}</span>
              </div>
            </div>

            <h2 className="text-white font-bold text-xl mb-0.5">{currentUser?.username || 'User'}</h2>
            <p className="text-white/70 text-sm mb-3">{currentUser?.email}</p>

            {/* KYC badge */}
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
              kycStatus === 'approved' ? 'bg-green-400/20 text-green-200'
              : kycStatus === 'pending' ? 'bg-white/20 text-white/90'
              : 'bg-red-400/20 text-red-200'
            }`}>
              {t('profile.kycPrefix')} {kycLabel}
            </span>
          </div>

        </div>
      </div>

      {/* Content overlapping hero */}
      <div className="w-full max-w-md mx-auto px-4 -mt-10 pb-32">

        {/* KYC banner — only if not verified */}
        {kycStatus !== 'approved' && (
          <button
            onClick={() => navigate('/kyc')}
            className="w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-4 mb-4 shadow-sm text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-[#0052FF] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#111111]">{t('profile.completeKycHeading')}</p>
              <p className="text-xs text-[#888888]">{t('profile.unlockHigherLimits')}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[#AAAAAA] shrink-0" />
          </button>
        )}

        {/* Grouped sections */}
        {sections.map((section) => (
          <div key={section.title} className="mb-4">
            <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1 mb-2">
              {section.title}
            </p>
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              {section.items.map(({ icon: Icon, label, desc, route, onPress }, idx) => (
                <button
                  key={route}
                  onClick={onPress ?? (() => navigate(route))}
                  className={`w-full flex items-center gap-3 px-4 py-4 hover:bg-[#FAFAFA] transition-colors ${
                    idx < section.items.length - 1 ? 'border-b border-[#F0F0F0]' : ''
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[#0052FF]" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-[#111111]">{label}</p>
                    <p className="text-xs text-[#888888] truncate">{desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#AAAAAA] shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-4 shadow-sm hover:bg-red-50 transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <LogOut className="w-4 h-4 text-red-500" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-red-500">{t('profile.logout')}</p>
            <p className="text-xs text-[#888888]">{t('profile.logoutDescription')}</p>
          </div>
        </button>

      </div>

      <Menu />
    </div>
  );
};

export default Profile;
