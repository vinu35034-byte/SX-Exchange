const mongoose = require('mongoose');

// Model to track referral chains/trees for multi-level bonuses
const referralChainSchema = new mongoose.Schema({
  // Root user (the one who made the original sale/trade)
  rootUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Complete referral chain from root up to top
  chain: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    level: {
      type: Number,
      required: true,
      min: 1
    },
    username: String, // Cached for quick access
    referralCode: String // Cached for quick access
  }],
  
  // Maximum depth of this chain
  maxDepth: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Status of the chain
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Cache for quick lookups
  chainUserIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
  
}, {
  timestamps: true,
  indexes: [
    { rootUser: 1 },
    { 'chain.user': 1 },
    { chainUserIds: 1 },
    { maxDepth: 1 },
    { isActive: 1 }
  ]
});

// Static methods
referralChainSchema.statics.buildChainForUser = async function(userId) {
  const User = mongoose.model('User');
  
  const chain = [];
  let currentUser = await User.findById(userId).select('referredBy username referralCode');
  let level = 1;
  
  // Build chain going up the referral tree
  while (currentUser && currentUser.referredBy && level <= 10) { // Max 10 levels
    const referrer = await User.findById(currentUser.referredBy)
      .select('username referralCode referredBy');
      
    if (!referrer) break;
    
    chain.push({
      user: referrer._id,
      level: level,
      username: referrer.username,
      referralCode: referrer.referralCode
    });
    
    currentUser = referrer;
    level++;
  }
  
  if (chain.length === 0) {
    return null; // User has no referral chain
  }
  
  // Check if chain already exists
  let existingChain = await this.findOne({ rootUser: userId });
  
  if (existingChain) {
    // Update existing chain
    existingChain.chain = chain;
    existingChain.maxDepth = chain.length;
    existingChain.chainUserIds = chain.map(c => c.user);
    existingChain.updatedAt = new Date();
    await existingChain.save();
    return existingChain;
  } else {
    // Create new chain
    const newChain = new this({
      rootUser: userId,
      chain: chain,
      maxDepth: chain.length,
      chainUserIds: chain.map(c => c.user)
    });
    await newChain.save();
    return newChain;
  }
};

referralChainSchema.statics.getChainForUser = async function(userId) {
  let chain = await this.findOne({ rootUser: userId });
  
  if (!chain) {
    // Build chain if it doesn't exist
    chain = await this.buildChainForUser(userId);
  }
  
  return chain;
};

referralChainSchema.statics.getUsersInChain = async function(rootUserId, maxLevel = 5) {
  const chain = await this.getChainForUser(rootUserId);
  
  if (!chain) return [];
  
  return chain.chain
    .filter(c => c.level <= maxLevel)
    .map(c => ({
      userId: c.user,
      level: c.level,
      username: c.username,
      referralCode: c.referralCode
    }));
};

referralChainSchema.statics.rebuildAllChains = async function() {
  const User = mongoose.model('User');
  
  // Get all users who have been referred
  const referredUsers = await User.find({ 
    referredBy: { $exists: true } 
  }).select('_id');
  
  const results = {
    processed: 0,
    errors: 0,
    skipped: 0
  };
  
  for (const user of referredUsers) {
    try {
      await this.buildChainForUser(user._id);
      results.processed++;
    } catch (error) {
      console.error(`Error building chain for user ${user._id}:`, error);
      results.errors++;
    }
  }
  
  return results;
};

// Instance methods
referralChainSchema.methods.getUserAtLevel = function(level) {
  return this.chain.find(c => c.level === level);
};

referralChainSchema.methods.getAllUsersUpToLevel = function(maxLevel) {
  return this.chain.filter(c => c.level <= maxLevel);
};

referralChainSchema.methods.getChainSummary = function() {
  return {
    rootUser: this.rootUser,
    totalLevels: this.maxDepth,
    usersInChain: this.chain.length,
    chain: this.chain.map(c => ({
      level: c.level,
      username: c.username,
      referralCode: c.referralCode
    }))
  };
};

referralChainSchema.methods.updateChain = async function() {
  const updatedChain = await this.constructor.buildChainForUser(this.rootUser);
  return updatedChain;
};

// Middleware
referralChainSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to calculate trading bonuses for the chain
referralChainSchema.methods.calculateTradingBonuses = async function(profitAmount, adminMaxLevels = null) {
  const ReferralSettings = mongoose.model('ReferralSettings');
  const settings = await ReferralSettings.getSettings();
  
  if (!settings.multiLevelTradingBonus.enabled) {
    return [];
  }
  
  // Use admin-configured max level, not hardcoded limits
  const maxConfiguredLevel = await ReferralSettings.getMaxConfiguredLevel();
  const effectiveMaxLevels = adminMaxLevels ? Math.min(adminMaxLevels, maxConfiguredLevel) : maxConfiguredLevel;
  
  if (effectiveMaxLevels === 0) {
    return []; // No levels configured by admin
  }
  
  const bonuses = [];
  const usersToReward = this.getAllUsersUpToLevel(effectiveMaxLevels);
  
  for (const chainUser of usersToReward) {
    // Get percentage from admin settings only - no fallback to hardcoded defaults
    const percentage = await ReferralSettings.getTradingBonusPercentage(chainUser.level);
    
    if (percentage > 0) {
      const bonusAmount = (profitAmount * percentage) / 100;
      
      bonuses.push({
        userId: chainUser.user,
        level: chainUser.level,
        percentage: percentage,
        bonusAmount: bonusAmount,
        username: chainUser.username
      });
    }
  }
  
  return bonuses;
};

module.exports = mongoose.model('ReferralChain', referralChainSchema);
