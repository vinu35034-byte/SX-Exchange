import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, FileText, CheckCircle, UserCheck,
  KeyRound, TrendingUp, CreditCard, Ban,
  ShieldAlert, UserX, Scale, Mail,
} from "lucide-react";
import Menu from "./Menu";

const Terms = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const sections = [
    {
      icon: CheckCircle,
      color: 'text-[#0052FF]',
      bg: 'bg-[#F0F5FF]',
      title: t('terms.acceptanceOfTerms'),
      intro: null,
      items: [t('terms.acceptanceText1'), t('terms.acceptanceText2')],
    },
    {
      icon: UserCheck,
      color: 'text-purple-500',
      bg: 'bg-purple-50',
      title: t('terms.eligibility'),
      intro: t('terms.eligibilityIntro'),
      items: [t('terms.eligibility1'), t('terms.eligibility2'), t('terms.eligibility3')],
    },
    {
      icon: KeyRound,
      color: 'text-blue-500',
      bg: 'bg-blue-50',
      title: t('terms.accountSecurity'),
      intro: t('terms.accountSecurityIntro'),
      items: [t('terms.accountSecurity1'), t('terms.accountSecurity2'), t('terms.accountSecurity3'), t('terms.accountSecurity4')],
    },
    {
      icon: TrendingUp,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50',
      title: t('terms.tradingTerms'),
      intro: t('terms.tradingTermsIntro'),
      items: [t('terms.tradingTerms1'), t('terms.tradingTerms2'), t('terms.tradingTerms3'), t('terms.tradingTerms4')],
    },
    {
      icon: CreditCard,
      color: 'text-[#0052FF]',
      bg: 'bg-[#F0F5FF]',
      title: t('terms.feesAndCharges'),
      intro: t('terms.feesIntro'),
      items: [t('terms.fees1'), t('terms.fees2'), t('terms.fees3')],
    },
    {
      icon: Ban,
      color: 'text-red-500',
      bg: 'bg-red-50',
      title: t('terms.prohibitedActivities'),
      intro: t('terms.prohibitedIntro'),
      items: [t('terms.prohibited1'), t('terms.prohibited2'), t('terms.prohibited3'), t('terms.prohibited4')],
    },
    {
      icon: ShieldAlert,
      color: 'text-purple-500',
      bg: 'bg-purple-50',
      title: t('terms.limitationOfLiability'),
      intro: t('terms.liabilityIntro'),
      items: [t('terms.liability1'), t('terms.liability2'), t('terms.liability3')],
    },
    {
      icon: UserX,
      color: 'text-blue-500',
      bg: 'bg-blue-50',
      title: t('terms.accountTermination'),
      intro: t('terms.terminationIntro'),
      items: [t('terms.termination1'), t('terms.termination2'), t('terms.termination3')],
    },
    {
      icon: Scale,
      color: 'text-[#0052FF]',
      bg: 'bg-[#F0F5FF]',
      title: t('terms.governingLaw'),
      intro: t('terms.governingLawIntro'),
      items: [t('terms.governingLaw1'), t('terms.governingLaw2'), t('terms.governingLaw3')],
    },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FA]">

      {/* Blue hero */}
      <div className="bg-linear-to-br from-[#0052FF] to-[#0041CC]">
        <div className="w-full max-w-md mx-auto px-4 pt-6 pb-16">

          {/* Top bar */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-white font-bold text-lg">{t('terms.termsAndConditions')}</h1>
            <div className="w-9" />
          </div>

          {/* Hero */}
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mb-4">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-white font-bold text-xl mb-1">{t('terms.termsOfService')}</h2>
            <span className="text-white/60 text-xs bg-white/10 px-3 py-1 rounded-full">
              {t('terms.updatedDate')}
            </span>
          </div>

        </div>
      </div>

      {/* Content */}
      <div className="w-full max-w-md mx-auto px-4 -mt-6 pb-32">

        {/* Agreement notice */}
        <div className="bg-white rounded-2xl shadow-sm px-4 py-4 mb-4">
          <p className="text-sm text-[#555555] leading-relaxed">{t('terms.agreementNotice')}</p>
        </div>

        {/* Sections */}
        {sections.map(({ icon: Icon, color, bg, title, intro, items }, idx) => (
          <div key={idx} className="mb-4">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

              {/* Section header */}
              <div className="flex items-center gap-3 px-4 py-4 border-b border-[#F0F0F0]">
                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-[#AAAAAA] uppercase tracking-wider">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <p className="text-sm font-bold text-[#111111] leading-snug">{title}</p>
                </div>
              </div>

              {/* Section body */}
              <div className="px-4 py-4">
                {intro && <p className="text-xs text-[#555555] mb-3 leading-relaxed">{intro}</p>}
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${color.replace('text-', 'bg-')} mt-1.5 shrink-0`} />
                      <p className="text-xs text-[#555555] leading-relaxed">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        ))}

        {/* Contact */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1 mb-2">
            {t('terms.questions')}
          </p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-4 border-b border-[#F0F0F0]">
              <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4 text-[#0052FF]" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#888888]">{t('terms.legal')}</p>
                <p className="text-sm font-medium text-[#0052FF]">legal@ NexaBitexchange.com</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-4">
              <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4 text-[#0052FF]" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#888888]">{t('terms.support')}</p>
                <p className="text-sm font-medium text-[#0052FF]">support@ NexaBitexchange.com</p>
              </div>
            </div>
          </div>
        </div>

      </div>

      <Menu />
    </div>
  );
};

export default Terms;
