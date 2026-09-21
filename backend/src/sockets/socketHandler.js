import { Server } from 'socket.io';
import { meshService } from '../services/meshService.js';
import { idempotencyService } from '../services/idempotencyService.js';
import { Account } from '../models/Account.js';
import { Transaction } from '../models/Transaction.js';

let ioInstance = null;

export const initSocket = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  ioInstance.on('connection', async (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Send immediate snapshot upon initial connection
    try {
      socket.emit('mesh:state', getMeshStateSnapshot());

      const accounts = await Account.find().sort({ vpa: 1 });
      socket.emit('accounts:update', accounts);

      const transactions = await Transaction.find().sort({ createdAt: -1 }).limit(20);
      socket.emit('transactions:update', transactions);
    } catch (err) {
      console.error('[Socket.IO] Error sending initial snapshot:', err.message);
    }

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return ioInstance;
};

export const getIO = () => ioInstance;

export const getMeshStateSnapshot = () => {
  const devices = meshService.getDevices().map((d) => ({
    deviceId: d.deviceId,
    hasInternet: d.hasInternet,
    packetCount: d.packetCount(),
    packetIds: d.getHeldPackets().map((p) => p.packetId.substring(0, 8)),
  }));

  return {
    devices,
    idempotencyCacheSize: idempotencyService.size(),
  };
};

export const broadcastMeshState = () => {
  if (ioInstance) {
    ioInstance.emit('mesh:state', getMeshStateSnapshot());
  }
};

export const broadcastAccounts = async () => {
  if (ioInstance) {
    try {
      const accounts = await Account.find().sort({ vpa: 1 });
      ioInstance.emit('accounts:update', accounts);
    } catch (err) {
      console.error('[Socket.IO] Broadcast accounts error:', err.message);
    }
  }
};

export const broadcastTransactions = async () => {
  if (ioInstance) {
    try {
      const transactions = await Transaction.find().sort({ createdAt: -1 }).limit(20);
      ioInstance.emit('transactions:update', transactions);
    } catch (err) {
      console.error('[Socket.IO] Broadcast transactions error:', err.message);
    }
  }
};

export const broadcastLog = (message) => {
  if (ioInstance) {
    ioInstance.emit('activity:log', {
      timestamp: new Date().toISOString(),
      message,
    });
  }
};
