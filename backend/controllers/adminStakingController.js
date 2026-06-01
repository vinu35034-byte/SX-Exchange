const StakingPool = require('../models/stakingPool');
const StakingPosition = require('../models/stakingPosition');
const StakingReward = require('../models/stakingReward');
const User = require('../models/user');
const { createUserTransaction } = require('../utils/transactionUtils');
const { escapeRegex } = require('../middlewares/securityMiddleware');

class AdminStakingController {
  // Get all staking pools with statistics
  static async getAllStakingPools(req, res) {
    try {
      const { page = 1, limit = 20, search, status } = req.query;
      
      let filter = {};
      if (search) {
        const safeSearch = escapeRegex(search);
        filter.$or = [
          { name: { $regex: safeSearch, $options: 'i' } },
          { symbol: { $regex: safeSearch, $options: 'i' } }
        ];
      }
      if (status) {
        filter.isActive = status === 'active';
      }

      const pools = await StakingPool.find(filter)
        .populate('createdBy', 'username email')
        .populate('lastModifiedBy', 'username email')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await StakingPool.countDocuments(filter);

      // Get statistics for each pool
      const poolsWithStats = await Promise.all(pools.map(async (pool) => {
        const stats = await StakingPosition.aggregate([
          { $match: { poolId: pool._id } },
          {
            $group: {
              _id: '$status',
              totalAmount: { $sum: '$amount' },
              count: { $sum: 1 }
            }
          }
        ]);

        const rewardStats = await StakingReward.aggregate([
          { $match: { poolId: pool._id, status: 'credited' } },
          {
            $group: {
              _id: null,
              totalRewardsPaid: { $sum: '$amount' },
              totalPayments: { $sum: 1 }
            }
          }
        ]);

        return {
          ...pool.toObject(),
          statistics: {
            positions: stats,
            rewards: rewardStats[0] || { totalRewardsPaid: 0, totalPayments: 0 }
          }
        };
      }));

      res.json({
        success: true,
        data: {
          pools: poolsWithStats,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalPools: total,
            hasNextPage: page * limit < total,
            hasPrevPage: page > 1
          }
        }
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

  // Create new staking pool
  static async createStakingPool(req, res) {
    try {
      const adminId = req.admin._id;
      const {
        name,
        symbol,
        description,
        apy,
        minimumStake,
        maximumStake,
        lockPeriod,
        totalPoolLimit,
        rewardToken,
        rewardDistributionType,
        isVipOnly,
        requiredVipLevel,
        earlyUnstakePenalty,
        startDate,
        endDate,
        iconUrl
      } = req.body;

      // Validate required fields
      if (!name || !symbol || apy === undefined || minimumStake === undefined || lockPeriod === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: name, symbol, apy, minimumStake, lockPeriod'
        });
      }

      // Create new pool
      const pool = new StakingPool({
        name: name.trim(),
        symbol: symbol.toUpperCase().trim(),
        description: description?.trim(),
        apy: Number(apy),
        minimumStake: Number(minimumStake),
        maximumStake: maximumStake ? Number(maximumStake) : null,
        lockPeriod: Number(lockPeriod),
        totalPoolLimit: totalPoolLimit ? Number(totalPoolLimit) : null,
        rewardToken: rewardToken ? rewardToken.toUpperCase().trim() : symbol.toUpperCase().trim(),
        rewardDistributionType: rewardDistributionType || 'daily',
        isVipOnly: Boolean(isVipOnly),
        requiredVipLevel: requiredVipLevel ? Number(requiredVipLevel) : null,
        earlyUnstakePenalty: earlyUnstakePenalty ? Number(earlyUnstakePenalty) : 0,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        iconUrl: iconUrl?.trim(),
        createdBy: adminId,
        lastModifiedBy: adminId
      });

      await pool.save();

      const populatedPool = await StakingPool.findById(pool._id)
        .populate('createdBy', 'username email')
        .populate('lastModifiedBy', 'username email');

      res.status(201).json({
        success: true,
        message: 'Staking pool created successfully',
        data: populatedPool
      });

    } catch (error) {
      console.error('Error creating staking pool:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create staking pool',
        error: error.message
      });
    }
  }

  // Update staking pool
  static async updateStakingPool(req, res) {
    try {
      const adminId = req.admin._id;
      const { poolId } = req.params;
      const updateData = req.body;

      const pool = await StakingPool.findById(poolId);
      if (!pool) {
        return res.status(404).json({
          success: false,
          message: 'Staking pool not found'
        });
      }

      // Update allowed fields
      const allowedUpdates = [
        'name', 'description', 'apy', 'minimumStake', 'maximumStake',
        'totalPoolLimit', 'isActive', 'isPublic', 'isVipOnly',
        'requiredVipLevel', 'earlyUnstakePenalty', 'endDate', 'iconUrl'
      ];

      allowedUpdates.forEach(field => {
        if (updateData.hasOwnProperty(field)) {
          if (field === 'name' || field === 'description' || field === 'iconUrl') {
            pool[field] = updateData[field]?.trim();
          } else if (field === 'endDate') {
            pool[field] = updateData[field] ? new Date(updateData[field]) : null;
          } else {
            pool[field] = updateData[field];
          }
        }
      });

      pool.lastModifiedBy = adminId;
      await pool.save();

      const updatedPool = await StakingPool.findById(pool._id)
        .populate('createdBy', 'username email')
        .populate('lastModifiedBy', 'username email');

      res.json({
        success: true,
        message: 'Staking pool updated successfully',
        data: updatedPool
      });

    } catch (error) {
      console.error('Error updating staking pool:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update staking pool',
        error: error.message
      });
    }
  }

  // Delete staking pool
  static async deleteStakingPool(req, res) {
    try {
      const { poolId } = req.params;

      const pool = await StakingPool.findById(poolId);
      if (!pool) {
        return res.status(404).json({
          success: false,
          message: 'Staking pool not found'
        });
      }

      // Check if pool has active positions
      const activePositions = await StakingPosition.countDocuments({
        poolId: pool._id,
        status: 'active'
      });

      if (activePositions > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete pool with ${activePositions} active positions. Deactivate the pool instead.`
        });
      }

      await StakingPool.findByIdAndDelete(poolId);

      res.json({
        success: true,
        message: 'Staking pool deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting staking pool:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete staking pool',
        error: error.message
      });
    }
  }

  // Get all staking positions with filters
  static async getAllStakingPositions(req, res) {
    try {
      const { page = 1, limit = 20, poolId, userId, status, search } = req.query;
      
      let filter = {};
      if (poolId) filter.poolId = poolId;
      if (userId) filter.userId = userId;
      if (status) filter.status = status;

      const positions = await StakingPosition.find(filter)
        .populate('userId', 'email username')
        .populate('poolId', 'name symbol apy')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await StakingPosition.countDocuments(filter);

      res.json({
        success: true,
        data: {
          positions,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalPositions: total,
            hasNextPage: page * limit < total,
            hasPrevPage: page > 1
          }
        }
      });

    } catch (error) {
      console.error('Error fetching staking positions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch staking positions',
        error: error.message
      });
    }
  }

  // Force unstake a position (admin action)
  static async forceUnstakePosition(req, res) {
    try {
      const { positionId } = req.params;
      const { reason } = req.body;

      const position = await StakingPosition.findOne({
        _id: positionId,
        status: 'active'
      }).populate('poolId');

      if (!position) {
        return res.status(404).json({
          success: false,
          message: 'Active staking position not found'
        });
      }

      const user = await User.findById(position.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Start transaction
      const session = await StakingPosition.startSession();
      let unstakeResult;
      
      await session.withTransaction(async () => {
        // Force unstake (no penalty for admin action)
        unstakeResult = position.unstake(false);
        await position.save({ session });

        // Return tokens to user balance
        const currentBalance = user.balances?.get(position.symbol) || 0;
        user.balances.set(position.symbol, currentBalance + unstakeResult.netAmount);
        await user.save({ session });

        // Update pool statistics
        position.poolId.currentTotalStaked -= position.amount;
        position.poolId.totalParticipants = await StakingPosition.countDocuments({
          poolId: position.poolId._id,
          status: 'active'
        });
        await position.poolId.save({ session });

        // Create transaction record
        const transactionData = {
          userId: position.userId,
          type: 'admin_unstake',
          amount: unstakeResult.netAmount,
          symbol: position.symbol,
          status: 'completed',
          metadata: {
            poolId: position.poolId._id,
            positionId: position._id,
            originalAmount: position.amount,
            rewards: unstakeResult.rewards,
            reason: reason || 'Admin forced unstake',
            adminAction: true
          }
        };
        
        const transaction = await createUserTransaction(transactionData, session);
        position.unstakeTransactionId = transaction._id;
        await position.save({ session });
      });

      await session.endSession();

      res.json({
        success: true,
        message: 'Position unstaked by admin successfully',
        data: {
          position,
          unstakeResult,
          reason: reason || 'Admin forced unstake'
        }
      });

    } catch (error) {
      console.error('Error force unstaking position:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to force unstake position',
        error: error.message
      });
    }
  }

  // Calculate and process pending rewards for all positions
  static async processAllRewards(req, res) {
    try {
      const { poolId } = req.query;
      
      let filter = { status: 'active' };
      if (poolId) filter.poolId = poolId;

      const positions = await StakingPosition.find(filter).populate('poolId');
      
      let processedCount = 0;
      let totalRewards = 0;
      const errors = [];

      for (const position of positions) {
        try {
          const pendingRewards = position.calculateRewards();
          
          if (pendingRewards > 0) {
            // Update user balance
            const user = await User.findById(position.userId);
            if (user) {
              const rewardToken = position.poolId.rewardToken;
              const currentBalance = user.balances?.get(rewardToken) || 0;
              user.balances.set(rewardToken, currentBalance + pendingRewards);
              await user.save();

              // Create reward record
              const rewardRecord = new StakingReward({
                positionId: position._id,
                userId: position.userId,
                poolId: position.poolId._id,
                amount: pendingRewards,
                rewardToken,
                calculatedForDate: new Date(),
                periodStart: position.lastRewardCalculatedAt,
                periodEnd: new Date(),
                rewardType: 'daily',
                status: 'credited',
                creditedAt: new Date(),
                stakedAmount: position.amount,
                apyUsed: position.lockedApy,
                daysInPeriod: (new Date() - position.lastRewardCalculatedAt) / (1000 * 60 * 60 * 24),
                calculatedBy: 'admin'
              });
              await rewardRecord.save();

              await position.save();
              processedCount++;
              totalRewards += pendingRewards;
            }
          }
        } catch (error) {
          errors.push({
            positionId: position._id,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        message: 'Rewards processing completed',
        data: {
          processedPositions: processedCount,
          totalRewardsDistributed: totalRewards,
          errors: errors.length > 0 ? errors : undefined
        }
      });

    } catch (error) {
      console.error('Error processing rewards:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process rewards',
        error: error.message
      });
    }
  }

  // Get comprehensive staking analytics
  static async getStakingAnalytics(req, res) {
    try {
      const { period = '7d' } = req.query;
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case '1d':
          startDate.setDate(endDate.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 7);
      }

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
            avgApy: { $avg: '$apy' },
            totalParticipants: { $sum: '$totalParticipants' }
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
            avgAmount: { $avg: '$amount' }
          }
        }
      ]);

      // Get recent activity
      const recentActivity = await StakingPosition.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              type: 'stake'
            },
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        },
        { $sort: { '_id.date': 1 } }
      ]);

      // Get reward statistics
      const rewardStats = await StakingReward.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
            status: 'credited'
          }
        },
        {
          $group: {
            _id: null,
            totalRewards: { $sum: '$amount' },
            totalPayments: { $sum: 1 },
            avgReward: { $avg: '$amount' }
          }
        }
      ]);

      // Get top pools by TVL
      const topPools = await StakingPool.find({ isActive: true })
        .sort({ currentTotalStaked: -1 })
        .limit(10)
        .select('name symbol currentTotalStaked apy totalParticipants');

      res.json({
        success: true,
        data: {
          period,
          overview: poolStats[0] || {},
          positionsByStatus: positionStats,
          rewardSummary: rewardStats[0] || {},
          recentActivity,
          topPools,
          generatedAt: new Date()
        }
      });

    } catch (error) {
      console.error('Error fetching staking analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch staking analytics',
        error: error.message
      });
    }
  }

  // Get reward distribution history
  static async getRewardHistory(req, res) {
    try {
      const { page = 1, limit = 50, poolId, status, dateFrom, dateTo } = req.query;
      
      let filter = {};
      if (poolId) filter.poolId = poolId;
      if (status) filter.status = status;
      if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
        if (dateTo) filter.createdAt.$lte = new Date(dateTo);
      }

      const rewards = await StakingReward.find(filter)
        .populate('userId', 'email username')
        .populate('poolId', 'name symbol')
        .populate('positionId', 'amount')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await StakingReward.countDocuments(filter);

      const summary = await StakingReward.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$status',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          rewards,
          summary,
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

module.exports = AdminStakingController;
