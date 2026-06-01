const mongoose = require('mongoose');

const kycDocumentSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['passport', 'id_card', 'driver_license'], 
    required: true 
  },
  side: { 
    type: String, 
    enum: ['front', 'back'], 
    required: true 
  },
  fileUrl: { type: String, required: true },
  filename: { type: String },
  fileSize: { type: Number },
  mimeType: { type: String },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  uploadedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  rejectionReason: { type: String }
});

const kycSchema = new mongoose.Schema({
  // Reference to user
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    unique: true 
  },

  // Personal Information
  personalInfo: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    nationality: { type: String, required: true },
    country: { type: String, required: true },
    city: { type: String, required: true },
    address: { type: String, required: true },
    postalCode: { type: String, required: true }
  },

  // Documents
  documents: [kycDocumentSchema],

  // KYC Status and Tracking
  status: { 
    type: String, 
    enum: ['not_started', 'personal_info_submitted', 'documents_uploaded', 'pending_review', 'approved', 'rejected'], 
    default: 'not_started' 
  },
  
  submittedAt: { type: Date },
  reviewedAt: { type: Date },
  approvedAt: { type: Date },
  rejectedAt: { type: Date },
  
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  rejectionReason: { type: String },
  
  // Resubmission tracking
  resubmissionCount: { type: Number, default: 0 },
  lastResubmissionAt: { type: Date },
  
  // Additional metadata
  ipAddress: { type: String },
  userAgent: { type: String },
  notes: [{ 
    content: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    createdAt: { type: Date, default: Date.now }
  }]

}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual to get user details
kycSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Virtual to check if required documents are uploaded
kycSchema.virtual('hasCompleteDocuments').get(function() {
  if (!this.documents || this.documents.length === 0) return false;
  
  // Check each document type separately
  const docTypes = ['passport', 'id_card', 'driver_license'];
  for (const docType of docTypes) {
    const docsOfType = this.documents.filter(doc => doc.type === docType);
    if (docsOfType.length === 0) continue; // No documents of this type
    
    if (docType === 'passport') {
      // Passport only needs front side (photo page)
      const frontDoc = docsOfType.find(doc => doc.side === 'front');
      if (frontDoc) return true;
    } else {
      // ID Card and Driver License need both front and back
      const frontDoc = docsOfType.find(doc => doc.side === 'front');
      const backDoc = docsOfType.find(doc => doc.side === 'back');
      if (frontDoc && backDoc) return true;
    }
  }
  return false;
});

// Virtual to get the selected document type
kycSchema.virtual('selectedDocumentType').get(function() {
  if (!this.documents || this.documents.length === 0) return null;
  return this.documents[0].type;
});

// Index for faster queries
kycSchema.index({ status: 1 });
kycSchema.index({ submittedAt: -1 });

module.exports = mongoose.model('KYC', kycSchema);
