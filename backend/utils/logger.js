const winston = require('winston');
const path = require('path');

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, service, userId, ip, ...meta }) => {
    let logEntry = `${timestamp} [${level.toUpperCase()}]`;
    
    if (service) logEntry += ` [${service}]`;
    if (userId) logEntry += ` [User:${userId}]`;
    if (ip) logEntry += ` [IP:${ip}]`;
    
    logEntry += `: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logEntry += ` ${JSON.stringify(meta)}`;
    }
    
    return logEntry;
  })
);

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { 
    service: 'crypto-exchange',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      tailable: true
    }),
    
    // Security events log
    new winston.transports.File({
      filename: path.join(logsDir, 'security.log'),
      level: 'warn',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      tailable: true
    }),
    
    // Trading activity log
    new winston.transports.File({
      filename: path.join(logsDir, 'trading.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      tailable: true
    })
  ],
  
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Custom logging methods for different contexts
const createLogger = (service) => {
  return {
    info: (message, meta = {}) => logger.info(message, { service, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { service, ...meta }),
    error: (message, meta = {}) => logger.error(message, { service, ...meta }),
    debug: (message, meta = {}) => logger.debug(message, { service, ...meta }),
    
    // Security-specific logging
    security: (message, meta = {}) => {
      logger.warn(message, { 
        service: `${service}-security`, 
        security: true,
        ...meta 
      });
    },
    
    // Trading-specific logging
    trading: (message, meta = {}) => {
      logger.info(message, { 
        service: `${service}-trading`, 
        trading: true,
        ...meta 
      });
    },
    
    // User action logging
    userAction: (action, userId, meta = {}) => {
      logger.info(`User action: ${action}`, {
        service: `${service}-user`,
        userId,
        action,
        ...meta
      });
    },
    
    // API request logging
    apiRequest: (method, url, userId, ip, statusCode, responseTime, meta = {}) => {
      logger.info(`${method} ${url} - ${statusCode}`, {
        service: `${service}-api`,
        method,
        url,
        userId,
        ip,
        statusCode,
        responseTime,
        ...meta
      });
    }
  };
};

// Express middleware for request logging
const requestLogger = (service = 'api') => {
  const serviceLogger = createLogger(service);
  
  return (req, res, next) => {
    const start = Date.now();
    
    // Capture original res.end
    const originalEnd = res.end;
    
    res.end = function(...args) {
      const responseTime = Date.now() - start;
      const userId = req.user?.id || req.user?._id;
      const ip = req.ip || req.connection.remoteAddress;
      
      serviceLogger.apiRequest(
        req.method,
        req.originalUrl,
        userId,
        ip,
        res.statusCode,
        responseTime,
        {
          userAgent: req.get('User-Agent'),
          contentLength: res.get('Content-Length')
        }
      );
      
      // Call original end method
      originalEnd.apply(this, args);
    };
    
    next();
  };
};

// Error logging middleware
const errorLogger = (service = 'api') => {
  const serviceLogger = createLogger(service);
  
  return (err, req, res, next) => {
    const userId = req.user?.id || req.user?._id;
    const ip = req.ip || req.connection.remoteAddress;
    
    serviceLogger.error('Request error', {
      error: err.message,
      stack: err.stack,
      method: req.method,
      url: req.originalUrl,
      userId,
      ip,
      userAgent: req.get('User-Agent')
    });
    
    next(err);
  };
};

module.exports = {
  logger,
  createLogger,
  requestLogger,
  errorLogger
};
