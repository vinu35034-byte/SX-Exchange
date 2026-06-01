require('dotenv').config();
const mongoose = require('mongoose');
const VIPLevel = require('../models/vipLevel');

const checkVIPLevels = async () => {
  try {
    console.log('🔗 Connecting to MongoDB...');
    console.log('MONGO_URI:', process.env.MONGO_URI);
    console.log('Database Name:', process.env.MONGODB_DB_NAME);
    
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.MONGODB_DB_NAME || 'crypto_db'
    });

    console.log('✅ Connected to database:', mongoose.connection.db.databaseName);

    // Check if VIP levels exist
    const vipLevels = await VIPLevel.find({}).sort({ level: 1 });
    
    console.log(`\n📊 Found ${vipLevels.length} VIP levels:`);
    vipLevels.forEach(level => {
      console.log(`  VIP ${level.level}: ${level.name} - Daily: $${level.dailyReward}, Upgrade: $${level.oneTimeUpgradeReward}`);
    });

    if (vipLevels.length === 0) {
      console.log('\n🆕 No VIP levels found. Creating default levels...');
      
      const defaultLevels = [
        {
          level: 0,
          name: 'Basic',
          minimumLevel1Referrals: 0,
          minimumTotalReferrals: 0,
          dailyReward: 0,
          oneTimeUpgradeReward: 0,
          currency: 'USDT',
          requirements: {
            description: 'Default level for all new users. No referrals required.',
            additionalConditions: ['Complete account registration']
          },
          benefits: {
            description: 'Basic trading features',
            features: ['Basic trading', 'Standard support', 'Standard fees']
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
            additionalConditions: ['KYC verification required', 'Active trading account']
          },
          benefits: {
            description: 'Daily rewards and priority support',
            features: ['$0.2 daily reward', 'Priority support', 'Reduced fees', 'VIP badge']
          }
        },
        {
          level: 2,
          name: 'Gold',
          minimumLevel1Referrals: 15,
          minimumTotalReferrals: 35,
          dailyReward: 0.5,
          oneTimeUpgradeReward: 15,
          currency: 'USDT',
          requirements: {
            description: 'Requires 15 direct referrals and 35 total referrals across all levels (Level 1 + Level 2 + Level 3)',
            additionalConditions: ['Active trading required', 'Verified KYC status']
          },
          benefits: {
            description: 'Enhanced rewards and exclusive features',
            features: ['$0.5 daily reward', 'Exclusive features', 'Personal account manager', 'Advanced analytics']
          }
        },
        {
          level: 3,
          name: 'Platinum',
          minimumLevel1Referrals: 30,
          minimumTotalReferrals: 75,
          dailyReward: 1.0,
          oneTimeUpgradeReward: 50,
          currency: 'USDT',
          requirements: {
            description: 'Requires 30 direct referrals and 75 total referrals across all levels (Level 1 + Level 2 + Level 3)',
            additionalConditions: ['High volume trading', 'Premium KYC verification']
          },
          benefits: {
            description: 'Premium benefits and maximum rewards',
            features: ['$1.0 daily reward', 'Premium features', 'VIP support', 'Special events access', 'Personal advisor']
          }
        }
      ];

      for (const levelData of defaultLevels) {
        const level = new VIPLevel(levelData);
        await level.save();
        console.log(`✅ Created VIP Level ${levelData.level}: ${levelData.name}`);
      }

      console.log('\n🎉 Default VIP levels created successfully!');
    }

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkVIPLevels();
