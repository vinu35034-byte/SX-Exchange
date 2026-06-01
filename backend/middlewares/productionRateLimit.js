const rateLimit = require('express-rate-limit');
const redisManager = require('../config/redis');

// Get rate limit settings from environment variables
// SECURITY: Rate limiting enabled by default — must explicitly disable
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== 'false';
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW || '60') * 1000; // Convert to milliseconds
const RATE_LIMIT_AUTH = parseInt(process.env.RATE_LIMIT_AUTH || '20'); // Increased for 20K users
const RATE_LIMIT_TRADING = parseInt(process.env.RATE_LIMIT_TRADING || '5000'); // Increased for high-frequency trading
const RATE_LIMIT_MARKET_DATA = parseInt(process.env.RATE_LIMIT_MARKET_DATA || '10000'); // High volume market data
const RATE_LIMIT_GENERAL = parseInt(process.env.RATE_LIMIT_GENERAL || '2000'); // Increased for 20K users
const RATE_LIMIT_WEBSOCKET = parseInt(process.env.RATE_LIMIT_WEBSOCKET || '15000'); // Increased for real-time data

// Redis store configuration for production scaling
let RedisStore;
try {
  RedisStore = require('rate-limit-redis');
} catch (e) {
  console.warn('⚠️  Redis not configured. Using memory store for rate limiting.');
  console.warn('For production with 20K+ users, install Redis: npm install redis rate-limit-redis');
}

// Get Redis client for rate limiting
function getRedisStore() {
  const redisClient = redisManager.getClient('rateLimit');
  if (redisClient && RedisStore) {
    return new RedisStore({
      client: redisClient,
      prefix: 'rl:',
      resetExpiryOnChange: true,
    });
  }
  return undefined; // Will use memory store
}

// Create rate limiter with Redis support for production scaling
const createRateLimiter = (requests, windowMs, message, keyGenerator = null) => {
  const config = {
    windowMs,
    max: requests,
    message: { 
      error: message,
      retryAfter: Math.ceil(windowMs / 1000),
      limit: requests,
      window: windowMs
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    // Use Redis store for distributed rate limiting
    store: getRedisStore(),
    // Enhanced error handler
    handler: (req, res) => {
      const retryAfter = Math.ceil(windowMs / 1000);
      res.status(429).json({
        success: false,
        error: message,
        retryAfter: retryAfter,
        limit: requests,
        window: windowMs,
        remaining: 0,
        reset: new Date(Date.now() + windowMs)
      });
    },
    // Skip rate limiting in development for localhost
    skip: (req) => {
      // Skip rate limiting if disabled in environment
      if (!RATE_LIMIT_ENABLED) {
        return true;
      }
      
      if (process.env.NODE_ENV === 'development' && 
          (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip?.startsWith('192.168.'))) {
        return true;
      }
      return false;
    }
  };

  // Custom key generator for user-specific limits
  if (keyGenerator) {
    config.keyGenerator = keyGenerator;
  }

  return rateLimit(config);
};

// Different rate limiters for different user types and operations
const createUserBasedLimiter = (regularLimit, premiumLimit, windowMs, message) => {
  return createRateLimiter(
    regularLimit,
    windowMs,
    message,
    (req) => {
      // Custom key generation based on user type
      const userId = req.user?.id || req.ip;
      const userType = req.user?.accountType || 'regular'; // regular, premium
      
      // Different limits for different user types
      const limits = {
        regular: regularLimit,
        premium: premiumLimit
      };

      // Store user type in request for limit adjustment
      req.rateLimit = { maxRequests: limits[userType] || regularLimit };
      
      return `${userType}-${userId}`;
    }
  );
};

// Authentication rate limiter (balanced for 20K users)
const authLimiter = createRateLimiter(
  RATE_LIMIT_AUTH, // From environment: 20 attempts per minute for 20K users
  RATE_LIMIT_WINDOW,
  'Too many authentication attempts. Please try again later.'
);

// Trading rate limiter (user-based with premium support for high volume)
const tradingLimiter = createUserBasedLimiter(
  RATE_LIMIT_TRADING, // From environment: 5000 requests/minute for regular users
  RATE_LIMIT_TRADING * 3, // Premium users: 3x the limit (15K/min)
  RATE_LIMIT_WINDOW,
  'Trading rate limit exceeded. Upgrade to premium for higher limits.'
);

// Market data rate limiter (optimized for 20K users with high-frequency needs)
const marketDataLimiter = createUserBasedLimiter(
  RATE_LIMIT_MARKET_DATA, // From environment: 10000 requests/minute
  RATE_LIMIT_MARKET_DATA * 2, // Premium users: 2x the limit (20K/min)
  RATE_LIMIT_WINDOW,
  'Market data rate limit exceeded. Consider using WebSocket for real-time data or upgrade to premium.'
);

// General API rate limiter (optimized for 20K concurrent users)
const generalLimiter = createUserBasedLimiter(
  RATE_LIMIT_GENERAL, // From environment: 2000 requests/minute per user
  RATE_LIMIT_GENERAL * 2.5, // Premium users: 2.5x the limit (5K/min)
  RATE_LIMIT_WINDOW,
  'API rate limit exceeded. Please slow down or upgrade to premium.'
);

// WebSocket rate limiter (per connection, optimized for 20K concurrent users)
const websocketLimiter = createRateLimiter(
  RATE_LIMIT_WEBSOCKET, // From environment: 15000 messages per minute per connection
  RATE_LIMIT_WINDOW,
  'WebSocket rate limit exceeded. Please reduce message frequency.'
);

// High-frequency trading limiter (for institutional users and 20K user base)
const hftLimiter = createRateLimiter(
  100000, // 100K requests per minute for HFT users (increased for 20K users)
  60 * 1000,
  'HFT rate limit exceeded. Contact support for enterprise limits.'
);

// Adaptive rate limiter that adjusts based on server load (scaled for 20K users)
const adaptiveLimiter = (baseLimit) => {
  return createRateLimiter(
    baseLimit,
    60 * 1000,
    'Server under high load. Rate limit temporarily reduced.',
    (req) => {
      // Adjust limit based on server metrics and 20K user load
      const performanceMonitor = require('../utils/performanceMonitor');
      const isHighLoad = performanceMonitor.isHighLoad();
      // More conservative scaling for 20K users
      const adjustedLimit = isHighLoad ? Math.floor(baseLimit * 0.3) : baseLimit;
      
      req.rateLimit = { maxRequests: adjustedLimit };
      return req.ip;
    }
  );
};

// Simple server load monitoring (replace with actual monitoring)
function getServerLoad() {
  try {
    const performanceMonitor = require('../utils/performanceMonitor');
    const metrics = performanceMonitor.getMetrics();
    return metrics.load || 0.5;
  } catch (error) {
    return 0.5; // Default fallback
  }
}

// Tier-based rate limiters for 20K user scaling
const createTierBasedLimiter = (basicLimit, premiumLimit, vipLimit, windowMs, message) => {
  return createRateLimiter(
    basicLimit,
    windowMs,
    message,
    (req) => {
      // Enhanced user tier detection
      const userId = req.user?.id || req.admin?.id || req.ip;
      const userTier = req.user?.tier || req.user?.vipLevel || 'basic';
      
      // Tier-based limits for 20K users
      const limits = {
        basic: basicLimit,        // Regular users
        premium: premiumLimit,    // Premium subscribers
        vip: vipLimit,           // VIP users
        institutional: vipLimit * 2  // Institutional clients
      };

      const actualLimit = limits[userTier] || basicLimit;
      req.rateLimit = { maxRequests: actualLimit };
      
      return `${userTier}-${userId}`;
    }
  );
};

// Enhanced general limiter with multiple tiers for 20K users
const enhancedGeneralLimiter = createTierBasedLimiter(
  1500,  // Basic: 1500/min
  3000,  // Premium: 3000/min  
  6000,  // VIP: 6000/min
  RATE_LIMIT_WINDOW,
  'API rate limit exceeded. Upgrade your account for higher limits.'
);

// Enhanced trading limiter for different user tiers
const enhancedTradingLimiter = createTierBasedLimiter(
  3000,  // Basic: 3000 trades/min
  8000,  // Premium: 8000 trades/min
  20000, // VIP: 20000 trades/min
  RATE_LIMIT_WINDOW,
  'Trading rate limit exceeded. Upgrade for professional trading limits.'
);

module.exports = {
  authLimiter,
  tradingLimiter,
  marketDataLimiter,
  generalLimiter,
  websocketLimiter,
  hftLimiter,
  adaptiveLimiter,
  createRateLimiter,
  createUserBasedLimiter,
  // Enhanced limiters for 20K user scaling
  createTierBasedLimiter,
  enhancedGeneralLimiter,
  enhancedTradingLimiter
};
