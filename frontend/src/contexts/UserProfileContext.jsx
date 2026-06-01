import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUserAuth } from './UserAuthContext';
import { userProfile } from '../services/api';

const UserProfileContext = createContext();

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  
  if (!context) {
    if (import.meta.env.DEV) {
      return {
        profileData: null,
        loading: false,
        error: null,
        updateProfile: () => Promise.resolve({ success: false }),
        changePassword: () => Promise.resolve({ success: false }),
        changeEmail: () => Promise.resolve({ success: false }),
        refreshProfile: () => Promise.resolve(null),
        clearError: () => {},
      };
    }
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
};

export const UserProfileProvider = ({ children }) => {
  // Try to get user auth context, but don't fail if it's not available
  let userAuthContext = null;
  try {
    userAuthContext = useUserAuth();
  } catch (err) {
    // UserAuth context not available
  }

  const { user, updateUser } = userAuthContext || { user: null, updateUser: () => {} };
  
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(0);

  // Minimum time between profile fetches (5 seconds)
  const MIN_FETCH_INTERVAL = 5000;

  // Load profile data when user changes
  useEffect(() => {
    if (user && !profileData) {
      // Add a small delay to prevent immediate API calls after auth
      const timer = setTimeout(() => {
        loadProfile();
      }, 100);
      return () => clearTimeout(timer);
    } else if (!user) {
      setProfileData(null);
      setError(null);
    }
  }, [user?.id]); // Only depend on user ID to prevent excessive calls

  const loadProfile = async (force = false) => {
    if (!user) return;
    
    // Rate limiting check
    const now = Date.now();
    if (!force && (now - lastFetchTime) < MIN_FETCH_INTERVAL) {
      return profileData;
    }

    // Prevent duplicate requests
    if (loading) {
      return profileData;
    }
    
    try {
      setLoading(true);
      setError(null);
      setLastFetchTime(now);
      
      const response = await userProfile.getProfile();
      
      if (response && response.user) {
        setProfileData(response.user);
        // Update the user in AuthContext as well
        updateUser(response.user);
        return response.user;
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      const errorMessage = err.message || 'Failed to load profile';
      setError(errorMessage);
      
      // Don't show rate limit errors to user as they're temporary
      if (!errorMessage.includes('Too many') && !errorMessage.includes('rate limit')) {
        // Only set user-facing errors for non-rate-limit issues
      }
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await userProfile.updateProfile(updates);
      
      if (response && response.user) {
        setProfileData(response.user);
        updateUser(response.user);
        return { success: true, user: response.user };
      }
      
      return { success: false, error: 'Failed to update profile' };
    } catch (err) {
      console.error('Failed to update profile:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to update profile';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (passwordData) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await userProfile.changePassword(passwordData);
      return { success: true, message: 'Password changed successfully' };
    } catch (err) {
      console.error('Failed to change password:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to change password';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const changeEmail = async (emailData) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await userProfile.changeEmail(emailData);
      
      if (response && response.user) {
        setProfileData(response.user);
        updateUser(response.user);
        return { success: true, user: response.user };
      }
      
      return { success: true, message: 'Email updated successfully' };
    } catch (err) {
      console.error('Failed to change email:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to change email';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    return await loadProfile(true); // Force refresh when explicitly requested
  };

  const clearError = () => {
    setError(null);
  };

  const value = {
    // Data
    profileData: profileData || user,
    loading,
    error,
    
    // Actions
    updateProfile,
    changePassword,
    changeEmail,
    refreshProfile,
    clearError,
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
};

export default UserProfileProvider;
