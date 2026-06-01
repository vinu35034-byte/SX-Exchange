const mongoose = require('mongoose');

const depositAddressSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  network: { 
    type: String, 
    required: true, 
    enum: ['BEP20', 'TRC20'],
    index: true 
  },
  address: { 
    type: String, 
    required: true, 
    index: true 
  },
  privateKey: { 
    type: String, 
    required: false // Optional for static TRC20 addresses
  },
  derivationPath: { 
    type: String, 
    required: false // Optional for static TRC20 addresses
  },
  addressIndex: { 
    type: Number, 
    required: false // Optional for static TRC20 addresses
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  lastChecked: { 
    type: Date, 
    default: Date.now 
  },
  totalDeposited: { 
    type: Number, 
    default: 0 
  },
  isSwept: { 
    type: Boolean, 
    default: false 
  }
}, { 
  timestamps: true,
  indexes: [
    { userId: 1, network: 1 },
    { address: 1 },
    { isActive: 1, isSwept: 1 }
  ]
});

// Compound index for efficient queries
depositAddressSchema.index({ userId: 1, network: 1 }, { unique: true });

module.exports = mongoose.model('DepositAddress', depositAddressSchema);
