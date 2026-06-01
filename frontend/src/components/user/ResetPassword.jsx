import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import HexLogo from '../common/HexLogo';
import {
  ArrowLeftIcon,
  EyeIcon,
  EyeSlashIcon,
  EnvelopeIcon,
  ShieldCheckIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline';
import { ApiUtils } from '../../services/api';
import { showToast } from '../../utils/toast';

/* ─── mesh gradient bg ─── */
const meshBg = { background: '#FFFFFF' };

const ResetPassword = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    otp: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const emailFromUrl = urlParams.get('email');
    if (emailFromUrl) {
      setFormData(prev => ({ ...prev, email: emailFromUrl }));
      setOtpSent(true);
    }
  }, [location]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSendCode = async (e) => {
    e.preventDefault();

    if (!formData.email) {
      showToast.error(t('auth.pleaseEnterEmail'));
      return;
    }

    setLoading(true);

    try {
      await ApiUtils.post('/user/forgot-password', { email: formData.email });
      showToast.success(t('auth.resetCodeSent'));
      setOtpSent(true);
    } catch (error) {
      console.error('Forgot password error:', error);
      showToast.error(error.message || t('auth.failedToSendResetCode'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.otp || !formData.newPassword || !formData.confirmPassword) {
      showToast.error(t('auth.fillAllResetFields'));
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      showToast.error(t('auth.passwordsDoNotMatch'));
      return;
    }

    if (formData.newPassword.length < 6) {
      showToast.error(t('auth.passwordTooShort'));
      return;
    }

    setLoading(true);

    try {
      await ApiUtils.post('/user/reset-password', {
        email: formData.email,
        otp: formData.otp,
        newPassword: formData.newPassword
      });

      showToast.success(t('auth.passwordResetSuccess'));
      navigate('/signin', { state: { message: 'Password reset successfully. Please sign in with your new password.' } });
    } catch (error) {
      console.error('Reset password error:', error);
      showToast.error(error.message || t('auth.failedToResetPassword'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden" style={meshBg}>

      {/* decorative floating rings */}
      <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full border border-[#0052FF]/15" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 w-96 h-96 rounded-full border border-[#0052FF]/10" />
      <div className="pointer-events-none absolute top-1/3 right-[-8%] w-44 h-44 rounded-full bg-[#0052FF]/8 blur-2xl" />

      <div className="w-full max-w-95 relative z-10">

        {/* logo — floating pill above card */}
        <div className="flex justify-center mb-6">
          <div className="rounded-[22px] bg-white/50 backdrop-blur-lg p-2 shadow-lg shadow-[#0052FF]/10 border border-white/50">
            <HexLogo size="sm" />
          </div>
        </div>

        {/* frosted glass card */}
        <div className="bg-white/65 backdrop-blur-2xl rounded-3xl px-7 py-9 shadow-xl shadow-[#0052FF]/8 border border-white/60">

          <h1 className="text-[22px] font-bold text-[#111111] text-center leading-tight">
            {otpSent ? t('auth.resetPassword') : t('auth.forgotPasswordTitle')}
          </h1>
          <p className="text-[13px] text-[#555555] text-center mt-1 mb-7">
            {otpSent ? t('auth.resetPasswordSubtitle') : t('auth.forgotPasswordSubtitle')}
          </p>

          <form onSubmit={(e) => { e.preventDefault(); otpSent ? handleResetPassword(e) : handleSendCode(e); }} className="space-y-4">

            {/* Email Field */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#888888] mb-1.5 block">{t('auth.emailAddress')}</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-[#0052FF]/12 flex items-center justify-center">
                  <EnvelopeIcon className="w-4 h-4 text-[#0052FF]" />
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={otpSent || loading}
                  className="w-full bg-[#F9F9F9]/70 rounded-2xl pl-14 pr-4 py-3.5 text-sm text-[#111111] placeholder-[#AAAAAA] focus:outline-none focus:ring-2 focus:ring-[#0052FF]/30 focus:bg-[#F9F9F9] transition-all duration-200 disabled:opacity-40 border-0"
                  placeholder={t('auth.yourEmail')}
                  required
                />
              </div>
            </div>

            {/* OTP and Password fields - only show after OTP is sent */}
            {otpSent && (
              <>
                {/* OTP Field */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#888888] mb-1.5 block text-center">{t('auth.verificationCode')}</label>
                  <input
                    type="text"
                    id="otp"
                    name="otp"
                    maxLength="6"
                    value={formData.otp}
                    onChange={(e) => handleInputChange({ target: { name: 'otp', value: e.target.value.replace(/\D/g, '').slice(0, 6) } })}
                    disabled={loading}
                    className="w-full bg-[#F9F9F9]/70 rounded-2xl px-4 py-4 text-[#111111] placeholder-[#AAAAAA] focus:outline-none focus:ring-2 focus:ring-[#0052FF]/30 focus:bg-[#F9F9F9] transition-all duration-200 disabled:opacity-40 text-center text-2xl font-mono tracking-[0.35em] font-bold border-0"
                    placeholder="000000"
                    required
                  />
                </div>

                {/* New Password Field */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#888888] mb-1.5 block">{t('auth.newPassword')}</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-[#0052FF]/12 flex items-center justify-center">
                      <LockClosedIcon className="w-4 h-4 text-[#0052FF]" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      id="newPassword"
                      name="newPassword"
                      autoComplete="new-password"
                      value={formData.newPassword}
                      onChange={handleInputChange}
                      disabled={loading}
                      className="w-full bg-[#F9F9F9]/70 rounded-2xl pl-14 pr-16 py-3.5 text-sm text-[#111111] placeholder-[#AAAAAA] focus:outline-none focus:ring-2 focus:ring-[#0052FF]/30 focus:bg-[#F9F9F9] transition-all duration-200 disabled:opacity-40 border-0"
                      placeholder={t('auth.enterNewPassword')}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold tracking-widest text-[#AAAAAA] hover:text-[#0052FF] transition-colors select-none"
                    >
                      {showPassword ? t('auth.hide') : t('auth.show')}
                    </button>
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#888888] mb-1.5 block">{t('auth.confirmPassword')}</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-[#0052FF]/12 flex items-center justify-center">
                      <LockClosedIcon className="w-4 h-4 text-[#0052FF]" />
                    </div>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      id="confirmPassword"
                      name="confirmPassword"
                      autoComplete="new-password"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      disabled={loading}
                      className="w-full bg-[#F9F9F9]/70 rounded-2xl pl-14 pr-16 py-3.5 text-sm text-[#111111] placeholder-[#AAAAAA] focus:outline-none focus:ring-2 focus:ring-[#0052FF]/30 focus:bg-[#F9F9F9] transition-all duration-200 disabled:opacity-40 border-0"
                      placeholder={t('auth.confirmNewPassword')}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold tracking-widest text-[#AAAAAA] hover:text-[#0052FF] transition-colors select-none"
                    >
                      {showConfirmPassword ? t('auth.hide') : t('auth.show')}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Submit Button */}
            <Button
              onClick={(e) => { otpSent ? handleResetPassword(e) : handleSendCode(e); }}
              disabled={loading}
              className="w-full h-12 rounded-2xl font-bold text-sm mt-2 border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#0052FF]/25 hover:shadow-[#0052FF]/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300"
              style={{ background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 40%, #0052FF 100%)' }}
            >
              <span className="flex items-center justify-center gap-2 text-white">
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {otpSent ? t('auth.resettingPassword') : t('auth.sendingCode')}
                  </>
                ) : (
                  <>
                    <ShieldCheckIcon className="w-4 h-4" />
                    {otpSent ? t('auth.resetPasswordBtn') : t('auth.sendResetCode')}
                  </>
                )}
              </span>
            </Button>
          </form>

          {/* divider + back to sign in link */}
          <div className="mt-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-[#E8DDD0]" />
              <span className="text-[10px] text-[#AAAAAA] font-medium uppercase tracking-wider">{t('common.or')}</span>
              <div className="flex-1 h-px bg-[#E8DDD0]" />
            </div>
            <p className="text-center text-[13px] text-[#555555]">
              <span
                onClick={() => navigate('/signin')}
                className="text-[#0052FF] hover:text-[#E65100] font-bold cursor-pointer transition-colors flex items-center justify-center gap-1"
              >
                <ArrowLeftIcon className="w-3.5 h-3.5" />
                {t('auth.backToSignIn')}
              </span>
            </p>

            {/* Resend Code - only show after OTP form is displayed */}
            {otpSent && (
              <p className="text-center text-[13px] text-[#555555] mt-3">
                {t('auth.didntReceiveCode')}{' '}
                <span
                  onClick={handleSendCode}
                  className="text-[#0052FF] hover:text-[#E65100] font-bold cursor-pointer transition-colors"
                >
                  {t('auth.resend')}
                </span>
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ResetPassword;
