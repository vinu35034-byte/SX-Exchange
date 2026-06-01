import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import HexLogo from '../common/HexLogo';
import { motion } from 'framer-motion';
import {
  AtSymbolIcon,
  KeyIcon,
  UserCircleIcon,
  CheckCircleIcon,
  SparklesIcon,
  FingerPrintIcon,
  ChevronLeftIcon,
  ArrowRightIcon
} from "@heroicons/react/24/outline";
import { useUserAuth } from '../../contexts/UserAuthContext';
import Spinner from '../common/Spinner';
import { otpAuth, referralApi } from '../../services/api';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

const meshBg = { background: '#FFFFFF' };

const SignUp = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { loginUser, isAuthenticated, loading: authLoading } = useUserAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    referralCode: ''
  });
  const [otp, setOtp] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [referralInfo, setReferralInfo] = useState(null);
  const referralDebounceRef = useRef(null);

  const inputBase = "w-full bg-gray-50 rounded-2xl pl-14 pr-4 py-3.5 text-sm text-[#111111] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0052FF]/20 focus:bg-white focus:border-[#0052FF] transition-all duration-200 disabled:opacity-40 border border-gray-200";
  const inputWithRight = "w-full bg-gray-50 rounded-2xl pl-14 pr-16 py-3.5 text-sm text-[#111111] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0052FF]/20 focus:bg-white focus:border-[#0052FF] transition-all duration-200 disabled:opacity-40 border border-gray-200";

  const validateReferralCode = (code) => {
    if (!code) return;
    if (referralDebounceRef.current) clearTimeout(referralDebounceRef.current);
    referralDebounceRef.current = setTimeout(async () => {
      try {
        const data = await referralApi.validateCode(code);
        if (data.valid) setReferralInfo(data.referrer);
        else { setReferralInfo(null); if (formData.referralCode) toast.error(t('signUp.invalidReferralCode')); }
      } catch (e) { console.error('Error validating referral code:', e); setReferralInfo(null); }
    }, 500);
  };

  useEffect(() => {
    const refCode = new URLSearchParams(location.search).get('ref');
    if (refCode) { setFormData(p => ({ ...p, referralCode: refCode.toUpperCase() })); validateReferralCode(refCode); }
  }, [location]);

  const handleInputChange = (field, value) => {
    setFormData(p => ({ ...p, [field]: value }));
    if (field === 'referralCode') { value.trim() ? validateReferralCode(value.trim()) : setReferralInfo(null); }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated()) navigate('/', { replace: true });
  }, [isAuthenticated, authLoading, navigate]);

  if (authLoading) return <Spinner />;

  /* ── handlers ── */
  const handleSignupSubmit = async () => {
    if (formData.password !== formData.confirmPassword) { toast.error(t('signUp.passwordMismatch')); return; }
    if (!agreedToTerms) { toast.error(t('signUp.agreeToTermsError')); return; }
    if (!formData.email || !formData.password || !formData.username) { toast.error(t('signUp.fillAllFields')); return; }
    setLoading(true);
    try {
      const data = await otpAuth.signupRequest({
        email: formData.email, username: formData.username,
        password: formData.password, referralCode: formData.referralCode || undefined
      });
      if (data.success) { toast.success(t('signUp.otpSent')); setSessionId(data.sessionId); setStep(2); }
      else throw new Error(data.message || 'Failed to send OTP');
    } catch (e) { toast.error(e.message || t('auth.signupFailed')); }
    finally { setLoading(false); }
  };

  const handleOTPSubmit = async () => {
    if (!otp || otp.length !== 6) { toast.error(t('signUp.invalidOtp')); return; }
    setLoading(true);
    try {
      const data = await otpAuth.verifySignup({ sessionId, otp });
      if (data.success) {
        if (!data.token) { toast.error(t('auth.pleaseSignIn')); navigate('/signin'); return; }
        if (!data.user) { toast.error(t('auth.userDataMissing')); navigate('/signin'); return; }
        try {
          const lr = await loginUser({ token: data.token, user: data.user });
          if (lr?.success && lr?.user) { toast.success(t('signUp.welcomeTo NexaBit')); navigate('/'); }
          else { toast.error(t('auth.pleaseSignInToContinue')); navigate('/signin'); }
        } catch { toast.error(t('auth.pleaseSignInToContinue')); navigate('/signin'); }
      } else throw new Error(data.message || t('signUp.otpVerificationFailed'));
    } catch (e) { toast.error(e.message || t('signUp.otpVerificationFailed')); }
    finally { setLoading(false); }
  };

  const handleResendOTP = async () => {
    setResendLoading(true);
    try {
      const data = await otpAuth.resendSignupOTP({ sessionId });
      if (data.success) { toast.success(t('signUp.newOtpSent')); setOtp(''); }
      else throw new Error(data.message || t('signUp.failedToResendOtp'));
    } catch (e) { toast.error(e.message || t('signUp.failedToResendOtp')); }
    finally { setResendLoading(false); }
  };

  /* ── OTP step ── */
  if (step === 2) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden" style={meshBg}>
        <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full border border-[#0052FF]/10" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 w-96 h-96 rounded-full border border-[#0052FF]/8" />

        <div className="w-full max-w-100 relative z-10">
          {/* logo — outside card */}
          <motion.div
            className="flex justify-center mb-5"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <HexLogo size="md" />
          </motion.div>

          {/* card */}
          <motion.div
            className="bg-white rounded-3xl px-7 py-9 shadow-xl shadow-gray-200 border border-gray-200"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          >
            <h1 className="text-[22px] font-bold text-[#111111] leading-tight mb-1">{t('signUp.verifyEmail')}</h1>
            <p className="text-[13px] text-[#555555] mb-6">{t('signUp.codeSentTo', { email: formData.email })}</p>

            {/* fingerprint badge */}
            <div className="flex justify-center mb-5">
              <div className="w-16 h-16 rounded-2xl bg-[#0052FF]/10 flex items-center justify-center border border-[#0052FF]/20">
                <FingerPrintIcon className="w-8 h-8 text-[#0052FF]" />
              </div>
            </div>

            {/* OTP */}
            <div className="space-y-5">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#888888] mb-1.5 block text-center">{t('signUp.verificationCode')}</label>
                <input
                  type="text" value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={loading}
                  className="w-full bg-gray-50 rounded-2xl px-4 py-4 text-[#111111] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0052FF]/20 focus:bg-white focus:border-[#0052FF] transition-all duration-200 disabled:opacity-40 text-center text-2xl font-mono tracking-[0.35em] font-bold border border-gray-200"
                  placeholder="• • • • • •" maxLength={6}
                />
              </div>

              <Button onClick={handleOTPSubmit}
                disabled={loading || !otp || otp.length !== 6}
                className="w-full h-12 rounded-2xl font-bold text-sm border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#0052FF]/25 hover:shadow-[#0052FF]/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300"
                style={{ background: '#0052FF' }}
              >
                <span className="flex items-center justify-center gap-2 text-white">
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {t('signUp.verifying')}</>
                  ) : t('signUp.verifyCode')}
                </span>
              </Button>

              <div className="text-center space-y-1.5">
                <p className="text-[#555555] text-xs">{t('signUp.didntReceive')}</p>
                <button onClick={handleResendOTP} disabled={resendLoading}
                  className="text-[#0052FF] hover:text-[#0040CC] text-xs font-semibold transition-colors disabled:opacity-40">
                  {resendLoading ? t('signUp.sending') : t('signUp.resendCode')}
                </button>
              </div>

              <button onClick={() => setStep(1)} disabled={loading}
                className="flex items-center gap-1 mx-auto text-gray-400 hover:text-gray-600 text-xs transition-colors disabled:opacity-40">
                <ChevronLeftIcon className="w-3 h-3" /> {t('signUp.backToSignUp')}
              </button>
            </div>
          </motion.div>

          {/* footer */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <span className="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-[#0052FF]" /> {t('signUp.encrypted')}
            </span>
            <span className="w-px h-3 bg-gray-200" />
            <span className="text-[10px] text-gray-400 font-medium">{t('signUp.twoFAProtected')}</span>
          </div>
        </div>
      </div>
    );
  }

  /* ── signup form ── */
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden" style={meshBg}>

      {/* decorative rings */}
      <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full border border-[#0052FF]/10" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 w-96 h-96 rounded-full border border-[#0052FF]/8" />
      <div className="pointer-events-none absolute top-1/4 right-[-8%] w-44 h-44 rounded-full bg-[#0052FF]/5 blur-2xl" />

      <div className="w-full max-w-100 relative z-10">

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
            <h1 className="text-[22px] font-bold text-[#111111] leading-tight mb-1">Start for free</h1>
            <p className="text-[13px] text-[#555555] mb-7">Create your GB Exchange account</p>

            <form onSubmit={(e) => { e.preventDefault(); handleSignupSubmit(); }} className="space-y-3.5">

              {/* username */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#888888] mb-1.5 block">{t('signUp.username')}</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-[#0052FF]/10 flex items-center justify-center">
                    <UserCircleIcon className="w-4 h-4 text-[#0052FF]" />
                  </div>
                  <input type="text" autoComplete="username"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    disabled={loading} className={inputBase} placeholder={t('signUp.username')}
                  />
                </div>
              </div>

              {/* email */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#888888] mb-1.5 block">{t('signUp.email')}</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-[#0052FF]/10 flex items-center justify-center">
                    <AtSymbolIcon className="w-4 h-4 text-[#0052FF]" />
                  </div>
                  <input type="email" autoComplete="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    disabled={loading} className={inputBase} placeholder="you@example.com"
                  />
                </div>
              </div>

              {/* referral */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#888888] mb-1.5 block">
                  {t('signUp.referralCode')}
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-[#0052FF]/10 flex items-center justify-center">
                    <SparklesIcon className="w-4 h-4 text-[#0052FF]" />
                  </div>
                  <input type="text"
                    value={formData.referralCode}
                    onChange={(e) => handleInputChange('referralCode', e.target.value.toUpperCase())}
                    disabled={loading}
                    className={`w-full rounded-2xl pl-14 pr-12 py-3.5 text-sm text-[#111111] placeholder-gray-400 focus:outline-none focus:ring-2 transition-all duration-200 disabled:opacity-40 border ${
                      referralInfo
                        ? 'bg-green-50 focus:ring-green-400/30 border-green-300'
                        : formData.referralCode && !referralInfo
                        ? 'bg-red-50 focus:ring-red-400/20 border-red-200'
                        : 'bg-gray-50 focus:ring-[#0052FF]/20 focus:border-[#0052FF] border-gray-200'
                    }`}
                    placeholder="Enter code"
                  />
                  {referralInfo && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <CheckCircleIcon className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                </div>
                {referralInfo && (
                  <p className="text-xs text-green-600 flex items-center mt-1.5 gap-1 pl-1">
                    <CheckCircleIcon className="w-3.5 h-3.5" />
                    {t('signUp.referredBy', { username: referralInfo.username })}
                  </p>
                )}
              </div>

              {/* password */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#888888] mb-1.5 block">{t('signUp.password')}</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-[#0052FF]/10 flex items-center justify-center">
                    <KeyIcon className="w-4 h-4 text-[#0052FF]" />
                  </div>
                  <input type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    disabled={loading} className={inputWithRight} placeholder={t('signUp.password')}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold tracking-widest text-gray-400 hover:text-[#0052FF] transition-colors select-none">
                    {showPassword ? t('auth.hide') : t('auth.show')}
                  </button>
                </div>
              </div>

              {/* confirm password */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#888888] mb-1.5 block">{t('signUp.confirmPassword')}</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-[#0052FF]/10 flex items-center justify-center">
                    <KeyIcon className="w-4 h-4 text-[#0052FF]" />
                  </div>
                  <input type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    disabled={loading} className={inputWithRight} placeholder={t('signUp.confirmPassword')}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold tracking-widest text-gray-400 hover:text-[#0052FF] transition-colors select-none">
                    {showConfirmPassword ? t('auth.hide') : t('auth.show')}
                  </button>
                </div>
              </div>

              {/* terms */}
              <div className="flex items-start gap-3 pt-1">
                <button type="button" onClick={() => setAgreedToTerms(!agreedToTerms)}
                  className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all duration-200 mt-0.5 shrink-0 border ${
                    agreedToTerms ? 'bg-[#0052FF] border-[#0052FF] shadow-sm shadow-[#0052FF]/30' : 'border-gray-300 hover:border-[#0052FF] bg-white'
                  }`}>
                  {agreedToTerms && <CheckCircleIcon className="w-3 h-3 text-white" />}
                </button>
                <p className="text-xs text-[#555555] leading-relaxed">
                  {t('signUp.agreeToTerms').split('Terms')[0]}
                  <span onClick={() => navigate('/terms')} className="text-[#0052FF] hover:text-[#0040CC] cursor-pointer font-semibold">Terms</span>
                  {' '}{t('common.or')}{' '}
                  <span onClick={() => navigate('/terms')} className="text-[#0052FF] hover:text-[#0040CC] cursor-pointer font-semibold">Privacy Policy</span>
                </p>
              </div>

              {/* submit */}
              <Button onClick={handleSignupSubmit}
                disabled={loading || !agreedToTerms}
                className="w-full h-12 rounded-2xl font-bold text-sm mt-2 border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#0052FF]/25 hover:shadow-[#0052FF]/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300"
                style={{ background: '#0052FF' }}
              >
                <span className="flex items-center justify-center gap-2 text-white">
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {t('signUp.creatingAccount')}</>
                  ) : (
                    <>{t('signUp.createAccountBtn')} <ArrowRightIcon className="w-4 h-4" /></>
                  )}
                </span>
              </Button>
            </form>

            {/* divider + signin link */}
            <div className="mt-7">
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{t('common.or')}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <p className="text-center text-[13px] text-[#555555]">
                {t('signUp.alreadyHaveAccount')}{' '}
                <span onClick={() => navigate('/signin')}
                  className="text-[#0052FF] hover:text-[#0040CC] font-bold cursor-pointer transition-colors">
                  {t('signUp.signIn')}
                </span>
              </p>
            </div>
          </motion.div>
        </div>
    </div>
  );
};

export default SignUp;
