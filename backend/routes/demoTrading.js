const express = require('express');
const router = express.Router();
const requireUserAuth = require('../middlewares/requireUserAuth');
const demoTradingService = require('../services/demoTradingService');

const roundBalance = (amount, decimals = 8) => {
  if (typeof amount !== 'number' || isNaN(amount)) return 0;
  const rounded = Math.round(amount * Math.pow(10, decimals)) / Math.pow(10, decimals);
  return Math.abs(rounded) < Math.pow(10, -decimals) ? 0 : rounded;
};

// ─── Get or create demo account ───────────────────────────────────────────────
router.get('/account', requireUserAuth, async (req, res) => {
  try {
    const account = await demoTradingService.getOrCreateAccount(req.user._id);

    // Format balances
    const balances = {};
    if (account.balances) {
      for (const [currency, amount] of account.balances) {
        const rounded = roundBalance(amount || 0);
        balances[currency] = {
          available: parseFloat(rounded.toFixed(8)),
          locked: 0,
          total: parseFloat(rounded.toFixed(8))
        };
      }
    }

    res.json({
      success: true,
      data: {
        id: account._id,
        balances,
        totalTrades: account.totalTrades,
        totalProfitLoss: account.totalProfitLoss,
        winCount: account.winCount,
        lossCount: account.lossCount,
        initialBalance: account.initialBalance,
        resetCount: account.resetCount,
        createdAt: account.createdAt
      }
    });
  } catch (error) {
    console.error('Error getting demo account:', error);
    res.status(500).json({ success: false, error: 'Failed to get demo account' });
  }
});

// ─── Get demo balances ────────────────────────────────────────────────────────
router.get('/balances', requireUserAuth, async (req, res) => {
  try {
    const account = await demoTradingService.getOrCreateAccount(req.user._id);

    const balances = {};
    if (account.balances) {
      for (const [currency, amount] of account.balances) {
        const rounded = roundBalance(amount || 0);
        balances[currency] = {
          available: parseFloat(rounded.toFixed(8)),
          locked: 0,
          total: parseFloat(rounded.toFixed(8))
        };
      }
    }

    res.json({ success: true, data: balances });
  } catch (error) {
    console.error('Error fetching demo balances:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch demo balances' });
  }
});

// ─── Place demo order (buy/sell) ──────────────────────────────────────────────
router.post('/orders', requireUserAuth, async (req, res) => {
  try {
    const { pair, side, type, amount, price, usdtValue, marketPrice } = req.body;

    // Validate required fields
    if (!pair || !side || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: pair, side, amount'
      });
    }

    if (!['buy', 'sell'].includes(side)) {
      return res.status(400).json({ success: false, error: 'Invalid side. Must be "buy" or "sell"' });
    }

    if (amount <= 0) {
      return res.status(400).json({ success: false, error: 'Amount must be greater than 0' });
    }

    const [baseCurrency, quoteCurrency] = pair.split('/');
    if (!baseCurrency || !quoteCurrency) {
      return res.status(400).json({ success: false, error: 'Invalid trading pair format' });
    }

    // Get demo account
    const account = await demoTradingService.getOrCreateAccount(req.user._id);

    // Get current market price
    const currentPrice = await demoTradingService.getMarketPrice(pair, marketPrice || price);

    let result;
    if (side === 'buy') {
      result = await demoTradingService.executeBuy(account, pair, parseFloat(amount), currentPrice, usdtValue);
    } else {
      result = await demoTradingService.executeSell(account, pair, parseFloat(amount), currentPrice);
    }

    // Format response balances
    const balances = {};
    for (const [currency, amt] of result.account.balances) {
      balances[currency] = {
        available: parseFloat(roundBalance(amt).toFixed(8)),
        locked: 0,
        total: parseFloat(roundBalance(amt).toFixed(8))
      };
    }

    res.status(201).json({
      success: true,
      message: `Demo ${side} order executed successfully`,
      data: {
        tradeId: result.trade.tradeId,
        pair: result.trade.pair,
        side: result.trade.side,
        type: 'market',
        amount: result.trade.amount,
        price: result.trade.price,
        totalValue: result.trade.totalValue,
        profitLoss: result.trade.profitLoss || 0,
        profitLossPercent: result.trade.profitLossPercent || 0,
        status: result.trade.status,
        executedAt: result.trade.executedAt,
        balances,
        isDemo: true
      }
    });
  } catch (error) {
    console.error('Error placing demo order:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to place demo order' });
  }
});

// ─── Get demo trade history ───────────────────────────────────────────────────
router.get('/trades', requireUserAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, pair } = req.query;
    const result = await demoTradingService.getTradeHistory(req.user._id, {
      page: parseInt(page),
      limit: parseInt(limit),
      pair
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching demo trades:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch demo trades' });
  }
});

// ─── Get demo orders (same as trades since market orders execute instantly) ───
router.get('/orders', requireUserAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, pair } = req.query;
    const result = await demoTradingService.getTradeHistory(req.user._id, {
      page: parseInt(page),
      limit: parseInt(limit),
      pair
    });

    // Map trades to order-like format
    const orders = result.trades.map(t => ({
      orderId: t.tradeId,
      pair: t.pair,
      side: t.side,
      type: t.type,
      amount: t.amount,
      price: t.price,
      totalValue: t.totalValue,
      status: 'filled',
      filledAmount: t.amount,
      remainingAmount: 0,
      averagePrice: t.price,
      createdAt: t.createdAt,
      filledAt: t.executedAt
    }));

    res.json({
      success: true,
      data: {
        orders,
        pagination: result.pagination
      }
    });
  } catch (error) {
    console.error('Error fetching demo orders:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch demo orders' });
  }
});

// ─── Get demo account stats ──────────────────────────────────────────────────
router.get('/stats', requireUserAuth, async (req, res) => {
  try {
    const stats = await demoTradingService.getAccountStats(req.user._id);
    if (!stats) {
      return res.status(404).json({ success: false, error: 'Demo account not found' });
    }

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching demo stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch demo stats' });
  }
});

// ─── Reset demo account ──────────────────────────────────────────────────────
router.post('/reset', requireUserAuth, async (req, res) => {
  try {
    const account = await demoTradingService.resetAccount(req.user._id);

    res.json({
      success: true,
      message: 'Demo account reset to $100,000 USDT',
      data: {
        balances: {
          USDT: { available: 100000, locked: 0, total: 100000 }
        },
        resetCount: account.resetCount,
        totalTrades: 0,
        totalProfitLoss: 0
      }
    });
  } catch (error) {
    console.error('Error resetting demo account:', error);
    res.status(500).json({ success: false, error: 'Failed to reset demo account' });
  }
});

module.exports = router;
