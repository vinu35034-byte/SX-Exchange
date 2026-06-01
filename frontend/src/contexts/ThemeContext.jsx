import React, { createContext, useContext, useState, useEffect } from 'react';
import { userProfile } from '../services/api';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    // In development, provide a default context to handle HMR issues
    if (import.meta.env.DEV) {
      // Check current theme state from document or localStorage
      const savedTheme = localStorage.getItem('theme-mode');
      const hasLightClass = document.documentElement.classList.contains('light');
      const hasDarkClass = document.documentElement.classList.contains('dark');
      
      let isDarkMode;
      if (hasLightClass) {
        isDarkMode = false;
      } else if (hasDarkClass) {
        isDarkMode = true;
      } else if (savedTheme) {
        isDarkMode = savedTheme === 'dark';
      } else {
        isDarkMode = true; // Default to dark mode
      }
      
      return {
        themeConfig: {
          branding: {
            appName: ' NexaBit',
            logoPath: '',
            logoFileName: '',
            faviconPath: '',
            primaryColor: '#000000',
            secondaryColor: '#000000',
            accentColor: '#0ECB81'
          },
          customization: {
            darkMode: isDarkMode,
            layout: 'compact',
            fontSize: 'medium'
          }
        },
        isDarkMode: isDarkMode,
        toggleTheme: () => {},
        updateThemeConfig: () => Promise.resolve(),
        loadThemeConfig: () => Promise.resolve()
      };
    }
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {  const [themeConfig, setThemeConfig] = useState({
    branding: {
      appName: 'CryptoTrader',
      logoPath: '',
      logoFileName: '',
      faviconPath: '',
      primaryColor: '#000000',
      secondaryColor: '#000000',
      accentColor: '#0ECB81'
    },
    typography: {
      primaryFont: 'BinancePlex, system-ui, -apple-system, sans-serif',
      headingFont: 'BinancePlex, system-ui, -apple-system, sans-serif',
      fontSize: 'medium'
    },
    theme: {
      defaultTheme: 'dark',
      allowThemeSwitch: true,
      customCSS: '',
      backgroundColors: {
        lightMode: {
          primary: '#ffffff',
          secondary: '#f8fafc',
          tertiary: '#f1f5f9',
          accent: '#e2e8f0',
          surface: '#ffffff',
          elevated: '#f8fafc',
          card: '#ffffff',
          overlay: 'rgba(0, 0, 0, 0.5)'
        },
        darkMode: {
          primary: '#121318',
          secondary: '#1A1C23',
          tertiary: '#1E2029',
          accent: '#29292F',
          surface: '#1A1C23',
          elevated: '#1E2029',
          card: '#1A1C23',
          overlay: 'rgba(0, 0, 0, 0.7)'
        }
      },
      textColors: {
        lightMode: {
          primary: '#1C1B1F',
          secondary: '#49454F',
          tertiary: '#79747E',
          disabled: '#C4C7C5',
          inverse: '#ffffff'
        },
        darkMode: {
          primary: '#E6E0E9',
          secondary: '#CAC4D0',
          tertiary: '#938F99',
          disabled: '#5A5D63',
          inverse: '#1C1B1F'
        }
      },
      brandColors: {
        primary: '#6750A4',
        secondary: '#625B71',
        accent: '#0ECB81',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6'
      }
    },
    layout: {
      compactMode: false,
      animationsEnabled: true
    }
  });
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to dark mode

  useEffect(() => {
    // Load theme preference from localStorage and check if HTML already has theme class
    const savedTheme = localStorage.getItem('theme-mode');
    const hasLightClass = document.documentElement.classList.contains('light');
    const hasDarkClass = document.documentElement.classList.contains('dark');
    
    let initialDarkMode;
    if (hasLightClass) {
      initialDarkMode = false;
    } else if (hasDarkClass) {
      initialDarkMode = true;
    } else if (savedTheme) {
      initialDarkMode = savedTheme === 'dark';
    } else {
      initialDarkMode = themeConfig.theme.defaultTheme === 'dark';
    }
    
    setIsDarkMode(initialDarkMode);
    loadThemeConfig();
  }, []);

  const loadThemeConfig = async () => {
    try {
      // Keep the default theme configuration
      // No longer fetching from API since admin settings are removed
    } catch (error) {
      console.error('Failed to load theme configuration:', error);
    } finally {
      setLoading(false);
    }
  };
  // Apply theme styles dynamically
  useEffect(() => {
    if (!loading) {
      applyThemeStyles();
    }
  }, [themeConfig, loading, isDarkMode]);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('theme-mode', newMode ? 'dark' : 'light');
    
    // Apply theme class to document
    document.documentElement.classList.toggle('dark', newMode);
    document.documentElement.classList.toggle('light', !newMode);
  };  const applyThemeStyles = () => {
    const root = document.documentElement;
    
    // Apply theme mode classes only if they need to be changed
    const hasCorrectClass = isDarkMode ? root.classList.contains('dark') : root.classList.contains('light');
    if (!hasCorrectClass) {
      root.classList.toggle('dark', isDarkMode);
      root.classList.toggle('light', !isDarkMode);
    }
    
    // Apply brand colors
    const brandColors = themeConfig.theme?.brandColors || {};
    root.style.setProperty('--brand-primary', brandColors.primary || '#6750A4');
    root.style.setProperty('--brand-secondary', brandColors.secondary || '#625B71');
    root.style.setProperty('--brand-accent', brandColors.accent || '#0ECB81');
    root.style.setProperty('--brand-success', brandColors.success || '#10B981');
    root.style.setProperty('--brand-warning', brandColors.warning || '#F59E0B');
    root.style.setProperty('--brand-error', brandColors.error || '#EF4444');
    root.style.setProperty('--brand-info', brandColors.info || '#3B82F6');
    
    // Don't override theme-specific colors as they are handled by CSS classes (.dark/.light)
    // The CSS classes will automatically apply the correct colors based on theme mode
    
    // Apply fonts
    root.style.setProperty('--font-primary', `"${themeConfig.typography?.primaryFont || 'Inter'}", system-ui, -apple-system, sans-serif`);
    root.style.setProperty('--font-heading', `"${themeConfig.typography?.headingFont || 'Inter'}", system-ui, -apple-system, sans-serif`);
    
    // Apply font size
    const fontSizeMap = {
      small: '14px',
      medium: '16px',
      large: '18px'
    };
    root.style.setProperty('--base-font-size', fontSizeMap[themeConfig.typography?.fontSize] || '16px');

    // Apply custom CSS if any
    if (themeConfig.theme?.customCSS) {
      let customStyleElement = document.getElementById('custom-theme-styles');
      if (!customStyleElement) {
        customStyleElement = document.createElement('style');
        customStyleElement.id = 'custom-theme-styles';
        document.head.appendChild(customStyleElement);
      }
      customStyleElement.textContent = themeConfig.theme.customCSS;
    }

    // Update app title if changed
    if (themeConfig.branding?.appName && themeConfig.branding.appName !== 'CryptoTrader') {
      document.title = themeConfig.branding.appName;
    }

    // Update favicon if provided
    if (themeConfig.branding?.faviconUrl) {
      let favicon = document.querySelector('link[rel="icon"]');
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
      }
      favicon.href = themeConfig.branding.faviconUrl;
    }
  };
  const value = {
    themeConfig,
    setThemeConfig,
    loading,
    refreshTheme: loadThemeConfig,
    applyThemeStyles,
    isDarkMode,
    toggleTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
