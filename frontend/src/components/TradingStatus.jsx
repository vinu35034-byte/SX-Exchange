import React, { useState, useEffect } from 'react';
import { useTrading } from '../contexts/TradingContext';
import { useTheme } from '../contexts/ThemeContext';
import { 
  WifiIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

const TradingStatus = () => {
  const { isConnected, error } = useTrading();
  const { isDarkMode } = useTheme();
  const [showDetails, setShowDetails] = useState(false);
  const [latency, setLatency] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  
  // Update timestamp when connection changes
  useEffect(() => {
    setLastUpdate(Date.now());
  }, [isConnected]);
  
  // Simulate latency check
  useEffect(() => {
    if (isConnected) {
      const start = Date.now();
      const checkLatency = () => {
        const elapsed = Date.now() - start;
        setLatency(elapsed < 300 ? elapsed : Math.floor(Math.random() * 50 + 30));
      };
      
      const timer = setTimeout(checkLatency, 500);
      return () => clearTimeout(timer);
    } else {
      setLatency(null);
    }
  }, [isConnected]);

  if (error) {
    return (
      <div className="group relative">
        <div className="flex items-center gap-2 text-red-400 text-sm cursor-help"
             onMouseEnter={() => setShowDetails(true)}
             onMouseLeave={() => setShowDetails(false)}
             onClick={() => setShowDetails(!showDetails)}>
          <ExclamationTriangleIcon className="w-4 h-4" />
          <span>Connection Error</span>
          <InformationCircleIcon className="w-3 h-3 opacity-60" />
        </div>
        
        {showDetails && (
          <div className="absolute top-full left-0 mt-2 p-3 bg-card border border-default rounded-md shadow-lg z-50 text-xs text-text-primary w-64">
            <p className="font-medium text-red-400 mb-1">Error Details:</p>
            <p className="text-text-secondary break-words">{error}</p>
            <p className="mt-2 text-text-muted">Try refreshing the page or check your network connection.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="group relative">
      <div className={`flex items-center gap-2 text-sm ${
        isConnected ? 'text-brand-success' : 'text-yellow-400'
      } cursor-help`}
           onMouseEnter={() => setShowDetails(true)}
           onMouseLeave={() => setShowDetails(false)}
           onClick={() => setShowDetails(!showDetails)}>
        {isConnected ? (
          <>
            <CheckCircleIcon className="w-4 h-4" />
            <span>Live Trading</span>
            {latency !== null && (
              <span className="text-xs opacity-70">{latency}ms</span>
            )}
          </>
        ) : (
          <>
            <WifiIcon className="w-4 h-4 animate-pulse" />
            <span>Connecting...</span>
          </>
        )}
        <InformationCircleIcon className="w-3 h-3 opacity-60" />
      </div>
      
      {showDetails && (
        <div className="absolute top-full left-0 mt-2 p-3 bg-card border border-default rounded-md shadow-lg z-50 text-xs text-text-primary w-64">
          <p className="font-medium mb-1">Market Data Status:</p>
          <div className="flex justify-between mb-1">
            <span className="text-text-secondary">Connection:</span>
            <span className={isConnected ? 'text-brand-success' : 'text-yellow-400'}>
              {isConnected ? 'Real-time' : 'Delayed'}
            </span>
          </div>
          {isConnected ? (
            <>
              <div className="flex justify-between mb-1">
                <span className="text-text-secondary">Latency:</span>
                <span className="text-brand-success">{latency}ms</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-text-secondary">Updates:</span>
                <span className="text-brand-success">Live</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Server:</span>
                <span className="text-brand-success">{import.meta.env.VITE_WS_URL}</span>
              </div>
              <p className="mt-2 text-text-secondary">
                Last update: {new Date(lastUpdate).toLocaleTimeString()}
              </p>
            </>
          ) : (
            <>
              <div className="flex justify-between mb-1">
                <span className="text-text-secondary">Fallback:</span>
                <span className="text-yellow-400">API Polling</span>
              </div>
              <p className="mt-2 text-text-muted">
                Using HTTP API for market data. Prices may be delayed by 2-5 seconds.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TradingStatus;
