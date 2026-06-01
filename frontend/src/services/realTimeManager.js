/**
 * Real-Time Manager for High-Performance Trading Application
 * Optimized for 20k+ concurrent users with 1-second updates
 */

class RealTimeManager {
  constructor() {
    this.subscribers = new Map();
    this.dataCache = new Map();
    this.lastUpdate = new Map();
    this.batchUpdates = new Map();
    this.updateInterval = 1000; // 1 second
    this.maxCacheAge = 5000; // 5 seconds
    this.isUpdating = false;
    this.updateQueue = [];
    
    // Performance monitoring
    this.requestCount = 0;
    this.rateLimitWindow = 60000; // 1 minute
    this.maxRequestsPerWindow = 100; // Adjust based on your rate limits
    this.requestTimestamps = [];
    
    // Batch update timer
    this.batchTimer = null;
    
    // Start the update loop
    this.startUpdateLoop();
  }

  /**
   * Subscribe to real-time data updates
   */
  subscribe(component, dataTypes, callback) {
    const subscriptionKey = `${component}_${Date.now()}`;
    
    this.subscribers.set(subscriptionKey, {
      component,
      dataTypes: Array.isArray(dataTypes) ? dataTypes : [dataTypes],
      callback,
      lastReceived: 0
    });

    // Immediately send cached data if available
    this.sendCachedData(subscriptionKey);
    
    return subscriptionKey;
  }

  /**
   * Unsubscribe from updates
   */
  unsubscribe(subscriptionKey) {
    this.subscribers.delete(subscriptionKey);
  }

  /**
   * Check if we're hitting rate limits
   */
  isRateLimited() {
    const now = Date.now();
    
    // Clean old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < this.rateLimitWindow
    );
    
    return this.requestTimestamps.length >= this.maxRequestsPerWindow;
  }

  /**
   * Add request to rate limit tracking
   */
  trackRequest() {
    this.requestTimestamps.push(Date.now());
    this.requestCount++;
  }

  /**
   * Get cached data if fresh enough
   */
  getCachedData(dataType) {
    const cached = this.dataCache.get(dataType);
    const lastUpdate = this.lastUpdate.get(dataType);
    
    if (cached && lastUpdate && (Date.now() - lastUpdate < this.maxCacheAge)) {
      return cached;
    }
    
    return null;
  }

  /**
   * Update cache with new data
   */
  updateCache(dataType, data) {
    this.dataCache.set(dataType, data);
    this.lastUpdate.set(dataType, Date.now());
  }

  /**
   * Send cached data to new subscriber
   */
  sendCachedData(subscriptionKey) {
    const subscription = this.subscribers.get(subscriptionKey);
    if (!subscription) return;

    const cachedData = {};
    let hasCachedData = false;

    subscription.dataTypes.forEach(dataType => {
      const cached = this.getCachedData(dataType);
      if (cached) {
        cachedData[dataType] = cached;
        hasCachedData = true;
      }
    });

    if (hasCachedData) {
      subscription.callback(cachedData);
      subscription.lastReceived = Date.now();
    }
  }

  /**
   * Queue data for batch update
   */
  queueUpdate(dataType, data) {
    this.batchUpdates.set(dataType, data);
    
    // Debounce batch updates
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    this.batchTimer = setTimeout(() => {
      this.processBatchUpdates();
    }, 100); // Batch updates every 100ms
  }

  /**
   * Process all queued updates
   */
  processBatchUpdates() {
    if (this.batchUpdates.size === 0) return;

    const updates = Object.fromEntries(this.batchUpdates);
    this.batchUpdates.clear();

    // Update cache
    Object.entries(updates).forEach(([dataType, data]) => {
      this.updateCache(dataType, data);
    });

    // Notify subscribers
    this.notifySubscribers(updates);
  }

  /**
   * Notify relevant subscribers of updates
   */
  notifySubscribers(updates) {
    const now = Date.now();
    
    this.subscribers.forEach((subscription, key) => {
      // Throttle updates per subscriber (max 1 per second)
      if (now - subscription.lastReceived < 1000) {
        return;
      }

      const relevantUpdates = {};
      let hasRelevantData = false;

      subscription.dataTypes.forEach(dataType => {
        if (updates[dataType]) {
          relevantUpdates[dataType] = updates[dataType];
          hasRelevantData = true;
        }
      });

      if (hasRelevantData) {
        try {
          subscription.callback(relevantUpdates);
          subscription.lastReceived = now;
        } catch (error) {
          console.error(`Error notifying subscriber ${key}:`, error);
        }
      }
    });
  }

  /**
   * Main update loop - coordinates all data fetching
   */
  startUpdateLoop() {
    const updateCycle = async () => {
      if (this.isUpdating) return;
      
      this.isUpdating = true;

      try {
        // Only fetch data if we have subscribers and aren't rate limited
        if (this.subscribers.size > 0 && !this.isRateLimited()) {
          await this.fetchRequiredData();
        }
      } catch (error) {
        console.error('Update cycle error:', error);
      } finally {
        this.isUpdating = false;
        
        // Schedule next update
        setTimeout(updateCycle, this.updateInterval);
      }
    };

    updateCycle();
  }

  /**
   * Fetch only the data that subscribers need
   */
  async fetchRequiredData() {
    const requiredDataTypes = new Set();
    
    // Collect all required data types from active subscribers
    this.subscribers.forEach(subscription => {
      subscription.dataTypes.forEach(dataType => {
        requiredDataTypes.add(dataType);
      });
    });

    // Prioritize data fetching based on cache age and subscriber count
    const fetchPromises = [];
    
    for (const dataType of requiredDataTypes) {
      const cached = this.getCachedData(dataType);
      
      if (!cached) {
        fetchPromises.push(this.fetchDataType(dataType));
        
        // Limit concurrent requests to avoid rate limiting
        if (fetchPromises.length >= 3) {
          break;
        }
      }
    }

    if (fetchPromises.length > 0) {
      await Promise.allSettled(fetchPromises);
    }
  }

  /**
   * Fetch specific data type
   */
  async fetchDataType(dataType) {
    if (this.isRateLimited()) {
      return;
    }

    try {
      this.trackRequest();
      
      const { ApiUtils } = await import('./api');
      let data = null;

      switch (dataType) {
        case 'prices':
          data = await ApiUtils.get('/market/prices');
          break;
        case 'tickers':
          data = await ApiUtils.get('/market/tickers');
          break;
        case 'orderbook':
          data = await ApiUtils.get('/market/orderbook');
          break;
        case 'trades':
          data = await ApiUtils.get('/market/recent-trades');
          break;
        case 'userBalances':
          data = await ApiUtils.get('/user/balances');
          break;
        case 'userOrders':
          data = await ApiUtils.get('/trading/orders?limit=10');
          break;
        default:
          console.warn(`Unknown data type: ${dataType}`);
          return;
      }

      if (data) {
        this.queueUpdate(dataType, data);
      }
    } catch (error) {
      if (error.message.includes('Rate limit')) {
        console.warn(`Rate limited for ${dataType}, using cached data`);
      } else {
        console.error(`Error fetching ${dataType}:`, error);
      }
    }
  }

  /**
   * Manual refresh for critical data
   */
  async forceRefresh(dataTypes) {
    const types = Array.isArray(dataTypes) ? dataTypes : [dataTypes];
    
    for (const dataType of types) {
      // Clear cache to force fresh fetch
      this.dataCache.delete(dataType);
      this.lastUpdate.delete(dataType);
      
      // Fetch immediately if not rate limited
      if (!this.isRateLimited()) {
        await this.fetchDataType(dataType);
      }
    }
  }

  /**
   * Get performance stats
   */
  getStats() {
    return {
      activeSubscribers: this.subscribers.size,
      cachedDataTypes: this.dataCache.size,
      requestCount: this.requestCount,
      isRateLimited: this.isRateLimited(),
      cacheHitRate: this.calculateCacheHitRate()
    };
  }

  /**
   * Calculate cache hit rate
   */
  calculateCacheHitRate() {
    const totalRequests = this.requestCount;
    const cacheHits = Math.max(0, totalRequests - this.requestTimestamps.length);
    return totalRequests > 0 ? (cacheHits / totalRequests * 100).toFixed(2) : 0;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.subscribers.clear();
    this.dataCache.clear();
    this.lastUpdate.clear();
    this.batchUpdates.clear();
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
  }
}

// Create singleton instance
const realTimeManager = new RealTimeManager();

export default realTimeManager;
