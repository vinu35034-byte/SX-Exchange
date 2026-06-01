const mongoose = require('mongoose');

const copyTradingFollowerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    trader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trader',
      required: true
    },
    // Investment details
    initialAmount: {
      type: Number,
      required: true,
      min: 0,
      description: 'Initial amount invested in copy trading'
    },
    currentBalance: {
      type: Number,
      required: true,
      description: 'Current balance in copy trading'
    },
    totalInvested: {
      type: Number,
      default: 0,
      description: 'Total amount ever invested'
    },
    totalReturns: {
      type: Number,
      default: 0,
      description: 'Total passive income received'
    },
    // Returns distribution
    lastReturnDate: {
      type: Date,
      default: null
    },
    nextReturnDate: {
      type: Date,
      default: null
    },
    // Status
    status: {
      type: String,
      enum: ['active', 'paused', 'stopped'],
      default: 'active'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    // Dates
    followedDate: {
      type: Date,
      default: Date.now
    },
    stoppedDate: {
      type: Date,
      default: null
    },
    // Preferences
    autoReinvest: {
      type: Boolean,
      default: false,
      description: 'Whether returns are automatically reinvested'
    }
  },
  {
    timestamps: true
  }
);

// Compound index for user-trader relationship
// Allow duplicate user-trader combinations when isActive is false (for re-following)
copyTradingFollowerSchema.index(
  { user: 1, trader: 1, isActive: 1 }, 
  { 
    unique: true,
    partialFilterExpression: { isActive: true }
  }
);
copyTradingFollowerSchema.index({ user: 1, isActive: 1 });
copyTradingFollowerSchema.index({ trader: 1, isActive: 1 });
copyTradingFollowerSchema.index({ createdAt: -1 });

module.exports = mongoose.model('CopyTradingFollower', copyTradingFollowerSchema);
