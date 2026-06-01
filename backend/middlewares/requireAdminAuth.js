const Admin = require('../models/admin');
const { sessionManager } = require('../config/session');
const { createLogger } = require('../utils/logger');

const logger = createLogger('admin-auth');

const requireAdminAuth = async (req, res, next) => {
  try {
    // Enhanced admin session validation logging
    const sessionValidationStart = Date.now();
    const sessionId = req.sessionID;
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent');

    // SECURITY: Debug logging removed — was leaking admin credentials and session IDs in production

    // Log admin authentication attempt
    logger.info('Admin authentication attempt', {
      sessionId,
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString()
    });

    // Check if admin session exists
    if (!req.session || !req.session.admin) {
      logger.security('Admin authentication failed - no session', {
        sessionId,
        ipAddress,
        userAgent,
        timestamp: new Date().toISOString()
      });
      
      return res.status(401).json({ 
        message: 'Admin session expired or not authenticated. Please login again.',
        code: 'ADMIN_SESSION_REQUIRED'
        // SECURITY: removed sessionInfo — never leak session IDs in API responses
      });
    }

    const sessionAdmin = req.session.admin;
    
    // Skip Redis validation temporarily to fix authentication issue
    // TODO: Re-enable Redis validation once Redis session storage is properly configured

    // Get fresh admin data from database
    const admin = await Admin.findById(sessionAdmin.id);
    if (!admin) {
      // Admin not found, destroy session
      logger.security('Admin authentication failed - admin not found', {
        adminId: sessionAdmin.id,
        sessionId,
        ipAddress,
        timestamp: new Date().toISOString()
      });
      
      await sessionManager.destroyAdminSession(req);
      return res.status(401).json({ 
        message: 'Admin account not found. Please login again.',
        code: 'ADMIN_NOT_FOUND'
      });
    }

    // Check if admin account is active
    if (admin.status && admin.status !== 'active') {
      logger.security('Admin authentication failed - account suspended', {
        adminId: admin._id.toString(),
        adminStatus: admin.status,
        sessionId,
        ipAddress,
        timestamp: new Date().toISOString()
      });
      
      await sessionManager.destroyAdminSession(req);
      return res.status(403).json({ 
        message: 'Admin account suspended or inactive. Please contact super admin.',
        code: 'ADMIN_ACCOUNT_SUSPENDED'
      });
    }

    // Update session activity with enhanced tracking
    await sessionManager.updateActivity(req);

    // Log successful admin authentication
    const authTime = Date.now() - sessionValidationStart;
    logger.info('Admin authentication successful', {
      adminId: admin._id.toString(),
      username: admin.username,
      isSuperAdmin: admin.isSuperAdmin,
      sessionId,
      ipAddress,
      authTime: `${authTime}ms`,
      timestamp: new Date().toISOString()
    });

    // Attach admin to request (maintain compatibility with existing code)
    req.admin = admin;
    req.sessionAdmin = sessionAdmin;
    req.user = {
      id: admin._id.toString(),
      role: admin.isSuperAdmin ? 'superadmin' : 'admin',
      email: admin.email,
      username: admin.username
    };
    
    // Add admin auth context
    req.adminContext = {
      authenticatedAt: new Date(),
      sessionId,
      ipAddress,
      userAgent,
      isSuperAdmin: admin.isSuperAdmin
    };
    
    next();
  } catch (err) {
    logger.error('Admin authentication error:', {
      error: err.message,
      sessionId: req.sessionID,
      ipAddress: req.ip,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    
    return res.status(500).json({
      message: 'Admin authentication error. Please try again.',
      code: 'ADMIN_AUTH_ERROR'
    });
  }
};

module.exports = requireAdminAuth;
