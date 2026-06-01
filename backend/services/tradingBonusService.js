const User = require('../models/user');
const ReferralChain = require('../models/referralChain');
const Transaction = require('../models/transaction'); // Use main Transaction model
const ReferralSettings = require('../models/referralSettings');
const SpecialToken = require('../models/specialToken');
const { createLogger } = require('../utils/logger');

const logger = createLogger('trading-bonus-service');

class TradingBonusService {
  
  /**
   * Process trading bonuses when a special token is sold with positive adjustment
   * @param {String} userId - ID of user who sold the token
   * @param {Object} saleData - Sale transaction data
   */
  static async processTradingBonuses(userId, saleData) {
    try {
      logger.info('Processing trading bonuses', {
        userId,
        saleData,
        timestamp: new Date().toISOString()
      });

      // Validate sale data
      if (!saleData.isSpecialToken || !saleData.priceAdjustment || saleData.priceAdjustment <= 0) {
        logger.info('Sale does not qualify for trading bonuses', {
          userId,
          isSpecialToken: saleData.isSpecialToken,
          priceAdjustment: saleData.priceAdjustment
        });
        return { bonusesDistributed: 0, totalAmount: 0 };
      }

      // Get referral settings
      const settings = await ReferralSettings.getSettings();
      if (!settings.multiLevelTradingBonus.enabled) {
        logger.info('Multi-level trading bonuses are disabled');
        return { bonusesDistributed: 0, totalAmount: 0 };
      }

      // Calculate profit from price adjustment
      const baseValue = saleData.quantity * saleData.basePrice;
      const saleValue = saleData.quantity * saleData.adjustedPrice;
      const profit = saleValue - baseValue;

      if (profit <= 0) {
        logger.info('No profit to distribute bonuses from', { userId, profit });
        return { bonusesDistributed: 0, totalAmount: 0 };
      }

      // Get or build referral chain
      let referralChain = await ReferralChain.getChainForUser(userId);
      if (!referralChain || referralChain.chain.length === 0) {
        logger.info('No referral chain found for user', { userId });
        return { bonusesDistributed: 0, totalAmount: 0 };
      }

      // Calculate bonuses for each level based on admin configuration
      const bonuses = await referralChain.calculateTradingBonuses(profit);

      if (bonuses.length === 0) {
        logger.info('No bonuses calculated - check admin trading bonus configuration', { 
          userId, 
          profit,
          maxConfiguredLevel: await ReferralSettings.getMaxConfiguredLevel(),
          chainLength: referralChain.chain.length 
        });
        return { bonusesDistributed: 0, totalAmount: 0 };
      }

      // Distribute bonuses
      const results = {
        bonusesDistributed: 0,
        totalAmount: 0,
        details: []
      };

      for (const bonus of bonuses) {
        try {
          await this.distributeTradingBonus(
            bonus.userId,
            bonus.bonusAmount,
            bonus.level,
            userId,
            profit,
            bonus.percentage,
            saleData
          );

          results.bonusesDistributed++;
          results.totalAmount += bonus.bonusAmount;
          results.details.push({
            userId: bonus.userId,
            username: bonus.username,
            level: bonus.level,
            amount: bonus.bonusAmount,
            percentage: bonus.percentage
          });

          logger.info('Trading bonus distributed', {
            recipient: bonus.userId,
            level: bonus.level,
            amount: bonus.bonusAmount,
            triggeredBy: userId
          });

        } catch (error) {
          logger.error('Error distributing trading bonus', {
            error: error.message,
            recipient: bonus.userId,
            level: bonus.level,
            amount: bonus.bonusAmount
          });
        }
      }

      logger.info('Trading bonuses processing completed', {
        userId,
        totalBonuses: results.bonusesDistributed,
        totalAmount: results.totalAmount
      });

      return results;

    } catch (error) {
      logger.error('Error processing trading bonuses', {
        error: error.message,
        userId,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Distribute trading bonus to a specific user
   */
  static async distributeTradingBonus(
    recipientId, 
    bonusAmount, 
    level, 
    triggeredBy, 
    originalProfit, 
    percentage, 
    saleData
  ) {
    try {
      // Get recipient user
      const recipient = await User.findById(recipientId);
      if (!recipient) {
        throw new Error('Recipient user not found');
      }

      // Add bonus to user's USDT balance
      const currency = 'USDT';
      const balanceBefore = recipient.balances.get(currency) || 0;
      const newBalance = balanceBefore + bonusAmount;
      
      // Update the balance in the Map
      recipient.balances.set(currency, newBalance);
      
      const balanceAfter = newBalance;

      // Update user trading bonus stats
      recipient.referralStats.tradingBonusStats.totalTradingBonuses += bonusAmount;
      recipient.referralStats.tradingBonusStats.totalBonusCount += 1;
      recipient.referralStats.tradingBonusStats.lastTradingBonusAt = new Date();

      // Update level-specific stats
      const levelField = `level${level}Bonuses`;
      if (recipient.referralStats.tradingBonusStats[levelField] !== undefined) {
        recipient.referralStats.tradingBonusStats[levelField] += bonusAmount;
      }

      await recipient.save();

      // Generate unique transaction ID
      const date = new Date();
      const dateStr = date.getFullYear().toString() + 
                     (date.getMonth() + 1).toString().padStart(2, '0') + 
                     date.getDate().toString().padStart(2, '0');
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      const transactionId = `TXN-${dateStr}-${randomNum}`;

      // Create transaction record
      const transaction = new Transaction({
        user: recipientId,
        transactionId: transactionId, // Set manually to avoid pre-save hook issues
        type: 'trading_bonus',
        subType: `level_${level}_trading_bonus`,
        currency: currency,
        amount: bonusAmount,
        direction: 'credit',
        balanceBefore: balanceBefore,
        balanceAfter: balanceAfter,
        usdValue: bonusAmount,
        status: 'completed',
        
        referralInfo: {
          referralLevel: level,
          triggeredBy: triggeredBy,
          bonusPercentage: percentage,
          originalProfit: originalProfit
        },
        
        tradingInfo: {
          tradeId: saleData.tradeId,
          pair: saleData.pair,
          side: 'sell',
          price: saleData.adjustedPrice,
          quantity: saleData.quantity,
          isSpecialToken: true,
          specialTokenId: saleData.specialTokenId,
          priceAdjustment: saleData.priceAdjustment,
          basePrice: saleData.basePrice,
          adjustedPrice: saleData.adjustedPrice,
          profit: originalProfit
        },
        
        description: `Level ${level} trading bonus from ${saleData.tokenSymbol} sale`,
        notes: `${percentage}% of ${originalProfit} USDT profit`,
        executedAt: new Date()
      });

      await transaction.save();

      // Send trading bonus notification to user
      try {
        const notificationService = require('../utils/notificationService');
        const triggeredByUser = await User.findById(triggeredBy).select('username');
        
        await notificationService.notifyUserTradingBonus(recipientId, {
          amount: bonusAmount.toFixed(2),
          level,
          percentage,
          triggeredBy: triggeredByUser ? triggeredByUser.username : 'Unknown',
          tokenSymbol: saleData.tokenSymbol,
          originalProfit: originalProfit.toFixed(2)
        });
        
        
      } catch (notificationError) {
        console.error('Error sending trading bonus notification:', notificationError);
        // Don't fail the bonus distribution if notification fails
      }

      return {
        success: true,
        transactionId: transaction._id,
        amount: bonusAmount,
        newBalance: balanceAfter
      };

    } catch (error) {
      logger.error('Error distributing individual trading bonus', {
        error: error.message,
        recipientId,
        bonusAmount,
        level
      });
      throw error;
    }
  }

  /**
   * Get trading bonus statistics for a user
   */
  static async getTradingBonusStats(userId) {
    try {
      const user = await User.findById(userId).select('referralStats');
      if (!user) {
        throw new Error('User not found');
      }

      const tradingBonusStats = user.referralStats.tradingBonusStats || {};

      // Get recent trading bonus transactions
      const recentBonuses = await Transaction.find({
        user: userId,
        type: 'trading_bonus',
        status: 'completed'
      })
      .populate('referralInfo.triggeredBy', 'username')
      .sort({ executedAt: -1 })
      .limit(10);

      return {
        stats: tradingBonusStats,
        recentBonuses: recentBonuses.map(bonus => ({
          amount: bonus.amount,
          currency: bonus.currency,
          level: bonus.referralInfo.referralLevel,
          percentage: bonus.referralInfo.bonusPercentage,
          originalProfit: bonus.referralInfo.originalProfit,
          triggeredBy: bonus.referralInfo.triggeredBy?.username,
          tokenSymbol: bonus.tradingInfo?.pair?.split('/')[0],
          date: bonus.executedAt
        }))
      };

    } catch (error) {
      logger.error('Error getting trading bonus stats', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Get users who would receive bonuses from a sale
   */
  static async previewTradingBonuses(userId, profit) {
    try {
      const settings = await ReferralSettings.getSettings();
      if (!settings.multiLevelTradingBonus.enabled) {
        return { enabled: false, bonuses: [] };
      }

      const referralChain = await ReferralChain.getChainForUser(userId);
      if (!referralChain) {
        return { enabled: true, bonuses: [] };
      }

      const bonuses = await referralChain.calculateTradingBonuses(profit);

      return {
        enabled: true,
        totalProfit: profit,
        maxConfiguredLevel: await ReferralSettings.getMaxConfiguredLevel(),
        bonuses: bonuses.map(bonus => ({
          username: bonus.username,
          level: bonus.level,
          percentage: bonus.percentage,
          estimatedAmount: bonus.bonusAmount
        }))
      };

    } catch (error) {
      logger.error('Error previewing trading bonuses', {
        error: error.message,
        userId,
        profit
      });
      throw error;
    }
  }

  /**
   * Rebuild all referral chains (admin function)
   */
  static async rebuildAllReferralChains() {
    try {
      logger.info('Starting referral chain rebuild');
      const results = await ReferralChain.rebuildAllChains();
      logger.info('Referral chain rebuild completed', results);
      return results;
    } catch (error) {
      logger.error('Error rebuilding referral chains', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get admin statistics for trading bonuses
   */
  static async getAdminStats() {
    try {
      const stats = await Transaction.aggregate([
        {
          $match: {
            type: 'trading_bonus',
            status: 'completed'
          }
        },
        {
          $group: {
            _id: '$subType',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
            avgAmount: { $avg: '$amount' }
          }
        }
      ]);

      const totalStats = await Transaction.aggregate([
        {
          $match: {
            type: 'trading_bonus',
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalBonuses: { $sum: '$amount' },
            totalTransactions: { $sum: 1 }
          }
        }
      ]);

      return {
        levelBreakdown: stats,
        totals: totalStats[0] || { totalBonuses: 0, totalTransactions: 0 }
      };

    } catch (error) {
      logger.error('Error getting admin trading bonus stats', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = TradingBonusService;
