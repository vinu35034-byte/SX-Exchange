const Redis = require('ioredis');

// Redis configuration for production scaling
class RedisManager {
  constructor() {
    this.clients = {};
    this.isConnected = false;
  }

  async connect() {
    try {
      const baseConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || null,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        family: 4,
        keepAlive: true,
        connectTimeout: parseInt(process.env.REDIS_CONNECTION_TIMEOUT || '10000'),
        commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000'),
      };

      // Main Redis client for general caching
      this.clients.main = new Redis({
        ...baseConfig,
        db: parseInt(process.env.REDIS_DB_MAIN || '0'),
      });

      // Rate limiting Redis client
      this.clients.rateLimit = new Redis({
        ...baseConfig,
        db: parseInt(process.env.REDIS_DB_RATE_LIMIT || '1'),
      });

      // Session storage Redis client
      this.clients.session = new Redis({
        ...baseConfig,
        db: parseInt(process.env.REDIS_DB_SESSION || '2'),
      });

      // Socket.IO adapter Redis clients
      this.clients.socketPub = new Redis({
        ...baseConfig,
        db: parseInt(process.env.REDIS_DB_SOCKET || '3'),
      });

      this.clients.socketSub = new Redis({
        ...baseConfig,
        db: parseInt(process.env.REDIS_DB_SOCKET || '3'),
      });

      // Connect all clients with better error handling
      try {
        await Promise.all([
          this.clients.main.connect(),
          this.clients.rateLimit.connect(),
          this.clients.session.connect(),
          this.clients.socketPub.connect(),
          this.clients.socketSub.connect(),
        ]);
        console.log('🔗 All Redis clients connected successfully');
      } catch (error) {
        console.error('❌ Redis connection failed:', error.message);
        if (error.message.includes('NOAUTH') || error.message.includes('Authentication')) {
          console.error('🔑 AUTHENTICATION ERROR: Redis requires a password but none provided or incorrect password');
          console.error('🔧 Fix: Set REDIS_PASSWORD environment variable with the correct Redis password');
        }
        throw error;
      }

      // Set up event listeners with enhanced error reporting
      Object.values(this.clients).forEach((client, index) => {
        const clientNames = ['main', 'rateLimit', 'session', 'socketPub', 'socketSub'];
        const clientName = clientNames[index];

        client.on('connect', () => {
          console.log(`✅ Redis ${clientName} client connected`);
        });

        client.on('error', (err) => {
          console.error(`❌ Redis ${clientName} client error:`, err.message);
          if (err.message.includes('NOAUTH') || err.message.includes('Authentication')) {
            console.error(`🔑 AUTHENTICATION ERROR on ${clientName}: Check REDIS_PASSWORD environment variable`);
          }
        });

        client.on('close', () => {
          console.log(`🔌 Redis ${clientName} client disconnected`);
        });
      });

      this.isConnected = true;
      console.log('🚀 Redis Manager initialized with all clients');

    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      console.warn('⚠️  Continuing without Redis - performance will be limited');
      this.isConnected = false;
    }
  }

  // Get specific Redis client
  getClient(type = 'main') {
    return this.clients[type] || null;
  }

  // Cache helpers
  async set(key, value, ttl = 3600) {
    if (!this.isConnected || !this.clients.main) return false;
    try {
      if (ttl) {
        await this.clients.main.setex(key, ttl, JSON.stringify(value));
      } else {
        await this.clients.main.set(key, JSON.stringify(value));
      }
      return true;
    } catch (error) {
      console.error('Redis set error:', error);
      return false;
    }
  }

  async get(key) {
    if (!this.isConnected || !this.clients.main) return null;
    try {
      const value = await this.clients.main.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async del(key) {
    if (!this.isConnected || !this.clients.main) return false;
    try {
      await this.clients.main.del(key);
      return true;
    } catch (error) {
      console.error('Redis del error:', error);
      return false;
    }
  }

  async exists(key) {
    if (!this.isConnected || !this.clients.main) return false;
    try {
      const result = await this.clients.main.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  }

  // Cleanup
  async disconnect() {
    if (this.isConnected) {
      await Promise.all(
        Object.values(this.clients).map(client => client.quit())
      );
      this.isConnected = false;
      console.log('🔌 Redis Manager disconnected');
    }
  }
}

// Create singleton instance
const redisManager = new RedisManager();

module.exports = redisManager;
