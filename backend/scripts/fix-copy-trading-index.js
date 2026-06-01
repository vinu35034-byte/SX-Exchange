/**
 * Migration script to fix the copy trading follower index
 * This allows users to re-follow traders after unfollowing
 * 
 * Run this script once to update the database index
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function fixIndex() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/crypto_db';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('copytradingfollowers');

    // Get existing indexes
    const indexes = await collection.indexes();
    console.log('\n📋 Current indexes:');
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    // Drop the old indexes if they exist
    const indexesToDrop = ['user_1_trader_1', 'user_1_trader_1_isActive_1'];
    
    for (const indexName of indexesToDrop) {
      try {
        await collection.dropIndex(indexName);
        console.log(`\n✅ Dropped old index: ${indexName}`);
      } catch (error) {
        if (error.code === 27 || error.codeName === 'IndexNotFound') {
          console.log(`\n⚠️  Index ${indexName} not found (already removed or never existed)`);
        } else {
          console.log(`\n⚠️  Could not drop index ${indexName}:`, error.message);
        }
      }
    }

    // Create new partial unique index
    // This allows multiple user-trader combinations when isActive is false
    await collection.createIndex(
      { user: 1, trader: 1, isActive: 1 },
      { 
        unique: true,
        partialFilterExpression: { isActive: true },
        name: 'user_1_trader_1_isActive_1_partial'
      }
    );
    console.log('✅ Created new partial unique index: user_1_trader_1_isActive_1_partial');

    // Verify new indexes
    const newIndexes = await collection.indexes();
    console.log('\n📋 Updated indexes:');
    newIndexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
      if (index.partialFilterExpression) {
        console.log(`    Partial filter: ${JSON.stringify(index.partialFilterExpression)}`);
      }
    });

    console.log('\n✅ Index migration completed successfully!');
    console.log('\n💡 Users can now re-follow traders after unfollowing.');

  } catch (error) {
    console.error('\n❌ Error during migration:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Run the migration
fixIndex()
  .then(() => {
    console.log('\n✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });
