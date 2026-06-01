import React, { createContext, useContext, useState, useEffect } from 'react';
import { userAuth } from '../services/api';

const UserAuthContext = createContext();

export const useUserAuth = () => {
  const context = useContext(UserAuthContext);
  if (!context) {
    if (import.meta.env.DEV) {
      return {
        user: null,
        loading: false,
        loginUser: () => Promise.resolve(),
        logoutUser: () => Promise.resolve(),
        signupUser: () => Promise.resolve(),
        updateUser: () => {},
        isAuthenticated: () => false,
        checkAuthStatus: () => Promise.resolve()
      };
    }
    throw new Error('useUserAuth must be used within a UserAuthProvider');
  }
  return context;
};

export const UserAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check authentication status with retry logic but respect rate limits
  const checkAuthStatus = async (skipDelay = false) => {
    try {
      setLoading(true);
      
      // For session-based auth, we need to ensure cookies are properly sent
      // Implement retry logic with exponential backoff to handle rate limiting
      let retryCount = 0;
      const maxRetries = 2; // Reduced from 3 to avoid rate limiting
      const baseRetryDelay = 1000; // Increased base delay to 1 second
      
      while (retryCount < maxRetries) {
        try {
          // Initial delay only on first try and if not skipped
          if (retryCount === 0 && !skipDelay) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          
          const userData = await userAuth.checkAuth();
          if (userData && userData.user) {
            setUser(userData.user);
            return; // Success, exit retry loop
          } else {
            // No user data but no error - user not authenticated
            if (retryCount === maxRetries - 1) {
              setUser(null);
              return;
            }
          }
        } catch (error) {
          console.log(`Auth check attempt ${retryCount + 1} failed:`, error.message);
          
          // If rate limited, wait longer before retry
          if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
            console.log('Rate limited - waiting longer before retry');
            if (retryCount === maxRetries - 1) {
              console.log('Rate limit exceeded - stopping auth checks');
              setUser(null);
              return;
            }
            // Wait longer for rate limit recovery
            await new Promise(resolve => setTimeout(resolve, baseRetryDelay * Math.pow(2, retryCount + 1)));
            retryCount++;
            continue;
          }
          
          // If this is the last retry, set user to null
          if (retryCount === maxRetries - 1) {
            setUser(null);
            return;
          }
        }
        
        retryCount++;
        if (retryCount < maxRetries) {
          // Exponential backoff for retries
          await new Promise(resolve => setTimeout(resolve, baseRetryDelay * Math.pow(2, retryCount)));
        }
      }
    } catch (error) {
      console.error('Auth check failed completely:', error.message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Check authentication on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Update user data in context
  const updateUser = (userData) => {
    setUser(userData);
  };

  const loginUser = async (credentials) => {
    try {
      setLoading(true);
      
      // Check if this is already an authenticated session (from OTP verification)
      if (credentials.token && credentials.user) {
        // This is an already-verified session from OTP flow
        // For session-based auth, we don't need to store the token
        // The session cookie is already set by the backend
        setUser(credentials.user);
        
        // Force a synchronous state update for immediate authentication
        // Add a small delay to allow session to propagate
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verify the session is working by making a test API call with retry
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            const authCheck = await userAuth.checkAuth();
            
            // Ensure user state is set with latest data from server
            if (authCheck && authCheck.user) {
              setUser(authCheck.user);
            }
            break;
          } catch (authError) {
            retryCount++;
            if (retryCount === maxRetries) {
              console.error('Session verification failed after', maxRetries, 'attempts:', authError);
              setUser(null);
              throw new Error('Session verification failed. Please try signing in again.');
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 200 * retryCount));
          }
        }
        
        return { success: true, user: credentials.user };
      } else {
        // This is a regular login (fallback for non-OTP flow)
        const response = await userAuth.signin(credentials);
        
        // Check for successful response - backend uses session cookies, no sessionId needed
        if (response.user) {
          setUser(response.user);
          return { success: true, user: response.user };
        } else {
          throw new Error(response.message || response.error || 'Login failed');
        }
      }
    } catch (error) {
      setUser(null);
      throw new Error(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const logoutUser = async () => {
    try {
      setLoading(true);
      await userAuth.logout();
      setUser(null);
      return { success: true };
    } catch (error) {
      setUser(null);
      throw new Error(error.message || 'Logout failed');
    } finally {
      setLoading(false);
    }
  };

  const signupUser = async (userData) => {
    try {
      setLoading(true);
      const response = await userAuth.signup(userData);
      
      // Check for successful response - backend uses session cookies, no sessionId needed
      if (response.user) {
        setUser(response.user);
        return { success: true, user: response.user };
      } else {
        throw new Error(response.message || response.error || 'Signup failed');
      }
    } catch (error) {
      setUser(null);
      throw new Error(error.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
  const isAuthenticated = () => !!user;

  const value = {
    user,
    loading,
    loginUser,
    logoutUser,
    signupUser,
    updateUser,
    checkAuthStatus,
    isAuthenticated
  };

  return (
    <UserAuthContext.Provider value={value}>
      {children}
    </UserAuthContext.Provider>
  );
};
