const mongoose = require('mongoose');

const orderLevelSchema = new mongoose.Schema({
  price: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
}, { _id: false });

const orderBookSchema = new mongoose.Schema({
  pair: { type: String, required: true, unique: true }, // e.g. "BTC/USD"

  bids: { type: [orderLevelSchema], default: [] }, // descending by price
  asks: { type: [orderLevelSchema], default: [] }, // ascending by price

  updatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

module.exports = mongoose.model('OrderBook', orderBookSchema);
