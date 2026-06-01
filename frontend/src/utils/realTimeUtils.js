/**
 * Real-time market data utilities for frontend
 * Handles display of live price sources and connection status
 */

export const PRICE_SOURCES = {
  'Binance WebSocket': {
    name: 'Binance',
    type: 'Real-time',
    reliability: 'High',
    icon: '🟢',
    color: 'text-green-500'
  },
  'Binance REST': {
    name: 'Binance',
    type: 'API',
    reliability: 'High',
    icon: '🟡',
    color: 'text-yellow-500'
  },
  'CoinGecko Polling': {
    name: 'CoinGecko',
    type: 'API',
    reliability: 'Medium',
    icon: '🟡',
    color: 'text-yellow-500'
  },
  'CoinGecko REST': {
    name: 'CoinGecko',
    type: 'API',
    reliability: 'Medium',
    icon: '🟡',
    color: 'text-yellow-500'
  },
  'Fallback REST': {
    name: 'Fallback',
    type: 'API',
    reliability: 'Low',
    icon: '🟠',
    color: 'text-orange-500'
  },
  'Real-time API': {
    name: 'Live Data',
    type: 'Real-time',
    reliability: 'High',
    icon: '🟢',
    color: 'text-green-500'
  }
};

/**
 * Format price source information for display
 */
export const formatPriceSource = (source) => {
  const sourceInfo = PRICE_SOURCES[source] || {
    name: 'Unknown',
    type: 'Unknown',
    reliability: 'Unknown',
    icon: '⚪',
    color: 'text-gray-500'
  };

  return sourceInfo;
};

/**
 * Get connection status indicator
 */
export const getConnectionStatus = (isConnected, lastUpdate = null) => {
  if (!isConnected) {
    return {
      status: 'Disconnected',
      icon: '🔴',
      color: 'text-red-500',
      message: 'No real-time connection'
    };
  }

  if (!lastUpdate) {
    return {
      status: 'Connected',
      icon: '🟡',
      color: 'text-yellow-500',
      message: 'Connected, waiting for data'
    };
  }

  const timeSinceUpdate = Date.now() - new Date(lastUpdate).getTime();
  
  if (timeSinceUpdate < 30000) { // Less than 30 seconds
    return {
      status: 'Live',
      icon: '🟢',
      color: 'text-green-500',
      message: 'Real-time data active'
    };
  } else if (timeSinceUpdate < 300000) { // Less than 5 minutes
    return {
      status: 'Recent',
      icon: '🟡',
      color: 'text-yellow-500',
      message: `Updated ${Math.floor(timeSinceUpdate / 1000)}s ago`
    };
  } else {
    return {
      status: 'Stale',
      icon: '🟠',
      color: 'text-orange-500',
      message: `Last update ${Math.floor(timeSinceUpdate / 60000)}m ago`
    };
  }
};

/**
 * Format price change with appropriate styling
 */
export const formatPriceChange = (price, previousPrice, priceChangePercent = null) => {
  if (!previousPrice || !price) {
    return {
      change: 0,
      changePercent: 0,
      direction: 'neutral',
      color: 'text-gray-500',
      icon: '⚪'
    };
  }

  const change = price - previousPrice;
  const changePercent = priceChangePercent || (change / previousPrice) * 100;
  
  if (changePercent > 0) {
    return {
      change,
      changePercent,
      direction: 'up',
      color: 'text-green-500',
      icon: '📈',
      sign: '+'
    };
  } else if (changePercent < 0) {
    return {
      change,
      changePercent,
      direction: 'down',
      color: 'text-red-500',
      icon: '📉',
      sign: ''
    };
  } else {
    return {
      change: 0,
      changePercent: 0,
      direction: 'neutral',
      color: 'text-gray-500',
      icon: '➡️',
      sign: ''
    };
  }
};

/**
 * Format price with appropriate decimal places
 */
export const formatPrice = (price, symbol = 'USDT') => {
  if (!price || isNaN(price)) return '$0.00';
  
  const numPrice = parseFloat(price);
  
  if (numPrice >= 1000) {
    return `$${numPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else if (numPrice >= 1) {
    return `$${numPrice.toFixed(2)}`;
  } else if (numPrice >= 0.01) {
    return `$${numPrice.toFixed(4)}`;
  } else if (numPrice >= 0.0001) {
    return `$${numPrice.toFixed(6)}`;
  } else {
    return `$${numPrice.toFixed(8)}`;
  }
};

/**
 * Real-time price component props helper
 */
export const createPriceDisplayProps = (priceData) => {
  const {
    pair,
    price,
    previousPrice,
    priceChange,
    priceChangePercent,
    source,
    timestamp,
    isConnected
  } = priceData;

  const sourceInfo = formatPriceSource(source);
  const connectionStatus = getConnectionStatus(isConnected, timestamp);
  const changeInfo = formatPriceChange(price, previousPrice, priceChangePercent);
  const formattedPrice = formatPrice(price);

  return {
    pair,
    price: formattedPrice,
    change: changeInfo,
    source: sourceInfo,
    connection: connectionStatus,
    timestamp: timestamp ? new Date(timestamp).toLocaleTimeString() : null,
    isLive: connectionStatus.status === 'Live'
  };
};

/**
 * WebSocket price update event names
 */
export const WEBSOCKET_EVENTS = {
  PRICE_UPDATE: 'price_update',
  MARKET_STATUS: 'market_status',
  CONNECTION_STATUS: 'connection_status'
};

/**
 * Default trading pairs with real exchange support
 */
export const SUPPORTED_PAIRS = [
  'BTC/USDT',
  'ETH/USDT', 
  'BNB/USDT',
  'SOL/USDT',
  'ADA/USDT',
  'DOT/USDT',
  'XRP/USDT',
  'DOGE/USDT'
];

/**
 * Check if a trading pair has real-time support
 */
export const hasRealTimeSupport = (pair) => {
  return SUPPORTED_PAIRS.includes(pair);
};

export default {
  formatPriceSource,
  getConnectionStatus,
  formatPriceChange,
  formatPrice,
  createPriceDisplayProps,
  hasRealTimeSupport,
  PRICE_SOURCES,
  WEBSOCKET_EVENTS,
  SUPPORTED_PAIRS
};
