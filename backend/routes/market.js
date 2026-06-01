const express = require('express');
const router = express.Router();
const MarketTicker = require('../models/marketTicker');
const OrderBook = require('../models/orderBook');
const Trade = require('../models/trade');
const Coin = require('../models/coin');
const SpecialToken = require('../models/specialToken');
const realTimeMarketData = require('../services/realTimeMarketData');
const cacheService = require('../utils/cacheService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('market-routes');

// Use development-friendly rate limiting
const { marketDataLimit } = require('../middlewares/devRateLimit');

// Cache configuration
const CACHE_CONFIG = {
  marketCoins: { ttl: 300 }, // 5 minutes
  marketTickers: { ttl: 30 }, // 30 seconds
  orderBook: { ttl: 15 }, // 15 seconds
  trades: { ttl: 60 }, // 1 minute
  allTokens: { ttl: 30 } // 30 seconds
};

// Get market coins (coins that should be displayed in market) including special tokens
router.get('/coins', marketDataLimit, async (req, res) => {
  try {
    const cacheKey = 'market:coins';
    
    // Try to get from cache first
    const cachedCoins = await cacheService.get(cacheKey);
    if (cachedCoins) {
      logger.debug('Market coins served from cache', {
        count: cachedCoins.length,
        timestamp: new Date().toISOString()
      });
      return res.json({
        success: true,
        data: cachedCoins,
        message: `Found ${cachedCoins.length} coins for market display`,
        cached: true
      });
    }

    const marketCoins = await Coin.getMarketCoins();
    
    // Cache the result
    await cacheService.set(cacheKey, marketCoins, CACHE_CONFIG.marketCoins);
    
    logger.info('Market coins fetched and cached', {
      count: marketCoins.length,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      data: marketCoins,
      message: `Found ${marketCoins.length} coins for market display`,
      cached: false
    });
  } catch (error) {
    logger.error('Error getting market coins', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    console.error('Error getting market coins:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get market coins'
    });
  }
});

// Get all market data including special tokens
router.get('/all-tokens', marketDataLimit, async (req, res) => {
  try {
    const cacheKey = 'market:all-tokens';
    
    // Try to get from cache first
    const cachedTokens = await cacheService.get(cacheKey);
    if (cachedTokens) {
      logger.debug('All tokens served from cache', {
        count: cachedTokens.length,
        timestamp: new Date().toISOString()
      });
      return res.json({
        success: true,
        data: cachedTokens,
        message: `Found ${cachedTokens.length} tokens for trading`,
        cached: true
      });
    }

    // Get regular market coins
    const marketCoins = await Coin.getMarketCoins();
    
    // Get special tokens
    const specialTokens = await SpecialToken.getMarketTokens();
    
    // Transform special tokens to match regular coin format
    const transformedSpecialTokens = specialTokens.map(token => ({
      _id: token._id,
      symbol: token.symbol,
      name: token.name,
      priceUSD: token.currentPrice,
      logoUrl: token.logoUrl,
      isSpecial: true,
      tradingControls: token.tradingControls, // Include trading controls
      specialTokenData: {
        badge: token.badge,
        description: token.description,
        tooltip: token.tooltip,
        priceChangePercent: token.priceChangePercent,
        priceStats24h: token.priceStats24h,
        lastUpdate: token.lastSimulationUpdate
      },
      // Add trading pair format for compatibility
      tradingPairs: [{
        quoteAsset: 'USDT',
        isActive: true
      }],
      status: 'active',
      isTradingEnabled: true, // Special tokens are tradeable
      showInMarket: token.showInMarket,
      marketPriority: token.marketPriority
    }));
    
    // Combine regular coins and special tokens
    const allTokens = [...marketCoins, ...transformedSpecialTokens];
    
    // Sort by market priority and name
    allTokens.sort((a, b) => {
      if (a.marketPriority !== b.marketPriority) {
        return b.marketPriority - a.marketPriority;
      }
      return a.name.localeCompare(b.name);
    });

    // Cache the result
    await cacheService.set(cacheKey, allTokens, CACHE_CONFIG.allTokens);
    
    logger.info('All tokens fetched and cached', {
      totalCount: allTokens.length,
      regularCoins: marketCoins.length,
      specialTokens: specialTokens.length,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      data: allTokens,
      message: `Found ${allTokens.length} tokens for market display (${marketCoins.length} regular, ${specialTokens.length} special)`,
      cached: false
    });
  } catch (error) {
    logger.error('Error getting all market tokens', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    console.error('Error getting all market tokens:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get market tokens'
    });
  }
});

// Get market tickers for all trading pairs including special tokens
router.get('/tickers', marketDataLimit, async (req, res) => {
  try {
    const cacheKey = 'market:tickers';
    
    // Try to get from cache first
    const cachedTickers = await cacheService.get(cacheKey);
    if (cachedTickers) {
      logger.debug('Market tickers served from cache', {
        count: cachedTickers.length,
        timestamp: new Date().toISOString()
      });
      return res.json({
        success: true,
        data: cachedTickers,
        cached: true
      });
    }

    // Get all coins that are visible, trading enabled, and should show in market
    const coins = await Coin.find({ 
      isVisible: true, 
      isTradingEnabled: true,
      $or: [
        { showInMarket: true },
        { showInMarket: { $exists: false } } // For backwards compatibility with coins that don't have this field
      ]
    }).lean();
    const allowedSymbols = new Set(coins.map(c => c.symbol));
    // Ensure USDT is always included as it's our base quote currency
    allowedSymbols.add('USDT');

    // Get all tickers
    const tickers = await MarketTicker.find({}).lean();
    // Only include tickers where both base and quote are allowed
    const filteredTickers = tickers.filter(ticker => {
      const [base, quote] = ticker.pair.split('/');
      return allowedSymbols.has(base) && allowedSymbols.has(quote);
    });

    // Create synthetic tickers for coins that don't have market tickers yet
    const existingTickerPairs = new Set(filteredTickers.map(t => t.pair));
    const syntheticTickers = [];
    
    coins.forEach(coin => {
      // Check if coin has trading pairs configured
      if (coin.tradingPairs && coin.tradingPairs.length > 0) {
        coin.tradingPairs.forEach(tradingPair => {
          if (tradingPair.isActive) {
            const pairSymbol = `${coin.symbol}/${tradingPair.quoteAsset}`;
            
            // Only create synthetic ticker if it doesn't exist
            if (!existingTickerPairs.has(pairSymbol) && allowedSymbols.has(tradingPair.quoteAsset)) {
              syntheticTickers.push({
                _id: `synthetic_${coin._id}_${tradingPair.quoteAsset}`,
                pair: pairSymbol,
                lastPrice: coin.priceUSD || 1.0,
                openPrice: coin.priceUSD || 1.0,
                highPrice: (coin.priceUSD || 1.0) * 1.02,
                lowPrice: (coin.priceUSD || 1.0) * 0.98,
                volume24h: 0,
                change24h: 0,
                updatedAt: new Date(),
                isSynthetic: true
              });
            }
          }
        });
      } else {
        // If no trading pairs configured, create a default USDT pair
        const defaultPair = `${coin.symbol}/USDT`;
        if (!existingTickerPairs.has(defaultPair) && allowedSymbols.has('USDT')) {
          syntheticTickers.push({
            _id: `synthetic_${coin._id}_USDT`,
            pair: defaultPair,
            lastPrice: coin.priceUSD || 1.0,
            openPrice: coin.priceUSD || 1.0,
            highPrice: (coin.priceUSD || 1.0) * 1.02,
            lowPrice: (coin.priceUSD || 1.0) * 0.98,
            volume24h: 0,
            change24h: 0,
            updatedAt: new Date(),
            isSynthetic: true
          });
        }
      }
    });

    // Combine real and synthetic tickers
    const combinedTickers = [...filteredTickers, ...syntheticTickers];

    // Transform regular tickers to include additional calculated fields
    const transformedTickers = combinedTickers.map(ticker => ({
      ...ticker,
      priceChange: ticker.lastPrice - ticker.openPrice,
      priceChangePercent: ticker.openPrice > 0 ? 
        ((ticker.lastPrice - ticker.openPrice) / ticker.openPrice) * 100 : 0,
      isSpecial: false
    }));

    // Get special tokens and create ticker-like objects
    const specialTokens = await SpecialToken.find({ isActive: true, showInMarket: true });
    const specialTickers = specialTokens.map(token => {
      const priceStats = token.priceStats24h;
      const priceChangePercent = token.priceChangePercent;
      
      return {
        _id: token._id,
        pair: `${token.symbol}/USDT`,
        lastPrice: token.currentPrice,
        openPrice: token.priceHistory.length > 0 ? 
          token.priceHistory[0].price : token.currentPrice,
        highPrice: priceStats.high,
        lowPrice: priceStats.low,
        volume24h: priceStats.volume,
        priceChange: token.currentPrice * (priceChangePercent / 100),
        priceChangePercent: priceChangePercent,
        updatedAt: token.lastSimulationUpdate,
        isSpecial: true,
        specialTokenData: {
          badge: token.badge,
          description: token.description,
          tooltip: token.tooltip,
          symbol: token.symbol,
          name: token.name,
          logoUrl: token.logoUrl
        }
      };
    });

    // Combine regular and special tickers
    const allTickers = [...transformedTickers, ...specialTickers];

    // Cache the result
    await cacheService.set(cacheKey, allTickers, CACHE_CONFIG.marketTickers);
    
    logger.info('Market tickers fetched and cached', {
      totalCount: allTickers.length,
      regularTickers: transformedTickers.length,
      specialTickers: specialTickers.length,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: allTickers,
      cached: false
    });

  } catch (error) {
    logger.error('Error fetching market tickers', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    console.error('❌ Error fetching market tickers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market tickers'
    });
  }
});

// Get ticker for specific trading pair
router.get('/ticker/:pair', async (req, res) => {
  try {
    const { pair } = req.params;
    
    // First check if it's a special token
    const [baseSymbol] = pair.split('/');
    const specialToken = await SpecialToken.findOne({ 
      symbol: baseSymbol.toUpperCase(), 
      isActive: true 
    });
    
    if (specialToken) {
      const priceStats = specialToken.priceStats24h;
      const priceChangePercent = specialToken.priceChangePercent;
      
      const specialTicker = {
        _id: specialToken._id,
        pair: pair,
        lastPrice: specialToken.currentPrice,
        openPrice: specialToken.priceHistory.length > 0 ? 
          specialToken.priceHistory[0].price : specialToken.currentPrice,
        highPrice: priceStats.high,
        lowPrice: priceStats.low,
        volume24h: priceStats.volume,
        priceChange: specialToken.currentPrice * (priceChangePercent / 100),
        priceChangePercent: priceChangePercent,
        updatedAt: specialToken.lastSimulationUpdate,
        isSpecial: true,
        specialTokenData: {
          badge: specialToken.badge,
          description: specialToken.description,
          tooltip: specialToken.tooltip,
          symbol: specialToken.symbol,
          name: specialToken.name,
          logoUrl: specialToken.logoUrl
        }
      };
      
      return res.json({
        success: true,
        data: specialTicker
      });
    }
    
    // If not a special token, check regular tickers
    const ticker = await MarketTicker.findOne({ pair }).lean();
    
    if (!ticker) {
      return res.status(404).json({
        success: false,
        error: 'Trading pair not found'
      });
    }

    const transformedTicker = {
      ...ticker,
      priceChange: ticker.lastPrice - ticker.openPrice,
      priceChangePercent: ticker.openPrice > 0 ? 
        ((ticker.lastPrice - ticker.openPrice) / ticker.openPrice) * 100 : 0,
      isSpecial: false
    };

    res.json({
      success: true,
      data: transformedTicker
    });

  } catch (error) {
    console.error('Error fetching ticker:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ticker'
    });
  }
});

// Get special token data by symbol
router.get('/special-token/:symbol', marketDataLimit, async (req, res) => {
  try {
    const { symbol } = req.params;
    
    const specialToken = await SpecialToken.findOne({ 
      symbol: symbol.toUpperCase(), 
      isActive: true,
      showInMarket: true
    });
    
    if (!specialToken) {
      return res.status(404).json({
        success: false,
        error: 'Special token not found'
      });
    }
    
    const priceStats = specialToken.priceStats24h;
    
    res.json({
      success: true,
      data: {
        _id: specialToken._id,
        symbol: specialToken.symbol,
        name: specialToken.name,
        currentPrice: specialToken.currentPrice,
        priceRange: specialToken.priceRange,
        logoUrl: specialToken.logoUrl,
        badge: specialToken.badge,
        description: specialToken.description,
        tooltip: specialToken.tooltip,
        priceChangePercent: specialToken.priceChangePercent,
        priceStats24h: priceStats,
        lastUpdate: specialToken.lastSimulationUpdate,
        simulationConfig: {
          type: specialToken.simulationConfig.type,
          interval: specialToken.simulationConfig.interval
        },
        recentPriceHistory: specialToken.priceHistory.slice(-24), // Last 24 updates
        isSpecial: true
      }
    });
    
  } catch (error) {
    console.error('Error fetching special token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch special token'
    });
  }
});

// Get all special tokens for market display
router.get('/special-tokens', marketDataLimit, async (req, res) => {
  try {
    const specialTokens = await SpecialToken.getMarketTokens();
    
    const transformedTokens = specialTokens.map(token => {
      const priceStats = token.priceStats24h;
      
      return {
        _id: token._id,
        symbol: token.symbol,
        name: token.name,
        currentPrice: token.currentPrice,
        logoUrl: token.logoUrl,
        badge: token.badge,
        description: token.description,
        tooltip: token.tooltip,
        priceChangePercent: token.priceChangePercent,
        priceStats24h: priceStats,
        lastUpdate: token.lastSimulationUpdate,
        pair: `${token.symbol}/USDT`,
        isSpecial: true,
        // Include trading controls in proper structure
        tradingControls: {
          buyEnabled: token.tradingControls.buyEnabled,
          sellEnabled: token.tradingControls.sellEnabled,
          sellPriceAdjustment: token.tradingControls.sellPriceAdjustment
        }
      };
    });
    
    res.json({
      success: true,
      data: transformedTokens,
      message: `Found ${transformedTokens.length} special tokens`
    });
    
  } catch (error) {
    console.error('Error fetching special tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch special tokens'
    });
  }
});

// Get order book for a trading pair
router.get('/orderbook/:pair', marketDataLimit, async (req, res) => {
  try {
    const { pair } = req.params;
    const { limit = 20 } = req.query;
    
    // Check if this is a special token
    const [baseCurrency] = pair.split('/');
    const specialToken = await SpecialToken.findOne({ 
      symbol: baseCurrency.toUpperCase(),
      isActive: true 
    });
    
    if (specialToken) {
      // Generate synthetic orderbook for special tokens
      const limitNum = Math.min(parseInt(limit), 100);
      const currentPrice = specialToken.currentPrice;
      const spread = currentPrice * 0.001; // 0.1% spread
      
      const bids = [];
      const asks = [];
      
      // Generate bids (buy orders) below current price
      for (let i = 0; i < limitNum; i++) {
        const price = currentPrice - spread - (i * spread * 0.1);
        const volume = Math.random() * 1000 + 100; // Random volume between 100-1100
        bids.push([price.toFixed(8), volume.toFixed(4)]);
      }
      
      // Generate asks (sell orders) above current price
      for (let i = 0; i < limitNum; i++) {
        const price = currentPrice + spread + (i * spread * 0.1);
        const volume = Math.random() * 1000 + 100;
        asks.push([price.toFixed(8), volume.toFixed(4)]);
      }
      
      return res.json({
        success: true,
        data: {
          pair,
          bids,
          asks,
          timestamp: Date.now(),
          isSpecialToken: true
        }
      });
    }
    
    // Get real-time order book data from realTimeMarketData service for regular pairs
    const orderBook = realTimeMarketData.getOrderBook(pair);
    
    if (orderBook && (orderBook.bids.length > 0 || orderBook.asks.length > 0)) {
      const limitNum = Math.min(parseInt(limit), 100);
      
      res.json({
        success: true,
        data: {
          pair,
          bids: orderBook.bids.slice(0, limitNum),
          asks: orderBook.asks.slice(0, limitNum),
          timestamp: orderBook.timestamp
        }
      });
    } else {
      // No real-time order book data available
      return res.status(404).json({
        success: false,
        error: 'Order book not available - real-time order book data not implemented yet'
      });
    }

  } catch (error) {
    console.error('Error fetching order book:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order book'
    });
  }
});

// Get recent trades for a trading pair
router.get('/trades/:pair', async (req, res) => {
  try {
    const { pair } = req.params;
    const { limit = 50 } = req.query;
    
    const trades = await Trade.find({ 
      pair,
      status: 'completed'
    })
    .sort({ executedAt: -1 })
    .limit(Math.min(parseInt(limit), 500))
    .select('tradeId price amount side executedAt')
    .lean();

    res.json({
      success: true,
      data: trades
    });

  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trades'
    });
  }
});

// Get market summary/stats
router.get('/stats', async (req, res) => {
  try {
    // Get total number of trading pairs
    const totalPairs = await MarketTicker.countDocuments({});
    
    // Get 24h volume across all pairs
    const volumeData = await MarketTicker.aggregate([
      {
        $group: {
          _id: null,
          totalVolume: { $sum: '$volume24h' },
          avgChange: { $avg: '$change24h' }
        }
      }
    ]);

    // Get top gainers and losers
    const topGainers = await MarketTicker.find({})
      .sort({ change24h: -1 })
      .limit(5)
      .lean();

    const topLosers = await MarketTicker.find({})
      .sort({ change24h: 1 })
      .limit(5)
      .lean();

    // Get most active pairs by volume
    const mostActive = await MarketTicker.find({})
      .sort({ volume24h: -1 })
      .limit(5)
      .lean();

    res.json({
      success: true,
      data: {
        totalPairs,
        totalVolume24h: volumeData[0]?.totalVolume || 0,
        averageChange24h: volumeData[0]?.avgChange || 0,
        topGainers,
        topLosers,
        mostActive
      }
    });

  } catch (error) {
    console.error('Error fetching market stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market statistics'
    });
  }
});

// Get OHLCV (candlestick) data for a trading pair
router.get('/klines/:pair', marketDataLimit, async (req, res) => {
  try {
    const { pair } = req.params;
    const { interval = '1m', limit = 100 } = req.query;
    
    // Check if Binance is blocked
    if (process.env.BINANCE_BLOCKED === 'true') {
      // Generate synthetic candlestick data based on current price
      const currentPrice = realTimeMarketData.getCurrentPrice(pair);
      if (!currentPrice) {
        return res.status(404).json({
          success: false,
          error: 'No price data available for this pair'
        });
      }
      
      const syntheticData = realTimeMarketData.generateHistoricalCandles(
        pair, 
        currentPrice, 
        parseInt(limit), 
        interval
      );
      
      res.json({
        success: true,
        data: {
          pair,
          interval,
          klines: syntheticData,
          synthetic: true,
          message: 'Using synthetic data due to exchange restrictions'
        }
      });
      return;
    }
    
    // Convert pair format (BTC/USDT -> BTCUSDT for Binance)
    const binancePair = pair.replace('/', '').toUpperCase();
    
    // Map frontend intervals to Binance API intervals
    const intervalMapping = {
      '1s': '1s',
      '1m': '1m',
      '5m': '5m',
      '1h': '1h',
      '1d': '1d'
    };
    
    const binanceInterval = intervalMapping[interval] || '1m';
    
    // Fetch real candlestick data from Binance
    const axios = require('axios');
    const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${binancePair}&interval=${binanceInterval}&limit=${limit}`;
    

    try {
      const response = await axios.get(binanceUrl);
      const klines = response.data;
      
      if (!klines || klines.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No candlestick data available for this pair'
        });
      }
      
      // Transform Binance data format to our format
      const transformedData = klines.map(kline => ({
        time: Math.floor(kline[0] / 1000), // Convert milliseconds to seconds
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5]),
        timestamp: kline[0]
      }));
      
      res.json({
        success: true,
        data: {
          pair,
          interval,
          klines: transformedData
        }
      });
      
    } catch (binanceError) {
      if (binanceError.response?.status === 451) {
        console.error('🚫 Binance 451 Error detected in klines endpoint');
        console.error('💡 Recommendation: Set BINANCE_BLOCKED=true in environment variables');
      }
      
      console.error('Error fetching from Binance:', binanceError.message);
      
      // Fallback to synthetic data when Binance fails
      const currentPrice = realTimeMarketData.getCurrentPrice(pair);
      if (currentPrice) {
        const syntheticData = realTimeMarketData.generateHistoricalCandles(
          pair, 
          currentPrice, 
          parseInt(limit), 
          interval
        );
        
        res.json({
          success: true,
          data: {
            pair,
            interval,
            klines: syntheticData,
            synthetic: true,
            message: 'Using synthetic data due to exchange API failure'
          }
        });
      } else {
        return res.status(503).json({
          success: false,
          error: 'Unable to fetch candlestick data from exchange and no fallback data available'
        });
      }
    }

  } catch (error) {
    console.error('Error fetching klines:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch klines data'
    });
  }
});

// Get market depth (order book with aggregated levels)
router.get('/depth/:pair', async (req, res) => {
  try {
    const { pair } = req.params;
    const { limit = 20 } = req.query;
    
    const orderBook = await OrderBook.findOne({ pair }).lean();
    
    if (!orderBook) {
      return res.status(404).json({
        success: false,
        error: 'Order book not found'
      });
    }

    const limitNum = Math.min(parseInt(limit), 100);
    
    // Calculate cumulative quantities for market depth
    let cumulativeBidQty = 0;
    let cumulativeAskQty = 0;
    
    const bids = orderBook.bids.slice(0, limitNum).map(bid => {
      cumulativeBidQty += bid.amount;
      return [bid.price, bid.amount, cumulativeBidQty];
    });

    const asks = orderBook.asks.slice(0, limitNum).map(ask => {
      cumulativeAskQty += ask.amount;
      return [ask.price, ask.amount, cumulativeAskQty];
    });

    res.json({
      success: true,
      data: {
        pair,
        bids,
        asks,
        lastUpdateId: Date.now()
      }
    });

  } catch (error) {
    console.error('Error fetching market depth:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market depth'
    });
  }
});

// Get real-time prices for all pairs
router.get('/prices', async (req, res) => {
  try {
    // Get real-time prices from real-time market data service
    const realtimePrices = realTimeMarketData.getAllPrices();
    
    if (Object.keys(realtimePrices).length > 0) {
      res.json({
        success: true,
        data: realtimePrices,
        source: 'realtime',
        timestamp: Date.now()
      });
      return;
    }
    
    // No real-time data available
    return res.status(503).json({
      success: false,
      error: 'Real-time prices not available',
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error fetching prices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prices'
    });
  }
});

// Get real-time price for specific pair
router.get('/price/:pair', async (req, res) => {
  try {
    const { pair } = req.params;
    
    // Get real-time price from real-time market data service
    const realtimePrice = realTimeMarketData.getCurrentPrice(pair);
    
    if (realtimePrice) {
      res.json({
        success: true,
        data: {
          pair,
          price: realtimePrice,
          source: 'realtime',
          timestamp: Date.now()
        }
      });
      return;
    }
    
    // No real-time data available
    return res.status(404).json({
      success: false,
      error: 'Real-time price not available for this pair'
    });

  } catch (error) {
    console.error('Error fetching price:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch price'
    });
  }
});

// Get available trading pairs (visible and trading-enabled tokens only)
router.get('/pairs', marketDataLimit, async (req, res) => {
  try {
    // Get all coins that are visible, trading enabled, and should show in market
    const coins = await Coin.find({ 
      isVisible: true, 
      isTradingEnabled: true,
      status: 'active',
      $or: [
        { showInMarket: true },
        { showInMarket: { $exists: false } } // For backwards compatibility with coins that don't have this field
      ]
    }).lean();

    // Extract available trading pairs from the coins
    const availablePairs = [];
    
    coins.forEach(coin => {
      if (coin.tradingPairs && coin.tradingPairs.length > 0) {
        coin.tradingPairs.forEach(tradingPair => {
          if (tradingPair.isActive) {
            const pairSymbol = `${coin.symbol}/${tradingPair.quoteAsset}`;
            availablePairs.push({
              symbol: pairSymbol,
              baseAsset: coin.symbol,
              quoteAsset: tradingPair.quoteAsset,
              baseName: coin.name,
              baseLogoUrl: coin.logoUrl,
              minOrderSize: tradingPair.minOrderSize,
              maxOrderSize: tradingPair.maxOrderSize,
              priceDecimals: tradingPair.priceDecimals,
              quantityDecimals: tradingPair.quantityDecimals
            });
          }
        });
      }
    });

    res.json({
      success: true,
      data: availablePairs
    });

  } catch (error) {
    console.error('Error fetching trading pairs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trading pairs'
    });
  }
});

// Get candlestick data for a trading pair
router.get('/chart/:pair', marketDataLimit, async (req, res) => {
  try {
    const { pair } = req.params;
    const { timeframe = '1h', limit = 100 } = req.query;

    // Validate timeframe
    const validTimeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({
        success: false,
        error: `Invalid timeframe. Valid options: ${validTimeframes.join(', ')}`
      });
    }

    // Get candlestick data from real-time market data service
    const candlesticks = [];
    const currentCandle = null;

    // If no data and we have price history, try to generate historical candles
    if (candlesticks.length === 0) {
      try {
        const PriceHistory = require('../models/priceHistory');
        const Coin = require('../models/coin');
        
        // Find the coin for this pair
        const [baseCoin] = pair.split('/');
        const coin = await Coin.findOne({ symbol: baseCoin });
        
        if (coin) {
          // Get price history for the last 30 days
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const priceHistory = await PriceHistory.find({
            coin: coin._id,
            timestamp: { $gte: thirtyDaysAgo }
          }).sort({ timestamp: 1 }).lean();

          if (priceHistory.length > 0) {
            // Generate historical candles
            const historicalCandles = realTimeMarketData.generateHistoricalCandles(
              pair, 
              priceHistory, 
              timeframe
            );
            
            return res.json({
              success: true,
              data: {
                pair,
                timeframe,
                candles: historicalCandles.slice(-limit),
                currentCandle,
                isHistorical: true
              }
            });
          }
        }
      } catch (historyError) {
        console.error('Error generating historical candles:', historyError);
      }
    }

    res.json({
      success: true,
      data: {
        pair,
        timeframe,
        candles: candlesticks,
        currentCandle,
        isHistorical: false
      }
    });

  } catch (error) {
    console.error('Error fetching chart data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chart data'
    });
  }
});

// Get available chart data
router.get('/chart/info', marketDataLimit, async (req, res) => {
  try {
    const availablePairs = realTimeMarketData.getAvailablePairs();
    const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
    
    const pairInfo = {};
    availablePairs.forEach(pair => {
      pairInfo[pair] = {
        availableTimeframes: realTimeMarketData.getAvailableTimeframes(pair),
        lastUpdate: realTimeMarketData.getLastUpdateTime(pair)
      };
    });

    res.json({
      success: true,
      data: {
        availablePairs,
        timeframes,
        pairInfo
      }
    });

  } catch (error) {
    console.error('Error fetching chart info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chart info'
    });
  }
});

module.exports = router;
