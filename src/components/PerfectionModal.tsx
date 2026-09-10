import React from 'react';
import { Trophy, Sparkles, ArrowRight, Share2, CheckCircle2, Award, X } from 'lucide-react';
import { ChallengeDefinition } from '../types';

interface PerfectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  challenge: ChallengeDefinition | null;
  nextChallenge: ChallengeDefinition | null;
  onSelectNextChallenge: () => void;
  onOpenShareModal: () => void;
  percentage: number;
}

export const PerfectionModal: React.FC<PerfectionModalProps> = ({
  isOpen,
  onClose,
  challenge,
  nextChallenge,
  onSelectNextChallenge,
  onOpenShareModal,
  percentage,
}) => {
  if (!isOpen || !challenge) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div
        id="perfection-challenge-modal"
        className="relative w-full max-w-lg bg-stone-950/95 border-2 border-emerald-500/40 rounded-3xl shadow-[0_0_60px_rgba(16,185,129,0.25)] p-6 text-stone-100 flex flex-col items-center text-center overflow-hidden"
      >
        {/* Ambient glow accent behind trophy */}
        <div className="absolute -top-20 -left-20 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-stone-400 hover:text-stone-100 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Golden Trophy Icon Badge */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-stone-950 shadow-xl shadow-amber-950/50 mb-3 animate-bounce">
          <Trophy className="w-8 h-8 fill-current" />
        </div>

        {/* Title */}
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-400 mb-1">
          <Sparkles className="w-4 h-4" />
          <span>Challenge Complete!</span>
          <Sparkles className="w-4 h-4" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-stone-100 tracking-tight">
          Perfection! {challenge.title} Passed!
        </h2>
        <p className="text-xs text-stone-400 mt-1 max-w-sm">
          {challenge.subtitle} &bull; All microphones, polar patterns, signal chains, stands, and snake channels passed with a score of <span className="text-emerald-400 font-extrabold">{percentage}%</span>.
        </p>

        {/* Success Checklist Pills */}
        <div className="grid grid-cols-2 gap-2 my-4 w-full text-left text-xs">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="text-[11px] font-bold">Transducer & Polar Match</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="text-[11px] font-bold">+48V Phantom Validated</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="text-[11px] font-bold">8-Channel Snake Patching</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="text-[11px] font-bold">Acoustic Stand Heights</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full mt-2">
          {nextChallenge ? (
            <button
              id="btn-perfection-next-challenge"
              onClick={onSelectNextChallenge}
              className="w-full sm:flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-stone-950 font-black text-sm shadow-lg shadow-emerald-950/50 transition-all group"
            >
              <span>Next Challenge</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          ) : (
            <button
              id="btn-perfection-close"
              onClick={onClose}
              className="w-full sm:flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-sm transition-all"
            >
              <Award className="w-4 h-4" />
              <span>All Challenges Mastered!</span>
            </button>
          )}

          <button
            id="btn-perfection-share"
            onClick={onOpenShareModal}
            className="w-full sm:w-auto flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-stone-200 border border-white/10 font-bold text-xs transition-all"
          >
            <Share2 className="w-4 h-4 text-blue-400" />
            <span>Share & Submit</span>
          </button>
        </div>
      </div>
    </div>
  );
};
