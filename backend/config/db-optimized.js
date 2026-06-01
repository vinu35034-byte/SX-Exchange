const mongoose = require('mongoose');
const createDefaultAdmin = require('../scripts/createDefaultAdmin');
const { createLogger } = require('../utils/logger');

const logger = createLogger('database');

const connectDB = async () => {
  try {
    // Enhanced connection options with environment variables
    const connectionOptions = {
      dbName: process.env.MONGODB_DB_NAME || 'crypto_db',
      maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '100'),
      minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '5'),
      connectTimeoutMS: parseInt(process.env.MONGODB_CONNECTION_TIMEOUT || '30000'),
      socketTimeoutMS: 30000,
      serverSelectionTimeoutMS: 30000,
      maxIdleTimeMS: 30000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      retryReads: true,
    };

    logger.info('🔌 Connecting to MongoDB...', {
      dbName: connectionOptions.dbName,
      maxPoolSize: connectionOptions.maxPoolSize,
      minPoolSize: connectionOptions.minPoolSize
    });

    await mongoose.connect(process.env.MONGO_URI, connectionOptions);

    logger.info('✅ MongoDB connected successfully');

    // Log connection pool status
    const connection = mongoose.connection;
    connection.on('connected', () => {
      logger.info('📡 MongoDB connected');
    });

    connection.on('error', (err) => {
      logger.error('❌ MongoDB connection error', { error: err.message });
    });

    connection.on('disconnected', () => {
      logger.warn('⚠️ MongoDB disconnected');
    });

    // Monitor connection pool
    if (process.env.NODE_ENV === 'development') {
      setInterval(() => {
        const poolStats = {
          readyConnections: connection.readyState,
          activeConnections: connection.db?.serverConfig?.connections?.length || 0
        };
        logger.debug('📊 Connection pool stats', poolStats);
      }, 30000); // Log every 30 seconds in development
    }

    // Production connection monitoring
    if (process.env.NODE_ENV === 'production') {
      // Monitor for connection issues
      let reconnectAttempts = 0;
      
      connection.on('disconnected', () => {
        reconnectAttempts++;
        logger.error('🔄 Attempting to reconnect to MongoDB', { attempt: reconnectAttempts });
        
        if (reconnectAttempts > 5) {
          logger.error('💀 Maximum reconnection attempts reached. Exiting...');
          process.exit(1);
        }
      });

      connection.on('reconnected', () => {
        reconnectAttempts = 0;
        logger.info('✅ Successfully reconnected to MongoDB');
      });
    }

    // Create default admin after successful connection
    await createDefaultAdmin();
    
    logger.info('🚀 Database initialization completed');

  } catch (error) {
    logger.error('❌ MongoDB connection error', { 
      error: error.message,
      stack: error.stack 
    });
    
    // Graceful exit in production
    if (process.env.NODE_ENV === 'production') {
      setTimeout(() => {
        process.exit(1);
      }, 5000);
    } else {
      process.exit(1);
    }
  }
};

// Graceful shutdown handling
process.on('SIGINT', async () => {
  try {
    logger.info('🛑 Received SIGINT. Gracefully closing MongoDB connection...');
    await mongoose.connection.close();
    logger.info('✅ MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during graceful shutdown', { error: error.message });
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  try {
    logger.info('🛑 Received SIGTERM. Gracefully closing MongoDB connection...');
    await mongoose.connection.close();
    logger.info('✅ MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during graceful shutdown', { error: error.message });
    process.exit(1);
  }
});

module.exports = connectDB;
