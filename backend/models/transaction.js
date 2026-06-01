const mongoose = require('mongoose');



const transactionSchema = new mongoose.Schema({

  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },



  // Unique transaction ID for user-friendly reference

  transactionId: {

    type: String,

    unique: true,

    required: true

  },



  type: {

    type: String,

    enum: [

      'deposit', 

      'withdrawal', 

      'internal_transfer', 

      'fee', 

      'refund',

      'referral_reward',    // Direct referral rewards

      'trading_bonus',      // Multi-level trading bonuses

      'vip_reward',         // VIP system rewards

      'trade_buy',          // Token purchases

      'trade_sell',         // Token sales

      'adjustment',         // Admin adjustments

      'unfollow',           // Copy trading unfollow

      'follow',             // Copy trading follow

      'passive_income',     // Copy trading passive income

      'copy_trade',         // Copy trading BUY/SELL

      'admin_distribution'  // Copy trading admin distribution

    ],

    required: true,

  },



  // Sub-type for more specific categorization

  subType: {

    type: String,

    enum: [

      'crypto_deposit',

      'crypto_withdrawal', 

      'wallet_transfer',

      'trading_fee',

      'withdrawal_fee',

      'direct_referral_bonus',

      'level_1_trading_bonus',

      'level_2_trading_bonus', 

      'level_3_trading_bonus',

      'level_4_trading_bonus',

      'level_5_trading_bonus',

      'vip_daily_reward',

      'vip_upgrade_reward',

      'spot_trade',

      'special_token_trade',

      'admin_adjustment',

      'copy_trade_buy',      // Copy trading BUY

      'copy_trade_sell',     // Copy trading SELL

      'copy_trade_follow',   // Copy trading follow

      'copy_trade_unfollow'  // Copy trading unfollow

    ]

  },



  currency: { type: String, required: true, uppercase: true },



  amount: { type: Number, required: true, min: 0 },



  fee: { type: Number, default: 0, min: 0 },



  // Direction of transaction

  direction: {

    type: String,

    enum: ['credit', 'debit'], // credit = money in, debit = money out

    required: true

  },



  // Balance tracking

  balanceBefore: { type: Number, default: 0 },

  balanceAfter: { type: Number, default: 0 },



  // USD value for reporting

  usdValue: { type: Number, default: 0 },



  status: {

    type: String,

    enum: ['pending', 'completed', 'failed', 'cancelled'],

    default: 'completed', // Most internal transactions are instant

  },



  // Referral-specific information

  referralInfo: {

    referralId: {

      type: mongoose.Schema.Types.ObjectId,

      ref: 'Referral'

    },

    referralLevel: Number, // 1, 2, 3, etc. for trading bonuses

    triggeredBy: {

      type: mongoose.Schema.Types.ObjectId,

      ref: 'User'

    },

    bonusPercentage: Number,

    originalProfit: Number

  },



  // Trading-specific information

  tradingInfo: {

    tradeId: {

      type: String  // Changed from ObjectId to String to match Trade.tradeId

    },

    pair: String, // e.g., "BTC/USDT"

    side: {

      type: String,

      enum: ['buy', 'sell']

    },

    price: Number,

    quantity: Number,

    isSpecialToken: {

      type: Boolean,

      default: false

    },

    specialTokenId: {

      type: mongoose.Schema.Types.ObjectId,

      ref: 'SpecialToken'

    },

    priceAdjustment: Number,

    basePrice: Number,

    adjustedPrice: Number,

    profit: Number

  },



  // Copy trading-specific information

  copyTradingInfo: {

    traderId: {

      type: mongoose.Schema.Types.ObjectId,

      ref: 'Trader'

    },

    traderName: String,

    copyTradingFollowerId: {

      type: mongoose.Schema.Types.ObjectId,

      ref: 'CopyTradingFollower'

    },

    copyTradingTransactionId: {

      type: mongoose.Schema.Types.ObjectId,

      ref: 'CopyTradingTransaction'

    },

    tradeType: {

      type: String,

      enum: ['BUY', 'SELL'],

      uppercase: true

    },

    coin: {

      symbol: {

        type: String,

        uppercase: true

      },

      name: String,

      image: String

    },

    price: Number,

    profitLossPercentage: Number,

    profitLossAmount: Number,

    investmentAmount: Number,

    returnedAmount: Number

  },



  // For blockchain or external transactions

  txHash: { type: String, default: null },



  // Address or account details

  from: { type: String, default: null },

  to: { type: String, default: null },



  // Network information

  network: {

    type: String,

    enum: ['BEP20', 'TRC20', 'ETH', 'BTC', null]

  },



  requestedAt: { type: Date, default: Date.now },

  completedAt: { type: Date },

  executedAt: { type: Date, default: Date.now },



  notes: { type: String, default: '' },

  description: { type: String, default: '' },



  // Admin information

  processedBy: {

    type: mongoose.Schema.Types.ObjectId,

    ref: 'Admin'

  },



  // System tracking

  ipAddress: String,

  sessionId: String,



}, {

  timestamps: true,

  indexes: [

    { user: 1, type: 1 },

    { user: 1, executedAt: -1 },

    { type: 1, status: 1 },

    { 'referralInfo.referralId': 1 },

    { 'tradingInfo.tradeId': 1 },

    { txHash: 1 },

    { currency: 1 },

    { executedAt: -1 }

  ]

});



// Pre-save middleware to generate transaction ID

transactionSchema.pre('save', async function(next) {

  try {

    if (!this.transactionId) {

      // Generate unique transaction ID (format: TXN-YYYYMMDD-XXXXXX)

      const date = new Date();

      const dateStr = date.getFullYear().toString() + 

                     (date.getMonth() + 1).toString().padStart(2, '0') + 

                     date.getDate().toString().padStart(2, '0');

      

      // Generate random 6-digit number

      const randomNum = Math.floor(100000 + Math.random() * 900000);

      

      this.transactionId = `TXN-${dateStr}-${randomNum}`;

      

      // Ensure uniqueness

      let isUnique = false;

      let attempts = 0;

      while (!isUnique && attempts < 5) {

        const existing = await this.constructor.findOne({ transactionId: this.transactionId });

        if (!existing) {

          isUnique = true;

        } else {

          const newRandomNum = Math.floor(100000 + Math.random() * 900000);

          this.transactionId = `TXN-${dateStr}-${newRandomNum}`;

          attempts++;

        }

      }

    }

    next();

  } catch (error) {

    next(error);

  }

});



module.exports = mongoose.model('Transaction', transactionSchema);

