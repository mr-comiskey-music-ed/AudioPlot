import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Zap,
  Volume2,
  VolumeX,
  Radio,
  Sliders,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronRight,
  BarChart2,
  GitCommit,
} from 'lucide-react';
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

type DisplayMode = 'oscilloscope' | 'spectrum' | 'signal_flow';
type OscilloscopeColor = 'green' | 'blue' | 'amber';

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

// Frequency response weighting function per instrument gearId to eliminate unwanted sub-bass
function getInstrumentFrequencyWeight(gearId: string, freqHz: number): number {
  switch (gearId) {
    case 'inst_flute':
      if (freqHz < 240) return 0.01;
      if (freqHz >= 240 && freqHz <= 9000) return 1.0;
      return Math.max(0.1, 1.0 - (freqHz - 9000) / 4000);
    case 'inst_violin':
      if (freqHz < 180) return 0.02;
      if (freqHz >= 180 && freqHz <= 11000) return 1.0;
      return Math.max(0.1, 1.0 - (freqHz - 11000) / 4000);
    case 'inst_trumpet':
      if (freqHz < 150) return 0.02;
      if (freqHz >= 150 && freqHz <= 8000) return 1.0;
      return Math.max(0.1, 1.0 - (freqHz - 8000) / 3000);
    case 'inst_hi_hat':
    case 'inst_drum_cymbals':
      if (freqHz < 3500) return 0.01;
      if (freqHz >= 3500 && freqHz <= 19000) return 1.0;
      return 0.7;
    case 'inst_snare_drum':
      if (freqHz < 130) return 0.04;
      if (freqHz >= 130 && freqHz <= 9000) return 1.0;
      return 0.5;
    case 'inst_kick_drum':
      if (freqHz <= 180) return 1.0;
      return Math.max(0.05, 1.0 - (freqHz - 180) / 1000);
    case 'inst_bass_guitar':
    case 'inst_double_bass':
      if (freqHz < 38) return 0.1;
      if (freqHz >= 38 && freqHz <= 3000) return 1.0;
      return Math.max(0.1, 1.0 - (freqHz - 3000) / 2000);
    case 'inst_acoustic_guitar':
    case 'inst_electric_guitar':
      if (freqHz < 75) return 0.05;
      if (freqHz >= 75 && freqHz <= 8500) return 1.0;
      return Math.max(0.1, 1.0 - (freqHz - 8500) / 4000);
    case 'inst_acoustic_piano':
    case 'inst_keyboard':
      if (freqHz < 26) return 0.15;
      return 1.0;
    case 'inst_voice':
    case 'inst_choir':
      if (freqHz < 90) return 0.04;
      if (freqHz >= 90 && freqHz <= 7500) return 1.0;
      return Math.max(0.1, 1.0 - (freqHz - 7500) / 3000);
    default:
      return 1.0;
  }
}

export const ChannelOscilloscopeViewer: React.FC<ChannelOscilloscopeViewerProps> = ({
  selectedChannelNumber,
  onSelectChannel,
  channels,
  placedGear,
  connections = [],
  environment,
  isPlayingAudio,
  onUpdateChannel,
  masterBus,
  onUpdateMasterBus,
  onToggleSoundcheck,
  isCompact = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timeDataRef = useRef<Uint8Array>(new Uint8Array(256));
  const freqDataRef = useRef<Uint8Array>(new Uint8Array(128));
  const peakHistoryRef = useRef<number>(0);
  const rmsHistoryRef = useRef<number>(0);

  // Viewer interactive settings
  const [displayMode, setDisplayMode] = useState<DisplayMode>('oscilloscope');
  const [isFrozen, setIsFrozen] = useState<boolean>(false);
  const [frozenTimeData, setFrozenTimeData] = useState<number[] | null>(null);
  const [timebaseScale, setTimebaseScale] = useState<number>(1); // 0.5x, 1x, 2x, 4x
  const [voltsZoom, setVoltsZoom] = useState<number>(1); // 1x, 2x, 4x
  const [triggerStabilize, setTriggerStabilize] = useState<boolean>(true);
  const [traceColor, setTraceColor] = useState<OscilloscopeColor>('green');

  // Derive active channel object
  const isMaster = selectedChannelNumber === 'master';
  const effectiveMaster: MasterBusState = masterBus || {
    fader: 75,
    gain: 50,
    pan: 0,
    muted: false,
    dim: false,
    mono: false,
  };

  const activeChannel: MixerChannelState = isMaster
    ? {
        channelNumber: 0,
        assignedGearInstanceId: null,
        label: 'Master Stereo Out',
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
  const channelSignal = validateChannelSignalChain(
    activeChannel,
    placedGear,
    connections,
    channels,
    environment
  );

  const isAudible = isMaster
    ? channels.some((c) => (hasAnySolo ? c.solo && !c.muted : !c.muted) && c.fader > 5) && !effectiveMaster.muted && effectiveMaster.fader > 5
    : (hasAnySolo ? activeChannel.solo && !activeChannel.muted : !activeChannel.muted) &&
      activeChannel.fader > 5;

  const isSignalActive = isPlayingAudio && isAudible && (isMaster || channelSignal.hasSignal);
  const hasChainError = Boolean(!isMaster && assignedGear && !channelSignal.hasSignal);

  // Gain staging calculations
  const UNITY_VAL = 72;
  const rawGain = isMaster
    ? effectiveMaster.gain !== undefined ? effectiveMaster.gain : UNITY_VAL
    : activeChannel.gain !== undefined ? activeChannel.gain : UNITY_VAL;
  
  let preampRatio = 1;
  if (rawGain === 0) {
    preampRatio = 0;
  } else if (rawGain <= UNITY_VAL) {
    const db = -48 * (1 - rawGain / UNITY_VAL);
    preampRatio = Math.max(0, Math.pow(10, db / 20));
  } else {
    const db = ((rawGain - UNITY_VAL) / (100 - UNITY_VAL)) * 12;
    preampRatio = Math.pow(10, db / 20);
  }
  const faderRatio = (isMaster ? effectiveMaster.fader : activeChannel.fader) / 75;
  const totalGainMultiplier = preampRatio * Math.pow(faderRatio, 1.4);

  // Oscilloscope Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = canvas.clientWidth || 400;
      const displayHeight = canvas.clientHeight || 180;

      if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      const width = displayWidth;
      const height = displayHeight;
      const centerY = height / 2;

      // 1. Dark CRT Scope Screen Background
      ctx.fillStyle = '#05070a';
      ctx.fillRect(0, 0, width, height);

      // CRT phosphor vignette / radial gradient
      const radGrad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        10,
        width / 2,
        height / 2,
        Math.max(width, height) / 1.1
      );
      radGrad.addColorStop(0, 'rgba(15, 23, 42, 0.4)');
      radGrad.addColorStop(1, 'rgba(2, 6, 23, 0.95)');
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. High-precision Reticle Grid (Volts / Div & Timebase Divisions)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;

      // Grid divisions
      const numHorizDivs = 8;
      const numVertDivs = 6;
      const dx = width / numHorizDivs;
      const dy = height / numVertDivs;

      ctx.beginPath();
      for (let x = dx; x < width; x += dx) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = dy; y < height; y += dy) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Major Center Axis (Crosshair)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();

      // 0dBFS & -18dBFS Nominal Headroom Reference Lines
      ctx.setLineDash([3, 4]);
      // Top 0dBFS ceiling
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)'; // Red 0dBFS
      ctx.beginPath();
      ctx.moveTo(0, height * 0.1);
      ctx.lineTo(width, height * 0.1);
      ctx.moveTo(0, height * 0.9);
      ctx.lineTo(width, height * 0.9);
      ctx.stroke();

      // -18dBFS Nominal target target zone
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.25)'; // Emerald target
      ctx.beginPath();
      ctx.moveTo(0, height * 0.28);
      ctx.lineTo(width, height * 0.28);
      ctx.moveTo(0, height * 0.72);
      ctx.lineTo(width, height * 0.72);
      ctx.stroke();
      ctx.setLineDash([]);

      // Axis Tick marks along center crosshair
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      for (let x = 0; x <= width; x += dx / 5) {
        ctx.moveTo(x, centerY - 2);
        ctx.lineTo(x, centerY + 2);
      }
      for (let y = 0; y <= height; y += dy / 5) {
        ctx.moveTo(width / 2 - 2, y);
        ctx.lineTo(width / 2 + 2, y);
      }
      ctx.stroke();

      // 3. Audio Data Extraction
      const timeArray = timeDataRef.current;
      const freqArray = freqDataRef.current;
      let peakAmp = 0;
      let rmsAmp = 0;
      let hasRealData = false;

      if (isMaster) {
        if (isPlayingAudio) {
          const res = audioEngine.getMasterWaveformData(timeArray);
          hasRealData = res.hasData;
          peakAmp = res.peakAmplitude;
          rmsAmp = res.rmsAmplitude;
          audioEngine.getMasterFrequencyData(freqArray);
        }
      } else if (isSignalActive && channelSignal.instrumentGear) {
        let targetGearId = channelSignal.instrumentGear.gearId;
        if (targetGearId === 'drummer' || targetGearId === 'inst_drum_set') {
          targetGearId = 'inst_kick_drum';
        }
        const res = audioEngine.getGearWaveformData(targetGearId, timeArray);
        hasRealData = res.hasData;
        peakAmp = res.peakAmplitude * totalGainMultiplier;
        rmsAmp = res.rmsAmplitude * totalGainMultiplier;
        audioEngine.getGearFrequencyData(targetGearId, freqArray);
      }

      // Smooth peak & RMS history
      peakHistoryRef.current = Math.max(peakAmp, peakHistoryRef.current * 0.88);
      rmsHistoryRef.current = Math.max(rmsAmp, rmsHistoryRef.current * 0.9);

      // Color Theme Selection
      const primaryColor =
        traceColor === 'green'
          ? '#22c55e'
          : traceColor === 'blue'
          ? '#38bdf8'
          : '#f59e0b';
      const glowColor =
        traceColor === 'green'
          ? 'rgba(34, 197, 94, 0.4)'
          : traceColor === 'blue'
          ? 'rgba(56, 189, 248, 0.4)'
          : 'rgba(245, 158, 11, 0.4)';
      const clipColor = '#ef4444';

      // 4. Render Modes
      if (displayMode === 'spectrum') {
        // ========== FFT RTA FREQUENCY SPECTRUM VIEW ==========
        const barCount = 48;
        const barWidth = (width - 20) / barCount;
        const startX = 10;

        for (let b = 0; b < barCount; b++) {
          const freqHz = 20 * Math.pow(1000, b / (barCount - 1));
          const dataIdx = Math.floor((b / barCount) * (freqArray.length * 0.75));
          const activeGearId = isMaster ? 'inst_acoustic_piano' : (assignedGear?.gearId || 'inst_voice');
          const weight = getInstrumentFrequencyWeight(activeGearId, freqHz);

          let val = 0;
          if (hasRealData && isSignalActive) {
            const rawVal = freqArray[dataIdx] / 255;
            val = rawVal * weight;
          } else if (!hasRealData && isSignalActive) {
            const harmonic = Math.sin(b * 0.3 + phase) * 0.35 + Math.sin(b * 0.12) * 0.45 + 0.2;
            val = Math.max(0.02, Math.min(0.95, harmonic * weight * totalGainMultiplier * 0.75));
          }

          const barHeight = Math.max(2, val * (height * 0.75));
          const bx = startX + b * barWidth;
          const by = height - 20 - barHeight;

          // Color gradient based on frequency & clipping
          const isHot = val > 0.85;
          const grad = ctx.createLinearGradient(0, height - 20, 0, by);
          grad.addColorStop(0, 'rgba(34, 197, 94, 0.8)');
          grad.addColorStop(0.6, 'rgba(250, 204, 21, 0.85)');
          grad.addColorStop(1, isHot ? clipColor : primaryColor);

          ctx.fillStyle = grad;
          ctx.fillRect(bx + 1, by, barWidth - 2, barHeight);

          // Top peak cap
          ctx.fillStyle = isHot ? '#fca5a5' : '#ffffff';
          ctx.fillRect(bx + 1, by, barWidth - 2, 2);
        }

        // Frequency axis labels
        ctx.fillStyle = '#64748b';
        ctx.font = '8px ui-monospace, SFMono-Regular, Menlo, monospace';
        const freqs = ['40Hz', '100Hz', '250Hz', '1kHz', '4kHz', '10kHz', '18kHz'];
        freqs.forEach((f, i) => {
          const fx = startX + (i / (freqs.length - 1)) * (width - 30);
          ctx.fillText(f, fx, height - 6);
        });
      } else if (displayMode === 'signal_flow') {
        // ========== SIGNAL FLOW BLOCK DIAGRAM VIEW ==========
        const stages = isMaster
          ? [
              { name: 'CHANNELS SUM', val: `${channels.filter((c) => !c.muted).length} ACTIVE`, ok: isAudible },
              { name: 'BUS PRE-FADER', val: 'STEREO L/R', ok: true },
              { name: 'MASTER FADER', val: faderToDb(activeChannel.fader), ok: activeChannel.fader > 5 },
              { name: 'SPEAKER OUT', val: 'MONITORS', ok: isPlayingAudio && isAudible },
            ]
          : [
              {
                name: 'TRANSDUCER',
                val: assignedDef?.name || 'UNPATCHED',
                ok: Boolean(assignedGear),
                err: !assignedGear ? 'No Mic Patched' : undefined,
              },
              {
                name: 'PREAMP / +48V',
                val: `${trimToPreampDb(rawGain)} ${activeChannel.phantomPower ? '(+48V ON)' : ''}`,
                ok: !hasChainError,
                err: hasChainError ? channelSignal.error : undefined,
              },
              {
                name: 'PAN & MUTE',
                val: activeChannel.muted ? 'MUTED' : activeChannel.pan === 0 ? 'CENTER' : `PAN ${activeChannel.pan}`,
                ok: !activeChannel.muted,
                err: activeChannel.muted ? 'Muted' : undefined,
              },
              {
                name: 'CHANNEL FADER',
                val: faderToDb(activeChannel.fader),
                ok: activeChannel.fader > 5,
                err: activeChannel.fader <= 5 ? '-∞ dB' : undefined,
              },
              {
                name: 'STEREO BUS',
                val: 'TO MASTER',
                ok: isAudible && !hasChainError,
              },
            ];

        const stepWidth = (width - 40) / stages.length;
        stages.forEach((st, idx) => {
          const sx = 20 + idx * stepWidth;
          const sy = centerY - 28;
          const sw = stepWidth - 14;
          const sh = 56;

          // Box container
          ctx.fillStyle = st.ok ? 'rgba(30, 41, 59, 0.8)' : 'rgba(239, 68, 68, 0.15)';
          ctx.strokeStyle = st.ok ? 'rgba(56, 189, 248, 0.5)' : 'rgba(239, 68, 68, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(sx, sy, sw, sh, 8);
          ctx.fill();
          ctx.stroke();

          // Stage Title
          ctx.font = 'bold 8px system-ui, -apple-system, sans-serif';
          ctx.fillStyle = st.ok ? '#94a3b8' : '#fca5a5';
          ctx.fillText(st.name, sx + 6, sy + 14);

          // Stage Value
          ctx.font = 'bold 9px ui-monospace, monospace';
          ctx.fillStyle = st.ok ? '#f8fafc' : '#ef4444';
          const valText = st.val.length > 14 ? `${st.val.substring(0, 13)}…` : st.val;
          ctx.fillText(valText, sx + 6, sy + 30);

          // Status indicator
          ctx.fillStyle = st.ok ? '#22c55e' : '#ef4444';
          ctx.beginPath();
          ctx.arc(sx + sw - 10, sy + 14, 3, 0, Math.PI * 2);
          ctx.fill();

          // Arrow to next stage
          if (idx < stages.length - 1) {
            const arrX = sx + sw + 2;
            const arrY = centerY;
            ctx.strokeStyle = st.ok ? 'rgba(56, 189, 248, 0.6)' : 'rgba(148, 163, 184, 0.3)';
            ctx.beginPath();
            ctx.moveTo(arrX, arrY);
            ctx.lineTo(arrX + 10, arrY);
            ctx.lineTo(arrX + 7, arrY - 3);
            ctx.moveTo(arrX + 10, arrY);
            ctx.lineTo(arrX + 7, arrY + 3);
            ctx.stroke();
          }
        });
      } else {
        // ========== REAL-TIME TIME-DOMAIN OSCILLOSCOPE TRACE ==========
        if (isFrozen && frozenTimeData) {
          // Render frozen static waveform
          renderWaveformTrace(
            ctx,
            frozenTimeData,
            width,
            height,
            centerY,
            primaryColor,
            glowColor,
            clipColor,
            totalGainMultiplier,
            voltsZoom
          );
        } else if (isMaster ? isPlayingAudio : isSignalActive) {
          // Trigger stabilization: find rising zero-crossing index
          let triggerOffset = 0;
          if (triggerStabilize && hasRealData) {
            for (let i = 1; i < timeArray.length - 128; i++) {
              if (timeArray[i - 1] < 128 && timeArray[i] >= 128) {
                triggerOffset = i;
                break;
              }
            }
          }

          // Sample points
          const sampleCount = Math.floor(128 / timebaseScale);
          const rawPoints: number[] = [];

          for (let i = 0; i < sampleCount; i++) {
            const dataIdx = triggerOffset + Math.floor(i * timebaseScale);
            let v = 0;
            if (hasRealData && dataIdx < timeArray.length) {
              v = (timeArray[dataIdx] - 128) / 128; // -1.0 to +1.0
            } else {
              // Smooth dynamic fallback
              const freq = i * 0.12 + phase;
              v = Math.sin(freq) * 0.5 + Math.sin(freq * 2.1 + phase * 0.5) * 0.25;
            }
            rawPoints.push(v);
          }

          renderWaveformTrace(
            ctx,
            rawPoints,
            width,
            height,
            centerY,
            primaryColor,
            glowColor,
            clipColor,
            totalGainMultiplier,
            voltsZoom
          );
        } else {
          // Standby / Quiescent resting line
          ctx.beginPath();
          ctx.moveTo(0, centerY);

          const restingColor = hasChainError
            ? '#f59e0b'
            : activeChannel.muted
            ? '#f43f5e'
            : '#475569';

          const restingAmp = isPlayingAudio && hasChainError ? 2 : 0.6;
          for (let x = 0; x <= width; x += 4) {
            const y = centerY + Math.sin(x * 0.08 + phase) * restingAmp;
            ctx.lineTo(x, y);
          }

          ctx.strokeStyle = restingColor;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // 5. On-Screen Scope Diagnostics Overlay HUD
      ctx.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, Monaco, monospace';
      ctx.textBaseline = 'top';

      // Top Left: Channel Tag & Source
      ctx.fillStyle = '#f8fafc';
      const chLabel = isMaster ? 'MASTER STEREO SUM' : `CH ${activeChannel.channelNumber}: ${activeChannel.label || assignedDef?.name || 'INPUT'}`;
      ctx.fillText(chLabel, 10, 8);

      // Top Right: Peak & RMS Meter Readouts
      if (isSignalActive) {
        const peakDb = peakHistoryRef.current > 0 ? (20 * Math.log10(peakHistoryRef.current)).toFixed(1) : '-∞';
        const rmsDb = rmsHistoryRef.current > 0 ? (20 * Math.log10(rmsHistoryRef.current)).toFixed(1) : '-∞';
        const isClipping = peakHistoryRef.current > 0.95;

        // Live Clip / Nominal Indicator
        ctx.fillStyle = isClipping ? '#ef4444' : '#22c55e';
        ctx.beginPath();
        ctx.arc(width - 125, 12, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isClipping ? '#fca5a5' : '#cbd5e1';
        ctx.fillText(`PK: ${peakDb} dBFS  RMS: ${rmsDb} dBFS`, width - 116, 8);
      } else if (hasChainError) {
        ctx.fillStyle = '#f59e0b';
        ctx.fillText(`SIGNAL CHAIN ERROR`, width - 130, 8);
      } else {
        ctx.fillStyle = '#64748b';
        ctx.fillText(`STANDBY (NO SIGNAL)`, width - 130, 8);
      }

      // Bottom Left: Scope Scaling Parameters
      ctx.font = '8px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = '#64748b';
      const scaleText = `TIME: ${timebaseScale}x  |  V/DIV: ${voltsZoom}x  |  PREAMP: ${trimToPreampDb(rawGain)}  |  FADER: ${faderToDb(activeChannel.fader)}`;
      ctx.fillText(scaleText, 10, height - 16);

      ctx.restore();
      phase += 0.06;
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [
    displayMode,
    isFrozen,
    frozenTimeData,
    timebaseScale,
    voltsZoom,
    triggerStabilize,
    traceColor,
    activeChannel,
    isMaster,
    isPlayingAudio,
    isSignalActive,
    hasChainError,
    assignedGear,
    assignedDef,
    channelSignal,
    rawGain,
    totalGainMultiplier,
    channels,
  ]);

  // Helper to draw the waveform path on the canvas with gain staging clipping
  const renderWaveformTrace = (
    ctx: CanvasRenderingContext2D,
    points: number[],
    width: number,
    height: number,
    centerY: number,
    primaryColor: string,
    glowColor: string,
    clipColor: string,
    gainMultiplier: number,
    zoom: number
  ) => {
    const sliceWidth = width / (points.length - 1);
    const coords: { x: number; y: number; isClipped: boolean }[] = [];
    let isAnyClipped = false;

    // Headroom rails (pixels from center)
    const maxAmplitudePix = height * 0.42;

    for (let i = 0; i < points.length; i++) {
      let amp = points[i] * gainMultiplier * zoom;

      // Soft/Hard clipping when amplitude exceeds 1.0 (0dBFS ceiling)
      let isClipped = false;
      if (amp > 0.95) {
        amp = 0.95 + Math.tanh((amp - 0.95) * 0.5) * 0.05; // Hard ceiling flattening
        isClipped = true;
        isAnyClipped = true;
      } else if (amp < -0.95) {
        amp = -0.95 + Math.tanh((amp + 0.95) * 0.5) * 0.05;
        isClipped = true;
        isAnyClipped = true;
      }

      const y = centerY - amp * maxAmplitudePix;
      coords.push({ x: i * sliceWidth, y, isClipped });
    }

    // 1. Translucent glowing fill under waveform
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(coords[0].x, centerY);
    coords.forEach((pt) => ctx.lineTo(pt.x, pt.y));
    ctx.lineTo(coords[coords.length - 1].x, centerY);
    ctx.closePath();

    const fillGrad = ctx.createLinearGradient(0, 0, 0, height);
    fillGrad.addColorStop(0, isAnyClipped ? 'rgba(239, 68, 68, 0.3)' : glowColor);
    fillGrad.addColorStop(0.5, 'rgba(15, 23, 42, 0.02)');
    fillGrad.addColorStop(1, isAnyClipped ? 'rgba(239, 68, 68, 0.3)' : glowColor);
    ctx.fillStyle = fillGrad;
    ctx.fill();
    ctx.restore();

    // 2. Glowing Waveform Beam Stroke
    ctx.beginPath();
    ctx.moveTo(coords[0].x, coords[0].y);
    for (let i = 1; i < coords.length; i++) {
      const xc = (coords[i].x + coords[i - 1].x) / 2;
      const yc = (coords[i].y + coords[i - 1].y) / 2;
      ctx.quadraticCurveTo(coords[i - 1].x, coords[i - 1].y, xc, yc);
    }
    ctx.lineTo(coords[coords.length - 1].x, coords[coords.length - 1].y);

    ctx.strokeStyle = isAnyClipped ? clipColor : primaryColor;
    ctx.lineWidth = 2;
    ctx.shadowColor = isAnyClipped ? clipColor : primaryColor;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  // Toggle freeze frame
  const handleToggleFreeze = () => {
    if (!isFrozen) {
      // Capture current buffer into state
      const timeArray = timeDataRef.current;
      const sampleCount = Math.floor(128 / timebaseScale);
      const snapshot: number[] = [];
      for (let i = 0; i < sampleCount; i++) {
        const v = (timeArray[i] - 128) / 128;
        snapshot.push(v);
      }
      setFrozenTimeData(snapshot);
      setIsFrozen(true);
    } else {
      setIsFrozen(false);
      setFrozenTimeData(null);
    }
  };

  // Gain staging health evaluation message
  const getGainStagingDiagnostic = () => {
    if (isMaster) {
      return {
        status: 'ok',
        title: 'Master Stereo Sum',
        desc: 'Monitoring stereo master output bus with calibrated peak headroom.',
      };
    }
    if (!assignedGear) {
      return {
        status: 'unpatched',
        title: 'No Input Source Patched',
        desc: 'Click an XLR port on the mixer or drag a cable to connect an instrument or mic.',
      };
    }
    if (hasChainError) {
      return {
        status: 'error',
        title: 'Signal Chain Broken',
        desc: channelSignal.error || 'Check transducer power (+48V) and cable connections.',
      };
    }
    if (rawGain > 85) {
      return {
        status: 'clipping',
        title: 'Digital Clipping / Overdrive Danger',
        desc: 'Preamp gain is pushed excessively high (+18dB). Reduce trim to prevent harsh digital harmonic distortion.',
      };
    }
    if (rawGain < 25) {
      return {
        status: 'underdriven',
        title: 'Under-Driven / High Noise Floor',
        desc: 'Preamp trim is very low. Increase gain toward unity (0dB) to optimize signal-to-noise ratio.',
      };
    }
    return {
      status: 'perfect',
      title: 'Optimal Gain Staging (-18 dBFS Nominal)',
      desc: 'Clean analog preamp staging with healthy dynamic headroom and zero clipping distortion.',
    };
  };

  const diag = getGainStagingDiagnostic();

  return (
    <div
      id="mixer-oscilloscope-inspector"
      className={`bg-stone-950/90 border border-white/15 rounded-2xl p-3 shadow-2xl backdrop-blur-2xl transition-all ${
        isCompact ? 'w-full' : 'w-full'
      }`}
    >
      {/* Main Body: Canvas Display + Equipment Inventory Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {/* Left / Center: High-Resolution CRT Oscilloscope Screen & Meter Controls */}
        <div className="lg:col-span-8 flex flex-col justify-between">
          <div>
            {/* Top Bar above meter: Title & Scope/Spectrum/Signal Flow Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-black/50 border border-white/10 px-3 py-2 rounded-xl mb-2.5">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider text-stone-200">
                  Real-Time Master Audio Meter & Analyzer
                </span>
              </div>

              {/* View Mode & Scope Controls */}
              <div className="flex items-center gap-1.5">
                {/* Mode Tabs */}
                <div className="flex bg-black/60 p-0.5 rounded-lg border border-white/10">
                  <button
                    onClick={() => setDisplayMode('oscilloscope')}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      displayMode === 'oscilloscope'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-stone-400 hover:text-white'
                    }`}
                    title="Time-Domain Voltage Oscilloscope"
                  >
                    <Activity className="w-3 h-3" />
                    <span>Scope</span>
                  </button>

                  <button
                    onClick={() => setDisplayMode('spectrum')}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      displayMode === 'spectrum'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                        : 'text-stone-400 hover:text-white'
                    }`}
                    title="RTA Real-Time FFT Frequency Spectrum Analyzer"
                  >
                    <BarChart2 className="w-3 h-3" />
                    <span>Spectrum</span>
                  </button>

                  <button
                    onClick={() => setDisplayMode('signal_flow')}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      displayMode === 'signal_flow'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-stone-400 hover:text-white'
                    }`}
                    title="Signal Flow Junction Inspection Pipeline"
                  >
                    <GitCommit className="w-3 h-3" />
                    <span>Signal Flow</span>
                  </button>
                </div>

                {/* Freeze / Hold Button */}
                <button
                  onClick={handleToggleFreeze}
                  className={`p-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    isFrozen
                      ? 'bg-amber-500 text-stone-950 border-amber-400 animate-pulse'
                      : 'bg-white/5 hover:bg-white/10 text-stone-300 border-white/10'
                  }`}
                  title={isFrozen ? 'Resume live scope capture' : 'Freeze / Hold trace for inspection'}
                >
                  {isFrozen ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* High-Resolution CRT Oscilloscope Screen */}
            <div className="w-full h-44 sm:h-52 bg-black rounded-xl border border-white/15 overflow-hidden relative shadow-inner">
              <canvas
                ref={canvasRef}
                className="w-full h-full block cursor-crosshair"
                style={{ width: '100%', height: '100%' }}
              />

              {/* Scope Floating Toolbar (Timebase, Zoom, Trigger, Phosphor Color) */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/80 backdrop-blur-md p-1 rounded-lg border border-white/10 text-[9px] font-mono">
                <span className="text-stone-400 pl-1">TIME:</span>
                {[0.5, 1, 2].map((s) => (
                  <button
                    key={s}
                    onClick={() => setTimebaseScale(s)}
                    className={`px-1.5 py-0.5 rounded ${
                      timebaseScale === s ? 'bg-emerald-500 text-stone-950 font-bold' : 'text-stone-300 hover:bg-white/10'
                    }`}
                  >
                    {s}x
                  </button>
                ))}

                <span className="text-stone-400 pl-1 border-l border-white/10">ZOOM:</span>
                {[1, 2].map((z) => (
                  <button
                    key={z}
                    onClick={() => setVoltsZoom(z)}
                    className={`px-1.5 py-0.5 rounded ${
                      voltsZoom === z ? 'bg-emerald-500 text-stone-950 font-bold' : 'text-stone-300 hover:bg-white/10'
                    }`}
                  >
                    {z}x
                  </button>
                ))}

                <span className="text-stone-400 pl-1 border-l border-white/10">PHOSPHOR:</span>
                {(['green', 'blue', 'amber'] as OscilloscopeColor[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setTraceColor(c)}
                    className={`w-3 h-3 rounded-full border ${
                      c === 'green'
                        ? 'bg-emerald-500 border-emerald-300'
                        : c === 'blue'
                        ? 'bg-sky-400 border-sky-200'
                        : 'bg-amber-400 border-amber-200'
                    } ${traceColor === c ? 'ring-2 ring-white scale-110' : 'opacity-60'}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Diagnostic Banner Below Scope */}
          <div
            className={`mt-2 p-2.5 rounded-xl border flex items-start gap-2 text-xs backdrop-blur-md ${
              diag.status === 'clipping'
                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : diag.status === 'underdriven'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : diag.status === 'error' || diag.status === 'unpatched'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}
          >
            {diag.status === 'clipping' ? (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5 animate-pulse" />
            ) : diag.status === 'underdriven' ? (
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            ) : diag.status === 'perfect' || diag.status === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-bold">{diag.title}</div>
              <div className="text-[11px] opacity-90 leading-tight mt-0.5">{diag.desc}</div>
            </div>
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
