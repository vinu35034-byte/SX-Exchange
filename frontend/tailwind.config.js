module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        'xs': '400px',
      },
      fontFamily: {
        'sans': ['BinancePlex', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        'primary': ['BinancePlex', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        'heading': ['BinancePlex', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        // Brand colors from themeUtils.js
        'brand-primary': '#FCD535',
        'brand-secondary': '#FCD535',
        'brand-accent': '#FCD535',
        'brand-success': '#10B981',
        'brand-warning': '#F59E0B',
        'brand-error': '#EF4444',
        'brand-info': '#3B82F6',
        
        // Text colors
        'heading': '#EAECAF',
        'primary': '#EAECAF',
        'secondary': '#EAECAF',
        'muted': '#EAECAF',
        
        // Background colors
        'bg-primary': '#181A20',
        'bg-secondary': '#181A20',
        'bg-tertiary': '#181A20',
        'bg-card': '#181A20',
        'bg-surface': '#181A20',
        'bg-elevated': '#181A20',
        
        // Component colors
        'input': '#181A20',
        'border': '#333A47',
        
        // Additional brand colors for ThemePreview compatibility
        'brand-dark': '#181A20',
        
        // Shadcn/ui compatibility
        background: '#181A20',
        foreground: '#EAECAF',
        card: {
          DEFAULT: '#181A20',
          foreground: '#EAECAF',
        },
        popover: {
          DEFAULT: '#181A20',
          foreground: '#EAECAF',
        },
        primary: {
          DEFAULT: '#FCD535',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#FCD535',
          foreground: '#EAECAF',
        },
        muted: {
          DEFAULT: '#EAECAF',
          foreground: '#EAECAF',
        },
        accent: {
          DEFAULT: '#FCD535',
          foreground: '#FFFFFF',
        },
        destructive: {
          DEFAULT: '#EF4444',
          foreground: '#FFFFFF',
        },
        border: '#333A47',
        input: '#181A20',
        ring: '#FCD535',
      },
      borderRadius: {
        lg: '12px',
        md: '8px',
        sm: '4px',
      },
      boxShadow: {
        'brand': '0 4px 14px 0 rgba(103, 80, 164, 0.3)',
        'brand-lg': '0 8px 25px 0 rgba(103, 80, 164, 0.4)',
      },
      transitionDuration: {
        '400': '400ms',
      },
      animation: {
        'fadeIn': 'fadeIn 0.3s ease-in-out',
        'slideUp': 'slideUp 0.3s ease-in-out',
        'scaleIn': 'scaleIn 0.2s ease-in-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(103, 80, 164, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(103, 80, 164, 0.8)' },
        },
      },
    },
  },
  plugins: [],
}
