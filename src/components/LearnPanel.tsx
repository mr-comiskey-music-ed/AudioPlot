import React from 'react';
import {
  GraduationCap,
  Check,
  Lightbulb,
  Headphones,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
  BookOpen,
  Play,
  Square,
  Info,
  Mic2,
  Speaker,
  Trophy,
} from 'lucide-react';
import { LEARN_STEPS, LearnPlot, stepDone } from '../data/learnSteps';

interface LearnPanelProps {
  /** 0..LEARN_STEPS.length; the last value is the finish screen. */
  stepIndex: number;
  plot: LearnPlot;
  /** Furthest step the student has opened. */
  reached: number;
  finished: boolean;
  /** Think First answers: step index -> chosen option. */
  answers: Record<number, number>;
  isPlayingAudio: boolean;
  onAnswer: (optionIndex: number) => void;
  onGoTo: (index: number) => void;
  onNext: () => void;
  onRestartStep: () => void;
  onToggleSoundcheck: () => void;
  onOpenReference: () => void;
  onTryItYourself: () => void;
  onExit: () => void;
}

const TOTAL = LEARN_STEPS.length;
const FIRST_LIVE = LEARN_STEPS.findIndex((s) => s.part === 'live');

export const LearnPanel: React.FC<LearnPanelProps> = ({
  stepIndex,
  plot,
  reached,
  finished,
  answers,
  isPlayingAudio,
  onAnswer,
  onGoTo,
  onNext,
  onRestartStep,
  onToggleSoundcheck,
  onOpenReference,
  onTryItYourself,
  onExit,
}) => {
  const step = LEARN_STEPS[stepIndex];
  const results = step ? step.missions.map((m) => m.check(plot)) : [];
  const answer = answers[stepIndex];
  const askAfter = step?.think ? step.think.afterMissions ?? 0 : 0;
  const thinkReady = !!step?.think && results.slice(0, askAfter).every(Boolean);
  const answered = answer !== undefined;
  // Missions after the Think First question appear once it is answered.
  const visibleMissions = step ? (step.think && !answered ? askAfter : step.missions.length) : 0;
  const complete = !!step && stepDone(step, plot) && (!step.think || answered);
  const canOpen = (i: number) => finished || i <= reached;

  return (
    <aside
      id="learn-panel"
      className="w-[340px] max-w-[42vw] shrink-0 h-full bg-stone-950/95 border-l border-white/10 flex flex-col text-stone-100 select-none z-20"
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-white/10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-extrabold leading-tight">Learn</div>
              <div className="text-[11px] text-stone-400 leading-tight">
                {step ? (
                  <>
                    Step {stepIndex + 1} of {TOTAL} · {step.part === 'studio' ? 'Studio session' : 'Live gig'}
                  </>
                ) : (
                  'Complete'
                )}
              </div>
            </div>
          </div>
          <button
            id="btn-learn-exit"
            onClick={onExit}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-stone-300 text-[11px] font-bold cursor-pointer"
            title="Leave Learn and go back to your own plot"
          >
            <X className="w-3.5 h-3.5" /> Exit
          </button>
        </div>

        {/* Step buttons */}
        <div className="flex gap-1 mt-3">
          {LEARN_STEPS.map((s, i) => {
            const current = i === stepIndex;
            const done = finished || i < reached;
            return (
              <button
                key={i}
                onClick={() => canOpen(i) && onGoTo(i)}
                disabled={!canOpen(i)}
                title={`${i + 1}. ${s.title}`}
                className={`flex-1 h-6 rounded-md text-[10px] font-black flex items-center justify-center transition-all ${
                  current
                    ? 'bg-orange-500 text-stone-950'
                    : done
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 cursor-pointer'
                    : canOpen(i)
                    ? 'bg-white/10 text-stone-300 hover:bg-white/15 cursor-pointer'
                    : 'bg-white/5 text-stone-600'
                } ${i === FIRST_LIVE ? 'ml-1.5' : ''}`}
              >
                {done && !current ? <Check className="w-3 h-3" /> : i + 1}
              </button>
            );
          })}
        </div>
        <div className="flex text-[9px] font-bold uppercase tracking-wider text-stone-500 mt-1">
          <span className="flex items-center gap-1" style={{ flex: FIRST_LIVE }}>
            <Mic2 className="w-3 h-3" /> Studio
          </span>
          <span className="flex items-center gap-1 pl-1.5" style={{ flex: TOTAL - FIRST_LIVE }}>
            <Speaker className="w-3 h-3" /> Live
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-[13px]">
        {!step ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-300">
              <Trophy className="w-5 h-5" />
              <h3 className="text-lg font-black">Learn complete</h3>
            </div>
            <p className="text-stone-300 leading-relaxed">
              You built a studio session and a live gig, and you know why each choice was made. That is marked as done, and it
              shows in the code you turn in.
            </p>
            <p className="text-stone-400 leading-relaxed">
              The same questions work for any band: what is the source, what does that gear need, where does each input go, and
              who needs to hear what.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={onTryItYourself}
                className="w-full px-3 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-stone-950 font-black cursor-pointer"
              >
                Try it yourself
              </button>
              <button
                onClick={() => onGoTo(0)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-stone-200 font-bold cursor-pointer"
              >
                Review the steps
              </button>
            </div>
          </div>
        ) : (
          <>
            {step.intro && (
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-sky-100 leading-relaxed">
                <div className="text-[10px] font-black uppercase tracking-wider text-sky-300 mb-1">To the live stage</div>
                {step.intro}
              </div>
            )}

            <div>
              <h3 className="text-lg font-black leading-tight">{step.title}</h3>
              <p className="text-stone-300 leading-relaxed mt-1">{step.what}</p>
            </div>

            {/* Missions before the Think First question (or all of them when there is none) */}
            <MissionList missions={step.missions.slice(0, step.think ? askAfter : visibleMissions)} results={results} offset={0} />

            {step.think && thinkReady && (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.07] p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-300 mb-1.5">
                  <Lightbulb className="w-3.5 h-3.5" /> Think first
                </div>
                <p className="font-bold text-stone-100 leading-snug mb-2">{step.think.question}</p>
                <div className="flex flex-col gap-1.5">
                  {step.think.options.map((opt, i) => {
                    const picked = answer === i;
                    const showRight = answered && opt.correct;
                    return (
                      <button
                        key={i}
                        onClick={() => !answered && onAnswer(i)}
                        disabled={answered}
                        className={`text-left px-2.5 py-1.5 rounded-lg border text-[12px] leading-snug transition-all ${
                          showRight
                            ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-100'
                            : picked
                            ? 'border-rose-500/40 bg-rose-500/10 text-rose-100'
                            : answered
                            ? 'border-white/5 text-stone-500'
                            : 'border-white/10 bg-white/5 hover:bg-white/10 text-stone-200 cursor-pointer'
                        }`}
                      >
                        <span className="flex items-start gap-1.5">
                          {showRight && <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                          {opt.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {answered && (
                  <div className="mt-2 space-y-1.5 text-[12px] leading-relaxed">
                    {!step.think.options[answer].correct && (
                      <p className="text-rose-200">{step.think.options[answer].explain}</p>
                    )}
                    <p className="text-emerald-200">{step.think.options.find((o) => o.correct)?.explain}</p>
                  </div>
                )}
              </div>
            )}

            {/* Missions after the question */}
            {step.think && answered && (
              <MissionList missions={step.missions.slice(askAfter)} results={results.slice(askAfter)} offset={askAfter} />
            )}

            {step.note && (step.think ? answered : true) && (
              <div className="flex gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-stone-300 leading-relaxed text-[12px]">
                <Info className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
                <span>{step.note}</span>
              </div>
            )}

            {complete && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                  <Check className="w-3.5 h-3.5" /> Step done
                </div>
                {step.hear && (
                  <>
                    <p className="text-emerald-100 leading-relaxed flex gap-1.5">
                      <Headphones className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{step.hear}</span>
                    </p>
                    <button
                      onClick={onToggleSoundcheck}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-[12px] font-bold cursor-pointer"
                    >
                      {isPlayingAudio ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      {isPlayingAudio ? 'Stop soundcheck' : 'Soundcheck'}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-white/10 flex items-center gap-2">
        {step && (
          <button
            onClick={onRestartStep}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-stone-400 hover:text-white cursor-pointer"
            title="Start this step over"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={onOpenReference}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-stone-300 text-[11px] font-bold cursor-pointer"
          title="The four questions behind any setup"
        >
          <BookOpen className="w-3.5 h-3.5" /> Four Questions
        </button>
        <div className="flex-1" />
        {stepIndex > 0 && (
          <button
            onClick={() => onGoTo(stepIndex - 1)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-stone-300 cursor-pointer"
            title="Previous step"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        )}
        {step && (
          <button
            id="btn-learn-next"
            onClick={onNext}
            disabled={!complete}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-black transition-all ${
              complete ? 'bg-orange-500 hover:bg-orange-400 text-stone-950 cursor-pointer' : 'bg-white/5 text-stone-600 border border-white/10'
            }`}
            title={complete ? 'Next step' : 'Finish the step to go on'}
          >
            {stepIndex === TOTAL - 1 ? 'Finish' : 'Next'} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </aside>
  );
};

const MissionList: React.FC<{ missions: { text: string }[]; results: boolean[]; offset: number }> = ({ missions, results }) => {
  if (missions.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {missions.map((m, i) => {
        const ok = results[i];
        return (
          <li
            key={i}
            className={`flex gap-2 rounded-xl border p-2.5 leading-snug ${
              ok ? 'border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-100' : 'border-orange-400/30 bg-orange-400/[0.06] text-stone-100'
            }`}
          >
            <span
              className={`w-4 h-4 mt-0.5 rounded-full border flex items-center justify-center shrink-0 ${
                ok ? 'bg-emerald-500 border-emerald-500 text-stone-950' : 'border-orange-400/60'
              }`}
            >
              {ok && <Check className="w-3 h-3" />}
            </span>
            <span>{m.text}</span>
          </li>
        );
      })}
    </ul>
  );
};
