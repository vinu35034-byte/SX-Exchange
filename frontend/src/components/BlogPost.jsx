import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Tag, BookOpen } from 'lucide-react';
import Menu from './Menu';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

const categoryColor = {
  news:     'bg-blue-50 text-blue-600',
  tutorial: 'bg-green-50 text-green-600',
  market:   'bg-purple-50 text-purple-600',
  product:  'bg-orange-50 text-orange-600',
  security: 'bg-red-50 text-red-600',
  other:    'bg-gray-50 text-gray-600',
};

const BlogPost = () => {
  const navigate    = useNavigate();
  const { slug }    = useParams();

  const [post, setPost]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/v1/blog/${slug}`);
        if (!res.ok) { setNotFound(true); return; }
        const data = await res.json();
        if (data.success) setPost(data.data);
        else setNotFound(true);
      } catch (_) { setNotFound(true); }
      finally { setLoading(false); }
    };
    fetchPost();
  }, [slug]);

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  return (
    <div className="min-h-screen bg-[#F5F7FA]">

      {/* Blue hero */}
      <div className="bg-linear-to-br from-[#0052FF] to-[#0041CC]">
        <div className="w-full max-w-md mx-auto px-4 pt-6 pb-16">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-white font-bold text-lg">Blog</h1>
            <div className="w-9" />
          </div>
        </div>
      </div>

      <div className="w-full max-w-md mx-auto px-4 -mt-6 pb-32">

        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm px-4 py-10 flex justify-center">
            <div className="w-8 h-8 border-2 border-[#0052FF]/20 border-t-[#0052FF] rounded-full animate-spin" />
          </div>
        ) : notFound ? (
          <div className="bg-white rounded-2xl shadow-sm px-4 py-10 text-center">
            <BookOpen className="w-10 h-10 text-[#CCCCCC] mx-auto mb-3" />
            <p className="text-sm font-semibold text-[#111111] mb-1">Post not found</p>
            <button onClick={() => navigate('/blog')} className="text-xs text-[#0052FF] font-medium mt-2">
              ← Back to Blog
            </button>
          </div>
        ) : (
          <div>
            {/* Cover image */}
            {post.coverImage && (
              <div className="mb-4 rounded-2xl overflow-hidden shadow-sm">
                <img
                  src={post.coverImage.startsWith('http') ? post.coverImage : `${BASE_URL}${post.coverImage}`}
                  alt={post.title}
                  className="w-full object-cover max-h-52"
                />
              </div>
            )}

            {/* Post header card */}
            <div className="bg-white rounded-2xl shadow-sm px-4 py-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${categoryColor[post.category] || categoryColor.other}`}>
                  {post.category}
                </span>
                <span className="text-xs text-[#AAAAAA] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(post.publishedAt || post.createdAt)}
                </span>
              </div>
              <h2 className="text-lg font-bold text-[#111111] leading-snug mb-2">{post.title}</h2>
              <p className="text-sm text-[#555555] leading-relaxed">{post.summary}</p>
            </div>

            {/* Content card */}
            <div className="bg-white rounded-2xl shadow-sm px-4 py-5">
              <div
                className="text-sm text-[#333333] leading-relaxed prose-sm max-w-none"
                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {post.content}
              </div>
            </div>
          </div>
        )}

      </div>

      <Menu />
    </div>
  );
};

export default BlogPost;
