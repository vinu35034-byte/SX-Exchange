/**
 * Frontend Configuration Utility
 * Centralized configuration management for the trading platform
 */

export const CONFIG = {
  // API Configuration
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001',
    timeout: parseInt(import.meta.env.VITE_API_REQUEST_TIMEOUT || '10000'),
    retryAttempts: parseInt(import.meta.env.VITE_MAX_RETRY_ATTEMPTS || '3'),
    retryDelay: parseInt(import.meta.env.VITE_RETRY_DELAY || '1000'),
  },

  // Rate Limiting Configuration
  rateLimit: {
    enabled: import.meta.env.VITE_RATE_LIMIT_ENABLED === 'true',
    maxRequests: parseInt(import.meta.env.VITE_CLIENT_THROTTLE_REQUESTS || '20'),
    windowMs: parseInt(import.meta.env.VITE_CLIENT_THROTTLE_WINDOW || '15000'),
    requestSpacing: parseInt(import.meta.env.VITE_REQUEST_SPACING || '200'),
    warningsEnabled: import.meta.env.VITE_ENABLE_RATE_LIMIT_WARNINGS === 'true',
  },

  // Cache Configuration
  cache: {
    shortTtl: parseInt(import.meta.env.VITE_CACHE_TTL_SHORT || '5000'),
    mediumTtl: parseInt(import.meta.env.VITE_CACHE_TTL_MEDIUM || '30000'),
    longTtl: parseInt(import.meta.env.VITE_CACHE_TTL_LONG || '60000'),
  },

  // WebSocket Configuration
  websocket: {
    url: import.meta.env.VITE_WS_URL || 'http://localhost:5001',
    reconnectInterval: parseInt(import.meta.env.VITE_WS_RECONNECT_INTERVAL || '5000'),
    maxReconnectAttempts: parseInt(import.meta.env.VITE_WS_MAX_RECONNECT_ATTEMPTS || '10'),
    heartbeatInterval: parseInt(import.meta.env.VITE_WS_HEARTBEAT_INTERVAL || '30000'),
  },

  // Performance Configuration
  performance: {
    debounceDelay: parseInt(import.meta.env.VITE_DEBOUNCE_DELAY || '300'),
    monitoringEnabled: import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING === 'true',
    debugLogging: import.meta.env.VITE_ENABLE_DEBUG_LOGGING === 'true',
  },

  // Trading Configuration
  trading: {
    orderBookUpdateInterval: 1000, // 1 second
    priceUpdateInterval: 30000, // 30 seconds
    maxRecentTrades: 100,
    maxOrderBookEntries: 20,
  },

  // Environment Information
  environment: {
    isDevelopment: import.meta.env.VITE_ENVIRONMENT === 'development',
    isProduction: import.meta.env.VITE_ENVIRONMENT === 'production',
    appName: import.meta.env.VITE_APP_NAME || 'Crypto Trading Platform',
  },

  // External Services
  external: {
    qrCodeService: import.meta.env.VITE_QR_CODE_SERVICE || 'https://api.qrserver.com/v1/create-qr-code',
    bscExplorer: import.meta.env.VITE_BSC_EXPLORER || 'https://bscscan.com',
  }
};

/**
 * Get configuration for a specific feature
 * @param {string} feature - Feature name (api, rateLimit, cache, etc.)
 * @returns {Object} Feature configuration
 */
export const getConfig = (feature) => {
  return CONFIG[feature] || {};
};

/**
 * Check if a feature is enabled
 * @param {string} feature - Feature name
 * @returns {boolean} Whether the feature is enabled
 */
export const isFeatureEnabled = (feature) => {
  switch (feature) {
    case 'rateLimit':
      return CONFIG.rateLimit.enabled;
    case 'performanceMonitoring':
      return CONFIG.performance.monitoringEnabled;
    case 'debugLogging':
      return CONFIG.performance.debugLogging;
    case 'rateLimitWarnings':
      return CONFIG.rateLimit.warningsEnabled;
    default:
      return false;
  }
};

/**
 * Log debug information if debug logging is enabled
 * @param {string} message - Debug message
 * @param {any} data - Additional data to log
 */
export const debugLog = (message, data = null) => {
  if (CONFIG.performance.debugLogging) {
    if (data) {
      console.log(`[DEBUG] ${message}`, data);
    } else {
      console.log(`[DEBUG] ${message}`);
    }
  }
};

/**
 * Log performance information if performance monitoring is enabled
 * @param {string} operation - Operation name
 * @param {number} duration - Duration in milliseconds
 * @param {any} metadata - Additional metadata
 */
export const logPerformance = (operation, duration, metadata = null) => {
  if (CONFIG.performance.monitoringEnabled) {
    console.log(`[PERF] ${operation}: ${duration}ms`, metadata || '');
  }
};

/**
 * Get cache timeout for different data types
 * @param {string} dataType - Data type (market, user, static)
 * @returns {number} Cache timeout in milliseconds
 */
export const getCacheTimeout = (dataType) => {
  switch (dataType) {
    case 'market':
    case 'prices':
    case 'orderbook':
      return CONFIG.cache.shortTtl;
    case 'user':
    case 'orders':
    case 'balances':
      return CONFIG.cache.mediumTtl;
    case 'static':
    case 'pairs':
    case 'coins':
      return CONFIG.cache.longTtl;
    default:
      return CONFIG.cache.mediumTtl;
  }
};

export default CONFIG;
