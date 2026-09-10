import React, { useState, useEffect } from 'react';
import {
  Activity,
  ArrowDown,
  Volume2,
  VolumeX,
  Zap,
  Radio,
  Sliders,
  Cable,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  MixerChannelState,
  PlacedGear,
  CableConnection,
  EnvironmentMode,
} from '../types';
import { getGearById } from '../data/gearCatalog';
import { validateChannelSignalChain } from '../services/gradingEngine';
import { StudioIcon } from './StudioIcons';

interface SignalFlowMapProps {
  channels: MixerChannelState[];
  placedGear: PlacedGear[];
  connections: CableConnection[];
  environment: EnvironmentMode;
  selectedItemId?: string | null;
  onSelectItem?: (id: string | null) => void;
  onUpdateChannel?: (channelNumber: number, updates: Partial<MixerChannelState>) => void;
  isPlayingAudio?: boolean;
}

export const SignalFlowMap: React.FC<SignalFlowMapProps> = ({
  channels,
  placedGear,
  connections,
  environment,
  selectedItemId,
  onSelectItem,
  onUpdateChannel,
  isPlayingAudio = false,
}) => {
  const [selectedChannelNumber, setSelectedChannelNumber] = useState<number>(1);

  // Auto-sync selected channel if user selects a piece of gear on canvas
  useEffect(() => {
    if (!selectedItemId) return;
    const matchingCh = channels.find((ch) => ch.assignedGearInstanceId === selectedItemId);
    if (matchingCh) {
      setSelectedChannelNumber(matchingCh.channelNumber);
      return;
    }
    // Check if selected item is an instrument feeding a patched mic/DI/amp
    const conn = connections.find(
      (c) => c.fromInstanceId === selectedItemId || c.toInstanceId === selectedItemId
    );
    if (conn) {
      const otherId = conn.fromInstanceId === selectedItemId ? conn.toInstanceId : conn.fromInstanceId;
      const otherCh = channels.find((ch) => ch.assignedGearInstanceId === otherId);
      if (otherCh) {
        setSelectedChannelNumber(otherCh.channelNumber);
      }
    }
  }, [selectedItemId, channels, connections]);

  const activeChannel =
    channels.find((ch) => ch.channelNumber === selectedChannelNumber) || channels[0] || {
      channelNumber: 1,
      assignedGearInstanceId: null,
      label: 'CH 1',
      phantomPower: false,
      gain: 72,
      fader: 75,
      pan: 0,
      solo: false,
      muted: false,
      meterValue: 0,
    };

  const assignedGear = placedGear.find((g) => g.instanceId === activeChannel.assignedGearInstanceId);
  const assignedDef = assignedGear ? getGearById(assignedGear.gearId) : null;
  const signalValidation = validateChannelSignalChain(
    activeChannel,
    placedGear,
    connections,
    channels,
    environment
  );

  const hasAnySolo = channels.some((c) => c.solo);
  const isAudible = (hasAnySolo ? activeChannel.solo && !activeChannel.muted : !activeChannel.muted) && activeChannel.fader > 5;
  const isSignalFlowing = isPlayingAudio && isAudible && signalValidation.hasSignal;

  // Derive Transducer & Intermediate Amplification / DI
  let instrumentGear: PlacedGear | null = signalValidation.instrumentGear || null;
  let intermediateAmpGear: PlacedGear | null = null;
  let diGear: PlacedGear | null = null;
  let micGear: PlacedGear | null = null;

  if (assignedDef?.category === 'microphone') {
    micGear = assignedGear || null;
    if (!instrumentGear && assignedGear?.latchedSourceInstanceId && assignedGear.latchedSourceInstanceId !== 'room' && assignedGear.latchedSourceInstanceId !== 'drummer') {
      const target = placedGear.find((g) => g.instanceId === assignedGear?.latchedSourceInstanceId);
      if (target) {
        const tDef = getGearById(target.gearId);
        if (tDef?.category === 'amplifier') {
          intermediateAmpGear = target;
          const qConn = connections.find(
            (c) =>
              (c.fromInstanceId === target.instanceId || c.toInstanceId === target.instanceId) &&
              c.cableType === 'quarter_inch'
          );
          if (qConn) {
            const instId = qConn.fromInstanceId === target.instanceId ? qConn.toInstanceId : qConn.fromInstanceId;
            instrumentGear = placedGear.find((g) => g.instanceId === instId) || null;
          }
        } else {
          instrumentGear = target;
        }
      }
    }
  } else if (assignedDef?.category === 'di_box') {
    diGear = assignedGear || null;
    const qConn = connections.find(
      (c) =>
        (c.fromInstanceId === assignedGear?.instanceId || c.toInstanceId === assignedGear?.instanceId) &&
        c.cableType === 'quarter_inch'
    );
    if (qConn) {
      const instId = qConn.fromInstanceId === assignedGear?.instanceId ? qConn.toInstanceId : qConn.fromInstanceId;
      instrumentGear = placedGear.find((g) => g.instanceId === instId) || null;
    }
  } else if (assignedDef?.category === 'amplifier') {
    intermediateAmpGear = assignedGear || null;
    const qConn = connections.find(
      (c) =>
        (c.fromInstanceId === assignedGear?.instanceId || c.toInstanceId === assignedGear?.instanceId) &&
        c.cableType === 'quarter_inch'
    );
    if (qConn) {
      const instId = qConn.fromInstanceId === assignedGear?.instanceId ? qConn.toInstanceId : qConn.fromInstanceId;
      instrumentGear = placedGear.find((g) => g.instanceId === instId) || null;
    }
  } else if (assignedDef?.category === 'instrument') {
    instrumentGear = assignedGear || null;
  }

  const instrumentDef = instrumentGear ? getGearById(instrumentGear.gearId) : null;
  const ampDef = intermediateAmpGear ? getGearById(intermediateAmpGear.gearId) : null;

  // Cables in this path
  const relevantCables = connections.filter((c) => {
    const ids = [
      activeChannel.assignedGearInstanceId,
      instrumentGear?.instanceId,
      intermediateAmpGear?.instanceId,
      diGear?.instanceId,
      micGear?.instanceId,
    ].filter(Boolean);
    return ids.includes(c.fromInstanceId) || ids.includes(c.toInstanceId);
  });

  // Stage Snake box check
  const snakeBox = placedGear.find((g) => g.gearId === 'gear_stage_snake_8ch');

  // Outputs in environment
  const isLive = environment === 'live_stage';
  const mainOutputs = isLive
    ? placedGear.filter((g) => g.gearId.startsWith('spk_pa') || g.gearId.startsWith('spk_sub'))
    : placedGear.filter((g) => g.gearId.startsWith('spk_studio_monitor'));
  const monitorOutputs = isLive
    ? placedGear.filter((g) => g.gearId.startsWith('mon_wedge') || g.gearId.startsWith('gear_iem'))
    : placedGear.filter((g) => g.gearId.startsWith('gear_headphones') || g.gearId.startsWith('gear_headphone_amp'));

  return (
    <div
      id="signal-flow-map-container"
      className="bg-stone-900/90 border border-white/10 rounded-2xl p-3.5 backdrop-blur-xl shadow-2xl flex flex-col gap-3 text-stone-200 select-none transition-all"
    >
      {/* Header & Mode Badge */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 shrink-0">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-stone-100 flex items-center gap-1.5">
              <span>Signal Flow Map</span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-white/10 text-stone-300 rounded-md border border-white/10">
                CH {activeChannel.channelNumber}
              </span>
            </h3>
            <p className="text-[10px] text-stone-400">Input transducer to speaker destination</p>
          </div>
        </div>

        {/* Global Live Pulse Indicator */}
        <div
          className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
            isSignalFlowing
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(52,211,153,0.3)]'
              : signalValidation.hasSignal
              ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
              : assignedGear
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              : 'bg-stone-800 text-stone-400 border-white/5'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isSignalFlowing
                ? 'bg-emerald-400 animate-ping'
                : signalValidation.hasSignal
                ? 'bg-sky-400'
                : assignedGear
                ? 'bg-amber-400'
                : 'bg-stone-500'
            }`}
          />
          <span>{isSignalFlowing ? 'SIGNAL ACTIVE' : signalValidation.hasSignal ? 'INTACT' : assignedGear ? 'CHECK CHAIN' : 'STANDBY'}</span>
        </div>
      </div>

      {/* Channel Strip Selector Tabs */}
      <div>
        <div className="text-[9px] font-black uppercase tracking-wider text-stone-400 mb-1.5 flex items-center justify-between">
          <span>Select Mixer Channel Strip</span>
          <span className="text-stone-400 text-[9px]">8 Console Channels</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {channels.slice(0, 8).map((ch) => {
            const isSelected = ch.channelNumber === selectedChannelNumber;
            const chGear = placedGear.find((g) => g.instanceId === ch.assignedGearInstanceId);
            const chDef = chGear ? getGearById(chGear.gearId) : null;
            const chSignal = validateChannelSignalChain(ch, placedGear, connections, channels, environment);

            return (
              <button
                key={ch.channelNumber}
                id={`btn-map-ch-${ch.channelNumber}`}
                onClick={() => setSelectedChannelNumber(ch.channelNumber)}
                className={`p-1.5 rounded-xl border text-left flex flex-col transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-orange-500/20 border-orange-400 text-stone-100 ring-1 ring-orange-400/50 shadow-md'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-stone-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-[10px] font-black ${isSelected ? 'text-orange-300' : 'text-stone-300'}`}>
                    CH {ch.channelNumber}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      chSignal.hasSignal
                        ? isPlayingAudio && !ch.muted && ch.fader > 5
                          ? 'bg-emerald-400 ring-2 ring-emerald-400/30 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                          : 'bg-emerald-500'
                        : ch.assignedGearInstanceId
                        ? 'bg-amber-400'
                        : 'bg-stone-600'
                    }`}
                  />
                </div>
                <span className="text-[9px] font-medium text-stone-400 truncate mt-0.5">
                  {chDef ? chDef.name : 'Unpatched'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Visual Signal Flow Path Diagram */}
      <div className="relative flex flex-col gap-2.5 py-1">
        {/* Animated Flowing Signal Bus Line */}
        <div className="absolute left-[23px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-stone-700 via-stone-600 to-stone-700 pointer-events-none">
          {isSignalFlowing && (
            <div className="w-full h-full bg-gradient-to-b from-emerald-400 via-sky-400 to-orange-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          )}
        </div>

        {/* NODE 1: INPUT SOUND SOURCE / PERFORMER */}
        <div
          id="flow-node-source"
          onClick={() => instrumentGear && onSelectItem && onSelectItem(instrumentGear.instanceId)}
          className={`relative z-10 flex items-start gap-2.5 p-2.5 rounded-xl border backdrop-blur-md transition-all ${
            instrumentGear ? 'cursor-pointer hover:border-orange-400/50 hover:bg-white/10' : 'opacity-80'
          } ${
            instrumentGear
              ? 'bg-white/5 border-white/15 text-stone-100 shadow-sm'
              : 'bg-stone-900/50 border-dashed border-white/10 text-stone-400'
          }`}
        >
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
              instrumentGear
                ? 'bg-indigo-950/80 border-indigo-400/40 text-indigo-300 shadow-inner'
                : 'bg-stone-800 border-white/10 text-stone-500'
            }`}
          >
            {instrumentDef ? (
              <StudioIcon iconType={instrumentDef.iconType} size={20} />
            ) : (
              <Radio className="w-4 h-4 text-stone-500" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-wider text-indigo-300">
                1. Sound Source / Instrument
              </span>
              {instrumentGear ? (
                <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Ready
                </span>
              ) : (
                <span className="text-[9px] font-bold text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> None
                </span>
              )}
            </div>
            <div className="text-xs font-bold text-stone-100 truncate mt-0.5">
              {instrumentDef ? instrumentDef.name : 'No instrument assigned'}
            </div>
            <div className="text-[10px] text-stone-400 mt-0.5">
              {instrumentDef
                ? `Acoustic / Electronic Source (${instrumentDef.category})`
                : 'Place an instrument or performer near microphone'}
            </div>
          </div>
        </div>

        {/* NODE 2: TRANSDUCER & CAPTURE / DIRECT INJECTION */}
        <div
          id="flow-node-transducer"
          onClick={() => assignedGear && onSelectItem && onSelectItem(assignedGear.instanceId)}
          className={`relative z-10 flex items-start gap-2.5 p-2.5 rounded-xl border backdrop-blur-md transition-all ${
            assignedGear ? 'cursor-pointer hover:border-orange-400/50 hover:bg-white/10' : 'opacity-80'
          } ${
            assignedGear
              ? activeChannel.phantomPower || !assignedDef?.requiresPhantomPower
                ? 'bg-white/5 border-white/15 text-stone-100'
                : 'bg-amber-950/40 border-amber-500/50 text-amber-200'
              : 'bg-stone-900/50 border-dashed border-white/10 text-stone-400'
          }`}
        >
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
              assignedGear
                ? assignedDef?.requiresPhantomPower && !activeChannel.phantomPower
                  ? 'bg-amber-900/70 border-amber-400 text-amber-300 animate-pulse'
                  : 'bg-sky-950/80 border-sky-400/40 text-sky-300'
                : 'bg-stone-800 border-white/10 text-stone-500'
            }`}
          >
            {assignedDef ? (
              <StudioIcon iconType={assignedDef.iconType} size={20} />
            ) : (
              <Zap className="w-4 h-4 text-stone-500" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-wider text-sky-300">
                2. Transducer / Direct Box
              </span>
              {assignedDef?.requiresPhantomPower && (
                <span
                  className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${
                    activeChannel.phantomPower
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-bounce'
                  }`}
                >
                  +48V {activeChannel.phantomPower ? 'ENGAGED' : 'REQUIRED'}
                </span>
              )}
            </div>

            <div className="text-xs font-bold text-stone-100 truncate mt-0.5">
              {assignedDef ? assignedDef.name : 'No microphone or DI patched'}
            </div>

            {/* Mic Placement / Latch / Amp Info */}
            <div className="text-[10px] text-stone-300 mt-0.5 flex items-center gap-1.5 flex-wrap">
              {assignedGear?.micPlacement && (
                <span className="bg-white/10 px-1.5 py-0.2 rounded text-stone-300 text-[9px]">
                  Placement: {assignedGear.micPlacement}
                </span>
              )}
              {intermediateAmpGear && ampDef && (
                <span className="bg-amber-500/20 text-amber-200 border border-amber-500/30 px-1.5 py-0.2 rounded text-[9px]">
                  Via {ampDef.name}
                </span>
              )}
              {diGear && (
                <span className="bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 px-1.5 py-0.2 rounded text-[9px]">
                  DI Balanced Output
                </span>
              )}
            </div>
          </div>
        </div>

        {/* NODE 3: TRANSMISSION / CABLE & STAGE SNAKE */}
        <div
          id="flow-node-interconnect"
          className="relative z-10 flex items-start gap-2.5 p-2.5 rounded-xl border bg-white/5 border-white/15 backdrop-blur-md"
        >
          <div className="w-8 h-8 rounded-xl bg-orange-950/80 border border-orange-400/40 flex items-center justify-center shrink-0 text-orange-300">
            <Cable className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-wider text-orange-300">
                3. Interconnect & Stage Snake
              </span>
              <span className="text-[9px] font-bold text-stone-400">
                {snakeBox ? '8ch Stage Snake' : 'Direct Patch'}
              </span>
            </div>

            <div className="text-xs font-bold text-stone-100 truncate mt-0.5">
              {assignedDef ? 'XLR Balanced Cable (Low-Z)' : 'Unconnected'}
            </div>

            <div className="text-[10px] text-stone-400 mt-0.5 flex items-center gap-2 flex-wrap">
              <span>{intermediateAmpGear || diGear ? '1/4" TS -> XLR Drop' : 'Standard 3-Pin Balanced XLR'}</span>
              {snakeBox && (
                <span className="text-stone-300 bg-white/10 px-1 py-0.2 rounded text-[9px]">
                  Snake In #{activeChannel.channelNumber}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* NODE 4: MIXER CONSOLE CHANNEL STRIP */}
        <div
          id="flow-node-mixer"
          className={`relative z-10 flex items-start gap-2.5 p-2.5 rounded-xl border backdrop-blur-md transition-all ${
            activeChannel.muted
              ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
              : 'bg-white/5 border-white/15 text-stone-100'
          }`}
        >
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
              activeChannel.muted
                ? 'bg-rose-900/80 border-rose-400 text-rose-300'
                : 'bg-emerald-950/80 border-emerald-400/40 text-emerald-300'
            }`}
          >
            <Sliders className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-300">
                4. Console Channel Strip
              </span>
              <div className="flex items-center gap-1">
                {activeChannel.solo && (
                  <span className="text-[9px] font-black px-1 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                    SOLO
                  </span>
                )}
                {activeChannel.muted ? (
                  <span className="text-[9px] font-black px-1 py-0.2 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded flex items-center gap-0.5">
                    <VolumeX className="w-2.5 h-2.5" /> MUTED
                  </span>
                ) : (
                  <span className="text-[9px] font-black px-1 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded flex items-center gap-0.5">
                    <Volume2 className="w-2.5 h-2.5" /> LIVE
                  </span>
                )}
              </div>
            </div>

            <div className="text-xs font-bold text-stone-100 truncate mt-0.5 flex items-center justify-between">
              <span>{activeChannel.label || `CH ${activeChannel.channelNumber}`}</span>
              <span className="text-[10px] font-mono text-stone-300">
                Fader: {activeChannel.fader}% | Gain: {activeChannel.gain}%
              </span>
            </div>

            {/* Quick Interactive Channel Controls */}
            <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-white/5 text-[10px]">
              {onUpdateChannel && (
                <>
                  <button
                    id={`map-toggle-mute-ch-${activeChannel.channelNumber}`}
                    onClick={() =>
                      onUpdateChannel(activeChannel.channelNumber, { muted: !activeChannel.muted })
                    }
                    className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                      activeChannel.muted
                        ? 'bg-rose-600 text-white'
                        : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                    }`}
                  >
                    {activeChannel.muted ? 'Unmute' : 'Mute'}
                  </button>

                  <button
                    id={`map-toggle-solo-ch-${activeChannel.channelNumber}`}
                    onClick={() =>
                      onUpdateChannel(activeChannel.channelNumber, { solo: !activeChannel.solo })
                    }
                    className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                      activeChannel.solo
                        ? 'bg-amber-500 text-black font-black'
                        : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                    }`}
                  >
                    Solo
                  </button>

                  {assignedDef?.requiresPhantomPower && (
                    <button
                      id={`map-toggle-phantom-ch-${activeChannel.channelNumber}`}
                      onClick={() =>
                        onUpdateChannel(activeChannel.channelNumber, {
                          phantomPower: !activeChannel.phantomPower,
                        })
                      }
                      className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                        activeChannel.phantomPower
                          ? 'bg-amber-500/30 text-amber-200 border border-amber-500/50'
                          : 'bg-rose-600 text-white animate-pulse'
                      }`}
                    >
                      {activeChannel.phantomPower ? '+48V On' : 'Engage +48V'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* NODE 5: OUTPUT DESTINATIONS */}
        <div
          id="flow-node-destination"
          className="relative z-10 flex items-start gap-2.5 p-2.5 rounded-xl border bg-white/5 border-white/15 backdrop-blur-md"
        >
          <div className="w-8 h-8 rounded-xl bg-purple-950/80 border border-purple-400/40 flex items-center justify-center shrink-0 text-purple-300">
            <Volume2 className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-wider text-purple-300">
                5. Output Destinations
              </span>
              <span className="text-[9px] font-bold text-stone-400">
                {isLive ? 'FOH & Stage Wedges' : 'Studio Nearfields & Cues'}
              </span>
            </div>

            <div className="text-xs font-bold text-stone-100 truncate mt-0.5">
              {isLive
                ? `Main PA (${mainOutputs.length} spks) & Monitors (${monitorOutputs.length} units)`
                : `Studio Monitors (${mainOutputs.length}) & Headphones (${monitorOutputs.length})`}
            </div>

            <div className="text-[10px] text-stone-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span className="bg-white/10 px-1.5 py-0.2 rounded text-[9px] text-stone-300">
                Master Stereo Bus (L/R)
              </span>
              <span className="bg-white/10 px-1.5 py-0.2 rounded text-[9px] text-stone-300">
                Aux Monitor 1/2
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Signal Chain Diagnostic / Actionable Guidance Card */}
      {assignedGear && !signalValidation.hasSignal && (
        <div
          id="signal-flow-diagnostic-alert"
          className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-amber-300 text-[11px]">Signal Chain Broken</div>
            <div className="text-[10px] text-amber-200/90 mt-0.5 leading-snug">
              {signalValidation.error}
            </div>
            {assignedDef?.requiresPhantomPower && !activeChannel.phantomPower && onUpdateChannel && (
              <button
                id="btn-fix-phantom-power"
                onClick={() =>
                  onUpdateChannel(activeChannel.channelNumber, { phantomPower: true })
                }
                className="mt-1.5 px-2.5 py-1 text-[10px] font-bold bg-amber-500 text-stone-950 rounded-lg hover:bg-amber-400 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Zap className="w-3 h-3" />
                <span>Turn on +48V Phantom Power on CH {activeChannel.channelNumber}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Positive Validation State */}
      {isSignalFlowing && (
        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-[10px] flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>
            Live audio signal is flowing seamlessly from <strong className="text-emerald-300">{instrumentDef?.name || 'source'}</strong> through to the sound system.
          </span>
        </div>
      )}
    </div>
  );
};
