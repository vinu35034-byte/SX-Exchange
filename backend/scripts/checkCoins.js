const mongoose = require('mongoose');
const connectDB = require('../config/db-optimized');

async function checkCoins() {
  try {
    await connectDB();
    
    const Coin = require('../models/coin');
    
    console.log('=== ALL COINS ===');
    const allCoins = await Coin.find({});
    console.log('Total coins:', allCoins.length);
    allCoins.forEach(coin => {
      console.log(`${coin.symbol}: status=${coin.status}, tradingEnabled=${coin.isTradingEnabled}, showInMarket=${coin.showInMarket || false}, pairs=${coin.tradingPairs?.length || 0}`);
    });
    
    console.log('\n=== ACTIVE TRADING PAIRS ===');
    const activeCoins = await Coin.find({
      status: 'active',
      isTradingEnabled: true
    });
    
    activeCoins.forEach(coin => {
      coin.tradingPairs?.forEach(pair => {
        if (pair.isActive) {
          console.log(`${coin.symbol}/${pair.quoteAsset}`);
        }
      });
    });
    
    console.log('\n=== MARKET READY COINS ===');
    const marketCoins = await Coin.find({
      showInMarket: true,
      status: 'active',
      isTradingEnabled: true
    });
    console.log('Market ready coins:', marketCoins.length);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkCoins();
