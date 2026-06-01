const mongoose = require('mongoose');

const unfollowRequestSchema = new mongoose.Schema(
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
    copyTradingFollower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CopyTradingFollower',
      required: true
    },
    // Investment details at time of request
    investedAmount: {
      type: Number,
      required: true,
      description: 'Original amount invested'
    },
    currentBalance: {
      type: Number,
      required: true,
      description: 'Current balance shown to user'
    },
    // Admin calculation
    profitLoss: {
      type: Number,
      default: null,
      description: 'Admin calculated profit or loss'
    },
    finalReturnAmount: {
      type: Number,
      default: null,
      description: 'Final amount to return after admin approval'
    },
    adminNotes: {
      type: String,
      default: '',
      description: 'Admin notes about the calculation'
    },
    // Status
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    // Admin info
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    },
    approvedAt: {
      type: Date,
      default: null
    },
    rejectionReason: {
      type: String,
      default: '',
      description: 'Reason for rejection if rejected'
    }
  },
  {
    timestamps: true
  }
);

// Indexes
unfollowRequestSchema.index({ user: 1, status: 1 });
unfollowRequestSchema.index({ status: 1, createdAt: -1 });
unfollowRequestSchema.index({ trader: 1, status: 1 });

module.exports = mongoose.model('UnfollowRequest', unfollowRequestSchema);
