import express from 'express';
import {
  getServerKey,
  demoSend,
  getMeshState,
  meshGossip,
  meshFlush,
  meshReset,
  bridgeIngest,
  getAccounts,
  getTransactions,
} from '../controllers/apiController.js';

const router = express.Router();

// Server key
router.get('/server-key', getServerKey);

// Demo injection
router.post('/demo/send', demoSend);

// Mesh simulation
router.get('/mesh/state', getMeshState);
router.post('/mesh/gossip', meshGossip);
router.post('/mesh/flush', meshFlush);
router.post('/mesh/reset', meshReset);

// Bridge ingestion (Production endpoint)
router.post('/bridge/ingest', bridgeIngest);

// Database queries
router.get('/accounts', getAccounts);
router.get('/transactions', getTransactions);

export default router;
