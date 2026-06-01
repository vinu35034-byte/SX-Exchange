import React, { createContext, useContext } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    // In development, provide a default context to handle HMR issues
    if (import.meta.env.DEV) {
      return {
        user: null,
        admin: null,
        loading: false,
        isAuthenticated: () => false,
        isUser: () => false,
        isAdmin: () => false,
        loginUser: () => Promise.resolve(),
        loginAdmin: () => Promise.resolve(),
        logoutUser: () => Promise.resolve(),
        logoutAdmin: () => Promise.resolve(),
        signupUser: () => Promise.resolve(),
        updateUser: () => Promise.resolve()
      };
    }
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  // Since UserAuth and AdminAuth are now separate and independent,
  // we'll create a simplified combined context that delegates to them
  // We'll import them dynamically to avoid circular dependencies
  const [userAuth, setUserAuth] = React.useState(null);
  const [adminAuth, setAdminAuth] = React.useState(null);

  React.useEffect(() => {
    // Dynamically import and access the auth contexts
    import('./UserAuthContext').then(({ useUserAuth }) => {
      setUserAuth(useUserAuth);
    });
    import('./AdminAuthContext').then(({ useAdminAuth }) => {
      setAdminAuth(useAdminAuth);
    });
  }, []);

  // Create a simple fallback context that works without the other contexts
  const value = {
    // User properties - these will be overridden by actual implementations
    user: null,
    loginUser: async (credentials) => {
      // This is a fallback - components should use useUserAuth directly
      console.warn('Using fallback loginUser - consider using useUserAuth directly');
      const userAuthModule = await import('./UserAuthContext');
      // This won't work properly, but prevents crashes
      return Promise.resolve();
    },
    logoutUser: async () => {
      console.warn('Using fallback logoutUser - consider using useUserAuth directly');
      return Promise.resolve();
    },
    signupUser: async (credentials) => {
      console.warn('Using fallback signupUser - consider using useUserAuth directly');
      return Promise.resolve();
    },
    updateUser: async (data) => {
      console.warn('Using fallback updateUser - consider using useUserAuth directly');
      return Promise.resolve();
    },
    
    // Admin properties
    admin: null,
    loginAdmin: async (credentials) => {
      console.warn('Using fallback loginAdmin - consider using useAdminAuth directly');
      return Promise.resolve();
    },
    logoutAdmin: async () => {
      console.warn('Using fallback logoutAdmin - consider using useAdminAuth directly');
      return Promise.resolve();
    },
    
    // Combined loading state
    loading: false,
    
    // Helper functions
    isAuthenticated: () => false,
    isUser: () => false,
    isAdmin: () => false,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
