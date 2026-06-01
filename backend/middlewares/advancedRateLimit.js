const rateLimit = require('express-rate-limit');

// Create different rate limiters for different operations
const createRateLimiter = (requests, windowMs, message) => {
  // In development, increase limits significantly for 20K user testing
  const devRequests = process.env.NODE_ENV === 'development' ? requests * 20 : requests;
  
  return rateLimit({
    windowMs,
    max: devRequests,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    // Use memory store for development, Redis for production
    store: undefined, // Will use MemoryStore by default
    skip: (req, res) => {
      // Skip rate limiting for localhost in development
      if (process.env.NODE_ENV === 'development' && 
          (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip?.startsWith('192.168.') || req.ip?.startsWith('::ffff:127.0.0.1'))) {
        return true;
      }
      
      // SECURITY: Only skip for actual Socket.IO path, not URL substring match
      if (req.headers.upgrade === 'websocket' && (req.path === '/socket.io' || req.path.startsWith('/socket.io/'))) {
        return true;
      }
      
      return false;
    }
  });
};

// Authentication operations (login, signup, password reset) - increased for 20K users
const authLimiter = createRateLimiter(
  parseInt(process.env.RATE_LIMIT_AUTH) || 25,
  60 * 1000, // 1 minute
  'Too many authentication attempts. Please try again later.'
);

// Trading operations (place order, cancel order, get orders) - scaled for 20K users
const tradingLimiter = createRateLimiter(
  parseInt(process.env.RATE_LIMIT_TRADING) || 5000,
  60 * 1000, // 1 minute
  'Trading rate limit exceeded. Please slow down.'
);

// Market data (prices, orderbook, recent trades) - high volume for 20K users
const marketDataLimiter = createRateLimiter(
  parseInt(process.env.RATE_LIMIT_MARKET_DATA) || 20000, // Increased significantly for 20K users
  60 * 1000, // 1 minute
  'Market data rate limit exceeded. Consider using WebSocket for real-time data.'
);

// General API operations - optimized for 20K concurrent users
const generalLimiter = createRateLimiter(
  parseInt(process.env.RATE_LIMIT_GENERAL) || 8000, // Increased significantly for 20K users
  60 * 1000, // 1 minute
  'API rate limit exceeded. Please slow down.'
);

// Strict limiter for suspicious activity
const strictLimiter = createRateLimiter(
  20,
  60 * 1000, // 1 minute
  'Suspicious activity detected. Access temporarily restricted.'
);

// Bot protection with higher limits for legitimate high-frequency trading (20K users)
const botProtectionLimiter = createRateLimiter(
  800, // Increased from 300 to handle 20K users
  10 * 60 * 1000, // 10 minutes
  'Rate limit exceeded. If you are a legitimate high-frequency trader, please contact support.'
);

module.exports = {
  authLimiter,
  tradingLimiter,
  marketDataLimiter,
  generalLimiter,
  strictLimiter,
  botProtectionLimiter
};
