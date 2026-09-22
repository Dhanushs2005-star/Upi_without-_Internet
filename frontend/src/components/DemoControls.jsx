import React, { useState } from 'react';
import { Send, Repeat, CloudUpload, ArrowRight, Lock, KeyRound } from 'lucide-react';

export const DemoControls = ({
  accounts = [],
  onInject,
  onGossip,
  onFlush,
  loadingAction,
}) => {
  const [senderVpa, setSenderVpa] = useState('alice@demo');
  const [receiverVpa, setReceiverVpa] = useState('bob@demo');
  const [amount, setAmount] = useState('250');
  const [pin, setPin] = useState('1234');

  const handleInject = (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    onInject({
      senderVpa,
      receiverVpa,
      amount: Number(amount),
      pin,
      ttl: 5,
      startDevice: 'phone-alice',
    });
  };

  return (
    <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
        <h2 className="text-base font-semibold text-white uppercase tracking-wider text-xs">
          Interactive Simulation Workflow
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step 1: Compose Offline Payment */}
        <div className="flex flex-col justify-between bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 hover:border-slate-700 transition-all">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-xs border border-indigo-500/30">
                1
              </span>
              <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-400" /> Offline Signing
              </span>
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Compose Payment</h3>
            <p className="text-xs text-slate-400 mb-4">
              Simulate sender offline phone: encrypts JSON with RSA-OAEP + AES-256-GCM.
            </p>

            <form onSubmit={handleInject} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-slate-400 mb-1 block">From</label>
                  <select
                    value={senderVpa}
                    onChange={(e) => setSenderVpa(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {accounts.map((a) => (
                      <option key={`sender-${a.vpa}`} value={a.vpa}>
                        {a.vpa}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-400 mb-1 block">To</label>
                  <select
                    value={receiverVpa}
                    onChange={(e) => setReceiverVpa(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {accounts.map((a) => (
                      <option key={`receiver-${a.vpa}`} value={a.vpa}>
                        {a.vpa}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-slate-400 mb-1 block">Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                    placeholder="250"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-400 mb-1 block">UPI PIN</label>
                  <div className="relative">
                    <input
                      type="password"
                      maxLength={4}
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white tracking-widest focus:outline-none focus:border-emerald-500"
                      placeholder="1234"
                    />
                    <KeyRound className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2" />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loadingAction === 'inject'}
                className="w-full mt-2 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs py-2 px-3 rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{loadingAction === 'inject' ? 'Encrypting & Injecting...' : 'Inject into Mesh (TTL=5)'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Step 2: Mesh Gossip */}
        <div className="flex flex-col justify-between bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 hover:border-slate-700 transition-all">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-xs border border-cyan-500/30">
                2
              </span>
              <span className="text-[11px] font-medium text-slate-400">Bluetooth Hop</span>
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Gossip Propagation</h3>
            <p className="text-xs text-slate-400 mb-4">
              Devices gossip packets in Bluetooth range. Opaque ciphertexts forward while TTL decrements per hop.
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onGossip}
              disabled={loadingAction === 'gossip'}
              className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs py-2.5 px-3 rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              <Repeat className={`w-3.5 h-3.5 ${loadingAction === 'gossip' ? 'animate-spin' : ''}`} />
              <span>{loadingAction === 'gossip' ? 'Gossiping...' : 'Run Gossip Round (TTL -1)'}</span>
            </button>
          </div>
        </div>

        {/* Step 3: Bridge Upload */}
        <div className="flex flex-col justify-between bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 hover:border-slate-700 transition-all">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 font-bold text-xs border border-violet-500/30">
                3
              </span>
              <span className="text-[11px] font-medium text-slate-400">4G Bridge Upload</span>
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Deferred Settlement</h3>
            <p className="text-xs text-slate-400 mb-4">
              Bridges walk outside, get 4G, and POST packets to backend. Demonstrates atomic idempotency and settlement.
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onFlush}
              disabled={loadingAction === 'flush'}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs py-2.5 px-3 rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              <span>{loadingAction === 'flush' ? 'Uploading...' : 'Upload via 4G Bridges (Parallel)'}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
