const mongoose = require('mongoose');


const walletSchema = new mongoose.Schema({
  currency: { type: String, required: true, uppercase: true },
  available: { type: Number, default: 0 },
  locked: { type: Number, default: 0 },
}, { _id: false });

const deviceSchema = new mongoose.Schema({
  deviceId: String,
  userAgent: String,
  ip: String,
  lastSeen: Date,
}, { _id: false });

const userSchema = new mongoose.Schema({

  email: { type: String, required: true, unique: true, lowercase: true },
  username: { type: String, unique: true, sparse: true },
  passwordHash: { type: String, required: true },

  // KYC Status (detailed data is in KYC model)
  kycStatus: { type: String, enum: ['not_started', 'pending', 'approved', 'rejected'], default: 'not_started' },
  kycVerifiedAt: Date,
  kycRejectionReason: String,

  balances: {
    type: Map,
    of: Number,
    default: {}
  },
  
  // Track average purchase price for each token (for sell price calculations)
  purchasePrices: {
    type: Map,
    of: Number,
    default: {}
  },
  
  // Track individual purchase lots for overselling prevention
  purchaseHistory: [{
    token: String,
    amount: Number,
    price: Number,
    usdtValue: Number,
    purchasedAt: { type: Date, default: Date.now },
    remainingAmount: { type: Number } // Tracks how much of this lot hasn't been sold yet
  }],
  tradeVolume: { type: Number, default: 0 },
  totalDeposits: { type: Number, default: 0 },
  totalWithdrawals: { type: Number, default: 0 },
  totalTrades: { type: Number, default: 0 },
  lastTradeAt: Date,

  // 🏦 Deposit Addresses
  depositAddresses: {
    BEP20: { type: String, sparse: true },
    TRC20: { type: String, sparse: true }
  },
  addressGenerated: { type: Boolean, default: false },


  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  // 🎯 Referral Statistics
  referralStats: {
    totalReferrals: { type: Number, default: 0 },
    successfulReferrals: { type: Number, default: 0 },
    pendingReferrals: { type: Number, default: 0 },
    totalReferralRewards: { type: Number, default: 0 },
    totalReferralDeposits: { type: Number, default: 0 },
    lastReferralAt: Date,
    
    // Multi-level referral statistics for VIP system
    multiLevelStats: {
      level1Referrals: { type: Number, default: 0 }, // Direct referrals
      level2Referrals: { type: Number, default: 0 }, // Referrals of level 1
      level3Referrals: { type: Number, default: 0 }, // Referrals of level 2
      totalMultiLevelReferrals: { type: Number, default: 0 }, // Sum of all levels
      lastMultiLevelUpdate: Date, // For caching purposes
      multiLevelCacheValid: { type: Boolean, default: false }
    },
    
    // Multi-level trading bonus statistics
    tradingBonusStats: {
      totalTradingBonuses: { type: Number, default: 0 },
      level1Bonuses: { type: Number, default: 0 },
      level2Bonuses: { type: Number, default: 0 },
      level3Bonuses: { type: Number, default: 0 },
      level4Bonuses: { type: Number, default: 0 },
      level5Bonuses: { type: Number, default: 0 },
      lastTradingBonusAt: Date,
      totalBonusCount: { type: Number, default: 0 }
    }
  },

  // 🏆 VIP System
  vipLevel: { type: Number, default: 0 },
  vipUpgradedAt: Date,
  vipStats: {
    totalDailyRewardsClaimed: { type: Number, default: 0 },
    totalUpgradeRewards: { type: Number, default: 0 },
    lastDailyRewardClaim: Date,
    consecutiveDaysClaimed: { type: Number, default: 0 }
  },


  // 🔐 Security & Sessions
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: String,
  withdrawalPasswordHash: { type: String }, // Withdrawal password (separate from login password)
  isEmailVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  lastPasswordChangeAt: Date,
  lastLogin: Date,
  linkedDevices: { type: [deviceSchema], default: [] },
  ipHistory: [{
    ip: String,
    timestamp: { type: Date, default: Date.now },
  }],

  // 🔐 OTP for Login Verification
  otp: {
    code: { type: String },
    expiresAt: { type: Date },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    isUsed: { type: Boolean, default: false },
    generatedAt: { type: Date },
    purpose: { 
      type: String, 
      enum: ['login', 'signup', 'password_reset', 'withdrawal_password_create', 'withdrawal_password_reset', 'email_verification'], 
      default: 'login' 
    }
  },

  favorites: { type: [String], default: [] },

  language: { type: String, default: 'en' },
  timezone: { type: String, default: 'UTC' },
  theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'dark' },
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true },
      trading: { type: Boolean, default: true },
      news: { type: Boolean, default: false }
    }
  },
  privacy: {
    profileVisibility: { type: String, enum: ['private', 'public', 'friends'], default: 'private' },
    activityTracking: { type: Boolean, default: false }
  },

  banReason: String,
  bannedAt: Date,
  flags: [String],
  riskScore: { type: Number, default: 0 },
  mlFlags: [String],
  tags: [String], 

  // OTP Authentication fields
  loginOTP: String,
  loginOTPExpiry: Date,
  loginOTPAttempts: { type: Number, default: 0 },
  lastOTPSentAt: Date,

}, { 
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      // Convert balances Map to plain object for JSON serialization
      if (ret.balances instanceof Map) {
        const roundedBalances = {};
        for (const [currency, amount] of ret.balances) {
          // Round to 2 decimal places for clean display
          const rounded = Math.round((amount || 0) * 100) / 100;
          roundedBalances[currency] = Math.abs(rounded) < 0.01 ? 0 : rounded;
        }
        ret.balances = roundedBalances;
      } else if (ret.balances && typeof ret.balances === 'object') {
        // Handle case where balances is already an object
        const roundedBalances = {};
        for (const [currency, amount] of Object.entries(ret.balances)) {
          const rounded = Math.round((amount || 0) * 100) / 100;
          roundedBalances[currency] = Math.abs(rounded) < 0.01 ? 0 : rounded;
        }
        ret.balances = roundedBalances;
      }
      
      console.log('Backend - After toJSON, balances:', ret.balances);
      
      return ret;
    }
  }
});

// Pre-save hook to round balances and prevent precision accumulation
userSchema.pre('save', function() {
  if (this.balances && this.balances instanceof Map) {
    for (const [currency, amount] of this.balances) {
      if (typeof amount === 'number') {
        // Round to 2 decimal places and set tiny amounts to zero
        const rounded = Math.round(amount * 100) / 100;
        this.balances.set(currency, Math.abs(rounded) < 0.01 ? 0 : rounded);
      }
    }
  }
});

// OTP utility methods
userSchema.methods.generateOTP = function(purpose = 'login') {
  const crypto = require('crypto');
  
  // Generate 6-digit OTP
  const otpCode = crypto.randomInt(100000, 999999).toString();
  
  // Set OTP data using the schema fields
  this.loginOTP = otpCode;
  this.loginOTPExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  this.loginOTPAttempts = 0;
  this.lastOTPSentAt = new Date();
  
  return otpCode;
};

userSchema.methods.verifyOTP = function(inputOtp) {
  // Check if OTP exists
  if (!this.loginOTP) {
    return { success: false, message: 'No OTP found. Please request a new one.' };
  }
  
  // Check if OTP is expired
  if (new Date() > this.loginOTPExpiry) {
    return { success: false, message: 'OTP has expired. Please request a new one.' };
  }
  
  // Check attempt limit
  if (this.loginOTPAttempts >= 3) {
    return { success: false, message: 'Too many failed attempts. Please request a new OTP.' };
  }
  
  // Verify OTP code
  if (this.loginOTP !== inputOtp.toString()) {
    this.loginOTPAttempts += 1;
    const remainingAttempts = 3 - this.loginOTPAttempts;
    return { 
      success: false, 
      message: `Invalid OTP. ${remainingAttempts} attempts remaining.`,
      remainingAttempts: remainingAttempts
    };
  }
  
  // OTP is valid - clear OTP data
  this.clearOTP();
  return { success: true, message: 'OTP verified successfully.' };
};

userSchema.methods.clearOTP = function() {
  this.loginOTP = undefined;
  this.loginOTPExpiry = undefined;
  this.loginOTPAttempts = 0;
  this.lastOTPSentAt = undefined;
};

userSchema.methods.isOTPValid = function() {
  return this.loginOTP && 
         this.loginOTPExpiry && 
         new Date() <= this.loginOTPExpiry &&
         this.loginOTPAttempts < 3;
};

userSchema.methods.getOTPTimeRemaining = function() {
  if (!this.loginOTPExpiry) return 0;
  
  const timeRemaining = this.loginOTPExpiry.getTime() - Date.now();
  return Math.max(0, Math.floor(timeRemaining / 1000)); // Return seconds
};

// Add virtual for display name
userSchema.virtual('displayName').get(function() {
  return this.username || this.email;
});

// Add virtual for full name  
userSchema.virtual('fullName').get(function() {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.firstName || this.username || this.email;
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash password if it's been modified
  if (!this.isModified('passwordHash')) return next();
  
  try {
    const bcrypt = require('bcryptjs');
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  const bcrypt = require('bcryptjs');
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);
