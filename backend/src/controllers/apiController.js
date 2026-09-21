import { serverKeyHolder } from '../crypto/keyHolder.js';
import { demoService } from '../services/demoService.js';
import { meshService } from '../services/meshService.js';
import { bridgeService } from '../services/bridgeService.js';
import { idempotencyService } from '../services/idempotencyService.js';
import { Account } from '../models/Account.js';
import { Transaction } from '../models/Transaction.js';
import {
  broadcastMeshState,
  broadcastAccounts,
  broadcastTransactions,
  broadcastLog,
  getMeshStateSnapshot,
} from '../sockets/socketHandler.js';

export const getServerKey = (req, res) => {
  res.json({
    publicKey: serverKeyHolder.getPublicKeyBase64(),
    algorithm: 'RSA-2048 / OAEP-SHA256',
    hybridScheme: 'RSA-OAEP encrypts an AES-256-GCM session key',
  });
};

export const demoSend = (req, res) => {
  try {
    const { senderVpa, receiverVpa, amount, pin, ttl, startDevice } = req.body;

    if (!senderVpa || !receiverVpa || !amount || !pin) {
      return res.status(400).json({ error: 'senderVpa, receiverVpa, amount, and pin are required' });
    }

    const packet = demoService.createPacket(
      senderVpa,
      receiverVpa,
      amount,
      pin,
      ttl !== undefined ? Number(ttl) : 5
    );

    const deviceId = startDevice || 'phone-alice';
    meshService.inject(deviceId, packet);

    // Live Socket.IO updates
    broadcastMeshState();
    broadcastLog(
      `📤 Packet ${packet.packetId.substring(0, 8)} encrypted & injected at ${deviceId} (TTL ${packet.ttl})`
    );

    res.json({
      packetId: packet.packetId,
      ciphertextPreview: packet.ciphertext.substring(0, 64) + '...',
      ttl: packet.ttl,
      injectedAt: deviceId,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getMeshState = (req, res) => {
  res.json(getMeshStateSnapshot());
};

export const meshGossip = (req, res) => {
  try {
    const result = meshService.gossipOnce();

    // Live Socket.IO updates
    broadcastMeshState();
    broadcastLog(`🔄 Gossip: ${result.transfers} transfer(s) — ${JSON.stringify(result.deviceCounts)}`);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const meshFlush = async (req, res) => {
  try {
    const uploads = meshService.collectBridgeUploads();

    // Process all bridge uploads in parallel to simulate concurrent bridge connectivity
    const results = await Promise.all(
      uploads.map(async (up) => {
        const hopCount = 5 - (up.packet.ttl || 0);
        const r = await bridgeService.ingest(up.packet, up.bridgeNodeId, hopCount);
        return {
          bridgeNode: up.bridgeNodeId,
          packetId: up.packet.packetId.substring(0, 8),
          outcome: r.outcome,
          reason: r.reason || '',
          transactionId: r.transactionId || null,
        };
      })
    );

    // Live Socket.IO updates
    await broadcastAccounts();
    await broadcastTransactions();
    broadcastMeshState();

    broadcastLog(`📡 ${uploads.length} bridge upload(s) executed`);
    for (const r of results) {
      broadcastLog(
        `   ${r.bridgeNode} packet ${r.packetId} → ${r.outcome}${r.reason ? ' (' + r.reason + ')' : ''}`
      );
    }

    res.json({
      uploadsAttempted: uploads.length,
      results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const meshReset = (req, res) => {
  try {
    meshService.resetMesh();
    idempotencyService.clear();

    // Live Socket.IO updates
    broadcastMeshState();
    broadcastLog('🗑 Mesh & idempotency cache cleared');

    res.json({ status: 'mesh and idempotency cache cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const bridgeIngest = async (req, res) => {
  try {
    const bridgeNodeId = req.headers['x-bridge-node-id'] || 'unknown';
    const hopCount = parseInt(req.headers['x-hop-count'] || '0', 10);

    const result = await bridgeService.ingest(req.body, bridgeNodeId, hopCount);

    if (result.outcome === 'SETTLED' || result.outcome === 'REJECTED') {
      await broadcastAccounts();
      await broadcastTransactions();
    }

    broadcastLog(
      `📡 Ingest from ${bridgeNodeId}: ${result.outcome}${result.reason ? ' (' + result.reason + ')' : ''}`
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAccounts = async (req, res) => {
  try {
    const accounts = await Account.find().sort({ vpa: 1 });
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getTransactions = async (req, res) => {
  try {
    const txs = await Transaction.find().sort({ createdAt: -1 }).limit(20);
    res.json(txs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
