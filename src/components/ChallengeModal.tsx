import React, { useState } from 'react';
import {
  Trophy,
  X,
  ArrowRight,
  CheckCircle2,
  Radio,
  Headphones,
  Lightbulb,
  Layers,
  Link2,
  Check,
  Shapes,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { EnvironmentMode, ChallengeDefinition } from '../types';
import { OPEN_TASKS, STUDIO_CHALLENGES, LIVE_STAGE_CHALLENGES } from '../data/challenges';
import { copyText } from '../utils/copyText';

interface ChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  environment: EnvironmentMode;
  activeChallengeId: string | null;
  /** Task the teacher assigned through the link the student opened, if any. */
  assignedTaskId?: string | null;
  onSelectChallenge: (challenge: ChallengeDefinition | null) => void;
}

type Filter = 'all' | 'recording_studio' | 'live_stage';

/** Link that opens AudioPlot straight into one task (for Google Classroom). */
export function buildTaskLink(taskId: string): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('task', taskId);
  return url.toString();
}

export const ChallengeModal: React.FC<ChallengeModalProps> = ({
  isOpen,
  onClose,
  activeChallengeId,
  assignedTaskId,
  onSelectChallenge,
}) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [showTeacherLinks, setShowTeacherLinks] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const byFilter = (list: ChallengeDefinition[]) =>
    filter === 'all' ? list : list.filter((t) => t.environment === filter);

  const copyLink = async (taskId: string) => {
    const ok = await copyText(buildTaskLink(taskId));
    if (ok) {
      setCopiedId(taskId);
      window.setTimeout(() => setCopiedId((id) => (id === taskId ? null : id)), 2000);
    }
  };

  const renderTask = (task: ChallengeDefinition) => {
    const isActive = activeChallengeId === task.id;
    const isAssigned = assignedTaskId === task.id;
    const isStudio = task.environment === 'recording_studio';

    return (
      <div
        key={task.id}
        className={`p-4 rounded-2xl border transition-all ${
          isActive
            ? 'bg-amber-500/15 border-amber-500/80 ring-1 ring-amber-400/50 text-stone-100 shadow-xl'
            : isAssigned
            ? 'bg-sky-500/10 border-sky-400/60 text-stone-200'
            : 'bg-white/5 hover:bg-white/10 border-white/10 text-stone-300'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className={`text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider flex items-center gap-1 ${
                  isStudio
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                }`}
              >
                {isStudio ? <Headphones className="w-2.5 h-2.5" /> : <Radio className="w-2.5 h-2.5" />}
                {isStudio ? 'Studio' : 'Live Stage'}
              </span>
              {isAssigned && (
                <span className="text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider flex items-center gap-1 bg-sky-500/20 text-sky-300 border border-sky-400/50">
                  <GraduationCap className="w-2.5 h-2.5" /> Assigned by your teacher
                </span>
              )}
              <span className="text-xs font-black text-amber-400 uppercase tracking-wide">{task.title}</span>
            </div>
            <div className="text-sm font-bold text-stone-100">{task.subtitle}</div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {showTeacherLinks && (
              <button
                onClick={() => copyLink(task.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                  copiedId === task.id
                    ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                    : 'bg-sky-500/10 hover:bg-sky-500/20 border-sky-400/40 text-sky-300'
                }`}
                title="Copy a link that opens AudioPlot straight into this task. Post it in Google Classroom."
              >
                {copiedId === task.id ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                <span>{copiedId === task.id ? 'Link copied' : 'Copy assignment link'}</span>
              </button>
            )}
            <button
              onClick={() => {
                onSelectChallenge(task);
                onClose();
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-amber-500 text-stone-950 shadow-md'
                  : isStudio
                  ? 'bg-orange-500/20 hover:bg-orange-500 text-orange-300 hover:text-stone-950 border border-orange-500/40'
                  : 'bg-blue-500/20 hover:bg-blue-500 text-blue-300 hover:text-stone-950 border border-blue-500/40'
              }`}
            >
              <span>{isActive ? 'Current Task' : 'Start'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <p className="text-xs text-stone-300 mb-3 leading-relaxed">{task.description}</p>

        {task.instruments.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
            <span className="text-[10px] text-stone-400 font-bold mr-1">Given instruments:</span>
            {task.instruments.map((inst, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/10 text-stone-200 border border-white/10"
              >
                {inst.label}
              </span>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 mb-2.5 text-[10px] font-bold text-stone-400">
            <Shapes className="w-3 h-3" />
            <span>You choose the instruments (at least {task.minInstruments ?? 4}).</span>
          </div>
        )}

        {task.hint && (
          <div className="bg-black/40 border border-amber-500/20 rounded-xl p-2.5 flex items-start gap-2 text-[11px] text-amber-200/90">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>Hint:</strong> {task.hint}
            </span>
          </div>
        )}
      </div>
    );
  };

  const openTasks = byFilter(OPEN_TASKS);
  const challenges = byFilter([...STUDIO_CHALLENGES, ...LIVE_STAGE_CHALLENGES]);

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
              <h2 className="text-lg font-black text-stone-100">Tasks</h2>
              <p className="text-xs text-stone-400">
                Graded tasks: pick your own instruments, or take on a challenge with the band already on stage.
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

        {/* Controls */}
        <div className="pt-3 pb-2 shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center p-1 bg-stone-950/80 rounded-2xl border border-white/10 text-xs shrink-0">
            {(
              [
                ['all', 'All', Layers, 'bg-amber-500'],
                ['recording_studio', 'Studio', Headphones, 'bg-orange-500'],
                ['live_stage', 'Live Stage', Radio, 'bg-blue-500'],
              ] as const
            ).map(([key, label, Icon, activeBg]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  filter === key ? `${activeBg} text-stone-950 shadow-md` : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-stone-400 cursor-pointer select-none px-1">
            <input
              type="checkbox"
              checked={showTeacherLinks}
              onChange={(e) => setShowTeacherLinks(e.target.checked)}
              className="accent-sky-500"
            />
            <GraduationCap className="w-3.5 h-3.5 text-sky-400" />
            <span>Teacher: show assignment links</span>
          </label>
        </div>

        {showTeacherLinks && (
          <div className="mb-2 p-2.5 rounded-xl bg-sky-500/10 border border-sky-400/30 text-[11px] text-sky-100/90 leading-relaxed shrink-0">
            Each link opens AudioPlot straight into that task, graded against it. Students' submission codes
            record the task, so batch grading shows which task each student did. Without a link, students
            start in the ungraded sandbox.
          </div>
        )}

        {/* Task list */}
        <div className="flex-1 overflow-y-auto pr-1 py-2 flex flex-col gap-3">
          {/* Sandbox */}
          <div
            className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              !activeChallengeId
                ? 'bg-stone-100/[0.06] border-stone-400/60 border-dashed'
                : 'bg-white/[0.03] border-white/10 border-dashed'
            }`}
          >
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-stone-300 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-black text-stone-100">Sandbox (not graded)</div>
                <p className="text-xs text-stone-400 leading-relaxed">
                  Open playground. Any instruments, any setup. Checks still show what is working, but nothing is graded.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                onSelectChallenge(null);
                onClose();
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 cursor-pointer transition-all ${
                !activeChallengeId
                  ? 'bg-stone-200 text-stone-950'
                  : 'bg-white/10 hover:bg-white/20 text-stone-200 border border-white/15'
              }`}
            >
              {!activeChallengeId ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> In Sandbox
                </>
              ) : (
                <>
                  Go to Sandbox <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>

          {openTasks.length > 0 && (
            <>
              <div className="text-[10px] font-black uppercase tracking-wider text-stone-400 px-1 mt-1">
                Open Tasks: you choose the instruments
              </div>
              {openTasks.map(renderTask)}
            </>
          )}

          {challenges.length > 0 && (
            <>
              <div className="text-[10px] font-black uppercase tracking-wider text-stone-400 px-1 mt-1">
                Challenges: the instruments are given
              </div>
              {challenges.map(renderTask)}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3 text-xs text-stone-400 shrink-0">
          <span>Challenges start with a fresh plot. An open task in the same room keeps what you have built.</span>
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
