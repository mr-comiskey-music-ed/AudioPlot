import React, { useState, useEffect, useRef } from 'react';
import { Activity, BarChart2, Radio, GitCommit } from 'lucide-react';
import {
  MixerChannelState,
  PlacedGear,
  CableConnection,
  EnvironmentMode,
  MasterBusState,
} from '../types';
import { getGearById } from '../data/gearCatalog';
import { validateChannelSignalChain } from '../services/gradingEngine';
import { audioEngine } from '../services/audioEngine';
import { calculateXlrCablesCount } from '../utils/cableUtils';

interface ChannelOscilloscopeViewerProps {
  selectedChannelNumber: number | 'master';
  onSelectChannel: (chNumber: number | 'master') => void;
  channels: MixerChannelState[];
  placedGear: PlacedGear[];
  connections?: CableConnection[];
  environment: EnvironmentMode;
  isPlayingAudio: boolean;
  onUpdateChannel: (channelNumber: number, updates: Partial<MixerChannelState>) => void;
  masterBus?: MasterBusState;
  onUpdateMasterBus?: (updates: Partial<MasterBusState>) => void;
  onToggleSoundcheck?: () => void;
  isCompact?: boolean;
}

type DisplayMode = 'waveform' | 'spectrum';

// Convert trim gain value (0..100) to preamp dB (-∞ to +12dB, 72 is 0.0dB unity)
const UNITY_VAL = 72;
export const trimToPreampDb = (val: number = 72): string => {
  if (val === 0) return '-∞ dB';
  if (val === UNITY_VAL) return '0.0 dB';
  if (val < UNITY_VAL) {
    const db = -48 * (1 - val / UNITY_VAL);
    return `${db.toFixed(1)} dB`;
  }
  const db = ((val - UNITY_VAL) / (100 - UNITY_VAL)) * 12;
  return `+${db.toFixed(1)} dB`;
};

// Convert fader position to dB
export const faderToDb = (val: number): string => {
  if (val <= 0) return '-∞ dB';
  if (val === 75) return '0.0 dB';
  if (val > 75) {
    const db = ((val - 75) / 25) * 6;
    return `+${db.toFixed(1)} dB`;
  }
  const db = ((val - 75) / 75) * 48;
  return `${db.toFixed(1)} dB`;
};

// Spectrum display range (log-spaced bars, like a real analyzer)
const SPEC_MIN_HZ = 40;
const SPEC_MAX_HZ = 16000;
const SPEC_BARS = 36;

/**
 * A small, fun live meter for the selected channel: the waveform (what the
 * signal looks like over time) or the spectrum (low to high frequencies).
 */
export const ChannelOscilloscopeViewer: React.FC<ChannelOscilloscopeViewerProps> = ({
  selectedChannelNumber,
  channels,
  placedGear,
  connections = [],
  environment,
  isPlayingAudio,
  masterBus,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timeDataRef = useRef<Uint8Array>(new Uint8Array(512));
  const freqDataRef = useRef<Uint8Array>(new Uint8Array(1024));
  const barLevelsRef = useRef<number[]>(new Array(SPEC_BARS).fill(0));
  const [displayMode, setDisplayMode] = useState<DisplayMode>('waveform');

  const isMaster = selectedChannelNumber === 'master';
  const effectiveMaster: MasterBusState = masterBus || { fader: 75, gain: 50, pan: 0, muted: false, dim: false, mono: false };

  const activeChannel: MixerChannelState = isMaster
    ? {
        channelNumber: 0,
        assignedGearInstanceId: null,
        label: 'Master',
        phantomPower: false,
        gain: effectiveMaster.gain,
        fader: effectiveMaster.fader,
        pan: effectiveMaster.pan,
        solo: false,
        muted: effectiveMaster.muted,
        meterValue: 0,
      }
    : channels.find((c) => c.channelNumber === selectedChannelNumber) || channels[0];

  const assignedGear = activeChannel.assignedGearInstanceId
    ? placedGear.find((g) => g.instanceId === activeChannel.assignedGearInstanceId)
    : null;
  const assignedDef = assignedGear ? getGearById(assignedGear.gearId) : null;

  const hasAnySolo = channels.some((c) => c.solo);
  const channelSignal = validateChannelSignalChain(activeChannel, placedGear, connections, channels, environment);

  const isAudible = isMaster
    ? channels.some((c) => (hasAnySolo ? c.solo && !c.muted : !c.muted) && c.fader > 5) &&
      !effectiveMaster.muted &&
      effectiveMaster.fader > 5
    : (hasAnySolo ? activeChannel.solo && !activeChannel.muted : !activeChannel.muted) && activeChannel.fader > 5;

  const isSignalActive = isPlayingAudio && isAudible && (isMaster || channelSignal.hasSignal);
  const hasChainError = Boolean(!isMaster && assignedGear && !channelSignal.hasSignal);

  // Preamp trim + fader scale how big the waveform looks (so gain staging is visible)
  const UNITY_VAL = 72;
  const rawGain = isMaster ? effectiveMaster.gain ?? UNITY_VAL : activeChannel.gain ?? UNITY_VAL;
  let preampRatio = 1;
  if (rawGain === 0) preampRatio = 0;
  else if (rawGain <= UNITY_VAL) preampRatio = Math.pow(10, (-48 * (1 - rawGain / UNITY_VAL)) / 20);
  else preampRatio = Math.pow(10, (((rawGain - UNITY_VAL) / (100 - UNITY_VAL)) * 12) / 20);
  const faderRatio = (isMaster ? effectiveMaster.fader : activeChannel.fader) / 75;
  const totalGain = preampRatio * Math.pow(faderRatio, 1.4);

  const sourceName = isMaster
    ? 'Master mix'
    : assignedDef
    ? `CH ${activeChannel.channelNumber} · ${channelSignal.instrumentGear ? getGearById(channelSignal.instrumentGear.gearId)?.name ?? assignedDef.name : assignedDef.name}`
    : `CH ${activeChannel.channelNumber} · nothing patched`;

  const status = !isPlayingAudio
    ? 'Press Soundcheck to see the signal'
    : hasChainError
    ? channelSignal.error || 'No signal: check the cables and +48V'
    : !isAudible
    ? 'Muted or fader down'
    : !isMaster && !assignedGear
    ? 'Nothing patched to this channel'
    : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || 400;
      const height = canvas.clientHeight || 160;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#05070a';
      ctx.fillRect(0, 0, width, height);

      // Pull live data for this channel (or the master mix)
      const timeArray = timeDataRef.current;
      const freqArray = freqDataRef.current;
      let hasData = false;
      let peak = 0;
      if (isMaster && isPlayingAudio) {
        const res = audioEngine.getMasterWaveformData(timeArray);
        hasData = res.hasData;
        peak = res.peakAmplitude * totalGain;
        audioEngine.getMasterFrequencyData(freqArray);
      } else if (isSignalActive && channelSignal.instrumentGear) {
        let id = channelSignal.instrumentGear.gearId;
        if (id === 'drummer' || id === 'inst_drum_set') id = 'inst_kick_drum';
        const res = audioEngine.getGearWaveformData(id, timeArray);
        hasData = res.hasData;
        peak = res.peakAmplitude * totalGain;
        audioEngine.getGearFrequencyData(id, freqArray);
      }
      const live = hasData && (isMaster ? isPlayingAudio && isAudible : isSignalActive);
      const clipping = live && peak > 0.98;
      const color = clipping ? '#ef4444' : displayMode === 'waveform' ? '#22c55e' : '#38bdf8';

      if (displayMode === 'waveform') {
        // Faint center line
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        if (live) {
          // Start at a rising zero crossing so the wave holds still
          let start = 0;
          for (let i = 1; i < timeArray.length - 256; i++) {
            if (timeArray[i - 1] < 128 && timeArray[i] >= 128) {
              start = i;
              break;
            }
          }
          const n = 256;
          ctx.beginPath();
          for (let i = 0; i < n; i++) {
            let v = ((timeArray[start + i] - 128) / 128) * totalGain;
            v = Math.max(-1, Math.min(1, v));
            const x = (i / (n - 1)) * width;
            const y = height / 2 - v * height * 0.44;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.shadowColor = color;
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      } else {
        // Log-spaced bars from 40 Hz to 16 kHz, read from the real FFT bins
        const nyquist = audioEngine.getSampleRate() / 2;
        const bins = freqArray.length;
        const gap = 2;
        const barW = (width - gap * (SPEC_BARS + 1)) / SPEC_BARS;
        const floorY = height - 14;
        for (let b = 0; b < SPEC_BARS; b++) {
          const f0 = SPEC_MIN_HZ * Math.pow(SPEC_MAX_HZ / SPEC_MIN_HZ, b / SPEC_BARS);
          const f1 = SPEC_MIN_HZ * Math.pow(SPEC_MAX_HZ / SPEC_MIN_HZ, (b + 1) / SPEC_BARS);
          const i0 = Math.max(0, Math.floor((f0 / nyquist) * bins));
          const i1 = Math.min(bins - 1, Math.max(i0, Math.ceil((f1 / nyquist) * bins) - 1));
          let level = 0;
          if (live) {
            for (let i = i0; i <= i1; i++) level = Math.max(level, freqArray[i] / 255);
            // Fader/trim still matter, without letting quiet bins pop up
            level = Math.min(1, level * Math.min(1.4, totalGain));
          }
          // Gentle fall-off so bars move smoothly
          const prev = barLevelsRef.current[b];
          const shown = level > prev ? level : prev * 0.9;
          barLevelsRef.current[b] = shown;

          const h = Math.max(1, shown * (floorY - 8));
          const x = gap + b * (barW + gap);
          const grad = ctx.createLinearGradient(0, floorY, 0, floorY - h);
          grad.addColorStop(0, 'rgba(56,189,248,0.35)');
          grad.addColorStop(1, shown > 0.95 ? '#ef4444' : '#38bdf8');
          ctx.fillStyle = grad;
          ctx.fillRect(x, floorY - h, barW, h);
        }
        // Just three plain-language labels
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.textBaseline = 'bottom';
        ctx.textAlign = 'left';
        ctx.fillText('LOW', 6, height - 2);
        ctx.textAlign = 'center';
        ctx.fillText('MID', width / 2, height - 2);
        ctx.textAlign = 'right';
        ctx.fillText('HIGH', width - 6, height - 2);
      }

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(render);
    };
    render();
    return () => {
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
    };
  }, [displayMode, isMaster, isPlayingAudio, isAudible, isSignalActive, channelSignal, totalGain]);

  return (
    <div
      id="mixer-oscilloscope-inspector"
      className="bg-stone-950/90 border border-white/15 rounded-2xl p-3 shadow-2xl backdrop-blur-2xl w-full"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        <div className="lg:col-span-8 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-black text-stone-200 truncate">{sourceName}</span>
            <div className="flex bg-black/60 p-0.5 rounded-lg border border-white/10 shrink-0">
              <button
                onClick={() => setDisplayMode('waveform')}
                className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  displayMode === 'waveform' ? 'bg-emerald-500/20 text-emerald-300' : 'text-stone-400 hover:text-white'
                }`}
                title="The shape of the sound over time"
              >
                <Activity className="w-3 h-3" />
                <span>Waveform</span>
              </button>
              <button
                onClick={() => setDisplayMode('spectrum')}
                className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  displayMode === 'spectrum' ? 'bg-sky-500/20 text-sky-300' : 'text-stone-400 hover:text-white'
                }`}
                title="How much low, mid and high is in the sound"
              >
                <BarChart2 className="w-3 h-3" />
                <span>Spectrum</span>
              </button>
            </div>
          </div>
          <div className="w-full h-40 bg-black rounded-xl border border-white/15 overflow-hidden relative">
            <canvas ref={canvasRef} className="w-full h-full block" style={{ width: '100%', height: '100%' }} />
            {status && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className={`text-[11px] font-bold px-2 text-center ${hasChainError ? 'text-amber-300' : 'text-stone-500'}`}>
                  {status}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Expanded Plot Equipment & Cable Inventory Panel */}
        <div className="lg:col-span-4 bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col justify-between space-y-3 h-full">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-2">
              <span className="text-xs font-black text-stone-200 uppercase tracking-wide flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-orange-400" />
                Plot Equipment & Cables
              </span>
              <span className="text-[10px] font-mono bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded border border-orange-500/30">
                {placedGear.length} Items • {connections.length} Cables
              </span>
            </div>

            {/* Compact Equipment & Cables List */}
            <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
              {placedGear.length === 0 && connections.length === 0 ? (
                <div className="text-xs text-stone-500 text-center py-4 italic">
                  No equipment placed on plot yet.
                </div>
              ) : (
                (() => {
                  const map = new Map<string, { name: string; category: string; color: string; count: number }>();
                  
                  // 1. Aggregate placed gear
                  for (const item of placedGear) {
                    const def = getGearById(item.gearId);
                    if (!def) continue;
                    const name = item.label || def.name;
                    const key = `gear-${item.gearId}-${item.label || ''}`;
                    if (!map.has(key)) {
                      map.set(key, { name, category: def.category, color: def.color || '#f97316', count: 0 });
                    }
                    map.get(key)!.count += 1;
                  }

                  // 2. Aggregate cables from connections & snake connections
                  const xlrCount = calculateXlrCablesCount(connections, channels, placedGear);
                  if (xlrCount > 0) {
                    map.set('cable-xlr', { name: 'XLR Cable', category: 'Cable', color: '#f97316', count: xlrCount });
                  }
                  const tsCount = connections.filter(c => c.cableType === 'quarter_inch').length;
                  if (tsCount > 0) {
                    map.set('cable-ts', { name: '1/4" TRS Cable', category: 'Cable', color: '#38bdf8', count: tsCount });
                  }
                  const spkCount = connections.filter(c => c.cableType === 'speaker').length;
                  if (spkCount > 0) {
                    map.set('cable-spk', { name: 'Speaker Cable', category: 'Cable', color: '#a855f7', count: spkCount });
                  }

                  const aggregated = Array.from(map.values());
                  return aggregated.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-black/30 border border-white/5 rounded-lg px-2 py-1.5 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <div className="truncate flex items-center gap-1.5">
                          <span className="font-bold text-stone-200">{item.name}</span>
                          {item.count > 1 && (
                            <span className="text-[10px] font-mono bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded border border-orange-500/30">
                              x {item.count}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[9px] text-stone-400 capitalize bg-white/5 px-1.5 py-0.5 rounded">
                          {item.category}
                        </span>
                      </div>
                    </div>
                  ));
                })()
              )}
            </div>

            {/* Cable Connection Summary */}
            <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-stone-300 font-bold flex items-center gap-1.5">
                <GitCommit className="w-3.5 h-3.5 text-sky-400" />
                Patch Cables Used:
              </span>
              <span className="font-mono text-sky-400 font-bold bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                {connections.length + channels.filter(ch => ch.assignedGearInstanceId !== null).length} Cables
              </span>
            </div>

            {(connections.length > 0 || channels.some(ch => ch.assignedGearInstanceId !== null)) && (
              <div className="flex gap-2 mt-1.5 text-[10px] text-stone-400">
                <span>XLR: {calculateXlrCablesCount(connections, channels, placedGear)}</span>
                <span>•</span>
                <span>1/4": {connections.filter(c => c.cableType === 'quarter_inch').length}</span>
                <span>•</span>
                <span>Speaker: {connections.filter(c => c.cableType === 'speaker').length}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
