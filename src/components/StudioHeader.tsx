import React from 'react';
import {
  Share2,
  RotateCcw,
  BookOpen,
  Radio,
  Sliders,
  Trophy,
  Sparkles,
} from 'lucide-react';
import { EnvironmentMode } from '../types';
import { AppLogo } from './AppLogo';

interface StudioHeaderProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
  studentName: string;
  onStudentNameChange: (newName: string) => void;
  isSharedView?: boolean;
  period: string;
  onPeriodChange: (newPeriod: string) => void;
  environment: EnvironmentMode;
  onEnvironmentChange: (env: EnvironmentMode) => void;
  onOpenShareModal: () => void;
  onExportPdf?: () => void;
  onOpenGuideModal: () => void;
  onOpenTour?: () => void;
  onOpenChallengeModal?: () => void;
  activeChallengeId?: string | null;
  onResetPlot: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  title,
  onTitleChange,
  studentName,
  onStudentNameChange,
  isSharedView,
  period,
  onPeriodChange,
  environment,
  onEnvironmentChange,
  onOpenShareModal,
  onExportPdf,
  onOpenGuideModal,
  onOpenTour,
  onOpenChallengeModal,
  activeChallengeId,
  onResetPlot,
}) => {
  const appName = 'AudioPlot';

  return (
    <header
      id="studio-header"
      className="bg-black/40 backdrop-blur-xl border-b border-white/10 text-stone-100 px-4 py-2 shadow-2xl select-none sticky top-0 z-30 w-full"
    >
      <div className="w-full flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
        {/* Left: Branding & Assignment Metadata */}
        <div className="flex items-center gap-3 shrink-0">
          <AppLogo size="sm" />
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-extrabold tracking-tight text-stone-100 flex items-center gap-1.5">
              {appName}
            </h1>
            <span className="text-white/20 text-sm">•</span>
            <span className="text-xs text-stone-400 font-medium tracking-wide hidden sm:inline">
              Studio & Stage Plot Designer & Signal Flow Simulator
            </span>
            {isSharedView && studentName && (
              <>
                <span className="text-white/20 text-sm hidden md:inline">•</span>
                <span className="bg-orange-500/20 border border-orange-500/40 text-orange-300 font-bold px-2.5 py-0.5 rounded-full text-xs shadow-sm flex items-center gap-1">
                  <span className="text-stone-400 font-normal">Student:</span> {studentName}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: In-line Environment Switcher + Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Environment Toggle (Recording Studio vs Live Stage) */}
          <div className="flex items-center bg-black/50 p-0.5 rounded-full border border-white/10 backdrop-blur-md shadow-inner">
            <button
              id="btn-env-studio"
              onClick={() => onEnvironmentChange('recording_studio')}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                environment === 'recording_studio'
                  ? 'bg-orange-500 text-stone-950 shadow-md font-bold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Switch to Recording Studio Floor Plan"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Recording Studio</span>
            </button>
            <button
              id="btn-env-live"
              onClick={() => onEnvironmentChange('live_stage')}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                environment === 'live_stage'
                  ? 'bg-purple-600 text-white shadow-md font-bold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Switch to Live Concert Stage Plot"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Live Stage</span>
            </button>
          </div>

          <div className="h-4 w-px bg-white/10 mx-0.5 hidden md:block" />



          {/* Clear Plot Button */}
          <button
            id="btn-clear-plot"
            onClick={onResetPlot}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-rose-500/20 text-stone-300 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 backdrop-blur-md transition-all text-xs font-semibold cursor-pointer"
            title="Clear Plot (Reset all equipment & connections)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear Plot</span>
          </button>

          {/* Challenge Mode Pill Button */}
          {onOpenChallengeModal && (
            <button
              id="btn-open-challenges"
              onClick={onOpenChallengeModal}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border shadow-sm ${
                activeChallengeId
                  ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-amber-950/60 ring-2 ring-amber-300'
                  : 'bg-white/5 hover:bg-white/10 text-amber-300 border-amber-500/30'
              }`}
              title="Practice pre-set tracking & sound challenges"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>{activeChallengeId ? 'Challenge Mode' : 'Challenges'}</span>
            </button>
          )}

          {/* Quick Mic Reference Guide */}
          <button
            id="btn-mic-guide"
            onClick={onOpenGuideModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-stone-300 border border-white/10 backdrop-blur-md transition-all text-xs font-semibold"
            title="Open Microphone & Signal Chain Guide"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Guide</span>
          </button>

          {/* Quick How-To Tour Walkthrough */}
          {onOpenTour && (
            <button
              id="btn-open-tour"
              onClick={onOpenTour}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-orange-500/20 text-stone-300 hover:text-orange-300 border border-white/10 hover:border-orange-500/30 backdrop-blur-md transition-all text-xs font-semibold"
              title="Open step-by-step How-To Tour"
            >
              <Sparkles className="w-3.5 h-3.5 text-orange-400" />
              <span>How-To</span>
            </button>
          )}





          {/* Share / Export Modal */}
          <button
            id="btn-share-submit"
            onClick={onOpenShareModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 transition-all cursor-pointer"
            title="Generate share URL & export PDF report"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share & Submit</span>
          </button>
        </div>
      </div>
    </header>
  );
};
