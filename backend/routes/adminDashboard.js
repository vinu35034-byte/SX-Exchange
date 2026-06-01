const express = require('express');
const router = express.Router();
const requireAdminAuth = require('../middlewares/requireAdminAuth');
const User = require('../models/user');
const DepositTransaction = require('../models/depositTransaction');
const WithdrawalRequest = require('../models/withdrawalRequest');
const Order = require('../models/order');
const Trade = require('../models/trade');
const KYC = require('../models/kyc');

// Get dashboard statistics
router.get('/stats', requireAdminAuth, async (req, res) => {
  try {
    // Get user statistics
    const totalUsers = await User.countDocuments();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeUsers = await User.countDocuments({
      lastLoginAt: { $gte: yesterday }
    });

    // Get detailed deposit statistics by status
    const allDeposits = await DepositTransaction.find({});
    const depositsByStatus = {
      total: allDeposits.length,
      pending: allDeposits.filter(d => d.status === 'pending').length,
      confirmed: allDeposits.filter(d => d.status === 'confirmed').length,
      credited: allDeposits.filter(d => d.status === 'credited').length,
      failed: allDeposits.filter(d => d.status === 'failed').length,
      submitted: allDeposits.filter(d => d.status === 'submitted').length,
      approved: allDeposits.filter(d => d.status === 'approved').length,
      rejected: allDeposits.filter(d => d.status === 'rejected').length
    };

    // Calculate deposit volumes - USE APPROVED STATUS, NOT CREDITED
    const approvedDeposits = allDeposits.filter(d => d.status === 'approved');
    const pendingDeposits = allDeposits.filter(d => ['pending', 'confirmed', 'submitted'].includes(d.status));
    
    const totalDeposits = approvedDeposits.length;
    const pendingDepositsCount = pendingDeposits.length;
    const depositVolume = approvedDeposits.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
    const pendingDepositVolume = pendingDeposits.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);

    // Get detailed withdrawal statistics by status
    const allWithdrawals = await WithdrawalRequest.find({});
    const withdrawalsByStatus = {
      total: allWithdrawals.length,
      pending: allWithdrawals.filter(w => w.status === 'pending').length,
      approved: allWithdrawals.filter(w => w.status === 'approved').length,
      rejected: allWithdrawals.filter(w => w.status === 'rejected').length,
      processing: allWithdrawals.filter(w => w.status === 'processing').length,
      completed: allWithdrawals.filter(w => w.status === 'completed').length,
      failed: allWithdrawals.filter(w => w.status === 'failed').length
    };

    // Calculate withdrawal volumes
    const completedWithdrawals = allWithdrawals.filter(w => w.status === 'completed');
    const pendingWithdrawals = allWithdrawals.filter(w => ['pending', 'approved', 'processing'].includes(w.status));
    
    const totalWithdrawals = completedWithdrawals.length;
    const pendingWithdrawalsCount = pendingWithdrawals.length;
    const withdrawalVolume = completedWithdrawals.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);
    const pendingWithdrawalVolume = pendingWithdrawals.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);

    // Get KYC statistics
    const pendingKycCount = await User.countDocuments({ kycStatus: 'pending' });

    // Get REAL trading statistics from Trade model
    const allTrades = await Trade.find({}).lean();
    const completedTrades = allTrades.filter(t => t.status === 'completed');
    
    // Calculate real trading volume: price × amount for each completed trade
    const realTradingVolume = completedTrades.reduce((sum, trade) => {
      const tradeValue = (parseFloat(trade.price) || 0) * (parseFloat(trade.amount) || 0);
      return sum + tradeValue;
    }, 0);

    // Get today's trading activity
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTrades = allTrades.filter(t => new Date(t.createdAt) >= today);
    const todayTradesCount = todayTrades.length;
    const todaySuccessfulTrades = todayTrades.filter(t => t.status === 'completed').length;


    const stats = {
      totalUsers,
      activeUsers,
      
      // Deposit statistics
      totalDeposits,
      depositVolume,
      pendingDeposits: pendingDepositsCount,
      pendingDepositVolume,
      depositsByStatus,
      
      // Withdrawal statistics  
      totalWithdrawals,
      withdrawalVolume,
      pendingWithdrawals: pendingWithdrawalsCount,
      pendingWithdrawalVolume,
      withdrawalsByStatus,
      
      // Other statistics
      pendingKyc: pendingKycCount,
      todayTrades: todayTradesCount,
      successfulTrades: todaySuccessfulTrades,
      tradingVolume: realTradingVolume, // REAL trading volume, not estimated!
      
      timestamp: new Date()
    };

    
    res.json(stats);

  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ 
      message: 'Failed to get dashboard statistics',
      error: error.message 
    });
  }
});

// Get simple database counts for debugging
router.get('/debug-counts', requireAdminAuth, async (req, res) => {
  try {
    const counts = {
      users: await User.countDocuments(),
      deposits: await DepositTransaction.countDocuments(),
      withdrawals: await WithdrawalRequest.countDocuments(),
      orders: await Order.countDocuments(),
      trades: await Trade.countDocuments(),
      kycRecords: await KYC.countDocuments()
    };
    res.json(counts);

  } catch (error) {
    console.error('Error getting debug counts:', error);
    res.status(500).json({ 
      message: 'Failed to get debug counts',
      error: error.message 
    });
  }
});

// Debug session endpoint (temporary)
router.get('/debug-session', async (req, res) => {
  try {
    res.json({
      success: true,
      debug: {
        sessionExists: !!req.session,
        sessionId: req.sessionID,
        sessionKeys: req.session ? Object.keys(req.session) : 'no session',
        adminInSession: !!(req.session && req.session.admin),
        adminData: req.session && req.session.admin ? {
          id: req.session.admin.id,
          email: req.session.admin.email,
          username: req.session.admin.username,
          role: req.session.admin.role
        } : 'no admin data',
        cookies: req.headers.cookie,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Error getting session debug info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get session debug info',
      error: error.message 
    });
  }
});

// Get simple counts for fallback when main stats fail
router.get('/simple-counts', requireAdminAuth, async (req, res) => {
  try {
    const [totalUsers, totalDeposits, totalWithdrawals] = await Promise.all([
      User.countDocuments(),
      DepositTransaction.countDocuments(),
      WithdrawalRequest.countDocuments()
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalDeposits,
        totalWithdrawals,
        message: 'Simple counts retrieved successfully'
      }
    });
  } catch (error) {
    console.error('Error getting simple counts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get simple counts',
      error: error.message 
    });
  }
});

module.exports = router;
