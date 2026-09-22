import React, { useRef, useEffect } from 'react';
import { Terminal, Trash2 } from 'lucide-react';

export const ActivityLog = ({ logs = [], onClear }) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col h-[340px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Live Activity Stream</h2>
            <p className="text-xs text-slate-400">Real-time Socket.IO event telemetry</p>
          </div>
        </div>

        <button
          onClick={onClear}
          title="Clear Log"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 bg-slate-950 border border-slate-800/90 rounded-xl p-3.5 font-mono text-xs overflow-y-auto space-y-1.5 select-text"
      >
        {logs.length === 0 ? (
          <div className="text-slate-600 italic py-4 text-center">
            Log buffer empty. Waiting for mesh events...
          </div>
        ) : (
          logs.map((log, index) => {
            const timeStr = log.timestamp
              ? new Date(log.timestamp).toLocaleTimeString()
              : new Date().toLocaleTimeString();

            let color = 'text-slate-300';
            if (log.message.includes('📤')) color = 'text-emerald-400 font-medium';
            else if (log.message.includes('🔄')) color = 'text-cyan-400 font-medium';
            else if (log.message.includes('📡')) color = 'text-violet-400 font-medium';
            else if (log.message.includes('SETTLED')) color = 'text-emerald-300 font-semibold';
            else if (log.message.includes('DUPLICATE_DROPPED')) color = 'text-amber-400 font-semibold';
            else if (log.message.includes('INVALID') || log.message.includes('REJECTED'))
              color = 'text-rose-400 font-semibold';
            else if (log.message.includes('🗑')) color = 'text-slate-400';

            return (
              <div key={index} className="leading-relaxed flex items-start gap-2">
                <span className="text-slate-600 text-[11px] select-none">[{timeStr}]</span>
                <span className={color}>{log.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
