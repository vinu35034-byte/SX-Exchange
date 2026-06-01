const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawalController');
const requireUserAuth = require('../middlewares/requireUserAuth');

// User withdrawal routes
router.post('/create', requireUserAuth, withdrawalController.createWithdrawalRequest);
router.get('/history', requireUserAuth, withdrawalController.getUserWithdrawals);
router.get('/fees', requireUserAuth, withdrawalController.getWithdrawalFees);

module.exports = router;
