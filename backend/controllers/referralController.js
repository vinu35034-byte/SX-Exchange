const ReferralService = require('../services/referralService');
const User = require('../models/user');
const Referral = require('../models/referral');
const { sessionManager } = require('../config/session');
const { createLogger } = require('../utils/logger');
const { escapeRegex } = require('../middlewares/securityMiddleware');

const logger = createLogger('referral-controller');

/**
 * Helper: Get frontend URL from request or environment
 */
function getFrontendUrl(req) {
  // Priority: 1. Environment variable, 2. Request origin, 3. Default
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL;
  }
  
  // Try to detect from request headers
  const origin = req.get('Origin') || req.get('Referer');
  if (origin) {
    // Extract domain from origin/referer
    try {
      const url = new URL(origin);
      // Don't use localhost in production
      if (process.env.NODE_ENV === 'production' && url.hostname === 'localhost') {
        return process.env.FRONTEND_URL_PROD || 'https://yourwebsite.com';
      }
      return `${url.protocol}//${url.host}`;
    } catch (error) {
      logger.warn('Could not parse origin/referer:', { origin, error: error.message });
    }
  }
  
  // Fallback based on environment
  if (process.env.NODE_ENV === 'production') {
    return process.env.FRONTEND_URL_PROD || 'https://yourwebsite.org'; // Use env var or fallback
  } else {
    return process.env.FRONTEND_URL || 'http://localhost:5173'; // Development default
  }
}

class ReferralController {
  /**
   * Get user's referral dashboard data
   */
  async getReferralDashboard(req, res) {
    try {
      const userId = req.user._id;
      
      // Log referral dashboard access
      logger.info('Referral dashboard accessed', {
        userId: userId.toString(),
        sessionId: req.sessionID,
        timestamp: new Date().toISOString()
      });
      
      // Get user's referral code
      const user = await User.findById(userId);
      let referralCode = user.referralCode;
      
      // Generate referral code if user doesn't have one
      if (!referralCode) {
        referralCode = await ReferralService.ensureReferralCode(userId);
      }
      
      // Get referral statistics
      const stats = await ReferralService.getReferralStats(userId);
      
      // Generate referral link with smart domain detection
      const referralLink = ReferralService.generateReferralLink(referralCode, getFrontendUrl(req));
      
      // Add session info for activity tracking
      const sessionInfo = {
        sessionId: req.sessionID,
        lastActivity: req.session?.user?.lastActivity,
        dashboardAccessed: new Date()
      };
      
      // Get trading bonus statistics
      const Transaction = require('../models/transaction');
      const tradingBonusStats = await Transaction.aggregate([
        {
          $match: {
            user: userId,
            type: 'trading_bonus',
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalTradingBonuses: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);

      const totalTradingBonuses = tradingBonusStats[0]?.totalTradingBonuses || 0;
      const totalReferralRewards = user.referralStats.totalReferralRewards || 0;

      // Get multi-level stats
      const multiLevelStats = user.referralStats?.multiLevelStats || {};

      res.json({
        referralCode,
        referralLink,
        statistics: {
          totalReferrals: user.referralStats.totalReferrals || 0,
          successfulReferrals: user.referralStats.successfulReferrals || 0,
          pendingReferrals: user.referralStats.pendingReferrals || 0,
          totalReferralRewards: totalReferralRewards,
          totalTradingBonuses: totalTradingBonuses,
          totalRewards: totalReferralRewards + totalTradingBonuses,
          lastReferralAt: user.referralStats.lastReferralAt,
          
          // Add multi-level stats for compatibility
          totalMultiLevelSuccessful: multiLevelStats.totalMultiLevelReferrals || 0,
          totalMultiLevelPending: 0, // For now, we only track successful multi-level
          level1Referrals: multiLevelStats.level1Referrals || 0,
          level2Referrals: multiLevelStats.level2Referrals || 0,
          level3Referrals: multiLevelStats.level3Referrals || 0,
          level4Referrals: multiLevelStats.level4Referrals || 0
        },
        recentReferrals: {
          successful: stats.successfulReferrals,
          pending: stats.pendingReferrals
        },
        sessionInfo
      });

    } catch (error) {
      logger.error('Error getting referral dashboard:', {
        error: error.message,
        userId: req.user._id.toString(),
        sessionId: req.sessionID,
        stack: error.stack
      });
      
      res.status(500).json({ 
        message: 'Failed to get referral dashboard',
        error: error.message,
        sessionInfo: {
          errorAt: new Date(),
          sessionId: req.sessionID
        }
      });
    }
  }

  /**
   * Get referral statistics
   */
  async getReferralStats(req, res) {
    try {
      const userId = req.user._id;
      
      // Log referral stats access
      logger.info('Referral stats accessed', {
        userId: userId.toString(),
        sessionId: req.sessionID,
        timestamp: new Date().toISOString()
      });
      
      const stats = await ReferralService.getReferralStats(userId);
      
      res.json({
        ...stats,
        sessionInfo: {
          accessedAt: new Date(),
          sessionId: req.sessionID
        }
      });

    } catch (error) {
      logger.error('Error getting referral stats:', {
        error: error.message,
        userId: req.user._id.toString(),
        sessionId: req.sessionID,
        stack: error.stack
      });
      
      res.status(500).json({ 
        message: 'Failed to get referral stats',
        error: error.message,
        sessionInfo: {
          errorAt: new Date(),
          sessionId: req.sessionID
        }
      });
    }
  }

  /**
   * Get user's referral history
   */
  async getReferralHistory(req, res) {
    try {
      const userId = req.user._id;
      const { page = 1, limit = 10, status } = req.query;
      
      // Log referral history access
      logger.info('Referral history accessed', {
        userId: userId.toString(),
        sessionId: req.sessionID,
        page,
        limit,
        status,
        timestamp: new Date().toISOString()
      });
      
      const query = { referrer: userId };
      if (status) {
        query.status = status;
      }
      
      const referrals = await Referral.find(query)
        .populate('referee', 'username email createdAt')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
      
      const total = await Referral.countDocuments(query);
      
      res.json({
        referrals,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        },
        sessionInfo: {
          accessedAt: new Date(),
          sessionId: req.sessionID
        }
      });

    } catch (error) {
      logger.error('Error getting referral history:', {
        error: error.message,
        userId: req.user._id.toString(),
        sessionId: req.sessionID,
        stack: error.stack
      });
      
      res.status(500).json({ 
        message: 'Failed to get referral history',
        error: error.message,
        sessionInfo: {
          errorAt: new Date(),
          sessionId: req.sessionID
        }
      });
    }
  }

  /**
   * Generate new referral code
   */
  async generateReferralCode(req, res) {
    try {
      const userId = req.user._id;
      
      // Log referral code generation
      logger.info('Referral code generation requested', {
        userId: userId.toString(),
        sessionId: req.sessionID,
        timestamp: new Date().toISOString()
      });
      
      const referralCode = await ReferralService.ensureReferralCode(userId);
      const referralLink = ReferralService.generateReferralLink(referralCode, getFrontendUrl(req));
      
      res.json({
        referralCode,
        referralLink,
        sessionInfo: {
          generatedAt: new Date(),
          sessionId: req.sessionID
        }
      });

    } catch (error) {
      logger.error('Error generating referral code:', {
        error: error.message,
        userId: req.user._id.toString(),
        sessionId: req.sessionID,
        stack: error.stack
      });
      
      res.status(500).json({ 
        message: 'Failed to generate referral code',
        error: error.message,
        sessionInfo: {
          errorAt: new Date(),
          sessionId: req.sessionID
        }
      });
    }
  }

  /**
   * Validate referral code
   */
  async validateReferralCode(req, res) {
    try {
      const { referralCode } = req.body;
      
      if (!referralCode) {
        return res.status(400).json({ message: 'Referral code is required' });
      }
      
      const referrer = await ReferralService.validateReferralCode(referralCode);
      
      if (!referrer) {
        return res.status(400).json({ 
          valid: false,
          message: 'Invalid referral code' 
        });
      }
      
      res.json({
        valid: true,
        referrer: {
          username: referrer.username,
          memberSince: referrer.createdAt
        }
      });

    } catch (error) {
      console.error('Error validating referral code:', error);
      res.status(500).json({ 
        message: 'Failed to validate referral code',
        error: error.message 
      });
    }
  }

  /**
   * Get referral rewards
   */
  async getReferralRewards(req, res) {
    try {
      const userId = req.user._id;
      
      const rewards = await Referral.find({ 
        referrer: userId,
        status: 'successful',
        'rewards.referrerReward.awarded': true
      })
      .populate('referee', 'username')
      .select('rewards.referrerReward completedAt referee')
      .sort({ completedAt: -1 });
      
      const totalRewards = rewards.reduce((sum, referral) => 
        sum + (referral.rewards.referrerReward.amount || 0), 0
      );
      
      res.json({
        rewards,
        totalRewards,
        currency: 'USDT'
      });

    } catch (error) {
      console.error('Error getting referral rewards:', error);
      res.status(500).json({ 
        message: 'Failed to get referral rewards',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Get all referrals
   */
  async getAllReferrals(req, res) {
    try {
      const { page = 1, limit = 20, status } = req.query;
      
      const query = {};
      if (status) {
        query.status = status;
      }
      
      const referrals = await Referral.find(query)
        .populate('referrer', 'username email')
        .populate('referee', 'username email')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
      
      const total = await Referral.countDocuments(query);
      
      res.json({
        referrals,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
          total
        }
      });

    } catch (error) {
      console.error('Error getting all referrals:', error);
      res.status(500).json({ 
        message: 'Failed to get referrals',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Set custom referral code for a user
   */
  async setCustomReferralCode(req, res) {
    try {
      const { userId, referralCode } = req.body;
      
      if (!userId || !referralCode) {
        return res.status(400).json({ 
          message: 'User ID and referral code are required' 
        });
      }
      
      const result = await ReferralService.setCustomReferralCode(userId, referralCode);
      
      res.json({
        message: 'Custom referral code set successfully',
        ...result
      });

    } catch (error) {
      console.error('Error setting custom referral code:', error);
      res.status(400).json({ 
        message: error.message || 'Failed to set custom referral code'
      });
    }
  }

  /**
   * Admin: Remove referral code from user
   */
  async removeReferralCode(req, res) {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ 
          message: 'User ID is required' 
        });
      }
      
      const result = await ReferralService.removeReferralCode(userId);
      
      res.json({
        message: 'Referral code removed successfully',
        ...result
      });

    } catch (error) {
      console.error('Error removing referral code:', error);
      res.status(400).json({ 
        message: error.message || 'Failed to remove referral code'
      });
    }
  }

  /**
   * Admin: Get all users with referral codes
   */
  async getAllUsersWithReferralCodes(req, res) {
    try {
      const { page = 1, limit = 20, search = '' } = req.query;
      
      const result = await ReferralService.getAllUsersWithReferralCodes(
        parseInt(page),
        parseInt(limit),
        search
      );
      
      res.json(result);

    } catch (error) {
      console.error('Error getting users with referral codes:', error);
      res.status(500).json({ 
        message: 'Failed to get users with referral codes',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Get referral statistics
   */
  async getAdminReferralStats(req, res) {
    try {
      const stats = await Referral.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalRewards: { $sum: '$rewards.referrerReward.amount' }
          }
        }
      ]);
      
      const totalUsers = await User.countDocuments();
      const usersWithReferrals = await User.countDocuments({ 
        'referralStats.totalReferrals': { $gt: 0 } 
      });
      
      res.json({
        referralStats: stats,
        userStats: {
          totalUsers,
          usersWithReferrals,
          referralRate: ((usersWithReferrals / totalUsers) * 100).toFixed(2)
        }
      });

    } catch (error) {
      console.error('Error getting admin referral stats:', error);
      res.status(500).json({ 
        message: 'Failed to get admin referral stats',
        error: error.message 
      });
    }
  }

  /**
   * Get referral settings (public endpoint)
   */
  async getReferralSettings(req, res) {
    try {
      const ReferralSettings = require('../models/referralSettings');
      const settings = await ReferralSettings.getSettings();
      
      console.log('Raw settings from database:', JSON.stringify(settings.multiLevelTradingBonus, null, 2));
      
      // Ensure defaultLevelPercentages has proper structure for 4 levels
      let defaultLevelPercentages = settings.multiLevelTradingBonus.defaultLevelPercentages || {};
      
      // If defaultLevelPercentages is empty or missing, create default structure
      if (!defaultLevelPercentages.level1 && !defaultLevelPercentages.level2 && 
          !defaultLevelPercentages.level3 && !defaultLevelPercentages.level4) {
        defaultLevelPercentages = {
          level1: 15, // 10%
          level2: 10,  // 5%
          level3: 5,  // 2%
          level4: 2   // 1%
        };
      } else {
        // Ensure we have exactly the levels we want with correct percentages
        defaultLevelPercentages = {
          level1: 15, // 10%
          level2: 10,  // 5%
          level3: 5,  // 2%
          level4: 2   // 1%
        };
      }
      
      console.log('Final defaultLevelPercentages:', defaultLevelPercentages);
      
      // Return only public settings with correct field names that frontend expects
      res.json({
        appName: settings.appName,
        defaultReferrerReward: settings.defaultReferrerReward,
        defaultRefereeReward: settings.defaultRefereeReward,
        currency: settings.currency,
        minimumDepositAmount: settings.minimumDepositAmount,
        requireKyc: settings.requireKyc,
        multiLevelTradingBonus: {
          enabled: settings.multiLevelTradingBonus.enabled,
          maxLevels: 4, // Force to 4 levels as per your requirement
          levelPercentages: settings.multiLevelTradingBonus.levelPercentages,
          defaultLevelPercentages: defaultLevelPercentages
        }
      });

    } catch (error) {
      console.error('Error getting referral settings:', error);
      res.status(500).json({ 
        message: 'Failed to get referral settings',
        error: error.message 
      });
    }
  }

  /**
   * Get trading bonus stats for user
   */
  async getTradingBonusStats(req, res) {
    try {
      const TradingBonusService = require('../services/tradingBonusService');
      const userId = req.user._id;
      
      const stats = await TradingBonusService.getTradingBonusStats(userId);
      
      res.json(stats);

    } catch (error) {
      console.error('Error getting trading bonus stats:', error);
      res.status(500).json({ 
        message: 'Failed to get trading bonus stats',
        error: error.message 
      });
    }
  }

  /**
   * Preview trading bonuses for a potential sale
   */
  async previewTradingBonuses(req, res) {
    try {
      const TradingBonusService = require('../services/tradingBonusService');
      const userId = req.user._id;
      const { profit } = req.query;
      
      if (!profit || profit <= 0) {
        return res.status(400).json({ 
          message: 'Valid profit amount is required' 
        });
      }
      
      const preview = await TradingBonusService.previewTradingBonuses(userId, parseFloat(profit));
      
      res.json(preview);

    } catch (error) {
      console.error('Error previewing trading bonuses:', error);
      res.status(500).json({ 
        message: 'Failed to preview trading bonuses',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Get complete referral settings
   */
  async getAdminReferralSettings(req, res) {
    try {
      const ReferralSettings = require('../models/referralSettings');
      const settings = await ReferralSettings.getSettings();
      
      res.json(settings);

    } catch (error) {
      console.error('Error getting admin referral settings:', error);
      res.status(500).json({ 
        message: 'Failed to get referral settings',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Update referral settings
   */
  async updateReferralSettings(req, res) {
    try {
      const ReferralSettings = require('../models/referralSettings');
      const updates = req.body;
      
      const settings = await ReferralSettings.updateSettings(updates);
      
      res.json({
        message: 'Referral settings updated successfully',
        settings
      });

    } catch (error) {
      console.error('Error updating referral settings:', error);
      res.status(400).json({ 
        message: error.message || 'Failed to update referral settings'
      });
    }
  }

  /**
   * Admin: Get trading bonus statistics
   */
  async getAdminTradingBonusStats(req, res) {
    try {
      const TradingBonusService = require('../services/tradingBonusService');
      const stats = await TradingBonusService.getAdminStats();
      
      res.json(stats);

    } catch (error) {
      console.error('Error getting admin trading bonus stats:', error);
      res.status(500).json({ 
        message: 'Failed to get trading bonus stats',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Rebuild all referral chains
   */
  async rebuildReferralChains(req, res) {
    try {
      const TradingBonusService = require('../services/tradingBonusService');
      const results = await TradingBonusService.rebuildAllReferralChains();
      
      res.json({
        message: 'Referral chains rebuilt successfully',
        results
      });

    } catch (error) {
      console.error('Error rebuilding referral chains:', error);
      res.status(500).json({ 
        message: 'Failed to rebuild referral chains',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Get all users with referral codes (enhanced for AdminReferralManager)
   */
  async getAdminUsersWithCodes(req, res) {
    try {
      const { page = 1, limit = 20, search = '' } = req.query;
      
      // Build search query
      const searchQuery = {};
      if (search) {
        const safeSearch = escapeRegex(search);
        searchQuery.$or = [
          { username: { $regex: safeSearch, $options: 'i' } },
          { email: { $regex: safeSearch, $options: 'i' } },
          { referralCode: { $regex: safeSearch, $options: 'i' } }
        ];
      }
      
      // Find users with referral codes
      const users = await User.find({
        ...searchQuery,
        referralCode: { $exists: true, $ne: null }
      })
      .select('username email referralCode createdAt referralStats tradingBonusStats')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

      const total = await User.countDocuments({
        ...searchQuery,
        referralCode: { $exists: true, $ne: null }
      });

      // Add referral links for each user
      const usersWithLinks = users.map(user => ({
        ...user.toObject(),
        referralLink: ReferralService.generateReferralLink(user.referralCode, getFrontendUrl(req))
      }));

      res.json({
        users: usersWithLinks,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      });

    } catch (error) {
      logger.error('Error getting admin users with codes:', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({ 
        message: 'Failed to get users with codes',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Get referral transactions
   */
  async getAdminReferralTransactions(req, res) {
    try {
      const { page = 1, limit = 20, search = '' } = req.query;
      const Transaction = require('../models/transaction');
      
      // Build search query for referral and trading bonus transactions
      const searchQuery = {
        type: { $in: ['referral_reward', 'trading_bonus'] }
      };

      if (search) {
        const safeSearch = escapeRegex(search);
        const users = await User.find({
          $or: [
            { username: { $regex: safeSearch, $options: 'i' } },
            { email: { $regex: safeSearch, $options: 'i' } }
          ]
        }).select('_id');
        
        const userIds = users.map(u => u._id);
        
        searchQuery.$or = [
          { user: { $in: userIds } }
        ];
      }

      const transactions = await Transaction.find(searchQuery)
        .populate('user', 'username email')
        .populate('referralInfo.triggeredBy', 'username')
        .sort({ executedAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Transaction.countDocuments(searchQuery);

      res.json({
        transactions,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      });

    } catch (error) {
      logger.error('Error getting admin referral transactions:', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({ 
        message: 'Failed to get referral transactions',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Get comprehensive referral statistics
   */
  async getAdminReferralStats(req, res) {
    try {
      const Transaction = require('../models/transaction');
      
      // Get total users with referral codes
      const totalUsers = await User.countDocuments({
        referralCode: { $exists: true, $ne: null }
      });

      // Get successful referrals
      const successfulReferrals = await Referral.countDocuments({
        status: 'completed'
      });

      // Get total rewards from transactions
      const rewardStats = await Transaction.aggregate([
        {
          $match: {
            type: { $in: ['referral_reward', 'trading_bonus'] },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: '$type',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);

      const totalRewards = rewardStats.reduce((sum, stat) => sum + stat.totalAmount, 0);
      const tradingBonuses = rewardStats.find(s => s._id === 'trading_bonus')?.totalAmount || 0;

      // Get active referrers (users who have made successful referrals)
      const activeReferrers = await User.countDocuments({
        'referralStats.successfulReferrals': { $gt: 0 }
      });

      // Calculate average reward
      const totalTransactions = rewardStats.reduce((sum, stat) => sum + stat.count, 0);
      const averageReward = totalTransactions > 0 ? (totalRewards / totalTransactions).toFixed(2) : 0;

      res.json({
        totalUsers,
        successfulReferrals,
        totalRewards: totalRewards.toFixed(2),
        tradingBonuses: tradingBonuses.toFixed(2),
        activeReferrers,
        averageReward
      });

    } catch (error) {
      logger.error('Error getting admin referral stats:', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({ 
        message: 'Failed to get referral stats',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Verify multilevel referral counts for a user
   */
  async verifyMultilevelCounts(req, res) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
      }

      const user = await User.findById(userId).select('username referralStats');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Calculate actual multilevel counts
      const VIPService = require('../services/vipService');
      const actualCounts = await VIPService.calculateMultiLevelReferrals(userId);

      // Get cached counts from user record
      const cachedCounts = user.referralStats.multiLevelStats;

      res.json({
        username: user.username,
        actualCounts,
        cachedCounts,
        discrepancy: {
          level1: actualCounts.level1Count !== (cachedCounts.level1Referrals || 0),
          level2: actualCounts.level2Count !== (cachedCounts.level2Referrals || 0), 
          level3: actualCounts.level3Count !== (cachedCounts.level3Referrals || 0),
          total: actualCounts.totalCount !== (cachedCounts.totalMultiLevelReferrals || 0)
        },
        needsUpdate: !cachedCounts.multiLevelCacheValid || 
                    actualCounts.totalCount !== (cachedCounts.totalMultiLevelReferrals || 0)
      });

    } catch (error) {
      logger.error('Error verifying multilevel counts:', {
        error: error.message,
        userId: req.params.userId,
        stack: error.stack
      });
      
      res.status(500).json({ 
        message: 'Failed to verify multilevel counts',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Refresh multilevel counts for all users
   */
  async refreshAllMultilevelCounts(req, res) {
    try {
      const usersWithReferrals = await User.find({
        'referralStats.successfulReferrals': { $gt: 0 }
      }).select('_id username referralStats');

      const results = {
        processed: 0,
        errors: 0,
        updated: 0
      };

      for (const user of usersWithReferrals) {
        try {
          const VIPService = require('../services/vipService');
          const actualCounts = await VIPService.calculateMultiLevelReferrals(user._id);
          
          // Update the user's cached multilevel stats
          await User.findByIdAndUpdate(user._id, {
            'referralStats.multiLevelStats.level1Referrals': actualCounts.level1Count,
            'referralStats.multiLevelStats.level2Referrals': actualCounts.level2Count,
            'referralStats.multiLevelStats.level3Referrals': actualCounts.level3Count,
            'referralStats.multiLevelStats.totalMultiLevelReferrals': actualCounts.totalCount,
            'referralStats.multiLevelStats.lastMultiLevelUpdate': new Date(),
            'referralStats.multiLevelStats.multiLevelCacheValid': true
          });

          results.updated++;
          results.processed++;
        } catch (error) {
          logger.error('Error refreshing multilevel count for user:', {
            userId: user._id,
            error: error.message
          });
          results.errors++;
          results.processed++;
        }
      }

      res.json({
        message: 'Multilevel counts refresh completed',
        results
      });

    } catch (error) {
      logger.error('Error refreshing all multilevel counts:', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({ 
        message: 'Failed to refresh multilevel counts',
        error: error.message 
      });
    }
  }
}

module.exports = new ReferralController();
