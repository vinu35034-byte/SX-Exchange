const express = require('express');
const router = express.Router();
const StakingController = require('../controllers/stakingController');
const requireUserAuth = require('../middlewares/requireUserAuth');

// Apply authentication middleware to all routes
router.use(requireUserAuth);

// Get all available staking pools
router.get('/pools', StakingController.getStakingPools);

// Get specific staking pool details
router.get('/pools/:poolId', StakingController.getStakingPool);

// Get user's staking positions
router.get('/positions', StakingController.getUserStakingPositions);

// Create new staking position
router.post('/stake', StakingController.createStakingPosition);

// Unstake position
router.post('/unstake/:positionId', StakingController.unstakePosition);

// Claim pending rewards
router.post('/claim/:positionId', StakingController.claimRewards);

// Get staking statistics
router.get('/stats', StakingController.getStakingStats);

// Get reward history
router.get('/rewards', StakingController.getRewardHistory);

module.exports = router;
