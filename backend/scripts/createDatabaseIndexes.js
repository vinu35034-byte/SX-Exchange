const mongoose = require('mongoose');
const { createLogger } = require('../utils/logger');

const logger = createLogger('database-indexes');

/**
 * Create performance indexes for 20K users
 * These indexes are critical for fast queries under high load
 */
async function createPerformanceIndexes() {
  try {
    logger.info('🔍 Creating performance indexes for 20K user scaling...');

    // Users collection indexes
    logger.info('Creating User collection indexes...');
    await mongoose.connection.db.collection('users').createIndex({ email: 1 }, { unique: true });
    await mongoose.connection.db.collection('users').createIndex({ username: 1 }, { unique: true, sparse: true });
    await mongoose.connection.db.collection('users').createIndex({ referralCode: 1 }, { unique: true, sparse: true });
    await mongoose.connection.db.collection('users').createIndex({ vipLevel: 1 });
    await mongoose.connection.db.collection('users').createIndex({ createdAt: -1 });
    await mongoose.connection.db.collection('users').createIndex({ lastTradeAt: -1 });

    // Orders collection indexes - Critical for trading performance
    logger.info('Creating Order collection indexes...');
    await mongoose.connection.db.collection('orders').createIndex({ user: 1, createdAt: -1 });
    await mongoose.connection.db.collection('orders').createIndex({ pair: 1, side: 1, price: 1 });
    await mongoose.connection.db.collection('orders').createIndex({ status: 1, pair: 1 });
    await mongoose.connection.db.collection('orders').createIndex({ orderId: 1 }, { unique: true });
    await mongoose.connection.db.collection('orders').createIndex({ user: 1, status: 1 });
    await mongoose.connection.db.collection('orders').createIndex({ pair: 1, status: 1, createdAt: -1 });

    // Trades collection indexes
    logger.info('Creating Trade collection indexes...');
    await mongoose.connection.db.collection('trades').createIndex({ user: 1, createdAt: -1 });
    await mongoose.connection.db.collection('trades').createIndex({ pair: 1, createdAt: -1 });
    await mongoose.connection.db.collection('trades').createIndex({ orderId: 1 });
    await mongoose.connection.db.collection('trades').createIndex({ tradeId: 1 }, { unique: true });

    // Deposit transactions indexes
    logger.info('Creating DepositTransaction collection indexes...');
    await mongoose.connection.db.collection('deposittransactions').createIndex({ userId: 1, status: 1 });
    await mongoose.connection.db.collection('deposittransactions').createIndex({ txHash: 1 }, { unique: true });
    await mongoose.connection.db.collection('deposittransactions').createIndex({ status: 1, createdAt: -1 });
    await mongoose.connection.db.collection('deposittransactions').createIndex({ network: 1, status: 1 });

    // Deposit addresses indexes
    logger.info('Creating DepositAddress collection indexes...');
    await mongoose.connection.db.collection('depositaddresses').createIndex({ userId: 1, network: 1 }, { unique: true });
    await mongoose.connection.db.collection('depositaddresses').createIndex({ address: 1 }, { unique: true });
    await mongoose.connection.db.collection('depositaddresses').createIndex({ isActive: 1, isSwept: 1 });

    // Withdrawal requests indexes
    logger.info('Creating WithdrawalRequest collection indexes...');
    await mongoose.connection.db.collection('withdrawalrequests').createIndex({ userId: 1, status: 1 });
    await mongoose.connection.db.collection('withdrawalrequests').createIndex({ status: 1, createdAt: -1 });
    await mongoose.connection.db.collection('withdrawalrequests').createIndex({ network: 1, status: 1 });

    // Transaction logs indexes
    logger.info('Creating TransactionLog collection indexes...');
    await mongoose.connection.db.collection('transactionlogs').createIndex({ userId: 1, type: 1, createdAt: -1 });
    await mongoose.connection.db.collection('transactionlogs').createIndex({ status: 1, createdAt: -1 });
    await mongoose.connection.db.collection('transactionlogs').createIndex({ txHash: 1 }, { sparse: true });
    await mongoose.connection.db.collection('transactionlogs').createIndex({ referenceId: 1 }, { sparse: true });
    await mongoose.connection.db.collection('transactionlogs').createIndex({ currency: 1, createdAt: -1 });

    // Notifications indexes
    logger.info('Creating Notification collection indexes...');
    await mongoose.connection.db.collection('notifications').createIndex({ 
      recipientType: 1, 
      recipientId: 1, 
      isRead: 1, 
      createdAt: -1 
    });
    await mongoose.connection.db.collection('notifications').createIndex({ type: 1, createdAt: -1 });
    await mongoose.connection.db.collection('notifications').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    // Market tickers indexes
    logger.info('Creating MarketTicker collection indexes...');
    await mongoose.connection.db.collection('markettickers').createIndex({ pair: 1 }, { unique: true });
    await mongoose.connection.db.collection('markettickers').createIndex({ updatedAt: -1 });

    // Order books indexes
    logger.info('Creating OrderBook collection indexes...');
    await mongoose.connection.db.collection('orderbooks').createIndex({ pair: 1 }, { unique: true });
    await mongoose.connection.db.collection('orderbooks').createIndex({ updatedAt: -1 });

    // Price history indexes
    logger.info('Creating PriceHistory collection indexes...');
    await mongoose.connection.db.collection('pricehistories').createIndex({ coin: 1, timestamp: -1 });

    // VIP rewards indexes
    logger.info('Creating VIPReward collection indexes...');
    await mongoose.connection.db.collection('viprewards').createIndex({ user: 1, rewardDate: 1, rewardType: 1 });
    await mongoose.connection.db.collection('viprewards').createIndex({ status: 1 });
    await mongoose.connection.db.collection('viprewards').createIndex({ expiresAt: 1 });
    await mongoose.connection.db.collection('viprewards').createIndex({ 
      user: 1, 
      rewardType: 1, 
      rewardDate: 1 
    }, { unique: true });

    // Referrals indexes
    logger.info('Creating Referral collection indexes...');
    await mongoose.connection.db.collection('referrals').createIndex({ referrer: 1, status: 1 });
    await mongoose.connection.db.collection('referrals').createIndex({ referee: 1 });
    await mongoose.connection.db.collection('referrals').createIndex({ createdAt: 1 });
    await mongoose.connection.db.collection('referrals').createIndex({ completedAt: 1 });

    // Coins indexes
    logger.info('Creating Coin collection indexes...');
    await mongoose.connection.db.collection('coins').createIndex({ symbol: 1 }, { unique: true });
    await mongoose.connection.db.collection('coins').createIndex({ status: 1, isTradingEnabled: 1, isVisible: 1 });

    // Special tokens indexes
    logger.info('Creating SpecialToken collection indexes...');
    await mongoose.connection.db.collection('specialtokens').createIndex({ symbol: 1 }, { unique: true });
    await mongoose.connection.db.collection('specialtokens').createIndex({ isActive: 1, showInMarket: 1 });
    await mongoose.connection.db.collection('specialtokens').createIndex({ lastSimulationUpdate: 1 });

    // KYC indexes
    logger.info('Creating KYC collection indexes...');
    await mongoose.connection.db.collection('kycs').createIndex({ userId: 1 }, { unique: true });
    await mongoose.connection.db.collection('kycs').createIndex({ status: 1 });
    await mongoose.connection.db.collection('kycs').createIndex({ submittedAt: -1 });

    // Admin indexes
    logger.info('Creating Admin collection indexes...');
    await mongoose.connection.db.collection('admins').createIndex({ email: 1 }, { unique: true });
    await mongoose.connection.db.collection('admins').createIndex({ username: 1 }, { unique: true });

    // Network fees indexes
    logger.info('Creating NetworkFee collection indexes...');
    await mongoose.connection.db.collection('networkfees').createIndex({ coin: 1, network: 1 }, { unique: true });

    logger.info('✅ All performance indexes created successfully');

    // Get collection stats
    const collections = await mongoose.connection.db.listCollections().toArray();
    logger.info(`📊 Database contains ${collections.length} collections`);

    for (const collection of collections) {
      try {
        const stats = await mongoose.connection.db.collection(collection.name).stats();
        const indexes = await mongoose.connection.db.collection(collection.name).listIndexes().toArray();
        
        logger.info(`Collection: ${collection.name}`, {
          documents: stats.count,
          indexes: indexes.length,
          avgObjSize: Math.round(stats.avgObjSize || 0),
          storageSize: Math.round(stats.storageSize / 1024) + 'KB'
        });
      } catch (err) {
        // Some collections might not exist or have permissions issues
        logger.debug(`Could not get stats for collection: ${collection.name}`);
      }
    }

  } catch (error) {
    logger.error('❌ Error creating performance indexes', { 
      error: error.message,
      stack: error.stack 
    });
    throw error;
  }
}

/**
 * Drop all indexes (use with caution!)
 */
async function dropAllIndexes() {
  try {
    logger.warn('🗑️  Dropping all custom indexes...');
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    for (const collection of collections) {
      try {
        await mongoose.connection.db.collection(collection.name).dropIndexes();
        logger.info(`Dropped indexes for: ${collection.name}`);
      } catch (err) {
        logger.debug(`Could not drop indexes for: ${collection.name} - ${err.message}`);
      }
    }
    
    logger.warn('⚠️  All custom indexes dropped');
  } catch (error) {
    logger.error('Error dropping indexes', { error: error.message });
    throw error;
  }
}

module.exports = {
  createPerformanceIndexes,
  dropAllIndexes
};
