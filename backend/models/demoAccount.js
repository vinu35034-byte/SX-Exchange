const mongoose = require('mongoose');

const demoAccountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  // Demo balance per currency (starts with 100,000 USDT)
  balances: {
    type: Map,
    of: Number,
    default: () => new Map([['USDT', 100000]])
  },
  // Track purchase prices for demo (same pattern as real trading)
  purchasePrices: {
    type: Map,
    of: Number,
    default: () => new Map()
  },
  // Purchase history for FIFO accounting in demo
  purchaseHistory: [{
    token: String,
    amount: Number,
    price: Number,
    usdtValue: Number,
    purchasedAt: { type: Date, default: Date.now },
    remainingAmount: Number
  }],
  // Stats
  totalTrades: { type: Number, default: 0 },
  totalProfitLoss: { type: Number, default: 0 },
  winCount: { type: Number, default: 0 },
  lossCount: { type: Number, default: 0 },
  initialBalance: { type: Number, default: 100000 },
  // Reset tracking
  resetCount: { type: Number, default: 0 },
  lastResetAt: { type: Date },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Indexes
demoAccountSchema.index({ isActive: 1 });

// Virtual: current total value in USDT
demoAccountSchema.virtual('totalEquity').get(function() {
  let total = 0;
  if (this.balances) {
    for (const [, amount] of this.balances) {
      total += amount || 0;
    }
  }
  return total;
});

// Virtual: P&L percentage
demoAccountSchema.virtual('pnlPercentage').get(function() {
  const usdtBalance = this.balances?.get('USDT') || 0;
  return ((usdtBalance - this.initialBalance) / this.initialBalance * 100).toFixed(2);
});

// Virtual: win rate
demoAccountSchema.virtual('winRate').get(function() {
  const total = this.winCount + this.lossCount;
  if (total === 0) return 0;
  return ((this.winCount / total) * 100).toFixed(1);
});

demoAccountSchema.set('toJSON', { virtuals: true });
demoAccountSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('DemoAccount', demoAccountSchema);
