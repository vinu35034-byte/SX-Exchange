/**
 * Special Token Cache Utilities
 * Helper functions for managing special token caching across the application
 */

export class SpecialTokenCacheUtils {
  /**
   * Determine if a pair represents a special token
   */
  static isSpecialTokenPair(pair, specialTokens = []) {
    if (!pair || !Array.isArray(specialTokens)) return false;
    
    const baseCurrency = pair.split('/')[0];
    return specialTokens.some(token => token.symbol === baseCurrency);
  }

  /**
   * Get appropriate cache timeout based on data characteristics
   */
  static getCacheTimeout(interval, candleState, dataCharacteristics = {}) {
    const { hasRecentTrades = false, isSimulated = false, volatility = 'normal' } = dataCharacteristics;
    
    // Base timeouts
    const baseTimeouts = {
      '1m': hasRecentTrades ? 5000 : 30000,     // 5s with trades, 30s without
      '5m': hasRecentTrades ? 10000 : 60000,    // 10s with trades, 1m without  
      '1h': hasRecentTrades ? 30000 : 300000,   // 30s with trades, 5m without
      '1d': hasRecentTrades ? 60000 : 600000    // 1m with trades, 10m without
    };

    let timeout = baseTimeouts[interval] || baseTimeouts['1h'];

    // Adjust based on candle state
    switch (candleState) {
      case 'active':
        timeout = Math.min(timeout, 10000); // Max 10s for active candles
        break;
      case 'closed':
        timeout *= 2; // Closed candles can be cached longer
        break;
      case 'historical':
        timeout *= 5; // Historical data can be cached much longer
        break;
    }

    // Adjust for volatility
    if (volatility === 'high') {
      timeout *= 0.5; // Refresh more frequently for volatile tokens
    } else if (volatility === 'low') {
      timeout *= 2; // Can cache longer for stable tokens
    }

    return Math.max(timeout, 2000); // Minimum 2s cache
  }

  /**
   * Generate cache key with smart parameters
   */
  static generateCacheKey(pair, interval, limit, options = {}) {
    const { includeState = false, includeUser = false, userContext = null } = options;
    
    let key = `special_${pair}_${interval}_${limit}`;
    
    if (includeState && options.candleState) {
      key += `_${options.candleState}`;
    }
    
    if (includeUser && userContext) {
      key += `_${userContext.userId || 'anon'}`;
    }
    
    return key;
  }

  /**
   * Analyze data freshness and determine cache strategy
   */
  static analyzeDataFreshness(data, currentTime = Date.now()) {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return {
        candleState: 'empty',
        freshness: 0,
        recommendation: 'fetch_new'
      };
    }

    const now = Math.floor(currentTime / 1000);
    const lastCandle = data[data.length - 1];
    const lastCandleAge = now - (lastCandle?.time || 0);
    
    // Determine candle state
    let candleState = 'historical';
    if (lastCandleAge < 300) { // Within 5 minutes
      candleState = 'active';
    } else if (lastCandleAge < 3600) { // Within 1 hour
      candleState = 'mixed';
    }

    // Calculate freshness score (0-100)
    const maxAge = 3600; // 1 hour
    const freshness = Math.max(0, Math.min(100, (maxAge - lastCandleAge) / maxAge * 100));

    // Determine recommendation
    let recommendation = 'use_cached';
    if (freshness < 20) {
      recommendation = 'fetch_new';
    } else if (freshness < 50 && candleState === 'active') {
      recommendation = 'refresh_background';
    }

    return {
      candleState,
      freshness: Math.round(freshness),
      lastCandleAge,
      recommendation,
      hasRecentData: lastCandleAge < 300,
      dataQuality: freshness > 70 ? 'excellent' : freshness > 40 ? 'good' : 'poor'
    };
  }

  /**
   * Smart cache invalidation based on events
   */
  static shouldInvalidateCache(event, pair, cacheEntry) {
    const eventRules = {
      'user_trade': {
        invalidateIfPair: true,
        invalidateStates: ['active', 'mixed'],
        reason: 'New trade affects recent candles'
      },
      'price_simulation': {
        invalidateIfPair: true,
        invalidateStates: ['active'],
        reason: 'Price simulation affects active candles'
      },
      'websocket_candle': {
        invalidateIfPair: true,
        invalidateStates: [], // Don't invalidate, update instead
        reason: 'WebSocket provides newer data'
      },
      'market_hours_change': {
        invalidateIfPair: false,
        invalidateStates: ['active', 'mixed'],
        reason: 'Market state change affects all active data'
      }
    };

    const rule = eventRules[event.type];
    if (!rule) return false;

    // Check if this cache entry should be invalidated
    if (rule.invalidateIfPair && event.pair !== pair) {
      return false;
    }

    if (rule.invalidateStates.length > 0 && !rule.invalidateStates.includes(cacheEntry.candleState)) {
      return false;
    }

    return {
      shouldInvalidate: true,
      reason: rule.reason
    };
  }

  /**
   * Merge new candle data with existing cache
   */
  static mergeWithCache(existingData, newCandle, options = {}) {
    const { maxCandles = 500, maintainOrder = true } = options;
    
    if (!existingData || !Array.isArray(existingData)) {
      return [newCandle];
    }

    const updatedData = [...existingData];
    const candleTime = newCandle.time;
    
    // Find existing candle with same timestamp
    const existingIndex = updatedData.findIndex(candle => candle.time === candleTime);
    
    if (existingIndex >= 0) {
      // Update existing candle
      updatedData[existingIndex] = {
        ...updatedData[existingIndex],
        ...newCandle,
        // Keep some metadata from existing if available
        _cached: updatedData[existingIndex]._cached,
        _source: 'websocket_update'
      };
    } else {
      // Add new candle
      updatedData.push({
        ...newCandle,
        _source: 'websocket_new'
      });
      
      // Maintain chronological order if requested
      if (maintainOrder) {
        updatedData.sort((a, b) => a.time - b.time);
      }
    }
    
    // Trim to max candles
    if (updatedData.length > maxCandles) {
      updatedData.splice(0, updatedData.length - maxCandles);
    }
    
    return updatedData;
  }

  /**
   * Generate cache performance metrics
   */
  static getCacheMetrics(cacheManager) {
    const stats = cacheManager.getStats();
    const totalEntries = stats.totalEntries;
    
    if (totalEntries === 0) {
      return {
        efficiency: 0,
        coverage: 0,
        freshness: 0,
        recommendations: ['No cache data available']
      };
    }

    // Calculate efficiency (active vs stale entries)
    const activeEntries = stats.byState.active + stats.byState.mixed;
    const efficiency = (activeEntries / totalEntries) * 100;

    // Calculate coverage (how many intervals are cached)
    const totalIntervals = 4; // 1m, 5m, 1h, 1d
    const coverage = (Object.keys(stats.byInterval).length / totalIntervals) * 100;

    // Calculate freshness based on newest entry age
    const freshness = stats.newestEntry ? 
      Math.max(0, 100 - (stats.newestEntry.age / 60000)) : 0; // Age in minutes

    // Generate recommendations
    const recommendations = [];
    if (efficiency < 50) {
      recommendations.push('Consider clearing old cache entries');
    }
    if (coverage < 75) {
      recommendations.push('Preload more timeframes for better coverage');
    }
    if (freshness < 30) {
      recommendations.push('Cache data is getting stale, consider refresh');
    }
    if (totalEntries > 80) {
      recommendations.push('Cache size is large, consider cleanup');
    }

    return {
      efficiency: Math.round(efficiency),
      coverage: Math.round(coverage),
      freshness: Math.round(freshness),
      recommendations,
      details: {
        totalEntries,
        activeEntries,
        oldestEntryAge: stats.oldestEntry?.age,
        newestEntryAge: stats.newestEntry?.age
      }
    };
  }
}

export default SpecialTokenCacheUtils;
