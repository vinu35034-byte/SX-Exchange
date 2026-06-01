const hdWalletService = require('../utils/hdWalletService');
const DepositAddress = require('../models/depositAddress');
const DepositTransaction = require('../models/depositTransaction');
const User = require('../models/user');
const Notification = require('../models/notification');

class DepositMonitoringService {
  constructor() {
    this.isRunning = false;
    this.interval = null;
    this.checkInterval = parseInt(process.env.DEPOSIT_CHECK_INTERVAL) || 30000; // 30 seconds default
    this.processedTransactions = new Set(); // To avoid duplicate processing
  }

  /**
   * Start the deposit monitoring service
   */
  start() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    
    // Initial check
    this.checkAllDeposits();
    
    // Set up interval for continuous monitoring
    this.interval = setInterval(() => {
      this.checkAllDeposits();
    }, this.checkInterval);

  }

  /**
   * Stop the deposit monitoring service
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

  }

  /**
   * Check all user deposit addresses for new transactions
   */
  async checkAllDeposits() {
    try {
      // Get all deposit addresses from database
      const depositAddresses = await DepositAddress.find({ network: 'BEP20' }).populate('userId');
      
      if (depositAddresses.length === 0) {
        return;
      }

     
      // Check each address for new transactions
      for (const depositAddress of depositAddresses) {
        try {
          await this.checkAddressForDeposits(depositAddress);
        } catch (error) {
          console.error(`❌ Error checking address ${depositAddress.address}:`, error.message);
        }
      }

    } catch (error) {
      console.error('❌ Error in deposit monitoring:', error);
    }
  }

  /**
   * Check a specific address for new deposits
   */
  async checkAddressForDeposits(depositAddress) {
    try {
      // Get transaction history for this address
      const transactions = await hdWalletService.getTransactions(depositAddress.address);
      
      if (!transactions || transactions.length === 0) {
        return; // No transactions found
      }

      // Filter for incoming USDT transactions
      const incomingTxs = transactions.filter(tx => 
        tx.to.toLowerCase() === depositAddress.address.toLowerCase() &&
        tx.contractAddress.toLowerCase() === hdWalletService.usdtContract.toLowerCase() &&
        !this.processedTransactions.has(tx.hash)
      );

      if (incomingTxs.length === 0) {
        return; // No new incoming transactions
      }

   
      // Process each new transaction
      for (const tx of incomingTxs) {
        await this.processNewDeposit(depositAddress, tx);
        this.processedTransactions.add(tx.hash); // Mark as processed
      }

    } catch (error) {
      console.error(`Error checking deposits for ${depositAddress.address}:`, error);
    }
  }

  /**
   * Process a new deposit transaction
   */
  async processNewDeposit(depositAddress, transaction) {
    try {
      // Convert transaction value to USDT amount
      const amount = parseFloat(hdWalletService.web3.utils.fromWei(transaction.value, 'ether'));
      
      if (amount <= 0) {
        return;
      }

     
      // Check if this transaction already exists in our database
      const existingDeposit = await DepositTransaction.findOne({ txHash: transaction.hash });
      if (existingDeposit) {
        return;
      }

      // Create deposit transaction record
      const depositTransaction = new DepositTransaction({
        userId: depositAddress.userId._id,
        address: depositAddress.address,
        network: 'BEP20',
        amount: amount,
        txHash: transaction.hash,
        blockNumber: parseInt(transaction.blockNumber),
        timestamp: new Date(parseInt(transaction.timeStamp) * 1000),
        status: 'pending', // Admin needs to manually approve
        confirmations: transaction.confirmations || 0,
        fromAddress: transaction.from
      });

      await depositTransaction.save();

      // Create notification for admins
      await this.createAdminNotification(depositAddress.userId, depositTransaction);

      // Create notification for user
      await this.createUserNotification(depositAddress.userId, depositTransaction);

    } catch (error) {
      console.error('Error processing new deposit:', error);
    }
  }

  /**
   * Create notification for admins about new deposit
   */
  async createAdminNotification(user, depositTransaction) {
    try {
      const notification = new Notification({
        title: '💰 New Deposit Detected',
        message: `${user.username} deposited ${depositTransaction.amount} USDT`,
        type: 'deposit',
        data: {
          userId: user._id,
          username: user.username,
          amount: depositTransaction.amount,
          network: depositTransaction.network,
          txHash: depositTransaction.txHash,
          address: depositTransaction.address
        },
        targetAudience: 'admin',
        isGlobal: true,
        priority: 'high'
      });

      await notification.save();
  
    } catch (error) {
      console.error('Error creating admin notification:', error);
    }
  }

  /**
   * Create notification for user about detected deposit
   */
  async createUserNotification(user, depositTransaction) {
    try {
      const notification = new Notification({
        userId: user._id,
        title: '💰 Deposit Detected',
        message: `We detected your ${depositTransaction.amount} USDT deposit. It's pending admin approval.`,
        type: 'deposit',
        data: {
          amount: depositTransaction.amount,
          network: depositTransaction.network,
          txHash: depositTransaction.txHash,
          status: 'pending'
        },
        targetAudience: 'user',
        priority: 'medium'
      });

      await notification.save();
 
    } catch (error) {
      console.error('Error creating user notification:', error);
    }
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      processedTransactionsCount: this.processedTransactions.size
    };
  }

  /**
   * Update check interval
   */
  setCheckInterval(intervalMs) {
    this.checkInterval = intervalMs;
    
    if (this.isRunning) {
      // Restart with new interval
      this.stop();
      this.start();
    }
    
  }

  /**
   * Manual deposit check (for testing or immediate check)
   */
  async manualCheck() {
   await this.checkAllDeposits();
  }
}

module.exports = new DepositMonitoringService();

module.exports = new DepositMonitoringService();
