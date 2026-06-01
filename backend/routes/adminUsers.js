const express = require('express');
const router = express.Router();
const adminUserController = require('../controllers/adminUserController');
const requireAdminAuth = require('../middlewares/requireAdminAuth');

// Apply admin authentication to all routes
router.use(requireAdminAuth);

// Get all users with pagination and filters
router.get('/', adminUserController.getAllUsers);

// Get special/flagged users for quick access
router.get('/special', adminUserController.getSpecialUsers);

// Get user statistics for dashboard
router.get('/stats', adminUserController.getUserStats);

// Get detailed user information
router.get('/:userId', adminUserController.getUserDetails);

// Update user status (ban/unban/activate/deactivate)
router.put('/:userId/status', adminUserController.updateUserStatus);

// Convenience routes for status actions
router.post('/:userId/ban', (req, res) => {
  req.body.action = 'ban';
  adminUserController.updateUserStatus(req, res);
});

router.post('/:userId/unban', (req, res) => {
  req.body.action = 'unban';
  adminUserController.updateUserStatus(req, res);
});

router.post('/:userId/activate', (req, res) => {
  req.body.action = 'activate';
  adminUserController.updateUserStatus(req, res);
});

router.post('/:userId/deactivate', (req, res) => {
  req.body.action = 'deactivate';
  adminUserController.updateUserStatus(req, res);
});

// Delete user (convenience POST route)
router.post('/:userId/delete', adminUserController.deleteUser);

// Update user balance
router.put('/:userId/balance', adminUserController.updateUserBalance);

// Reset user password
router.put('/:userId/password', adminUserController.resetUserPassword);

// Update user tags and flags
router.put('/:userId/tags', adminUserController.updateUserTags);

// Update user KYC status
router.put('/:userId/kyc', adminUserController.updateUserKYC);

// Delete user (soft or permanent)
router.delete('/:userId', adminUserController.deleteUser);

// Bulk operations
router.put('/bulk', adminUserController.bulkUpdateUsers);

// Bulk action endpoint for frontend compatibility
router.post('/bulk-action', adminUserController.bulkUpdateUsers);

module.exports = router;
