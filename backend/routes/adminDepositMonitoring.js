const express = require('express');
const router = express.Router();
const depositMonitoringService = require('../services/depositMonitoringService');
const DepositTransaction = require('../models/depositTransaction');
const User = require('../models/user');
const requireAdminAuth = require('../middlewares/requireAdminAuth');

// Apply admin authentication to all routes
router.use(requireAdminAuth);

/**
 * GET /admin/deposit-monitoring/status
 * Get current monitoring status
 */
router.get('/status', async (req, res) => {
  try {
    const status = depositMonitoringService.getStatus();
    const pendingDeposits = await DepositTransaction.countDocuments({ status: 'pending' });
    
    res.json({
      ...status,
      pendingDeposits,
      message: 'Deposit monitoring status retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting monitoring status:', error);
    res.status(500).json({ message: 'Failed to get monitoring status' });
  }
});

/**
 * POST /admin/deposit-monitoring/start
 * Start deposit monitoring
 */
router.post('/start', async (req, res) => {
  try {
    depositMonitoringService.start();
    res.json({ 
      message: 'Deposit monitoring started successfully',
      status: depositMonitoringService.getStatus()
    });
  } catch (error) {
    console.error('Error starting monitoring:', error);
    res.status(500).json({ message: 'Failed to start monitoring' });
  }
});

/**
 * POST /admin/deposit-monitoring/stop
 * Stop deposit monitoring
 */
router.post('/stop', async (req, res) => {
  try {
    depositMonitoringService.stop();
    res.json({ 
      message: 'Deposit monitoring stopped successfully',
      status: depositMonitoringService.getStatus()
    });
  } catch (error) {
    console.error('Error stopping monitoring:', error);
    res.status(500).json({ message: 'Failed to stop monitoring' });
  }
});

/**
 * POST /admin/deposit-monitoring/manual-check
 * Perform manual deposit check
 */
router.post('/manual-check', async (req, res) => {
  try {
    await depositMonitoringService.manualCheck();
    res.json({ message: 'Manual deposit check completed successfully' });
  } catch (error) {
    console.error('Error performing manual check:', error);
    res.status(500).json({ message: 'Failed to perform manual check' });
  }
});

/**
 * POST /admin/deposit-monitoring/config
 * Update monitoring configuration
 */
router.post('/config', async (req, res) => {
  try {
    const { checkInterval } = req.body;
    
    if (checkInterval && checkInterval >= 5000) { // Minimum 5 seconds
      depositMonitoringService.setCheckInterval(checkInterval);
      res.json({ 
        message: 'Configuration updated successfully',
        config: { checkInterval }
      });
    } else {
      res.status(400).json({ message: 'Invalid configuration. Check interval must be at least 5000ms' });
    }
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ message: 'Failed to update configuration' });
  }
});

/**
 * GET /admin/deposit-monitoring/pending
 * Get all pending deposits that need admin approval
 */
router.get('/pending', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const pendingDeposits = await DepositTransaction.find({ status: 'pending' })
      .populate('userId', 'username email')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await DepositTransaction.countDocuments({ status: 'pending' });

    res.json({
      deposits: pendingDeposits,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        count: pendingDeposits.length,
        totalItems: total
      }
    });
  } catch (error) {
    console.error('Error getting pending deposits:', error);
    res.status(500).json({ message: 'Failed to get pending deposits' });
  }
});

/**
 * POST /admin/deposit-monitoring/approve/:depositId
 * Approve a pending deposit and credit user account
 */
router.post('/approve/:depositId', async (req, res) => {
  try {
    const { depositId } = req.params;
    
    const deposit = await DepositTransaction.findById(depositId).populate('userId');
    if (!deposit) {
      return res.status(404).json({ message: 'Deposit not found' });
    }

    if (deposit.status !== 'pending') {
      return res.status(400).json({ message: 'Deposit is not pending approval' });
    }

    // Update deposit status
    deposit.status = 'approved';
    deposit.approvedAt = new Date();
    deposit.approvedBy = req.admin._id;
    await deposit.save();

    // Credit user account
    const user = deposit.userId;
    if (!user.balances) {
      user.balances = new Map();
    }

    const currentBalance = user.balances.get('USDT') || 0;
    user.balances.set('USDT', currentBalance + deposit.amount);
    await user.save();

    // Create notification for user
    const Notification = require('../models/notification');
    await Notification.create({
      userId: user._id,
      title: '✅ Deposit Approved',
      message: `Your ${deposit.amount} USDT deposit has been credited to your account.`,
      type: 'deposit',
      data: {
        amount: deposit.amount,
        txHash: deposit.txHash,
        status: 'approved'
      },
      targetAudience: 'user',
      priority: 'high'
    });

    res.json({ 
      message: 'Deposit approved and user credited successfully',
      deposit: {
        id: deposit._id,
        amount: deposit.amount,
        user: user.username,
        status: deposit.status
      }
    });

  } catch (error) {
    console.error('Error approving deposit:', error);
    res.status(500).json({ message: 'Failed to approve deposit' });
  }
});

/**
 * POST /admin/deposit-monitoring/reject/:depositId
 * Reject a pending deposit
 */
router.post('/reject/:depositId', async (req, res) => {
  try {
    const { depositId } = req.params;
    const { reason } = req.body;
    
    const deposit = await DepositTransaction.findById(depositId).populate('userId');
    if (!deposit) {
      return res.status(404).json({ message: 'Deposit not found' });
    }

    if (deposit.status !== 'pending') {
      return res.status(400).json({ message: 'Deposit is not pending approval' });
    }

    // Update deposit status
    deposit.status = 'rejected';
    deposit.rejectedAt = new Date();
    deposit.rejectedBy = req.admin._id;
    deposit.rejectionReason = reason || 'No reason provided';
    await deposit.save();

    // Create notification for user
    const Notification = require('../models/notification');
    await Notification.create({
      userId: deposit.userId._id,
      title: '❌ Deposit Rejected',
      message: `Your ${deposit.amount} USDT deposit has been rejected. Reason: ${reason || 'Contact support for details'}`,
      type: 'deposit',
      data: {
        amount: deposit.amount,
        txHash: deposit.txHash,
        status: 'rejected',
        reason: reason
      },
      targetAudience: 'user',
      priority: 'high'
    });

    res.json({ 
      message: 'Deposit rejected successfully',
      deposit: {
        id: deposit._id,
        amount: deposit.amount,
        user: deposit.userId.username,
        status: deposit.status,
        reason: reason
      }
    });

  } catch (error) {
    console.error('Error rejecting deposit:', error);
    res.status(500).json({ message: 'Failed to reject deposit' });
  }
});

module.exports = router;

/**
 * GET /api/v1/admin/deposit-monitoring/status
 * Get monitoring service status
 */
router.get('/status', async (req, res) => {
  try {
    const status = depositMonitoringService.getStatus();
    
    // Get additional stats
    const totalAddresses = await DepositAddress.countDocuments({ network: 'BEP20' });
    
    res.json({
      success: true,
      status: {
        ...status,
        totalAddresses,
        lastChecked: new Date()
      }
    });
  } catch (error) {
    console.error('Error getting monitoring status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get monitoring status' 
    });
  }
});

/**
 * POST /api/v1/admin/deposit-monitoring/start
 * Start deposit monitoring
 */
router.post('/start', async (req, res) => {
  try {
    depositMonitoringService.startMonitoring();
    
    res.json({
      success: true,
      message: 'Deposit monitoring started',
      status: depositMonitoringService.getStatus()
    });
  } catch (error) {
    console.error('Error starting monitoring:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to start monitoring' 
    });
  }
});

/**
 * POST /api/v1/admin/deposit-monitoring/stop
 * Stop deposit monitoring
 */
router.post('/stop', async (req, res) => {
  try {
    depositMonitoringService.stopMonitoring();
    
    res.json({
      success: true,
      message: 'Deposit monitoring stopped',
      status: depositMonitoringService.getStatus()
    });
  } catch (error) {
    console.error('Error stopping monitoring:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to stop monitoring' 
    });
  }
});

/**
 * POST /api/v1/admin/deposit-monitoring/sweep/:addressId
 * Manually sweep a specific address
 */
router.post('/sweep/:addressId', async (req, res) => {
  try {
    const { addressId } = req.params;
    const { amount } = req.body;

    const depositAddress = await DepositAddress.findById(addressId);
    if (!depositAddress) {
      return res.status(404).json({ 
        success: false, 
        message: 'Deposit address not found' 
      });
    }

    // Check current balance
    const currentBalance = await hdWalletService.checkBalance(depositAddress.address);
    const sweepAmount = amount || parseFloat(currentBalance);

    if (sweepAmount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No funds to sweep' 
      });
    }

    // Perform sweep
    const masterWallet = process.env.MASTER_WALLET_BEP20;
    const result = await hdWalletService.autoSweepWithGasFunding(
      depositAddress,
      masterWallet,
      sweepAmount
    );

    res.json({
      success: true,
      message: `Successfully swept ${sweepAmount} USDT`,
      result: {
        txHash: result.txHash,
        amount: sweepAmount,
        from: depositAddress.address,
        to: masterWallet
      }
    });

  } catch (error) {
    console.error('Error manual sweep:', error);
    res.status(500).json({ 
      success: false, 
      message: `Sweep failed: ${error.message}` 
    });
  }
});

/**
 * GET /api/v1/admin/deposit-monitoring/addresses
 * Get all deposit addresses with balances
 */
router.get('/addresses', async (req, res) => {
  try {
    const addresses = await DepositAddress.find({ network: 'BEP20' })
      .populate('userId', 'username email')
      .sort({ createdAt: -1 });

    // Check balances for each address
    const addressesWithBalances = await Promise.all(
      addresses.map(async (addr) => {
        try {
          const balance = await hdWalletService.checkBalance(addr.address);
          return {
            _id: addr._id,
            address: addr.address,
            user: addr.userId,
            balance: parseFloat(balance),
            derivationPath: addr.derivationPath,
            addressIndex: addr.addressIndex,
            createdAt: addr.createdAt
          };
        } catch (error) {
          console.error(`Error checking balance for ${addr.address}:`, error);
          return {
            _id: addr._id,
            address: addr.address,
            user: addr.userId,
            balance: 0,
            error: 'Failed to check balance',
            derivationPath: addr.derivationPath,
            addressIndex: addr.addressIndex,
            createdAt: addr.createdAt
          };
        }
      })
    );

    // Sort by balance (highest first)
    addressesWithBalances.sort((a, b) => b.balance - a.balance);

    res.json({
      success: true,
      addresses: addressesWithBalances,
      totalAddresses: addresses.length,
      totalBalance: addressesWithBalances.reduce((sum, addr) => sum + addr.balance, 0)
    });

  } catch (error) {
    console.error('Error getting addresses:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get addresses' 
    });
  }
});

/**
 * POST /api/v1/admin/deposit-monitoring/sweep-all
 * Sweep all addresses with balance above threshold
 */
router.post('/sweep-all', async (req, res) => {
  try {
    const { minAmount = 10 } = req.body; // Minimum amount to sweep
    
    const addresses = await DepositAddress.find({ network: 'BEP20' });
    const masterWallet = process.env.MASTER_WALLET_BEP20;
    
    if (!masterWallet) {
      return res.status(400).json({ 
        success: false, 
        message: 'Master wallet not configured' 
      });
    }

    const sweepResults = [];
    let totalSwept = 0;

    for (const addr of addresses) {
      try {
        const balance = await hdWalletService.checkBalance(addr.address);
        const balanceNum = parseFloat(balance);

        if (balanceNum >= minAmount) {
          const result = await hdWalletService.autoSweepWithGasFunding(
            addr,
            masterWallet,
            balanceNum
          );

          sweepResults.push({
            address: addr.address,
            amount: balanceNum,
            txHash: result.txHash,
            success: true
          });

          totalSwept += balanceNum;
        }
      } catch (error) {
        sweepResults.push({
          address: addr.address,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Swept ${totalSwept} USDT from ${sweepResults.filter(r => r.success).length} addresses`,
      totalSwept,
      results: sweepResults
    });

  } catch (error) {
    console.error('Error sweep all:', error);
    res.status(500).json({ 
      success: false, 
      message: `Sweep all failed: ${error.message}` 
    });
  }
});

module.exports = router;
