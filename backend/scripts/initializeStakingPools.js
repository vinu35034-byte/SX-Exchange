require('dotenv').config();
const mongoose = require('mongoose');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.MONGODB_DB_NAME || 'crypto_db'
    });
    console.log('✅ MongoDB connected successfully for staking pool initialization');
    console.log('Connected to database:', mongoose.connection.db.databaseName);
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

const StakingPool = require('../models/stakingPool');
const Admin = require('../models/admin');

async function initializeStakingPools() {
  try {
    console.log('🏆 Initializing Staking Pools...');
    
    // Connect to database
    await connectDB();
    console.log('✅ Connected to database');

    // Find any admin (created by other scripts)
    const defaultAdmin = await Admin.findOne({});
    if (!defaultAdmin) {
      console.error('❌ No admin found. Please run createDefaultAdmin.js first');
      process.exit(1);
    }
    console.log('✅ Found admin:', defaultAdmin.username);

    // Check if staking pools already exist
    const existingPools = await StakingPool.countDocuments();
    if (existingPools > 0) {
      console.log(`ℹ️ Found ${existingPools} existing staking pools. Skipping initialization.`);
      process.exit(0);
    }

    // Create sample staking pools
    const stakingPools = [
      {
        name: 'Bitcoin Flexible Staking',
        symbol: 'BTC',
        description: 'Flexible staking for Bitcoin with daily rewards. No lock period.',
        apy: 5.5,
        minimumStake: 0.001,
        maximumStake: 10,
        lockPeriod: 0, // Flexible
        totalPoolLimit: 100,
        rewardToken: 'BTC',
        rewardDistributionType: 'daily',
        isActive: true,
        isPublic: true,
        isVipOnly: false,
        earlyUnstakePenalty: 0,
        createdBy: defaultAdmin._id,
        lastModifiedBy: defaultAdmin._id,
        startDate: new Date(),
        endDate: null
      },
      {
        name: 'Ethereum 30-Day Lock',
        symbol: 'ETH',
        description: 'Higher APY Ethereum staking with 30-day lock period.',
        apy: 12.0,
        minimumStake: 0.1,
        maximumStake: 50,
        lockPeriod: 30,
        totalPoolLimit: 500,
        rewardToken: 'ETH',
        rewardDistributionType: 'daily',
        isActive: true,
        isPublic: true,
        isVipOnly: false,
        earlyUnstakePenalty: 5.0, // 5% penalty for early unstaking
        createdBy: defaultAdmin._id,
        lastModifiedBy: defaultAdmin._id,
        startDate: new Date(),
        endDate: null
      },
      {
        name: 'USDT High Yield',
        symbol: 'USDT',
        description: 'Stable coin staking with attractive returns. 90-day lock.',
        apy: 15.0,
        minimumStake: 100,
        maximumStake: 10000,
        lockPeriod: 90,
        totalPoolLimit: 100000,
        rewardToken: 'USDT',
        rewardDistributionType: 'daily',
        isActive: true,
        isPublic: true,
        isVipOnly: false,
        earlyUnstakePenalty: 10.0, // 10% penalty for early unstaking
        createdBy: defaultAdmin._id,
        lastModifiedBy: defaultAdmin._id,
        startDate: new Date(),
        endDate: null
      },
      {
        name: 'VIP Exclusive Pool',
        symbol: 'BTC',
        description: 'Exclusive high-yield pool for VIP members only. 180-day lock.',
        apy: 25.0,
        minimumStake: 1,
        maximumStake: 100,
        lockPeriod: 180,
        totalPoolLimit: 50,
        rewardToken: 'BTC',
        rewardDistributionType: 'daily',
        isActive: true,
        isPublic: true,
        isVipOnly: true,
        requiredVipLevel: 2,
        earlyUnstakePenalty: 15.0, // 15% penalty for early unstaking
        createdBy: defaultAdmin._id,
        lastModifiedBy: defaultAdmin._id,
        startDate: new Date(),
        endDate: null
      },
      {
        name: 'Flexible USDT',
        symbol: 'USDT',
        description: 'Low-risk flexible staking for USDT. Earn daily rewards.',
        apy: 8.0,
        minimumStake: 10,
        maximumStake: null, // No maximum
        lockPeriod: 0, // Flexible
        totalPoolLimit: null, // No limit
        rewardToken: 'USDT',
        rewardDistributionType: 'daily',
        isActive: true,
        isPublic: true,
        isVipOnly: false,
        earlyUnstakePenalty: 0,
        createdBy: defaultAdmin._id,
        lastModifiedBy: defaultAdmin._id,
        startDate: new Date(),
        endDate: null
      },
      {
        name: 'Ethereum Premium',
        symbol: 'ETH',
        description: 'Premium Ethereum staking with compound rewards. 365-day lock.',
        apy: 30.0,
        minimumStake: 1,
        maximumStake: 20,
        lockPeriod: 365,
        totalPoolLimit: 200,
        rewardToken: 'ETH',
        rewardDistributionType: 'compound',
        isActive: true,
        isPublic: true,
        isVipOnly: false,
        earlyUnstakePenalty: 20.0, // 20% penalty for early unstaking
        createdBy: defaultAdmin._id,
        lastModifiedBy: defaultAdmin._id,
        startDate: new Date(),
        endDate: null
      }
    ];

    // Create the pools
    const createdPools = await StakingPool.insertMany(stakingPools);
    
    console.log('✅ Successfully created staking pools:');
    createdPools.forEach((pool, index) => {
      console.log(`   ${index + 1}. ${pool.name} (${pool.symbol}) - ${pool.apy}% APY`);
      console.log(`      Lock Period: ${pool.lockPeriod === 0 ? 'Flexible' : pool.lockPeriod + ' days'}`);
      console.log(`      Min Stake: ${pool.minimumStake} ${pool.symbol}`);
      console.log(`      Pool Limit: ${pool.totalPoolLimit ? pool.totalPoolLimit + ' ' + pool.symbol : 'Unlimited'}`);
      console.log(`      VIP Only: ${pool.isVipOnly ? 'Yes (Level ' + pool.requiredVipLevel + '+)' : 'No'}`);
      console.log('');
    });

    console.log(`\n🎉 Staking system initialized with ${createdPools.length} pools!`);
    console.log('\nNext steps:');
    console.log('1. Start the server to begin automated reward calculation');
    console.log('2. Access the admin panel to manage pools');
    console.log('3. Users can now start staking on the frontend');

  } catch (error) {
    console.error('❌ Error initializing staking pools:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('📝 Database connection closed');
    process.exit(0);
  }
}

// Run the initialization
initializeStakingPools();
