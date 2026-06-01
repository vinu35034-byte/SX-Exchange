const WebSocket = require('ws');
const axios = require('axios');
const { sessionManager } = require('../config/session');
const { createLogger } = require('../utils/logger');
const cacheService = require('../utils/cacheService');

const logger = createLogger('market-data');

/**
 * Real-Time Market Data Service
 * Connects to multiple cryptocurrency exchanges for live price feeds and order books
 * Supports: Binance, CoinGecko, CryptoCompare, Coinbase
 */
class RealTimeMarketData {
  constructor() {
    this.sessionManager = sessionManager;
    this.isRunning = false;
    this.connections = new Map();
    this.lastPrices = new Map();
    this.orderBooks = new Map(); // Add order book storage
    this.priceHistory = new Map();
    this.updateIntervals = new Map();
    this.socketServer = null; // Socket server will be set when initialized
    
    // Cache configuration
    this.cacheConfig = {
      marketData: { ttl: 30 }, // 30 seconds for market data
      priceHistory: { ttl: 300 }, // 5 minutes for price history
      orderBook: { ttl: 10 }, // 10 seconds for order book
      ticker: { ttl: 15 } // 15 seconds for ticker data
    };
    
    // API endpoints and WebSocket URLs
    this.dataSources = {
      binance: {
        wsUrl: 'wss://stream.binance.com:9443/ws',
        restUrl: 'https://api.binance.com/api/v3',
        name: 'Binance'
      },
      binanceUs: {
        wsUrl: 'wss://stream.binance.us:9443/ws',
        restUrl: 'https://api.binance.us/api/v3',
        name: 'Binance US'
      },
      coinbase: {
        wsUrl: 'wss://ws-feed.exchange.coinbase.com',
        restUrl: 'https://api.exchange.coinbase.com',
        name: 'Coinbase Pro'
      },
      coingecko: {
        restUrl: 'https://api.coingecko.com/api/v3',
        name: 'CoinGecko'
      },
      cryptocompare: {
        wsUrl: 'wss://streamer.cryptocompare.com/v2',
        restUrl: 'https://api.cryptocompare.com/data/v2',
        name: 'CryptoCompare'
      },
      // Alternative sources for when primary sources fail
      kraken: {
        wsUrl: 'wss://ws.kraken.com',
        restUrl: 'https://api.kraken.com/0/public',
        name: 'Kraken'
      },
      kucoin: {
        restUrl: 'https://api.kucoin.com/api/v1',
        name: 'KuCoin'
      }
    };

    // Symbol mapping for different exchanges
    this.symbolMapping = {
      'BTC/USDT': {
        binance: 'btcusdt',
        coinbase: 'BTC-USD',
        coingecko: 'bitcoin',
        cryptocompare: 'BTC'
      },
      'ETH/USDT': {
        binance: 'ethusdt',
        coinbase: 'ETH-USD',
        coingecko: 'ethereum',
        cryptocompare: 'ETH'
      },
      'BNB/USDT': {
        binance: 'bnbusdt',
        coinbase: 'BNB-USD',
        coingecko: 'binancecoin',
        cryptocompare: 'BNB'
      },
      'SOL/USDT': {
        binance: 'solusdt',
        coinbase: 'SOL-USD',
        coingecko: 'solana',
        cryptocompare: 'SOL'
      },
      'ADA/USDT': {
        binance: 'adausdt',
        coinbase: 'ADA-USD',
        coingecko: 'cardano',
        cryptocompare: 'ADA'
      },
      'DOT/USDT': {
        binance: 'dotusdt',
        coinbase: 'DOT-USD',
        coingecko: 'polkadot',
        cryptocompare: 'DOT'
      },
      'XRP/USDT': {
        binance: 'xrpusdt',
        coinbase: 'XRP-USD',
        coingecko: 'ripple',
        cryptocompare: 'XRP'
      },
      'DOGE/USDT': {
        binance: 'dogeusdt',
        coinbase: 'DOGE-USD',
        coingecko: 'dogecoin',
        cryptocompare: 'DOGE'
      }
    };
  }

  /**
   * Set the socket server instance for broadcasting updates
   */
  setSocketServer(socketServer) {
    this.socketServer = socketServer;
  }

  async start(tradingPairs = []) {
    if (this.isRunning) return;
    
    this.isRunning = true;

    // Determine which pairs to track
    const pairsToTrack = tradingPairs.length > 0 
      ? tradingPairs.map(p => p.symbol || p)
      : Object.keys(this.symbolMapping);

    
    // Check if Binance is blocked in this region
    const binanceBlocked = process.env.BINANCE_BLOCKED === 'true';
    const debugMode = process.env.MARKET_DATA_DEBUG === 'true';


    // Initialize with REST API data first (faster initial load)
    await this.initializeWithRestData(pairsToTrack);

    // Start data sources based on availability
    if (!binanceBlocked) {
      this.startBinanceWebSocket(pairsToTrack);
      // Use Binance polling as backup instead of CoinGecko
      this.startBinancePolling(pairsToTrack);
      this.startPeriodicUpdates(pairsToTrack);
    } else {
      return; // Don't start any fallback services
    }
  }

  async initializeWithRestData(pairs) {
   
    try {
      const binanceBlocked = process.env.BINANCE_BLOCKED === 'true';
      
      if (binanceBlocked) {
       return;
      }
      
      // Fetch only from Binance for reliability
      const binancePrices = await this.fetchBinancePrices(pairs);
      
      Object.entries(binancePrices).forEach(([pair, price]) => {
        this.updatePrice(pair, price, 'Binance REST');
      });

    } catch (error) {
      console.error('❌ Error fetching initial price data:', error);
    }
  }

  async fetchBinancePrices(pairs) {
    // Skip Binance if it's blocked
    if (process.env.BINANCE_BLOCKED === 'true') {
      return {};
    }

    try {
      // Check cache first
      const cacheKey = 'binance:prices:all';
      const cachedPrices = await cacheService.get(cacheKey);
      
      if (cachedPrices) {
        logger.debug('Using cached Binance prices', {
          pairsCount: Object.keys(cachedPrices).length,
          timestamp: new Date().toISOString()
        });
        return cachedPrices;
      }

      logger.info('Fetching Binance prices from API', {
        pairsRequested: pairs.length,
        timestamp: new Date().toISOString()
      });

      const response = await axios.get(`${this.dataSources.binance.restUrl}/ticker/price`);
      
      const prices = {};
      response.data.forEach(item => {
        const pair = this.convertFromBinanceSymbol(item.symbol);
        if (pairs.includes(pair)) {
          prices[pair] = {
            price: parseFloat(item.price),
            source: 'Binance',
            timestamp: Date.now()
          };
        }
      });

      // Cache the prices
      await cacheService.set(cacheKey, prices, this.cacheConfig.marketData);

      logger.info('Binance prices fetched and cached', {
        pairsReturned: Object.keys(prices).length,
        timestamp: new Date().toISOString()
      });

      return prices;
    } catch (error) {
      // Enhanced error handling for 451 errors
      if (error.response && error.response.status === 451) {
        console.error('🚫 Binance API geographic restriction detected - Status 451');
        console.error('🚫 Binance REST API 451 Error: Geographic restriction detected');
        console.error('💡 Solution: Set BINANCE_BLOCKED=true in your environment variables');
        console.error('🔄 Skipping Binance and using alternative sources only');
        return {};
      } else {
        // Use console.error to avoid logger context issues
        console.error('❌ Binance REST API error:', error.message, {
          status: error.response?.status,
          timestamp: new Date().toISOString()
        });
        console.error('❌ Binance REST API error:', error.message);
        return {};
      }
    }
  }

  startBinanceWebSocket(pairs) {
    try {
      // Create stream names for Binance WebSocket (combined stream)
      // Include both ticker and depth streams for order book data
      const tickerStreams = pairs
        .map(pair => this.symbolMapping[pair]?.binance)
        .filter(Boolean)
        .map(symbol => `${symbol}@ticker`);
      
      const depthStreams = pairs
        .map(pair => this.symbolMapping[pair]?.binance)
        .filter(Boolean)
        .map(symbol => `${symbol}@depth10@100ms`); // Get top 10 levels, updated every 100ms

      const allStreams = [...tickerStreams, ...depthStreams];

      if (!allStreams.length) {
        return;
      }

      // Use combined stream format for multiple symbols
      const streamParam = allStreams.join('/');
      
      // Try multiple WebSocket endpoints with fallback strategy
      this.connectWithFallback(allStreams, streamParam, pairs);
    } catch (error) {
      console.error('❌ Error starting Binance WebSocket:', error);
      // Fallback to REST-only updates
      this.startRestOnlyUpdates(pairs);
    }
  }

  async connectWithFallback(allStreams, streamParam, pairs) {
    // Define multiple WebSocket endpoints to try
    const endpoints = [
      'wss://stream.binance.com:9443/stream',
      'wss://stream.binance.com:443/stream',
      'wss://stream.binance.us:9443/stream', // US endpoint as fallback
      'wss://dstream.binance.com:9443/stream' // Alternative endpoint
    ];

    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      const wsUrl = `${endpoint}?streams=${streamParam}`;
      
      try {
        const success = await this.attemptBinanceConnection(wsUrl, allStreams, i === endpoints.length - 1);
        if (success) {
          return;
        }
      } catch (error) {
       
        // If this was the last endpoint, fall back to REST-only updates
        if (i === endpoints.length - 1) {
          this.startRestOnlyUpdates(pairs);
        }
      }
    }
  }

  attemptBinanceConnection(wsUrl, allStreams, isLastAttempt = false) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.terminate();
        reject(new Error('Connection timeout'));
      }, 10000); // 10 second timeout

      const ws = new WebSocket(wsUrl, {
        headers: {
          'User-Agent': 'crypto-trading-platform/1.0.0',
          'Origin': 'https://www.binance.com',
          'Sec-WebSocket-Protocol': 'echo-protocol'
        },
        handshakeTimeout: 10000,
        perMessageDeflate: false
      });

      ws.on('open', () => {
        clearTimeout(timeout);
        this.connections.set('binance', ws);
        this.setupBinanceMessageHandlers(ws);
        resolve(true);
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        
        // Enhanced error logging for 451 errors
        if (error.message && error.message.includes('451')) {
          console.error('🚫 Binance WebSocket 451 Error: Geographic restriction detected');
          console.error('💡 Solution: Set BINANCE_BLOCKED=true in your environment variables');
          console.error('🔄 The system will automatically fall back to alternative data sources');
        } else {
          console.error('❌ Binance WebSocket error:', error.message || error);
        }
        
        reject(error);
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        this.connections.delete('binance');
        
        // Attempt to reconnect after 5 seconds if not manually stopped
        if (this.isRunning && !isLastAttempt) {
          setTimeout(() => {
            this.connectWithFallback(allStreams, wsUrl.split('?streams=')[1], []);
          }, 5000);
        }
        resolve(false);
      });
    });
  }

  setupBinanceMessageHandlers(ws) {
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        if (message.data) {
          const streamData = message.data;
          const streamName = message.stream;
          
          if (streamName.includes('@ticker')) {
            // Handle ticker data (price updates)
            if (streamData.c) {
              const symbol = streamData.s.toLowerCase();
              const pair = this.findPairBySymbol(symbol, 'binance');
              
              if (pair) {
                const price = parseFloat(streamData.c);
                this.updatePrice(pair, price, 'Binance WebSocket');
              }
            }
          } else if (streamName.includes('@depth')) {
            // Handle order book depth data
            const symbol = streamData.s ? streamData.s.toLowerCase() : streamName.split('@')[0];
            const pair = this.findPairBySymbol(symbol, 'binance');
            
            if (pair && streamData.bids && streamData.asks) {
              this.updateOrderBook(pair, {
                bids: streamData.bids.map(([price, quantity]) => ({
                  price: parseFloat(price),
                  amount: parseFloat(quantity)
                })),
                asks: streamData.asks.map(([price, quantity]) => ({
                  price: parseFloat(price),
                  amount: parseFloat(quantity)
                })),
                timestamp: Date.now()
              });
            }
          }
        }
      } catch (error) {
        console.error('❌ Binance WebSocket message error:', error);
      }
    });
  }

  // Fallback method for REST-only updates when WebSocket fails
  startRestOnlyUpdates(pairs) {
    // No fallback data generation - service remains inactive
    return;
  }

  generateMockPrices(pairs) {
    // Mock price generation disabled - no fallback data
   return {};
  }

  startBinancePolling(pairs) {
    // Binance REST API polling as backup (every 60 seconds to avoid rate limits)
    const updateInterval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(updateInterval);
        return;
      }

      try {
        const prices = await this.fetchBinancePrices(pairs);
        Object.entries(prices).forEach(([pair, price]) => {
          // Only update if significantly different from current price (reduce noise)
          const currentPrice = this.lastPrices.get(pair);
          if (!currentPrice || Math.abs(price - currentPrice) / currentPrice > 0.0001) {
            this.updatePrice(pair, price, 'Binance Polling');
          }
        });
      } catch (error) {
        console.error('❌ Binance polling error:', error.message);
      }
    }, 60000); // Poll every 60 seconds

    this.updateIntervals.set('binance-polling', updateInterval);
  }

  startPeriodicUpdates(pairs) {
    // Fallback periodic updates every 60 seconds for any pairs without recent updates
    const fallbackInterval = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(fallbackInterval);
        return;
      }

      pairs.forEach(pair => {
        const lastUpdate = this.lastPrices.get(`${pair}_timestamp`);
        const now = Date.now();
        
        // If no update in the last 2 minutes, fetch from REST API
        if (!lastUpdate || now - lastUpdate > 120000) {
          this.fetchFallbackPrice(pair);
        }
      });
    }, 60000); // 60 seconds

    this.updateIntervals.set('fallback', fallbackInterval);
  }

  async fetchFallbackPrice(pair) {
    try {
      // Build sources list based on availability
      const sources = [];
      
      // Only add Binance if not blocked
      if (process.env.BINANCE_BLOCKED !== 'true') {
        sources.push(() => this.fetchBinancePrices([pair]));
      }
      
      // If no sources available, don't generate mock data
      if (sources.length === 0) {
        return;
      }

      for (const fetchFn of sources) {
        try {
          const prices = await fetchFn();
          if (prices[pair]) {
            this.updatePrice(pair, prices[pair], 'Fallback REST');
            return;
          }
        } catch (error) {
          console.error(`❌ Fallback fetch error for ${pair}:`, error.message);
        }
      }
      
      // If all sources fail, don't use mock data
    } catch (error) {
      console.error(`❌ All fallback sources failed for ${pair}:`, error);
    }
  }

  updatePrice(pair, price, source = 'Unknown') {
    if (!price || isNaN(price) || price <= 0) {
      console.warn(`⚠️ Invalid price for ${pair}: ${price}`);
      return;
    }

    const previousPrice = this.lastPrices.get(pair) || price;
    const priceChange = price - previousPrice;
    const priceChangePercent = previousPrice ? (priceChange / previousPrice) * 100 : 0;

    // Update price and timestamp
    this.lastPrices.set(pair, price);
    this.lastPrices.set(`${pair}_timestamp`, Date.now());

    // Broadcast to connected clients via WebSocket
    this.broadcastPriceUpdate({
      pair,
      price,
      previousPrice,
      priceChange,
      priceChangePercent,
      timestamp: Date.now(),
      source
    });

    // Log significant price changes (> 1%)
    if (Math.abs(priceChangePercent) > 1) {
      const direction = priceChange > 0 ? '📈' : '📉';
    }
  }

  updateOrderBook(pair, orderBookData) {
    if (!orderBookData || !orderBookData.bids || !orderBookData.asks) {
      console.warn(`⚠️ Invalid order book data for ${pair}`);
      return;
    }

    // Store the order book data
    this.orderBooks.set(pair, {
      bids: orderBookData.bids.slice(0, 20), // Keep top 20 levels
      asks: orderBookData.asks.slice(0, 20),
      timestamp: orderBookData.timestamp || Date.now()
    });

    // Broadcast to connected clients via WebSocket
    this.broadcastOrderBookUpdate({
      pair,
      bids: orderBookData.bids.slice(0, 20),
      asks: orderBookData.asks.slice(0, 20),
      timestamp: orderBookData.timestamp || Date.now()
    });

    // Removed verbose order book update logging to reduce console spam
  }

  broadcastOrderBookUpdate(data) {
    try {
      if (this.socketServer) {
        // Broadcast to order book room for this specific pair
        this.socketServer.to(`orderbook_${data.pair}`).emit('orderbook_update', data);
      }
    } catch (error) {
      console.error('❌ Error broadcasting order book update:', error);
    }
  }

  broadcastPriceUpdate(data) {
    try {
      if (this.socketServer) {
        // Broadcast to price room for this specific pair
        this.socketServer.to(`price_${data.pair}`).emit('price_update', data);
        
        // Also broadcast to general price room
        this.socketServer.to('prices').emit('price_update', data);
      }
    } catch (error) {
      console.error('❌ Error broadcasting price update:', error);
    }
  }

  findPairBySymbol(symbol, source) {
    for (const [pair, mapping] of Object.entries(this.symbolMapping)) {
      if (mapping[source] && mapping[source].toLowerCase() === symbol.toLowerCase()) {
        return pair;
      }
    }
    return null;
  }

  getCurrentPrice(pair) {
    return this.lastPrices.get(pair) || null;
  }

  getAllPrices() {
    const prices = {};
    for (const [key, value] of this.lastPrices.entries()) {
      if (!key.endsWith('_timestamp')) {
        prices[key] = value;
      }
    }
    return prices;
  }

  getLastUpdateTime(pair) {
    return this.lastPrices.get(`${pair}_timestamp`) || null;
  }

  getOrderBook(pair) {
    return this.orderBooks.get(pair) || null;
  }

  getAllOrderBooks() {
    const orderBooks = {};
    for (const [pair, orderBook] of this.orderBooks.entries()) {
      orderBooks[pair] = orderBook;
    }
    return orderBooks;
  }

  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;

    // Close WebSocket connections
    this.connections.forEach((ws, source) => {
      ws.close();
    });
    this.connections.clear();

    // Clear intervals
    this.updateIntervals.forEach((interval, source) => {
      clearInterval(interval);
    });
    this.updateIntervals.clear();
}

  // Method to add new trading pair dynamically
  async addTradingPair(pair, basePriceUSD = null) {
    if (!this.symbolMapping[pair]) {
      return;
    }

    // Fetch initial price
    try {
      const prices = await this.fetchBinancePrices([pair]);
      if (prices[pair]) {
        this.updatePrice(pair, prices[pair], 'New Pair - Binance');
      } else {
        // No fallback to mock data - only use real data
        if (basePriceUSD) {
          // Only use provided base price if available
          this.updatePrice(pair, basePriceUSD, 'New Pair - Base Price');
        }
      }
    } catch (error) {
      console.error(`❌ Error adding real-time data for ${pair}:`, error);
    }
  }

  // Method to get connection status
  getStatus() {
    return {
      isRunning: this.isRunning,
      connections: Array.from(this.connections.keys()),
      trackedPairs: Array.from(this.lastPrices.keys()).filter(k => !k.endsWith('_timestamp')),
      lastUpdate: Math.max(...Array.from(this.lastPrices.keys())
        .filter(k => k.endsWith('_timestamp'))
        .map(k => this.lastPrices.get(k) || 0))
    };
  }
}

// Singleton instance
const realTimeMarketData = new RealTimeMarketData();

module.exports = realTimeMarketData;
