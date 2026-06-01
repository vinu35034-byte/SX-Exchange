const express = require('express');
const router = express.Router();
const AdminStakingController = require('../controllers/adminStakingController');
const requireAdminAuth = require('../middlewares/requireAdminAuth');

// Apply admin authentication middleware to all routes
router.use(requireAdminAuth);

// Pool Management
router.get('/pools', AdminStakingController.getAllStakingPools);
router.post('/pools', AdminStakingController.createStakingPool);
router.put('/pools/:poolId', AdminStakingController.updateStakingPool);
router.delete('/pools/:poolId', AdminStakingController.deleteStakingPool);

// Position Management
router.get('/positions', AdminStakingController.getAllStakingPositions);
router.post('/positions/:positionId/force-unstake', AdminStakingController.forceUnstakePosition);

// Reward Management
router.post('/rewards/process', AdminStakingController.processAllRewards);
router.get('/rewards/history', AdminStakingController.getRewardHistory);

// Analytics
router.get('/analytics', AdminStakingController.getStakingAnalytics);

module.exports = router;
