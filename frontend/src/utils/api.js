
// API configuration using environment variables
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1';

/**
 * @deprecated Use ApiUtils from /src/services/api.js instead
 * Makes an API request with proper error handling
 * @param {string} endpoint - The API endpoint (without base URL)
 * @param {Object} options - Fetch options
 * @returns {Promise} - The response data
 */
export const apiRequest = async (endpoint, options = {}) => {
  console.warn('⚠️ apiRequest is deprecated. Use ApiUtils from /src/services/api.js instead');
  
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      // NOTE: This deprecated utility no longer handles authentication
      // Use SessionContext and ApiUtils for proper session management
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, defaultOptions);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API request failed for ${endpoint}:`, error);
    throw error;
  }
};

/**
 * @deprecated Use cache-aware hooks from /src/hooks/useCacheAwareData.js instead
 * API endpoints - These have been replaced by cache-aware data fetching hooks
 * 
 * Migration examples:
 * - API_ENDPOINTS.USER_PROFILE -> useUserProfile() hook
 * - API_ENDPOINTS.USER_BALANCES -> useUserBalance() hook
 * - API_ENDPOINTS.MARKET_DATA -> useMarketData() hook
 * - API_ENDPOINTS.DEPOSIT_HISTORY -> useCacheAwareData('/api/deposits/history')
 * - API_ENDPOINTS.WITHDRAWAL_HISTORY -> useWithdrawalHistory() hook
 */
export const API_ENDPOINTS = {
  // Auth endpoints - Now handled by SessionContext
  LOGIN: '/user/signin',
  REGISTER: '/user/signup', 
  LOGOUT: '/user/logout',
  USER_ME: '/user/me',
  
  // Deposit endpoints - Use useDepositAddresses() and useCacheAwareData() hooks
  DEPOSIT_ADDRESS: '/deposits/generate-addresses',
  DEPOSIT_ADDRESSES: '/deposits/addresses',
  DEPOSIT_HISTORY: '/deposits/history',
  DEPOSIT_BALANCE: (network) => `/deposits/balance/${network}`,
  
  // Withdrawal endpoints - Use useWithdrawalHistory() hook
  WITHDRAWAL_INFO: '/withdrawals/fees',
  WITHDRAWAL_REQUEST: '/withdrawals/create',
  WITHDRAWAL_HISTORY: '/withdrawals/history',
  
  // User endpoints - Use useUserProfile() and useUserBalance() hooks
  USER_PROFILE: '/user/profile',
  USER_BALANCES: '/user/balances',
  
  // Trading endpoints - Use useMarketData() and related hooks
  MARKET_DATA: '/market/data',
  TRADING_PAIRS: '/trading/pairs',
};

export default API_BASE_URL;
