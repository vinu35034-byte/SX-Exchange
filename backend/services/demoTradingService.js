const DemoAccount = require('../models/demoAccount');
const DemoTrade = require('../models/demoTrade');
const SpecialToken = require('../models/specialToken');
const realTimeMarketData = require('./realTimeMarketData');
const { createLogger } = require('../utils/logger');

const logger = createLogger('demo-trading-service');

const INITIAL_DEMO_BALANCE = 100000; // $100k USDT

// Helper function to round balances
const roundBalance = (amount, decimals = 8) => {
  if (typeof amount !== 'number' || isNaN(amount)) return 0;
  const rounded = Math.round(amount * Math.pow(10, decimals)) / Math.pow(10, decimals);
  return Math.abs(rounded) < Math.pow(10, -decimals) ? 0 : rounded;
};

class DemoTradingService {

  /**
   * Get or create a demo account for the user
   */
  async getOrCreateAccount(userId) {
    let account = await DemoAccount.findOne({ userId, isActive: true });
    if (!account) {
      account = await DemoAccount.create({
        userId,
        balances: new Map([['USDT', INITIAL_DEMO_BALANCE]]),
        initialBalance: INITIAL_DEMO_BALANCE
      });
      logger.info('Demo account created', { userId });
    }
    return account;
  }

  /**
   * Get current market price for a trading pair
   */
  async getMarketPrice(pair, providedPrice) {
    // Use frontend-provided price if available
    if (providedPrice && providedPrice > 0) {
      return providedPrice;
    }

    const [baseCurrency] = pair.split('/');

    // Check special token
    const specialToken = await SpecialToken.findOne({ symbol: baseCurrency });
    if (specialToken) {
      return specialToken.currentPrice;
    }

    // Try real-time market data
    const rtPrice = realTimeMarketData.getCurrentPrice(pair);
    if (rtPrice) return rtPrice;

    // Fallback prices
    const fallbacks = {
      'BTC/USDT': 117500,
      'ETH/USDT': 3200,
      'BNB/USDT': 580,
      'SOL/USDT': 180,
      'ADA/USDT': 0.45,
      'DOT/USDT': 7.5,
      'XRP/USDT': 0.62,
      'DOGE/USDT': 0.08
    };

    return fallbacks[pair] || 100;
  }

  /**
   * Place a demo buy order
   */
  async executeBuy(account, pair, amount, price, usdtValue) {
    const [baseCurrency, quoteCurrency] = pair.split('/');

    // Calculate cost
    const usdtCost = usdtValue && usdtValue > 0 ? usdtValue : amount * price;
    const finalAmount = usdtValue && usdtValue > 0 ? usdtValue / price : amount;

    // Check USDT balance
    const usdtBalance = account.balances.get(quoteCurrency) || 0;
    if (usdtBalance < usdtCost - 1e-6) {
      throw new Error(`Insufficient ${quoteCurrency} balance. Need ${usdtCost.toFixed(2)} but have ${usdtBalance.toFixed(2)}`);
    }

    // Snapshot balances before trade
    const balanceBefore = new Map(account.balances);

    // Deduct USDT
    const newUsdtBalance = roundBalance(usdtBalance - usdtCost);
    account.balances.set(quoteCurrency, newUsdtBalance);

    // Add crypto
    const currentCrypto = account.balances.get(baseCurrency) || 0;
    account.balances.set(baseCurrency, roundBalance(currentCrypto + finalAmount));

    // Update purchase price (weighted average)
    if (!account.purchasePrices) account.purchasePrices = new Map();
    const existingAmount = currentCrypto;
    const existingPrice = account.purchasePrices.get(baseCurrency) || price;
    const totalAmount = existingAmount + finalAmount;
    const weightedAvg = totalAmount > 0
      ? ((existingAmount * existingPrice) + (finalAmount * price)) / totalAmount
      : price;
    account.purchasePrices.set(baseCurrency, weightedAvg);

    // Add purchase lot
    if (!account.purchaseHistory) account.purchaseHistory = [];
    account.purchaseHistory.push({
      token: baseCurrency,
      amount: finalAmount,
      price,
      usdtValue: usdtCost,
      purchasedAt: new Date(),
      remainingAmount: finalAmount
    });

    // Update stats
    account.totalTrades += 1;

    await account.save();

    // Create trade record
    const tradeId = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const trade = await DemoTrade.create({
      userId: account.userId,
      demoAccountId: account._id,
      tradeId,
      pair,
      side: 'buy',
      type: 'market',
      amount: finalAmount,
      price,
      totalValue: usdtCost,
      balanceBefore: Object.fromEntries(balanceBefore),
      balanceAfter: Object.fromEntries(account.balances),
      status: 'completed',
      executedAt: new Date()
    });

    logger.info('Demo buy executed', {
      userId: account.userId.toString(),
      pair,
      amount: finalAmount,
      price,
      usdtCost
    });

    return { trade, account, finalAmount, usdtCost };
  }

  /**
   * Place a demo sell order
   */
  async executeSell(account, pair, amount, price) {
    const [baseCurrency, quoteCurrency] = pair.split('/');

    // Check crypto balance
    const cryptoBalance = account.balances.get(baseCurrency) || 0;
    if (cryptoBalance < amount - 1e-6) {
      throw new Error(`Insufficient ${baseCurrency} balance. Have ${cryptoBalance.toFixed(8)} but trying to sell ${amount.toFixed(8)}`);
    }

    // Get purchase price for P&L calculation
    const purchasePrice = account.purchasePrices?.get(baseCurrency) || price;
    const usdtReceived = amount * price;
    const costBasis = amount * purchasePrice;
    const profitLoss = usdtReceived - costBasis;
    const profitLossPercent = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;

    // Snapshot balances before trade
    const balanceBefore = new Map(account.balances);

    // Deduct crypto
    account.balances.set(baseCurrency, roundBalance(cryptoBalance - amount));

    // Add USDT
    const currentUsdt = account.balances.get(quoteCurrency) || 0;
    account.balances.set(quoteCurrency, roundBalance(currentUsdt + usdtReceived));

    // Consume purchase lots (FIFO)
    let remainingToSell = amount;
    if (account.purchaseHistory) {
      const lots = account.purchaseHistory
        .filter(h => h.token === baseCurrency && h.remainingAmount > 0)
        .sort((a, b) => a.purchasedAt - b.purchasedAt);

      for (const lot of lots) {
        if (remainingToSell <= 0) break;
        const consume = Math.min(remainingToSell, lot.remainingAmount);
        lot.remainingAmount -= consume;
        remainingToSell -= consume;
      }
    }

    // If crypto balance is now 0, clear purchase price
    const newCryptoBalance = account.balances.get(baseCurrency) || 0;
    if (newCryptoBalance <= 1e-8) {
      account.purchasePrices?.delete(baseCurrency);
      account.balances.delete(baseCurrency);
    }

    // Update stats
    account.totalTrades += 1;
    account.totalProfitLoss = roundBalance((account.totalProfitLoss || 0) + profitLoss);
    if (profitLoss >= 0) {
      account.winCount += 1;
    } else {
      account.lossCount += 1;
    }

    await account.save();

    // Create trade record
    const tradeId = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const trade = await DemoTrade.create({
      userId: account.userId,
      demoAccountId: account._id,
      tradeId,
      pair,
      side: 'sell',
      type: 'market',
      amount,
      price,
      totalValue: usdtReceived,
      profitLoss: roundBalance(profitLoss),
      profitLossPercent: parseFloat(profitLossPercent.toFixed(2)),
      balanceBefore: Object.fromEntries(balanceBefore),
      balanceAfter: Object.fromEntries(account.balances),
      status: 'completed',
      executedAt: new Date()
    });

    logger.info('Demo sell executed', {
      userId: account.userId.toString(),
      pair,
      amount,
      price,
      usdtReceived,
      profitLoss: roundBalance(profitLoss)
    });

    return { trade, account, usdtReceived, profitLoss, profitLossPercent };
  }

  /**
   * Reset demo account back to initial $100k
   */
  async resetAccount(userId) {
    const account = await DemoAccount.findOne({ userId, isActive: true });
    if (!account) {
      throw new Error('Demo account not found');
    }

    account.balances = new Map([['USDT', INITIAL_DEMO_BALANCE]]);
    account.purchasePrices = new Map();
    account.purchaseHistory = [];
    account.totalTrades = 0;
    account.totalProfitLoss = 0;
    account.winCount = 0;
    account.lossCount = 0;
    account.resetCount += 1;
    account.lastResetAt = new Date();

    await account.save();

    // Optionally delete old demo trades
    await DemoTrade.deleteMany({ demoAccountId: account._id });

    logger.info('Demo account reset', { userId: userId.toString(), resetCount: account.resetCount });

    return account;
  }

  /**
   * Get trade history for a demo account
   */
  async getTradeHistory(userId, options = {}) {
    const { page = 1, limit = 50, pair } = options;
    const query = { userId };
    if (pair) query.pair = pair;

    const trades = await DemoTrade.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    const total = await DemoTrade.countDocuments(query);

    return {
      trades,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get demo account statistics
   */
  async getAccountStats(userId) {
    const account = await DemoAccount.findOne({ userId, isActive: true });
    if (!account) return null;

    const usdtBalance = account.balances.get('USDT') || 0;

    // Calculate portfolio value (USDT + estimated value of all holdings)
    let portfolioValue = usdtBalance;
    const holdings = [];

    for (const [currency, amount] of account.balances) {
      if (currency === 'USDT' || amount <= 0) continue;
      const price = await this.getMarketPrice(`${currency}/USDT`, null);
      const value = amount * price;
      portfolioValue += value;
      holdings.push({
        currency,
        amount: roundBalance(amount),
        price,
        value: roundBalance(value),
        purchasePrice: account.purchasePrices?.get(currency) || 0,
        unrealizedPnl: roundBalance(value - (amount * (account.purchasePrices?.get(currency) || price)))
      });
    }

    return {
      totalEquity: roundBalance(portfolioValue),
      usdtBalance: roundBalance(usdtBalance),
      initialBalance: account.initialBalance,
      totalProfitLoss: roundBalance(portfolioValue - account.initialBalance),
      pnlPercentage: parseFloat(((portfolioValue - account.initialBalance) / account.initialBalance * 100).toFixed(2)),
      totalTrades: account.totalTrades,
      winCount: account.winCount,
      lossCount: account.lossCount,
      winRate: account.winCount + account.lossCount > 0
        ? parseFloat(((account.winCount / (account.winCount + account.lossCount)) * 100).toFixed(1))
        : 0,
      resetCount: account.resetCount,
      holdings,
      createdAt: account.createdAt
    };
  }
}

module.exports = new DemoTradingService();
