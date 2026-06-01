const express = require('express');
const router = express.Router();
const Transaction = require('../models/transaction');
const User = require('../models/user');
const requireAdminAuth = require('../middlewares/requireAdminAuth');
const { escapeRegex } = require('../middlewares/securityMiddleware');

// Get all transactions with pagination and filtering
router.get('/', requireAdminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const { search, type, status, currency, direction, dateFrom, dateTo } = req.query;

    // Build filter object
    let filter = {};

    if (type && type !== 'all') {
      filter.type = type;
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (currency && currency !== 'all') {
      filter.currency = currency;
    }

    if (direction && direction !== 'all') {
      filter.direction = direction;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) {
        filter.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        filter.createdAt.$lte = new Date(dateTo);
      }
    }

    // Search functionality
    if (search) {
      const safeSearch = escapeRegex(search);
      const searchRegex = new RegExp(safeSearch, 'i');
      
      // Find users matching search
      const matchingUsers = await User.find({
        $or: [
          { username: searchRegex },
          { email: searchRegex }
        ]
      }).select('_id');

      const userIds = matchingUsers.map(user => user._id);

      filter.$or = [
        { transactionId: searchRegex },
        { txHash: searchRegex },
        { user: { $in: userIds } }
      ];
    }

    // Get total count for pagination
    const total = await Transaction.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    // Fetch transactions with user population
    const transactions = await Transaction.find(filter)
      .populate('user', 'username email')
      .populate('referralInfo.triggeredBy', 'username email')
      .populate('processedBy', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      transactions,
      pagination: {
        current: page,
        pages: totalPages,
        total,
        limit
      }
    });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message
    });
  }
});

// Get transaction statistics
router.get('/stats', requireAdminAuth, async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    // Build date filter
    let dateFilter = {};
    if (dateFrom || dateTo) {
      dateFilter.createdAt = {};
      if (dateFrom) {
        dateFilter.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        dateFilter.createdAt.$lte = new Date(dateTo);
      }
    }

    // Aggregate statistics
    const stats = await Transaction.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalVolume: { $sum: '$amount' },
          
          // Count by type
          deposits: {
            $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, 1, 0] }
          },
          withdrawals: {
            $sum: { $cond: [{ $eq: ['$type', 'withdrawal'] }, 1, 0] }
          },
          referralRewards: {
            $sum: { $cond: [{ $eq: ['$type', 'referral_reward'] }, 1, 0] }
          },
          tradingBonuses: {
            $sum: { $cond: [{ $eq: ['$type', 'trading_bonus'] }, 1, 0] }
          },
          
          // Count by status
          pendingTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          completedTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          failedTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          
          // Volume by type
          depositVolume: {
            $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0] }
          },
          withdrawalVolume: {
            $sum: { $cond: [{ $eq: ['$type', 'withdrawal'] }, '$amount', 0] }
          },
          referralRewardVolume: {
            $sum: { $cond: [{ $eq: ['$type', 'referral_reward'] }, '$amount', 0] }
          },
          tradingBonusVolume: {
            $sum: { $cond: [{ $eq: ['$type', 'trading_bonus'] }, '$amount', 0] }
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalTransactions: 0,
      totalVolume: 0,
      deposits: 0,
      withdrawals: 0,
      referralRewards: 0,
      tradingBonuses: 0,
      pendingTransactions: 0,
      completedTransactions: 0,
      failedTransactions: 0,
      depositVolume: 0,
      withdrawalVolume: 0,
      referralRewardVolume: 0,
      tradingBonusVolume: 0
    };

    res.json({
      success: true,
      stats: result
    });

  } catch (error) {
    console.error('Error fetching transaction stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction statistics',
      error: error.message
    });
  }
});

// Get transaction by ID
router.get('/:id', requireAdminAuth, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('user', 'username email')
      .populate('referralInfo.triggeredBy', 'username email')
      .populate('processedBy', 'username');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      transaction
    });

  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction',
      error: error.message
    });
  }
});

// Get transactions by user ID
router.get('/user/:userId', requireAdminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const total = await Transaction.countDocuments({ user: userId });
    const totalPages = Math.ceil(total / limit);

    const transactions = await Transaction.find({ user: userId })
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      transactions,
      pagination: {
        current: page,
        pages: totalPages,
        total,
        limit
      }
    });

  } catch (error) {
    console.error('Error fetching user transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user transactions',
      error: error.message
    });
  }
});

module.exports = router;
