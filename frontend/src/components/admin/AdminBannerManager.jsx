import { useState, useEffect, useRef } from 'react';
import { ApiUtils } from '../../services/api';
import { adminTheme } from '../../styles/adminTheme';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  PhotoIcon,
  TrashIcon,
  PlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@heroicons/react/24/outline';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

const AdminBannerManager = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');

  const flash = (type, msg) => {
    if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); }
    else { setError(msg); setTimeout(() => setError(''), 4000); }
  };

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const data = await ApiUtils.get('/admin/banners');
      setBanners(data.banners || []);
    } catch (e) {
      flash('error', 'Failed to load banners');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBanners(); }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPreviewFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!previewFile) return flash('error', 'Please select an image first');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', previewFile);
      formData.append('title', titleInput);

      const res = await fetch(`${BASE_URL}/api/v1/admin/banners`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      flash('success', 'Banner uploaded');
      setPreviewFile(null);
      setPreviewUrl('');
      setTitleInput('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchBanners();
    } catch (e) {
      flash('error', e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this banner?')) return;
    try {
      await ApiUtils.delete(`/admin/banners/${id}`);
      flash('success', 'Banner deleted');
      fetchBanners();
    } catch (e) {
      flash('error', 'Delete failed');
    }
  };

  const handleToggle = async (banner) => {
    try {
      const formData = new FormData();
      formData.append('isActive', String(!banner.isActive));
      const res = await fetch(`${BASE_URL}/api/v1/admin/banners/${banner._id}`, {
        method: 'PUT',
        body: formData,
        credentials: 'include',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      flash('success', banner.isActive ? 'Banner hidden' : 'Banner visible');
      fetchBanners();
    } catch (e) {
      flash('error', 'Update failed');
    }
  };

  const handleMove = async (index, direction) => {
    const updated = [...banners];
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= updated.length) return;
    [updated[index], updated[swapWith]] = [updated[swapWith], updated[index]];
    const items = updated.map((b, i) => ({ id: b._id, order: i }));
    try {
      await ApiUtils.put('/admin/banners/reorder/save', { items });
      setBanners(updated);
    } catch (e) {
      flash('error', 'Reorder failed');
    }
  };

  return (
    <div className={`min-h-screen ${adminTheme.primary} p-4`}>
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/u/dashboard')}
            className={`p-2 rounded-lg ${adminTheme.surface} ${adminTheme.border} border ${adminTheme.textMuted} hover:${adminTheme.textPrimary} transition-colors`}
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className={`text-2xl font-bold ${adminTheme.textPrimary}`}>Banner Manager</h1>
            <p className={`text-sm ${adminTheme.textMuted}`}>Upload and manage home page banners</p>
          </div>
        </div>

        {/* Feedback */}
        {success && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400">
            <CheckCircleIcon className="w-5 h-5 shrink-0" />
            <span className="text-sm">{success}</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400">
            <XCircleIcon className="w-5 h-5 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Upload Card */}
        <div className={`${adminTheme.card} border ${adminTheme.border} rounded-2xl p-5 mb-6`}>
          <h2 className={`text-base font-semibold ${adminTheme.textPrimary} mb-4 flex items-center gap-2`}>
            <PlusIcon className="w-5 h-5 text-[#FCD535]" />
            Upload New Banner
          </h2>

          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`relative cursor-pointer border-2 border-dashed ${adminTheme.borderAccent} rounded-xl overflow-hidden flex items-center justify-center transition-all hover:border-[#FCD535]/70`}
            style={{ minHeight: '180px' }}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="preview" className="w-full h-full object-cover max-h-64" />
            ) : (
              <div className="flex flex-col items-center gap-2 py-10">
                <PhotoIcon className="w-10 h-10 text-[#FCD535]/40" />
                <p className={`text-sm ${adminTheme.textMuted}`}>Click to select banner image</p>
                <p className={`text-xs ${adminTheme.textMuted} opacity-60`}>Any size · JPG, PNG, WebP · max 10 MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Title */}
          <input
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="Banner label (optional, for admin use only)"
            className={`mt-3 w-full ${adminTheme.surface} ${adminTheme.border} border rounded-xl px-4 py-2.5 text-sm ${adminTheme.textPrimary} placeholder-[#EAECEF]/30 focus:outline-none focus:ring-2 focus:ring-[#FCD535]/30`}
          />

          <button
            onClick={handleUpload}
            disabled={!previewFile || uploading}
            className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold bg-[#FCD535] text-[#181A20] hover:bg-[#E6C228] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {uploading ? 'Uploading…' : 'Upload Banner'}
          </button>
        </div>

        {/* Banner List */}
        <div className={`${adminTheme.card} border ${adminTheme.border} rounded-2xl p-5`}>
          <h2 className={`text-base font-semibold ${adminTheme.textPrimary} mb-4`}>
            All Banners ({banners.length})
          </h2>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-2 border-[#FCD535]/30 border-t-[#FCD535] rounded-full animate-spin" />
            </div>
          ) : banners.length === 0 ? (
            <p className={`text-center py-10 text-sm ${adminTheme.textMuted}`}>No banners yet. Upload one above.</p>
          ) : (
            <div className="space-y-3">
              {banners.map((banner, index) => {
                const imgSrc = banner.imageUrl.startsWith('http')
                  ? banner.imageUrl
                  : `${BASE_URL}${banner.imageUrl}`;
                return (
                  <div
                    key={banner._id}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${adminTheme.border} ${adminTheme.surface} ${!banner.isActive ? 'opacity-50' : ''}`}
                  >
                    {/* Thumbnail */}
                    <div className="w-24 h-14 rounded-lg overflow-hidden shrink-0 bg-[#252A33]">
                      <img src={imgSrc} alt={banner.title || 'banner'} className="w-full h-full object-cover" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${adminTheme.textPrimary} truncate`}>
                        {banner.title || `Banner ${index + 1}`}
                      </p>
                      <p className={`text-xs ${adminTheme.textMuted}`}>
                        #{index + 1} · {banner.isActive ? 'Visible' : 'Hidden'}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Move up */}
                      <button
                        onClick={() => handleMove(index, 'up')}
                        disabled={index === 0}
                        className={`p-1.5 rounded-lg ${adminTheme.surface} ${adminTheme.textMuted} hover:text-white disabled:opacity-20 transition-all`}
                      >
                        <ArrowUpIcon className="w-4 h-4" />
                      </button>
                      {/* Move down */}
                      <button
                        onClick={() => handleMove(index, 'down')}
                        disabled={index === banners.length - 1}
                        className={`p-1.5 rounded-lg ${adminTheme.surface} ${adminTheme.textMuted} hover:text-white disabled:opacity-20 transition-all`}
                      >
                        <ArrowDownIcon className="w-4 h-4" />
                      </button>
                      {/* Toggle visibility */}
                      <button
                        onClick={() => handleToggle(banner)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                          banner.isActive
                            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                            : 'bg-[#333A47] text-[#EAECEF]/50 hover:bg-[#333A47]/80'
                        }`}
                      >
                        {banner.isActive ? 'Visible' : 'Hidden'}
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(banner._id)}
                        className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminBannerManager;
