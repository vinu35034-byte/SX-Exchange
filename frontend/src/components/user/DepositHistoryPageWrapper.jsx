import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { showToast } from '../../utils/toast';
import { getDepositHistory } from '../../services/api';
import DepositHistory from './DepositHistory';

const DepositHistoryPageWrapper = () => {
  const { t } = useTranslation();
  const [depositHistory, setDepositHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDepositHistory = async () => {
    try {
      setLoading(true);
      const response = await getDepositHistory();
      setDepositHistory(response.deposits || []);
    } catch (error) {
      console.error('Error fetching deposit history:', error);
      showToast.error('Failed to load deposit history');
      setDepositHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepositHistory();
  }, []);

  return (
    <DepositHistory
      depositHistory={depositHistory}
      refreshHistory={fetchDepositHistory}
      loading={loading}
      // No onClose prop - this makes it render as full page
    />
  );
};

export default DepositHistoryPageWrapper;
