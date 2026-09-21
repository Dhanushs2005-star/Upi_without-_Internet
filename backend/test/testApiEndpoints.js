import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { io as Client } from 'socket.io-client';
import { connectDB } from '../src/config/db.js';
import { initSocket } from '../src/sockets/socketHandler.js';
import { demoService } from '../src/services/demoService.js';
import { Account } from '../src/models/Account.js';
import { Transaction } from '../src/models/Transaction.js';
import apiRoutes from '../src/routes/apiRoutes.js';

dotenv.config();

async function runApiTests() {
  console.log('=== Running Express API & Socket.IO Integration Tests ===\n');

  await connectDB();
  await Account.deleteMany({});
  await Transaction.deleteMany({});
  await demoService.seedAccounts();

  // Setup test Express & HTTP server on an ephemeral port
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api', apiRoutes);

  const server = http.createServer(app);
  initSocket(server);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`[Test Server] Running on ${baseUrl}`);

  // Connect Socket.IO client
  let socketReceivedState = null;
  let socketReceivedLog = null;
  let socketReceivedAccounts = null;

  const socket = Client(baseUrl);
  socket.on('mesh:state', (data) => {
    socketReceivedState = data;
  });
  socket.on('activity:log', (data) => {
    socketReceivedLog = data;
  });
  socket.on('accounts:update', (data) => {
    socketReceivedAccounts = data;
  });

  // Wait for socket connection
  await new Promise((resolve) => socket.on('connect', resolve));
  console.log(`[Socket.IO Client] Connected to test server (id: ${socket.id})`);

  let passed = 0;
  let failed = 0;

  // Test 1: GET /api/server-key
  try {
    const res = await fetch(`${baseUrl}/api/server-key`);
    const data = await res.json();
    if (res.status === 200 && data.publicKey && data.algorithm.includes('RSA-2048')) {
      console.log('✅ Test 1 Passed: GET /api/server-key returned valid public key.');
      console.log(`   Algorithm: ${data.algorithm} | Key: ${data.publicKey.substring(0, 32)}...`);
      passed++;
    } else {
      throw new Error(`Unexpected server-key response: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.error('❌ Test 1 Failed:', err.message);
    failed++;
  }

  // Test 2: GET /api/accounts
  try {
    const res = await fetch(`${baseUrl}/api/accounts`);
    const data = await res.json();
    if (res.status === 200 && Array.isArray(data) && data.length === 4) {
      console.log('\n✅ Test 2 Passed: GET /api/accounts returned 4 seeded accounts.');
      console.log(`   Accounts: ${data.map(a => `${a.vpa} (₹${a.balance})`).join(', ')}`);
      passed++;
    } else {
      throw new Error(`Unexpected accounts response: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.error('❌ Test 2 Failed:', err.message);
    failed++;
  }

  // Test 3: POST /api/demo/send
  let packetId = null;
  try {
    const res = await fetch(`${baseUrl}/api/demo/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderVpa: 'alice@demo',
        receiverVpa: 'bob@demo',
        amount: 300,
        pin: '1234',
        ttl: 5,
        startDevice: 'phone-alice'
      })
    });
    const data = await res.json();
    packetId = data.packetId;

    // Small delay to allow socket event propagation
    await new Promise(r => setTimeout(r, 100));

    if (res.status === 200 && data.packetId && data.injectedAt === 'phone-alice') {
      console.log('\n✅ Test 3 Passed: POST /api/demo/send successfully injected packet.');
      console.log(`   Injected packet ${data.packetId.substring(0, 8)} at ${data.injectedAt}`);
      console.log(`   Ciphertext Preview: ${data.ciphertextPreview}`);
      passed++;
    } else {
      throw new Error(`Unexpected demo/send response: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.error('❌ Test 3 Failed:', err.message);
    failed++;
  }

  // Test 4: Socket.IO received live updates
  try {
    if (socketReceivedState && socketReceivedLog) {
      console.log('\n✅ Test 4 Passed: Socket.IO pushed real-time mesh:state and activity:log events.');
      console.log(`   Last Log: "${socketReceivedLog.message}"`);
      passed++;
    } else {
      throw new Error('Socket.IO did not receive expected broadcast events');
    }
  } catch (err) {
    console.error('❌ Test 4 Failed:', err.message);
    failed++;
  }

  // Test 5: GET /api/mesh/state
  try {
    const res = await fetch(`${baseUrl}/api/mesh/state`);
    const data = await res.json();
    const alice = data.devices.find(d => d.deviceId === 'phone-alice');
    if (res.status === 200 && alice && alice.packetCount === 1) {
      console.log('\n✅ Test 5 Passed: GET /api/mesh/state accurately reports device holdings.');
      console.log(`   phone-alice holds ${alice.packetCount} packet(s): [${alice.packetIds.join(', ')}]`);
      passed++;
    } else {
      throw new Error(`Unexpected mesh/state response: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.error('❌ Test 5 Failed:', err.message);
    failed++;
  }

  // Test 6: POST /api/mesh/gossip
  try {
    const res = await fetch(`${baseUrl}/api/mesh/gossip`, { method: 'POST' });
    const data = await res.json();
    if (res.status === 200 && data.transfers > 0) {
      console.log('\n✅ Test 6 Passed: POST /api/mesh/gossip propagated packets.');
      console.log(`   Transfers: ${data.transfers} | Counts: ${JSON.stringify(data.deviceCounts)}`);
      passed++;
    } else {
      throw new Error(`Unexpected gossip response: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.error('❌ Test 6 Failed:', err.message);
    failed++;
  }

  // Test 7: POST /api/mesh/flush (Bridge nodes upload)
  try {
    const res = await fetch(`${baseUrl}/api/mesh/flush`, { method: 'POST' });
    const data = await res.json();
    const settled = data.results.find(r => r.outcome === 'SETTLED');
    if (res.status === 200 && data.uploadsAttempted > 0 && settled) {
      console.log('\n✅ Test 7 Passed: POST /api/mesh/flush uploaded bridge packets and settled.');
      console.log(`   Uploads: ${data.uploadsAttempted} | Settled Tx ID: ${settled.transactionId}`);
      passed++;
    } else {
      throw new Error(`Unexpected flush response: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.error('❌ Test 7 Failed:', err.message);
    failed++;
  }

  // Test 8: GET /api/transactions
  try {
    const res = await fetch(`${baseUrl}/api/transactions`);
    const data = await res.json();
    if (res.status === 200 && Array.isArray(data) && data.length > 0) {
      console.log('\n✅ Test 8 Passed: GET /api/transactions returned ledger history.');
      console.log(`   Latest Tx: ₹${data[0].amount} from ${data[0].senderVpa} to ${data[0].receiverVpa} (${data[0].status})`);
      passed++;
    } else {
      throw new Error(`Unexpected transactions response: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.error('❌ Test 8 Failed:', err.message);
    failed++;
  }

  // Test 9: POST /api/bridge/ingest (Direct production endpoint)
  try {
    // Create a new fresh packet
    const freshPacket = demoService.createPacket('alice@demo', 'carol@demo', 150, '1234', 4);
    const res = await fetch(`${baseUrl}/api/bridge/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bridge-Node-Id': 'manual-bridge-99',
        'X-Hop-Count': '2'
      },
      body: JSON.stringify(freshPacket)
    });
    const data = await res.json();
    if (res.status === 200 && data.outcome === 'SETTLED') {
      console.log('\n✅ Test 9 Passed: POST /api/bridge/ingest processed direct bridge upload.');
      console.log(`   Outcome: ${data.outcome} | Tx ID: ${data.transactionId} | Hash: ${data.packetHash.substring(0, 16)}...`);
      passed++;
    } else {
      throw new Error(`Unexpected bridge/ingest response: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.error('❌ Test 9 Failed:', err.message);
    failed++;
  }

  // Test 10: POST /api/mesh/reset
  try {
    const res = await fetch(`${baseUrl}/api/mesh/reset`, { method: 'POST' });
    const data = await res.json();
    const stateRes = await fetch(`${baseUrl}/api/mesh/state`);
    const stateData = await stateRes.json();
    const totalPackets = stateData.devices.reduce((acc, d) => acc + d.packetCount, 0);

    if (res.status === 200 && totalPackets === 0 && stateData.idempotencyCacheSize === 0) {
      console.log('\n✅ Test 10 Passed: POST /api/mesh/reset cleared mesh and idempotency cache.');
      console.log(`   Remaining held packets: ${totalPackets} | Cache size: ${stateData.idempotencyCacheSize}`);
      passed++;
    } else {
      throw new Error(`Unexpected reset response: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.error('❌ Test 10 Failed:', err.message);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`Tests Summary: ${passed} passed, ${failed} failed.`);
  console.log(`========================================\n`);

  socket.disconnect();
  server.close();
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runApiTests();
