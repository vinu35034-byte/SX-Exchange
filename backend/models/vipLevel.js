const mongoose = require('mongoose');

const vipLevelSchema = new mongoose.Schema({
  level: { 
    type: Number, 
    required: true, 
    unique: true,
    min: 0
  },
  name: { 
    type: String, 
    required: true 
  },
  minimumLevel1Referrals: { 
    type: Number, 
    required: true, 
    default: 0,
    min: 0
  },
  minimumTotalReferrals: { 
    type: Number, 
    required: true, 
    default: 0,
    min: 0
  },
  dailyReward: { 
    type: Number, 
    required: true, 
    default: 0 
  },
  oneTimeUpgradeReward: { 
    type: Number, 
    required: true, 
    default: 0 
  },
  currency: { 
    type: String, 
    default: 'USDT' 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  requirements: {
    description: String,
    additionalConditions: [String]
  },
  benefits: {
    description: String,
    features: [String]
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Admin' 
  },
  updatedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Admin' 
  }
}, { 
  timestamps: true 
});

// Indexes for performance (level already indexed due to unique: true)
vipLevelSchema.index({ isActive: 1 });

// Static methods
vipLevelSchema.statics.getActiveVIPLevels = function() {
  return this.find({ isActive: true }).sort({ level: 1 });
};

vipLevelSchema.statics.getVIPLevelByLevel = function(level) {
  return this.findOne({ level, isActive: true });
};

vipLevelSchema.statics.getNextVIPLevel = function(currentLevel) {
  return this.findOne({ 
    level: { $gt: currentLevel }, 
    isActive: true 
  }).sort({ level: 1 });
};

module.exports = mongoose.model('VIPLevel', vipLevelSchema);
