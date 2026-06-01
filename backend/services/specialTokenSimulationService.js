const SpecialToken = require('../models/specialToken');
const { sessionManager } = require('../config/session');
const { createLogger } = require('../utils/logger');
const candleService = require('./candleService');

const logger = createLogger('special-token-service');

/**
 * Special Token Simulation Service
 * Handles background price simulation for special tokens
 */
class SpecialTokenSimulationService {
  constructor() {
    this.sessionManager = sessionManager;
    this.intervalId = null;
    this.isRunning = false;
    this.socketServer = null;
    this.lastUpdateTimes = new Map();
    
    // Default simulation interval (can be overridden by token config)
    this.defaultInterval = 30000; // 30 seconds
  }

  /**
   * Initialize the simulation service
   * @param {Object} socketServer - Socket.io server instance for real-time updates
   */
  initialize(socketServer) {
    this.socketServer = socketServer;
    logger.info('Special token simulation service initialized', {
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Start the background simulation process
   */
  start() {
    console.log('🚀 SPECIAL TOKEN SIMULATION SERVICE - START METHOD CALLED');
    
    if (this.isRunning) {
      console.log('⚠️ Service already running');
      logger.warn('Special token simulation service already running', {
        timestamp: new Date().toISOString()
      });
     return;
    }

    this.isRunning = true;
    console.log('✅ Starting simulation service');
    
    // Start the main simulation loop
    this.intervalId = setInterval(async () => {
      console.log('⏰ Running simulation cycle');
      try {
        await this.runSimulationCycle();
      } catch (error) {
        console.error('❌ ERROR IN INTERVAL CALLBACK:', error);
      }
    }, 5000); // Check every 5 seconds

    console.log('🎯 Special token simulation service started successfully');
    logger.info('Special token simulation service started', {
      interval: 5000,
      defaultTokenInterval: this.defaultInterval,
      timestamp: new Date().toISOString()
    });

  }

  /**
   * Stop the background simulation process
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Attempted to stop non-running simulation service', {
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    this.lastUpdateTimes.clear();
    
  }

  /**
   * Run a single simulation cycle for all active tokens
   */
  async runSimulationCycle() {
    console.log('🔄 Starting simulation cycle...');
    
    try {
      logger.info('🔄 Running simulation cycle...');
      
      // Get all active special tokens
      console.log('📡 Querying database for active tokens...');
      const activeTokens = await SpecialToken.find({
        isActive: true
      });

      console.log(`📊 Found ${activeTokens.length} active tokens`);
      logger.info(`📊 Found ${activeTokens.length} active tokens`);

      if (activeTokens.length === 0) {
        console.log('⚠️ No active tokens to simulate');
        logger.warn('⚠️ No active tokens to simulate');
        return; // No tokens to simulate
      }

      const updatedTokens = [];
      const now = Date.now();

      console.log(`🔄 Processing ${activeTokens.length} tokens...`);

      for (const token of activeTokens) {
        console.log(`🎯 Processing token: ${token.symbol}`);
        try {
          // Check if it's time to update this token
          const lastUpdate = this.lastUpdateTimes.get(token._id.toString()) || 0;
          const intervalMs = token.simulationConfig.interval * 1000;
          
          console.log(`🔍 Checking token ${token.symbol}: lastUpdate=${lastUpdate}, intervalMs=${intervalMs}, timeSince=${now - lastUpdate}`);
          logger.info(`🔍 Checking token ${token.symbol}: lastUpdate=${lastUpdate}, intervalMs=${intervalMs}, timeSince=${now - lastUpdate}`);
          
          if (now - lastUpdate < intervalMs) {
            console.log(`⏰ Token ${token.symbol} not ready for update yet`);
            logger.info(`⏰ Token ${token.symbol} not ready for update yet`);
            continue; // Not time to update yet
          }

          console.log(`🎯 Updating price for token ${token.symbol}`);
          logger.info(`🎯 Updating price for token ${token.symbol}`);
          
          // Simulate price update
          const updatedToken = await this.simulateTokenPrice(token);
          if (updatedToken) {
            updatedTokens.push(updatedToken);
            this.lastUpdateTimes.set(token._id.toString(), now);
            logger.info(`✅ Updated ${token.symbol} to price: ${updatedToken.currentPrice}`);
          }

        } catch (error) {
          logger.error(`❌ Error simulating price for token ${token.symbol}:`, error);
        }
      }

      // Broadcast updates to connected clients
      if (updatedTokens.length > 0 && this.socketServer) {
        logger.info(`📡 Broadcasting ${updatedTokens.length} token updates`);
        this.broadcastPriceUpdates(updatedTokens);
      } else if (updatedTokens.length > 0) {
        logger.warn('❌ No socket server available for broadcasting');
      } else {
        logger.info('ℹ️ No tokens were updated this cycle');
      }

    } catch (error) {
      console.error('❌ ERROR IN SIMULATION CYCLE:', error);
      logger.error('❌ Error in simulation cycle:', error);
    }
  }

  /**
   * Simulate price update for a single token
   * @param {Object} token - Special token document
   * @returns {Object|null} Updated token or null if no update needed
   */
  async simulateTokenPrice(token) {
    try {
      let newPrice = token.currentPrice;
      const config = token.simulationConfig;
      
      switch (config.type) {
        case 'random_walk':
          newPrice = this.simulateRandomWalk(token);
          break;
        case 'sinusoidal':
          newPrice = this.simulateSinusoidal(token);
          break;
        case 'trend':
          newPrice = this.simulateTrend(token);
          break;
        default:
          newPrice = this.simulateRandomWalk(token);
      }
      
      // Ensure price stays within bounds
      newPrice = Math.max(token.priceRange.min, Math.min(token.priceRange.max, newPrice));
      
      // Only update if price actually changed significantly
      const priceChangePercent = Math.abs((newPrice - token.currentPrice) / token.currentPrice);
      if (priceChangePercent < 0.0001) { // Less than 0.01% change
        return null;
      }
      
      // Update token in database
      const now = new Date();
      const volumeSimulation = this.simulateVolume(token, newPrice);
      
      await SpecialToken.findByIdAndUpdate(token._id, {
        currentPrice: newPrice,
        lastSimulationUpdate: now,
        $inc: { 'stats.totalUpdates': 1 },
        $push: {
          priceHistory: {
            $each: [{
              price: newPrice,
              timestamp: now,
              volume: volumeSimulation
            }],
            $slice: -1000 // Keep only last 1000 entries
          }
        },
        $set: {
          'stats.highestPrice': Math.max(token.stats.highestPrice || 0, newPrice),
          'stats.lowestPrice': token.stats.lowestPrice > 0 ? 
            Math.min(token.stats.lowestPrice, newPrice) : newPrice
        }
      });

      // Create live candles for this price movement
      try {
        await candleService.processTrade({
          pair: `${token.symbol}/USDT`,
          price: newPrice,
          amount: volumeSimulation / newPrice, // Convert volume to amount
          timestamp: now
        });
      } catch (candleError) {
        logger.error('Error creating candles for special token price update', {
          tokenSymbol: token.symbol,
          error: candleError.message,
          price: newPrice
        });
      }
      
      // Return updated token data for broadcasting
      return {
        _id: token._id,
        symbol: token.symbol,
        name: token.name,
        currentPrice: newPrice,
        priceChange: newPrice - token.currentPrice,
        priceChangePercent: ((newPrice - token.currentPrice) / token.currentPrice) * 100,
        volume24h: volumeSimulation,
        timestamp: now,
        badge: token.badge,
        logoUrl: token.logoUrl
      };
      
    } catch (error) {
      console.error(`Error simulating price for ${token.symbol}:`, error);
      return null;
    }
  }

  /**
   * Random walk price simulation
   */
  simulateRandomWalk(token) {
    const config = token.simulationConfig;
    const currentPrice = token.currentPrice;
    
    // Get or initialize momentum
    let momentum = token.simulationData?.momentum || 0;
    
    // Random component (-1 to 1)
    const randomComponent = (Math.random() - 0.5) * 2;
    
    // Mean reversion factor (pulls price towards center of range)
    const center = (token.priceRange.min + token.priceRange.max) / 2;
    const meanReversionFactor = (center - currentPrice) / center * 0.1;
    
    // Combine components
    const change = (
      randomComponent * 0.5 +
      momentum * 0.3 +
      meanReversionFactor * 0.2
    ) * config.volatility;
    
    // Update momentum for next iteration (with decay)
    const newMomentum = change * 0.6 + momentum * 0.4;
    
    // Store momentum back to token (this will be saved on next update)
    if (!token.simulationData) token.simulationData = {};
    token.simulationData.momentum = newMomentum;
    
    return currentPrice * (1 + change);
  }

  /**
   * Sinusoidal price simulation
   */
  simulateSinusoidal(token) {
    const config = token.simulationConfig;
    
    // Initialize base price if not set
    if (!token.simulationData?.basePrice) {
      if (!token.simulationData) token.simulationData = {};
      token.simulationData.basePrice = (token.priceRange.min + token.priceRange.max) / 2;
      token.simulationData.phase = 0;
    }
    
    const basePrice = token.simulationData.basePrice;
    const amplitude = (token.priceRange.max - token.priceRange.min) * config.amplitude;
    
    // Increment phase based on frequency and interval
    const phaseIncrement = (config.frequency * config.interval) / 3600; // Convert to hourly cycles
    token.simulationData.phase = (token.simulationData.phase || 0) + phaseIncrement;
    
    // Add some randomness to make it less predictable
    const randomNoise = (Math.random() - 0.5) * config.volatility * basePrice * 0.5;
    
    const sineValue = Math.sin(token.simulationData.phase * 2 * Math.PI);
    const newPrice = basePrice + (sineValue * amplitude) + randomNoise;
    
    return newPrice;
  }

  /**
   * Trend-based price simulation
   */
  simulateTrend(token) {
    const config = token.simulationConfig;
    
    // Initialize trend data if not set
    if (!token.simulationData?.trendStartPrice) {
      if (!token.simulationData) token.simulationData = {};
      token.simulationData.trendStartPrice = token.currentPrice;
      token.simulationData.trendStartTime = new Date();
    }
    
    const timeElapsed = (new Date() - new Date(token.simulationData.trendStartTime)) / (1000 * 60 * 60); // hours
    const trendMultiplier = config.trendDirection === 'up' ? 1 : 
                           config.trendDirection === 'down' ? -1 : 0;
    
    // Calculate trend change (1% per hour by default)
    const trendChange = trendMultiplier * timeElapsed * 0.01;
    
    // Add volatility as random noise
    const randomNoise = (Math.random() - 0.5) * config.volatility;
    
    // Apply mean reversion to prevent going too far from range
    const center = (token.priceRange.min + token.priceRange.max) / 2;
    const meanReversionFactor = (center - token.currentPrice) / center * 0.05;
    
    const totalChange = trendChange + randomNoise + meanReversionFactor;
    const newPrice = token.simulationData.trendStartPrice * (1 + totalChange);
    
    return newPrice;
  }

  /**
   * Simulate trading volume
   */
  simulateVolume(token, newPrice) {
    const priceChange = Math.abs(newPrice - token.currentPrice) / token.currentPrice;
    
    // Base volume (simulated)
    const baseVolume = Math.random() * 100000 + 50000; // 50k - 150k base
    
    // Volume increases with price volatility
    const volatilityMultiplier = 1 + (priceChange * 10);
    
    return baseVolume * volatilityMultiplier;
  }

  /**
   * Broadcast price updates to connected clients
   */
  broadcastPriceUpdates(updatedTokens) {
    if (!this.socketServer) return;
    
    try {
      // Broadcast to all connected clients
      this.socketServer.emit('specialTokenPriceUpdate', {
        tokens: updatedTokens,
        timestamp: new Date().toISOString()
      });
      
      // Also broadcast individual token updates for specific subscriptions
      updatedTokens.forEach(token => {
        this.socketServer.emit(`specialToken:${token.symbol}`, {
          ...token,
          timestamp: new Date().toISOString()
        });
      });
      
    } catch (error) {
      console.error('Error broadcasting price updates:', error);
    }
  }

  /**
   * Get current simulation status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeTokenCount: this.lastUpdateTimes.size,
      lastUpdateTimes: Object.fromEntries(this.lastUpdateTimes)
    };
  }

  /**
   * Force update all active tokens (for testing/admin purposes)
   */
  async forceUpdateAll() {
    try {
      const activeTokens = await SpecialToken.find({ isActive: true });
      const updatedTokens = [];
      
      for (const token of activeTokens) {
        const updatedToken = await this.simulateTokenPrice(token);
        if (updatedToken) {
          updatedTokens.push(updatedToken);
          this.lastUpdateTimes.set(token._id.toString(), Date.now());
        }
      }
      
      if (updatedTokens.length > 0 && this.socketServer) {
        this.broadcastPriceUpdates(updatedTokens);
      }
      
      return updatedTokens;
      
    } catch (error) {
      console.error('Error in force update all:', error);
      throw error;
    }
  }
}

module.exports = new SpecialTokenSimulationService();
