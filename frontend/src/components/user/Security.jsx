import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, ShieldCheck, Lock, BadgeCheck,
  User, ChevronRight, AlertTriangle, Eye,
  LogOut, KeyRound,
} from 'lucide-react';
import Menu from '../Menu';

const Security = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const actions = [
    {
      icon: KeyRound,
      label: t('security.changePassword'),
      desc: t('security.changePasswordDesc'),
      route: '/settings',
    },
    {
      icon: BadgeCheck,
      label: t('security.verifyIdentity'),
      desc: t('security.verifyIdentityDesc'),
      route: '/kyc',
    },
    {
      icon: User,
      label: t('security.updateProfile'),
      desc: t('security.updateProfileDesc'),
      route: '/edit-profile',
    },
  ];

  const tips = [
    { icon: Lock,          text: t('security.tip1') },
    { icon: Eye,           text: t('security.tip2') },
    { icon: LogOut,        text: t('security.tip3') },
    { icon: AlertTriangle, text: t('security.tip4') },
  ];

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
            <h1 className="text-white font-bold text-lg">{t('security.security')}</h1>
            <div className="w-9" />
          </div>

          {/* Hero icon + headline */}
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center mb-4">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-white font-bold text-xl mb-1">{t('security.securitySettings')}</h2>
            <p className="text-white/70 text-sm">{t('security.heroSubtitle')}</p>
          </div>

        </div>
      </div>

      {/* Content */}
      <div className="w-full max-w-md mx-auto px-4 -mt-10 pb-32">

        {/* Actions */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1 mb-2">
            {t('security.actionsTitle')}
          </p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {actions.map(({ icon: Icon, label, desc, route }, idx) => (
              <button
                key={route}
                onClick={() => navigate(route)}
                className={`w-full flex items-center gap-3 px-4 py-4 hover:bg-[#FAFAFA] transition-colors ${
                  idx < actions.length - 1 ? 'border-b border-[#F0F0F0]' : ''
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-[#0052FF]" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-[#111111]">{label}</p>
                  <p className="text-xs text-[#888888]">{desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#AAAAAA] shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Security tips */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1 mb-2">
            {t('security.tipsTitle')}
          </p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {tips.map(({ icon: Icon, text }, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 px-4 py-4 ${
                  idx < tips.length - 1 ? 'border-b border-[#F0F0F0]' : ''
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-[#0052FF]" />
                </div>
                <p className="flex-1 text-sm text-[#555555] leading-relaxed pt-2">{text}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      <Menu />
    </div>
  );
};

export default Security;
