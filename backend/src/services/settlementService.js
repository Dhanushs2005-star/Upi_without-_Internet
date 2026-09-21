import { Account } from '../models/Account.js';
import { Transaction } from '../models/Transaction.js';

/**
 * SettlementService
 * Corresponds to SettlementService.java in the Spring Boot project.
 *
 * Handles atomic balance transfer and ledger creation.
 * Uses atomic MongoDB operations ($inc with balance >= amount conditional checks)
 * to prevent double spending, lost updates, and overdrafts.
 */
class SettlementService {
  /**
   * Settle a decrypted payment instruction.
   *
   * @param {Object} instruction - { senderVpa, receiverVpa, amount, signedAt, ... }
   * @param {string} packetHash - SHA-256 hex of the ciphertext (unique index)
   * @param {string} bridgeNodeId - ID of device that uploaded packet
   * @param {number} hopCount - Number of hops traversed
   * @returns {Promise<Object>} The created Transaction document
   */
  async settle(instruction, packetHash, bridgeNodeId = 'unknown', hopCount = 0) {
    const senderVpa = instruction.senderVpa.toLowerCase().trim();
    const receiverVpa = instruction.receiverVpa.toLowerCase().trim();
    const amount = Number(instruction.amount);

    if (isNaN(amount) || amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const sender = await Account.findOne({ vpa: senderVpa });
    if (!sender) {
      throw new Error(`Unknown sender VPA: ${senderVpa}`);
    }

    const receiver = await Account.findOne({ vpa: receiverVpa });
    if (!receiver) {
      throw new Error(`Unknown receiver VPA: ${receiverVpa}`);
    }

    // Atomic conditional debit: only succeeds if balance >= amount
    const debitedSender = await Account.findOneAndUpdate(
      { vpa: senderVpa, balance: { $gte: amount } },
      { $inc: { balance: -amount, version: 1 } },
      { new: true }
    );

    // If condition failed, sender has insufficient funds
    if (!debitedSender) {
      console.warn(
        `[SettlementService] Insufficient balance: ${senderVpa} has ₹${sender.balance}, tried to send ₹${amount}`
      );
      return this.recordTransaction(
        instruction,
        packetHash,
        bridgeNodeId,
        hopCount,
        'REJECTED'
      );
    }

    // Credit receiver atomically
    await Account.findOneAndUpdate(
      { vpa: receiverVpa },
      { $inc: { balance: amount, version: 1 } },
      { new: true }
    );

    // Record settled transaction in ledger
    try {
      const tx = await this.recordTransaction(
        instruction,
        packetHash,
        bridgeNodeId,
        hopCount,
        'SETTLED'
      );

      console.log(
        `[SettlementService] SETTLED ₹${amount} from ${senderVpa} to ${receiverVpa} ` +
          `(packetHash=${packetHash.substring(0, 12)}..., bridge=${bridgeNodeId}, hops=${hopCount})`
      );

      return tx;
    } catch (dbErr) {
      // If packetHash already exists in DB (unique index fallback), rollback balances
      if (dbErr.code === 11000) {
        console.error(`[SettlementService] Unique constraint violation on packetHash: ${packetHash}`);
        await Account.findOneAndUpdate({ vpa: senderVpa }, { $inc: { balance: amount, version: 1 } });
        await Account.findOneAndUpdate({ vpa: receiverVpa }, { $inc: { balance: -amount, version: 1 } });
        throw new Error('Duplicate packetHash detected at database level');
      }
      throw dbErr;
    }
  }

  async recordTransaction(instruction, packetHash, bridgeNodeId, hopCount, status) {
    return Transaction.create({
      packetHash,
      senderVpa: instruction.senderVpa.toLowerCase().trim(),
      receiverVpa: instruction.receiverVpa.toLowerCase().trim(),
      amount: Number(instruction.amount),
      signedAt: new Date(Number(instruction.signedAt)),
      settledAt: new Date(),
      bridgeNodeId,
      hopCount,
      status,
    });
  }
}

// Export singleton instance
export const settlementService = new SettlementService();
