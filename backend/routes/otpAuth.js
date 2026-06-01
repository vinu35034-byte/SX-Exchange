const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/user');
const SignupSession = require('../models/signupSession');
const emailService = require('../services/emailService');
const advancedRateLimit = require('../middlewares/advancedRateLimit');
const { createLogger } = require('../utils/logger');
const { sessionManager: SessionManager } = require('../config/session');

const router = express.Router();
const logger = createLogger('otp-auth');

/**
 * Step 1: Verify user credentials and send OTP
 */
router.post('/verify-credentials', advancedRateLimit.authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      logger.warn(`Login attempt with non-existent email: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account has been deactivated. Please contact support.'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      logger.warn(`Invalid password attempt for user: ${user.email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate OTP and save to user
    const otpCode = user.generateOTP('login');
    await user.save();

    // Send OTP via email
    try {
      await emailService.sendOTPEmail(user.email, {
        firstName: user.firstName || user.username,
        otp: otpCode,
        expiresIn: '5 minutes'
      });

      logger.info(`OTP sent to user: ${user.email}, User ID: ${user._id}`);
    } catch (emailError) {
      logger.error('Failed to send OTP email:', emailError);
      // Don't fail the request, but log the error
    }

    res.json({
      success: true,
      message: 'Credentials verified. OTP sent to your email.',
      userId: user._id.toString(), // Send user ID for OTP verification
      expiresIn: 300 // 5 minutes in seconds
    });

  } catch (error) {
    logger.error('Error in verify-credentials:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Step 2: Verify OTP and complete login
 */
router.post('/verify-otp', advancedRateLimit.authLimiter, async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({
        success: false,
        message: 'User ID and OTP are required'
      });
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify OTP using user model method
    const otpResult = user.verifyOTP(otp);
    if (!otpResult.success) {
      await user.save(); // Save updated attempt count
      return res.status(401).json({
        success: false,
        message: otpResult.message,
        remainingAttempts: otpResult.remainingAttempts
      });
    }

    // OTP is valid, complete login
    // Generate JWT token
    const jwtPayload = {
      userId: user._id,
      email: user.email,
      role: 'user'
    };

    const token = jwt.sign(jwtPayload, process.env.JWT_SECRET_USER, {
      expiresIn: '7d'
    });

    // Update user's last login
    user.lastLogin = new Date();
    user.lastLoginIP = req.ip;
    
    // Clear OTP after successful verification
    user.clearOTP();
    await user.save();

    // Create session
    req.session.user = {
      id: user._id,
      email: user.email,
      username: user.username,
      loginAt: new Date(),
      lastActivity: new Date()
    };

    // Explicitly save session to Redis and wait for completion
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          logger.error('Session save error during signin OTP verification:', err);
          reject(err);
        } else {
          logger.info(`Session saved successfully for user: ${user.email}, sessionId: ${req.sessionID}`);
          resolve();
        }
      });
    });

    // Also store in Redis using SessionManager for consistency
    try {
      await SessionManager.storeUserSession(req.sessionID, {
        userId: user._id.toString(),
        email: user.email,
        username: user.username,
        loginAt: new Date(),
        lastActivity: new Date()
      });
      logger.info(`Session stored in Redis via SessionManager for user: ${user.email}`);
    } catch (redisError) {
      logger.error('Redis session storage error:', redisError);
      // Don't fail login for Redis errors, session is still in memory/express-session store
    }

    logger.info(`Successful OTP login for user: ${user.email}`);

    res.json({
      success: true,
      message: 'Login successful',
      token: token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        vipLevel: user.vipLevel,
        isEmailVerified: user.isEmailVerified,
        isKYCVerified: user.kycStatus === 'approved'
      }
    });

  } catch (error) {
    logger.error('Error in verify-otp:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Resend OTP
 */
router.post('/resend-otp', advancedRateLimit.authLimiter, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate new OTP
    const newOtpCode = user.generateOTP('login');
    await user.save();

    // Send new OTP via email
    try {
      await emailService.sendOTPEmail(user.email, {
        firstName: user.firstName || user.username,
        otp: newOtpCode,
        expiresIn: '5 minutes'
      });

      logger.info(`OTP resent to user: ${user.email}, User ID: ${user._id}`);
    } catch (emailError) {
      logger.error('Failed to resend OTP email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email'
      });
    }

    res.json({
      success: true,
      message: 'New OTP sent to your email',
      expiresIn: 300 // 5 minutes in seconds
    });

  } catch (error) {
    logger.error('Error in resend-otp:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * SIGNUP OTP ROUTES
 */

/**
 * Step 1: Signup Request - Validate data and send OTP
 */
router.post('/signup-request', advancedRateLimit.authLimiter, async (req, res) => {
  try {
    const { email, username, password, referralCode } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email, username, and password are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }

    // Check if email already exists in User collection
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered. Please sign in or use different email.'
      });
    }

    // Check if there's already an active signup session for this email
    const existingSession = await SignupSession.findOne({ email: email.toLowerCase() });
    if (existingSession) {
      // Delete the old session and create a new one
      await SignupSession.deleteOne({ email: email.toLowerCase() });
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ username: username });
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: 'Username not available. Please choose another.'
      });
    }

    // Validate referral code if provided
    let referralUser = null;
    if (referralCode) {
      referralUser = await User.findOne({ 
        referralCode: referralCode.toUpperCase() 
      });
      if (!referralUser) {
        return res.status(400).json({
          success: false,
          message: 'Referral code invalid. Please check and resubmit.'
        });
      }
    }

    // Create new signup session
    const signupSession = new SignupSession({
      email: email.toLowerCase(),
      username: username,
      passwordHash: password, // Store plain password - User model will hash it
      referralCode: referralCode ? referralCode.toUpperCase() : undefined
    });

    // Generate OTP
    const otpCode = signupSession.generateSignupOTP();
    await signupSession.save();
    
    // Send OTP email
    try {
      console.log(`📧 Attempting to send signup OTP email to: ${email}`);
      const emailResult = await emailService.sendSignupOTPEmail(email, {
        username: username,
        otp: otpCode,
        expiresIn: '5 minutes'
      });

      console.log(`📧 Email result:`, emailResult);

      if (emailResult.success) {
        logger.info(`✅ Signup OTP sent successfully to: ${email}, Session ID: ${signupSession.sessionId}, Message ID: ${emailResult.messageId}`);
      } else {
        logger.error(`❌ Failed to send signup OTP email to ${email}:`, emailResult.error);
      }
    } catch (emailError) {
      console.error(`❌ Exception sending signup OTP email:`, emailError);
      logger.error('Failed to send signup OTP email:', emailError);
      // Don't delete session for debugging - just log the error
      logger.info(`Signup session created without email: ${signupSession.sessionId}, OTP: ${otpCode}`);
    }

    res.json({
      success: true,
      message: 'Verification code sent to your email.',
      sessionId: signupSession.sessionId,
      expiresIn: 300 // 5 minutes in seconds
    });

  } catch (error) {
    logger.error('Error in signup-request:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Step 2: Verify Signup OTP and Create Account
 */
router.post('/verify-signup', advancedRateLimit.authLimiter, async (req, res) => {
  try {
    const { sessionId, otp } = req.body;

    if (!sessionId || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Session ID and OTP are required'
      });
    }

    // Get signup session
    const signupSession = await SignupSession.findOne({ sessionId });
    if (!signupSession) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired signup session. Please start over.'
      });
    }

    // Verify OTP
    const otpResult = signupSession.verifySignupOTP(otp);
    if (!otpResult.success) {
      await signupSession.save(); // Save updated attempt count
      return res.status(401).json({
        success: false,
        message: otpResult.message,
        remainingAttempts: otpResult.remainingAttempts
      });
    }

    // Check if email/username still available (race condition protection)
    const existingUser = await User.findOne({ 
      $or: [
        { email: signupSession.email },
        { username: signupSession.username }
      ]
    });
    
    if (existingUser) {
      await SignupSession.findByIdAndDelete(signupSession._id);
      return res.status(400).json({
        success: false,
        message: 'Email or username already taken. Please start over.'
      });
    }

    // Find the referring user if referral code was provided
    let referringUser = null;
    if (signupSession.referralCode) {
      referringUser = await User.findOne({ 
        referralCode: signupSession.referralCode 
      });
    }

    // Create user account
    const newUser = new User({
      email: signupSession.email,
      username: signupSession.username,
      passwordHash: signupSession.passwordHash,
      firstName: signupSession.username, // Default to username
      lastName: '',
      referredBy: referringUser ? referringUser._id : undefined
    });

    await newUser.save();

    // Generate referral code for new user (MUST be done before sending welcome email)
    try {
      const ReferralService = require('../services/referralService');
      await ReferralService.ensureReferralCode(newUser._id);
      // Reload user to get the generated referral code
      await newUser.populate('referralCode');
      logger.info(`Referral code generated for new user: ${newUser.email}, Code: ${newUser.referralCode}`);
    } catch (codeError) {
      logger.error('Failed to generate referral code for new user:', codeError);
      // Don't fail signup for referral code generation errors
    }

    // Process referral signup if applicable
    if (signupSession.referralCode && referringUser) {
      try {
        const ReferralService = require('../services/referralService');
        await ReferralService.processReferralSignup(
          newUser._id, 
          signupSession.referralCode,
          {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            source: 'signup'
          }
        );
        logger.info(`Referral processed: ${newUser.email} referred by ${referringUser.email}`);
      } catch (referralError) {
        logger.error('Error processing referral signup:', referralError);
        // Don't fail signup for referral errors
      }
    }

    // Send welcome email immediately after account creation (with referral code)
    try {
      // Fetch the latest user data to ensure referralCode is available
      const userWithReferralCode = await User.findById(newUser._id);
      
      const emailResult = await emailService.sendWelcomeEmail(userWithReferralCode.email, {
        firstName: userWithReferralCode.firstName || userWithReferralCode.username,
        lastName: userWithReferralCode.lastName || '',
        email: userWithReferralCode.email,
        referralCode: userWithReferralCode.referralCode || 'PENDING'
      });

      if (emailResult.success) {
        logger.info(`✅ Welcome email sent to ${userWithReferralCode.email}, Message ID: ${emailResult.messageId}`);
      } else {
        logger.error(`❌ Welcome email failed for ${userWithReferralCode.email}:`, emailResult.error);
      }
    } catch (emailError) {
      logger.error('❌ Failed to send welcome email:', emailError);
      // Don't fail signup for welcome email errors
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: newUser._id,
        email: newUser.email,
        username: newUser.username
      },
      process.env.JWT_SECRET_USER,
      { expiresIn: '7d' }
    );

    // Create session for the new user
    const sessionUserData = {
      id: newUser._id,
      email: newUser.email,
      username: newUser.username,
      loginAt: new Date(),
      lastActivity: new Date()
    };
    
    req.session.user = sessionUserData;
   
    // Save session explicitly
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          logger.error('Failed to save session after signup:', err);
          reject(err);
        } else {
          logger.info(`Session created for new user: ${newUser.email}, SessionID: ${req.sessionID}`);
          resolve();
        }
      });
    });

    // Store session in Redis for better session management
    try {
      const { sessionManager } = require('../config/session');
      await sessionManager.storeUserSession(req.sessionID, sessionUserData);
      logger.info(`Session stored in Redis for user: ${newUser.email}, SessionID: ${req.sessionID}`);
    } catch (redisError) {
      logger.error('Failed to store session in Redis:', redisError);
      // Don't fail signup for Redis errors, session is still in memory/express-session store
    }

    // Clean up signup session
    await SignupSession.findByIdAndDelete(signupSession._id);

    logger.info(`New user created: ${newUser.email}, User ID: ${newUser._id}`);

    res.json({
      success: true,
      message: 'Account created successfully! Welcome to  NexaBit!',
      token: token,
      user: {
        id: newUser._id,
        email: newUser.email,
        username: newUser.username,
        firstName: newUser.firstName,
        lastName: newUser.lastName
      }
    });

  } catch (error) {
    logger.error('Error in verify-signup:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Resend Signup OTP
 */
router.post('/resend-signup-otp', advancedRateLimit.authLimiter, async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    // Get signup session
    const signupSession = await SignupSession.findOne({ sessionId });
    if (!signupSession) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired signup session. Please start over.'
      });
    }

    // Check rate limiting (30 seconds between OTP requests)
    if (signupSession.lastOTPSentAt) {
      const timeSinceLastOTP = Date.now() - signupSession.lastOTPSentAt.getTime();
      if (timeSinceLastOTP < 30000) { // 30 seconds
        const waitTime = Math.ceil((30000 - timeSinceLastOTP) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${waitTime} seconds before requesting a new code.`
        });
      }
    }

    // Generate new OTP
    const newOtpCode = signupSession.generateSignupOTP();
    await signupSession.save();

    // Send new OTP via email
    try {
      await emailService.sendSignupOTPEmail(signupSession.email, {
        username: signupSession.username,
        otp: newOtpCode,
        expiresIn: '5 minutes'
      });

      logger.info(`Signup OTP resent to: ${signupSession.email}, Session ID: ${signupSession.sessionId}`);
    } catch (emailError) {
      logger.error('Failed to resend signup OTP email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email'
      });
    }

    res.json({
      success: true,
      message: 'New verification code sent to your email',
      expiresIn: 300 // 5 minutes in seconds
    });

  } catch (error) {
    logger.error('Error in resend-signup-otp:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
