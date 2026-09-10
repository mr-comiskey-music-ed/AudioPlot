import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';
import { PlacedGear, MixerChannelState, CableConnection, EnvironmentMode } from '../types';
import { validateChannelSignalChain } from '../services/gradingEngine';
import { getGearById } from '../data/gearCatalog';

interface ChannelWaveformVisualizerProps {
  channel: MixerChannelState;
  placedGear: PlacedGear[];
  connections?: CableConnection[];
  channels: MixerChannelState[];
  environment: EnvironmentMode;
  isPlayingAudio: boolean;
  hasAnySolo: boolean;
  className?: string;
  isMaster?: boolean;
}

export const ChannelWaveformVisualizer: React.FC<ChannelWaveformVisualizerProps> = ({
  channel,
  placedGear,
  connections = [],
  channels,
  environment,
  isPlayingAudio,
  hasAnySolo,
  className = '',
  isMaster = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array>(new Uint8Array(128));
  const peakHistoryRef = useRef<number>(0);

  // Derive signal status
  const assignedGear = placedGear.find((g) => g.instanceId === channel.assignedGearInstanceId);
  const assignedDef = assignedGear ? getGearById(assignedGear.gearId) : null;
  const channelSignal = validateChannelSignalChain(channel, placedGear, connections, channels, environment);
  
  const isAudible = (hasAnySolo ? channel.solo && !channel.muted : !channel.muted) && channel.fader > 5;
  const isSignalActive = isPlayingAudio && isAudible && channelSignal.hasSignal;
  const hasChainError = Boolean(assignedGear && !channelSignal.hasSignal);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = canvas.clientWidth || 100;
      const displayHeight = canvas.clientHeight || 42;

      // Adjust canvas resolution for high-DPI displays
      if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      const width = displayWidth;
      const height = displayHeight;
      const centerY = height / 2;

      // 1. Clear background & draw oscilloscope screen
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, width, height);

      // Subtle oscilloscope grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      
      // Horizontal center line
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      // Top and bottom headroom guide lines (dashed)
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(0, height * 0.2);
      ctx.lineTo(width, height * 0.2);
      ctx.moveTo(0, height * 0.8);
      ctx.lineTo(width, height * 0.8);
      ctx.stroke();

      // Vertical subdivision markers
      ctx.beginPath();
      for (let x = width * 0.25; x < width; x += width * 0.25) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Sample real-time waveform data or synthesize dynamic idle/active signal
      const dataArray = dataArrayRef.current;
      let peakAmp = 0;
      let hasRealData = false;

      if (isMaster) {
        if (isPlayingAudio) {
          const res = audioEngine.getMasterWaveformData(dataArray);
          hasRealData = res.hasData;
          peakAmp = res.peakAmplitude;
        }
      } else if (isSignalActive && channelSignal.instrumentGear) {
        let targetGearId = channelSignal.instrumentGear.gearId;
        if (targetGearId === 'drummer' || targetGearId === 'inst_drum_set') {
          targetGearId = 'inst_kick_drum';
        }
        const res = audioEngine.getGearWaveformData(targetGearId, dataArray);
        hasRealData = res.hasData;
        peakAmp = res.peakAmplitude;
      }

      // Smooth decay on peak value
      peakHistoryRef.current = Math.max(peakAmp, peakHistoryRef.current * 0.92);
      const currentPeak = peakHistoryRef.current;

      // 3. Render Waveform Trace
      if (isMaster ? isPlayingAudio : isSignalActive) {
        const primaryColor = isMaster
          ? '#f97316' // Orange for master
          : channel.solo
          ? '#facc15' // Amber for solo
          : '#38bdf8'; // Sky blue for live active input

        const glowColor = isMaster ? 'rgba(249, 115, 22, 0.4)' : 'rgba(56, 189, 248, 0.4)';

        // Draw waveform path
        ctx.beginPath();
        const sliceWidth = width / (dataArray.length - 1);
        let x = 0;

        const points: { x: number; y: number }[] = [];

        for (let i = 0; i < dataArray.length; i++) {
          let v = (dataArray[i] - 128) / 128; // -1.0 to +1.0
          
          // Fallback dynamic synthesis if buffer not ready yet
          if (!hasRealData) {
            const faderRatio = channel.fader / 75;
            const synthGain = Math.min(1.2, Math.pow(faderRatio, 1.4) * 0.7);
            const freq = i * 0.15 + phase;
            v = (Math.sin(freq) * 0.6 + Math.sin(freq * 2.3 + phase) * 0.3) * synthGain;
          }

          // Scale to canvas height
          const y = centerY + v * (height * 0.42);
          points.push({ x, y });
          x += sliceWidth;
        }

        // Draw glowing translucent area fill under waveform
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(points[0].x, centerY);
        points.forEach((pt) => ctx.lineTo(pt.x, pt.y));
        ctx.lineTo(points[points.length - 1].x, centerY);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, glowColor);
        grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.02)');
        grad.addColorStop(1, glowColor);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();

        // Draw crisp glowing waveform line
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          // Smooth curve using midpoint interpolation
          const xc = (points[i].x + points[i - 1].x) / 2;
          const yc = (points[i].y + points[i - 1].y) / 2;
          ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);

        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 1.75;
        ctx.shadowColor = primaryColor;
        ctx.shadowBlur = 6;
        ctx.stroke();

        // Reset shadow
        ctx.shadowBlur = 0;
      } else {
        // Quiescent / Standby trace line
        ctx.beginPath();
        ctx.moveTo(0, centerY);

        const statusColor = hasChainError
          ? '#f59e0b' // Amber for signal chain error
          : channel.muted
          ? '#f43f5e' // Rose for muted
          : assignedGear
          ? '#78716c' // Stone for patched but standby
          : '#44403c'; // Dark stone for unpatched

        // Subtle resting trace oscillation
        const restingAmp = isPlayingAudio && hasChainError ? 1.5 : 0.5;
        for (let x = 0; x <= width; x += 4) {
          const y = centerY + Math.sin(x * 0.1 + phase * 0.5) * restingAmp;
          ctx.lineTo(x, y);
        }

        ctx.strokeStyle = statusColor;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // 4. Amplitude Peak Readout / Status Badge (Corner Overlays)
      ctx.font = 'bold 8px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      ctx.textBaseline = 'top';

      if (isMaster ? isPlayingAudio : isSignalActive) {
        // Live glowing status indicator dot
        const dotColor = currentPeak > 0.9 ? '#ef4444' : isMaster ? '#f97316' : '#34d399';
        ctx.fillStyle = dotColor;
        ctx.beginPath();
        ctx.arc(6, 6, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Live amplitude percentage or dB label
        const ampPercent = Math.min(100, Math.round(currentPeak * 100));
        ctx.fillStyle = currentPeak > 0.9 ? '#fca5a5' : '#e2e8f0';
        ctx.fillText(`${ampPercent}%`, 12, 3);

        // Right corner: Status tag
        const tagText = isMaster ? 'MASTER' : channel.solo ? 'SOLO' : 'LIVE';
        ctx.fillStyle = isMaster ? '#fed7aa' : channel.solo ? '#fef08a' : '#86efac';
        const tagWidth = ctx.measureText(tagText).width;
        ctx.fillText(tagText, width - tagWidth - 4, 3);
      } else if (hasChainError) {
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('NO SIGNAL', 4, 3);
        ctx.fillStyle = '#fde68a';
        const errText = 'CHAIN ERR';
        const errWidth = ctx.measureText(errText).width;
        ctx.fillText(errText, width - errWidth - 4, 3);
      } else if (channel.muted) {
        ctx.fillStyle = '#f87171';
        ctx.fillText('MUTED', 4, 3);
      } else if (assignedGear) {
        ctx.fillStyle = '#a8a29e';
        ctx.fillText('STANDBY', 4, 3);
      } else {
        ctx.fillStyle = '#78716c';
        ctx.fillText('UNPATCHED', 4, 3);
      }

      // Bottom Right: Instrument Type or Channel Source Name
      if (assignedDef && !isMaster) {
        ctx.font = '7px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#94a3b8';
        const srcName = assignedDef.name.length > 13 ? `${assignedDef.name.substring(0, 12)}…` : assignedDef.name;
        const nameWidth = ctx.measureText(srcName).width;
        ctx.fillText(srcName, width - nameWidth - 4, height - 9);
      } else if (isMaster) {
        ctx.font = '7px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#fdba74';
        const masterText = 'STEREO SUM';
        const masterWidth = ctx.measureText(masterText).width;
        ctx.fillText(masterText, width - masterWidth - 4, height - 9);
      }

      ctx.restore();
      phase += 0.08;
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [
    channel,
    isMaster,
    isPlayingAudio,
    isSignalActive,
    hasChainError,
    assignedGear,
    assignedDef,
    channelSignal.instrumentGear,
    channelSignal.hasSignal,
    hasAnySolo,
  ]);

  return (
    <div
      id={isMaster ? 'waveform-visualizer-master' : `waveform-visualizer-ch-${channel.channelNumber}`}
      className={`w-full h-11 bg-black/90 rounded-xl border overflow-hidden relative shadow-inner select-none transition-colors ${
        isSignalActive
          ? 'border-sky-500/50 shadow-[0_0_10px_rgba(56,189,248,0.2)]'
          : hasChainError
          ? 'border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.15)]'
          : channel.muted
          ? 'border-rose-500/30'
          : 'border-white/15 hover:border-white/25'
      } ${className}`}
      title={
        isMaster
          ? 'Master Stereo Output Waveform Monitor'
          : isSignalActive
          ? `Live Signal Waveform for CH ${channel.channelNumber} (${assignedDef?.name || 'Active'})`
          : hasChainError
          ? `Signal Chain Broken: ${channelSignal.error || 'Check patch and power'}`
          : `CH ${channel.channelNumber} Waveform Monitor (Standby)`
      }
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};
