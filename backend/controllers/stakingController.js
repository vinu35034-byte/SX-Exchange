const StakingPool = require('../models/stakingPool');
const StakingPosition = require('../models/stakingPosition');
const StakingReward = require('../models/stakingReward');
const User = require('../models/user');
const Transaction = require('../models/transaction');
const { createUserTransaction } = require('../utils/transactionUtils');

class StakingController {
  // Get all available staking pools
  static async getStakingPools(req, res) {
    try {
      const pools = await StakingPool.find({
        isActive: true,
        isPublic: true,
        $or: [
          { startDate: { $lte: new Date() } },
          { startDate: null }
        ],
        $or: [
          { endDate: { $gte: new Date() } },
          { endDate: null }
        ]
      }).sort({ apy: -1 });

      res.json({
        success: true,
        data: pools
      });
    } catch (error) {
      console.error('Error fetching staking pools:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch staking pools',
        error: error.message
      });
    }
  }

  // Get specific staking pool details
  static async getStakingPool(req, res) {
    try {
      const { poolId } = req.params;
      
      const pool = await StakingPool.findById(poolId);
      if (!pool) {
        return res.status(404).json({
          success: false,
          message: 'Staking pool not found'
        });
      }

      // Get pool statistics
      const stats = await StakingPosition.aggregate([
        { $match: { poolId: pool._id, status: 'active' } },
        {
          $group: {
            _id: null,
            totalStaked: { $sum: '$amount' },
            activePositions: { $sum: 1 },
            avgStakeAmount: { $avg: '$amount' }
          }
        }
      ]);

      const poolData = {
        ...pool.toObject(),
        statistics: stats[0] || {
          totalStaked: 0,
          activePositions: 0,
          avgStakeAmount: 0
        }
      };

      res.json({
        success: true,
        data: poolData
      });
    } catch (error) {
      console.error('Error fetching staking pool:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch staking pool',
        error: error.message
      });
    }
  }

  // Get user's staking positions
  static async getUserStakingPositions(req, res) {
    try {
      const userId = req.user._id || req.user.id;
      
      const positions = await StakingPosition.find({ userId })
        .populate('poolId')
        .sort({ createdAt: -1 });

      // Add poolName to each position for frontend compatibility
      const positionsWithPoolName = positions.map(position => {
        const positionObj = position.toObject();
        positionObj.poolName = position.poolId?.name || 'Unknown Pool';
        return positionObj;
      });

      // Calculate summary statistics
      const summary = {
        totalStaked: 0,
        totalRewards: 0,
        activePositions: 0,
        totalPositions: positions.length
      };

      positions.forEach(position => {
        if (position.status === 'active') {
          summary.totalStaked += position.amount;
          summary.totalRewards += position.totalRewardsEarned - position.totalRewardsClaimed + position.pendingRewards;
          summary.activePositions++;
        }
      });

      res.json({
        success: true,
        data: {
          positions: positionsWithPoolName,
          summary
        }
      });
    } catch (error) {
      console.error('Error fetching user staking positions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch staking positions',
        error: error.message
      });
    }
  }

  // Create new staking position
  static async createStakingPosition(req, res) {
    try {
      const userId = req.user._id || req.user.id;
      const { poolId, amount } = req.body;

      // Validate input
      if (!poolId || !amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid pool ID or amount'
        });
      }

      // Get staking pool
      const pool = await StakingPool.findById(poolId);
      if (!pool) {
        return res.status(404).json({
          success: false,
          message: 'Staking pool not found'
        });
      }

      // Get user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if user can stake
      const canStake = pool.canUserStake(user, amount);
      if (!canStake.canStake) {
        return res.status(400).json({
          success: false,
          message: canStake.reason
        });
      }

      // Check user balance
      const userBalance = user.balances?.get(pool.symbol) || 0;
      if (userBalance < amount) {
        return res.status(400).json({
          success: false,
          message: `Insufficient ${pool.symbol} balance`
        });
      }

      try {
        // Deduct from user balance ATOMICALLY (prevent double-spend race condition)
        const atomicResult = await User.findOneAndUpdate(
          { _id: userId, [`balances.${pool.symbol}`]: { $gte: amount } },
          { $inc: { [`balances.${pool.symbol}`]: -amount } },
          { new: true }
        );
        if (!atomicResult) {
          return res.status(400).json({
            success: false,
            message: `Insufficient ${pool.symbol} balance (concurrent modification). Please try again.`
          });
        }

        // Create staking position
        const stakedAt = new Date();
        const lockPeriodDays = pool.lockPeriod || 0; // Default to 0 if undefined
        const canUnstakeAt = new Date(stakedAt.getTime() + (lockPeriodDays * 24 * 60 * 60 * 1000)); // lockPeriod in days
        
        const position = new StakingPosition({
          userId,
          poolId,
          amount,
          symbol: pool.symbol,
          lockedApy: pool.apy || 0,
          lockPeriod: lockPeriodDays,
          earlyUnstakePenalty: pool.earlyUnstakePenalty || 0,
          stakedAt,
          canUnstakeAt
        });
        await position.save();

        // Update pool statistics
        pool.currentTotalStaked += amount;
        pool.totalParticipants = await StakingPosition.countDocuments({
          poolId: pool._id,
          status: 'active'
        });
        await pool.save();

        // TODO: Create transaction record (commented out due to UserTransaction model incompatibility)
        // const transactionData = {
        //   userId,
        //   type: 'stake',
        //   amount,
        //   symbol: pool.symbol,
        //   status: 'completed',
        //   metadata: {
        //     poolId: pool._id,
        //     positionId: position._id,
        //     apy: pool.apy,
        //     lockPeriod: pool.lockPeriod
        //   }
        // };
        // 
        // const transaction = await createUserTransaction(transactionData);
        // position.stakeTransactionId = transaction._id;
        // await position.save();

        // Fetch the created position with pool data
        const createdPosition = await StakingPosition.findById(position._id).populate('poolId');

        res.status(201).json({
          success: true,
          message: 'Staking position created successfully',
          data: createdPosition
        });

      } catch (saveError) {
        console.error('Error saving staking data:', saveError);
        res.status(500).json({
          success: false,
          message: 'Failed to create staking position',
          error: saveError.message
        });
      }

    } catch (error) {
      console.error('Error creating staking position:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create staking position',
        error: error.message
      });
    }
  }

  // Unstake position
  static async unstakePosition(req, res) {
    try {
      const userId = req.user._id || req.user.id;
      const { positionId } = req.params;
      const { forceUnstake = false } = req.body;

      // Get staking position
      const position = await StakingPosition.findOne({
        _id: positionId,
        userId,
        status: 'active'
      }).populate('poolId');

      if (!position) {
        return res.status(404).json({
          success: false,
          message: 'Active staking position not found'
        });
      }

      // Check if early unstaking
      const now = new Date();
      const isEarlyUnstake = now < position.canUnstakeAt;
      
      if (isEarlyUnstake && !forceUnstake) {
        return res.status(400).json({
          success: false,
          message: 'Position is still in lock period. Set forceUnstake to true to proceed with penalty.',
          data: {
            canUnstakeAt: position.canUnstakeAt,
            daysRemaining: position.daysRemainingInLock,
            earlyUnstakePenalty: position.earlyUnstakePenalty
          }
        });
      }

      // Get user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      try {
        // Calculate final rewards and unstake
        const unstakeResult = position.unstake(isEarlyUnstake);
        await position.save();

        // Return tokens to user balance ATOMICALLY (prevent lost-update race condition)
        await User.updateOne(
          { _id: userId },
          { $inc: { [`balances.${position.symbol}`]: unstakeResult.netAmount } }
        );

        // Update pool statistics
        position.poolId.currentTotalStaked -= position.amount;
        position.poolId.totalParticipants = await StakingPosition.countDocuments({
          poolId: position.poolId._id,
          status: 'active'
        });
        await position.poolId.save();

        // Create transaction record
        const transactionData = {
          userId,
          type: 'unstake',
          amount: unstakeResult.netAmount,
          symbol: position.symbol,
          status: 'completed',
          metadata: {
            poolId: position.poolId._id,
            positionId: position._id,
            originalAmount: position.amount,
            rewards: unstakeResult.rewards,
            penalty: unstakeResult.penalty,
            isEarlyUnstake
          }
        };
        
        // TODO: Create transaction record (commented out due to UserTransaction model incompatibility)
        // const transaction = await createUserTransaction(transactionData);
        // position.unstakeTransactionId = transaction._id;
        // await position.save();

        res.json({
          success: true,
          message: isEarlyUnstake ? 'Position unstaked with penalty' : 'Position unstaked successfully',
          data: {
            position,
            unstakeResult,
            isEarlyUnstake
          }
        });

      } catch (saveError) {
        console.error('Error saving unstake data:', saveError);
        res.status(500).json({
          success: false,
          message: 'Failed to unstake position',
          error: saveError.message
        });
      }

    } catch (error) {
      console.error('Error unstaking position:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to unstake position',
        error: error.message
      });
    }
  }

  // Claim pending rewards
  static async claimRewards(req, res) {
    try {
      const userId = req.user._id || req.user.id;
      const { positionId } = req.params;

      // Get staking position
      const position = await StakingPosition.findOne({
        _id: positionId,
        userId,
        status: 'active'
      }).populate('poolId');

      if (!position) {
        return res.status(404).json({
          success: false,
          message: 'Active staking position not found'
        });
      }

      // Calculate pending rewards
      const pendingRewards = position.pendingRewards;
      
      if (pendingRewards <= 0) {
        return res.status(400).json({
          success: false,
          message: 'No pending rewards to claim'
        });
      }

      // Get user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      try {
        // Update position rewards
        position.calculateRewards();
        position.totalRewardsClaimed += pendingRewards;
        await position.save();

        // Add rewards to user balance ATOMICALLY (prevent lost-update race condition)
        const rewardToken = position.poolId.rewardToken;
        await User.updateOne(
          { _id: userId },
          { $inc: { [`balances.${rewardToken}`]: pendingRewards } }
        );

        // Create reward record
        const rewardRecord = new StakingReward({
          positionId: position._id,
          userId,
          poolId: position.poolId._id,
          amount: pendingRewards,
          rewardToken,
          calculatedForDate: new Date(),
          periodStart: position.lastRewardCalculatedAt,
          periodEnd: new Date(),
          rewardType: 'daily', // Using 'daily' instead of 'manual' as it's a valid enum value
          status: 'credited',
          creditedAt: new Date(),
          stakedAmount: position.amount,
          apyUsed: position.lockedApy,
          daysInPeriod: (new Date() - position.lastRewardCalculatedAt) / (1000 * 60 * 60 * 24)
        });
        await rewardRecord.save();

        // Create transaction record
        const transactionData = {
          userId,
          type: 'staking_reward',
          amount: pendingRewards,
          symbol: rewardToken,
          status: 'completed',
          metadata: {
            poolId: position.poolId._id,
            positionId: position._id,
            rewardId: rewardRecord._id
          }
        };
        
        // TODO: Create transaction record (commented out due to UserTransaction model incompatibility)
        // const transaction = await createUserTransaction(transactionData);
        // rewardRecord.transactionId = transaction._id;
        // await rewardRecord.save();

        res.json({
          success: true,
          message: 'Rewards claimed successfully',
          data: {
            claimedAmount: pendingRewards,
            rewardToken: position.poolId.rewardToken,
            position
          }
        });

      } catch (saveError) {
        console.error('Error saving reward data:', saveError);
        res.status(500).json({
          success: false,
          message: 'Failed to claim rewards',
          error: saveError.message
        });
      }

    } catch (error) {
      console.error('Error claiming rewards:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to claim rewards',
        error: error.message
      });
    }
  }

  // Get staking statistics
  static async getStakingStats(req, res) {
    try {
      const userId = req.user._id || req.user.id;

      // Get user's staking summary
      const userStats = await StakingPosition.aggregate([
        { $match: { userId: userId } },
        {
          $group: {
            _id: '$status',
            totalAmount: { $sum: '$amount' },
            totalRewards: { $sum: { $subtract: ['$totalRewardsEarned', '$totalRewardsClaimed'] } },
            count: { $sum: 1 }
          }
        }
      ]);

      // Get platform statistics
      const platformStats = await StakingPool.aggregate([
        {
          $group: {
            _id: null,
            totalPools: { $sum: 1 },
            activePools: {
              $sum: {
                $cond: [{ $eq: ['$isActive', true] }, 1, 0]
              }
            },
            totalValueLocked: { $sum: '$currentTotalStaked' },
            totalParticipants: { $sum: '$totalParticipants' }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          userStats,
          platformStats: platformStats[0] || {
            totalPools: 0,
            activePools: 0,
            totalValueLocked: 0,
            totalParticipants: 0
          }
        }
      });

    } catch (error) {
      console.error('Error fetching staking stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch staking statistics',
        error: error.message
      });
    }
  }

  // Get reward history
  static async getRewardHistory(req, res) {
    try {
      const userId = req.user._id || req.user.id;
      const { page = 1, limit = 20 } = req.query;

      const rewards = await StakingReward.find({ userId })
        .populate('poolId', 'name symbol')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await StakingReward.countDocuments({ userId });

      res.json({
        success: true,
        data: {
          rewards,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalRewards: total,
            hasNextPage: page * limit < total,
            hasPrevPage: page > 1
          }
        }
      });

    } catch (error) {
      console.error('Error fetching reward history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch reward history',
        error: error.message
      });
    }
  }
}

module.exports = StakingController;
