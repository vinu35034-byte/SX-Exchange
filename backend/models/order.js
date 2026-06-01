const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

const orderSchema = new mongoose.Schema({
  orderId: { 
    type: String, 
    unique: true, 
    default: () => nanoid(12),
    required: true 
  },
  
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  pair: { 
    type: String, 
    required: true,
    index: true
  }, // e.g., "BTC/USDT"
  
  side: { 
    type: String, 
    enum: ['buy', 'sell'], 
    required: true 
  },
  
  type: {
    type: String,
    enum: ['market', 'limit', 'stop', 'stop_limit'],
    default: 'limit',
    required: true
  },
  
  price: { 
    type: Number, 
    required: function() { return this.type === 'limit' || this.type === 'stop_limit'; },
    min: 0 
  },
  
  stopPrice: {
    type: Number,
    required: function() { return this.type === 'stop' || this.type === 'stop_limit'; },
    min: 0
  },
  
  amount: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  
  filledAmount: { 
    type: Number, 
    default: 0, 
    min: 0 
  },
  
  remainingAmount: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  
  status: {
    type: String,
    enum: ['pending', 'partial', 'filled', 'cancelled', 'rejected'],
    default: 'pending',
  },
  
  timeInForce: {
    type: String,
    enum: ['GTC', 'IOC', 'FOK'], // Good Till Cancel, Immediate or Cancel, Fill or Kill
    default: 'GTC'
  },
  
  fee: { 
    type: Number, 
    default: 0, 
    min: 0 
  },
  
  feeCurrency: { 
    type: String, 
    uppercase: true, 
    default: 'USDT' 
  },
  
  trades: [{
    tradeId: String,
    price: Number,
    amount: Number,
    fee: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  
  averagePrice: { 
    type: Number, 
    default: 0 
  },
  
  totalValue: { 
    type: Number, 
    default: 0 
  },
  
  cancelledAt: Date,
  filledAt: Date,
  expiresAt: Date,
  
}, {
  timestamps: true,
});

// Indexes for efficient querying
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ pair: 1, side: 1, price: 1 });
orderSchema.index({ status: 1, pair: 1 });
// Note: orderId index is automatically created due to unique: true constraint

// Pre-save middleware to calculate remaining amount
orderSchema.pre('save', function(next) {
  this.remainingAmount = this.amount - this.filledAmount;
  
  // Calculate average price if there are trades
  if (this.trades && this.trades.length > 0) {
    let totalValue = 0;
    let totalAmount = 0;
    
    this.trades.forEach(trade => {
      totalValue += trade.price * trade.amount;
      totalAmount += trade.amount;
    });
    
    if (totalAmount > 0) {
      this.averagePrice = totalValue / totalAmount;
      this.totalValue = totalValue;
    }
  }
  
  // Update status based on filled amount
  if (this.filledAmount >= this.amount) {
    this.status = 'filled';
    this.filledAt = new Date();
  } else if (this.filledAmount > 0) {
    this.status = 'partial';
  }
  
  next();
});

module.exports = mongoose.model('Order', orderSchema);
