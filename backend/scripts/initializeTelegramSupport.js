const mongoose = require('mongoose');
const TelegramSupport = require('../models/telegramSupport');
const Admin = require('../models/admin');
const connectDB = require('../config/db-optimized');

const defaultSupportTopics = [
  {
    topic: 'getting_started',
    title: 'Getting Started',
    description: 'Learn the basics of crypto trading and platform navigation',
    telegramUsername: 'crypto_support_start',
    priority: 1,
    icon: 'PlayCircleIcon'
  },
  {
    topic: 'trading_guide',
    title: 'Trading Guide',
    description: 'How to buy and sell cryptocurrencies effectively',
    telegramUsername: 'crypto_trading_help',
    priority: 2,
    icon: 'ChartBarIcon'
  },
  {
    topic: 'kyc_verification',
    title: 'KYC Verification',
    description: 'Identity verification process and requirements',
    telegramUsername: 'crypto_kyc_support',
    priority: 3,
    icon: 'IdentificationIcon'
  },
  {
    topic: 'deposits_withdrawals',
    title: 'Deposits & Withdrawals',
    description: 'Managing your funds - deposits and withdrawal assistance',
    telegramUsername: 'crypto_funds_help',
    priority: 4,
    icon: 'BanknotesIcon'
  },
  {
    topic: 'referral_program',
    title: 'Referral Program',
    description: 'Earn rewards by referring friends to our platform',
    telegramUsername: 'crypto_referral_help',
    priority: 5,
    icon: 'UserGroupIcon'
  },
  {
    topic: 'security_practices',
    title: 'Security Best Practices',
    description: 'Keep your account secure with our security guidelines',
    telegramUsername: 'crypto_security_help',
    priority: 6,
    icon: 'ShieldCheckIcon'
  },
  {
    topic: 'troubleshooting',
    title: 'Troubleshooting',
    description: 'Common issues and their solutions',
    telegramUsername: 'crypto_tech_support',
    priority: 7,
    icon: 'WrenchScrewdriverIcon'
  },
  {
    topic: 'general_support',
    title: 'General Support',
    description: 'Get help from our support team for any other questions',
    telegramUsername: 'crypto_general_help',
    priority: 8,
    icon: 'ChatBubbleLeftRightIcon'
  }
];

async function initializeTelegramSupport() {
  try {
    // Connect to database
    await connectDB();

    // Find or create a default admin user
    let admin = await Admin.findOne({ role: 'super_admin' });
    if (!admin) {
      admin = await Admin.findOne({});
      if (!admin) {
        console.log('❌ No admin user found. Please create an admin user first.');
        return;
      }
    }

    console.log('📱 Initializing Telegram support topics...');

    for (const topicData of defaultSupportTopics) {
      const existingTopic = await TelegramSupport.findOne({ topic: topicData.topic });
      
      if (!existingTopic) {
        const newTopic = new TelegramSupport({
          ...topicData,
          createdBy: admin._id
        });
        
        await newTopic.save();
        console.log(`✅ Created support topic: ${topicData.title}`);
      } else {
        console.log(`⚠️  Support topic already exists: ${topicData.title}`);
      }
    }

    console.log('🎉 Telegram support initialization completed!');
    console.log('');
    console.log('📋 Summary:');
    console.log(`   - ${defaultSupportTopics.length} support topics configured`);
    console.log('   - All topics are active by default');
    console.log('   - Admin can manage topics via /api/v1/admin/telegram-support');
    console.log('   - Users can access topics via /api/v1/telegram-support/active');
    console.log('');
    console.log('⚙️  Next steps:');
    console.log('   1. Update Telegram usernames in admin panel');
    console.log('   2. Configure real Telegram support accounts');
    console.log('   3. Test the help component integration');

  } catch (error) {
    console.error('❌ Error initializing Telegram support:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run if called directly
if (require.main === module) {
  initializeTelegramSupport();
}

module.exports = initializeTelegramSupport;
