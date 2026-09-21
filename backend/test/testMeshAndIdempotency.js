import { demoService } from '../src/services/demoService.js';
import { meshService } from '../src/services/meshService.js';
import { idempotencyService } from '../src/services/idempotencyService.js';
import { HybridCrypto } from '../src/crypto/hybridCrypto.js';

async function runMeshTests() {
  console.log('=== Running Mesh Simulation & Idempotency Tests ===\n');

  let passed = 0;
  let failed = 0;

  meshService.resetMesh();
  idempotencyService.clear();

  // Test 1: Payment packet enters the mesh
  let packet = null;
  try {
    packet = demoService.createPacket('alice@demo', 'bob@demo', 250.0, '1234', 5);
    meshService.inject('phone-alice', packet);

    const alice = meshService.getDevice('phone-alice');
    if (alice.packetCount() === 1 && alice.holds(packet.packetId)) {
      console.log('✅ Test 1 Passed: Payment packet successfully created and injected into phone-alice.');
      console.log(`   Packet ID: ${packet.packetId.substring(0, 8)}... | Initial TTL: ${packet.ttl}`);
      passed++;
    } else {
      throw new Error('phone-alice does not hold the injected packet');
    }
  } catch (err) {
    console.error('❌ Test 1 Failed:', err.message);
    failed++;
  }

  // Test 2 & 3: Packet moves between devices and TTL decreases
  try {
    const gossipResult = meshService.gossipOnce();
    console.log('\n✅ Test 2 Passed: Packet gossiped across mesh devices.');
    console.log(`   Transfers recorded: ${gossipResult.transfers}`);
    console.log('   Device counts:', JSON.stringify(gossipResult.deviceCounts));

    // Verify stranger received packet with decremented TTL
    const stranger1 = meshService.getDevice('phone-stranger1');
    const heldByStranger1 = stranger1.getHeldPackets();
    const packetAtStranger1 = heldByStranger1.find(p => p.packetId === packet.packetId);

    if (packetAtStranger1 && packetAtStranger1.ttl === 4) {
      console.log('\n✅ Test 3 Passed: Packet TTL decremented properly per hop.');
      console.log(`   Original TTL: 5 -> Forwarded TTL at phone-stranger1: ${packetAtStranger1.ttl}`);
      passed++;
    } else {
      throw new Error(`Expected packet with TTL 4, but got: ${packetAtStranger1 ? packetAtStranger1.ttl : 'none'}`);
    }
  } catch (err) {
    console.error('❌ Test 2/3 Failed:', err.message);
    failed++;
  }

  // Test 4: Bridge receives the packet
  try {
    const bridge = meshService.getDevice('phone-bridge');
    if (!bridge.holds(packet.packetId)) {
      throw new Error('phone-bridge did not receive packet in gossip');
    }

    const bridgeUploads = meshService.collectBridgeUploads();
    const upload = bridgeUploads.find(u => u.packet.packetId === packet.packetId);

    if (upload && upload.bridgeNodeId === 'phone-bridge') {
      console.log('\n✅ Test 4 Passed: Bridge node successfully received packet and queued for upload.');
      console.log(`   Bridge Node: ${upload.bridgeNodeId} | Ready upload count: ${bridgeUploads.length}`);
      passed++;
    } else {
      throw new Error('Bridge upload collection did not find packet');
    }
  } catch (err) {
    console.error('❌ Test 4 Failed:', err.message);
    failed++;
  }

  // Test 5: Duplicate packets are detected via idempotency cache
  try {
    const packetHash = HybridCrypto.hashCiphertext(packet.ciphertext);

    // First delivery attempt
    const firstClaim = idempotencyService.claim(packetHash);
    // Second delivery attempt (simulating duplicate upload from another bridge)
    const secondClaim = idempotencyService.claim(packetHash);
    // Third delivery attempt
    const thirdClaim = idempotencyService.claim(packetHash);

    if (firstClaim === true && secondClaim === false && thirdClaim === false) {
      console.log('\n✅ Test 5 Passed: Duplicate packets detected and dropped.');
      console.log(`   Packet Hash: ${packetHash.substring(0, 16)}...`);
      console.log(`   First bridge claim: ${firstClaim} (ALLOWED)`);
      console.log(`   Duplicate bridge claim 1: ${secondClaim} (DROPPED)`);
      console.log(`   Duplicate bridge claim 2: ${thirdClaim} (DROPPED)`);
      passed++;
    } else {
      throw new Error(`Idempotency claims incorrect: 1st=${firstClaim}, 2nd=${secondClaim}, 3rd=${thirdClaim}`);
    }
  } catch (err) {
    console.error('\n❌ Test 5 Failed:', err.message);
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

runMeshTests();
