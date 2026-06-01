const mongoose = require("mongoose");
const Admin = require("../models/admin");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const { sessionManager } = require('../config/session');
const { createLogger } = require('../utils/logger');
const logger = createLogger('admin-auth');

// Validation Schemas — admin passwords require minimum 10 characters
const adminSignupSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20),
  password: z.string().min(10, 'Admin password must be at least 10 characters'),
});
const adminSigninSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
const resetPasswordSchema = z.object({
  targetAdminId: z.string().length(24),
  newPassword: z.string().min(10, 'Admin password must be at least 10 characters'),
});
const changeOwnPasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(10, 'Admin password must be at least 10 characters'),
});
const superAdminChangePasswordSchema = z.object({
  targetAdminId: z.string().length(24),
  newPassword: z.string().min(10, 'Admin password must be at least 10 characters'),
});

// SECURITY: In-memory failed login tracker for account lockout
const failedLoginAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function checkAccountLockout(email) {
  const record = failedLoginAttempts.get(email);
  if (!record) return false;
  if (Date.now() - record.lastAttempt > LOCKOUT_DURATION_MS) {
    failedLoginAttempts.delete(email);
    return false;
  }
  return record.count >= MAX_FAILED_ATTEMPTS;
}

function recordFailedLogin(email) {
  const record = failedLoginAttempts.get(email) || { count: 0, lastAttempt: 0 };
  record.count += 1;
  record.lastAttempt = Date.now();
  failedLoginAttempts.set(email, record);
}

function clearFailedLogins(email) {
  failedLoginAttempts.delete(email);
}

// Create Admin by Admin (only authenticated admins)
exports.createAdminByAdmin = async (req, res) => {
  try {
    const { email, username, password } = adminSignupSchema.parse(req.body);

    // Enhanced admin session validation
    if (!req.admin || !req.session?.admin) {
      logger.security('Unauthorized admin creation attempt', {
        sessionId: req.sessionID,
        attemptedBy: req.admin?._id?.toString(),
        timestamp: new Date().toISOString()
      });
      
      return res.status(401).json({ 
        message: "Not authenticated"
      });
    }

    // Log admin creation attempt
    logger.info('Admin creation attempt', {
      createdBy: req.admin._id.toString(),
      newAdminEmail: email,
      newAdminUsername: username,
      sessionId: req.sessionID,
      timestamp: new Date().toISOString()
    });

    const hashedPassword = await bcrypt.hash(password, 12);
    const newAdmin = new Admin({
      email,
      username,
      passwordHash: hashedPassword,
      isSuperAdmin: false
    });

    await newAdmin.save();

    // Log successful admin creation
    logger.info('New admin created successfully', {
      createdBy: req.admin._id.toString(),
      newAdminId: newAdmin._id.toString(),
      newAdminEmail: email,
      sessionId: req.sessionID,
      timestamp: new Date().toISOString()
    });

    res.status(201).json({ 
      message: "New admin created successfully"
    });
  } catch (err) {
    logger.error('Error creating admin', {
      error: err.message,
      createdBy: req.admin?._id?.toString(),
      sessionId: req.sessionID,
      stack: err.stack
    });
    
    const message = err?.errors?.[0]?.message || err.message;
    res.status(400).json({ message });
  }
};

// Admin Signin
exports.adminSignin = async (req, res) => {
  try {
    const { email, password } = adminSigninSchema.parse(req.body);

    // Log admin signin attempt
    logger.info('Admin signin attempt', {
      email,
      ipAddress: req.ip,
      timestamp: new Date().toISOString()
    });

    // SECURITY: Check account lockout before DB lookup
    if (checkAccountLockout(email)) {
      logger.security('Admin signin blocked - account locked', {
        email,
        ipAddress: req.ip,
        timestamp: new Date().toISOString()
      });
      return res.status(429).json({ 
        message: 'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.'
      });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      recordFailedLogin(email);
      logger.security('Admin signin failed - user not found', {
        email,
        ipAddress: req.ip,
        timestamp: new Date().toISOString()
      });
      return res.status(401).json({ 
        message: "Invalid credentials"
      });
    }

    // SECURITY: Check if admin account is active
    if (admin.status && admin.status !== 'active') {
      logger.security('Admin signin blocked - account suspended', {
        adminId: admin._id.toString(),
        status: admin.status,
        ipAddress: req.ip,
        timestamp: new Date().toISOString()
      });
      return res.status(403).json({ 
        message: 'Account suspended. Contact super admin.'
      });
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      recordFailedLogin(email);
      const record = failedLoginAttempts.get(email);
      logger.security('Admin signin failed - invalid password', {
        adminId: admin._id.toString(),
        email,
        failedAttempts: record?.count,
        ipAddress: req.ip,
        timestamp: new Date().toISOString()
      });
      return res.status(401).json({ 
        message: "Invalid credentials"
      });
    }

    // Clear failed attempts on successful login
    clearFailedLogins(email);

    // Update login details
    const loginDetails = {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      timestamp: new Date(),
    };

    admin.lastLoginAt = new Date();
    admin.lastLoginIP = req.ip;
    admin.loginHistory.push(loginDetails);
    await admin.save();

    // Create admin session instead of JWT
    try {
      await sessionManager.createAdminSession(req, admin);
      
      // Log successful admin signin
      logger.info('Admin signin successful', {
        adminId: admin._id.toString(),
        email: admin.email,
        ipAddress: req.ip,
        timestamp: new Date().toISOString()
      });
      
      res.status(200).json({
        message: "Admin signed in",
        admin: {
          id: admin._id,
          email: admin.email,
          username: admin.username,
          isSuperAdmin: admin.isSuperAdmin,
        },
      });
    } catch (sessionError) {
      console.error('Failed to create admin session:', sessionError);
      res.status(500).json({ 
        message: 'Login failed. Please try again.',
        code: 'ADMIN_SESSION_CREATION_FAILED'
      });
    }
  } catch (err) {
    const message = err?.errors?.[0]?.message || err.message;
    res.status(400).json({ message });
  }
};

// Admin Logout
exports.adminLogout = async (req, res) => {
  try {
    // Destroy admin session
    await sessionManager.destroyAdminSession(req);
    
    res.status(200).json({ 
      message: 'Admin logged out successfully',
      code: 'ADMIN_LOGOUT_SUCCESS'
    });
  } catch (error) {
    console.error('Admin logout error:', error);
    res.status(500).json({ 
      message: 'Logout failed. Please try again.',
      code: 'ADMIN_LOGOUT_FAILED'
    });
  }
};

// Admin changes own password (old password must match)
exports.changeOwnPassword = async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { oldPassword, newPassword } = changeOwnPasswordSchema.parse(
      req.body
    );

    const admin = await Admin.findById(req.admin._id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    const isMatch = await bcrypt.compare(oldPassword, admin.passwordHash);
    if (!isMatch)
      return res.status(400).json({ message: "Old password is incorrect" });

    admin.passwordHash = await bcrypt.hash(newPassword, 12);
    await admin.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (err) {
    const message = err?.errors?.[0]?.message || err.message;
    res.status(400).json({ message });
  }
};

// Superadmin resets password of any admin (or self)
exports.resetAdminPassword = async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { targetAdminId, newPassword } = resetPasswordSchema.parse(req.body);

    if (!mongoose.Types.ObjectId.isValid(targetAdminId)) {
      return res.status(400).json({ message: "Invalid admin ID" });
    }

    const isSelf = targetAdminId === req.admin._id.toString();
    const isSuper = req.admin.isSuperAdmin;

    if (!isSelf && !isSuper) {
      return res
        .status(403)
        .json({ message: "Only superadmin can reset other admins' passwords" });
    }

    const targetAdmin = await Admin.findById(targetAdminId);
    if (!targetAdmin)
      return res.status(404).json({ message: "Target admin not found" });

    targetAdmin.passwordHash = await bcrypt.hash(newPassword, 12);
    await targetAdmin.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (err) {
    const message = err?.errors?.[0]?.message || err.message;
    res.status(400).json({ message });
  }
};

// Superadmin changes password of any admin (alias for resetAdminPassword)
exports.superAdminChangePassword = async (req, res) => {
  try {
    if (!req.admin?.isSuperAdmin) {
      return res
        .status(403)
        .json({ message: "Only superadmin can change other admin passwords" });
    }

    const { targetAdminId, newPassword } = superAdminChangePasswordSchema.parse(
      req.body
    );

    if (!mongoose.Types.ObjectId.isValid(targetAdminId)) {
      return res.status(400).json({ message: "Invalid admin ID" });
    }

    const targetAdmin = await Admin.findById(targetAdminId);
    if (!targetAdmin)
      return res.status(404).json({ message: "Target admin not found" });

    targetAdmin.passwordHash = await bcrypt.hash(newPassword, 12);
    await targetAdmin.save();

    res
      .status(200)
      .json({ message: "Target admin password updated successfully" });
  } catch (err) {
    const message = err?.errors?.[0]?.message || err.message;
    res.status(400).json({ message });
  }
};

// Superadmin deletes any admin (except self)
exports.deleteAdminBySuperAdmin = async (req, res) => {
  try {
    if (!req.admin?.isSuperAdmin) {
      return res
        .status(403)
        .json({
          message: "Access denied. Only super admins can delete admins.",
        });
    }

    const targetAdminId = req.params.adminId;

    if (!mongoose.Types.ObjectId.isValid(targetAdminId)) {
      return res.status(400).json({ message: "Invalid admin ID." });
    }

    if (req.admin._id.toString() === targetAdminId) {
      return res.status(400).json({ message: "You cannot delete yourself." });
    }

    const deletedAdmin = await Admin.findByIdAndDelete(targetAdminId);
    if (!deletedAdmin) {
      return res.status(404).json({ message: "Admin not found." });
    }

    res.status(200).json({ message: "Admin deleted successfully." });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to delete admin.", error: err.message });
  }
};
