const mongoose = require('mongoose');
const axios = require('axios');
const MarketTicker = require('../models/marketTicker');
const OrderBook = require('../models/orderBook');
const Coin = require('../models/coin');

const initializeRealTimeMarketData = async () => {
  try {
    console.log('🔄 Initializing market data with real-time prices...');

    // Trading pairs to track
    const tradingPairs = [
      { symbol: 'BTC/USDT', name: 'Bitcoin', coingeckoId: 'bitcoin' },
      { symbol: 'ETH/USDT', name: 'Ethereum', coingeckoId: 'ethereum' },
      { symbol: 'BNB/USDT', name: 'BNB', coingeckoId: 'binancecoin' },
      { symbol: 'ADA/USDT', name: 'Cardano', coingeckoId: 'cardano' },
      { symbol: 'SOL/USDT', name: 'Solana', coingeckoId: 'solana' },
      { symbol: 'DOT/USDT', name: 'Polkadot', coingeckoId: 'polkadot' },
      { symbol: 'MATIC/USDT', name: 'Polygon', coingeckoId: 'matic-network' },
      { symbol: 'AVAX/USDT', name: 'Avalanche', coingeckoId: 'avalanche-2' }
    ];

    // Fetch real-time prices from CoinGecko
    const realTimePrices = await fetchRealTimePrices(tradingPairs);

    // Initialize coins with real prices
    for (const pair of tradingPairs) {
      const [baseSymbol] = pair.symbol.split('/');
      const realPrice = realTimePrices[pair.coingeckoId] || 0;
      
      if (realPrice === 0) {
        console.warn(`⚠️ No real-time price found for ${pair.name} (${baseSymbol}), skipping...`);
        continue;
      }

      const coinExists = await Coin.findOne({ symbol: baseSymbol });
      if (!coinExists) {
        const coin = new Coin({
          symbol: baseSymbol,
          name: pair.name,
          priceUSD: realPrice,
          priceBTC: baseSymbol === 'BTC' ? 1 : realPrice / (realTimePrices['bitcoin'] || 1),
          marketCapUSD: 0, // Will be updated by real-time service
          volume24hUSD: 0, // Will be updated by real-time service
          circulatingSupply: 0, // Will be updated by real-time service
          totalSupply: 0, // Will be updated by real-time service
          status: 'active',
          isVisible: true,
          isTradingEnabled: true,
          isListedOnExchange: true,
          showInMarket: true,
          marketPriority: getMarketPriority(baseSymbol)
        });
        
        await coin.save();
        console.log(`✅ Created coin: ${baseSymbol} with real price: $${realPrice.toFixed(2)}`);
      } else {
        // Update existing coin with real price
        await Coin.updateOne(
          { symbol: baseSymbol },
          {
            $set: {
              priceUSD: realPrice,
              priceBTC: baseSymbol === 'BTC' ? 1 : realPrice / (realTimePrices['bitcoin'] || 1),
              isVisible: true,
              isTradingEnabled: true,
              isListedOnExchange: true,
              showInMarket: true,
              marketPriority: getMarketPriority(baseSymbol)
            }
          }
        );
        console.log(`✅ Updated coin: ${baseSymbol} with real price: $${realPrice.toFixed(2)}`);
      }
    }

    // Ensure USDT exists as quote currency
    const usdtExists = await Coin.findOne({ symbol: 'USDT' });
    if (!usdtExists) {
      const usdt = new Coin({
        symbol: 'USDT',
        name: 'Tether USD',
        priceUSD: 1.0,
        priceBTC: 1.0 / (realTimePrices['bitcoin'] || 1),
        marketCapUSD: 0,
        volume24hUSD: 0,
        circulatingSupply: 0,
        totalSupply: 0,
        status: 'active',
        isVisible: true,
        isTradingEnabled: true,
        isListedOnExchange: true,
        showInMarket: true,
        marketPriority: 1000 // High priority for stable coin
      });
      
      await usdt.save();
      console.log(`✅ Created USDT with price: $1.00`);
    }

    // Initialize market tickers with real prices
    for (const pair of tradingPairs) {
      const realPrice = realTimePrices[pair.coingeckoId];
      if (!realPrice) continue;

      const tickerExists = await MarketTicker.findOne({ pair: pair.symbol });
      if (!tickerExists) {
        // Generate realistic market data based on current price
        const priceVariation = realPrice * 0.02; // 2% variation for open price
        const openPrice = realPrice + (Math.random() - 0.5) * priceVariation;
        
        const ticker = new MarketTicker({
          pair: pair.symbol,
          lastPrice: realPrice,
          openPrice: openPrice,
          highPrice: Math.max(realPrice, openPrice) * (1 + Math.random() * 0.03), // Up to 3% higher
          lowPrice: Math.min(realPrice, openPrice) * (1 - Math.random() * 0.03), // Up to 3% lower
          volume24h: Math.random() * 50000000 + 5000000, // 5M - 55M volume
          change24h: ((realPrice - openPrice) / openPrice) * 100
        });

        await ticker.save();
        console.log(`✅ Created ticker: ${pair.symbol} at $${realPrice.toFixed(2)}`);
      } else {
        // Update existing ticker with real price
        const existingTicker = tickerExists;
        const priceChange = realPrice - existingTicker.openPrice;
        const priceChangePercent = existingTicker.openPrice > 0 ? 
          (priceChange / existingTicker.openPrice) * 100 : 0;

        await MarketTicker.updateOne(
          { pair: pair.symbol },
          {
            $set: {
              lastPrice: realPrice,
              highPrice: Math.max(realPrice, existingTicker.highPrice),
              lowPrice: Math.min(realPrice, existingTicker.lowPrice),
              change24h: priceChangePercent
            }
          }
        );
        console.log(`✅ Updated ticker: ${pair.symbol} to $${realPrice.toFixed(2)}`);
      }
    }

    // Initialize order books with realistic data based on current prices
    for (const pair of tradingPairs) {
      const realPrice = realTimePrices[pair.coingeckoId];
      if (!realPrice) continue;

      const orderBookExists = await OrderBook.findOne({ pair: pair.symbol });
      if (!orderBookExists) {
        const bids = generateOrderBookSide('bid', realPrice, 20);
        const asks = generateOrderBookSide('ask', realPrice, 20);

        const orderBook = new OrderBook({
          pair: pair.symbol,
          bids: bids,
          asks: asks
        });

        await orderBook.save();
        console.log(`✅ Created order book: ${pair.symbol}`);
      }
    }

    console.log('✅ Real-time market data initialization completed!');

  } catch (error) {
    console.error('❌ Error initializing real-time market data:', error);
    throw error;
  }
};

async function fetchRealTimePrices(tradingPairs) {
  console.log('📡 Fetching real-time prices from CoinGecko...');
  
  try {
    const coinIds = tradingPairs.map(pair => pair.coingeckoId).join(',');
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`,
      {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'Crypto-Trading-Platform/1.0'
        }
      }
    );

    const prices = {};
    Object.entries(response.data).forEach(([coinId, data]) => {
      if (data.usd) {
        prices[coinId] = data.usd;
        console.log(`📊 ${coinId}: $${data.usd.toFixed(2)} (${data.usd_24h_change ? data.usd_24h_change.toFixed(2) : '0.00'}%)`);
      }
    });

    console.log(`✅ Successfully fetched ${Object.keys(prices).length} real-time prices`);
    return prices;

  } catch (error) {
    console.error('❌ Failed to fetch real-time prices from CoinGecko:', error.message);
    
    // Fallback: Try to fetch from Binance if CoinGecko fails
    if (process.env.BINANCE_BLOCKED !== 'true') {
      console.log('🔄 Trying Binance as fallback...');
      return await fetchBinanceFallbackPrices(tradingPairs);
    }
    
    throw new Error('Unable to fetch real-time prices from any source');
  }
}

async function fetchBinanceFallbackPrices(tradingPairs) {
  try {
    const response = await axios.get('https://api.binance.com/api/v3/ticker/price', {
      timeout: 10000
    });

    const binanceSymbolMap = {
      'BTC/USDT': 'BTCUSDT',
      'ETH/USDT': 'ETHUSDT',
      'BNB/USDT': 'BNBUSDT',
      'ADA/USDT': 'ADAUSDT',
      'SOL/USDT': 'SOLUSDT',
      'DOT/USDT': 'DOTUSDT',
      'MATIC/USDT': 'MATICUSDT',
      'AVAX/USDT': 'AVAXUSDT'
    };

    const prices = {};
    tradingPairs.forEach(pair => {
      const binanceSymbol = binanceSymbolMap[pair.symbol];
      if (binanceSymbol) {
        const ticker = response.data.find(t => t.symbol === binanceSymbol);
        if (ticker) {
          prices[pair.coingeckoId] = parseFloat(ticker.price);
          console.log(`📊 ${pair.symbol}: $${ticker.price} (Binance)`);
        }
      }
    });

    console.log(`✅ Fetched ${Object.keys(prices).length} prices from Binance fallback`);
    return prices;

  } catch (error) {
    console.error('❌ Binance fallback also failed:', error.message);
    throw error;
  }
}

function getMarketPriority(symbol) {
  const priorities = {
    'BTC': 100,
    'ETH': 90,
    'BNB': 80,
    'SOL': 70,
    'ADA': 60,
    'DOT': 50,
    'MATIC': 40,
    'AVAX': 30,
    'USDT': 1000
  };
  return priorities[symbol] || 10;
}

const generateOrderBookSide = (side, basePrice, levels) => {
  const orders = [];
  const spread = basePrice * 0.001; // 0.1% spread
  
  for (let i = 1; i <= levels; i++) {
    const priceOffset = side === 'bid' 
      ? -(spread + (i - 1) * spread * 0.5) 
      : (spread + (i - 1) * spread * 0.5);
    
    const price = basePrice + priceOffset;
    const amount = Math.random() * 10 + 0.1; // Random amount between 0.1 and 10.1

    orders.push({
      price: parseFloat(price.toFixed(8)),
      amount: parseFloat(amount.toFixed(6))
    });
  }

  // Sort bids descending, asks ascending
  return side === 'bid' 
    ? orders.sort((a, b) => b.price - a.price)
    : orders.sort((a, b) => a.price - b.price);
};

module.exports = initializeRealTimeMarketData;

// Run if called directly
if (require.main === module) {
  const connectDB = require('../config/db-optimized');
  
  const run = async () => {
    await connectDB();
    await initializeRealTimeMarketData();
    process.exit(0);
  };

  run().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}
