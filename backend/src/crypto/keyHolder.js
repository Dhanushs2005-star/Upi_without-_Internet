import crypto from 'crypto';

/**
 * ServerKeyHolder
 * Corresponds to ServerKeyHolder.java in the Spring Boot project.
 * Holds the server's RSA-2048 keypair generated on startup.
 * The public key is exposed so simulated sender devices can encrypt payloads.
 */
class ServerKeyHolder {
  constructor() {
    this.publicKey = null;
    this.privateKey = null;
    this.init();
  }

  init() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    this.publicKey = publicKey;
    this.privateKey = privateKey;

    const base64Pub = this.getPublicKeyBase64();
    console.log(
      `[Crypto] Server RSA keypair generated (2048-bit). Public key fingerprint: ${base64Pub.substring(0, 32)}...`
    );
  }

  getPublicKey() {
    return this.publicKey;
  }

  getPrivateKey() {
    return this.privateKey;
  }

  /**
   * Returns base64 encoded X.509 SPKI DER, identical to Java's keyPair.getPublic().getEncoded()
   */
  getPublicKeyBase64() {
    return this.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  }

  /**
   * Returns PEM format string of public key
   */
  getPublicKeyPem() {
    return this.publicKey.export({ type: 'spki', format: 'pem' });
  }
}

// Export singleton instance
export const serverKeyHolder = new ServerKeyHolder();
