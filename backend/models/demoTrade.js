const mongoose = require('mongoose');

const demoTradeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  demoAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DemoAccount',
    required: true
  },
  tradeId: {
    type: String,
    unique: true,
    required: true
  },
  pair: {
    type: String,
    required: true
  },
  side: {
    type: String,
    enum: ['buy', 'sell'],
    required: true
  },
  type: {
    type: String,
    enum: ['market', 'limit'],
    default: 'market'
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  totalValue: {
    type: Number,
    required: true
  },
  fee: {
    type: Number,
    default: 0
  },
  // Balance snapshots
  balanceBefore: {
    type: Map,
    of: Number
  },
  balanceAfter: {
    type: Map,
    of: Number
  },
  // For sell trades: profit/loss tracking
  profitLoss: {
    type: Number,
    default: 0
  },
  profitLossPercent: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['completed', 'cancelled', 'failed'],
    default: 'completed'
  },
  executedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
demoTradeSchema.index({ userId: 1, createdAt: -1 });
demoTradeSchema.index({ demoAccountId: 1, createdAt: -1 });
demoTradeSchema.index({ pair: 1, createdAt: -1 });

module.exports = mongoose.model('DemoTrade', demoTradeSchema);
