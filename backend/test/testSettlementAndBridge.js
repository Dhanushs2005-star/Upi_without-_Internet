import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../src/config/db.js';
import { Account } from '../src/models/Account.js';
import { Transaction } from '../src/models/Transaction.js';
import { demoService } from '../src/services/demoService.js';
import { bridgeService } from '../src/services/bridgeService.js';
import { idempotencyService } from '../src/services/idempotencyService.js';
import { HybridCrypto } from '../src/crypto/hybridCrypto.js';

dotenv.config();

async function runSettlementTests() {
  console.log('=== Running Settlement & Bridge Ingestion Tests ===\n');

  await connectDB();

  // Reset database state for clean test run
  await Account.deleteMany({});
  await Transaction.deleteMany({});
  idempotencyService.clear();

  // Seed demo accounts: Alice: 5000, Bob: 1000, Carol: 2500, Dave: 500
  await demoService.seedAccounts();

  let passed = 0;
  let failed = 0;

  // Test 1: Successful payment
  try {
    const aliceBefore = await Account.findOne({ vpa: 'alice@demo' });
    const bobBefore = await Account.findOne({ vpa: 'bob@demo' });

    const packet = demoService.createPacket('alice@demo', 'bob@demo', 200.0, '1234', 5);
    const result = await bridgeService.ingest(packet, 'phone-bridge', 2);

    const aliceAfter = await Account.findOne({ vpa: 'alice@demo' });
    const bobAfter = await Account.findOne({ vpa: 'bob@demo' });

    if (
      result.outcome === 'SETTLED' &&
      aliceAfter.balance === aliceBefore.balance - 200 &&
      bobAfter.balance === bobBefore.balance + 200
    ) {
      console.log('✅ Test 1 Passed: Successful payment settled correctly.');
      console.log(`   Alice balance: ₹${aliceBefore.balance} -> ₹${aliceAfter.balance}`);
      console.log(`   Bob balance: ₹${bobBefore.balance} -> ₹${bobAfter.balance}`);
      console.log(`   Transaction ID: ${result.transactionId}`);
      passed++;
    } else {
      throw new Error(`Payment failed to settle: ${JSON.stringify(result)}`);
    }
  } catch (err) {
    console.error('❌ Test 1 Failed:', err.message);
    failed++;
  }

  // Test 2: Insufficient balance
  try {
    const daveBefore = await Account.findOne({ vpa: 'dave@demo' }); // Dave has ₹500
    const packet = demoService.createPacket('dave@demo', 'carol@demo', 5000.0, '1234', 5);
    const result = await bridgeService.ingest(packet, 'phone-bridge', 1);

    const daveAfter = await Account.findOne({ vpa: 'dave@demo' });

    if (
      result.outcome === 'REJECTED' &&
      result.reason === 'insufficient_balance' &&
      daveAfter.balance === daveBefore.balance
    ) {
      console.log('\n✅ Test 2 Passed: Insufficient balance properly rejected without altering balances.');
      console.log(`   Dave attempted ₹5000 with balance ₹${daveBefore.balance}. Outcome: ${result.outcome} (${result.reason})`);
      passed++;
    } else {
      throw new Error(`Insufficient balance test failed: ${JSON.stringify(result)}`);
    }
  } catch (err) {
    console.error('\n❌ Test 2 Failed:', err.message);
    failed++;
  }

  // Test 3: Invalid/tampered packet
  try {
    const packet = demoService.createPacket('alice@demo', 'bob@demo', 100.0, '1234', 5);
    // Tamper with ciphertext by flipping bits in the AES payload
    const buf = Buffer.from(packet.ciphertext, 'base64');
    buf[270] ^= 0x01;
    packet.ciphertext = buf.toString('base64');

    const result = await bridgeService.ingest(packet, 'phone-bridge', 3);

    if (result.outcome === 'INVALID' && result.reason.includes('decryption_failed')) {
      console.log('\n✅ Test 3 Passed: Tampered packet rejected as INVALID by decryption/auth-tag.');
      console.log(`   Outcome: ${result.outcome} | Reason: ${result.reason}`);
      passed++;
    } else {
      throw new Error(`Tampered packet test failed: ${JSON.stringify(result)}`);
    }
  } catch (err) {
    console.error('\n❌ Test 3 Failed:', err.message);
    failed++;
  }

  // Test 4: Expired packet (older than 24 hours)
  try {
    const expiredSignedAt = Date.now() - (90000 * 1000); // 25 hours ago
    const instruction = {
      senderVpa: 'alice@demo',
      receiverVpa: 'bob@demo',
      amount: 50.0,
      pinHash: 'dummy',
      nonce: 'expired-nonce-1234',
      signedAt: expiredSignedAt
    };
    const ciphertext = HybridCrypto.encrypt(instruction);
    const packet = {
      packetId: 'expired-pkt-1',
      ttl: 2,
      createdAt: expiredSignedAt,
      ciphertext
    };

    const result = await bridgeService.ingest(packet, 'phone-bridge', 2);

    if (result.outcome === 'INVALID' && result.reason === 'stale_packet') {
      console.log('\n✅ Test 4 Passed: Expired packet caught by freshness check.');
      console.log(`   Outcome: ${result.outcome} | Reason: ${result.reason}`);
      passed++;
    } else {
      throw new Error(`Expired packet test failed: ${JSON.stringify(result)}`);
    }
  } catch (err) {
    console.error('\n❌ Test 4 Failed:', err.message);
    failed++;
  }

  // Test 5: Duplicate packet
  try {
    const aliceBefore = await Account.findOne({ vpa: 'alice@demo' });
    const packet = demoService.createPacket('alice@demo', 'bob@demo', 75.0, '1234', 5);

    // Bridge 1 uploads packet
    const result1 = await bridgeService.ingest(packet, 'bridge-node-1', 2);
    // Bridge 2 uploads identical packet simultaneously
    const result2 = await bridgeService.ingest(packet, 'bridge-node-2', 3);

    const aliceAfter = await Account.findOne({ vpa: 'alice@demo' });

    if (
      result1.outcome === 'SETTLED' &&
      result2.outcome === 'DUPLICATE_DROPPED' &&
      aliceAfter.balance === aliceBefore.balance - 75.0
    ) {
      console.log('\n✅ Test 5 Passed: Duplicate packet detected and dropped; account debited exactly once.');
      console.log(`   Bridge 1 upload: ${result1.outcome} (tx: ${result1.transactionId})`);
      console.log(`   Bridge 2 upload: ${result2.outcome}`);
      console.log(`   Alice balance debited once: ₹${aliceBefore.balance} -> ₹${aliceAfter.balance}`);
      passed++;
    } else {
      throw new Error(`Duplicate packet test failed: ${JSON.stringify({ result1, result2 })}`);
    }
  } catch (err) {
    console.error('\n❌ Test 5 Failed:', err.message);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`Tests Summary: ${passed} passed, ${failed} failed.`);
  console.log(`========================================\n`);

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runSettlementTests();
