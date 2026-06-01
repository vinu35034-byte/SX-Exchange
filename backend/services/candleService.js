const Candlestick = require('../models/candlestick');
const Trade = require('../models/trade');
const { createLogger } = require('../utils/logger');

const logger = createLogger('candle-service');

/**
 * Live Candlestick Service
 * Creates and updates OHLC candles from real trading activity
 */
class CandleService {
  constructor() {
    this.activeCandlesCache = new Map(); // cache for current active candles
    this.socketServer = null;
    
    // Timeframe configurations
    this.timeframes = {
      '1m':  60 * 1000,              // 1 minute
      '5m':  5  * 60 * 1000,         // 5 minutes
      '15m': 15 * 60 * 1000,         // 15 minutes
      '1h':  60 * 60 * 1000,         // 1 hour
      '4h':  4  * 60 * 60 * 1000,    // 4 hours
      '1d':  24 * 60 * 60 * 1000     // 1 day
    };
  }

  setSocketServer(io) {
    this.socketServer = io;
    logger.info('Socket server attached to candle service');
  }

  /**
   * Process a new trade and update all relevant candles
   * @param {Object} trade - Trade object with pair, price, amount, timestamp
   */
  async processTrade(trade) {
    try {
      const { pair, price, amount, timestamp = new Date() } = trade;
      const quoteVolume = price * amount;

      console.log(`🕯️ CANDLE SERVICE - Processing trade for ${pair}:`, {
        price,
        amount,
        quoteVolume,
        timestamp
      });

      // Update candles for all timeframes
      for (const [timeframe, intervalMs] of Object.entries(this.timeframes)) {
        console.log(`🕯️ Creating/updating ${timeframe} candle for ${pair}`);
        await this.updateCandle(pair, timeframe, {
          price,
          volume: amount,
          quoteVolume,
          timestamp: new Date(timestamp)
        });
      }

      logger.debug(`Processed trade for ${pair}`, {
        price,
        amount,
        quoteVolume,
        timestamp
      });

    } catch (error) {
      console.error('❌ Error processing trade for candles:', error);
      logger.error('Error processing trade for candles', {
        error: error.message,
        trade
      });
    }
  }

  /**
   * Update a specific candle with new trade data
   */
  async updateCandle(pair, timeframe, tradeData) {
    try {
      const { price, volume, quoteVolume, timestamp } = tradeData;
      const intervalMs = this.timeframes[timeframe];
      
      // Calculate candle period boundaries
      const candleStart = this.getCandleStartTime(timestamp, intervalMs);
      const candleEnd = new Date(candleStart.getTime() + intervalMs);
      
      console.log(`🕯️ Updating ${timeframe} candle for ${pair}:`, {
        price,
        volume,
        candleStart: candleStart.toISOString(),
        candleEnd: candleEnd.toISOString()
      });
      
      const cacheKey = `${pair}_${timeframe}_${candleStart.getTime()}`;
      
      // Check if we have this candle in cache
      let candle = this.activeCandlesCache.get(cacheKey);
      
      if (!candle) {
        // Try to find existing candle in database
        candle = await Candlestick.findOne({
          pair,
          timeframe,
          openTime: candleStart,
          closed: false
        });
        
        if (!candle) {
          // Create new candle
          console.log(`🆕 Creating NEW ${timeframe} candle for ${pair} at ${candleStart.toISOString()}`);
          candle = new Candlestick({
            pair,
            timeframe,
            open: price,
            high: price,
            low: price,
            close: price,
            volume,
            quoteVolume,
            openTime: candleStart,
            closeTime: candleEnd,
            tradeCount: 1,
            closed: false
          });
        } else {
          console.log(`🔄 Found existing ${timeframe} candle for ${pair} in database`);
          // Cache existing candle
          this.activeCandlesCache.set(cacheKey, candle);
        }
      } else {
        console.log(`💾 Using cached ${timeframe} candle for ${pair}`);
      }
      
      // Update candle with new trade data
      if (candle) {
        const oldPrice = candle.close;
        candle.high = Math.max(candle.high, price);
        candle.low = Math.min(candle.low, price);
        candle.close = price; // Latest price becomes close
        candle.volume += volume;
        candle.quoteVolume += quoteVolume;
        candle.tradeCount += 1;
        
        console.log(`📊 Updated ${timeframe} candle for ${pair}:`, {
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          oldPrice,
          newPrice: price
        });
        
        // Save to database
        await candle.save();
        console.log(`💾 Saved ${timeframe} candle for ${pair} to database`);
        
        // Update cache
        this.activeCandlesCache.set(cacheKey, candle);
        
        // Broadcast candle update
        this.broadcastCandleUpdate(candle);
        
        // Check if candle should be closed
        if (timestamp >= candleEnd) {
          await this.closeCandle(candle, cacheKey);
        }
      }

    } catch (error) {
      console.error(`❌ Error updating ${timeframe} candle for ${pair}:`, error);
      logger.error('Error updating candle', {
        error: error.message,
        pair,
        timeframe,
        tradeData
      });
    }
  }

  /**
   * Close a completed candle
   */
  async closeCandle(candle, cacheKey) {
    try {
      candle.closed = true;
      await candle.save();
      
      // Remove from active cache
      this.activeCandlesCache.delete(cacheKey);
      
      // Broadcast final candle
      this.broadcastCandleUpdate(candle);
      
      logger.debug(`Closed candle for ${candle.pair} ${candle.timeframe}`, {
        openTime: candle.openTime,
        closeTime: candle.closeTime,
        ohlc: {
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close
        }
      });

    } catch (error) {
      logger.error('Error closing candle', {
        error: error.message,
        candleId: candle._id
      });
    }
  }

  /**
   * Get the start time for a candle period
   */
  getCandleStartTime(timestamp, intervalMs) {
    const time = new Date(timestamp);
    const minutes = time.getMinutes();
    const seconds = time.getSeconds();
    const milliseconds = time.getMilliseconds();
    
    // Round down to the nearest interval
    const intervalMinutes = intervalMs / (60 * 1000);
    
    if (intervalMinutes < 60) {
      // For sub-hour intervals, round down to nearest interval
      const roundedMinutes = Math.floor(minutes / intervalMinutes) * intervalMinutes;
      return new Date(time.getFullYear(), time.getMonth(), time.getDate(), 
                     time.getHours(), roundedMinutes, 0, 0);
    } else {
      // For hour+ intervals, round down to hour boundary then calculate
      const hours = time.getHours();
      const intervalHours = intervalMinutes / 60;
      const roundedHours = Math.floor(hours / intervalHours) * intervalHours;
      return new Date(time.getFullYear(), time.getMonth(), time.getDate(), 
                     roundedHours, 0, 0, 0);
    }
  }

  /**
   * Get historical candles for a pair and timeframe
   */
  async getHistoricalCandles(pair, timeframe, limit = 100, endTime = new Date()) {
    try {
      console.log(`🔍 CANDLE SERVICE - Searching for candles:`, {
        pair,
        timeframe,
        limit,
        endTime: endTime.toISOString()
      });
      
      const query = {
        pair,
        timeframe,
        closeTime: { $lte: endTime }
      };
      
      console.log(`📋 CANDLE SERVICE - MongoDB query:`, JSON.stringify(query, null, 2));
      
      const candles = await Candlestick.find(query)
        .sort({ openTime: -1 })
        .limit(limit);

      console.log(`📊 CANDLE SERVICE - Found ${candles.length} candles for ${pair} ${timeframe}`);
      
      if (candles.length > 0) {
        console.log(`🕒 CANDLE SERVICE - Sample candle:`, {
          pair: candles[0].pair,
          timeframe: candles[0].timeframe,
          openTime: candles[0].openTime,
          open: candles[0].open,
          high: candles[0].high,
          low: candles[0].low,
          close: candles[0].close
        });
      }

      return candles.reverse(); // Return in chronological order

    } catch (error) {
      logger.error('Error fetching historical candles', {
        error: error.message,
        pair,
        timeframe,
        limit
      });
      return [];
    }
  }

  /**
   * Get current active candle for a pair and timeframe
   */
  async getCurrentCandle(pair, timeframe) {
    try {
      const now = new Date();
      const intervalMs = this.timeframes[timeframe];
      const candleStart = this.getCandleStartTime(now, intervalMs);
      
      const candle = await Candlestick.findOne({
        pair,
        timeframe,
        openTime: candleStart,
        closed: false
      });

      return candle;

    } catch (error) {
      logger.error('Error fetching current candle', {
        error: error.message,
        pair,
        timeframe
      });
      return null;
    }
  }

  /**
   * Broadcast candle update to connected clients
   */
  broadcastCandleUpdate(candle) {
    if (!this.socketServer) {
      console.log('❌ No socket server available for candle broadcast');
      return;
    }

    try {
      // Comprehensive validation to prevent null values in broadcast
      if (!candle || !candle.pair || !candle.timeframe || !candle.openTime) {
        console.warn('❌ Invalid candle data, skipping broadcast:', candle);
        return;
      }

      // Validate all OHLC values are valid numbers
      const ohlcValues = [candle.open, candle.high, candle.low, candle.close];
      const hasInvalidOHLC = ohlcValues.some(value => 
        value === null || 
        value === undefined || 
        isNaN(value) || 
        !isFinite(value) ||
        value <= 0
      );

      if (hasInvalidOHLC) {
        console.warn('❌ Invalid OHLC values in candle, skipping broadcast:', {
          pair: candle.pair,
          timeframe: candle.timeframe,
          ohlc: ohlcValues,
          candleId: candle._id
        });
        return;
      }

      // Validate volume and ensure it's a positive number
      const volume = candle.volume || 0;
      if (isNaN(volume) || !isFinite(volume) || volume < 0) {
        console.warn('❌ Invalid volume in candle, using 0:', {
          pair: candle.pair,
          timeframe: candle.timeframe,
          volume: candle.volume
        });
        candle.volume = 0;
      }

      const candleData = {
        pair: candle.pair,
        timeframe: candle.timeframe,
        time: Math.floor(candle.openTime.getTime() / 1000),
        open: parseFloat(candle.open.toFixed(8)), // Ensure proper formatting
        high: parseFloat(candle.high.toFixed(8)),
        low: parseFloat(candle.low.toFixed(8)),
        close: parseFloat(candle.close.toFixed(8)),
        volume: parseFloat((candle.volume || 0).toFixed(8)),
        closed: Boolean(candle.closed),
        // Add debugging information for production clustering
        metadata: {
          instanceId: process.env.INSTANCE_ID || process.pid,
          port: process.env.PORT || 'unknown',
          timestamp: Date.now(),
          broadcastId: Math.random().toString(36).substr(2, 9)
        }
      };

      // Final validation before broadcast
      const finalValidation = [candleData.open, candleData.high, candleData.low, candleData.close];
      if (finalValidation.some(val => !isFinite(val) || isNaN(val))) {
        console.error('❌ Final validation failed, invalid data would be broadcast:', candleData);
        return;
      }

      // Enhanced logging for production debugging
      if (process.env.DEBUG_CANDLESTICKS === 'true') {
        console.log(`📡 [Instance ${candleData.metadata.instanceId}:${candleData.metadata.port}] Broadcasting candle update for ${candle.pair}:${candle.timeframe}:`, {
          ohlc: `${candleData.open}/${candleData.high}/${candleData.low}/${candleData.close}`,
          volume: candleData.volume,
          closed: candleData.closed,
          broadcastId: candleData.metadata.broadcastId,
          connectedClients: this.socketServer.engine?.clientsCount || 'unknown'
        });
      }

      // Broadcast to all clients subscribed to this pair/timeframe
      this.socketServer.emit(`candleUpdate:${candle.pair}:${candle.timeframe}`, candleData);
      
      // Also broadcast to general candle update channel
      this.socketServer.emit('candleUpdate', candleData);

      // Log successful broadcast for debugging
      if (process.env.DEBUG_CANDLESTICKS === 'true') {
        console.log(`✅ [Instance ${candleData.metadata.instanceId}] Broadcast sent for ${candle.pair}:${candle.timeframe}`);
      }

    } catch (error) {
      console.error('❌ Error broadcasting candle update:', error);
      logger.error('Error broadcasting candle update', {
        error: error.message,
        candleId: candle._id,
        instanceId: process.env.INSTANCE_ID || process.pid,
        port: process.env.PORT
      });
    }
  }

  /**
   * Initialize candle service with cleanup of old data
   */
  async initialize() {
    try {
      // Clean up very old candles (older than 30 days for 1m, scaled for other timeframes)
      const cleanupTasks = [];
      
      for (const [timeframe, intervalMs] of Object.entries(this.timeframes)) {
        const maxAge = this.getMaxAgeForTimeframe(timeframe);
        const cutoffDate = new Date(Date.now() - maxAge);
        
        cleanupTasks.push(
          Candlestick.deleteMany({
            timeframe,
            closeTime: { $lt: cutoffDate }
          })
        );
      }
      
      await Promise.all(cleanupTasks);
      
      logger.info('Candle service initialized and old data cleaned up');

    } catch (error) {
      logger.error('Error initializing candle service', {
        error: error.message
      });
    }
  }

  /**
   * Get maximum age for candles based on timeframe
   */
  getMaxAgeForTimeframe(timeframe) {
    const maxAges = {
      '1m': 7 * 24 * 60 * 60 * 1000,      // 7 days
      '5m': 30 * 24 * 60 * 60 * 1000,     // 30 days
      '15m': 60 * 24 * 60 * 60 * 1000,    // 60 days
      '1h': 180 * 24 * 60 * 60 * 1000,    // 180 days
      '4h': 365 * 24 * 60 * 60 * 1000,    // 1 year
      '1d': 3 * 365 * 24 * 60 * 60 * 1000 // 3 years
    };
    
    return maxAges[timeframe] || maxAges['1d'];
  }
}

module.exports = new CandleService();
