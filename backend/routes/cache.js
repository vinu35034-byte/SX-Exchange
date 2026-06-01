const express = require('express');
const router = express.Router();
const cacheService = require('../utils/cacheService');
const cacheWarmupService = require('../utils/cacheWarmupService');
const requireAdminAuth = require('../middlewares/requireAdminAuth');
const { createLogger } = require('../utils/logger');

const logger = createLogger('cache-routes');

// Get cache statistics and info
router.get('/info', requireAdminAuth, async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    
    logger.info('Cache info requested', {
      adminId: req.user.id,
      sessionId,
      timestamp: new Date().toISOString()
    });

    const cacheInfo = await cacheService.getInfo();
    const warmupStats = cacheWarmupService.getStats();

    res.json({
      success: true,
      data: {
        cache: cacheInfo,
        warmup: warmupStats,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error getting cache info', {
      adminId: req.user?.id,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to get cache information',
      error: error.message
    });
  }
});

// Warm up cache
router.post('/warmup', requireAdminAuth, async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    const { tasks } = req.body; // Optional: specific tasks to warm up
    
    logger.info('Cache warmup initiated', {
      adminId: req.user.id,
      sessionId,
      specificTasks: tasks,
      timestamp: new Date().toISOString()
    });

    let result;
    if (tasks && Array.isArray(tasks) && tasks.length > 0) {
      result = await cacheWarmupService.warmupSpecific(tasks);
    } else {
      result = await cacheWarmupService.warmupCache();
    }

    logger.info('Cache warmup completed', {
      adminId: req.user.id,
      sessionId,
      result,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Cache warmup completed',
      data: result
    });

  } catch (error) {
    logger.error('Cache warmup failed', {
      adminId: req.user?.id,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({
      success: false,
      message: 'Cache warmup failed',
      error: error.message
    });
  }
});

// Clear cache
router.post('/clear', requireAdminAuth, async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    const { pattern } = req.body; // Optional: pattern to clear specific keys
    
    logger.warn('Cache clear initiated', {
      adminId: req.user.id,
      sessionId,
      pattern,
      timestamp: new Date().toISOString()
    });

    let clearedCount;
    if (pattern) {
      clearedCount = await cacheService.delPattern(pattern);
    } else {
      await cacheService.flushAll();
      clearedCount = 'all';
    }

    logger.warn('Cache cleared', {
      adminId: req.user.id,
      sessionId,
      clearedCount,
      pattern,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Cache cleared: ${clearedCount} keys`,
      data: {
        cleared: clearedCount,
        pattern: pattern || 'all'
      }
    });

  } catch (error) {
    logger.error('Cache clear failed', {
      adminId: req.user?.id,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({
      success: false,
      message: 'Cache clear failed',
      error: error.message
    });
  }
});

// Refresh cache (clear + warmup)
router.post('/refresh', requireAdminAuth, async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    
    logger.info('Cache refresh initiated', {
      adminId: req.user.id,
      sessionId,
      timestamp: new Date().toISOString()
    });

    const result = await cacheWarmupService.refreshCache();

    logger.info('Cache refresh completed', {
      adminId: req.user.id,
      sessionId,
      result,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Cache refreshed successfully',
      data: result
    });

  } catch (error) {
    logger.error('Cache refresh failed', {
      adminId: req.user?.id,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({
      success: false,
      message: 'Cache refresh failed',
      error: error.message
    });
  }
});

// Get specific cache key
router.get('/key/:key', requireAdminAuth, async (req, res) => {
  try {
    const { key } = req.params;
    const sessionId = req.headers['x-session-id'];
    
    const value = await cacheService.get(key);
    const ttl = await cacheService.ttl(key);
    const exists = await cacheService.exists(key);

    logger.debug('Cache key accessed', {
      adminId: req.user.id,
      sessionId,
      key,
      exists,
      ttl,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        key,
        value,
        ttl,
        exists,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error getting cache key', {
      adminId: req.user?.id,
      key: req.params.key,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to get cache key',
      error: error.message
    });
  }
});

// Set cache key (for testing)
router.put('/key/:key', requireAdminAuth, async (req, res) => {
  try {
    const { key } = req.params;
    const { value, ttl = 300 } = req.body;
    const sessionId = req.headers['x-session-id'];
    
    const result = await cacheService.set(key, value, { ttl });

    logger.info('Cache key set by admin', {
      adminId: req.user.id,
      sessionId,
      key,
      ttl,
      success: result,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Cache key ${result ? 'set' : 'failed to set'}`,
      data: {
        key,
        ttl,
        result
      }
    });

  } catch (error) {
    logger.error('Error setting cache key', {
      adminId: req.user?.id,
      key: req.params.key,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to set cache key',
      error: error.message
    });
  }
});

// Delete cache key
router.delete('/key/:key', requireAdminAuth, async (req, res) => {
  try {
    const { key } = req.params;
    const sessionId = req.headers['x-session-id'];
    
    const result = await cacheService.del(key);

    logger.info('Cache key deleted by admin', {
      adminId: req.user.id,
      sessionId,
      key,
      success: result,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Cache key ${result ? 'deleted' : 'not found'}`,
      data: {
        key,
        deleted: result
      }
    });

  } catch (error) {
    logger.error('Error deleting cache key', {
      adminId: req.user?.id,
      key: req.params.key,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete cache key',
      error: error.message
    });
  }
});

// Cache health check
router.get('/health', async (req, res) => {
  try {
    const testKey = 'cache:health:test';
    const testValue = { timestamp: Date.now(), test: true };
    
    // Test write
    const setResult = await cacheService.set(testKey, testValue, { ttl: 10 });
    
    // Test read
    const getValue = await cacheService.get(testKey);
    
    // Test delete
    const delResult = await cacheService.del(testKey);
    
    const isHealthy = setResult && getValue && getValue.test === true && delResult;

    res.json({
      success: true,
      healthy: isHealthy,
      tests: {
        set: setResult,
        get: !!getValue,
        delete: delResult
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Cache health check failed', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({
      success: false,
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
