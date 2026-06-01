import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { adminAuth } from '../services/api';

const AdminAuthContext = createContext();

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    if (import.meta.env.DEV) {
      return {
        admin: null,
        loading: false,
        loginAdmin: () => Promise.resolve(),
        logoutAdmin: () => Promise.resolve(),
        isAuthenticated: () => false,
        checkAuthStatus: () => Promise.resolve()
      };
    }
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  
  // Check if current route is an admin route
  const isAdminRoute = location.pathname.startsWith('/u/');

  // Check authentication status
  const checkAuthStatus = async () => {
    // Only check admin auth if we're on an admin route
    if (!isAdminRoute) {
      setAdmin(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const adminData = await adminAuth.checkAuth();
      if (adminData) {
        setAdmin(adminData.admin);
      } else {
        setAdmin(null);
      }
    } catch (error) {
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  };

  // Check authentication when route changes
  useEffect(() => {
    checkAuthStatus();
  }, [isAdminRoute]);

  const loginAdmin = async (credentials) => {
    try {
      setLoading(true);
      const response = await adminAuth.signin(credentials);
      
      // Check for successful response - backend uses session cookies, no sessionId needed
      if (response.admin) {
        setAdmin(response.admin);
        return { success: true, admin: response.admin };
      } else {
        throw new Error(response.message || response.error || 'Admin login failed');
      }
    } catch (error) {
      console.error('Admin login error:', error);
      setAdmin(null);
      throw new Error(error.message || 'Admin login failed');
    } finally {
      setLoading(false);
    }
  };

  const logoutAdmin = async () => {
    try {
      setLoading(true);
      await adminAuth.logout();
      setAdmin(null);
      return { success: true };
    } catch (error) {
      console.error('Admin logout error:', error);
      setAdmin(null);
      throw new Error(error.message || 'Admin logout failed');
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
  const isAuthenticated = () => !!admin;

  const value = {
    admin,
    loading,
    loginAdmin,
    logoutAdmin,
    checkAuthStatus,
    isAuthenticated
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};
