const express = require('express');
const router = express.Router();
const telegramSupportController = require('../controllers/telegramSupportController');
const requireAdminAuth = require('../middlewares/requireAdminAuth');

// Apply admin authentication to all routes
router.use(requireAdminAuth);

// Get all support topics (admin only)
router.get('/', telegramSupportController.getAllSupport);

// Create new support topic
router.post('/', telegramSupportController.createSupport);

// Update support topic
router.put('/:id', telegramSupportController.updateSupport);

// Delete support topic
router.delete('/:id', telegramSupportController.deleteSupport);

// Toggle support topic status
router.patch('/:id/toggle', telegramSupportController.toggleSupportStatus);

// Get support by topic
router.get('/topic/:topic', telegramSupportController.getSupportByTopic);

module.exports = router;
