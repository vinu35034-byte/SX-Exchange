const Trader = require('../models/trader');
const CopyTradingFollower = require('../models/copyTradingFollower');
const CopyTradingTransaction = require('../models/copyTradingTransaction');
const UnfollowRequest = require('../models/unfollowRequest');
const User = require('../models/user');
const { createLogger } = require('../utils/logger');
const { escapeRegex } = require('../middlewares/securityMiddleware');

const logger = createLogger('copy-trading-controller');

class CopyTradingController {
  /**
   * Get all available traders (for users to follow)
   */
  async getAvailableTraders(req, res) {
    try {
      const { page = 1, limit = 10, sort = 'totalFollowers' } = req.query;

      // Whitelist allowed sort fields
      const ALLOWED_SORT_FIELDS = ['totalFollowers', 'winRate', 'totalProfitLoss', 'totalReturn', 'createdAt'];
      const safeSort = ALLOWED_SORT_FIELDS.includes(sort) ? sort : 'totalFollowers';

      const traders = await Trader.find({
        isActive: true,
        isVerified: true
      })
        .select('-__v')
        .sort({ [safeSort]: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      const total = await Trader.countDocuments({
        isActive: true,
        isVerified: true
      });

      res.json({
        success: true,
        data: traders,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error fetching available traders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch traders',
        error: error.message
      });
    }
  }

  /**
   * Get trader details
   */
  async getTraderDetails(req, res) {
    try {
      const { traderId } = req.params;

      const trader = await Trader.findById(traderId).lean();

      if (!trader) {
        return res.status(404).json({
          success: false,
          message: 'Trader not found'
        });
      }

      res.json({
        success: true,
        data: trader
      });
    } catch (error) {
      logger.error('Error fetching trader details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch trader details',
        error: error.message
      });
    }
  }

  /**
   * Follow a trader
   */
  async followTrader(req, res) {
    try {
      const userId = req.user._id;
      const { traderId, initialAmount } = req.body;

      // Validate inputs
      if (!traderId || !initialAmount || initialAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid trader ID and amount are required'
        });
      }

      // Check if trader exists and is active
      const trader = await Trader.findById(traderId);
      if (!trader || !trader.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Trader not found or inactive'
        });
      }

      // Check if user is already following this trader (only active followings)
      const existing = await CopyTradingFollower.findOne({
        user: userId,
        trader: traderId,
        isActive: true
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'You are already following this trader'
        });
      }

      // Check user balance
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get USDT balance - handle both Map and direct number formats
      let currentUSDT = 0;
      
      if (user.balances) {
        const usdtData = user.balances.get ? user.balances.get('USDT') : user.balances['USDT'];
        currentUSDT = parseFloat(usdtData) || 0;
      }
      
      logger.info(`Follow check - userId: ${userId}, currentBalance: ${currentUSDT}, requestAmount: ${initialAmount}`);

      if (currentUSDT < initialAmount) {
        return res.status(400).json({
          success: false,
          message: `Insufficient balance! You have $${currentUSDT.toFixed(2)} USDT`,
          data: {
            currentBalance: currentUSDT,
            requestedAmount: initialAmount,
            shortfall: initialAmount - currentUSDT
          }
        });
      }

      // Create copy trading follower record
      const following = new CopyTradingFollower({
        user: userId,
        trader: traderId,
        initialAmount,
        currentBalance: initialAmount,
        totalInvested: initialAmount
      });

      await following.save();

      // Deduct amount from user balance ATOMICALLY (prevent double-spend race condition)
      const atomicResult = await User.findOneAndUpdate(
        { _id: userId, 'balances.USDT': { $gte: initialAmount } },
        { $inc: { 'balances.USDT': -initialAmount } },
        { new: true }
      );
      if (!atomicResult) {
        // Race condition: balance was modified concurrently, clean up the following record
        await CopyTradingFollower.findByIdAndDelete(following._id);
        return res.status(400).json({
          success: false,
          message: 'Insufficient balance (concurrent modification). Please try again.'
        });
      }
      const newUSDT = atomicResult.balances.get('USDT') || 0;
      logger.info(`Follow: Deducted ${initialAmount} from user ${userId}. Balance: ${currentUSDT} -> ${newUSDT}`);

      // Create transaction record
      const transaction = new CopyTradingTransaction({
        user: userId,
        trader: traderId,
        copyTradingFollower: following._id,
        type: 'follow',
        amount: initialAmount,
        followerAmount: initialAmount,
        status: 'completed'
      });

      await transaction.save();

      // Increment trader followers count
      trader.totalFollowers += 1;
      trader.totalInvested = (trader.totalInvested || 0) + initialAmount;
      await trader.save();

      res.json({
        success: true,
        message: 'Successfully started following trader',
        data: following
      });
    } catch (error) {
      logger.error('Error following trader:', error);
      
      // Handle duplicate key error specifically
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'You are already following this trader or have a pending follow request'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to follow trader',
        error: error.message
      });
    }
  }

  /**
   * Get user's followings
   */
  async getMyFollowings(req, res) {
    try {
      const userId = req.user._id;
      const { page = 1, limit = 10 } = req.query;

      const followings = await CopyTradingFollower.find({ user: userId, isActive: true })
        .populate('trader', '-__v')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      const total = await CopyTradingFollower.countDocuments({ user: userId, isActive: true });

      res.json({
        success: true,
        data: followings,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error fetching followings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch followings',
        error: error.message
      });
    }
  }

  /**
   * Request to unfollow a trader (creates request for admin approval)
   */
  async unfollowTrader(req, res) {
    try {
      const userId = req.user._id;
      const { followingId } = req.params;

      logger.info(`Unfollow request - userId: ${userId}, followingId: ${followingId}`);

      const following = await CopyTradingFollower.findById(followingId);

      if (!following) {
        logger.warn(`Following record not found: ${followingId}`);
        return res.status(404).json({
          success: false,
          message: 'Following record not found'
        });
      }

      if (following.user.toString() !== userId.toString()) {
        logger.warn(`User mismatch - following.user: ${following.user}, userId: ${userId}`);
        return res.status(404).json({
          success: false,
          message: 'Following record not found'
        });
      }

      // Check if there's already a pending request
      const existingRequest = await UnfollowRequest.findOne({
        copyTradingFollower: followingId,
        status: 'pending'
      });

      if (existingRequest) {
        logger.warn(`Pending request already exists for ${followingId}`);
        return res.status(400).json({
          success: false,
          message: 'You already have a pending unfollow request'
        });
      }

      // Create unfollow request
      const unfollowRequest = new UnfollowRequest({
        user: userId,
        trader: following.trader,
        copyTradingFollower: followingId,
        investedAmount: following.initialAmount,
        currentBalance: following.currentBalance,
        status: 'pending'
      });

      await unfollowRequest.save();
      logger.info(`Unfollow request created: ${unfollowRequest._id}`);

      res.json({
        success: true,
        message: 'Unfollow request submitted. Awaiting admin approval.',
        data: {
          requestId: unfollowRequest._id,
          status: 'pending'
        }
      });
    } catch (error) {
      logger.error('Error creating unfollow request:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create unfollow request',
        error: error.message
      });
    }
  }

  /**
   * Get pending unfollow requests (Admin)
   */
  async getPendingUnfollowRequests(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;

      const requests = await UnfollowRequest.find({ status: 'pending' })
        .populate('user', 'email username')
        .populate('trader', 'name')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      const total = await UnfollowRequest.countDocuments({ status: 'pending' });

      res.json({
        success: true,
        data: requests,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error fetching unfollow requests:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch unfollow requests',
        error: error.message
      });
    }
  }

  /**
   * Approve unfollow request and process it (Admin)
   */
  async approveUnfollowRequest(req, res) {
    try {
      const { requestId } = req.params;
      const { profitLoss, adminNotes } = req.body;

      logger.info(`Approving unfollow request: ${requestId}, profitLoss: ${profitLoss}`);

      const unfollowRequest = await UnfollowRequest.findById(requestId);

      if (!unfollowRequest) {
        logger.warn(`Unfollow request not found: ${requestId}`);
        return res.status(404).json({
          success: false,
          message: 'Unfollow request not found'
        });
      }

      if (unfollowRequest.status !== 'pending') {
        logger.warn(`Request already processed: ${requestId}`);
        return res.status(400).json({
          success: false,
          message: 'This request has already been processed'
        });
      }

      // Calculate final return amount
      const finalReturnAmount = unfollowRequest.currentBalance + (profitLoss || 0);

      // Get the following record
      const following = await CopyTradingFollower.findById(unfollowRequest.copyTradingFollower);
      if (!following) {
        logger.error(`Following record not found: ${unfollowRequest.copyTradingFollower}`);
        return res.status(404).json({
          success: false,
          message: 'Following record not found'
        });
      }

      // Get user and update balance
      const user = await User.findById(unfollowRequest.user);
      if (!user) {
        logger.error(`User not found: ${unfollowRequest.user}`);
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Update user's USDT balance
      // Update user's USDT balance ATOMICALLY (prevent lost-update race condition)
      await User.updateOne(
        { _id: unfollowRequest.user },
        { $inc: { 'balances.USDT': finalReturnAmount } }
      );
      logger.info(`User balance updated atomically - added: ${finalReturnAmount}`);

      // Create withdrawal transaction
      const transaction = new CopyTradingTransaction({
        user: unfollowRequest.user,
        trader: unfollowRequest.trader,
        copyTradingFollower: unfollowRequest.copyTradingFollower,
        type: 'unfollow',
        amount: finalReturnAmount,
        followerAmount: finalReturnAmount,
        status: 'completed',
        notes: `Admin approved with profit/loss adjustment: ${profitLoss || 0}`,
        adminNotes: adminNotes || ''
      });
      await transaction.save();
      logger.info(`Unfollow transaction created with amount: ${finalReturnAmount}`);

      // Update following status
      following.status = 'stopped';
      following.isActive = false;
      following.stoppedDate = new Date();
      await following.save();
      logger.info(`Following marked as stopped`);

      // Decrement trader followers (ensure it doesn't go negative)
      const trader = await Trader.findById(following.trader);
      if (trader) {
        trader.totalFollowers = Math.max(0, (trader.totalFollowers || 0) - 1);
        await trader.save();
        logger.info(`Trader followers decremented to ${trader.totalFollowers}`);
      }

      // Update unfollow request
      unfollowRequest.status = 'approved';
      unfollowRequest.profitLoss = profitLoss || 0;
      unfollowRequest.finalReturnAmount = finalReturnAmount;
      unfollowRequest.adminNotes = adminNotes || '';
      unfollowRequest.approvedBy = req.user._id;
      unfollowRequest.approvedAt = new Date();
      await unfollowRequest.save();
      logger.info(`Unfollow request approved and processed`);

      res.json({
        success: true,
        message: 'Unfollow request approved and processed',
        data: {
          finalReturnAmount,
          profitLoss
        }
      });
    } catch (error) {
      logger.error('Error approving unfollow request:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to approve unfollow request',
        error: error.message
      });
    }
  }

  /**
   * Reject unfollow request (Admin)
   */
  async rejectUnfollowRequest(req, res) {
    try {
      const { requestId } = req.params;
      const { rejectionReason } = req.body;

      logger.info(`Rejecting unfollow request: ${requestId}`);

      const unfollowRequest = await UnfollowRequest.findById(requestId);

      if (!unfollowRequest) {
        logger.warn(`Unfollow request not found: ${requestId}`);
        return res.status(404).json({
          success: false,
          message: 'Unfollow request not found'
        });
      }

      if (unfollowRequest.status !== 'pending') {
        logger.warn(`Request already processed: ${requestId}`);
        return res.status(400).json({
          success: false,
          message: 'This request has already been processed'
        });
      }

      // Update request status
      unfollowRequest.status = 'rejected';
      unfollowRequest.rejectionReason = rejectionReason || 'Request rejected by admin';
      await unfollowRequest.save();
      logger.info(`Unfollow request rejected`);

      res.json({
        success: true,
        message: 'Unfollow request rejected'
      });
    } catch (error) {
      logger.error('Error rejecting unfollow request:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reject unfollow request',
        error: error.message
      });
    }
  }

  /**
   * Bulk approve all pending unfollow requests (Admin)
   */
  async bulkApproveUnfollowRequests(req, res) {
    try {
      const { profitLossPercentage = 0, adminNotes = 'Bulk approved by admin' } = req.body;

      logger.info(`Bulk approving unfollow requests with ${profitLossPercentage}% P/L adjustment`);

      // Get all pending requests
      const pendingRequests = await UnfollowRequest.find({ status: 'pending' })
        .populate('copyTradingFollower')
        .populate('user')
        .populate('trader');

      if (pendingRequests.length === 0) {
        return res.json({
          success: true,
          message: 'No pending unfollow requests to process',
          data: {
            processed: 0,
            succeeded: 0,
            failed: 0,
            totalReturned: 0
          }
        });
      }

      let succeeded = 0;
      let failed = 0;
      let totalReturned = 0;
      const errors = [];
      const traderFollowerUpdates = new Map(); // Track follower count changes per trader

      // Process each request
      for (const unfollowRequest of pendingRequests) {
        try {
          // Calculate profit/loss based on percentage
          const profitLoss = (unfollowRequest.currentBalance * profitLossPercentage) / 100;
          const finalReturnAmount = unfollowRequest.currentBalance + profitLoss;

          // Get the following record
          const following = await CopyTradingFollower.findById(unfollowRequest.copyTradingFollower);
          if (!following) {
            failed++;
            errors.push(`Following record not found for request ${unfollowRequest._id}`);
            continue;
          }

          // Get user and update balance
          const user = await User.findById(unfollowRequest.user);
          if (!user) {
            failed++;
            errors.push(`User not found for request ${unfollowRequest._id}`);
            continue;
          }

          // Update user's USDT balance ATOMICALLY (prevent lost-update race condition)
          await User.updateOne(
            { _id: unfollowRequest.user },
            { $inc: { 'balances.USDT': finalReturnAmount } }
          );

          // Create unfollow transaction
          const transaction = new CopyTradingTransaction({
            user: unfollowRequest.user,
            trader: unfollowRequest.trader,
            copyTradingFollower: unfollowRequest.copyTradingFollower,
            type: 'unfollow',
            amount: finalReturnAmount,
            followerAmount: finalReturnAmount,
            status: 'completed',
            notes: `Bulk approved: ${adminNotes} (${profitLossPercentage}% adjustment)`,
            adminNotes: adminNotes
          });
          await transaction.save();

          // Update following status
          following.status = 'stopped';
          following.isActive = false;
          following.stoppedDate = new Date();
          await following.save();

          // Track trader follower count changes
          const traderId = following.trader.toString();
          traderFollowerUpdates.set(traderId, (traderFollowerUpdates.get(traderId) || 0) + 1);

          // Update unfollow request
          unfollowRequest.status = 'approved';
          unfollowRequest.profitLoss = profitLoss;
          unfollowRequest.finalReturnAmount = finalReturnAmount;
          unfollowRequest.adminNotes = adminNotes;
          unfollowRequest.approvedBy = req.user._id;
          unfollowRequest.approvedAt = new Date();
          await unfollowRequest.save();

          succeeded++;
          totalReturned += finalReturnAmount;

          logger.info(`Bulk approved request ${unfollowRequest._id}, returned $${finalReturnAmount}`);
        } catch (error) {
          failed++;
          errors.push(`Error processing request ${unfollowRequest._id}: ${error.message}`);
          logger.error(`Error in bulk approve for request ${unfollowRequest._id}:`, error);
        }
      }

      // Update all affected traders' follower counts
      for (const [traderId, decrementCount] of traderFollowerUpdates.entries()) {
        try {
          const trader = await Trader.findById(traderId);
          if (trader) {
            trader.totalFollowers = Math.max(0, (trader.totalFollowers || 0) - decrementCount);
            await trader.save();
            logger.info(`Updated trader ${traderId} followers: -${decrementCount} to ${trader.totalFollowers}`);
          }
        } catch (error) {
          logger.error(`Error updating trader ${traderId} follower count:`, error);
        }
      }

      const response = {
        success: true,
        message: `Bulk approval completed: ${succeeded} succeeded, ${failed} failed`,
        data: {
          processed: pendingRequests.length,
          succeeded,
          failed,
          totalReturned: totalReturned.toFixed(2),
          tradersAffected: traderFollowerUpdates.size
        }
      };

      if (errors.length > 0) {
        response.errors = errors;
      }

      res.json(response);
    } catch (error) {
      logger.error('Error in bulk approve unfollow requests:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to bulk approve unfollow requests',
        error: error.message
      });
    }
  }

  /**
   * Bulk reject all pending unfollow requests (Admin)
   */
  async bulkRejectUnfollowRequests(req, res) {
    try {
      const { rejectionReason = 'Bulk rejected by admin' } = req.body;

      logger.info(`Bulk rejecting unfollow requests`);

      // Get all pending requests
      const pendingRequests = await UnfollowRequest.find({ status: 'pending' });

      if (pendingRequests.length === 0) {
        return res.json({
          success: true,
          message: 'No pending unfollow requests to reject',
          data: {
            processed: 0,
            rejected: 0
          }
        });
      }

      let rejected = 0;

      // Reject each request
      for (const unfollowRequest of pendingRequests) {
        try {
          unfollowRequest.status = 'rejected';
          unfollowRequest.rejectionReason = rejectionReason;
          await unfollowRequest.save();
          rejected++;
          logger.info(`Bulk rejected request ${unfollowRequest._id}`);
        } catch (error) {
          logger.error(`Error rejecting request ${unfollowRequest._id}:`, error);
        }
      }

      res.json({
        success: true,
        message: `Bulk rejection completed: ${rejected} requests rejected`,
        data: {
          processed: pendingRequests.length,
          rejected
        }
      });
    } catch (error) {
      logger.error('Error in bulk reject unfollow requests:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to bulk reject unfollow requests',
        error: error.message
      });
    }
  }

  /**
   * Get copy trading dashboard for user
   */
  async getCopyTradingDashboard(req, res) {
    try {
      const userId = req.user._id;

      // Get total invested (all-time, including inactive)
      const allFollowings = await CopyTradingFollower.find({ user: userId });
      const totalInvested = allFollowings.reduce((sum, f) => sum + f.initialAmount, 0);

      // Get active followings count
      const activeFollowings = await CopyTradingFollower.countDocuments({ user: userId, isActive: true });

      // Get total returns (all-time) - including both passive_income and trade profits
      const returns = await CopyTradingTransaction.find({
        user: userId,
        status: 'completed',
        $or: [
          { type: 'passive_income' },
          { type: 'trade', 'trade.tradeType': 'SELL' }
        ]
      });
      const totalReturns = returns.reduce((sum, t) => sum + (t.followerAmount || 0), 0);

      // Get recent transactions
      const recentTransactions = await CopyTradingTransaction.find({ user: userId })
        .populate('trader', 'name profileImage')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      res.json({
        success: true,
        data: {
          totalInvested,
          totalReturns,
          activeFollowings,
          recentTransactions
        }
      });
    } catch (error) {
      logger.error('Error fetching dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard',
        error: error.message
      });
    }
  }

  // ========== ADMIN ENDPOINTS ==========

  /**
   * Create a new trader (Admin only)
   */
  async createTrader(req, res) {
    try {
      const {
        name,
        bio,
        profileImage,
        winRate,
        totalFollowers,
        commissionPercentage,
        platformFeePercentage,
        followerCommissionPercentage
      } = req.body;

      // Validate inputs
      if (!name || commissionPercentage === undefined || followerCommissionPercentage === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }

      // Validate percentages
      const totalPercentage = commissionPercentage + platformFeePercentage + followerCommissionPercentage;
      if (totalPercentage > 100) {
        return res.status(400).json({
          success: false,
          message: 'Total commission percentages cannot exceed 100%'
        });
      }

      const trader = new Trader({
        name,
        bio,
        profileImage,
        winRate,
        commissionPercentage,
        platformFeePercentage,
        followerCommissionPercentage,
        isVerified: true,
        verifiedBy: req.user._id,
        verificationDate: new Date(),
        totalFollowers: totalFollowers !== undefined ? totalFollowers : 5  // Use provided value or default to 5
      });

      await trader.save();

      res.status(201).json({
        success: true,
        message: 'Trader created successfully',
        data: trader
      });
    } catch (error) {
      logger.error('Error creating trader:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create trader',
        error: error.message
      });
    }
  }

  /**
   * Update trader details (Admin only)
   */
  async updateTrader(req, res) {
    try {
      const { traderId } = req.params;
      const { name, bio, profileImage, winRate, commissionPercentage, platformFeePercentage, followerCommissionPercentage, isActive } = req.body;

      const trader = await Trader.findById(traderId);
      if (!trader) {
        return res.status(404).json({
          success: false,
          message: 'Trader not found'
        });
      }

      // Update fields
      if (name) trader.name = name;
      if (bio !== undefined) trader.bio = bio;
      if (profileImage !== undefined) trader.profileImage = profileImage;
      if (winRate !== undefined) trader.winRate = winRate;
      if (commissionPercentage !== undefined) trader.commissionPercentage = commissionPercentage;
      if (platformFeePercentage !== undefined) trader.platformFeePercentage = platformFeePercentage;
      if (followerCommissionPercentage !== undefined) trader.followerCommissionPercentage = followerCommissionPercentage;
      if (isActive !== undefined) trader.isActive = isActive;

      await trader.save();

      res.json({
        success: true,
        message: 'Trader updated successfully',
        data: trader
      });
    } catch (error) {
      logger.error('Error updating trader:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update trader',
        error: error.message
      });
    }
  }

  /**
   * Delete trader (Admin only)
   */
  async deleteTrader(req, res) {
    try {
      const { traderId } = req.params;

      const trader = await Trader.findById(traderId);
      if (!trader) {
        return res.status(404).json({
          success: false,
          message: 'Trader not found'
        });
      }

      // Check if trader has active followers
      const activeFollowers = await CopyTradingFollower.countDocuments({
        trader: traderId,
        isActive: true
      });

      if (activeFollowers > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete trader with ${activeFollowers} active followers. Please ensure all followers have unfollowed first.`
        });
      }

      // Delete the trader
      await Trader.findByIdAndDelete(traderId);

      logger.info(`Trader deleted: ${traderId} by admin: ${req.user._id}`);

      res.json({
        success: true,
        message: 'Trader deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting trader:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete trader',
        error: error.message
      });
    }
  }

  /**
   * Get all traders (Admin)
   */
  async getAllTraders(req, res) {
    try {
      const { page = 1, limit = 10, isActive } = req.query;

      const query = {};
      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }

      const traders = await Trader.find(query)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      const total = await Trader.countDocuments(query);

      res.json({
        success: true,
        data: traders,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error fetching traders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch traders',
        error: error.message
      });
    }
  }

  /**
   * Get followers for a specific trader (Admin)
   */
  async getTraderFollowers(req, res) {
    try {
      const { traderId } = req.params;
      const { page = 1, limit = 20, isActive } = req.query;

      const query = { trader: traderId };
      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }

      const followers = await CopyTradingFollower.find(query)
        .populate('user', 'email fullName username createdAt')
        .populate('trader', 'name profileImage')
        .sort({ followedDate: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      const total = await CopyTradingFollower.countDocuments(query);

      res.json({
        success: true,
        data: {
          followers,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching trader followers:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch followers',
        error: error.message
      });
    }
  }

  /**
   * Get all follower relationships (Admin)
   */
  async getAllFollowerRelationships(req, res) {
    try {
      const { page = 1, limit = 50, isActive, userId, traderId } = req.query;

      const query = {};
      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }
      if (userId) {
        query.user = userId;
      }
      if (traderId) {
        query.trader = traderId;
      }

      const relationships = await CopyTradingFollower.find(query)
        .populate('user', 'email fullName username')
        .populate('trader', 'name profileImage winRate')
        .sort({ followedDate: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      const total = await CopyTradingFollower.countDocuments(query);

      // Get aggregated stats
      const stats = await CopyTradingFollower.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalInvested: { $sum: '$initialAmount' },
            totalCurrentBalance: { $sum: '$currentBalance' },
            totalReturns: { $sum: '$totalReturns' },
            activeCount: {
              $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
            }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          relationships,
          stats: stats[0] || {
            totalInvested: 0,
            totalCurrentBalance: 0,
            totalReturns: 0,
            activeCount: 0
          },
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching follower relationships:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch follower relationships',
        error: error.message
      });
    }
  }

  /**
   * Get copy trading statistics (Admin)
   */
  async getCopyTradingStats(req, res) {
    try {
      const totalTraders = await Trader.countDocuments({ isActive: true });
      const totalFollowers = await CopyTradingFollower.countDocuments({ isActive: true });
      const totalTransactions = await CopyTradingTransaction.countDocuments();

      const totalDistributed = await CopyTradingTransaction.aggregate([
        { $match: { type: 'passive_income', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$followerAmount' } } }
      ]);

      const traderStats = await Trader.find({ isActive: true })
        .select('name totalFollowers totalEarned totalDistributed')
        .sort({ totalFollowers: -1 })
        .limit(10)
        .lean();

      // Get follower breakdown by trader
      const followersByTrader = await CopyTradingFollower.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$trader',
            activeFollowers: { $sum: 1 },
            totalInvested: { $sum: '$currentBalance' }
          }
        },
        {
          $lookup: {
            from: 'traders',
            localField: '_id',
            foreignField: '_id',
            as: 'traderInfo'
          }
        },
        { $unwind: '$traderInfo' },
        {
          $project: {
            traderId: '$_id',
            traderName: '$traderInfo.name',
            activeFollowers: 1,
            totalInvested: 1
          }
        },
        { $sort: { activeFollowers: -1 } },
        { $limit: 10 }
      ]);

      res.json({
        success: true,
        data: {
          totalTraders,
          totalFollowers,
          totalTransactions,
          totalDistributed: totalDistributed[0]?.total || 0,
          topTraders: traderStats,
          followersByTrader
        }
      });
    } catch (error) {
      logger.error('Error fetching stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch statistics',
        error: error.message
      });
    }
  }

  /**
   * Get user's own copy trading transactions
   */
  async getMyTransactions(req, res) {
    try {
      const userId = req.user._id;
      const { page = 1, limit = 20, type } = req.query;

      logger.info(`Fetching transactions for user: ${userId}`);

      const query = { user: userId };
      if (type) {
        query.type = type;
      }

      const transactions = await CopyTradingTransaction.find(query)
        .populate('trader', 'name profileImage')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      logger.info(`Found ${transactions.length} transactions for user ${userId}`);

      const total = await CopyTradingTransaction.countDocuments(query);

      // Get summary stats
      const summary = await CopyTradingTransaction.aggregate([
        { $match: { user: userId } },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$followerAmount' },
            count: { $sum: 1 }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          transactions,
          summary,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching user transactions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch transactions',
        error: error.message
      });
    }
  }

  /**
   * Get follower transactions (Admin)
   */
  async getFollowerTransactions(req, res) {
    try {
      const { followerId, page = 1, limit = 10 } = req.query;

      const query = {};
      if (followerId) {
        query.copyTradingFollower = followerId;
      }

      const transactions = await CopyTradingTransaction.find(query)
        .populate('user', 'email username')
        .populate('trader', 'name')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      const total = await CopyTradingTransaction.countDocuments(query);

      res.json({
        success: true,
        data: transactions,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error fetching transactions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch transactions',
        error: error.message
      });
    }
  }

  /**
   * Execute trade for a trader (Admin only)
   * Creates BUY and SELL transactions for all followers
   * Distributes profit/loss and auto-unfollows all followers
   */
  async executeTrade(req, res) {
    try {
      const { traderId, coins, totalProfitLossPercentage } = req.body;
      const adminId = req.admin._id;

      // Validate inputs
      if (!traderId || !coins || coins.length === 0 || totalProfitLossPercentage === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: traderId, coins, totalProfitLossPercentage'
        });
      }

      // Randomly distribute the total profit/loss percentage across coins
      const distributeProfitLoss = (total, numCoins) => {
        if (numCoins === 1) return [total];
        
        const percentages = [];
        let remaining = total;
        
        // Generate random splits
        for (let i = 0; i < numCoins - 1; i++) {
          // Random percentage between 10% and 50% of remaining
          const minShare = remaining * 0.1;
          const maxShare = remaining * 0.5;
          const share = Math.random() * (maxShare - minShare) + minShare;
          percentages.push(parseFloat(share.toFixed(2)));
          remaining -= percentages[i];
        }
        
        // Last coin gets the remainder to ensure exact total
        percentages.push(parseFloat(remaining.toFixed(2)));
        
        return percentages;
      };

      const coinPercentages = distributeProfitLoss(totalProfitLossPercentage, coins.length);
      
      console.log('Total P/L:', totalProfitLossPercentage);
      console.log('Distributed percentages:', coinPercentages);
      console.log('Coins:', coins.map((c, i) => `${c.symbol}: ${coinPercentages[i]}%`));

      // Get all active followers for this trader
      console.log('Looking for followers with traderId:', traderId);
      const followers = await CopyTradingFollower.find({
        trader: traderId,
        isActive: true
      }).populate('user', 'email username');
      
      console.log('Found followers:', followers.length);

      if (followers.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No active followers found for this trader'
        });
      }

      const results = {
        totalFollowers: followers.length,
        successCount: 0,
        failCount: 0,
        totalProfitDistributed: 0,
        totalLossDistributed: 0,
        transactions: [],
        coinsProcessed: coins.length
      };

      // Batch processing configuration
      const BATCH_SIZE = 100;
      const totalBatches = Math.ceil(followers.length / BATCH_SIZE);
      
      console.log(`Processing ${followers.length} followers in ${totalBatches} batches of ${BATCH_SIZE}`);
      console.log(`Processing ${coins.length} coins per follower`);

      // Process followers in batches for better performance
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, followers.length);
        const batch = followers.slice(start, end);
        
        console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} followers)`);

        // Prepare bulk operations
        const transactionsToCreate = [];
        const followerUpdates = [];
        const userBalanceUpdates = new Map();

        for (const follower of batch) {
          try {
            const investmentAmount = follower.currentBalance || follower.initialAmount;
            let totalProfitLossForFollower = 0;

            // Process each coin for this follower
            for (let coinIndex = 0; coinIndex < coins.length; coinIndex++) {
              const coin = coins[coinIndex];
              const profitLossPercentage = coinPercentages[coinIndex];
              const currentPrice = coin.currentPrice;
              const sellPrice = currentPrice * (1 + profitLossPercentage / 100);
              
              // Calculate profit/loss for this coin
              const profitLossAmount = (investmentAmount * profitLossPercentage) / 100;
              const returnedAmount = investmentAmount + profitLossAmount;
              
              totalProfitLossForFollower += profitLossAmount;

              // Prepare BUY transaction for this coin
              transactionsToCreate.push({
                user: follower.user._id,
                trader: traderId,
                copyTradingFollower: follower._id,
                type: 'trade',
                amount: investmentAmount,
                trade: {
                  coin: {
                    symbol: coin.symbol.toUpperCase(),
                    name: coin.name,
                    image: coin.image
                  },
                  tradeType: 'BUY',
                  price: currentPrice,
                  profitLossPercentage: 0,
                  profitLossAmount: 0,
                  investmentAmount: investmentAmount,
                  returnedAmount: investmentAmount,
                  marketData: {}
                },
                status: 'completed',
                processedBy: adminId,
                processedAt: new Date()
              });

              // Prepare SELL transaction for this coin
              transactionsToCreate.push({
                user: follower.user._id,
                trader: traderId,
                copyTradingFollower: follower._id,
                type: 'trade',
                amount: returnedAmount,
                trade: {
                  coin: {
                    symbol: coin.symbol.toUpperCase(),
                    name: coin.name,
                    image: coin.image
                  },
                  tradeType: 'SELL',
                  price: sellPrice,
                  profitLossPercentage: profitLossPercentage,
                  profitLossAmount: profitLossAmount,
                  investmentAmount: investmentAmount,
                  returnedAmount: returnedAmount,
                  marketData: {}
                },
                followerAmount: profitLossAmount,
                status: 'completed',
                processedBy: adminId,
                processedAt: new Date()
              });
            }

            // Calculate total returned amount for all coins
            const totalReturnedAmount = investmentAmount + totalProfitLossForFollower;

            // Prepare follower update
            followerUpdates.push({
              updateOne: {
                filter: { _id: follower._id },
                update: {
                  $set: {
                    isActive: false,
                    status: 'stopped',
                    stoppedDate: new Date()
                  }
                }
              }
            });

            // Aggregate user balance updates
            const userId = follower.user._id.toString();
            if (!userBalanceUpdates.has(userId)) {
              userBalanceUpdates.set(userId, { userId: follower.user._id, amount: 0 });
            }
            userBalanceUpdates.get(userId).amount += totalReturnedAmount;

            // Track results
            results.successCount++;
            if (totalProfitLossForFollower >= 0) {
              results.totalProfitDistributed += totalProfitLossForFollower;
            } else {
              results.totalLossDistributed += Math.abs(totalProfitLossForFollower);
            }

            results.transactions.push({
              userId: follower.user._id,
              username: follower.user.username,
              investmentAmount,
              profitLossAmount: totalProfitLossForFollower,
              returnedAmount: totalReturnedAmount,
              coinsTraded: coins.length
            });

          } catch (error) {
            console.error(`Error preparing follower ${follower._id}:`, error);
            logger.error(`Error preparing follower ${follower._id}:`, error);
            results.failCount++;
          }
        }

        // Execute bulk operations for this batch
        try {
          // 1. Bulk insert transactions (ordered: true ensures BUY is stored before SELL)
          if (transactionsToCreate.length > 0) {
            await CopyTradingTransaction.insertMany(transactionsToCreate, { ordered: true });
            console.log(`Created ${transactionsToCreate.length} transactions`);
          }

          // 2. Bulk update followers
          if (followerUpdates.length > 0) {
            await CopyTradingFollower.bulkWrite(followerUpdates);
            console.log(`Updated ${followerUpdates.length} followers`);
          }

          // 3. Update user balances
          if (userBalanceUpdates.size > 0) {
            for (const [userId, updateData] of userBalanceUpdates) {
              const user = await User.findById(updateData.userId);
              if (user) {
                const currentBalance = user.balances.get('USDT') || 0;
                user.balances.set('USDT', currentBalance + updateData.amount);
                await user.save();
              }
            }
            console.log(`Updated ${userBalanceUpdates.size} user balances`);
          }

        } catch (error) {
          console.error(`Error executing bulk operations for batch ${batchIndex + 1}:`, error);
          logger.error(`Batch ${batchIndex + 1} execution error:`, error);
          // Continue with next batch even if this batch fails
        }

        console.log(`Completed batch ${batchIndex + 1}/${totalBatches}`);
      }

      // Calculate total profit/loss distributed (profit - loss)
      const totalProfitLossDistributed = results.totalProfitDistributed - results.totalLossDistributed;
      
      res.json({
        success: true,
        message: `Trade executed successfully for ${results.successCount} followers`,
        data: {
          ...results,
          totalProfitLossDistributed
        }
      });

    } catch (error) {
      logger.error('Error executing trade:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to execute trade',
        error: error.message
      });
    }
  }

  /**
   * Get user's copy trading transactions
   */
  async getUserTransactions(req, res) {
    try {
      const userId = req.user._id;
      const { page = 1, limit = 50, type, traderId } = req.query;

      const filter = { user: userId };
      if (type) filter.type = type;
      if (traderId) filter.trader = traderId;

      const transactions = await CopyTradingTransaction.find(filter)
        .populate('trader', 'name profileImage')
        .populate('copyTradingFollower', 'initialAmount currentBalance')
        .sort({ _id: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      // Format transactions with proper +/- signs and display amounts
      const formattedTransactions = transactions.map(tx => {
        let displayAmount = tx.amount;
        let sign = '';
        
        // Determine sign based on transaction type
        if (tx.type === 'follow') {
          // Follow = money going out (investment)
          sign = '-';
          displayAmount = tx.amount;
        } else if (tx.type === 'unfollow') {
          // Unfollow = money coming back
          sign = '+';
          displayAmount = tx.amount;
        } else if (tx.type === 'trade') {
          // For trades, use the tradeType
          if (tx.trade?.tradeType === 'BUY') {
            sign = '-';
            displayAmount = tx.trade.investmentAmount || tx.amount;
          } else if (tx.trade?.tradeType === 'SELL') {
            sign = '+';
            displayAmount = tx.trade.returnedAmount || tx.amount;
          }
        } else if (tx.type === 'passive_income' || tx.type === 'admin_distribution') {
          // Income = money coming in
          sign = '+';
          displayAmount = tx.followerAmount || tx.amount;
        } else if (tx.type === 'refund') {
          sign = '+';
          displayAmount = tx.amount;
        }
        
        return {
          ...tx,
          displayAmount,
          displaySign: sign,
          formattedAmount: `${sign}${displayAmount.toFixed(2)}`
        };
      });

      const total = await CopyTradingTransaction.countDocuments(filter);

      res.json({
        success: true,
        data: formattedTransactions,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error fetching user transactions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch transactions',
        error: error.message
      });
    }
  }

  /**
   * Get all copy trading transactions (Admin)
   */
  async getAllTransactions(req, res) {
    try {
      const { page = 1, limit = 50, type, traderId, userId } = req.query;

      const filter = {};
      if (type) filter.type = type;
      if (traderId) filter.trader = traderId;
      if (userId) filter.user = userId;

      const transactions = await CopyTradingTransaction.find(filter)
        .populate('user', 'email username')
        .populate('trader', 'name profileImage')
        .populate('copyTradingFollower', 'initialAmount currentBalance')
        .populate('processedBy', 'username email')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      const total = await CopyTradingTransaction.countDocuments(filter);

      // Calculate statistics
      const stats = await CopyTradingTransaction.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      res.json({
        success: true,
        data: transactions,
        stats,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error fetching all transactions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch transactions',
        error: error.message
      });
    }
  }
}

module.exports = new CopyTradingController();
