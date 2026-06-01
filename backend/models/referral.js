const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  // Who made the referral
  referrer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Who was referred
  referee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Referral code used
  referralCode: {
    type: String,
    required: true
  },
  
  // Status of the referral
  status: {
    type: String,
    enum: ['pending', 'successful', 'failed'],
    default: 'pending',
    index: true
  },
  
  // When the referral was created (user signed up)
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  // When the referral became successful (first $10+ deposit)
  completedAt: {
    type: Date
  },
  
  // Deposit information that made this referral successful
  completingDeposit: {
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DepositTransaction'
    },
    amount: Number,
    currency: String,
    usdValue: Number
  },
  
  // Reward information
  rewards: {
    referrerReward: {
      amount: { type: Number, default: 0 },
      currency: { type: String, default: 'USDT' },
      awarded: { type: Boolean, default: false },
      awardedAt: Date
    },
    refereeReward: {
      amount: { type: Number, default: 0 },
      currency: { type: String, default: 'USDT' },
      awarded: { type: Boolean, default: false },
      awardedAt: Date
    }
  },
  
  // Tracking metadata
  metadata: {
    signupIP: String,
    signupUserAgent: String,
    referralSource: String, // 'link' or 'code'
    campaignId: String // For future campaign tracking
  }
}, {
  timestamps: true
});

// Indexes for better query performance
referralSchema.index({ referrer: 1, status: 1 });
referralSchema.index({ referee: 1 });
referralSchema.index({ createdAt: 1 });
referralSchema.index({ completedAt: 1 });

// Static methods
referralSchema.statics.getSuccessfulReferrals = function(userId) {
  return this.find({ referrer: userId, status: 'successful' })
    .populate('referee', 'username email createdAt')
    .sort({ completedAt: -1 });
};

referralSchema.statics.getPendingReferrals = function(userId) {
  return this.find({ referrer: userId, status: 'pending' })
    .populate('referee', 'username email createdAt')
    .sort({ createdAt: -1 });
};

referralSchema.statics.getReferralStats = function(userId) {
  return this.aggregate([
    { $match: { referrer: userId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalRewards: { $sum: '$rewards.referrerReward.amount' }
      }
    }
  ]);
};

module.exports = mongoose.model('Referral', referralSchema);
