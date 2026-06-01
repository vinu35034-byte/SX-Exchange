const mongoose = require('mongoose');

// Comprehensive transaction model for ALL user transactions
const userTransactionSchema = new mongoose.Schema({
  // Basic Info
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Transaction Type
  type: {
    type: String,
    enum: [
      'deposit',           // User deposits crypto
      'withdrawal',        // User withdraws crypto
      'trade_buy',         // User buys tokens
      'trade_sell',        // User sells tokens
      'referral_reward',   // Direct referral reward (Level 1 only)
      'trading_bonus',     // Multi-level trading bonus
      'vip_reward',        // VIP system rewards
      'internal_transfer', // Internal wallet transfers
      'fee',              // Trading or withdrawal fees
      'refund',           // Refunds
      'special_token_profit', // Special token selling profit
      'adjustment'        // Admin adjustments
    ],
    required: true,
    index: true
  },
  
  // Sub-type for more specific categorization
  subType: {
    type: String,
    enum: [
      // Deposit subtypes
      'crypto_deposit',
      'bank_deposit',
      
      // Withdrawal subtypes
      'crypto_withdrawal',
      'bank_withdrawal',
      
      // Trading subtypes
      'spot_trade',
      'special_token_trade',
      
      // Bonus subtypes
      'direct_referral_bonus',
      'level_1_trading_bonus',
      'level_2_trading_bonus',
      'level_3_trading_bonus',
      'level_4_trading_bonus',
      'level_5_trading_bonus',
      
      // Fee subtypes
      'trading_fee',
      'withdrawal_fee',
      'network_fee',
      
      // Other
      'vip_daily_reward',
      'vip_upgrade_reward',
      'admin_adjustment'
    ]
  },
  
  // Amount Information
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    uppercase: true,
    default: 'USDT'
  },
  usdValue: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Transaction Direction
  direction: {
    type: String,
    enum: ['credit', 'debit'], // credit = money in, debit = money out
    required: true,
    index: true
  },
  
  // Balance Information
  balanceBefore: {
    type: Number,
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'completed', // Most internal transactions are instant
    index: true
  },
  
  // Referral-specific information
  referralInfo: {
    // For referral rewards
    referralId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Referral'
    },
    
    // For trading bonuses
    referralLevel: {
      type: Number, // 1, 2, 3, etc.
      min: 1
    },
    
    // Who triggered this bonus (the person who sold the token)
    triggeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    // Percentage of profit this user gets
    bonusPercentage: {
      type: Number,
      min: 0,
      max: 100
    },
    
    // Original profit amount that bonus is calculated from
    originalProfit: {
      type: Number,
      min: 0
    },
    
    // Referral chain info
    referralChain: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      level: Number,
      percentage: Number
    }]
  },
  
  // Trading-specific information
  tradingInfo: {
    // Related trade
    tradeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trade'
    },
    
    // Token pair
    pair: String, // e.g., "BTC/USDT"
    
    // Trade details
    side: {
      type: String,
      enum: ['buy', 'sell']
    },
    price: Number,
    quantity: Number,
    
    // Special token info
    isSpecialToken: {
      type: Boolean,
      default: false
    },
    specialTokenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SpecialToken'
    },
    priceAdjustment: Number, // For special tokens
    basePrice: Number,       // Original market price
    adjustedPrice: Number,   // Final price after adjustment
    profit: Number           // Profit from price adjustment
  },
  
  // Blockchain information (for crypto transactions)
  blockchain: {
    network: {
      type: String,
      enum: ['BEP20', 'TRC20', 'ETH', 'BTC', null]
    },
    txHash: String,
    fromAddress: String,
    toAddress: String,
    blockNumber: Number,
    confirmations: {
      type: Number,
      default: 0
    }
  },
  
  // Fee Information
  fee: {
    amount: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'USDT'
    },
    usdValue: {
      type: Number,
      default: 0
    }
  },
  
  // Reference to original transaction/document
  reference: {
    type: {
      type: String,
      enum: ['DepositTransaction', 'WithdrawalRequest', 'Trade', 'Referral', 'VIPReward', 'Admin']
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'reference.type'
    }
  },
  
  // Additional metadata
  description: String,
  notes: String,
  
  // Admin information
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  processedAt: Date,
  
  // System tracking
  ipAddress: String,
  userAgent: String,
  sessionId: String,
  
  // Flags for monitoring
  flags: [{
    type: String,
    enum: ['suspicious', 'large_amount', 'unusual_pattern', 'manual_review']
  }],
  
  // Timestamps
  executedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
  
}, {
  timestamps: true,
  indexes: [
    { user: 1, type: 1 },
    { user: 1, executedAt: -1 },
    { type: 1, status: 1 },
    { 'referralInfo.referralId': 1 },
    { 'referralInfo.triggeredBy': 1 },
    { 'tradingInfo.tradeId': 1 },
    { 'blockchain.txHash': 1 },
    { currency: 1 },
    { executedAt: -1 }
  ]
});

// Static methods for querying
userTransactionSchema.statics.getUserTransactions = function(userId, options = {}) {
  const query = { user: userId };
  
  if (options.type) query.type = options.type;
  if (options.currency) query.currency = options.currency;
  if (options.status) query.status = options.status;
  
  return this.find(query)
    .sort({ executedAt: -1 })
    .limit(options.limit || 50)
    .skip(options.skip || 0);
};

userTransactionSchema.statics.getReferralTransactions = function(userId) {
  return this.find({
    user: userId,
    type: { $in: ['referral_reward', 'trading_bonus'] }
  }).sort({ executedAt: -1 });
};

userTransactionSchema.statics.getTradingBonusTransactions = function(userId) {
  return this.find({
    user: userId,
    type: 'trading_bonus'
  })
  .populate('referralInfo.triggeredBy', 'username')
  .sort({ executedAt: -1 });
};

userTransactionSchema.statics.getTransactionSummary = function(userId, timeframe = '30d') {
  const startDate = new Date();
  if (timeframe === '24h') startDate.setHours(startDate.getHours() - 24);
  else if (timeframe === '7d') startDate.setDate(startDate.getDate() - 7);
  else if (timeframe === '30d') startDate.setDate(startDate.getDate() - 30);
  else if (timeframe === '1y') startDate.setFullYear(startDate.getFullYear() - 1);
  
  return this.aggregate([
    {
      $match: {
        user: userId,
        executedAt: { $gte: startDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: {
          type: '$type',
          currency: '$currency'
        },
        totalAmount: { $sum: '$amount' },
        totalUsdValue: { $sum: '$usdValue' },
        count: { $sum: 1 }
      }
    }
  ]);
};

// Instance methods
userTransactionSchema.methods.calculateNetEffect = function() {
  if (this.direction === 'credit') {
    return this.amount - (this.fee.amount || 0);
  } else {
    return -(this.amount + (this.fee.amount || 0));
  }
};

userTransactionSchema.methods.isReferralRelated = function() {
  return ['referral_reward', 'trading_bonus'].includes(this.type);
};

userTransactionSchema.methods.getReferralLevel = function() {
  return this.referralInfo?.referralLevel || null;
};

// Pre-save middleware
userTransactionSchema.pre('save', function(next) {
  // Auto-calculate balance after if not provided
  if (this.balanceAfter === undefined && this.balanceBefore !== undefined) {
    const netEffect = this.calculateNetEffect();
    this.balanceAfter = this.balanceBefore + netEffect;
  }
  
  // Ensure USD value is set
  if (!this.usdValue && this.currency === 'USDT') {
    this.usdValue = this.amount;
  }
  
  next();
});

module.exports = mongoose.model('UserTransaction', userTransactionSchema);
