import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { adminTheme } from '../../styles/adminTheme';
import { ApiUtils } from '../../services/api';
import { XMarkIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import toast from 'react-hot-toast';

const BulkActionsModal = ({ selectedUsers, isOpen, onClose, onBulkAction }) => {
  const [action, setAction] = useState('');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  const bulkActions = [
    { id: 'activate', label: 'Activate Users', needsValue: false },
    { id: 'deactivate', label: 'Deactivate Users', needsValue: false },
    { id: 'ban', label: 'Ban Users', needsValue: false },
    { id: 'unban', label: 'Unban Users', needsValue: false },
    { id: 'addSpecialTag', label: 'Add to Special Users', needsValue: false },
    { id: 'removeSpecialTag', label: 'Remove from Special Users', needsValue: false },
    { id: 'addTag', label: 'Add Custom Tag', needsValue: true, placeholder: 'Tag name' },
    { id: 'removeTag', label: 'Remove Custom Tag', needsValue: true, placeholder: 'Tag name' },
    { id: 'setVipLevel', label: 'Set VIP Level', needsValue: true, placeholder: 'VIP level (0-10)' },
    { id: 'addBalance', label: 'Add Balance', needsValue: true, placeholder: 'Amount (USDT)' },
    { id: 'delete', label: 'Delete Users', needsValue: false, dangerous: true }
  ];

  const selectedAction = bulkActions.find(a => a.id === action);

  const handleBulkAction = async () => {
    if (!action) {
      toast.error('Please select an action');
      return;
    }

    if (selectedAction?.needsValue && !value) {
      toast.error(`Please enter a ${selectedAction.placeholder.toLowerCase()}`);
      return;
    }

    if (selectedAction?.dangerous) {
      const confirm = window.confirm(`Are you sure you want to ${selectedAction.label.toLowerCase()}? This action cannot be undone.`);
      if (!confirm) return;
    }

    try {
      setLoading(true);
      const data = await ApiUtils.post('/admin/users/bulk-action', {
        userIds: selectedUsers.map(user => user._id), // Extract IDs from user objects
        action,
        value: selectedAction?.needsValue ? value : undefined
      });

      if (data.success) {
        toast.success(`Successfully ${selectedAction.label.toLowerCase()}`);
        onBulkAction();
        onClose();
      } else {
        toast.error(data.message || 'Failed to perform bulk action');
      }
    } catch (error) {
      console.error('Error performing bulk action:', error);
      toast.error('Failed to perform bulk action');
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
            <UserGroupIcon className="w-6 h-6 text-blue-500" />
            <h2 className={`text-xl font-bold ${adminTheme.textPrimary}`}>
              Bulk Actions
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-600/50 rounded-lg">
            <XMarkIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className={`${adminTheme.textSecondary} mb-4`}>
              Selected users: {selectedUsers.length}
            </p>
            <div className="max-h-20 overflow-y-auto bg-gray-700/50 rounded-lg p-2">
              {selectedUsers.map((user, index) => (
                <span key={user._id} className={`text-sm ${adminTheme.textSecondary}`}>
                  {user.username || user.email}
                  {index < selectedUsers.length - 1 && ', '}
                </span>
              ))}
            </div>
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
              <option value="">Select an action...</option>
              {bulkActions.map((actionItem) => (
                <option key={actionItem.id} value={actionItem.id}>
                  {actionItem.label}
                </option>
              ))}
            </select>
          </div>

          {selectedAction?.needsValue && (
            <div>
              <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                {selectedAction.placeholder}
              </label>
              <input
                type={selectedAction.id === 'setVipLevel' || selectedAction.id === 'addBalance' ? 'number' : 'text'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={selectedAction.placeholder}
                className={`w-full ${adminTheme.input} rounded-lg`}
                step={selectedAction.id === 'addBalance' ? '0.00000001' : undefined}
              />
            </div>
          )}

          {selectedAction?.dangerous && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm">
                ⚠️ This is a dangerous action that cannot be undone. Please be careful.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleBulkAction}
              disabled={loading || !action}
              className={`flex-1 ${selectedAction?.dangerous ? 'bg-red-600 hover:bg-red-700' : adminTheme.buttonPrimary}`}
            >
              {loading ? 'Processing...' : 'Execute Action'}
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

export default BulkActionsModal;
