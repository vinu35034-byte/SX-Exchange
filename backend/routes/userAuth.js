const express = require('express');
const router = express.Router();
const requireUserAuth = require('../middlewares/requireUserAuth');
const { signup, signin, logout, forgotPassword, resetPassword } = require('../controllers/userAuthController');

// Authentication routes
router.post('/signup',  signup);
router.post('/signin',  signin);
router.post('/logout',  logout);

// Password reset routes
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected route to get current user
router.get('/me', requireUserAuth, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      email: req.user.email,
      username: req.user.username,
    }
  });
});

// Debug route to check session status (temporary for debugging)
router.get('/session-debug', (req, res) => {
  res.json({
    sessionID: req.sessionID,
    hasSession: !!req.session,
    hasUser: !!req.session?.user,
    sessionUser: req.session?.user ? {
      id: req.session.user.id,
      email: req.session.user.email
    } : null,
    cookies: req.headers.cookie ? 'present' : 'missing',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
