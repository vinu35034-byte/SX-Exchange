const session = require('express-session');
const redisManager = require('../config/redis');
const { createLogger } = require('../utils/logger');

const logger = createLogger('session-manager');

// Try to import RedisStore, fallback to MemoryStore if Redis is not available
let RedisStore;
try {
  // For connect-redis v6 (requires session to be passed)
  const ConnectRedis = require('connect-redis');
  RedisStore = ConnectRedis(session);
} catch (error) {
  logger.warn('Redis store not available, using memory store', { error: error.message });
  RedisStore = null;
}

/**
 * Session configuration for 20K users
 * Uses Redis for distributed session storage when available, fallback to memory store
 */
const getSessionConfig = () => {
  // Base session configuration
  // SECURITY: Require SESSION_SECRET in production
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret && process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: SESSION_SECRET environment variable is required in production. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  }

  const isProduction = process.env.NODE_ENV === 'production';

  const baseConfig = {
    secret: sessionSecret || 'dev-only-secret-' + require('crypto').randomBytes(16).toString('hex'),
    name: 'tradingSessionId',
    resave: false, // Don't save session if not modified
    saveUninitialized: false, // Don't save empty sessions
    rolling: false, // Don't extend session on each request to avoid constant regeneration
    cookie: {
      secure: isProduction, // SECURITY: true in production (HTTPS only)
      httpOnly: true, // SECURITY: always true — never expose cookies to JS
      maxAge: parseInt(process.env.SESSION_COOKIE_MAX_AGE) || (1000 * 60 * 60 * 4), // SECURITY: 4 hours instead of 30 days
      sameSite: isProduction ? 'strict' : 'lax', // SECURITY: strict in production
      domain: undefined, // Let browser set domain automatically for localhost
      path: '/' // Ensure cookie is available for all paths
    },
    // Add session debugging in development
    ...(process.env.NODE_ENV !== 'production' && {
      // Log session activity in development only when needed
      genid: (req) => {
        return require('crypto').randomBytes(16).toString('hex');
      }
    })
  };

  // Try to use Redis store if available
  if (RedisStore && redisManager.clients && redisManager.clients.session) {
    try {
      const store = new RedisStore({ 
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        client: redisManager.clients.session,
        prefix: 'sess:',
        ttl: Math.floor((parseInt(process.env.SESSION_COOKIE_MAX_AGE) || (1000 * 60 * 60 * 24 * 7)) / 1000), // Convert to seconds
        logErrors: (err) => {
          logger.error('Redis session store error', { error: err.message });
        }
      });
      
      return {
        ...baseConfig,
        store: store
      };
    } catch (error) {
      logger.warn('Failed to create Redis store, using memory store', { error: error.message });
    }
  }

  // Fallback to memory store
  logger.info('Using memory store for sessions (not recommended for production)');
  return baseConfig;
};

/**
 * Session manager for user authentication
 */
class SessionManager {
  constructor() {
    this.logger = createLogger('session-manager');
    this.redisClient = null;
  }

  // Initialize with Redis client
  initialize() {
    if (redisManager.clients && redisManager.clients.session) {
      this.redisClient = redisManager.clients.session;
      this.logger.info('Session manager initialized with Redis');
    } else {
      this.logger.warn('Session manager initialized without Redis');
    }
  }

  // Store user session data
  async storeUserSession(sessionId, userData) {
    try {
      if (this.redisClient) {
        const sessionKey = `user_session:${sessionId}`;
        const ttlSeconds = Math.floor((parseInt(process.env.SESSION_COOKIE_MAX_AGE) || (1000 * 60 * 60 * 24 * 7)) / 1000);
        await this.redisClient.setex(sessionKey, ttlSeconds, JSON.stringify(userData));
        this.logger.debug('User session stored in Redis', { sessionId, userId: userData.id });
      }
    } catch (error) {
      this.logger.error('Failed to store user session', { error: error.message, sessionId });
    }
  }

  // Store admin session data
  async storeAdminSession(sessionId, adminData) {
    try {
      if (this.redisClient) {
        const sessionKey = `admin_session:${sessionId}`;
        const ttlSeconds = Math.floor((parseInt(process.env.SESSION_COOKIE_MAX_AGE) || (1000 * 60 * 60 * 24 * 7)) / 1000);
        await this.redisClient.setex(sessionKey, ttlSeconds, JSON.stringify(adminData));
        this.logger.debug('Admin session stored in Redis', { sessionId, adminId: adminData.id });
      }
    } catch (error) {
      this.logger.error('Failed to store admin session', { error: error.message, sessionId });
    }
  }

  // Get user session data
  async getUserSession(sessionId) {
    try {
      if (this.redisClient) {
        const sessionKey = `user_session:${sessionId}`;
        const sessionData = await this.redisClient.get(sessionKey);
        if (sessionData) {
          return JSON.parse(sessionData);
        }
      }
      return null;
    } catch (error) {
      this.logger.error('Failed to get user session', { error: error.message, sessionId });
      return null;
    }
  }

  // Get admin session data
  async getAdminSession(adminId) {
    try {
      if (this.redisClient) {
        const sessionKey = `admin_session:${adminId}`;
        const sessionData = await this.redisClient.get(sessionKey);
        if (sessionData) {
          return JSON.parse(sessionData);
        }
      }
      return null;
    } catch (error) {
      this.logger.error('Failed to get admin session', { error: error.message, adminId });
      return null;
    }
  }

  // Create user session with both JWT and Redis
  async createUserSession(req, userData) {
    try {
      // Store in express session
      req.session.user = {
        id: userData._id,
        email: userData.email,
        username: userData.username,
        vipLevel: userData.vipLevel,
        role: 'user',
        loginAt: new Date(),
        lastActivity: new Date()
      };

      // Store additional session data in Redis using consistent sessionId key
      if (this.redisClient) {
        const sessionKey = `user_session:${req.sessionID}`;
        await this.redisClient.setex(sessionKey, 86400 * 7, JSON.stringify({
          userId: userData._id,
          email: userData.email,
          sessionId: req.sessionID,
          loginAt: new Date(),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          lastActivity: new Date()
        }));
      }

      this.logger.info('User session created', {
        userId: userData._id,
        sessionId: req.sessionID,
        ipAddress: req.ip
      });

      return req.sessionID;
    } catch (error) {
      this.logger.error('Error creating user session', {
        userId: userData._id,
        error: error.message
      });
      throw error;
    }
  }

  // Create admin session with both JWT and Redis
  async createAdminSession(req, adminData) {
    try {
      // Store in express session
      req.session.admin = {
        id: adminData._id,
        email: adminData.email,
        username: adminData.username,
        role: 'admin',
        isSuperAdmin: adminData.isSuperAdmin,
        loginAt: new Date(),
        lastActivity: new Date()
      };

      // Explicitly save the session
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      // Store additional session data in Redis
      if (this.redisClient) {
        const sessionKey = `admin_session:${adminData._id}`;
        await this.redisClient.setex(sessionKey, 86400 * 7, JSON.stringify({
          adminId: adminData._id,
          email: adminData.email,
          sessionId: req.sessionID,
          loginAt: new Date(),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          lastActivity: new Date()
        }));
      }

      this.logger.info('Admin session created', {
        adminId: adminData._id,
        sessionId: req.sessionID,
        ipAddress: req.ip
      });

      return req.sessionID;
    } catch (error) {
      this.logger.error('Error creating admin session', {
        adminId: adminData._id,
        error: error.message
      });
      throw error;
    }
  }

  // Update session activity
  async updateActivity(req) {
    try {
      if (req.session && req.session.user) {
        req.session.user.lastActivity = new Date();
        
        if (this.redisClient) {
          const sessionKey = `user_session:${req.sessionID}`;
          const sessionData = await this.redisClient.get(sessionKey);
          
          if (sessionData) {
            const data = JSON.parse(sessionData);
            data.lastActivity = new Date();
            const ttlSeconds = Math.floor((parseInt(process.env.SESSION_COOKIE_MAX_AGE) || (1000 * 60 * 60 * 24 * 7)) / 1000);
            await this.redisClient.setex(sessionKey, ttlSeconds, JSON.stringify(data));
          }
        }
      }

      if (req.session && req.session.admin) {
        req.session.admin.lastActivity = new Date();
        
        if (this.redisClient) {
          const sessionKey = `admin_session:${req.session.admin.id}`;
          const sessionData = await this.redisClient.get(sessionKey);
          
          if (sessionData) {
            const data = JSON.parse(sessionData);
            data.lastActivity = new Date();
            const ttlSeconds = Math.floor((parseInt(process.env.SESSION_COOKIE_MAX_AGE) || (1000 * 60 * 60 * 24 * 7)) / 1000);
            await this.redisClient.setex(sessionKey, ttlSeconds, JSON.stringify(data));
          }
        }
      }
    } catch (error) {
      this.logger.error('Error updating session activity', { error: error.message });
    }
  }

  // Destroy user session
  async destroyUserSession(req) {
    try {
      if (req.session && req.session.user) {
        const userId = req.session.user.id;
        
        // Remove from Redis using sessionId key (consistent with other methods)
        if (this.redisClient) {
          const sessionKey = `user_session:${req.sessionID}`;
          await this.redisClient.del(sessionKey);
        }
        
        // Destroy express session
        req.session.destroy((err) => {
          if (err) {
            this.logger.error('Error destroying session', { error: err.message });
          }
        });

        this.logger.info('User session destroyed', {
          userId: userId,
          sessionId: req.sessionID
        });
      }
    } catch (error) {
      this.logger.error('Error destroying user session', { error: error.message });
      throw error;
    }
  }

  // Destroy admin session
  async destroyAdminSession(req) {
    try {
      if (req.session && req.session.admin) {
        const adminId = req.session.admin.id;
        
        // Remove from Redis
        if (this.redisClient) {
          const sessionKey = `admin_session:${adminId}`;
          await this.redisClient.del(sessionKey);
        }
        
        // Destroy express session
        req.session.destroy((err) => {
          if (err) {
            this.logger.error('Error destroying session', { error: err.message });
          }
        });

        this.logger.info('Admin session destroyed', {
          adminId: adminId,
          sessionId: req.sessionID
        });
      }
    } catch (error) {
      this.logger.error('Error destroying admin session', { error: error.message });
      throw error;
    }
  }

  // Get session statistics
  async getSessionStats() {
    try {
      if (this.redisClient) {
        const userSessions = await this.redisClient.keys('user_session:*');
        const adminSessions = await this.redisClient.keys('admin_session:*');
        const expressSessions = await this.redisClient.keys('sess:*');

        return {
          activeSessions: expressSessions.length,
          userSessions: userSessions.length,
          adminSessions: adminSessions.length,
          totalSessions: expressSessions.length
        };
      }
      return { activeSessions: 0, userSessions: 0, adminSessions: 0, totalSessions: 0 };
    } catch (error) {
      this.logger.error('Failed to get session stats', { error: error.message });
      return { activeSessions: 0, userSessions: 0, adminSessions: 0, totalSessions: 0 };
    }
  }
}

// Middleware to update session activity
const updateSessionActivity = (req, res, next) => {
  if (req.session && (req.session.user || req.session.admin)) {
    sessionManager.updateActivity(req).catch(err => {
      logger.error('Error updating session activity middleware', { error: err.message });
    });
  }
  next();
};

// Create singleton instance
const sessionManager = new SessionManager();

module.exports = {
  getSessionConfig,
  sessionManager,
  updateSessionActivity
};
