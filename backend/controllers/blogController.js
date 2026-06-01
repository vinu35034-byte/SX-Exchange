const Blog = require('../models/blog');

// ── Public ──────────────────────────────────────────────────

// GET /blog  — list published posts
exports.getPublishedPosts = async (req, res) => {
  try {
    const { category, limit = 20, page = 1 } = req.query;
    const filter = { isPublished: true };
    if (category && category !== 'all') filter.category = category;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [posts, total] = await Promise.all([
      Blog.find(filter)
        .select('title slug summary category coverImage publishedAt createdAt')
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Blog.countDocuments(filter),
    ]);

    res.json({ success: true, data: posts, total, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /blog/:slug
exports.getPostBySlug = async (req, res) => {
  try {
    const post = await Blog.findOne({ slug: req.params.slug, isPublished: true });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, data: post });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin ────────────────────────────────────────────────────

// GET /admin/blog  — all posts
exports.getAllPosts = async (req, res) => {
  try {
    const posts = await Blog.find({}).sort({ createdAt: -1 });
    res.json({ success: true, data: posts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /admin/blog
exports.createPost = async (req, res) => {
  try {
    const { title, summary, content, category, coverImage, isPublished } = req.body;
    if (!title || !summary || !content) {
      return res.status(400).json({ success: false, message: 'Title, summary and content are required' });
    }

    // Generate unique slug
    let baseSlug = title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80);
    let slug = baseSlug;
    let count = 1;
    while (await Blog.findOne({ slug })) {
      slug = `${baseSlug}-${count++}`;
    }

    const post = new Blog({
      title, summary, content, category, coverImage,
      isPublished: !!isPublished,
      publishedAt: isPublished ? new Date() : undefined,
      slug,
      createdBy: req.admin?._id,
    });

    await post.save();
    res.status(201).json({ success: true, data: post });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /admin/blog/:id
exports.updatePost = async (req, res) => {
  try {
    const post = await Blog.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const { title, summary, content, category, coverImage, isPublished } = req.body;
    if (title !== undefined) post.title = title;
    if (summary !== undefined) post.summary = summary;
    if (content !== undefined) post.content = content;
    if (category !== undefined) post.category = category;
    if (coverImage !== undefined) post.coverImage = coverImage;
    if (isPublished !== undefined) {
      if (isPublished && !post.isPublished) post.publishedAt = new Date();
      post.isPublished = isPublished;
    }

    await post.save();
    res.json({ success: true, data: post });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /admin/blog/:id
exports.deletePost = async (req, res) => {
  try {
    const post = await Blog.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /admin/blog/:id/toggle
exports.togglePublish = async (req, res) => {
  try {
    const post = await Blog.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    if (!post.isPublished && !post.publishedAt) post.publishedAt = new Date();
    post.isPublished = !post.isPublished;
    await post.save();
    res.json({ success: true, data: post });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
