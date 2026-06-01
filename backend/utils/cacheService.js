const redis = require('redis');
const { createLogger } = require('./logger');

const logger = createLogger('cache-service');

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.defaultTTL = 300; // 5 minutes default TTL
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
  }

  async connect() {
    try {
      if (this.isConnected) {
        return this.client;
      }

      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = redis.createClient({
        url: redisUrl,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.error('Redis connection refused', {
              error: options.error.message,
              attempt: options.attempt,
              timestamp: new Date().toISOString()
            });
            return new Error('Redis server connection refused');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error('Redis retry time exhausted');
          }
          if (options.attempt > this.retryAttempts) {
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.client.on('error', (err) => {
        logger.error('Redis cache error', {
          error: err.message,
          timestamp: new Date().toISOString()
        });
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis cache connected successfully', {
          timestamp: new Date().toISOString()
        });
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('Redis cache ready for operations', {
          timestamp: new Date().toISOString()
        });
      });

      this.client.on('end', () => {
        logger.warn('Redis cache connection ended', {
          timestamp: new Date().toISOString()
        });
        this.isConnected = false;
      });

      await this.client.connect();
      return this.client;

    } catch (error) {
      logger.error('Failed to connect to Redis cache', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.client && this.isConnected) {
        await this.client.quit();
        this.isConnected = false;
        logger.info('Redis cache disconnected', {
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Error disconnecting Redis cache', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Get cached data
  async get(key, options = {}) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const { parseJSON = true } = options;
      const value = await this.client.get(key);

      if (value === null) {
        logger.debug('Cache miss', {
          key,
          timestamp: new Date().toISOString()
        });
        return null;
      }

      logger.debug('Cache hit', {
        key,
        timestamp: new Date().toISOString()
      });

      return parseJSON ? JSON.parse(value) : value;

    } catch (error) {
      logger.error('Cache get error', {
        key,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return null; // Return null on cache error to fallback to original source
    }
  }

  // Set cached data
  async set(key, value, options = {}) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const { 
        ttl = this.defaultTTL, 
        stringify = true,
        nx = false // Only set if key doesn't exist
      } = options;

      const serializedValue = stringify ? JSON.stringify(value) : value;
      
      let result;
      if (nx) {
        result = await this.client.setNX(key, serializedValue);
        if (result && ttl > 0) {
          await this.client.expire(key, ttl);
        }
      } else {
        if (ttl > 0) {
          result = await this.client.setEx(key, ttl, serializedValue);
        } else {
          result = await this.client.set(key, serializedValue);
        }
      }

      logger.debug('Cache set', {
        key,
        ttl,
        nx,
        success: !!result,
        timestamp: new Date().toISOString()
      });

      return result;

    } catch (error) {
      logger.error('Cache set error', {
        key,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return false;
    }
  }

  // Delete cached data
  async del(key) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const result = await this.client.del(key);
      
      logger.debug('Cache delete', {
        key,
        deleted: result > 0,
        timestamp: new Date().toISOString()
      });

      return result > 0;

    } catch (error) {
      logger.error('Cache delete error', {
        key,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return false;
    }
  }

  // Delete multiple keys with pattern
  async delPattern(pattern) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      const result = await this.client.del(keys);
      
      logger.info('Cache pattern delete', {
        pattern,
        keysFound: keys.length,
        deleted: result,
        timestamp: new Date().toISOString()
      });

      return result;

    } catch (error) {
      logger.error('Cache pattern delete error', {
        pattern,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return 0;
    }
  }

  // Check if key exists
  async exists(key) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const result = await this.client.exists(key);
      return result === 1;

    } catch (error) {
      logger.error('Cache exists error', {
        key,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return false;
    }
  }

  // Set expiration time for existing key
  async expire(key, ttl) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const result = await this.client.expire(key, ttl);
      
      logger.debug('Cache expire set', {
        key,
        ttl,
        success: result === 1,
        timestamp: new Date().toISOString()
      });

      return result === 1;

    } catch (error) {
      logger.error('Cache expire error', {
        key,
        ttl,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return false;
    }
  }

  // Get remaining TTL for key
  async ttl(key) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const result = await this.client.ttl(key);
      return result;

    } catch (error) {
      logger.error('Cache TTL error', {
        key,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return -1;
    }
  }

  // Increment numeric value
  async incr(key, amount = 1) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const result = amount === 1 
        ? await this.client.incr(key)
        : await this.client.incrBy(key, amount);

      logger.debug('Cache increment', {
        key,
        amount,
        newValue: result,
        timestamp: new Date().toISOString()
      });

      return result;

    } catch (error) {
      logger.error('Cache increment error', {
        key,
        amount,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return null;
    }
  }

  // Decrement numeric value
  async decr(key, amount = 1) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const result = amount === 1 
        ? await this.client.decr(key)
        : await this.client.decrBy(key, amount);

      logger.debug('Cache decrement', {
        key,
        amount,
        newValue: result,
        timestamp: new Date().toISOString()
      });

      return result;

    } catch (error) {
      logger.error('Cache decrement error', {
        key,
        amount,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return null;
    }
  }

  // Add to set
  async sadd(key, members) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const membersArray = Array.isArray(members) ? members : [members];
      const result = await this.client.sAdd(key, membersArray);

      logger.debug('Cache set add', {
        key,
        membersCount: membersArray.length,
        added: result,
        timestamp: new Date().toISOString()
      });

      return result;

    } catch (error) {
      logger.error('Cache set add error', {
        key,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return 0;
    }
  }

  // Remove from set
  async srem(key, members) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const membersArray = Array.isArray(members) ? members : [members];
      const result = await this.client.sRem(key, membersArray);

      logger.debug('Cache set remove', {
        key,
        membersCount: membersArray.length,
        removed: result,
        timestamp: new Date().toISOString()
      });

      return result;

    } catch (error) {
      logger.error('Cache set remove error', {
        key,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return 0;
    }
  }

  // Get all set members
  async smembers(key) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const result = await this.client.sMembers(key);

      logger.debug('Cache set members', {
        key,
        memberCount: result.length,
        timestamp: new Date().toISOString()
      });

      return result;

    } catch (error) {
      logger.error('Cache set members error', {
        key,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return [];
    }
  }

  // Check if member exists in set
  async sismember(key, member) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const result = await this.client.sIsMember(key, member);
      return result === 1;

    } catch (error) {
      logger.error('Cache set member check error', {
        key,
        member,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return false;
    }
  }

  // Flush all cache
  async flushAll() {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      await this.client.flushAll();
      
      logger.warn('Cache flush all executed', {
        timestamp: new Date().toISOString()
      });

      return true;

    } catch (error) {
      logger.error('Cache flush all error', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return false;
    }
  }

  // Get cache info and stats
  async getInfo() {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const info = await this.client.info();
      const dbSize = await this.client.dbSize();

      return {
        connected: this.isConnected,
        dbSize,
        info: info.split('\r\n').reduce((acc, line) => {
          const [key, value] = line.split(':');
          if (key && value) {
            acc[key] = value;
          }
          return acc;
        }, {})
      };

    } catch (error) {
      logger.error('Cache info error', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return {
        connected: false,
        error: error.message
      };
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

module.exports = cacheService;
