import { serverKeyHolder } from '../src/crypto/keyHolder.js';
import { HybridCrypto } from '../src/crypto/hybridCrypto.js';

async function runCryptoTests() {
  console.log('=== Running Cryptography Layer Tests ===\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Key generation and Base64 export
  try {
    const pubKeyBase64 = serverKeyHolder.getPublicKeyBase64();
    if (pubKeyBase64 && pubKeyBase64.length > 300) {
      console.log('✅ Test 1 Passed: RSA-2048 keypair generated successfully.');
      console.log(`   Public Key Fingerprint: ${pubKeyBase64.substring(0, 32)}...`);
      passed++;
    } else {
      throw new Error('Public key base64 length unexpected');
    }
  } catch (err) {
    console.error('❌ Test 1 Failed:', err.message);
    failed++;
  }

  // Test 2: Encrypt -> Decrypt Round Trip
  const sampleInstruction = {
    senderVpa: 'alice@demo',
    receiverVpa: 'bob@demo',
    amount: 500.00,
    pinHash: '1c8aff7e59b6623631f24d7764d8ebccf92dbefc26fa323f462a71bfb5a864d4',
    nonce: '550e8400-e29b-41d4-a716-446655440000',
    signedAt: Date.now()
  };

  let ciphertext = '';
  try {
    ciphertext = HybridCrypto.encrypt(sampleInstruction);
    const decrypted = HybridCrypto.decrypt(ciphertext);

    if (
      decrypted.senderVpa === sampleInstruction.senderVpa &&
      decrypted.receiverVpa === sampleInstruction.receiverVpa &&
      decrypted.amount === sampleInstruction.amount &&
      decrypted.nonce === sampleInstruction.nonce &&
      decrypted.signedAt === sampleInstruction.signedAt
    ) {
      console.log('\n✅ Test 2 Passed: Encrypt -> Decrypt round trip successful.');
      console.log(`   Original payload: ₹${decrypted.amount} from ${decrypted.senderVpa} to ${decrypted.receiverVpa}`);
      console.log(`   Ciphertext preview: ${ciphertext.substring(0, 48)}...`);
      passed++;
    } else {
      throw new Error('Decrypted payload does not match original instruction');
    }
  } catch (err) {
    console.error('\n❌ Test 2 Failed:', err.message);
    failed++;
  }

  // Test 3: Tampering causes decryption to fail (AES-GCM Auth Tag & RSA-OAEP)
  try {
    // 3a. Tamper specifically in the AES ciphertext portion (past 256 bytes RSA key + 12 bytes IV)
    const buf = Buffer.from(ciphertext, 'base64');
    const tamperedBuf = Buffer.from(buf);
    // Flip a byte in the AES payload
    tamperedBuf[256 + 12 + 2] ^= 0x01;
    const tamperedGcmCiphertext = tamperedBuf.toString('base64');

    let gcmRejected = false;
    try {
      HybridCrypto.decrypt(tamperedGcmCiphertext);
    } catch (gcmErr) {
      gcmRejected = true;
      console.log('\n✅ Test 3 Passed: Tampered AES payload rejected by AES-GCM authentication tag.');
      console.log(`   Expected security rejection: "${gcmErr.message}"`);
    }

    if (!gcmRejected) {
      throw new Error('AES-GCM tag verification did not catch payload tampering!');
    }
    passed++;
  } catch (err) {
    console.error('\n❌ Test 3 Failed:', err.message);
    failed++;
  }

  // Test 4: SHA-256 hash generation for idempotency key
  try {
    const hash = HybridCrypto.hashCiphertext(ciphertext);
    if (hash && hash.length === 64 && /^[a-f0-9]+$/i.test(hash)) {
      console.log('\n✅ Test 4 Passed: SHA-256 hash computed correctly.');
      console.log(`   Packet Hash (Idempotency Key): ${hash}`);
      passed++;
    } else {
      throw new Error(`Invalid SHA-256 hash: ${hash}`);
    }
  } catch (err) {
    console.error('\n❌ Test 4 Failed:', err.message);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`Tests Summary: ${passed} passed, ${failed} failed.`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runCryptoTests();
