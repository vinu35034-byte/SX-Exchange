const mongoose = require('mongoose');

const marketTickerSchema = new mongoose.Schema({
  pair: { type: String, required: true, unique: true }, // e.g. "BTC/USD"

  lastPrice: { type: Number, required: true, min: 0 },
  openPrice: { type: Number, required: true, min: 0 },
  highPrice: { type: Number, required: true, min: 0 },
  lowPrice: { type: Number, required: true, min: 0 },

  volume24h: { type: Number, required: true, min: 0 },

  change24h: { type: Number, default: 0 }, // can be % or absolute

  updatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

module.exports = mongoose.model('MarketTicker', marketTickerSchema);
