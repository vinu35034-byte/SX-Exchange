const mongoose = require('mongoose');

const coinSchema = new mongoose.Schema({
  symbol: { type: String, required: true, unique: true, uppercase: true }, // e.g. "MYCOIN"
  name: { type: String, required: true }, // e.g. "My Native Coin"
  
  // Price info
  priceUSD: { type: Number, default: 0 },        // Current price in USD
  priceBTC: { type: Number, default: 0 },        // Current price in BTC
  marketCapUSD: { type: Number, default: 0 },    // Market Cap
  volume24hUSD: { type: Number, default: 0 },    // 24h Trading volume USD
  circulatingSupply: { type: Number, default: 0 },
  totalSupply: { type: Number, default: 0 },
  
  // Token visibility and trading controls
  isVisible: { type: Boolean, default: true },    // Show in public token list
  isTradingEnabled: { type: Boolean, default: false }, // Allow trading
  isListedOnExchange: { type: Boolean, default: false }, // Listed for trading pairs
  showInMarket: { type: Boolean, default: false }, // Show in market page
  marketPriority: { type: Number, default: 0 }, // Order in market display (higher = shown first)
  
  // Trading fees and controls (admin configurable)
  tradingControls: {
    buyEnabled: { type: Boolean, default: true },
    sellEnabled: { type: Boolean, default: true },
    sellFeePercentage: { type: Number, default: 1.0 }, // Default 1% fee on sell
    // Positive = user gets less, Negative = user gets bonus
    sellPriceAdjustment: { type: Number, default: -1.0 } // -1% = 1% fee
  },
  
  // Trading pair configurations
  tradingPairs: [{
    quoteAsset: { type: String, required: true }, // e.g., 'USDT', 'BTC', 'ETH'
    isActive: { type: Boolean, default: true },
    minOrderSize: { type: Number, default: 0.001 },
    maxOrderSize: { type: Number, default: 1000000 },
    priceDecimals: { type: Number, default: 6 },
    quantityDecimals: { type: Number, default: 4 }
  }],
  
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'delisted', 'pending_review'], 
    default: 'pending_review' 
  },

  // Admin metadata
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  approvedAt: { type: Date },
  
  lastUpdated: { type: Date, default: Date.now },

  // Optional: Links for more info or logos
  websiteUrl: { type: String },
  logoUrl: { type: String },
  
  description: { type: String },
  
  // Technical details
  contractAddress: { type: String }, // For tokens on blockchain
  network: { type: String, enum: ['ETH', 'BSC', 'TRON', 'POLYGON', 'NATIVE'], default: 'NATIVE' },
  decimals: { type: Number, default: 18 },

}, {
  timestamps: true,
});

// Static method to get coins for market display
coinSchema.statics.getMarketCoins = function() {
  return this.find({
    showInMarket: true,
    status: 'active',
    isTradingEnabled: true
  }).sort({ marketPriority: -1, name: 1 });
};

// Static method to get active trading pairs
coinSchema.statics.getActiveTradingPairs = function() {
  return this.find({
    status: 'active',
    isTradingEnabled: true,
    'tradingPairs.isActive': true
  }).populate('tradingPairs');
};

module.exports = mongoose.model('Coin', coinSchema);
