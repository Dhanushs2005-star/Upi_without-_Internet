import mongoose from 'mongoose';

/**
 * Transaction Schema
 * Corresponds to Transaction.java in the Spring Boot project.
 * Permanent record of every settled/rejected transaction.
 * packetHash is the idempotency key with a unique index enforced at the DB level.
 */
const transactionSchema = new mongoose.Schema(
  {
    packetHash: {
      type: String,
      required: true,
      unique: true,
      length: 64,
      index: true
    },
    senderVpa: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    receiverVpa: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    signedAt: {
      type: Date,
      required: true
    },
    settledAt: {
      type: Date,
      default: Date.now
    },
    bridgeNodeId: {
      type: String,
      required: true,
      default: 'unknown'
    },
    hopCount: {
      type: Number,
      required: true,
      default: 0
    },
    status: {
      type: String,
      enum: ['SETTLED', 'REJECTED'],
      required: true,
      default: 'SETTLED'
    }
  },
  {
    timestamps: true
  }
);

export const Transaction = mongoose.model('Transaction', transactionSchema);
