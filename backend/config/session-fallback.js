const session = require('express-session');
const { createLogger } = require('../utils/logger');

const logger = createLogger('session-manager');

/**
 * Temporary session configuration without Redis
 * This is a fallback for development when Redis is not available
 */
const getSessionConfig = () => {
  logger.warn('⚠️ Using memory session store - not suitable for production!');
  
  return {
    secret: process.env.SESSION_SECRET || 'crypto-trading-platform-secret-2024',
    name: 'tradingSessionId',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
    }
  };
};

/**
 * Session manager for user authentication
 */
class SessionManager {
  constructor() {
    this.logger = createLogger('session-manager');
  }

  /**
   * Create user session
   */
  async createUserSession(req, userData) {
    try {
      req.session.user = {
        id: userData._id,
        email: userData.email,
        username: userData.username,
        vipLevel: userData.vipLevel,
        role: 'user',
        loginAt: new Date(),
        lastActivity: new Date()
      };

      this.logger.info('User session created', {
        userId: userData._id,
        sessionId: req.sessionID
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

  /**
   * Create admin session
   */
  async createAdminSession(req, adminData) {
    try {
      req.session.admin = {
        id: adminData._id,
        email: adminData.email,
        username: adminData.username,
        role: 'admin',
        permissions: adminData.permissions || [],
        loginAt: new Date(),
        lastActivity: new Date()
      };

      this.logger.info('Admin session created', {
        adminId: adminData._id,
        sessionId: req.sessionID
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

  /**
   * Update session activity
   */
  async updateActivity(req) {
    try {
      if (req.session.user) {
        req.session.user.lastActivity = new Date();
      }

      if (req.session.admin) {
        req.session.admin.lastActivity = new Date();
      }
    } catch (error) {
      this.logger.error('Error updating session activity', { error: error.message });
    }
  }

  /**
   * Destroy user session
   */
  async destroyUserSession(req) {
    try {
      if (req.session.user) {
        const userId = req.session.user.id;
        
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

  /**
   * Destroy admin session
   */
  async destroyAdminSession(req) {
    try {
      if (req.session.admin) {
        const adminId = req.session.admin.id;
        
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

  /**
   * Get session statistics
   */
  async getSessionStats() {
    // Memory store doesn't provide detailed stats
    return {
      activeSessions: 0,
      userSessions: 0,
      adminSessions: 0,
      totalSessions: 0
    };
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

const sessionManager = new SessionManager();

module.exports = {
  getSessionConfig,
  sessionManager,
  updateSessionActivity
};
