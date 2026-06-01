const rateLimit = require('express-rate-limit');

// Development rate limiter with higher limits
const createDevRateLimiter = (requests, windowMs, message) => {
  // In development, increase limits by 10x
  const devRequests = process.env.NODE_ENV === 'development' ? requests * 10 : requests;
  
  return rateLimit({
    windowMs,
    max: devRequests,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skip: (req, res) => {
      // Skip rate limiting for localhost in development
      if (process.env.NODE_ENV === 'development') {
        if (req.ip === '127.0.0.1' || 
            req.ip === '::1' || 
            req.ip === '::ffff:127.0.0.1' ||
            req.ip?.startsWith('192.168.') ||
            req.ip?.startsWith('::ffff:192.168.')) {
          return true;
        }
      }
      
      // SECURITY: Only skip for actual Socket.IO path, not URL substring match
      if (req.headers.upgrade === 'websocket' && (req.path === '/socket.io' || req.path.startsWith('/socket.io/'))) {
        return true;
      }
      
      return false;
    }
  });
};

// Export rate limiters for different endpoints
module.exports = {
  // Market data endpoints (high frequency)
  marketDataLimit: createDevRateLimiter(
    60, // 60 requests per minute (600 in dev)
    60 * 1000, // 1 minute window
    'Too many market data requests. Please slow down.'
  ),

  // Authentication endpoints (medium frequency)
  authLimit: createDevRateLimiter(
    10, // 10 requests per minute (100 in dev)
    60 * 1000, // 1 minute window
    'Too many authentication attempts. Please try again later.'
  ),

  // General API endpoints (medium frequency)
  generalLimit: createDevRateLimiter(
    30, // 30 requests per minute (300 in dev)
    60 * 1000, // 1 minute window
    'Too many requests. Please slow down.'
  ),

  // Trading endpoints (high frequency)
  tradingLimit: createDevRateLimiter(
    100, // 100 requests per minute (1000 in dev)
    60 * 1000, // 1 minute window
    'Too many trading requests. Please slow down.'
  )
};
