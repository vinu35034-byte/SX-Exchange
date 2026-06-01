import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { useSession } from '../../contexts/SessionContext';
import { ApiUtils } from '../../services/api';
import {
  ArrowLeft, Settings as SettingsIcon, Mail, KeyRound,
  ShieldCheck, RefreshCw, Eye, EyeOff, ChevronDown, ChevronRight,
} from 'lucide-react';
import Menu from '../Menu';
import Spinner from '../common/Spinner';
import { showToast } from '../../utils/toast';

const InputField = ({ type, placeholder, value, onChange, showToggle, visible, onToggle, autoComplete }) => (
  <div className="relative">
    <input
      type={showToggle ? (visible ? 'text' : 'password') : type}
      autoComplete={autoComplete}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className="w-full bg-[#F5F7FA] rounded-xl px-4 py-3 text-sm text-[#111111] placeholder-[#AAAAAA] focus:outline-none focus:ring-2 focus:ring-[#0052FF]/30 border border-[#EEEEEE] focus:border-[#0052FF]/40"
    />
    {showToggle && (
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#AAAAAA] hover:text-[#555555] transition-colors"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    )}
  </div>
);

const Settings = () => {
  const navigate = useNavigate();
  const { user } = useUserAuth();
  const { sessionStatus } = useSession();
  const { t } = useTranslation();

  const [loading, setLoading]           = useState(false);
  const [activeSection, setActiveSection] = useState(null);

  // Password change state
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });

  // Email change state
  const [emailData, setEmailData]         = useState({ newEmail: '', password: '' });
  const [showEmailPassword, setShowEmailPassword] = useState(false);

  // Withdrawal password state
  const [withdrawalPasswordData, setWithdrawalPasswordData] = useState({
    currentPassword: '', newWithdrawalPassword: '', confirmWithdrawalPassword: '', otp: ''
  });
  const [showWithdrawalPasswords, setShowWithdrawalPasswords] = useState({ current: false, new: false, confirm: false });
  const [otpSent, setOtpSent]           = useState(false);
  const [otpLoading, setOtpLoading]     = useState(false);
  const [hasWithdrawalPassword, setHasWithdrawalPassword] = useState(false);

  useEffect(() => { checkWithdrawalPasswordStatus(); }, []);

  const checkWithdrawalPasswordStatus = async () => {
    try {
      const data = await ApiUtils.get('/user/withdrawal-password/status');
      setHasWithdrawalPassword(data.hasPassword);
    } catch { setHasWithdrawalPassword(false); }
  };

  const sendOTP = async () => {
    setOtpLoading(true);
    try {
      if (hasWithdrawalPassword) {
        if (!withdrawalPasswordData.currentPassword) {
          showToast.error(t('settings.enterCurrentWithdrawalPassword'));
          return;
        }
        await ApiUtils.post('/user/withdrawal-password/send-change-otp', { currentPassword: withdrawalPasswordData.currentPassword });
      } else {
        await ApiUtils.post('/user/withdrawal-password/send-otp');
      }
      setOtpSent(true);
      showToast.success(t('settings.otpSentToEmail'));
    } catch (error) {
      if (error.action === 'change_required') {
        setHasWithdrawalPassword(true);
        showToast.error(t('settings.alreadyHaveWithdrawalPassword'));
      } else {
        showToast.error(error.message || 'Failed to send OTP');
      }
    } finally { setOtpLoading(false); }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) { showToast.error(t('settings.newPasswordsDoNotMatch')); return; }
    if (passwordData.newPassword.length < 6) { showToast.error(t('settings.passwordMin6')); return; }
    try {
      setLoading(true);
      await ApiUtils.put('/user/change-password', { currentPassword: passwordData.currentPassword, newPassword: passwordData.newPassword });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showToast.success(t('settings.passwordChanged'));
    } catch (error) { showToast.error(error.message || 'Failed to change password'); }
    finally { setLoading(false); }
  };

  const handleEmailChange = async () => {
    if (!emailData.newEmail || !emailData.password) { showToast.error(t('settings.fillAllFields')); return; }
    try {
      setLoading(true);
      await ApiUtils.put('/user/change-email', { newEmail: emailData.newEmail, password: emailData.password });
      setEmailData({ newEmail: '', password: '' });
      showToast.success('Email updated successfully');
    } catch (error) { showToast.error(error.message || 'Failed to update email'); }
    finally { setLoading(false); }
  };

  const handleWithdrawalPasswordChange = async () => {
    if (!hasWithdrawalPassword) {
      if (withdrawalPasswordData.newWithdrawalPassword !== withdrawalPasswordData.confirmWithdrawalPassword) { showToast.error(t('settings.newWithdrawalPasswordsDoNotMatch')); return; }
      if (withdrawalPasswordData.newWithdrawalPassword.length < 4) { showToast.error(t('settings.withdrawalPasswordMin4')); return; }
      if (!withdrawalPasswordData.otp || withdrawalPasswordData.otp.length !== 6) { showToast.error(t('settings.validOtp')); return; }
      try {
        setLoading(true);
        await ApiUtils.post('/user/withdrawal-password/create', { password: withdrawalPasswordData.newWithdrawalPassword, otp: withdrawalPasswordData.otp });
        setHasWithdrawalPassword(true);
        setWithdrawalPasswordData({ currentPassword: '', newWithdrawalPassword: '', confirmWithdrawalPassword: '', otp: '' });
        setOtpSent(false);
        showToast.success(t('settings.withdrawalPasswordCreated'));
      } catch (error) { showToast.error(error.message || 'Failed to create withdrawal password'); }
      finally { setLoading(false); }
    } else {
      if (!withdrawalPasswordData.currentPassword) { showToast.error(t('settings.enterCurrentWithdrawalPassword')); return; }
      if (withdrawalPasswordData.newWithdrawalPassword !== withdrawalPasswordData.confirmWithdrawalPassword) { showToast.error(t('settings.newWithdrawalPasswordsDoNotMatch')); return; }
      if (withdrawalPasswordData.newWithdrawalPassword.length < 4) { showToast.error(t('settings.withdrawalPasswordMin4')); return; }
      if (!withdrawalPasswordData.otp || withdrawalPasswordData.otp.length !== 6) { showToast.error(t('settings.validOtp')); return; }
      try {
        setLoading(true);
        await ApiUtils.post('/user/withdrawal-password/change', { currentPassword: withdrawalPasswordData.currentPassword, newPassword: withdrawalPasswordData.newWithdrawalPassword, otp: withdrawalPasswordData.otp });
        setWithdrawalPasswordData({ currentPassword: '', newWithdrawalPassword: '', confirmWithdrawalPassword: '', otp: '' });
        setOtpSent(false);
        showToast.success(t('settings.withdrawalPasswordChanged'));
      } catch (error) { showToast.error(error.message || 'Failed to change withdrawal password'); }
      finally { setLoading(false); }
    }
  };

  const handlePasswordReset = async () => {
    try {
      setLoading(true);
      await ApiUtils.post('/user/forgot-password', { email: user.email });
      showToast.success(t('settings.passwordResetEmailSent'));
    } catch (error) { showToast.error(error.message || 'Failed to send reset email'); }
    finally { setLoading(false); }
  };

  const toggle = (section) => setActiveSection(prev => prev === section ? null : section);

  if (loading && !user) return <Spinner />;

  return (
    <div className="min-h-screen bg-[#F5F7FA]">

      {/* Blue hero */}
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
            <h1 className="text-white font-bold text-lg">{t('settings.settings')}</h1>
            <div className="w-9" />
          </div>

          {/* Status row */}
          <div className="flex justify-center gap-8">
            <div className="text-center">
              <p className="text-white font-bold text-base">{hasWithdrawalPassword ? t('settings.protected') : t('settings.basic')}</p>
              <p className="text-white/60 text-xs">{t('settings.securityCard')}</p>
            </div>
            <div className="w-px bg-white/20" />
            <div className="text-center">
              <p className="text-white font-bold text-base truncate max-w-30">{user?.email?.split('@')[0]}</p>
              <p className="text-white/60 text-xs">{t('settings.currentEmail')}</p>
            </div>
          </div>

        </div>
      </div>

      {/* Content */}
      <div className="w-full max-w-md mx-auto px-4 -mt-10 pb-32">

        {/* Security section */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1 mb-2">
            {t('settings.securitySettings')}
          </p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

            {/* Login Password */}
            <div className={`border-b border-[#F0F0F0]`}>
              <button
                onClick={() => toggle('password')}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-[#FAFAFA] transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4 text-[#0052FF]" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-[#111111]">{t('settings.loginPassword')}</p>
                  <p className="text-xs text-[#888888]">{t('settings.updateAccountPassword')}</p>
                </div>
                {activeSection === 'password'
                  ? <ChevronDown className="w-4 h-4 text-[#0052FF] shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-[#AAAAAA] shrink-0" />
                }
              </button>
              {activeSection === 'password' && (
                <div className="px-4 pb-4 space-y-3 bg-[#F8FAFF]">
                  <InputField type="password" autoComplete="current-password" placeholder={t('settings.currentPassword')} value={passwordData.currentPassword} onChange={e => setPasswordData(p => ({ ...p, currentPassword: e.target.value }))} showToggle visible={showPasswords.current} onToggle={() => setShowPasswords(p => ({ ...p, current: !p.current }))} />
                  <InputField type="password" autoComplete="new-password" placeholder={t('settings.newPasswordMin6')} value={passwordData.newPassword} onChange={e => setPasswordData(p => ({ ...p, newPassword: e.target.value }))} showToggle visible={showPasswords.new} onToggle={() => setShowPasswords(p => ({ ...p, new: !p.new }))} />
                  <InputField type="password" autoComplete="new-password" placeholder={t('settings.confirmNewPassword')} value={passwordData.confirmPassword} onChange={e => setPasswordData(p => ({ ...p, confirmPassword: e.target.value }))} showToggle visible={showPasswords.confirm} onToggle={() => setShowPasswords(p => ({ ...p, confirm: !p.confirm }))} />
                  <button
                    onClick={handlePasswordChange}
                    disabled={loading || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                    className="w-full py-3 bg-[#0052FF] text-white text-sm font-semibold rounded-xl hover:bg-[#0041CC] disabled:opacity-50 transition-colors"
                  >
                    {loading ? t('settings.changingPassword') : t('settings.changePassword')}
                  </button>
                </div>
              )}
            </div>

            {/* Withdrawal Password */}
            <div>
              <button
                onClick={() => toggle('withdrawal')}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-[#FAFAFA] transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4 text-[#0052FF]" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-[#111111]">
                    {hasWithdrawalPassword ? t('settings.withdrawalPassword') : t('settings.createWithdrawalPin')}
                  </p>
                  <p className="text-xs text-[#888888]">
                    {hasWithdrawalPassword ? t('settings.updateSecurityPIN') : t('settings.addExtraSecurity')}
                  </p>
                </div>
                {activeSection === 'withdrawal'
                  ? <ChevronDown className="w-4 h-4 text-[#0052FF] shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-[#AAAAAA] shrink-0" />
                }
              </button>
              {activeSection === 'withdrawal' && (
                <div className="px-4 pb-4 space-y-3 bg-[#F8FAFF]">
                  {hasWithdrawalPassword && (
                    <InputField type="password" autoComplete="current-password" placeholder={t('settings.currentWithdrawalPassword')} value={withdrawalPasswordData.currentPassword} onChange={e => setWithdrawalPasswordData(p => ({ ...p, currentPassword: e.target.value }))} showToggle visible={showWithdrawalPasswords.current} onToggle={() => setShowWithdrawalPasswords(p => ({ ...p, current: !p.current }))} />
                  )}
                  <InputField type="password" autoComplete="new-password" placeholder={t('settings.newWithdrawalPasswordMin4')} value={withdrawalPasswordData.newWithdrawalPassword} onChange={e => setWithdrawalPasswordData(p => ({ ...p, newWithdrawalPassword: e.target.value }))} showToggle visible={showWithdrawalPasswords.new} onToggle={() => setShowWithdrawalPasswords(p => ({ ...p, new: !p.new }))} />
                  <InputField type="password" autoComplete="new-password" placeholder={t('settings.confirmNewWithdrawalPassword')} value={withdrawalPasswordData.confirmWithdrawalPassword} onChange={e => setWithdrawalPasswordData(p => ({ ...p, confirmWithdrawalPassword: e.target.value }))} showToggle visible={showWithdrawalPasswords.confirm} onToggle={() => setShowWithdrawalPasswords(p => ({ ...p, confirm: !p.confirm }))} />

                  {!otpSent ? (
                    <button
                      onClick={sendOTP}
                      disabled={otpLoading}
                      className="w-full py-3 bg-[#0052FF] text-white text-sm font-semibold rounded-xl hover:bg-[#0041CC] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                      {otpLoading
                        ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('settings.sendingOtp')}</>
                        : <><Mail className="w-4 h-4" />{t('settings.sendOtpToEmail')}</>
                      }
                    </button>
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder={t('settings.enterOtp')}
                        value={withdrawalPasswordData.otp}
                        onChange={e => setWithdrawalPasswordData(p => ({ ...p, otp: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                        className="w-full bg-[#F5F7FA] border border-[#EEEEEE] rounded-xl px-4 py-3 text-center text-xl tracking-widest font-mono text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#0052FF]/30"
                        maxLength={6}
                      />
                      <button
                        onClick={handleWithdrawalPasswordChange}
                        disabled={loading || !withdrawalPasswordData.newWithdrawalPassword || !withdrawalPasswordData.confirmWithdrawalPassword || !withdrawalPasswordData.otp}
                        className="w-full py-3 bg-[#0052FF] text-white text-sm font-semibold rounded-xl hover:bg-[#0041CC] disabled:opacity-50 transition-colors"
                      >
                        {loading
                          ? (hasWithdrawalPassword ? t('settings.changing') : t('settings.creating'))
                          : (hasWithdrawalPassword ? t('settings.changeWithdrawalPassword') : t('settings.createWithdrawalPassword'))
                        }
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Account section */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1 mb-2">
            {t('settings.accountSettings')}
          </p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

            {/* Update Email */}
            <div className="border-b border-[#F0F0F0]">
              <button
                onClick={() => toggle('email')}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-[#FAFAFA] transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-[#0052FF]" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-[#111111]">{t('settings.email')}</p>
                  <p className="text-xs text-[#888888]">{t('settings.currentEmail')}: {user?.email}</p>
                </div>
                {activeSection === 'email'
                  ? <ChevronDown className="w-4 h-4 text-[#0052FF] shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-[#AAAAAA] shrink-0" />
                }
              </button>
              {activeSection === 'email' && (
                <div className="px-4 pb-4 space-y-3 bg-[#F8FAFF]">
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder={t('settings.newEmailAddress')}
                    value={emailData.newEmail}
                    onChange={e => setEmailData(p => ({ ...p, newEmail: e.target.value }))}
                    className="w-full bg-[#F5F7FA] border border-[#EEEEEE] rounded-xl px-4 py-3 text-sm text-[#111111] placeholder-[#AAAAAA] focus:outline-none focus:ring-2 focus:ring-[#0052FF]/30"
                  />
                  <InputField type="password" autoComplete="current-password" placeholder={t('settings.currentPassword')} value={emailData.password} onChange={e => setEmailData(p => ({ ...p, password: e.target.value }))} showToggle visible={showEmailPassword} onToggle={() => setShowEmailPassword(v => !v)} />
                  <button
                    onClick={handleEmailChange}
                    disabled={loading || !emailData.newEmail || !emailData.password}
                    className="w-full py-3 bg-[#0052FF] text-white text-sm font-semibold rounded-xl hover:bg-[#0041CC] disabled:opacity-50 transition-colors"
                  >
                    {loading ? t('settings.updatingEmail') : t('settings.updateEmail')}
                  </button>
                </div>
              )}
            </div>

            {/* Password Reset */}
            <div>
              <button
                onClick={() => toggle('reset')}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-[#FAFAFA] transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
                  <RefreshCw className="w-4 h-4 text-[#0052FF]" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-[#111111]">{t('settings.passwordReset')}</p>
                  <p className="text-xs text-[#888888]">{t('settings.forgotYourPassword')}</p>
                </div>
                {activeSection === 'reset'
                  ? <ChevronDown className="w-4 h-4 text-[#0052FF] shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-[#AAAAAA] shrink-0" />
                }
              </button>
              {activeSection === 'reset' && (
                <div className="px-4 pb-4 bg-[#F8FAFF] space-y-3">
                  <p className="text-xs text-[#555555] leading-relaxed">
                    {t('settings.resetLinkSentTo', { email: user?.email })}
                  </p>
                  <button
                    onClick={handlePasswordReset}
                    disabled={loading}
                    className="w-full py-3 bg-[#0052FF] text-white text-sm font-semibold rounded-xl hover:bg-[#0041CC] disabled:opacity-50 transition-colors"
                  >
                    {loading ? t('settings.sendingResetEmail') : t('settings.sendResetEmail')}
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

      <Menu />
    </div>
  );
};

export default Settings;
