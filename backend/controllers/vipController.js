const VIPService = require('../services/vipService');
const VIPLevel = require('../models/vipLevel');
const VIPReward = require('../models/vipReward');
const User = require('../models/user');
const { sessionManager } = require('../config/session');

class VIPController {
  /**
   * Get VIP dashboard data for user
   */
  async getVIPDashboard(req, res) {
    try {
      const userId = req.user._id;
      const dashboard = await VIPService.getVIPDashboard(userId);
      
      // Add session activity to response for VIP tracking
      dashboard.sessionInfo = {
        sessionId: req.sessionID,
        lastActivity: req.session?.user?.lastActivity,
        loginAt: req.session?.user?.loginAt
      };
      
      res.json(dashboard);
    } catch (error) {
      console.error('Error getting VIP dashboard:', error);
      res.status(500).json({ 
        message: 'Failed to get VIP dashboard',
        error: error.message 
      });
    }
  }

  /**
   * Create today's daily reward
   */
  async createDailyReward(req, res) {
    try {
      // Validate active session for reward claims
      if (!req.session?.user || !req.sessionID) {
        return res.status(401).json({ 
          success: false,
          message: 'Session validation failed. Please login again to claim rewards.',
          code: 'REWARD_SESSION_REQUIRED'
        });
      }

      const userId = req.user._id;
      
      const result = await VIPService.createDailyReward(userId);
      
      if (result.eligible) {
        res.json({
          success: true,
          message: result.message,
          reward: result.reward,
          sessionInfo: {
            claimedAt: new Date(),
            sessionId: req.sessionID
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.reason,
          reward: result.reward
        });
      }
    } catch (error) {
      console.error('Error creating daily reward:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to create daily reward',
        error: error.message 
      });
    }
  }

  /**
   * Claim a reward
   */
  async claimReward(req, res) {
    try {
      // Validate active session for reward claims
      if (!req.session?.user || !req.sessionID) {
        return res.status(401).json({ 
          success: false,
          message: 'Session validation failed. Please login again to claim rewards.',
          code: 'REWARD_CLAIM_SESSION_REQUIRED'
        });
      }

      const userId = req.user._id;
      const { rewardId } = req.params;

      const result = await VIPService.claimReward(userId, rewardId);
      
      res.json({
        success: true,
        message: 'Reward claimed successfully',
        reward: result.reward,
        newBalance: result.newBalance,
        sessionInfo: {
          claimedAt: new Date(),
          sessionId: req.sessionID
        }
      });
    } catch (error) {
      console.error('Error claiming reward:', error);
      res.status(400).json({ 
        success: false,
        message: error.message || 'Failed to claim reward'
      });
    }
  }

  /**
   * Get user's reward history
   */
  async getRewardHistory(req, res) {
    try {
      const userId = req.user._id;
      const { page = 1, limit = 20 } = req.query;
      
      const rewards = await VIPReward.getUserRewardHistory(userId, parseInt(page), parseInt(limit));
      const total = await VIPReward.countDocuments({ user: userId });
      
      res.json({
        rewards,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
          total
        },
        sessionInfo: {
          accessedAt: new Date(),
          sessionId: req.sessionID,
          lastActivity: req.session?.user?.lastActivity
        }
      });
    } catch (error) {
      console.error('Error getting reward history:', error);
      res.status(500).json({ 
        message: 'Failed to get reward history',
        error: error.message 
      });
    }
  }

  /**
   * Get all VIP levels (public)
   */
  async getVIPLevels(req, res) {
    try {
      const vipLevels = await VIPLevel.find({ isActive: true }).sort({ level: 1 });
      
      res.json({
        vipLevels: vipLevels.map(level => ({
          level: level.level,
          name: level.name,
          minimumLevel1Referrals: level.minimumLevel1Referrals,
          minimumTotalReferrals: level.minimumTotalReferrals,
          dailyReward: level.dailyReward,
          oneTimeUpgradeReward: level.oneTimeUpgradeReward,
          currency: level.currency,
          requirements: level.requirements,
          benefits: level.benefits,
          _id: level._id
        }))
      });
    } catch (error) {
      console.error('Error getting VIP levels:', error);
      res.status(500).json({ 
        message: 'Failed to get VIP levels',
        error: error.message 
      });
    }
  }

  /**
   * Force update user's VIP level (useful for testing)
   */
  async updateVIPLevel(req, res) {
    try {
      // Add session validation for VIP level updates
      if (!req.session?.user || !req.sessionID) {
        return res.status(401).json({ 
          success: false,
          message: 'Session validation failed. Please login again.',
          code: 'VIP_UPDATE_SESSION_REQUIRED'
        });
      }

      const userId = req.user._id;
      
      const result = await VIPService.updateUserVIPLevel(userId);
      
      res.json({
        ...result,
        sessionInfo: {
          updatedAt: new Date(),
          sessionId: req.sessionID
        }
      });
    } catch (error) {
      console.error('Error updating VIP level:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to update VIP level',
        error: error.message 
      });
    }
  }

  // ADMIN METHODS

  /**
   * Admin: Create or update VIP level
   */
  async createOrUpdateVIPLevel(req, res) {
    try {
      // Enhanced admin session validation
      if (!req.session?.admin || !req.sessionID) {
        return res.status(401).json({ 
          success: false,
          message: 'Admin session validation failed. Please login again.',
          code: 'ADMIN_VIP_SESSION_REQUIRED'
        });
      }

      const adminId = req.admin._id;
      const {
        level,
        name,
        minimumLevel1Referrals,
        minimumTotalReferrals,
        dailyReward,
        oneTimeUpgradeReward,
        currency = 'USDT',
        requirements,
        benefits
      } = req.body;
      if (level < 0) {
        return res.status(400).json({ message: 'VIP level cannot be negative' });
      }

      // Check if level already exists
      let vipLevel = await VIPLevel.findOne({ level });
      
      if (vipLevel) {
        // Update existing level
        vipLevel.name = name;
        vipLevel.minimumLevel1Referrals = minimumLevel1Referrals;
        vipLevel.minimumTotalReferrals = minimumTotalReferrals;
        vipLevel.dailyReward = dailyReward;
        vipLevel.oneTimeUpgradeReward = oneTimeUpgradeReward;
        vipLevel.currency = currency;
        vipLevel.requirements = requirements;
        vipLevel.benefits = benefits;
        vipLevel.updatedBy = adminId;
      } else {
        // Create new level
        vipLevel = new VIPLevel({
          level,
          name,
          minimumLevel1Referrals,
          minimumTotalReferrals,
          dailyReward,
          oneTimeUpgradeReward,
          currency,
          requirements,
          benefits,
          createdBy: adminId
        });
      }

      await vipLevel.save();

      res.json({
        success: true,
        message: `VIP level ${level} ${vipLevel.isNew ? 'created' : 'updated'} successfully`,
        vipLevel,
        adminInfo: {
          modifiedBy: adminId,
          sessionId: req.sessionID,
          modifiedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error creating/updating VIP level:', error);
      res.status(500).json({ 
        message: 'Failed to create/update VIP level',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Delete VIP level
   */
  async deleteVIPLevel(req, res) {
    try {
      // Admin session validation for critical operations
      if (!req.session?.admin || !req.sessionID) {
        return res.status(401).json({ 
          success: false,
          message: 'Admin session validation failed. Please login again.',
          code: 'ADMIN_DELETE_SESSION_REQUIRED'
        });
      }

      const { level } = req.params;

      if (level == 0) {
        return res.status(400).json({ message: 'Cannot delete VIP level 0' });
      }

      // Soft delete by setting isActive to false
      const vipLevel = await VIPLevel.findOneAndUpdate(
        { level: parseInt(level) },
        { isActive: false },
        { new: true }
      );

      if (!vipLevel) {
        return res.status(404).json({ message: 'VIP level not found' });
      }

      res.json({
        success: true,
        message: `VIP level ${level} deactivated successfully`,
        adminInfo: {
          deletedBy: req.admin._id,
          sessionId: req.sessionID,
          deletedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error deleting VIP level:', error);
      res.status(500).json({ 
        message: 'Failed to delete VIP level',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Get all VIP levels (including inactive)
   */
  async getAllVIPLevels(req, res) {
    try {
      const vipLevels = await VIPLevel.find({})
        .populate('createdBy', 'username')
        .populate('updatedBy', 'username')
        .sort({ level: 1 });
      
      res.json({ vipLevels });
    } catch (error) {
      console.error('Error getting all VIP levels:', error);
      res.status(500).json({ 
        message: 'Failed to get VIP levels',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Get VIP statistics
   */
  async getVIPStatistics(req, res) {
    try {
      const statistics = await VIPService.getVIPStatistics();
      res.json(statistics);
    } catch (error) {
      console.error('Error getting VIP statistics:', error);
      res.status(500).json({ 
        message: 'Failed to get VIP statistics',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Get all rewards with pagination
   */
  async getAllRewards(req, res) {
    try {
      const { page = 1, limit = 20, status, rewardType, userId } = req.query;
      
      const query = {};
      if (status) query.status = status;
      if (rewardType) query.rewardType = rewardType;
      if (userId) query.user = userId;
      
      const rewards = await VIPReward.find(query)
        .populate('user', 'username email vipLevel')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
      
      const total = await VIPReward.countDocuments(query);
      
      res.json({
        rewards,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
          total
        }
      });
    } catch (error) {
      console.error('Error getting all rewards:', error);
      res.status(500).json({ 
        message: 'Failed to get rewards',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Manually set user VIP level
   */
  async setUserVIPLevel(req, res) {
    try {
      // Enhanced admin session validation for user modifications
      if (!req.session?.admin || !req.sessionID) {
        return res.status(401).json({ 
          success: false,
          message: 'Admin session validation failed. Please login again.',
          code: 'ADMIN_USER_MODIFY_SESSION_REQUIRED'
        });
      }

      const { userId, vipLevel } = req.body;
      
      if (vipLevel < 0) {
        return res.status(400).json({ message: 'VIP level cannot be negative' });
      }

      // Check if VIP level exists
      const levelExists = await VIPLevel.findOne({ level: vipLevel, isActive: true });
      if (vipLevel > 0 && !levelExists) {
        return res.status(400).json({ message: 'VIP level does not exist' });
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { 
          vipLevel: vipLevel,
          vipUpgradedAt: new Date()
        },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        success: true,
        message: `User VIP level set to ${vipLevel}`,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          vipLevel: user.vipLevel
        },
        adminInfo: {
          modifiedBy: req.admin._id,
          sessionId: req.sessionID,
          modifiedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error setting user VIP level:', error);
      res.status(500).json({ 
        message: 'Failed to set user VIP level',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Create daily rewards for all eligible users
   */
  async createAllDailyRewards(req, res) {
    try {
      const result = await VIPService.createDailyRewardsForAllUsers();
      
      res.json({
        success: true,
        message: `Created ${result.created} daily rewards for ${result.total} VIP users`,
        statistics: result
      });
    } catch (error) {
      console.error('Error creating all daily rewards:', error);
      res.status(500).json({ 
        message: 'Failed to create daily rewards',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Force expire old rewards
   */
  async expireOldRewards(req, res) {
    try {
      const result = await VIPService.expireOldRewards();
      
      res.json({
        success: true,
        message: `Expired ${result.modifiedCount} old rewards`,
        result
      });
    } catch (error) {
      console.error('Error expiring old rewards:', error);
      res.status(500).json({ 
        message: 'Failed to expire old rewards',
        error: error.message 
      });
    }
  }
}

module.exports = new VIPController();
