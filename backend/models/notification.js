const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Target recipient
  recipientType: {
    type: String,
    enum: ['user', 'admin'],
    required: true
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'recipientType'
  },

  // Notification content
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },

  // Notification type and context
  type: {
    type: String,
    enum: [
      'deposit_submitted',    // User: Your deposit request has been submitted
      'deposit_detected',     // User: Your deposit has been detected
      'deposit_confirmed',    // User: Your deposit has been confirmed
      'deposit_approved',     // User: Your deposit has been approved (manual approval)
      'deposit_rejected',     // User: Your deposit has been rejected
      'first_deposit_bonus',  // User: Welcome bonus for first deposit without referrer
      'deposit_new',          // Admin: New deposit requires review
      'withdrawal_requested', // Admin: New withdrawal request
      'withdrawal_approved',  // User: Your withdrawal has been approved
      'withdrawal_rejected',  // User: Your withdrawal has been rejected
      'withdrawal_completed', // User: Your withdrawal has been completed
      'kyc_submitted',        // User: Your KYC has been submitted for review
      'kyc_approved',         // User: Your KYC has been approved
      'kyc_rejected',         // User: Your KYC has been rejected
      'kyc_resubmission',     // User: KYC resubmission required
      'kyc_new',              // Admin: New KYC submission for review
      'referral_new',         // User: New referral signup
      'referral_completed',   // User: Referral completed with reward
      'referral_bonus',       // User: Referral bonus received
      'trade_executed',       // User: Trade successfully executed
      'trading_bonus',        // User: Trading bonus received from referral chain
      'balance_update',       // User: Balance updated
      'system',              // System notifications
      'security',            // Security alerts
      'info',                // Information notifications
      'success',             // Success notifications
      'warning',             // Warning notifications
      'error'                // Error notifications
    ],
    required: true
  },

  // Related transaction/request data
  relatedData: {
    transactionId: { type: mongoose.Schema.Types.ObjectId },
    withdrawalId: { type: mongoose.Schema.Types.ObjectId },
    amount: { type: Number },
    currency: { type: String },
    txHash: { type: String },
    network: { type: String },
    status: { type: String },
    reason: { type: String } // For rejections
  },

  // Status
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },

  // Priority
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  // Auto-expire for temporary notifications
  expiresAt: {
    type: Date,
    default: null
  }

}, {
  timestamps: true
});

// Indexes for efficient queries
notificationSchema.index({ recipientType: 1, recipientId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual to populate recipient details
notificationSchema.virtual('recipient', {
  refPath: 'recipientType',
  localField: 'recipientId',
  foreignField: '_id'
});

// Ensure virtuals are included in JSON output
notificationSchema.set('toJSON', { virtuals: true });
notificationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Notification', notificationSchema);
