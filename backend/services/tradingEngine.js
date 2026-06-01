const Order = require('../models/order');
const Trade = require('../models/trade');
const User = require('../models/user');
const OrderBook = require('../models/orderBook');
const MarketTicker = require('../models/marketTicker');
const { sessionManager } = require('../config/session');
const { createLogger } = require('../utils/logger');
const { nanoid } = require('nanoid');

const logger = createLogger('trading-engine');

class TradingEngine {
  constructor() {
    this.sessionManager = sessionManager;
    this.orderBooks = new Map(); // pair -> { bids: [], asks: [] }
    this.lastPrices = new Map(); // pair -> price
    this.subscriptions = new Map(); // socketId -> Set of pairs
    this.io = null; // Will be set later
    // Note: initializeOrderBooks() will be called manually after DB connection
  }

  setSocketServer(io) {
    this.io = io;
    logger.info('Socket server attached to trading engine', {
      timestamp: new Date().toISOString()
    });
  }

  async initializeOrderBooks() {
    try {
      logger.info('Trading engine initialization starting', {
        timestamp: new Date().toISOString()
      });
      

      // List of main trading pairs to initialize
      const pairs = [
        'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT',
        'ADA/USDT', 'DOT/USDT', 'XRP/USDT', 'DOGE/USDT'
      ];

      for (const pair of pairs) {
        await this.loadOrderBook(pair);
        await this.initializeMarketTicker(pair);
      }

      logger.info('Trading engine initialization completed', {
        initializedPairs: pairs.length,
        pairs,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error in trading engine initialization', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      console.error('❌ Error in order book initialization:', error);
    }
  }

  async loadOrderBook(pair) {
    try {
      logger.info('Loading order book for trading pair', {
        pair,
        timestamp: new Date().toISOString()
      });
      
   
      // Initialize empty order book
      this.orderBooks.set(pair, {
        bids: [],
        asks: []
      });

      logger.info('Order book initialized for pair', {
        pair,
        bidsCount: 0,
        asksCount: 0,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error initializing order book for pair', {
        pair,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      console.error(`Error initializing empty order book for ${pair}:`, error);
    }
  }

  generateSampleOrderBook(side, pair) {
    // Generate realistic sample order book data
    const basePrice = this.getBasePriceForPair(pair);
    const orders = [];
    
    for (let i = 0; i < 10; i++) {
      const priceOffset = side === 'bid' ? 
        -((i + 1) * 0.001 * basePrice) : 
        ((i + 1) * 0.001 * basePrice);
      
      orders.push({
        price: basePrice + priceOffset,
        amount: Math.random() * 5 + 0.1
      });
    }

    return side === 'bid' ? 
      orders.sort((a, b) => b.price - a.price) : 
      orders.sort((a, b) => a.price - b.price);
  }

  getBasePriceForPair(pair) {
    const basePrices = {
      'BTC/USDT': 105000,
      'ETH/USDT': 4100,
      'BNB/USDT': 720,
      'ADA/USDT': 1.15,
      'SOL/USDT': 220,
      'DOT/USDT': 8.5,
      'MATIC/USDT': 0.65,
      'AVAX/USDT': 45
    };
    return basePrices[pair] || 100;
  }

  async initializeMarketTicker(pair) {
    try {
      let ticker = await MarketTicker.findOne({ pair });
      
      if (!ticker) {
        const basePrice = this.getBasePriceForPair(pair);
        ticker = new MarketTicker({
          pair,
          lastPrice: basePrice,
          openPrice: basePrice * 0.98,
          highPrice: basePrice * 1.05,
          lowPrice: basePrice * 0.95,
          volume24h: Math.random() * 1000000,
          change24h: (Math.random() - 0.5) * 10
        });
        await ticker.save();
      }

      this.lastPrices.set(pair, ticker.lastPrice);
    } catch (error) {
      console.error(`Error initializing market ticker for ${pair}:`, error);
    }
  }

  async placeOrder(orderData) {
    try {
      const { userId, pair, side, type, amount, price, stopPrice, timeInForce } = orderData;

      // Validate user has sufficient balance
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const requiredBalance = side === 'buy' ? 
        (price || this.lastPrices.get(pair)) * amount : 
        amount;

      const currency = side === 'buy' ? 'USDT' : pair.split('/')[0];
      const userBalance = user.balances.get(currency) || 0;
      
      if (userBalance < requiredBalance) {
        throw new Error('Insufficient balance');
      }

      // Create order
      const order = new Order({
        user: userId,
        pair,
        side,
        type,
        amount,
        price: type === 'market' ? this.lastPrices.get(pair) : price,
        stopPrice,
        timeInForce: timeInForce || 'GTC',
        remainingAmount: amount
      });

      await order.save();

      // For simulation trading, execute all orders immediately
      if (type === 'market') {
        await this.executeMarketOrder(order);
      } else if (type === 'limit') {
        // For simplicity, also execute limit orders immediately at current market price
        await this.executeMarketOrder(order);
      }

      // Broadcast order update
      this.broadcastOrderUpdate(pair, order);
      
      return order;

    } catch (error) {
      console.error('Error placing order:', error);
      throw error;
    }
  }

  async executeMarketOrder(order) {
    try {
      // Add realistic delay (1-3 seconds) for trading simulation
      const delay = Math.random() * 2000 + 1000; // 1-3 seconds
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Get current market price
      const currentPrice = this.lastPrices.get(order.pair) || this.getBasePriceForPair(order.pair);
      let finalPrice = currentPrice;
      
      // For sell orders, we need to get the user's purchase price
      let purchasePrice = currentPrice; // Default to current price
      
      if (order.side === 'sell') {
        // Get user's purchase price for this token
        const User = require('../models/user');
        const user = await User.findById(order.user);
        const [baseCurrency] = order.pair.split('/');
        
        if (user && user.purchasePrices) {
          purchasePrice = user.purchasePrices.get(baseCurrency) || currentPrice;
        }
      }
      
      // Check if this is a special token or regular token and apply admin controls
      const [baseCurrency] = order.pair.split('/');
      
      // Check for special token controls
      const SpecialToken = require('../models/specialToken');
      const specialToken = await SpecialToken.findOne({ symbol: baseCurrency });
      
      if (specialToken) {
        // Special token logic
        if (order.side === 'buy' && !specialToken.tradingControls.buyEnabled) {
          throw new Error('Buying is currently disabled for this token');
        }
        if (order.side === 'sell' && !specialToken.tradingControls.sellEnabled) {
          throw new Error('Selling is currently disabled for this token');
        }
        
        // Apply admin-configured price adjustment (works for both buy and sell)
        if (order.side === 'sell') {
          const adjustment = specialToken.tradingControls.sellPriceAdjustment || 0;
          finalPrice = purchasePrice * (1 + adjustment / 100);
        } else if (order.side === 'buy') {
          // For buy orders, use current market price (no adjustment typically needed for buys)
          finalPrice = currentPrice;
        }
      } else {
        // Regular token logic
        const Coin = require('../models/coin');
        const coin = await Coin.findOne({ symbol: baseCurrency });
        
        if (coin && coin.tradingControls) {
          if (order.side === 'buy' && !coin.tradingControls.buyEnabled) {
            throw new Error('Buying is currently disabled for this token');
          }
          if (order.side === 'sell' && !coin.tradingControls.sellEnabled) {
            throw new Error('Selling is currently disabled for this token');
          }
          
          // Apply admin-configured price adjustments
          if (order.side === 'sell') {
            const adjustment = coin.tradingControls.sellPriceAdjustment || -1.0;
            finalPrice = purchasePrice * (1 + adjustment / 100);
          } else if (order.side === 'buy') {
            // For buy orders, use current market price (no adjustment typically needed for buys)
            finalPrice = currentPrice;
          }
        } else {
          // Default behavior for tokens without specific controls
          if (order.side === 'sell') {
            // Default 1% fee on sell (based on purchase price)
            finalPrice = purchasePrice * 0.99;
          } else if (order.side === 'buy') {
            // Default buy behavior - use current market price
            finalPrice = currentPrice;
          }
        }
      }
      
      // Ensure price is positive
      finalPrice = Math.max(finalPrice, 0.000001);
      
      // Create single trade for the full amount at final price
      const trade = await this.createTrade(order, finalPrice, order.amount);

      // Update order status to filled
      order.status = 'filled';
      order.filledAmount = order.amount;
      order.averagePrice = finalPrice;
      order.trades = [{
        tradeId: trade.tradeId,
        price: trade.price,
        amount: trade.amount,
        fee: trade.fee,
        timestamp: trade.executedAt
      }];

      await order.save();
      
      // Update user balances immediately
      await this.updateUserBalancesAfterTrade(order, trade);
      
      // Update market ticker with the trade price
      await this.updateMarketTicker(order.pair, finalPrice);

      // Broadcast updates
      this.broadcastOrderBookUpdate(order.pair);
      this.broadcastTradeUpdate(order.pair, [trade]);

    } catch (error) {
      console.error('Error executing market order:', error);
      throw error;
    }
  }

  async addToOrderBook(order) {
    try {
      const orderBook = this.orderBooks.get(order.pair);
      if (!orderBook) return;

      const bookSide = order.side === 'buy' ? orderBook.bids : orderBook.asks;
      
      // Check for immediate matches
      const oppositeOrders = order.side === 'buy' ? orderBook.asks : orderBook.bids;
      const trades = [];
      let remainingAmount = order.amount;

      for (let i = 0; i < oppositeOrders.length && remainingAmount > 0; i++) {
        const bookOrder = oppositeOrders[i];
        
        // Check if prices match
        const isMatch = order.side === 'buy' ? 
          order.price >= bookOrder.price : 
          order.price <= bookOrder.price;

        if (!isMatch) break;

        const tradeAmount = Math.min(remainingAmount, bookOrder.amount);
        
        // Create trade
        const trade = await this.createTrade(order, bookOrder.price, tradeAmount);
        trades.push(trade);

        // Update amounts
        remainingAmount -= tradeAmount;
        bookOrder.amount -= tradeAmount;
        order.filledAmount += tradeAmount;

        // Remove empty order from book
        if (bookOrder.amount === 0) {
          oppositeOrders.splice(i, 1);
          i--;
        }
      }

      // Add remaining amount to order book if any
      if (remainingAmount > 0) {
        const bookEntry = {
          price: order.price,
          amount: remainingAmount,
          orderId: order.orderId
        };

        // Insert in correct position (sorted by price)
        let inserted = false;
        for (let i = 0; i < bookSide.length; i++) {
          const shouldInsert = order.side === 'buy' ? 
            order.price > bookSide[i].price : 
            order.price < bookSide[i].price;

          if (shouldInsert) {
            bookSide.splice(i, 0, bookEntry);
            inserted = true;
            break;
          }
        }

        if (!inserted) {
          bookSide.push(bookEntry);
        }
      }

      // Update order
      order.status = remainingAmount === 0 ? 'filled' : 
                    trades.length > 0 ? 'partial' : 'pending';
      
      if (trades.length > 0) {
        order.trades = trades.map(t => ({
          tradeId: t.tradeId,
          price: t.price,
          amount: t.amount,
          fee: t.fee,
          timestamp: t.executedAt
        }));
      }

      await order.save();
      await this.updateOrderBook(order.pair);
      
      if (trades.length > 0) {
        await this.updateMarketTicker(order.pair, trades[trades.length - 1].price);
        this.broadcastTradeUpdate(order.pair, trades);
      }

      this.broadcastOrderBookUpdate(order.pair);

    } catch (error) {
      console.error('Error adding to order book:', error);
      throw error;
    }
  }

  async createTrade(order, price, amount) {
    try {
      const trade = new Trade({
        user: order.user,
        orderId: order._id,
        pair: order.pair,
        side: order.side,
        price,
        amount,
        filledAmount: amount,
        fee: amount * price * 0.001, // 0.1% fee
        feeCurrency: 'USDT',
        status: 'completed',
        orderType: order.type,
        tradeId: nanoid(12),
        executedAt: new Date()
      });

      await trade.save();

      // Update user balances
      await this.updateUserBalances(order.user, order.pair, order.side, price, amount);

      return trade;

    } catch (error) {
      console.error('Error creating trade:', error);
      throw error;
    }
  }

  async updateUserBalances(userId, pair, side, price, amount) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      const [baseCurrency, quoteCurrency] = pair.split('/');
      
      // Initialize balances and purchase prices if they don't exist
      if (!user.balances) {
        user.balances = new Map();
      }
      if (!user.purchasePrices) {
        user.purchasePrices = new Map();
      }
      
      if (side === 'buy') {
        // Buying: Reduce USDT, increase base currency, track purchase price
        const usdtBalance = user.balances.get(quoteCurrency) || 0;
        const baseBalance = user.balances.get(baseCurrency) || 0;
        const currentAvgPrice = user.purchasePrices.get(baseCurrency) || 0;
        
        // Calculate new average purchase price using weighted average
        const totalValue = (baseBalance * currentAvgPrice) + (amount * price);
        const totalAmount = baseBalance + amount;
        const newAvgPrice = totalAmount > 0 ? totalValue / totalAmount : price;
        
        user.balances.set(quoteCurrency, Math.max(0, usdtBalance - (price * amount)));
        user.balances.set(baseCurrency, baseBalance + amount);
        user.purchasePrices.set(baseCurrency, newAvgPrice);
        
      } else {
        // Selling: Reduce base currency, increase USDT (purchase price unchanged)
        const baseBalance = user.balances.get(baseCurrency) || 0;
        const usdtBalance = user.balances.get(quoteCurrency) || 0;
        
        user.balances.set(baseCurrency, Math.max(0, baseBalance - amount));
        user.balances.set(quoteCurrency, usdtBalance + (price * amount));
        
        // If user sells all tokens, reset purchase price
        if (user.balances.get(baseCurrency) <= 0) {
          user.purchasePrices.set(baseCurrency, 0);
        }
      }

      await user.save();

    } catch (error) {
      console.error('Error updating user balances:', error);
    }
  }

  async updateUserBalancesAfterTrade(order, trade) {
    // This method handles the immediate balance update after trade execution
    // For simulation trading, we can just call the existing updateUserBalances method
    await this.updateUserBalances(order.user, order.pair, order.side, trade.price, trade.amount);
  }

  async lockUserFunds(userId, currency, amount) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      const wallet = user.wallets.find(w => w.currency === currency);
      if (wallet) {
        wallet.available -= amount;
        wallet.locked += amount;
      } else {
        // This shouldn't happen if balance was checked
        throw new Error('Wallet not found');
      }

      await user.save();

    } catch (error) {
      console.error('Error locking user funds:', error);
      throw error;
    }
  }

  async updateOrderBook(pair) {
    try {
      const orderBook = this.orderBooks.get(pair);
      if (!orderBook) return;

      await OrderBook.findOneAndUpdate(
        { pair },
        {
          bids: orderBook.bids,
          asks: orderBook.asks,
          updatedAt: new Date()
        },
        { upsert: true }
      );

    } catch (error) {
      console.error('Error updating order book:', error);
    }
  }

  async updateMarketTicker(pair, lastPrice) {
    try {
      if (lastPrice) {
        this.lastPrices.set(pair, lastPrice);
      }

      const currentPrice = this.lastPrices.get(pair);
      if (!currentPrice) return;

      await MarketTicker.findOneAndUpdate(
        { pair },
        {
          lastPrice: currentPrice,
          updatedAt: new Date()
        },
        { upsert: true }
      );

    } catch (error) {
      console.error('Error updating market ticker:', error);
    }
  }

  // WebSocket broadcasting methods
  broadcastOrderBookUpdate(pair) {
    const orderBook = this.orderBooks.get(pair);
    if (!orderBook || !this.io) return;

    this.io.to(`orderbook_${pair}`).emit('orderbook_update', {
      pair,
      bids: orderBook.bids.slice(0, 20), // Top 20 levels
      asks: orderBook.asks.slice(0, 20),
      timestamp: Date.now()
    });
  }

  broadcastTradeUpdate(pair, trades) {
    if (!trades || trades.length === 0 || !this.io) return;

    const tradeData = trades.map(trade => ({
      id: trade.tradeId,
      pair: trade.pair,
      price: trade.price,
      amount: trade.amount,
      side: trade.side,
      timestamp: trade.executedAt
    }));

    this.io.to(`trades_${pair}`).emit('trade_update', {
      pair,
      trades: tradeData,
      timestamp: Date.now()
    });
  }

  broadcastOrderUpdate(pair, order) {
    if (!order || !this.io) return;

    this.io.to(`orders_${order.user}`).emit('order_update', {
      orderId: order.orderId,
      pair: order.pair,
      side: order.side,
      type: order.type,
      amount: order.amount,
      filledAmount: order.filledAmount,
      price: order.price,
      status: order.status,
      timestamp: order.updatedAt
    });
  }

  broadcastPriceUpdate(pair) {
    const price = this.lastPrices.get(pair);
    if (!price || !this.io) return;

    this.io.to(`price_${pair}`).emit('price_update', {
      pair,
      price,
      timestamp: Date.now()
    });
  }

  // Subscription management
  subscribe(socketId, channel, pair) {
    if (!this.subscriptions.has(socketId)) {
      this.subscriptions.set(socketId, new Set());
    }
    
    this.subscriptions.get(socketId).add(`${channel}_${pair}`);
  }

  unsubscribe(socketId, channel, pair) {
    const userSubs = this.subscriptions.get(socketId);
    if (userSubs) {
      userSubs.delete(`${channel}_${pair}`);
    }
  }

  unsubscribeAll(socketId) {
    this.subscriptions.delete(socketId);
  }
}

module.exports = TradingEngine;
