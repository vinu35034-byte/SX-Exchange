const express = require('express');
const router = express.Router();
const requireAdminAuth = require('../middlewares/requireAdminAuth');
const Coin = require('../models/coin');
const SpecialToken = require('../models/specialToken');

// Get all token trading controls
router.get('/controls', requireAdminAuth, async (req, res) => {
  try {
    // Get regular coins
    const coins = await Coin.find({}, {
      symbol: 1,
      name: 1,
      tradingControls: 1,
      isVisible: 1,
      isTradingEnabled: 1
    });

    // Get special tokens
    const specialTokens = await SpecialToken.find({}, {
      symbol: 1,
      name: 1,
      tradingControls: 1,
      isActive: 1,
      showInMarket: 1
    });

    res.json({
      success: true,
      data: {
        regularTokens: coins,
        specialTokens: specialTokens
      }
    });

  } catch (error) {
    console.error('Error fetching token controls:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch token controls'
    });
  }
});

// Update regular token trading controls
router.put('/coins/:symbol/controls', requireAdminAuth, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { buyEnabled, sellEnabled, sellPriceAdjustment } = req.body;

    const coin = await Coin.findOne({ symbol: symbol.toUpperCase() });
    if (!coin) {
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      });
    }

    // Initialize tradingControls if it doesn't exist
    if (!coin.tradingControls) {
      coin.tradingControls = {};
    }

    // Update controls
    if (typeof buyEnabled === 'boolean') {
      coin.tradingControls.buyEnabled = buyEnabled;
    }
    if (typeof sellEnabled === 'boolean') {
      coin.tradingControls.sellEnabled = sellEnabled;
    }
    if (typeof sellPriceAdjustment === 'number') {
      coin.tradingControls.sellPriceAdjustment = sellPriceAdjustment;
    }

    await coin.save();

    res.json({
      success: true,
      message: `Trading controls updated for ${symbol}`,
      data: {
        symbol: coin.symbol,
        tradingControls: coin.tradingControls
      }
    });

  } catch (error) {
    console.error('Error updating coin trading controls:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update trading controls'
    });
  }
});

// Update special token trading controls
router.put('/special-tokens/:symbol/controls', requireAdminAuth, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { buyEnabled, sellEnabled, sellPriceAdjustment } = req.body;

    const specialToken = await SpecialToken.findOne({ symbol: symbol.toUpperCase() });
    if (!specialToken) {
      return res.status(404).json({
        success: false,
        error: 'Special token not found'
      });
    }

    // Initialize tradingControls if it doesn't exist
    if (!specialToken.tradingControls) {
      specialToken.tradingControls = {};
    }

    // Update controls
    if (typeof buyEnabled === 'boolean') {
      specialToken.tradingControls.buyEnabled = buyEnabled;
    }
    if (typeof sellEnabled === 'boolean') {
      specialToken.tradingControls.sellEnabled = sellEnabled;
    }
    if (typeof sellPriceAdjustment === 'number') {
      specialToken.tradingControls.sellPriceAdjustment = sellPriceAdjustment;
    }

    specialToken.lastUpdatedBy = req.admin._id;
    await specialToken.save();

    res.json({
      success: true,
      message: `Trading controls updated for ${symbol}`,
      data: {
        symbol: specialToken.symbol,
        tradingControls: specialToken.tradingControls
      }
    });

  } catch (error) {
    console.error('Error updating special token trading controls:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update trading controls'
    });
  }
});

// Get trading controls for a specific token
router.get('/tokens/:symbol/controls', requireAdminAuth, async (req, res) => {
  try {
    const { symbol } = req.params;
    const upperSymbol = symbol.toUpperCase();

    // Check regular tokens first
    let token = await Coin.findOne({ symbol: upperSymbol });
    let tokenType = 'regular';

    // If not found in regular tokens, check special tokens
    if (!token) {
      token = await SpecialToken.findOne({ symbol: upperSymbol });
      tokenType = 'special';
    }

    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      });
    }

    res.json({
      success: true,
      data: {
        symbol: token.symbol,
        name: token.name,
        type: tokenType,
        tradingControls: token.tradingControls || {
          buyEnabled: true,
          sellEnabled: true,
          sellPriceAdjustment: tokenType === 'regular' ? -1.0 : 0
        }
      }
    });

  } catch (error) {
    console.error('Error fetching token controls:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch token controls'
    });
  }
});

// Set default trading controls for all regular tokens
router.post('/coins/set-defaults', requireAdminAuth, async (req, res) => {
  try {
    const { sellPriceAdjustment = -1.0 } = req.body;

    const result = await Coin.updateMany(
      { 'tradingControls': { $exists: false } },
      {
        $set: {
          'tradingControls.buyEnabled': true,
          'tradingControls.sellEnabled': true,
          'tradingControls.sellPriceAdjustment': sellPriceAdjustment
        }
      }
    );

    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} tokens with default trading controls`,
      data: {
        modifiedCount: result.modifiedCount,
        defaultSellAdjustment: sellPriceAdjustment
      }
    });

  } catch (error) {
    console.error('Error setting default trading controls:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set default trading controls'
    });
  }
});

module.exports = router;
