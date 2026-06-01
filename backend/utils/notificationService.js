const Notification = require('../models/notification');
const User = require('../models/user');
const Admin = require('../models/admin');

class NotificationService {
  /**
   * Create a new notification
   */
  async createNotification({
    recipientType,
    recipientId,
    title,
    message,
    type,
    relatedData = {},
    priority = 'medium',
    expiresAt = null
  }) {
    try {
      const notification = new Notification({
        recipientType,
        recipientId,
        title,
        message,
        type,
        relatedData,
        priority,
        expiresAt
      });

      await notification.save();
      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Notify user about detected deposit
   */
  async notifyUserDepositDetected(depositTransaction) {
    return await this.createNotification({
      recipientType: 'user',
      recipientId: depositTransaction.user,
      title: 'Deposit Detected',
      message: `We've detected your deposit of ${depositTransaction.amount} ${depositTransaction.network}. Transaction is being processed.`,
      type: 'deposit_detected',
      relatedData: {
        transactionId: depositTransaction._id,
        amount: depositTransaction.amount,
        currency: depositTransaction.network,
        txHash: depositTransaction.txHash,
        network: depositTransaction.network,
        status: depositTransaction.status
      },
      priority: 'medium'
    });
  }

  /**
   * Notify user about confirmed deposit
   */
  async notifyUserDepositConfirmed(depositTransaction) {
    return await this.createNotification({
      recipientType: 'user',
      recipientId: depositTransaction.user,
      title: 'Deposit Confirmed',
      message: `Your deposit of ${depositTransaction.amount} ${depositTransaction.network} has been confirmed and is ready for admin review.`,
      type: 'deposit_confirmed',
      relatedData: {
        transactionId: depositTransaction._id,
        amount: depositTransaction.amount,
        currency: depositTransaction.network,
        txHash: depositTransaction.txHash,
        network: depositTransaction.network,
        status: depositTransaction.status
      },
      priority: 'medium'
    });
  }

  /**
   * Notify all admins about new deposit
   */
  async notifyAdminNewDeposit(depositTransaction) {
    try {
      // Get all admins
      const admins = await Admin.find({ isActive: true });
      
      const notifications = [];
      for (const admin of admins) {
        const notification = await this.createNotification({
          recipientType: 'admin',
          recipientId: admin._id,
          title: 'New Deposit for Review',
          message: `New deposit: ${depositTransaction.amount} ${depositTransaction.network} from user. Requires admin review.`,
          type: 'deposit_new',
          relatedData: {
            transactionId: depositTransaction._id,
            amount: depositTransaction.amount,
            currency: depositTransaction.network,
            txHash: depositTransaction.txHash,
            network: depositTransaction.network,
            status: depositTransaction.status
          },
          priority: 'high'
        });
        notifications.push(notification);
      }
      
      return notifications;
    } catch (error) {
      console.error('Error notifying admins about new deposit:', error);
      throw error;
    }
  }

  /**
   * Notify user about withdrawal submission
   */
  async notifyUserWithdrawalSubmitted(withdrawalRequest) {
    return await this.createNotification({
      recipientType: 'user',
      recipientId: withdrawalRequest.userId,
      title: 'Withdrawal Request Submitted',
      message: `Your withdrawal request for ${withdrawalRequest.amount} USDT has been submitted and is pending.`,
      type: 'withdrawal_requested',
      relatedData: {
        withdrawalId: withdrawalRequest._id,
        amount: withdrawalRequest.amount,
        currency: withdrawalRequest.network,
        network: withdrawalRequest.network,
        status: withdrawalRequest.status
      },
      priority: 'medium'
    });
  }

  /**
   * Notify all admins about new withdrawal request
   */
  async notifyAdminNewWithdrawal(withdrawalRequest) {
    try {
      // Get all admins
      const admins = await Admin.find({ isActive: true });
      
      const notifications = [];
      for (const admin of admins) {
        const notification = await this.createNotification({
          recipientType: 'admin',
          recipientId: admin._id,
          title: 'New Withdrawal Request',
          message: `New withdrawal request: ${withdrawalRequest.amount} ${withdrawalRequest.network} from user. Requires admin review.`,
          type: 'withdrawal_requested',
          relatedData: {
            withdrawalId: withdrawalRequest._id,
            amount: withdrawalRequest.amount,
            currency: withdrawalRequest.network,
            network: withdrawalRequest.network,
            status: withdrawalRequest.status
          },
          priority: 'high'
        });
        notifications.push(notification);
      }
      
      return notifications;
    } catch (error) {
      console.error('Error notifying admins about new withdrawal:', error);
      throw error;
    }
  }

  /**
   * Notify user about withdrawal approval
   */
  async notifyUserWithdrawalApproved(withdrawalRequest) {
    return await this.createNotification({
      recipientType: 'user',
      recipientId: withdrawalRequest.userId,
      title: 'Withdrawal Approved',
      message: `Your withdrawal request for ${withdrawalRequest.amount} USDT has being processed.`,
      type: 'withdrawal_approved',
      relatedData: {
        withdrawalId: withdrawalRequest._id,
        amount: withdrawalRequest.amount,
        currency: withdrawalRequest.network,
        network: withdrawalRequest.network,
        status: withdrawalRequest.status
      },
      priority: 'medium'
    });
  }

  /**
   * Notify user about withdrawal rejection
   */
  async notifyUserWithdrawalRejected(withdrawalRequest, reason) {
    return await this.createNotification({
      recipientType: 'user',
      recipientId: withdrawalRequest.userId,
      title: 'Withdrawal Rejected',
      message: `Your withdrawal request for ${withdrawalRequest.amount} USDT has been rejected. Reason: ${reason || withdrawalRequest.rejectionReason || 'No reason provided'}`,
      type: 'withdrawal_rejected',
      relatedData: {
        withdrawalId: withdrawalRequest._id,
        amount: withdrawalRequest.amount,
        currency: withdrawalRequest.network,
        network: withdrawalRequest.network,
        status: withdrawalRequest.status,
        reason: reason || withdrawalRequest.rejectionReason
      },
      priority: 'high'
    });
  }

  /**
   * Notify user about withdrawal completion
   */
  async notifyUserWithdrawalCompleted(withdrawalRequest) {
    return await this.createNotification({
      recipientType: 'user',
      recipientId: withdrawalRequest.userId,
      title: 'Withdrawal Completed',
      message: `Your withdrawal of ${withdrawalRequest.amount} USDT has been completed successfully.`,
      type: 'withdrawal_completed',
      relatedData: {
        withdrawalId: withdrawalRequest._id,
        amount: withdrawalRequest.amount,
        currency: withdrawalRequest.network,
        network: withdrawalRequest.network,
        status: withdrawalRequest.status,
        txHash: withdrawalRequest.txHash
      },
      priority: 'medium'
    });
  }

  /**
   * Notify user about security events (login, logout, password change, etc.)
   */
  async notifyUserSecurityEvent(userId, eventType, eventData = {}) {
    try {
      let title, message;
      
      switch (eventType) {
        case 'login':
          title = 'Security Alert: Account Login';
          message = `Your account was accessed from ${eventData.location || 'unknown location'} at ${eventData.timestamp || new Date().toISOString()}`;
          break;
        case 'logout':
          title = 'Security Alert: Account Logout';
          message = `Your account was logged out at ${eventData.timestamp || new Date().toISOString()}`;
          break;
        case 'password_change':
          title = 'Security Alert: Password Changed';
          message = `Your password was changed at ${eventData.timestamp || new Date().toISOString()}`;
          break;
        case 'password_reset':
          title = 'Security Alert: Password Reset';
          message = `Your password was reset at ${eventData.timestamp || new Date().toISOString()}`;
          break;
        case 'failed_login':
          title = 'Security Alert: Failed Login Attempt';
          message = `Failed login attempt from ${eventData.location || 'unknown location'} at ${eventData.timestamp || new Date().toISOString()}`;
          break;
        default:
          title = 'Security Alert';
          message = `Security event: ${eventType} at ${eventData.timestamp || new Date().toISOString()}`;
      }

      return await this.createNotification({
        recipientType: 'user',
        recipientId: userId,
        title,
        message,
        type: 'security',
        relatedData: {
          eventType,
          ...eventData
        },
        priority: 'high'
      });
    } catch (error) {
      console.error('Error notifying user security event:', error);
      throw error;
    }
  }

  /**
   * Get notifications for a user
   */
  async getUserNotifications(userId, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;
      const notifications = await Notification.find({
        recipientType: 'user',
        recipientId: userId
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

      const total = await Notification.countDocuments({
        recipientType: 'user',
        recipientId: userId
      });

      return {
        notifications,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + notifications.length < total
      };
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    }
  }

  /**
   * Get notifications for an admin
   */
  async getAdminNotifications(adminId, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;
      const notifications = await Notification.find({
        recipientType: 'admin',
        recipientId: adminId
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

      const total = await Notification.countDocuments({
        recipientType: 'admin',
        recipientId: adminId
      });

      return {
        notifications,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + notifications.length < total
      };
    } catch (error) {
      console.error('Error getting admin notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, recipientType, recipientId) {
    try {
      const notification = await Notification.findOneAndUpdate(
        {
          _id: notificationId,
          recipientType,
          recipientId,
          isRead: false
        },
        {
          isRead: true,
          readAt: new Date()
        },
        { new: true }
      );

      return notification;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a recipient
   */
  async markAllAsRead(recipientType, recipientId) {
    try {
      const result = await Notification.updateMany(
        {
          recipientType,
          recipientId,
          isRead: false
        },
        {
          isRead: true,
          readAt: new Date()
        }
      );

      return result;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId, recipientType, recipientId) {
    try {
      const notification = await Notification.findOneAndDelete({
        _id: notificationId,
        recipientType,
        recipientId
      });

      return notification;
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Get unread count for a recipient
   */
  async getUnreadCount(recipientType, recipientId) {
    try {
      const count = await Notification.countDocuments({
        recipientType,
        recipientId,
        isRead: false
      });

      return count;
    } catch (error) {
      console.error('Error getting unread count:', error);
      throw error;
    }
  }

  /**
   * Clean up expired notifications
   */
  async cleanupExpiredNotifications() {
    try {
      const result = await Notification.deleteMany({
        expiresAt: { $lt: new Date() }
      });

      return result;
    } catch (error) {
      console.error('Error cleaning up expired notifications:', error);
      throw error;
    }
  }

  /**
   * Send custom notification from admin to user(s)
   */
  async sendAdminNotification({ 
    senderId, 
    title, 
    message, 
    type = 'system', 
    priority = 'medium',
    sendToAll = false,
    userId = null 
  }) {
    try {
      const notifications = [];
      
      if (sendToAll) {
        // Get all active users
        const users = await User.find({ isActive: true });
        
        for (const user of users) {
          const notification = await this.createNotification({
            recipientType: 'user',
            recipientId: user._id,
            title,
            message,
            type,
            priority,
            relatedData: {
              senderId,
              senderType: 'admin',
              sendToAll: true
            }
          });
          notifications.push(notification);
        }
      } else if (userId) {
        // Send to specific user
        const notification = await this.createNotification({
          recipientType: 'user',
          recipientId: userId,
          title,
          message,
          type,
          priority,
          relatedData: {
            senderId,
            senderType: 'admin',
            sendToAll: false
          }
        });
        notifications.push(notification);
      } else {
        throw new Error('Either sendToAll must be true or userId must be provided');
      }
      
     return notifications;
    } catch (error) {
      console.error('Error sending admin notification:', error);
      throw error;
    }
  }

  /**
   * Get all sent notifications for admin management
   */
  async getAdminSentNotifications(page = 1, limit = 20, filters = {}) {
    try {
      const skip = (page - 1) * limit;
      
      // Build query for admin-sent notifications
      const query = {
        recipientType: 'user',
        'relatedData.senderType': 'admin'
      };
      
      // Apply filters
      if (filters.type && filters.type !== 'all') {
        query.type = filters.type;
      }
      
      if (filters.priority && filters.priority !== 'all') {
        query.priority = filters.priority;
      }
      
      if (filters.search) {
        const safeSearch = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
          { title: { $regex: safeSearch, $options: 'i' } },
          { message: { $regex: safeSearch, $options: 'i' } }
        ];
      }
      
      const notifications = await Notification.find(query)
        .populate('recipientId', 'username email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      
      const total = await Notification.countDocuments(query);
      
      return {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        hasMore: skip + notifications.length < total
      };
    } catch (error) {
      console.error('Error getting admin sent notifications:', error);
      throw error;
    }
  }

  /**
   * Delete admin sent notification
   */
  async deleteAdminSentNotification(notificationId) {
    try {
      const notification = await Notification.findOneAndDelete({
        _id: notificationId,
        recipientType: 'user',
        'relatedData.senderType': 'admin'
      });
      
      return notification;
    } catch (error) {
      console.error('Error deleting admin sent notification:', error);
      throw error;
    }
  }

  /**
   * Notify user that KYC has been submitted
   */
  async notifyUserKycSubmitted(userId) {
    return await this.createNotification({
      recipientType: 'user',
      recipientId: userId,
      title: 'KYC Submitted',
      message: 'Your KYC documents have been submitted for review. We will notify you once the review is complete.',
      type: 'kyc_submitted',
      priority: 'medium'
    });
  }

  /**
   * Notify user about successful trade execution
   */
  async notifyUserTradeExecuted(userId, tradeData) {
    const { side, pair, amount, price, totalValue, isSpecialToken } = tradeData;
    const tokenName = pair.split('/')[0];
    const action = side === 'buy' ? 'purchased' : 'sold';
    
    const title = isSpecialToken ? 
      `🎉 Special Token Trade Executed!` : 
      `✅ Trade Executed Successfully`;
    
    const message = isSpecialToken ?
      `Successfully ${action} ${amount} ${tokenName} for $${totalValue}! Your special token trade is complete.` :
      `Successfully ${action} ${amount} ${tokenName} for $${totalValue}. Your trade has been executed at $${price} per token.`;

    return await this.createNotification({
      recipientType: 'user',
      recipientId: userId,
      title,
      message,
      type: 'trade_executed',
      relatedData: {
        tradeData: {
          side,
          pair,
          amount,
          price,
          totalValue,
          isSpecialToken
        }
      },
      priority: 'medium'
    });
  }

  /**
   * Notify user about trading bonus received
   */
  async notifyUserTradingBonus(userId, bonusData) {
    const { amount, level, percentage, triggeredBy, tokenSymbol, originalProfit } = bonusData;
    
    return await this.createNotification({
      recipientType: 'user',
      recipientId: userId,
      title: `💰 Trading Bonus Received!`,
      message: `You've received a Level ${level} trading bonus of $${amount} USDT`,
      type: 'trading_bonus',
      relatedData: {
        bonusData: {
          amount,
          level,
          percentage,
          triggeredBy,
          tokenSymbol,
          originalProfit
        }
      },
      priority: 'medium'
    });
  }

  /**
   * Notify user about balance update
   */
  async notifyUserBalanceUpdate(userId, balanceData) {
    const { currency, amount, direction, newBalance, reason } = balanceData;
    const action = direction === 'credit' ? 'credited to' : 'debited from';
    
    return await this.createNotification({
      recipientType: 'user',
      recipientId: userId,
      title: `💳 Balance Updated`,
      message: `${amount} ${currency} has been ${action} your account. New balance: ${newBalance} ${currency}. Reason: ${reason}`,
      type: 'balance_update',
      relatedData: {
        balanceData: {
          currency,
          amount,
          direction,
          newBalance,
          reason
        }
      },
      priority: 'low'
    });
  }

  /**
   * Notify user that KYC has been approved
   */
  async notifyUserKycApproved(userId) {
    return await this.createNotification({
      recipientType: 'user',
      recipientId: userId,
      title: 'KYC Approved',
      message: 'Congratulations! Your KYC verification has been approved. You now have access to all platform features.',
      type: 'kyc_approved',
      priority: 'high'
    });
  }

  /**
   * Notify user that KYC has been rejected
   */
  async notifyUserKycRejected(userId, reason = 'Please check your documents and try again') {
    return await this.createNotification({
      recipientType: 'user',
      recipientId: userId,
      title: 'KYC Rejected',
      message: `Your KYC verification has been rejected. ${reason}`,
      type: 'kyc_rejected',
      priority: 'high'
    });
  }

  /**
   * Notify user that KYC resubmission is required
   */
  async notifyUserKycResubmissionRequired(userId, reason = 'Please resubmit your KYC documents') {
    return await this.createNotification({
      recipientType: 'user',
      recipientId: userId,
      title: 'KYC Resubmission Required',
      message: `Your KYC requires resubmission. ${reason}. Please complete the KYC process again.`,
      type: 'kyc_resubmission',
      priority: 'high'
    });
  }

  /**
   * Notify admin of new KYC submission
   */
  async notifyAdminNewKyc(adminId, userId) {
    const user = await User.findById(userId).select('email firstName lastName');
    return await this.createNotification({
      recipientType: 'admin',
      recipientId: adminId,
      title: 'New KYC Submission',
      message: `New KYC submission from ${user.firstName} ${user.lastName} (${user.email}) requires review.`,
      type: 'kyc_new',
      priority: 'medium',
      relatedData: {
        userId: userId
      }
    });
  }
}

module.exports = new NotificationService();