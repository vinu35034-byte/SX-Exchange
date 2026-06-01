const mongoose = require('mongoose');

const vipRewardSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true 
  },
  vipLevel: { 
    type: Number, 
    required: true 
  },
  rewardType: { 
    type: String, 
    enum: ['daily', 'upgrade'], 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  currency: { 
    type: String, 
    default: 'USDT' 
  },
  status: { 
    type: String, 
    enum: ['pending', 'claimed', 'expired'], 
    default: 'pending' 
  },
  claimedAt: Date,
  expiresAt: Date,
  // For daily rewards - the date this reward is for
  rewardDate: { 
    type: Date, 
    required: true 
  },
  // Metadata for tracking
  metadata: {
    referralCount: Number,
    totalReferralDeposits: Number,
    upgradeFromLevel: Number, // For upgrade rewards
    autoAwarded: { type: Boolean, default: false } // For upgrade rewards
  }
}, { 
  timestamps: true 
});

// Indexes for performance
vipRewardSchema.index({ user: 1, rewardDate: 1, rewardType: 1 });
vipRewardSchema.index({ status: 1 });
vipRewardSchema.index({ expiresAt: 1 });
vipRewardSchema.index({ rewardDate: 1 });

// Compound index for checking monthly rewards
vipRewardSchema.index({
  user: 1,
  rewardType: 1,
  rewardDate: 1
}, { unique: true });

// Static methods
vipRewardSchema.statics.getThisMonthsReward = function(userId) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return this.findOne({
    user: userId,
    rewardType: 'daily',
    rewardDate: { $gte: startOfMonth, $lt: startOfNextMonth }
  });
};

vipRewardSchema.statics.getUserRewardHistory = function(userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  return this.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('user', 'username email');
};

vipRewardSchema.statics.getUnclaimedRewards = function(userId) {
  return this.find({
    user: userId,
    status: 'pending',
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  }).sort({ createdAt: -1 });
};

vipRewardSchema.statics.expireOldRewards = function() {
  return this.updateMany(
    {
      status: 'pending',
      expiresAt: { $lt: new Date() }
    },
    {
      $set: { status: 'expired' }
    }
  );
};

module.exports = mongoose.model('VIPReward', vipRewardSchema);
