import crypto from 'crypto';
import { HybridCrypto } from '../crypto/hybridCrypto.js';
import { Account } from '../models/Account.js';

/**
 * DemoService
 * Corresponds to DemoService.java in the Spring Boot project.
 *
 * Provides helpers for:
 * 1. Seeding default demo accounts into MongoDB.
 * 2. Simulating a sender phone creating an encrypted MeshPacket offline.
 */
class DemoService {
  /**
   * Seeds default demo accounts in MongoDB if empty.
   */
  async seedAccounts() {
    try {
      const count = await Account.countDocuments();
      if (count === 0) {
        await Account.create([
          { vpa: 'alice@demo', holderName: 'Alice', balance: 5000.0 },
          { vpa: 'bob@demo', holderName: 'Bob', balance: 1000.0 },
          { vpa: 'carol@demo', holderName: 'Carol', balance: 2500.0 },
          { vpa: 'dave@demo', holderName: 'Dave', balance: 500.0 },
        ]);
        console.log('[DemoService] Seeded 4 demo accounts into MongoDB');
      }
    } catch (err) {
      console.error('[DemoService] Error seeding accounts:', err.message);
    }
  }

  /**
   * Simulates the sender's phone creating an encrypted payment packet offline:
   * 1. Constructs PaymentInstruction with unique nonce and signedAt timestamp.
   * 2. Encrypts payload with server's RSA public key using hybrid encryption.
   * 3. Wraps ciphertext into MeshPacket with TTL.
   *
   * @param {string} senderVpa
   * @param {string} receiverVpa
   * @param {number} amount
   * @param {string} pin
   * @param {number} ttl
   * @returns {Object} MeshPacket { packetId, ttl, createdAt, ciphertext }
   */
  createPacket(senderVpa, receiverVpa, amount, pin, ttl = 5) {
    const pinHash = crypto.createHash('sha256').update(String(pin), 'utf8').digest('hex');

    const instruction = {
      senderVpa,
      receiverVpa,
      amount: Number(amount),
      pinHash,
      nonce: crypto.randomUUID(),
      signedAt: Date.now(),
    };

    const ciphertext = HybridCrypto.encrypt(instruction);

    return {
      packetId: crypto.randomUUID(),
      ttl: Number(ttl),
      createdAt: Date.now(),
      ciphertext,
    };
  }
}

// Export singleton instance
export const demoService = new DemoService();
