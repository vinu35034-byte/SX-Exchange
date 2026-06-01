import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useUserProfile } from '../../contexts/UserProfileContext';
import {
  ArrowLeft, Check, AlertTriangle,
  User, Mail, Phone, Calendar, MapPin, Briefcase, Camera
} from 'lucide-react';
import { getUserProfilePicture } from '../../utils/profilePictures';
import Menu from '../Menu';

const EditProfile = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { profileData, updateProfile } = useUserProfile();

  const [loading, setLoading]   = useState(false);
  const [message, setMessage]   = useState({ type: '', text: '' });
  const [profileFormData, setProfileFormData] = useState({
    username: '', email: '', fullName: '',
    phoneNumber: '', dateOfBirth: '',
    country: '', city: '', occupation: '', bio: ''
  });

  useEffect(() => {
    const currentUser = profileData || user;
    if (currentUser) {
      setProfileFormData({
        username:    currentUser.username    || '',
        email:       currentUser.email       || '',
        fullName:    currentUser.fullName    || '',
        phoneNumber: currentUser.phoneNumber || '',
        dateOfBirth: currentUser.dateOfBirth ? currentUser.dateOfBirth.split('T')[0] : '',
        country:     currentUser.country     || '',
        city:        currentUser.city        || '',
        occupation:  currentUser.occupation  || '',
        bio:         currentUser.bio         || '',
      });
    }
  }, [profileData, user]);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handleInputChange = (field, value) => {
    setProfileFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      if (!profileFormData.username.trim()) {
        showMessage('error', t('editProfile.usernameRequired'));
        return;
      }
      if (!profileFormData.email.trim()) {
        showMessage('error', t('editProfile.emailRequired'));
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(profileFormData.email)) {
        showMessage('error', t('editProfile.validEmail'));
        return;
      }
      if (profileFormData.phoneNumber && profileFormData.phoneNumber.length < 10) {
        showMessage('error', t('editProfile.validPhone'));
        return;
      }
      const result = await updateProfile(profileFormData);
      if (result.success) {
        showMessage('success', t('editProfile.profileUpdated'));
        setTimeout(() => navigate('/profile'), 1500);
      } else {
        showMessage('error', result.error || t('editProfile.failedToUpdate'));
      }
    } catch (error) {
      console.error('Profile update error:', error);
      showMessage('error', t('editProfile.failedToUpdate'));
    } finally {
      setLoading(false);
    }
  };

  const countries = [
    'United States', 'Canada', 'United Kingdom', 'Germany', 'France', 'Japan',
    'Australia', 'South Korea', 'Singapore', 'Switzerland', 'Netherlands',
    'Sweden', 'Norway', 'Denmark', 'Finland', 'Austria', 'Belgium', 'Ireland',
    'New Zealand', 'Spain', 'Italy', 'Portugal', 'Other'
  ];

  const currentUser  = profileData || user;
  const stableUserId = currentUser?._id || currentUser?.id || currentUser?.email;
  const { imageUrl, gradientClass, initials } = getUserProfilePicture(
    stableUserId,
    profileFormData.username || currentUser?.email || 'User'
  );

  const inputClass = 'w-full bg-[#F5F7FA] rounded-xl px-4 py-3 text-sm text-[#111111] placeholder-[#AAAAAA] focus:outline-none focus:ring-2 focus:ring-[#0052FF]/30 border border-transparent focus:border-[#0052FF]/20';

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-24">

      {/* Blue hero header */}
      <div className="bg-linear-to-br from-[#0052FF] to-[#0041CC]">
        <div className="w-full max-w-md mx-auto px-4 pt-6 pb-20">

          {/* Top bar */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => navigate('/profile')}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-white font-bold text-lg">{t('editProfile.editProfile')}</h1>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 bg-white text-[#0052FF] text-sm font-bold rounded-xl hover:bg-white/90 transition-colors disabled:opacity-60"
            >
              {loading ? t('editProfile.saving') : t('common.save')}
            </button>
          </div>

          {/* Avatar */}
          <div className="flex flex-col items-center">
            <div className="relative mb-3">
              <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-white/30">
                <img
                  src={imageUrl}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'flex';
                  }}
                />
                <div
                  className={`w-full h-full bg-linear-to-br ${gradientClass} items-center justify-center absolute inset-0`}
                  style={{ display: 'none' }}
                >
                  <span className="text-white font-bold text-2xl tracking-wide">{initials}</span>
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md">
                <Camera className="w-4 h-4 text-[#0052FF]" />
              </div>
            </div>
            <p className="text-white font-bold text-xl mb-0.5">{profileFormData.username || 'User'}</p>
            <p className="text-white/70 text-sm">{profileFormData.email}</p>
          </div>

        </div>
      </div>

      {/* Content */}
      <div className="w-full max-w-md mx-auto px-4 -mt-10 pb-6">

        {/* Message */}
        {message.text && (
          <div className={`flex items-center gap-2 mb-4 px-4 py-3 rounded-2xl text-sm font-medium ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-600 border border-red-200'
          }`}>
            {message.type === 'success'
              ? <Check className="w-4 h-4 shrink-0" />
              : <AlertTriangle className="w-4 h-4 shrink-0" />}
            {message.text}
          </div>
        )}

        {/* Basic Information */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1 mb-2">
            {t('editProfile.basicInformation')}
          </p>
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[#555555] mb-1.5">
                <User className="w-3.5 h-3.5" />{t('editProfile.username')}
              </label>
              <input
                type="text"
                value={profileFormData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                className={inputClass}
                placeholder={t('editProfile.usernameEnter')}
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[#555555] mb-1.5">
                <User className="w-3.5 h-3.5" />{t('editProfile.fullName')}
              </label>
              <input
                type="text"
                value={profileFormData.fullName}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
                className={inputClass}
                placeholder={t('editProfile.fullNameEnter')}
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[#555555] mb-1.5">
                <Briefcase className="w-3.5 h-3.5" />{t('editProfile.bio')}
              </label>
              <textarea
                value={profileFormData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                rows={3}
                className={`${inputClass} resize-none`}
                placeholder={t('editProfile.bioPlaceholder')}
              />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1 mb-2">
            {t('editProfile.contactInformation')}
          </p>
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[#555555] mb-1.5">
                <Mail className="w-3.5 h-3.5" />{t('editProfile.emailAddress')}
              </label>
              <input
                type="email"
                autoComplete="email"
                value={profileFormData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={inputClass}
                placeholder={t('editProfile.emailEnter')}
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[#555555] mb-1.5">
                <Phone className="w-3.5 h-3.5" />{t('editProfile.phoneNumber')}
              </label>
              <input
                type="tel"
                value={profileFormData.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                className={inputClass}
                placeholder={t('editProfile.phoneEnter')}
              />
            </div>
          </div>
        </div>

        {/* Personal Details */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1 mb-2">
            {t('editProfile.personalDetails')}
          </p>
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[#555555] mb-1.5">
                <Calendar className="w-3.5 h-3.5" />{t('editProfile.dateOfBirth')}
              </label>
              <input
                type="date"
                value={profileFormData.dateOfBirth}
                onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[#555555] mb-1.5">
                <MapPin className="w-3.5 h-3.5" />{t('editProfile.country')}
              </label>
              <select
                value={profileFormData.country}
                onChange={(e) => handleInputChange('country', e.target.value)}
                className={inputClass}
              >
                <option value="">{t('editProfile.selectCountry')}</option>
                {countries.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[#555555] mb-1.5">
                <MapPin className="w-3.5 h-3.5" />{t('editProfile.city')}
              </label>
              <input
                type="text"
                value={profileFormData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                className={inputClass}
                placeholder={t('editProfile.cityEnter')}
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[#555555] mb-1.5">
                <Briefcase className="w-3.5 h-3.5" />{t('editProfile.occupation')}
              </label>
              <input
                type="text"
                value={profileFormData.occupation}
                onChange={(e) => handleInputChange('occupation', e.target.value)}
                className={inputClass}
                placeholder={t('editProfile.occupationEnter')}
              />
            </div>
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-[#0052FF] text-white font-bold py-4 rounded-2xl hover:bg-[#0041CC] transition-colors disabled:opacity-60"
        >
          {loading ? t('editProfile.saving') : t('common.save')}
        </button>

      </div>

      <Menu />
    </div>
  );
};

export default EditProfile;
