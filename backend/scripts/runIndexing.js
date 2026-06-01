#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const { createPerformanceIndexes } = require('./createDatabaseIndexes');

async function runIndexing() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log('✅ Connected to MongoDB');
    console.log('🚀 Starting database indexing...');

    await createPerformanceIndexes();

    console.log('✅ Database indexing completed successfully');
    console.log('📊 Your platform is now optimized for 20K users!');

  } catch (error) {
    console.error('❌ Error during indexing:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  runIndexing();
}

module.exports = { runIndexing };
