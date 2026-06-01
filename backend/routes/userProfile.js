const express = require('express');
const requireUserAuth = require('../middlewares/requireUserAuth');
const {
  getUserProfile,
  updateUserSettings,
  changePassword,
  changeEmail,
  sendPasswordReset,
  getUserTransactions,
  getWithdrawalPasswordStatus,
  sendWithdrawalPasswordOTP,
  createWithdrawalPassword,
  verifyWithdrawalPassword,
  sendWithdrawalPasswordChangeOTP,
  changeWithdrawalPassword
} = require('../controllers/userProfileController');

const router = express.Router();

// Test route for debugging
router.get('/test', (req, res) => {
  res.json({ message: 'User profile routes are working', timestamp: new Date() });
});

// Test route for special tokens (no auth needed)
router.get('/test-tokens', async (req, res) => {
  try {
    const SpecialToken = require('../models/specialToken');
    const tokens = await SpecialToken.find({});
    res.json({ 
      message: 'Special tokens test', 
      count: tokens.length,
      tokens: tokens.map(t => ({
        symbol: t.symbol,
        name: t.name,
        logoUrl: t.logoUrl,
        currentPrice: t.currentPrice
      }))
    });
  } catch (error) {
    console.error('Error fetching special tokens:', error);
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
});

// Get user profile data
router.get('/profile', requireUserAuth, getUserProfile);

// Get user transactions
router.get('/transactions', requireUserAuth, getUserTransactions);

// Update user settings
router.put('/settings', requireUserAuth, updateUserSettings);

// Change password
router.put('/change-password', requireUserAuth, changePassword);

// Update email
router.put('/change-email', requireUserAuth, changeEmail);

// Send password reset email
router.post('/password-reset', requireUserAuth, sendPasswordReset);

// Withdrawal password routes
router.get('/withdrawal-password/status', requireUserAuth, getWithdrawalPasswordStatus);
router.post('/withdrawal-password/send-otp', requireUserAuth, sendWithdrawalPasswordOTP);
router.post('/withdrawal-password/create', requireUserAuth, createWithdrawalPassword);
router.post('/withdrawal-password/verify', requireUserAuth, verifyWithdrawalPassword);
router.post('/withdrawal-password/send-change-otp', requireUserAuth, sendWithdrawalPasswordChangeOTP);
router.post('/withdrawal-password/change', requireUserAuth, changeWithdrawalPassword);

module.exports = router;
