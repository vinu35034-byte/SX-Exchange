const mongoose = require('mongoose');

const referralSettingsSchema = new mongoose.Schema({
  appName: {
    type: String,
    default: 'CryptoTrader',
    trim: true
  },
  defaultReferrerReward: {
    type: Number,
    default: 5,
    min: 0
  },
  defaultRefereeReward: {
    type: Number,
    default: 2,
    min: 0
  },
  currency: {
    type: String,
    default: 'USDT'
  },
  minimumDepositAmount: {
    type: Number,
    default: 25,
    min: 0
  },
  depositCurrency: {
    type: String,
    default: 'USD'
  },
  requireKyc: {
    type: Boolean,
    default: true
  },
  referralCodeLength: {
    type: Number,
    default: 8,
    min: 4,
    max: 16
  },
  referralCodeFormat: {
    type: String,
    enum: ['alphanumeric', 'alphabetic', 'numeric'],
    default: 'alphanumeric'
  },
  linkExpirationDays: {
    type: Number,
    default: 0, // 0 means no expiration
    min: 0
  },
  maxReferralsPerUser: {
    type: Number,
    default: 0, // 0 means unlimited
    min: 0
  },
  levelSystemEnabled: {
    type: Boolean,
    default: true
  },
  autoUpgradeEnabled: {
    type: Boolean,
    default: true
  },
  notificationsEnabled: {
    type: Boolean,
    default: true
  },
  trackingEnabled: {
    type: Boolean,
    default: true
  },
  fraudDetection: {
    enabled: {
      type: Boolean,
      default: true
    },
    maxSignupsPerIP: {
      type: Number,
      default: 5,
      min: 1
    },
    suspiciousPatternDetection: {
      type: Boolean,
      default: true
    }
  },
  customMessages: {
    welcomeMessage: {
      type: String,
      default: 'Welcome! You\'ve been referred by a friend.'
    },
    successMessage: {
      type: String,
      default: 'Congratulations! Your referral was successful.'
    },
    rewardMessage: {
      type: String,
      default: 'You\'ve earned a referral reward!'
    }
  },
  socialSharing: {
    enabled: {
      type: Boolean,
      default: true
    },
    platforms: [{
      type: String,
      enum: ['facebook', 'twitter', 'telegram', 'whatsapp', 'email', 'custom']
    }],
    customShareText: {
      type: String,
      default: 'Join me on {appName} and get ${rewardAmount} USDT! Use my referral code: {referralCode}'
    }
  },
  analytics: {
    trackConversions: {
      type: Boolean,
      default: true
    },
    trackSources: {
      type: Boolean,
      default: true
    },
    retentionTracking: {
      type: Boolean,
      default: true
    }
  },
  
  // Multi-level trading bonus settings (for special token selling)
  multiLevelTradingBonus: {
    enabled: { type: Boolean, default: true },
    maxLevels: { type: Number, default: 5, min: 1, max: 10 },
    
    // Percentage each level gets of the trading profit
    levelPercentages: [{
      level: { type: Number, required: true, min: 1 },
      percentage: { type: Number, required: true, min: 0, max: 100 },
      description: { type: String }
    }],
    
    // Default percentages if none configured (admin must set these)
    defaultLevelPercentages: {
      level1: { type: Number, default: 0 }, // 0% - admin must configure
      level2: { type: Number, default: 0 }, // 0% - admin must configure
      level3: { type: Number, default: 0 }, // 0% - admin must configure
      level4: { type: Number, default: 0 }  // 0% - admin must configure
    },
    
    // Only apply to special tokens with positive selling adjustments
    onlyPositiveAdjustments: { type: Boolean, default: true },
    
    // Maximum total percentage that can be distributed
    maxTotalPercentage: { type: Number, default: 50, min: 0, max: 100 }
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Static methods
referralSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    // Create default settings if none exist
    settings = new this({});
    await settings.save();
  }
  return settings;
};

referralSettingsSchema.statics.updateSettings = async function(updates) {
  let settings = await this.findOne();
  if (!settings) {
    settings = new this(updates);
  } else {
    Object.assign(settings, updates);
    settings.updatedAt = new Date();
  }
  await settings.save();
  return settings;
};

referralSettingsSchema.statics.getTradingBonusPercentage = async function(level) {
  const settings = await this.getSettings();
  
  if (!settings.multiLevelTradingBonus.enabled) {
    return 0;
  }
  
  // Check custom level percentages first (admin configured)
  const customLevel = settings.multiLevelTradingBonus.levelPercentages.find(l => l.level === level);
  if (customLevel) {
    return customLevel.percentage;
  }
  
  // Check admin-configured default percentages
  const defaults = settings.multiLevelTradingBonus.defaultLevelPercentages;
  const levelKey = `level${level}`;
  if (defaults && defaults[levelKey] !== undefined) {
    return defaults[levelKey];
  }
  
  // No admin configuration found - return 0 (no bonus)
  return 0;
};

referralSettingsSchema.statics.getAllTradingBonusLevels = async function() {
  const settings = await this.getSettings();
  
  if (!settings.multiLevelTradingBonus.enabled) {
    return [];
  }
  
  const levels = [];
  
  // First, check custom level percentages (admin configured specific levels)
  if (settings.multiLevelTradingBonus.levelPercentages && settings.multiLevelTradingBonus.levelPercentages.length > 0) {
    for (const levelConfig of settings.multiLevelTradingBonus.levelPercentages) {
      if (levelConfig.percentage > 0) {
        levels.push({
          level: levelConfig.level,
          percentage: levelConfig.percentage,
          description: levelConfig.description || `Level ${levelConfig.level} gets ${levelConfig.percentage}% of trading profit`
        });
      }
    }
  }
  
  // Then, check default level percentages that admin has configured
  const defaults = settings.multiLevelTradingBonus.defaultLevelPercentages;
  if (defaults) {
    for (let i = 1; i <= 100; i++) { // Check up to 100 levels max
      const levelKey = `level${i}`;
      if (defaults[levelKey] && defaults[levelKey] > 0) {
        // Only add if not already added from custom levels
        if (!levels.find(l => l.level === i)) {
          levels.push({
            level: i,
            percentage: defaults[levelKey],
            description: `Level ${i} gets ${defaults[levelKey]}% of trading profit`
          });
        }
      }
    }
  }
  
  // Sort by level ascending
  levels.sort((a, b) => a.level - b.level);
  
  return levels;
};

referralSettingsSchema.statics.getMaxConfiguredLevel = async function() {
  const settings = await this.getSettings();
  
  if (!settings.multiLevelTradingBonus.enabled) {
    return 0;
  }
  
  let maxLevel = 0;
  
  // Check custom level percentages first (these are admin-configured)
  if (settings.multiLevelTradingBonus.levelPercentages && settings.multiLevelTradingBonus.levelPercentages.length > 0) {
    for (const levelConfig of settings.multiLevelTradingBonus.levelPercentages) {
      if (levelConfig.percentage > 0 && levelConfig.level > maxLevel) {
        maxLevel = levelConfig.level;
      }
    }
  }
  
  // Only check default level percentages that admin has explicitly configured
  // Don't use the schema defaults - only use what admin has saved
  const defaults = settings.multiLevelTradingBonus.defaultLevelPercentages;
  if (defaults) {
    // Only check the levels that have been explicitly set by admin (not schema defaults)
    // We need to differentiate between schema defaults and admin-configured values
    const explicitlyConfiguredLevels = [];
    
    // For existing installations, we'll only consider levels with percentage > 0
    // For new installations, admin must configure everything
    for (let i = 1; i <= 10; i++) { // Check reasonable range
      const levelKey = `level${i}`;
      if (defaults[levelKey] && defaults[levelKey] > 0) {
        explicitlyConfiguredLevels.push(i);
        if (i > maxLevel) {
          maxLevel = i;
        }
      }
    }
  }
  
  return maxLevel;
};

// Instance methods
referralSettingsSchema.methods.getRewardForLevel = function(level) {
  if (!level) {
    return {
      referrerReward: this.defaultReferrerReward,
      refereeReward: this.defaultRefereeReward,
      currency: this.currency
    };
  }
  
  return {
    referrerReward: level.referrerReward * (level.bonusMultiplier || 1),
    refereeReward: level.refereeReward * (level.bonusMultiplier || 1),
    currency: level.currency || this.currency
  };
};

referralSettingsSchema.methods.generateShareText = function(referralCode, userLevel = null) {
  const rewardAmount = userLevel ? 
    userLevel.referrerReward * (userLevel.bonusMultiplier || 1) : 
    this.defaultReferrerReward;
    
  return this.socialSharing.customShareText
    .replace('{appName}', this.appName)
    .replace('{rewardAmount}', rewardAmount)
    .replace('{referralCode}', referralCode);
};

referralSettingsSchema.methods.updateTradingBonusLevels = function(levelPercentages) {
  // Validate total percentage doesn't exceed maximum
  const totalPercentage = levelPercentages.reduce((sum, level) => sum + level.percentage, 0);
  
  if (totalPercentage > this.multiLevelTradingBonus.maxTotalPercentage) {
    throw new Error(`Total trading bonus percentages cannot exceed ${this.multiLevelTradingBonus.maxTotalPercentage}%`);
  }
  
  this.multiLevelTradingBonus.levelPercentages = levelPercentages;
  this.updatedAt = new Date();
  return this.save();
};

referralSettingsSchema.methods.toggleTradingBonus = function(enabled) {
  this.multiLevelTradingBonus.enabled = enabled;
  this.updatedAt = new Date();
  return this.save();
};

referralSettingsSchema.methods.getTradingBonusForLevel = function(level) {
  if (!this.multiLevelTradingBonus.enabled) {
    return 0;
  }
  
  // Check custom level percentages first
  const customLevel = this.multiLevelTradingBonus.levelPercentages.find(l => l.level === level);
  if (customLevel) {
    return customLevel.percentage;
  }
  
  // Fall back to default percentages
  const defaults = this.multiLevelTradingBonus.defaultLevelPercentages;
  switch (level) {
    case 1: return defaults.level1;
    case 2: return defaults.level2;
    case 3: return defaults.level3;
    case 4: return defaults.level4;
    case 5: return defaults.level5;
    default: return 0;
  }
};

module.exports = mongoose.model('ReferralSettings', referralSettingsSchema);
