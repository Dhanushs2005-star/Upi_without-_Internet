import http from 'http';
import { io as Client } from 'socket.io-client';
import { app, httpServer } from '../src/server.js';
import { Account } from '../src/models/Account.js';
import { Transaction } from '../src/models/Transaction.js';

async function verifyFullFlow() {
  console.log('=== Verifying End-to-End Frontend + Backend Flow ===\n');

  // Wait 1.5 seconds for DB connection and server start
  await new Promise((r) => setTimeout(r, 1500));

  const baseUrl = 'http://localhost:5000';
  let passed = 0;
  let failed = 0;

  // 1. Verify frontend index.html served at /
  try {
    const res = await fetch(`${baseUrl}/`);
    const text = await res.text();
    if (res.status === 200 && text.includes('UPI Offline Mesh')) {
      console.log('✅ Step 1: Frontend SPA HTML successfully served at http://localhost:5000');
      passed++;
    } else {
      throw new Error(`Frontend HTML not returned: ${text.substring(0, 100)}`);
    }
  } catch (err) {
    console.error('❌ Step 1 Failed:', err.message);
    failed++;
  }

  // 2. Verify Socket.IO connectivity
  let socketReceivedState = false;
  const socket = Client(baseUrl);
  socket.on('mesh:state', () => {
    socketReceivedState = true;
  });

  await new Promise((resolve) => socket.on('connect', resolve));
  console.log(`✅ Step 2: Socket.IO connected in real-time (id: ${socket.id})`);
  passed++;

  // 3. Reset demo state
  await fetch(`${baseUrl}/api/mesh/reset`, { method: 'POST' });

  // 4. Test payment injection (Alice -> Bob ₹350)
  try {
    const aliceBeforeRes = await fetch(`${baseUrl}/api/accounts`);
    const accountsBefore = await aliceBeforeRes.json();
    const aliceBefore = accountsBefore.find((a) => a.vpa === 'alice@demo');
    const bobBefore = accountsBefore.find((a) => a.vpa === 'bob@demo');

    console.log(`\nStarting balances: Alice ₹${aliceBefore.balance}, Bob ₹${bobBefore.balance}`);

    const injectRes = await fetch(`${baseUrl}/api/demo/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderVpa: 'alice@demo',
        receiverVpa: 'bob@demo',
        amount: 350,
        pin: '1234',
        ttl: 5,
        startDevice: 'phone-alice',
      }),
    });
    const injectData = await injectRes.json();
    console.log(`✅ Step 3: Payment packet created & injected (ID: ${injectData.packetId.substring(0, 8)})`);

    // 5. Gossip round
    const gossipRes = await fetch(`${baseUrl}/api/mesh/gossip`, { method: 'POST' });
    const gossipData = await gossipRes.json();
    console.log(`✅ Step 4: Gossip round executed (${gossipData.transfers} transfers across mesh)`);

    // 6. Bridge flush (walks outside, gets 4G)
    const flushRes = await fetch(`${baseUrl}/api/mesh/flush`, { method: 'POST' });
    const flushData = await flushRes.json();
    console.log(`✅ Step 5: 4G bridge upload executed (Settled outcome: ${flushData.results[0].outcome})`);

    // 7. Verify balances updated
    const accountsAfterRes = await fetch(`${baseUrl}/api/accounts`);
    const accountsAfter = await accountsAfterRes.json();
    const aliceAfter = accountsAfter.find((a) => a.vpa === 'alice@demo');
    const bobAfter = accountsAfter.find((a) => a.vpa === 'bob@demo');

    console.log(`Final balances: Alice ₹${aliceAfter.balance}, Bob ₹${bobAfter.balance}`);

    if (
      aliceAfter.balance === aliceBefore.balance - 350 &&
      bobAfter.balance === bobBefore.balance + 350
    ) {
      console.log('✅ Step 6: Atomic balance transfer settled successfully across the full stack!');
      passed += 4;
    } else {
      throw new Error('Balances did not update as expected');
    }
  } catch (err) {
    console.error('❌ E2E Flow Failed:', err.message);
    failed++;
  }

  socket.disconnect();
  httpServer.close();

  console.log(`\n========================================`);
  console.log(`Full E2E Verification: ${passed} checks passed, ${failed} failed.`);
  console.log(`========================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

verifyFullFlow();
