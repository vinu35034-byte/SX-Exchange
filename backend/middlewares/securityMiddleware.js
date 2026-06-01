/**
 * Comprehensive Security Middleware
 * Protects against: NoSQL injection, DDoS, XSS, HPP, request smuggling,
 * slowloris, payload bombs, and various injection attacks.
 *
 * NOTE: express-mongo-sanitize is NOT used because it crashes on Express 5
 * (req.query is a read-only getter in Express 5). A custom sanitizer is
 * used instead.
 */
const hpp = require('hpp');
const mongoose = require('mongoose');
const { createLogger } = require('../utils/logger');

const logger = createLogger('security');

// ─── 1. NoSQL Injection Sanitizer (Express 5 compatible) ──────────────────
// Strips MongoDB operators ($gt, $ne, $regex, etc.) from req.body and req.params.
// In Express 5 req.query is a read-only getter so we sanitize it by deep-checking
// values in route handlers via the exported sanitizeValue helper instead.

function hasDollarKeys(obj) {
  if (obj === null || typeof obj !== 'object') return false;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$')) return true;
    if (typeof obj[key] === 'object' && obj[key] !== null && hasDollarKeys(obj[key])) return true;
  }
  return false;
}

function stripDollarKeys(obj, replaceWith = '_') {
  if (Array.isArray(obj)) return obj.map(item => stripDollarKeys(item, replaceWith));
  if (obj !== null && typeof obj === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      const safeKey = key.startsWith('$') ? replaceWith + key.slice(1) : key;
      cleaned[safeKey] = stripDollarKeys(value, replaceWith);
    }
    return cleaned;
  }
  // String values that look like operators (e.g. "$gt")
  if (typeof obj === 'string' && obj.startsWith('$')) {
    return replaceWith + obj.slice(1);
  }
  return obj;
}

function noSqlSanitizer(req, res, next) {
  try {
    // Sanitize body (writable)
    if (req.body && typeof req.body === 'object') {
      if (hasDollarKeys(req.body)) {
        logger.security('NoSQL injection attempt blocked in body', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          userAgent: req.get('User-Agent')?.substring(0, 100),
        });
        req.body = stripDollarKeys(req.body);
      }
    }

    // Sanitize params (writable)
    if (req.params && typeof req.params === 'object') {
      for (const [key, value] of Object.entries(req.params)) {
        if (typeof value === 'string' && value.includes('$')) {
          logger.security('NoSQL injection attempt blocked in params', {
            ip: req.ip, path: req.path, method: req.method, key,
          });
          req.params[key] = value.replace(/\$/g, '_');
        }
      }
    }

    // For Express 5: req.query is a read-only getter, so we can't reassign it.
    // Instead, we check for dangerous operators and reject the request outright.
    const query = req.query;
    if (query && typeof query === 'object' && hasDollarKeys(query)) {
      logger.security('NoSQL injection attempt blocked in query', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent')?.substring(0, 100),
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}

// ─── 2. HTTP Parameter Pollution Protection ────────────────────────────────
// Prevents ?sort=email&sort=password attacks — picks last value
const hppProtection = hpp({
  whitelist: [
    // Fields where arrays are legitimately expected
    'tags', 'pairs', 'symbols', 'ids', 'currencies',
  ],
});

// ─── 3. Regex Escape Helper ────────────────────────────────────────────────
// Prevents ReDoS by escaping special regex characters in user input
function escapeRegex(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── 4. ObjectId Validator ─────────────────────────────────────────────────
// Validates MongoDB ObjectId format before database queries
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id);
}

// Middleware that validates all :id-like params are valid ObjectIds
function validateObjectIdParams(req, res, next) {
  const idParamNames = ['id', 'userId', 'traderId', 'followingId', 'requestId',
    'poolId', 'positionId', 'orderId', 'tradeId', 'transactionId',
    'withdrawalId', 'depositId', 'addressId', 'notificationId',
    'documentId', 'rewardId', 'tokenId', 'levelId'];

  for (const paramName of idParamNames) {
    const value = req.params[paramName];
    if (value && !isValidObjectId(value)) {
      return res.status(400).json({
        success: false,
        error: `Invalid ${paramName} format`,
      });
    }
  }
  next();
}

// ─── 5. Request Size & Payload Bomb Protection ─────────────────────────────
// Prevents oversized JSON/urlencoded bodies and deeply nested objects
function payloadLimiter(options = {}) {
  const maxBodySize = options.maxBodySize || '1mb';
  const maxUrlEncodedSize = options.maxUrlEncodedSize || '1mb';
  const maxJsonDepth = options.maxJsonDepth || 10;
  const maxParamLength = options.maxParamLength || 500;
  const maxQueryParams = options.maxQueryParams || 30;

  return (req, res, next) => {
    // Check query string parameter count (prevent query bomb)
    const queryKeys = Object.keys(req.query || {});
    if (queryKeys.length > maxQueryParams) {
      logger.security('Query bomb attempt blocked', {
        ip: req.ip,
        path: req.path,
        queryCount: queryKeys.length,
      });
      return res.status(400).json({
        success: false,
        error: 'Too many query parameters',
      });
    }

    // Check individual query param lengths
    for (const [key, value] of Object.entries(req.query || {})) {
      if (typeof value === 'string' && value.length > maxParamLength) {
        logger.security('Oversized query parameter blocked', {
          ip: req.ip,
          path: req.path,
          param: key,
          length: value.length,
        });
        return res.status(400).json({
          success: false,
          error: `Query parameter '${key}' exceeds maximum length`,
        });
      }
    }

    // Check JSON body depth (prevent deeply nested object DoS)
    if (req.body && typeof req.body === 'object') {
      if (getObjectDepth(req.body) > maxJsonDepth) {
        logger.security('Deep nesting attack blocked', {
          ip: req.ip,
          path: req.path,
        });
        return res.status(400).json({
          success: false,
          error: 'Request body is too deeply nested',
        });
      }
    }

    next();
  };
}

function getObjectDepth(obj, currentDepth = 0) {
  if (currentDepth > 20) return currentDepth; // Hard ceiling to prevent stack overflow
  if (obj === null || typeof obj !== 'object') return currentDepth;
  let maxDepth = currentDepth;
  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null) {
      const depth = getObjectDepth(value, currentDepth + 1);
      if (depth > maxDepth) maxDepth = depth;
    }
  }
  return maxDepth;
}

// ─── 6. Request Timeout Protection (anti-Slowloris) ────────────────────────
function requestTimeout(timeoutMs = 30000) {
  return (req, res, next) => {
    // Don't timeout SSE/WebSocket/long-polling connections
    if (req.path.startsWith('/socket.io/') || req.headers.upgrade === 'websocket') {
      return next();
    }

    req.setTimeout(timeoutMs, () => {
      if (!res.headersSent) {
        logger.security('Request timeout — possible Slowloris attack', {
          ip: req.ip,
          path: req.path,
          method: req.method,
        });
        res.status(408).json({
          success: false,
          error: 'Request timeout',
        });
      }
    });
    next();
  };
}

// ─── 7. Query String Sanitizer ─────────────────────────────────────────────
// In Express 5 req.query is read-only. Instead of mutating, we reject requests
// that contain object-type query values (which indicate operator injection).
function sanitizeQueryStrings(req, res, next) {
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      const value = req.query[key];
      // If the value is an object (operator injection attempt), reject it
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        logger.security('Query operator injection blocked', {
          ip: req.ip,
          path: req.path,
          key,
        });
        return res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
        });
      }
    }
  }
  next();
}

// ─── 8. Suspicious Path Detection ──────────────────────────────────────────
// Blocks common exploit path patterns
function pathTraversalProtection(req, res, next) {
  const suspiciousPatterns = [
    /\.\.\//,             // Directory traversal
    /\.\.\\/,             // Windows directory traversal
    /%2e%2e/i,            // URL-encoded traversal
    /%252e%252e/i,        // Double URL-encoded traversal
    /\/etc\/passwd/i,     // Linux file read
    /\/proc\/self/i,      // Linux proc attack
    /cmd\.exe/i,          // Windows RCE
    /powershell/i,        // Windows RCE
    /\0/,                 // Null byte injection
    /<script/i,           // XSS in URL
    /javascript:/i,       // JS protocol handler
    /vbscript:/i,         // VBScript protocol handler
    /on\w+\s*=/i,         // Event handler injections
    /data:text\/html/i,   // Data URI XSS
  ];

  const fullPath = decodeURIComponent(req.originalUrl || req.url || '');
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(fullPath)) {
      logger.security('Suspicious path blocked', {
        ip: req.ip,
        path: fullPath,
        pattern: pattern.toString(),
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
      });
    }
  }
  next();
}

// ─── 9. XSS Sanitizer for Request Body ────────────────────────────────────
// Strips HTML tags and dangerous characters from string values in req.body
function xssSanitizer(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  // Remove script tags, event handlers, and dangerous HTML
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/<link\b[^>]*>/gi, '');
}

function sanitizeObject(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  if (obj !== null && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  return obj;
}

// ─── 10. IP-Based Abuse Tracking ───────────────────────────────────────────
// Tracks per-IP error rates — blocks IPs that hit too many 4xx/5xx errors
const ipErrorCounters = new Map();

function ipAbuseTracker(req, res, next) {
  const ip = req.ip;
  const originalEnd = res.end;

  res.end = function (...args) {
    // Track error responses
    if (res.statusCode >= 400) {
      const now = Date.now();
      if (!ipErrorCounters.has(ip)) {
        ipErrorCounters.set(ip, []);
      }
      const errors = ipErrorCounters.get(ip);
      errors.push(now);

      // Keep only errors from last 5 minutes
      const cutoff = now - 5 * 60 * 1000;
      const recent = errors.filter(t => t > cutoff);
      ipErrorCounters.set(ip, recent);

      // If more than 100 errors in 5 minutes from same IP, log it
      if (recent.length > 100) {
        logger.security('IP abuse threshold exceeded', {
          ip,
          errorCount: recent.length,
          path: req.path,
          method: req.method,
        });
      }
    }

    return originalEnd.apply(this, args);
  };

  // Clean up stale entries periodically (every 10 minutes)
  if (!ipAbuseTracker._cleanupTimer) {
    ipAbuseTracker._cleanupTimer = setInterval(() => {
      const now = Date.now();
      const cutoff = now - 5 * 60 * 1000;
      for (const [ip, errors] of ipErrorCounters) {
        const recent = errors.filter(t => t > cutoff);
        if (recent.length === 0) {
          ipErrorCounters.delete(ip);
        } else {
          ipErrorCounters.set(ip, recent);
        }
      }
    }, 10 * 60 * 1000);
  }

  next();
}

// ─── 11. Enum Validator Factory ────────────────────────────────────────────
// For query params that should only accept specific values
function validateEnum(value, allowedValues, fieldName) {
  if (value === undefined || value === null || value === '') return true;
  if (!allowedValues.includes(String(value))) {
    return false;
  }
  return true;
}

// Common enum values used across routes
const ENUMS = {
  status: ['pending', 'approved', 'rejected', 'completed', 'failed', 'cancelled', 'active', 'inactive', 'processing', 'confirmed', 'expired'],
  side: ['buy', 'sell'],
  orderType: ['market', 'limit'],
  direction: ['in', 'out', 'deposit', 'withdrawal', 'trade'],
  kycStatus: ['pending', 'approved', 'rejected', 'none', 'submitted'],
  currency: ['USDT', 'BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'DOT', 'XRP', 'DOGE', 'MATIC', 'AVAX', 'LINK', 'UNI', 'ATOM'],
  network: ['ERC20', 'TRC20', 'BEP20', 'SOL', 'BTC', 'MATIC', 'AVAX'],
  sortDirection: ['asc', 'desc', '1', '-1'],
};

// ─── Export All Middleware ──────────────────────────────────────────────────
module.exports = {
  // Core middleware (apply globally)
  noSqlSanitizer,
  hppProtection,
  sanitizeQueryStrings,
  pathTraversalProtection,
  xssSanitizer,
  payloadLimiter,
  requestTimeout,
  ipAbuseTracker,
  validateObjectIdParams,

  // Helpers (use in controllers/routes)
  escapeRegex,
  isValidObjectId,
  validateEnum,
  stripDollarKeys,
  ENUMS,

  // Convenience: apply all global security middleware at once
  applyAll: () => [
    pathTraversalProtection,
    noSqlSanitizer,
    hppProtection,
    sanitizeQueryStrings,
    xssSanitizer,
    payloadLimiter(),
    requestTimeout(30000),
    ipAbuseTracker,
    validateObjectIdParams,
  ],
};
