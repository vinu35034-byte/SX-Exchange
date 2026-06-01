const User = require('../models/user');
const DepositAddress = require('../models/depositAddress');
const DepositTransaction = require('../models/depositTransaction');
const Transaction = require('../models/transaction');
const hdWalletService = require('../utils/hdWalletService');
// Deposit monitoring service removed - using manual deposit management
const notificationService = require('../utils/notificationService');
const ReferralService = require('../services/referralService');
const { sessionManager } = require('../config/session');
const { createLogger } = require('../utils/logger');
const { escapeRegex } = require('../middlewares/securityMiddleware');

const logger = createLogger('deposit-controller');

class DepositController {
  /**
   * Generate deposit addresses for a user
   */
  async generateDepositAddresses(req, res) {
    try {
      const userId = req.user._id;
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if user already has a BEP20 deposit address
      const existingAddress = await DepositAddress.findOne({ userId, network: 'BEP20' });
      
      if (existingAddress) {
        return res.status(400).json({ 
          message: 'Deposit address already generated',
          address: existingAddress.address,
          network: 'BEP20',
          sessionInfo: {
            generatedAt: existingAddress.createdAt,
            sessionId: req.sessionID
          }
        });
      }

      // Generate unique address index for this user
      // Use user's MongoDB ObjectId to create a unique but deterministic index
      const userIdHash = require('crypto').createHash('sha256').update(userId.toString()).digest('hex');
      const addressIndex = parseInt(userIdHash.substring(0, 8), 16) % 1000000; // Use first 8 chars as hex, mod 1M

      try {
        // Generate new BEP20 address
        const walletData = hdWalletService.generateDepositAddress(userId, addressIndex);
        
        // Encrypt private key for storage
        const encryptedKey = hdWalletService.encryptPrivateKey(walletData.privateKey);

        // Create deposit address record
        const depositAddress = new DepositAddress({
          userId,
          network: 'BEP20',
          address: walletData.address,
          privateKey: JSON.stringify(encryptedKey), // Store encrypted
          derivationPath: walletData.derivationPath,
          addressIndex: walletData.addressIndex
        });

        await depositAddress.save();

        // Update user record with the new address
        await User.findByIdAndUpdate(userId, { 
          $set: { 
            addressGenerated: true,
            'depositAddresses.BEP20': walletData.address
          }
        });

        // Prepare response
        const response = {
          address: walletData.address,
          network: 'BEP20',
          message: 'BEP20 deposit address generated successfully',
          sessionInfo: {
            generatedAt: new Date(),
            sessionId: req.sessionID,
            ipAddress: req.ip
          }
        };

        res.json(response);

      } catch (error) {
        console.error('Failed to generate BEP20 address:', error.message);
        res.status(500).json({
          message: 'Failed to generate deposit address',
          error: error.message
        });
      }

    } catch (error) {
      console.error('Error generating deposit addresses:', error);
      res.status(500).json({ 
        message: 'Failed to generate deposit addresses',
        error: error.message 
      });
    }
  }

  /**
   * Get user's deposit addresses
   */
  async getDepositAddresses(req, res) {
    try {
      const userId = req.user._id;
      
      const addresses = await DepositAddress.find({ 
        userId, 
        isActive: true 
      }).select('network address totalDeposited');

      const result = {};
      addresses.forEach(addr => {
        result[addr.network] = {
          address: addr.address,
          totalDeposited: addr.totalDeposited
        };
      });

      res.json({
        addresses: result,
        hasAddresses: addresses.length > 0
      });

    } catch (error) {
      console.error('Error getting deposit addresses:', error);
      res.status(500).json({ 
        message: 'Failed to get deposit addresses',
        error: error.message 
      });
    }
  }

  /**
   * Get deposit history for user
   */
  async getDepositHistory(req, res) {
    try {
      const userId = req.user._id;
      const { page = 1, limit = 10, network, status } = req.query;

      // Log deposit history access
      logger.info('Deposit history accessed', {
        userId: userId.toString(),
        sessionId: req.sessionID,
        page,
        limit,
        network,
        status,
        timestamp: new Date().toISOString()
      });

      const query = { userId };
      if (network) query.network = network;
      if (status) query.status = status;

      const deposits = await DepositTransaction.find(query)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .populate('depositAddressId', 'address network');

      const total = await DepositTransaction.countDocuments(query);

      res.json({
        deposits,
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
      logger.error('Error getting deposit history:', {
        error: error.message,
        userId: req.user._id.toString(),
        sessionId: req.sessionID,
        stack: error.stack
      });
      
      res.status(500).json({ 
        message: 'Failed to get deposit history',
        error: error.message,
        sessionInfo: {
          errorAt: new Date(),
          sessionId: req.sessionID
        }
      });
    }
  }

  /**
   * Check balance for user's deposit addresses
   */
  async checkBalance(req, res) {
    try {
      const userId = req.user._id;
      const { network } = req.params;

      // Log balance check request
      logger.info('Deposit balance check requested', {
        userId: userId.toString(),
        sessionId: req.sessionID,
        network,
        timestamp: new Date().toISOString()
      });

      const depositAddress = await DepositAddress.findOne({ 
        userId, 
        network: network.toUpperCase(),
        isActive: true 
      });

      if (!depositAddress) {
        return res.status(404).json({ 
          message: 'Deposit address not found',
          sessionInfo: {
            checkedAt: new Date(),
            sessionId: req.sessionID
          }
        });
      }

      let balance = 0;
      if (network.toUpperCase() === 'BEP20') {
        balance = await hdWalletService.checkBEP20Balance(depositAddress.address);
      } else if (network.toUpperCase() === 'TRC20') {
        balance = await hdWalletService.checkTRC20Balance(depositAddress.address);
      }

      res.json({
        address: depositAddress.address,
        network: network.toUpperCase(),
        balance,
        lastChecked: new Date(),
        sessionInfo: {
          checkedAt: new Date(),
          sessionId: req.sessionID
        }
      });

    } catch (error) {
      logger.error('Error checking balance:', {
        error: error.message,
        userId: req.user._id.toString(),
        sessionId: req.sessionID,
        network: req.params.network,
        stack: error.stack
      });
      
      res.status(500).json({ 
        message: 'Failed to check balance',
        error: error.message,
        sessionInfo: {
          errorAt: new Date(),
          sessionId: req.sessionID
        }
      });
    }
  }

  /**
   * Admin: Get all pending deposits
   */
  async getPendingDeposits(req, res) {
    try {
      const { page = 1, limit = 20, network } = req.query;

      // Log admin access to pending deposits
      logger.info('Admin accessed pending deposits', {
        adminId: req.user._id.toString(),
        sessionId: req.sessionID,
        page,
        limit,
        network,
        timestamp: new Date().toISOString()
      });

      const query = { status: 'confirmed' }; // Confirmed but not yet credited
      if (network) query.network = network;

      const deposits = await DepositTransaction.find(query)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .populate('userId', 'email username')
        .populate('depositAddressId', 'address network');

      const total = await DepositTransaction.countDocuments(query);

      res.json({
        deposits,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        },
        sessionInfo: {
          accessedAt: new Date(),
          sessionId: req.sessionID,
          adminId: req.user._id
        }
      });

    } catch (error) {
      logger.error('Error getting pending deposits:', {
        error: error.message,
        adminId: req.user._id.toString(),
        sessionId: req.sessionID,
        stack: error.stack
      });
      
      res.status(500).json({ 
        message: 'Failed to get pending deposits',
        error: error.message,
        sessionInfo: {
          errorAt: new Date(),
          sessionId: req.sessionID
        }
      });
    }
  }
  /**
   * Admin: Credit deposit to user account (Approve)
   */
  async creditDeposit(req, res) {
    try {
      const { transactionId } = req.params;
      const adminId = req.user._id;

      // Enhanced admin session validation for financial operations
      if (!req.session || !req.session.isAdmin) {
        logger.security('Unauthorized deposit credit attempt', {
          sessionId: req.sessionID,
          adminId: adminId.toString(),
          transactionId,
          timestamp: new Date().toISOString()
        });
        return res.status(403).json({ 
          message: 'Admin authorization required',
          sessionInfo: {
            deniedAt: new Date(),
            sessionId: req.sessionID
          }
        });
      }

      // Log admin deposit credit action
      logger.info('Admin initiated deposit credit', {
        adminId: adminId.toString(),
        sessionId: req.sessionID,
        transactionId,
        timestamp: new Date().toISOString()
      });

      const depositTx = await DepositTransaction.findById(transactionId)
        .populate('userId');

      if (!depositTx) {
        return res.status(404).json({ 
          message: 'Deposit transaction not found',
          sessionInfo: {
            checkedAt: new Date(),
            sessionId: req.sessionID
          }
        });
      }

      if (depositTx.status !== 'confirmed') {
        return res.status(400).json({ 
          message: 'Transaction is not confirmed yet',
          sessionInfo: {
            checkedAt: new Date(),
            sessionId: req.sessionID
          }
        });
      }

      if (depositTx.status === 'credited') {
        return res.status(400).json({ 
          message: 'Transaction already credited',
          sessionInfo: {
            checkedAt: new Date(),
            sessionId: req.sessionID
          }
        });
      }

      // Update user balance ATOMICALLY (prevent lost-update race condition)
      const user = depositTx.userId;
      const currentBalance = user.balances.get(depositTx.currency) || 0;
      
      await User.updateOne(
        { _id: user._id },
        { $inc: { 
          [`balances.${depositTx.currency}`]: depositTx.amount,
          totalDeposits: depositTx.amount 
        }}
      );
      
      // Create transaction record
      const transaction = new Transaction({
        user: user._id,
        type: 'deposit',
        subType: 'crypto_deposit',
        currency: depositTx.currency,
        amount: depositTx.amount,
        direction: 'credit',
        balanceBefore: currentBalance,
        balanceAfter: currentBalance + depositTx.amount,
        usdValue: depositTx.usdValue,
        status: 'completed',
        txHash: depositTx.txHash,
        network: depositTx.network,
        description: `Deposit credited by admin`,
        processedBy: adminId,
        ipAddress: req.ip,
        sessionId: req.sessionID,
        executedAt: new Date()
      });

      await transaction.save();

      // Update transaction status
      depositTx.status = 'credited';
      depositTx.creditedAt = new Date();
      depositTx.creditedBy = adminId;
      await depositTx.save();

      // Log successful credit action
      logger.info('Deposit credited successfully', {
        adminId: adminId.toString(),
        sessionId: req.sessionID,
        transactionId: depositTx._id.toString(),
        userId: user._id.toString(),
        amount: depositTx.amount,
        newBalance: user.balance,
        timestamp: new Date().toISOString()
      });

      // Check for referral completion (first deposit >= $10)
      try {
        const depositData = {
          transactionId: depositTx._id,
          amount: depositTx.amount,
          currency: depositTx.currency,
          usdValue: depositTx.usdValue || depositTx.amount // Assuming USD value is stored
        };
        
        // Try to process as a new successful referral first
        const referralResult = await ReferralService.processSuccessfulReferral(user._id, depositData);
        
        // If no pending referral was found, try to track as additional deposit from existing successful referral
        if (!referralResult) {
          await ReferralService.trackReferralDeposit(user._id, depositData);
        }
      } catch (referralError) {
        logger.error('Error processing referral completion:', {
          error: referralError.message,
          transactionId: depositTx._id.toString(),
          sessionId: req.sessionID
        });
        // Don't fail the deposit if referral processing fails
      }

      // Send notification to user about approval
      await notificationService.notifyUserDepositStatus(depositTx, 'approved', adminId);

      res.json({
        message: 'Deposit credited successfully',
        transaction: depositTx,
        newBalance: user.balance,
        sessionInfo: {
          creditedAt: new Date(),
          sessionId: req.sessionID,
          adminId
        }
      });

    } catch (error) {
      logger.error('Error crediting deposit:', {
        error: error.message,
        adminId: req.user._id.toString(),
        sessionId: req.sessionID,
        transactionId: req.params.transactionId,
        stack: error.stack
      });
      
      res.status(500).json({ 
        message: 'Failed to credit deposit',
        error: error.message,
        sessionInfo: {
          errorAt: new Date(),
          sessionId: req.sessionID
        }
      });
    }
  }

  /**
   * Admin: Reject deposit
   */
  async rejectDeposit(req, res) {
    console.log('🚨 REJECT DEPOSIT CALLED - Method entered');
    console.log('🚨 Request params:', req.params);
    console.log('🚨 Request body:', req.body);
    console.log('🚨 Request user:', req.user);
    
    try {
      const { transactionId } = req.params;
      const { reason, rejectionReason } = req.body; // Accept both field names
      const rejectionReasonText = reason || rejectionReason; // Use either field
      const adminId = req.user._id;

      console.log('🔍 Reject deposit request:', {
        transactionId,
        reason,
        rejectionReason,
        rejectionReasonText,
        adminId: adminId?.toString(),
        sessionId: req.sessionID
      });

      // Validate transactionId format
      if (!transactionId || !transactionId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid transaction ID format',
          transactionId
        });
      }

      // Enhanced admin session validation for financial operations
      if (!req.session || !req.session.isAdmin) {
        logger.security('Unauthorized deposit rejection attempt', {
          sessionId: req.sessionID,
          adminId: adminId.toString(),
          transactionId,
          timestamp: new Date().toISOString()
        });
        return res.status(403).json({ 
          message: 'Admin authorization required',
          sessionInfo: {
            deniedAt: new Date(),
            sessionId: req.sessionID
          }
        });
      }

      // Log admin deposit rejection action
      logger.info('Admin initiated deposit rejection', {
        adminId: adminId.toString(),
        sessionId: req.sessionID,
        transactionId,
        reason: rejectionReasonText,
        timestamp: new Date().toISOString()
      });

      const depositTx = await DepositTransaction.findById(transactionId)
        .populate('userId');

      if (!depositTx) {
        return res.status(404).json({ 
          message: 'Deposit transaction not found',
          sessionInfo: {
            checkedAt: new Date(),
            sessionId: req.sessionID
          }
        });
      }

      if (depositTx.status === 'credited') {
        return res.status(400).json({ 
          message: 'Cannot reject already credited transaction',
          sessionInfo: {
            checkedAt: new Date(),
            sessionId: req.sessionID
          }
        });
      }

      if (depositTx.status === 'failed') {
        return res.status(400).json({ 
          message: 'Transaction already rejected',
          sessionInfo: {
            checkedAt: new Date(),
            sessionId: req.sessionID
          }
        });
      }

      // Update transaction status
      depositTx.status = 'failed';
      depositTx.notes = rejectionReasonText || 'Rejected by admin';
      depositTx.creditedBy = adminId;
      await depositTx.save();

      // Log successful rejection action
      logger.info('Deposit rejected successfully', {
        adminId: adminId.toString(),
        sessionId: req.sessionID,
        transactionId: depositTx._id.toString(),
        userId: depositTx.userId._id.toString(),
        reason: rejectionReasonText,
        timestamp: new Date().toISOString()
      });

      // Send notification to user about rejection (with error handling)
      try {
        await notificationService.notifyUserDepositStatus(depositTx, 'rejected', adminId);
      } catch (notificationError) {
        console.error('Error sending rejection notification:', notificationError);
        // Continue execution even if notification fails
      }

      res.json({
        message: 'Deposit rejected successfully',
        transaction: depositTx,
        sessionInfo: {
          rejectedAt: new Date(),
          sessionId: req.sessionID,
          adminId
        }
      });

    } catch (error) {
      logger.error('Error rejecting deposit:', {
        error: error.message,
        adminId: req.user?._id?.toString() || 'unknown',
        sessionId: req.sessionID,
        transactionId: req.params.transactionId,
        stack: error.stack
      });
      
      res.status(500).json({ 
        message: 'Failed to reject deposit',
        error: error.message,
        sessionInfo: {
          errorAt: new Date(),
          sessionId: req.sessionID
        }
      });
    }
  }

  /**
   * Admin: Get deposit statistics
   */
  async getDepositStats(req, res) {
    try {
      // Check if req.user exists (middleware sets req.user.id, not req.user._id)
      const adminId = req.user?._id || req.user?.id;
      if (!req.user || !adminId) {
        logger.error('Missing user in request for deposit stats', {
          hasUser: !!req.user,
          userKeys: req.user ? Object.keys(req.user) : null,
          sessionId: req.sessionID
        });
        return res.status(401).json({ 
          message: 'User authentication required',
          error: 'Missing user data in request'
        });
      }

      // Log admin access to deposit statistics
      logger.info('Admin accessed deposit statistics', {
        adminId: adminId.toString(),
        sessionId: req.sessionID,
        timestamp: new Date().toISOString()
      });

      const stats = await DepositTransaction.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      const networkStats = await DepositTransaction.aggregate([
        {
          $group: {
            _id: '$network',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      const depositStats = {
        byStatus: stats,
        byNetwork: networkStats,
        totalAddresses: await DepositAddress.countDocuments({ isActive: true }),
        sessionInfo: {
          accessedAt: new Date(),
          sessionId: req.sessionID,
          adminId: adminId
        }
      };

      res.json(depositStats);
    } catch (error) {
      const adminId = req.user?._id || req.user?.id;
      logger.error('Error getting deposit stats:', {
        error: error.message,
        adminId: adminId?.toString() || 'unknown',
        sessionId: req.sessionID,
        stack: error.stack
      });
      
      res.status(500).json({ 
        message: 'Failed to get deposit stats',
        error: error.message,
        sessionInfo: {
          errorAt: new Date(),
          sessionId: req.sessionID
        }
      });
    }
  }

  /**
   * Admin: Deposit monitoring disabled - using manual management
   */
  async toggleMonitoring(req, res) {
    try {
      res.json({ 
        message: 'Automatic deposit monitoring is disabled. Using manual deposit management.',
        monitoring: false
      });
    } catch (error) {
      console.error('Error with monitoring status:', error);
      res.status(500).json({ 
        message: 'Failed to get monitoring status',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Manually check specific address
   */
  async checkAddress(req, res) {
    try {
      const { addressId } = req.params;

      const depositAddress = await DepositAddress.findById(addressId);
      if (!depositAddress) {
        return res.status(404).json({ message: 'Deposit address not found' });
      }

      // Automatic address checking disabled - using manual management

      res.json({ 
        message: 'Automatic address checking is disabled. Please use manual deposit verification.',
        address: depositAddress.address,
        network: depositAddress.network
      });

    } catch (error) {
      console.error('Error checking address:', error);
      res.status(500).json({ 
        message: 'Failed to check address',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Manually create deposit transaction
   */
  async createDepositTransaction(req, res) {
    try {
      const { 
        userId, 
        amount, 
        currency, 
        txHash, 
        network, 
        notes 
      } = req.body;
      const adminId = req.user._id;

      // Validate required fields
      if (!userId || !amount || !currency || !txHash || !network) {
        return res.status(400).json({ 
          message: 'Missing required fields: userId, amount, currency, txHash, network' 
        });
      }

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if transaction hash already exists
      const existingTx = await DepositTransaction.findOne({ txHash });
      if (existingTx) {
        return res.status(400).json({ 
          message: 'Transaction with this hash already exists' 
        });
      }

      // Find user's deposit address for this network
      const depositAddress = await DepositAddress.findOne({ 
        userId, 
        network: network.toUpperCase() 
      });

      if (!depositAddress) {
        return res.status(404).json({ 
          message: `No ${network} deposit address found for this user` 
        });
      }

      // Calculate USD value (you might want to integrate with price API)
      let usdValue = amount;
      if (currency.toUpperCase() !== 'USDT' && currency.toUpperCase() !== 'USD') {
        // For now, assume 1:1 ratio, but you should integrate with a price service
        // Example: usdValue = await getPriceInUSD(currency, amount);
        usdValue = amount; // Placeholder - implement proper price conversion
      }

      // Create deposit transaction
      const depositTx = new DepositTransaction({
        userId,
        depositAddressId: depositAddress._id,
        amount: parseFloat(amount),
        currency: currency.toUpperCase(),
        network: network.toUpperCase(),
        txHash,
        usdValue: parseFloat(usdValue),
        status: 'confirmed', // Admin manually confirms
        notes: notes || `Manually created by admin`,
        createdBy: adminId,
        confirmedAt: new Date()
      });

      await depositTx.save();

      // Update deposit address total
      await DepositAddress.findByIdAndUpdate(depositAddress._id, {
        $inc: { totalDeposited: parseFloat(amount) }
      });

      // Send notification to user
      try {
        await notificationService.createNotification({
          userId: userId,
          type: 'deposit',
          title: '💰 Deposit Detected',
          message: `Your ${currency} deposit of ${amount} has been detected and is pending approval.`,
          channel: 'in-app',
          metadata: {
            depositId: depositTx._id,
            amount: amount,
            currency: currency,
            txHash: txHash
          }
        });
      } catch (notificationError) {
        console.error('Failed to send deposit notification:', notificationError);
      }

      res.status(201).json({
        message: 'Deposit transaction created successfully',
        transaction: depositTx
      });

    } catch (error) {
      console.error('Error creating deposit transaction:', error);
      res.status(500).json({ 
        message: 'Failed to create deposit transaction',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Get all deposit transactions
   */
  async getAllDeposits(req, res) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        status, 
        network, 
        userId,
        dateFrom,
        dateTo 
      } = req.query;

      const query = {};
      if (status) query.status = status;
      if (network) query.network = network.toUpperCase();
      if (userId) query.userId = userId;
      
      // Date range filter
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }

      const deposits = await DepositTransaction.find(query)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .populate('userId', 'email username')
        .populate('depositAddressId', 'address network')
        .populate('createdBy', 'username email')
        .populate('creditedBy', 'username email');

      const total = await DepositTransaction.countDocuments(query);

      // Get summary statistics
      const stats = await DepositTransaction.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalUsdValue: { $sum: '$usdValue' }
          }
        }
      ]);

      res.json({
        deposits,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        },
        statistics: stats
      });

    } catch (error) {
      console.error('Error getting all deposits:', error);
      res.status(500).json({ 
        message: 'Failed to get deposits',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Search users for deposit creation
   */
  async searchUsers(req, res) {
    try {
      const { search } = req.query;
      
      if (!search || search.length < 2) {
        return res.status(400).json({ 
          message: 'Search term must be at least 2 characters' 
        });
      }

      const users = await User.find({
        $or: [
          { username: { $regex: escapeRegex(search), $options: 'i' } },
          { email: { $regex: escapeRegex(search), $options: 'i' } }
        ]
      })
      .select('_id username email depositAddresses')
      .limit(20);

      res.json({
        users: users.map(user => ({
          _id: user._id,
          username: user.username,
          email: user.email,
          hasAddresses: !!(user.depositAddresses?.BEP20 || user.depositAddresses?.TRC20)
        }))
      });

    } catch (error) {
      console.error('Error searching users:', error);
      res.status(500).json({ 
        message: 'Failed to search users',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Get user's deposit addresses for manual deposit creation
   */
  async getUserDepositAddresses(req, res) {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId).select('username email');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const addresses = await DepositAddress.find({ 
        userId, 
        isActive: true 
      }).select('network address totalDeposited');

      res.json({
        user: {
          _id: userId,
          username: user.username,
          email: user.email
        },
        addresses
      });

    } catch (error) {
      console.error('Error getting user deposit addresses:', error);
      res.status(500).json({ 
        message: 'Failed to get user deposit addresses',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Get user deposit information for manual verification
   */
  async getUserDepositInfo(req, res) {
    try {
      const { userId } = req.params;
      
      const user = await User.findById(userId).select('username email balance totalDeposits');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const addresses = await DepositAddress.find({ 
        userId, 
        isActive: true 
      }).select('network address totalDeposited createdAt');

      const depositHistory = await DepositTransaction.find({ userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('amount network txHash status createdAt');

      const userInfo = {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          balance: user.balance,
          totalDeposits: user.totalDeposits
        },
        addresses: addresses.map(addr => ({
          network: addr.network,
          address: addr.address,
          totalDeposited: addr.totalDeposited,
          explorerUrl: addr.network === 'BEP20' 
            ? `https://bscscan.com/address/${addr.address}`
            : `https://tronscan.org/#/address/${addr.address}`,
          createdAt: addr.createdAt
        })),
        recentDeposits: depositHistory
      };
      
      res.json({
        success: true,
        data: userInfo
      });

    } catch (error) {
      console.error('Error getting user deposit info:', error);
      res.status(500).json({ 
        message: 'Failed to get user deposit info',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Verify transaction on blockchain manually (simplified)
   */
  async verifyTransaction(req, res) {
    try {
      const { txHash, network, expectedAddress, expectedAmount } = req.body;

      if (!txHash || !network) {
        return res.status(400).json({ 
          message: 'Transaction hash and network are required' 
        });
      }

      // Simplified verification - return basic structure for manual verification
      const verification = {
        valid: true,
        txHash: txHash,
        network: network.toUpperCase(),
        explorerUrl: network.toUpperCase() === 'BEP20' 
          ? `https://bscscan.com/tx/${txHash}`
          : `https://tronscan.org/#/transaction/${txHash}`,
        message: 'Please manually verify this transaction on the blockchain explorer.'
      };

      res.json({
        success: true,
        verification
      });

    } catch (error) {
      console.error('Error verifying transaction:', error);
      res.status(500).json({ 
        message: 'Failed to verify transaction',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Create deposit after manual blockchain verification
   */
  async createManualDeposit(req, res) {
    try {
      const adminId = req.user._id;
      const { userId, txHash, amount, network, notes } = req.body;

      // Verify user exists and has address for this network
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const depositAddress = await DepositAddress.findOne({ 
        userId, 
        network: network.toUpperCase() 
      });

      if (!depositAddress) {
        return res.status(404).json({ 
          message: `No ${network} deposit address found for this user` 
        });
      }

      // Check if transaction already exists
      const existingTx = await DepositTransaction.findOne({ txHash });
      if (existingTx) {
        return res.status(400).json({ message: 'Transaction with this hash already exists' });
      }

      // Create deposit transaction record
      const depositTx = new DepositTransaction({
        userId,
        depositAddressId: depositAddress._id,
        amount: parseFloat(amount),
        currency: 'USDT',
        usdValue: parseFloat(amount),
        network: network.toUpperCase(),
        txHash,
        fromAddress: 'manual-verification',
        toAddress: depositAddress.address,
        status: 'confirmed',
        confirmations: 99,
        requiredConfirmations: network === 'BEP20' ? 12 : 19,
        notes: notes || `Manually verified by admin`,
        createdBy: adminId,
        confirmedAt: new Date(),
        blockNumber: 0
      });

      await depositTx.save();

      // Update deposit address total
      await DepositAddress.findByIdAndUpdate(depositAddress._id, {
        $inc: { totalDeposited: parseFloat(amount) }
      });

      // Send notification to user
      await notificationService.createNotification({
        recipientType: 'user',
        recipientId: userId,
        title: '💰 Deposit Detected',
        message: `Your ${network} deposit of ${amount} USDT has been manually verified and confirmed.`,
        type: 'deposit_confirmed',
        relatedData: {
          depositId: depositTx._id,
          amount: amount,
          currency: 'USDT',
          txHash: txHash,
          network: network
        }
      });

      const result = {
        success: true,
        transaction: depositTx,
        message: 'Deposit created successfully and confirmed'
      };
      
      res.status(201).json(result);

    } catch (error) {
      console.error('Error creating manual deposit:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to create deposit',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Manually generate deposit addresses for a user
   */
  async generateUserAddresses(req, res) {
    try {
      const { userId } = req.body;
      const adminId = req.user._id;

      if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
      }

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if addresses already exist
      const existingAddresses = await DepositAddress.find({ userId });
      
      if (existingAddresses.length >= 2) {
        return res.status(400).json({ 
          message: 'Deposit addresses already generated for this user',
          addresses: {
            BEP20: existingAddresses.find(addr => addr.network === 'BEP20')?.address,
            TRC20: existingAddresses.find(addr => addr.network === 'TRC20')?.address
          }
        });
      }

      const addressCount = await DepositAddress.countDocuments();
      const addressIndex = addressCount + 1;

      const results = {};
      const networks = ['BEP20', 'TRC20'];

      for (const network of networks) {
        // Check if address already exists for this network
        const existing = await DepositAddress.findOne({ userId, network });
        if (existing) {
          results[network] = existing.address;
          continue;
        }

        // Generate new address
        const walletData = hdWalletService.generateDepositAddress(userId, network, addressIndex);
        
        // Encrypt private key for storage
        const encryptedKey = hdWalletService.encryptPrivateKey(walletData.privateKey);

        // Create deposit address record
        const depositAddress = new DepositAddress({
          userId,
          network,
          address: walletData.address,
          privateKey: JSON.stringify(encryptedKey),
          derivationPath: walletData.derivationPath,
          addressIndex: walletData.addressIndex,
          createdBy: adminId // Track which admin created this
        });

        await depositAddress.save();
        results[network] = walletData.address;
      }

      // Update user record
      await User.findByIdAndUpdate(userId, {
        $set: {
          'depositAddresses.BEP20': results.BEP20,
          'depositAddresses.TRC20': results.TRC20,
          addressGenerated: true
        }
      });

      // Send notification to user
      await notificationService.createNotification({
        userId: userId,
        type: 'system',
        title: '🏦 Deposit Addresses Generated',
        message: 'Your deposit addresses have been generated by admin. You can now deposit USDT.',
        channel: 'in-app',
        metadata: {
          BEP20: results.BEP20,
          TRC20: results.TRC20,
          generatedBy: adminId
        }
      });

      res.json({
        success: true,
        message: 'Deposit addresses generated successfully by admin',
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        },
        addresses: results,
        generatedBy: adminId
      });

    } catch (error) {
      console.error('Error generating user addresses:', error);
      res.status(500).json({ 
        message: 'Failed to generate deposit addresses',
        error: error.message 
      });
    }
  }

  /**
   * Submit deposit request for manual verification
   */
  async submitDepositRequest(req, res) {
    try {
      const userId = req.user._id;
      const { amount, network, address } = req.body;

      // Validate input
      if (!amount || !network || !address) {
        return res.status(400).json({
          message: 'Amount, network, and address are required'
        });
      }

      if (amount < 20) {
        return res.status(400).json({
          message: 'Minimum deposit amount is 20 USDT'
        });
      }

      // Normalize network name
      const normalizedNetwork = network === 'BSC' ? 'BEP20' : network;

      // Handle TRC20 static address vs BEP20 dynamic address
      let depositAddress = null;
      
      if (normalizedNetwork === 'TRC20') {
        // TRC20 uses static address from env - find or create placeholder record
        depositAddress = await DepositAddress.findOne({ 
          userId, 
          network: 'TRC20'
        });

        // If no TRC20 address record exists for this user, create a placeholder
        if (!depositAddress) {
          depositAddress = new DepositAddress({
            userId,
            network: 'TRC20',
            address: address, // Use the static address provided
            privateKey: 'static-address-no-key', // Placeholder since we don't manage this key
            derivationPath: 'static-trc20', // Placeholder
            addressIndex: 0, // Placeholder
            isActive: true
          });
          await depositAddress.save();
        }
      } else {
        // BEP20 - verify the address belongs to the user
        depositAddress = await DepositAddress.findOne({ 
          userId, 
          address,
          network: normalizedNetwork
        });

        if (!depositAddress) {
          return res.status(400).json({ 
            message: 'Invalid deposit address for this user. Please generate your BEP20 address first.' 
          });
        }
      }

      // Create deposit transaction record
      const depositTransaction = new DepositTransaction({
        userId,
        depositAddressId: depositAddress._id,
        amount,
        network: normalizedNetwork,
        toAddress: address,
        usdValue: amount, // For USDT, amount equals USD value
        currency: 'USDT',
        status: 'submitted',
        coin: 'USDT',
        from: 'external', // Since user is providing the transaction
        blockchainConfirmations: 0,
        submittedAt: new Date(),
        createdAt: new Date()
      });

      await depositTransaction.save();

      // Send notification to user
      await notificationService.createNotification({
        recipientType: 'user',
        recipientId: userId,
        type: 'deposit_submitted',
        title: 'Deposit Request Submitted',
        message: `Your deposit request for ${amount} USDT has been submitted for verification.`,
        relatedData: {
          amount,
          network,
          depositId: depositTransaction._id
        }
      });

      res.json({
        message: 'Deposit request submitted successfully',
        depositId: depositTransaction._id,
        status: 'submitted'
      });

    } catch (error) {
      console.error('Error submitting deposit request:', error);
      
      // Handle validation errors specifically
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({ 
          message: 'Validation failed',
          errors: validationErrors,
          error: error.message 
        });
      }
      
      res.status(500).json({ 
        message: 'Failed to submit deposit request',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Get all pending deposit requests
   */
  async getAdminDepositRequests(req, res) {
    try {
      const { page = 1, limit = 20, status = 'submitted', network } = req.query;

      const query = { status };
      if (network) query.network = network;

      const deposits = await DepositTransaction.find(query)
        .populate('userId', 'username email')
        .populate('depositAddressId', 'address network')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await DepositTransaction.countDocuments(query);

      res.json({
        deposits,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      });

    } catch (error) {
      console.error('Error getting admin deposit requests:', error);
      res.status(500).json({ 
        message: 'Failed to get deposit requests',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Approve deposit request
   */
  async approveDepositRequest(req, res) {
    try {
      const { depositId } = req.params;
      const { confirmedAmount, blockConfirmations = 12 } = req.body;

      const deposit = await DepositTransaction.findById(depositId);
      if (!deposit) {
        return res.status(404).json({ message: 'Deposit request not found' });
      }

      if (deposit.status !== 'submitted') {
        return res.status(400).json({ message: 'Deposit request has already been processed' });
      }

      // Update deposit status
      deposit.status = 'approved';
      deposit.confirmedAmount = confirmedAmount || deposit.amount;
      deposit.blockchainConfirmations = blockConfirmations;
      deposit.approvedAt = new Date();
      deposit.approvedBy = req.admin._id;
      await deposit.save();

      // Update user balance - use simple balances object
      const user = await User.findById(deposit.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Initialize balances object if it doesn't exist
      if (!user.balances) {
        user.balances = new Map();
      }
      
      // Initialize USDT balance if it doesn't exist
      if (!user.balances.get('USDT')) {
        user.balances.set('USDT', 0);
      }
      
      // Add the deposit amount to user's USDT balance
      const currentUSDT = user.balances.get('USDT') || 0;
      user.balances.set('USDT', currentUSDT + deposit.confirmedAmount);
      
      // Update total deposits
      if (!user.totalDeposits) user.totalDeposits = 0;
      user.totalDeposits += deposit.confirmedAmount;
      
      await user.save();

      // Check for referral completion (first deposit >= $25)
      try {
        const depositData = {
          transactionId: deposit._id,
          amount: deposit.confirmedAmount,
          currency: deposit.currency,
          usdValue: deposit.usdValue || deposit.confirmedAmount
        };
        
        // Try to process as a new successful referral first
        const referralResult = await ReferralService.processSuccessfulReferral(user._id, depositData);
        
        // If no pending referral was found, try to track as additional deposit from existing successful referral
        if (!referralResult) {
          await ReferralService.trackReferralDeposit(user._id, depositData);
        }
        
        // Check if this is user's first deposit and they have no referrer - give $1 bonus
        if (user.totalDeposits === deposit.confirmedAmount) { // This means it's their first deposit
          const Referral = require('../models/referral');
          const hasReferrer = await Referral.findOne({ 
            referee: user._id, 
            status: { $in: ['pending', 'successful'] } 
          });
          
          if (!hasReferrer && deposit.confirmedAmount >= 25) {
            // Give $1 bonus for first deposit without referrer
            const currentUSDT = user.balances.get('USDT') || 0;
            user.balances.set('USDT', currentUSDT + 1);
            await user.save();
            
            // Send notification about the bonus
            await notificationService.createNotification({
              recipientType: 'user',
              recipientId: user._id,
              type: 'first_deposit_bonus',
              title: 'Welcome Bonus!',
              message: 'Congratulations! You received a $1 welcome bonus for your first deposit.',
              relatedData: {
                bonusAmount: 1,
                depositAmount: deposit.confirmedAmount
              }
            });
          }
        }
      } catch (referralError) {
        console.error('Error processing referral completion:', referralError);
        // Don't fail the deposit if referral processing fails
      }

      // Update deposit address total
      await DepositAddress.findByIdAndUpdate(
        deposit.depositAddressId,
        { $inc: { totalDeposited: deposit.confirmedAmount } }
      );

      // Send notification to user
      await notificationService.createNotification({
        recipientType: 'user',
        recipientId: deposit.userId,
        type: 'deposit_approved',
        title: 'Deposit Approved',
        message: `Your deposit of ${deposit.confirmedAmount} USDT has been credited to your account.`,
        relatedData: {
          amount: deposit.confirmedAmount,
          transactionId: deposit._id
        }
      });

      res.json({
        message: 'Deposit request approved successfully',
        deposit: deposit
      });

    } catch (error) {
      console.error('Error approving deposit request:', error);
      res.status(500).json({ 
        message: 'Failed to approve deposit request',
        error: error.message 
      });
    }
  }

  /**
   * Admin: Reject deposit request
   */
  async rejectDepositRequest(req, res) {
    try {
      console.log('🚨 REJECT DEPOSIT REQUEST CALLED:', {
        params: req.params,
        body: req.body,
        method: 'rejectDepositRequest'
      });

      const { depositId } = req.params;
      const { rejectionReason } = req.body;

      if (!rejectionReason) {
        return res.status(400).json({ message: 'Rejection reason is required' });
      }

      const deposit = await DepositTransaction.findById(depositId);
      if (!deposit) {
        return res.status(404).json({ message: 'Deposit request not found' });
      }

      if (deposit.status !== 'submitted') {
        return res.status(400).json({ message: 'Deposit request has already been processed' });
      }

      // Update deposit status
      deposit.status = 'rejected';
      deposit.rejectionReason = rejectionReason;
      deposit.rejectedAt = new Date();
      deposit.rejectedBy = req.admin._id;
      await deposit.save();

      // Send notification to user
      await notificationService.createNotification({
        recipientType: 'user',
        recipientId: deposit.userId,
        type: 'deposit_rejected',
        title: 'Deposit Rejected',
        message: `Your deposit request has been rejected. Reason: ${rejectionReason}`,
        relatedData: {
          amount: deposit.amount,
          rejectionReason,
          transactionId: deposit._id
        }
      });

      res.json({
        message: 'Deposit request rejected successfully',
        deposit: deposit
      });

    } catch (error) {
      console.error('Error rejecting deposit request:', error);
      res.status(500).json({ 
        message: 'Failed to reject deposit request',
        error: error.message 
      });
    }
  }
}

module.exports = new DepositController();
