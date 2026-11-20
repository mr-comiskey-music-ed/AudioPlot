import React from 'react';
import { Check, ClipboardCheck, Minus, X } from 'lucide-react';
import { QuizGrade, formatQuizTime, quizMinutes, quizTotal } from './quizBatch';
import { CHECK_LABELS, CheckId, CombinedResult, Credit, QUIZ_WEIGHTS } from './quizEngine';

const CHECK_ORDER: CheckId[] = ['input', 'cable', 'phantom', 'stereo', 'channel'];
const SHORT: Record<CheckId, string> = { input: 'Input', cable: 'Cable', phantom: '48V', stereo: 'Stereo', channel: 'Channel' };

/** Full credit, half (fixed on the second pass), none, or not part of this source. */
const Mark: React.FC<{ credit?: Credit }> = ({ credit }) =>
  credit === undefined ? (
    <Minus className="w-3.5 h-3.5 text-stone-600 mx-auto" />
  ) : credit === 1 ? (
    <Check className="w-3.5 h-3.5 text-emerald-400 mx-auto" />
  ) : credit === 0.5 ? (
    <span className="block mx-auto w-3.5 text-center text-[10px] font-black text-yellow-300" title="Fixed on the second pass (half credit)">½</span>
  ) : (
    <X className="w-3.5 h-3.5 text-rose-400 mx-auto" />
  );

const creditOf = (c: CombinedResult, id: string) => c.items.find((i) => i.id === id)?.credit;

/** Part 1 checklist as a grid: one row per source, one column per check. */
const PlanGrid: React.FC<{ grade: QuizGrade }> = ({ grade }) => (
  <table className="w-full text-[11px]">
    <thead>
      <tr className="text-stone-400">
        <th className="text-left font-bold py-1">Source</th>
        {CHECK_ORDER.map((c) => (
          <th key={c} className="font-bold" title={CHECK_LABELS[c]}>{SHORT[c]}</th>
        ))}
        <th className="font-bold text-right">CH</th>
      </tr>
    </thead>
    <tbody>
      {grade.plan.sources.map((s) => (
        <tr key={s.key} className="border-t border-white/5">
          <td className="py-1 text-stone-200">{s.label}{!s.found && <span className="text-rose-300"> (missing)</span>}</td>
          {CHECK_ORDER.map((c) => (
            <td key={c}><Mark credit={creditOf(grade.planC, `${s.key}:${c}`)} /></td>
          ))}
          <td className="text-right text-stone-400">{s.channels.join(', ') || '—'}</td>
        </tr>
      ))}
      {[
        ['extra', 'No extra or dead channels'],
        ['pa', 'PA speakers on MAIN L/R'],
        ['monitors', 'Stage monitors on MON 1/2'],
      ].map(([id, label]) => (
        <tr key={id} className="border-t border-white/5">
          <td className="py-1 text-stone-400" colSpan={6}>{label}</td>
          <td><Mark credit={creditOf(grade.planC, id)} /></td>
        </tr>
      ))}
    </tbody>
  </table>
);

const FixList: React.FC<{ grade: QuizGrade }> = ({ grade }) =>
  grade.fixC ? (
    <>
      <ul className="space-y-0.5 text-[11px]">
        {grade.fixC.items.map((it) => (
          <li key={it.id} className="flex items-center gap-1.5">
            <span className="w-3.5 shrink-0"><Mark credit={it.credit} /></span>
            <span className={it.id === 'rest' ? 'text-stone-400' : 'text-stone-200'}>{it.label}</span>
          </li>
        ))}
      </ul>
      <div className="text-[10.5px] text-stone-500 pt-1">
        Line check ticked: {grade.lineChecked.length} of {grade.scenario.sources.length}
      </div>
    </>
  ) : (
    <p className="text-[11px] text-stone-500">Part 2 not submitted.</p>
  );

const Answers: React.FC<{ grade: QuizGrade }> = ({ grade }) => (
  <div className="space-y-2">
    {[
      [grade.whyQuestion, grade.why],
      [grade.fixQuestion, grade.fixNote],
    ].map(([q, a], i) => (
      <div key={i}>
        <div className="text-[11px] font-bold text-stone-300">{q}</div>
        <div className="text-[12px] text-stone-100 bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 whitespace-pre-wrap select-text">
          {a || <span className="text-stone-500">No answer</span>}
        </div>
      </div>
    ))}
  </div>
);

const Section: React.FC<{ title: string; pct?: number | null; children: React.ReactNode }> = ({ title, pct, children }) => (
  <div className="rounded-xl bg-white/[0.03] border border-white/10 p-2.5 space-y-1.5">
    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-stone-400">
      <span>{title}</span>
      {pct != null && <span className="text-stone-200">{pct}%</span>}
    </div>
    {children}
  </div>
);

const Part3Input: React.FC<{ value?: number; onChange: (v: number | null) => void }> = ({ value, onChange }) => (
  <label className="flex items-center gap-2 text-[11px] text-stone-300">
    Part 3 score
    <input
      type="number"
      min={0}
      max={100}
      value={value ?? ''}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value === '' ? null : Math.max(0, Math.min(100, Number(e.target.value))))}
      className="w-16 bg-stone-900 border border-white/20 rounded-lg px-2 py-1 text-stone-100"
    />
    %
  </label>
);

/** Start, finish and time taken: helps spot a retake (a second window, a different day). */
const Timing: React.FC<{ grade: QuizGrade }> = ({ grade }) => {
  if (!grade.startedAt && !grade.finishedAt) return null;
  const mins = quizMinutes(grade);
  return (
    <div className="text-[11px] text-stone-400">
      {grade.startedAt && <>Started {formatQuizTime(grade.startedAt)}</>}
      {grade.finishedAt && <> · finished {formatQuizTime(grade.finishedAt)}</>}
      {mins != null && <> · <b className="text-stone-200">{mins} min</b></>}
    </div>
  );
};

/** Expanded row in the batch list. */
export const QuizBatchDetails: React.FC<{ grade: QuizGrade; part3?: number; onPart3: (v: number | null) => void }> = ({ grade, part3, onPart3 }) => {
  const total = quizTotal(grade, part3);
  return (
    <div className="px-4 pb-3 pt-1 bg-white/[0.02] grid grid-cols-1 md:grid-cols-2 gap-2">
      <div className="space-y-2">
        <Section title={`The gig · ${grade.scenario.title}`}>
          <div className="text-[11px] text-stone-300">{grade.scenario.sources.map((s) => s.label).join(' · ')}</div>
        </Section>
        <Section title={`Part 1 · Plan it${grade.planC.revised ? ' (2 passes)' : ''}`} pct={grade.planC.percentage}>
          <PlanGrid grade={grade} />
        </Section>
        <Section title={`Part 2 · Fix it${grade.fixC?.revised ? ' (2 passes)' : ''}`} pct={grade.fixC?.percentage ?? null}>
          <FixList grade={grade} />
        </Section>
      </div>
      <div className="space-y-2">
        <Section title="Part 3 · Explain it">
          <Answers grade={grade} />
          <div className="flex items-center justify-between pt-1">
            <Part3Input value={part3} onChange={onPart3} />
            <span className="text-[11px] text-stone-400">
              Total {total == null ? '—' : <b className="text-stone-100">{total}%</b>} ({QUIZ_WEIGHTS.plan}/{QUIZ_WEIGHTS.fix}/{QUIZ_WEIGHTS.explain})
            </span>
          </div>
        </Section>
        <Timing grade={grade} />
        {!grade.finished && <div className="text-[11px] text-amber-300">This student had not finished the quiz when they made the code.</div>}
      </div>
    </div>
  );
};

/** Right-hand panel while the teacher steps through quiz plots. */
export const QuizReviewPanel: React.FC<{ grade: QuizGrade; part: 1 | 2; onPart: (p: 1 | 2) => void }> = ({ grade, part, onPart }) => (
  <aside className="w-[340px] max-w-[42vw] shrink-0 h-full bg-stone-950/95 border-l border-white/10 flex flex-col text-stone-100 z-20">
    <div className="px-4 pt-3 pb-2 border-b border-white/10 space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 flex items-center justify-center shrink-0">
          <ClipboardCheck className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-extrabold truncate">Quiz · {grade.scenario.title}</div>
          <div className="text-[11px] text-stone-400 truncate">{grade.scenario.sources.map((s) => s.label).join(' · ')}</div>
          <Timing grade={grade} />
        </div>
      </div>
      <div className="flex gap-1">
        {([1, 2] as const).map((p) => (
          <button
            key={p}
            onClick={() => onPart(p)}
            disabled={p === 2 && !grade.part2Plot}
            className={`flex-1 h-7 rounded-md text-[11px] font-black ${part === p ? 'bg-purple-600 text-white' : 'bg-white/5 text-stone-300 hover:bg-white/10'} disabled:opacity-30`}
          >
            Show Part {p} plot
          </button>
        ))}
      </div>
    </div>
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      <Section title={`Part 1 · Plan it${grade.planC.revised ? ' (2 passes)' : ''}`} pct={grade.planC.percentage}>
        <PlanGrid grade={grade} />
      </Section>
      <Section title={`Part 2 · Fix it${grade.fixC?.revised ? ' (2 passes)' : ''}`} pct={grade.fixC?.percentage ?? null}>
        <FixList grade={grade} />
      </Section>
      <Section title="Part 3 · Explain it">
        <Answers grade={grade} />
      </Section>
    </div>
  </aside>
);
