// Profile Pictures Utility
// Generates consistent pixel-art avatars via DiceBear + gradient fallback

const DICEBEAR_BASE = 'https://api.dicebear.com/7.x/micah/svg';

const gradientBackgrounds = [
  'from-[#0052FF] to-[#003ACC]',
  'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-blue-600',
  'from-indigo-500 to-violet-600',
  'from-fuchsia-500 to-pink-600',
  'from-teal-500 to-cyan-600',
  'from-orange-500 to-red-600',
];

/**
 * Simple stable hash for consistent avatar assignment
 */
const createStableHash = (str) => {
  let hash = 0;
  if (!str || str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

/**
 * Derive up to 2 initials from a name or email
 */
const getInitials = (text) => {
  if (!text) return 'U';
  const clean = text.split('@')[0];
  const parts = clean.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
};

/**
 * Get profile picture config for a user.
 * Returns a DiceBear pixel-art avatar URL seeded by userId for consistency.
 * Falls back to gradient + initials if the image fails to load.
 * @param {string} userId
 * @param {string} fallbackText - username or email
 * @returns {{ imageUrl: string, gradientClass: string, initials: string }}
 */
export const getUserProfilePicture = (userId, fallbackText = '') => {
  const key = userId ? String(userId).trim() : fallbackText;
  const hash = createStableHash(key);
  const index = hash % gradientBackgrounds.length;

  // Use userId as seed so avatar is stable per user
  const seed = encodeURIComponent(key || 'user');
  const imageUrl = `${DICEBEAR_BASE}?seed=${seed}&size=128&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,e8f5e9`;

  return {
    imageUrl,
    gradientClass: gradientBackgrounds[index],
    initials: getInitials(fallbackText),
  };
};

export const getProfilePictureUrl = (userId) => {
  const { imageUrl } = getUserProfilePicture(userId);
  return imageUrl;
};

export const getProfileGradient = (userId) => {
  const { gradientClass } = getUserProfilePicture(userId);
  return gradientClass;
};
