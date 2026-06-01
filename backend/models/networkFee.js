const mongoose = require('mongoose');

const networkFeeSchema = new mongoose.Schema({
  coin: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  network: {
    type: String,
    required: true,
    enum: ['BEP20', 'TRC20'],
    index: true
  },
  
  // Fee Configuration
  withdrawalFee: {
    type: Number,
    required: true,
    min: 0,
    default: 1 // Default 1 USDT
  },
  minWithdrawal: {
    type: Number,
    required: true,
    min: 0,
    default: 5 // Default 5 USDT minimum
  },
  maxWithdrawal: {
    type: Number,
    required: true,
    min: 0,
    default: 10000 // Default 10,000 USDT maximum
  },
  
  // Deposit Configuration
  minDeposit: {
    type: Number,
    required: true,
    min: 0,
    default: 25 // Default 25 USDT minimum
  },
  requiredConfirmations: {
    type: Number,
    required: true,
    min: 1,
    default: 12 // Default 12 confirmations
  },
  
  // Network Status
  isActive: {
    type: Boolean,
    default: true
  },
  isDepositEnabled: {
    type: Boolean,
    default: true
  },
  isWithdrawalEnabled: {
    type: Boolean,
    default: true
  },
  
  // Network Information
  networkDisplayName: {
    type: String,
    required: true
  },
  networkDescription: {
    type: String
  },
  blockExplorerUrl: {
    type: String
  },
  
  // Admin Information
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  notes: {
    type: String
  }

}, {
  timestamps: true,
  indexes: [
    { coin: 1, network: 1 }, // Compound index for efficient lookups
  ]
});

// Ensure unique combination of coin and network
networkFeeSchema.index({ coin: 1, network: 1 }, { unique: true });

// Virtual for full network name
networkFeeSchema.virtual('fullNetworkName').get(function() {
  return `${this.coin} (${this.networkDisplayName})`;
});

// Static method to get fees for a specific coin and network
networkFeeSchema.statics.getFees = async function(coin, network) {
  return await this.findOne({ 
    coin: coin.toUpperCase(), 
    network: network.toUpperCase(),
    isActive: true 
  });
};

// Static method to get all active networks for a coin
networkFeeSchema.statics.getActiveNetworks = async function(coin) {
  return await this.find({ 
    coin: coin.toUpperCase(),
    isActive: true 
  }).sort({ network: 1 });
};

// Instance method to check if withdrawals are available
networkFeeSchema.methods.canWithdraw = function(amount) {
  if (!this.isActive || !this.isWithdrawalEnabled) {
    return { 
      allowed: false, 
      reason: 'Withdrawals are temporarily disabled for this network' 
    };
  }
  
  if (amount < this.minWithdrawal) {
    return { 
      allowed: false, 
      reason: `Minimum withdrawal amount is ${this.minWithdrawal} ${this.coin}` 
    };
  }
  
  if (amount > this.maxWithdrawal) {
    return { 
      allowed: false, 
      reason: `Maximum withdrawal amount is ${this.maxWithdrawal} ${this.coin}` 
    };
  }
  
  return { allowed: true };
};

// Instance method to check if deposits are available
networkFeeSchema.methods.canDeposit = function(amount) {
  if (!this.isActive || !this.isDepositEnabled) {
    return { 
      allowed: false, 
      reason: 'Deposits are temporarily disabled for this network' 
    };
  }
  
  if (amount && amount < this.minDeposit) {
    return { 
      allowed: false, 
      reason: `Minimum deposit amount is ${this.minDeposit} ${this.coin}` 
    };
  }
  
  return { allowed: true };
};

// Pre-save middleware to set default network display names
networkFeeSchema.pre('save', function(next) {
  if (!this.networkDisplayName) {
    switch (this.network) {
      case 'BEP20':
        this.networkDisplayName = 'BEP-20 (Binance Smart Chain)';
        break;
      case 'TRC20':
        this.networkDisplayName = 'TRC-20 (Tron Network)';
        break;
      default:
        this.networkDisplayName = this.network;
    }
  }
  
  // Set default confirmations based on network
  if (!this.requiredConfirmations || this.requiredConfirmations === 0) {
    switch (this.network) {
      case 'BEP20':
        this.requiredConfirmations = 12;
        break;
      case 'TRC20':
        this.requiredConfirmations = 19;
        break;
      default:
        this.requiredConfirmations = 12;
    }
  }
  
  next();
});

module.exports = mongoose.model('NetworkFee', networkFeeSchema);
