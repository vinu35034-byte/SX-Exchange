const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawalController');
const requireAdminAuth = require('../middlewares/requireAdminAuth');

// Admin withdrawal management routes
router.get('/all', requireAdminAuth, withdrawalController.getAllWithdrawals);
router.get('/pending', requireAdminAuth, withdrawalController.getPendingWithdrawals);
router.post('/approve/:withdrawalId', requireAdminAuth, withdrawalController.approveWithdrawal);
router.post('/reject/:withdrawalId', requireAdminAuth, withdrawalController.rejectWithdrawal);
router.get('/stats', requireAdminAuth, withdrawalController.getWithdrawalStats);

module.exports = router;
