const express = require('express');
const requireUserAuth = require('../middlewares/requireUserAuth');
const requireAdminAuth = require('../middlewares/requireAdminAuth');
const copyTradingController = require('../controllers/copyTradingControllers');

const router = express.Router();

// ========== USER ROUTES ==========

// Get all available traders
router.get('/traders/available', copyTradingController.getAvailableTraders);

// Get trader details
router.get('/traders/:traderId', copyTradingController.getTraderDetails);

// Follow a trader
router.post('/follow', requireUserAuth, copyTradingController.followTrader);

// Get user's followings
router.get('/my-followings', requireUserAuth, copyTradingController.getMyFollowings);

// Unfollow a trader
router.post('/unfollow/:followingId', requireUserAuth, copyTradingController.unfollowTrader);

// Get copy trading dashboard
router.get('/dashboard', requireUserAuth, copyTradingController.getCopyTradingDashboard);

// Get user's copy trading transactions
router.get('/my-transactions', requireUserAuth, copyTradingController.getMyTransactions);

// ========== ADMIN ROUTES ==========

// Create a new trader
router.post('/admin/traders/create', requireAdminAuth, copyTradingController.createTrader);

// Update trader
router.put('/admin/traders/:traderId', requireAdminAuth, copyTradingController.updateTrader);

// Delete trader
router.delete('/admin/traders/:traderId', requireAdminAuth, copyTradingController.deleteTrader);

// Get all traders (admin)
router.get('/admin/traders', requireAdminAuth, copyTradingController.getAllTraders);

// Get followers for a specific trader (Admin)
router.get('/admin/traders/:traderId/followers', requireAdminAuth, copyTradingController.getTraderFollowers);

// Get all follower relationships (Admin)
router.get('/admin/followers', requireAdminAuth, copyTradingController.getAllFollowerRelationships);

// Get copy trading statistics
router.get('/admin/stats', requireAdminAuth, copyTradingController.getCopyTradingStats);

// Get follower transactions
router.get('/admin/transactions', requireAdminAuth, copyTradingController.getFollowerTransactions);

// Get pending unfollow requests (Admin)
router.get('/admin/unfollow-requests', requireAdminAuth, copyTradingController.getPendingUnfollowRequests);

// Approve unfollow request (Admin)
router.post('/admin/unfollow-requests/:requestId/approve', requireAdminAuth, copyTradingController.approveUnfollowRequest);

// Reject unfollow request (Admin)
router.post('/admin/unfollow-requests/:requestId/reject', requireAdminAuth, copyTradingController.rejectUnfollowRequest);

// Bulk approve all pending unfollow requests (Admin)
router.post('/admin/unfollow-requests/bulk-approve', requireAdminAuth, copyTradingController.bulkApproveUnfollowRequests);

// Bulk reject all pending unfollow requests (Admin)
router.post('/admin/unfollow-requests/bulk-reject', requireAdminAuth, copyTradingController.bulkRejectUnfollowRequests);

// Execute trade for a trader (Admin) - Creates BUY/SELL transactions and auto-unfollows all followers
router.post('/admin/execute-trade', requireAdminAuth, copyTradingController.executeTrade);

// Get user's copy trading transactions
router.get('/my-transactions-history', requireUserAuth, copyTradingController.getUserTransactions);

// Get all copy trading transactions (Admin)
router.get('/admin/all-transactions', requireAdminAuth, copyTradingController.getAllTransactions);

module.exports = router;
