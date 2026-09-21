import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { initSocket } from './sockets/socketHandler.js';
import { demoService } from './services/demoService.js';
import apiRoutes from './routes/apiRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Mount API routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'UPI Offline Mesh Backend (MERN + Socket.IO)',
    version: '1.0.0',
    endpoints: [
      'GET  /api/server-key',
      'POST /api/demo/send',
      'GET  /api/mesh/state',
      'POST /api/mesh/gossip',
      'POST /api/mesh/flush',
      'POST /api/mesh/reset',
      'POST /api/bridge/ingest',
      'GET  /api/accounts',
      'GET  /api/transactions'
    ]
  });
});

// Create HTTP server and initialize Socket.IO
const httpServer = http.createServer(app);
initSocket(httpServer);

// Connect DB, seed accounts, and start listening
const startServer = async () => {
  await connectDB();
  await demoService.seedAccounts();

  httpServer.listen(PORT, () => {
    console.log(`[Server] UPI Mesh Backend running on http://localhost:${PORT}`);
    console.log(`[Socket.IO] Real-time engine listening on port ${PORT}`);
  });
};

startServer();

export { app, httpServer };
