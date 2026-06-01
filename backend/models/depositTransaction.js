const mongoose = require('mongoose');

const depositTransactionSchema = new mongoose.Schema({
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
  txHash: {
    type: String,
    sparse: true,
    index: true
  },
  fromAddress: { 
    type: String 
  },
  toAddress: { 
    type: String, 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  currency: { 
    type: String, 
    required: true,
    default: 'USDT'
  },
  usdValue: { 
    type: Number, 
    required: true
  },
  confirmations: { 
    type: Number, 
    default: 0 
  },
  requiredConfirmations: { 
    type: Number, 
    default: 12 // BEP20: 12, TRC20: 19 (can be adjusted)
  },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'failed', 'credited', 'submitted', 'approved', 'rejected'], 
    default: 'pending',
    index: true 
  },
  blockNumber: { 
    type: Number 
  },
  blockHash: { 
    type: String 
  },
  gasUsed: { 
    type: Number 
  },
  gasPrice: { 
    type: String 
  },
  fee: { 
    type: Number, 
    default: 0 
  },
  creditedAt: { 
    type: Date 
  },
  creditedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Admin' 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Admin' 
  },
  confirmedAt: { 
    type: Date 
  },
  sweptTxHash: { 
    type: String 
  },
  sweptAt: { 
    type: Date 
  },
  isSwept: { 
    type: Boolean, 
    default: false 
  },
  notes: { 
    type: String 
  },
  // Manual verification fields
  submittedAt: {
    type: Date
  },
  approvedAt: {
    type: Date
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  rejectedAt: {
    type: Date
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  rejectionReason: {
    type: String
  },
  confirmedAmount: {
    type: Number
  }
}, { 
  timestamps: true,
  indexes: [
    { userId: 1, status: 1 },
    { txHash: 1 },
    { status: 1, network: 1 },
    { createdAt: -1 }
  ]
});

module.exports = mongoose.model('DepositTransaction', depositTransactionSchema);
