const express = require('express');
const requireUserAuth = require('../middlewares/requireUserAuth');
const requireAdminAuth = require('../middlewares/requireAdminAuth');
const vipController = require('../controllers/vipController');

const router = express.Router();

// User routes
router.get('/dashboard', requireUserAuth, vipController.getVIPDashboard);
router.post('/daily-reward', requireUserAuth, vipController.createDailyReward);
router.post('/claim/:rewardId', requireUserAuth, vipController.claimReward);
router.get('/reward-history', requireUserAuth, vipController.getRewardHistory);
router.get('/levels', vipController.getVIPLevels); // Public endpoint
router.post('/update-level', requireUserAuth, vipController.updateVIPLevel);

// Admin routes
router.get('/admin/levels', requireAdminAuth, vipController.getAllVIPLevels);
router.post('/admin/levels', requireAdminAuth, vipController.createOrUpdateVIPLevel);
router.put('/admin/levels/:level', requireAdminAuth, vipController.createOrUpdateVIPLevel);
router.delete('/admin/levels/:level', requireAdminAuth, vipController.deleteVIPLevel);
router.get('/admin/statistics', requireAdminAuth, vipController.getVIPStatistics);
router.get('/admin/rewards', requireAdminAuth, vipController.getAllRewards);
router.post('/admin/set-user-level', requireAdminAuth, vipController.setUserVIPLevel);
router.post('/admin/create-daily-rewards', requireAdminAuth, vipController.createAllDailyRewards);
router.post('/admin/expire-rewards', requireAdminAuth, vipController.expireOldRewards);

module.exports = router;
