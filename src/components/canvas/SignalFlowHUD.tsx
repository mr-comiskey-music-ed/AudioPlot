import React, { useState } from 'react';
import { HighlightedSignalPath, SignalPathNode } from './signalPath';
import { MixerChannelState, PlacedGear } from '../../types';
import { getGearById } from '../../data/gearCatalog';
import { StudioIcon } from '../StudioIcons';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Radio,
  Sliders,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';

interface SignalFlowHUDProps {
  highlightedPath: HighlightedSignalPath | null;
  isHighlightEnabled: boolean;
  onToggleHighlight: () => void;
  onSelectGear: (instanceId: string | null) => void;
  onUpdateChannel?: (channelNumber: number, updates: Partial<MixerChannelState>) => void;
  mixerChannels: MixerChannelState[];
  placedGear: PlacedGear[];
}

export const SignalFlowHUD: React.FC<SignalFlowHUDProps> = ({
  highlightedPath,
  isHighlightEnabled,
  onToggleHighlight,
  onSelectGear,
  onUpdateChannel,
  mixerChannels,
  placedGear,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!highlightedPath) return null;

  const targetGear = placedGear.find((g) => g.instanceId === highlightedPath.selectedGearId);
  const targetDef = targetGear ? getGearById(targetGear.gearId) : null;
  const primaryChannelNum = Array.from(highlightedPath.mixerChannelNumbers)[0];
  const primaryChannel = primaryChannelNum
    ? mixerChannels.find((c) => c.channelNumber === primaryChannelNum)
    : null;

  return (
    <div
      id="signal-flow-hud-container"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-[98vw] w-max animate-in fade-in slide-in-from-bottom-3 duration-200"
    >
      <div className="bg-stone-950/95 backdrop-blur-2xl border-2 border-cyan-500/40 hover:border-cyan-400/70 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8),0_0_20px_rgba(6,182,212,0.2)] px-3 py-1.5 text-stone-200 transition-all">
        {/* Header Row */}
        <div className="flex items-center justify-between gap-4 pb-1 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping absolute opacity-75" />
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black tracking-wider uppercase text-cyan-300 flex items-center gap-1">
                <Activity className="w-3 h-3 text-cyan-400 animate-pulse" />
                <span>Signal Path:</span>
              </span>
              <span className="text-xs font-black text-stone-100 max-w-[180px] sm:max-w-none truncate">
                {targetDef?.name || 'Selected Equipment'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Signal Health Status Badge */}
            <div
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                highlightedPath.health === 'healthy'
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                  : highlightedPath.health === 'warning'
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                  : highlightedPath.health === 'muted'
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                  : 'bg-white/10 border-white/20 text-stone-400'
              }`}
            >
              {highlightedPath.health === 'healthy' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
              {highlightedPath.health === 'warning' && <AlertTriangle className="w-3 h-3 text-amber-400" />}
              {highlightedPath.health === 'muted' && <VolumeX className="w-3 h-3 text-rose-400" />}
              {highlightedPath.health === 'unpatched' && <Radio className="w-3 h-3 text-stone-400" />}
              <span className="capitalize">{highlightedPath.health}</span>
            </div>

            {/* Highlight Signal Path Toggle Button */}
            <button
              id="btn-toggle-signal-highlight"
              onClick={onToggleHighlight}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                isHighlightEnabled
                  ? 'bg-cyan-500 border-cyan-400 text-stone-950 font-black shadow-[0_0_12px_rgba(6,182,212,0.5)] ring-1 ring-cyan-300'
                  : 'bg-white/5 hover:bg-white/15 border-white/10 text-stone-400 hover:text-stone-200'
              }`}
              title={
                isHighlightEnabled
                  ? 'Signal Path Highlight is ON (Tracing cables and mixer flow)'
                  : 'Click to Highlight Signal Path in glowing neon'
              }
            >
              {isHighlightEnabled ? (
                <>
                  <Eye className="w-3 h-3 fill-current" />
                  <span>Tracing ON</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3 h-3" />
                  <span>Highlight</span>
                </>
              )}
            </button>

            {/* Expand / Minimize Toggle */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded-md bg-white/5 hover:bg-white/15 text-stone-400 hover:text-white transition-colors cursor-pointer"
              title={isExpanded ? 'Minimize HUD' : 'Expand HUD'}
            >
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Interactive Step Breadcrumbs Bar */}
        {isExpanded && (
          <div className="pt-1.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin scrollbar-thumb-stone-700">
              {highlightedPath.nodes.map((node, idx) => {
                const isSelected = targetGear?.instanceId === node.id;
                const isClickable = !node.id.startsWith('dest_');

                return (
                  <React.Fragment key={node.id}>
                    {idx > 0 && (
                      <div className="flex items-center gap-1 text-stone-500 shrink-0">
                        <ArrowRight className="w-3 h-3 text-cyan-400/80 animate-pulse" />
                      </div>
                    )}

                    <button
                      onClick={() => {
                        if (isClickable) {
                          if (node.id.startsWith('snake_in_') || node.id.startsWith('mixer_ch_')) {
                            // Focus primary gear or stay on current
                          } else {
                            onSelectGear(node.id);
                          }
                        }
                      }}
                      className={`px-2 py-1 rounded-lg border flex items-center gap-1.5 shrink-0 transition-all text-left group ${
                        isSelected
                          ? 'bg-cyan-500/25 border-cyan-400 text-cyan-100 ring-1 ring-cyan-400/60 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                          : isClickable
                          ? 'bg-white/5 hover:bg-white/15 border-white/10 hover:border-cyan-400/50 text-stone-300 hover:text-stone-100 cursor-pointer'
                          : 'bg-white/5 border-white/10 text-stone-300 cursor-default'
                      }`}
                      title={node.statusText || node.label}
                    >
                      {/* Step Stage Number Badge */}
                      <span className="w-3.5 h-3.5 rounded-full bg-black/50 border border-white/20 flex items-center justify-center text-[9px] font-mono font-bold text-cyan-400 shrink-0">
                        {idx + 1}
                      </span>

                      <div className="flex flex-col min-w-0">
                        <div className="text-[11px] font-bold text-stone-100 truncate max-w-[120px] flex items-center gap-1">
                          <span>{node.label}</span>
                        </div>
                        {node.subLabel && (
                          <div className="text-[8px] text-stone-400 font-mono truncate max-w-[120px]">
                            {node.subLabel}
                          </div>
                        )}
                      </div>

                      {node.status === 'warning' && (
                        <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                      )}
                      {node.status === 'muted' && (
                        <VolumeX className="w-3 h-3 text-rose-400 shrink-0" />
                      )}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Signal Diagnosis & Quick Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-300 pt-0.5 border-t border-white/5">
              <div className="flex items-center gap-1.5">
                <span className="text-stone-400">Diagnosis:</span>
                <span
                  className={`font-semibold ${
                    highlightedPath.health === 'healthy'
                      ? 'text-emerald-400'
                      : highlightedPath.health === 'warning'
                      ? 'text-amber-400'
                      : highlightedPath.health === 'muted'
                      ? 'text-rose-400'
                      : 'text-stone-400'
                  }`}
                >
                  {highlightedPath.healthMessage}
                </span>
              </div>

              {/* Contextual Quick Actions */}
              <div className="flex items-center gap-2">
                {/* Phantom Power Quick Fix */}
                {highlightedPath.health === 'warning' && primaryChannel && onUpdateChannel && (
                  <button
                    onClick={() => {
                      onUpdateChannel(primaryChannel.channelNumber, {
                        phantomPower: true,
                      });
                    }}
                    className="px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Zap className="w-3 h-3 fill-current" />
                    <span>Engage +48V</span>
                  </button>
                )}

                {/* Unmute Channel Quick Fix */}
                {highlightedPath.health === 'muted' && primaryChannel && onUpdateChannel && (
                  <button
                    onClick={() => {
                      onUpdateChannel(primaryChannel.channelNumber, {
                        muted: false,
                      });
                    }}
                    className="px-2 py-0.5 rounded-md bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 text-rose-300 text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>Unmute CH {primaryChannel.channelNumber}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
