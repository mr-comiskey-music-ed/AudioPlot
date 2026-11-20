import React, { useState } from 'react';
import { Check, ClipboardCheck, Copy, Headphones, ListChecks, Play, RotateCcw, Square, Wrench, X, PencilLine, Send } from 'lucide-react';
import { FixResult, PlanResult, QuizPhase, QuizScenario, QuizSource, QUIZ_WEIGHTS, explainQuestion } from './quizEngine';

interface QuizPanelProps {
  phase: QuizPhase;
  scenario: QuizScenario;
  planResult: PlanResult | null;
  fixResult: FixResult | null;
  explainAbout: QuizSource;
  why: string;
  fixNote: string;
  studentName: string;
  code: string | null;
  isPlayingAudio: boolean;
  onToggleSoundcheck: () => void;
  onStart: () => void;
  onSubmitPlan: () => void;
  onStartFix: () => void;
  onSubmitFix: () => void;
  onStartExplain: () => void;
  onWhyChange: (v: string) => void;
  onFixNoteChange: (v: string) => void;
  onFinish: () => void;
  onNameChange: (v: string) => void;
  onMakeCode: () => void;
  onResetFix: () => void;
}

const PARTS: { id: 'plan' | 'fix' | 'explain'; label: string }[] = [
  { id: 'plan', label: '1 Plan it' },
  { id: 'fix', label: '2 Fix it' },
  { id: 'explain', label: '3 Explain it' },
];

const partOf = (phase: QuizPhase) =>
  phase === 'intro' || phase === 'plan' || phase === 'plan_done' ? 'plan' : phase === 'fix' || phase === 'fix_done' ? 'fix' : 'explain';

const Btn: React.FC<{ id?: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; tone?: 'primary' | 'plain' }> = ({
  id, onClick, children, disabled, tone = 'primary',
}) => (
  <button
    id={id}
    onClick={onClick}
    disabled={disabled}
    className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
      disabled
        ? 'bg-white/5 text-stone-500 cursor-not-allowed'
        : tone === 'primary'
        ? 'bg-orange-500 hover:bg-orange-400 text-stone-950 shadow-lg shadow-orange-950/40'
        : 'bg-white/5 hover:bg-white/10 text-stone-200 border border-white/10'
    }`}
  >
    {children}
  </button>
);

/** The band list. Students get the sources only: no hints about how to capture them. */
const Lineup: React.FC<{ scenario: QuizScenario }> = ({ scenario }) => (
  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
    <div className="text-[10px] font-black uppercase tracking-wider text-purple-300">The gig</div>
    <div className="text-base font-extrabold text-stone-100 leading-tight mt-0.5">{scenario.title}</div>
    <div className="text-[12px] text-stone-400 mt-0.5">{scenario.blurb}</div>
    <ul className="mt-2 space-y-1">
      {scenario.sources.map((s) => (
        <li key={s.key} className="text-[13px] text-stone-200 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
          {s.label}
        </li>
      ))}
    </ul>
  </div>
);

export const QuizPanel: React.FC<QuizPanelProps> = (props) => {
  const { phase, scenario, planResult, fixResult } = props;
  const [copied, setCopied] = useState(false);
  const current = partOf(phase);

  const soundcheck = (
    <Btn tone="plain" onClick={props.onToggleSoundcheck}>
      {props.isPlayingAudio ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      {props.isPlayingAudio ? 'Stop soundcheck' : 'Soundcheck'}
    </Btn>
  );

  return (
    <aside
      id="quiz-panel"
      className="w-[340px] max-w-[42vw] shrink-0 h-full bg-stone-950/95 border-l border-white/10 flex flex-col text-stone-100 select-none z-20"
    >
      <div className="px-4 pt-3 pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-extrabold">Quiz</div>
            <div className="text-[11px] text-stone-400">Live stage · no hints until you submit</div>
          </div>
        </div>
        <div className="flex gap-1 mt-2.5">
          {PARTS.map((p) => (
            <div
              key={p.id}
              className={`flex-1 h-6 rounded-md text-[10px] font-black flex items-center justify-center ${
                p.id === current ? 'bg-purple-600 text-white' : PARTS.findIndex((x) => x.id === p.id) < PARTS.findIndex((x) => x.id === current) ? 'bg-emerald-600/30 text-emerald-200' : 'bg-white/5 text-stone-500'
              }`}
            >
              {p.label}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 select-text">
        {phase === 'intro' && (
          <>
            <Lineup scenario={scenario} />
            <div className="text-[13px] text-stone-300 leading-relaxed space-y-2">
              <p><b>Part 1, Plan it:</b> put every source on the stage and get each one into the mixer: mics or DIs, cables, snake channels and 48V. Nothing is checked until you submit.</p>
              <p><b>Part 2, Fix it:</b> someone else set up this band and some things are wrong. Find and fix them.</p>
              <p><b>Part 3, Explain it:</b> two short written answers.</p>
            </div>
            <Btn id="btn-quiz-start" onClick={props.onStart}>Start Part 1</Btn>
          </>
        )}

        {phase === 'plan' && (
          <>
            <Lineup scenario={scenario} />
            <div className="text-[12px] text-stone-400 leading-relaxed">
              Build the whole input setup for this band. You can soundcheck any time. When you submit, Part 1 is locked.
            </div>
            {soundcheck}
            <Btn id="btn-quiz-submit-plan" onClick={props.onSubmitPlan}>
              <Send className="w-4 h-4" /> Submit Part 1
            </Btn>
          </>
        )}

        {phase === 'plan_done' && planResult && (
          <>
            <ScoreCard title="Part 1 score" pct={planResult.percentage} />
            <ul className="space-y-1">
              {planResult.sources.map((s) => (
                <li key={s.key} className="flex items-center justify-between text-[13px] px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/5">
                  <span>{s.label}</span>
                  {s.passed ? (
                    <span className="flex items-center gap-1 text-emerald-300 font-bold text-[12px]"><Check className="w-3.5 h-3.5" /> Pass</span>
                  ) : (
                    <span className="flex items-center gap-1 text-rose-300 font-bold text-[12px]"><X className="w-3.5 h-3.5" /> Not yet</span>
                  )}
                </li>
              ))}
            </ul>
            <Btn id="btn-quiz-start-fix" onClick={props.onStartFix}>
              <Wrench className="w-4 h-4" /> Go to Part 2
            </Btn>
          </>
        )}

        {phase === 'fix' && (
          <>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3 text-[13px] text-stone-200 leading-relaxed">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-300 mb-1">
                <Headphones className="w-3.5 h-3.5" /> Something is wrong
              </div>
              Another engineer set up this gig (<b>{scenario.title}</b>), and there are a few problems in the setup and the mixer. Find them and fix them. Use soundcheck and look closely.
            </div>
            <Lineup scenario={scenario} />
            {soundcheck}
            <Btn id="btn-quiz-submit-fix" onClick={props.onSubmitFix}>
              <Send className="w-4 h-4" /> Submit Part 2
            </Btn>
            <button onClick={props.onResetFix} className="w-full text-[11px] text-stone-500 hover:text-stone-300 flex items-center justify-center gap-1">
              <RotateCcw className="w-3 h-3" /> Start Part 2 over
            </button>
          </>
        )}

        {phase === 'fix_done' && fixResult && (
          <>
            <ScoreCard title="Part 2 score" pct={fixResult.percentage} />
            <div className="text-[13px] text-stone-300">
              You fixed {fixResult.errors.filter((e) => e.fixed).length} of {fixResult.errors.length} problems.
            </div>
            <Btn id="btn-quiz-start-explain" onClick={props.onStartExplain}>
              <PencilLine className="w-4 h-4" /> Go to Part 3
            </Btn>
          </>
        )}

        {phase === 'explain' && (
          <>
            <label className="block">
              <span className="text-[13px] font-bold text-stone-100">{explainQuestion(props.explainAbout)}</span>
              <span className="block text-[11px] text-stone-500 mb-1">Think about your Part 1 plot.</span>
              <textarea
                id="quiz-why"
                value={props.why}
                onChange={(e) => props.onWhyChange(e.target.value)}
                rows={5}
                maxLength={800}
                className="w-full rounded-xl bg-black/40 border border-white/15 focus:border-purple-400 outline-none p-2.5 text-[13px] text-stone-100"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-bold text-stone-100">Explain one fix you made in Part 2.</span>
              <span className="block text-[11px] text-stone-500 mb-1">What was wrong, and why did your fix work?</span>
              <textarea
                id="quiz-fix-note"
                value={props.fixNote}
                onChange={(e) => props.onFixNoteChange(e.target.value)}
                rows={5}
                maxLength={800}
                className="w-full rounded-xl bg-black/40 border border-white/15 focus:border-purple-400 outline-none p-2.5 text-[13px] text-stone-100"
              />
            </label>
            <Btn id="btn-quiz-finish" onClick={props.onFinish} disabled={!props.why.trim() || !props.fixNote.trim()}>
              <Send className="w-4 h-4" /> Finish the quiz
            </Btn>
          </>
        )}

        {phase === 'done' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <ScoreCard title="Part 1" pct={planResult?.percentage ?? 0} small />
              <ScoreCard title="Part 2" pct={fixResult?.percentage ?? 0} small />
            </div>
            <div className="text-[12px] text-stone-400">
              Part 3 is scored by your teacher. Parts weigh {QUIZ_WEIGHTS.plan}% / {QUIZ_WEIGHTS.fix}% / {QUIZ_WEIGHTS.explain}%.
            </div>
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/[0.06] p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-sky-300">
                <ListChecks className="w-3.5 h-3.5" /> Turn it in
              </div>
              <label className="block text-[12px] text-stone-300">
                Your name
                <input
                  id="quiz-name"
                  value={props.studentName}
                  onChange={(e) => props.onNameChange(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-black/40 border border-white/15 focus:border-sky-400 outline-none px-2.5 py-1.5 text-[13px] text-stone-100"
                />
              </label>
              <Btn id="btn-quiz-make-code" onClick={props.onMakeCode} disabled={!props.studentName.trim()}>
                Make my code
              </Btn>
              {props.code && (
                <>
                  <textarea
                    id="quiz-code"
                    readOnly
                    value={props.code}
                    rows={4}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-full rounded-lg bg-black/50 border border-white/10 p-2 text-[10px] font-mono text-stone-300 break-all"
                  />
                  <Btn
                    tone="plain"
                    onClick={async () => {
                      const { copyText } = await import('../utils/copyText');
                      setCopied(await copyText(props.code!));
                      window.setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    <Copy className="w-4 h-4" /> {copied ? 'Copied' : 'Copy code'}
                  </Btn>
                  <div className="text-[11px] text-stone-400">Paste this code into Google Classroom.</div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
};

const ScoreCard: React.FC<{ title: string; pct: number; small?: boolean }> = ({ title, pct, small }) => (
  <div className={`rounded-xl border border-white/10 bg-white/[0.04] ${small ? 'p-2.5' : 'p-3'} text-center`}>
    <div className="text-[10px] font-black uppercase tracking-wider text-stone-400">{title}</div>
    <div className={`${small ? 'text-2xl' : 'text-4xl'} font-black ${pct >= 90 ? 'text-emerald-300' : pct >= 70 ? 'text-yellow-300' : 'text-rose-300'}`}>{pct}%</div>
  </div>
);
