import React from 'react';
import {
  Sparkles,
  Sliders,
  Cable,
  Zap,
  GripVertical,
  Trophy,
  X,
  Radio,
  Headphones,
  Volume2,
  Users,
  Mic,
  Music,
} from 'lucide-react';
import { EnvironmentMode } from '../types';
import { AppLogo } from './AppLogo';

interface IntroWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartMode: (mode: EnvironmentMode) => void;
  onOpenChallenges?: () => void;
}

export const IntroWelcomeModal: React.FC<IntroWelcomeModalProps> = ({
  isOpen,
  onClose,
  onStartMode,
  onOpenChallenges,
}) => {
  if (!isOpen) return null;

  const appName = 'AudioPlot';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        id="intro-welcome-card"
        className="relative w-full max-w-2xl bg-stone-900/98 border border-white/15 text-stone-100 rounded-3xl shadow-2xl p-6 sm:p-7 backdrop-blur-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Ambient Background Gradient */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          id="btn-intro-close"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <AppLogo size="lg" />
          <div>
            <h2 className="text-xl font-black text-stone-100 tracking-tight">
              Welcome to AudioPlot Simulator
            </h2>
            <p className="text-xs text-stone-400">
              Interactive Audio Setup, Stage Plotting & Signal Flow Engine
            </p>
          </div>
        </div>

        {/* Concise Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-4 text-xs text-stone-300">
          {/* Feature 1 */}
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/5">
            <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400 shrink-0 mt-0.5">
              <GripVertical className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-stone-100 mb-0.5 flex items-center gap-1.5">
                <span>1. Gear Locker & Stage Floor</span>
              </div>
              <p className="text-stone-400 leading-relaxed text-[11px]">
                Place instruments (drums, amps, strings, choir, piano), dynamic & condenser mics, DIs, and floor wedges. Drag to reposition or drop to swap.
              </p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/5">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 shrink-0 mt-0.5">
              <Cable className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-stone-100 mb-0.5 flex items-center gap-1.5">
                <span>2. Cables & Snake Box Patching</span>
              </div>
              <p className="text-stone-400 leading-relaxed text-[11px]">
                Wire 1/4&quot; instrument cables to DIs/Amps and balanced XLR lines directly into the 8-Channel Stage Snake with bi-directional drag & drop.
              </p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/5">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 shrink-0 mt-0.5">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-stone-100 mb-0.5 flex items-center gap-1.5">
                <span>3. Console & Live Soundcheck</span>
              </div>
              <p className="text-stone-400 leading-relaxed text-[11px]">
                Configure preamps, toggle +48V Phantom Power, set mic stands & pop filters, and hit Soundcheck to hear real-time synthesized multi-track audio.
              </p>
            </div>
          </div>

          {/* Feature 4: Highlight Challenges */}
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 shrink-0 mt-0.5">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-amber-200 mb-0.5 flex items-center gap-1.5">
                <span>4. Hands-On Audio Challenges</span>
              </div>
              <p className="text-stone-400 leading-relaxed text-[11px]">
                Tackle structured missions (e.g. Acoustic Trio, Rock Band, Jazz Ensemble) with instant rubric scoring, real-time feedback, and shareable reports!
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Mode Selection Action Buttons */}
        <div className="pt-3 border-t border-white/10 mt-5">
          <div className="text-[11px] font-semibold text-stone-400 mb-2.5 text-center">
            Choose how you want to start:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              id="btn-start-studio-plot"
              onClick={() => onStartMode('recording_studio')}
              className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-stone-950 font-black text-xs shadow-lg shadow-orange-950/50 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              <Headphones className="w-4 h-4 shrink-0" />
              <span>Start Studio Plot</span>
            </button>

            <button
              id="btn-start-live-plot"
              onClick={() => onStartMode('live_stage')}
              className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-stone-950 font-black text-xs shadow-lg shadow-blue-950/50 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              <Radio className="w-4 h-4 shrink-0" />
              <span>Start Live Plot</span>
            </button>
          </div>

          {onOpenChallenges && (
            <div className="flex justify-center mt-3">
              <button
                id="btn-intro-browse-challenges"
                onClick={() => {
                  onClose();
                  onOpenChallenges();
                }}
                className="inline-flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-amber-300 transition-colors py-1 px-3 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>Or browse available student challenges</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

