const express = require('express');
const router = express.Router();
const hdWalletService = require('../utils/hdWalletService');
const DepositAddress = require('../models/depositAddress');
const requireAdminAuth = require('../middlewares/requireAdminAuth');

// Apply admin authentication to all routes
router.use(requireAdminAuth);

/**
 * GET /admin/fund-management/preview
 * Preview what would be swept without actually doing it
 */
router.get('/preview', async (req, res) => {
  try {

    const minSweepAmount = parseFloat(req.query.minAmount) || 1;
    const masterWallet = process.env.MASTER_WALLET_BEP20;
    
    if (!masterWallet) {
     return res.status(500).json({ 
        message: 'Master wallet address not configured. Set MASTER_WALLET_BEP20 in environment variables.' 
      });
    }

    // Use real HD wallet service to get preview with actual balances
    const hdWalletService = require('../utils/hdWalletService');
    
    const previewData = await hdWalletService.getSweepPreview(minSweepAmount);

    
    res.json({
      message: 'Sweep preview generated successfully',
      masterWallet,
      preview: previewData
    });
    
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate sweep preview', error: error.message });
  }
});

/**
 * POST /admin/fund-management/sweep-all
 * Sweep all deposit addresses to master wallet
 */
router.post('/sweep-all', async (req, res) => {
  try {
    const { minSweepAmount = 1, masterWalletAddress } = req.body;
    const masterWallet = masterWalletAddress || process.env.MASTER_WALLET_BEP20;
    
    if (!masterWallet) {
      return res.status(500).json({ 
        message: 'Master wallet address not configured. Set MASTER_WALLET_BEP20 in environment variables.' 
      });
    }

    // Use real HD wallet service for sweep operation
    const hdWalletService = require('../utils/hdWalletService');
    const result = await hdWalletService.sweepAllAddresses(masterWallet, parseFloat(minSweepAmount));
 
    res.json({
      message: 'Bulk sweep operation completed',
      summary: result.summary,
      results: result.results
    });
  } catch (error) {
    console.error('❌ Error in bulk sweep:', error);
    res.status(500).json({ message: 'Bulk sweep failed', error: error.message });
  }
});

/**
 * POST /admin/fund-management/sweep-address
 * Sweep a specific deposit address by address (not ID)
 */
router.post('/sweep-address', async (req, res) => {
  try {
    const { address, masterWalletAddress, amount } = req.body;
    const masterWallet = masterWalletAddress || process.env.MASTER_WALLET_BEP20;
    
    if (!masterWallet) {
      return res.status(500).json({ 
        message: 'Master wallet address not configured' 
      });
    }

    if (!address) {
      return res.status(400).json({ message: 'Address is required' });
    }

    // Get the deposit address from database
    const DepositAddress = require('../models/depositAddress');
    const depositAddress = await DepositAddress.findOne({ address }).populate('userId');
    
    if (!depositAddress) {
      return res.status(404).json({ message: 'Deposit address not found in database' });
    }

    // Use real HD wallet service
    const hdWalletService = require('../utils/hdWalletService');
    
    // Check current balance
    const balance = await hdWalletService.checkBalance(depositAddress.address);
    const balanceFloat = parseFloat(balance);
    const sweepAmount = amount ? parseFloat(amount) : balanceFloat;

    if (balanceFloat === 0) {
      return res.status(400).json({ message: 'No funds available to sweep' });
    }

    if (sweepAmount > balanceFloat) {
      return res.status(400).json({ 
        message: `Insufficient balance. Available: ${balanceFloat} USDT, Requested: ${sweepAmount} USDT` 
      });
    }

 
    const result = await hdWalletService.autoSweepWithGasFunding(
      depositAddress,
      masterWallet,
      sweepAmount
    );

    res.json({
      message: 'Address swept successfully',
      from: depositAddress.address,
      to: masterWallet,
      amount: sweepAmount,
      user: depositAddress.userId?.username || 'Unknown',
      txHash: result.txHash,
      success: result.success
    });
  } catch (error) {
    console.error('❌ Error sweeping address:', error);
    res.status(500).json({ message: 'Failed to sweep address', error: error.message });
  }
});

/**
 * GET /admin/fund-management/balances
 * Get balances for all deposit addresses
 */
router.get('/balances', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const minBalance = parseFloat(req.query.minBalance) || 0;
    
    const depositAddresses = await DepositAddress.find({ network: 'BEP20' })
      .populate('userId', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await DepositAddress.countDocuments({ network: 'BEP20' });
    
    // Check balances for each address
    const addressesWithBalances = await Promise.all(
      depositAddresses.map(async (addr) => {
        try {
          const balance = await hdWalletService.checkBalance(addr.address);
          const balanceFloat = parseFloat(balance) || 0;
          
          return {
            id: addr._id,
            address: addr.address,
            user: addr.userId ? {
              id: addr.userId._id,
              username: addr.userId.username,
              email: addr.userId.email
            } : null,
            balance: balanceFloat,
            network: addr.network,
            createdAt: addr.createdAt
          };
        } catch (error) {
          return {
            id: addr._id,
            address: addr.address,
            user: addr.userId ? {
              id: addr.userId._id,
              username: addr.userId.username,
              email: addr.userId.email
            } : null,
            balance: 0,
            network: addr.network,
            error: 'Failed to check balance',
            createdAt: addr.createdAt
          };
        }
      })
    );

    // Filter by minimum balance if specified
    const filteredAddresses = addressesWithBalances.filter(addr => addr.balance >= minBalance);
    
    // Calculate totals
    const totalBalance = filteredAddresses.reduce((sum, addr) => sum + addr.balance, 0);
    const addressesWithFunds = filteredAddresses.filter(addr => addr.balance > 0).length;
    
    res.json({
      addresses: filteredAddresses.sort((a, b) => b.balance - a.balance), // Sort by balance descending
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        count: filteredAddresses.length,
        totalItems: total
      },
      summary: {
        totalAddresses: filteredAddresses.length,
        addressesWithFunds,
        totalBalance: totalBalance.toFixed(6),
        minBalanceFilter: minBalance
      }
    });
  } catch (error) {
    console.error('Error getting balances:', error);
    res.status(500).json({ message: 'Failed to get balances', error: error.message });
  }
});

/**
 * GET /admin/fund-management/master-wallet
 * Get master wallet info and balance
 */
router.get('/master-wallet', async (req, res) => {
  try {
    const masterWallet = process.env.MASTER_WALLET_BEP20;
    
    if (!masterWallet) {
      return res.status(500).json({ 
        message: 'Master wallet address not configured' 
      });
    }

    // Use real HD wallet service to get balances
    const hdWalletService = require('../utils/hdWalletService');
    
    const usdtBalance = await hdWalletService.checkBalance(masterWallet);
    const bnbBalance = await hdWalletService.web3.eth.getBalance(masterWallet);
    const bnbBalanceInEther = hdWalletService.web3.utils.fromWei(bnbBalance, 'ether');


    res.json({
      address: masterWallet,
      usdtBalance: parseFloat(usdtBalance) || 0,
      bnbBalance: parseFloat(bnbBalanceInEther) || 0,
      lastChecked: new Date()
    });
  } catch (error) {
    console.error('❌ Error getting master wallet info:', error);
    res.status(500).json({ message: 'Failed to get master wallet info', error: error.message });
  }
});

/**
 * POST /admin/fund-management/fund-gas
 * Fund a specific address with BNB for gas fees
 */
router.post('/fund-gas', async (req, res) => {
  try {
    const { address, amount = '0.002' } = req.body;
    
    if (!address) {
      return res.status(400).json({ message: 'Address is required' });
    }

    // Use real HD wallet service
    const hdWalletService = require('../utils/hdWalletService');
    const result = await hdWalletService.fundAddressForGas(address, amount);
    
    res.json({
      message: 'Address funded with gas successfully',
      address: address,
      amount: amount,
      txHash: result.txHash,
      success: result.success
    });
  } catch (error) {
    console.error('❌ Error funding gas:', error);
    res.status(500).json({ message: 'Failed to fund address', error: error.message });
  }
});

/**
 * POST /admin/fund-management/bulk-fund-gas
 * Fund multiple addresses with BNB for gas fees with proper nonce management
 */
router.post('/bulk-fund-gas', async (req, res) => {
  try {
    const { addresses, amount = '0.001' } = req.body;
    
    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({ message: 'Addresses array is required' });
    }

    if (addresses.length > 1000) {
      return res.status(400).json({ message: 'Maximum 1000 addresses per batch' });
    }

    console.log(`🚀 Starting bulk gas funding for ${addresses.length} addresses with ${amount} BNB each`);

    const hdWalletService = require('../utils/hdWalletService');
    const result = await hdWalletService.bulkFundAddressesForGas(addresses, amount);
    
    res.json({
      message: `Bulk gas funding completed: ${result.successCount}/${result.totalProcessed} successful`,
      totalProcessed: result.totalProcessed,
      successCount: result.successCount,
      failCount: result.failCount,
      amount: amount,
      results: result.results,
      success: result.success
    });
  } catch (error) {
    console.error('❌ Error in bulk gas funding:', error);
    res.status(500).json({ message: 'Failed to bulk fund addresses', error: error.message });
  }
});

/**
 * POST /admin/fund-management/fund-gas/:addressId
 * Fund a specific address with BNB for gas fees (by ID)
 */
router.post('/fund-gas/:addressId', async (req, res) => {
  try {
    const { addressId } = req.params;
    const { bnbAmount = '0.002' } = req.body;
    
    const DepositAddress = require('../models/depositAddress');
    const depositAddress = await DepositAddress.findById(addressId).populate('userId');
    if (!depositAddress) {
      return res.status(404).json({ message: 'Deposit address not found' });
    }

    const hdWalletService = require('../utils/hdWalletService');
    const result = await hdWalletService.fundAddressForGas(depositAddress.address, bnbAmount);
    
    res.json({
      message: 'Address funded with gas successfully',
      result: {
        address: depositAddress.address,
        user: depositAddress.userId?.username,
        amount: bnbAmount,
        txHash: result.txHash,
        success: result.success
      }
    });
  } catch (error) {
    console.error('Error funding gas:', error);
    res.status(500).json({ message: 'Failed to fund address', error: error.message });
  }
});

module.exports = router;
