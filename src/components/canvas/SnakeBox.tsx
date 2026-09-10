import React, { useState, useEffect, useRef } from 'react';
import { CableConnection, EnvironmentMode, MixerChannelState, PlacedGear } from '../../types';
import { getGearById } from '../../data/gearCatalog';
import { AlertTriangle } from 'lucide-react';

interface SnakeBoxProps {
  environment: EnvironmentMode;
  mixerChannels: MixerChannelState[];
  placedGear: PlacedGear[];
  connections: CableConnection[];
  onStartCableDragFromSnakeChannel: (e: React.MouseEvent, chNum: number) => void;
  onConnectToSnakeChannel: (chNum: number) => void;
  onStartCableDragFromSnakeOutput: (e: React.MouseEvent, outPort: 'mon1' | 'mon2' | 'main_l' | 'main_r') => void;
  onConnectToSnakeOutput: (outPort: 'mon1' | 'mon2' | 'main_l' | 'main_r') => void;
  highlightedSnakeChannels?: Set<number>;
  highlightedSnakeOutputs?: Set<string>;
  isHighlightPathActive?: boolean;
  errorNotification?: { title: string; message: string } | null;
  onDismissError?: () => void;
}

export const SnakeBox: React.FC<SnakeBoxProps> = ({
  environment,
  mixerChannels,
  placedGear,
  connections,
  onStartCableDragFromSnakeChannel,
  onConnectToSnakeChannel,
  onStartCableDragFromSnakeOutput,
  onConnectToSnakeOutput,
  highlightedSnakeChannels,
  highlightedSnakeOutputs,
  isHighlightPathActive = false,
  errorNotification,
}) => {
  const [displayedError, setDisplayedError] = useState<{ title: string; message: string } | null>(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const timerRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (errorNotification) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);

      setDisplayedError(errorNotification);
      setIsFadingOut(false);

      // 3 seconds visible, then 1 second dissolve
      timerRef.current = window.setTimeout(() => {
        setIsFadingOut(true);
        fadeTimerRef.current = window.setTimeout(() => {
          setDisplayedError(null);
        }, 1000); // 1 second dissolve duration
      }, 3000); // 3 seconds display time
    } else {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
      setIsFadingOut(true);
      fadeTimerRef.current = window.setTimeout(() => {
        setDisplayedError(null);
      }, 300);
    }

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
    };
  }, [errorNotification]);

  return (
    <div
      id="stage-snake-box"
      onClick={(e) => e.stopPropagation()}
      className={`absolute z-30 bg-stone-950/90 backdrop-blur-2xl border-2 border-orange-500/40 rounded-2xl shadow-2xl text-stone-200 select-none top-4 left-1/2 -translate-x-1/2 ${
        environment === 'live_stage'
          ? 'w-[500px] p-3'
          : 'w-[336px] p-2.5'
      }`}
    >
      {displayedError && (
        <div
          className={`absolute inset-0 z-40 bg-stone-950/95 backdrop-blur-xl border-2 border-rose-500/90 rounded-2xl p-4 flex flex-col justify-center shadow-2xl transition-opacity duration-1000 ${
            isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 mt-0.5 shadow-[0_0_12px_rgba(244,63,94,0.4)]">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="font-black text-xs uppercase tracking-wide text-rose-200">
                {displayedError.title}
              </div>
              <div className="text-[11px] text-stone-300 mt-1 leading-relaxed">
                {displayedError.message}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className={`flex items-center justify-between border-b border-white/10 ${environment === 'live_stage' ? 'pb-1.5 mb-2' : 'pb-1 mb-1.5'}`}>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse shadow-[0_0_8px_#f97316]" />
          <span className={`font-black uppercase tracking-wider text-orange-300 ${environment === 'live_stage' ? 'text-xs' : 'text-[11px]'}`}>
            {environment === 'recording_studio' ? 'Studio Snake' : 'Stage Snake'}
          </span>
        </div>
        <span className="text-[8.5px] text-stone-400 font-mono">
          {environment === 'live_stage' ? '8 IN / 4 OUT' : 'XLR INPUTS'}
        </span>
      </div>

      {environment === 'live_stage' ? (
        <div className="grid grid-cols-12 gap-2">
          {/* Left Section: 8 XLR Inputs in 2 Rows of 4 */}
          <div className="col-span-7">
            <div className="text-[9px] font-bold text-orange-400/90 uppercase tracking-wide mb-1 flex items-center gap-1">
              <span>XLR Inputs</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {Array.from({ length: 8 }).map((_, idx) => {
                const chNum = idx + 1;
                const ch = mixerChannels.find((c) => c.channelNumber === chNum);
                const assignedGear = placedGear.find((g) => g.instanceId === ch?.assignedGearInstanceId);
                const assignedDef = assignedGear ? getGearById(assignedGear.gearId) : null;
                const isHighlighted = isHighlightPathActive && highlightedSnakeChannels?.has(chNum);

                return (
                  <button
                    key={chNum}
                    id={`snake-channel-socket-${chNum}`}
                    onMouseDown={(e) => onStartCableDragFromSnakeChannel(e, chNum)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onConnectToSnakeChannel(chNum);
                    }}
                    className={`p-1 rounded-lg border flex flex-col items-center justify-center transition-all relative group cursor-pointer ${
                      isHighlighted
                        ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 shadow-[0_0_16px_rgba(6,182,212,0.5)] ring-2 ring-cyan-400 animate-pulse'
                        : assignedGear
                        ? 'bg-orange-500/20 border-orange-500/60 text-orange-200 shadow-md ring-1 ring-orange-400/40'
                        : 'bg-white/5 hover:bg-white/15 border-white/10 hover:border-orange-400/50 text-stone-400 hover:text-stone-200'
                    }`}
                    title={
                      assignedGear
                        ? `Channel ${chNum}: Patched to ${assignedDef?.name || 'Input'}. Click or drag to repatch.`
                        : `Click or drag an XLR cable between Channel ${chNum} and a Microphone or DI Box`
                    }
                  >
                    {/* 3-pin XLR Female Socket Graphic */}
                    <svg width="18" height="18" viewBox="0 0 24 24" className="mb-0.5">
                      <circle cx="12" cy="12" r="10.5" fill="#18181B" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="12" cy="12" r="8.5" fill="#09090B" stroke="#3F3F46" strokeWidth="0.8" />
                      <rect x="10.5" y="2" width="3" height="2.5" rx="0.5" fill="currentColor" opacity="0.8" />
                      <circle cx="8" cy="9.5" r="1.4" fill="currentColor" />
                      <circle cx="16" cy="9.5" r="1.4" fill="currentColor" />
                      <circle cx="12" cy="15.5" r="1.4" fill="currentColor" />
                    </svg>
                    <div className="text-[8px] font-black leading-none">CH {chNum}</div>
                    <div className="text-[7.5px] truncate max-w-full font-mono text-stone-400 leading-tight">
                      {assignedGear ? ch?.label : 'OPEN'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Section: 4 XLR Outputs (Monitors & PA Returns) */}
          <div className="col-span-5 border-l border-white/10 pl-2">
            <div className="text-[9px] font-bold text-sky-400/90 uppercase tracking-wide mb-1 flex items-center gap-1">
              <span>XLR Outputs (Mixer Returns)</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {[
                { id: 'mon1', label: 'MON 1 (Aux 1)', socketId: 'snake_out_mon1' },
                { id: 'mon2', label: 'MON 2 (Aux 2)', socketId: 'snake_out_mon2' },
                { id: 'main_l', label: 'MAIN L (FOH)', socketId: 'snake_out_main_l' },
                { id: 'main_r', label: 'MAIN R (FOH)', socketId: 'snake_out_main_r' },
              ].map((out) => {
                const conn = connections.find(
                  (c) => c.fromInstanceId === out.socketId || c.toInstanceId === out.socketId
                );
                const connectedGearId = conn
                  ? conn.fromInstanceId === out.socketId
                    ? conn.toInstanceId
                    : conn.fromInstanceId
                  : null;
                const connectedGear = connectedGearId
                  ? placedGear.find((g) => g.instanceId === connectedGearId)
                  : null;
                const connectedDef = connectedGear ? getGearById(connectedGear.gearId) : null;
                const isOutHighlighted = isHighlightPathActive && highlightedSnakeOutputs?.has(out.socketId);

                return (
                  <button
                    key={out.id}
                    id={`snake-output-socket-${out.id}`}
                    onMouseDown={(e) => onStartCableDragFromSnakeOutput(e, out.id as any)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onConnectToSnakeOutput(out.id as any);
                    }}
                    className={`p-1 rounded-lg border flex flex-col items-center justify-center transition-all relative group cursor-pointer ${
                      isOutHighlighted
                        ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 shadow-[0_0_16px_rgba(6,182,212,0.5)] ring-2 ring-cyan-400 animate-pulse'
                        : connectedGear
                        ? 'bg-sky-500/20 border-sky-500/60 text-sky-200 shadow-md ring-1 ring-sky-400/40'
                        : 'bg-white/5 hover:bg-white/15 border-white/10 hover:border-sky-400/50 text-stone-400 hover:text-stone-200'
                    }`}
                    title={
                      connectedGear
                        ? `${out.label}: Connected to ${connectedDef?.name || 'Speaker/Monitor'}. Click or drag to repatch.`
                        : `Click or drag an XLR cable between ${out.label} and a Stage Monitor or PA Speaker`
                    }
                  >
                    {/* 3-pin XLR Male Socket Graphic (with pins) */}
                    <svg width="18" height="18" viewBox="0 0 24 24" className="mb-0.5">
                      <circle cx="12" cy="12" r="10.5" fill="#18181B" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="12" cy="12" r="8.5" fill="#09090B" stroke="#3F3F46" strokeWidth="0.8" />
                      <circle cx="8" cy="9.5" r="1.8" fill="#F59E0B" stroke="#000" strokeWidth="0.5" />
                      <circle cx="16" cy="9.5" r="1.8" fill="#F59E0B" stroke="#000" strokeWidth="0.5" />
                      <circle cx="12" cy="15.5" r="1.8" fill="#F59E0B" stroke="#000" strokeWidth="0.5" />
                    </svg>
                    <div className="text-[7.5px] font-black leading-none">{out.id.toUpperCase()}</div>
                    <div className="text-[7px] truncate max-w-full font-mono text-stone-400 leading-tight">
                      {connectedGear ? connectedDef?.name : 'OPEN'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Recording Studio Layout: 8 Channel Inputs */
        <div className="grid grid-cols-4 gap-1.5">
          {Array.from({ length: 8 }).map((_, idx) => {
            const chNum = idx + 1;
            const ch = mixerChannels.find((c) => c.channelNumber === chNum);
            const assignedGear = placedGear.find((g) => g.instanceId === ch?.assignedGearInstanceId);
            const assignedDef = assignedGear ? getGearById(assignedGear.gearId) : null;
            const isHighlighted = isHighlightPathActive && highlightedSnakeChannels?.has(chNum);

            return (
              <button
                key={chNum}
                id={`snake-channel-socket-${chNum}`}
                onMouseDown={(e) => onStartCableDragFromSnakeChannel(e, chNum)}
                onClick={(e) => {
                  e.stopPropagation();
                  onConnectToSnakeChannel(chNum);
                }}
                className={`p-1.5 rounded-lg border flex flex-col items-center justify-center transition-all relative group cursor-pointer ${
                  isHighlighted
                    ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 shadow-[0_0_16px_rgba(6,182,212,0.5)] ring-2 ring-cyan-400 animate-pulse'
                    : assignedGear
                    ? 'bg-orange-500/20 border-orange-500/60 text-orange-200 shadow-md ring-1 ring-orange-400/40'
                    : 'bg-white/5 hover:bg-white/15 border-white/10 hover:border-orange-400/50 text-stone-400 hover:text-stone-200'
                }`}
                title={
                  assignedGear
                    ? `Channel ${chNum}: Patched to ${assignedDef?.name || 'Input'}. Click or drag to repatch.`
                    : `Click or drag an XLR cable between Channel ${chNum} and a Microphone or DI Box`
                }
              >
                <svg width="20" height="20" viewBox="0 0 24 24" className="mb-0.5">
                  <circle cx="12" cy="12" r="10.5" fill="#18181B" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="12" cy="12" r="8.5" fill="#09090B" stroke="#3F3F46" strokeWidth="0.8" />
                  <rect x="10.5" y="2" width="3" height="2.5" rx="0.5" fill="currentColor" opacity="0.8" />
                  <circle cx="8" cy="9.5" r="1.4" fill="currentColor" />
                  <circle cx="16" cy="9.5" r="1.4" fill="currentColor" />
                  <circle cx="12" cy="15.5" r="1.4" fill="currentColor" />
                </svg>
                <div className="text-[8.5px] font-black leading-none">CH {chNum}</div>
                <div className="text-[7.5px] truncate max-w-full font-mono text-stone-400 leading-tight">
                  {assignedGear ? ch?.label : 'OPEN'}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
