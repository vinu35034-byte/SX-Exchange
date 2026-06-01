const Transaction = require('../models/transaction');
const UserTransaction = require('../models/userTransaction');
const { v4: uuidv4 } = require('uuid');

/**
 * Create a user transaction record
 * @param {Object} transactionData - Transaction data
 * @param {Object} session - Mongoose session for transaction
 * @returns {Object} - Created transaction
 */
const createUserTransaction = async (transactionData, session = null) => {
  const {
    userId,
    type,
    amount,
    symbol,
    status = 'completed',
    metadata = {},
    description = null
  } = transactionData;

  // Generate unique transaction ID
  const transactionId = uuidv4();

  // Create transaction data
  const txData = {
    transactionId,
    userId,
    type,
    amount: parseFloat(amount),
    symbol: symbol.toUpperCase(),
    status,
    metadata,
    description: description || generateTransactionDescription(type, amount, symbol, metadata),
    timestamp: new Date()
  };

  // Save with or without session
  const transaction = new UserTransaction(txData);
  
  if (session) {
    await transaction.save({ session });
  } else {
    await transaction.save();
  }

  return transaction;
};

/**
 * Generate a human-readable transaction description
 * @param {string} type - Transaction type
 * @param {number} amount - Transaction amount
 * @param {string} symbol - Token symbol
 * @param {Object} metadata - Additional metadata
 * @returns {string} - Generated description
 */
const generateTransactionDescription = (type, amount, symbol, metadata = {}) => {
  const formattedAmount = parseFloat(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  });

  switch (type) {
    case 'stake':
      return `Staked ${formattedAmount} ${symbol} in ${metadata.poolName || 'staking pool'}`;
    
    case 'unstake':
      if (metadata.isEarlyUnstake) {
        return `Early unstaked ${formattedAmount} ${symbol} from ${metadata.poolName || 'staking pool'} (penalty applied)`;
      }
      return `Unstaked ${formattedAmount} ${symbol} from ${metadata.poolName || 'staking pool'}`;
    
    case 'admin_unstake':
      return `Admin force unstaked ${formattedAmount} ${symbol} from ${metadata.poolName || 'staking pool'}`;
    
    case 'staking_reward':
      return `Staking reward of ${formattedAmount} ${symbol} claimed`;
    
    case 'deposit':
      return `Deposited ${formattedAmount} ${symbol}`;
    
    case 'withdrawal':
      return `Withdrew ${formattedAmount} ${symbol}`;
    
    case 'trade_buy':
      return `Bought ${formattedAmount} ${symbol}`;
    
    case 'trade_sell':
      return `Sold ${formattedAmount} ${symbol}`;
    
    case 'referral_reward':
      return `Referral reward of ${formattedAmount} ${symbol}`;
    
    case 'vip_reward':
      return `VIP reward of ${formattedAmount} ${symbol}`;
    
    case 'bonus':
      return `Bonus of ${formattedAmount} ${symbol}`;
    
    case 'fee':
      return `Fee of ${formattedAmount} ${symbol}`;
    
    case 'adjustment':
      return `Balance adjustment of ${formattedAmount} ${symbol}`;
    
    default:
      return `${type} transaction of ${formattedAmount} ${symbol}`;
  }
};

/**
 * Get user transaction history with pagination
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Object} - Transaction history with pagination
 */
const getUserTransactionHistory = async (userId, options = {}) => {
  const {
    page = 1,
    limit = 20,
    type = null,
    symbol = null,
    startDate = null,
    endDate = null
  } = options;

  // Build filter
  const filter = { userId };
  
  if (type) filter.type = type;
  if (symbol) filter.symbol = symbol.toUpperCase();
  
  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) filter.timestamp.$gte = new Date(startDate);
    if (endDate) filter.timestamp.$lte = new Date(endDate);
  }

  // Execute query
  const transactions = await UserTransaction.find(filter)
    .sort({ timestamp: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  const total = await UserTransaction.countDocuments(filter);

  return {
    transactions,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalTransactions: total,
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1
    }
  };
};

/**
 * Get transaction statistics for a user
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Object} - Transaction statistics
 */
const getUserTransactionStats = async (userId, options = {}) => {
  const {
    period = '30d' // 1d, 7d, 30d, 90d, 1y, all
  } = options;

  // Calculate date range
  let startDate = null;
  const endDate = new Date();

  switch (period) {
    case '1d':
      startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      // All time
      break;
  }

  // Build filter
  const filter = { userId };
  if (startDate) {
    filter.timestamp = { $gte: startDate, $lte: endDate };
  }

  // Get statistics
  const stats = await UserTransaction.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        avgAmount: { $avg: '$amount' }
      }
    }
  ]);

  // Get overall stats
  const overallStats = await UserTransaction.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalTransactions: { $sum: 1 },
        totalVolume: { $sum: '$amount' },
        avgTransactionAmount: { $avg: '$amount' },
        firstTransaction: { $min: '$timestamp' },
        lastTransaction: { $max: '$timestamp' }
      }
    }
  ]);

  return {
    period,
    byType: stats,
    overall: overallStats[0] || {
      totalTransactions: 0,
      totalVolume: 0,
      avgTransactionAmount: 0,
      firstTransaction: null,
      lastTransaction: null
    }
  };
};

/**
 * Validate transaction data
 * @param {Object} transactionData - Transaction data to validate
 * @returns {Object} - Validation result
 */
const validateTransactionData = (transactionData) => {
  const {
    userId,
    type,
    amount,
    symbol
  } = transactionData;

  const errors = [];

  if (!userId) {
    errors.push('User ID is required');
  }

  if (!type) {
    errors.push('Transaction type is required');
  }

  if (amount === undefined || amount === null) {
    errors.push('Amount is required');
  }

  if (typeof amount !== 'number' || amount < 0) {
    errors.push('Amount must be a positive number');
  }

  if (!symbol || typeof symbol !== 'string') {
    errors.push('Symbol is required and must be a string');
  }

  const validTypes = [
    'stake', 'unstake', 'admin_unstake', 'staking_reward',
    'deposit', 'withdrawal', 'trade_buy', 'trade_sell',
    'referral_reward', 'vip_reward', 'bonus', 'fee', 'adjustment'
  ];

  if (type && !validTypes.includes(type)) {
    errors.push(`Invalid transaction type. Must be one of: ${validTypes.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  createUserTransaction,
  generateTransactionDescription,
  getUserTransactionHistory,
  getUserTransactionStats,
  validateTransactionData
};
