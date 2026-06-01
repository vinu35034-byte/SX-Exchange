const express = require('express');
const router = express.Router();
const requireAdminAuth = require('../middlewares/requireAdminAuth');
const blogController = require('../controllers/blogController');

router.use(requireAdminAuth);

router.get('/',           blogController.getAllPosts);
router.post('/',          blogController.createPost);
router.put('/:id',        blogController.updatePost);
router.delete('/:id',     blogController.deletePost);
router.patch('/:id/toggle', blogController.togglePublish);

module.exports = router;
