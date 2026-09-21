/**
 * IdempotencyService
 * Corresponds to IdempotencyService.java in the Spring Boot project.
 *
 * In-memory idempotency cache preventing duplicate packet processing.
 * In a production distributed setup, this is equivalent to Redis SETNX with TTL.
 *
 * The contract:
 *   - claim(hash) returns true on the first call, false on every subsequent call
 *     (within the TTL window).
 *   - Any duplicate arrivals (e.g. multiple bridge nodes uploading the same packet)
 *     are immediately identified and dropped.
 */
class IdempotencyService {
  constructor(ttlSeconds = 86400) {
    this.seen = new Map(); // packetHash -> timestampMs
    this.ttlMs = ttlSeconds * 1000;

    // Periodic cleanup every 60 seconds
    this.cleanupInterval = setInterval(() => this.evictExpired(), 60_000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref(); // don't prevent Node process from exiting
    }
  }

  /**
   * Try to claim a hash.
   * @param {string} packetHash - SHA-256 of the ciphertext
   * @returns {boolean} true if first claimer, false if duplicate
   */
  claim(packetHash) {
    if (!packetHash) return false;
    
    const now = Date.now();
    const existing = this.seen.get(packetHash);

    // If already seen and not expired, reject as duplicate
    if (existing && now - existing < this.ttlMs) {
      return false;
    }

    // Atomic claim in Node.js event loop
    this.seen.set(packetHash, now);
    return true;
  }

  /**
   * Check if a hash has already been claimed
   */
  has(packetHash) {
    const existing = this.seen.get(packetHash);
    if (!existing) return false;
    if (Date.now() - existing >= this.ttlMs) {
      this.seen.delete(packetHash);
      return false;
    }
    return true;
  }

  size() {
    return this.seen.size;
  }

  evictExpired() {
    const cutoff = Date.now() - this.ttlMs;
    for (const [hash, timestamp] of this.seen.entries()) {
      if (timestamp < cutoff) {
        this.seen.delete(hash);
      }
    }
  }

  clear() {
    this.seen.clear();
  }
}

// Export singleton instance
const ttlSeconds = parseInt(process.env.IDEMPOTENCY_TTL_SECONDS || '86400', 10);
export const idempotencyService = new IdempotencyService(ttlSeconds);
