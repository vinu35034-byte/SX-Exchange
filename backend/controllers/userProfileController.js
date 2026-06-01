const bcrypt = require('bcrypt');
const User = require('../models/user');
const { sessionManager } = require('../config/session');
const { createLogger } = require('../utils/logger');

const logger = createLogger('user-profile');

// Get user profile data
const getUserProfile = async (req, res) => {
  try {
    // Log profile access
    logger.info('User profile accessed', {
      userId: req.user.id,
      sessionId: req.sessionID,
      timestamp: new Date().toISOString()
    });

    const user = await User.findById(req.user.id).select('-passwordHash -twoFactorSecret');
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        sessionInfo: {
          checkedAt: new Date(),
          sessionId: req.sessionID
        }
      });
    }
    // Convert user to JSON-serializable format
    const userObj = user.toJSON();
    
    // Add purchase history summary for frontend display
    const purchaseHistorySummary = user.purchaseHistory ? 
      user.purchaseHistory
        .filter(h => h.remainingAmount > 0) // Only show lots that still have remaining tokens
        .map(h => ({
          token: h.token,
          remainingAmount: h.remainingAmount,
          purchasePrice: h.price,
          purchasedAt: h.purchasedAt,
          originalAmount: h.amount,
          usdtValue: h.usdtValue
        }))
        .sort((a, b) => b.purchasedAt - a.purchasedAt) // Most recent first for display
      : [];
    
    // Add session information to response
    const sessionInfo = {
      sessionId: req.sessionID,
      loginAt: req.session?.user?.loginAt,
      lastActivity: req.session?.user?.lastActivity,
      isAuthenticated: true,
      accessedAt: new Date()
    };

    res.json({ 
      user: userObj,
      purchaseHistory: purchaseHistorySummary,
      session: sessionInfo
    });
  } catch (error) {
    logger.error('Profile fetch error:', {
      error: error.message,
      userId: req.user.id,
      sessionId: req.sessionID,
      stack: error.stack
    });
    
    res.status(500).json({ 
      error: 'Server error',
      sessionInfo: {
        errorAt: new Date(),
        sessionId: req.sessionID
      }
    });
  }
};

// Update user settings
const updateUserSettings = async (req, res) => {
  try {
    const { notifications, privacy, appearance } = req.body;
    
    // Log settings update
    logger.info('User settings update attempt', {
      userId: req.user.id,
      sessionId: req.sessionID,
      settingsChanged: { notifications: !!notifications, privacy: !!privacy, appearance: !!appearance },
      timestamp: new Date().toISOString()
    });
    
    const updateData = {};
    
    if (notifications) {
      updateData['preferences.notifications'] = {
        email: notifications.email,
        push: notifications.push,
        trading: notifications.trading,
        news: notifications.news
      };
    }
    
    if (privacy) {
      updateData.privacy = privacy;
    }
    
    if (appearance) {
      if (appearance.theme) updateData.theme = appearance.theme;
      if (appearance.language) updateData.language = appearance.language;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-passwordHash -twoFactorSecret');

    // Log successful settings update
    logger.info('User settings updated successfully', {
      userId: req.user.id,
      sessionId: req.sessionID,
      updateData: Object.keys(updateData),
      timestamp: new Date().toISOString()
    });

    res.json({ 
      message: 'Settings updated successfully',
      user,
      sessionInfo: {
        updatedAt: new Date(),
        sessionId: req.sessionID
      }
    });

  } catch (error) {
    logger.error('Error updating user settings:', {
      error: error.message,
      userId: req.user.id,
      sessionId: req.sessionID,
      stack: error.stack
    });
    
    res.status(500).json({ 
      error: 'Server error',
      sessionInfo: {
        errorAt: new Date(),
        sessionId: req.sessionID
      }
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Enhanced session validation for password changes
    if (!req.session?.user || !req.sessionID) {
      logger.security('Password change attempted without valid session', {
        sessionId: req.sessionID,
        userId: req.user?.id,
        timestamp: new Date().toISOString()
      });
      
      return res.status(401).json({ 
        error: 'Session validation failed. Please login again for security.',
        sessionInfo: {
          deniedAt: new Date(),
          sessionId: req.sessionID
        }
      });
    }

    // Log password change attempt
    logger.info('Password change attempt', {
      userId: req.user.id,
      sessionId: req.sessionID,
      timestamp: new Date().toISOString()
    });

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Current password and new password are required',
        sessionInfo: {
          validatedAt: new Date(),
          sessionId: req.sessionID
        }
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: 'New password must be at least 6 characters long',
        sessionInfo: {
          validatedAt: new Date(),
          sessionId: req.sessionID
        }
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        sessionInfo: {
          checkedAt: new Date(),
          sessionId: req.sessionID
        }
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      logger.security('Invalid current password provided for password change', {
        userId: req.user.id,
        sessionId: req.sessionID,
        timestamp: new Date().toISOString()
      });
      
      return res.status(400).json({ 
        error: 'Current password is incorrect',
        sessionInfo: {
          validatedAt: new Date(),
          sessionId: req.sessionID
        }
      });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await User.findByIdAndUpdate(req.user.id, {
      passwordHash: newPasswordHash,
      lastPasswordChangeAt: new Date()
    });

    // Log successful password change
    logger.info('Password changed successfully', {
      userId: req.user.id,
      sessionId: req.sessionID,
      timestamp: new Date().toISOString()
    });

    res.json({ 
      message: 'Password changed successfully',
      sessionInfo: {
        changedAt: new Date(),
        sessionId: req.sessionID
      }
    });
  } catch (error) {
    logger.error('Password change error:', {
      error: error.message,
      userId: req.user.id,
      sessionId: req.sessionID,
      stack: error.stack
    });
    
    res.status(500).json({ 
      error: 'Failed to change password',
      sessionInfo: {
        errorAt: new Date(),
        sessionId: req.sessionID
      }
    });
  }
};

// Update email
const changeEmail = async (req, res) => {
  try {
    const { newEmail, password } = req.body;

    if (!newEmail || !password) {
      return res.status(400).json({ error: 'New email and password are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Password is incorrect' });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: newEmail.toLowerCase() });
    if (existingUser && existingUser._id.toString() !== req.user.id) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    // Update email
    await User.findByIdAndUpdate(req.user.id, {
      email: newEmail.toLowerCase(),
      isEmailVerified: false // Require re-verification
    });

    res.json({ message: 'Email updated successfully. Please verify your new email address.' });
  } catch (error) {
    console.error('Email change error:', error);
    res.status(500).json({ error: 'Failed to update email' });
  }
};

// Send password reset email
const sendPasswordReset = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Password reset email sent successfully' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Failed to send reset email' });
  }
};

// Get user transactions with filtering
const getUserTransactions = async (req, res) => {
  try {
    const userId = req.user._id;
    const { 
      page = 1, 
      limit = 20, 
      type, 
      status,
      startDate,
      endDate 
    } = req.query;

    const Transaction = require('../models/transaction');
    
    // Build filter query
    const filter = { user: userId };
    
    if (type && type !== 'all') {
      if (type === 'rewards') {
        filter.type = { $in: ['referral_reward', 'trading_bonus', 'vip_reward'] };
      } else if (type === 'referral') {
        filter.type = 'referral_reward';
      } else if (type === 'trading') {
        filter.type = 'trading_bonus';
      } else if (type === 'vip') {
        filter.type = 'vip_reward';
      } else if (type === 'deposits') {
        filter.type = 'deposit';
      } else if (type === 'withdrawals') {
        filter.type = 'withdrawal';
      } else {
        filter.type = type;
      }
    }
    
    if (status) {
      filter.status = status;
    }
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Execute query with pagination
    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('user', 'username email')
      .lean();

    // Get total count for pagination
    const total = await Transaction.countDocuments(filter);

    res.json({
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
        total
      },
      sessionInfo: {
        accessedAt: new Date(),
        sessionId: req.sessionID,
        lastActivity: req.session?.user?.lastActivity
      }
    });

  } catch (error) {
    console.error('Error getting user transactions:', error);
    res.status(500).json({ 
      message: 'Failed to get transactions',
      error: error.message 
    });
  }
};

// Get withdrawal password status
const getWithdrawalPasswordStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('withdrawalPasswordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hasPassword = !!user.withdrawalPasswordHash;
    const sessionVerified = req.session?.withdrawalPasswordVerified || false;

    res.json({
      hasPassword,
      sessionVerified
    });

  } catch (error) {
    console.error('Error checking withdrawal password status:', error);
    res.status(500).json({
      error: 'Failed to check withdrawal password status'
    });
  }
};

// Send OTP for withdrawal password creation
const sendWithdrawalPasswordOTP = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user already has withdrawal password
    if (user.withdrawalPasswordHash) {
      return res.status(400).json({ 
        error: 'Withdrawal password already exists. Use change password endpoint instead.',
        action: 'change_required'
      });
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update user with OTP
    user.otp = {
      code: otpCode,
      expiresAt,
      attempts: 0,
      maxAttempts: 3,
      isUsed: false,
      generatedAt: new Date(),
      purpose: 'withdrawal_password_create'
    };

    await user.save();

    // Send OTP email (using dedicated withdrawal password email service)
    const emailService = require('../services/emailService');
    await emailService.sendWithdrawalPasswordOTPEmail(user.email, {
      otp: otpCode,
      firstName: user.username || 'User',
      expiresIn: '10 minutes',
      isCreation: true
    });

    logger.info('Withdrawal password OTP sent', {
      userId: user._id,
      email: user.email,
      timestamp: new Date()
    });

    res.json({
      message: 'OTP sent to your email address',
      expiresAt
    });

  } catch (error) {
    console.error('Error sending withdrawal password OTP:', error);
    res.status(500).json({
      error: 'Failed to send OTP'
    });
  }
};

// Create withdrawal password
const createWithdrawalPassword = async (req, res) => {
  try {
    const { password, otp } = req.body;

    // Validate input
    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    if (!otp || otp.length !== 6) {
      return res.status(400).json({ error: 'Invalid OTP format' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user already has withdrawal password
    if (user.withdrawalPasswordHash) {
      return res.status(400).json({ error: 'Withdrawal password already exists' });
    }

    // Verify OTP
    if (!user.otp || user.otp.isUsed) {
      return res.status(400).json({ error: 'No valid OTP found' });
    }

    if (user.otp.purpose !== 'withdrawal_password_create') {
      return res.status(400).json({ error: 'Invalid OTP purpose' });
    }

    if (new Date() > user.otp.expiresAt) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    if (user.otp.attempts >= user.otp.maxAttempts) {
      return res.status(400).json({ error: 'Maximum OTP attempts exceeded' });
    }

    if (user.otp.code !== otp) {
      user.otp.attempts += 1;
      await user.save();
      return res.status(400).json({ 
        error: 'Invalid OTP',
        attemptsRemaining: user.otp.maxAttempts - user.otp.attempts
      });
    }

    // Hash withdrawal password
    const saltRounds = 12;
    const withdrawalPasswordHash = await bcrypt.hash(password, saltRounds);

    // Update user
    user.withdrawalPasswordHash = withdrawalPasswordHash;
    user.otp.isUsed = true;
    req.session.withdrawalPasswordVerified = true; // Mark as verified in session

    await user.save();

    logger.info('Withdrawal password created', {
      userId: user._id,
      timestamp: new Date()
    });

    res.json({
      message: 'Withdrawal password created successfully'
    });

  } catch (error) {
    console.error('Error creating withdrawal password:', error);
    res.status(500).json({
      error: 'Failed to create withdrawal password'
    });
  }
};

// Verify withdrawal password
const verifyWithdrawalPassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const user = await User.findById(req.user.id).select('withdrawalPasswordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.withdrawalPasswordHash) {
      return res.status(400).json({ error: 'Withdrawal password not set' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.withdrawalPasswordHash);
    if (!isValid) {
      logger.warn('Invalid withdrawal password attempt', {
        userId: user._id,
        timestamp: new Date()
      });
      return res.status(400).json({ error: 'Invalid withdrawal password' });
    }

    // Mark as verified in session
    req.session.withdrawalPasswordVerified = true;

    logger.info('Withdrawal password verified', {
      userId: user._id,
      timestamp: new Date()
    });

    res.json({
      message: 'Withdrawal password verified successfully'
    });

  } catch (error) {
    console.error('Error verifying withdrawal password:', error);
    res.status(500).json({
      error: 'Failed to verify withdrawal password'
    });
  }
};

// Send OTP for changing withdrawal password
const sendWithdrawalPasswordChangeOTP = async (req, res) => {
  try {
    const { currentPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({ error: 'Current withdrawal password is required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has withdrawal password
    if (!user.withdrawalPasswordHash) {
      return res.status(400).json({ error: 'No withdrawal password exists to change' });
    }

    // Verify current withdrawal password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.withdrawalPasswordHash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: 'Current withdrawal password is incorrect' });
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update user with OTP
    user.otp = {
      code: otpCode,
      expiresAt,
      attempts: 0,
      maxAttempts: 3,
      isUsed: false,
      generatedAt: new Date(),
      purpose: 'withdrawal_password_reset'
    };

    await user.save();

    // Send OTP email for withdrawal password change
    const emailService = require('../services/emailService');
    await emailService.sendWithdrawalPasswordOTPEmail(user.email, {
      otp: otpCode,
      firstName: user.username || 'User',
      expiresIn: '10 minutes',
      isCreation: false
    });

    logger.info('Withdrawal password change OTP sent', {
      userId: user._id,
      email: user.email,
      timestamp: new Date()
    });

    res.json({
      message: 'OTP sent to your email address for password change',
      expiresAt
    });

  } catch (error) {
    console.error('Error sending withdrawal password change OTP:', error);
    res.status(500).json({
      error: 'Failed to send OTP'
    });
  }
};

// Change withdrawal password
const changeWithdrawalPassword = async (req, res) => {
  try {
    const { newPassword, otp } = req.body;

    // Validate input
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters' });
    }

    if (!otp || otp.length !== 6) {
      return res.status(400).json({ error: 'Invalid OTP format' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has withdrawal password
    if (!user.withdrawalPasswordHash) {
      return res.status(400).json({ error: 'No withdrawal password exists to change' });
    }

    // Verify OTP
    if (!user.otp || user.otp.isUsed) {
      return res.status(400).json({ error: 'No valid OTP found' });
    }

    if (user.otp.purpose !== 'withdrawal_password_reset') {
      return res.status(400).json({ error: 'Invalid OTP purpose' });
    }

    if (new Date() > user.otp.expiresAt) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    if (user.otp.attempts >= user.otp.maxAttempts) {
      return res.status(400).json({ error: 'Maximum OTP attempts exceeded' });
    }

    if (user.otp.code !== otp) {
      user.otp.attempts += 1;
      await user.save();
      return res.status(400).json({ 
        error: 'Invalid OTP',
        attemptsRemaining: user.otp.maxAttempts - user.otp.attempts
      });
    }

    // Hash new withdrawal password
    const saltRounds = 12;
    const newWithdrawalPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update user
    user.withdrawalPasswordHash = newWithdrawalPasswordHash;
    user.otp.isUsed = true;
    req.session.withdrawalPasswordVerified = true; // Mark as verified in session

    await user.save();

    logger.info('Withdrawal password changed', {
      userId: user._id,
      timestamp: new Date()
    });

    res.json({
      message: 'Withdrawal password changed successfully'
    });

  } catch (error) {
    console.error('Error changing withdrawal password:', error);
    res.status(500).json({
      error: 'Failed to change withdrawal password'
    });
  }
};

module.exports = {
  getUserProfile,
  updateUserSettings,
  changePassword,
  changeEmail,
  sendPasswordReset,
  getUserTransactions,
  getWithdrawalPasswordStatus,
  sendWithdrawalPasswordOTP,
  createWithdrawalPassword,
  verifyWithdrawalPassword,
  sendWithdrawalPasswordChangeOTP,
  changeWithdrawalPassword
};
