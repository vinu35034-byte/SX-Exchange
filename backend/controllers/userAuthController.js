const User = require('../models/user');
const DepositAddress = require('../models/depositAddress');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const hdWalletService = require('../utils/hdWalletService');
const notificationService = require('../utils/notificationService');
const ReferralService = require('../services/referralService');
const { sessionManager } = require('../config/session');
const { createLogger } = require('../utils/logger');

const logger = createLogger('user-auth');

const signupSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20),
  password: z.string().min(6),
  referralCode: z.string().optional(),
});

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

//User signup
exports.signup = async (req, res) => {
  try {
    const { email, username, password, referralCode } = signupSchema.parse(req.body);

    // Log signup attempt
    logger.info('User signup attempt', {
      email,
      username,
      referralCode: referralCode || 'none',
      sessionId: req.sessionID,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.info('Signup failed - email already in use', {
        email,
        sessionId: req.sessionID,
        timestamp: new Date().toISOString()
      });
      return res.status(409).json({ 
        message: 'Email already in use',
        sessionInfo: {
          deniedAt: new Date(),
          sessionId: req.sessionID
        }
      });
    }

    // Validate referral code if provided
    let referrer = null;
    if (referralCode) {
      try {
        referrer = await ReferralService.validateReferralCode(referralCode);
        if (!referrer) {
          logger.info('Signup failed - invalid referral code', {
            email,
            referralCode,
            sessionId: req.sessionID,
            timestamp: new Date().toISOString()
          });
          return res.status(400).json({ 
            message: 'Invalid referral code',
            sessionInfo: {
              deniedAt: new Date(),
              sessionId: req.sessionID
            }
          });
        }
      } catch (error) {
        logger.error('Referral code validation error', {
          error: error.message,
          referralCode,
          sessionId: req.sessionID,
          timestamp: new Date().toISOString()
        });
        return res.status(400).json({ 
          message: 'Invalid referral code',
          sessionInfo: {
            errorAt: new Date(),
            sessionId: req.sessionID
          }
        });
      }
    }

    // Create user with plain password - let the model's pre-save hook handle hashing
    const user = new User({
      email,
      username,
      passwordHash: password, // Let the pre-save hook hash this
    });

    await user.save();

    // Log successful user creation
    logger.info('User created successfully', {
      userId: user._id.toString(),
      email: user.email,
      username: user.username,
      hasReferrer: !!referrer,
      sessionId: req.sessionID,
      timestamp: new Date().toISOString()
    });

    // Process referral if code was provided
    if (referralCode && referrer) {
      try {
        const clientIP = req.ip || req.connection.remoteAddress || 'Unknown';
        const userAgent = req.get('User-Agent') || 'Unknown';
        
        await ReferralService.processReferralSignup(user._id, referralCode, {
          ip: clientIP,
          userAgent: userAgent,
          source: 'signup'
        });
        
        logger.info('Referral processed successfully', {
          newUserId: user._id.toString(),
          referrerId: referrer._id.toString(),
          referralCode,
          sessionId: req.sessionID,
          timestamp: new Date().toISOString()
        });
      } catch (referralError) {
        logger.error('Referral processing failed:', {
          error: referralError.message,
          userId: user._id.toString(),
          referralCode,
          sessionId: req.sessionID,
          stack: referralError.stack
        });
        // Don't fail the signup if referral processing fails
      }
    }

    // Generate referral code for new user
    try {
      await ReferralService.ensureReferralCode(user._id);
    } catch (error) {
      logger.error('Failed to generate referral code:', {
        error: error.message,
        userId: user._id.toString(),
        sessionId: req.sessionID,
        stack: error.stack
      });
      // Don't fail signup if referral code generation fails
    }

    // Generate deposit addresses for the new user
    try {
      const addressCount = await DepositAddress.countDocuments();
      const addressIndex = addressCount + 1;
      
      const networks = ['BEP20'];
      const depositAddresses = {};

      for (const network of networks) {
        const walletData = hdWalletService.generateDepositAddress(user._id, network, addressIndex);
        const encryptedKey = hdWalletService.encryptPrivateKey(walletData.privateKey);

        const depositAddress = new DepositAddress({
          userId: user._id,
          network,
          address: walletData.address,
          privateKey: JSON.stringify(encryptedKey),
          derivationPath: walletData.derivationPath,
          addressIndex: walletData.addressIndex
        });

        await depositAddress.save();
        depositAddresses[network] = walletData.address;
      }

      // Update user with deposit addresses
      user.depositAddresses = depositAddresses;
      user.addressGenerated = true;
      await user.save();
      
      logger.info('Deposit addresses generated successfully', {
        userId: user._id.toString(),
        networks: networks,
        sessionId: req.sessionID,
        timestamp: new Date().toISOString()
      });
    } catch (addressError) {
      logger.error('Failed to generate deposit addresses:', {
        error: addressError.message,
        userId: user._id.toString(),
        sessionId: req.sessionID,
        stack: addressError.stack
      });      
      // Don't fail the signup if address generation fails
    }

    // Send welcome notification
    try {
      await notificationService.createNotification({
        recipientType: 'user',
        recipientId: user._id,
        userId: user._id,
        type: 'system',
        title: '🎉 Welcome to exchange!',
        message: `Welcome ${user.username}! Your account has been successfully created. Start by making your first deposit to begin trading.`,
        channel: 'in-app',
        metadata: {
          accountCreated: true,
          welcomeMessage: true
        }
      });
    } catch (notificationError) {
      console.error('Failed to send welcome notification:', notificationError);
      // Don't fail the signup if notification fails
    }

    // Create user session instead of JWT
    try {
      await sessionManager.createUserSession(req, user);
      
      res.status(201).json({
        message: 'User created successfully',
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
        }
      });
    } catch (sessionError) {
      console.error('Failed to create user session:', sessionError);
      res.status(500).json({ 
        message: 'Account created but session failed. Please login manually.',
        code: 'SESSION_CREATION_FAILED'
      });
    }
  } catch (err) {
    const message = err?.errors ? err.errors[0].message : err.message;
    res.status(400).json({ message });
  }
};

//User signin
exports.signin = async (req, res) => {
  try {
    const { email, password } = signinSchema.parse(req.body);

    const user = await User.findOne({ email });
    if (!user) {
      console.log('🔍 Signin Debug - User not found:', { email });
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    console.log('🔍 Signin Debug:', {
      userId: user._id,
      email: user.email,
      passwordLength: password.length,
      storedPasswordHash: user.passwordHash?.substring(0, 20) + '...',
      lastPasswordChangeAt: user.lastPasswordChangeAt
    });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    console.log('🔍 Password Comparison Result:', { isMatch, email });
    
    if (!isMatch) {
      // Additional debugging for failed password comparisons
      console.log('🔍 Password Mismatch Debug:', {
        email,
        providedPasswordLength: password.length,
        storedHashLength: user.passwordHash?.length,
        hashStartsWith: user.passwordHash?.substring(0, 7)
      });
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Update last login
    const previousLogin = user.lastLogin;
    user.lastLogin = new Date();
    await user.save();

    // Send security notification for login
    try {
      const clientIP = req.ip || req.connection.remoteAddress || 'Unknown';
      const userAgent = req.get('User-Agent') || 'Unknown';
      
      await notificationService.notifyUserSecurityEvent(user._id, 'login', {
        timestamp: new Date().toISOString(),
        location: `IP: ${clientIP}`,
        ipAddress: clientIP,
        userAgent: userAgent,
        previousLogin: previousLogin
      });
    } catch (notificationError) {
      console.error('Failed to send login notification:', notificationError);
      // Don't fail the login if notification fails
    }

    // Create user session instead of JWT
    try {
      // SECURITY: Regenerate session ID to prevent session fixation attacks
      await new Promise((resolve) => {
        req.session.regenerate((err) => {
          if (err) console.warn('Session regeneration failed, continuing with existing session');
          resolve();
        });
      });

      await sessionManager.createUserSession(req, user);
      
      res.status(200).json({
        message: 'Signed in successfully',
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
        }
      });
    } catch (sessionError) {
      console.error('Failed to create user session:', sessionError);
      res.status(500).json({ 
        message: 'Login failed. Please try again.',
        code: 'SESSION_CREATION_FAILED'
      });
    }
  } catch (err) {
    const message = err?.errors ? err.errors[0].message : err.message;
    res.status(400).json({ message });
  }
};

//User Logout 
exports.logout = async (req, res) => {
  try {
    // Destroy user session
    await sessionManager.destroyUserSession(req);
    
    res.status(200).json({ 
      message: 'Logged out successfully',
      code: 'LOGOUT_SUCCESS'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      message: 'Logout failed. Please try again.',
      code: 'LOGOUT_FAILED'
    });
  }
};

// Forgot password - send reset email
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        error: 'Email is required',
        code: 'EMAIL_REQUIRED'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // For security, don't reveal if email exists
      return res.json({ 
        message: 'If an account with this email exists, a password reset link has been sent.',
        code: 'RESET_EMAIL_SENT'
      });
    }

    // Generate password reset OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Update user with password reset OTP
    user.otp = {
      code: otpCode,
      expiresAt,
      attempts: 0,
      maxAttempts: 3,
      isUsed: false,
      generatedAt: new Date(),
      purpose: 'password_reset'
    };

    await user.save();

    // Send password reset email
    try {
      const emailService = require('../services/emailService');
      // Create reset link that goes to frontend reset page
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?email=${encodeURIComponent(user.email)}`;
      
      await emailService.sendPasswordResetEmail(user.email, {
        resetCode: otpCode,
        resetLink: resetLink,
        firstName: user.username || 'User',
        expiresIn: '15 minutes'
      });

      logger.info('Password reset OTP sent', {
        userId: user._id,
        email: user.email,
        timestamp: new Date()
      });
    } catch (emailError) {
      logger.error('Failed to send password reset email:', emailError);
      // Continue - don't reveal email service issues
    }

    res.json({ 
      message: 'If an account with this email exists, a password reset link has been sent.',
      code: 'RESET_EMAIL_SENT'
    });

  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({ 
      error: 'Failed to process password reset request',
      code: 'RESET_REQUEST_FAILED'
    });
  }
};

// Reset password with OTP
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Validate input
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ 
        error: 'Email, OTP, and new password are required',
        code: 'MISSING_FIELDS'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters long',
        code: 'PASSWORD_TOO_SHORT'
      });
    }

    if (otp.length !== 6) {
      return res.status(400).json({ 
        error: 'Invalid OTP format',
        code: 'INVALID_OTP_FORMAT'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ 
        error: 'Invalid email or OTP',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Verify OTP
    if (!user.otp || user.otp.isUsed) {
      return res.status(400).json({ 
        error: 'No valid OTP found',
        code: 'NO_VALID_OTP'
      });
    }

    if (user.otp.purpose !== 'password_reset') {
      return res.status(400).json({ 
        error: 'Invalid OTP purpose',
        code: 'INVALID_OTP_PURPOSE'
      });
    }

    if (new Date() > user.otp.expiresAt) {
      return res.status(400).json({ 
        error: 'OTP has expired',
        code: 'OTP_EXPIRED'
      });
    }

    if (user.otp.attempts >= user.otp.maxAttempts) {
      return res.status(400).json({ 
        error: 'Maximum OTP attempts exceeded',
        code: 'MAX_ATTEMPTS_EXCEEDED'
      });
    }

    if (user.otp.code !== otp) {
      user.otp.attempts += 1;
      await user.save();
      return res.status(400).json({ 
        error: 'Invalid OTP',
        code: 'INVALID_OTP',
        attemptsRemaining: user.otp.maxAttempts - user.otp.attempts
      });
    }

    // Set new password (let the model's pre-save hook handle hashing)
    console.log('🔍 Password Reset Debug:', {
      userId: user._id,
      email: user.email,
      newPasswordLength: newPassword.length,
      oldPasswordHash: user.passwordHash?.substring(0, 20) + '...',
      willLetModelHashPassword: true
    });

    // Update user password and mark OTP as used
    user.passwordHash = newPassword; // Let the pre-save hook hash this
    user.otp.isUsed = true;
    user.lastPasswordChangeAt = new Date();

    await user.save();

    // Verify the password was saved correctly
    const updatedUser = await User.findById(user._id);
    console.log('🔍 Password Reset Verification:', {
      userId: user._id,
      passwordHashSaved: updatedUser.passwordHash?.substring(0, 20) + '...',
      lastPasswordChangeAt: updatedUser.lastPasswordChangeAt
    });

    logger.info('Password reset successful', {
      userId: user._id,
      email: user.email,
      timestamp: new Date()
    });

    res.json({ 
      message: 'Password reset successfully',
      code: 'PASSWORD_RESET_SUCCESS'
    });

  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({ 
      error: 'Failed to reset password',
      code: 'PASSWORD_RESET_FAILED'
    });
  }
};
