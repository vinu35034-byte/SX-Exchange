import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import App from './App.jsx'

// Component to handle loading state
const AppWithLoading = () => {
  useEffect(() => {
    // Remove skeleton loading and show content after React renders
    const rootElement = document.getElementById('root');
    const loadingContainer = document.querySelector('.loading-container');
    
    if (loadingContainer) {
      // Smooth fade out transition
      loadingContainer.style.opacity = '0';
      loadingContainer.style.transition = 'opacity 0.5s ease';
      
      setTimeout(() => {
        loadingContainer.remove();
      }, 500);
    }
    
    if (rootElement) {
      rootElement.classList.add('loaded');
    }
  }, []);

  return <App />;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppWithLoading />
  </StrictMode>,
)
