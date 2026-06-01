const express = require('express');
const router = express.Router();
const { sessionManager } = require('../config/session');

// Get session status and statistics (public endpoint for monitoring)
router.get('/status', async (req, res) => {
  try {
    const stats = await sessionManager.getSessionStats();
    
    // Check current session info
    const currentSession = {
      sessionId: req.sessionID,
      hasUserSession: !!req.session?.user,
      hasAdminSession: !!req.session?.admin,
      sessionData: {
        user: req.session?.user ? {
          id: req.session.user.id,
          email: req.session.user.email,
          username: req.session.user.username,
          loginAt: req.session.user.loginAt,
          lastActivity: req.session.user.lastActivity
        } : null,
        admin: req.session?.admin ? {
          id: req.session.admin.id,
          email: req.session.admin.email,
          username: req.session.admin.username,
          isSuperAdmin: req.session.admin.isSuperAdmin,
          loginAt: req.session.admin.loginAt,
          lastActivity: req.session.admin.lastActivity
        } : null
      }
    };

    res.json({
      message: 'Session status retrieved',
      sessionStats: stats,
      currentSession: currentSession,
      redisConnected: !!sessionManager.redisClient,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Session status error:', error);
    res.status(500).json({
      message: 'Failed to get session status',
      error: error.message
    });
  }
});

// Test session creation (development only)
router.post('/test-session', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'Test endpoint not available in production' });
    }

    // Create a test session
    req.session.testData = {
      created: new Date(),
      testId: Math.random().toString(36).substring(7)
    };

    res.json({
      message: 'Test session created',
      sessionId: req.sessionID,
      testData: req.session.testData
    });
  } catch (error) {
    console.error('Test session error:', error);
    res.status(500).json({
      message: 'Failed to create test session',
      error: error.message
    });
  }
});

// Destroy current session
router.post('/destroy', async (req, res) => {
  try {
    if (req.session?.user) {
      await sessionManager.destroyUserSession(req);
    } else if (req.session?.admin) {
      await sessionManager.destroyAdminSession(req);
    } else {
      // Destroy anonymous session
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
      });
    }

    res.json({
      message: 'Session destroyed successfully'
    });
  } catch (error) {
    console.error('Session destroy error:', error);
    res.status(500).json({
      message: 'Failed to destroy session',
      error: error.message
    });
  }
});

module.exports = router;
