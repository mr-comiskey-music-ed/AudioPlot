import React, { useState } from 'react';
import { ClipboardCheck, Copy, Eye, Headphones, ListChecks, Play, RotateCcw, Square, Wrench, PencilLine, Send } from 'lucide-react';
import { CombinedResult, QuizPhase, QuizScenario, QuizSource, QUIZ_WEIGHTS, SourceStatus, explainQuestion, statusOf } from './quizEngine';

interface QuizPanelProps {
  phase: QuizPhase;
  scenario: QuizScenario;
  plan: CombinedResult | null;
  fix: CombinedResult | null;
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
  onRevisePlan: () => void;
  onRevealPlan: () => void;
  onReviseFix: () => void;
  onRevealFix: () => void;
  viewing: 1 | 2 | null;
  onView: (part: 1 | 2 | null) => void;
  lineChecked: string[];
  onLineCheck: (key: string, on: boolean) => void;
}

const PARTS: { id: 'plan' | 'fix' | 'explain'; label: string }[] = [
  { id: 'plan', label: '1 Plan it' },
  { id: 'fix', label: '2 Fix it' },
  { id: 'explain', label: '3 Explain it' },
];

const INTRO_PARTS = [
  {
    n: 1, name: 'Plan it', text: 'Build the whole stage for this band: every source into the mixer, plus the PA and stage monitors. Nothing is checked until you submit.',
    box: 'border-orange-500/30 bg-orange-500/[0.07]', badge: 'bg-orange-500 text-stone-950', title: 'text-orange-300',
  },
  {
    n: 2, name: 'Fix it', text: 'Another engineer set this band up and some things are wrong. Find and fix them.',
    box: 'border-sky-500/30 bg-sky-500/[0.07]', badge: 'bg-sky-500 text-stone-950', title: 'text-sky-300',
  },
  {
    n: 3, name: 'Explain it', text: 'Two short written answers about your setups.',
    box: 'border-amber-400/30 bg-amber-400/[0.07]', badge: 'bg-amber-400 text-stone-950', title: 'text-amber-300',
  },
];

const partOf = (phase: QuizPhase) =>
  phase === 'intro' || phase.startsWith('plan') ? 'plan' : phase.startsWith('fix') ? 'fix' : 'explain';

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

type Combined = CombinedResult;

const STATUS_STYLE: Record<SourceStatus, { text: string; cls: string }> = {
  pass: { text: 'Pass', cls: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40' },
  partial: { text: 'Partly', cls: 'text-yellow-300 bg-yellow-500/15 border-yellow-500/40' },
  missed: { text: 'Missed', cls: 'text-rose-300 bg-rose-500/15 border-rose-500/40' },
};

const StatusChip: React.FC<{ status: SourceStatus }> = ({ status }) => (
  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[status].cls}`}>{STATUS_STYLE[status].text}</span>
);

/** Rows for Part 1: one per source, then the stage-wide items. No reasons until the student asks. */
const PlanRows: React.FC<{ scenario: QuizScenario; result: Combined }> = ({ scenario, result }) => {
  const rows: { key: string; label: string; status: SourceStatus }[] = scenario.sources.map((s) => ({
    key: s.key,
    label: s.label,
    status: statusOf(result.items.filter((i) => i.source === s.key)),
  }));
  const global = (id: string, label: string) => {
    const it = result.items.find((i) => i.id === id);
    if (it) rows.push({ key: id, label, status: statusOf([it]) });
  };
  global('pa', 'PA speakers');
  global('monitors', 'Stage monitors');
  global('extra', 'Channels (nothing extra)');
  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center justify-between text-[13px] px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/5">
          <span>{r.label}</span>
          <StatusChip status={r.status} />
        </li>
      ))}
    </ul>
  );
};

/** Shown once the student has chosen to see it (or after their second pass). */
const MissedList: React.FC<{ result: Combined }> = ({ result }) => {
  const missed = result.items.filter((i) => i.credit < 1);
  if (!missed.length) return <div className="text-[13px] text-emerald-300 font-bold">Nothing missed. Nice work.</div>;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[10px] font-black uppercase tracking-wider text-stone-400 mb-1.5">What you missed</div>
      <ul className="space-y-1.5">
        {missed.map((i) => (
          <li key={i.id} className="text-[12.5px] leading-snug flex gap-2">
            <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${i.credit === 0.5 ? 'bg-yellow-400' : 'bg-rose-400'}`} />
            <span className="text-stone-200">
              {i.missed}
              {i.credit === 0.5 && <span className="text-yellow-300"> · fixed on your second pass (half credit)</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * Part 2's line check, the way it's done at a real gig: go through every source in the show and make sure
 * its signal comes up on its own mixer channel. The student ticks each one; nothing here checks or hints.
 */
const LineCheck: React.FC<{ scenario: QuizScenario; checked: string[]; onCheck: (key: string, on: boolean) => void }> = ({ scenario, checked, onCheck }) => (
  <div className="rounded-xl border border-sky-500/30 bg-sky-500/[0.06] p-3">
    <div className="flex items-center justify-between">
      <div className="text-[10px] font-black uppercase tracking-wider text-sky-300">Line check</div>
      <div className="text-[11px] text-stone-400">{scenario.sources.filter((s) => checked.includes(s.key)).length} of {scenario.sources.length}</div>
    </div>
    <p className="text-[11.5px] text-stone-300 leading-snug mt-1 mb-2">
      Run soundcheck and solo each channel. Tick a source once you hear it coming through its own channel on the mixer. Don't leave a whole instrument out of the show.
    </p>
    <ul className="space-y-1">
      {scenario.sources.map((s) => (
        <li key={s.key}>
          <label className="flex items-center gap-2 text-[13px] text-stone-200 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 accent-sky-500"
              checked={checked.includes(s.key)}
              onChange={(e) => onCheck(s.key, e.target.checked)}
            />
            {s.label}
          </label>
        </li>
      ))}
    </ul>
  </div>
);

/** After a first submit: keep working for half credit on what gets fixed, or see what was missed. */
const Choice: React.FC<{ onRevise: () => void; onReveal: () => void; idRevise: string; idReveal: string }> = ({ onRevise, onReveal, idRevise, idReveal }) => (
  <div className="space-y-2">
    <Btn id={idRevise} onClick={onRevise}>
      <RotateCcw className="w-4 h-4" /> Take another pass (half credit for fixes)
    </Btn>
    <Btn id={idReveal} tone="plain" onClick={onReveal}>
      <Eye className="w-4 h-4" /> Show me what I missed
    </Btn>
    <div className="text-[11px] text-stone-500 leading-snug">
      Another pass: go back to your setup and fix what you can. Anything you fix earns half credit, then you see what you missed.
    </div>
  </div>
);

export const QuizPanel: React.FC<QuizPanelProps> = (props) => {
  const { phase, scenario, plan, fix } = props;
  const [copied, setCopied] = useState(false);
  const current = partOf(phase);

  const soundcheck = (
    <Btn tone="plain" onClick={props.onToggleSoundcheck}>
      {props.isPlayingAudio ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      {props.isPlayingAudio ? 'Stop soundcheck' : 'Soundcheck'}
    </Btn>
  );
  const secondPassNote = (
    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/[0.07] p-3 text-[12.5px] text-yellow-100 leading-snug">
      <b>Second pass.</b> Fix what you can, then submit again. Anything you fix now earns half credit.
    </div>
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
            <div className="space-y-2">
              {INTRO_PARTS.map((p) => (
                <div key={p.n} className={`flex gap-3 rounded-xl border p-3 ${p.box}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shrink-0 ${p.badge}`}>{p.n}</div>
                  <div className="min-w-0">
                    <div className={`text-[13px] font-extrabold leading-tight ${p.title}`}>{p.name}</div>
                    <div className="text-[12.5px] text-stone-300 leading-snug mt-0.5">{p.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <Btn id="btn-quiz-start" onClick={props.onStart}>Start Part 1</Btn>
          </>
        )}

        {(phase === 'plan' || phase === 'plan_revise') && (
          <>
            {phase === 'plan_revise' && secondPassNote}
            <Lineup scenario={scenario} />
            {phase === 'plan' && (
              <div className="text-[12px] text-stone-400 leading-relaxed">
                Build the whole setup for this band, including the PA and stage monitors. You can soundcheck any time.
              </div>
            )}
            {soundcheck}
            <Btn id="btn-quiz-submit-plan" onClick={props.onSubmitPlan}>
              <Send className="w-4 h-4" /> {phase === 'plan' ? 'Submit Part 1' : 'Submit my second pass'}
            </Btn>
          </>
        )}

        {(phase === 'plan_done' || phase === 'plan_final') && plan && (
          <>
            <ScoreCard title={plan.revised ? 'Part 1 score (with second pass)' : 'Part 1 score'} pct={plan.percentage} />
            <PlanRows scenario={scenario} result={plan} />
            {phase === 'plan_done' && plan.percentage < 100 ? (
              <Choice idRevise="btn-quiz-revise-plan" idReveal="btn-quiz-reveal-plan" onRevise={props.onRevisePlan} onReveal={props.onRevealPlan} />
            ) : (
              <>
                <MissedList result={plan} />
                <Btn id="btn-quiz-start-fix" onClick={props.onStartFix}>
                  <Wrench className="w-4 h-4" /> Go to Part 2
                </Btn>
              </>
            )}
          </>
        )}

        {(phase === 'fix' || phase === 'fix_revise') && (
          <>
            {phase === 'fix_revise' ? (
              secondPassNote
            ) : (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3 text-[13px] text-stone-200 leading-relaxed">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-300 mb-1">
                  <Headphones className="w-3.5 h-3.5" /> Something is wrong
                </div>
                Another engineer set up this gig (<b>{scenario.title}</b>), and there are a few problems, mostly on the stage, maybe on the mixer too. Find them and fix them. Use soundcheck and look closely.
              </div>
            )}
            <LineCheck scenario={scenario} checked={props.lineChecked} onCheck={props.onLineCheck} />
            {soundcheck}
            <Btn id="btn-quiz-submit-fix" onClick={props.onSubmitFix}>
              <Send className="w-4 h-4" /> {phase === 'fix' ? 'Submit Part 2' : 'Submit my second pass'}
            </Btn>
            {phase === 'fix' && (
              <button onClick={props.onResetFix} className="w-full text-[11px] text-stone-500 hover:text-stone-300 flex items-center justify-center gap-1">
                <RotateCcw className="w-3 h-3" /> Start Part 2 over
              </button>
            )}
          </>
        )}

        {(phase === 'fix_done' || phase === 'fix_final') && fix && (
          <>
            <ScoreCard title={fix.revised ? 'Part 2 score (with second pass)' : 'Part 2 score'} pct={fix.percentage} />
            <div className="text-[13px] text-stone-300 flex items-center justify-between">
              <span>
                Problems fixed: {fix.items.filter((i) => i.id !== 'rest' && i.credit === 1).length} of {fix.items.filter((i) => i.id !== 'rest').length}
                {fix.items.some((i) => i.id !== 'rest' && i.credit === 0.5) && (
                  <span className="text-yellow-300"> (+{fix.items.filter((i) => i.id !== 'rest' && i.credit === 0.5).length} on the second pass)</span>
                )}
              </span>
              <StatusChip status={statusOf(fix.items)} />
            </div>
            {phase === 'fix_done' && fix.percentage < 100 ? (
              <Choice idRevise="btn-quiz-revise-fix" idReveal="btn-quiz-reveal-fix" onRevise={props.onReviseFix} onReveal={props.onRevealFix} />
            ) : (
              <>
                <MissedList result={fix} />
                <Btn id="btn-quiz-start-explain" onClick={props.onStartExplain}>
                  <PencilLine className="w-4 h-4" /> Go to Part 3
                </Btn>
              </>
            )}
          </>
        )}

        {phase === 'explain' && (
          <>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[10px] font-black uppercase tracking-wider text-stone-400 mb-1.5">Look back at your setups</div>
              <div className="flex gap-1.5">
                {([1, 2] as const).map((n) => (
                  <button
                    key={n}
                    id={`btn-quiz-view-${n}`}
                    onClick={() => props.onView(props.viewing === n ? null : n)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[12px] font-bold border transition-all ${
                      props.viewing === n
                        ? n === 1 ? 'bg-orange-500 border-orange-400 text-stone-950' : 'bg-sky-500 border-sky-400 text-stone-950'
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-stone-200'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" /> Part {n} setup
                  </button>
                ))}
              </div>
              <div className="text-[11px] text-stone-500 leading-snug mt-1.5">
                {props.viewing
                  ? `Showing your Part ${props.viewing} setup on the stage and mixer. Changes here aren't kept.`
                  : 'Tap one to see it on the stage and mixer while you write.'}
              </div>
              {props.viewing && (
                <button onClick={() => props.onView(null)} className="mt-1.5 w-full text-[11px] text-stone-400 hover:text-stone-200 underline">
                  Back to where I was
                </button>
              )}
            </div>
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
              <ScoreCard title="Part 1" pct={plan?.percentage ?? 0} small />
              <ScoreCard title="Part 2" pct={fix?.percentage ?? 0} small />
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
