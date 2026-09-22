import React from 'react';
import { Landmark, User } from 'lucide-react';

export const AccountBalances = ({ accounts = [] }) => {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Landmark className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Bank Account Balances</h2>
            <p className="text-xs text-slate-400">Live ledger accounts (MongoDB)</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
              <th className="pb-2.5 font-medium">Account / VPA</th>
              <th className="pb-2.5 font-medium">Account Holder</th>
              <th className="pb-2.5 font-medium text-right">Available Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {accounts.map((acc) => (
              <tr key={acc.vpa} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3 font-mono text-cyan-300 font-medium">{acc.vpa}</td>
                <td className="py-3 text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>{acc.holderName}</span>
                </td>
                <td className="py-3 text-right font-mono font-bold text-emerald-400 text-sm">
                  ₹{Number(acc.balance).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
