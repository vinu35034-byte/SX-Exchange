/**
 * Script to check and optionally clean duplicate following records
 * This helps identify users who have inactive records that might cause issues
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function checkDuplicates() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/crypto_db';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('copytradingfollowers');

    // Find duplicate user-trader combinations
    const duplicates = await collection.aggregate([
      {
        $group: {
          _id: { user: '$user', trader: '$trader' },
          count: { $sum: 1 },
          records: { $push: { _id: '$_id', isActive: '$isActive', status: '$status' } }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]).toArray();

    console.log(`\n📊 Found ${duplicates.length} duplicate user-trader combinations\n`);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found! Database is clean.');
      return;
    }

    for (const dup of duplicates) {
      console.log(`User: ${dup._id.user}, Trader: ${dup._id.trader}`);
      console.log(`  Records (${dup.count} total):`);
      dup.records.forEach(record => {
        console.log(`    - ID: ${record._id}, Active: ${record.isActive}, Status: ${record.status}`);
      });
      console.log('');
    }

    // Optionally clean up inactive duplicates (keep only the most recent)
    console.log('\n🧹 Cleaning up inactive duplicate records...\n');
    
    for (const dup of duplicates) {
      // Get all records for this user-trader combination
      const records = await collection.find({
        user: dup._id.user,
        trader: dup._id.trader
      }).sort({ createdAt: -1 }).toArray();

      // Keep the most recent one, delete the rest if they're inactive
      const toDelete = records.slice(1).filter(r => !r.isActive);
      
      if (toDelete.length > 0) {
        const idsToDelete = toDelete.map(r => r._id);
        const result = await collection.deleteMany({ _id: { $in: idsToDelete } });
        console.log(`  Deleted ${result.deletedCount} old inactive records for user ${dup._id.user}`);
      }
    }

    console.log('\n✅ Cleanup completed!');

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Run the script
checkDuplicates()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
