// Professional Admin Theme System
// Dark administrative theme with purple/blue accent colors
// Designed to be visually distinct from user interface

export const adminTheme = {
  // Main admin colors - Gold/Dark professional theme
  primary: 'bg-linear-to-br from-[#181A20] via-[#1F2128] to-[#181A20]',
  secondary: 'bg-linear-to-br from-[#1F2128] via-[#252A33] to-[#1F2128]',
  accent: 'bg-linear-to-r from-[#FCD535] to-green-500',
  surface: 'bg-[#333A47]/50 backdrop-blur-md',
  card: 'bg-linear-to-br from-[#333A47]/80 to-[#252A33]/40 backdrop-blur-md',
  
  // Text colors
  textPrimary: 'text-[#EAECEF]',
  textSecondary: 'text-[#EAECEF]/80',
  textMuted: 'text-[#EAECEF]/60',
  textAccent: 'text-[#FCD535]',
  
  // Border colors
  border: 'border-[#333A47]/50',
  borderAccent: 'border-[#FCD535]/30',
  borderHover: 'border-[#FCD535]/50',
  
  // Status colors (admin specific)
  success: 'bg-green-500 hover:bg-green-600',
  warning: 'bg-yellow-500 hover:bg-yellow-600',
  danger: 'bg-red-500 hover:bg-red-600',
  info: 'bg-blue-500 hover:bg-blue-600',
  
  // Status backgrounds
  successBg: 'bg-green-500/10 border-green-500/20 text-green-400',
  warningBg: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
  dangerBg: 'bg-red-500/10 border-red-500/20 text-red-400',
  infoBg: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  
  // Interactive states
  hover: 'hover:bg-[#333A47]/50 hover:border-[#FCD535]/30',
  focus: 'focus:ring-2 focus:ring-[#FCD535]/50 focus:border-[#FCD535]',
  active: 'active:bg-[#333A47]/80',
  
  // Shadows
  shadow: 'shadow-xl shadow-[#FCD535]/20',
  shadowLg: 'shadow-2xl shadow-[#FCD535]/30',
  
  // Buttons
  buttonPrimary: 'bg-linear-to-r from-[#FCD535] to-green-500 hover:from-[#E6C228] hover:to-green-600 text-white font-semibold shadow-lg hover:shadow-[#FCD535]/25',
  buttonSecondary: 'bg-[#333A47] hover:bg-[#3F4554] text-[#EAECEF] hover:text-white border border-[#333A47] hover:border-[#FCD535]/50',
  buttonSuccess: 'bg-linear-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white',
  buttonDanger: 'bg-linear-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white',
  buttonWarning: 'bg-linear-to-r from-yellow-600 to-yellow-500 hover:from-yellow-700 hover:to-yellow-600 text-white',
  
  // Table styles
  tableHeader: 'bg-[#333A47]/80 border-b border-[#333A47]/50 text-[#EAECEF] font-semibold',
  tableRow: 'border-b border-[#333A47]/30 hover:bg-[#333A47]/30 transition-colors',
  tableCell: 'text-[#EAECEF]/80',
  
  // Modal styles
  modalOverlay: 'bg-black/60 backdrop-blur-sm',
  modalContent: 'bg-linear-to-br from-[#1F2128] to-[#252A33]/40 border border-[#333A47]/50 shadow-2xl shadow-[#FCD535]/30',
  
  // Input styles
  input: 'bg-[#333A47]/50 border-[#333A47]/50 text-[#EAECEF] placeholder-[#EAECEF]/40 focus:border-[#FCD535] focus:ring-[#FCD535]/20',
  select: 'bg-[#333A47]/50 border-[#333A47]/50 text-[#EAECEF] focus:border-[#FCD535] focus:ring-[#FCD535]/20',
  textarea: 'bg-[#333A47]/50 border-[#333A47]/50 text-[#EAECEF] placeholder-[#EAECEF]/40 focus:border-[#FCD535] focus:ring-[#FCD535]/20',
};

// Utility function to combine admin theme classes
export const getAdminClasses = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

// Network specific colors for admin
export const adminNetworkColors = {
  BEP20: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
  BSC: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
  ETH: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
};

// Status colors for admin
export const adminStatusColors = {
  pending: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
  confirmed: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  credited: 'bg-green-500/10 border-green-500/20 text-green-400',
  approved: 'bg-green-500/10 border-green-500/20 text-green-400',
  failed: 'bg-red-500/10 border-red-500/20 text-red-400',
  submitted: 'bg-[#FCD535]/10 border-[#FCD535]/20 text-[#FCD535]',
  rejected: 'bg-red-500/10 border-red-500/20 text-red-400',
};
