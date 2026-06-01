import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { adminTheme } from '../../styles/adminTheme';
import { ApiUtils } from '../../services/api';
import { XMarkIcon, KeyIcon } from "@heroicons/react/24/outline";
import toast from 'react-hot-toast';

const PasswordResetModal = ({ isOpen, onClose, user, onPasswordReset }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState('manual'); // 'manual' or 'generate'

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (action === 'manual') {
      if (newPassword !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }

      if (newPassword.length < 6) {
        toast.error('Password must be at least 6 characters long');
        return;
      }
    }

    try {
      setLoading(true);
      
      const data = await ApiUtils.put(`/admin/users/${user._id}/password`, {
        newPassword: action === 'manual' ? newPassword : undefined,
        generateRandom: action === 'generate'
      });

      if (data.success) {
        if (action === 'generate') {
          toast.success(`Password reset successfully. New password: ${data.newPassword}`);
        } else {
          toast.success('Password reset successfully');
        }
        onPasswordReset();
        onClose();
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(data.message || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error('Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 ${adminTheme.modalOverlay} flex items-center justify-center z-50`}>
      <div className={`${adminTheme.modalContent} rounded-lg p-6 w-full max-w-md`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-semibold ${adminTheme.textPrimary} flex items-center`}>
            <KeyIcon className="h-5 w-5 mr-2 text-[#FCD535]" />
            Reset Password for {user?.username}
          </h3>
          <button
            onClick={onClose}
            className={`${adminTheme.textSecondary} hover:${adminTheme.textPrimary} transition-colors`}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium ${adminTheme.textPrimary} mb-2`}>
              Reset Method
            </label>
            <div className="space-y-2">
              <label className={`flex items-center ${adminTheme.textSecondary}`}>
                <input
                  type="radio"
                  value="manual"
                  checked={action === 'manual'}
                  onChange={(e) => setAction(e.target.value)}
                  className="mr-2 text-[#FCD535] focus:ring-[#FCD535]"
                />
                Set new password manually
              </label>
              <label className={`flex items-center ${adminTheme.textSecondary}`}>
                <input
                  type="radio"
                  value="generate"
                  checked={action === 'generate'}
                  onChange={(e) => setAction(e.target.value)}
                  className="mr-2 text-[#FCD535] focus:ring-[#FCD535]"
                />
                Generate random password
              </label>
            </div>
          </div>

          {action === 'manual' && (
            <>
              <div>
                <label className={`block text-sm font-medium ${adminTheme.textPrimary} mb-1`}>
                  New Password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`w-full p-2 ${adminTheme.input} rounded-md`}
                  required
                  minLength={8}
                  placeholder="Enter new password"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${adminTheme.textPrimary} mb-1`}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full p-2 ${adminTheme.input} rounded-md`}
                  required
                  minLength={8}
                  placeholder="Confirm new password"
                />
              </div>
            </>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={`${adminTheme.buttonSecondary}`}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || (action === 'manual' && (!newPassword || !confirmPassword))}
              className={`${adminTheme.buttonPrimary}`}
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordResetModal;
