const express = require('express');
const axios = require('axios');
const SpecialToken = require('../models/specialToken');
const candleService = require('../services/candleService');
const router = express.Router();

// In-memory cache for candlestick data
const candleCache = new Map();
const CACHE_DURATION = {
  '1m':  60 * 1000,         // 1 minute
  '5m':  5  * 60 * 1000,    // 5 minutes
  '15m': 15 * 60 * 1000,    // 15 minutes
  '1h':  30 * 60 * 1000,    // 30 minutes
  '4h':  2  * 60 * 60 * 1000, // 2 hours
  '1d':  60 * 60 * 1000     // 1 hour
};

/**
 * Get historical candlestick data for crypto pairs
 * Supports multiple timeframes: 1m, 5m, 1h, 1d
 * Caches data to reduce API calls to Binance
 */
router.get('/klines/:pair', async (req, res) => {
  try {
    const { pair } = req.params;
    const { 
      interval = '1m', 
      limit = 500,
      startTime,
      endTime 
    } = req.query;

    // Validate interval
    const validIntervals = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'];
    if (!validIntervals.includes(interval)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid interval. Supported: 1m, 5m, 15m, 1h, 4h, 1d, 1w, 1M'
      });
    }

    // Check if this is a special token
    let baseCurrency;
    if (pair.includes('/')) {
      // Format: "DT/USDT"
      [baseCurrency] = pair.split('/');
    } else {
      // Format: "DTUSDT" - need to extract base currency
      // Try to match known patterns like USDT, USDC, BTC, ETH, BNB
      const quoteCurrencies = ['USDT', 'USDC', 'BTC', 'ETH', 'BNB', 'BUSD'];
      for (const quote of quoteCurrencies) {
        if (pair.endsWith(quote)) {
          baseCurrency = pair.replace(quote, '');
          break;
        }
      }
      // If no match found, assume it's the whole pair for special tokens
      if (!baseCurrency) baseCurrency = pair;
    }
    
    const specialToken = await SpecialToken.findOne({ 
      symbol: baseCurrency.toUpperCase(),
      isActive: true 
    });
    
    if (specialToken) {
      // Use real candle data for special tokens from trades
      try {
        const limitNum = Math.min(parseInt(limit), 1000);
        
        // Get historical candles from candle service
        // Convert pair format for database lookup - special tokens store as "BASE/QUOTE"
        const dbPair = baseCurrency + '/USDT'; // Assume USDT for now
        
        const historicalCandles = await candleService.getHistoricalCandles(
          dbPair, 
          interval, 
          limitNum
        );
        
        // If we have real candle data, use it
        if (historicalCandles && historicalCandles.length > 0) {
          const candleData = historicalCandles.map(candle => ({
            time: Math.floor(candle.openTime.getTime() / 1000),
            open: parseFloat(candle.open.toFixed(8)),
            high: parseFloat(candle.high.toFixed(8)),
            low: parseFloat(candle.low.toFixed(8)),
            close: parseFloat(candle.close.toFixed(8)),
            volume: parseFloat(candle.volume.toFixed(4))
          }));
          
          // Analyze candle freshness for special tokens
          const now = Math.floor(Date.now() / 1000);
          const lastCandle = candleData[candleData.length - 1];
          const isRecent = lastCandle && (now - lastCandle.time) < 300; // Within 5 minutes
          const hasActiveCandleData = isRecent && candleData.some(c => (now - c.time) < 3600); // Has data within last hour
          
          return res.json({
            success: true,
            data: candleData,
            pair,
            interval,
            count: candleData.length,
            cached: false,
            specialToken: true,
            dataSource: 'live_candles',
            metadata: {
              isRecent,
              hasActiveCandleData,
              lastCandleAge: lastCandle ? (now - lastCandle.time) : null,
              candleState: hasActiveCandleData ? 'active' : (isRecent ? 'mixed' : 'historical')
            }
          });
        }
        
        // Instead of synthetic data, use real BTC data and scale it to special token price
        try {
          const btcSymbol = 'BTCUSDT';
          const btcParams = {
            symbol: btcSymbol,
            interval,
            limit: Math.min(parseInt(limit), 1000)
          };

          const btcResponse = await axios.get('https://api.binance.com/api/v3/klines', {
            params: btcParams,
            timeout: 10000
          });

          if (btcResponse.data && btcResponse.data.length > 0) {
            const currentPrice = specialToken.currentPrice;
            const btcData = btcResponse.data;
            
            // Get BTC's current price to calculate scaling factor
            const btcCurrentPrice = parseFloat(btcData[btcData.length - 1][4]); // latest close price
            const scalingFactor = currentPrice / btcCurrentPrice;

            // Scale BTC data to special token price range with validation
            const candleData = btcData.map(candle => {
              // Validate raw BTC data
              if (!candle || !Array.isArray(candle) || candle.length < 6) {
                console.warn('⚠️ Invalid BTC candle data:', candle);
                return null;
              }

              const [timestamp, open, high, low, close, volume] = candle;
              
              // Validate numeric values
              if ([timestamp, open, high, low, close, volume].some(val => val === null || val === undefined || isNaN(val))) {
                console.warn('⚠️ BTC candle contains null/invalid values:', candle);
                return null;
              }

              const scaledOpen = parseFloat((parseFloat(open) * scalingFactor).toFixed(8));
              const scaledHigh = parseFloat((parseFloat(high) * scalingFactor).toFixed(8));
              const scaledLow = parseFloat((parseFloat(low) * scalingFactor).toFixed(8));
              const scaledClose = parseFloat((parseFloat(close) * scalingFactor).toFixed(8));
              const scaledVolume = parseFloat(volume);

              // Validate scaled values
              if ([scaledOpen, scaledHigh, scaledLow, scaledClose, scaledVolume].some(val => isNaN(val) || !isFinite(val))) {
                console.warn('⚠️ Scaled candle contains invalid values:', {
                  original: candle,
                  scaled: { scaledOpen, scaledHigh, scaledLow, scaledClose, scaledVolume },
                  scalingFactor
                });
                return null;
              }

              // Additional validation: high >= low, etc.
              if (scaledHigh < scaledLow) {
                console.warn('⚠️ Invalid candle: high < low after scaling:', {
                  scaledHigh, scaledLow, scalingFactor
                });
                return null;
              }

              return {
                time: Math.floor(timestamp / 1000),
                open: scaledOpen,
                high: scaledHigh,
                low: scaledLow,
                close: scaledClose,
                volume: scaledVolume
              };
            }).filter(candle => candle !== null); // Remove any null entries

            return res.json({
              success: true,
              data: candleData,
              pair,
              interval,
              count: candleData.length,
              cached: false,
              dataSource: 'scaled_btc'
            });
          }
        } catch (btcError) {
          // Error fetching BTC data for scaling
        }
        
        // Final fallback: Generate synthetic data if BTC fetch fails
        const currentPrice = specialToken.currentPrice;
        const priceRange = specialToken.priceRange;
        
        // Generate historical data based on interval
        const intervalMs = {
          '1m': 60 * 1000,
          '5m': 5 * 60 * 1000,
          '15m': 15 * 60 * 1000,
          '1h': 60 * 60 * 1000,
          '4h': 4 * 60 * 60 * 1000,
          '1d': 24 * 60 * 60 * 1000,
          '1w': 7 * 24 * 60 * 60 * 1000,
          '1M': 30 * 24 * 60 * 60 * 1000
        };
        
        const candleData = [];
        const now = Date.now();
        
        for (let i = limitNum - 1; i >= 0; i--) {
          const timestamp = now - (i * intervalMs[interval]);
          const basePrice = currentPrice + (Math.random() - 0.5) * (priceRange.max - priceRange.min) * 0.1;
          const volatility = 0.02; // 2% volatility
          
          const open = basePrice * (1 + (Math.random() - 0.5) * volatility);
          const high = open * (1 + Math.random() * volatility);
          const low = open * (1 - Math.random() * volatility);
          const close = open + (Math.random() - 0.5) * (high - low);
          const volume = Math.random() * 10000 + 1000; // Random volume
          
          candleData.push({
            time: Math.floor(timestamp / 1000),
            open: parseFloat(open.toFixed(8)),
            high: parseFloat(high.toFixed(8)),
            low: parseFloat(low.toFixed(8)),
            close: parseFloat(close.toFixed(8)),
            volume: parseFloat(volume.toFixed(4))
          });
        }
        
        return res.json({
          success: true,
          data: candleData,
          pair,
          interval,
          count: candleData.length,
          cached: false
        });
        
      } catch (error) {
        console.error('Error fetching special token candles:', error);
        // Fall through to synthetic generation
      }
    }

    // Convert pair format (BTC/USDT -> BTCUSDT)
    const binanceSymbol = pair.replace('/', '').toUpperCase();
    
    // Check cache first
    const cacheKey = `${binanceSymbol}_${interval}_${limit}`;
    const cached = candleCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < (CACHE_DURATION[interval] || 60000)) {
      return res.json({
        success: true,
        data: cached.data,
        pair,
        interval,
        count: cached.data.length,
        cached: true
      });
    }
    // Prepare Binance API parameters
    const params = {
      symbol: binanceSymbol,
      interval,
      limit: Math.min(parseInt(limit), 1000) // Binance max is 1000
    };

    if (startTime) params.startTime = parseInt(startTime);
    if (endTime) params.endTime = parseInt(endTime);

    // Fetch from Binance API
    const response = await axios.get('https://api.binance.com/api/v3/klines', {
      params,
      timeout: 10000 // 10 second timeout
    });

    // Format the data for lightweight-charts
    const formattedData = response.data.map(candle => ({
      time: Math.floor(candle[0] / 1000), // Convert ms to seconds
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5])
    }));

    // Cache the formatted data
    candleCache.set(cacheKey, {
      data: formattedData,
      timestamp: now
    });

    // Clean old cache entries (keep cache size manageable)
    if (candleCache.size > 100) {
      const oldestKey = candleCache.keys().next().value;
      candleCache.delete(oldestKey);
    }
    res.json({
      success: true,
      data: formattedData,
      pair,
      interval,
      count: formattedData.length,
      cached: false
    });

  } catch (error) {
    // Return appropriate error based on error type
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        success: false,
        error: 'Timeout fetching data from Binance API'
      });
    }
    
    if (error.response?.status === 400) {
      return res.status(400).json({
        success: false,
        error: 'Invalid symbol or parameters'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch candlestick data',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Get supported trading pairs and their intervals
 */
router.get('/pairs', async (req, res) => {
  try {
    // This could be expanded to fetch from Binance exchange info
    // For now, return common pairs
    const commonPairs = [
      'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT',
      'XRP/USDT', 'SOL/USDT', 'DOT/USDT', 'DOGE/USDT',
      'AVAX/USDT', 'LUNA/USDT', 'LINK/USDT', 'UNI/USDT'
    ];

    const supportedIntervals = [
      { label: '1m', value: '1m', name: '1 Minute' },
      { label: '5m', value: '5m', name: '5 Minutes' },
      { label: '15m', value: '15m', name: '15 Minutes' },
      { label: '1h', value: '1h', name: '1 Hour' },
      { label: '4h', value: '4h', name: '4 Hours' },
      { label: '1d', value: '1d', name: '1 Day' },
      { label: '1w', value: '1w', name: '1 Week' },
      { label: '1M', value: '1M', name: '1 Month' }
    ];

    res.json({
      success: true,
      pairs: commonPairs,
      intervals: supportedIntervals
    });

  } catch (error) {
    console.error('❌ Error fetching pairs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trading pairs'
    });
  }
});

/**
 * Clear cache for a specific pair/interval or all cache
 */
router.delete('/cache', (req, res) => {
  const { pair, interval } = req.query;
  
  if (pair && interval) {
    const binanceSymbol = pair.replace('/', '').toUpperCase();
    const cacheKey = `${binanceSymbol}_${interval}`;
    
    // Find and delete matching cache entries
    let deleted = 0;
    for (const key of candleCache.keys()) {
      if (key.startsWith(cacheKey)) {
        candleCache.delete(key);
        deleted++;
      }
    }
    
    res.json({
      success: true,
      message: `Cleared ${deleted} cache entries for ${pair} ${interval}`
    });
  } else {
    // Clear all cache
    const size = candleCache.size;
    candleCache.clear();
    
    res.json({
      success: true,
      message: `Cleared all cache (${size} entries)`
    });
  }
});

module.exports = router;
