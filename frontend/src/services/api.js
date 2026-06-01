const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1';

// Get configuration from environment variables
const RATE_LIMIT_CONFIG = {
  enabled: import.meta.env.VITE_RATE_LIMIT_ENABLED !== 'false',
  maxRequests: parseInt(import.meta.env.VITE_CLIENT_THROTTLE_REQUESTS || '20'),
  windowMs: parseInt(import.meta.env.VITE_CLIENT_THROTTLE_WINDOW || '15000'),
  requestSpacing: parseInt(import.meta.env.VITE_REQUEST_SPACING || '200'),
  maxRetryAttempts: parseInt(import.meta.env.VITE_MAX_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(import.meta.env.VITE_RETRY_DELAY || '1000'),
  debugLogging: import.meta.env.VITE_ENABLE_DEBUG_LOGGING === 'true',
  apiTimeout: parseInt(import.meta.env.VITE_API_REQUEST_TIMEOUT || '10000')
};

// Session management utilities
class SessionManager {
  constructor() {
    // For cookie-based sessions, we don't need to manage client-side session IDs
    // The browser handles session cookies automatically
    this.isConnected = false;
    this.lastActivity = Date.now();
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.pendingRequests = new Map(); // Track pending requests to prevent duplicates
  }

  // Remove client-side session ID generation since we use server cookies
  getSessionId() {
    // Return null since we use server-side session cookies
    return null;
  }

  updateActivity() {
    this.lastActivity = Date.now();
    this.requestCount++;
    this.lastRequestTime = Date.now();
  }

  // Check if we should throttle requests to avoid rate limiting
  shouldThrottle() {
    if (!RATE_LIMIT_CONFIG.enabled) {
      return false;
    }

    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // If making requests too frequently, throttle
    if (timeSinceLastRequest < RATE_LIMIT_CONFIG.requestSpacing) {
      return true;
    }
    
    // Reset request count every window
    if (now - this.lastActivity > RATE_LIMIT_CONFIG.windowMs) {
      this.requestCount = 0;
    }
    
    // If more than max requests in the window, throttle
    return this.requestCount > RATE_LIMIT_CONFIG.maxRequests;
  }

  // Check if a request to this URL is already pending
  isPending(url) {
    return this.pendingRequests.has(url);
  }

  // Add a pending request
  addPendingRequest(url, promise) {
    this.pendingRequests.set(url, promise);
    promise.finally(() => {
      this.pendingRequests.delete(url);
    });
    return promise;
  }

  // Get existing pending request
  getPendingRequest(url) {
    return this.pendingRequests.get(url);
  }

  clearSession() {
    // For cookie-based sessions, we rely on server to clear the session cookie
    // No client-side session data to clear
    this.lastActivity = Date.now();
    this.requestCount = 0;
    this.pendingRequests.clear();
  }
}

// Create singleton session manager
const sessionManager = new SessionManager();

// Enhanced API utilities
class ApiUtils {
  static getDefaultHeaders() {
    return {
      'Content-Type': 'application/json',
      // Remove X-Session-ID since we use server-side session cookies
      'X-Timestamp': new Date().toISOString(),
    };
  }

  static async makeRequest(url, options = {}) {
    // Ensure URL starts with a slash for proper concatenation
    const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
    const fullUrl = `${API_BASE_URL}${normalizedUrl}`;
    
    // Check if the same request is already pending (for GET requests)
    if (options.method === 'GET' || !options.method) {
      const existing = sessionManager.getPendingRequest(fullUrl);
      if (existing) {
        return existing;
      }
    }
    
    // Check if we should throttle to avoid rate limiting
    if (sessionManager.shouldThrottle()) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_CONFIG.requestSpacing * 2));
    }
    
    sessionManager.updateActivity();
    
    const defaultOptions = {
      credentials: 'include',
      headers: {
        ...this.getDefaultHeaders(),
        ...options.headers,
      },
    };

    const finalOptions = { 
      ...defaultOptions, 
      ...options,
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(RATE_LIMIT_CONFIG.apiTimeout)
    };
    
    const requestPromise = (async () => {
      try {
        const response = await fetch(fullUrl, finalOptions);
        
        // Get response text first to handle both JSON and non-JSON responses
        const responseText = await response.text();
       
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (jsonError) {
          throw new Error(`Server returned non-JSON response: ${response.status} ${response.statusText}. Response: ${responseText.substring(0, 100)}...`);
        }

        if (!response.ok) {
          // Handle rate limiting specifically
          if (response.status === 429) {
            const error = new Error(data.message || 'Too Many Requests - Rate Limited');
            error.status = 429;
            error.isRateLimit = true;
            throw error;
          }
          
          // Handle session expiry
          if (response.status === 401 && data.code === 'SESSION_EXPIRED') {
            sessionManager.clearSession();
            window.dispatchEvent(new CustomEvent('sessionExpired'));
          }
          
          // Handle banned users
          if (response.status === 403 && data.code === 'ACCOUNT_BANNED') {
            sessionManager.clearSession();
            window.dispatchEvent(new CustomEvent('accountBanned', { 
              detail: { 
                reason: data.banInfo?.reason,
                bannedAt: data.banInfo?.bannedAt 
              } 
            }));
          }
          
          // Handle inactive users
          if (response.status === 403 && data.code === 'ACCOUNT_INACTIVE') {
            sessionManager.clearSession();
            window.dispatchEvent(new CustomEvent('accountInactive'));
          }
          
          const error = new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
          error.status = response.status;
          throw error;
        }

        return data;
      } catch (error) {
        // Add specific handling for rate limit errors with exponential backoff
        if (error.isRateLimit || error.status === 429) {
          if (RATE_LIMIT_CONFIG.debugLogging) {
            console.warn('Request rate limited, backing off');
          }
          
          // Implement exponential backoff for rate limited requests
          const backoffDelay = Math.min(
            RATE_LIMIT_CONFIG.retryDelay * Math.pow(2, sessionManager.requestCount % RATE_LIMIT_CONFIG.maxRetryAttempts), 
            10000
          ); // Max 10 seconds
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          
          // Don't update activity on rate limit to avoid counting failed requests
          throw new Error('Rate limit exceeded. Please slow down your requests.');
        }
        throw error;
      }
    })();
    
    // Add to pending requests for GET requests
    if (options.method === 'GET' || !options.method) {
      return sessionManager.addPendingRequest(fullUrl, requestPromise);
    }
    
    return requestPromise;
  }

  static async get(url, options = {}) {
    return this.makeRequest(url, { method: 'GET', ...options });
  }

  static async post(url, data, options = {}) {

    
    return this.makeRequest(url, {
      method: 'POST',
      body: JSON.stringify(data),
      ...options,
    });
  }

  static async postFormData(url, formData, options = {}) {
    // Remove Content-Type header for FormData - browser will set it with boundary
    const { headers = {}, ...restOptions } = options;
    const formDataHeaders = { ...headers };
    delete formDataHeaders['Content-Type'];
    
    return this.makeRequest(url, {
      method: 'POST',
      body: formData,
      headers: formDataHeaders,
      ...restOptions,
    });
  }

  static async put(url, data, options = {}) {
    return this.makeRequest(url, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...options,
    });
  }

  static async delete(url, options = {}) {
    return this.makeRequest(url, { method: 'DELETE', ...options });
  }
}

// User Authentication API
export const userAuth = {
  signup: async (userData) => {
    try {
      const response = await ApiUtils.post('/user/signup', userData);
      // For session-based auth, no need to manage session IDs - cookies handle it
      return response;
    } catch (error) {
      throw new Error(error.message || 'Signup failed');
    }
  },

  signin: async (credentials) => {
    try {
      const response = await ApiUtils.post('/user/signin', credentials);
      // For session-based auth, no need to manage session IDs - cookies handle it
      return response;
    } catch (error) {
      throw new Error(error.message || 'Signin failed');
    }
  },

  logout: async () => {
    try {
      const response = await ApiUtils.post('/user/logout', {});
      // For session-based auth, server clears the session cookie
      sessionManager.clearSession();
      return response;
    } catch (error) {
      // Clear session even if logout fails
      sessionManager.clearSession();
      throw new Error(error.message || 'Logout failed');
    }
  },

  checkAuth: async () => {
    try {
      const response = await ApiUtils.get('/user/me');
      if (response && response.user) {
        return response;
      }
      return null;
    } catch (error) {
      // Handle rate limiting specifically
      if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
        // Don't throw for rate limit - treat as unauthenticated temporarily
        return null;
      }
      
     return null;
    }
  },
};

// OTP Authentication API
export const otpAuth = {
  signupRequest: async (signupData) => {
    return ApiUtils.post('/otp/signup-request', signupData);
  },

  verifySignup: async (verificationData) => {
    return ApiUtils.post('/otp/verify-signup', verificationData);
  },

  resendSignupOTP: async (sessionData) => {
    return ApiUtils.post('/otp/resend-signup-otp', sessionData);
  },
};

// Admin Authentication API
export const adminAuth = {
  signin: async (credentials) => {
    try {

      
      const response = await ApiUtils.post('/admin/signin', credentials);
      
      
      // For session-based auth, cookies handle everything automatically
      return response;
    } catch (error) {
      console.error('🔥 Frontend admin signin error:', {
        error: error.message,
        status: error.status,
        timestamp: new Date().toISOString()
      });
      throw new Error(error.message || 'Admin signin failed');
    }
  },

  logout: async () => {
    try {
      const response = await ApiUtils.post('/admin/logout', {});
      // For session-based auth, server clears the session cookie automatically
      return response;
    } catch (error) {
      throw new Error(error.message || 'Admin logout failed');
    }
  },

  checkAuth: async () => {
    try {
      const response = await ApiUtils.get('/admin/me');
      return response;
    } catch (error) {
      return null;
    }
  },
};

// User Profile API
export const userProfile = {
  getProfile: async () => {
    return ApiUtils.get('/user/profile');
  },

  updateSettings: async (settings) => {
    return ApiUtils.put('/user/settings', settings);
  },

  changePassword: async (passwordData) => {
    return ApiUtils.put('/user/change-password', passwordData);
  },

  changeEmail: async (emailData) => {
    return ApiUtils.put('/user/change-email', emailData);
  },

  sendPasswordReset: async () => {
    const response = await fetch(`${API_BASE_URL}/user/password-reset`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to send reset email');
    }
    return data;
  },
};

// Trading API
export const trading = {
  // Get user's orders
  getOrders: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return ApiUtils.get(`/trading/orders${queryString ? `?${queryString}` : ''}`);
  },

  // Get specific order
  getOrder: async (orderId) => {
    return ApiUtils.get(`/trading/orders/${orderId}`);
  },

  // Place new order
  placeOrder: async (orderData) => {
    return ApiUtils.post('/trading/orders', orderData);
  },

  // Cancel order
  cancelOrder: async (orderId) => {
    return ApiUtils.delete(`/trading/orders/${orderId}`);
  },

  // Get trade history
  getTrades: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return ApiUtils.get(`/trading/trades${queryString ? `?${queryString}` : ''}`);
  },

  // Get trading statistics
  getStats: async () => {
    return ApiUtils.get('/trading/stats');
  },

  // Get available trading pairs
  getPairs: async () => {
    return ApiUtils.get('/trading/pairs');
  }
};

// Market Data API
export const market = {
  // Get all market tickers with cache awareness
  getTickers: async () => {
    return ApiUtils.get('/market/tickers');
  },

  // Get ticker for specific pair
  getTicker: async (pair) => {
    return ApiUtils.get(`/market/ticker/${encodeURIComponent(pair)}`);
  },

  // Get all market coins with cache awareness
  getCoins: async () => {
    return ApiUtils.get('/market/coins');
  },

  // Get all tokens (regular + special) with cache awareness
  getAllTokens: async () => {
    return ApiUtils.get('/market/all-tokens');
  },

  // Get order book
  getOrderBook: async (pair, limit = 20) => {
    return ApiUtils.get(`/market/orderbook/${encodeURIComponent(pair)}?limit=${limit}`);
  },

  // Get recent trades
  getTrades: async (pair, limit = 50) => {
    return ApiUtils.get(`/market/trades/${encodeURIComponent(pair)}?limit=${limit}`);
  },

  // Get market statistics
  getStats: async () => {
    return ApiUtils.get('/market/stats');
  },

  // Get OHLCV data (candlestick)
  getKlines: async (pair, interval = '1h', limit = 100) => {
    return ApiUtils.get(`/candlesticks/klines/${encodeURIComponent(pair)}?interval=${interval}&limit=${limit}`);
  },

  // Get market depth
  getDepth: async (pair, limit = 20) => {
    return ApiUtils.get(`/market/depth/${encodeURIComponent(pair)}?limit=${limit}`);
  },

  // Get special tokens
  getSpecialTokens: async () => {
    return ApiUtils.get('/market/special-tokens');
  }
};



// Referral API
export const referralApi = {
  getDashboard: async () => {
    const response = await fetch(`${API_BASE_URL}/referrals/dashboard`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get referral dashboard');
    }
    return data;
  },

  getStats: async () => {
    const response = await fetch(`${API_BASE_URL}/referrals/stats`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get referral stats');
    }
    return data;
  },

  getHistory: async (page = 1, limit = 10, status = null) => {
    const params = new URLSearchParams({ page, limit });
    if (status) params.append('status', status);
    
    const response = await fetch(`${API_BASE_URL}/referrals/history?${params}`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get referral history');
    }
    return data;
  },

  getRewards: async () => {
    const response = await fetch(`${API_BASE_URL}/referrals/rewards`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get referral rewards');
    }
    return data;
  },

  getSettings: async () => {
    const response = await fetch(`${API_BASE_URL}/referrals/settings`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get referral settings');
    }
    return data;
  },

  validateCode: async (referralCode) => {
    return ApiUtils.post('/referrals/validate-code', { referralCode });
  },

  generateCode: async () => {
    const response = await fetch(`${API_BASE_URL}/referrals/generate-code`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to generate referral code');
    }
    return data;
  },

  // Admin methods
  admin: {
    getUsersWithCodes: async (page = 1, limit = 20, search = '') => {
      const params = new URLSearchParams({ page, limit, search });
      const response = await fetch(`${API_BASE_URL}/referrals/admin/users-with-codes?${params}`, {
        method: 'GET',
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to get users with referral codes');
      }
      return data;
    },

    setCustomCode: async (userId, referralCode) => {
      const response = await fetch(`${API_BASE_URL}/referrals/admin/set-custom-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ userId, referralCode }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to set custom referral code');
      }
      return data;
    },

    removeCode: async (userId) => {
      const response = await fetch(`${API_BASE_URL}/referrals/admin/remove-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ userId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to remove referral code');
      }
      return data;
    },

    getAllReferrals: async (page = 1, limit = 20, status = null) => {
      const params = new URLSearchParams({ page, limit });
      if (status) params.append('status', status);
      
      const response = await fetch(`${API_BASE_URL}/referrals/admin/all?${params}`, {
        method: 'GET',
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to get all referrals');
      }
      return data;
    },

    getStats: async () => {
      const response = await fetch(`${API_BASE_URL}/referrals/admin/stats`, {
        method: 'GET',
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to get admin referral stats');
      }
      return data;
    },

    getTransactions: async (page = 1, limit = 20, search = '') => {
      const params = new URLSearchParams({ page, limit, search });
      const response = await fetch(`${API_BASE_URL}/referrals/admin/transactions?${params}`, {
        method: 'GET',
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to get referral transactions');
      }
      return data;
    },

    getSettings: async () => {
      const response = await fetch(`${API_BASE_URL}/referrals/admin/settings`, {
        method: 'GET',
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to get referral settings');
      }
      return data;
    },

    updateSettings: async (settings) => {
      const response = await fetch(`${API_BASE_URL}/referrals/admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to update referral settings');
      }
      return data;
    },
  },
};

// VIP Rewards API
export const rewardsApi = {
  // User endpoints
  getDashboard: async () => {
    const response = await fetch(`${API_BASE_URL}/rewards/dashboard`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get VIP dashboard');
    }
    return data;
  },

  getVIPLevels: async () => {
    const response = await fetch(`${API_BASE_URL}/rewards/levels`, {
      method: 'GET',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get VIP levels');
    }
    return data;
  },

  createDailyReward: async () => {
    const response = await fetch(`${API_BASE_URL}/rewards/daily-reward`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to create daily reward');
    }
    return data;
  },

  claimReward: async (rewardId) => {
    const response = await fetch(`${API_BASE_URL}/rewards/claim/${rewardId}`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to claim reward');
    }
    return data;
  },

  getRewardHistory: async (page = 1, limit = 20) => {
    const params = new URLSearchParams({ page, limit });
    const response = await fetch(`${API_BASE_URL}/rewards/reward-history?${params}`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get reward history');
    }
    return data;
  },

  updateVIPLevel: async () => {
    const response = await fetch(`${API_BASE_URL}/rewards/update-level`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to update VIP level');
    }
    return data;
  },

  // Admin endpoints
  admin: {
    getAllVIPLevels: async () => {
      const response = await fetch(`${API_BASE_URL}/rewards/admin/levels`, {
        method: 'GET',
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to get all VIP levels');
      }
      return data;
    },

    createOrUpdateVIPLevel: async (levelData) => {
      const response = await fetch(`${API_BASE_URL}/rewards/admin/levels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(levelData),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create/update VIP level');
      }
      return data;
    },

    deleteVIPLevel: async (level) => {
      const response = await fetch(`${API_BASE_URL}/rewards/admin/levels/${level}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete VIP level');
      }
      return data;
    },

    getStatistics: async () => {
      const response = await fetch(`${API_BASE_URL}/rewards/admin/statistics`, {
        method: 'GET',
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to get VIP statistics');
      }
      return data;
    },

    getAllRewards: async (page = 1, limit = 20, status = null, rewardType = null, userId = null) => {
      const params = new URLSearchParams({ page, limit });
      if (status) params.append('status', status);
      if (rewardType) params.append('rewardType', rewardType);
      if (userId) params.append('userId', userId);

      const response = await fetch(`${API_BASE_URL}/rewards/admin/rewards?${params}`, {
        method: 'GET',
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to get all rewards');
      }
      return data;
    },

    setUserVIPLevel: async (userId, vipLevel) => {
      const response = await fetch(`${API_BASE_URL}/rewards/admin/set-user-level`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ userId, vipLevel }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to set user VIP level');
      }
      return data;
    },

    createAllDailyRewards: async () => {
      const response = await fetch(`${API_BASE_URL}/rewards/admin/create-daily-rewards`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create daily rewards');
      }
      return data;
    },

    expireOldRewards: async () => {
      const response = await fetch(`${API_BASE_URL}/rewards/admin/expire-rewards`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to expire old rewards');
      }
      return data;
    },
  },
};

// Deposit API
export const deposits = {
  generateAddress: async (coin, network) => {
    const response = await fetch(`${API_BASE_URL}/deposits/generate-addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ coin, network }),
    });
    const data = await response.json();
    
    // If addresses already exist, return them instead of throwing an error
    if (response.status === 400 && data.message === 'Deposit addresses already generated') {
      // Return the existing addresses in the expected format
      const networkKey = network === 'BSC' ? 'BEP20' : network;
      const address = data.addresses[networkKey];
      
      if (address) {
        const qrService = import.meta.env.VITE_QR_CODE_SERVICE || 'https://api.qrserver.com/v1/create-qr-code';
        return {
          address: address,
          network: network,
          qrCodeUrl: `${qrService}/?size=200x200&data=${address}`
        };
      }
    }
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to generate deposit address');
    }
    return data;
  },

  getRecent: async () => {
    const response = await fetch(`${API_BASE_URL}/deposits/history`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch recent deposits');
    }
    return data;
  },

  getHistory: async () => {
    const response = await fetch(`${API_BASE_URL}/deposits/history`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch deposit history');
    }
    return data;
  },

  getAddresses: async () => {
    const response = await fetch(`${API_BASE_URL}/deposits/addresses`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch deposit addresses');
    }
    return data;
  },

  // Get or generate address for a specific network
  getOrGenerateAddress: async (coin, network) => {
    try {
      // First try to get existing addresses
      const existingData = await deposits.getAddresses();
      
      // Check if we have an address for this network
      const networkKey = network === 'BSC' ? 'BEP20' : network;
      
      // Handle the backend response format: addresses is an object with network keys
      if (existingData.addresses && existingData.addresses[networkKey]) {
        const addressData = existingData.addresses[networkKey];
        const qrService = import.meta.env.VITE_QR_CODE_SERVICE || 'https://api.qrserver.com/v1/create-qr-code';
        return {
          address: addressData.address,
          network: network,
          qrCodeUrl: `${qrService}/?size=200x200&data=${addressData.address}`
        };
      }
      
      // If no existing address, generate new one
      return await deposits.generateAddress(coin, network);
    } catch (error) {
      // If getAddresses fails, fall back to generateAddress
      return await deposits.generateAddress(coin, network);
    }
  },

  getBalance: async (network) => {
    const response = await fetch(`${API_BASE_URL}/deposits/balance/${network}`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch balance');
    }
    return data;
  },

  submitRequest: async (depositData) => {
    const response = await fetch(`${API_BASE_URL}/deposits/submit-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(depositData),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to submit deposit request');
    }
    return data;
  },
};

// Withdrawal API
export const withdrawals = {
  getInfo: async () => {
    const response = await fetch(`${API_BASE_URL}/withdrawals/fees`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch withdrawal info');
    }
    return data;
  },

  create: async (withdrawalData) => {
    const response = await fetch(`${API_BASE_URL}/withdrawals/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(withdrawalData),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to create withdrawal');
    }
    return data;
  },

  getRecent: async () => {
    const response = await fetch(`${API_BASE_URL}/withdrawals/history`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch recent withdrawals');
    }
    return data;
  },
};

// Convenience exports for specific use cases
export const getDepositHistory = deposits.getHistory;
export const getWithdrawalHistory = withdrawals.getRecent;

// Admin Cache Management API
export const adminCache = {
  // Get cache info and statistics
  getInfo: async () => {
    return ApiUtils.get('/admin/cache/info');
  },

  // Warm up cache
  warmup: async (tasks = null) => {
    return ApiUtils.post('/admin/cache/warmup', { tasks });
  },

  // Clear cache
  clear: async (pattern = null) => {
    return ApiUtils.post('/admin/cache/clear', { pattern });
  },

  // Refresh cache (clear + warmup)
  refresh: async () => {
    return ApiUtils.post('/admin/cache/refresh', {});
  },

  // Get specific cache key
  getKey: async (key) => {
    return ApiUtils.get(`/admin/cache/key/${encodeURIComponent(key)}`);
  },

  // Set cache key
  setKey: async (key, value, ttl = 300) => {
    return ApiUtils.put(`/admin/cache/key/${encodeURIComponent(key)}`, { value, ttl });
  },

  // Delete cache key
  deleteKey: async (key) => {
    return ApiUtils.delete(`/admin/cache/key/${encodeURIComponent(key)}`);
  },

  // Cache health check
  checkHealth: async () => {
    return ApiUtils.get('/admin/cache/health');
  },
};

// Session Management API
export const session = {
  // Get session status
  getStatus: async () => {
    return ApiUtils.get('/session/status');
  },

  // Refresh session
  refresh: async () => {
    return ApiUtils.post('/session/refresh', {});
  },

  // Get session info
  getInfo: async () => {
    return ApiUtils.get('/session/info');
  },
};

// Admin Dashboard API
export const adminDashboardApi = {
  // Get dashboard statistics
  getStats: async () => {
    try {
     
      // Try the dedicated dashboard stats endpoint first
      try {
        const stats = await ApiUtils.get('/admin/dashboard/stats');
        return stats;
      } catch (error) {
        console.warn('⚠️ Dedicated endpoint failed, trying fallback methods:', error.message);
      }
      
      // If dedicated endpoint fails, try the original method
      let monitoringStats, depositStats, withdrawalStats, kycSubmissions;
      
      try {
        monitoringStats = await ApiUtils.get('/monitoring/metrics');
      } catch (error) {
        console.warn('⚠️ Failed to fetch monitoring stats:', error.message);
        monitoringStats = { users: {}, trades: {} };
      }

      try {
        depositStats = await ApiUtils.get('/admin/deposits/stats');
      } catch (error) {
        console.warn('⚠️ Failed to fetch deposit stats:', error.message);
        depositStats = { byStatus: [] };
      }

      try {
        withdrawalStats = await ApiUtils.get('/admin/withdrawals/stats');
      } catch (error) {
        console.warn('⚠️ Failed to fetch withdrawal stats:', error.message);
        withdrawalStats = { byStatus: [] };
      }

      try {
        kycSubmissions = await ApiUtils.get('/kyc/admin/submissions?status=pending_review&limit=1');
      } catch (error) {
        console.warn('⚠️ Failed to fetch KYC submissions:', error.message);
        kycSubmissions = [];
      }

      // Calculate totals from the stats
      const totalUsers = monitoringStats.users?.totalRegistered || 0;
      const activeUsers = monitoringStats.users?.active || 0;
      
      // Calculate deposit totals - handle different response formats
      let totalDeposits = 0;
      let depositVolume = 0;
      
      if (depositStats.byStatus && Array.isArray(depositStats.byStatus)) {
        totalDeposits = depositStats.byStatus.reduce((sum, status) => {
          return sum + (status._id === 'completed' ? status.count : 0);
        }, 0);
        
        depositVolume = depositStats.byStatus.reduce((sum, status) => {
          return sum + (status._id === 'completed' ? status.totalAmount : 0);
        }, 0);
      }

      // Calculate withdrawal totals - handle different response formats
      let totalWithdrawals = 0;
      let withdrawalVolume = 0;
      
      if (withdrawalStats.byStatus && Array.isArray(withdrawalStats.byStatus)) {
        totalWithdrawals = withdrawalStats.byStatus.reduce((sum, status) => {
          return sum + (status._id === 'completed' ? status.count : 0);
        }, 0);

        withdrawalVolume = withdrawalStats.byStatus.reduce((sum, status) => {
          return sum + (status._id === 'completed' ? status.totalAmount : 0);
        }, 0);
      }

      // Get pending KYC count - handle different response formats
      let pendingKycCount = 0;
      if (Array.isArray(kycSubmissions)) {
        pendingKycCount = kycSubmissions.length;
      } else if (kycSubmissions.data && Array.isArray(kycSubmissions.data)) {
        pendingKycCount = kycSubmissions.data.length;
      } else if (kycSubmissions.submissions && Array.isArray(kycSubmissions.submissions)) {
        pendingKycCount = kycSubmissions.submissions.length;
      }

      // Get trading data from monitoring stats (today's trades)
      const todayTrades = monitoringStats.trades?.total || 0;
      const successfulTrades = monitoringStats.trades?.success || 0;
      
      // Estimate trading volume based on successful trades (rough estimate)
      const estimatedTradeVolume = successfulTrades * 500; // Assuming avg $500 per trade

      return {
        totalUsers,
        activeUsers,
        totalDeposits,
        depositVolume,
        totalWithdrawals,
        withdrawalVolume,
        pendingKyc: pendingKycCount,
        tradingVolume: estimatedTradeVolume,
        todayTrades,
        successfulTrades,
        rawStats: {
          monitoring: monitoringStats,
          deposits: depositStats,
          withdrawals: withdrawalStats
        }
      };
    } catch (error) {
      console.error('Error fetching admin dashboard stats:', error);
      throw error;
    }
  },

  // Alternative method to get simple counts directly
  getSimpleCounts: async () => {
    try {
    
      // Try to get all deposits and withdrawals to count them manually
      let allDeposits, allWithdrawals;
      
      try {
        allDeposits = await ApiUtils.get('/admin/deposits/all');
      } catch (error) {
        console.warn('Failed to fetch all deposits:', error.message);
        allDeposits = { deposits: [] };
      }
      
      try {
        allWithdrawals = await ApiUtils.get('/admin/withdrawals/all');
      } catch (error) {
        console.warn('Failed to fetch all withdrawals:', error.message);
        allWithdrawals = { withdrawals: [] };
      }
      
      let totalDeposits = 0;
      let totalWithdrawals = 0;
      let depositVolume = 0;
      let withdrawalVolume = 0;
      
      // Count deposits - handle multiple response formats
      if (Array.isArray(allDeposits)) {
        totalDeposits = allDeposits.filter(d => d.status === 'completed').length;
        depositVolume = allDeposits
          .filter(d => d.status === 'completed')
          .reduce((sum, d) => sum + (d.amount || 0), 0);
      } else if (allDeposits.deposits && Array.isArray(allDeposits.deposits)) {
        totalDeposits = allDeposits.deposits.filter(d => d.status === 'completed').length;
        depositVolume = allDeposits.deposits
          .filter(d => d.status === 'completed')
          .reduce((sum, d) => sum + (d.amount || 0), 0);
      } else if (allDeposits.data && Array.isArray(allDeposits.data)) {
        totalDeposits = allDeposits.data.filter(d => d.status === 'completed').length;
        depositVolume = allDeposits.data
          .filter(d => d.status === 'completed')
          .reduce((sum, d) => sum + (d.amount || 0), 0);
      }
      
      // Count withdrawals - handle multiple response formats
      if (Array.isArray(allWithdrawals)) {
        totalWithdrawals = allWithdrawals.filter(w => w.status === 'completed').length;
        withdrawalVolume = allWithdrawals
          .filter(w => w.status === 'completed')
          .reduce((sum, w) => sum + (w.amount || 0), 0);
      } else if (allWithdrawals.withdrawals && Array.isArray(allWithdrawals.withdrawals)) {
        totalWithdrawals = allWithdrawals.withdrawals.filter(w => w.status === 'completed').length;
        withdrawalVolume = allWithdrawals.withdrawals
          .filter(w => w.status === 'completed')
          .reduce((sum, w) => sum + (w.amount || 0), 0);
      } else if (allWithdrawals.data && Array.isArray(allWithdrawals.data)) {
        totalWithdrawals = allWithdrawals.data.filter(w => w.status === 'completed').length;
        withdrawalVolume = allWithdrawals.data
          .filter(w => w.status === 'completed')
          .reduce((sum, w) => sum + (w.amount || 0), 0);
      }
      
      return {
        totalDeposits,
        totalWithdrawals,
        depositVolume,
        withdrawalVolume
      };
    } catch (error) {
      console.error('Error fetching simple counts:', error);
      return {
        totalDeposits: 0,
        totalWithdrawals: 0,
        depositVolume: 0,
        withdrawalVolume: 0
      };
    }
  },

  // Get recent activity (can be enhanced later)
  getRecentActivity: async () => {
    try {
      // For now, return mock data. This can be enhanced with real activity logs
      return [
        { type: 'user', message: 'New user registration', time: '2 minutes ago', status: 'success' },
        { type: 'trade', message: 'Large trade executed', time: '5 minutes ago', status: 'info' },
        { type: 'deposit', message: 'Deposit approved', time: '10 minutes ago', status: 'success' },
        { type: 'system', message: 'System backup completed', time: '15 minutes ago', status: 'success' },
      ];
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      return [];
    }
  }
};

// Staking API
export const stakingApi = {
  // User staking endpoints
  user: {
    getPools: async () => {
      return ApiUtils.get('/staking/pools');
    },
    
    getPositions: async () => {
      return ApiUtils.get('/staking/positions');
    },
    
    getStats: async () => {
      return ApiUtils.get('/staking/stats');
    },
    
    stake: async (stakeData) => {
      return ApiUtils.post('/staking/stake', stakeData);
    },
    
    unstake: async (data) => {
      // Handle both old format (positionId string) and new format (object with positionId and forceUnstake)
      if (typeof data === 'string') {
        // Old format: just positionId
        return ApiUtils.post(`/staking/unstake/${data}`, {});
      } else {
        // New format: object with positionId and optional forceUnstake
        const { positionId, ...requestBody } = data;
        return ApiUtils.post(`/staking/unstake/${positionId}`, requestBody);
      }
    },
    
    claimRewards: async (positionId) => {
      return ApiUtils.post(`/staking/claim/${positionId}`, {});
    }
  },
  
  // Admin staking endpoints
  admin: {
    getPools: async () => {
      return ApiUtils.get('/admin/staking/pools');
    },
    
    createPool: async (poolData) => {
      return ApiUtils.post('/admin/staking/pools', poolData);
    },
    
    updatePool: async (poolId, poolData) => {
      return ApiUtils.put(`/admin/staking/pools/${poolId}`, poolData);
    },
    
    deletePool: async (poolId) => {
      return ApiUtils.delete(`/admin/staking/pools/${poolId}`);
    },
    
    getPositions: async () => {
      return ApiUtils.get('/admin/staking/positions');
    },
    
    forceUnstake: async (positionId) => {
      return ApiUtils.post(`/admin/staking/positions/${positionId}/force-unstake`, {});
    },
    
    getAnalytics: async () => {
      return ApiUtils.get('/admin/staking/analytics');
    },
    
    processRewards: async (poolId = null) => {
      const url = poolId ? `/admin/staking/rewards/process?poolId=${poolId}` : '/admin/staking/rewards/process';
      return ApiUtils.post(url, {});
    },
    
    getRewardHistory: async () => {
      return ApiUtils.get('/admin/staking/rewards/history');
    }
  }
};

// Demo Trading API
export const demoTrading = {
  // Get or create demo account
  getAccount: async () => {
    return ApiUtils.get('/demo-trading/account');
  },

  // Get demo balances
  getBalances: async () => {
    return ApiUtils.get('/demo-trading/balances');
  },

  // Place demo order (buy/sell)
  placeOrder: async (orderData) => {
    return ApiUtils.post('/demo-trading/orders', orderData);
  },

  // Get demo orders
  getOrders: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return ApiUtils.get(`/demo-trading/orders${queryString ? `?${queryString}` : ''}`);
  },

  // Get demo trade history
  getTrades: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return ApiUtils.get(`/demo-trading/trades${queryString ? `?${queryString}` : ''}`);
  },

  // Get demo stats
  getStats: async () => {
    return ApiUtils.get('/demo-trading/stats');
  },

  // Reset demo account to $100k
  resetAccount: async () => {
    return ApiUtils.post('/demo-trading/reset', {});
  }
};

// Export session manager and ApiUtils for use in components
export { sessionManager, ApiUtils, API_BASE_URL };