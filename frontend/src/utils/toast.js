import toast from 'react-hot-toast';

// Gradient-border glass card — white center, glowing gradient border per type
const base = {
  borderRadius: '18px',
  padding: '12px 16px',
  fontSize: '13.5px',
  fontWeight: '600',
  color: '#0A0A0A',
  maxWidth: '360px',
  minWidth: '240px',
  border: '1.5px solid transparent',
  backgroundClip: 'padding-box',
};

const toastConfig = {
  duration: 1500,
  position: 'top-center',

  style: {
    ...base,
    background: '#ffffff',
    boxShadow: '0 8px 30px rgba(0,82,255,0.10), 0 2px 8px rgba(0,0,0,0.07)',
    border: '1.5px solid rgba(0,82,255,0.15)',
  },

  success: {
    duration: 1500,
    iconTheme: { primary: '#00C853', secondary: '#ffffff' },
    style: {
      ...base,
      background:
        'linear-gradient(#fff,#fff) padding-box, linear-gradient(135deg,#00C853,#00E676) border-box',
      boxShadow: '0 8px 28px rgba(0,200,83,0.18), 0 2px 8px rgba(0,0,0,0.06)',
    },
  },

  error: {
    duration: 2500,
    iconTheme: { primary: '#FF3B30', secondary: '#ffffff' },
    style: {
      ...base,
      background:
        'linear-gradient(#fff,#fff) padding-box, linear-gradient(135deg,#FF3B30,#FF6B6B) border-box',
      boxShadow: '0 8px 28px rgba(255,59,48,0.18), 0 2px 8px rgba(0,0,0,0.06)',
    },
  },

  loading: {
    duration: Infinity,
    iconTheme: { primary: '#0052FF', secondary: '#ffffff' },
    style: {
      ...base,
      background:
        'linear-gradient(#fff,#fff) padding-box, linear-gradient(135deg,#0052FF,#7B61FF) border-box',
      boxShadow: '0 8px 28px rgba(0,82,255,0.18), 0 2px 8px rgba(0,0,0,0.06)',
    },
  },

  warning: {
    duration: 2000,
    iconTheme: { primary: '#FF9500', secondary: '#ffffff' },
    style: {
      ...base,
      background:
        'linear-gradient(#fff,#fff) padding-box, linear-gradient(135deg,#FF9500,#FFCC02) border-box',
      boxShadow: '0 8px 28px rgba(255,149,0,0.18), 0 2px 8px rgba(0,0,0,0.06)',
    },
  },
};

// Enhanced toast functions with better UX and error handling
export const showToast = {
  success: (message, options = {}) => {
    return toast.success(message, {
      ...toastConfig,
      ...toastConfig.success,
      ...options,
      style: {
        ...toastConfig.style,
        ...toastConfig.success.style,
        ...options.style,
      },
    });
  },
  
  error: (message, options = {}) => {
    // Auto-format error messages for better readability
    const formattedMessage = typeof message === 'string' 
      ? message.replace(/Error: /g, '').trim()
      : String(message);
      
    return toast.error(formattedMessage, {
      ...toastConfig,
      ...toastConfig.error,
      ...options,
      style: {
        ...toastConfig.style,
        ...toastConfig.error.style,
        ...options.style,
      },
    });
  },
  
  warning: (message, options = {}) => {
    return toast(message, {
      ...toastConfig,
      ...toastConfig.warning,
      ...options,
      icon: '',
      style: {
        ...toastConfig.style,
        ...toastConfig.warning.style,
        ...options.style,
      },
    });
  },
  
  loading: (message, options = {}) => {
    return toast.loading(message, {
      ...toastConfig,
      ...toastConfig.loading,
      ...options,
      style: {
        ...toastConfig.style,
        ...toastConfig.loading.style,
        ...options.style,
      },
    });
  },
  
  promise: (promise, messages, options = {}) => {
    return toast.promise(
      promise,
      {
        loading: messages.loading || 'Processing...',
        success: (data) => {
          // Allow dynamic success messages based on response
          return typeof messages.success === 'function' 
            ? messages.success(data)
            : messages.success || 'Success!';
        },
        error: (err) => {
          // Better error message formatting
          const errorMessage = err?.message || err?.data?.message || String(err);
          return typeof messages.error === 'function'
            ? messages.error(err)
            : messages.error || errorMessage.replace(/Error: /g, '').trim();
        },
      },
      {
        ...toastConfig,
        ...options,
        style: {
          ...toastConfig.style,
          ...options.style,
        },
        success: {
          ...toastConfig.success,
          ...options.success,
          style: {
            ...toastConfig.style,
            ...toastConfig.success.style,
            ...options.success?.style,
          },
        },
        error: {
          ...toastConfig.error,
          ...options.error,
          style: {
            ...toastConfig.style,
            ...toastConfig.error.style,
            ...options.error?.style,
          },
        },
        loading: {
          ...toastConfig.loading,
          ...options.loading,
          style: {
            ...toastConfig.style,
            ...toastConfig.loading.style,
            ...options.loading?.style,
          },
        },
      }
    );
  },
  
  custom: (message, options = {}) => {
    return toast(message, {
      ...toastConfig,
      ...options,
      style: {
        ...toastConfig.style,
        ...options.style,
      },
    });
  },
  
  // Utility functions
  dismiss: (toastId) => {
    return toast.dismiss(toastId);
  },
  
  remove: (toastId) => {
    return toast.remove(toastId);
  },

  // Clear all toasts
  clear: () => {
    return toast.dismiss();
  },

  // Update existing toast
  update: (toastId, options) => {
    return toast.dismiss(toastId) && toast(options.message, options);
  },
};

export default showToast;
