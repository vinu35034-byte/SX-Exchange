import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, RefreshCw, BookOpen, ChevronRight, Clock, Tag } from 'lucide-react';
import Menu from './Menu';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

const CATEGORIES = ['all', 'news', 'tutorial', 'market', 'product', 'security', 'other'];

const categoryColor = {
  news:     'bg-blue-50 text-blue-600',
  tutorial: 'bg-green-50 text-green-600',
  market:   'bg-purple-50 text-purple-600',
  product:  'bg-orange-50 text-orange-600',
  security: 'bg-red-50 text-red-600',
  other:    'bg-gray-50 text-gray-600',
};

const Blog = () => {
  const navigate    = useNavigate();
  const { t }       = useTranslation();

  const [posts, setPosts]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory]   = useState('all');

  const fetchPosts = async (cat = category) => {
    try {
      const q = cat !== 'all' ? `?category=${cat}` : '';
      const res = await fetch(`${BASE_URL}/api/v1/blog${q}`);
      const data = await res.json();
      setPosts(data.data || []);
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchPosts(category); }, [category]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPosts(category);
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';

  return (
    <div className="min-h-screen bg-[#F5F7FA]">

      {/* Blue hero */}
      <div className="bg-linear-to-br from-[#0052FF] to-[#0041CC]">
        <div className="w-full max-w-md mx-auto px-4 pt-6 pb-20">

          {/* Top bar */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-white font-bold text-lg">{t('blog.blog')}</h1>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Subtitle */}
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mb-4">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-white font-bold text-xl mb-1">{t('blog.latestNews')}</h2>
            <p className="text-white/70 text-sm">{t('blog.subtitle')}</p>
          </div>

        </div>
      </div>

      {/* Content */}
      <div className="w-full max-w-md mx-auto px-4 -mt-10 pb-32">

        {/* Category filter */}
        <div className="mb-4 overflow-x-auto">
          <div className="flex gap-2 pb-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  category === cat
                    ? 'bg-[#0052FF] text-white'
                    : 'bg-white text-[#555555] shadow-sm hover:bg-[#F0F5FF]'
                }`}
              >
                {t(`blog.cat_${cat}`, { defaultValue: cat.charAt(0).toUpperCase() + cat.slice(1) })}
              </button>
            ))}
          </div>
        </div>

        {/* Posts */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm px-4 py-10 flex justify-center">
            <div className="w-8 h-8 border-2 border-[#0052FF]/20 border-t-[#0052FF] rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm px-4 py-10 text-center">
            <BookOpen className="w-10 h-10 text-[#CCCCCC] mx-auto mb-3" />
            <p className="text-sm font-semibold text-[#111111] mb-1">{t('blog.noPosts')}</p>
            <p className="text-xs text-[#888888]">{t('blog.checkBack')}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {posts.map((post, idx) => (
              <button
                key={post._id}
                onClick={() => navigate(`/blog/${post.slug}`)}
                className={`w-full text-left flex items-start gap-3 px-4 py-4 hover:bg-[#FAFAFA] transition-colors ${
                  idx < posts.length - 1 ? 'border-b border-[#F0F0F0]' : ''
                }`}
              >
                {/* Cover thumbnail */}
                {post.coverImage ? (
                  <img
                    src={post.coverImage.startsWith('http') ? post.coverImage : `${BASE_URL}${post.coverImage}`}
                    alt={post.title}
                    className="w-16 h-16 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
                    <BookOpen className="w-6 h-6 text-[#0052FF]" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {/* Category + date */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${categoryColor[post.category] || categoryColor.other}`}>
                      {post.category}
                    </span>
                    <span className="text-[10px] text-[#AAAAAA] flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {formatDate(post.publishedAt || post.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-[#111111] leading-snug line-clamp-2">{post.title}</p>
                  <p className="text-xs text-[#888888] mt-0.5 line-clamp-1">{post.summary}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#AAAAAA] shrink-0 mt-4" />
              </button>
            ))}
          </div>
        )}

      </div>

      <Menu />
    </div>
  );
};

export default Blog;
