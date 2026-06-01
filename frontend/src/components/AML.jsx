import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Shield,
  Fingerprint,
  Activity,
  Ban,
  Filter,
  Database,
  ClipboardCheck,
  TrendingUp,
  GraduationCap,
  UserCog,
  FileText,
} from "lucide-react";
import Menu from "./Menu";

const meshBg = { background: '#FFFFFF' };

const AML = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen relative overflow-hidden" style={meshBg}>
      <div className="pointer-events-none fixed -top-20 -right-20 w-72 h-72 rounded-full border border-[#0052FF]/10 z-0" />
      <div className="pointer-events-none fixed -bottom-32 -left-24 w-96 h-96 rounded-full border border-[#0052FF]/8 z-0" />

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-md mx-auto px-4 py-4 pb-24">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 flex items-center justify-center hover:bg-[#F0F5FF]/60 transition-all duration-300 active:scale-95 rounded-lg border border-[#0052FF]/15 hover:border-[#0052FF]/30"
            >
              <ArrowLeft className="w-5 h-5 text-[#555555]" />
            </button>
            <h1 className="text-xl font-bold text-[#111111]">{t('amlPolicy.amlPolicy')}</h1>
            <div className="w-10 h-10"></div>
          </div>
        </header>

        {/* Introduction */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-linear-to-br from-cyan-500/20 to-purple-500/20 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#0052FF]" />
            </div>
            <h2 className="text-xl font-bold text-[#111111]">{t('amlPolicy.amlPolicy')}</h2>
          </div>
          <p className="text-[#555555] text-sm leading-relaxed">
            {t('amlPolicy.introduction')}
          </p>
        </div>

        {/* AML Policy Sections */}
        <div className="space-y-8">
          {/* Section 1: Overview */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <FileText className="w-5 h-5 text-[#0052FF]" />
              <h3 className="text-lg font-semibold text-[#111111]">{t('amlPolicy.policyOverview')}</h3>
            </div>
            <div className="text-sm text-[#555555] leading-relaxed pl-8">
              <p className="mb-2">
                {t('amlPolicy.policyOverviewText1')}
              </p>
              <p>
                {t('amlPolicy.policyOverviewText2')}
              </p>
            </div>
          </div>

          {/* Section 2: KYC Requirements */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Fingerprint className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-semibold text-[#111111]">{t('amlPolicy.identityVerification')}</h3>
            </div>
            <div className="text-sm text-[#555555] leading-relaxed pl-8">
              <p className="mb-2">{t('amlPolicy.identityVerificationIntro')}</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{t('amlPolicy.kycItem1')}</li>
                <li>{t('amlPolicy.kycItem2')}</li>
                <li>{t('amlPolicy.kycItem3')}</li>
                <li>{t('amlPolicy.kycItem4')}</li>
              </ul>
            </div>
          </div>

          {/* Section 3: Transaction Monitoring */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Activity className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-[#111111]">{t('amlPolicy.transactionMonitoring')}</h3>
            </div>
            <div className="text-sm text-[#555555] leading-relaxed pl-8">
              <p className="mb-2">{t('amlPolicy.transactionMonitoringIntro')}</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{t('amlPolicy.monitoringItem1')}</li>
                <li>{t('amlPolicy.monitoringItem2')}</li>
                <li>{t('amlPolicy.monitoringItem3')}</li>
                <li>{t('amlPolicy.monitoringItem4')}</li>
              </ul>
            </div>
          </div>

          {/* Section 4: Prohibited Activities */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Ban className="w-5 h-5 text-red-400" />
              <h3 className="text-lg font-semibold text-[#111111]">{t('amlPolicy.prohibitedActivities')}</h3>
            </div>
            <div className="text-sm text-[#555555] leading-relaxed pl-8">
              <p className="mb-2">{t('amlPolicy.prohibitedIntro')}</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{t('amlPolicy.prohibited1')}</li>
                <li>{t('amlPolicy.prohibited2')}</li>
                <li>{t('amlPolicy.prohibited3')}</li>
                <li>{t('amlPolicy.prohibited4')}</li>
                <li>{t('amlPolicy.prohibited5')}</li>
              </ul>
              <p className="mt-2 text-red-400/80">{t('amlPolicy.violationWarning')}</p>
            </div>
          </div>

          {/* Section 5: Sanctions Screening */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Filter className="w-5 h-5 text-[#0052FF]" />
              <h3 className="text-lg font-semibold text-[#111111]">{t('amlPolicy.sanctionsScreening')}</h3>
            </div>
            <div className="text-sm text-[#555555] leading-relaxed pl-8">
              <p className="mb-2">{t('amlPolicy.sanctionsIntro')}</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{t('amlPolicy.sanctions1')}</li>
                <li>{t('amlPolicy.sanctions2')}</li>
                <li>{t('amlPolicy.sanctions3')}</li>
                <li>{t('amlPolicy.sanctions4')}</li>
              </ul>
            </div>
          </div>

          {/* Section 6: Record Keeping */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Database className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-semibold text-[#111111]">{t('amlPolicy.recordKeeping')}</h3>
            </div>
            <div className="text-sm text-[#555555] leading-relaxed pl-8">
              <p className="mb-2">{t('amlPolicy.recordKeepingIntro')}</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{t('amlPolicy.records1')}</li>
                <li>{t('amlPolicy.records2')}</li>
                <li>{t('amlPolicy.records3')}</li>
                <li>{t('amlPolicy.records4')}</li>
              </ul>
            </div>
          </div>

          {/* Section 7: Reporting Requirements */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <ClipboardCheck className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-[#111111]">{t('amlPolicy.regulatoryReporting')}</h3>
            </div>
            <div className="text-sm text-[#555555] leading-relaxed pl-8">
              <p className="mb-2">{t('amlPolicy.reportingIntro')}</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{t('amlPolicy.reporting1')}</li>
                <li>{t('amlPolicy.reporting2')}</li>
                <li>{t('amlPolicy.reporting3')}</li>
                <li>{t('amlPolicy.reporting4')}</li>
              </ul>
            </div>
          </div>

          {/* Section 8: Risk Assessment */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="w-5 h-5 text-[#0052FF]" />
              <h3 className="text-lg font-semibold text-[#111111]">{t('amlPolicy.riskAssessment')}</h3>
            </div>
            <div className="text-sm text-[#555555] leading-relaxed pl-8">
              <p className="mb-2">{t('amlPolicy.riskIntro')}</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{t('amlPolicy.risk1')}</li>
                <li>{t('amlPolicy.risk2')}</li>
                <li>{t('amlPolicy.risk3')}</li>
                <li>{t('amlPolicy.risk4')}</li>
              </ul>
            </div>
          </div>

          {/* Section 9: Training and Compliance */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <GraduationCap className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-semibold text-[#111111]">{t('amlPolicy.staffTraining')}</h3>
            </div>
            <div className="text-sm text-[#555555] leading-relaxed pl-8">
              <p className="mb-2">{t('amlPolicy.trainingIntro')}</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{t('amlPolicy.training1')}</li>
                <li>{t('amlPolicy.training2')}</li>
                <li>{t('amlPolicy.training3')}</li>
                <li>{t('amlPolicy.training4')}</li>
              </ul>
            </div>
          </div>

          {/* Section 10: Customer Obligations */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <UserCog className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-[#111111]">{t('amlPolicy.yourObligations')}</h3>
            </div>
            <div className="text-sm text-[#555555] leading-relaxed pl-8">
              <p className="mb-2">{t('amlPolicy.obligationsIntro')}</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{t('amlPolicy.obligation1')}</li>
                <li>{t('amlPolicy.obligation2')}</li>
                <li>{t('amlPolicy.obligation3')}</li>
                <li>{t('amlPolicy.obligation4')}</li>
                <li>{t('amlPolicy.obligation5')}</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="mt-10 mb-8">
          <h3 className="text-lg font-bold text-[#111111] mb-4">{t('amlPolicy.complianceContact')}</h3>
          <div className="space-y-2 text-sm">
            <p className="text-[#555555]">
              <span className="font-semibold text-[#0052FF]">{t('amlPolicy.compliance')}:</span> compliance@ NexaBitexchange.com
            </p>
            <p className="text-[#555555]">
              <span className="font-semibold text-[#0052FF]">{t('amlPolicy.amlHotline')}:</span> aml@ NexaBitexchange.com
            </p>
            <p className="text-[#555555]">
              <span className="font-semibold text-[#0052FF]">{t('amlPolicy.support')}:</span> support@ NexaBitexchange.com
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <Menu />
    </div>
  );
};

export default AML;
