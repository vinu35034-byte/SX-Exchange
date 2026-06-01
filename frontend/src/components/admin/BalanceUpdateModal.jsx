import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { adminTheme } from '../../styles/adminTheme';
import { ApiUtils } from '../../services/api';
import { XMarkIcon, BanknotesIcon } from "@heroicons/react/24/outline";
import toast from 'react-hot-toast';

const BalanceUpdateModal = ({ user, isOpen, onClose, onBalanceUpdate }) => {
  const [currency, setCurrency] = useState('USDT');
  const [amount, setAmount] = useState('');
  const [action, setAction] = useState('set');
  const [loading, setLoading] = useState(false);

  const currencies = ['USDT', 'BTC', 'ETH', 'BNB', 'TRX'];

  const handleUpdateBalance = async () => {
    if (!amount || isNaN(parseFloat(amount))) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      setLoading(true);
      const data = await ApiUtils.put(`/admin/users/${user._id}/balance`, {
        currency,
        amount: parseFloat(amount),
        action
      });

      if (data.success) {
        toast.success('Balance updated successfully');
        onBalanceUpdate();
        onClose();
      } else {
        toast.error(data.message || 'Failed to update balance');
      }
    } catch (error) {
      console.error('Error updating balance:', error);
      toast.error('Failed to update balance');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl w-full max-w-md`}>
        <div className={`${adminTheme.surface} p-6 border-b ${adminTheme.border} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <BanknotesIcon className="w-6 h-6 text-green-400" />
            <h2 className={`text-xl font-bold ${adminTheme.textPrimary}`}>
              Update Balance
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-600/50 rounded-lg">
            <XMarkIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className={`${adminTheme.textSecondary} mb-4`}>
              User: {user.username || user.email}
            </p>
          </div>

          <div>
            <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={`w-full ${adminTheme.input} rounded-lg`}
            >
              {currencies.map((curr) => (
                <option key={curr} value={curr}>{curr}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
              Action
            </label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className={`w-full ${adminTheme.input} rounded-lg`}
            >
              <option value="set">Set Balance</option>
              <option value="add">Add to Balance</option>
              <option value="subtract">Subtract from Balance</option>
            </select>
          </div>

          <div>
            <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
              Amount
            </label>
            <input
              type="number"
              step="0.00000001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount..."
              className={`w-full ${adminTheme.input} rounded-lg`}
            />
          </div>

          {user.balances && user.balances[currency] && (
            <div className="bg-gray-700/50 rounded-lg p-3">
              <p className={`text-sm ${adminTheme.textSecondary}`}>
                Current {currency} balance:
              </p>
              <p className={`font-semibold ${adminTheme.textPrimary}`}>
                {user.balances[currency].toFixed(8)}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleUpdateBalance}
              disabled={loading}
              className={`flex-1 ${adminTheme.buttonPrimary}`}
            >
              {loading ? 'Updating...' : 'Update Balance'}
            </Button>
            <Button
              onClick={onClose}
              className={`flex-1 ${adminTheme.buttonSecondary}`}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BalanceUpdateModal;
