const mongoose = require('mongoose');

const depositQRCodeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  depositAddressId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DepositAddress',
    required: true
  },
  network: {
    type: String,
    required: true,
    enum: ['BEP20', 'TRC20']
  },
  address: {
    type: String,
    required: true,
    index: true
  },
  
  // QR Code Information
  qrCodeData: {
    type: String,
    required: true // Base64 encoded QR code image or URL
  },
  qrCodeFormat: {
    type: String,
    enum: ['base64', 'url', 'svg'],
    default: 'base64'
  },
  qrCodeSize: {
    type: Number,
    default: 256 // Size in pixels
  },
  
  // QR Code Content
  qrContent: {
    type: String,
    required: true // The actual content encoded in the QR (usually the address)
  },
  qrType: {
    type: String,
    enum: ['address_only', 'uri_scheme'], // address_only: just address, uri_scheme: coin:address?amount=...
    default: 'address_only'
  },
  
  // Metadata
  generatedAt: {
    type: Date,
    default: Date.now
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  },
  accessCount: {
    type: Number,
    default: 0
  },
  
  // Storage Information
  filePath: {
    type: String // If stored as file on server
  },
  fileSize: {
    type: Number // Size in bytes
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Expires in 7 days
  }

}, {
  timestamps: true
});

// Indexes for efficient queries
depositQRCodeSchema.index({ userId: 1, network: 1 });
depositQRCodeSchema.index({ address: 1 });
depositQRCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Virtual for QR code URL (if stored as file)
depositQRCodeSchema.virtual('qrCodeUrl').get(function() {
  if (this.qrCodeFormat === 'url' && this.filePath) {
    return `/uploads/qr-codes/${this.filePath}`;
  }
  return null;
});

// Virtual for full QR code data URL (for base64)
depositQRCodeSchema.virtual('qrCodeDataUrl').get(function() {
  if (this.qrCodeFormat === 'base64' && this.qrCodeData) {
    return `data:image/png;base64,${this.qrCodeData}`;
  }
  return this.qrCodeData;
});

// Static method to find or create QR code for address
depositQRCodeSchema.statics.findOrCreateForAddress = async function(userId, depositAddressId, address, network) {
  // First, try to find existing valid QR code
  let qrCode = await this.findOne({
    userId,
    address,
    network,
    isActive: true,
    expiresAt: { $gt: new Date() }
  });
  
  if (qrCode) {
    // Update access information
    qrCode.lastAccessedAt = new Date();
    qrCode.accessCount += 1;
    await qrCode.save();
    return qrCode;
  }
  
  // If no valid QR code found, we'll return null and let the controller generate a new one
  return null;
};

// Instance method to update access tracking
depositQRCodeSchema.methods.trackAccess = async function() {
  this.lastAccessedAt = new Date();
  this.accessCount += 1;
  return await this.save();
};

// Instance method to check if QR code is still valid
depositQRCodeSchema.methods.isValid = function() {
  return this.isActive && this.expiresAt > new Date();
};

// Instance method to deactivate QR code
depositQRCodeSchema.methods.deactivate = async function() {
  this.isActive = false;
  return await this.save();
};

// Pre-save middleware to set QR content
depositQRCodeSchema.pre('save', function(next) {
  if (!this.qrContent && this.address) {
    if (this.qrType === 'uri_scheme') {
      // Create URI scheme like: tron:address or binance:address
      const scheme = this.network === 'TRC20' ? 'tron' : 'binance';
      this.qrContent = `${scheme}:${this.address}`;
    } else {
      // Just the address
      this.qrContent = this.address;
    }
  }
  next();
});

// Static method to cleanup expired QR codes
depositQRCodeSchema.statics.cleanupExpired = async function() {
  const result = await this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { isActive: false }
    ]
  });
  return result.deletedCount;
};

module.exports = mongoose.model('DepositQRCode', depositQRCodeSchema);
