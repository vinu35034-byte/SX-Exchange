import { useState, useEffect, useCallback, useRef } from 'react';
import realTimeManager from '../services/realTimeManager';

/**
 * Custom hook for real-time data with intelligent caching and rate limiting
 */
export const useRealTimeData = (dataTypes, componentName = 'unknown') => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  
  const subscriptionRef = useRef(null);
  const componentRef = useRef(componentName);
  const isMountedRef = useRef(true);

  // Callback to handle real-time updates
  const handleUpdate = useCallback((updates) => {
    if (!isMountedRef.current) return;

    setData(prevData => ({
      ...prevData,
      ...updates
    }));
    
    setLastUpdate(Date.now());
    setLoading(false);
    setError(null);
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    isMountedRef.current = true;
    
    // Subscribe to data updates
    subscriptionRef.current = realTimeManager.subscribe(
      componentRef.current,
      dataTypes,
      handleUpdate
    );

    return () => {
      isMountedRef.current = false;
      if (subscriptionRef.current) {
        realTimeManager.unsubscribe(subscriptionRef.current);
      }
    };
  }, [dataTypes, handleUpdate]);

  // Force refresh function
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      await realTimeManager.forceRefresh(dataTypes);
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.message);
        setLoading(false);
      }
    }
  }, [dataTypes]);

  // Get specific data type
  const getData = useCallback((dataType) => {
    return data[dataType] || null;
  }, [data]);

  return {
    data,
    loading,
    error,
    lastUpdate,
    refresh,
    getData,
    stats: realTimeManager.getStats()
  };
};

/**
 * Hook specifically for trading data (prices, orderbook, trades)
 */
export const useTradingData = (pair, componentName = 'trading') => {
  const dataTypes = ['prices', 'tickers', 'orderbook', 'trades'];
  const realTimeData = useRealTimeData(dataTypes, componentName);
  
  const getCurrentPrice = useCallback((tradingPair) => {
    const prices = realTimeData.getData('prices');
    return prices?.[tradingPair] || 0;
  }, [realTimeData]);

  const getCurrentTicker = useCallback((tradingPair) => {
    const tickers = realTimeData.getData('tickers');
    return tickers?.[tradingPair] || null;
  }, [realTimeData]);

  const getOrderBook = useCallback((tradingPair) => {
    const orderbook = realTimeData.getData('orderbook');
    return orderbook?.[tradingPair] || { bids: [], asks: [] };
  }, [realTimeData]);

  const getRecentTrades = useCallback((tradingPair) => {
    const trades = realTimeData.getData('trades');
    return trades?.[tradingPair] || [];
  }, [realTimeData]);

  return {
    ...realTimeData,
    currentPrice: getCurrentPrice(pair),
    currentTicker: getCurrentTicker(pair),
    orderBook: getOrderBook(pair),
    recentTrades: getRecentTrades(pair),
    getCurrentPrice,
    getCurrentTicker,
    getOrderBook,
    getRecentTrades
  };
};

/**
 * Hook for user-specific data (balances, orders)
 */
export const useUserData = (componentName = 'user') => {
  const dataTypes = ['userBalances', 'userOrders'];
  const realTimeData = useRealTimeData(dataTypes, componentName);

  const getBalance = useCallback((currency) => {
    const balances = realTimeData.getData('userBalances');
    return balances?.[currency] || { available: 0, locked: 0, total: 0 };
  }, [realTimeData]);

  const getOrders = useCallback((status = null) => {
    const orders = realTimeData.getData('userOrders') || [];
    return status ? orders.filter(order => order.status === status) : orders;
  }, [realTimeData]);

  return {
    ...realTimeData,
    balances: realTimeData.getData('userBalances') || {},
    orders: realTimeData.getData('userOrders') || [],
    getBalance,
    getOrders
  };
};

/**
 * Hook for market overview data
 */
export const useMarketData = (componentName = 'market') => {
  const dataTypes = ['prices', 'tickers'];
  const realTimeData = useRealTimeData(dataTypes, componentName);

  const getAllPrices = useCallback(() => {
    return realTimeData.getData('prices') || {};
  }, [realTimeData]);

  const getAllTickers = useCallback(() => {
    return realTimeData.getData('tickers') || {};
  }, [realTimeData]);

  const getTopMovers = useCallback(() => {
    const tickers = getAllTickers();
    return Object.values(tickers)
      .filter(ticker => ticker.priceChangePercent !== undefined)
      .sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent))
      .slice(0, 10);
  }, [getAllTickers]);

  return {
    ...realTimeData,
    prices: getAllPrices(),
    tickers: getAllTickers(),
    topMovers: getTopMovers(),
    getAllPrices,
    getAllTickers,
    getTopMovers
  };
};
