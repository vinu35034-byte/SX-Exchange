const mongoose = require('mongoose');

const stakingPoolSchema = new mongoose.Schema({
  // Basic Pool Information
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  symbol: { 
    type: String, 
    required: true,
    uppercase: true,
    trim: true
  },
  description: { 
    type: String,
    trim: true
  },
  
  // Pool Configuration
  apy: { 
    type: Number, 
    required: true,
    min: 0,
    max: 1000 // Max 1000% APY
  },
  minimumStake: { 
    type: Number, 
    required: true,
    min: 0,
    default: 1
  },
  maximumStake: { 
    type: Number,
    min: 0,
    default: null // null means no limit
  },
  
  // Pool Status
  isActive: { 
    type: Boolean, 
    default: true 
  },
  isPublic: { 
    type: Boolean, 
    default: true 
  },
  
  // Time Configuration
  lockPeriod: { 
    type: Number, // in days
    required: true,
    min: 0,
    default: 0 // 0 means flexible staking
  },
  
  // Pool Limits
  totalPoolLimit: { 
    type: Number,
    min: 0,
    default: null // null means no limit
  },
  currentTotalStaked: { 
    type: Number, 
    default: 0,
    min: 0
  },
  
  // Reward Configuration
  rewardToken: { 
    type: String,
    required: true,
    uppercase: true,
    default: function() { return this.symbol; }
  },
  rewardDistributionType: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'compound'],
    default: 'daily'
  },
  
  // Pool Statistics
  totalParticipants: { 
    type: Number, 
    default: 0,
    min: 0
  },
  totalRewardsPaid: { 
    type: Number, 
    default: 0,
    min: 0
  },
  
  // Admin Configuration
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  
  // Special Features
  isVipOnly: { 
    type: Boolean, 
    default: false 
  },
  requiredVipLevel: { 
    type: Number,
    min: 1,
    default: null
  },
  
  // Pool Image/Icon
  iconUrl: String,
  
  // Advanced Settings
  earlyUnstakePenalty: { 
    type: Number, // percentage
    min: 0,
    max: 100,
    default: 0
  },
  
  // Pool Lifecycle
  startDate: { 
    type: Date,
    default: Date.now
  },
  endDate: { 
    type: Date,
    default: null // null means no end date
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for calculating pool utilization percentage
stakingPoolSchema.virtual('utilizationPercentage').get(function() {
  if (!this.totalPoolLimit || this.totalPoolLimit === 0) {
    return 0;
  }
  return Math.min((this.currentTotalStaked / this.totalPoolLimit) * 100, 100);
});

// Virtual for checking if pool is full
stakingPoolSchema.virtual('isFull').get(function() {
  if (!this.totalPoolLimit) {
    return false;
  }
  return this.currentTotalStaked >= this.totalPoolLimit;
});

// Virtual for checking if pool is active and available
stakingPoolSchema.virtual('isAvailable').get(function() {
  const now = new Date();
  const isInTimeRange = (!this.startDate || this.startDate <= now) && 
                       (!this.endDate || this.endDate >= now);
  return this.isActive && this.isPublic && isInTimeRange && !this.isFull;
});

// Index for efficient queries
stakingPoolSchema.index({ symbol: 1, isActive: 1 });
stakingPoolSchema.index({ isActive: 1, isPublic: 1 });
stakingPoolSchema.index({ apy: -1 });
stakingPoolSchema.index({ createdAt: -1 });

// Static method to get active pools
stakingPoolSchema.statics.getActivePools = function() {
  return this.find({ 
    isActive: true, 
    isPublic: true,
    $or: [
      { startDate: { $lte: new Date() } },
      { startDate: null }
    ],
    $or: [
      { endDate: { $gte: new Date() } },
      { endDate: null }
    ]
  }).sort({ apy: -1 });
};

// Instance method to check if user can stake
stakingPoolSchema.methods.canUserStake = function(user, amount) {
  if (!this.isAvailable) {
    return { canStake: false, reason: 'Pool is not available' };
  }
  
  if (amount < this.minimumStake) {
    return { canStake: false, reason: `Minimum stake is ${this.minimumStake} ${this.symbol}` };
  }
  
  if (this.maximumStake && amount > this.maximumStake) {
    return { canStake: false, reason: `Maximum stake is ${this.maximumStake} ${this.symbol}` };
  }
  
  if (this.totalPoolLimit && (this.currentTotalStaked + amount) > this.totalPoolLimit) {
    return { canStake: false, reason: 'Pool limit exceeded' };
  }
  
  if (this.isVipOnly && (!user.vipLevel || user.vipLevel < (this.requiredVipLevel || 1))) {
    return { canStake: false, reason: 'VIP membership required' };
  }
  
  return { canStake: true };
};

module.exports = mongoose.model('StakingPool', stakingPoolSchema);
