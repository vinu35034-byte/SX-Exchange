import { useTheme } from '../contexts/ThemeContext';

// Theme utility hook for consistent styling across components
export const useThemeStyles = () => {
  const { isDarkMode } = useTheme();

  const styles = {
    // Main container styles
    container: isDarkMode 
      ? 'bg-linear-to-b from-slate-950 via-slate-900 to-slate-950 text-white' 
      : 'bg-linear-to-b from-gray-50 via-white to-gray-50 text-gray-900',
    
    // Card styles
    card: isDarkMode 
      ? 'bg-slate-800/50 backdrop-blur-sm border border-slate-700/50' 
      : 'bg-white/80 backdrop-blur-sm border border-gray-200/50',
    
    cardHover: isDarkMode 
      ? 'hover:bg-slate-700/50' 
      : 'hover:bg-gray-50/80',
    
    // Input styles
    input: isDarkMode 
      ? 'bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-400 focus:ring-blue-500/50' 
      : 'bg-white/80 border border-gray-300/50 text-gray-900 placeholder-gray-400 focus:ring-blue-500/50',
    
    // Button styles
    button: isDarkMode 
      ? 'bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 text-slate-300 hover:bg-slate-700/80' 
      : 'bg-white/80 backdrop-blur-sm border border-gray-300/50 text-gray-600 hover:bg-gray-50/80',
    
    // Text styles
    textPrimary: isDarkMode ? 'text-white' : 'text-gray-900',
    textSecondary: isDarkMode ? 'text-slate-300' : 'text-gray-600',
    textMuted: isDarkMode ? 'text-slate-400' : 'text-gray-500',
    
    // Header styles
    header: isDarkMode 
      ? 'bg-linear-to-r from-slate-900/90 via-slate-800/90 to-slate-900/90 border-slate-700/50' 
      : 'bg-linear-to-r from-white/90 via-gray-50/90 to-white/90 border-gray-200/50',
    
    // Menu/Navigation styles
    nav: isDarkMode 
      ? 'bg-linear-to-r from-slate-900/90 via-slate-800/90 to-slate-900/90 border-slate-700/50' 
      : 'bg-linear-to-r from-white/90 via-gray-50/90 to-white/90 border-gray-200/50',
    
    // Dropdown/Modal styles
    dropdown: isDarkMode 
      ? 'bg-slate-800/95 backdrop-blur-sm border border-slate-700/50' 
      : 'bg-white/95 backdrop-blur-sm border border-gray-200/50',
  };

  // Color utilities
  const getTextColor = (type = 'primary') => {
    switch (type) {
      case 'secondary':
        return isDarkMode ? 'text-slate-300' : 'text-gray-600';
      case 'muted':
        return isDarkMode ? 'text-slate-400' : 'text-gray-500';
      default:
        return isDarkMode ? 'text-white' : 'text-gray-900';
    }
  };

  const getBgColor = (type = 'card') => {
    switch (type) {
      case 'container':
        return isDarkMode 
          ? 'bg-linear-to-b from-slate-950 via-slate-900 to-slate-950' 
          : 'bg-linear-to-b from-gray-50 via-white to-gray-50';
      case 'input':
        return isDarkMode ? 'bg-slate-800/50' : 'bg-white/80';
      case 'button':
        return isDarkMode ? 'bg-slate-800/80' : 'bg-white/80';
      default:
        return isDarkMode ? 'bg-slate-800/50' : 'bg-white/80';
    }
  };

  const getBorderColor = () => {
    return isDarkMode ? 'border-slate-700/50' : 'border-gray-200/50';
  };

  return {
    isDarkMode,
    styles,
    getTextColor,
    getBgColor,
    getBorderColor,
  };
};

export default useThemeStyles;
