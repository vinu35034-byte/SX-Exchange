import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUserAuth } from '../contexts/UserAuthContext';
import { useSession } from '../contexts/SessionContext';
import Spinner from './common/Spinner';

const UserProtectedRoute = ({ children }) => {
  const { user, loading } = useUserAuth();
  const { sessionStatus } = useSession();

  if (loading) return <Spinner />;

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  return children;
};

export default UserProtectedRoute;
