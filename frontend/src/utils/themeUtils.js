// Theme utilities for managing the application's color scheme and styling
export const themeColors = {
  // Brand colors - directly use the colors defined in Tailwind
  brand: {
    primary: '#6750A4',
    secondary: '#625B71', 
    accent: '#0ECB81',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
  
  // Text colors for different contexts
  text: {
    heading: '#E6E0E9',
    primary: '#E6E0E9',
    secondary: '#CAC4D0',
    muted: '#938F99',
  },
  
  // Background colors for different surfaces
  background: {
    primary: '#121318',
    secondary: '#1A1C23',
    tertiary: '#1E2029',
    card: '#1A1C23',
    surface: '#1A1C23',
    elevated: '#1E2029',
  },
  
  // Component-specific colors
  components: {
    input: '#34343A',
    border: 'rgba(255, 255, 255, 0.1)',
  }
};

// Theme utility classes that can be used directly in components
export const themeClasses = {
  // Background classes
  backgrounds: {
    primary: 'bg-bg-primary',
    secondary: 'bg-bg-secondary', 
    tertiary: 'bg-bg-tertiary',
    card: 'bg-card',
    surface: 'bg-bg-surface',
    elevated: 'bg-bg-elevated',
  },
  
  // Text classes
  text: {
    heading: 'text-heading',
    primary: 'text-primary',
    secondary: 'text-secondary',
    muted: 'text-muted',
  },
  
  // Brand classes
  brand: {
    primary: 'text-brand-primary',
    secondary: 'text-brand-secondary',
    accent: 'text-brand-accent',
    success: 'text-brand-success',
    warning: 'text-brand-warning',
    error: 'text-brand-error',
    info: 'text-brand-info',
  },
  
  // Brand background classes
  brandBg: {
    primary: 'bg-brand-primary',
    secondary: 'bg-brand-secondary',
    accent: 'bg-brand-accent',
    success: 'bg-brand-success',
    warning: 'bg-brand-warning',
    error: 'bg-brand-error', 
    info: 'bg-brand-info',
  },
  
  // Component classes
  components: {
    input: 'bg-input border-border',
    card: 'bg-card border-border',
    button: {
      primary: 'bg-brand-primary text-white hover:bg-opacity-90',
      secondary: 'bg-brand-secondary text-white hover:bg-opacity-90',
      accent: 'bg-brand-accent text-white hover:bg-opacity-90',
      success: 'bg-brand-success text-white hover:bg-opacity-90',
      warning: 'bg-brand-warning text-white hover:bg-opacity-90',
      error: 'bg-brand-error text-white hover:bg-opacity-90',
      ghost: 'text-primary hover:bg-bg-secondary',
      outline: 'border border-border text-primary hover:bg-bg-secondary',
    },
  },
};

// Helper function to get brand color
export const getBrandColor = (variant = 'primary') => {
  return themeColors.brand[variant] || themeColors.brand.primary;
};

// Helper function to get background color
export const getBackgroundColor = (variant = 'primary') => {
  return themeColors.background[variant] || themeColors.background.primary;
};

// Helper function to get text color
export const getTextColor = (variant = 'primary') => {
  return themeColors.text[variant] || themeColors.text.primary;
};

// Helper function to construct component classes
export const getButtonClasses = (variant = 'primary', size = 'md') => {
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';
  
  const sizeClasses = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 py-2',
    lg: 'h-12 px-6 text-lg',
  };
  
  return `${baseClasses} ${sizeClasses[size]} ${themeClasses.components.button[variant]}`;
};

// Helper function to get card classes
export const getCardClasses = (elevated = false) => {
  const baseClasses = 'rounded-lg border shadow-sm';
  const backgroundClass = elevated ? themeClasses.backgrounds.elevated : themeClasses.backgrounds.card;
  return `${baseClasses} ${backgroundClass} ${themeClasses.components.card}`;
};

// Helper function to get input classes
export const getInputClasses = () => {
  return `flex h-10 w-full rounded-md px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${themeClasses.components.input}`;
};

// Export default theme configuration
export const defaultTheme = {
  colors: themeColors,
  classes: themeClasses,
  helpers: {
    getBrandColor,
    getBackgroundColor,
    getTextColor,
    getButtonClasses,
    getCardClasses,
    getInputClasses,
  },
};

export default defaultTheme;
