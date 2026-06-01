import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiUtils } from '../services/api';

/**
 * Advanced caching system specifically designed for special tokens
 * Handles real-time updates, WebSocket integration, and smart cache invalidation
 */

class SpecialTokenCacheManager {
  constructor() {
    this.cache = new Map();
    this.activeCandles = new Map(); // Track active (unclosed) candles
    this.websocketSubscriptions = new Map();
    this.cacheConfig = {
      // Different cache times based on candle state and timeframe
      activeCandleTimeout: 5000,    // 5 seconds for active candles
      closedCandleTimeout: 300000,  // 5 minutes for closed candles
      historicalTimeout: 600000,    // 10 minutes for historical data
      maxCacheSize: 100,            // Max cache entries per timeframe
      
      // Smart invalidation rules
      invalidateOnTrade: true,      // Clear cache when user trades
      invalidateOnPriceUpdate: true, // Clear cache on price simulation
      preloadTimeframes: ['1m', '5m', '1h'], // Preload these timeframes
    };
  }

  generateCacheKey(pair, interval, limit, candleState = 'mixed') {
    return `${pair}_${interval}_${limit}_${candleState}`;
  }

  isSpecialToken(pair) {
    // Extract base currency from pair (e.g., "DT/USDT" -> "DT")
    const baseCurrency = pair.split('/')[0];
    // This should be synchronized with special tokens list from context
    return window.specialTokenSymbols?.includes(baseCurrency) || false;
  }

  getCacheTimeout(interval, candleState) {
    const { activeCandleTimeout, closedCandleTimeout, historicalTimeout } = this.cacheConfig;
    
    switch (candleState) {
      case 'active':
        return activeCandleTimeout;
      case 'closed':
        return closedCandleTimeout;
      case 'historical':
        return historicalTimeout;
      default:
        // Smart timeout based on interval for mixed data
        const timeoutMap = {
          '1m': activeCandleTimeout,
          '5m': activeCandleTimeout * 2,
          '1h': closedCandleTimeout,
          '1d': historicalTimeout
        };
        return timeoutMap[interval] || closedCandleTimeout;
    }
  }

  async get(pair, interval, limit = 100) {
    if (!this.isSpecialToken(pair)) {
      return null; // Not a special token, use regular caching
    }

    const cacheKey = this.generateCacheKey(pair, interval, limit);
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (cached) {
      const timeout = this.getCacheTimeout(interval, cached.candleState);
      
      if (now - cached.timestamp < timeout) {
        console.log(`🎯 SPECIAL TOKEN CACHE HIT: ${pair} ${interval} (${cached.candleState})`);
        return {
          data: cached.data,
          fromCache: true,
          cacheAge: now - cached.timestamp,
          candleState: cached.candleState
        };
      } else {
        console.log(`⏰ SPECIAL TOKEN CACHE EXPIRED: ${pair} ${interval}`);
        this.cache.delete(cacheKey);
      }
    }

    return null;
  }

  async set(pair, interval, data, limit = 100) {
    if (!this.isSpecialToken(pair)) {
      return false;
    }

    const cacheKey = this.generateCacheKey(pair, interval, limit);
    
    // Analyze data to determine cache strategy
    const candleState = this.analyzeCandleState(data);
    
    const cacheEntry = {
      data,
      timestamp: Date.now(),
      candleState,
      interval,
      pair,
      dataLength: data?.length || 0
    };

    this.cache.set(cacheKey, cacheEntry);

    // Track active candles for real-time updates
    if (candleState === 'active' || candleState === 'mixed') {
      this.trackActiveCandles(pair, interval, data);
    }

    // Cleanup old cache entries
    this.cleanup();

    console.log(`💾 SPECIAL TOKEN CACHED: ${pair} ${interval} (${candleState}) - ${data?.length || 0} candles`);
    return true;
  }

  analyzeCandleState(data) {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return 'empty';
    }

    const now = Math.floor(Date.now() / 1000);
    const lastCandle = data[data.length - 1];
    
    // Check if last candle is recent (within last 5 minutes)
    const isRecent = lastCandle.time && (now - lastCandle.time) < 300;
    
    if (isRecent) {
      // Check if we have mostly recent data
      const recentCandles = data.filter(candle => (now - candle.time) < 3600); // Last hour
      const recentRatio = recentCandles.length / data.length;
      
      if (recentRatio > 0.5) {
        return 'active';
      } else {
        return 'mixed';
      }
    }

    return 'historical';
  }

  trackActiveCandles(pair, interval, data) {
    const key = `${pair}_${interval}`;
    const lastCandle = data[data.length - 1];
    
    if (lastCandle) {
      this.activeCandles.set(key, {
        lastCandleTime: lastCandle.time,
        lastUpdate: Date.now(),
        pair,
        interval
      });
    }
  }

  // Invalidate cache when new trade occurs
  invalidateOnTrade(pair) {
    if (!this.isSpecialToken(pair)) return;

    console.log(`🔄 INVALIDATING CACHE ON TRADE: ${pair}`);
    
    // Remove all cache entries for this pair
    for (const [key, value] of this.cache.entries()) {
      if (value.pair === pair) {
        this.cache.delete(key);
      }
    }
  }

  // Invalidate cache when price simulation updates
  invalidateOnPriceUpdate(pair) {
    if (!this.isSpecialToken(pair)) return;

    // Only invalidate active candle caches, keep historical data
    for (const [key, value] of this.cache.entries()) {
      if (value.pair === pair && (value.candleState === 'active' || value.candleState === 'mixed')) {
        console.log(`📊 INVALIDATING ACTIVE CACHE ON PRICE UPDATE: ${key}`);
        this.cache.delete(key);
      }
    }
  }

  // Update cache with WebSocket candle update
  updateWithWebSocketData(candleData) {
    const { pair, timeframe: interval } = candleData;
    
    if (!this.isSpecialToken(pair)) return;

    // Find and update relevant cache entries
    for (const [key, value] of this.cache.entries()) {
      if (value.pair === pair && value.interval === interval) {
        const updatedData = this.mergeCandleUpdate(value.data, candleData);
        
        value.data = updatedData;
        value.timestamp = Date.now();
        value.candleState = 'active';
        
        console.log(`🔴 WEBSOCKET CACHE UPDATE: ${pair} ${interval}`);
      }
    }
  }

  mergeCandleUpdate(existingData, newCandle) {
    if (!existingData || !Array.isArray(existingData)) return [newCandle];

    const updatedData = [...existingData];
    const candleTime = newCandle.time;
    
    // Find existing candle with same timestamp
    const existingIndex = updatedData.findIndex(candle => candle.time === candleTime);
    
    if (existingIndex >= 0) {
      // Update existing candle
      updatedData[existingIndex] = {
        time: candleTime,
        open: newCandle.open,
        high: newCandle.high,
        low: newCandle.low,
        close: newCandle.close,
        volume: newCandle.volume
      };
    } else {
      // Add new candle and maintain chronological order
      updatedData.push({
        time: candleTime,
        open: newCandle.open,
        high: newCandle.high,
        low: newCandle.low,
        close: newCandle.close,
        volume: newCandle.volume
      });
      
      updatedData.sort((a, b) => a.time - b.time);
      
      // Keep only last 500 candles
      if (updatedData.length > 500) {
        updatedData.splice(0, updatedData.length - 500);
      }
    }
    
    return updatedData;
  }

  cleanup() {
    if (this.cache.size <= this.cacheConfig.maxCacheSize) return;

    // Remove oldest entries first
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = entries.slice(0, entries.length - this.cacheConfig.maxCacheSize);
    
    toRemove.forEach(([key]) => {
      this.cache.delete(key);
    });

    console.log(`🧹 CLEANED UP ${toRemove.length} old cache entries`);
  }

  // Preload data for commonly used timeframes
  async preloadTimeframes(pair) {
    if (!this.isSpecialToken(pair)) return;

    console.log(`🚀 PRELOADING TIMEFRAMES FOR: ${pair}`);
    
    const preloadPromises = this.cacheConfig.preloadTimeframes.map(async (interval) => {
      try {
        const cached = await this.get(pair, interval);
        if (!cached) {
          // Fetch and cache
          const response = await ApiUtils.get(
            `/candlesticks/klines/${encodeURIComponent(pair)}?interval=${interval}&limit=100`
          );
          
          if (response.data?.success && response.data?.data) {
            await this.set(pair, interval, response.data.data);
          }
        }
      } catch (error) {
        console.warn(`Failed to preload ${pair} ${interval}:`, error);
      }
    });

    await Promise.allSettled(preloadPromises);
  }

  // Get cache statistics
  getStats() {
    const stats = {
      totalEntries: this.cache.size,
      byState: { active: 0, closed: 0, historical: 0, mixed: 0, empty: 0 },
      byInterval: {},
      oldestEntry: null,
      newestEntry: null
    };

    let oldestTime = Date.now();
    let newestTime = 0;

    for (const [key, value] of this.cache.entries()) {
      // Count by state
      stats.byState[value.candleState]++;
      
      // Count by interval
      stats.byInterval[value.interval] = (stats.byInterval[value.interval] || 0) + 1;
      
      // Track oldest/newest
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        stats.oldestEntry = { key, age: Date.now() - value.timestamp };
      }
      
      if (value.timestamp > newestTime) {
        newestTime = value.timestamp;
        stats.newestEntry = { key, age: Date.now() - value.timestamp };
      }
    }

    return stats;
  }

  clear() {
    this.cache.clear();
    this.activeCandles.clear();
    console.log('🗑️ SPECIAL TOKEN CACHE CLEARED');
  }
}

// Singleton instance
const specialTokenCache = new SpecialTokenCacheManager();

/**
 * Hook for special token candlestick data with advanced caching
 */
export function useSpecialTokenCandlestickData(pair, interval = '1h', limit = 100, specialTokens = []) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cacheInfo, setCacheInfo] = useState({ fromCache: false, cacheAge: 0 });
  const abortControllerRef = useRef(null);
  const websocketRef = useRef(null);

  // Set special tokens in cache manager
  useEffect(() => {
    window.specialTokenSymbols = specialTokens.map(token => token.symbol);
  }, [specialTokens]);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!pair || !specialTokenCache.isSpecialToken(pair)) {
      return null;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setLoading(true);
    setError(null);

    try {
      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = await specialTokenCache.get(pair, interval, limit);
        if (cached) {
          setData(cached.data);
          setCacheInfo({
            fromCache: true,
            cacheAge: cached.cacheAge,
            candleState: cached.candleState
          });
          setLoading(false);
          return cached.data;
        }
      }

      // Fetch fresh data
      abortControllerRef.current = new AbortController();
      
      const encodedPair = encodeURIComponent(pair);
      const response = await ApiUtils.get(
        `/candlesticks/klines/${encodedPair}?interval=${interval}&limit=${limit}`,
        { signal: abortControllerRef.current.signal }
      );

      if (response.data?.success && response.data?.data) {
        const candleData = response.data.data;
        
        // Cache the data
        await specialTokenCache.set(pair, interval, candleData, limit);
        
        setData(candleData);
        setCacheInfo({
          fromCache: false,
          cacheAge: 0,
          candleState: specialTokenCache.analyzeCandleState(candleData)
        });
        
        return candleData;
      } else {
        throw new Error('Invalid response format');
      }

    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        console.error('Special token candlestick fetch error:', err);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [pair, interval, limit]);

  // Setup WebSocket updates for special tokens
  useEffect(() => {
    if (!pair || !specialTokenCache.isSpecialToken(pair)) return;

    const setupWebSocket = async () => {
      try {
        const { default: websocketService } = await import('../services/websocket');
        
        const handleCandleUpdate = (candleData) => {
          if (candleData.pair === pair && candleData.timeframe === interval) {
            // Update cache with WebSocket data
            specialTokenCache.updateWithWebSocketData(candleData);
            
            // Update local state
            setData(prevData => {
              const updatedData = specialTokenCache.mergeCandleUpdate(prevData, candleData);
              return updatedData;
            });
          }
        };

        websocketService.subscribeToGeneral('candleUpdate', handleCandleUpdate);
        websocketRef.current = { unsubscribe: () => {
          websocketService.unsubscribeFromGeneral('candleUpdate', handleCandleUpdate);
        }};

      } catch (error) {
        console.warn('Failed to setup WebSocket for special token cache:', error);
      }
    };

    setupWebSocket();

    return () => {
      if (websocketRef.current?.unsubscribe) {
        websocketRef.current.unsubscribe();
      }
    };
  }, [pair, interval]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Preload related timeframes
  useEffect(() => {
    if (pair && specialTokenCache.isSpecialToken(pair)) {
      specialTokenCache.preloadTimeframes(pair);
    }
  }, [pair]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Expose cache control methods
  const cacheControls = {
    refresh: () => fetchData(true),
    invalidate: () => specialTokenCache.invalidateOnTrade(pair),
    getStats: () => specialTokenCache.getStats(),
    clear: () => specialTokenCache.clear()
  };

  return {
    data,
    loading,
    error,
    cacheInfo,
    cacheControls,
    refetch: fetchData
  };
}

// Export cache manager for external use
export { specialTokenCache };
export default useSpecialTokenCandlestickData;
