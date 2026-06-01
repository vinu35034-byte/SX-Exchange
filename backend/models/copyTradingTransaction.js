const mongoose = require('mongoose');

const copyTradingTransactionSchema = new mongoose.Schema(
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
    // Transaction details
    type: {
      type: String,
      enum: ['follow', 'unfollow', 'deposit', 'withdrawal', 'passive_income', 'admin_distribution', 'refund', 'trade'],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    // Trade execution details (for type: 'trade')
    trade: {
      coin: {
        symbol: {
          type: String,
          uppercase: true
        },
        name: String,
        image: String
      },
      tradeType: {
        type: String,
        enum: ['BUY', 'SELL'],
        uppercase: true
      },
      price: {
        type: Number,
        min: 0
      },
      profitLossPercentage: Number,
      profitLossAmount: Number,
      investmentAmount: Number,
      returnedAmount: Number,
      marketData: {
        priceChange24h: Number,
        volume24h: Number,
        marketCap: Number
      }
    },
    // For passive income distribution
    distributionReason: {
      type: String,
      default: null,
      description: 'Reason for distribution (e.g., market gains, manual distribution)'
    },
    // Commission breakdown
    traderCommission: {
      type: Number,
      default: 0,
      description: 'Amount earned by trader'
    },
    platformFee: {
      type: Number,
      default: 0,
      description: 'Platform fee'
    },
    followerAmount: {
      type: Number,
      default: 0,
      description: 'Amount received by follower'
    },
    // Status
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    // Processing info
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    },
    processedAt: {
      type: Date,
      default: null
    },
    // Reference
    referenceId: {
      type: String,
      default: null,
      description: 'External transaction reference'
    },
    notes: {
      type: String,
      default: ''
    },
    adminNotes: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Indexes for queries
copyTradingTransactionSchema.index({ user: 1, createdAt: -1 });
copyTradingTransactionSchema.index({ trader: 1, createdAt: -1 });
copyTradingTransactionSchema.index({ type: 1, status: 1 });
copyTradingTransactionSchema.index({ 'trade.coin.symbol': 1 });
copyTradingTransactionSchema.index({ createdAt: -1 });

// Static method to get user's trade transactions
copyTradingTransactionSchema.statics.getUserTrades = function(userId, options = {}) {
  const { limit = 50, skip = 0, coinSymbol } = options;
  
  const query = { user: userId, type: 'trade' };
  if (coinSymbol) query['trade.coin.symbol'] = coinSymbol.toUpperCase();
  
  return this.find(query)
    .populate('trader', 'name profileImage winRate')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get trade summary for a user
copyTradingTransactionSchema.statics.getUserTradeSummary = async function(userId) {
  const summary = await this.aggregate([
    { $match: { user: mongoose.Types.ObjectId(userId), type: 'trade' } },
    {
      $group: {
        _id: null,
        totalTrades: { $sum: 1 },
        totalProfit: {
          $sum: {
            $cond: [{ $gte: ['$trade.profitLossAmount', 0] }, '$trade.profitLossAmount', 0]
          }
        },
        totalLoss: {
          $sum: {
            $cond: [{ $lt: ['$trade.profitLossAmount', 0] }, { $abs: '$trade.profitLossAmount' }, 0]
          }
        }
      }
    }
  ]);
  
  return summary.length > 0 ? summary[0] : {
    totalTrades: 0,
    totalProfit: 0,
    totalLoss: 0
  };
};

module.exports = mongoose.model('CopyTradingTransaction', copyTradingTransactionSchema);
