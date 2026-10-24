import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight, ListChecks, LogOut, Eye } from 'lucide-react';
import { BatchEntry } from '../services/batchGrading';

interface BatchReviewBarProps {
  entry: BatchEntry;
  position: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onBackToList: () => void;
  onExit: () => void;
}

export const BatchReviewBar: React.FC<BatchReviewBarProps> = ({ entry, position, total, onPrev, onNext, onBackToList, onExit }) => {
  // Left/right arrow keys step through students (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft' && position > 0) onPrev();
      if (e.key === 'ArrowRight' && position < total - 1) onNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [position, total, onPrev, onNext]);

  const pct = entry.evaluation.percentage;
  const color = entry.evaluation.isSandbox ? 'text-stone-400 border-white/20' : pct >= 90 ? 'text-emerald-300 border-emerald-400/50' : pct >= 70 ? 'text-orange-300 border-orange-400/50' : 'text-rose-300 border-rose-400/50';
  const btn = 'p-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer';

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-32px)]">
      <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-stone-950/95 border border-emerald-500/40 shadow-2xl backdrop-blur-xl text-xs text-stone-200">
        <Eye className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="text-stone-400 shrink-0">
          {position + 1} of {total}
        </span>
        <span className="font-black text-white truncate max-w-[160px]">{entry.project.studentName || 'Unnamed student'}</span>
        <span className="text-stone-400 truncate max-w-[180px] hidden sm:inline">
          {entry.project.period ? `P${entry.project.period} · ` : ''}
          {entry.challengeTitle}
        </span>
        <span className={`font-black px-2 py-0.5 rounded-full border ${color} shrink-0`}>
          {entry.evaluation.isSandbox ? 'Not graded' : `${pct}% ${entry.evaluation.gradeLetter}`}
        </span>
        <button onClick={onPrev} disabled={position === 0} className={btn} title="Previous student (←)">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button onClick={onNext} disabled={position >= total - 1} className={btn} title="Next student (→)">
          <ChevronRight className="w-4 h-4" />
        </button>
        <button onClick={onBackToList} className={`${btn} px-2.5 flex items-center gap-1 font-bold`} title="Back to class list">
          <ListChecks className="w-4 h-4" /> <span className="hidden sm:inline">Class list</span>
        </button>
        <button
          onClick={onExit}
          className="px-2.5 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black flex items-center gap-1 cursor-pointer shrink-0"
          title="Stop reviewing and return to your own workspace"
        >
          <LogOut className="w-3.5 h-3.5" /> Done
        </button>
      </div>
    </div>
  );
};
