const mongoose = require('mongoose');
const connectDB = require('../config/db-optimized');

async function updateCoinsForMarket() {
  try {
    await connectDB();
    
    const Coin = require('../models/coin');
    
    console.log('🔄 Updating coins to show in market...');
    
    // Update coins with trading pairs to show in market
    const result = await Coin.updateMany(
      {
        status: 'active',
        isTradingEnabled: true,
        'tradingPairs.isActive': true
      },
      {
        $set: {
          showInMarket: true,
          marketPriority: 10  // High priority for major coins
        }
      }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} coins to show in market`);
    
    // Set specific priorities for major coins
    await Coin.updateOne({ symbol: 'BTC' }, { $set: { marketPriority: 100 } });
    await Coin.updateOne({ symbol: 'ETH' }, { $set: { marketPriority: 90 } });
    await Coin.updateOne({ symbol: 'BNB' }, { $set: { marketPriority: 80 } });
    await Coin.updateOne({ symbol: 'SOL' }, { $set: { marketPriority: 70 } });
    await Coin.updateOne({ symbol: 'ADA' }, { $set: { marketPriority: 60 } });
    await Coin.updateOne({ symbol: 'DOT' }, { $set: { marketPriority: 50 } });
    await Coin.updateOne({ symbol: 'XRP' }, { $set: { marketPriority: 40 } });
    await Coin.updateOne({ symbol: 'DOGE' }, { $set: { marketPriority: 30 } });
    
    console.log('✅ Set market priorities for major coins');
    
    // Verify the changes
    const marketCoins = await Coin.find({
      showInMarket: true
    }).sort({ marketPriority: -1 });
    
    console.log('\n📊 Market coins (ordered by priority):');
    marketCoins.forEach(coin => {
      console.log(`${coin.symbol}: priority=${coin.marketPriority}, pairs=${coin.tradingPairs?.length || 0}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateCoinsForMarket();
