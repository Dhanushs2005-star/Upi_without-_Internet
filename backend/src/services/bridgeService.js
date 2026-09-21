import { HybridCrypto } from '../crypto/hybridCrypto.js';
import { idempotencyService } from './idempotencyService.js';
import { settlementService } from './settlementService.js';

/**
 * BridgeService
 * Corresponds to BridgeIngestionService.java in the Spring Boot project.
 *
 * Orchestrates the full backend ingestion pipeline for an inbound mesh packet from a bridge node:
 *   1. Hash the ciphertext (SHA-256).
 *   2. Atomic idempotency claim: if already claimed, drop as duplicate.
 *   3. Decrypt ciphertext: if authentication fails or corrupted, return INVALID.
 *   4. Freshness check: reject if signedAt is stale (replay protection) or future-dated.
 *   5. Atomic settlement: balance verification, debit/credit, and ledger entry.
 */
class BridgeService {
  constructor() {
    this.maxAgeSeconds = parseInt(process.env.PACKET_MAX_AGE_SECONDS || '86400', 10);
  }

  /**
   * Ingest an inbound MeshPacket from a bridge node.
   *
   * @param {Object} packet - { packetId, ttl, createdAt, ciphertext }
   * @param {string} bridgeNodeId - Bridge node device ID
   * @param {number} hopCount - Number of hops packet traversed
   * @returns {Promise<Object>} { outcome, packetHash, reason, transactionId }
   */
  async ingest(packet, bridgeNodeId = 'unknown', hopCount = 0) {
    if (!packet || !packet.ciphertext) {
      return {
        outcome: 'INVALID',
        packetHash: null,
        reason: 'missing_ciphertext',
        transactionId: null,
      };
    }

    try {
      // 1. Hash ciphertext (SHA-256) — Outer packetId is untrusted
      const packetHash = HybridCrypto.hashCiphertext(packet.ciphertext);

      // 2. Idempotency Gate — Atomic compare-and-set
      if (!idempotencyService.claim(packetHash)) {
        console.log(
          `[BridgeService] DUPLICATE packet ${packetHash.substring(0, 12)}... from bridge ${bridgeNodeId} dropped`
        );
        return {
          outcome: 'DUPLICATE_DROPPED',
          packetHash,
          reason: 'duplicate_packet',
          transactionId: null,
        };
      }

      // 3. Decrypt with Server's Private Key
      let instruction;
      try {
        instruction = HybridCrypto.decrypt(packet.ciphertext);
      } catch (e) {
        console.warn(
          `[BridgeService] Decryption failed for packet ${packetHash.substring(0, 12)}...: ${e.message}`
        );
        return {
          outcome: 'INVALID',
          packetHash,
          reason: 'decryption_failed',
          transactionId: null,
        };
      }

      // 4. Freshness Check (Replay Protection)
      const now = Date.now();
      const signedAt = Number(instruction.signedAt);
      const ageSeconds = (now - signedAt) / 1000;

      if (ageSeconds > this.maxAgeSeconds) {
        console.warn(
          `[BridgeService] Stale packet ${packetHash.substring(0, 12)}... (age ${ageSeconds.toFixed(1)}s), rejected`
        );
        return {
          outcome: 'INVALID',
          packetHash,
          reason: 'stale_packet',
          transactionId: null,
        };
      }

      if (ageSeconds < -300) {
        // Clock skew tolerance: >5 minutes in the future
        console.warn(`[BridgeService] Future-dated packet ${packetHash.substring(0, 12)}..., rejected`);
        return {
          outcome: 'INVALID',
          packetHash,
          reason: 'future_dated',
          transactionId: null,
        };
      }

      // 5. Atomic Settlement
      const tx = await settlementService.settle(instruction, packetHash, bridgeNodeId, hopCount);

      return {
        outcome: tx.status, // 'SETTLED' or 'REJECTED'
        packetHash,
        reason: tx.status === 'REJECTED' ? 'insufficient_balance' : null,
        transactionId: tx._id,
      };
    } catch (err) {
      console.error('[BridgeService] Unexpected ingestion error:', err.message);
      return {
        outcome: 'INVALID',
        packetHash: null,
        reason: 'internal_error: ' + err.message,
        transactionId: null,
      };
    }
  }
}

// Export singleton instance
export const bridgeService = new BridgeService();
