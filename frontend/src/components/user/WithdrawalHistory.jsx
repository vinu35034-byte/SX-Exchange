import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, RefreshCw, Clock, CheckCircle, XCircle, Eye, ArrowLeft, ArrowUp } from 'lucide-react';
import Menu from '../Menu';
import Spinner from '../common/Spinner';

const meshBg = { background: '#FFFFFF' };

const WithdrawalHistory = ({ onClose, withdrawalHistory = [], refreshHistory, loading = false }) => {
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isModal = !!onClose;

  const handleRefresh = async () => {
    if (!refreshHistory) return;
    setIsRefreshing(true);
    try {
      await refreshHistory();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const getStatusConfig = (status) => {
    const map = {
      pending:    { color: 'text-[#0052FF] bg-[#0052FF]/10',  icon: <Clock className="w-3 h-3" />,       label: 'Pending' },
      processing: { color: 'text-blue-500 bg-blue-500/10',    icon: <Eye className="w-3 h-3" />,          label: 'Processing' },
      completed:  { color: 'text-green-500 bg-green-500/10',  icon: <CheckCircle className="w-3 h-3" />,  label: 'Completed' },
      approved:   { color: 'text-green-500 bg-green-500/10',  icon: <CheckCircle className="w-3 h-3" />,  label: 'Approved' },
      rejected:   { color: 'text-red-500 bg-red-500/10',      icon: <XCircle className="w-3 h-3" />,      label: 'Rejected' },
      failed:     { color: 'text-red-500 bg-red-500/10',      icon: <XCircle className="w-3 h-3" />,      label: 'Failed' },
    };
    return map[status] || { color: 'text-[#888888] bg-[#F4F4F4]', icon: <Clock className="w-3 h-3" />, label: status };
  };

  const formatDate = (date) =>
    new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const formatTime = (date) =>
    new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const networkLabel = (network) =>
    network === 'BEP20' || network === 'BSC' ? 'BEP-20' : network;

  const renderContent = () => {
    if (loading || isRefreshing) return <Spinner />;

    if (!withdrawalHistory || withdrawalHistory.length === 0) {
      return (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#F0F5FF] flex items-center justify-center">
            <ArrowUp className="w-8 h-8 text-[#0052FF]" />
          </div>
          <p className="text-[#111111] font-semibold mb-1">No sends yet</p>
          <p className="text-[#888888] text-sm mb-6">Your send history will appear here</p>
          {!isModal && (
            <button
              onClick={() => navigate('/withdraw')}
              className="text-white text-sm font-semibold px-6 py-3 rounded-xl border-0"
              style={{ background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 100%)' }}
            >
              Send Now
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {withdrawalHistory.map((withdrawal) => {
          const sc = getStatusConfig(withdrawal.status);
          return (
            <div key={withdrawal._id} className="flex items-center justify-between py-4 border-b border-[#F0F0F0] last:border-0">
              {/* Left */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#0052FF] bg-[#F0F5FF] px-2 py-0.5 rounded-md">
                    {networkLabel(withdrawal.network)}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md ${sc.color}`}>
                    {sc.icon}
                    {sc.label}
                  </span>
                </div>
                <span className="text-xs text-[#AAAAAA]">
                  {formatDate(withdrawal.createdAt)} · {formatTime(withdrawal.createdAt)}
                </span>
                {withdrawal.status === 'rejected' && withdrawal.rejectionReason && (
                  <span className="text-xs text-red-400">{withdrawal.rejectionReason}</span>
                )}
              </div>

              {/* Right */}
              <div className="text-right">
                <p className="text-base font-bold text-[#111111]">
                  -{parseFloat(withdrawal.amount).toLocaleString()}
                  <span className="text-xs font-medium text-[#888888] ml-1">USDT</span>
                </p>
                {withdrawal.fee > 0 && (
                  <p className="text-xs text-[#AAAAAA]">fee {parseFloat(withdrawal.fee).toFixed(2)}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Modal
  if (isModal) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
        <div className="bg-white rounded-t-3xl w-full max-w-md max-h-[80vh] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F0F0]">
            <h2 className="text-base font-bold text-[#111111]">Send History</h2>
            <button onClick={onClose} className="p-1 text-[#888888] hover:text-[#111111]">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="px-5 py-4 overflow-y-auto max-h-[calc(80vh-64px)]">
            {renderContent()}
          </div>
        </div>
      </div>
    );
  }

  // Full page
  return (
    <div className="min-h-screen" style={meshBg}>
      <div className="w-full max-w-md mx-auto px-4 py-6 pb-24">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 text-[#555555] hover:text-[#0052FF] rounded-lg hover:bg-[#F0F5FF] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-[#111111]">Send History</h1>
          </div>
          {refreshHistory && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 text-[#888888] hover:text-[#0052FF] rounded-lg hover:bg-[#F0F5FF] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {renderContent()}
      </div>

      <Menu />
    </div>
  );
};

export default WithdrawalHistory;
