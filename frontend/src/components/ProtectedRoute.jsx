import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../contexts/SessionContext';
import Spinner from './common/Spinner';

const ProtectedRoute = ({ children, requireAdmin = false, requireUser = false }) => {
  const { isAuthenticated, isAdmin, isUser, loading } = useAuth();
  const { sessionStatus } = useSession(); // Removed sessionToken since we use session cookies

  if (loading) return <Spinner />;

  // Primary authentication check - use AuthContext
  if (requireAdmin && !isAdmin()) {
    return <Navigate to="/u/login" replace />;
  }

  if (requireUser && !isUser()) {
    return <Navigate to="/signin" replace />;
  }

  if ((requireAdmin || requireUser) && !isAuthenticated()) {
    return <Navigate to={requireAdmin ? "/u/login" : "/signin"} replace />;
  }

  return children;
};

export default ProtectedRoute;
