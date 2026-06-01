import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { sessionManager, session as sessionAPI } from '../services/api';

const SessionContext = createContext();

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

export const SessionProvider = ({ children }) => {
  const [sessionInfo, setSessionInfo] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Session status check interval
  const [statusCheckInterval, setStatusCheckInterval] = useState(null);

  // Get session status
  const getSessionStatus = useCallback(async () => {
    try {
      setError(null);
      const response = await sessionAPI.getStatus();
      
      if (response.success) {
        setSessionInfo(response.data);
        setIsConnected(response.data.isActive);
        // No need to sync session IDs - cookies handle everything
      } else {
        setIsConnected(false);
        setError(response.message || 'Session check failed');
      }
    } catch (err) {
      setIsConnected(false);
      setError(err.message || 'Failed to check session status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh session
  const refreshSession = useCallback(async () => {
    try {
      setError(null);
      const response = await sessionAPI.refresh();
      
      if (response.success) {
        setSessionInfo(response.data);
        setIsConnected(true);
        // No need to sync session IDs - cookies handle everything
        return response.data;
      } else {
        throw new Error(response.message || 'Session refresh failed');
      }
    } catch (err) {
      setError(err.message || 'Failed to refresh session');
      setIsConnected(false);
      throw err;
    }
  }, []);

  // Clear session data
  const clearSession = useCallback(() => {
    sessionManager.clearSession();
    setSessionInfo(null);
    setIsConnected(false);
    setError(null);
  }, []);

  // Handle session expiry
  const handleSessionExpiry = useCallback(() => {
    clearSession();
    window.dispatchEvent(new CustomEvent('sessionExpired'));
  }, [clearSession]);

  // Start periodic session checks
  const startSessionChecks = useCallback(() => {
    if (statusCheckInterval) {
      clearInterval(statusCheckInterval);
    }

    const interval = setInterval(() => {
      getSessionStatus();
    }, 60000); // Check every minute

    setStatusCheckInterval(interval);
    return interval;
  }, [getSessionStatus, statusCheckInterval]);

  // Stop periodic session checks
  const stopSessionChecks = useCallback(() => {
    if (statusCheckInterval) {
      clearInterval(statusCheckInterval);
      setStatusCheckInterval(null);
    }
  }, [statusCheckInterval]);

  // Initialize session
  useEffect(() => {
    getSessionStatus();
    const interval = startSessionChecks();

    // Cleanup
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  // Update session activity on user interaction
  useEffect(() => {
    const updateActivity = () => {
      sessionManager.updateActivity();
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, updateActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true);
      });
    };
  }, []);

  const value = {
    // Session state
    sessionInfo,
    isConnected,
    isLoading,
    error,

    // Session status that ProtectedRoute expects
    sessionStatus: isLoading ? 'loading' : (isConnected ? 'authenticated' : 'unauthenticated'),
    // Remove sessionToken since we use session cookies, not bearer tokens
    sessionToken: null,

    // Session methods
    getSessionStatus,
    refreshSession,
    clearSession,
    startSessionChecks,
    stopSessionChecks,

    // Session utilities
    getSessionId: () => null, // No client-side session IDs for cookie-based auth
    updateActivity: () => sessionManager.updateActivity(),
    
    // Session status helpers
    isSessionActive: () => isConnected && sessionInfo?.isActive,
    getSessionDuration: () => sessionInfo?.duration || 0,
    getLastActivity: () => sessionInfo?.lastActivity,
    getSessionUser: () => sessionInfo?.user,
    getSessionType: () => sessionInfo?.type || 'guest',
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

export default SessionContext;
