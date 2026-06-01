import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Briefcase, Globe, Zap, Heart,
  ChevronRight, MapPin, Clock,
} from 'lucide-react';
import Menu from './Menu';

const Careers = () => {
  const navigate = useNavigate();
  const { t }    = useTranslation();

  const perks = [
    { icon: Globe,     label: t('careers.perk1'),     desc: t('careers.perk1Desc') },
    { icon: Zap,       label: t('careers.perk2'),     desc: t('careers.perk2Desc') },
    { icon: Heart,     label: t('careers.perk3'),     desc: t('careers.perk3Desc') },
    { icon: Briefcase, label: t('careers.perk4'),     desc: t('careers.perk4Desc') },
  ];

  const openRoles = [
    { title: t('careers.role1'),  dept: t('careers.deptEng'),      type: t('careers.fullTime'), remote: true },
    { title: t('careers.role2'),  dept: t('careers.deptProduct'),  type: t('careers.fullTime'), remote: true },
    { title: t('careers.role3'),  dept: t('careers.deptMarketing'),type: t('careers.fullTime'), remote: true },
    { title: t('careers.role4'),  dept: t('careers.deptSupport'),  type: t('careers.fullTime'), remote: true },
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
            <h1 className="text-white font-bold text-lg">{t('careers.heading')}</h1>
            <div className="w-9" />
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mb-4">
              <Briefcase className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-white font-bold text-xl mb-1">{t('careers.heroTitle')}</h2>
            <p className="text-white/70 text-sm">{t('careers.heroSub')}</p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-md mx-auto px-4 -mt-10 pb-32">

        {/* Why join us */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1 mb-2">
            {t('careers.whyJoin')}
          </p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {perks.map(({ icon: Icon, label, desc }, idx) => (
              <div key={idx} className={`flex items-start gap-3 px-4 py-4 ${idx < perks.length - 1 ? 'border-b border-[#F0F0F0]' : ''}`}>
                <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-[#0052FF]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#111111]">{label}</p>
                  <p className="text-xs text-[#888888] mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Open roles */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1 mb-2">
            {t('careers.openRoles')}
          </p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {openRoles.map((role, idx) => (
              <div key={idx} className={`flex items-center gap-3 px-4 py-4 ${idx < openRoles.length - 1 ? 'border-b border-[#F0F0F0]' : ''}`}>
                <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
                  <Briefcase className="w-4 h-4 text-[#0052FF]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#111111]">{role.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-[#888888]">{role.dept}</span>
                    <span className="text-[#DDDDDD]">·</span>
                    <span className="flex items-center gap-0.5 text-[10px] text-[#888888]">
                      <Clock className="w-3 h-3" />{role.type}
                    </span>
                    {role.remote && (
                      <>
                        <span className="text-[#DDDDDD]">·</span>
                        <span className="flex items-center gap-0.5 text-[10px] text-[#0052FF] font-medium">
                          <MapPin className="w-3 h-3" />{t('careers.remote')}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#AAAAAA] shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="bg-white rounded-2xl shadow-sm px-4 py-5 text-center">
          <p className="text-sm font-bold text-[#111111] mb-1">{t('careers.ctaTitle')}</p>
          <p className="text-xs text-[#888888] mb-4">{t('careers.ctaDesc')}</p>
          <a
            href="mailto:careers@ NexaBitexchange.com"
            className="inline-block px-6 py-2.5 bg-[#0052FF] text-white text-sm font-semibold rounded-xl hover:bg-[#0041CC] transition-colors"
          >
            {t('careers.applyNow')}
          </a>
        </div>

      </div>

      <Menu />
    </div>
  );
};

export default Careers;
