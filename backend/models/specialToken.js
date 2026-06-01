const mongoose = require('mongoose');

const specialTokenSchema = new mongoose.Schema({
  // Basic token information
  symbol: { 
    type: String, 
    required: true, 
    unique: true, 
    uppercase: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  
  // Price simulation settings
  priceRange: {
    min: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    max: { 
      type: Number, 
      required: true, 
      min: 0 
    }
  },
  
  // Current simulated price
  currentPrice: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  
  // Logo settings
  logoUrl: { 
    type: String, 
    required: true 
  },
  logoSize: {
    width: { type: Number, default: 64 },
    height: { type: Number, default: 64 }
  },
  
  // Simulation settings
  simulationConfig: {
    type: { 
      type: String, 
      enum: ['random_walk', 'sinusoidal', 'trend', 'target_based'], 
      default: 'target_based' 
    },
    interval: { 
      type: Number, 
      default: 30, // seconds
      min: 1,
      max: 3600 
    },
    volatility: { 
      type: Number, 
      default: 0.02, // 2% volatility
      min: 0.001,
      max: 0.1 
    },
    trendDirection: { 
      type: String, 
      enum: ['up', 'down', 'neutral'], 
      default: 'neutral' 
    },
    // For sinusoidal pattern
    amplitude: { 
      type: Number, 
      default: 0.1 // 10% of price range
    },
    frequency: { 
      type: Number, 
      default: 1 // cycles per hour
    },
    // New target-based simulation
    targetPrice: {
      type: Number,
      default: null // Target price to reach
    },
    targetTimeframe: {
      type: Number, 
      default: 3600 // Time in seconds to reach target
    },
    targetPercentage: {
      type: Number,
      default: 0 // Percentage change (e.g., 10 for +10%, -5 for -5%)
    },
    supportLevels: [{
      price: Number,
      strength: { type: Number, default: 0.5 } // 0-1, how strong the support is
    }],
    resistanceLevels: [{
      price: Number,
      strength: { type: Number, default: 0.5 } // 0-1, how strong the resistance is
    }],
    enableRealisticPatterns: {
      type: Boolean,
      default: true
    }
  },
  
  // Display settings
  isActive: { 
    type: Boolean, 
    default: true 
  },
  showInMarket: { 
    type: Boolean, 
    default: true 
  },
  marketPriority: { 
    type: Number, 
    default: 0 
  },
  
  // Trading controls (admin configurable)
  tradingControls: {
    buyEnabled: { type: Boolean, default: true },
    sellEnabled: { type: Boolean, default: true },
    // For special tokens, admin can set any percentage (can be + or -)
    sellPriceAdjustment: { type: Number, default: 0 }, // 0% = market price
    // Positive = user pays more/gets bonus, Negative = user pays less/gets less
    // Example: +10 = user pays 10% more for buy, user gets 10% more for sell
    //          -5 = user pays 5% less for buy, user gets 5% less for sell
  },
  
  // Special token indicators
  badge: {
    text: { 
      type: String, 
      default: 'SPECIAL' 
    },
    color: { 
      type: String, 
      default: '#10B981' // emerald-500
    },
    backgroundColor: { 
      type: String, 
      default: '#065F46' // emerald-800
    }
  },
  
  // Tooltip/description for users
  description: { 
    type: String, 
    default: 'This is a simulated token for demonstration purposes.' 
  },
  tooltip: { 
    type: String, 
    default: 'Simulated token with demo price movements' 
  },
  
  // Price history for charts with OHLC data
  priceHistory: [{
    timestamp: { type: Date, default: Date.now },
    open: Number,
    high: Number,
    low: Number,
    close: Number,
    volume: { type: Number, default: 0 }
  }],
  
  // Admin tracking
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Admin',
    required: true 
  },
  lastUpdatedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Admin' 
  },
  
  // Simulation state
  lastSimulationUpdate: { 
    type: Date, 
    default: Date.now 
  },
  simulationData: {
    // For random walk
    lastDirection: { type: Number, default: 0 },
    momentum: { type: Number, default: 0 },
    
    // For sinusoidal
    phase: { type: Number, default: 0 },
    basePrice: { type: Number },
    
    // For trend
    trendStartPrice: { type: Number },
    trendStartTime: { type: Date },
    
    // For target-based simulation
    targetStartPrice: { type: Number },
    targetStartTime: { type: Date },
    currentCandle: {
      open: Number,
      high: Number,
      low: Number,
      timestamp: Date,
      intervalSeconds: { type: Number, default: 300 } // 5-minute candles
    }
  },
  
  // Statistics
  stats: {
    totalUpdates: { type: Number, default: 0 },
    highestPrice: { type: Number, default: 0 },
    lowestPrice: { type: Number, default: 0 },
    averagePrice: { type: Number, default: 0 },
    priceChanges24h: { type: Number, default: 0 },
    volatility24h: { type: Number, default: 0 }
  }

}, {
  timestamps: true,
  indexes: [
    { symbol: 1 },
    { isActive: 1, showInMarket: 1 },
    { createdBy: 1 },
    { lastSimulationUpdate: 1 }
  ]
});

// Virtual for price change percentage
specialTokenSchema.virtual('priceChangePercent').get(function() {
  if (this.priceHistory && this.priceHistory.length >= 2) {
    const current = this.currentPrice;
    const previous = this.priceHistory[0]?.price || current;
    return previous > 0 ? ((current - previous) / previous) * 100 : 0;
  }
  return 0;
});

// Virtual for 24h high/low
specialTokenSchema.virtual('priceStats24h').get(function() {
  if (!this.priceHistory || this.priceHistory.length === 0) {
    return {
      high: this.currentPrice,
      low: this.currentPrice,
      volume: 0
    };
  }
  
  const last24h = this.priceHistory.filter(
    p => p.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
  );
  
  if (last24h.length === 0) {
    return {
      high: this.currentPrice,
      low: this.currentPrice,
      volume: 0
    };
  }
  
  return {
    high: Math.max(...last24h.map(p => p.price), this.currentPrice),
    low: Math.min(...last24h.map(p => p.price), this.currentPrice),
    volume: last24h.reduce((sum, p) => sum + (p.volume || 0), 0)
  };
});

// Static method to get active special tokens for market display
specialTokenSchema.statics.getMarketTokens = function() {
  return this.find({
    isActive: true,
    showInMarket: true
  }).sort({ marketPriority: -1, symbol: 1 });
};

// Static method to simulate price update for a token
specialTokenSchema.statics.simulatePriceUpdate = async function(tokenId) {
  const token = await this.findById(tokenId);
  if (!token) return null;
  
  const now = new Date();
  const timeSinceLastUpdate = (now - token.lastSimulationUpdate) / 1000; // in seconds
  
  if (timeSinceLastUpdate < token.simulationConfig.interval) {
    return token; // Too soon for update
  }
  
  let newPrice = token.currentPrice;
  const config = token.simulationConfig;
  
  switch (config.type) {
    case 'random_walk':
      newPrice = token._simulateRandomWalk();
      break;
    case 'sinusoidal':
      newPrice = token._simulateSinusoidal();
      break;
    case 'trend':
      newPrice = token._simulateTrend();
      break;
    case 'target_based':
      newPrice = token._simulateTargetBased();
      break;
  }
  
  // Ensure price stays within bounds
  newPrice = Math.max(token.priceRange.min, Math.min(token.priceRange.max, newPrice));
  
  // Update token with OHLC data
  const currentCandle = token.simulationData.currentCandle;
  const candleInterval = currentCandle?.intervalSeconds || 300; // 5 minutes default
  
  // Check if we need to start a new candle
  if (!currentCandle?.timestamp || 
      (now - currentCandle.timestamp) >= (candleInterval * 1000)) {
    
    // Complete the previous candle if it exists
    if (currentCandle?.open !== undefined) {
      token.priceHistory.push({
        timestamp: currentCandle.timestamp,
        open: currentCandle.open,
        high: currentCandle.high,
        low: currentCandle.low,
        close: token.currentPrice,
        volume: Math.random() * 1000000 // Random volume for demo
      });
    }
    
    // Start new candle
    token.simulationData.currentCandle = {
      open: token.currentPrice,
      high: Math.max(token.currentPrice, newPrice),
      low: Math.min(token.currentPrice, newPrice),
      timestamp: now,
      intervalSeconds: candleInterval
    };
  } else {
    // Update current candle
    token.simulationData.currentCandle.high = Math.max(
      currentCandle.high || token.currentPrice, 
      newPrice
    );
    token.simulationData.currentCandle.low = Math.min(
      currentCandle.low || token.currentPrice, 
      newPrice
    );
  }
  
  // Update current price
  token.currentPrice = newPrice;
  token.lastSimulationUpdate = now;
  token.stats.totalUpdates += 1;
  
  // Keep last 1000 candles (about 3.5 days of 5-minute candles)
  if (token.priceHistory.length > 1000) {
    token.priceHistory = token.priceHistory.slice(-1000);
  }
  
  // Update statistics
  token._updateStatistics();
  
  await token.save();
  return token;
};

// Instance method for random walk simulation
specialTokenSchema.methods._simulateRandomWalk = function() {
  const config = this.simulationConfig;
  const currentPrice = this.currentPrice;
  
  // Random walk with momentum
  const randomChange = (Math.random() - 0.5) * 2; // -1 to 1
  const momentum = this.simulationData.momentum || 0;
  
  // Apply momentum and volatility
  const change = (randomChange * 0.7 + momentum * 0.3) * config.volatility;
  const newPrice = currentPrice * (1 + change);
  
  // Update momentum for next iteration
  this.simulationData.momentum = change * 0.5; // Decay momentum
  
  return newPrice;
};

// Instance method for sinusoidal simulation
specialTokenSchema.methods._simulateSinusoidal = function() {
  const config = this.simulationConfig;
  
  if (!this.simulationData.basePrice) {
    this.simulationData.basePrice = (this.priceRange.min + this.priceRange.max) / 2;
  }
  
  const basePrice = this.simulationData.basePrice;
  const amplitude = (this.priceRange.max - this.priceRange.min) * config.amplitude;
  
  // Increment phase based on frequency
  this.simulationData.phase = (this.simulationData.phase || 0) + 
    (config.frequency * config.interval) / 3600; // Convert to hourly cycles
  
  const sineValue = Math.sin(this.simulationData.phase * 2 * Math.PI);
  const newPrice = basePrice + (sineValue * amplitude);
  
  return newPrice;
};

// Instance method for trend simulation
specialTokenSchema.methods._simulateTrend = function() {
  const config = this.simulationConfig;
  
  if (!this.simulationData.trendStartPrice) {
    this.simulationData.trendStartPrice = this.currentPrice;
    this.simulationData.trendStartTime = new Date();
  }
  
  const timeElapsed = (new Date() - this.simulationData.trendStartTime) / (1000 * 60 * 60); // hours
  const trendMultiplier = config.trendDirection === 'up' ? 1 : 
                         config.trendDirection === 'down' ? -1 : 0;
  
  // Linear trend with random noise
  const trendChange = trendMultiplier * timeElapsed * 0.01; // 1% per hour
  const randomNoise = (Math.random() - 0.5) * config.volatility;
  
  const newPrice = this.simulationData.trendStartPrice * (1 + trendChange + randomNoise);
  
  return newPrice;
};

// Instance method for target-based simulation (most realistic)
specialTokenSchema.methods._simulateTargetBased = function() {
  const config = this.simulationConfig;
  
  // Initialize target simulation if needed
  if (!this.simulationData.targetStartPrice || !this.simulationData.targetStartTime) {
    this.simulationData.targetStartPrice = this.currentPrice;
    this.simulationData.targetStartTime = new Date();
    
    // Set target price based on percentage if not already set
    if (config.targetPercentage && !config.targetPrice) {
      config.targetPrice = this.currentPrice * (1 + config.targetPercentage / 100);
    }
  }
  
  const timeElapsed = (new Date() - this.simulationData.targetStartTime) / 1000; // seconds
  const timeProgress = Math.min(timeElapsed / config.targetTimeframe, 1); // 0 to 1
  
  let targetPrice = config.targetPrice || this.currentPrice;
  
  // Ensure target is within bounds
  targetPrice = Math.max(this.priceRange.min, Math.min(this.priceRange.max, targetPrice));
  
  // Calculate the expected price at this point in time (linear interpolation)
  const expectedPrice = this.simulationData.targetStartPrice + 
    (targetPrice - this.simulationData.targetStartPrice) * timeProgress;
  
  // Add realistic market movements
  let newPrice = this.currentPrice;
  
  // Trend towards expected price with some randomness
  const priceGap = expectedPrice - this.currentPrice;
  const trendStrength = 0.3; // How strongly to trend towards target
  const trendMove = priceGap * trendStrength;
  
  // Add volatility and support/resistance levels
  const randomMove = (Math.random() - 0.5) * this.currentPrice * config.volatility;
  
  // Check for support/resistance levels
  let resistanceEffect = 0;
  if (config.resistanceLevels && config.resistanceLevels.length > 0) {
    for (const resistance of config.resistanceLevels) {
      const distanceToResistance = Math.abs(this.currentPrice - resistance.price) / this.currentPrice;
      if (distanceToResistance < 0.02 && this.currentPrice < resistance.price) { // Within 2%
        resistanceEffect -= trendMove * resistance.strength; // Reduce upward movement
      }
    }
  }
  
  if (config.supportLevels && config.supportLevels.length > 0) {
    for (const support of config.supportLevels) {
      const distanceToSupport = Math.abs(this.currentPrice - support.price) / this.currentPrice;
      if (distanceToSupport < 0.02 && this.currentPrice > support.price) { // Within 2%
        resistanceEffect += Math.abs(trendMove) * support.strength; // Reduce downward movement
      }
    }
  }
  
  // Combine all effects
  newPrice = this.currentPrice + trendMove + randomMove + resistanceEffect;
  
  // Add momentum for more realistic movement
  if (!this.simulationData.momentum) this.simulationData.momentum = 0;
  const momentum = this.simulationData.momentum * 0.7; // Decay previous momentum
  newPrice += momentum;
  
  // Update momentum for next iteration
  const currentMove = newPrice - this.currentPrice;
  this.simulationData.momentum = currentMove * 0.3;
  
  // Reset target if reached timeframe
  if (timeProgress >= 1) {
    this.simulationData.targetStartPrice = null;
    this.simulationData.targetStartTime = null;
  }
  
  return newPrice;
};

// Instance method to update statistics
specialTokenSchema.methods._updateStatistics = function() {
  this.stats.highestPrice = Math.max(this.stats.highestPrice, this.currentPrice);
  this.stats.lowestPrice = this.stats.lowestPrice > 0 ? 
    Math.min(this.stats.lowestPrice, this.currentPrice) : this.currentPrice;
  
  // Calculate 24h price change using OHLC data
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const priceYesterday = this.priceHistory.find(p => p.timestamp <= yesterday)?.close || this.currentPrice;
  this.stats.priceChanges24h = priceYesterday > 0 ? 
    ((this.currentPrice - priceYesterday) / priceYesterday) * 100 : 0;
  
  // Calculate average price
  if (this.priceHistory.length > 0) {
    const totalPrice = this.priceHistory.reduce((sum, p) => sum + p.close, 0) + this.currentPrice;
    this.stats.averagePrice = totalPrice / (this.priceHistory.length + 1);
  } else {
    this.stats.averagePrice = this.currentPrice;
  }
  
  // Calculate 24h volatility using OHLC data
  const last24hPrices = this.priceHistory
    .filter(p => p.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000))
    .map(p => p.close);
  
  if (last24hPrices.length > 1) {
    const mean = last24hPrices.reduce((sum, p) => sum + p, 0) / last24hPrices.length;
    const variance = last24hPrices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / last24hPrices.length;
    this.stats.volatility24h = Math.sqrt(variance) / mean * 100;
  }
};

// Pre-save validation
specialTokenSchema.pre('save', function(next) {
  // Ensure min price is less than max price
  if (this.priceRange.min >= this.priceRange.max) {
    return next(new Error('Minimum price must be less than maximum price'));
  }
  
  // Ensure current price is within range
  if (this.currentPrice < this.priceRange.min || this.currentPrice > this.priceRange.max) {
    this.currentPrice = Math.max(this.priceRange.min, 
      Math.min(this.priceRange.max, this.currentPrice));
  }
  
  // Initialize simulation data if needed
  if (!this.simulationData.basePrice && this.simulationConfig.type === 'sinusoidal') {
    this.simulationData.basePrice = (this.priceRange.min + this.priceRange.max) / 2;
  }
  
  next();
});

// Ensure virtuals are included in JSON output
specialTokenSchema.set('toJSON', { virtuals: true });
specialTokenSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('SpecialToken', specialTokenSchema);
