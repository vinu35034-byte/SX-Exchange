import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { useSession } from '../../contexts/SessionContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import {
  ArrowUp,
  Wallet,
  CheckCircle,
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  Lock,
  Key,
  Mail,
} from "lucide-react";
import { GrDocumentTime } from "react-icons/gr";
import { getCryptoLogoUrl } from '../../utils/logoService';
import { ApiUtils } from '../../services/api';
import Menu from '../Menu';
import WithdrawalHistory from './WithdrawalHistory';
import { showToast } from '../../utils/toast';

const meshBg = { background: '#FFFFFF' };

const Withdraw = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useUserAuth();
  const { sessionStatus } = useSession(); // Removed sessionToken since we use session cookies
  const { isDarkMode } = useTheme();
  const { t } = useTranslation();
  const [selectedNetwork, setSelectedNetwork] = useState('BSC');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [showBalance, setShowBalance] = useState(true);
  const [loading, setLoading] = useState(false);
  const [withdrawalFee, setWithdrawalFee] = useState(0);
  const [minWithdrawal, setMinWithdrawal] = useState(1);
  const [recentWithdrawals, setRecentWithdrawals] = useState([]);
  const [errors, setErrors] = useState({});
  const [showHistory, setShowHistory] = useState(false);

  // Withdrawal password states
  const [withdrawalPasswordStep, setWithdrawalPasswordStep] = useState('check'); // 'check', 'create', 'verify', 'confirm'
  const [withdrawalPassword, setWithdrawalPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [enteredPassword, setEnteredPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({});
  const [hasWithdrawalPassword, setHasWithdrawalPassword] = useState(false);
  const [withdrawalPasswordVerified, setWithdrawalPasswordVerified] = useState(false);

  // Get user USDT balance from the new balances object structure
  const userBalances = user?.balances || {};
  const availableBalance = userBalances.USDT || 0;

  // Available networks for USDT withdrawal
  const availableNetworks = [
    {
      symbol: 'USDT',
      name: 'Tether (BSC)',
      network: 'BSC',
      networkName: 'BEP-20 (Binance Smart Chain)',
      minWithdrawal: 25,
      feePercentage: 0.05 // 5% fee
    }
  ];

  // Get selected network info
  const selectedNetworkInfo = availableNetworks.find(n => n.network === selectedNetwork);

  // Calculate fee based on amount (5% of withdrawal amount)
  const calculateFee = (amount) => {
    const parsedAmount = parseFloat(amount || 0);
    return parsedAmount * 0.05; // 5% fee
  };

  const currentFee = calculateFee(amount);

  // Fetch withdrawal info when network changes
  useEffect(() => {
    if (selectedNetwork && isAuthenticated()) {
      const networkInfo = availableNetworks.find(n => n.network === selectedNetwork);
      if (networkInfo) {
        setMinWithdrawal(networkInfo.minWithdrawal);
      }
    }
  }, [selectedNetwork]);

  // Set default network and remove unused effects
  useEffect(() => {
    if (isAuthenticated()) {
      fetchRecentWithdrawals();
      checkWithdrawalPasswordStatus();
    }
  }, []);

  const checkWithdrawalPasswordStatus = async () => {
    try {
      const data = await ApiUtils.get('/user/withdrawal-password/status');
      setHasWithdrawalPassword(data.hasPassword);
      setWithdrawalPasswordVerified(data.sessionVerified || false);
    } catch (error) {
      console.error('Error checking withdrawal password status:', error);
      setHasWithdrawalPassword(false);
      setWithdrawalPasswordVerified(false);
    }
  };

  const fetchWithdrawalInfo = async () => {
    try {
      const data = await ApiUtils.get('/withdrawals/fees');
      // Find the network-specific info from the response
      const networkInfo = data.fees?.find(f => f.network === selectedNetwork && f.coin === 'USDT');
      if (networkInfo) {
        setWithdrawalFee(networkInfo.withdrawalFee || selectedNetworkInfo?.fee || 1);
        setMinWithdrawal(networkInfo.minWithdrawal || selectedNetworkInfo?.minWithdrawal || 1);
      } else {
        // Use default values if network info not found
        setWithdrawalFee(selectedNetworkInfo?.fee || 1);
        setMinWithdrawal(selectedNetworkInfo?.minWithdrawal || 1);
      }
    } catch (error) {
      console.error('Error fetching withdrawal info:', error);
      // Use default values on error
      setWithdrawalFee(selectedNetworkInfo?.fee || 1);
      setMinWithdrawal(selectedNetworkInfo?.minWithdrawal || 1);
    }
  };

  const fetchRecentWithdrawals = async () => {
    try {
      const data = await ApiUtils.get('/withdrawals/history');
      setRecentWithdrawals(data.withdrawals || data.history || []);
    } catch (error) {
      console.error('Error fetching recent withdrawals:', error);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!recipientAddress.trim()) {
      newErrors.address = t('withdraw.addressRequired');
    } else if (recipientAddress.length < 20) {
      newErrors.address = t('withdraw.invalidAddress');
    }

    if (!amount.trim()) {
      newErrors.amount = t('withdraw.amountRequired');
    } else if (parseFloat(amount) <= 0) {
      newErrors.amount = t('withdraw.amountGreaterThanZero');
    } else if (parseFloat(amount) < minWithdrawal) {
      newErrors.amount = t('withdraw.minimumWithdrawal', { min: minWithdrawal });
    } else if (parseFloat(amount) > availableBalance) {
      newErrors.amount = t('withdraw.insufficientBalance', { amount, available: availableBalance.toFixed(2) });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleMaxAmount = () => {
    const maxAmount = availableBalance;
    setAmount(maxAmount.toFixed(2));
  };

  // Withdrawal password functions
  const sendOTP = async () => {
    setOtpLoading(true);
    try {
      await ApiUtils.post('/user/withdrawal-password/send-otp');
      setOtpSent(true);
      showToast.success(t('withdraw.otpSentToEmail'));
    } catch (error) {
      console.error('Error sending OTP:', error);
      showToast.error(error.message || 'Failed to send OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const validateWithdrawalPassword = () => {
    const errors = {};

    if (withdrawalPasswordStep === 'create') {
      if (!withdrawalPassword || withdrawalPassword.length < 4) {
        errors.password = 'Password must be at least 4 characters';
      }
      if (withdrawalPassword !== confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
      if (!otpCode || otpCode.length !== 6) {
        errors.otp = 'Please enter valid 6-digit OTP';
      }
    } else if (withdrawalPasswordStep === 'verify') {
      if (!enteredPassword || enteredPassword.length < 4) {
        errors.enteredPassword = 'Please enter your withdrawal password';
      }
    }

    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const createWithdrawalPassword = async () => {
    if (!validateWithdrawalPassword()) return;

    setLoading(true);
    try {
      await ApiUtils.post('/user/withdrawal-password/create', {
        password: withdrawalPassword,
        otp: otpCode
      });

      setHasWithdrawalPassword(true);
      setWithdrawalPasswordVerified(true);
      setWithdrawalPasswordStep('check');
      showToast.success(t('withdraw.withdrawalPasswordCreated'));

      // Automatically process withdrawal after password creation
      await processWithdrawal();

    } catch (error) {
      console.error('Error creating withdrawal password:', error);
      showToast.error(error.message || 'Failed to create withdrawal password');
      setLoading(false);
    }
  };

  const verifyWithdrawalPassword = async () => {
    if (!validateWithdrawalPassword()) return;
    if (loading) return; // Prevent multiple calls

    setLoading(true);
    try {
      await ApiUtils.post('/user/withdrawal-password/verify', {
        password: enteredPassword
      });

      setWithdrawalPasswordVerified(true);
      setWithdrawalPasswordStep('check');
      showToast.success(t('withdraw.passwordVerified'));

      // Automatically process withdrawal after verification
      await processWithdrawal();

    } catch (error) {
      console.error('Error verifying withdrawal password:', error);

      // Handle specific error messages from backend
      if (error.message?.includes('Invalid withdrawal password')) {
        showToast.error('Incorrect password.');
      } else if (error.message?.includes('Password is required')) {
        showToast.error('Please enter your withdrawal password.');
      } else if (error.message?.includes('Withdrawal password not set')) {
        showToast.error('Withdrawal password not found. Please set up a new one.');
        setWithdrawalPasswordStep('create');
      } else {
        showToast.error('Failed to verify password. Please try again.');
      }

      // Reset password field on verification failure
      setEnteredPassword('');
      setLoading(false);
    }
  };

  const processWithdrawal = async () => {
    try {
      // Map frontend network names to backend expected values
      const networkMapping = {
        'BSC': 'BEP20'
      };

      await ApiUtils.post('/withdrawals/create', {
        network: networkMapping[selectedNetwork] || selectedNetwork,
        amount: parseFloat(amount),
        withdrawalAddress: recipientAddress.trim()
      });

      // Reset form
      setAmount('');
      setRecipientAddress('');
      setWithdrawalPasswordStep('check');
      setWithdrawalPasswordVerified(false);
      setEnteredPassword('');
      setWithdrawalPassword('');
      setConfirmPassword('');
      setOtpCode('');
      setOtpSent(false);
      setPasswordErrors({});

      // Refresh recent withdrawals
      fetchRecentWithdrawals();
      // Refresh withdrawal password status
      checkWithdrawalPasswordStatus();

      // Show success message with details
      showToast.success(
        t('withdraw.withdrawalSubmitted', { amount: parseFloat(amount), network: selectedNetwork })
      );
    } catch (error) {
      console.error('Error submitting withdrawal:', error);

      // Handle session-related errors
      if (error.message?.includes('session') || error.message?.includes('unauthorized')) {
        showToast.error(t('withdraw.sessionExpired'));
        navigate('/login');
        return;
      }

      // Handle specific withdrawal errors
      if (error.message?.includes('too many pending')) {
        showToast.error(t('withdraw.tooManyPending'));
        return;
      }

      const errorMessage = error.message || 'Network error. Please try again.';
      showToast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prevent double-submission
    if (loading) return;

    // Check session status first
    if (!isAuthenticated()) {
      showToast.error(t('withdraw.sessionExpired'));
      navigate('/login');
      return;
    }

    if (!validateForm()) {
      return;
    }

    // Check withdrawal password status
    if (!hasWithdrawalPassword) {
      setWithdrawalPasswordStep('create');
      return;
    }

    if (!withdrawalPasswordVerified) {
      setWithdrawalPasswordStep('verify');
      return;
    }

    // If password is verified, process withdrawal directly
    setLoading(true);
    await processWithdrawal();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-emerald-400';
      case 'pending':
        return 'text-amber-400';
      case 'processing':
        return 'text-[#0052FF]';
      case 'rejected':
      case 'failed':
        return 'text-red-500';
      default:
        return 'text-[#888888]';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return CheckCircle;
      case 'pending':
      case 'processing':
        return Clock;
      case 'rejected':
      case 'failed':
        return AlertCircle;
      default:
        return Clock;
    }
  };

  if (!isAuthenticated()) {
    return (
      <div className="min-h-screen w-full max-w-md mx-auto flex items-center justify-center" style={meshBg}>
        <div className="text-center p-6">
          <p className="text-[#888888] mb-4">
            {t('withdraw.pleaseLoginWithdraw')}
          </p>
          <Button onClick={() => navigate('/signin')} style={{ background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 40%, #0052FF 100%)' }} className="text-white">
            {t('common.login')}
          </Button>
        </div>
      </div>
    );
  }

  if (availableBalance <= 0) {
    return (
      <div className="min-h-screen relative overflow-hidden" style={meshBg}>
        <div className="relative z-10 w-full max-w-md mx-auto px-4 py-6 pb-24">
          <header className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-bold text-[#0052FF]">Send</h1>
              <button
                onClick={() => navigate('/withdrawal-history')}
                className="text-[#555555] hover:text-[#0052FF] p-2 hover:bg-[#F0F5FF]/60 rounded-lg transition-all duration-200"
              >
                <GrDocumentTime className="w-5 h-5" />
              </button>
            </div>
          </header>

          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#F0F5FF] flex items-center justify-center">
              <Wallet className="w-8 h-8 text-[#0052FF]" />
            </div>
            <p className="text-[#111111] font-semibold mb-1">No balance available</p>
            <p className="text-[#888888] text-sm mb-6">Deposit USDT to start sending</p>
            <Button
              onClick={() => navigate('/deposit')}
              className="text-white font-bold px-6 py-3 rounded-xl border-0"
              style={{ background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 100%)' }}
            >
              Deposit Now
            </Button>
          </div>
        </div>
        <Menu />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={meshBg}>
      {/* Main Content */}
      <div className="relative z-10 w-full max-w-md mx-auto px-4 py-6 pb-24">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-[#0052FF]">Send</h1>
            <button
              onClick={() => navigate('/withdrawal-history')}
              className="text-[#555555] hover:text-[#0052FF] p-2 hover:bg-[#F0F5FF]/60 rounded-lg transition-all duration-200"
            >
              <GrDocumentTime className="w-5 h-5" />
            </button>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col items-center">
          {/* Coin + Network badge */}
          <div className="flex items-center gap-2 bg-[#F0F5FF] border border-[#0052FF]/20 rounded-full px-4 py-2 mb-12">
            <img
              src={getCryptoLogoUrl('USDT')}
              alt="USDT"
              className="w-5 h-5 rounded-full object-cover"
            />
            <span className="text-sm font-semibold text-[#111111]">USDT</span>
            <span className="text-[#CCCCCC] text-sm">·</span>
            <span className="text-sm font-semibold text-[#0052FF]">BEP-20</span>
          </div>

          {/* Large amount input */}
          <div className="flex items-center gap-1 mb-3 w-full justify-center">
            <span className="text-5xl font-bold text-[#CCCCCC]">$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="any"
              min="0"
              autoFocus
              className="text-5xl font-bold text-[#111111] bg-transparent border-none outline-none w-44 text-center placeholder-[#CCCCCC] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              style={{ MozAppearance: 'textfield' }}
            />
          </div>

          {/* Available + MAX */}
          <div className="flex items-center gap-3 mb-2">
            <button
              type="button"
              onClick={() => setShowBalance(v => !v)}
              className="text-[#AAAAAA] hover:text-[#555555] transition-colors"
            >
              {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <p className="text-sm text-[#AAAAAA]">
              {t('withdraw.available')} {showBalance ? `${availableBalance.toFixed(2)} USDT` : '••••'}
            </p>
            <button
              type="button"
              onClick={handleMaxAmount}
              className="text-xs font-bold text-[#0052FF] bg-[#F0F5FF] px-2.5 py-1 rounded-full hover:bg-[#EBF2FF] transition-colors"
            >
              {t('withdraw.maxAmount')}
            </button>
          </div>

          {errors.amount && (
            <p className="text-red-500 text-xs mb-3 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.amount}
            </p>
          )}

          {/* Quick amounts */}
          <div className="grid grid-cols-4 gap-2 w-full mb-10 mt-6">
            {[50, 100, 500, 1000].map(amt => (
              <button
                type="button"
                key={amt}
                onClick={() => setAmount(String(amt))}
                className={`py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 ${
                  parseFloat(amount) === amt
                    ? 'bg-[#0052FF] border-[#0052FF] text-white'
                    : 'bg-[#F4F8FF] border-[#0052FF]/15 text-[#0052FF] hover:bg-[#EBF2FF]'
                }`}
              >
                ${amt}
              </button>
            ))}
          </div>

          {/* Recipient Address */}
          <div className="w-full mb-8">
            <label className="text-sm font-bold text-[#111111] mb-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-[#0052FF] rounded-full"></div>
              {t('withdraw.recipientAddress', { network: 'BEP-20' })}
            </label>
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder={t('withdraw.enterAddress', { network: 'BSC' })}
              className="w-full px-0 py-4 bg-transparent border-b-2 border-[#0052FF]/25 text-[#111111] placeholder-[#888888] focus:outline-none focus:border-[#0052FF] transition-all duration-300 text-sm"
            />
            {errors.address && (
              <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.address}
              </p>
            )}
          </div>

          {/* Fee summary */}
          {amount && parseFloat(amount) > 0 && (
            <div className="w-full mb-8 bg-[#F4F8FF] rounded-2xl px-4 py-3 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-[#888888]">{t('withdraw.withdrawalAmount')}</span>
                <span className="text-[#111111] font-medium">{amount} USDT</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#888888]">{t('withdraw.networkFee')}</span>
                <span className="text-red-500 font-semibold">−{currentFee.toFixed(2)} USDT</span>
              </div>
              <div className="border-t border-[#0052FF]/10 pt-2 flex justify-between">
                <span className="text-[#111111] font-bold text-sm">{t('withdraw.youWillReceive')}</span>
                <span className="text-[#0052FF] font-bold">{Math.max(0, parseFloat(amount) - currentFee).toFixed(2)} USDT</span>
              </div>
            </div>
          )}

          {/* Subtle notice */}
          <p className="w-full text-[#000000] text-xs mb-2">Only send to a valid BEP-20 (BSC) address. Wrong address = permanent loss of funds.</p>
          <p className="w-full text-[#000000] text-xs mb-8">A 5% network fee is deducted from the withdrawal amount.</p>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading || !isAuthenticated()}
            className="w-full text-white font-bold py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 40%, #0052FF 100%)' }}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {t('withdraw.processingWithdrawal')}
              </div>
            ) : !hasWithdrawalPassword ? (
              <div className="flex items-center justify-center gap-2">
                <Lock className="w-5 h-5" />
                {t('withdraw.createWithdrawalPassword')}
              </div>
            ) : !withdrawalPasswordVerified ? (
              <div className="flex items-center justify-center gap-2">
                <Key className="w-5 h-5" />
                {t('withdraw.verifyWithdraw')}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <ArrowUp className="w-5 h-5" />
                {t('withdraw.withdrawNow')}
              </div>
            )}
          </Button>
        </form>
      </div>

      {/* Withdrawal History Modal */}
      {showHistory && (
        <WithdrawalHistory
          onClose={() => setShowHistory(false)}
          withdrawalHistory={recentWithdrawals}
          refreshHistory={fetchRecentWithdrawals}
        />
      )}

      {/* Create Password — bottom sheet */}
      {withdrawalPasswordStep === 'create' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setWithdrawalPasswordStep('check')} />
          <div
            className="relative w-full max-w-md bg-white rounded-t-3xl px-6 pt-5 pb-28 max-h-[90vh] overflow-y-auto"
            style={{ animation: 'slideUp 0.32s cubic-bezier(0.32,0.72,0,1)' }}
          >
            <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
            <div className="w-10 h-1 bg-[#E0E0E0] rounded-full mx-auto mb-6" />

            {/* Icon + title */}
            <div className="text-center mb-7">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-[#F0F5FF] flex items-center justify-center">
                <Lock className="w-6 h-6 text-[#0052FF]" />
              </div>
              <h2 className="text-base font-bold text-[#111111]">Set Withdrawal Password</h2>
              <p className="text-[#888888] text-sm mt-0.5">Secure your withdrawals with a PIN</p>
            </div>

            <div className="space-y-5">
              {!otpSent ? (
                <Button
                  onClick={sendOTP}
                  disabled={otpLoading}
                  className="w-full text-white font-bold py-4 rounded-xl border-0"
                  style={{ background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 100%)' }}
                >
                  {otpLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending…
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Mail className="w-4 h-4" />
                      Send OTP to Email
                    </div>
                  )}
                </Button>
              ) : (
                <>
                  {/* OTP */}
                  <div>
                    <label className="text-xs font-semibold text-[#888888] uppercase tracking-wide">OTP Code</label>
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      className="w-full mt-1 px-0 py-3 bg-transparent border-b-2 border-[#0052FF]/25 text-[#111111] text-2xl font-bold tracking-widest text-center placeholder-[#CCCCCC] focus:outline-none focus:border-[#0052FF] transition-colors"
                    />
                    {passwordErrors.otp && <p className="text-red-500 text-xs mt-1">{passwordErrors.otp}</p>}
                  </div>

                  {/* New password */}
                  <div>
                    <label className="text-xs font-semibold text-[#888888] uppercase tracking-wide">New Password</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={withdrawalPassword}
                      onChange={(e) => setWithdrawalPassword(e.target.value)}
                      placeholder="Min. 4 characters"
                      className="w-full mt-1 px-0 py-3 bg-transparent border-b-2 border-[#0052FF]/25 text-[#111111] placeholder-[#CCCCCC] focus:outline-none focus:border-[#0052FF] transition-colors text-sm"
                    />
                    {passwordErrors.password && <p className="text-red-500 text-xs mt-1">{passwordErrors.password}</p>}
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label className="text-xs font-semibold text-[#888888] uppercase tracking-wide">Confirm Password</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full mt-1 px-0 py-3 bg-transparent border-b-2 border-[#0052FF]/25 text-[#111111] placeholder-[#CCCCCC] focus:outline-none focus:border-[#0052FF] transition-colors text-sm"
                    />
                    {passwordErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.confirmPassword}</p>}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={() => setWithdrawalPasswordStep('check')}
                      disabled={loading}
                      className="flex-1 bg-[#F4F4F4] text-[#555555] border-0 font-semibold py-3 rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={createWithdrawalPassword}
                      disabled={loading}
                      className="flex-1 text-white font-bold py-3 rounded-xl border-0"
                      style={{ background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 100%)' }}
                    >
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Creating…
                        </div>
                      ) : 'Create'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Verify Password — bottom sheet */}
      {withdrawalPasswordStep === 'verify' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setWithdrawalPasswordStep('check')} />
          <div
            className="relative w-full max-w-md bg-white rounded-t-3xl px-6 pt-5 pb-28"
            style={{ animation: 'slideUp 0.32s cubic-bezier(0.32,0.72,0,1)' }}
          >
            <div className="w-10 h-1 bg-[#E0E0E0] rounded-full mx-auto mb-6" />

            <div className="text-center mb-7">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-[#F0F5FF] flex items-center justify-center">
                <Key className="w-6 h-6 text-[#0052FF]" />
              </div>
              <h2 className="text-base font-bold text-[#111111]">Enter Withdrawal Password</h2>
              <p className="text-[#888888] text-sm mt-0.5">Required to confirm this send</p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-xs font-semibold text-[#888888] uppercase tracking-wide">Password</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={enteredPassword}
                  onChange={(e) => setEnteredPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoFocus
                  className="w-full mt-1 px-0 py-3 bg-transparent border-b-2 border-[#0052FF]/25 text-[#111111] placeholder-[#CCCCCC] focus:outline-none focus:border-[#0052FF] transition-colors text-sm"
                />
                {passwordErrors.enteredPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.enteredPassword}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => setWithdrawalPasswordStep('check')}
                  disabled={loading}
                  className="flex-1 bg-[#F4F4F4] text-[#555555] border-0 font-semibold py-3 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={verifyWithdrawalPassword}
                  disabled={loading}
                  className="flex-1 text-white font-bold py-3 rounded-xl border-0"
                  style={{ background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 100%)' }}
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Verifying…
                    </div>
                  ) : 'Confirm'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Menu />
    </div>
  );
};

export default Withdraw;
