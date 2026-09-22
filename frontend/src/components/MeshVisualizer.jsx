import React from 'react';
import { Smartphone, Wifi, WifiOff, Box, ArrowRight } from 'lucide-react';

export const MeshVisualizer = ({ devices = [] }) => {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">Mesh Devices Simulation</h2>
          <p className="text-xs text-slate-400">
            Simulated Bluetooth LE mesh. Packets hop between offline devices until reaching a 4G bridge.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-slate-500" /> Offline (Basement)
          </span>
          <span className="flex items-center gap-1 text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> 4G Bridge (Outdoor)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {devices.map((device) => {
          const isBridge = device.hasInternet;
          const hasPackets = device.packetCount > 0;

          return (
            <div
              key={device.deviceId}
              className={`rounded-xl p-4 border transition-all relative overflow-hidden ${
                isBridge
                  ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm shadow-emerald-950/40'
                  : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div
                  className={`p-2 rounded-lg border ${
                    isBridge
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-slate-800/50 border-slate-700/50 text-slate-400'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                </div>

                <div
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    isBridge
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {isBridge ? (
                    <>
                      <Wifi className="w-3 h-3 text-emerald-400" />
                      <span>4G Bridge</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3 h-3 text-slate-500" />
                      <span>Offline</span>
                    </>
                  )}
                </div>
              </div>

              {/* Device ID */}
              <h3 className="text-xs font-semibold text-white tracking-wide mb-1 font-mono">
                {device.deviceId}
              </h3>

              {/* Packet Count */}
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/60 text-xs">
                <span className="text-slate-400 text-[11px] flex items-center gap-1">
                  <Box className="w-3 h-3 text-slate-500" /> Holding:
                </span>
                <span
                  className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${
                    hasPackets
                      ? isBridge
                        ? 'bg-emerald-500 text-emerald-950 animate-pulse'
                        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-500 bg-slate-900'
                  }`}
                >
                  {device.packetCount} packet{device.packetCount !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Packet IDs */}
              <div className="mt-2 min-h-[32px] flex flex-wrap gap-1">
                {device.packetIds && device.packetIds.length > 0 ? (
                  device.packetIds.map((id) => (
                    <span
                      key={id}
                      className="inline-block font-mono text-[10px] bg-slate-900 text-cyan-300 border border-cyan-900/50 px-1.5 py-0.5 rounded"
                    >
                      {id}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-slate-600 italic py-1">Buffer empty</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
