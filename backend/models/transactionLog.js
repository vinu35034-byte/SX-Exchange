const mongoose = require('mongoose');

const transactionLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Transaction Basic Info
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'internal_transfer', 'trade', 'fee', 'reward', 'refund'],
    required: true,
    index: true
  },
  subType: {
    type: String,
    enum: ['crypto_deposit', 'crypto_withdrawal', 'wallet_transfer', 'trading_fee', 'withdrawal_fee', 'referral_reward'],
    index: true
  },
  
  // Amount Information
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    uppercase: true,
    default: 'USDT'
  },
  usdValue: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Network Information (for crypto transactions)
  network: {
    type: String,
    enum: ['BEP20', 'TRC20', null],
    sparse: true
  },
  
  // Blockchain Information
  txHash: {
    type: String,
    sparse: true,
    index: true
  },
  fromAddress: {
    type: String,
    sparse: true
  },
  toAddress: {
    type: String,
    sparse: true
  },
  blockNumber: {
    type: Number,
    sparse: true
  },
  confirmations: {
    type: Number,
    default: 0
  },
  
  // Fee Information
  fee: {
    amount: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'USDT'
    },
    usdValue: {
      type: Number,
      default: 0
    }
  },
  
  // Status Tracking
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'expired'],
    default: 'pending',
    index: true
  },
  
  // Balance Information
  balanceBefore: {
    type: Number,
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  
  // Reference Information
  referenceId: {
    type: String,
    sparse: true,
    index: true // Could be deposit ID, withdrawal ID, etc.
  },
  referenceType: {
    type: String,
    enum: ['DepositTransaction', 'WithdrawalRequest', 'Trade', 'InternalTransfer']
  },
  referenceDocument: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'referenceType'
  },
  
  // Additional Details
  description: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed, // For storing additional data
    default: {}
  },
  
  // Admin Information
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  processedAt: {
    type: Date
  },
  
  // System Information
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  
  // Flags and Risk Assessment
  flags: [{
    type: String,
    enum: ['suspicious', 'large_amount', 'frequent_transaction', 'new_address', 'high_risk_country']
  }],
  riskScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  
  // Timing Information
  initiatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  failedAt: {
    type: Date
  }

}, {
  timestamps: true
});

// Indexes for efficient queries
transactionLogSchema.index({ userId: 1, type: 1, createdAt: -1 });
transactionLogSchema.index({ status: 1, createdAt: -1 });
transactionLogSchema.index({ txHash: 1 }, { sparse: true });
transactionLogSchema.index({ referenceId: 1 }, { sparse: true });
transactionLogSchema.index({ currency: 1, createdAt: -1 });
transactionLogSchema.index({ network: 1, type: 1 }, { sparse: true });

// Virtual for net amount (amount - fee)
transactionLogSchema.virtual('netAmount').get(function() {
  if (this.type === 'withdrawal') {
    return this.amount - (this.fee.amount || 0);
  }
  return this.amount;
});

// Virtual for transaction direction
transactionLogSchema.virtual('direction').get(function() {
  const incomingTypes = ['deposit', 'reward', 'refund'];
  const outgoingTypes = ['withdrawal', 'fee'];
  
  if (incomingTypes.includes(this.type)) {
    return 'incoming';
  } else if (outgoingTypes.includes(this.type)) {
    return 'outgoing';
  }
  return 'neutral';
});

// Static method to create deposit log
transactionLogSchema.statics.createDepositLog = async function(data) {
  return await this.create({
    userId: data.userId,
    type: 'deposit',
    subType: 'crypto_deposit',
    amount: data.amount,
    currency: data.currency || 'USDT',
    usdValue: data.usdValue,
    network: data.network,
    txHash: data.txHash,
    fromAddress: data.fromAddress,
    toAddress: data.toAddress,
    status: data.status || 'pending',
    balanceBefore: data.balanceBefore,
    balanceAfter: data.balanceAfter,
    referenceType: 'DepositTransaction',
    referenceDocument: data.depositTransactionId,
    confirmations: data.confirmations || 0,
    description: `Crypto deposit via ${data.network}`,
    metadata: data.metadata || {}
  });
};

// Static method to create withdrawal log
transactionLogSchema.statics.createWithdrawalLog = async function(data) {
  return await this.create({
    userId: data.userId,
    type: 'withdrawal',
    subType: 'crypto_withdrawal',
    amount: data.amount,
    currency: data.currency || 'USDT',
    usdValue: data.usdValue,
    network: data.network,
    toAddress: data.toAddress,
    status: data.status || 'pending',
    balanceBefore: data.balanceBefore,
    balanceAfter: data.balanceAfter,
    fee: {
      amount: data.fee || 0,
      currency: data.currency || 'USDT',
      usdValue: data.feeUsdValue || 0
    },
    referenceType: 'WithdrawalRequest',
    referenceDocument: data.withdrawalRequestId,
    description: `Crypto withdrawal via ${data.network}`,
    processedBy: data.processedBy,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    metadata: data.metadata || {}
  });
};

// Static method to get user transaction history
transactionLogSchema.statics.getUserHistory = async function(userId, options = {}) {
  const {
    type,
    status,
    currency,
    network,
    limit = 50,
    skip = 0,
    sortBy = 'createdAt',
    sortOrder = -1
  } = options;
  
  const query = { userId };
  
  if (type) query.type = type;
  if (status) query.status = status;
  if (currency) query.currency = currency;
  if (network) query.network = network;

  // Whitelist allowed sort fields
  const ALLOWED_SORT_FIELDS = ['createdAt', 'amount', 'type', 'status', 'currency'];
  const safeSortBy = ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'createdAt';
  
  return await this.find(query)
    .sort({ [safeSortBy]: sortOrder })
    .limit(limit)
    .skip(skip)
    .populate('referenceDocument')
    .lean();
};

// Instance method to mark as completed
transactionLogSchema.methods.markCompleted = async function(txHash, blockNumber) {
  this.status = 'completed';
  this.completedAt = new Date();
  if (txHash) this.txHash = txHash;
  if (blockNumber) this.blockNumber = blockNumber;
  return await this.save();
};

// Instance method to mark as failed
transactionLogSchema.methods.markFailed = async function(reason) {
  this.status = 'failed';
  this.failedAt = new Date();
  this.metadata.failureReason = reason;
  return await this.save();
};

// Instance method to update confirmations
transactionLogSchema.methods.updateConfirmations = async function(confirmations) {
  this.confirmations = confirmations;
  return await this.save();
};

module.exports = mongoose.model('TransactionLog', transactionLogSchema);
