import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import HexLogo from '../common/HexLogo';
import {
  AtSymbolIcon,
  KeyIcon,
  FingerPrintIcon,
  ChevronLeftIcon,
  ArrowRightIcon
} from "@heroicons/react/24/outline";
import { useUserAuth } from '../../contexts/UserAuthContext';
import Spinner from '../common/Spinner';
import { ApiUtils } from '../../services/api';
import { showToast } from '../../utils/toast';

const meshBg = { background: '#FFFFFF' };

const SignIn = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { loginUser, isAuthenticated, loading: authLoading } = useUserAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState('credentials');
  const [otpTimer, setOtpTimer] = useState(0);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [otpData, setOtpData] = useState({ otp: '', userId: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && isAuthenticated()) navigate('/', { replace: true });
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    let iv;
    if (otpTimer > 0) iv = setInterval(() => setOtpTimer(p => p - 1), 1000);
    return () => clearInterval(iv);
  }, [otpTimer]);

  if (authLoading) return <Spinner />;

  /* ── handlers ── */
  const handleInputChange = (field, value) => {
    if (currentStep === 'credentials') setFormData(p => ({ ...p, [field]: value }));
    else setOtpData(p => ({ ...p, [field]: value }));
    if (error) setError('');
  };

  const handleCredentialsSubmit = async () => {
    if (!formData.email || !formData.password) { showToast.error(t('auth.fillAllFields')); return; }
    setLoading(true); setError('');
    try {
      const data = await ApiUtils.post('/otp/verify-credentials', { email: formData.email, password: formData.password });
      setOtpData(p => ({ ...p, userId: data.userId }));
      setCurrentStep('otp');
      setOtpTimer(data.expiresIn || 300);
      showToast.success(t('auth.otpSent'));
    } catch (e) { showToast.error(e.message || t('auth.verificationFailed')); }
    finally { setLoading(false); }
  };

  const handleOtpSubmit = async () => {
    if (!otpData.otp || otpData.otp.length !== 6) { showToast.error(t('auth.invalidOtp')); return; }
    setLoading(true); setError('');
    try {
      const data = await ApiUtils.post('/otp/verify-otp', { userId: otpData.userId, otp: otpData.otp });
      const lr = await loginUser({ token: data.token, user: data.user });
      if (lr && lr.success) {
        await new Promise(r => setTimeout(r, 200));
        navigate('/');
      } else throw new Error('Authentication failed after OTP verification');
    } catch (e) {
      if (e.message?.includes('expired')) { setOtpTimer(0); showToast.error(t('auth.otpExpired')); }
      else if (e.message?.includes('No OTP found')) { setOtpTimer(0); showToast.error(t('auth.noValidOtp')); }
      else showToast.error(e.message || t('auth.otpVerifyFailed'));
    } finally { setLoading(false); }
  };

  const handleResendOtp = async () => {
    if (otpTimer > 0) return;
    setLoading(true);
    try {
      const data = await ApiUtils.post('/otp/resend-otp', { userId: otpData.userId });
      setOtpTimer(data.expiresIn || 300);
      showToast.success(t('auth.otpResent'));
    } catch (e) { showToast.error(e.message || t('auth.failedResendOtp')); }
    finally { setLoading(false); }
  };

  const handleSubmit = () => { currentStep === 'credentials' ? handleCredentialsSubmit() : handleOtpSubmit(); };
  const handleBackToCredentials = () => { setCurrentStep('credentials'); setOtpData({ otp: '', userId: '' }); setOtpTimer(0); setError(''); };
  const handleKeyPress = (e) => { if (e.key === 'Enter') handleSubmit(); };

  /* ── render ── */
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden" style={meshBg}>

      {/* decorative floating rings */}
      <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full border border-[#0052FF]/10" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 w-96 h-96 rounded-full border border-[#0052FF]/8" />
      <div className="pointer-events-none absolute top-1/3 right-[-8%] w-44 h-44 rounded-full bg-[#0052FF]/5 blur-2xl" />

      <div className="w-full max-w-95 relative z-10">

          {/* logo — outside card */}
          <motion.div
            className="flex justify-center mb-5"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <HexLogo size="md" />
          </motion.div>

          {/* ── card ── */}
          <motion.div
            className="bg-white rounded-3xl px-7 py-9 shadow-xl shadow-gray-200 border border-gray-200"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          >
            <h1 className="text-[22px] font-bold text-[#111111] leading-tight mb-1">
              {currentStep === 'credentials' ? t('auth.signIn') : t('auth.verifyIdentity')}
            </h1>
            <p className="text-[13px] text-[#555555] mb-7">
              {currentStep === 'credentials' ? t('auth.signInToAccount') : t('auth.enterOtpCode')}
            </p>

            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>

              <AnimatePresence mode="wait">
              {currentStep === 'credentials' ? (
                <motion.div
                  key="credentials"
                  className="space-y-4"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  {/* email */}
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-[#888888] mb-1.5 block">{t('auth.emailLabel')}</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-[#0052FF]/10 flex items-center justify-center">
                        <AtSymbolIcon className="w-4 h-4 text-[#0052FF]" />
                      </div>
                      <input
                        type="email" autoComplete="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={loading}
                        className="w-full bg-gray-50 rounded-2xl pl-14 pr-4 py-3.5 text-sm text-[#111111] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0052FF]/20 focus:bg-white focus:border-[#0052FF] transition-all duration-200 disabled:opacity-40 border border-gray-200"
                        placeholder={t('auth.emailPlaceholder')}
                      />
                    </div>
                  </div>

                  {/* password */}
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-[#888888] mb-1.5 block">{t('auth.passwordLabel')}</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-[#0052FF]/10 flex items-center justify-center">
                        <KeyIcon className="w-4 h-4 text-[#0052FF]" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={loading}
                        className="w-full bg-gray-50 rounded-2xl pl-14 pr-16 py-3.5 text-sm text-[#111111] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0052FF]/20 focus:bg-white focus:border-[#0052FF] transition-all duration-200 disabled:opacity-40 border border-gray-200"
                        placeholder={t('auth.passwordPlaceholder')}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold tracking-widest text-gray-400 hover:text-[#0052FF] transition-colors select-none">
                        {showPassword ? t('auth.hide') : t('auth.show')}
                      </button>
                    </div>
                  </div>

                  {/* forgot */}
                  <div className="flex justify-end -mt-1">
                    <span onClick={() => navigate('/reset-password')}
                      className="text-[11px] text-[#0052FF] hover:text-[#0040CC] font-semibold cursor-pointer transition-colors">
                      {t('auth.forgotPassword')}
                    </span>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="otp"
                  className="space-y-5"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  {/* fingerprint badge */}
                  <div className="flex justify-center">
                    <div className="w-16 h-16 rounded-2xl bg-[#0052FF]/10 flex items-center justify-center border border-[#0052FF]/20">
                      <FingerPrintIcon className="w-8 h-8 text-[#0052FF]" />
                    </div>
                  </div>

                  <p className="text-center text-xs text-[#555555]">
                    Sent to <span className="text-[#0052FF] font-semibold">{formData.email}</span>
                  </p>

                  {/* OTP input */}
                  <div>
                    <input
                      type="text" maxLength="6"
                      value={otpData.otp}
                      onChange={(e) => handleInputChange('otp', e.target.value.replace(/\D/g, ''))}
                      onKeyPress={handleKeyPress}
                      disabled={loading}
                      className="w-full bg-gray-50 rounded-2xl px-4 py-4 text-[#111111] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0052FF]/20 focus:bg-white focus:border-[#0052FF] transition-all duration-200 disabled:opacity-40 text-center text-2xl font-mono tracking-[0.35em] font-bold border border-gray-200"
                      placeholder={t('auth.otpPlaceholder')}
                    />
                  </div>

                  {/* timer / resend */}
                  <div className="text-center">
                    {otpTimer > 0 ? (
                      <p className="text-xs text-[#555555]">
                        {t('auth.expiresIn')}{' '}
                        <span className="font-bold text-[#0052FF]">
                          {Math.floor(otpTimer / 60)}:{(otpTimer % 60).toString().padStart(2, '0')}
                        </span>
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        <p className="text-xs text-red-500 font-medium">{t('auth.codeExpiredText')}</p>
                        <button type="button" onClick={handleResendOtp} disabled={loading}
                          className="text-xs text-[#0052FF] hover:text-[#0040CC] font-semibold transition-colors disabled:opacity-40">
                          {t('auth.resendCode')}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* back */}
                  <button type="button" onClick={handleBackToCredentials} disabled={loading}
                    className="flex items-center gap-1 mx-auto text-gray-400 hover:text-gray-600 text-xs transition-colors disabled:opacity-40">
                    <ChevronLeftIcon className="w-3 h-3" /> {t('auth.backToLogin')}
                  </button>
                </motion.div>
              )}
              </AnimatePresence>

              {/* submit */}
              <Button onClick={handleSubmit}
                disabled={loading || (currentStep === 'otp' && (otpData.otp.length !== 6 || otpTimer <= 0))}
                className="w-full h-12 rounded-2xl font-bold text-sm mt-6 border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#0052FF]/25 hover:shadow-[#0052FF]/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300"
                style={{ background: '#0052FF' }}
              >
                <span className="flex items-center justify-center gap-2 text-white">
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {currentStep === 'credentials' ? t('auth.signingIn') : t('auth.verifying')}
                    </>
                  ) : currentStep === 'credentials' ? (
                    <>{t('auth.signIn')} <ArrowRightIcon className="w-4 h-4" /></>
                  ) : otpTimer <= 0 ? t('auth.codeExpired') : t('auth.verifyCode')}
                </span>
              </Button>
            </form>

            {/* divider + signup link */}
            {currentStep === 'credentials' && (
              <p className="text-center text-[13px] text-[#555555] mt-6">
                {t('auth.newTo NexaBit')}{' '}
                <span onClick={() => navigate('/signup')}
                  className="text-[#0052FF] hover:text-[#0040CC] font-bold cursor-pointer transition-colors">
                  {t('common.createAccount')}
                </span>
              </p>
            )}
          </motion.div>

        </div>
    </div>
  );
};

export default SignIn;
