const User = require('../models/user');
const Referral = require('../models/referral');
const Transaction = require('../models/transaction');
const notificationService = require('../utils/notificationService');
const { createLogger } = require('../utils/logger');
const crypto = require('crypto');

const logger = createLogger('referral-service');

class ReferralService {
  // Generate a unique referral code
  static generateReferralCode() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  // Create referral code for user if they don't have one
  static async ensureReferralCode(userId) {
    try {
      logger.info('Ensuring referral code for user', {
        userId: userId.toString(),
        timestamp: new Date().toISOString()
      });

      const user = await User.findById(userId);
      if (!user.referralCode) {
        let referralCode;
        let isUnique = false;
        
        // Keep generating until we find a unique code
        while (!isUnique) {
          referralCode = this.generateReferralCode();
          const existingUser = await User.findOne({ referralCode });
          if (!existingUser) {
            isUnique = true;
          }
        }
        
        user.referralCode = referralCode;
        await user.save();
        
        logger.info('Referral code generated successfully', {
          userId: userId.toString(),
          referralCode,
          timestamp: new Date().toISOString()
        });
        
        return referralCode;
      }
      return user.referralCode;
    } catch (error) {
      logger.error('Error ensuring referral code:', {
        error: error.message,
        userId: userId.toString(),
        stack: error.stack
      });
      throw error;
    }
  }

  // Validate referral code and return referrer
  static async validateReferralCode(referralCode) {
    try {
      if (!referralCode) return null;
      
      logger.info('Validating referral code', {
        referralCode,
        timestamp: new Date().toISOString()
      });
      
      const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
      
      if (referrer) {
        logger.info('Referral code validation successful', {
          referralCode,
          referrerId: referrer._id.toString(),
          referrerUsername: referrer.username,
          timestamp: new Date().toISOString()
        });
      } else {
        logger.warn('Referral code validation failed - code not found', {
          referralCode,
          timestamp: new Date().toISOString()
        });
      }
      
      return referrer;
    } catch (error) {
      logger.error('Error validating referral code:', {
        error: error.message,
        referralCode,
        stack: error.stack
      });
      throw error;
    }
  }

  // Process referral during signup
  static async processReferralSignup(refereeId, referralCode, signupMetadata = {}) {
    try {
      if (!referralCode) return null;

      logger.info('Processing referral signup', {
        refereeId: refereeId.toString(),
        referralCode,
        signupMetadata,
        timestamp: new Date().toISOString()
      });

      const referrer = await this.validateReferralCode(referralCode);
      if (!referrer) {
        logger.error('Referral signup failed - invalid code', {
          refereeId: refereeId.toString(),
          referralCode,
          timestamp: new Date().toISOString()
        });
        throw new Error('Invalid referral code');
      }

      // Don't allow self-referral
      if (referrer._id.toString() === refereeId.toString()) {
        throw new Error('Cannot refer yourself');
      }

      // Create referral record
      const referral = new Referral({
        referrer: referrer._id,
        referee: refereeId,
        referralCode: referralCode.toUpperCase(),
        status: 'pending',
        metadata: {
          signupIP: signupMetadata.ip,
          signupUserAgent: signupMetadata.userAgent,
          referralSource: signupMetadata.source || 'code'
        }
      });

      await referral.save();

      // Update user referral relationship
      await User.findByIdAndUpdate(refereeId, {
        referredBy: referrer._id
      });

      // Update referrer's referral list and stats
      await User.findByIdAndUpdate(referrer._id, {
        $push: { referrals: refereeId },
        $inc: { 
          'referralStats.totalReferrals': 1,
          'referralStats.pendingReferrals': 1
        },
        $set: { 'referralStats.lastReferralAt': new Date() }
      });

      // Get referral settings for notification message
      const ReferralSettings = require('../models/referralSettings');
      const settings = await ReferralSettings.getSettings();
      const minDeposit = settings.minimumDepositAmount || 25;

      // Send notification to referrer
      await notificationService.createNotification({
        recipientType: 'user',
        recipientId: referrer._id,
        type: 'referral_new',
        title: '🎉 New Referral!',
        message: `Someone just signed up using your referral code! They need to deposit $${minDeposit} to complete the referral.`,
        relatedData: {
          referralId: referral._id,
          refereeId: refereeId,
          referralCode: referralCode.toUpperCase()
        }
      });

      // Check if this new referral affects VIP level (for multi-level VIP system)
      try {
        const VIPService = require('./vipService');
        await VIPService.updateReferralStats(referrer._id);
        
        logger.info('VIP level checked after new referral signup', {
          referrerId: referrer._id.toString(),
          refereeId: refereeId.toString(),
          timestamp: new Date().toISOString()
        });
      } catch (vipError) {
        logger.error('Error updating VIP level after referral signup', {
          error: vipError.message,
          referrerId: referrer._id.toString(),
          refereeId: refereeId.toString()
        });
        // Don't fail the referral process if VIP update fails
      }

      return referral;
    } catch (error) {
      console.error('Error processing referral signup:', error);
      throw error;
    }
  }

  // Process successful referral when user makes qualifying deposit
  static async processSuccessfulReferral(userId, depositData) {
    try {
      // Find pending referral for this user
      const referral = await Referral.findOne({
        referee: userId,
        status: 'pending'
      }).populate('referrer referee');

      if (!referral) {
        return null; // No pending referral found
      }

      // Get referral settings for reward amounts and minimum deposit
      const ReferralSettings = require('../models/referralSettings');
      const settings = await ReferralSettings.getSettings();
      
      // Check if deposit meets minimum requirement from settings
      const minDepositUSD = settings.minimumDepositAmount || 25;
      if (depositData.usdValue < minDepositUSD) {
        return null; // Deposit too small
      }

      // Update referral status
      referral.status = 'successful';
      referral.completedAt = new Date();
      referral.completingDeposit = {
        transactionId: depositData.transactionId,
        amount: depositData.amount,
        currency: depositData.currency,
        usdValue: depositData.usdValue
      };

      // Use configurable reward amounts from settings
      const referrerReward = settings.defaultReferrerReward || 5;
      const refereeReward = settings.defaultRefereeReward || 2;
      
      referral.rewards = {
        referrerReward: {
          amount: referrerReward,
          currency: settings.currency || 'USDT',
          awarded: false
        },
        refereeReward: {
          amount: refereeReward,
          currency: settings.currency || 'USDT',
          awarded: false
        }
      };

      await referral.save();

      // Update referrer stats including total referral deposits for VIP calculation
      await User.findByIdAndUpdate(referral.referrer._id, {
        $inc: {
          'referralStats.successfulReferrals': 1,
          'referralStats.pendingReferrals': -1,
          'referralStats.totalReferralRewards': referrerReward,
          'referralStats.totalReferralDeposits': depositData.usdValue
        }
      });

      // Update multilevel referral counts for all users in the chain
      await this.updateMultiLevelReferralCounts(referral.referee._id);

      // Award rewards to both users
      await this.awardReferralRewards(referral);

      // Send success notifications
      await this.sendSuccessNotifications(referral);

      // Check and update VIP level for referrer
      try {
        const VIPService = require('./vipService');
        await VIPService.updateUserVIPLevel(referral.referrer._id);
      } catch (vipError) {
        console.error('Error updating VIP level after referral:', vipError);
        // Don't fail referral processing if VIP update fails
      }

      return referral;
    } catch (error) {
      console.error('Error processing successful referral:', error);
      throw error;
    }
  }

  // Track additional deposits from already successful referrals for VIP calculations
  static async trackReferralDeposit(userId, depositData) {
    try {
      // Find if this user was referred (check for successful referral)
      const referral = await Referral.findOne({
        referee: userId,
        status: 'successful'
      }).populate('referrer');

      if (!referral) {
        return null; // User wasn't referred or referral not successful
      }

      // Get referral settings for minimum deposit requirement
      const ReferralSettings = require('../models/referralSettings');
      const settings = await ReferralSettings.getSettings();
      
      // Check if deposit meets minimum requirement from settings
      const minDepositUSD = settings.minimumDepositAmount || 25;
      if (depositData.usdValue < minDepositUSD) {
        return null; // Deposit too small
      }

      // Update referrer's total referral deposits for VIP calculation
      await User.findByIdAndUpdate(referral.referrer._id, {
        $inc: {
          'referralStats.totalReferralDeposits': depositData.usdValue
        }
      });

      // Check and update VIP level for referrer
      try {
        const VIPService = require('./vipService');
        await VIPService.updateUserVIPLevel(referral.referrer._id);
      } catch (vipError) {
        console.error('Error updating VIP level after additional referral deposit:', vipError);
        // Don't fail deposit processing if VIP update fails
      }

      return {
        referrer: referral.referrer,
        additionalDeposit: depositData.usdValue
      };
    } catch (error) {
      console.error('Error tracking referral deposit:', error);
      throw error;
    }
  }

  // Check and process referral completion based on KYC approval
  static async processKycReferralCompletion(userId) {
    try {
      // Find pending referral for this user
      const referral = await Referral.findOne({
        referee: userId,
        status: 'pending'
      }).populate('referrer referee');

      if (!referral) {
        return null; // No pending referral found
      }

      const referee = referral.referee;

      // Get referral settings for minimum deposit and reward amounts
      const ReferralSettings = require('../models/referralSettings');
      const settings = await ReferralSettings.getSettings();

      // Check if both KYC and minimum deposit requirements are met
      const isKycApproved = referee.kycStatus === 'approved';
      const hasMinDeposit = referee.totalDeposits >= (settings.minimumDepositAmount || 25);

      if (!isKycApproved || !hasMinDeposit) {
        return null; // Requirements not met yet
      }

      // Update referral status
      referral.status = 'successful';
      referral.completedAt = new Date();
      referral.completionType = 'kyc_and_deposit';

      // Use configurable reward amounts from settings
      const referrerReward = settings.defaultReferrerReward || 5;
      const refereeReward = settings.defaultRefereeReward || 2;
      
      referral.rewards = {
        referrerReward: {
          amount: referrerReward,
          currency: settings.currency || 'USDT',
          awarded: false
        },
        refereeReward: {
          amount: refereeReward,
          currency: settings.currency || 'USDT',
          awarded: false
        }
      };

      await referral.save();

      // Update referrer stats
      await User.findByIdAndUpdate(referral.referrer._id, {
        $inc: {
          'referralStats.successfulReferrals': 1,
          'referralStats.pendingReferrals': -1,
          'referralStats.totalReferralRewards': referrerReward
        }
      });

      // Award rewards to both users
      await this.awardReferralRewards(referral);

      // Send success notifications
      await this.sendSuccessNotifications(referral);

      return referral;
    } catch (error) {
      console.error('Error processing KYC referral completion:', error);
      throw error;
    }
  }

  // Award referral rewards to both users
  static async awardReferralRewards(referral) {
    try {
      // Get both users
      const referrer = await User.findById(referral.referrer._id);
      const referee = await User.findById(referral.referee._id);

      const currency = referral.rewards.referrerReward.currency;
      const referrerAmount = referral.rewards.referrerReward.amount;
      const refereeAmount = referral.rewards.refereeReward.amount;

      // Award referrer reward
      const referrerBalanceBefore = referrer.balances.get(currency) || 0;
      referrer.balances.set(currency, referrerBalanceBefore + referrerAmount);

      // Award referee reward
      const refereeBalanceBefore = referee.balances.get(currency) || 0;
      referee.balances.set(currency, refereeBalanceBefore + refereeAmount);

      // Save users
      await referrer.save();
      await referee.save();

      // Create transaction records for both rewards
      const referrerTransaction = new Transaction({
        user: referral.referrer._id,
        type: 'referral_reward',
        subType: 'direct_referral_bonus',
        currency: currency,
        amount: referrerAmount,
        direction: 'credit',
        balanceBefore: referrerBalanceBefore,
        balanceAfter: referrerBalanceBefore + referrerAmount,
        usdValue: referrerAmount,
        status: 'completed',
        referralInfo: {
          referralId: referral._id,
          referralLevel: 1
        },
        description: `Referral reward from ${referral.referee.username || 'new user'}`,
        notes: `Direct referral completed first deposit`,
        executedAt: new Date()
      });

      const refereeTransaction = new Transaction({
        user: referral.referee._id,
        type: 'referral_reward',
        subType: 'direct_referral_bonus',
        currency: currency,
        amount: refereeAmount,
        direction: 'credit',
        balanceBefore: refereeBalanceBefore,
        balanceAfter: refereeBalanceBefore + refereeAmount,
        usdValue: refereeAmount,
        status: 'completed',
        referralInfo: {
          referralId: referral._id,
          referralLevel: 0 // Recipient of referral
        },
        description: `Welcome bonus for joining through referral`,
        notes: `Referral welcome reward`,
        executedAt: new Date()
      });

      await referrerTransaction.save();
      await refereeTransaction.save();

      // Send balance update notifications for both users
      try {
        const notificationService = require('../utils/notificationService');
        
        // Notify referrer about balance update
        await notificationService.notifyUserBalanceUpdate(referral.referrer._id, {
          currency,
          amount: referrerAmount.toFixed(2),
          direction: 'credit',
          newBalance: (referrerBalanceBefore + referrerAmount).toFixed(2),
          reason: `Referral reward from ${referral.referee.username || 'new user'}`
        });
        
        // Notify referee about balance update
        await notificationService.notifyUserBalanceUpdate(referral.referee._id, {
          currency,
          amount: refereeAmount.toFixed(2),
          direction: 'credit',
          newBalance: (refereeBalanceBefore + refereeAmount).toFixed(2),
          reason: 'Welcome bonus for joining through referral'
        });

        
      } catch (notificationError) {
        console.error('Error sending balance update notifications:', notificationError);
        // Don't fail the reward if notification fails
      }

      // Mark rewards as awarded
      referral.rewards.referrerReward.awarded = true;
      referral.rewards.referrerReward.awardedAt = new Date();
      referral.rewards.refereeReward.awarded = true;
      referral.rewards.refereeReward.awardedAt = new Date();
      
      await referral.save();

      return true;
    } catch (error) {
      console.error('Error awarding referral rewards:', error);
      return false;
    }
  }

  // Send success notifications
  static async sendSuccessNotifications(referral) {
    // Notify referrer
    await notificationService.createNotification({
      recipientType: 'user',
      recipientId: referral.referrer._id,
      type: 'referral_completed',
      title: '🎉 Referral Successful!',
      message: `Your referral made their first deposit! You've earned $${referral.rewards.referrerReward.amount} USDT as a reward.`,
      relatedData: {
        referralId: referral._id,
        reward: referral.rewards.referrerReward.amount,
        currency: referral.rewards.referrerReward.currency
      }
    });

    // Notify referee
    await notificationService.createNotification({
      recipientType: 'user',
      recipientId: referral.referee._id,
      type: 'referral_bonus',
      title: '🎁 Welcome Bonus!',
      message: `Welcome to our platform! You've received $${referral.rewards.refereeReward.amount} USDT as a referral bonus.`,
      relatedData: {
        referralId: referral._id,
        reward: referral.rewards.refereeReward.amount,
        currency: referral.rewards.refereeReward.currency
      }
    });
  }

  // Get referral statistics for user
  static async getReferralStats(userId) {
    const [stats, successfulReferrals, pendingReferrals, user] = await Promise.all([
      Referral.getReferralStats(userId),
      Referral.getSuccessfulReferrals(userId),
      Referral.getPendingReferrals(userId),
      User.findById(userId).select('referralStats')
    ]);

    // Get multi-level stats from user document
    const multiLevelStats = user?.referralStats?.multiLevelStats || {};
    
    return {
      stats: stats.reduce((acc, stat) => {
        acc[stat._id] = {
          count: stat.count,
          totalRewards: stat.totalRewards
        };
        return acc;
      }, {}),
      successfulReferrals: successfulReferrals.slice(0, 10), // Latest 10
      pendingReferrals: pendingReferrals.slice(0, 10), // Latest 10
      totalSuccessful: successfulReferrals.length,
      totalPending: pendingReferrals.length,
      
      // Add multi-level stats for frontend consumption
      multiLevelStats: {
        totalSuccessfulReferrals: multiLevelStats.totalMultiLevelReferrals || 0,
        totalPendingReferrals: 0, // For now, we only track successful multi-level
        level1Referrals: multiLevelStats.level1Referrals || 0,
        level2Referrals: multiLevelStats.level2Referrals || 0,
        level3Referrals: multiLevelStats.level3Referrals || 0,
        level4Referrals: multiLevelStats.level4Referrals || 0,
        lastUpdate: multiLevelStats.lastMultiLevelUpdate
      }
    };
  }

  // Admin: Set custom referral code for a user
  static async setCustomReferralCode(userId, customCode) {
    try {
      // Validate the custom code format (alphanumeric, 4-12 characters)
      if (!customCode || !/^[A-Z0-9]{4,12}$/i.test(customCode)) {
        throw new Error('Referral code must be 4-12 alphanumeric characters');
      }

      const upperCode = customCode.toUpperCase();

      // Check if code is already taken
      const existingUser = await User.findOne({ referralCode: upperCode });
      if (existingUser && existingUser._id.toString() !== userId.toString()) {
        throw new Error('Referral code already exists');
      }

      // Update user's referral code
      const user = await User.findByIdAndUpdate(
        userId,
        { referralCode: upperCode },
        { new: true }
      );

      if (!user) {
        throw new Error('User not found');
      }

      return {
        success: true,
        referralCode: upperCode,
        referralLink: this.generateReferralLink(upperCode)
      };
    } catch (error) {
      console.error('Error setting custom referral code:', error);
      throw error;
    }
  }

  // Admin: Remove referral code from user
  static async removeReferralCode(userId) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { $unset: { referralCode: 1 } },
        { new: true }
      );

      if (!user) {
        throw new Error('User not found');
      }

      return { success: true };
    } catch (error) {
      console.error('Error removing referral code:', error);
      throw error;
    }
  }

  // Admin: Get all users with referral codes
  static async getAllUsersWithReferralCodes(page = 1, limit = 20, search = '') {
    try {
      const query = { referralCode: { $exists: true } };
      
      if (search) {
        // Import escapeRegex inline to avoid circular dependency
        const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
          { username: { $regex: safeSearch, $options: 'i' } },
          { email: { $regex: safeSearch, $options: 'i' } },
          { referralCode: { $regex: safeSearch, $options: 'i' } }
        ];
      }

      const users = await User.find(query)
        .select('username email referralCode referralStats createdAt')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await User.countDocuments(query);

      return {
        users: users.map(user => ({
          _id: user._id,
          username: user.username,
          email: user.email,
          referralCode: user.referralCode,
          referralStats: user.referralStats,
          createdAt: user.createdAt,
          referralLink: this.generateReferralLink(user.referralCode)
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
          total
        }
      };
    } catch (error) {
      console.error('Error getting users with referral codes:', error);
      throw error;
    }
  }

  // Generate referral link
  static generateReferralLink(referralCode, baseUrl = null) {
    // Auto-detect frontend URL based on environment
    if (!baseUrl) {
      if (process.env.NODE_ENV === 'production') {
        // Production: Use environment variable or try to detect from request
        baseUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://yourapp.com';
      } else {
        // Development: Use Vite default port
        baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      }
    }
    
    return `${baseUrl}/signup?ref=${referralCode}`;
  }

  // Process special token sale and distribute trading bonuses
  static async processSpecialTokenSale(userId, saleData) {
    try {
      const TradingBonusService = require('./tradingBonusService');
      
      // Process trading bonuses for multi-level referral chain
      const results = await TradingBonusService.processTradingBonuses(userId, saleData);
      
      logger.info('Special token sale bonuses processed', {
        userId,
        tokenSymbol: saleData.tokenSymbol,
        profit: saleData.profit,
        bonusesDistributed: results.bonusesDistributed,
        totalBonusAmount: results.totalAmount
      });
      
      return results;
      
    } catch (error) {
      logger.error('Error processing special token sale bonuses', {
        error: error.message,
        userId,
        saleData,
        stack: error.stack
      });
      throw error;
    }
  }

  // Build or update referral chain for user
  static async updateReferralChain(userId) {
    try {
      const ReferralChain = require('../models/referralChain');
      const chain = await ReferralChain.buildChainForUser(userId);
      
      logger.info('Referral chain updated', {
        userId,
        chainLength: chain?.maxDepth || 0,
        hasChain: !!chain
      });
      
      return chain;
      
    } catch (error) {
      logger.error('Error updating referral chain', {
        error: error.message,
        userId,
        stack: error.stack
      });
      throw error;
    }
  }

  // Update multilevel referral counts when a successful referral happens
  static async updateMultiLevelReferralCounts(newRefereeId) {
    try {
      const ReferralChain = require('../models/referralChain');
      const ReferralSettings = require('../models/referralSettings');
      
      // Get max configured level from admin settings
      const maxConfiguredLevel = await ReferralSettings.getMaxConfiguredLevel();
      
      if (maxConfiguredLevel === 0) {
        logger.info('No multilevel trading bonus levels configured - skipping count update');
        return;
      }
      
      // Build/update referral chain for the new referee
      const chain = await ReferralChain.buildChainForUser(newRefereeId);
      
      if (!chain || chain.chain.length === 0) {
        return;
      }
      
      // For each user in the chain (up to max configured level), increment their multilevel counts
      for (let i = 0; i < chain.chain.length; i++) {
        const chainUser = chain.chain[i];
        const level = chainUser.level;
        
        // Only update counts for levels that admin has configured with bonuses
        if (level > maxConfiguredLevel) {
          break; // No point going further than admin-configured levels
        }
        
        // Check if this level actually has a bonus percentage configured
        const percentage = await ReferralSettings.getTradingBonusPercentage(level);
        if (percentage === 0) {
          continue; // Skip levels with no bonus configured
        }
        
        // Build the update object dynamically
        const updateObj = {
          $inc: {
            'referralStats.multiLevelStats.totalMultiLevelReferrals': 1
          }
        };
        
        // Increment the specific level count
        const levelField = `referralStats.multiLevelStats.level${level}Referrals`;
        updateObj.$inc[levelField] = 1;
        
        // Set cache invalidation
        updateObj.$set = {
          'referralStats.multiLevelStats.multiLevelCacheValid': false,
          'referralStats.multiLevelStats.lastMultiLevelUpdate': new Date()
        };
        
        await User.findByIdAndUpdate(chainUser.user, updateObj);
        
        logger.info('Updated multilevel referral count', {
          userId: chainUser.user,
          level,
          percentage,
          newRefereeId
        });
      }
      
    } catch (error) {
      logger.error('Error updating multilevel referral counts', {
        error: error.message,
        newRefereeId,
        stack: error.stack
      });
      // Don't throw - this shouldn't fail the main referral processing
    }
  }
}

module.exports = ReferralService;
