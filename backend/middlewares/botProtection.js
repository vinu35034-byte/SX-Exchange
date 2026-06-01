const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { createLogger } = require('../utils/logger');

const logger = createLogger('bot-protection');

// List of known bad user agents
const knownBadBots = [
  'curl',
  'wget',
  'python-requests',
  'libwww-perl',
  'scrapy',
  'httpclient',
  'java',
  'nmap',
  'masscan',
  'bot',
  'crawler',
  'spider',
];

// Generate a fake session/token to discourage scrapers
function generateFakeToken() {
  return crypto.randomBytes(16).toString('hex');
}

// Basic bot protection rate limiter (more lenient for high-volume trading)
const apiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 500, // Increased from 80 to handle legitimate high-frequency trading
  message: { 
    error: 'Rate limit exceeded. If you are a legitimate trader, please contact support.',
    code: 'RATE_LIMIT_EXCEEDED',
    sessionInfo: {
      blockedAt: new Date()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skip: (req) => {
    // Skip rate limiting for Socket.IO and WebSocket connections
    return req.headers.upgrade === 'websocket' || req.path.startsWith('/socket.io/');
  },
  handler: (req, res) => {
    logger.security('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      sessionId: req.sessionID,
      timestamp: new Date().toISOString()
    });
    
    res.status(429).json({
      error: 'Rate limit exceeded. If you are a legitimate trader, please contact support.',
      code: 'RATE_LIMIT_EXCEEDED',
      sessionInfo: {
        blockedAt: new Date()
      }
    });
  }
});

// Block bad user agents
function userAgentBlocker(req, res, next) {
  // Skip user agent blocking for Socket.IO and WebSocket connections
  if (req.headers.upgrade === 'websocket' || req.path.startsWith('/socket.io/')) {
    return next();
  }

  const ua = (req.headers['user-agent'] || '').toLowerCase();
  if (!ua || knownBadBots.some(bot => ua.includes(bot))) {
    logger.security('Suspicious user agent blocked', {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      path: req.path,
      method: req.method,
      sessionId: req.sessionID,
      timestamp: new Date().toISOString()
    });
    
    return res.status(403).json({ 
      error: 'Suspicious activity detected. Access denied.', 
      code: 'SUSPICIOUS_USER_AGENT'
      // SECURITY: removed fake token and sessionId — never leak session info
    });
  }
  next();
}

// Basic IP reputation check (can be enhanced with external services)
const blacklistedIPs = new Set();

function ipBlocker(req, res, next) {
  if (blacklistedIPs.has(req.ip)) {
    return res.status(403).json({ 
      error: 'Your IP is blocked.',
      code: 'IP_BLOCKED' 
    });
  }
  next();
}

// Enhanced bot detection based on request patterns
function behaviorAnalyzer(req, res, next) {
  // Skip for WebSocket upgrades and Socket.IO paths
  if (req.headers.upgrade === 'websocket' || req.path.startsWith('/socket.io/')) {
    return next();
  }

  // Check for rapid sequential requests (potential bot behavior)
  // SECURITY: Key on IP only — user-agent is trivially spoofable
  const userKey = req.ip;
  
  // This is a simple implementation - in production, use Redis for shared state
  if (!global.requestTracker) {
    global.requestTracker = new Map();
    // SECURITY: Periodic cleanup to prevent unbounded memory growth (OOM DoS)
    setInterval(() => {
      const now = Date.now();
      for (const [key, timestamps] of global.requestTracker) {
        const recent = timestamps.filter(t => now - t < 10000);
        if (recent.length === 0) {
          global.requestTracker.delete(key);
        } else {
          global.requestTracker.set(key, recent);
        }
      }
    }, 30000); // Cleanup every 30 seconds
  }
  
  const now = Date.now();
  const userRequests = global.requestTracker.get(userKey) || [];
  
  // Remove requests older than 10 seconds
  const recentRequests = userRequests.filter(timestamp => now - timestamp < 10000);
  
  // If more than 50 requests in 10 seconds, it might be a bot
  if (recentRequests.length > 50) {
    return res.status(429).json({ 
      error: 'Suspicious request pattern detected. Please slow down.',
      code: 'SUSPICIOUS_PATTERN'
    });
  }
  
  // Add current request
  recentRequests.push(now);
  global.requestTracker.set(userKey, recentRequests);
  
  next();
}

// Combine all protections with conditional application
const botProtection = (req, res, next) => {
  // Skip bot protection only for actual WebSocket upgrade requests on the Socket.IO path
  // SECURITY: Only skip for genuine socket.io paths, not spoofed headers
  if (req.headers.upgrade === 'websocket' && 
      (req.path === '/socket.io' || req.path.startsWith('/socket.io/'))) {
    return next();
  }

  // Apply different levels of protection based on endpoint
  const isTrading = req.path.includes('/trading');
  const isMarketData = req.path.includes('/market');
  const isAuth = req.path.includes('/auth') || req.path.includes('/login') || req.path.includes('/register');

  // Apply behavior analysis for all requests
  behaviorAnalyzer(req, res, () => {
    // Apply user agent blocking
    userAgentBlocker(req, res, () => {
      // Apply IP blocking
      ipBlocker(req, res, () => {
        // Apply rate limiting only if not high-frequency trading endpoint
        if (isTrading || isMarketData) {
          // Skip general rate limiting for trading/market data (handled by specific limiters)
          return next();
        } else {
          // Apply general rate limiting for other endpoints
          apiLimiter(req, res, next);
        }
      });
    });
  });
};

module.exports = botProtection;
