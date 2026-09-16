import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Award,
  ShieldCheck,
  X,
  ExternalLink,
  User,
  Activity,
} from 'lucide-react';
import { StudioProjectState, RubricEvaluation } from '../types';

interface VerifiedGradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  project: StudioProjectState;
  evaluation: RubricEvaluation;
  onLoadProject: (project: StudioProjectState) => void;
}

export const VerifiedGradeModal: React.FC<VerifiedGradeModalProps> = ({
  isOpen,
  onClose,
  studentName,
  project,
  evaluation,
  onLoadProject,
}) => {
  if (!isOpen) return null;

  const isHigh = evaluation.percentage >= 90;
  const isMedium = evaluation.percentage >= 70 && evaluation.percentage < 90;

  const handleLoadAndInspect = () => {
    onLoadProject(project);
    onClose();
  };

  return (
    <div
      id="verified-grade-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 select-none"
    >
      <div
        id="verified-grade-modal-card"
        className="bg-stone-950/95 backdrop-blur-2xl border border-emerald-500/40 rounded-3xl max-w-xl w-full p-6 text-stone-100 shadow-[0_0_50px_rgba(52,211,153,0.15)] overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-inner backdrop-blur-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-stone-100">
                  Verified Student Grade Report
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Tamper-Proof Secure ✓
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Audio Engineering Assignment Submission Verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white border border-white/10 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Scrollable */}
        <div className="space-y-4 overflow-y-auto pr-1">
          {/* Student & Score Banner */}
          <div className="p-4 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/30 rounded-2xl flex items-center justify-between backdrop-blur-md">
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>Submitted Student Engineer</span>
              </div>
              <h4 className="text-lg font-black text-white tracking-tight">
                {studentName || project.studentName || 'Unnamed Student'}
              </h4>
              <p className="text-[11px] text-stone-400">
                Project Title: <span className="text-stone-200 font-semibold">{project.title}</span> ({project.className || 'Audio Production'}, Period {project.period || '1'})
              </p>
            </div>

            <div className="flex flex-col items-end">
              <div
                className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black border-2 shadow-xl ${
                  isHigh
                    ? 'bg-emerald-950/90 text-emerald-300 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.4)]'
                    : isMedium
                    ? 'bg-orange-950/90 text-orange-300 border-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.4)]'
                    : 'bg-rose-950/90 text-rose-300 border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.4)]'
                }`}
              >
                <span className="text-xl font-black tracking-tighter">{evaluation.percentage}%</span>
                <span className="text-[9px] uppercase tracking-wider font-bold opacity-85">Grade</span>
              </div>
            </div>
          </div>

          {/* Critical Issues / Feedback Notice */}
          {evaluation.criticalIssues.length > 0 && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs space-y-1.5 backdrop-blur-md">
              <div className="font-bold text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Detected Setup Issues ({evaluation.criticalIssues.length}):</span>
              </div>
              <ul className="space-y-1 pl-4 list-disc text-rose-200 text-[11px]">
                {evaluation.criticalIssues.map((issue, idx) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Rubric Categories Summary */}
          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-stone-400 px-1">
              Rubric Assessment Breakdown
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(
                Object.entries(evaluation.categories) as [
                  string,
                  RubricEvaluation['categories'][keyof RubricEvaluation['categories']]
                ][]
              ).map(([key, cat]) => {
                const isPerfect = cat.status === 'perfect';
                const isNA = cat.status === 'not_applicable';
                return (
                  <div
                    key={key}
                    className="p-3 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between text-xs backdrop-blur-md"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isPerfect ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : isNA ? (
                        <div className="w-4 h-4 rounded-full bg-stone-700 text-stone-400 text-[10px] flex items-center justify-center font-bold">N/A</div>
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      <span className="font-bold text-stone-200 truncate">{cat.name}</span>
                    </div>
                    <span className={`text-xs font-black ${isPerfect ? 'text-emerald-400' : isNA ? 'text-stone-400' : 'text-amber-400'}`}>
                      {cat.score}/{cat.maxScore}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-stone-300 text-xs font-bold border border-white/10 transition-all cursor-pointer"
          >
            Close
          </button>
          <button
            id="btn-load-student-plot"
            onClick={handleLoadAndInspect}
            className="px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-stone-950 font-black text-xs shadow-lg shadow-emerald-950/40 flex items-center gap-2 transition-all cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Load & Inspect Student Plot on Stage</span>
          </button>
        </div>
      </div>
    </div>
  );
};
