const express = require('express');
const router = express.Router();
const depositController = require('../controllers/depositController');
const requireAdminAuth = require('../middlewares/requireAdminAuth');

// Admin routes - require admin authentication
router.get('/all', requireAdminAuth, depositController.getAllDeposits);
router.get('/pending', requireAdminAuth, depositController.getPendingDeposits);
router.post('/create', requireAdminAuth, depositController.createDepositTransaction);
router.post('/credit/:transactionId', requireAdminAuth, depositController.creditDeposit);
router.post('/reject-transaction/:transactionId', requireAdminAuth, depositController.rejectDeposit);
router.get('/stats', requireAdminAuth, depositController.getDepositStats);
router.get('/search-users', requireAdminAuth, depositController.searchUsers);
router.get('/user-addresses/:userId', requireAdminAuth, depositController.getUserDepositAddresses);
router.post('/monitoring', requireAdminAuth, depositController.toggleMonitoring);
router.post('/check-address/:addressId', requireAdminAuth, depositController.checkAddress);

// Manual verification routes
router.get('/user-info/:userId', requireAdminAuth, depositController.getUserDepositInfo);
router.post('/verify-transaction', requireAdminAuth, depositController.verifyTransaction);
router.post('/create-manual', requireAdminAuth, depositController.createManualDeposit);

// New deposit request management routes
router.get('/requests', requireAdminAuth, depositController.getAdminDepositRequests);
router.post('/approve/:depositId', requireAdminAuth, depositController.approveDepositRequest);
router.post('/reject-request/:depositId', requireAdminAuth, depositController.rejectDepositRequest);

// Test endpoint for creating demo deposits (for testing the workflow)
router.post('/create-test-deposit', requireAdminAuth, async (req, res) => {
  try {
    const { userId, amount = 100 } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Generate a fake transaction hash for testing
    const fakeTransactionHash = 'test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Create test deposit transaction
    const testDepositData = {
      userId,
      amount: parseFloat(amount),
      currency: 'USDT',
      txHash: fakeTransactionHash,
      network: 'BEP20',
      notes: 'Test deposit created for workflow testing'
    };

    // Use the existing createDepositTransaction method
    req.body = testDepositData;
    await depositController.createDepositTransaction(req, res);

  } catch (error) {
    console.error('Error creating test deposit:', error);
    res.status(500).json({ 
      message: 'Failed to create test deposit',
      error: error.message 
    });
  }
});

module.exports = router;
