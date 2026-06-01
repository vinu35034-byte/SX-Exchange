const express = require('express');
const router = express.Router();
const telegramSupportController = require('../controllers/telegramSupportController');

// Get active support topics (public route)
router.get('/active', telegramSupportController.getActiveSupport);

// Get support by topic (public route)
router.get('/topic/:topic', telegramSupportController.getSupportByTopic);

module.exports = router;
