const mongoose = require('mongoose');

const stakingPositionSchema = new mongoose.Schema({
  // User and Pool References
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
  
  // Staking Details
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  symbol: {
    type: String,
    required: true,
    uppercase: true
  },
  
  // APY at time of staking (locked for this position)
  lockedApy: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Time Information
  stakedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  unstakedAt: {
    type: Date,
    default: null
  },
  lockPeriod: {
    type: Number, // in days
    required: true,
    min: 0
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'unstaked', 'penalty_unstaked'],
    default: 'active'
  },
  
  // Rewards Tracking
  totalRewardsEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  totalRewardsClaimed: {
    type: Number,
    default: 0,
    min: 0
  },
  lastRewardCalculatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Unstaking Information
  canUnstakeAt: {
    type: Date,
    required: true
  },
  earlyUnstakePenalty: {
    type: Number, // percentage
    min: 0,
    max: 100,
    default: 0
  },
  penaltyPaid: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Transaction References
  stakeTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  unstakeTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  
  // Additional Metadata
  metadata: {
    stakingSource: {
      type: String,
      enum: ['web', 'mobile', 'api'],
      default: 'web'
    },
    deviceInfo: String,
    ipAddress: String
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for calculating pending rewards
stakingPositionSchema.virtual('pendingRewards').get(function() {
  if (this.status !== 'active') {
    return 0;
  }
  
  const now = new Date();
  const lastCalculated = this.lastRewardCalculatedAt || this.stakedAt;
  const timeDiff = now - lastCalculated;
  const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
  
  // Calculate annual reward and convert to period reward
  const annualReward = (this.amount * this.lockedApy) / 100;
  const dailyReward = annualReward / 365;
  
  return Math.max(0, dailyReward * daysDiff);
});

// Virtual for checking if position can be unstaked without penalty
stakingPositionSchema.virtual('canUnstakeWithoutPenalty').get(function() {
  return new Date() >= this.canUnstakeAt;
});

// Virtual for calculating total value (stake + rewards)
stakingPositionSchema.virtual('totalValue').get(function() {
  return this.amount + this.totalRewardsEarned - this.totalRewardsClaimed + this.pendingRewards;
});

// Virtual for calculating days remaining in lock period
stakingPositionSchema.virtual('daysRemainingInLock').get(function() {
  if (this.status !== 'active') {
    return 0;
  }
  
  const now = new Date();
  if (now >= this.canUnstakeAt) {
    return 0;
  }
  
  const timeDiff = this.canUnstakeAt - now;
  return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
});

// Virtual for calculating total staking duration
stakingPositionSchema.virtual('stakingDurationDays').get(function() {
  const endDate = this.unstakedAt || new Date();
  const timeDiff = endDate - this.stakedAt;
  return Math.floor(timeDiff / (1000 * 60 * 60 * 24));
});

// Indexes for efficient queries
stakingPositionSchema.index({ userId: 1, status: 1 });
stakingPositionSchema.index({ poolId: 1, status: 1 });
stakingPositionSchema.index({ status: 1, canUnstakeAt: 1 });
stakingPositionSchema.index({ userId: 1, poolId: 1 });
stakingPositionSchema.index({ createdAt: -1 });

// Pre-save middleware to calculate canUnstakeAt
stakingPositionSchema.pre('save', function(next) {
  if (this.isNew && !this.canUnstakeAt) {
    const lockDays = this.lockPeriod || 0;
    this.canUnstakeAt = new Date(this.stakedAt.getTime() + (lockDays * 24 * 60 * 60 * 1000));
  }
  next();
});

// Static method to get user's active positions
stakingPositionSchema.statics.getUserActivePositions = function(userId) {
  return this.find({ 
    userId: userId, 
    status: 'active' 
  })
  .populate('poolId')
  .sort({ createdAt: -1 });
};

// Static method to get positions ready for reward calculation
stakingPositionSchema.statics.getPositionsForRewardCalculation = function() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return this.find({
    status: 'active',
    lastRewardCalculatedAt: { $lt: oneDayAgo }
  }).populate('poolId');
};

// Instance method to calculate and update rewards
stakingPositionSchema.methods.calculateRewards = function() {
  const pendingRewards = this.pendingRewards;
  
  if (pendingRewards > 0) {
    this.totalRewardsEarned += pendingRewards;
    this.lastRewardCalculatedAt = new Date();
  }
  
  return pendingRewards;
};

// Instance method to unstake position
stakingPositionSchema.methods.unstake = function(isEarlyUnstake = false) {
  if (this.status !== 'active') {
    throw new Error('Position is not active');
  }
  
  const now = new Date();
  this.unstakedAt = now;
  
  if (isEarlyUnstake && now < this.canUnstakeAt) {
    this.status = 'penalty_unstaked';
    this.penaltyPaid = (this.amount * this.earlyUnstakePenalty) / 100;
  } else {
    this.status = 'unstaked';
  }
  
  // Calculate final rewards
  this.calculateRewards();
  
  return {
    amount: this.amount,
    rewards: this.totalRewardsEarned - this.totalRewardsClaimed,
    penalty: this.penaltyPaid,
    netAmount: this.amount + (this.totalRewardsEarned - this.totalRewardsClaimed) - this.penaltyPaid
  };
};

module.exports = mongoose.model('StakingPosition', stakingPositionSchema);
