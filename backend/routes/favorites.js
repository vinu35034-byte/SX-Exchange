const express = require('express');
const requireUserAuth = require('../middlewares/requireUserAuth');
const User = require('../models/user');

const router = express.Router();

// GET /api/v1/user/favorites — return user's favorites
router.get('/favorites', requireUserAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('favorites').lean();
    res.json({ success: true, favorites: user.favorites || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch favorites' });
  }
});

// POST /api/v1/user/favorites/toggle — toggle a single coin symbol
router.post('/favorites/toggle', requireUserAuth, async (req, res) => {
  try {
    const { symbol } = req.body;
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid symbol' });
    }
    const sym = symbol.toUpperCase().trim();
    const user = await User.findById(req.user._id).select('favorites');
    const idx = user.favorites.indexOf(sym);
    if (idx === -1) {
      user.favorites.push(sym);
    } else {
      user.favorites.splice(idx, 1);
    }
    await user.save();
    res.json({ success: true, favorites: user.favorites });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update favorites' });
  }
});

module.exports = router;
