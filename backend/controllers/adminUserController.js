const User = require('../models/user');
const DepositTransaction = require('../models/depositTransaction');
const WithdrawalRequest = require('../models/withdrawalRequest');
const UserTransaction = require('../models/userTransaction');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { escapeRegex } = require('../middlewares/securityMiddleware');

const adminUserController = {
  // Get all users with pagination and filters
  async getAllUsers(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        search = '',
        status = 'all',
        kycStatus = 'all',
        vipLevel = 'all',
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      // Build filter object
      const filter = {};
      
      // Search filter
      if (search) {
        const safeSearch = escapeRegex(search);
        filter.$or = [
          { email: { $regex: safeSearch, $options: 'i' } },
          { username: { $regex: safeSearch, $options: 'i' } },
          { referralCode: { $regex: safeSearch, $options: 'i' } }
        ];
      }
      
      // Status filter
      if (status !== 'all') {
        if (status === 'active') filter.isActive = true;
        if (status === 'inactive') filter.isActive = false;
        if (status === 'banned') filter.banReason = { $exists: true, $ne: null };
      }
      
      // KYC filter
      if (kycStatus !== 'all') {
        filter.kycStatus = kycStatus;
      }
      
      // VIP level filter
      if (vipLevel !== 'all') {
        filter.vipLevel = parseInt(vipLevel);
      }

      // Sort object - whitelist allowed sort fields
      const ALLOWED_SORT_FIELDS = ['createdAt', 'email', 'username', 'lastLogin', 'vipLevel', 'isActive'];
      const safeSortBy = ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'createdAt';
      const sort = {};
      sort[safeSortBy] = sortOrder === 'desc' ? -1 : 1;

      // Get users with pagination
      const users = await User.find(filter)
        .select('-passwordHash -twoFactorSecret -otp -loginOTP')
        .sort(sort)
        .limit(parseInt(limit))
        .skip(skip)
        .lean();

      // Get total count for pagination
      const totalUsers = await User.countDocuments(filter);

      // Calculate pagination info
      const totalPages = Math.ceil(totalUsers / parseInt(limit));
      const hasNextPage = parseInt(page) < totalPages;
      const hasPrevPage = parseInt(page) > 1;

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalUsers,
            hasNextPage,
            hasPrevPage,
            limit: parseInt(limit)
          }
        }
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch users',
        error: error.message
      });
    }
  },

  // Get special/flagged users for quick access
  async getSpecialUsers(req, res) {
    try {
      const specialUsers = await User.find({
        $or: [
          { vipLevel: { $gt: 0 } },
          { flags: { $exists: true, $ne: [] } },
          { tags: { $in: ['special', 'vip', 'whale', 'monitor'] } },
          { riskScore: { $gt: 50 } },
          { totalDeposits: { $gt: 10000 } },
          { tradeVolume: { $gt: 50000 } }
        ]
      })
      .select('-passwordHash -twoFactorSecret -otp -loginOTP')
      .sort({ totalDeposits: -1, tradeVolume: -1 })
      .limit(20)
      .lean();

      res.json({
        success: true,
        data: specialUsers
      });
    } catch (error) {
      console.error('Error fetching special users:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch special users',
        error: error.message
      });
    }
  },

  // Get user details with full financial history
  async getUserDetails(req, res) {
    try {
      const { userId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID'
        });
      }

      // Get user details
      const user = await User.findById(userId)
        .select('-passwordHash -twoFactorSecret -otp -loginOTP')
        .populate('referredBy', 'email username')
        .populate('referrals', 'email username createdAt')
        .lean();

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get deposits
      const deposits = await DepositTransaction.find({ userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      // Get withdrawals
      const withdrawals = await WithdrawalRequest.find({ userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      // Get transactions
      const transactions = await UserTransaction.find({ userId })
        .sort({ timestamp: -1 })
        .limit(100)
        .lean();

      // Calculate statistics
      const stats = {
        totalBalance: Object.values(user.balances || {}).reduce((sum, balance) => sum + balance, 0),
        depositCount: deposits.length,
        withdrawalCount: withdrawals.length,
        transactionCount: transactions.length,
        completedDeposits: deposits.filter(d => d.status === 'approved').length,
        pendingDeposits: deposits.filter(d => d.status === 'pending').length,
        completedWithdrawals: withdrawals.filter(w => w.status === 'completed').length,
        pendingWithdrawals: withdrawals.filter(w => w.status === 'pending').length,
        lastActivity: Math.max(
          user.lastLogin ? new Date(user.lastLogin).getTime() : 0,
          user.lastTradeAt ? new Date(user.lastTradeAt).getTime() : 0,
          deposits.length > 0 ? new Date(deposits[0].createdAt).getTime() : 0
        )
      };

      res.json({
        success: true,
        data: {
          user,
          deposits,
          withdrawals,
          transactions,
          stats
        }
      });
    } catch (error) {
      console.error('Error fetching user details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user details',
        error: error.message
      });
    }
  },

  // Update user status (ban/unban/activate/deactivate)
  async updateUserStatus(req, res) {
    try {
      const { userId } = req.params;
      const { action, reason = '', isActive } = req.body;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      let updateData = {};

      switch (action) {
        case 'ban':
          updateData = {
            isActive: false,
            banReason: reason || 'Banned by admin'
          };
          break;
        case 'unban':
          updateData = {
            isActive: true,
            banReason: null
          };
          break;
        case 'activate':
          updateData = { isActive: true };
          break;
        case 'deactivate':
          updateData = { isActive: false };
          break;
        case 'toggle':
          updateData = { isActive: typeof isActive === 'boolean' ? isActive : !user.isActive };
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid action'
          });
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true, select: '-passwordHash -twoFactorSecret -otp -loginOTP' }
      );

      res.json({
        success: true,
        message: `User ${action}ed successfully`,
        data: updatedUser
      });
    } catch (error) {
      console.error('Error updating user status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user status',
        error: error.message
      });
    }
  },

  // Update user balance
  async updateUserBalance(req, res) {
    try {
      const { userId } = req.params;
      const { currency, amount, action = 'set' } = req.body; // action: 'set', 'add', 'subtract'

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID'
        });
      }

      if (!currency || typeof amount !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'Currency and amount are required'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get current balance
      const currentBalance = user.balances.get(currency) || 0;
      let newBalance;

      switch (action) {
        case 'set':
          newBalance = amount;
          break;
        case 'add':
          newBalance = currentBalance + amount;
          break;
        case 'subtract':
          newBalance = currentBalance - amount;
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid action. Use set, add, or subtract'
          });
      }

      // Ensure balance doesn't go negative
      if (newBalance < 0) {
        return res.status(400).json({
          success: false,
          message: 'Balance cannot be negative'
        });
      }

      // Update balance
      user.balances.set(currency, newBalance);
      await user.save();

      // Create transaction record
      await UserTransaction.create({
        user: user._id,  // Changed from userId to user
        type: 'adjustment',  // Changed from admin_adjustment to adjustment
        subType: 'admin_adjustment',  // Fixed: changed from admin_balance_adjustment
        currency,
        amount: Math.abs(amount),  // Always positive amount
        usdValue: Math.abs(amount), // Assuming USDT = 1 USD, adjust if needed
        direction: action === 'subtract' ? 'debit' : 'credit',  // Required field
        balanceBefore: currentBalance,  // Required field
        balanceAfter: newBalance,  // Required field
        description: `Admin balance ${action}: ${amount} ${currency}`,
        status: 'completed',
        metadata: {
          adminId: req.admin.id,
          previousBalance: currentBalance,
          newBalance,
          action,
          adjustmentReason: 'Admin manual adjustment'
        }
      });

      res.json({
        success: true,
        message: 'Balance updated successfully',
        data: {
          currency,
          previousBalance: currentBalance,
          newBalance,
          action
        }
      });
    } catch (error) {
      console.error('Error updating user balance:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user balance',
        error: error.message
      });
    }
  },

  // Reset user password
  async resetUserPassword(req, res) {
    try {
      const { userId } = req.params;
      const { newPassword } = req.body;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID'
        });
      }

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { 
          passwordHash: hashedPassword,
          lastPasswordChangeAt: new Date()
        },
        { new: true, select: 'email username lastPasswordChangeAt' }
      );

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'Password reset successfully',
        data: updatedUser
      });
    } catch (error) {
      console.error('Error resetting user password:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset password',
        error: error.message
      });
    }
  },

  // Update user tags and flags
  async updateUserTags(req, res) {
    try {
      const { userId } = req.params;
      const { tags = [], flags = [], riskScore } = req.body;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID'
        });
      }

      const updateData = {};
      if (Array.isArray(tags)) updateData.tags = tags;
      if (Array.isArray(flags)) updateData.flags = flags;
      if (typeof riskScore === 'number') updateData.riskScore = riskScore;

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true, select: '-passwordHash -twoFactorSecret -otp -loginOTP' }
      );

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'User tags updated successfully',
        data: updatedUser
      });
    } catch (error) {
      console.error('Error updating user tags:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user tags',
        error: error.message
      });
    }
  },

  // Update user KYC status
  async updateUserKYC(req, res) {
    try {
      const { userId } = req.params;
      const { kycStatus, rejectionReason } = req.body;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID'
        });
      }

      const validStatuses = ['not_started', 'pending', 'approved', 'rejected'];
      if (!validStatuses.includes(kycStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid KYC status'
        });
      }

      const updateData = { kycStatus };

      if (kycStatus === 'approved') {
        updateData.kycVerifiedAt = new Date();
        updateData.kycRejectionReason = null;
      } else if (kycStatus === 'rejected') {
        updateData.kycRejectionReason = rejectionReason || 'Rejected by admin';
        updateData.kycVerifiedAt = null;
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true, select: '-passwordHash -twoFactorSecret -otp -loginOTP' }
      );

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'KYC status updated successfully',
        data: updatedUser
      });
    } catch (error) {
      console.error('Error updating user KYC:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update KYC status',
        error: error.message
      });
    }
  },

  // Delete user (soft delete by deactivating)
  async deleteUser(req, res) {
    try {
      const { userId } = req.params;
      const { permanent = false } = req.body;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (permanent) {
        // Permanent deletion - remove from database
        await User.findByIdAndDelete(userId);
        
        res.json({
          success: true,
          message: 'User permanently deleted'
        });
      } else {
        // Soft delete - deactivate account
        await User.findByIdAndUpdate(userId, {
          isActive: false,
          banReason: 'Account deleted by admin',
          email: `deleted_${Date.now()}_${user.email}` // Preserve uniqueness
        });

        res.json({
          success: true,
          message: 'User account deactivated'
        });
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete user',
        error: error.message
      });
    }
  },

  // Bulk operations
  async bulkUpdateUsers(req, res) {
    try {
      console.log('Bulk update request received:', {
        body: req.body,
        userIds: req.body.userIds,
        action: req.body.action,
        value: req.body.value
      });

      const { userIds, action, value } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'User IDs array is required'
        });
      }

      // Validate ObjectIds
      const validIds = userIds.filter(id => mongoose.Types.ObjectId.isValid(id));
      if (validIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid user IDs provided'
        });
      }

      let updateData = {};
      let message = '';

      switch (action) {
        case 'activate':
          updateData = { isActive: true };
          message = 'Users activated successfully';
          break;
        case 'deactivate':
          updateData = { isActive: false };
          message = 'Users deactivated successfully';
          break;
        case 'ban':
          updateData = { isActive: false, banReason: value || 'Bulk ban by admin' };
          message = 'Users banned successfully';
          break;
        case 'unban':
          updateData = { isActive: true, banReason: null };
          message = 'Users unbanned successfully';
          break;
        case 'addSpecialTag':
          updateData = { $addToSet: { tags: 'special' } };
          message = 'Users added to special users successfully';
          break;
        case 'removeSpecialTag':
          updateData = { $pull: { tags: 'special' } };
          message = 'Users removed from special users successfully';
          break;
        case 'addTag':
          updateData = { $addToSet: { tags: value } };
          message = 'Tag added to users successfully';
          break;
        case 'removeTag':
          updateData = { $pull: { tags: value } };
          message = 'Tag removed from users successfully';
          break;
        case 'setVipLevel':
          updateData = { vipLevel: parseInt(value) || 0 };
          message = 'VIP level updated for users successfully';
          break;
        case 'addBalance':
          // This requires individual updates per user
          const amount = parseFloat(value) || 0;
          if (amount > 0) {
            for (const userId of validIds) {
              await User.findByIdAndUpdate(userId, {
                $inc: { 'balances.USDT': amount }
              });
            }
            message = 'Balance added to users successfully';
          } else {
            return res.status(400).json({
              success: false,
              message: 'Invalid amount for balance update'
            });
          }
          break;
        case 'delete':
          await User.deleteMany({ _id: { $in: validIds } });
          message = 'Users deleted successfully';
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid bulk action'
          });
      }

      // Apply the update for actions that use updateData
      let result = { matchedCount: validIds.length, modifiedCount: 0 };
      
      if (action !== 'delete' && action !== 'addBalance' && Object.keys(updateData).length > 0) {
        result = await User.updateMany(
          { _id: { $in: validIds } },
          updateData
        );
      } else if (action === 'addBalance') {
        result.modifiedCount = validIds.length; // We already processed balance updates above
      } else if (action === 'delete') {
        result.modifiedCount = validIds.length; // We already processed deletions above
      }

      res.json({
        success: true,
        message,
        data: {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount
        }
      });
    } catch (error) {
      console.error('Error in bulk update:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform bulk update',
        error: error.message
      });
    }
  },

  // Get user statistics for dashboard
  async getUserStats(req, res) {
    try {
      const [
        totalUsers,
        activeUsers,
        bannedUsers,
        vipUsers,
        kycPendingUsers,
        recentUsers
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isActive: true }),
        User.countDocuments({ banReason: { $exists: true, $ne: null } }),
        User.countDocuments({ vipLevel: { $gt: 0 } }),
        User.countDocuments({ kycStatus: 'pending' }),
        User.countDocuments({ 
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
        })
      ]);

      // Get VIP level breakdown
      const vipBreakdown = await User.aggregate([
        { $match: { vipLevel: { $gt: 0 } } },
        { $group: { _id: '$vipLevel', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);

      // Get user registration trend (last 30 days)
      const registrationTrend = await User.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      res.json({
        success: true,
        data: {
          summary: {
            totalUsers,
            activeUsers,
            bannedUsers,
            vipUsers,
            kycPendingUsers,
            recentUsers
          },
          vipBreakdown,
          registrationTrend
        }
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user statistics',
        error: error.message
      });
    }
  }
};

module.exports = adminUserController;
