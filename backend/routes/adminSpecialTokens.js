const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const SpecialToken = require('../models/specialToken');
const requireAdminAuth = require('../middlewares/requireAdminAuth');
const { escapeRegex } = require('../middlewares/securityMiddleware');

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/logos'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'special-token-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Get all special tokens (admin view)
router.get('/special-tokens', requireAdminAuth, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    
    let query = {};
    
    // Filter by status
    if (status && status !== 'all') {
      if (status === 'active') {
        query.isActive = true;
      } else if (status === 'inactive') {
        query.isActive = false;
      }
    }
    
    // Search by name or symbol
    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { symbol: { $regex: safeSearch, $options: 'i' } }
      ];
    }
    
    const tokens = await SpecialToken.find(query)
      .populate('createdBy', 'username')
      .populate('lastUpdatedBy', 'username')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await SpecialToken.countDocuments(query);
    
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
    console.error('Error fetching special tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch special tokens'
    });
  }
});

// Get a single special token
router.get('/special-tokens/:id', requireAdminAuth, async (req, res) => {
  try {
    const token = await SpecialToken.findById(req.params.id)
      .populate('createdBy', 'username')
      .populate('lastUpdatedBy', 'username');
    
    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Special token not found'
      });
    }
    
    res.json({
      success: true,
      data: token
    });
    
  } catch (error) {
    console.error('Error fetching special token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch special token'
    });
  }
});

// Create a new special token
router.post('/special-tokens', requireAdminAuth, upload.single('logo'), async (req, res) => {
  try {
    const {
      symbol,
      name,
      priceMin,
      priceMax,
      currentPrice,
      logoUrl,
      simulationType,
      simulationInterval,
      volatility,
      trendDirection,
      amplitude,
      frequency,
      targetPercentage,
      targetTimeframe,
      description,
      tooltip,
      badgeText,
      badgeColor,
      backgroundColor,
      isActive,
      showInMarket,
      marketPriority
    } = req.body;

    // Validation
    if (!symbol || !name || !priceMin || !priceMax) {
      return res.status(400).json({
        success: false,
        error: 'Symbol, name, and price range are required'
      });
    }

    const minPrice = parseFloat(priceMin);
    const maxPrice = parseFloat(priceMax);
    const current = parseFloat(currentPrice) || (minPrice + maxPrice) / 2;

    if (minPrice >= maxPrice) {
      return res.status(400).json({
        success: false,
        error: 'Minimum price must be less than maximum price'
      });
    }

    if (current < minPrice || current > maxPrice) {
      return res.status(400).json({
        success: false,
        error: 'Current price must be within the specified range'
      });
    }

    // Check if symbol already exists
    const existingToken = await SpecialToken.findOne({ symbol: symbol.toUpperCase() });
    if (existingToken) {
      return res.status(400).json({
        success: false,
        error: 'A special token with this symbol already exists'
      });
    }

    // Handle logo URL
    let finalLogoUrl = logoUrl;
    if (req.file) {
      finalLogoUrl = `/uploads/logos/${req.file.filename}`;
    }

    // Use default logo if none provided
    if (!finalLogoUrl) {
      finalLogoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(symbol)}&background=1a1a2e&color=00d4ff&size=64&bold=true&format=png`;
    }

    // Create new special token
    const newToken = new SpecialToken({
      symbol: symbol.toUpperCase(),
      name,
      priceRange: {
        min: minPrice,
        max: maxPrice
      },
      currentPrice: current,
      logoUrl: finalLogoUrl,
      simulationConfig: {
        type: simulationType || 'random_walk',
        interval: parseInt(simulationInterval) || 30,
        volatility: parseFloat(volatility) || 0.02,
        trendDirection: trendDirection || 'neutral',
        amplitude: parseFloat(amplitude) || 0.1,
        frequency: parseFloat(frequency) || 1,
        targetPercentage: parseFloat(targetPercentage) || 0,
        targetTimeframe: parseInt(targetTimeframe) || 3600
      },
      isActive: isActive !== 'false',
      showInMarket: showInMarket !== 'false',
      marketPriority: parseInt(marketPriority) || 0,
      description: description || 'This is a simulated token for demonstration purposes.',
      tooltip: tooltip || 'Simulated token with demo price movements',
      badge: {
        text: badgeText || 'SPECIAL',
        color: badgeColor || '#10B981',
        backgroundColor: backgroundColor || '#065F46'
      },
      createdBy: req.admin._id,
      lastUpdatedBy: req.admin._id
    });

    await newToken.save();

    res.status(201).json({
      success: true,
      data: newToken,
      message: 'Special token created successfully'
    });

  } catch (error) {
    console.error('Error creating special token:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting uploaded file:', unlinkError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create special token'
    });
  }
});

// Update a special token
router.put('/special-tokens/:id', requireAdminAuth, upload.single('logo'), async (req, res) => {
  try {
    const token = await SpecialToken.findById(req.params.id);
    
    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Special token not found'
      });
    }

    const {
      symbol,
      name,
      priceMin,
      priceMax,
      currentPrice,
      logoUrl,
      simulationType,
      simulationInterval,
      volatility,
      trendDirection,
      amplitude,
      frequency,
      targetPercentage,
      targetTimeframe,
      description,
      tooltip,
      badgeText,
      badgeColor,
      backgroundColor,
      isActive,
      showInMarket,
      marketPriority
    } = req.body;

    // Update basic fields
    if (symbol) token.symbol = symbol.toUpperCase();
    if (name) token.name = name;
    if (description) token.description = description;
    if (tooltip) token.tooltip = tooltip;

    // Update price range
    if (priceMin !== undefined || priceMax !== undefined) {
      const minPrice = priceMin !== undefined ? parseFloat(priceMin) : token.priceRange.min;
      const maxPrice = priceMax !== undefined ? parseFloat(priceMax) : token.priceRange.max;
      
      if (minPrice >= maxPrice) {
        return res.status(400).json({
          success: false,
          error: 'Minimum price must be less than maximum price'
        });
      }
      
      token.priceRange.min = minPrice;
      token.priceRange.max = maxPrice;
    }

    // Update current price
    if (currentPrice !== undefined) {
      const current = parseFloat(currentPrice);
      if (current < token.priceRange.min || current > token.priceRange.max) {
        return res.status(400).json({
          success: false,
          error: 'Current price must be within the specified range'
        });
      }
      token.currentPrice = current;
    }

    // Handle logo update
    if (req.file) {
      // Delete old logo file if it's a local file
      if (token.logoUrl && token.logoUrl.startsWith('/uploads/')) {
        try {
          const oldLogoPath = path.join(__dirname, '../', token.logoUrl);
          await fs.unlink(oldLogoPath);
        } catch (error) {
          console.warn('Could not delete old logo file:', error.message);
        }
      }
      token.logoUrl = `/uploads/logos/${req.file.filename}`;
    } else if (logoUrl) {
      token.logoUrl = logoUrl;
    }

    // Update simulation config
    if (simulationType) token.simulationConfig.type = simulationType;
    if (simulationInterval !== undefined) token.simulationConfig.interval = parseInt(simulationInterval);
    if (volatility !== undefined) token.simulationConfig.volatility = parseFloat(volatility);
    if (trendDirection) token.simulationConfig.trendDirection = trendDirection;
    if (amplitude !== undefined) token.simulationConfig.amplitude = parseFloat(amplitude);
    if (frequency !== undefined) token.simulationConfig.frequency = parseFloat(frequency);
    if (targetPercentage !== undefined) token.simulationConfig.targetPercentage = parseFloat(targetPercentage);
    if (targetTimeframe !== undefined) token.simulationConfig.targetTimeframe = parseInt(targetTimeframe);

    // Update display settings
    if (isActive !== undefined) token.isActive = isActive !== 'false';
    if (showInMarket !== undefined) token.showInMarket = showInMarket !== 'false';
    if (marketPriority !== undefined) token.marketPriority = parseInt(marketPriority);

    // Update badge
    if (badgeText) token.badge.text = badgeText;
    if (badgeColor) token.badge.color = badgeColor;
    if (backgroundColor) token.badge.backgroundColor = backgroundColor;

    // Update admin tracking
    token.lastUpdatedBy = req.admin._id;

    await token.save();

    res.json({
      success: true,
      data: token,
      message: 'Special token updated successfully'
    });

  } catch (error) {
    console.error('Error updating special token:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting uploaded file:', unlinkError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update special token'
    });
  }
});

// Delete a special token
router.delete('/special-tokens/:id', requireAdminAuth, async (req, res) => {
  try {
    const token = await SpecialToken.findById(req.params.id);
    
    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Special token not found'
      });
    }

    // Delete logo file if it's a local file
    if (token.logoUrl && token.logoUrl.startsWith('/uploads/')) {
      try {
        const logoPath = path.join(__dirname, '../', token.logoUrl);
        await fs.unlink(logoPath);
      } catch (error) {
        console.warn('Could not delete logo file:', error.message);
      }
    }

    await SpecialToken.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Special token deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting special token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete special token'
    });
  }
});

// Toggle special token status (activate/deactivate)
router.patch('/special-tokens/:id/toggle', requireAdminAuth, async (req, res) => {
  try {
    const token = await SpecialToken.findById(req.params.id);
    
    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Special token not found'
      });
    }

    token.isActive = !token.isActive;
    token.lastUpdatedBy = req.admin._id;
    
    await token.save();

    res.json({
      success: true,
      data: token,
      message: `Special token ${token.isActive ? 'activated' : 'deactivated'} successfully`
    });

  } catch (error) {
    console.error('Error toggling special token status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle special token status'
    });
  }
});

// Manually trigger price simulation for a token
router.post('/special-tokens/:id/simulate', requireAdminAuth, async (req, res) => {
  try {
    const updatedToken = await SpecialToken.simulatePriceUpdate(req.params.id);
    
    if (!updatedToken) {
      return res.status(404).json({
        success: false,
        error: 'Special token not found'
      });
    }

    res.json({
      success: true,
      data: updatedToken,
      message: 'Price simulation executed successfully'
    });

  } catch (error) {
    console.error('Error simulating price update:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to simulate price update'
    });
  }
});

// Get special token statistics
router.get('/special-tokens/:id/stats', requireAdminAuth, async (req, res) => {
  try {
    const token = await SpecialToken.findById(req.params.id);
    
    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Special token not found'
      });
    }

    const stats = {
      basicStats: token.stats,
      priceStats24h: token.priceStats24h,
      priceChangePercent: token.priceChangePercent,
      currentPrice: token.currentPrice,
      priceRange: token.priceRange,
      recentPriceHistory: token.priceHistory.slice(-100), // Last 100 updates
      simulationConfig: token.simulationConfig,
      lastUpdate: token.lastSimulationUpdate
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching special token stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch special token statistics'
    });
  }
});

module.exports = router;
