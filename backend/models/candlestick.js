const mongoose = require('mongoose');

const candlestickSchema = new mongoose.Schema({
  pair: { type: String, required: true }, // e.g., "SPECIAL/USDT"
  
  // Timeframe for this candle
  timeframe: { 
    type: String, 
    enum: ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'], 
    required: true 
  },
  
  // OHLC data
  open: { type: Number, required: true, min: 0 },
  high: { type: Number, required: true, min: 0 },
  low: { type: Number, required: true, min: 0 },
  close: { type: Number, required: true, min: 0 },
  
  // Volume data
  volume: { type: Number, default: 0, min: 0 },
  quoteVolume: { type: Number, default: 0, min: 0 }, // Volume in quote currency (USDT)
  
  // Timestamp for the start of this candle period
  openTime: { type: Date, required: true },
  closeTime: { type: Date, required: true },
  
  // Trading statistics for this period
  tradeCount: { type: Number, default: 0, min: 0 },
  
  // Track if this candle is closed (completed) or still being updated
  closed: { type: Boolean, default: false }
  
}, {
  timestamps: true
});

// Compound indexes for efficient querying
candlestickSchema.index({ pair: 1, timeframe: 1, openTime: -1 });
candlestickSchema.index({ pair: 1, timeframe: 1, closeTime: -1 });
candlestickSchema.index({ pair: 1, timeframe: 1, closed: 1, openTime: -1 });

module.exports = mongoose.model('Candlestick', candlestickSchema);
