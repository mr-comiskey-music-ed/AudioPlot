import React, { useState } from 'react';
import {
  Trophy,
  X,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Sliders,
  Radio,
  Headphones,
  Lightbulb,
  Layers,
} from 'lucide-react';
import { EnvironmentMode, ChallengeDefinition } from '../types';
import { STUDIO_CHALLENGES, LIVE_STAGE_CHALLENGES } from '../data/challenges';

interface ChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  environment: EnvironmentMode;
  activeChallengeId: string | null;
  onSelectChallenge: (challenge: ChallengeDefinition | null) => void;
}

export const ChallengeModal: React.FC<ChallengeModalProps> = ({
  isOpen,
  onClose,
  environment,
  activeChallengeId,
  onSelectChallenge,
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'recording_studio' | 'live_stage'>('all');

  if (!isOpen) return null;

  const allChallengesList: ChallengeDefinition[] = [...STUDIO_CHALLENGES, ...LIVE_STAGE_CHALLENGES];

  const displayedChallenges =
    filterTab === 'all'
      ? allChallengesList
      : filterTab === 'recording_studio'
      ? STUDIO_CHALLENGES
      : LIVE_STAGE_CHALLENGES;

  return (
    <div
      id="challenge-selection-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="bg-stone-900 border-2 border-amber-500/60 rounded-3xl max-w-3xl w-full p-6 shadow-2xl text-stone-100 relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-950/50">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-stone-100">
                  Hands-On Audio Challenges
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wide">
                  8 Available Missions
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Practice real-world engineering scenarios across Studio Recording & Live Stage setups.
              </p>
            </div>
          </div>
          <button
            id="btn-challenge-modal-close"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-100 p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Controls: Mode Filter Tabs & Freeform Card */}
        <div className="pt-3 pb-2 shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Mode Category Filter Tabs */}
          <div className="flex items-center p-1 bg-stone-950/80 rounded-2xl border border-white/10 text-xs shrink-0">
            <button
              onClick={() => setFilterTab('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                filterTab === 'all'
                  ? 'bg-amber-500 text-stone-950 shadow-md'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All ({allChallengesList.length})</span>
            </button>
            <button
              onClick={() => setFilterTab('recording_studio')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                filterTab === 'recording_studio'
                  ? 'bg-orange-500 text-stone-950 shadow-md'
                  : 'text-stone-400 hover:text-orange-300'
              }`}
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Studio ({STUDIO_CHALLENGES.length})</span>
            </button>
            <button
              onClick={() => setFilterTab('live_stage')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                filterTab === 'live_stage'
                  ? 'bg-blue-500 text-stone-950 shadow-md'
                  : 'text-stone-400 hover:text-blue-300'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Live Stage ({LIVE_STAGE_CHALLENGES.length})</span>
            </button>
          </div>

          {/* Freeform Switcher Option */}
          <div
            onClick={() => {
              onSelectChallenge(null);
              onClose();
            }}
            className={`px-3 py-1.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-xs ${
              !activeChallengeId
                ? 'bg-orange-500/20 border-orange-500 text-orange-200 ring-1 ring-orange-400/40'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-stone-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span className="font-bold">Freeform Mode</span>
            </div>
            {!activeChallengeId ? (
              <span className="text-[10px] font-bold text-orange-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Active
              </span>
            ) : (
              <span className="text-[10px] text-stone-400 hover:text-stone-200">Switch</span>
            )}
          </div>
        </div>

        {/* Challenge Cards List */}
        <div className="flex-1 overflow-y-auto pr-1 py-2 flex flex-col gap-3">
          {displayedChallenges.map((challenge) => {
            const isActive = activeChallengeId === challenge.id;
            const isStudio = challenge.environment === 'recording_studio';

            return (
              <div
                key={challenge.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isActive
                    ? 'bg-amber-500/15 border-amber-500/80 ring-1 ring-amber-400/50 text-stone-100 shadow-xl'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-stone-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider flex items-center gap-1 ${
                          isStudio
                            ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                        }`}
                      >
                        {isStudio ? (
                          <>
                            <Headphones className="w-2.5 h-2.5" /> Studio Mode
                          </>
                        ) : (
                          <>
                            <Radio className="w-2.5 h-2.5" /> Live Stage Mode
                          </>
                        )}
                      </span>
                      <span className="text-xs font-black text-amber-400 uppercase tracking-wide">
                        {challenge.title}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-stone-100">{challenge.subtitle}</div>
                  </div>

                  <button
                    onClick={() => {
                      onSelectChallenge(challenge);
                      onClose();
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-amber-500 text-stone-950 shadow-md'
                        : isStudio
                        ? 'bg-orange-500/20 hover:bg-orange-500 text-orange-300 hover:text-stone-950 border border-orange-500/40'
                        : 'bg-blue-500/20 hover:bg-blue-500 text-blue-300 hover:text-stone-950 border border-blue-500/40'
                    }`}
                  >
                    <span>{isActive ? 'Current Scenario' : 'Start Challenge'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-xs text-stone-300 mb-3 leading-relaxed">
                  {challenge.description}
                </p>

                {/* Pre-Assigned Instruments Pill Tags */}
                <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                  <span className="text-[10px] text-stone-400 font-bold mr-1">Pre-Set Stage Sources:</span>
                  {challenge.instruments.map((inst, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/10 text-stone-200 border border-white/10"
                    >
                      {inst.label}
                    </span>
                  ))}
                </div>

                {/* Challenge Hint */}
                {challenge.hint && (
                  <div className="bg-black/40 border border-amber-500/20 rounded-xl p-2.5 flex items-start gap-2 text-[11px] text-amber-200/90">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Pro Hint:</strong> {challenge.hint}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-stone-400 shrink-0">
          <span>Selecting a challenge automatically configures the plot and switches to the correct environment.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-stone-200 font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
