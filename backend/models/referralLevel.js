const mongoose = require('mongoose');

const referralLevelSchema = new mongoose.Schema({
  level: {
    type: Number,
    required: true,
    unique: true,
    min: 1
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  minimumReferrals: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  minimumReferralDeposits: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  referrerReward: {
    type: Number,
    required: true,
    min: 0,
    default: 5
  },
  refereeReward: {
    type: Number,
    required: true,
    min: 0,
    default: 2
  },
  currency: {
    type: String,
    required: true,
    default: 'USDT'
  },
  bonusMultiplier: {
    type: Number,
    min: 1,
    default: 1
  },
  requirements: {
    kycRequired: {
      type: Boolean,
      default: true
    },
    minimumDepositAmount: {
      type: Number,
      min: 0,
      default: 10
    },
    depositCurrency: {
      type: String,
      default: 'USD'
    }
  },
  benefits: [{
    type: {
      type: String,
      enum: ['bonus_multiplier', 'reduced_fees', 'priority_support', 'exclusive_rewards', 'custom'],
      required: true
    },
    description: {
      type: String,
      required: true
    },
    value: {
      type: mongoose.Schema.Types.Mixed
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
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

// Indexes
referralLevelSchema.index({ level: 1 });
referralLevelSchema.index({ isActive: 1, level: 1 });
referralLevelSchema.index({ minimumReferrals: 1 });

// Static methods
referralLevelSchema.statics.getActiveLevels = function() {
  return this.find({ isActive: true }).sort({ level: 1 });
};

referralLevelSchema.statics.getDefaultLevel = function() {
  return this.findOne({ isDefault: true, isActive: true });
};

referralLevelSchema.statics.findLevelForUser = function(successfulReferrals, totalReferralDeposits) {
  return this.findOne({
    isActive: true,
    minimumReferrals: { $lte: successfulReferrals },
    minimumReferralDeposits: { $lte: totalReferralDeposits }
  }).sort({ level: -1 }); // Get highest level that user qualifies for
};

// Instance methods
referralLevelSchema.methods.checkUserQualification = function(user) {
  const stats = user.referralStats || {};
  const successfulReferrals = stats.successfulReferrals || 0;
  const totalDeposits = stats.totalReferralDeposits || 0;
  
  return {
    qualifies: successfulReferrals >= this.minimumReferrals && 
               totalDeposits >= this.minimumReferralDeposits,
    requirements: {
      referrals: {
        current: successfulReferrals,
        required: this.minimumReferrals,
        met: successfulReferrals >= this.minimumReferrals
      },
      deposits: {
        current: totalDeposits,
        required: this.minimumReferralDeposits,
        met: totalDeposits >= this.minimumReferralDeposits
      }
    }
  };
};

// Middleware
referralLevelSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Ensure only one default level
referralLevelSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    // Remove default from other levels
    await this.constructor.updateMany(
      { _id: { $ne: this._id }, isDefault: true },
      { isDefault: false }
    );
  }
  next();
});

module.exports = mongoose.model('ReferralLevel', referralLevelSchema);
