import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { showToast } from '../../utils/toast';
import { ApiUtils } from '../../services/api';
import WithdrawalHistory from './WithdrawalHistory';

const WithdrawalHistoryPageWrapper = () => {
  const { t } = useTranslation();
  const [withdrawalHistory, setWithdrawalHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchWithdrawalHistory = async () => {
    try {
      setLoading(true);
      const response = await ApiUtils.get('/withdrawals/history');
      setWithdrawalHistory(response.withdrawals || []);
    } catch (error) {
      console.error('Error fetching withdrawal history:', error);
      showToast.error('Failed to load withdrawal history');
      setWithdrawalHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawalHistory();
  }, []);

  return (
    <WithdrawalHistory
      withdrawalHistory={withdrawalHistory}
      refreshHistory={fetchWithdrawalHistory}
      loading={loading}
      // No onClose prop - this makes it render as full page
    />
  );
};

export default WithdrawalHistoryPageWrapper;
