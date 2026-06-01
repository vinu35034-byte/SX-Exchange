import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Shield, Users, Globe,
  Zap, TrendingUp, Copy, Layers,
  Gift, FileText, Lock, ChevronRight,
  CheckCircle, Clock, Star,
} from "lucide-react";
import Menu from "./Menu";

const About = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const offerings = [
    { icon: TrendingUp, label: t('about.offerTrading'),    desc: t('about.offerTradingDesc') },
    { icon: Copy,       label: t('about.offerCopy'),       desc: t('about.offerCopyDesc') },
    { icon: Layers,     label: t('about.offerStaking'),    desc: t('about.offerStakingDesc') },
    { icon: Gift,       label: t('about.offerReferrals'),  desc: t('about.offerReferralsDesc') },
    { icon: Globe,      label: t('about.offerMultiAsset'), desc: t('about.offerMultiAssetDesc') },
  ];

  const values = [
    { icon: Shield,     label: t('about.securityFirst'),  desc: t('about.securityFirstDesc') },
    { icon: Zap,        label: t('about.lightningFast'),  desc: t('about.lightningFastDesc') },
    { icon: Users,      label: t('about.userCentric'),    desc: t('about.userCentricDesc') },
    { icon: TrendingUp, label: t('about.transparent'),    desc: t('about.transparentDesc') },
  ];

  const legal = [
    { icon: FileText, label: t('about.termsLink'),   route: '/terms' },
    { icon: Lock,     label: t('about.privacyLink'), route: '/privacy' },
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
            <h1 className="text-white font-bold text-lg">{t('about.heading')}</h1>
            <div className="w-9" />
          </div>

          {/* Logo + name */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center mb-4">
              <Globe className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-white font-bold text-2xl mb-1">{t('about.appName')}</h2>
            <span className="text-white/60 text-xs bg-white/10 px-3 py-1 rounded-full">
              {t('about.appVersion')} {t('about.versionNumber')}
            </span>
          </div>

          {/* Stats row */}
          <div className="flex justify-center gap-8">
            <div className="text-center">
              <p className="text-white font-bold text-xl">50K+</p>
              <p className="text-white/60 text-xs">{t('about.activeTraders')}</p>
            </div>
            <div className="w-px bg-white/20" />
            <div className="text-center">
              <p className="text-white font-bold text-xl">80+</p>
              <p className="text-white/60 text-xs">{t('about.cryptocurrencies')}</p>
            </div>
            <div className="w-px bg-white/20" />
            <div className="text-center">
              <p className="text-white font-bold text-xl">50+</p>
              <p className="text-white/60 text-xs">{t('about.countriesLabel')}</p>
            </div>
          </div>

        </div>
      </div>

      {/* Content */}
      <div className="w-full max-w-md mx-auto px-4 -mt-10 pb-32">

        {/* Mission */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1 mb-2">
            {t('about.ourMission')}
          </p>
          <div className="bg-white rounded-2xl shadow-sm px-4 py-5">
            <p className="text-sm text-[#555555] leading-relaxed">{t('about.missionText')}</p>
          </div>
        </div>

        {/* Platform stats */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1 mb-2">
            {t('about.trustedGlobally')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: '$500M+', label: t('about.tradingVolume'),    color: 'text-[#0052FF]' },
              { value: '99.9%',  label: t('about.uptimeSla'),        color: 'text-green-600' },
              { value: '50K+',   label: t('about.activeTraders'),    color: 'text-[#0052FF]' },
              { value: '80+',    label: t('about.cryptocurrencies'), color: 'text-green-600' },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm p-4 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-[#888888] mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* What We Offer */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1 mb-2">
            {t('about.offersTitle')}
          </p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {offerings.map(({ icon: Icon, label, desc }, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 px-4 py-4 ${idx < offerings.length - 1 ? 'border-b border-[#F0F0F0]' : ''}`}
              >
                <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-[#0052FF]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#111111]">{label}</p>
                  <p className="text-xs text-[#888888]">{desc}</p>
                </div>
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Core Values */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1 mb-2">
            {t('about.whatDrivesUs')}
          </p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {values.map(({ icon: Icon, label, desc }, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 px-4 py-4 ${idx < values.length - 1 ? 'border-b border-[#F0F0F0]' : ''}`}
              >
                <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-[#0052FF]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#111111]">{label}</p>
                  <p className="text-xs text-[#888888] leading-relaxed mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Support */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1 mb-2">
            {t('about.hereToHelp')}
          </p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-4 border-b border-[#F0F0F0]">
              <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-[#0052FF]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#111111]">{t('about.supportAvailability')}</p>
                <p className="text-xs text-[#888888]">{t('about.supportAvailabilityDesc')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-4">
              <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
                <Star className="w-4 h-4 text-[#0052FF]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#111111]">{t('about.generalSupport')}</p>
                <p className="text-xs text-[#888888]">{t('about.generalSupportDesc')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Legal */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1 mb-2">
            {t('about.legalTitle')}
          </p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {legal.map(({ icon: Icon, label, route }, idx) => (
              <button
                key={idx}
                onClick={() => navigate(route)}
                className={`w-full flex items-center gap-3 px-4 py-4 hover:bg-[#FAFAFA] transition-colors ${idx < legal.length - 1 ? 'border-b border-[#F0F0F0]' : ''}`}
              >
                <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-[#0052FF]" />
                </div>
                <p className="flex-1 text-left text-sm font-semibold text-[#111111]">{label}</p>
                <ChevronRight className="w-4 h-4 text-[#AAAAAA] shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => navigate('/signup')}
          className="w-full py-4 rounded-2xl bg-[#0052FF] text-white font-bold text-sm hover:bg-[#0041CC] transition-colors"
        >
          {t('about.createFreeAccount')}
        </button>

      </div>

      <Menu />
    </div>
  );
};

export default About;
