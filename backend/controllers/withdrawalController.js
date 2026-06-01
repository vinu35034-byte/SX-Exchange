const User = require('../models/user');
const WithdrawalRequest = require('../models/withdrawalRequest');
const Transaction = require('../models/transaction');
const hdWalletService = require('../utils/hdWalletService');
const notificationService = require('../utils/notificationService');
const { sessionManager } = require('../config/session');

class WithdrawalController {
  /**
   * Create a new withdrawal request
   */
  async createWithdrawalRequest(req, res) {
    try {
      // Enhanced session validation for financial operations
      if (!req.session?.user || !req.sessionID) {
        return res.status(401).json({ 
          message: 'Session validation failed. Please login again for security.',
          code: 'WITHDRAWAL_SESSION_REQUIRED'
        });
      }

      // Verify session freshness (must be logged in within last 30 days for withdrawals)
      console.log('Session validation for withdrawal:', {
        hasSession: !!req.session,
        hasUser: !!req.session?.user,
        loginAt: req.session?.user?.loginAt,
        sessionUser: req.session?.user
      });
      
      if (!req.session.user.loginAt) {
        return res.status(401).json({ 
          message: 'Session login time not found. Please login again for security.',
          code: 'WITHDRAWAL_SESSION_INVALID'
        });
      }
      
      const sessionAge = Date.now() - new Date(req.session.user.loginAt).getTime();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      
      console.log('Session age check:', {
        loginAt: req.session.user.loginAt,
        sessionAge: sessionAge,
        thirtyDays: thirtyDays,
        isExpired: sessionAge > thirtyDays
      });
      
      if (sessionAge > thirtyDays) {
        return res.status(401).json({ 
          message: 'Session too old for withdrawal. Please login again for security.',
          code: 'WITHDRAWAL_SESSION_EXPIRED'
        });
      }

      // Check withdrawal password verification
      if (!req.session?.withdrawalPasswordVerified) {
        return res.status(401).json({ 
          message: 'Withdrawal password verification required',
          code: 'WITHDRAWAL_PASSWORD_REQUIRED'
        });
      }

      const userId = req.user._id;
      const { network, amount, withdrawalAddress } = req.body;

      // Validate input
      if (!network || !amount || !withdrawalAddress) {
        return res.status(400).json({ message: 'All fields are required' });
      }

      if (!['BEP20'].includes(network)) {
        return res.status(400).json({ message: 'Invalid network' });
      }

      if (amount < 25) {
        return res.status(400).json({ message: 'Minimum withdrawal amount is 25 USDT' });
      }

      // Validate address format
      if (!hdWalletService.isValidAddress(withdrawalAddress, network)) {
        return res.status(400).json({ message: 'Invalid withdrawal address format' });
      }

      // Get user and check balance
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Calculate fees (5% of withdrawal amount)
      const fee = amount * 0.05; // 5% fee
      const totalRequired = amount; // Only deduct the requested amount

      // Get USDT balance (supporting both new Map format and old balance field)
      const usdtBalance = user.balances?.get('USDT') || user.balance || 0;

      if (usdtBalance < totalRequired) {
        return res.status(400).json({ 
          message: `Insufficient balance. Required: ${totalRequired} USDT. Available: ${usdtBalance} USDT`,
          required: totalRequired,
          available: usdtBalance,
          fee: fee
        });
      }

      // Check for pending withdrawals
      const pendingWithdrawals = await WithdrawalRequest.countDocuments({
        userId,
        status: 'pending'
      });

      if (pendingWithdrawals >= 3) {
        return res.status(400).json({ 
          message: 'You have too many pending withdrawal requests. Please wait for them to be processed.' 
        });
      }

      // Check withdrawal password verification
      if (!user.withdrawalPasswordHash) {
        return res.status(400).json({
          message: 'Withdrawal password not set. Please set up withdrawal password first.',
          code: 'WITHDRAWAL_PASSWORD_REQUIRED'
        });
      }

      if (!req.session?.withdrawalPasswordVerified) {
        return res.status(400).json({
          message: 'Withdrawal password verification required. Please verify your withdrawal password.',
          code: 'WITHDRAWAL_PASSWORD_VERIFICATION_REQUIRED'
        });
      }

      // Create withdrawal request
      const withdrawalRequest = new WithdrawalRequest({
        userId,
        network,
        amount,
        withdrawalAddress,
        fee,
        netAmount: amount // Will be calculated by pre-save hook
      });

      await withdrawalRequest.save();

      // Lock the funds ATOMICALLY (prevent double-spend race condition)
      const atomicResult = await User.findOneAndUpdate(
        { _id: userId, 'balances.USDT': { $gte: totalRequired } },
        { $inc: { 'balances.USDT': -totalRequired } },
        { new: true }
      );
      if (!atomicResult) {
        // Race condition: balance was modified between check and deduction
        await WithdrawalRequest.findByIdAndDelete(withdrawalRequest._id);
        return res.status(400).json({ message: 'Insufficient balance (concurrent modification). Please try again.' });
      }
      const balanceBefore = usdtBalance;
      const balanceAfter = atomicResult.balances.get('USDT') || 0;

      // Create withdrawal transaction record
      const transactionId = `WD${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      
      const transaction = new Transaction({
        user: user._id,
        transactionId: transactionId,
        type: 'withdrawal',
        subType: 'crypto_withdrawal',
        currency: 'USDT',
        amount: amount,
        fee: fee,
        direction: 'debit',
        balanceBefore: balanceBefore,
        balanceAfter: balanceAfter,
        usdValue: amount,
        status: 'pending',
        to: withdrawalAddress,
        network: network,
        description: `Withdrawal request to ${withdrawalAddress}`,
        notes: `Network: ${network}, Fee: ${fee} USDT`,
        ipAddress: req.ip,
        sessionId: req.sessionID,
        requestedAt: new Date()
      });

      await transaction.save();

      // Populate user data for notifications
      await withdrawalRequest.populate('userId', 'email username');

      // Send notification to admins
      await notificationService.notifyAdminNewWithdrawal(withdrawalRequest);

      // Send confirmation to user
      await notificationService.notifyUserWithdrawalSubmitted(withdrawalRequest);

      // Clear withdrawal password verification from session for security
      req.session.withdrawalPasswordVerified = false;

      res.status(201).json({
        message: 'Withdrawal request submitted successfully',
        withdrawalRequest: {
          _id: withdrawalRequest._id,
          network: withdrawalRequest.network,
          amount: withdrawalRequest.amount,
          fee: withdrawalRequest.fee,
          netAmount: withdrawalRequest.netAmount,
          status: withdrawalRequest.status,
          createdAt: withdrawalRequest.createdAt
        },
        newBalance: user.balances?.get('USDT') || user.balance || 0,
        sessionInfo: {
          submittedAt: new Date(),
          sessionId: req.sessionID,
          ipAddress: req.ip
        }
      });

    } catch (error) {
      console.error('Error creating withdrawal request:', error);
      res.status(500).json({ 
        message: 'Failed to create withdrawal request',
        error: error.message 
      });
    }
  }

  /**
   * Get user's withdrawal history
   */
  async getUserWithdrawals(req, res) {
    try {
      const userId = req.user._id;
      const { page = 1, limit = 10, status, network } = req.query;

      const query = { userId };
      if (status) query.status = status;
      if (network) query.network = network;

      const withdrawals = await WithdrawalRequest.find(query)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .select('-userId');

      const total = await WithdrawalRequest.countDocuments(query);

      res.json({
        withdrawals,
        pagination: {
          current: page,
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
      console.error('Error getting user withdrawals:', error);
      res.status(500).json({
        message: 'Failed to get withdrawal history',
        error: error.message 
      });
    }
  }

  /**
   * Get withdrawal fees
   */
  async getWithdrawalFees(req, res) {
    try {
      // Log fee inquiry
      logger.info('Withdrawal fees requested', {
        userId: req.user._id.toString(),
        sessionId: req.sessionID,
        timestamp: new Date().toISOString()
      });

      const fees = {
        BEP20: 0.05, // 5% fee
        percentage: true // Indicate this is a percentage fee
      };

      res.json({
        fees,
        currency: 'USDT',
        feeType: 'percentage',
        feeRate: 0.05,
        minWithdrawal: 25,
        lastUpdated: new Date(),
        sessionInfo: {
          accessedAt: new Date(),
          sessionId: req.sessionID
        }
      });
    } catch (error) {
      logger.error('Error getting withdrawal fees:', {
        error: error.message,
        userId: req.user._id.toString(),
        sessionId: req.sessionID,
        stack: error.stack
      });
      
      res.status(500).json({ 
        message: 'Failed to get withdrawal fees',
        sessionInfo: {
          errorAt: new Date(),
          sessionId: req.sessionID
        }
      });
    }
  }

  // Admin functions

  /**
   * Admin: Get all withdrawal requests
   */
  async getAllWithdrawals(req, res) {
    try {
      const { page = 1, limit = 100, network, status } = req.query;

      const query = {};
      if (network) query.network = network;
      if (status) query.status = status;

      const withdrawals = await WithdrawalRequest.find(query)
        .populate('userId', 'username email')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await WithdrawalRequest.countDocuments(query);

      res.json({
        withdrawals,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      });

    } catch (error) {
      console.error('Error getting all withdrawals:', error);
      res.status(500).json({ 
        message: 'Failed to get withdrawals',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Get all pending withdrawal requests
   */
  async getPendingWithdrawals(req, res) {
    try {
      const { page = 1, limit = 20, network } = req.query;

      const query = { status: 'pending' };
      if (network) query.network = network;

      const withdrawals = await WithdrawalRequest.find(query)
        .populate('userId', 'username email')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await WithdrawalRequest.countDocuments(query);

      res.json({
        withdrawals,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      });

    } catch (error) {
      console.error('Error getting pending withdrawals:', error);
      res.status(500).json({ 
        message: 'Failed to get pending withdrawals',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Approve withdrawal request
   */
  async approveWithdrawal(req, res) {
    try {
      const { withdrawalId } = req.params;
      const { txHash } = req.body; // Accept transaction hash from admin
      const adminId = req.user?._id || req.user?.id;

      const withdrawal = await WithdrawalRequest.findById(withdrawalId)
        .populate('userId');

      if (!withdrawal) {
        return res.status(404).json({ message: 'Withdrawal request not found' });
      }

      if (withdrawal.status !== 'pending') {
        return res.status(400).json({ 
          message: `Cannot approve withdrawal with status: ${withdrawal.status}` 
        });
      }

      // Update withdrawal status
      withdrawal.status = 'approved';
      withdrawal.processedBy = adminId;
      withdrawal.processedAt = new Date();
      
      // Update corresponding transaction status
      const correspondingTransaction = await Transaction.findOne({
        user: withdrawal.userId._id,
        type: 'withdrawal',
        amount: withdrawal.amount,
        status: 'pending',
        currency: 'USDT'
      }).sort({ createdAt: -1 }); // Get the most recent matching transaction

      if (correspondingTransaction) {
        correspondingTransaction.status = 'completed'; // Use 'completed' for approved withdrawals
        correspondingTransaction.processedBy = adminId;
        correspondingTransaction.notes = 'Withdrawal Done';
        await correspondingTransaction.save();
      }
      
      // If transaction hash is provided, mark as completed immediately
      if (txHash && txHash.trim()) {
        withdrawal.status = 'completed';
        withdrawal.completedAt = new Date();
        withdrawal.txHash = txHash.trim();
        
        // Update transaction status to completed
        if (correspondingTransaction) {
          correspondingTransaction.status = 'completed';
          correspondingTransaction.completedAt = new Date();
          correspondingTransaction.processedBy = adminId;
          correspondingTransaction.txHash = txHash.trim();
          correspondingTransaction.notes = 'Withdrawal completed with transaction hash';
          await correspondingTransaction.save();
        }
        
        // Save withdrawal with the provided hash
        await withdrawal.save();
        
        // Send notification to user about completion
        await notificationService.notifyUserWithdrawalCompleted(withdrawal);
      } else {
        // No hash provided, save first then use simulated processing
        await withdrawal.save();
        
        // Send notification to user about approval
        await notificationService.notifyUserWithdrawalApproved(withdrawal);
        
        // Use simulated processing after a delay
        setTimeout(async () => {
          try {
            const withdrawalToUpdate = await WithdrawalRequest.findById(withdrawalId);
            if (withdrawalToUpdate && withdrawalToUpdate.status === 'approved') {
              withdrawalToUpdate.status = 'completed';
              withdrawalToUpdate.completedAt = new Date();
              withdrawalToUpdate.txHash = 'simulated-tx-hash-' + Date.now(); // Simulate tx hash
              await withdrawalToUpdate.save();
              
              // Update the corresponding transaction to completed
              const transactionToUpdate = await Transaction.findOne({
                user: withdrawalToUpdate.userId,
                type: 'withdrawal',
                amount: withdrawalToUpdate.amount,
                status: 'completed', // Look for already approved transaction
                currency: 'USDT'
              }).sort({ createdAt: -1 });

              if (transactionToUpdate) {
                transactionToUpdate.completedAt = new Date();
                transactionToUpdate.txHash = withdrawalToUpdate.txHash;
                transactionToUpdate.notes = 'Withdrawal completed via simulation';
                await transactionToUpdate.save();
              }
              
              await notificationService.notifyUserWithdrawalCompleted(withdrawalToUpdate);
            }
          } catch (timeoutError) {
            console.error('Error in simulated processing:', timeoutError);
          }
        }, 5000); // Simulate 5 second processing time
      }

      res.json({
        message: txHash ? 'Withdrawal completed successfully' : 'Withdrawal approved successfully',
        withdrawal
      });

    } catch (error) {
      console.error('Error approving withdrawal:', error);
      res.status(500).json({ 
        message: 'Failed to approve withdrawal',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Reject withdrawal request
   */
  async rejectWithdrawal(req, res) {
    try {
      const { withdrawalId } = req.params;
      const { reason } = req.body;
      const adminId = req.user?._id || req.user?.id;

      const withdrawal = await WithdrawalRequest.findById(withdrawalId)
        .populate('userId');

      if (!withdrawal) {
        return res.status(404).json({ message: 'Withdrawal request not found' });
      }

      if (withdrawal.status !== 'pending') {
        return res.status(400).json({ 
          message: `Cannot reject withdrawal with status: ${withdrawal.status}` 
        });
      }

      // Return funds to user balance ATOMICALLY (prevent lost update race condition)
      const refundAmount = withdrawal.amount;
      await User.updateOne(
        { _id: withdrawal.userId._id },
        { $inc: { 'balances.USDT': refundAmount } }
      );

      // Update withdrawal status
      withdrawal.status = 'rejected';
      withdrawal.rejectionReason = reason || 'Rejected by admin';
      withdrawal.processedBy = adminId;
      withdrawal.processedAt = new Date();
      await withdrawal.save();

      // Update corresponding transaction status
      const correspondingTransaction = await Transaction.findOne({
        user: withdrawal.userId._id,
        type: 'withdrawal',
        amount: withdrawal.amount,
        status: 'pending',
        currency: 'USDT'
      }).sort({ createdAt: -1 }); // Get the most recent matching transaction

      if (correspondingTransaction) {
        correspondingTransaction.status = 'failed'; // Use 'failed' for rejected withdrawals
        correspondingTransaction.processedBy = adminId;
        correspondingTransaction.notes = reason || 'Withdrawal rejected';
        await correspondingTransaction.save();
      }

      // Send notification to user (non-critical — don't fail the whole request)
      try {
        await notificationService.notifyUserWithdrawalRejected(withdrawal);
      } catch (notifyErr) {
        console.error('Notification failed after rejection (non-fatal):', notifyErr.message);
      }

      res.json({
        message: 'Withdrawal rejected successfully',
        withdrawal,
        refundedAmount: refundAmount,
      });

    } catch (error) {
      console.error('Error rejecting withdrawal:', error);
      res.status(500).json({ 
        message: 'Failed to reject withdrawal',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Get withdrawal statistics
   */
  async getWithdrawalStats(req, res) {
    try {
      const stats = await WithdrawalRequest.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      const networkStats = await WithdrawalRequest.aggregate([
        {
          $group: {
            _id: '$network',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      res.json({
        byStatus: stats,
        byNetwork: networkStats,
        totalRequests: await WithdrawalRequest.countDocuments()
      });

    } catch (error) {
      console.error('Error getting withdrawal stats:', error);
      res.status(500).json({ 
        message: 'Failed to get withdrawal statistics',
        error: error.message 
      });
    }
  }
}

module.exports = new WithdrawalController();
