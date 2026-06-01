import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { useUserProfile } from '../../contexts/UserProfileContext';
import { useSession } from '../../contexts/SessionContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from "@/components/ui/button";
import {
  Copy,
  QrCode,
  CheckCircle,
  AlertCircle,
  Wallet,
  RefreshCw,
  ShieldX,
  Timer,
  Clock
} from "lucide-react";
import { GrDocumentTime } from "react-icons/gr";
import { getCryptoLogoUrl } from '../../utils/logoService';
import { ApiUtils } from '../../services/api';
import Menu from '../Menu';
import Spinner from '../common/Spinner';
import { showToast } from '../../utils/toast';

const meshBg = { background: '#FFFFFF' };

const Deposit = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user, isAuthenticated } = useUserAuth();
  const { sessionStatus } = useSession(); // Removed sessionToken since we use session cookies
  const { profileData } = useUserProfile();
  const { isDarkMode } = useTheme();
  const [selectedNetwork] = useState(location.state?.network || 'BSC');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositAddress, setDepositAddress] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [timerSeconds, setTimerSeconds] = useState(300);
  const [timerExpired, setTimerExpired] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submittingDeposit, setSubmittingDeposit] = useState(false);
  const [showAddressSection, setShowAddressSection] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submittedDetails, setSubmittedDetails] = useState(null);
  const [showKycWarning, setShowKycWarning] = useState(false);

  // Available networks for USDT deposit
  const availableNetworks = [
    {
      symbol: 'USDT',
      name: 'Tether (BSC)',
      network: 'BSC',
      networkName: 'BEP-20 (Binance Smart Chain)',
      minDeposit: '20 USDT',
      fee: 'Free',
      type: 'dynamic'
    },
    {
      symbol: 'USDT',
      name: 'Tether (TRC20)',
      network: 'TRC20',
      networkName: 'TRC-20 (TRON Network)',
      minDeposit: '20 USDT',
      fee: 'Free',
      type: 'static',
      staticAddress: import.meta.env.VITE_DEPOSIT_ADDRESS_TRC20 || ''
    }
  ];

  // Fetch recent deposits on component mount
  useEffect(() => {
    if (isAuthenticated()) {
      const timer = setTimeout(() => setInitialLoading(false), 800);
      return () => clearTimeout(timer);
    } else {
      setInitialLoading(false);
    }
  }, []);

  // 5-minute countdown timer — starts when deposit address is ready
  useEffect(() => {
    if (!depositAddress || !showAddressSection) return;
    setTimerSeconds(300);
    setTimerExpired(false);
    const interval = setInterval(() => {
      setTimerSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimerExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [depositAddress]);

  const generateDepositAddress = async () => {
    setLoading(true);
    try {
      // Get selected network info
      const selectedNetworkInfo = availableNetworks.find(n => n.network === selectedNetwork);

      let addressData;

      // Handle static address (TRC20)
      if (selectedNetworkInfo?.type === 'static' && selectedNetworkInfo?.staticAddress) {
        const address = selectedNetworkInfo.staticAddress;
        const qrService = import.meta.env.VITE_QR_CODE_SERVICE || 'https://api.qrserver.com/v1/create-qr-code';
        addressData = {
          address: address,
          network: selectedNetwork,
          qrCodeUrl: `${qrService}/?size=200x200&data=${address}`
        };
      } else {
        // Handle dynamic address (BSC) - try to get existing or generate new
        try {
          const existingData = await ApiUtils.get('/deposits/addresses');

          // Check if we have an address for this network
          const networkKey = selectedNetwork === 'BSC' ? 'BEP20' : selectedNetwork;

          if (existingData.addresses && existingData.addresses[networkKey]) {
            const address = existingData.addresses[networkKey].address;
            const qrService = import.meta.env.VITE_QR_CODE_SERVICE || 'https://api.qrserver.com/v1/create-qr-code';
            addressData = {
              address: address,
              network: selectedNetwork,
              qrCodeUrl: `${qrService}/?size=200x200&data=${address}`
            };
          }
        } catch (error) {
          // Ignore errors from getting existing addresses
        }

        // If no existing address, generate new one
        if (!addressData) {
          const response = await ApiUtils.post('/deposits/generate-addresses', {
            coin: 'USDT',
            network: selectedNetwork
          });

          if (response.address) {
            const qrService = import.meta.env.VITE_QR_CODE_SERVICE || 'https://api.qrserver.com/v1/create-qr-code';
            addressData = {
              address: response.address,
              network: selectedNetwork,
              qrCodeUrl: `${qrService}/?size=200x200&data=${response.address}`
            };
          } else {
            throw new Error('Failed to generate deposit address');
          }
        }
      }

      setDepositAddress(addressData.address);
      setQrCodeUrl(addressData.qrCodeUrl);
      showToast.success(t('deposit.addressGenerated'));
    } catch (error) {
      console.error('Failed to get deposit address:', error);
      showToast.error(t('deposit.failedGenerateAddress'));
    } finally {
      setLoading(false);
    }
  };

  const handleDepositRequest = async () => {
    if (!depositAmount || parseFloat(depositAmount) < 20) {
      showToast.error(t('deposit.minimum50Usdt'));
      return;
    }

    // Check KYC verification status
    const currentUser = profileData || user;
    if (!currentUser?.kycStatus || currentUser.kycStatus !== 'approved') {
      setShowKycWarning(true);
      return;
    }

    setShowAddressSection(true);
    generateDepositAddress();
  };

  const resetForm = () => {
    setDepositAmount('');
    setShowAddressSection(false);
    setShowConfirmation(false);
    setShowKycWarning(false);
    setDepositAddress('');
    setQrCodeUrl('');
    setSubmittedDetails(null);
    setTimerSeconds(300);
    setTimerExpired(false);
  };

  const formatTimer = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const submitDepositRequest = async () => {
    if (!depositAddress) {
      showToast.error(t('deposit.generateAddressFirst'));
      return;
    }

    setSubmittingDeposit(true);

    const submitPromise = ApiUtils.post('/deposits/submit-request', {
      amount: parseFloat(depositAmount),
      network: selectedNetwork,
      address: depositAddress
    });

    showToast.promise(
      submitPromise,
      {
        loading: t('deposit.submitting'),
        success: () => {
          setSubmittedDetails({
            amount: depositAmount,
            network: selectedNetwork,
            address: depositAddress,
            timestamp: new Date()
          });
          setShowConfirmation(true);
          setShowAddressSection(false);
          return t('deposit.submittedSuccess');
        },
        error: (err) => {
          if (err.message?.includes('Authentication')) return t('deposit.pleaseLoginDeposit');
          if (err.message?.includes('Invalid deposit address')) return 'Invalid address';
          if (err.message) return err.message.replace(/Error: /g, '').trim();
          return 'Submission failed';
        },
      }
    ).finally(() => {
      setSubmittingDeposit(false);
    });
  };

  const fetchRecentDeposits = async () => {
    // Removed - no longer needed
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
      showToast.success(t('deposit.copied'));
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      showToast.error(t('deposit.copyFailed'));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return 'text-green-500';
      case 'pending':
      case 'submitted':
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
      case 'approved':
      case 'completed':
        return CheckCircle;
      case 'pending':
      case 'submitted':
        return Clock;
      case 'rejected':
      case 'failed':
        return AlertCircle;
      default:
        return Clock;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'submitted':
        return 'Pending Review';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'completed':
        return 'Completed';
      default:
        return status;
    }
  };

  if (!isAuthenticated()) {
    return (
      <div className="min-h-screen relative overflow-hidden" style={meshBg}>
        <div className="relative z-10 w-full max-w-md mx-auto px-4 py-6 pb-24 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="bg-white/70 backdrop-blur-xl border border-[#0052FF]/15 rounded-2xl p-8 mb-6">
              <p className="text-[#555555] mb-6">{t('deposit.pleaseLoginDeposit')}</p>
              <Button
                onClick={() => navigate('/login')}
                className="text-white font-bold px-8 py-3 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 border-0"
                style={{ background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 40%, #0052FF 100%)' }}
              >
                Login
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show KYC warning if user is not verified
  if (showKycWarning) {
    const currentUser = profileData || user;
    const kycStatus = currentUser?.kycStatus;
    const isPending = kycStatus === 'pending';
    const isRejected = kycStatus === 'rejected';

    return (
      <div className="min-h-screen relative overflow-hidden" style={meshBg}>
        <div className="relative z-10 w-full max-w-md mx-auto px-4 py-6 pb-24 flex flex-col items-center justify-center min-h-screen">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center mb-6">
            <ShieldX className="w-8 h-8 text-orange-400" />
          </div>

          {/* Text */}
          <h2 className="text-xl font-bold text-[#111111] mb-2">{t('deposit.verificationRequired')}</h2>
          <p className="text-sm text-[#888888] text-center mb-2">
            {t('deposit.completeKycToDeposit')}
          </p>

          {/* Status badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-8 ${
            isPending ? 'bg-[#0052FF]/10 text-[#0052FF]' :
            isRejected ? 'bg-red-50 text-red-500' :
            'bg-[#F4F4F4] text-[#888888]'
          }`}>
            {isPending ? <Clock className="w-3 h-3" /> : isRejected ? <AlertCircle className="w-3 h-3" /> : <ShieldX className="w-3 h-3" />}
            {isPending ? 'Under Review' : isRejected ? 'Rejected' : 'Not Verified'}
          </div>

          {/* Action */}
          <Button
            onClick={() => navigate('/kyc')}
            className="w-full text-white font-bold py-3.5 rounded-xl border-0 mb-3"
            style={{ background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 100%)' }}
          >
            {isPending ? t('deposit.checkKycStatus') : isRejected ? t('deposit.resubmitKyc') : t('deposit.startVerification')}
          </Button>
          <button
            onClick={() => setShowKycWarning(false)}
            className="text-sm text-[#888888] hover:text-[#0052FF] transition-colors"
          >
            {t('deposit.goBack')}
          </button>
        </div>
        <Menu />
      </div>
    );
  }

  if (initialLoading) {
    return <Spinner />;
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={meshBg}>
      {/* Main Content */}
      <div className="relative z-10 w-full max-w-md mx-auto px-4 py-6 pb-24">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-[#0052FF]">
                    {t('deposit.depositUsdt')}
                  </h1>
                </div>
                <button
                  onClick={() => navigate('/deposit-history')}
                  className="text-[#555555] hover:text-[#0052FF] p-2 hover:bg-[#F0F5FF]/60 rounded-lg transition-all duration-200"
                  title="View deposit history"
                >
                  <GrDocumentTime className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Amount Entry */}
        {!showAddressSection && (
          <div className="flex flex-col items-center">
            {/* Coin + Network badge */}
            <div className="flex items-center gap-2 bg-[#F0F5FF] border border-[#0052FF]/20 rounded-full px-4 py-2 mb-12">
              <img
                src={getCryptoLogoUrl('USDT')}
                alt="USDT"
                className="w-5 h-5 rounded-full object-cover"
              />
              <span className="text-sm font-semibold text-[#111111]">USDT</span>
              <span className="text-[#CCCCCC] text-sm">·</span>
              <span className="text-sm font-semibold text-[#0052FF]">
                {selectedNetwork === 'BSC' ? 'BEP-20' : 'TRC-20'}
              </span>
            </div>

            {/* Large amount input */}
            <div className="flex items-center gap-1 mb-3 w-full justify-center">
              <span className="text-5xl font-bold text-[#CCCCCC]">$</span>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                min="20"
                step="0.01"
                autoFocus
                className="text-5xl font-bold text-[#111111] bg-transparent border-none outline-none w-44 text-center placeholder-[#CCCCCC] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                style={{ MozAppearance: 'textfield' }}
              />
            </div>
            <p className="text-sm text-[#AAAAAA] mb-10">{t('deposit.minAmount')}</p>

            {/* Quick amounts */}
            <div className="grid grid-cols-4 gap-2 w-full mb-10">
              {[50, 100, 500, 1000].map(amount => (
                <button
                  key={amount}
                  onClick={() => setDepositAmount(String(amount))}
                  className={`py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 ${
                    parseFloat(depositAmount) === amount
                      ? 'bg-[#0052FF] border-[#0052FF] text-white'
                      : 'bg-[#F4F8FF] border-[#0052FF]/15 text-[#0052FF] hover:bg-[#EBF2FF]'
                  }`}
                >
                  ${amount}
                </button>
              ))}
            </div>

            <Button
              onClick={handleDepositRequest}
              disabled={!depositAmount || parseFloat(depositAmount) < 20}
              className="w-full text-white font-bold py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 40%, #0052FF 100%)' }}
            >
              {t('deposit.continue')}
            </Button>
          </div>
        )}

        {/* Deposit Address Section */}
        {showAddressSection && (
          <div className="mb-8">
            <div className="mb-6">
              <h3 className="font-bold text-[#111111] text-lg mb-2 flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                {t('deposit.sendUsdtToAddress', { amount: depositAmount })}
              </h3>
              <p className="text-[#555555] text-sm">
                Network: {availableNetworks.find(n => n.network === selectedNetwork)?.networkName}
              </p>
            </div>

            {loading ? (
              <div className="py-16">
                <Spinner />
              </div>
            ) : depositAddress ? (
              <>
                {/* QR Code */}
                <div className="text-center mb-10">
                  <div className="w-48 h-48 mx-auto mb-6 bg-white rounded-2xl p-4 border border-[#0052FF]/20 shadow-xl">
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="QR Code" className="w-full h-full" />
                    ) : (
                      <div className="w-full h-full bg-[#0052FF]/12 rounded-lg flex items-center justify-center">
                        <QrCode className="w-20 h-20 text-[#555555]" />
                      </div>
                    )}
                  </div>
                  <p className="text-[#555555] text-sm">{t('deposit.scanQrCode')}</p>
                </div>

                {/* Address */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-[#111111]">{t('deposit.depositAddress')}</label>
                    <button
                      onClick={generateDepositAddress}
                      disabled={loading}
                      className="flex items-center gap-2 px-3 py-2 text-xs text-[#555555] hover:text-[#0052FF] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                      {t('deposit.refresh')}
                    </button>
                  </div>

                  <div className="border-b-2 border-[#0052FF]/25 pb-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[#111111] font-mono text-sm break-all mr-4">
                        {depositAddress}
                      </p>
                      <button
                        onClick={() => copyToClipboard(depositAddress)}
                        className="shrink-0 p-3 bg-[#F0F5FF] text-[#0052FF] border border-[#0052FF]/30 rounded-lg transition-colors"
                      >
                        {copiedAddress ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <Copy className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Subtle notice */}
                <p className="mt-6 text-[#040303] text-xs">Send only {depositAmount} USDT on {selectedNetwork === 'BSC' ? 'BEP-20' : 'TRC-20'}. Wrong network = permanent loss of funds.</p>
                <p className="text-[#000000] text-xs mt-0.5">Requires {selectedNetwork === 'BSC' ? '12' : '19'} confirmations. Do not send from exchanges.</p>

                {/* Timer + Done button */}
                <div className="mt-8 space-y-4">
                  {timerExpired ? (
                    <div className="text-center py-6">
                      <p className="text-red-400 font-semibold mb-1">Time's up</p>
                      <p className="text-[#888888] text-sm mb-4">Your session expired. Please start over.</p>
                      <Button
                        onClick={resetForm}
                        className="w-full border border-[#0052FF]/20 bg-transparent text-[#0052FF] font-medium py-3 rounded-xl"
                      >
                        Start Over
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-center gap-2 py-3">
                        <Timer className="w-4 h-4 text-[#888888]" />
                        <span className={`font-mono text-lg font-bold ${timerSeconds <= 60 ? 'text-red-400' : 'text-[#0052FF]'}`}>
                          {formatTimer(timerSeconds)}
                        </span>
                        <span className="text-[#888888] text-xs">remaining</span>
                      </div>
                      <Button
                        onClick={submitDepositRequest}
                        disabled={submittingDeposit}
                        className="w-full bg-linear-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white font-bold py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                      >
                        {submittingDeposit ? (
                          <div className="flex items-center justify-center gap-2">
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            {t('deposit.submitting')}
                          </div>
                        ) : (
                          "I've Done Payment"
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <Wallet className="w-16 h-16 mx-auto mb-4 text-[#888888]" />
                <p className="text-[#555555] mb-4">{t('deposit.failedGenerateAddress')}</p>
                <Button
                  onClick={generateDepositAddress}
                  className="text-white font-bold px-6 py-3 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 40%, #0052FF 100%)' }}
                >
                  {t('deposit.tryAgain')}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Success bottom sheet */}
      {showConfirmation && submittedDetails && (
        <div className="fixed inset-0 z-200 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-md bg-white rounded-3xl px-6 pt-5 pb-8"
            style={{ animation: 'slideUp 0.32s cubic-bezier(0.32,0.72,0,1)' }}
          >
            <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

            {/* Handle */}
            <div className="w-10 h-1 bg-[#E0E0E0] rounded-full mx-auto mb-6" />

            {/* Icon + title */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-green-500" />
              </div>
              <h2 className="text-lg font-bold text-[#111111]">Deposit Submitted</h2>
              <p className="text-[#888888] text-sm mt-0.5">Your request is being processed</p>
            </div>

            {/* Details */}
            <div className="space-y-3 mb-7 border border-[#F0F0F0] rounded-2xl p-4">
              <div className="flex justify-between items-center">
                <span className="text-[#888888] text-sm">Amount</span>
                <span className="text-[#111111] font-semibold">{submittedDetails.amount} USDT</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#888888] text-sm">Network</span>
                <span className="text-[#111111] text-sm font-medium">
                  {availableNetworks.find(n => n.network === submittedDetails.network)?.networkName}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#888888] text-sm">Status</span>
                <div className="flex items-center gap-1.5 bg-[#0052FF]/10 rounded-lg px-2.5 py-1">
                  <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
                  <span className="text-[#0052FF] text-xs font-medium">Processing</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#888888] text-sm">Submitted</span>
                <span className="text-[#111111] text-sm">{submittedDetails.timestamp.toLocaleTimeString()}</span>
              </div>
            </div>

            {/* Single button */}
            <Button
              onClick={() => navigate('/assets', { state: { fromDeposit: true } })}
              className="w-full text-white font-bold py-4 rounded-xl border-0"
              style={{ background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 100%)' }}
            >
              Assets
            </Button>
          </div>
        </div>
      )}

      <Menu />
    </div>
  );
};

export default Deposit;
