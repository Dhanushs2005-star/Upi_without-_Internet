import crypto from 'crypto';
import { serverKeyHolder } from './keyHolder.js';

/**
 * HybridCrypto
 * Corresponds to HybridCryptoService.java in the Spring Boot project.
 *
 * Implements hybrid encryption:
 * 1. Generates ephemeral AES-256 key per packet.
 * 2. Encrypts JSON payload with AES-256-GCM (12-byte IV, 16-byte auth tag).
 * 3. Encrypts AES key with RSA-OAEP (SHA-256) using server's public key.
 * 4. Packs into wire format:
 *    [ 256 bytes RSA encrypted key ][ 12 bytes IV ][ AES ciphertext + 16-byte tag ]
 *    and encodes as Base64.
 *
 * Any tampering with the ciphertext causes AES-GCM tag verification to fail during decryption.
 */
export class HybridCrypto {
  static RSA_ENCRYPTED_KEY_BYTES = 256; // 2048-bit RSA key produces 256-byte ciphertext
  static GCM_IV_BYTES = 12;
  static GCM_TAG_BYTES = 16;
  static MIN_CIPHERTEXT_BYTES = 256 + 12 + 16; // 284 bytes minimum

  /**
   * Encrypt a payment instruction object with the server's public key.
   * @param {Object} instruction - The payment instruction (senderVpa, receiverVpa, amount, etc.)
   * @param {crypto.KeyObject} [serverPublicKey] - Optional custom public key, defaults to serverKeyHolder
   * @returns {string} base64-encoded hybrid ciphertext
   */
  static encrypt(instruction, serverPublicKey = null) {
    const pubKey = serverPublicKey || serverKeyHolder.getPublicKey();
    const plaintext = Buffer.from(JSON.stringify(instruction), 'utf8');

    // 1. Generate one-time 256-bit (32-byte) AES key
    const aesKey = crypto.randomBytes(32);

    // 2. Encrypt payload with AES-256-GCM
    const iv = crypto.randomBytes(this.GCM_IV_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
    const aesCiphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // 3. Encrypt AES key using RSA-OAEP with SHA-256
    const encryptedAesKey = crypto.publicEncrypt(
      {
        key: pubKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      aesKey
    );

    // 4. Pack: [256-byte encrypted key][12-byte IV][AES ciphertext][16-byte tag]
    const packed = Buffer.concat([encryptedAesKey, iv, aesCiphertext, authTag]);
    return packed.toString('base64');
  }

  /**
   * Decrypt hybrid ciphertext with server's private key.
   * If any bit is tampered with, GCM tag verification or RSA decryption will throw.
   * @param {string} base64Ciphertext
   * @param {crypto.KeyObject} [serverPrivateKey] - Optional custom private key, defaults to serverKeyHolder
   * @returns {Object} Decrypted payment instruction
   */
  static decrypt(base64Ciphertext, serverPrivateKey = null) {
    const privKey = serverPrivateKey || serverKeyHolder.getPrivateKey();
    const all = Buffer.from(base64Ciphertext, 'base64');

    if (all.length < this.MIN_CIPHERTEXT_BYTES) {
      throw new Error(`Ciphertext too short (${all.length} bytes; minimum is ${this.MIN_CIPHERTEXT_BYTES} bytes)`);
    }

    // Unpack fields
    const encryptedAesKey = all.subarray(0, this.RSA_ENCRYPTED_KEY_BYTES);
    const iv = all.subarray(this.RSA_ENCRYPTED_KEY_BYTES, this.RSA_ENCRYPTED_KEY_BYTES + this.GCM_IV_BYTES);
    const aesCiphertextWithTag = all.subarray(this.RSA_ENCRYPTED_KEY_BYTES + this.GCM_IV_BYTES);

    const authTag = aesCiphertextWithTag.subarray(aesCiphertextWithTag.length - this.GCM_TAG_BYTES);
    const aesCiphertext = aesCiphertextWithTag.subarray(0, aesCiphertextWithTag.length - this.GCM_TAG_BYTES);

    // 1. RSA-decrypt the AES key
    const aesKey = crypto.privateDecrypt(
      {
        key: privKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      encryptedAesKey
    );

    // 2. AES-GCM decrypt payload and verify tag
    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(aesCiphertext), decipher.final()]);

    return JSON.parse(plaintext.toString('utf8'));
  }

  /**
   * Compute SHA-256 hex digest of the base64 ciphertext.
   * Used as the idempotency key.
   * @param {string} base64Ciphertext
   * @returns {string} 64-character hex string
   */
  static hashCiphertext(base64Ciphertext) {
    return crypto.createHash('sha256').update(base64Ciphertext, 'utf8').digest('hex');
  }
}
