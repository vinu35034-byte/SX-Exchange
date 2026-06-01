const StakingPool = require('../models/stakingPool');
const StakingPosition = require('../models/stakingPosition');
const StakingReward = require('../models/stakingReward');
const User = require('../models/user');
const { createUserTransaction } = require('../utils/transactionUtils');
const { createLogger } = require('../utils/logger');

const stakingLogger = createLogger('staking-service');

class StakingService {
  constructor() {
    this.isProcessing = false;
    this.rewardCalculationInterval = null;
  }

  /**
   * Initialize the staking service with automated reward calculation
   */
  initialize() {
    stakingLogger.info('Initializing staking service...');
    
    // Start automated reward calculation every hour
    this.startRewardCalculation();
    
    stakingLogger.info('✅ Staking service initialized successfully');
  }

  /**
   * Start automated reward calculation
   */
  startRewardCalculation() {
    // Run every hour (3600000 ms)
    this.rewardCalculationInterval = setInterval(async () => {
      await this.calculateAndDistributeRewards();
    }, 60 * 60 * 1000);

    // Also run immediately on startup after 30 seconds
    setTimeout(async () => {
      await this.calculateAndDistributeRewards();
    }, 30000);

    stakingLogger.info('✅ Automated reward calculation started');
  }

  /**
   * Stop automated reward calculation
   */
  stopRewardCalculation() {
    if (this.rewardCalculationInterval) {
      clearInterval(this.rewardCalculationInterval);
      this.rewardCalculationInterval = null;
      stakingLogger.info('Automated reward calculation stopped');
    }
  }

  /**
   * Calculate and distribute rewards for all eligible positions
   */
  async calculateAndDistributeRewards() {
    if (this.isProcessing) {
      stakingLogger.warn('Reward calculation already in progress, skipping...');
      return;
    }

    try {
      this.isProcessing = true;
      stakingLogger.info('Starting reward calculation and distribution...');

      // Get all active positions that need reward calculation
      const positions = await StakingPosition.find({
        status: 'active',
        lastRewardCalculatedAt: {
          $lt: new Date(Date.now() - 23 * 60 * 60 * 1000) // At least 23 hours ago
        }
      }).populate('poolId').populate('userId');

      let processedCount = 0;
      let totalRewardsDistributed = 0;
      const errors = [];

      for (const position of positions) {
        try {
          const result = await this.calculatePositionRewards(position);
          if (result.success && result.rewardAmount > 0) {
            processedCount++;
            totalRewardsDistributed += result.rewardAmount;
          }
        } catch (error) {
          errors.push({
            positionId: position._id,
            userId: position.userId?._id,
            error: error.message
          });
          stakingLogger.error('Error calculating rewards for position', {
            positionId: position._id,
            error: error.message
          });
        }
      }

      stakingLogger.info('Reward calculation completed', {
        totalPositions: positions.length,
        processedCount,
        totalRewardsDistributed,
        errorCount: errors.length
      });

      return {
        success: true,
        totalPositions: positions.length,
        processedCount,
        totalRewardsDistributed,
        errors
      };

    } catch (error) {
      stakingLogger.error('Error in reward calculation process', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Calculate rewards for a specific position
   * @param {Object} position - Staking position
   * @returns {Object} - Calculation result
   */
  async calculatePositionRewards(position) {
    const session = await StakingPosition.startSession();
    
    try {
      return await session.withTransaction(async () => {
        // Check if position is still active
        if (position.status !== 'active') {
          return { success: false, reason: 'Position not active' };
        }

        // Calculate pending rewards
        const now = new Date();
        const lastCalculated = position.lastRewardCalculatedAt || position.stakedAt;
        const timeDiff = now - lastCalculated;
        const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

        // Only calculate if at least 1 day has passed
        if (daysDiff < 1) {
          return { success: false, reason: 'Less than 1 day since last calculation' };
        }

        // Calculate daily reward
        const annualReward = (position.amount * position.lockedApy) / 100;
        const dailyReward = annualReward / 365;
        const totalReward = dailyReward * Math.floor(daysDiff);

        if (totalReward <= 0) {
          return { success: false, reason: 'No rewards to distribute' };
        }

        // Get user
        const user = await User.findById(position.userId).session(session);
        if (!user) {
          throw new Error('User not found');
        }

        // Add rewards to user balance
        const rewardToken = position.poolId.rewardToken;
        const currentBalance = user.balances?.get(rewardToken) || 0;
        user.balances.set(rewardToken, currentBalance + totalReward);
        await user.save({ session });

        // Update position
        position.totalRewardsEarned += totalReward;
        position.lastRewardCalculatedAt = now;
        await position.save({ session });

        // Create reward record
        const rewardRecord = new StakingReward({
          positionId: position._id,
          userId: position.userId,
          poolId: position.poolId._id,
          amount: totalReward,
          rewardToken,
          calculatedForDate: now,
          periodStart: lastCalculated,
          periodEnd: now,
          rewardType: 'daily',
          status: 'credited',
          creditedAt: now,
          stakedAmount: position.amount,
          apyUsed: position.lockedApy,
          daysInPeriod: Math.floor(daysDiff),
          calculatedBy: 'system'
        });
        await rewardRecord.save({ session });

        // Create transaction record
        const transactionData = {
          userId: position.userId,
          type: 'staking_reward',
          amount: totalReward,
          symbol: rewardToken,
          status: 'completed',
          metadata: {
            poolId: position.poolId._id,
            positionId: position._id,
            rewardId: rewardRecord._id,
            daysCalculated: Math.floor(daysDiff),
            apy: position.lockedApy
          }
        };
        
        const transaction = await createUserTransaction(transactionData, session);
        rewardRecord.transactionId = transaction._id;
        await rewardRecord.save({ session });

        // Update pool statistics
        if (position.poolId) {
          position.poolId.totalRewardsPaid += totalReward;
          await position.poolId.save({ session });
        }

        stakingLogger.info('Rewards calculated and distributed', {
          positionId: position._id,
          userId: position.userId,
          rewardAmount: totalReward,
          rewardToken,
          daysCalculated: Math.floor(daysDiff)
        });

        return {
          success: true,
          rewardAmount: totalReward,
          rewardToken,
          daysCalculated: Math.floor(daysDiff),
          transactionId: transaction._id
        };
      });

    } catch (error) {
      stakingLogger.error('Error calculating position rewards', {
        positionId: position._id,
        error: error.message
      });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Get staking statistics
   * @returns {Object} - Staking statistics
   */
  async getStakingStatistics() {
    try {
      // Get pool statistics
      const poolStats = await StakingPool.aggregate([
        {
          $group: {
            _id: null,
            totalPools: { $sum: 1 },
            activePools: {
              $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
            },
            totalValueLocked: { $sum: '$currentTotalStaked' },
            totalParticipants: { $sum: '$totalParticipants' },
            avgApy: { $avg: '$apy' },
            totalRewardsPaid: { $sum: '$totalRewardsPaid' }
          }
        }
      ]);

      // Get position statistics
      const positionStats = await StakingPosition.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalRewards: { $sum: '$totalRewardsEarned' }
          }
        }
      ]);

      // Get recent activity (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentActivity = await StakingPosition.aggregate([
        {
          $match: {
            createdAt: { $gte: sevenDaysAgo }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
            },
            newStakes: { $sum: 1 },
            totalStaked: { $sum: '$amount' }
          }
        },
        { $sort: { '_id.date': 1 } }
      ]);

      return {
        pools: poolStats[0] || {},
        positions: positionStats,
        recentActivity,
        lastUpdated: new Date()
      };

    } catch (error) {
      stakingLogger.error('Error getting staking statistics', { error: error.message });
      throw error;
    }
  }

  /**
   * Process pending rewards for a specific pool
   * @param {string} poolId - Pool ID (optional)
   * @returns {Object} - Processing result
   */
  async processPoolRewards(poolId = null) {
    try {
      let filter = { status: 'active' };
      if (poolId) {
        filter.poolId = poolId;
      }

      const positions = await StakingPosition.find(filter)
        .populate('poolId')
        .populate('userId');

      let processedCount = 0;
      let totalRewardsDistributed = 0;
      const errors = [];

      for (const position of positions) {
        try {
          const result = await this.calculatePositionRewards(position);
          if (result.success && result.rewardAmount > 0) {
            processedCount++;
            totalRewardsDistributed += result.rewardAmount;
          }
        } catch (error) {
          errors.push({
            positionId: position._id,
            error: error.message
          });
        }
      }

      return {
        success: true,
        processedPositions: processedCount,
        totalRewardsDistributed,
        errors
      };

    } catch (error) {
      stakingLogger.error('Error processing pool rewards', { poolId, error: error.message });
      throw error;
    }
  }

  /**
   * Validate staking pool configuration
   * @param {Object} poolData - Pool configuration
   * @returns {Object} - Validation result
   */
  validatePoolConfiguration(poolData) {
    const errors = [];

    if (!poolData.name || poolData.name.trim().length === 0) {
      errors.push('Pool name is required');
    }

    if (!poolData.symbol || poolData.symbol.trim().length === 0) {
      errors.push('Pool symbol is required');
    }

    if (poolData.apy === undefined || poolData.apy < 0 || poolData.apy > 1000) {
      errors.push('APY must be between 0 and 1000');
    }

    if (poolData.minimumStake === undefined || poolData.minimumStake < 0) {
      errors.push('Minimum stake must be 0 or greater');
    }

    if (poolData.lockPeriod === undefined || poolData.lockPeriod < 0) {
      errors.push('Lock period must be 0 or greater');
    }

    if (poolData.maximumStake !== null && poolData.maximumStake < poolData.minimumStake) {
      errors.push('Maximum stake must be greater than minimum stake');
    }

    if (poolData.earlyUnstakePenalty !== undefined && 
        (poolData.earlyUnstakePenalty < 0 || poolData.earlyUnstakePenalty > 100)) {
      errors.push('Early unstake penalty must be between 0 and 100');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
const stakingService = new StakingService();
module.exports = stakingService;
