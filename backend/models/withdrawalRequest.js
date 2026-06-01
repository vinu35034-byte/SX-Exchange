const mongoose = require('mongoose');

const withdrawalRequestSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  network: { 
    type: String, 
    required: true, 
    enum: ['BEP20', 'TRC20'] 
  },
  amount: { 
    type: Number, 
    required: true,
    min: 25 // Minimum withdrawal amount
  },
  withdrawalAddress: { 
    type: String, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'processing', 'completed', 'failed'], 
    default: 'pending',
    index: true 
  },
  txHash: { 
    type: String, 
    sparse: true // Only set when transaction is sent
  },
  fee: { 
    type: Number, 
    default: 0 
  },
  netAmount: { 
    type: Number, 
    required: true // Amount after fees
  },
  rejectionReason: { 
    type: String 
  },
  processedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Admin' 
  },
  processedAt: { 
    type: Date 
  },
  completedAt: { 
    type: Date 
  },
  notes: { 
    type: String 
  }
}, { 
  timestamps: true,
  indexes: [
    { userId: 1, status: 1 },
    { status: 1, createdAt: -1 },
    { network: 1, status: 1 }
  ]
});

// Calculate net amount after fees before saving
withdrawalRequestSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('amount') || this.isModified('fee')) {
    this.netAmount = this.amount - this.fee;
  }
  next();
});

module.exports = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);
  