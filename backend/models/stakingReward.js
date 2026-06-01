const mongoose = require('mongoose');

const stakingRewardSchema = new mongoose.Schema({
  // Position Reference
  positionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StakingPosition',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  poolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StakingPool',
    required: true
  },
  
  // Reward Details
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  rewardToken: {
    type: String,
    required: true,
    uppercase: true
  },
  
  // Calculation Period
  calculatedForDate: {
    type: Date,
    required: true
  },
  periodStart: {
    type: Date,
    required: true
  },
  periodEnd: {
    type: Date,
    required: true
  },
  
  // Reward Type
  rewardType: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'compound', 'final'],
    required: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'credited', 'failed'],
    default: 'pending'
  },
  creditedAt: {
    type: Date
  },
  
  // Calculation Details
  stakedAmount: {
    type: Number,
    required: true,
    min: 0
  },
  apyUsed: {
    type: Number,
    required: true,
    min: 0
  },
  daysInPeriod: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Transaction Reference
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  
  // Error Information (if failed)
  errorMessage: String,
  retryCount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Metadata
  calculatedBy: {
    type: String,
    enum: ['system', 'admin', 'manual'],
    default: 'system'
  },
  calculatedByAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for calculating expected daily reward
stakingRewardSchema.virtual('expectedDailyReward').get(function() {
  const annualReward = (this.stakedAmount * this.apyUsed) / 100;
  return annualReward / 365;
});

// Indexes for efficient queries
stakingRewardSchema.index({ positionId: 1, calculatedForDate: 1 });
stakingRewardSchema.index({ userId: 1, status: 1 });
stakingRewardSchema.index({ poolId: 1, status: 1 });
stakingRewardSchema.index({ status: 1, calculatedForDate: 1 });
stakingRewardSchema.index({ createdAt: -1 });

// Compound index for preventing duplicate rewards
stakingRewardSchema.index({ 
  positionId: 1, 
  calculatedForDate: 1,
  rewardType: 1 
}, { unique: true });

// Static method to get pending rewards for processing
stakingRewardSchema.statics.getPendingRewards = function() {
  return this.find({ 
    status: 'pending',
    retryCount: { $lt: 3 } // Limit retries
  })
  .populate('positionId')
  .populate('userId')
  .sort({ createdAt: 1 });
};

// Static method to get user's reward history
stakingRewardSchema.statics.getUserRewardHistory = function(userId, limit = 50) {
  return this.find({ userId: userId })
    .populate('poolId', 'name symbol')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get pool's reward statistics
stakingRewardSchema.statics.getPoolRewardStats = function(poolId) {
  return this.aggregate([
    { $match: { poolId: poolId, status: 'credited' } },
    {
      $group: {
        _id: null,
        totalRewards: { $sum: '$amount' },
        totalRecipients: { $addToSet: '$userId' },
        totalPayments: { $sum: 1 },
        avgReward: { $avg: '$amount' }
      }
    },
    {
      $project: {
        _id: 0,
        totalRewards: 1,
        totalRecipients: { $size: '$totalRecipients' },
        totalPayments: 1,
        avgReward: 1
      }
    }
  ]);
};

// Instance method to mark reward as credited
stakingRewardSchema.methods.markAsCredited = function(transactionId) {
  this.status = 'credited';
  this.creditedAt = new Date();
  this.transactionId = transactionId;
  return this.save();
};

// Instance method to mark reward as failed
stakingRewardSchema.methods.markAsFailed = function(errorMessage) {
  this.status = 'failed';
  this.errorMessage = errorMessage;
  this.retryCount += 1;
  return this.save();
};

module.exports = mongoose.model('StakingReward', stakingRewardSchema);
