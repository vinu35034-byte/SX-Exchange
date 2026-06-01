const DepositAddress = require('../models/depositAddress');
const DepositTransaction = require('../models/depositTransaction');
const User = require('../models/user');
const hdWalletService = require('./hdWalletService');
const notificationService = require('./notificationService');
const axios = require('axios');

class DepositMonitorService {
  constructor() {
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.updateInterval = null;
    this.checkInterval = process.env.DEPOSIT_CHECK_INTERVAL || 30000; // 30 seconds
    this.updateConfirmationsInterval = 60000; // 1 minute for confirmation updates
    this.rateLimitDelay = 1000; // 1 second between API calls
    this.maxRetries = 3;
    }

  /**
   * Start monitoring deposits
   */
  startMonitoring() {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    
    // Initial check
    this.checkAllDeposits();
    
    // Set up interval checking
    this.monitoringInterval = setInterval(() => {
      this.checkAllDeposits();
    }, this.checkInterval);
  }

  /**
   * Stop monitoring deposits
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Check all active deposit addresses for new transactions
   */
  async checkAllDeposits() {
    try {
      const activeAddresses = await DepositAddress.find({ 
        isActive: true,
        isSwept: false 
      }).populate('userId');
      const checkPromises = activeAddresses.map(address => 
        this.checkAddressForDeposits(address)
      );

      await Promise.allSettled(checkPromises);
      
      // Update last checked timestamp
      await DepositAddress.updateMany(
        { isActive: true },
        { lastChecked: new Date() }
      );

    } catch (error) {
      console.error('Error during deposit monitoring:', error);
    }
  }

  /**
   * Check a specific address for new deposits
   */
  async checkAddressForDeposits(depositAddress) {
    try {
      let transactions = [];
      
      if (depositAddress.network === 'BEP20') {
        transactions = await this.checkBEP20Deposits(depositAddress);
      } else if (depositAddress.network === 'TRC20') {
        transactions = await this.checkTRC20Deposits(depositAddress);
      }

      // Process each new transaction
      for (const tx of transactions) {
        await this.processTransaction(tx, depositAddress);
      }

    } catch (error) {
      console.error(`Error checking deposits for ${depositAddress.address}:`, error);
    }
  }

  /**
   * Check BEP20 deposits using BSCScan API
   */
  async checkBEP20Deposits(depositAddress) {
    try {
      const apiKey = process.env.BSCSCAN_API_KEY;
      if (!apiKey) {
        return [];
      }

      const response = await axios.get('https://api.bscscan.com/api', {
        params: {
          module: 'account',
          action: 'tokentx',
          contractaddress: hdWalletService.usdtContracts.BEP20,
          address: depositAddress.address,
          startblock: 0,
          endblock: 99999999,
          sort: 'desc',
          apikey: apiKey
        }
      });

      if (response.data.status !== '1') {
        return [];
      }

      const transactions = response.data.result || [];
      const newTransactions = [];

      for (const tx of transactions) {
        // Check if transaction already exists
        const existingTx = await DepositTransaction.findOne({ txHash: tx.hash });
        if (existingTx) continue;

        // Only process incoming transactions
        if (tx.to.toLowerCase() !== depositAddress.address.toLowerCase()) continue;

        newTransactions.push({
          txHash: tx.hash,
          fromAddress: tx.from,
          toAddress: tx.to,
          amount: parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal)),
          blockNumber: parseInt(tx.blockNumber),
          blockHash: tx.blockHash,
          gasUsed: parseInt(tx.gasUsed),
          gasPrice: tx.gasPrice,
          confirmations: await this.getBEP20Confirmations(tx.blockNumber),
          network: 'BEP20',
          timestamp: new Date(parseInt(tx.timeStamp) * 1000)
        });
      }

      return newTransactions;
    } catch (error) {
      console.error('Error checking BEP20 deposits:', error);
      return [];
    }
  }

  /**
   * Check TRC20 deposits using TronGrid API
   */  async checkTRC20Deposits(depositAddress) {
    try {
      const tronApiKey = process.env.TRON_API_KEY || '';
      if (!tronApiKey) {
        return [];
      }

      const response = await axios.get(`https://api.trongrid.io/v1/accounts/${depositAddress.address}/transactions/trc20`, {
        params: {
          limit: 50,
          contract_address: hdWalletService.usdtContracts.TRC20
        },
        headers: {
          'TRON-PRO-API-KEY': tronApiKey
        }
      });

      const transactions = response.data.data || [];
      const newTransactions = [];

      for (const tx of transactions) {
        // Check if transaction already exists
        const existingTx = await DepositTransaction.findOne({ txHash: tx.transaction_id });
        if (existingTx) continue;

        // Only process incoming transactions
        if (tx.to !== depositAddress.address) continue;

        newTransactions.push({
          txHash: tx.transaction_id,
          fromAddress: tx.from,
          toAddress: tx.to,
          amount: parseFloat(tx.value) / Math.pow(10, tx.token_info.decimals),
          blockNumber: tx.block_number,
          confirmations: await this.getTRC20Confirmations(tx.block_number),
          network: 'TRC20',
          timestamp: new Date(tx.block_timestamp)
        });
      }

      return newTransactions;
    } catch (error) {
      console.error('Error checking TRC20 deposits:', error);
      return [];
    }
  }

  /**
   * Get current confirmations for BEP20 transaction
   */
  async getBEP20Confirmations(blockNumber) {
    try {
      const currentBlock = await hdWalletService.web3.eth.getBlockNumber();
      return currentBlock - blockNumber;
    } catch (error) {
      console.error('Error getting BEP20 confirmations:', error);
      return 0;
    }
  }

  /**
   * Get current confirmations for TRC20 transaction
   */
  async getTRC20Confirmations(blockNumber) {
    try {
      const currentBlock = await hdWalletService.tronWeb.trx.getCurrentBlock();
      return currentBlock.block_header.raw_data.number - blockNumber;
    } catch (error) {
      console.error('Error getting TRC20 confirmations:', error);
      return 0;
    }
  }
  /**
   * Process a new transaction
   */
  async processTransaction(txData, depositAddress) {
    try {
      // Create deposit transaction record
      const depositTx = new DepositTransaction({
        userId: depositAddress.userId,
        depositAddressId: depositAddress._id,
        network: txData.network,
        txHash: txData.txHash,
        fromAddress: txData.fromAddress,
        toAddress: txData.toAddress,
        amount: txData.amount,
        confirmations: txData.confirmations,
        requiredConfirmations: txData.network === 'BEP20' ? 12 : 19,
        status: txData.confirmations >= (txData.network === 'BEP20' ? 12 : 19) ? 'confirmed' : 'pending',
        blockNumber: txData.blockNumber,
        blockHash: txData.blockHash,
        gasUsed: txData.gasUsed,
        gasPrice: txData.gasPrice
      });

      await depositTx.save();

      // Populate user data for notifications
      await depositTx.populate('userId', 'email username');

      // Update deposit address total
      depositAddress.totalDeposited += txData.amount;
      await depositAddress.save();

      await notificationService.notifyUserDepositDetected(depositTx);

      // If transaction is confirmed, notify admin and user
      if (depositTx.status === 'confirmed') {
        
        // Notify user about confirmation
        await notificationService.notifyUserDepositConfirmed(depositTx);
        
        // Notify admin about new confirmed deposit
        await notificationService.notifyAdminNewDeposit(depositTx);
      }

    } catch (error) {
      console.error('Error processing transaction:', error);
    }
  }
  /**
   * Update confirmations for pending transactions
   */
  async updatePendingTransactions() {
    try {
      const pendingTxs = await DepositTransaction.find({ 
        status: 'pending' 
      }).populate('userId', 'email username');

      for (const tx of pendingTxs) {
        let currentConfirmations = 0;
        
        if (tx.network === 'BEP20') {
          currentConfirmations = await this.getBEP20Confirmations(tx.blockNumber);
        } else if (tx.network === 'TRC20') {
          currentConfirmations = await this.getTRC20Confirmations(tx.blockNumber);
        }

        tx.confirmations = currentConfirmations;
        
        if (currentConfirmations >= tx.requiredConfirmations) {
          tx.status = 'confirmed';
          // Notify user about confirmation
          await notificationService.notifyUserDepositConfirmed(tx);
          
          // Notify admin about new confirmed deposit
          await notificationService.notifyAdminNewDeposit(tx);
        }

        await tx.save();
      }
    } catch (error) {
      console.error('Error updating pending transactions:', error);
    }
  }

  /**
   * Get deposit statistics
   */
  async getDepositStats() {
    try {
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

      return {
        byStatus: stats,
        byNetwork: networkStats,
        totalAddresses: await DepositAddress.countDocuments({ isActive: true })
      };
    } catch (error) {
      console.error('Error getting deposit stats:', error);
      return null;
    }
  }

  /**
   * Manual blockchain verification helpers for admin
   */
  
  /**
   * Verify a transaction hash manually on BEP20 network
   * Admin can use this to check if a transaction is valid
   */
  async verifyBEP20Transaction(txHash, expectedAddress, expectedAmount) {
    try {
      const apiKey = process.env.BSCSCAN_API_KEY;
      if (!apiKey) {
        throw new Error('BSCScan API key required for verification');
      }

      // Get transaction details
      const response = await axios.get('https://api.bscscan.com/api', {
        params: {
          module: 'proxy',
          action: 'eth_getTransactionByHash',
          txhash: txHash,
          apikey: apiKey
        }
      });

      if (!response.data.result) {
        return { valid: false, error: 'Transaction not found' };
      }

      const tx = response.data.result;
      
      // Get transaction receipt for more details
      const receiptResponse = await axios.get('https://api.bscscan.com/api', {
        params: {
          module: 'proxy',
          action: 'eth_getTransactionReceipt',
          txhash: txHash,
          apikey: apiKey
        }
      });

      const receipt = receiptResponse.data.result;
      
      // Verify it's a USDT transfer to the expected address
      const usdtContract = hdWalletService.usdtContracts.BEP20;
      if (tx.to.toLowerCase() !== usdtContract.toLowerCase()) {
        return { valid: false, error: 'Not a USDT transaction' };
      }

      // Decode transfer data to verify recipient and amount
      const verification = {
        valid: true,
        txHash: txHash,
        from: tx.from,
        to: expectedAddress,
        contractAddress: tx.to,
        blockNumber: parseInt(tx.blockNumber, 16),
        confirmations: await this.getBEP20Confirmations(parseInt(tx.blockNumber, 16)),
        gasUsed: parseInt(receipt.gasUsed, 16),
        status: receipt.status === '0x1' ? 'success' : 'failed',
        network: 'BEP20',
        explorerUrl: `https://bscscan.com/tx/${txHash}`
      };

      return verification;

    } catch (error) {
      console.error('Error verifying BEP20 transaction:', error);
      return { valid: false, error: error.message };
    }
  }

  /**
   * Verify a transaction hash manually on TRC20 network
   */
  async verifyTRC20Transaction(txHash, expectedAddress, expectedAmount) {
    try {
      const tronApiKey = process.env.TRON_API_KEY;
      if (!tronApiKey) {
        throw new Error('TRON API key not configured');
      }

      // Get transaction details
      const response = await axios.get(`https://api.trongrid.io/v1/transactions/${txHash}`, {
        headers: {
          'TRON-PRO-API-KEY': tronApiKey
        }
      });

      const tx = response.data.data[0];
      if (!tx) {
        return { valid: false, error: 'Transaction not found' };
      }

      // Verify transaction details
      const verification = {
        valid: true,
        txHash: txHash,
        from: tx.raw_data.contract[0].parameter.value.owner_address,
        to: expectedAddress,
        blockNumber: tx.blockNumber,
        confirmations: await this.getTRC20Confirmations(tx.blockNumber),
        status: tx.ret[0].contractRet === 'SUCCESS' ? 'success' : 'failed',
        network: 'TRC20',
        explorerUrl: `https://tronscan.org/#/transaction/${txHash}`
      };

      return verification;

    } catch (error) {
      console.error('Error verifying TRC20 transaction:', error);
      return { valid: false, error: error.message };
    }
  }

  /**
   * Get user's deposit addresses for manual verification
   */
  async getUserDepositInfo(userId) {
    try {
      const user = await User.findById(userId).select('username email balance totalDeposits');
      if (!user) {
        throw new Error('User not found');
      }

      const addresses = await DepositAddress.find({ 
        userId, 
        isActive: true 
      }).select('network address totalDeposited createdAt');

      const depositHistory = await DepositTransaction.find({ userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('amount network txHash status createdAt');

      return {
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

    } catch (error) {
      console.error('Error getting user deposit info:', error);
      throw error;
    }
  }

  /**
   * Admin helper to manually create verified deposit
   */
  async createManualDeposit(adminId, depositData) {
    try {
      const { userId, txHash, amount, network, notes } = depositData;

      // Verify user exists and has address for this network
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const depositAddress = await DepositAddress.findOne({ 
        userId, 
        network: network.toUpperCase() 
      });

      if (!depositAddress) {
        throw new Error(`No ${network} deposit address found for this user`);
      }

      // Check if transaction already exists
      const existingTx = await DepositTransaction.findOne({ txHash });
      if (existingTx) {
        throw new Error('Transaction with this hash already exists');
      }

      // Verify transaction on blockchain (optional but recommended)
      let verification = null;
      if (network === 'BEP20') {
        verification = await this.verifyBEP20Transaction(txHash, depositAddress.address, amount);
      } else if (network === 'TRC20') {
        verification = await this.verifyTRC20Transaction(txHash, depositAddress.address, amount);
      }

      // Create deposit transaction record
      const depositTx = new DepositTransaction({
        userId,
        depositAddressId: depositAddress._id,
        amount: parseFloat(amount),
        currency: 'USDT',
        usdValue: parseFloat(amount), // Assuming USDT = USD
        network: network.toUpperCase(),
        txHash,
        fromAddress: verification?.from || 'unknown',
        toAddress: depositAddress.address,
        status: 'confirmed', // Admin manually confirmed
        confirmations: verification?.confirmations || 0,
        requiredConfirmations: network === 'BEP20' ? 12 : 19,
        notes: notes || `Manually verified by admin`,
        createdBy: adminId,
        confirmedAt: new Date(),
        blockNumber: verification?.blockNumber || 0
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
        type: 'deposit_detected',
        title: '💰 Deposit Detected',
        message: `Your ${network} deposit of ${amount} USDT has been detected and is ready for approval.`,
        relatedData: {
          depositId: depositTx._id,
          amount: amount,
          currency: 'USDT',
          txHash: txHash,
          network: network,
          explorerUrl: verification?.explorerUrl
        }
      });

      return {
        success: true,
        transaction: depositTx,
        verification: verification,
        message: 'Deposit created successfully and ready for approval'
      };

    } catch (error) {
      console.error('Error creating manual deposit:', error);
      throw error;
    }
  }
}

module.exports = new DepositMonitorService();
