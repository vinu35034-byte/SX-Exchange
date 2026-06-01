const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
  coin: { type: mongoose.Schema.Types.ObjectId, ref: 'Coin', required: true },

  timestamp: { type: Date, required: true, default: Date.now },

  priceUSD: { type: Number, required: true },
  priceBTC: { type: Number, default: 0 },

  volume24hUSD: { type: Number, default: 0 },
  marketCapUSD: { type: Number, default: 0 },

}, {
  timestamps: true,
  // Consider adding indexes on coin + timestamp for faster queries
});

priceHistorySchema.index({ coin: 1, timestamp: -1 });

module.exports = mongoose.model('PriceHistory', priceHistorySchema);
