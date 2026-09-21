import mongoose from 'mongoose';

/**
 * Account Schema
 * Corresponds to Account.java in the Spring Boot project.
 * Represents a simulated bank account holding VPA, name, balance, and optimistic locking version.
 */
const accountSchema = new mongoose.Schema(
  {
    vpa: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    holderName: {
      type: String,
      required: true,
      trim: true
    },
    balance: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    version: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    versionKey: 'version'
  }
);

export const Account = mongoose.model('Account', accountSchema);
