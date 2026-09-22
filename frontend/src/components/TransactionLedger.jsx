import React from 'react';
import { History, ArrowRight, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';

export const TransactionLedger = ({ transactions = [] }) => {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Transaction Ledger</h2>
            <p className="text-xs text-slate-400">
              Immutable settled entries (deduplicated by packetHash index)
            </p>
          </div>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          Total: <strong className="text-white">{transactions.length}</strong>
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
              <th className="pb-2.5 font-medium">Tx ID</th>
              <th className="pb-2.5 font-medium">Flow</th>
              <th className="pb-2.5 font-medium text-right">Amount</th>
              <th className="pb-2.5 font-medium text-center">Status</th>
              <th className="pb-2.5 font-medium">Bridge Node</th>
              <th className="pb-2.5 font-medium text-center">Hops</th>
              <th className="pb-2.5 font-medium text-right">Settled Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-500 italic">
                  No transactions settled yet. Inject a payment and flush bridges to see it here.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => {
                const isSettled = tx.status === 'SETTLED';
                const settledDate = tx.settledAt ? new Date(tx.settledAt).toLocaleTimeString() : '—';
                const idShort = tx._id ? tx._id.substring(tx._id.length - 6) : String(tx.id || '—');

                return (
                  <tr key={tx._id || tx.packetHash} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 font-mono text-slate-400">#{idShort}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <span className="text-slate-300">{tx.senderVpa}</span>
                        <ArrowRight className="w-3 h-3 text-slate-500" />
                        <span className="text-cyan-300">{tx.receiverVpa}</span>
                      </div>
                    </td>
                    <td className="py-3 text-right font-mono font-semibold text-white">
                      ₹{Number(tx.amount).toFixed(2)}
                    </td>
                    <td className="py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isSettled
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                            : 'bg-rose-950/80 text-rose-300 border-rose-800'
                        }`}
                      >
                        {isSettled ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <XCircle className="w-3 h-3 text-rose-400" />
                        )}
                        <span>{tx.status}</span>
                      </span>
                    </td>
                    <td className="py-3 font-mono text-[11px] text-slate-300">
                      {tx.bridgeNodeId || 'unknown'}
                    </td>
                    <td className="py-3 text-center font-mono text-slate-400">
                      {tx.hopCount !== undefined ? tx.hopCount : '—'}
                    </td>
                    <td className="py-3 text-right text-slate-400 font-mono text-[11px]">
                      {settledDate}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
