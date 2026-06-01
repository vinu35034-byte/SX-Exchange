const express = require('express');
const requireUserAuth = require('../middlewares/requireUserAuth');
const requireAdminAuth = require('../middlewares/requireAdminAuth');
const referralController = require('../controllers/referralController');

const router = express.Router();

// User routes
router.get('/dashboard', requireUserAuth, referralController.getReferralDashboard);
router.get('/stats', requireUserAuth, referralController.getReferralStats);
router.get('/history', requireUserAuth, referralController.getReferralHistory);
router.get('/rewards', requireUserAuth, referralController.getReferralRewards);
router.get('/settings', referralController.getReferralSettings); // Public settings
router.post('/generate-code', requireUserAuth, referralController.generateReferralCode);
router.post('/validate-code', referralController.validateReferralCode);

// Trading bonus routes
router.get('/trading-bonus/stats', requireUserAuth, referralController.getTradingBonusStats);
router.get('/trading-bonus/preview', requireUserAuth, referralController.previewTradingBonuses);

// Admin routes
router.get('/admin/all', requireAdminAuth, referralController.getAllReferrals);
router.get('/admin/stats', requireAdminAuth, referralController.getAdminReferralStats);
router.get('/admin/users-with-codes', requireAdminAuth, referralController.getAdminUsersWithCodes);
router.get('/admin/transactions', requireAdminAuth, referralController.getAdminReferralTransactions);
router.post('/admin/set-custom-code', requireAdminAuth, referralController.setCustomReferralCode);
router.post('/admin/remove-code', requireAdminAuth, referralController.removeReferralCode);

// Admin settings routes
router.get('/admin/settings', requireAdminAuth, referralController.getAdminReferralSettings);
router.put('/admin/settings', requireAdminAuth, referralController.updateReferralSettings);
router.get('/admin/trading-bonus/stats', requireAdminAuth, referralController.getAdminTradingBonusStats);
router.post('/admin/rebuild-chains', requireAdminAuth, referralController.rebuildReferralChains);

// Admin multilevel verification routes
router.get('/admin/verify-multilevel/:userId', requireAdminAuth, referralController.verifyMultilevelCounts);
router.post('/admin/refresh-multilevel-counts', requireAdminAuth, referralController.refreshAllMultilevelCounts);

module.exports = router;
