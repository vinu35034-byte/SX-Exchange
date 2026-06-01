const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Banner = require('../models/banner');
const requireAdminAuth = require('../middlewares/requireAdminAuth');

// Multer storage for banner images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/banners'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'banner-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// GET /api/v1/admin/banners — list all banners (admin)
router.get('/', requireAdminAuth, async (req, res) => {
  try {
    const banners = await Banner.find().sort({ order: 1, createdAt: 1 });
    res.json({ success: true, banners });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/admin/banners — upload a new banner
router.post('/', requireAdminAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Image file is required' });
    }

    const count = await Banner.countDocuments();
    const banner = new Banner({
      imageUrl: `/uploads/banners/${req.file.filename}`,
      title: req.body.title || '',
      order: count,
      isActive: req.body.isActive !== 'false',
    });

    await banner.save();
    res.status(201).json({ success: true, banner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/v1/admin/banners/:id — update banner (image optional)
router.put('/:id', requireAdminAuth, upload.single('image'), async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    if (req.file) {
      // Delete old image
      const oldPath = path.join(__dirname, '..', banner.imageUrl);
      try { await fs.unlink(oldPath); } catch (_) {}
      banner.imageUrl = `/uploads/banners/${req.file.filename}`;
    }

    if (req.body.title !== undefined) banner.title = req.body.title;
    if (req.body.order !== undefined) banner.order = Number(req.body.order);
    if (req.body.isActive !== undefined) banner.isActive = req.body.isActive !== 'false';

    await banner.save();
    res.json({ success: true, banner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/v1/admin/banners/:id
router.delete('/:id', requireAdminAuth, async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }
    // Delete image file
    const filePath = path.join(__dirname, '..', banner.imageUrl);
    try { await fs.unlink(filePath); } catch (_) {}
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/v1/admin/banners/reorder — save new order array [{ id, order }]
router.put('/reorder/save', requireAdminAuth, async (req, res) => {
  try {
    const { items } = req.body; // [{ id: '...', order: 0 }, ...]
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'items array required' });
    }
    await Promise.all(
      items.map(({ id, order }) => Banner.findByIdAndUpdate(id, { order }))
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Public GET — active banners only (no auth required)
router.get('/public', async (req, res) => {
  try {
    const banners = await Banner.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
    res.json({ success: true, banners });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
