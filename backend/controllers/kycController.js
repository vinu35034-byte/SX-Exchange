const User = require('../models/user');
const KYC = require('../models/kyc');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { z } = require('zod');
const notificationService = require('../utils/notificationService');
const ReferralService = require('../services/referralService');
const { sessionManager } = require('../config/session');
const { createLogger } = require('../utils/logger');

const logger = createLogger('kyc-controller');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/kyc';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only image files and PDFs are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Validation schemas
const kycPersonalInfoSchema = z.object({
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  dateOfBirth: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .refine((date) => {
      const birthDate = new Date(date);
      // Check if the date is valid
      if (isNaN(birthDate.getTime())) {
        return false;
      }
      return true;
    }, 'Please enter a valid date')
    .refine((date) => {
      const birthDate = new Date(date);
      const today = new Date();
      
      // Make sure birth date is not in the future
      if (birthDate > today) {
        return false;
      }
      
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        return age - 1 >= 18;
      }
      return age >= 18;
    }, 'You must be at least 18 years old'),
  nationality: z.string().min(2).max(50),
  country: z.string().min(2).max(50),
  city: z.string().min(2).max(50),
  address: z.string().min(10).max(200),
  postalCode: z.string().min(3).max(20)
});

const getKycStatus = async (req, res) => {
  try {
    // Get user basic info
    const user = await User.findById(req.user.id).select('email kycStatus');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get KYC data from dedicated KYC model
    let kycData = await KYC.findOne({ userId: req.user.id });
    
    if (!kycData) {
      // No KYC data exists, return basic structure with user's kycStatus
      return res.json({
        status: user.kycStatus || 'not_started',
        personalInfo: null,
        documents: [],
        hasCompleteDocuments: false
      });
    }

    // Return KYC data with proper structure
    const response = {
      status: kycData.status,
      verifiedAt: kycData.approvedAt,
      rejectionReason: kycData.rejectionReason,
      personalInfo: kycData.personalInfo,
      documents: kycData.documents.map(doc => ({
        _id: doc._id,
        type: doc.type,
        side: doc.side,
        status: doc.status,
        uploadedAt: doc.uploadedAt
      })),
      hasCompleteDocuments: kycData.hasCompleteDocuments,
      selectedDocumentType: kycData.selectedDocumentType,
      sessionInfo: {
        accessedAt: new Date(),
        sessionId: req.sessionID
      }
    };

    res.json(response);
  } catch (error) {
    logger.error('KYC status fetch error:', {
      error: error.message,
      userId: req.user.id,
      sessionId: req.sessionID,
      stack: error.stack
    });
    
    res.status(500).json({ 
      error: 'Server error',
      sessionInfo: {
        errorAt: new Date(),
        sessionId: req.sessionID
      }
    });
  }
};

// Submit personal information for KYC
const submitPersonalInfo = async (req, res) => {
  try {
    // Enhanced session validation for sensitive KYC operations
    if (!req.session?.user || !req.sessionID) {
      logger.security('KYC submission attempted without valid session', {
        sessionId: req.sessionID,
        userId: req.user?.id,
        timestamp: new Date().toISOString()
      });
      
      return res.status(401).json({ 
        error: 'Session validation failed. Please login again for security.',
        code: 'KYC_SESSION_REQUIRED',
        sessionInfo: {
          deniedAt: new Date(),
          sessionId: req.sessionID
        }
      });
    }

    // Log KYC attempt for security monitoring
    logger.info('KYC personal info submission attempt', {
      userId: req.user.id,
      sessionId: req.sessionID,
      timestamp: new Date().toISOString()
    });

    const validatedData = kycPersonalInfoSchema.parse(req.body);
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        sessionInfo: {
          checkedAt: new Date(),
          sessionId: req.sessionID
        }
      });
    }

    // Create or update KYC record
    let kycRecord = await KYC.findOne({ userId: req.user.id });
    
    if (kycRecord) {
      // Update existing KYC record
      kycRecord.personalInfo = {
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        dateOfBirth: new Date(validatedData.dateOfBirth),
        nationality: validatedData.nationality,
        country: validatedData.country,
        city: validatedData.city,
        address: validatedData.address,
        postalCode: validatedData.postalCode
      };
      kycRecord.status = 'personal_info_submitted';
      kycRecord.ipAddress = req.ip;
      kycRecord.userAgent = req.get('User-Agent');
      await kycRecord.save();
    } else {
      // Create new KYC record
      kycRecord = new KYC({
        userId: req.user.id,
        personalInfo: {
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          dateOfBirth: new Date(validatedData.dateOfBirth),
          nationality: validatedData.nationality,
          country: validatedData.country,
          city: validatedData.city,
          address: validatedData.address,
          postalCode: validatedData.postalCode
        },
        status: 'personal_info_submitted',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      await kycRecord.save();
    }

    // Update user KYC status
    await User.findByIdAndUpdate(req.user.id, {
      kycStatus: 'pending'
    });

    res.json({ 
      success: true,
      message: 'Personal information submitted successfully' 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false,
        error: 'Validation error', 
        details: error.errors 
      });
    }
    
    logger.error('KYC personal info submission error:', {
      error: error.message,
      userId: req.user?.id,
      sessionId: req.sessionID,
      stack: error.stack
    });
    
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};

// Upload KYC documents
const uploadDocuments = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    const { type, side } = req.body;
    if (!['passport', 'id_card', 'driver_license'].includes(type)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid document type' 
      });
    }

    if (!['front', 'back'].includes(side)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid document side. Must be front or back' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded' 
      });
    }

    // Get or create KYC record
    let kycRecord = await KYC.findOne({ userId: req.user.id });
    if (!kycRecord) {
      return res.status(400).json({ 
        success: false,
        error: 'Please submit personal information first' 
      });
    }

    // Create new document object
    const newDocument = {
      type: type,
      side: side,
      fileUrl: req.file.path.replace(/\\/g, '/'),
      filename: req.file.filename,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      status: 'pending',
      uploadedAt: new Date()
    };

    // Check if document of this type and side already exists
    const existingDocIndex = kycRecord.documents.findIndex(doc => 
      doc.type === type && doc.side === side
    );

    if (existingDocIndex !== -1) {
      // Replace existing document
      kycRecord.documents[existingDocIndex] = newDocument;
    } else {
      // Add new document
      kycRecord.documents.push(newDocument);
    }

    // Only update status to 'documents_uploaded' if both sides are now present
    // Do NOT automatically change status - wait for explicit submission
    if (kycRecord.hasCompleteDocuments && kycRecord.status === 'personal_info_submitted') {
      kycRecord.status = 'documents_uploaded';
    }
    
    await kycRecord.save();

    res.json({ 
      success: true,
      message: 'Document uploaded successfully', 
      documentType: type, 
      side: side
    });
  } catch (error) {
    console.error('KYC document upload error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};

// Complete KYC submission
const completeKyc = async (req, res) => {
  try {
    // Get KYC record
    const kycRecord = await KYC.findOne({ userId: req.user.id });
    if (!kycRecord) {
      return res.status(400).json({ 
        success: false,
        error: 'No KYC data found. Please start the KYC process.' 
      });
    }

    // Check if personal info is provided
    if (!kycRecord.personalInfo || !kycRecord.personalInfo.firstName) {
      return res.status(400).json({ 
        success: false,
        error: 'Please submit personal information first' 
      });
    }

    // Check if required documents are uploaded
    if (!kycRecord.hasCompleteDocuments) {
      const documentType = kycRecord.documents?.[0]?.type;
      let errorMessage = 'Please upload required identity documents';
      
      if (documentType === 'passport') {
        errorMessage = 'Please upload your passport photo page';
      } else if (documentType === 'id_card' || documentType === 'driver_license') {
        errorMessage = 'Please upload both front and back sides of your identity document';
      }
      
      return res.status(400).json({ 
        success: false,
        error: errorMessage
      });
    }

    // Update KYC status to pending review
    kycRecord.status = 'pending_review';
    kycRecord.submittedAt = new Date();
    await kycRecord.save();

    // Update user KYC status
    await User.findByIdAndUpdate(req.user.id, {
      kycStatus: 'pending'
    });

    // Send notification to user
    await notificationService.notifyUserKycSubmitted(req.user.id);

    res.json({ 
      success: true,
      message: 'KYC submission completed successfully' 
    });
  } catch (error) {
    console.error('KYC completion error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};

// Admin: Get all KYC submissions
const getAllKycSubmissions = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    // Build filter for KYC model
    const kycFilter = {};
    if (status && status !== 'all') {
      kycFilter.status = status;
    }

    // Get KYC submissions with user details
    const kycSubmissions = await KYC.find(kycFilter)
      .populate('userId', 'email kycStatus kycVerifiedAt createdAt')
      .sort({ submittedAt: -1, createdAt: -1 });


    // Check for and log any records with null userId
    const invalidRecords = kycSubmissions.filter(kyc => kyc.userId === null);


    // Also get users with legacy KYC data (in User model)
    const userFilter = { 
      kycStatus: { $ne: 'not_started' },
      $or: [
        { kycDocuments: { $exists: true, $ne: [] } },
        { firstName: { $exists: true } }
      ]
    };
    
    // Map status filter for User model
    if (status && status !== 'all') {
      if (['pending_review', 'documents_uploaded'].includes(status)) {
        userFilter.kycStatus = 'pending';
      } else if (['approved', 'rejected'].includes(status)) {
        userFilter.kycStatus = status;
      }
    }

    const legacyUsers = await User.find(userFilter)
      .select('email firstName lastName dateOfBirth nationality country city address postalCode kycStatus kycDocuments createdAt');

    // Format KYC model data - filter out records with null userId first
    const validKycSubmissions = kycSubmissions.filter(kyc => kyc.userId !== null);
    const formattedKycSubmissions = validKycSubmissions.map(kyc => ({
      _id: kyc._id,
      userId: kyc.userId._id,
      email: kyc.userId.email,
      firstName: kyc.personalInfo?.firstName || '',
      lastName: kyc.personalInfo?.lastName || '',
      dateOfBirth: kyc.personalInfo?.dateOfBirth || null,
      nationality: kyc.personalInfo?.nationality || '',
      country: kyc.personalInfo?.country || '',
      city: kyc.personalInfo?.city || '',
      address: kyc.personalInfo?.address || '',
      postalCode: kyc.personalInfo?.postalCode || '',
      kycStatus: kyc.status,
      kycDocuments: kyc.documents,
      submittedAt: kyc.submittedAt,
      createdAt: kyc.userId.createdAt,
      source: 'kyc_model'
    }));

    // Format User model legacy data
    const formattedLegacySubmissions = legacyUsers
      .filter(user => !kycSubmissions.find(kyc => kyc.userId._id.toString() === user._id.toString()))
      .map(user => ({
        _id: user._id,
        userId: user._id,
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        dateOfBirth: user.dateOfBirth || null,
        nationality: user.nationality || '',
        country: user.country || '',
        city: user.city || '',
        address: user.address || '',
        postalCode: user.postalCode || '',
        kycStatus: user.kycStatus,
        kycDocuments: user.kycDocuments || [],
        submittedAt: user.createdAt,
        createdAt: user.createdAt,
        source: 'user_model'
      }));

    // Combine both sources
    const allSubmissions = [...formattedKycSubmissions, ...formattedLegacySubmissions]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply pagination
    const total = allSubmissions.length;
    const startIndex = (page - 1) * limit;
    const paginatedSubmissions = allSubmissions.slice(startIndex, startIndex + parseInt(limit));

    res.json({
      users: paginatedSubmissions,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('KYC submissions fetch error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Admin: Approve/Reject KYC
const updateKycStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, reason, deleteFiles } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Find KYC record
    let kycRecord = await KYC.findOne({ userId });
    
    // Store document file paths for deletion if requested
    let filesToDelete = [];
    
    if (kycRecord && deleteFiles) {
      // Collect file paths from KYC documents
      kycRecord.documents.forEach(doc => {
        if (doc.fileUrl) {
          filesToDelete.push(path.join(__dirname, '..', doc.fileUrl));
        }
      });
    }
    
    // Also check for legacy documents in User model
    if (deleteFiles) {
      const user = await User.findById(userId).select('kycDocuments');
      if (user && user.kycDocuments) {
        user.kycDocuments.forEach(doc => {
          if (doc.fileUrl) {
            filesToDelete.push(path.join(__dirname, '..', doc.fileUrl));
          }
        });
      }
    }
    
    if (kycRecord) {
      // Update KYC record
      kycRecord.status = status;
      kycRecord.reviewedAt = new Date();
      kycRecord.reviewedBy = req.admin.id;

      if (status === 'approved') {
        kycRecord.approvedAt = new Date();
      } else {
        kycRecord.rejectedAt = new Date();
        kycRecord.rejectionReason = reason;
      }

      await kycRecord.save();
    } else {
      // Handle legacy users - create a basic KYC record for tracking
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      kycRecord = new KYC({
        userId: userId,
        personalInfo: {
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          dateOfBirth: user.dateOfBirth,
          nationality: user.nationality || '',
          country: user.country || '',
          city: user.city || '',
          address: user.address || '',
          postalCode: user.postalCode || ''
        },
        documents: user.kycDocuments || [],
        status: status,
        reviewedAt: new Date(),
        reviewedBy: req.admin.id,
        submittedAt: new Date()
      });

      if (status === 'approved') {
        kycRecord.approvedAt = new Date();
      } else {
        kycRecord.rejectedAt = new Date();
        kycRecord.rejectionReason = reason;
      }

      await kycRecord.save();
    }

    // Update user record
    const userUpdateData = {
      kycStatus: status,
      kycVerifiedAt: status === 'approved' ? new Date() : null
    };

    if (status === 'rejected' && reason) {
      userUpdateData.kycRejectionReason = reason;
    }

    const user = await User.findByIdAndUpdate(userId, userUpdateData, { new: true });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete files if requested
    if (deleteFiles && filesToDelete.length > 0) {
      let deletedCount = 0;
      let deleteErrors = [];
      
      for (const filePath of filesToDelete) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deletedCount++;
            logger.info('KYC file deleted', {
              userId,
              filePath,
              adminId: req.admin.id,
              action: status
            });
          }
        } catch (error) {
          deleteErrors.push({ filePath, error: error.message });
          logger.error('KYC file deletion failed', {
            userId,
            filePath,
            error: error.message,
            adminId: req.admin.id
          });
        }
      }
      
      // Log deletion summary
      logger.info('KYC file deletion summary', {
        userId,
        totalFiles: filesToDelete.length,
        deletedCount,
        errorCount: deleteErrors.length,
        adminId: req.admin.id
      });
    }

    // Send notification to user
    if (status === 'approved') {
      await notificationService.notifyUserKycApproved(userId);
    } else {
      await notificationService.notifyUserKycRejected(userId, reason);
    }

    // Check and process referral completion if KYC is approved
    if (status === 'approved') {
      try {
        await ReferralService.processKycReferralCompletion(userId);
      } catch (error) {
        console.error('Error processing referral completion:', error);
        // Don't fail the KYC approval if referral processing fails
      }
    }

    res.json({ message: `KYC ${status} successfully`, user });
  } catch (error) {
    console.error('KYC status update error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get document for admin viewing (returns file as blob)
const getDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    
    // Find KYC record with this document
    const kycRecord = await KYC.findOne({
      'documents._id': documentId
    });

    let doc = null;
    let filePath = null;

    if (kycRecord) {
      // Document found in KYC model
      doc = kycRecord.documents.id(documentId);
      if (doc) {
        filePath = path.join(__dirname, '..', doc.fileUrl);
      }
    } else {
      // Fallback: check User model for legacy documents
      const user = await User.findOne({
        'kycDocuments._id': documentId
      });
      
      if (user) {
        doc = user.kycDocuments.id(documentId);
        if (doc) {
          filePath = path.join(__dirname, '..', doc.fileUrl);
        }
      }
    }

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const fs = require('fs');
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Set appropriate headers based on file type
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf'
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.type}_${doc.side}${ext}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Document fetch error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// User version of getDocument - allows users to view their own documents
const getUserDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    
    let doc = null;
    let filePath = null;
    
    // Check KYC model for user's document
    const kycRecord = await KYC.findOne({
      userId: req.user.id,
      'documents._id': documentId
    });
    
    if (kycRecord) {
      doc = kycRecord.documents.id(documentId);
      if (doc) {
        filePath = path.join(__dirname, '..', doc.fileUrl);
      }
    }

    if (!doc) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }

    const fs = require('fs');
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Set appropriate headers based on file type
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf'
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.type}_${doc.side}${ext}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('User document fetch error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Helper function to delete KYC files
const deleteKycFiles = async (userId) => {
  try {
    const fs = require('fs');
    
    // Find the user's KYC record
    const kycRecord = await KYC.findOne({ userId });
    
    if (kycRecord && kycRecord.documents && kycRecord.documents.length > 0) {
      // Delete each document file
      for (const doc of kycRecord.documents) {
        if (doc.fileUrl) {
          const filePath = path.join(__dirname, '..', doc.fileUrl);
          
          // Check if file exists and delete it
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
              logger.info(`Deleted KYC file: ${filePath}`, { userId, docId: doc._id });
            } catch (fileError) {
              logger.error(`Failed to delete file: ${filePath}`, { 
                userId, 
                docId: doc._id, 
                error: fileError.message 
              });
            }
          }
        }
      }
      
      // Clear documents array from database
      kycRecord.documents = [];
      await kycRecord.save();
      
      logger.info('KYC files cleanup completed', { userId });
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error('Error during KYC files cleanup:', { 
      userId, 
      error: error.message,
      stack: error.stack 
    });
    return false;
  }
};

// Request KYC resubmission (clears documents and resets status)
const requestResubmission = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find and clear KYC record
    const kycRecord = await KYC.findOne({ userId });
    if (kycRecord) {
      kycRecord.status = 'not_started';
      kycRecord.documents = [];
      kycRecord.resubmissionCount += 1;
      kycRecord.lastResubmissionAt = new Date();
      kycRecord.rejectionReason = reason;
      await kycRecord.save();
    }

    // Update user status
    await User.findByIdAndUpdate(userId, {
      kycStatus: 'not_started',
      kycVerifiedAt: null,
      kycRejectionReason: null
    });

    // Send notification to user about resubmission request
    await notificationService.notifyUserKycResubmissionRequired(userId, reason);

    res.json({ message: 'Resubmission request sent successfully' });
  } catch (error) {
    console.error('Resubmission request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  upload,
  getKycStatus,
  submitPersonalInfo,
  uploadDocuments,
  completeKyc,
  getAllKycSubmissions,
  updateKycStatus,
  getDocument,
  getUserDocument,
  requestResubmission
};
