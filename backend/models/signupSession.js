const mongoose = require('mongoose');
const crypto = require('crypto');

const signupSessionSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    lowercase: true
  },
  username: { 
    type: String, 
    required: true 
  },
  passwordHash: { 
    type: String, 
    required: true 
  },
  referralCode: { 
    type: String, 
    uppercase: true 
  },
  
  // OTP fields
  signupOTP: String,
  signupOTPExpiry: Date,
  signupOTPAttempts: { type: Number, default: 0 },
  lastOTPSentAt: Date,
  
  // Session tracking
  sessionId: { 
    type: String, 
    required: true, 
    unique: true,
    default: () => crypto.randomBytes(32).toString('hex')
  },
  
  // Auto-expire after 1 hour
  createdAt: { 
    type: Date, 
    default: Date.now, 
    expires: 3600 // 1 hour in seconds
  }
}, { 
  timestamps: true 
});

// Index for cleanup and fast lookups
signupSessionSchema.index({ email: 1 });

// Generate OTP method
signupSessionSchema.methods.generateSignupOTP = function() {
  const otpCode = crypto.randomInt(100000, 999999).toString();
  
  this.signupOTP = otpCode;
  this.signupOTPExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  this.signupOTPAttempts = 0;
  this.lastOTPSentAt = new Date();
  
  return otpCode;
};

// Verify OTP method
signupSessionSchema.methods.verifySignupOTP = function(inputOtp) {
  // Check if OTP exists
  if (!this.signupOTP) {
    return { success: false, message: 'No OTP found. Please request a new one.' };
  }
  
  // Check if OTP is expired
  if (new Date() > this.signupOTPExpiry) {
    return { success: false, message: 'OTP has expired. Please request a new one.' };
  }
  
  // Check attempt limit
  if (this.signupOTPAttempts >= 3) {
    return { success: false, message: 'Too many failed attempts. Please start over.' };
  }
  
  // Verify OTP code
  if (this.signupOTP !== inputOtp.toString()) {
    this.signupOTPAttempts += 1;
    const remainingAttempts = 3 - this.signupOTPAttempts;
    return { 
      success: false, 
      message: `Invalid OTP. ${remainingAttempts} attempts remaining.`,
      remainingAttempts: remainingAttempts
    };
  }
  
  // OTP is valid
  return { success: true, message: 'OTP verified successfully.' };
};

// Clear OTP method
signupSessionSchema.methods.clearSignupOTP = function() {
  this.signupOTP = undefined;
  this.signupOTPExpiry = undefined;
  this.signupOTPAttempts = 0;
  this.lastOTPSentAt = undefined;
};

// Check if OTP is valid
signupSessionSchema.methods.isSignupOTPValid = function() {
  return this.signupOTP && 
         this.signupOTPExpiry && 
         new Date() <= this.signupOTPExpiry &&
         this.signupOTPAttempts < 3;
};

// Get remaining time for OTP
signupSessionSchema.methods.getOTPTimeRemaining = function() {
  if (!this.signupOTPExpiry) return 0;
  
  const timeRemaining = this.signupOTPExpiry.getTime() - Date.now();
  return Math.max(0, Math.floor(timeRemaining / 1000)); // Return seconds
};

module.exports = mongoose.model('SignupSession', signupSessionSchema);
