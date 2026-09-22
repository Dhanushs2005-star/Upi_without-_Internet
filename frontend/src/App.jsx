import React, { useState, useEffect } from 'react';
import { socket } from './socket';
import { Navbar } from './components/Navbar';
import { DemoControls } from './components/DemoControls';
import { MeshVisualizer } from './components/MeshVisualizer';
import { AccountBalances } from './components/AccountBalances';
import { TransactionLedger } from './components/TransactionLedger';
import { ActivityLog } from './components/ActivityLog';

const API_BASE = '/api';

export function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [meshState, setMeshState] = useState({ devices: [], idempotencyCacheSize: 0 });
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loadingAction, setLoadingAction] = useState(null);

  // Initial HTTP hydration & Socket.IO listener setup
  useEffect(() => {
    // 1. Initial HTTP fetch
    const fetchInitialData = async () => {
      try {
        const [accsRes, meshRes, txsRes] = await Promise.all([
          fetch(`${API_BASE}/accounts`),
          fetch(`${API_BASE}/mesh/state`),
          fetch(`${API_BASE}/transactions`),
        ]);

        if (accsRes.ok) setAccounts(await accsRes.json());
        if (meshRes.ok) setMeshState(await meshRes.json());
        if (txsRes.ok) setTransactions(await txsRes.json());
      } catch (err) {
        console.error('Initial data fetch error:', err);
      }
    };

    fetchInitialData();

    // 2. Socket.IO event listeners
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    const onMeshState = (data) => setMeshState(data);
    const onAccountsUpdate = (data) => setAccounts(data);
    const onTransactionsUpdate = (data) => setTransactions(data);
    const onActivityLog = (newLog) => {
      setLogs((prev) => [...prev.slice(-150), newLog]);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('mesh:state', onMeshState);
    socket.on('accounts:update', onAccountsUpdate);
    socket.on('transactions:update', onTransactionsUpdate);
    socket.on('activity:log', onActivityLog);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('mesh:state', onMeshState);
      socket.off('accounts:update', onAccountsUpdate);
      socket.off('transactions:update', onTransactionsUpdate);
      socket.off('activity:log', onActivityLog);
    };
  }, []);

  // Action: Step 1 - Inject payment into mesh
  const handleInject = async (payload) => {
    setLoadingAction('inject');
    try {
      const res = await fetch(`${API_BASE}/demo/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to inject packet');
    } catch (err) {
      alert(`Inject failed: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  // Action: Step 2 - Run gossip round
  const handleGossip = async () => {
    setLoadingAction('gossip');
    try {
      const res = await fetch(`${API_BASE}/mesh/gossip`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gossip failed');
    } catch (err) {
      alert(`Gossip failed: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  // Action: Step 3 - Flush bridge nodes to backend
  const handleFlush = async () => {
    setLoadingAction('flush');
    try {
      const res = await fetch(`${API_BASE}/mesh/flush`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Flush failed');
    } catch (err) {
      alert(`Flush failed: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  // Action: Reset demo
  const handleReset = async () => {
    setLoadingAction('reset');
    try {
      const res = await fetch(`${API_BASE}/mesh/reset`, { method: 'POST' });
      if (!res.ok) throw new Error('Reset failed');
    } catch (err) {
      alert(`Reset failed: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar
        isConnected={isConnected}
        cacheSize={meshState.idempotencyCacheSize || 0}
        onReset={handleReset}
        isResetting={loadingAction === 'reset'}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Step-by-step pipeline controls */}
        <DemoControls
          accounts={accounts}
          onInject={handleInject}
          onGossip={handleGossip}
          onFlush={handleFlush}
          loadingAction={loadingAction}
        />

        {/* Mesh Device Topology */}
        <MeshVisualizer devices={meshState.devices || []} />

        {/* Tables & Activity Log Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AccountBalances accounts={accounts} />
          <ActivityLog logs={logs} onClear={() => setLogs([])} />
        </div>

        {/* Transaction History */}
        <TransactionLedger transactions={transactions} />
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
        <p>
          UPI Offline Mesh Deferred Settlement &bull; React + Vite + Tailwind &bull; Node.js + Express + MongoDB &bull; Socket.IO
        </p>
      </footer>
    </div>
  );
}

export default App;
