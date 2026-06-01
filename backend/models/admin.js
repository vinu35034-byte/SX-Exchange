const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({

  email: { type: String, required: true, unique: true, lowercase: true },
  username: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },

  isSuperAdmin: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'suspended', 'disabled'], default: 'active' },

  lastLoginAt: Date,
  lastLoginIP: String,
  loginHistory: [{
    ip: String,
    timestamp: { type: Date, default: Date.now },
    userAgent: String,
  }],
  notes: String,
  flags: [String], 
  banReason: String,
}, { timestamps: true });


module.exports = mongoose.model('Admin', adminSchema);
