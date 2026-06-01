const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },

  pair: { type: String, required: true }, // e.g., "BTC/USD"

  side: { 
    type: String, 
    enum: ['buy', 'sell'], 
    required: true 
  },

  price: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
  filledAmount: { type: Number, default: 0, min: 0 },

  fee: { type: Number, default: 0, min: 0 },
  feeCurrency: { type: String, uppercase: true, default: '' },

  status: {
    type: String,
    enum: ['pending', 'completed', 'partial', 'cancelled'],
    default: 'pending',
  },

  executedAt: { type: Date },

  orderType: {
    type: String,
    enum: ['limit', 'market', 'stop', 'stop_limit', 'ioc', 'fok'],
    default: 'limit',
  },

  tradeId: { type: String, unique: true, required: true },

}, {
  timestamps: true,
});

module.exports = mongoose.model('Trade', tradeSchema);
