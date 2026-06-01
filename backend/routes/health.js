const express = require('express');
const router = express.Router();
const performanceMonitor = require('../utils/performanceMonitor');
const redisManager = require('../config/redis');
const mongoose = require('mongoose');

// Health check endpoint
router.get('/', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: 'unknown',
        redis: 'unknown',
        performance: 'unknown'
      },
      performance: {},
      recommendations: []
    };

    // Check database connection
    try {
      if (mongoose.connection.readyState === 1) {
        health.services.database = 'connected';
      } else {
        health.services.database = 'disconnected';
        health.status = 'degraded';
      }
    } catch (error) {
      health.services.database = 'error';
      health.status = 'unhealthy';
    }

    // Check Redis connection
    try {
      if (redisManager.isConnected) {
        const redisClient = redisManager.getClient('main');
        await redisClient.ping();
        health.services.redis = 'connected';
      } else {
        health.services.redis = 'disconnected';
        health.status = 'degraded';
      }
    } catch (error) {
      health.services.redis = 'error';
      health.status = 'degraded'; // Redis is optional, so degraded not unhealthy
    }

    // Get performance metrics
    try {
      health.performance = performanceMonitor.getMetrics();
      health.recommendations = performanceMonitor.getScalingRecommendations();
      health.services.performance = 'active';

      // Check if performance indicates unhealthy state
      if (health.performance.cpu > 95 || health.performance.memory > 95) {
        health.status = 'unhealthy';
      } else if (health.performance.cpu > 85 || health.performance.memory > 85) {
        health.status = 'degraded';
      }
    } catch (error) {
      health.services.performance = 'error';
      health.status = 'degraded';
    }

    // Set appropriate HTTP status code
    let statusCode = 200;
    if (health.status === 'degraded') {
      statusCode = 200; // Still functional
    } else if (health.status === 'unhealthy') {
      statusCode = 503; // Service unavailable
    }

    res.status(statusCode).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Detailed performance metrics endpoint
router.get('/metrics', async (req, res) => {
  try {
    const metrics = performanceMonitor.getMetrics();
    const recommendations = performanceMonitor.getScalingRecommendations();

    res.json({
      timestamp: new Date().toISOString(),
      metrics,
      recommendations,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get metrics',
      message: error.message
    });
  }
});

// Redis status endpoint
router.get('/redis', async (req, res) => {
  try {
    const status = {
      connected: redisManager.isConnected,
      clients: {},
      config: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        hasPassword: !!process.env.REDIS_PASSWORD,
        passwordLength: process.env.REDIS_PASSWORD ? process.env.REDIS_PASSWORD.length : 0
      }
    };

    if (redisManager.isConnected) {
      const clientNames = ['main', 'rateLimit', 'session', 'socketPub', 'socketSub'];
      
      for (const clientName of clientNames) {
        try {
          const client = redisManager.getClient(clientName);
          if (client) {
            await client.ping();
            status.clients[clientName] = 'connected';
          } else {
            status.clients[clientName] = 'not_found';
          }
        } catch (error) {
          status.clients[clientName] = {
            status: 'error',
            error: error.message,
            isAuthError: error.message.includes('NOAUTH') || error.message.includes('Authentication')
          };
        }
      }
    }

    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check Redis status',
      message: error.message,
      isAuthError: error.message.includes('NOAUTH') || error.message.includes('Authentication')
    });
  }
});

/**
 * Detailed candlestick service status for debugging clustering issues
 * GET /api/health/candlesticks
 */
router.get('/candlesticks', async (req, res) => {
  try {
    const candleService = require('../services/candleService');
    const Candlestick = require('../models/candlestick');
    const { pair, timeframe } = req.query;
    
    const candlestickInfo = {
      timestamp: new Date().toISOString(),
      instance: {
        id: process.env.INSTANCE_ID || process.pid,
        port: process.env.PORT || 'unknown',
        pid: process.pid
      },
      activeCandlesCount: candleService.activeCandlesCache?.size || 0,
      socketConnections: candleService.socketServer?.engine?.clientsCount || 0,
      socketAdapterType: candleService.socketServer?.adapter?.constructor?.name || 'unknown'
    };

    // If specific pair/timeframe requested, get recent candles
    if (pair && timeframe) {
      try {
        const recentCandles = await candleService.getHistoricalCandles(pair, timeframe, 5);
        const currentCandle = await candleService.getCurrentCandle(pair, timeframe);
        
        candlestickInfo.query = { pair, timeframe };
        candlestickInfo.recentCandlesCount = recentCandles.length;
        candlestickInfo.hasCurrentCandle = !!currentCandle;
        
        if (recentCandles.length > 0) {
          candlestickInfo.latestCandle = {
            openTime: recentCandles[recentCandles.length - 1].openTime,
            close: recentCandles[recentCandles.length - 1].close,
            volume: recentCandles[recentCandles.length - 1].volume
          };
        }
        
        if (currentCandle) {
          candlestickInfo.currentCandle = {
            openTime: currentCandle.openTime,
            close: currentCandle.close,
            volume: currentCandle.volume,
            closed: currentCandle.closed
          };
        }
      } catch (error) {
        candlestickInfo.queryError = error.message;
      }
    }

    // Get database stats for debugging
    try {
      const stats = await Promise.all([
        Candlestick.countDocuments({ timeframe: '1m' }),
        Candlestick.countDocuments({ timeframe: '5m' }),
        Candlestick.countDocuments({ timeframe: '1h' }),
        Candlestick.countDocuments({ closed: false })
      ]);
      
      candlestickInfo.databaseStats = {
        candles_1m: stats[0],
        candles_5m: stats[1],
        candles_1h: stats[2],
        activeCandles: stats[3]
      };
    } catch (error) {
      candlestickInfo.databaseStatsError = error.message;
    }

    res.json(candlestickInfo);

  } catch (error) {
    console.error('❌ Candlestick health check error:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
      instance: {
        id: process.env.INSTANCE_ID || process.pid,
        port: process.env.PORT || 'unknown'
      }
    });
  }
});

/**
 * Test candlestick broadcast for debugging clustering
 * POST /api/health/test-broadcast
 */
router.post('/test-broadcast', async (req, res) => {
  try {
    const candleService = require('../services/candleService');
    const { pair = 'PARA/USDT', timeframe = '1m' } = req.body;
    
    // Create a test candle update
    const testCandle = {
      pair,
      timeframe,
      openTime: new Date(),
      open: 1.0,
      high: 1.1,
      low: 0.9,
      close: 1.05,
      volume: 1000,
      closed: false,
      _id: 'test-' + Date.now()
    };

    // Broadcast the test candle
    candleService.broadcastCandleUpdate(testCandle);

    console.log(`🧪 [Instance ${process.env.INSTANCE_ID || process.pid}:${process.env.PORT}] Test broadcast sent for ${pair}:${timeframe}`);

    res.json({
      status: 'test_broadcast_sent',
      testCandle,
      timestamp: new Date().toISOString(),
      instance: {
        id: process.env.INSTANCE_ID || process.pid,
        port: process.env.PORT || 'unknown'
      },
      socketConnections: candleService.socketServer?.engine?.clientsCount || 0,
      message: 'Check browser console and server logs for broadcast reception'
    });

  } catch (error) {
    console.error('❌ Test broadcast error:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
