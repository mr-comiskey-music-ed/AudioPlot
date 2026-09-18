import React, { useState, useEffect, useRef } from 'react';
import {
  Sliders,
  Zap,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Cable,
  Check,
  AlertTriangle,
  Activity,
  Maximize2,
  Radio,
  ClipboardList,
} from 'lucide-react';
import {
  MixerChannelState,
  PlacedGear,
  EnvironmentMode,
  CableConnection,
  MasterBusState,
} from '../types';
import { getGearById } from '../data/gearCatalog';
import { validateChannelSignalChain } from '../services/gradingEngine';
import { audioEngine } from '../services/audioEngine';

import { ChannelOscilloscopeViewer, trimToPreampDb } from './ChannelOscilloscopeViewer';
import { MasterMixMeter } from './MasterMixMeter';

interface MixerConsoleProps {
  environment: EnvironmentMode;
  channels: MixerChannelState[];
  placedGear: PlacedGear[];
  connections?: CableConnection[];
  onUpdateChannel: (channelNumber: number, updates: Partial<MixerChannelState>) => void;
  onPatchGearToChannel: (gearInstanceId: string, channelNumber: number) => void;
  onUnpatchChannel: (channelNumber: number) => void;
  isPlayingAudio: boolean;
  onToggleSoundcheck: () => void;
  selectedGearId?: string | null;
  masterBus?: MasterBusState;
  onUpdateMasterBus?: (updates: Partial<MasterBusState>) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

// Convert 0..100 fader position to accurate audio decibels (-∞ to +6dB)
const faderToDb = (val: number): string => {
  if (val <= 0) return '-∞ dB';
  if (val === 75) return '0.0 dB';
  if (val > 75) {
    const db = ((val - 75) / 25) * 6;
    return `+${db.toFixed(1)} dB`;
  }
  const db = ((val - 75) / 75) * 48;
  return `${db.toFixed(1)} dB`;
};

// Preamp Gain Trim knob (Default: 50 / 0.0dB Unity, 0: -24dB, 100: +24dB)
interface GainTrimKnobProps {
  value: number; // 0 to 100
  onChange: (newVal: number) => void;
}

const GainTrimKnob: React.FC<GainTrimKnobProps> = ({ value = 50, onChange }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dragStartY = React.useRef(0);
  const startVal = React.useRef(50);

  const UNITY_VAL = 72;
  // Map 0..100 to -135deg..+135deg with unity (72) at +60deg (2 o'clock)
  const angle = value <= UNITY_VAL
    ? -135 + (value / UNITY_VAL) * (60 - (-135))
    : 60 + ((value - UNITY_VAL) / (100 - UNITY_VAL)) * (135 - 60);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    startVal.current = value;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = dragStartY.current - moveEvent.clientY;
      const deltaVal = Math.round(deltaY / 1.5);
      const nextVal = Math.max(0, Math.min(100, startVal.current + deltaVal));
      onChange(nextVal);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    dragStartY.current = e.touches[0].clientY;
    startVal.current = value;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length !== 1) return;
      if (moveEvent.cancelable) moveEvent.preventDefault();
      const deltaY = dragStartY.current - moveEvent.touches[0].clientY;
      const deltaVal = Math.round(deltaY / 1.5);
      const nextVal = Math.max(0, Math.min(100, startVal.current + deltaVal));
      onChange(nextVal);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
  };

  const handleDoubleClick = () => {
    onChange(72);
  };

  const isInteracting = isDragging || isHovered;
  const dbText = trimToPreampDb(value);
  const isHot = value > 80;

  return (
    <div
      className="flex flex-col items-center select-none my-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={`Preamp Trim: ${dbText} (Drag up/down to adjust gain staging, double click to reset to 0.0 dB)`}
    >
      <div className="w-full flex justify-center items-center h-3 text-[8px] font-bold uppercase mb-0.5">
        {isInteracting ? (
          <span className={`font-mono text-[8px] font-black ${isHot ? 'text-rose-400' : 'text-orange-400'}`}>
            {dbText}
          </span>
        ) : (
          <span className="text-stone-400">GAIN</span>
        )}
      </div>
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={handleDoubleClick}
        className={`w-7 h-7 rounded-full bg-stone-900 border-2 flex items-center justify-center cursor-ns-resize shadow-md transition-all relative ${
          isDragging
            ? 'border-orange-400 ring-2 ring-orange-400/40 shadow-orange-950/80 scale-105'
            : isHot
            ? 'border-rose-500 hover:border-rose-400'
            : 'border-stone-600 hover:border-orange-400/80'
        }`}
      >
        {/* Notch pointer line */}
        <div
          className={`absolute w-0.5 h-2.5 rounded-full top-0.5 ${
            isHot ? 'bg-rose-400 shadow-[0_0_4px_#fb7185]' : 'bg-orange-400 shadow-[0_0_4px_#fb923c]'
          }`}
          style={{
            transformOrigin: '50% 11px',
            transform: `rotate(${angle}deg)`,
          }}
        />
        {/* Center cap */}
        <div className="w-2.5 h-2.5 rounded-full bg-stone-800 border border-stone-600 pointer-events-none" />
      </div>
    </div>
  );
};

// Studio-style rotary pan knob (Default: 0 / 12 O'clock / C)
interface PanKnobProps {
  value: number; // -50 to +50
  onChange: (newVal: number) => void;
}

const PanKnob: React.FC<PanKnobProps> = ({ value, onChange }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dragStartY = React.useRef(0);
  const startVal = React.useRef(0);

  // Map -50..+50 to -135deg..+135deg (0 is 0deg / 12 o'clock)
  const angle = (value / 50) * 135;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    startVal.current = value;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = dragStartY.current - moveEvent.clientY;
      const deltaVal = Math.round(deltaY / 1.5);
      const nextVal = Math.max(-50, Math.min(50, startVal.current + deltaVal));
      onChange(nextVal);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    dragStartY.current = e.touches[0].clientY;
    startVal.current = value;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length !== 1) return;
      if (moveEvent.cancelable) moveEvent.preventDefault();
      const deltaY = dragStartY.current - moveEvent.touches[0].clientY;
      const deltaVal = Math.round(deltaY / 1.5);
      const nextVal = Math.max(-50, Math.min(50, startVal.current + deltaVal));
      onChange(nextVal);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
  };

  const handleDoubleClick = () => {
    onChange(0);
  };

  const isInteracting = isDragging || isHovered;
  const label = value === 0 ? 'C' : value < 0 ? `L${Math.abs(value)}` : `R${value}`;
  const labelColor = value === 0 ? 'text-stone-300' : value < 0 ? 'text-sky-300' : 'text-amber-300';

  return (
    <div
      className="flex flex-col items-center select-none my-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={`Pan: ${value === 0 ? 'Center (12 o\'clock)' : value < 0 ? `Left ${Math.abs(value)}` : `Right ${value}`} (Drag up/down or double click to center)`}
    >
      <div className="w-full flex justify-center items-center h-3 text-[8px] font-bold uppercase mb-0.5">
        {isInteracting ? (
          <span className={`font-mono text-[8px] font-black ${labelColor}`}>{label}</span>
        ) : (
          <span className="text-stone-400">PAN</span>
        )}
      </div>
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={handleDoubleClick}
        className={`w-7 h-7 rounded-full bg-stone-900 border-2 flex items-center justify-center cursor-ns-resize shadow-md transition-all relative ${
          isDragging
            ? 'border-sky-400 ring-2 ring-sky-400/40 shadow-sky-950/80 scale-105'
            : 'border-stone-600 hover:border-sky-400/80'
        }`}
      >
        {/* Notch pointer line */}
        <div
          className="absolute w-0.5 h-2.5 bg-sky-400 rounded-full top-0.5 shadow-[0_0_4px_#38bdf8]"
          style={{
            transformOrigin: '50% 11px',
            transform: `rotate(${angle}deg)`,
          }}
        />
        {/* Center cap */}
        <div className="w-2.5 h-2.5 rounded-full bg-stone-800 border border-stone-600 pointer-events-none" />
      </div>
    </div>
  );
};

export const MixerConsole: React.FC<MixerConsoleProps> = ({
  environment,
  channels,
  placedGear,
  connections = [],
  onUpdateChannel,
  onPatchGearToChannel,
  onUnpatchChannel,
  isPlayingAudio,
  onToggleSoundcheck,
  selectedGearId,
  masterBus,
  onUpdateMasterBus,
  isCollapsed: propIsCollapsed,
  onToggleCollapse,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(true);
  const isCollapsed = propIsCollapsed !== undefined ? propIsCollapsed : internalCollapsed;
  const setIsCollapsed = (val: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof val === 'function' ? val(isCollapsed) : val;
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed(nextVal);
    }
  };
  const [patchMenuChannel, setPatchMenuChannel] = useState<number | null>(null);
  const [selectedChannelNumber, setSelectedChannelNumber] = useState<number | 'master'>(1);
  const [showOscilloscopeDeck, setShowOscilloscopeDeck] = useState<boolean>(false);
  const [localFaders, setLocalFaders] = useState<Record<number, number>>({});
  const [localMasterFader, setLocalMasterFader] = useState<number | null>(null);

  const defaultMasterBus: MasterBusState = {
    fader: 75,
    gain: 50,
    pan: 0,
    muted: false,
    dim: false,
    mono: false,
  };
  const effectiveMaster: MasterBusState = masterBus || defaultMasterBus;

  const handleUpdateMaster = (updates: Partial<MasterBusState>) => {
    if (onUpdateMasterBus) {
      onUpdateMasterBus(updates);
    }
    audioEngine.setMasterBusState(updates);
  };

  // Sync selected channel when gear is clicked on the floor/stage
  useEffect(() => {
    if (selectedGearId) {
      const match = channels.find((c) => c.assignedGearInstanceId === selectedGearId);
      if (match) {
        setSelectedChannelNumber(match.channelNumber);
      }
    }
  }, [selectedGearId, channels]);

  // Available gear that can be patched (Mics, DIs, Instruments)
  const patchableGear = placedGear.filter((g) => {
    const def = getGearById(g.gearId);
    return def?.category === 'microphone' || def?.category === 'di_box' || def?.category === 'instrument';
  });

  // Check if any channel is in solo mode
  const hasAnySolo = channels.some((c) => c.solo);

  // Master bus checks if any audible channel has a valid, unbroken signal chain
  const hasAnyValidAudibleSignal = channels.some((c) => {
    const isAud = (hasAnySolo ? c.solo && !c.muted : !c.muted) && c.fader > 5;
    if (!isAud) return false;
    const sig = validateChannelSignalChain(c, placedGear, connections, channels, environment);
    return sig.hasSignal;
  });

  const isMasterAudible = hasAnyValidAudibleSignal && !effectiveMaster.muted && effectiveMaster.fader > 5;

  const getInstrumentBaseLevel = (gearId: string | undefined): number => {
    if (!gearId) return 0.7;
    if (gearId.includes('drum') || gearId.includes('bass')) return 0.9;
    if (gearId.includes('voice') || gearId.includes('electric_guitar') || gearId.includes('keyboard')) return 0.8;
    if (gearId.includes('acoustic') || gearId.includes('violin') || gearId.includes('flute') || gearId.includes('saxophone')) return 0.65;
    return 0.75;
  };

  const [channelMeterLevels, setChannelMeterLevels] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);
  const channelAnimRef = useRef<number | null>(null);

  useEffect(() => {
    let lastTime = performance.now();

    const updateChannelMeters = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (!isPlayingAudio) {
        setChannelMeterLevels([0, 0, 0, 0, 0, 0, 0, 0]);
      } else {
        const newLevels = channels.map((ch, idx) => {
          const assignedGear = placedGear.find((g) => g.instanceId === ch.assignedGearInstanceId);
          const channelSignal = validateChannelSignalChain(ch, placedGear, connections, channels, environment);
          const isAudible = (hasAnySolo ? ch.solo && !ch.muted : !ch.muted) && ch.fader > 5;

          if (!isAudible || !channelSignal.hasSignal || !assignedGear) {
            return 0;
          }

          const rawTrim = ch.gain !== undefined ? ch.gain : 50;
          const trimMult = rawTrim <= 50 ? rawTrim / 50 : 1 + ((rawTrim - 50) / 50) * 1.5;
          const baseLoudness = getInstrumentBaseLevel(assignedGear.gearId);
          const faderRatio = ch.fader / 100;

          // Target level determined by audio initial level, gain knob, and volume fader
          const targetLevel = Math.min(100, Math.max(10, faderRatio * 85 * trimMult * baseLoudness));
          
          // Organic real-time audio animation wave responding to volume level
          const wave = Math.sin(now / 85 + idx * 2.3) * 16 + Math.cos(now / 55 + idx * 1.5) * 10 + (Math.random() - 0.5) * 10;
          const currentLevel = Math.min(100, Math.max(5, targetLevel + wave * (targetLevel / 100)));
          return currentLevel;
        });

        setChannelMeterLevels(newLevels);
      }

      channelAnimRef.current = requestAnimationFrame(updateChannelMeters);
    };

    channelAnimRef.current = requestAnimationFrame(updateChannelMeters);

    return () => {
      if (channelAnimRef.current !== null) {
        cancelAnimationFrame(channelAnimRef.current);
      }
    };
  }, [isPlayingAudio, channels, placedGear, connections, environment, hasAnySolo]);

  return (
    <footer
      id="mixer-console-container"
      className="bg-black/85 backdrop-blur-2xl border-t border-white/10 text-stone-100 shadow-2xl z-30 select-none transition-all duration-200 shrink-0"
    >
      {/* Console Top Header Strip */}
      <div
        id="mixer-console-header-strip"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="px-4 py-2 bg-black/30 hover:bg-black/50 cursor-pointer backdrop-blur-md border-b border-white/10 flex items-center justify-between text-xs transition-colors group"
        title={isCollapsed ? 'Click anywhere to expand Mixer & Audio Interface' : 'Click anywhere to collapse Mixer'}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
          <span className="font-extrabold uppercase tracking-wider text-stone-200 flex items-center gap-1.5 group-hover:text-white transition-colors">
            <Sliders className="w-3.5 h-3.5 text-orange-400" />
            Studio Console/Mixer, Advanced Metering, & Equipment List
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Oscilloscope Toggle Button */}
          <button
            id="btn-toggle-scope-deck"
            onClick={(e) => {
              e.stopPropagation();
              if (isCollapsed) {
                setIsCollapsed(false);
                setShowOscilloscopeDeck(true);
              } else {
                setShowOscilloscopeDeck((prev) => !prev);
              }
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all flex items-center gap-1.5 backdrop-blur-md cursor-pointer ${
              showOscilloscopeDeck && !isCollapsed
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-sm'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-stone-400 hover:text-stone-200'
            }`}
            title="Toggle Real-Time Oscilloscope & Equipment List"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Oscilloscope & Equipment List</span>
            <ClipboardList className="w-3.5 h-3.5 text-orange-400 ml-0.5" />
          </button>

          {/* Soundcheck Playback Button */}
          <button
            id="btn-soundcheck-console"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSoundcheck();
            }}
            className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all flex items-center gap-1.5 backdrop-blur-md cursor-pointer ${
              isPlayingAudio
                ? 'bg-emerald-500 border-emerald-400 text-stone-950 animate-pulse shadow-md shadow-emerald-950/40'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-stone-300 hover:text-white'
            }`}
          >
            {isPlayingAudio ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-stone-400" />}
            <span>{isPlayingAudio ? 'Sound Check ON' : 'Sound Check'}</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-stone-400 hover:text-stone-200 border border-white/10 transition-all group-hover:border-white/20 cursor-pointer"
            title={isCollapsed ? 'Expand Mixer' : 'Collapse Mixer'}
          >
            {isCollapsed ? <ChevronUp className="w-3.5 h-3.5 text-orange-400" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded Console View (Oscilloscope Inspector + 8-Channel Hardware Strips) */}
      {!isCollapsed && (
        <div className="p-3 space-y-3 max-h-[85vh] overflow-y-auto">
          {/* Top Section: Real-Time Oscilloscope & Signal Flow Inspector for Selected Channel */}
          {showOscilloscopeDeck && (
            <ChannelOscilloscopeViewer
              selectedChannelNumber={selectedChannelNumber}
              onSelectChannel={setSelectedChannelNumber}
              channels={channels}
              placedGear={placedGear}
              connections={connections}
              environment={environment}
              isPlayingAudio={isPlayingAudio}
              onUpdateChannel={onUpdateChannel}
              masterBus={effectiveMaster}
              onUpdateMasterBus={handleUpdateMaster}
              onToggleSoundcheck={onToggleSoundcheck}
            />
          )}

          {/* Bottom Section: 8 Channel Strips + Master Stereo Bus */}
          <div className="overflow-x-auto pb-1">
            <div className="flex items-stretch gap-2.5 min-w-max">
              {/* 8 Channel Strips */}
              {channels.map((ch, idx) => {
                const isSelected = selectedChannelNumber === ch.channelNumber;
                const assignedGear = placedGear.find((g) => g.instanceId === ch.assignedGearInstanceId);
                const assignedDef = assignedGear ? getGearById(assignedGear.gearId) : null;

                // Validate signal chain for this specific channel
                const channelSignal = validateChannelSignalChain(ch, placedGear, connections, channels, environment);
                const isAudible = (hasAnySolo ? ch.solo && !ch.muted : !ch.muted) && ch.fader > 5;

                // Visual VU meter bars only light up if audio is playing, channel is audible, and signal chain is intact!
                const rawTrim = ch.gain !== undefined ? ch.gain : 50;
                const trimMult = rawTrim <= 50 ? rawTrim / 50 : 1 + ((rawTrim - 50) / 50) * 1.5;
                const level = isPlayingAudio && isAudible && channelSignal.hasSignal
                  ? channelMeterLevels[idx]
                  : 0;
                const meterSegments = 8;
                const activeSegments = Math.round((level / 100) * meterSegments);

                const hasChainError = assignedGear && !channelSignal.hasSignal;

                return (
                  <div
                    key={ch.channelNumber}
                    id={`channel-strip-${ch.channelNumber}`}
                    onClick={() => setSelectedChannelNumber(ch.channelNumber)}
                    className={`w-28 border rounded-2xl p-2.5 flex flex-col items-center justify-between shadow-inner relative transition-all backdrop-blur-lg cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-emerald-400 border-emerald-400 bg-emerald-500/[0.08] shadow-[0_0_12px_rgba(52,211,153,0.2)]'
                        : assignedGear
                        ? hasChainError
                          ? 'border-amber-500/40 bg-amber-500/[0.04] hover:border-amber-500/60'
                          : 'border-white/20 bg-white/[0.08] hover:border-white/40'
                        : 'border-white/10 opacity-75 hover:opacity-90 hover:border-white/20'
                    }`}
                  >
                    {/* Channel Number & Scope Selection Badge */}
                    <div className="w-full flex items-center justify-between text-[10px] font-black text-stone-400 border-b border-white/10 pb-1 mb-1.5">
                      <span className={isSelected ? 'text-emerald-400 font-extrabold' : ''}>
                        CH {ch.channelNumber}
                      </span>
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" title="Selected on Oscilloscope" />
                      )}
                      {hasChainError && (
                        <span
                          className="text-amber-400 flex items-center gap-0.5 cursor-help"
                          title={channelSignal.error || 'Signal chain error'}
                        >
                          <AlertTriangle className="w-3 h-3 animate-pulse" />
                        </span>
                      )}
                    </div>

                    {/* XLR Input Port (Interactive Patch Point) */}
                    <div className="relative my-0.5">
                      <button
                        id={`btn-xlr-port-${ch.channelNumber}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPatchMenuChannel(patchMenuChannel === ch.channelNumber ? null : ch.channelNumber);
                        }}
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all shadow-md cursor-pointer ${
                          assignedGear
                            ? hasChainError
                              ? 'border-amber-500 bg-amber-500/10 text-amber-400 ring-2 ring-amber-500/30'
                              : 'border-orange-500 bg-white/10 text-orange-400 ring-2 ring-orange-500/30'
                            : 'border-white/20 bg-white/5 text-stone-400 hover:border-white/40 hover:text-white'
                        }`}
                        title={
                          assignedGear
                            ? hasChainError
                              ? `${assignedDef?.name} (${channelSignal.error})`
                              : `Patched to ${assignedDef?.name}`
                            : 'Click to Patch a Mic or DI line'
                        }
                      >
                        <Cable className="w-4 h-4" />
                      </button>

                      {/* Patch dropdown modal */}
                      {patchMenuChannel === ch.channelNumber && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute bottom-10 left-1/2 -translate-x-1/2 w-48 bg-stone-900/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl p-2 z-50 text-xs"
                        >
                          <div className="font-bold text-orange-400 border-b border-white/10 pb-1 mb-1.5 flex justify-between items-center">
                            <span>Patch to Ch {ch.channelNumber}</span>
                            <button
                              onClick={() => setPatchMenuChannel(null)}
                              className="text-stone-400 hover:text-white text-[10px] cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>

                          {patchableGear.length === 0 ? (
                            <div className="text-[11px] text-stone-400 py-2 text-center">
                              Place mics or instruments on the floor first.
                            </div>
                          ) : (
                            <div className="max-h-40 overflow-y-auto space-y-1">
                              {patchableGear.map((item) => {
                                const d = getGearById(item.gearId);
                                const isCurrentlyAssigned = ch.assignedGearInstanceId === item.instanceId;

                                return (
                                  <button
                                    key={item.instanceId}
                                    onClick={() => {
                                      onPatchGearToChannel(item.instanceId, ch.channelNumber);
                                      setPatchMenuChannel(null);
                                    }}
                                    className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] flex items-center justify-between transition-colors cursor-pointer ${
                                      isCurrentlyAssigned
                                        ? 'bg-orange-500 text-stone-950 font-bold'
                                        : 'hover:bg-white/10 text-stone-300'
                                    }`}
                                  >
                                    <span className="truncate">{d?.name}</span>
                                    {isCurrentlyAssigned && <Check className="w-3 h-3" />}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {assignedGear && (
                            <button
                              onClick={() => {
                                onUnpatchChannel(ch.channelNumber);
                                setPatchMenuChannel(null);
                              }}
                              className="w-full mt-2 pt-1 border-t border-white/10 text-rose-400 hover:text-rose-300 text-[10px] text-center block font-bold cursor-pointer"
                            >
                              Unpatch Channel
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Scribble Strip (Channel Name) */}
                    <input
                      type="text"
                      value={ch.label}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onUpdateChannel(ch.channelNumber, { label: e.target.value })}
                      placeholder={`Ch ${ch.channelNumber}`}
                      className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/10 focus:border-orange-400/80 rounded-lg px-1.5 py-0.5 text-[10px] font-bold text-center text-orange-300 outline-none backdrop-blur-md truncate transition-all mb-1"
                    />



                    {/* Preamp Input Gain Trim Knob (Gain Staging) */}
                    <GainTrimKnob
                      value={ch.gain !== undefined ? ch.gain : 50}
                      onChange={(newGain) => onUpdateChannel(ch.channelNumber, { gain: newGain })}
                    />

                    {/* +48V Phantom Power Toggle Button */}
                    <div className="my-0.5 flex flex-col items-center">
                      <button
                        id={`btn-phantom-${ch.channelNumber}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateChannel(ch.channelNumber, { phantomPower: !ch.phantomPower });
                        }}
                        className={`px-2.5 py-0.5 rounded-full text-[9px] font-black border transition-all flex items-center gap-1 backdrop-blur-md cursor-pointer ${
                          ch.phantomPower
                            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.4)] font-bold'
                            : 'bg-white/5 border-white/10 text-stone-400 hover:text-stone-200'
                        }`}
                        title={ch.phantomPower ? '+48V Power Active' : 'Toggle +48V Phantom Power for Condenser Mics'}
                      >
                        <Zap className={`w-2.5 h-2.5 ${ch.phantomPower ? 'fill-current' : ''}`} />
                        <span>+48V</span>
                      </button>
                    </div>

                    {/* Rotary Pan Knob Control */}
                    <PanKnob
                      value={ch.pan ?? 0}
                      onChange={(newPan) => onUpdateChannel(ch.channelNumber, { pan: newPan })}
                    />

                    {/* Mute and Solo Control Buttons */}
                    <div className="w-full flex items-center gap-1 my-1">
                      <button
                        id={`btn-mute-${ch.channelNumber}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateChannel(ch.channelNumber, { muted: !ch.muted });
                        }}
                        className={`flex-1 py-0.5 rounded-md text-[9px] font-black border transition-all backdrop-blur-md cursor-pointer ${
                          ch.muted
                            ? 'bg-rose-500 border-rose-400 text-stone-950 shadow-sm shadow-rose-950/50'
                            : 'bg-white/5 border-white/10 text-stone-400 hover:text-stone-200'
                        }`}
                        title={ch.muted ? 'Unmute Channel' : 'Mute Channel'}
                      >
                        MUTE
                      </button>
                      <button
                        id={`btn-solo-${ch.channelNumber}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateChannel(ch.channelNumber, { solo: !ch.solo });
                        }}
                        className={`flex-1 py-0.5 rounded-md text-[9px] font-black border transition-all backdrop-blur-md cursor-pointer ${
                          ch.solo
                            ? 'bg-amber-400 border-amber-300 text-stone-950 shadow-sm shadow-amber-950/60 ring-1 ring-amber-300/50 animate-pulse'
                            : 'bg-white/5 border-white/10 text-stone-400 hover:text-amber-300'
                        }`}
                        title={ch.solo ? 'Solo Active (Click to disable)' : 'Solo Channel'}
                      >
                        SOLO
                      </button>
                    </div>

                    {/* Fader & VU Meter Section with Decibel Readout */}
                    <div className="flex flex-col items-center w-full my-1" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[8px] font-mono font-bold text-stone-300 mb-0.5" title="Decibel Output Level">
                        {faderToDb(localFaders[ch.channelNumber] !== undefined ? localFaders[ch.channelNumber] : ch.fader)}
                      </span>
                      <div className="flex items-center gap-2 h-20">
                        {/* Vertical Fader (Default 75 = 0.0 dB, Range -∞ to +6dB) */}
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={localFaders[ch.channelNumber] !== undefined ? localFaders[ch.channelNumber] : ch.fader}
                          onInput={(e) => {
                            const val = Number(e.target.value);
                            setLocalFaders(prev => ({ ...prev, [ch.channelNumber]: val }));
                          }}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            onUpdateChannel(ch.channelNumber, { fader: val });
                            setLocalFaders(prev => {
                              const next = { ...prev };
                              delete next[ch.channelNumber];
                              return next;
                            });
                          }}
                          onDoubleClick={() => onUpdateChannel(ch.channelNumber, { fader: 75 })}
                          className="h-20 w-3 channel-fader cursor-pointer [writing-mode:vertical-lr] [direction:rtl]"
                          title={`Fader: ${faderToDb(localFaders[ch.channelNumber] !== undefined ? localFaders[ch.channelNumber] : ch.fader)} (Double click to reset to 0.0 dB)`}
                        />

                        {/* Dynamic LED VU Meter */}
                        <div className="flex flex-col-reverse gap-0.5 h-20 w-2.5 bg-black/50 p-0.5 rounded-md border border-white/10 backdrop-blur-xs">
                          {Array.from({ length: meterSegments }).map((_, idx) => {
                            const isLit = idx < activeSegments;
                            const isRed = idx >= meterSegments - 1;
                            const isYellow = idx >= meterSegments - 3 && idx < meterSegments - 1;
                            const colorClass = isRed
                              ? isLit
                                ? 'bg-red-500 shadow-[0_0_4px_#ef4444]'
                                : 'bg-red-950/40'
                              : isYellow
                              ? isLit
                                ? 'bg-yellow-400 shadow-[0_0_4px_#facc15]'
                                : 'bg-yellow-950/40'
                              : isLit
                              ? 'bg-emerald-400 shadow-[0_0_4px_#34d399]'
                              : 'bg-emerald-950/40';

                            return <div key={idx} className={`w-full flex-1 rounded-xs ${colorClass}`} />;
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Master Stereo Bus Section */}
              <div
                id="mixer-master-strip"
                onClick={() => setSelectedChannelNumber('master')}
                className={`w-40 bg-black/60 backdrop-blur-xl border rounded-2xl p-3 flex flex-col items-center justify-between shadow-xl cursor-pointer transition-all ${
                  selectedChannelNumber === 'master'
                    ? 'ring-2 ring-orange-400 border-orange-400 bg-orange-500/[0.08] shadow-[0_0_16px_rgba(249,115,22,0.3)]'
                    : 'border-orange-500/30 hover:border-orange-500/60'
                }`}
              >
                {/* Master Header */}
                <div className="w-full text-center border-b border-white/10 pb-1.5 mb-2">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-[12px] font-black text-orange-400 tracking-wider">MASTER</span>
                    {selectedChannelNumber === 'master' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />
                    )}
                  </div>
                  <div className="text-[8.5px] text-stone-400 mt-0.5">Main Outs (L/R)</div>
                </div>

                {/* Master Fader + Integrated Stereo Mix Meter */}
                <div className="w-full bg-black/40 border border-white/5 rounded-xl p-2 flex flex-col items-center my-1">
                  <div className="flex items-center justify-between gap-2 w-full px-1 mb-1.5">
                    {/* Fader level label centered above fader column */}
                    <div className="flex-1 flex justify-center">
                      <span className="text-[9px] font-mono font-bold text-orange-400">
                        {faderToDb(localMasterFader !== null ? localMasterFader : effectiveMaster.fader)}
                      </span>
                    </div>
                    {/* Empty spacer matching meter column */}
                    <div className="flex-1" />
                  </div>

                  <div className="flex items-center justify-between gap-2 h-34 w-full px-1">
                    {/* Vertical Master Fader column */}
                    <div className="flex-1 flex flex-col items-center h-full justify-center">
                      <input
                        id="master-bus-fader"
                        type="range"
                        min="0"
                        max="100"
                        value={localMasterFader !== null ? localMasterFader : effectiveMaster.fader}
                        onInput={(e) => {
                          const val = Number(e.target.value);
                          setLocalMasterFader(val);
                          audioEngine.setMasterBusState({ fader: val });
                        }}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          handleUpdateMaster({ fader: val });
                          setLocalMasterFader(null);
                        }}
                        onDoubleClick={() => handleUpdateMaster({ fader: 75 })}
                        className="h-32 w-4 master-fader cursor-pointer [writing-mode:vertical-lr] [direction:rtl] select-none"
                        title={`Master Output Fader: ${faderToDb(localMasterFader !== null ? localMasterFader : effectiveMaster.fader)} (Double click to reset to 0.0 dB)`}
                      />
                    </div>

                    {/* Integrated Dual Stereo Mix Meter column */}
                    <div className="flex-1 flex flex-col items-center h-full justify-center">
                      <MasterMixMeter
                        isPlaying={isPlayingAudio}
                        hasAudibleSignal={isMasterAudible}
                        className="shrink-0"
                      />
                    </div>
                  </div>
                </div>

                {/* Live Master Output Status Badge */}
                <div className="w-full text-center mt-1">
                  <span
                    className={`text-[8.5px] font-bold uppercase tracking-wider ${
                      effectiveMaster.muted
                        ? 'text-rose-400 font-black'
                        : effectiveMaster.dim
                        ? 'text-amber-400 font-bold'
                        : isPlayingAudio && isMasterAudible
                        ? 'text-emerald-400 animate-pulse font-black'
                        : isPlayingAudio
                        ? 'text-amber-300'
                        : 'text-stone-500'
                    }`}
                  >
                    {effectiveMaster.muted
                      ? '● MUTED'
                      : effectiveMaster.dim
                      ? 'DIM (-20dB)'
                      : isPlayingAudio
                      ? isMasterAudible
                        ? '● LIVE MIX'
                        : 'NO SIGNAL'
                      : 'STANDBY'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};
