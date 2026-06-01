const mongoose = require('mongoose');

const telegramSupportSchema = new mongoose.Schema({
  topic: {
    type: String,
    required: true,
    enum: [
      'getting_started',
      'trading_guide',
      'kyc_verification',
      'deposits_withdrawals',
      'referral_program',
      'security_practices',
      'troubleshooting',
      'general_support'
    ]
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  telegramUsername: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        // Allow alphanumeric, underscores, and dots. Telegram usernames can be 5-32 characters
        // and can contain letters, numbers, underscores, and dots (but can't start/end with dots)
        return /^[a-zA-Z0-9][a-zA-Z0-9_.]{3,30}[a-zA-Z0-9]$/.test(v) || /^[a-zA-Z0-9]{5,32}$/.test(v);
      },
      message: 'Invalid Telegram username format. Must be 5-32 characters, containing only letters, numbers, underscores, and dots.'
    }
  },
  telegramUserId: {
    type: String,
    sparse: true // Optional field
  },
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  icon: {
    type: String,
    default: 'QuestionMarkCircleIcon'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

// Index for efficient queries
telegramSupportSchema.index({ topic: 1, isActive: 1, priority: 1 });
telegramSupportSchema.index({ telegramUsername: 1 });

// Update the updatedAt field before saving
telegramSupportSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get active support topics
telegramSupportSchema.statics.getActiveTopics = function() {
  return this.find({ isActive: true })
    .sort({ priority: 1, createdAt: 1 })
    .select('-__v');
};

// Static method to get support by topic
telegramSupportSchema.statics.getBySupportTopic = function(topic) {
  return this.findOne({ topic, isActive: true })
    .select('-__v');
};

module.exports = mongoose.model('TelegramSupport', telegramSupportSchema);
