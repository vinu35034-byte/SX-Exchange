import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from '../contexts/SessionContext';
import { ApiUtils } from '../services/api'; // Import enhanced API utility

// Get cache configuration from environment variables
const CACHE_CONFIG = {
  debugLogging: true, // Enable for debugging
  rateLimitWarnings: true,
  maxRetries: 3,
  retryDelay: 1000,
  defaultCacheTimeout: 60000 // 1 minute default cache
};

/**
 * Cache-aware data fetching hook with session support and rate limiting
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Hook options
 * @returns {Object} - { data, loading, error, refetch, lastFetch }
 */
export function useCacheAwareData(endpoint, options = {}) {
  const {
    cacheTimeout = CACHE_CONFIG.longTtl, // Use environment variable for default timeout
    transform = null,
    onError = null,
    enabled = true
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(0);
  
  const { isAuthenticated } = useSession();
  const abortControllerRef = useRef(null);
  const transformRef = useRef(transform);
  const requestInProgress = useRef(false);

  // Update transform ref when transform changes
  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!enabled || (!isAuthenticated && endpoint.includes('auth'))) {
      return;
    }

    // Prevent multiple simultaneous requests to the same endpoint
    if (requestInProgress.current) {
      return data;
    }

    // Check cache freshness
    const now = Date.now();
    const cacheValid = !forceRefresh && data && (now - lastFetch < cacheTimeout);
    
    if (cacheValid) {
      if (CACHE_CONFIG.debugLogging) {
        console.log(`Using cached data for ${endpoint}, age: ${now - lastFetch}ms`);
      }
      return data;
    }

    requestInProgress.current = true;

    try {
      setLoading(true);
      setError(null);

      // Use our enhanced API service with rate limiting and error handling
      const response = await ApiUtils.get(endpoint);
      
      if (CACHE_CONFIG.debugLogging) {
        console.log(`API Response for ${endpoint}:`, {
          status: response.status,
          dataKeys: response.data ? Object.keys(response.data) : 'no data',
          responseType: typeof response.data
        });
      }
      
      const transformedData = transformRef.current ? transformRef.current(response.data) : response.data;
      
      if (CACHE_CONFIG.debugLogging) {
        console.log(`Transformed data for ${endpoint}:`, {
          originalLength: response.data?.data?.length,
          transformedLength: Array.isArray(transformedData) ? transformedData.length : 'not array',
          transformedType: typeof transformedData
        });
      }
      
      setData(transformedData);
      setLastFetch(now);
      
      return transformedData;
    } catch (error) {
      // Handle rate limiting gracefully
      if (error.message?.includes('429') || error.message?.includes('rate limit') || error.message?.includes('slow down')) {
        // For rate limiting, don't update error state, just use cached data if available
        if (data) {
          if (CACHE_CONFIG.rateLimitWarnings) {
            console.warn(`Rate limited for ${endpoint}, using cached data`);
          }
          return data;
        }
        if (CACHE_CONFIG.rateLimitWarnings) {
          console.warn(`Rate limited for ${endpoint}, no cached data available`);
        }
        return;
      }
      
      setError(error.message);
      if (onError) {
        onError(error);
      }
      if (CACHE_CONFIG.debugLogging) {
        console.error(`Error fetching ${endpoint}:`, error);
      }
      throw error;
    } finally {
      setLoading(false);
      requestInProgress.current = false;
    }
  }, [endpoint, isAuthenticated, lastFetch, cacheTimeout, data, onError, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      requestInProgress.current = false;
    };
  }, []);

  // Auto-fetch with debouncing to prevent rapid successive calls
  useEffect(() => {
    if (!enabled) return;
    
    const timeoutId = setTimeout(() => {
      fetchData();
    }, 100); // Small delay to debounce rapid calls

    return () => clearTimeout(timeoutId);
  }, [fetchData, enabled]);

  // Manual refetch function
  const refetch = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
    lastFetch
  };
}

export const useMarketData = (symbol = null) => {
  return useCacheAwareData(
    symbol ? `/market/ticker/${symbol}` : '/market/tickers',
    {
      cacheTimeout: 30000, // 30 second cache (increased from 12 seconds)
      transform: (data) => {
        // Ensure consistent data structure
        if (symbol && data.ticker) {
          return data.ticker;
        }
        return data;
      }
    }
  );
};

export const useCandlestickData = (pair, interval = '1h', limit = 100, specialTokens = []) => {
  // Check if this is a special token
  const isSpecialToken = specialTokens.some(token => `${token.symbol}/USDT` === pair);
  
  // For now, use the standard cache-aware approach for all tokens
  // We'll handle special token caching optimization in the future
  const encodedPair = encodeURIComponent(pair);
  
  // Adjust cache timeout based on token type
  const cacheTimeout = isSpecialToken 
    ? (interval === '1m' ? 15000 : 60000)  // Shorter cache for special tokens (15s-1m)
    : (interval === '1m' ? 60000 : 300000); // Longer cache for real tokens (1-5 minutes)
  
  return useCacheAwareData(
    `/candlesticks/klines/${encodedPair}?interval=${interval}&limit=${limit}`,
    {
      deps: [pair, interval, limit],
      cacheTimeout,
      transform: (apiResponse) => {
        // Debug logging for candlestick data transform
        console.log(`🔍 ${isSpecialToken ? 'SPECIAL' : 'REGULAR'} TOKEN CANDLESTICK TRANSFORM:`, {
          pair,
          interval,
          isSpecialToken,
          apiResponseType: typeof apiResponse,
          success: apiResponse?.success,
          dataLength: apiResponse?.data?.length,
          cached: apiResponse?.cached,
          isArray: Array.isArray(apiResponse)
        });
        
        // Handle both fresh API response format and cached array format
        let result;
        if (Array.isArray(apiResponse)) {
          // If apiResponse is already an array, it's probably cached transformed data
          result = apiResponse;
        } else if (apiResponse?.data) {
          // Fresh API response: { success: true, data: [...], count: X }
          result = apiResponse.data;
        } else {
          // Fallback
          result = [];
        }

        // CRITICAL: Validate and sanitize candlestick data to prevent chart errors
        if (Array.isArray(result)) {
          result = result.filter(candle => {
            // Check if candle has all required properties and no null values
            if (!candle || typeof candle !== 'object') {
              console.warn('🚨 Invalid candle data (not object):', candle);
              return false;
            }

            const requiredFields = ['time', 'open', 'high', 'low', 'close'];
            const hasAllFields = requiredFields.every(field => {
              const value = candle[field];
              const isValid = value !== null && value !== undefined && !isNaN(value) && isFinite(value);
              if (!isValid) {
                console.warn(`🚨 Invalid ${field} in candle:`, { [field]: value, candle });
              }
              return isValid;
            });

            if (!hasAllFields) {
              console.warn('� Candle missing required fields:', candle);
              return false;
            }

            // Additional safety checks
            if (candle.high < candle.low) {
              console.warn('🚨 Invalid candle: high < low:', candle);
              return false;
            }

            if (candle.open < 0 || candle.close < 0 || candle.high < 0 || candle.low < 0) {
              console.warn('🚨 Invalid candle: negative prices:', candle);
              return false;
            }

            return true;
          }).map(candle => ({
            // Ensure all numeric values are properly converted
            time: Number(candle.time),
            open: Number(candle.open),
            high: Number(candle.high),
            low: Number(candle.low),
            close: Number(candle.close),
            volume: Number(candle.volume || 0) // Volume can be 0
          }));
        }
        
        console.log(`�🔍 ${isSpecialToken ? 'SPECIAL' : 'REGULAR'} TOKEN RESULT:`, { 
          resultLength: result.length, 
          fromCache: apiResponse?.cached,
          cacheTimeout: cacheTimeout,
          firstCandle: result[0],
          lastCandle: result[result.length - 1]
        });
        return result;
      }
    }
  );
};

export const useUserProfile = () => {
  return useCacheAwareData('/user/profile', {
    cacheTimeout: 60000, // 1 minute cache for profile data
    enabled: true
  });
};

export const useUserBalance = () => {
  return useCacheAwareData('/trading/balances', {
    cacheTimeout: 30000, // 30 second cache for balance (increased from 10)
  });
};

export const useOrderBook = (pair, options = {}) => {
  const encodedPair = encodeURIComponent(pair);
  const { enabled = true, ...otherOptions } = options;
  
  return useCacheAwareData(
    `/market/orderbook/${encodedPair}`,
    {
      deps: [pair],
      cacheTimeout: 10000, // 10 second cache (increased from 1 second)
      transform: (data) => data.orderbook || { bids: [], asks: [] },
      enabled,
      ...otherOptions
    }
  );
};

export const useTradeHistory = (pair, limit = 50) => {
  const encodedPair = encodeURIComponent(pair);
  return useCacheAwareData(
    `/market/trades/${encodedPair}?limit=${limit}`,
    {
      deps: [pair, limit],
      cacheTimeout: 15000 // 15 second cache (increased from 5)
    }
  );
};

export const useNotifications = () => {
  return useCacheAwareData('/notifications', {
    cacheTimeout: 120000, // 2 minute cache (increased from 30 seconds)
  });
};

export const useVIPStatus = () => {
  return useCacheAwareData('/rewards/dashboard', {
    cacheTimeout: 300000, // 5 minute cache - VIP status doesn't change often
  });
};

export const useDepositAddresses = () => {
  return useCacheAwareData('/deposits/addresses', {
    cacheTimeout: 3600000, // 1 hour cache - addresses rarely change
  });
};

export const useWithdrawalHistory = (page = 1, limit = 20) => {
  return useCacheAwareData(
    `/withdrawals/history?page=${page}&limit=${limit}`,
    {
      deps: [page, limit],
      cacheTimeout: 60000 // 1 minute cache
    }
  );
};

export const useKYCStatus = () => {
  return useCacheAwareData('/kyc/status', {
    cacheTimeout: 300000, // 5 minute cache
  });
};

export const useReferralStats = () => {
  return useCacheAwareData('/referrals/stats', {
    cacheTimeout: 300000, // 5 minute cache
  });
};

// Admin-specific hooks
export const useAdminStats = () => {
  return useCacheAwareData('/admin/stats', {
    cacheTimeout: 300000, // 5 minute cache (increased from 1 minute)
  });
};

export const useAdminUsers = (page = 1, limit = 50, search = '') => {
  return useCacheAwareData(
    `/admin/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`,
    {
      deps: [page, limit, search],
      cacheTimeout: 120000 // 2 minute cache (increased from 30 seconds)
    }
  );
};

export const useCacheHealth = () => {
  return useCacheAwareData('/cache/status', {
    cacheTimeout: 60000 // 1 minute cache (increased from 10 seconds)
  });
};
