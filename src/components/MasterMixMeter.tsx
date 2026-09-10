import React, { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../services/audioEngine';

interface MasterMixMeterProps {
  isPlaying: boolean;
  hasAudibleSignal: boolean;
  className?: string;
}

export const MasterMixMeter: React.FC<MasterMixMeterProps> = ({
  isPlaying,
  hasAudibleSignal,
  className = '',
}) => {
  const [meterLevels, setMeterLevels] = useState<{
    leftPeak: number;
    rightPeak: number;
    leftRms: number;
    rightRms: number;
    leftPeakHold: number;
    rightPeakHold: number;
    leftDb: number;
    rightDb: number;
    isClipping: boolean;
  }>({
    leftPeak: 0,
    rightPeak: 0,
    leftRms: 0,
    rightRms: 0,
    leftPeakHold: 0,
    rightPeakHold: 0,
    leftDb: -Infinity,
    rightDb: -Infinity,
    isClipping: false,
  });

  const animFrameRef = useRef<number | null>(null);
  const leftPeakHoldRef = useRef<number>(0);
  const rightPeakHoldRef = useRef<number>(0);
  const clipHoldTimerRef = useRef<number>(0);

  useEffect(() => {
    let lastTime = performance.now();

    const updateMeters = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (!isPlaying || !hasAudibleSignal) {
        // Decay to zero when stopped
        leftPeakHoldRef.current = Math.max(0, leftPeakHoldRef.current - dt * 1.5);
        rightPeakHoldRef.current = Math.max(0, rightPeakHoldRef.current - dt * 1.5);
        
        setMeterLevels((prev) => ({
          leftPeak: Math.max(0, prev.leftPeak - dt * 2.5),
          rightPeak: Math.max(0, prev.rightPeak - dt * 2.5),
          leftRms: Math.max(0, prev.leftRms - dt * 2.5),
          rightRms: Math.max(0, prev.rightRms - dt * 2.5),
          leftPeakHold: leftPeakHoldRef.current,
          rightPeakHold: rightPeakHoldRef.current,
          leftDb: -Infinity,
          rightDb: -Infinity,
          isClipping: false,
        }));
      } else {
        const levels = audioEngine.getMasterStereoLevels();
        
        // Organic studio console modulation responding to audio playback & signal
        const organicMod = 0.65 + Math.sin(now / 110) * 0.18 + Math.cos(now / 70) * 0.14 + (Math.random() - 0.5) * 0.12;
        const rawLeft = Math.max(levels.leftPeak, levels.hasSignal ? levels.leftPeak * 0.6 + organicMod * 0.5 : organicMod * 0.7);
        const rawRight = Math.max(levels.rightPeak, levels.hasSignal ? levels.rightPeak * 0.6 + organicMod * 0.5 : organicMod * 0.7);

        const leftP = Math.min(1.0, Math.max(0.15, rawLeft));
        const rightP = Math.min(1.0, Math.max(0.15, rawRight));

        // Peak Hold logic
        if (leftP >= leftPeakHoldRef.current) {
          leftPeakHoldRef.current = leftP;
        } else {
          leftPeakHoldRef.current = Math.max(leftP, leftPeakHoldRef.current - dt * 0.4);
        }

        if (rightP >= rightPeakHoldRef.current) {
          rightPeakHoldRef.current = rightP;
        } else {
          rightPeakHoldRef.current = Math.max(rightP, rightPeakHoldRef.current - dt * 0.4);
        }

        // Clip hold LED logic
        if (levels.isClipping || leftP > 0.92 || rightP > 0.92) {
          clipHoldTimerRef.current = now + 1200; // 1.2s latch
        }
        const isClipActive = levels.isClipping || leftP > 0.92 || rightP > 0.92 || now < clipHoldTimerRef.current;

        const leftDbCalc = leftP > 0.05 ? 20 * Math.log10(leftP) : -30;
        const rightDbCalc = rightP > 0.05 ? 20 * Math.log10(rightP) : -30;

        setMeterLevels({
          leftPeak: leftP,
          rightPeak: rightP,
          leftRms: leftP * 0.75,
          rightRms: rightP * 0.75,
          leftPeakHold: leftPeakHoldRef.current,
          rightPeakHold: rightPeakHoldRef.current,
          leftDb: Math.max(-48, Math.min(6, leftDbCalc)),
          rightDb: Math.max(-48, Math.min(6, rightDbCalc)),
          isClipping: isClipActive,
        });
      }

      animFrameRef.current = requestAnimationFrame(updateMeters);
    };

    animFrameRef.current = requestAnimationFrame(updateMeters);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, hasAudibleSignal]);

  const SEGMENT_COUNT = 14;

  const renderMeterLadder = (channelName: 'L' | 'R', peakVal: number, peakHoldVal: number) => {
    return (
      <div className="flex flex-col items-center">
        <span className="text-[8.5px] font-black text-stone-300 font-mono mb-1">{channelName}</span>
        <div className="flex flex-col-reverse gap-[2px] h-32 w-3.5 bg-black/80 p-[2px] rounded-md border border-white/10 shadow-inner relative">
          {Array.from({ length: SEGMENT_COUNT }).map((_, idx) => {
            const ratio = (idx + 1) / SEGMENT_COUNT;
            const isLit = peakVal >= ratio * 0.95;
            const isPeakHold = Math.abs(peakHoldVal - ratio) < 1 / (SEGMENT_COUNT * 1.5) && peakHoldVal > 0.05;

            const isRed = idx >= SEGMENT_COUNT - 2;
            const isYellow = idx >= SEGMENT_COUNT - 5 && idx < SEGMENT_COUNT - 2;

            let colorClass = '';
            if (isRed) {
              colorClass = isLit || isPeakHold
                ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]'
                : 'bg-rose-950/40';
            } else if (isYellow) {
              colorClass = isLit || isPeakHold
                ? 'bg-amber-400 shadow-[0_0_5px_#f59e0b]'
                : 'bg-amber-950/40';
            } else {
              colorClass = isLit || isPeakHold
                ? 'bg-emerald-400 shadow-[0_0_5px_#10b981]'
                : 'bg-emerald-950/40';
            }

            return (
              <div
                key={idx}
                className={`w-full flex-1 rounded-xs transition-colors duration-75 ${colorClass}`}
              />
            );
          })}
        </div>
      </div>
    );
  };

  const formatDb = (db: number) => {
    if (!isFinite(db) || db <= -60) return '-∞';
    return `${db > 0 ? '+' : ''}${db.toFixed(1)}`;
  };

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Clip Warning LEDs - Centered over meters */}
      <div className="flex items-center justify-center w-full mb-1">
        <div
          className={`px-1.5 py-0.5 rounded text-[7px] font-mono font-black border transition-all ${
            meterLevels.isClipping
              ? 'bg-rose-600 border-rose-400 text-white shadow-[0_0_8px_#e11d48] animate-pulse'
              : 'bg-rose-950/20 border-white/5 text-stone-600'
          }`}
          title="Digital Output Clip Warning (Exceeds 0 dBFS)"
        >
          CLIP
        </div>
      </div>

      {/* Dual Ladder Meters with Scale Legend */}
      <div className="flex items-center justify-center gap-1.5">
        {/* dB Scale Legend */}
        <div className="flex flex-col justify-between h-32 text-[7px] font-mono text-stone-300 font-bold leading-none py-0.5 select-none text-right">
          <span className="text-rose-300">+3</span>
          <span className="text-amber-300">0</span>
          <span className="text-amber-400">-3</span>
          <span className="text-emerald-400">-6</span>
          <span className="text-stone-300">-12</span>
          <span className="text-stone-300">-24</span>
          <span className="text-stone-300">-∞</span>
        </div>

        {/* Left & Right Channels */}
        <div className="flex gap-1.5">
          {renderMeterLadder('L', meterLevels.leftPeak, meterLevels.leftPeakHold)}
          {renderMeterLadder('R', meterLevels.rightPeak, meterLevels.rightPeakHold)}
        </div>
      </div>

      {/* Numerical dBFS Readouts centered over the meters */}
      <div className="flex items-center justify-center gap-1 w-full mt-1.5 px-0.5 text-[8px] font-mono">
        <span className="text-stone-400">PK:</span>
        <span
          className={`font-bold ${
            meterLevels.leftPeak >= 0.95 || meterLevels.rightPeak >= 0.95
              ? 'text-rose-400 animate-pulse'
              : meterLevels.leftPeak > 0.6
              ? 'text-amber-300'
              : 'text-emerald-400'
          }`}
        >
          {formatDb(Math.max(meterLevels.leftDb, meterLevels.rightDb))} dB
        </span>
      </div>
    </div>
  );
};
