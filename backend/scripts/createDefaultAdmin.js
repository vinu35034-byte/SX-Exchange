const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('../models/admin');
const { createLogger } = require('../utils/logger');
require('dotenv').config();

const logger = createLogger('admin-setup');

async function createDefaultAdmin() {
  const email = 'admin@gmail.com';
  const username = 'superadmin';
  const password = 'Admin@123';

  try {
    logger.info('Creating default admin account', {
      email,
      username,
      timestamp: new Date().toISOString()
    });

    const existing = await Admin.findOne({ email });
    if (existing) {
      logger.info('Default admin already exists', {
        email,
        existingId: existing._id.toString(),
        timestamp: new Date().toISOString()
      });
      console.log('Default admin already exists.');
      return;                                 
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const admin = new Admin({
      email,
      username,
      passwordHash: hashedPassword,
      isSuperAdmin: true
    });

    await admin.save();
    
    logger.info('Default admin created successfully', {
      adminId: admin._id.toString(),
      email,
      username,
      timestamp: new Date().toISOString()
    });
    
    console.log('Default admin created.');
  } catch (error) {
    logger.error('Error creating default admin:', {
      error: error.message,
      email,
      username,
      stack: error.stack
    });
    throw error;
  }
}

module.exports = createDefaultAdmin;