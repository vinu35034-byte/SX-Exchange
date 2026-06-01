const express = require('express');
const router = express.Router();
const { redisClients } = require('../config/redis');
const { sessionManager } = require('../config/session');
const { createLogger } = require('../utils/logger');
const mongoose = require('mongoose');
const os = require('os');

const logger = createLogger('monitoring');

/**
 * System Health Monitoring for 20K Users
 * Real-time performance metrics and alerts
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: { total: 0, success: 0, errors: 0 },
      trades: { total: 0, success: 0, failed: 0 },
      deposits: { pending: 0, completed: 0, failed: 0 },
      withdrawals: { pending: 0, completed: 0, failed: 0 },
      users: { active: 0, online: 0, totalRegistered: 0 },
      system: { 
        cpu: 0, 
        memory: { used: 0, total: 0, percentage: 0 },
        connections: { database: 0, redis: 0, websocket: 0 }
      }
    };
    
    this.alerts = [];
    this.startTime = new Date();
    
    // Start monitoring
    this.startMonitoring();
  }

  startMonitoring() {
    // Update metrics every 30 seconds
    setInterval(() => {
      this.updateSystemMetrics();
    }, 30000);

    // Update user metrics every 60 seconds
    setInterval(() => {
      this.updateUserMetrics();
    }, 60000);

    // Clean old alerts every 5 minutes
    setInterval(() => {
      this.cleanOldAlerts();
    }, 300000);
  }

  async updateSystemMetrics() {
    try {
      // CPU usage
      const cpus = os.cpus();
      let totalIdle = 0;
      let totalTick = 0;

      cpus.forEach(cpu => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
      });

      this.metrics.system.cpu = Math.round(100 - (totalIdle / totalTick) * 100);

      // Memory usage
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      
      this.metrics.system.memory = {
        used: Math.round(usedMem / 1024 / 1024), // MB
        total: Math.round(totalMem / 1024 / 1024), // MB
        percentage: Math.round((usedMem / totalMem) * 100)
      };

      // Database connections
      this.metrics.system.connections.database = mongoose.connection.readyState === 1 ? 
        mongoose.connection.db.serverConfig.connections.length || 1 : 0;

      // Redis connections
      this.metrics.system.connections.redis = Object.keys(redisClients).length;

      // Check for alerts
      this.checkSystemAlerts();

    } catch (error) {
      logger.error('Error updating system metrics', { error: error.message });
    }
  }

  async updateUserMetrics() {
    try {
      // Session statistics - handle both Redis and fallback sessions
      let sessionStats;
      try {
        sessionStats = await sessionManager.getSessionStats();
      } catch (error) {
        // Fallback if Redis is not available
        sessionStats = {
          activeSessions: 0,
          userSessions: 0,
          adminSessions: 0,
          totalSessions: 0
        };
        logger.debug('Using fallback session stats', { error: error.message });
      }
      
      this.metrics.users.online = sessionStats.activeSessions;

      // Database statistics
      const User = require('../models/user');
      this.metrics.users.totalRegistered = await User.countDocuments();
      
      // Active users (logged in within 24 hours)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      this.metrics.users.active = await User.countDocuments({
        lastLoginAt: { $gte: yesterday }
      });

      // Trading metrics
      const Order = require('../models/order');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayOrders = await Order.aggregate([
        { $match: { createdAt: { $gte: today } } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      this.metrics.trades.total = todayOrders.reduce((sum, order) => sum + order.count, 0);
      this.metrics.trades.success = todayOrders.find(o => o._id === 'filled')?.count || 0;
      this.metrics.trades.failed = todayOrders.find(o => o._id === 'rejected')?.count || 0;

      // Deposit metrics
      const DepositTransaction = require('../models/depositTransaction');
      const todayDeposits = await DepositTransaction.aggregate([
        { $match: { createdAt: { $gte: today } } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      this.metrics.deposits.pending = todayDeposits.find(d => d._id === 'pending')?.count || 0;
      this.metrics.deposits.completed = todayDeposits.find(d => d._id === 'completed')?.count || 0;
      this.metrics.deposits.failed = todayDeposits.find(d => d._id === 'failed')?.count || 0;

      // Withdrawal metrics
      const WithdrawalRequest = require('../models/withdrawalRequest');
      const todayWithdrawals = await WithdrawalRequest.aggregate([
        { $match: { createdAt: { $gte: today } } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      this.metrics.withdrawals.pending = todayWithdrawals.find(w => w._id === 'pending')?.count || 0;
      this.metrics.withdrawals.completed = todayWithdrawals.find(w => w._id === 'completed')?.count || 0;
      this.metrics.withdrawals.failed = todayWithdrawals.find(w => w._id === 'failed')?.count || 0;

    } catch (error) {
      logger.error('Error updating user metrics', { error: error.message });
    }
  }

  checkSystemAlerts() {
    const now = new Date();

    // High CPU usage alert
    if (this.metrics.system.cpu > 80) {
      this.addAlert('HIGH_CPU', `CPU usage is ${this.metrics.system.cpu}%`, 'critical');
    }

    // High memory usage alert
    if (this.metrics.system.memory.percentage > 85) {
      this.addAlert('HIGH_MEMORY', `Memory usage is ${this.metrics.system.memory.percentage}%`, 'critical');
    }

    // Database connection alert
    if (this.metrics.system.connections.database === 0) {
      this.addAlert('DB_DISCONNECTED', 'Database connection lost', 'critical');
    }

    // High user load alert
    if (this.metrics.users.online > 18000) { // 90% of 20K capacity
      this.addAlert('HIGH_USER_LOAD', `${this.metrics.users.online} users online (90% capacity)`, 'warning');
    }

    // Trading performance alert
    const tradeSuccessRate = this.metrics.trades.total > 0 ? 
      (this.metrics.trades.success / this.metrics.trades.total) * 100 : 100;
    
    if (tradeSuccessRate < 95 && this.metrics.trades.total > 100) {
      this.addAlert('LOW_TRADE_SUCCESS', `Trade success rate is ${tradeSuccessRate.toFixed(1)}%`, 'warning');
    }
  }

  addAlert(type, message, severity) {
    // Check if alert already exists in last 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const existingAlert = this.alerts.find(alert => 
      alert.type === type && alert.timestamp > tenMinutesAgo
    );

    if (!existingAlert) {
      const alert = {
        id: Date.now(),
        type,
        message,
        severity,
        timestamp: new Date()
      };

      this.alerts.push(alert);
      
      logger.warn('System alert generated', alert);

      // Keep only last 100 alerts
      if (this.alerts.length > 100) {
        this.alerts = this.alerts.slice(-100);
      }
    }
  }

  cleanOldAlerts() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.alerts = this.alerts.filter(alert => alert.timestamp > oneHourAgo);
  }

  getMetrics() {
    const uptime = Math.floor((new Date() - this.startTime) / 1000);
    
    return {
      ...this.metrics,
      uptime: {
        seconds: uptime,
        formatted: this.formatUptime(uptime)
      },
      alerts: this.alerts.slice(-20), // Last 20 alerts
      timestamp: new Date()
    };
  }

  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  }

  incrementRequest(success = true) {
    this.metrics.requests.total++;
    if (success) {
      this.metrics.requests.success++;
    } else {
      this.metrics.requests.errors++;
    }
  }
}

// Global performance monitor instance
const performanceMonitor = new PerformanceMonitor();

// Middleware to track requests
const trackRequest = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    performanceMonitor.incrementRequest(res.statusCode < 400);
    originalSend.call(this, data);
  };
  
  next();
};

// Routes for monitoring dashboard
router.get('/health', (req, res) => {
  const metrics = performanceMonitor.getMetrics();
  
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date(),
    uptime: metrics.uptime,
    system: metrics.system,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    redis: Object.keys(redisClients).length > 0 ? 'connected' : 'disconnected'
  };

  // Determine overall health
  if (metrics.system.cpu > 90 || metrics.system.memory.percentage > 90) {
    healthStatus.status = 'critical';
  } else if (metrics.system.cpu > 80 || metrics.system.memory.percentage > 85) {
    healthStatus.status = 'warning';
  }

  res.json(healthStatus);
});

router.get('/metrics', (req, res) => {
  res.json(performanceMonitor.getMetrics());
});

router.get('/alerts', (req, res) => {
  res.json({
    alerts: performanceMonitor.alerts,
    total: performanceMonitor.alerts.length
  });
});

// Database performance metrics
router.get('/database', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const admin = db.admin();
    
    const [serverStatus, dbStats] = await Promise.all([
      admin.serverStatus(),
      db.stats()
    ]);

    const metrics = {
      connections: {
        current: serverStatus.connections.current,
        available: serverStatus.connections.available,
        totalCreated: serverStatus.connections.totalCreated
      },
      operations: {
        insert: serverStatus.opcounters.insert,
        query: serverStatus.opcounters.query,
        update: serverStatus.opcounters.update,
        delete: serverStatus.opcounters.delete
      },
      memory: {
        resident: serverStatus.mem.resident,
        virtual: serverStatus.mem.virtual,
        mapped: serverStatus.mem.mapped
      },
      storage: {
        dataSize: Math.round(dbStats.dataSize / 1024 / 1024), // MB
        storageSize: Math.round(dbStats.storageSize / 1024 / 1024), // MB
        indexSize: Math.round(dbStats.indexSize / 1024 / 1024), // MB
        collections: dbStats.collections,
        indexes: dbStats.indexes
      }
    };

    res.json(metrics);
  } catch (error) {
    logger.error('Error getting database metrics', { error: error.message });
    res.status(500).json({ error: 'Failed to get database metrics' });
  }
});

// Redis performance metrics
router.get('/redis', async (req, res) => {
  try {
    const redisMetrics = {};
    
    for (const [name, client] of Object.entries(redisClients)) {
      try {
        const info = await client.info();
        const memory = await client.info('memory');
        
        redisMetrics[name] = {
          connected: client.status === 'ready',
          uptime: parseInt(info.match(/uptime_in_seconds:(\d+)/)?.[1] || 0),
          memory: {
            used: parseInt(memory.match(/used_memory:(\d+)/)?.[1] || 0),
            peak: parseInt(memory.match(/used_memory_peak:(\d+)/)?.[1] || 0)
          },
          commands: {
            processed: parseInt(info.match(/total_commands_processed:(\d+)/)?.[1] || 0),
            connections: parseInt(info.match(/total_connections_received:(\d+)/)?.[1] || 0)
          }
        };
      } catch (err) {
        redisMetrics[name] = { connected: false, error: err.message };
      }
    }

    res.json(redisMetrics);
  } catch (error) {
    logger.error('Error getting Redis metrics', { error: error.message });
    res.status(500).json({ error: 'Failed to get Redis metrics' });
  }
});

module.exports = router;
