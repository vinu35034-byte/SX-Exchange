const express = require('express');
const router = express.Router();
const depositController = require('../controllers/depositController');
const requireUserAuth = require('../middlewares/requireUserAuth');

// User routes - require user authentication
router.post('/generate-addresses', requireUserAuth, depositController.generateDepositAddresses);
router.get('/addresses', requireUserAuth, depositController.getDepositAddresses);
router.get('/history', requireUserAuth, depositController.getDepositHistory);
router.get('/balance/:network', requireUserAuth, depositController.checkBalance);
router.post('/submit-request', requireUserAuth, depositController.submitDepositRequest);

module.exports = router;
