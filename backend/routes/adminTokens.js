const express = require('express');
const router = express.Router();
const Coin = require('../models/coin');
const MarketTicker = require('../models/marketTicker');
const requireAdminAuth = require('../middlewares/requireAdminAuth');
const { escapeRegex } = require('../middlewares/securityMiddleware');

// Get all tokens (admin view)
router.get('/tokens', requireAdminAuth, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    
    let query = {};
    
    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Search by name or symbol
    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { symbol: { $regex: safeSearch, $options: 'i' } }
      ];
    }
    
    const tokens = await Coin.find(query)
      .populate('addedBy', 'username')
      .populate('approvedBy', 'username')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Coin.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        tokens,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tokens'
    });
  }
});

// Add new token
router.post('/tokens', requireAdminAuth, async (req, res) => {
  try {
    const {
      symbol,
      name,
      description,
      websiteUrl,
      logoUrl,
      contractAddress,
      network,
      decimals,
      priceUSD,
      isVisible,
      isTradingEnabled,
      tradingPairs
    } = req.body;

    // Validate required fields
    if (!symbol || !name) {
      return res.status(400).json({
        success: false,
        error: 'Symbol and name are required'
      });
    }

    // Check if token already exists
    const existingToken = await Coin.findOne({ symbol: symbol.toUpperCase() });
    if (existingToken) {
      return res.status(400).json({
        success: false,
        error: 'Token with this symbol already exists'
      });
    }

    // Create new token
    const newToken = new Coin({
      symbol: symbol.toUpperCase(),
      name,
      description,
      websiteUrl,
      logoUrl,
      contractAddress,
      network: network || 'NATIVE',
      decimals: decimals || 18,
      priceUSD: priceUSD || 0,
      isVisible: isVisible !== undefined ? isVisible : true,
      isTradingEnabled: isTradingEnabled !== undefined ? isTradingEnabled : false,
      tradingPairs: tradingPairs || [
        { 
          quoteAsset: 'USDT', 
          isActive: true,
          minOrderSize: 0.001,
          maxOrderSize: 1000000,
          priceDecimals: 6,
          quantityDecimals: 4
        }
      ],
      addedBy: req.admin._id,
      status: 'pending_review'
    });

    const savedToken = await newToken.save();

    res.json({
      success: true,
      data: savedToken,
      message: 'Token added successfully'
    });

  } catch (error) {
    console.error('Error adding token:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add token'
    });
  }
});

// Update token
router.put('/tokens/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.addedBy;
    delete updateData.createdAt;

    const updatedToken = await Coin.findByIdAndUpdate(
      id,
      { ...updateData, lastUpdated: new Date() },
      { new: true, runValidators: true }
    );

    if (!updatedToken) {
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      });
    }

    res.json({
      success: true,
      data: updatedToken,
      message: 'Token updated successfully'
    });

  } catch (error) {
    console.error('Error updating token:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update token'
    });
  }
});

// Approve token for trading
router.post('/tokens/:id/approve', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const token = await Coin.findByIdAndUpdate(
      id,
      {
        status: 'active',
        isListedOnExchange: true,
        isTradingEnabled: true,
        isVisible: true, // Ensure token is visible when approved
        showInMarket: true, // Ensure token shows in market when approved
        approvedBy: req.admin._id,
        approvedAt: new Date()
      },
      { new: true }
    );

    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      });
    }

    // Create market tickers for approved trading pairs
    for (const pair of token.tradingPairs) {
      if (pair.isActive) {
        const tickerPair = `${token.symbol}/${pair.quoteAsset}`;
        
        // Check if ticker already exists
        const existingTicker = await MarketTicker.findOne({ pair: tickerPair });
        
        if (!existingTicker) {
          const newTicker = new MarketTicker({
            pair: tickerPair,
            lastPrice: token.priceUSD || 1.0,
            openPrice: token.priceUSD || 1.0,
            highPrice: (token.priceUSD || 1.0) * 1.05,
            lowPrice: (token.priceUSD || 1.0) * 0.95,
            volume24h: 0,
            change24h: 0
          });
          
          await newTicker.save();
        }
      }
    }

    // Refresh real-time market data service with new trading pairs
    try {
      const realTimeMarketData = require('../services/realTimeMarketData');
      
      // Add each trading pair to real-time tracking
      for (const pair of token.tradingPairs) {
        if (pair.isActive) {
          const pairSymbol = `${token.symbol}/${pair.quoteAsset}`;
          await realTimeMarketData.addTradingPair(pairSymbol, token.priceUSD);
        }
      }
      
    } catch (refreshError) {
      console.error('Warning: Failed to add real-time tracking:', refreshError);
      // Don't fail the token approval if real-time service fails
    }

    res.json({
      success: true,
      data: token,
      message: 'Token approved and activated for trading'
    });

  } catch (error) {
    console.error('Error approving token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve token'
    });
  }
});

// Disable token trading
router.post('/tokens/:id/disable', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const token = await Coin.findByIdAndUpdate(
      id,
      {
        isTradingEnabled: false,
        isListedOnExchange: false
      },
      { new: true }
    );

    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      });
    }

    res.json({
      success: true,
      data: token,
      message: 'Token trading disabled'
    });

  } catch (error) {
    console.error('Error disabling token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable token'
    });
  }
});

// Delete token
router.delete('/tokens/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const token = await Coin.findById(id);
    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      });
    }

    // Remove associated market tickers
    for (const pair of token.tradingPairs) {
      const tickerPair = `${token.symbol}/${pair.quoteAsset}`;
      await MarketTicker.findOneAndDelete({ pair: tickerPair });
    }

    await Coin.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Token deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete token'
    });
  }
});

// Get trading pairs for a token
router.get('/tokens/:id/pairs', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const token = await Coin.findById(id);
    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      });
    }

    res.json({
      success: true,
      data: token.tradingPairs
    });

  } catch (error) {
    console.error('Error fetching trading pairs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trading pairs'
    });
  }
});

// Update trading pairs for a token
router.put('/tokens/:id/pairs', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { tradingPairs } = req.body;

    const token = await Coin.findByIdAndUpdate(
      id,
      { tradingPairs },
      { new: true }
    );

    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      });
    }

    res.json({
      success: true,
      data: token.tradingPairs,
      message: 'Trading pairs updated successfully'
    });

  } catch (error) {
    console.error('Error updating trading pairs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update trading pairs'
    });
  }
});

module.exports = router;
