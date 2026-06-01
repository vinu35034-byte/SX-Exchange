const User = require('../models/user');
const VIPLevel = require('../models/vipLevel');
const VIPReward = require('../models/vipReward');
const Referral = require('../models/referral');
const Transaction = require('../models/transaction');
const notificationService = require('../utils/notificationService');
const cacheService = require('../utils/cacheService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('vip-service');

class VIPService {
  static cacheConfig = {
    vipLevels: { ttl: 3600 }, // 1 hour for VIP levels
    userVipData: { ttl: 300 }, // 5 minutes for user VIP data
    vipStats: { ttl: 600 } // 10 minutes for VIP statistics
  };

  /**
   * Calculate multi-level referral counts for VIP qualification
   * Returns: { level1Count, level2Count, level3Count, totalCount }
   */
  static async calculateMultiLevelReferrals(userId) {
    try {
      const Referral = require('../models/referral');
      
      // Get Level 1 referrals (direct referrals)
      const level1Referrals = await Referral.find({
        referrer: userId,
        status: 'successful'
      }).select('referee');
      
      const level1Count = level1Referrals.length;
      const level1UserIds = level1Referrals.map(ref => ref.referee);
      
      // Get Level 2 referrals (referrals of level 1 users)
      const level2Referrals = await Referral.find({
        referrer: { $in: level1UserIds },
        status: 'successful'
      }).select('referee');
      
      const level2Count = level2Referrals.length;
      const level2UserIds = level2Referrals.map(ref => ref.referee);
      
      // Get Level 3 referrals (referrals of level 2 users)
      const level3Referrals = await Referral.find({
        referrer: { $in: level2UserIds },
        status: 'successful'
      }).select('referee');
      
      const level3Count = level3Referrals.length;
      const totalCount = level1Count + level2Count + level3Count;
      
      logger.info('Multi-level referral calculation completed', {
        userId: userId.toString(),
        level1Count,
        level2Count,
        level3Count,
        totalCount,
        timestamp: new Date().toISOString()
      });
      
      return {
        level1Count,
        level2Count,
        level3Count,
        totalCount
      };
    } catch (error) {
      logger.error('Error calculating multi-level referrals', {
        error: error.message,
        userId: userId.toString(),
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Calculate user's VIP level based on multi-level referrals
   */
  static async calculateUserVIPLevel(userId) {
    try {
      const cacheKey = `vip:user:${userId}`;
      
      // Try to get from cache first
      const cachedVipData = await cacheService.get(cacheKey);
      if (cachedVipData) {
        logger.debug('VIP level served from cache', {
          userId: userId.toString(),
          level: cachedVipData.level,
          timestamp: new Date().toISOString()
        });
        return cachedVipData.level;
      }

      logger.info('Calculating VIP level for user', {
        userId: userId.toString(),
        timestamp: new Date().toISOString()
      });

      const user = await User.findById(userId);
      if (!user) {
        logger.error('VIP level calculation failed - user not found', {
          userId: userId.toString(),
          timestamp: new Date().toISOString()
        });
        throw new Error('User not found');
      }

      // Calculate multi-level referral counts
      const referralCounts = await this.calculateMultiLevelReferrals(userId);

      logger.info('User referral stats for VIP calculation', {
        userId: userId.toString(),
        level1Referrals: referralCounts.level1Count,
        totalReferrals: referralCounts.totalCount,
        timestamp: new Date().toISOString()
      });

      // Get all active VIP levels, sorted by level
      const vipLevels = await VIPLevel.find({ isActive: true }).sort({ level: 1 });

      // Find the highest level the user qualifies for
      let qualifyingLevel = 0;
      
      for (const level of vipLevels) {
        const meetsLevel1Requirement = referralCounts.level1Count >= level.minimumLevel1Referrals;
        const meetsTotalRequirement = referralCounts.totalCount >= level.minimumTotalReferrals;
        
        if (meetsLevel1Requirement && meetsTotalRequirement) {
          qualifyingLevel = level.level;
        } else {
          break; // Since levels are sorted, we can break here
        }
      }

      const vipData = {
        level: qualifyingLevel,
        level1Referrals: referralCounts.level1Count,
        level2Referrals: referralCounts.level2Count,
        level3Referrals: referralCounts.level3Count,
        totalReferrals: referralCounts.totalCount,
        calculatedAt: new Date()
      };

      // Cache the result
      await cacheService.set(cacheKey, vipData, this.cacheConfig.userVipData);

      logger.info('VIP level calculation completed and cached', {
        userId: userId.toString(),
        qualifyingLevel,
        level1Referrals: referralCounts.level1Count,
        totalReferrals: referralCounts.totalCount,
        timestamp: new Date().toISOString()
      });

      return qualifyingLevel;
    } catch (error) {
      logger.error('Error calculating VIP level:', {
        error: error.message,
        userId: userId.toString(),
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Update user's VIP level and award upgrade reward if applicable
   */
  static async updateUserVIPLevel(userId) {
    try {
      logger.info('Updating VIP level for user', {
        userId: userId.toString(),
        timestamp: new Date().toISOString()
      });

      const user = await User.findById(userId);
      if (!user) {
        logger.error('VIP level update failed - user not found', {
          userId: userId.toString(),
          timestamp: new Date().toISOString()
        });
        throw new Error('User not found');
      }

      const currentVIPLevel = user.vipLevel || 0;
      const newVIPLevel = await this.calculateUserVIPLevel(userId);

      // If level has increased, update and award upgrade reward
      if (newVIPLevel > currentVIPLevel) {
        // Update user's VIP level
        await User.findByIdAndUpdate(userId, {
          vipLevel: newVIPLevel,
          vipUpgradedAt: new Date()
        });

        // Award upgrade reward for each level increase
        for (let level = currentVIPLevel + 1; level <= newVIPLevel; level++) {
          await this.awardUpgradeReward(userId, level, currentVIPLevel);
        }

        // Send notification
        await this.sendVIPUpgradeNotification(userId, currentVIPLevel, newVIPLevel);

        return {
          upgraded: true,
          oldLevel: currentVIPLevel,
          newLevel: newVIPLevel
        };
      }

      return {
        upgraded: false,
        currentLevel: currentVIPLevel
      };
    } catch (error) {
      console.error('Error updating VIP level:', error);
      throw error;
    }
  }

  /**
   * Award upgrade reward for VIP level increase
   */
  static async awardUpgradeReward(userId, newLevel, fromLevel) {
    try {
      const vipLevel = await VIPLevel.findOne({ level: newLevel, isActive: true });
      if (!vipLevel || vipLevel.oneTimeUpgradeReward <= 0) return;

      // Get user for balance update
      const user = await User.findById(userId);
      const currency = vipLevel.currency;
      const amount = vipLevel.oneTimeUpgradeReward;

      // Auto-claim upgrade reward immediately
      const currentBalance = user.balances.get(currency) || 0;
      const newBalance = currentBalance + amount;
      user.balances.set(currency, newBalance);

      // Generate unique transaction ID
      const date = new Date();
      const dateStr = date.getFullYear().toString() + 
                     (date.getMonth() + 1).toString().padStart(2, '0') + 
                     date.getDate().toString().padStart(2, '0');
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      const generatedTransactionId = `TXN-${dateStr}-${randomNum}`;

      // Create transaction record
      const transaction = new Transaction({
        user: userId,
        transactionId: generatedTransactionId,
        type: 'vip_reward',
        subType: 'vip_upgrade_reward',
        currency: currency,
        amount: amount,
        direction: 'credit',
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        status: 'completed',
        executedAt: new Date(),
        description: `VIP upgrade reward auto-claimed - Level ${newLevel}`,
        notes: `Upgrade from Level ${fromLevel} to Level ${newLevel}`
      });

      await transaction.save();

      // Create upgrade reward record (already claimed)
      const reward = new VIPReward({
        user: userId,
        vipLevel: newLevel,
        rewardType: 'upgrade',
        amount: vipLevel.oneTimeUpgradeReward,
        currency: vipLevel.currency,
        status: 'claimed', // Auto-claimed
        rewardDate: new Date(),
        claimedAt: new Date(),
        metadata: {
          upgradeFromLevel: fromLevel,
          autoAwarded: true,
          autoClaimed: true
        }
      });

      await reward.save();

      // Update user stats
      user.vipStats.totalUpgradeRewards += amount;
      await user.save();

      return reward;
    } catch (error) {
      console.error('Error awarding upgrade reward:', error);
      throw error;
    }
  }

  /**
   * Create daily reward for eligible users
   */
  static async createDailyReward(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      // Get VIP level details (allow level 0 if it has daily rewards)
      const userVipLevel = user.vipLevel || 0;
      const vipLevel = await VIPLevel.findOne({ level: userVipLevel, isActive: true });
      
      if (!vipLevel || vipLevel.dailyReward <= 0) {
        return { eligible: false, reason: 'No daily reward for this VIP level' };
      }

      // Check if reward already exists for this month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const existingReward = await VIPReward.findOne({
        user: userId,
        rewardType: 'daily',
        rewardDate: { $gte: startOfMonth, $lt: startOfNextMonth }
      });

      if (existingReward) {
        return {
          eligible: false,
          reason: 'Monthly reward already created for this month',
          reward: existingReward
        };
      }

      // Create monthly reward (rewardType stays 'daily' for DB compatibility)
      const reward = new VIPReward({
        user: userId,
        vipLevel: user.vipLevel,
        rewardType: 'daily',
        amount: vipLevel.dailyReward,
        currency: vipLevel.currency,
        status: 'pending',
        rewardDate: startOfMonth,
        // Monthly rewards expire at the end of the month
        expiresAt: startOfNextMonth,
        metadata: {
          referralCount: user.referralStats.totalReferrals,
          totalReferralDeposits: user.referralStats.totalReferralDeposits
        }
      });

      await reward.save();

      return {
        eligible: true,
        reward,
        message: 'Monthly reward created successfully'
      };
    } catch (error) {
      console.error('Error creating daily reward:', error);
      throw error;
    }
  }

  /**
   * Claim a reward (daily or upgrade)
   */
  static async claimReward(userId, rewardId) {
    try {
      const reward = await VIPReward.findOne({
        _id: rewardId,
        user: userId,
        status: 'pending'
      });

      if (!reward) {
        throw new Error('Reward not found or already claimed');
      }

      // Check if reward has expired
      if (reward.expiresAt && reward.expiresAt < new Date()) {
        await VIPReward.findByIdAndUpdate(rewardId, { status: 'expired' });
        throw new Error('Reward has expired');
      }

      // Award the reward to user's wallet
      const user = await User.findById(userId);
      const currency = reward.currency;
      const amount = reward.amount;

      // Update balance map directly (no wallets array used in this model)
      const currentBalance = user.balances.get(currency) || 0;
      const newBalance = currentBalance + amount;
      user.balances.set(currency, newBalance);

      // Create transaction record for the reward claim
      // Generate unique transaction ID
      const date = new Date();
      const dateStr = date.getFullYear().toString() + 
                     (date.getMonth() + 1).toString().padStart(2, '0') + 
                     date.getDate().toString().padStart(2, '0');
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      const generatedTransactionId = `TXN-${dateStr}-${randomNum}`;

      const transaction = new Transaction({
        user: userId,
        transactionId: generatedTransactionId,
        type: 'vip_reward',
        subType: reward.rewardType === 'daily' ? 'vip_daily_reward' : 'vip_upgrade_reward',
        currency: currency,
        amount: amount,
        direction: 'credit',
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        status: 'completed',
        executedAt: new Date(),
        description: `VIP ${reward.rewardType} reward claimed - Level ${reward.vipLevel}`,
        notes: `Reward ID: ${rewardId}, VIP Level: ${reward.vipLevel}`
      });

      await transaction.save();

      // Update VIP stats
      if (reward.rewardType === 'daily') {
        const lastClaim = user.vipStats.lastDailyRewardClaim;
        const now = new Date();
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        // Check if this is consecutive months
        let consecutiveDays = user.vipStats.consecutiveDaysClaimed || 0;
        if (lastClaim && lastClaim >= startOfLastMonth) {
          consecutiveDays += 1;
        } else {
          consecutiveDays = 1; // Reset streak
        }

        user.vipStats.lastDailyRewardClaim = now;
        user.vipStats.consecutiveDaysClaimed = consecutiveDays;
        user.vipStats.totalDailyRewardsClaimed += amount;
      }

      await user.save();

      // Mark reward as claimed
      reward.status = 'claimed';
      reward.claimedAt = new Date();
      await reward.save();

      // Send notification
      await this.sendRewardClaimedNotification(userId, reward);

      return {
        success: true,
        reward,
        newBalance: user.balances.get(currency),
        transaction: {
          id: transaction._id,
          transactionId: transaction.transactionId,
          amount: transaction.amount,
          currency: transaction.currency
        }
      };
    } catch (error) {
      console.error('Error claiming reward:', error);
      throw error;
    }
  }

  /**
   * Get user's VIP dashboard data
   */
  static async getVIPDashboard(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      const currentLevel = user.vipLevel || 0;
      const currentVIPLevel = await VIPLevel.findOne({ level: currentLevel, isActive: true });
      const nextVIPLevel = await VIPLevel.findOne({ 
        level: { $gt: currentLevel }, 
        isActive: true 
      }).sort({ level: 1 });

      // Get this month's reward
      const todaysReward = await VIPReward.getThisMonthsReward(userId);

      // Get unclaimed rewards
      const unclaimedRewards = await VIPReward.getUnclaimedRewards(userId);

      // Get current multi-level referral counts (live calculation)
      const referralCounts = await this.calculateMultiLevelReferrals(userId);

      // Calculate progress to next level using new multi-level system
      let progressToNext = null;
      if (nextVIPLevel) {
        const level1Progress = Math.min(100, (referralCounts.level1Count / nextVIPLevel.minimumLevel1Referrals) * 100);
        const totalProgress = Math.min(100, (referralCounts.totalCount / nextVIPLevel.minimumTotalReferrals) * 100);
        
        progressToNext = {
          level1Referrals: {
            current: referralCounts.level1Count,
            required: nextVIPLevel.minimumLevel1Referrals,
            remaining: Math.max(0, nextVIPLevel.minimumLevel1Referrals - referralCounts.level1Count),
            progress: level1Progress
          },
          totalReferrals: {
            current: referralCounts.totalCount,
            required: nextVIPLevel.minimumTotalReferrals,
            remaining: Math.max(0, nextVIPLevel.minimumTotalReferrals - referralCounts.totalCount),
            progress: totalProgress
          },
          breakdown: {
            level1: referralCounts.level1Count,
            level2: referralCounts.level2Count,
            level3: referralCounts.level3Count,
            total: referralCounts.totalCount
          },
          overall: Math.min(level1Progress, totalProgress)
        };
      }

      return {
        user: {
          vipLevel: currentLevel,
          vipStats: user.vipStats,
          referralStats: {
            ...user.referralStats,
            multiLevelStats: {
              level1Referrals: referralCounts.level1Count,
              level2Referrals: referralCounts.level2Count,
              level3Referrals: referralCounts.level3Count,
              totalMultiLevelReferrals: referralCounts.totalCount
            }
          }
        },
        currentLevelInfo: currentVIPLevel,
        nextLevelInfo: nextVIPLevel,
        progressToNext,
        todaysReward,
        unclaimedRewards: unclaimedRewards.length,
        unclaimedRewardsList: unclaimedRewards
      };
    } catch (error) {
      console.error('Error getting VIP dashboard:', error);
      throw error;
    }
  }

  /**
   * Update referral stats when new referral is added for VIP calculation
   */
  static async updateReferralStats(referrerId) {
    try {
      // Check if this triggers a VIP level upgrade
      const upgradeResult = await this.updateUserVIPLevel(referrerId);
      
      return upgradeResult;
    } catch (error) {
      console.error('Error updating referral stats:', error);
      throw error;
    }
  }

  /**
   * Send VIP upgrade notification
   */
  static async sendVIPUpgradeNotification(userId, oldLevel, newLevel) {
    try {
      const vipLevel = await VIPLevel.findOne({ level: newLevel, isActive: true });
      const referralCounts = await this.calculateMultiLevelReferrals(userId);
      
      await notificationService.createNotification({
        recipientType: 'user',
        recipientId: userId,
        type: 'vip_upgrade',
        title: `🏆 VIP Level ${newLevel} Unlocked!`,
        message: `Congratulations! You've been upgraded to ${vipLevel?.name || `VIP ${newLevel}`} with ${referralCounts.level1Count} direct referrals and ${referralCounts.totalCount} total referrals across your network! ${vipLevel?.oneTimeUpgradeReward > 0 ? `You've earned $${vipLevel.oneTimeUpgradeReward} USDT as an upgrade bonus!` : ''} Claim your monthly rewards of $${vipLevel?.dailyReward || 0} USDT every month.`,
        relatedData: {
          oldLevel,
          newLevel,
          dailyReward: vipLevel?.dailyReward || 0,
          upgradeReward: vipLevel?.oneTimeUpgradeReward || 0,
          referralBreakdown: {
            level1: referralCounts.level1Count,
            level2: referralCounts.level2Count,
            level3: referralCounts.level3Count,
            total: referralCounts.totalCount
          }
        }
      });
    } catch (error) {
      console.error('Error sending VIP upgrade notification:', error);
    }
  }

  /**
   * Send reward claimed notification
   */
  static async sendRewardClaimedNotification(userId, reward) {
    try {
      const typeText = reward.rewardType === 'daily' ? 'Daily' : 'Upgrade';
      
      await notificationService.createNotification({
        recipientType: 'user',
        recipientId: userId,
        type: 'reward_claimed',
        title: `💰 ${typeText} Reward Claimed!`,
        message: `You've successfully claimed your ${typeText.toLowerCase()} reward of $${reward.amount} ${reward.currency}.`,
        relatedData: {
          rewardId: reward._id,
          amount: reward.amount,
          currency: reward.currency,
          rewardType: reward.rewardType
        }
      });
    } catch (error) {
      console.error('Error sending reward claimed notification:', error);
    }
  }

  /**
   * Create daily rewards for all eligible users (cron job)
   */
  static async createDailyRewardsForAllUsers() {
    try {
      const vipUsers = await User.find({ vipLevel: { $gte: 1 } });
      let created = 0;
      let errors = 0;

      for (const user of vipUsers) {
        try {
          const result = await this.createDailyReward(user._id);
          if (result.eligible) {
            created++;
          }
        } catch (error) {
          console.error(`Error creating daily reward for user ${user._id}:`, error);
          errors++;
        }
      }

      return { created, errors, total: vipUsers.length };
    } catch (error) {
      console.error('Error creating daily rewards for all users:', error);
      throw error;
    }
  }

  /**
   * Expire old unclaimed rewards (cron job)
   */
  static async expireOldRewards() {
    try {
      const result = await VIPReward.expireOldRewards();
      return result;
    } catch (error) {
      console.error('Error expiring old rewards:', error);
      throw error;
    }
  }

  /**
   * Admin: Get VIP statistics
   */
  static async getVIPStatistics() {
    try {
      const totalUsers = await User.countDocuments();
      const vipUsersByLevel = await User.aggregate([
        { $group: { _id: '$vipLevel', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);

      const rewardStats = await VIPReward.aggregate([
        { 
          $group: { 
            _id: { rewardType: '$rewardType', status: '$status' },
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          } 
        }
      ]);

      const todayRewards = await VIPReward.countDocuments({
        rewardType: 'daily',
        rewardDate: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999))
        }
      });

      return {
        userStats: {
          totalUsers,
          vipUsersByLevel
        },
        rewardStats,
        todayRewards
      };
    } catch (error) {
      console.error('Error getting VIP statistics:', error);
      throw error;
    }
  }
}

module.exports = VIPService;
