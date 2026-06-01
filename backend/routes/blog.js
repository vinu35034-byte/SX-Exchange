const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');

// Public routes
router.get('/', blogController.getPublishedPosts);
router.get('/:slug', blogController.getPostBySlug);

module.exports = router;
