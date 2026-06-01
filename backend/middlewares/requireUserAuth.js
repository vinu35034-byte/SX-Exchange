const User = require('../models/user');
const { sessionManager } = require('../config/session');
const { createLogger } = require('../utils/logger');

const logger = createLogger('user-auth');

const requireUserAuth = async (req, res, next) => {
  try {
    // Enhanced session validation logging
    const sessionValidationStart = Date.now();
    const sessionId = req.sessionID;
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent');

    // Log authentication attempt
    logger.info('User authentication attempt', {
      sessionId,
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString()
    });

    // Check if user session exists
    if (!req.session || !req.session.user) {      
      logger.warn('Authentication failed - no session or user', {
        sessionId,
        hasSession: !!req.session,
        hasUser: !!req.session?.user,
        ipAddress,
        userAgent: userAgent?.substring(0, 100),
        timestamp: new Date().toISOString()
      });
      
      return res.status(401).json({ 
        message: 'Session expired or not authenticated. Please login again.',
        code: 'SESSION_REQUIRED'
        // SECURITY: removed sessionInfo — never leak session IDs in API responses
      });
    }

    const sessionUser = req.session.user;
    
    // Skip manual Redis check - express-session handles session persistence
    // The session middleware already verifies the session exists in the store
    
    // Get fresh user data from database
    const user = await User.findById(sessionUser.id);
    if (!user) {
      // User not found, destroy session
      logger.security('Authentication failed - user not found', {
        userId: sessionUser.id,
        sessionId,
        ipAddress,
        timestamp: new Date().toISOString()
      });
      
      await sessionManager.destroyUserSession(req);
      return res.status(401).json({ 
        message: 'User account not found. Please login again.',
        code: 'USER_NOT_FOUND',
        sessionInfo: {
          deniedAt: new Date(),
          sessionId
        }
      });
    }

    // Check if user account is active/not suspended
    if (user.status && user.status !== 'active') {
      logger.security('Authentication failed - account suspended', {
        userId: user._id.toString(),
        userStatus: user.status,
        sessionId,
        ipAddress,
        timestamp: new Date().toISOString()
      });
      
      await sessionManager.destroyUserSession(req);
      return res.status(403).json({ 
        message: 'Account suspended or inactive. Please contact support.',
        code: 'ACCOUNT_SUSPENDED',
        sessionInfo: {
          deniedAt: new Date(),
          sessionId
        }
      });
    }

    // Update session activity with enhanced tracking
    await sessionManager.updateActivity(req);

    // Log successful authentication
    const authTime = Date.now() - sessionValidationStart;
    logger.info('User authentication successful', {
      userId: user._id.toString(),
      username: user.username,
      sessionId,
      ipAddress,
      authTime: `${authTime}ms`,
      timestamp: new Date().toISOString()
    });

    // Attach user to request with session context
    req.user = user;
    req.sessionUser = sessionUser;
    req.authContext = {
      authenticatedAt: new Date(),
      sessionId,
      ipAddress,
      userAgent
    };
    
    next();
  } catch (err) {
    logger.error('User authentication error:', {
      error: err.message,
      sessionId: req.sessionID,
      ipAddress: req.ip,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    
    return res.status(500).json({
      message: 'Authentication error. Please try again.',
      code: 'AUTH_ERROR',
      sessionInfo: {
        errorAt: new Date(),
        sessionId: req.sessionID
      }
    });
  }
};

module.exports = requireUserAuth;
