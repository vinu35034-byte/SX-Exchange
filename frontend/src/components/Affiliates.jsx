import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Users, DollarSign, TrendingUp,
  Share2, ChevronRight, Gift, BarChart2,
} from 'lucide-react';
import Menu from './Menu';

const Affiliates = () => {
  const navigate = useNavigate();
  const { t }    = useTranslation();

  const steps = [
    { label: t('affiliates.step1'), desc: t('affiliates.step1Desc') },
    { label: t('affiliates.step2'), desc: t('affiliates.step2Desc') },
    { label: t('affiliates.step3'), desc: t('affiliates.step3Desc') },
  ];

  const benefits = [
    { icon: DollarSign, label: t('affiliates.ben1'), desc: t('affiliates.ben1Desc') },
    { icon: TrendingUp, label: t('affiliates.ben2'), desc: t('affiliates.ben2Desc') },
    { icon: BarChart2,  label: t('affiliates.ben3'), desc: t('affiliates.ben3Desc') },
    { icon: Gift,       label: t('affiliates.ben4'), desc: t('affiliates.ben4Desc') },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FA]">

      {/* Blue hero */}
      <div className="bg-linear-to-br from-[#0052FF] to-[#0041CC]">
        <div className="w-full max-w-md mx-auto px-4 pt-6 pb-20">
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-white font-bold text-lg">{t('affiliates.heading')}</h1>
            <div className="w-9" />
          </div>

          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mb-4">
              <Share2 className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-white font-bold text-xl mb-1">{t('affiliates.heroTitle')}</h2>
            <p className="text-white/70 text-sm mb-5">{t('affiliates.heroSub')}</p>
          </div>

          {/* Hero stat row */}
          <div className="flex justify-center gap-8">
            <div className="text-center">
              <p className="text-white font-bold text-xl">30%</p>
              <p className="text-white/60 text-xs">{t('affiliates.statCommission')}</p>
            </div>
            <div className="w-px bg-white/20" />
            <div className="text-center">
              <p className="text-white font-bold text-xl">4</p>
              <p className="text-white/60 text-xs">{t('affiliates.statLevels')}</p>
            </div>
            <div className="w-px bg-white/20" />
            <div className="text-center">
              <p className="text-white font-bold text-xl">∞</p>
              <p className="text-white/60 text-xs">{t('affiliates.statEarnings')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-md mx-auto px-4 -mt-10 pb-32">

        {/* How it works */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1 mb-2">
            {t('affiliates.howItWorks')}
          </p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {steps.map((step, idx) => (
              <div key={idx} className={`flex items-start gap-3 px-4 py-4 ${idx < steps.length - 1 ? 'border-b border-[#F0F0F0]' : ''}`}>
                <div className="w-9 h-9 rounded-xl bg-[#0052FF] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-white font-bold text-sm">{idx + 1}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#111111]">{step.label}</p>
                  <p className="text-xs text-[#888888] mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Benefits */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1 mb-2">
            {t('affiliates.benefits')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {benefits.map(({ icon: Icon, label, desc }, idx) => (
              <div key={idx} className="bg-white rounded-2xl shadow-sm p-4">
                <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center mb-3">
                  <Icon className="w-4 h-4 text-[#0052FF]" />
                </div>
                <p className="text-sm font-bold text-[#111111]">{label}</p>
                <p className="text-xs text-[#888888] mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA — links to referrals page */}
        <button
          onClick={() => navigate('/referrals')}
          className="w-full flex items-center gap-3 bg-white rounded-2xl shadow-sm px-4 py-4 hover:bg-[#FAFAFA] transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-[#0052FF] flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-[#111111]">{t('affiliates.ctaTitle')}</p>
            <p className="text-xs text-[#888888]">{t('affiliates.ctaDesc')}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-[#AAAAAA] shrink-0" />
        </button>

      </div>

      <Menu />
    </div>
  );
};

export default Affiliates;
