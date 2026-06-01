const express = require('express');
const router = express.Router();
const requireUserAuth = require('../middlewares/requireUserAuth');
const Order = require('../models/order');
const Trade = require('../models/trade');
const User = require('../models/user');
const SpecialToken = require('../models/specialToken');
const Transaction = require('../models/transaction');
const TradingEngine = require('../services/tradingEngine');
const candleService = require('../services/candleService');

// Helper function to round balances to avoid floating-point precision issues
const roundBalance = (amount, decimals = 8) => {
  if (typeof amount !== 'number') return 0;
  const rounded = Math.round(amount * Math.pow(10, decimals)) / Math.pow(10, decimals);
  // If the rounded amount is very close to zero (within 0.00000001), return 0
  return Math.abs(rounded) < Math.pow(10, -decimals) ? 0 : rounded;
};

// Helper function to update user balance with proper precision
const updateBalance = (balances, currency, amount) => {
  const currentBalance = balances.get(currency) || 0;
  const newBalance = roundBalance(currentBalance + amount);
  balances.set(currency, newBalance);
  return newBalance;
};


// Get user balances
router.get('/balances', requireUserAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('balances');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Format balances for easy frontend consumption
    const balances = {};
    if (user.balances) {
      // Convert Map to object format for frontend
      for (const [currency, amount] of user.balances) {
        const roundedAmount = roundBalance(amount || 0);
        // Display with 5 decimal places for user-friendly viewing
        const displayAmount = parseFloat(roundedAmount.toFixed(5));
        balances[currency] = {
          available: displayAmount,
          locked: 0, // No locked amounts in simplified system
          total: displayAmount
        };
      }
    }
    res.json({
      success: true,
      data: balances
    });

  } catch (error) {
    console.error('Error fetching balances:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch balances'
    });
  }
});

// Get user's trading orders
router.get('/orders', requireUserAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, status, pair } = req.query;
    
    const query = { user: req.user._id };
    if (status) query.status = status;
    if (pair) query.pair = pair;

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
});

// Get specific order details
router.get('/orders/:orderId', requireUserAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findOne({
      orderId,
      user: req.user._id
    }).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order'
    });
  }
});

// Get user's trade history
router.get('/trades', requireUserAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, pair } = req.query;
    
    const query = { user: req.user._id };
    if (pair) query.pair = pair;

    const trades = await Trade.find(query)
      .sort({ executedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Trade.countDocuments(query);

    res.json({
      success: true,
      data: {
        trades,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trades'
    });
  }
});

// Cancel an order
router.delete('/orders/:orderId', requireUserAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findOne({
      orderId,
      user: req.user._id,
      status: { $in: ['pending', 'partial'] }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found or cannot be cancelled'
      });
    }

    // Update order status
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    await order.save();

    // Release locked funds ATOMICALLY (prevent lost-update race condition)
    const [baseCurrency, quoteCurrency] = order.pair.split('/');
    const currency = order.side === 'buy' ? quoteCurrency : baseCurrency;
    const amount = order.side === 'buy' ? 
      order.remainingAmount * order.price : 
      order.remainingAmount;

    await User.updateOne(
      { _id: req.user._id, 'wallets.currency': currency },
      { $inc: { 'wallets.$.available': amount, 'wallets.$.locked': -amount } }
    );

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: {
        orderId: order.orderId,
        status: order.status
      }
    });

  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel order'
    });
  }
});

// Get trading statistics
router.get('/stats', requireUserAuth, async (req, res) => {
  try {
    const userId = req.user._id;

    // Get trading statistics
    const totalTrades = await Trade.countDocuments({ user: userId });
    const totalOrders = await Order.countDocuments({ user: userId });
    
    const tradeVolume = await Trade.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, volume: { $sum: { $multiply: ['$price', '$amount'] } } } }
    ]);

    const recentTrades = await Trade.find({ user: userId })
      .sort({ executedAt: -1 })
      .limit(10)
      .lean();

    const activeOrders = await Order.countDocuments({
      user: userId,
      status: { $in: ['pending', 'partial'] }
    });

    res.json({
      success: true,
      data: {
        totalTrades,
        totalOrders,
        activeOrders,
        totalVolume: tradeVolume[0]?.volume || 0,
        recentTrades
      }
    });

  } catch (error) {
    console.error('Error fetching trading stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trading statistics'
    });
  }
});

// Get available trading pairs
router.get('/pairs', async (req, res) => {
  try {
    // This would typically come from a database or configuration
    const tradingPairs = [
      {
        symbol: 'BTC/USDT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        active: true,
        minOrderSize: 0.001,
        maxOrderSize: 1000,
        tickSize: 0.01,
        stepSize: 0.00001
      },
      {
        symbol: 'ETH/USDT',
        baseAsset: 'ETH',
        quoteAsset: 'USDT',
        active: true,
        minOrderSize: 0.01,
        maxOrderSize: 10000,
        tickSize: 0.01,
        stepSize: 0.001
      },
      {
        symbol: 'BNB/USDT',
        baseAsset: 'BNB',
        quoteAsset: 'USDT',
        active: true,
        minOrderSize: 0.1,
        maxOrderSize: 50000,
        tickSize: 0.01,
        stepSize: 0.01
      },
      {
        symbol: 'ADA/USDT',
        baseAsset: 'ADA',
        quoteAsset: 'USDT',
        active: true,
        minOrderSize: 1,
        maxOrderSize: 1000000,
        tickSize: 0.0001,
        stepSize: 0.1
      },
      {
        symbol: 'SOL/USDT',
        baseAsset: 'SOL',
        quoteAsset: 'USDT',
        active: true,
        minOrderSize: 0.1,
        maxOrderSize: 10000,
        tickSize: 0.01,
        stepSize: 0.01
      }
    ];

    res.json({
      success: true,
      data: tradingPairs
    });

  } catch (error) {
    console.error('Error fetching trading pairs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trading pairs'
    });
  }
});

// Place a new order
router.post('/orders', requireUserAuth, async (req, res) => {
  try {
    const { pair, side, type, amount, price, timeInForce, usdtValue, userInputType, userInputAmount, marketPrice } = req.body;
    // Validate required fields
    if (!pair || !side || !type || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: pair, side, type, amount'
      });
    }

    // Validate side
    if (!['buy', 'sell'].includes(side)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid side. Must be "buy" or "sell"'
      });
    }

    // Validate type
    if (!['market', 'limit'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order type. Must be "market" or "limit"'
      });
    }

    // For sell orders, only allow market orders (instant execution with price adjustments)
    if (side === 'sell' && type !== 'market') {
      return res.status(400).json({
        success: false,
        error: 'Sell orders must be market orders for instant execution with price adjustments'
      });
    }

    // Validate price for limit orders
    if (type === 'limit' && (!price || price <= 0)) {
      return res.status(400).json({
        success: false,
        error: 'Price is required for limit orders and must be greater than 0'
      });
    }

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be greater than 0'
      });
    }

    // Get user
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Parse pair
    const [baseCurrency, quoteCurrency] = pair.split('/');
    if (!baseCurrency || !quoteCurrency) {
      return res.status(400).json({
        success: false,
        error: 'Invalid trading pair format. Use format like BTC/USDT'
      });
    }


    // Check trading controls for the token
    let isSpecialToken = false;
    let tokenTradingControls = null;
    
    // First check if it's a special token
    const specialToken = await SpecialToken.findOne({ symbol: baseCurrency });
    if (specialToken) {
      isSpecialToken = true;
      tokenTradingControls = specialToken.tradingControls;
    } else {
      // Check if it's a regular token with trading controls
      const Coin = require('../models/coin');
      const regularToken = await Coin.findOne({ symbol: baseCurrency });
      if (regularToken && regularToken.tradingControls) {
        tokenTradingControls = regularToken.tradingControls;
      }
    }
    
    // Validate trading controls
    if (tokenTradingControls) {
      if (side === 'buy' && tokenTradingControls.buyEnabled === false) {
        return res.status(400).json({
          success: false,
          error: `Buy is currently disabled for ${baseCurrency}`
        });
      }
      
      if (side === 'sell' && tokenTradingControls.sellEnabled === false) {
        return res.status(400).json({
          success: false,
          error: `Sell is currently disabled for ${baseCurrency}`
        });
      }
    }
    

    // Check user balance using the new balances Map
    const requiredCurrency = side === 'buy' ? quoteCurrency : baseCurrency;
    let requiredAmount;
    
    if (side === 'buy') {
      // For buy orders, use the exact USDT value from frontend if provided
      if (usdtValue && usdtValue > 0) {
        requiredAmount = usdtValue; // Use the exact USDT value the user intends to spend
      } else {
        // Fallback: calculate from amount * price (for backward compatibility)
        let estimatedPrice = price;
        if (type === 'market') {
          // First check if this is a special token
          const specialToken = await SpecialToken.findOne({ symbol: baseCurrency });
          
          if (specialToken) {
            // Use special token's current price
            estimatedPrice = specialToken.currentPrice;
          } else {
            // Use hardcoded prices for regular tokens
            switch (pair) {
              case 'BTC/USDT':
                estimatedPrice = 65000;
                break;
              case 'ETH/USDT':
                estimatedPrice = 3200;
                break;
              case 'BNB/USDT':
                estimatedPrice = 580;
                break;
              case 'ADA/USDT':
                estimatedPrice = 0.45;
                break;
              case 'SOL/USDT':
                estimatedPrice = 180;
                break;
              default:
                estimatedPrice = 1000;
            }
          }
        }
        requiredAmount = amount * estimatedPrice;
      }
    } else {
      // For sell orders, need base currency (BTC, ETH, etc.)
      requiredAmount = amount;
    }

    // Initialize balances Map if it doesn't exist
    if (!user.balances) {
      user.balances = new Map();
    }

    // Check if user has sufficient balance with floating-point precision tolerance
    const currentBalance = user.balances.get(requiredCurrency) || 0;
    
    // Add tolerance for floating-point precision issues (1e-6 = 0.000001)
    const tolerance = 1e-6;
    const hasInsufficientBalance = (currentBalance + tolerance) < requiredAmount;
    
    // SECURITY: Use atomic balance deduction to prevent double-spend race condition
    // The actual deduction happens via findOneAndUpdate with $gte condition below
    
    if (hasInsufficientBalance) {
      return res.status(400).json({
        success: false,
        error: `Insufficient ${requiredCurrency} balance to ${side}. You need ${requiredAmount.toFixed(6)} ${requiredCurrency} but only have ${currentBalance.toFixed(6)} available.`
      });
    }

    // Create order
    const order = new Order({
      user: req.user._id,
      pair,
      side,
      type,
      amount: parseFloat(amount),
      price: type === 'limit' ? parseFloat(price) : undefined,
      remainingAmount: parseFloat(amount),
      timeInForce: timeInForce || 'GTC'
    });

    await order.save();

    // Initialize variables that will be used in the response
    let actualUsdtValue = 0; // Track the actual USDT amount for response
    let currentPrice; // Will be set for market orders

    // For market orders, execute immediately with the new balance system
    if (type === 'market') {
      // Use real-time price from frontend if provided, otherwise fallback to backend calculation
      let currentPrice;
      
      // SECURITY: Never trust client-provided market prices for order execution
      // Always determine price server-side to prevent price manipulation attacks
      if (false /* marketPrice from client is NEVER trusted */) {
        currentPrice = marketPrice;
      } else {
        // Fallback to backend price calculation
        // First check if this is a special token
        const specialToken = await SpecialToken.findOne({ symbol: baseCurrency });
        
        if (specialToken) {
          // Use special token's current price
          currentPrice = specialToken.currentPrice;
        } else {
          // Use simulated prices for regular tokens
          switch (pair) {
            case 'BTC/USDT':
              currentPrice = 117508 + (Math.random() - 0.5) * 2000; // BTC around $117k
              break;
            case 'ETH/USDT':
              currentPrice = 3200 + (Math.random() - 0.5) * 200; // ETH around $3.2k
              break;
            case 'BNB/USDT':
              currentPrice = 580 + (Math.random() - 0.5) * 50; // BNB around $580
              break;
            case 'ADA/USDT':
              currentPrice = 0.45 + (Math.random() - 0.5) * 0.1; // ADA around $0.45
              break;
            case 'SOL/USDT':
              currentPrice = 180 + (Math.random() - 0.5) * 20; // SOL around $180
              break;
            default:
              currentPrice = price || 1000; // Default price
          }
        }
      }
      
      // For buy orders, recalculate the exact amount based on USDT value and current price
      let finalAmount = order.amount; // Default to frontend amount
      
      if (side === 'buy' && usdtValue && usdtValue > 0) {
        // Recalculate exact amount based on USDT value and current price
        finalAmount = usdtValue / currentPrice;
        console.log(`🔄 Recalculating buy amount - USDT: $${usdtValue}, Price: $${currentPrice}, Calculated amount: ${finalAmount}`);
        
        // Update the order with the recalculated amount
        order.amount = finalAmount;
        order.filledAmount = finalAmount;
        order.remainingAmount = 0;
      }
      
      // Update order status
      order.status = 'filled';
      order.filledAmount = finalAmount;
      order.remainingAmount = 0;
      order.averagePrice = currentPrice;
      order.totalValue = finalAmount * currentPrice;
      order.filledAt = new Date();
      await order.save();

      // Execute the trade: Update balances ATOMICALLY
      // First deduct the required currency atomically to prevent double-spend
      if (side === 'buy') {
        // Buying: Remove USDT, Add base currency (BTC, ETH, etc.)
        // Use the exact USDT value from frontend if provided, otherwise calculate
        const usdtCost = usdtValue && usdtValue > 0 ? usdtValue : (finalAmount * currentPrice);
        actualUsdtValue = usdtCost;
        
        // Update balances using the helper function to avoid precision issues
        updateBalance(user.balances, quoteCurrency, -usdtCost);
        updateBalance(user.balances, baseCurrency, finalAmount);
        
        
        // Store purchase price for this token (weighted average if user already owns some)
        if (!user.purchasePrices) {
          user.purchasePrices = new Map();
        }
        
        const existingAmount = (user.balances.get(baseCurrency) || 0) - finalAmount; // Before this purchase
        const newAmount = finalAmount;
        const existingPrice = user.purchasePrices.get(baseCurrency) || currentPrice;
        
        // Calculate weighted average purchase price
        const totalAmount = existingAmount + newAmount;
        const weightedAveragePrice = totalAmount > 0 ? 
          ((existingAmount * existingPrice) + (newAmount * currentPrice)) / totalAmount : 
          currentPrice;
        
        // Store the weighted average purchase price - this will be used for sell calculations
        user.purchasePrices.set(baseCurrency, weightedAveragePrice);
        
        // Track this individual purchase for overselling prevention
        if (!user.purchaseHistory) {
          user.purchaseHistory = [];
        }
        
        user.purchaseHistory.push({
          token: baseCurrency,
          amount: finalAmount,
          price: currentPrice,
          usdtValue: usdtCost,
          purchasedAt: new Date(),
          remainingAmount: finalAmount // Initially, all of this purchase is available for sale
        });
        
        console.log(`💰 Purchase tracking - User: ${req.user._id}, Token: ${baseCurrency}, Amount bought: ${finalAmount}, Price: $${currentPrice}, Total USDT: $${usdtCost}, Stored weighted avg price: $${weightedAveragePrice}`);
        console.log(`📦 Purchase lot added - Remaining lots for ${baseCurrency}: ${user.purchaseHistory.filter(h => h.token === baseCurrency && h.remainingAmount > 0).length}`);
        
      } else {
        // Selling: Remove base currency, Add USDT
        console.log(`🔍 Sell analysis - User: ${req.user._id}, Trying to sell: ${order.amount} ${baseCurrency}, Current balance: ${user.balances.get(baseCurrency) || 0}`);
        
        // Get the user's purchase price for this token (fallback to current price if no purchase history)
        const userPurchasePrice = user.purchasePrices?.get(baseCurrency) || currentPrice;
        
        // Check if user is trying to sell more than their total balance
        const currentTokenBalance = user.balances.get(baseCurrency) || 0;
        if (order.amount > currentTokenBalance) {
          return res.status(400).json({
            success: false,
            error: `Cannot sell ${order.amount} ${baseCurrency}. You only have ${currentTokenBalance.toFixed(8)} ${baseCurrency} available.`
          });
        }
        
        // Check if user has enough remaining purchase lots to cover this sale (FIFO accounting)
        const availableLots = user.purchaseHistory ? 
          user.purchaseHistory.filter(h => h.token === baseCurrency && h.remainingAmount > 0) : [];
        
        const totalRemainingFromPurchases = availableLots.reduce((sum, lot) => sum + lot.remainingAmount, 0);
        
        // Check for legacy balance (tokens owned before purchase lot tracking was implemented)
        const legacyBalance = currentTokenBalance - totalRemainingFromPurchases;
        
        if (order.amount > totalRemainingFromPurchases && legacyBalance > 0) {
          // User is trying to sell more than they have in purchase lots, but they have legacy balance
          const sellFromLots = Math.min(order.amount, totalRemainingFromPurchases);
          const sellFromLegacy = order.amount - sellFromLots;
          
          if (sellFromLegacy > legacyBalance) {
            return res.status(400).json({
              success: false,
              error: `Cannot sell ${order.amount} ${baseCurrency}. Available: ${totalRemainingFromPurchases.toFixed(8)} from purchases + ${legacyBalance.toFixed(8)} legacy = ${(totalRemainingFromPurchases + legacyBalance).toFixed(8)} total.`
            });
          }
          
          console.log(`💡 Mixed sale detected - User: ${req.user._id}, Selling ${sellFromLots} from purchase lots + ${sellFromLegacy} from legacy balance`);
        } else if (order.amount > totalRemainingFromPurchases) {
          return res.status(400).json({
            success: false,
            error: `Cannot sell ${order.amount} ${baseCurrency}. You can only sell up to ${totalRemainingFromPurchases.toFixed(8)} ${baseCurrency} from your purchase history. Total balance: ${currentTokenBalance.toFixed(8)}.`
          });
        }
        
        let finalSellPrice = userPurchasePrice; // Always start with the user's buy price
        let adjustmentPercent = 0;
        
        // Check if this is a special token with sell price adjustment
        const specialToken = await SpecialToken.findOne({ symbol: baseCurrency });
        if (specialToken && typeof specialToken.tradingControls?.sellPriceAdjustment === 'number') {
          // Apply sell price adjustment to the user's purchase price (can be + or -)
          adjustmentPercent = specialToken.tradingControls.sellPriceAdjustment;
          finalSellPrice = userPurchasePrice * (1 + adjustmentPercent / 100);
          console.log(`🔄 Special token sell: ${baseCurrency} - Purchase price: $${userPurchasePrice}, Adjustment: ${adjustmentPercent > 0 ? '+' : ''}${adjustmentPercent}%, Final sell price: $${finalSellPrice}`);
        } else {
          // For regular tokens, check if they have sell adjustments in the regular Coin model
          const Coin = require('../models/coin');
          const regularToken = await Coin.findOne({ symbol: baseCurrency });
          if (regularToken && typeof regularToken.tradingControls?.sellPriceAdjustment === 'number') {
            adjustmentPercent = regularToken.tradingControls.sellPriceAdjustment;
            finalSellPrice = userPurchasePrice * (1 + adjustmentPercent / 100);
            console.log(`🔄 Regular token sell: ${baseCurrency} - Purchase price: $${userPurchasePrice}, Adjustment: ${adjustmentPercent > 0 ? '+' : ''}${adjustmentPercent}%, Final sell price: $${finalSellPrice}`);
          } else {
            // No admin adjustment defined, use the user's purchase price as-is
            finalSellPrice = userPurchasePrice;
            console.log(`📊 Token sell: ${baseCurrency} - Using user's purchase price: $${finalSellPrice} (no admin adjustment defined)`);
          }
        }
        
        const usdtReceived = order.amount * finalSellPrice;
        actualUsdtValue = usdtReceived;
        
        console.log(`💸 Sell tracking - User: ${req.user._id}, Token: ${baseCurrency}, Amount sold: ${order.amount}, Purchase price: $${userPurchasePrice}, Final sell price: $${finalSellPrice}, USDT received: $${usdtReceived}`);
        
        // Consume from purchase lots using FIFO accounting
        let remainingToSell = order.amount;
        const lotsToUpdate = user.purchaseHistory
          .filter(h => h.token === baseCurrency && h.remainingAmount > 0)
          .sort((a, b) => a.purchasedAt - b.purchasedAt); // FIFO: oldest first
        
        let soldFromLots = 0;
        for (const lot of lotsToUpdate) {
          if (remainingToSell <= 0) break;
          
          const consumeFromThisLot = Math.min(remainingToSell, lot.remainingAmount);
          lot.remainingAmount -= consumeFromThisLot;
          remainingToSell -= consumeFromThisLot;
          soldFromLots += consumeFromThisLot;
          
          console.log(`📦 FIFO: Consumed ${consumeFromThisLot} ${baseCurrency} from lot purchased at $${lot.price} on ${lot.purchasedAt}. Lot remaining: ${lot.remainingAmount}`);
        }
        
        // If there's still remaining to sell, it's coming from legacy balance
        if (remainingToSell > 0) {
          console.log(`🔄 Legacy sale: ${remainingToSell} ${baseCurrency} sold from legacy balance (no purchase lots)`);
        }
        
        console.log(`📊 Sale breakdown - From lots: ${soldFromLots}, From legacy: ${remainingToSell}, Total: ${order.amount}`);
        
        // Update balances using the helper function to avoid precision issues
        updateBalance(user.balances, baseCurrency, -order.amount);
        updateBalance(user.balances, quoteCurrency, usdtReceived);
        
      // Update the order with the final sell price and values
      if (side === 'sell') {
        order.averagePrice = finalSellPrice;
        order.totalValue = actualUsdtValue; // Store the actual USDT received
      } else {
        order.totalValue = order.amount * currentPrice;
      }
      }

      // ATOMIC balance update to prevent double-spend race condition
      // Use findOneAndUpdate with $inc and $gte guard for the deducted currency
      const balanceUpdate = {};
      if (side === 'buy') {
        const usdtCost = usdtValue && usdtValue > 0 ? usdtValue : (order.amount * currentPrice);
        balanceUpdate[`balances.${quoteCurrency}`] = -usdtCost;
        balanceUpdate[`balances.${baseCurrency}`] = order.amount;
        
        const atomicTradeResult = await User.findOneAndUpdate(
          { _id: req.user._id, [`balances.${quoteCurrency}`]: { $gte: usdtCost - 1e-6 } },
          { 
            $inc: balanceUpdate,
            $set: { 
              purchasePrices: user.purchasePrices,
              purchaseHistory: user.purchaseHistory 
            }
          },
          { new: true }
        );
        if (!atomicTradeResult) {
          order.status = 'cancelled';
          order.cancelledAt = new Date();
          await order.save();
          return res.status(400).json({ success: false, error: 'Insufficient balance (concurrent modification). Please try again.' });
        }
        user.balances = atomicTradeResult.balances;
      } else {
        const usdtReceived = actualUsdtValue;
        balanceUpdate[`balances.${baseCurrency}`] = -order.amount;
        balanceUpdate[`balances.${quoteCurrency}`] = usdtReceived;
        
        const atomicTradeResult = await User.findOneAndUpdate(
          { _id: req.user._id, [`balances.${baseCurrency}`]: { $gte: order.amount - 1e-6 } },
          {
            $inc: balanceUpdate,
            $set: {
              purchasePrices: user.purchasePrices,
              purchaseHistory: user.purchaseHistory
            }
          },
          { new: true }
        );
        if (!atomicTradeResult) {
          order.status = 'cancelled';
          order.cancelledAt = new Date();
          await order.save();
          return res.status(400).json({ success: false, error: 'Insufficient balance (concurrent modification). Please try again.' });
        }
        user.balances = atomicTradeResult.balances;
      }
      await order.save(); // Save the order with updated totalValue and averagePrice

      // Create trade record
      const finalTradePrice = side === 'sell' ? (order.averagePrice || currentPrice) : currentPrice;
      
      const trade = new Trade({
        user: req.user._id,
        orderId: order._id,
        pair,
        side,
        price: finalTradePrice,
        amount: order.amount,
        filledAmount: order.amount,
        fee: 0,
        status: 'completed',
        executedAt: new Date(),
        orderType: type,
        tradeId: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });

      await trade.save();

      // Process trade for live candle creation
      try {
        await candleService.processTrade({
          pair,
          price: finalTradePrice,
          amount: order.amount,
          timestamp: new Date()
        });
      } catch (candleError) {
        console.error('Error processing trade for candles:', candleError);
        // Don't fail the trade if candle processing fails
      }

      // Create transaction record for this trade
      const Transaction = require('../models/transaction');
      
      // Generate unique transaction ID manually to ensure it's set
      const date = new Date();
      const dateStr = date.getFullYear().toString() + 
                     (date.getMonth() + 1).toString().padStart(2, '0') + 
                     date.getDate().toString().padStart(2, '0');
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      const transactionId = `TXN-${dateStr}-${randomNum}`;
      
      const transactionPrice = side === 'sell' ? (order.averagePrice || currentPrice) : currentPrice;
      const transactionAmount = side === 'buy' ? order.amount : actualUsdtValue; // Use actual USDT received for sells
      
      const transactionData = {
        user: req.user._id,
        transactionId: transactionId,  // Explicitly set transactionId
        type: side === 'buy' ? 'trade_buy' : 'trade_sell',
        subType: side === 'buy' ? 'spot_trade' : 'spot_trade',
        currency: side === 'buy' ? baseCurrency : quoteCurrency,
        amount: transactionAmount,
        direction: side === 'buy' ? 'debit' : 'credit',
        balanceBefore: side === 'buy' ? 
          (user.balances.get(baseCurrency) || 0) - order.amount :
          (user.balances.get(quoteCurrency) || 0) - actualUsdtValue,
        balanceAfter: side === 'buy' ? 
          (user.balances.get(baseCurrency) || 0) :
          (user.balances.get(quoteCurrency) || 0),
        usdValue: actualUsdtValue || (order.amount * transactionPrice),
        status: 'completed',
        tradingInfo: {
          tradeId: trade.tradeId,
          pair: pair,
          side: side,
          price: transactionPrice,
          quantity: order.amount,
          orderType: type
        }
      };

      await Transaction.create(transactionData);

      // Process trading bonuses for special token sales
      if (side === 'sell') {
        const [baseCurrency] = pair.split('/');
        const specialToken = await SpecialToken.findOne({ symbol: baseCurrency });
        
        if (specialToken && specialToken.tradingControls?.sellPriceAdjustment > 0) {
          try {
            const ReferralService = require('../services/referralService');
            
            // Get the user's original purchase price
            const purchasePrice = user.purchasePrices?.get(baseCurrency) || currentPrice;
            const adjustedPrice = order.averagePrice; // This includes the sell adjustment applied to purchase price
            
            // Calculate profit from price adjustment (bonus from admin-set adjustment)
            const adjustmentBonus = (adjustedPrice - purchasePrice) * order.amount; // Bonus from adjustment
            
            // Only process referral bonuses if there's profit from the adjustment
            if (adjustmentBonus > 0) {
              const saleData = {
                isSpecialToken: true,
                specialTokenId: specialToken._id,
                tokenSymbol: baseCurrency,
                tradeId: trade.tradeId,
                pair: pair,
                quantity: order.amount,
                basePrice: purchasePrice,
                adjustedPrice: adjustedPrice,
                priceAdjustment: specialToken.tradingControls.sellPriceAdjustment,
                profit: adjustmentBonus // Only the bonus amount from admin adjustment
              };
              
              await ReferralService.processSpecialTokenSale(req.user._id, saleData);
            }
          } catch (bonusError) {
            console.error('Error processing trading bonuses:', bonusError);
            // Don't fail the trade if bonus processing fails
          }
        }
      }
    }

    // Send trade notification to user
    try {
      const notificationService = require('../utils/notificationService');
      
      // Determine if this is a special token
      const [baseCurrency] = pair.split('/');
      const specialTokenCheck = await SpecialToken.findOne({ symbol: baseCurrency });
      const isSpecialToken = !!specialTokenCheck;
      
      // Calculate USD value
      const usdValue = order.averagePrice * order.amount;
      
      // Send trade notification
      console.log(`📊 Trade notification data - Side: ${order.side}, Amount: ${order.amount}, Price: ${order.averagePrice}, Total: ${usdValue}`);
      await notificationService.notifyUserTradeExecuted(req.user._id, {
        side: order.side,
        pair: order.pair,
        amount: order.amount.toFixed(8), // Use more precision for crypto amounts
        price: order.averagePrice.toFixed(2),
        totalValue: usdValue.toFixed(2),
        isSpecialToken
      });
      

      
    } catch (notificationError) {
      console.error('Error sending trade notification:', notificationError);
      // Don't fail the trade if notification fails
    }

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: {
        orderId: order.orderId,
        pair: order.pair,
        side: order.side,
        type: order.type,
        amount: order.amount,
        price: order.averagePrice || currentPrice,
        status: order.status,
        createdAt: order.createdAt,
        // Include the actual USDT cost/value for frontend verification
        total: actualUsdtValue || (order.amount * (order.averagePrice || currentPrice)),
        // For sells, include the USDT received separately for clarity
        usdtReceived: side === 'sell' ? actualUsdtValue : undefined,
        // Include total value for consistent display
        totalValue: order.totalValue || actualUsdtValue || (order.amount * (order.averagePrice || currentPrice))
      }
    });

  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to place order: ' + error.message
    });
  }
});

module.exports = router;
