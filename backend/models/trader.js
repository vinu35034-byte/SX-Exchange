const mongoose = require('mongoose');

const traderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    bio: {
      type: String,
      default: '',
      maxlength: 500
    },
    profileImage: {
      type: String,
      default: null
    },
    totalFollowers: {
      type: Number,
      default: 0
    },
    // Performance metrics
    winRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    totalTrades: {
      type: Number,
      default: 0
    },
    totalProfit: {
      type: Number,
      default: 0
    },
    // Commission/Revenue split
    commissionPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      description: 'Percentage of passive income that goes to the trader'
    },
    platformFeePercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      description: 'Platform fee from the passive income'
    },
    followerCommissionPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      description: 'Percentage of passive income that goes to followers'
    },
    // Status
    isActive: {
      type: Boolean,
      default: true
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verificationDate: {
      type: Date,
      default: null
    },
    // Verification by admin
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    },
    // Stats
    totalDistributed: {
      type: Number,
      default: 0,
      description: 'Total passive income distributed to followers'
    },
    totalEarned: {
      type: Number,
      default: 0,
      description: 'Total earned by trader through commissions'
    },
    // Metadata
    joinedDate: {
      type: Date,
      default: Date.now
    },
    lastActivityDate: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Index for active traders
traderSchema.index({ isActive: 1, isVerified: 1 });
traderSchema.index({ totalFollowers: -1 });
traderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Trader', traderSchema);
