const express = require('express');
const router = express.Router();
const requireUserAuth = require('../middlewares/requireUserAuth');
const requireAdminAuth = require('../middlewares/requireAdminAuth');
const kycController = require('../controllers/kycController');

// User KYC routes
router.get('/status', requireUserAuth, kycController.getKycStatus);
router.post('/personal-info', requireUserAuth, kycController.submitPersonalInfo);
router.post('/upload-document', requireUserAuth, kycController.upload.single('document'), kycController.uploadDocuments);
router.post('/complete', requireUserAuth, kycController.completeKyc);

// Admin KYC routes
router.get('/admin/submissions', requireAdminAuth, kycController.getAllKycSubmissions);
router.put('/admin/status/:userId', requireAdminAuth, kycController.updateKycStatus);
router.get('/admin/document/:documentId', requireAdminAuth, kycController.getDocument);
router.post('/admin/request-resubmission/:userId', requireAdminAuth, kycController.requestResubmission);

module.exports = router;
