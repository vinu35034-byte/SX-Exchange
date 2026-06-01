const mongoose = require('mongoose');
require('dotenv').config();
const VIPLevel = require('../models/vipLevel');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.MONGODB_DB_NAME || 'crypto_db'
    });
    console.log('MongoDB connected successfully for VIP initialization');
    console.log('Connected to database:', mongoose.connection.db.databaseName);
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};

const defaultVIPLevels = [
  {
    level: 0,
    name: 'Bronze',
    minimumLevel1Referrals: 0,
    minimumTotalReferrals: 0,
    dailyReward: 0.1,
    oneTimeUpgradeReward: 0,
    currency: 'USDT',
    requirements: {
      description: 'Default level for all new users. No referrals required.',
      additionalConditions: ['Complete account registration']
    },
    benefits: {
      description: 'Basic trading features with daily rewards',
      features: ['$0.1 daily reward (manual claim)', 'Access to trading', 'Basic support', 'Standard fees']
    }
  },
  {
    level: 1,
    name: 'Silver',
    minimumLevel1Referrals: 5,
    minimumTotalReferrals: 10,
    dailyReward: 0.2,
    oneTimeUpgradeReward: 5,
    currency: 'USDT',
    requirements: {
      description: 'Requires 5 direct referrals and 10 total referrals across all levels (Level 1 + Level 2 + Level 3)',
      additionalConditions: ['Must have valid KYC status', 'Active trading account']
    },
    benefits: {
      description: 'Daily rewards and priority support',
      features: ['$0.2 daily reward (manual claim)', 'Priority customer support', 'Reduced trading fees', 'VIP badge']
    }
  },
  {
    level: 2,
    name: 'Gold',
    minimumLevel1Referrals: 15,
    minimumTotalReferrals: 25,
    dailyReward: 0.5,
    oneTimeUpgradeReward: 15,
    currency: 'USDT',
    requirements: {
      description: 'Requires 15 direct referrals and 25 total referrals across all levels',
      additionalConditions: ['Maintain active referral network', 'Regular trading activity']
    },
    benefits: {
      description: 'Enhanced rewards and exclusive features',
      features: ['$0.5 daily reward (manual claim)', 'Dedicated account manager', 'Lowest trading fees', 'Early access to new features']
    }
  },
  {
    level: 3,
    name: 'Platinum',
    minimumLevel1Referrals: 30,
    minimumTotalReferrals: 50,
    dailyReward: 1.0,
    oneTimeUpgradeReward: 50,
    currency: 'USDT',
    requirements: {
      description: 'Requires 30 direct referrals and 50 total referrals across all levels',
      additionalConditions: ['Proven track record', 'Community leadership']
    },
    benefits: {
      description: 'Premium rewards and exclusive access',
      features: ['$1.0 daily reward (manual claim)', '24/7 priority support', 'Zero trading fees', 'Exclusive market insights', 'Beta testing access']
    }
  },
  {
    level: 4,
    name: 'Diamond',
    minimumLevel1Referrals: 50,
    minimumTotalReferrals: 100,
    dailyReward: 2.0,
    oneTimeUpgradeReward: 100,
    currency: 'USDT',
    requirements: {
      description: 'Requires 50 direct referrals and 100 total referrals across all levels',
      additionalConditions: ['Exceptional contribution to platform growth', 'Verified influence in crypto community']
    },
    benefits: {
      description: 'Ultimate VIP experience',
      features: ['$2.0 daily reward (manual claim)', 'Personal relationship manager', 'Free advanced features', 'Exclusive events access', 'Revenue sharing opportunities']
    }
  }
];

const initializeVIPLevels = async () => {
  try {
    await connectDB();
    
    console.log('🏆 Initializing VIP Levels...');
    
    // Check if VIP levels already exist
    const existingLevels = await VIPLevel.countDocuments();
    
    if (existingLevels > 0) {
      console.log(`⚠️  Found ${existingLevels} existing VIP levels. Skipping initialization.`);
      console.log('💡 To reset VIP levels, delete them manually and run this script again.');
      process.exit(0);
    }
    
    // Create default VIP levels
    for (const levelData of defaultVIPLevels) {
      const vipLevel = new VIPLevel(levelData);
      await vipLevel.save();
      console.log(`✅ Created VIP Level ${levelData.level}: ${levelData.name}`);
    }
    
    console.log('🎉 VIP Levels initialized successfully!');
    console.log('\n📊 Summary:');
    console.log('VIP 0 (Bronze): Default level - No rewards');
    console.log('VIP 1 (Silver): 5 direct + 10 total referrals - $0.2 daily + $5 upgrade');
    console.log('VIP 2 (Gold): 15 direct + 25 total referrals - $0.5 daily + $15 upgrade');
    console.log('VIP 3 (Platinum): 30 direct + 50 total referrals - $1.0 daily + $50 upgrade');
    console.log('VIP 4 (Diamond): 50 direct + 100 total referrals - $2.0 daily + $100 upgrade');
    
    console.log('\n🔔 Note: Daily rewards must be manually claimed by users each day.');
    console.log('🔔 Upgrade rewards are automatically awarded when users reach new VIP levels.');
    
  } catch (error) {
    console.error('❌ Error initializing VIP levels:', error);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
};

// Run initialization if this file is executed directly
if (require.main === module) {
  initializeVIPLevels();
}

module.exports = initializeVIPLevels;
