const cacheService = require('./cacheService');
const { createLogger } = require('./logger');

const logger = createLogger('cache-warmup');

class CacheWarmupService {
  constructor() {
    this.warmupTasks = [];
    this.isWarming = false;
  }

  // Register a cache warmup task
  registerWarmupTask(name, fn, priority = 5) {
    this.warmupTasks.push({
      name,
      fn,
      priority,
      lastRun: null,
      runCount: 0,
      avgDuration: 0
    });
    
    // Sort by priority (higher numbers run first)
    this.warmupTasks.sort((a, b) => b.priority - a.priority);
    
    logger.info('Cache warmup task registered', {
      name,
      priority,
      totalTasks: this.warmupTasks.length,
      timestamp: new Date().toISOString()
    });
  }

  // Run all warmup tasks
  async warmupCache() {
    if (this.isWarming) {
      logger.warn('Cache warmup already in progress', {
        timestamp: new Date().toISOString()
      });
      return;
    }

    this.isWarming = true;
    const startTime = Date.now();

    logger.info('Starting cache warmup process', {
      tasksCount: this.warmupTasks.length,
      timestamp: new Date().toISOString()
    });

 
    const results = [];

    for (const task of this.warmupTasks) {
      const taskStart = Date.now();
      
      try {
    
        await task.fn();
        
        const duration = Date.now() - taskStart;
        task.lastRun = new Date();
        task.runCount++;
        task.avgDuration = (task.avgDuration * (task.runCount - 1) + duration) / task.runCount;
        
        results.push({
          name: task.name,
          success: true,
          duration
        });
        
     
        logger.info('Cache warmup task completed', {
          taskName: task.name,
          duration,
          runCount: task.runCount,
          avgDuration: Math.round(task.avgDuration),
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        const duration = Date.now() - taskStart;
        
        results.push({
          name: task.name,
          success: false,
          error: error.message,
          duration
        });
        

        logger.error('Cache warmup task failed', {
          taskName: task.name,
          error: error.message,
          duration,
          timestamp: new Date().toISOString()
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    
    this.isWarming = false;

    logger.info('Cache warmup process completed', {
      totalDuration,
      tasksTotal: this.warmupTasks.length,
      tasksSuccessful: successCount,
      tasksFailed: this.warmupTasks.length - successCount,
      results,
      timestamp: new Date().toISOString()
    });


    return {
      success: true,
      totalDuration,
      tasksTotal: this.warmupTasks.length,
      tasksSuccessful: successCount,
      tasksFailed: this.warmupTasks.length - successCount,
      results
    };
  }

  // Get warmup statistics
  getStats() {
    return {
      isWarming: this.isWarming,
      totalTasks: this.warmupTasks.length,
      tasks: this.warmupTasks.map(task => ({
        name: task.name,
        priority: task.priority,
        lastRun: task.lastRun,
        runCount: task.runCount,
        avgDuration: Math.round(task.avgDuration)
      }))
    };
  }

  // Warmup specific cache keys
  async warmupSpecific(taskNames) {
    const tasksToRun = this.warmupTasks.filter(task => 
      taskNames.includes(task.name)
    );

    if (tasksToRun.length === 0) {
      throw new Error(`No warmup tasks found for: ${taskNames.join(', ')}`);
    }

    logger.info('Starting selective cache warmup', {
      requestedTasks: taskNames,
      foundTasks: tasksToRun.length,
      timestamp: new Date().toISOString()
    });

    const results = [];

    for (const task of tasksToRun) {
      const taskStart = Date.now();
      
      try {
        await task.fn();
        
        const duration = Date.now() - taskStart;
        task.lastRun = new Date();
        task.runCount++;
        task.avgDuration = (task.avgDuration * (task.runCount - 1) + duration) / task.runCount;
        
        results.push({
          name: task.name,
          success: true,
          duration
        });
        
        logger.info('Selective cache warmup task completed', {
          taskName: task.name,
          duration,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        results.push({
          name: task.name,
          success: false,
          error: error.message,
          duration: Date.now() - taskStart
        });
        
        logger.error('Selective cache warmup task failed', {
          taskName: task.name,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    return results;
  }

  // Clear cache and rewarm
  async refreshCache() {
    logger.info('Starting cache refresh process', {
      timestamp: new Date().toISOString()
    });


    // Clear all cache
    await cacheService.flushAll();

    // Rewarm cache
    const result = await this.warmupCache();
    return result;
  }
}

// Create singleton instance
const cacheWarmupService = new CacheWarmupService();

// Register common warmup tasks
cacheWarmupService.registerWarmupTask('market-coins', async () => {
  // Simulate market coins cache warmup
  const Coin = require('../models/coin');
  await Coin.getMarketCoins();
}, 10);

cacheWarmupService.registerWarmupTask('vip-levels', async () => {
  // Simulate VIP levels cache warmup
  const VIPLevel = require('../models/vipLevel');
  await VIPLevel.find({ isActive: true }).sort({ level: 1 });
}, 8);

cacheWarmupService.registerWarmupTask('market-tickers', async () => {
  // Simulate market tickers cache warmup
  const MarketTicker = require('../models/marketTicker');
  await MarketTicker.find({}).lean();
}, 9);

cacheWarmupService.registerWarmupTask('special-tokens', async () => {
  // Simulate special tokens cache warmup
  const SpecialToken = require('../models/specialToken');
  await SpecialToken.find({ isActive: true, showInMarket: true });
}, 7);

module.exports = cacheWarmupService;
