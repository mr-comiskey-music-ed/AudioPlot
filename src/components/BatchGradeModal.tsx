import React, { useMemo, useState } from 'react';
import {
  X,
  ListChecks,
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Lightbulb,
  Lock,
} from 'lucide-react';
import { BatchParseResult, BatchEntry, classPatterns, downloadBatchCsv } from '../services/batchGrading';

type SortKey = 'name' | 'score' | 'period';

interface BatchGradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  text: string;
  onTextChange: (text: string) => void;
  result: BatchParseResult | null;
  onGrade: () => void;
  onClear: () => void;
  /** Open plots in this order (entry ids), starting at position `start`. */
  onReview: (order: number[], start: number) => void;
}

const gradeColor = (pct: number) =>
  pct >= 90 ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40'
  : pct >= 70 ? 'text-orange-300 bg-orange-500/15 border-orange-500/40'
  : 'text-rose-300 bg-rose-500/15 border-rose-500/40';

const lastName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  return (parts.length > 1 ? parts[parts.length - 1] + ' ' + parts.slice(0, -1).join(' ') : full).toLowerCase();
};

export const BatchGradeModal: React.FC<BatchGradeModalProps> = ({
  isOpen,
  onClose,
  text,
  onTextChange,
  result,
  onGrade,
  onClear,
  onReview,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showPatterns, setShowPatterns] = useState(true);

  const entries = result?.entries ?? [];
  const periods = useMemo(
    () =>
      Array.from(new Set<string>(entries.map((e) => e.project.period || '—'))).sort((a: string, b: string) =>
        a.localeCompare(b, undefined, { numeric: true })
      ),
    [entries]
  );

  const visible: BatchEntry[] = useMemo(() => {
    const list = entries.filter((e) => periodFilter === 'all' || (e.project.period || '—') === periodFilter);
    return [...list].sort((a, b) => {
      if (sortKey === 'score') return b.evaluation.percentage - a.evaluation.percentage;
      if (sortKey === 'period')
        return (a.project.period || '').localeCompare(b.project.period || '', undefined, { numeric: true }) ||
          lastName(a.project.studentName).localeCompare(lastName(b.project.studentName));
      return lastName(a.project.studentName).localeCompare(lastName(b.project.studentName));
    });
  }, [entries, sortKey, periodFilter]);

  const patterns = useMemo(() => classPatterns(visible), [visible]);
  // Sandbox submissions are not graded, so they stay out of the class average.
  const graded = visible.filter((e) => !e.evaluation.isSandbox);
  const average = graded.length ? Math.round(graded.reduce((s, e) => s + e.evaluation.percentage, 0) / graded.length) : 0;
  const letterCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of visible) m.set(e.evaluation.gradeLetter, (m.get(e.evaluation.gradeLetter) || 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [visible]);

  if (!isOpen) return null;
  const order = visible.map((e) => e.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-stone-950/95 backdrop-blur-2xl border border-orange-500/30 rounded-3xl max-w-4xl w-full p-6 text-stone-100 shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/20 border border-orange-500/30 text-orange-400 flex items-center justify-center">
              <ListChecks className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-stone-100">Batch Grade a Class</h3>
              <p className="text-xs text-stone-400 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Codes and results stay in this tab only. Nothing is saved or sent anywhere.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white border border-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!result ? (
          /* ---------- Paste view ---------- */
          <div className="space-y-3 flex flex-col min-h-0">
            <p className="text-xs text-stone-300">
              Paste all your students' codes below. One per line works, and so does a whole column copied from
              Google Classroom or a spreadsheet. Names and other text mixed in are ignored.
            </p>
            <textarea
              id="textarea-batch-codes"
              autoFocus
              rows={12}
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="Paste student codes here..."
              className="w-full bg-stone-900/90 border border-white/20 focus:border-orange-400 rounded-xl p-3 text-[11px] text-orange-300 font-mono outline-none resize-none placeholder:text-stone-500"
            />
            <button
              id="btn-run-batch-grade"
              onClick={onGrade}
              disabled={!text.trim()}
              className="w-full py-2.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ListChecks className="w-4 h-4" />
              Grade All Codes
            </button>
          </div>
        ) : (
          /* ---------- Results view ---------- */
          <div className="space-y-3 overflow-y-auto pr-1 min-h-0">
            {/* Summary */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                <b className="text-stone-100">{visible.length}</b> graded
              </span>
              <span className={`px-3 py-1.5 rounded-full border font-bold ${gradeColor(average)}`}>Class average {average}%</span>
              {letterCounts.map(([letter, n]) => (
                <span key={letter} className="px-2.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-stone-300">
                  {letter}: <b className="text-stone-100">{n}</b>
                </span>
              ))}
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => downloadBatchCsv(visible)}
                  disabled={!visible.length}
                  className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-stone-200 font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" /> Download CSV
                </button>
                <button
                  onClick={() => {
                    setExpandedId(null);
                    setPeriodFilter('all');
                    onClear();
                  }}
                  className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-stone-200 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> New Batch
                </button>
              </div>
            </div>

            {/* Problems with the paste */}
            {(result.unreadable.length > 0 || result.duplicatesRemoved > 0) && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-[11px] text-amber-200 space-y-1">
                {result.unreadable.length > 0 && (
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                    <span>
                      <b>{result.unreadable.length}</b> code{result.unreadable.length > 1 ? 's' : ''} couldn't be read
                      (incomplete, mistyped or edited):{' '}
                      <span className="font-bold text-amber-100">{result.unreadable.join(', ')}</span>. Ask
                      {result.unreadable.length > 1 ? ' these students' : ' this student'} to copy their code again.
                    </span>
                  </div>
                )}
                {result.duplicatesRemoved > 0 && (
                  <div>
                    {result.duplicatesRemoved} exact duplicate code{result.duplicatesRemoved > 1 ? 's were' : ' was'} skipped.
                  </div>
                )}
              </div>
            )}

            {entries.length === 0 ? (
              <p className="text-xs text-stone-400 p-4 text-center">No readable codes were found in what you pasted.</p>
            ) : (
              <>
                {/* Class patterns */}
                {patterns.length > 0 && (
                  <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-2xl">
                    <button
                      onClick={() => setShowPatterns(!showPatterns)}
                      className="w-full flex items-center gap-1.5 text-xs font-bold text-sky-300 cursor-pointer"
                    >
                      {showPatterns ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <Lightbulb className="w-4 h-4" /> Class patterns: where students lost points
                    </button>
                    {showPatterns && (
                      <div className="mt-2 space-y-1.5">
                        {patterns.slice(0, 6).map((p) => {
                          const pct = Math.round((100 * p.studentsMissing) / p.totalApplicable);
                          return (
                            <div key={p.name} className="flex items-center gap-2 text-[11px]">
                              <span className="w-72 truncate text-stone-200" title={p.name}>{p.name}</span>
                              <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                                <div className="h-full bg-sky-400/70" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="w-28 text-right text-stone-300">
                                {p.studentsMissing} of {p.totalApplicable} students
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Controls */}
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="text-stone-400">Sort:</span>
                  {(['name', 'score', 'period'] as SortKey[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => setSortKey(k)}
                      className={`px-2.5 py-1 rounded-full border cursor-pointer ${
                        sortKey === k ? 'bg-orange-500 text-stone-950 border-orange-400 font-black' : 'bg-white/5 border-white/10 text-stone-300'
                      }`}
                    >
                      {k === 'name' ? 'Last name' : k === 'score' ? 'Score' : 'Period'}
                    </button>
                  ))}
                  {periods.length > 1 && (
                    <>
                      <span className="text-stone-400 ml-2">Period:</span>
                      <select
                        value={periodFilter}
                        onChange={(e) => setPeriodFilter(e.target.value)}
                        className="bg-stone-900 border border-white/20 rounded-lg px-2 py-1 text-stone-200 cursor-pointer"
                      >
                        <option value="all">All</option>
                        {periods.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  <button
                    onClick={() => onReview(order, 0)}
                    disabled={!order.length}
                    className="ml-auto px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-stone-950 font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    <Eye className="w-3.5 h-3.5" /> Review Plots in This Order
                  </button>
                </div>

                {/* Table */}
                <div className="border border-white/10 rounded-2xl overflow-hidden">
                  <div className="grid grid-cols-[1fr_60px_1fr_70px_60px_96px] gap-2 px-3 py-2 bg-white/5 text-[10px] font-black uppercase tracking-wider text-stone-400">
                    <span>Student</span>
                    <span>Period</span>
                    <span>Challenge</span>
                    <span className="text-right">Score</span>
                    <span className="text-center">Grade</span>
                    <span />
                  </div>
                  {visible.map((e, pos) => {
                    const open = expandedId === e.id;
                    const cats = Object.values(e.evaluation.categories).filter(Boolean);
                    return (
                      <div key={e.id} className="border-t border-white/5">
                        <div
                          onClick={() => setExpandedId(open ? null : e.id)}
                          className="grid grid-cols-[1fr_60px_1fr_70px_60px_96px] gap-2 px-3 py-2 items-center text-xs hover:bg-white/5 cursor-pointer"
                        >
                          <span className="font-bold text-stone-100 truncate flex items-center gap-1.5">
                            {open ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                            {e.project.studentName || 'Unnamed student'}
                            {e.hasMultipleSubmissions && (
                              <span className="text-[9px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 rounded-full shrink-0">
                                multiple codes
                              </span>
                            )}
                          </span>
                          <span className="text-stone-300">{e.project.period || '—'}</span>
                          <span className="text-stone-300 truncate">{e.challengeTitle}</span>
                          <span className="text-right text-stone-200">
                            {e.evaluation.totalScore}/{e.evaluation.maxTotalScore}
                          </span>
                          {e.evaluation.isSandbox ? (
                            <span className="text-center font-black rounded-full border px-1.5 py-0.5 text-stone-400 border-white/15" title="Built in the sandbox, not graded">
                              N/G
                            </span>
                          ) : (
                            <span className={`text-center font-black rounded-full border px-1.5 py-0.5 ${gradeColor(e.evaluation.percentage)}`}>
                              {e.evaluation.percentage}%
                            </span>
                          )}
                          <button
                            onClick={(ev) => {
                              ev.stopPropagation();
                              onReview(order, pos);
                            }}
                            className="justify-self-end px-2.5 py-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> View plot
                          </button>
                        </div>
                        {open && (
                          <div className="px-4 pb-3 pt-1 space-y-2 bg-white/[0.02]">
                            {e.evaluation.criticalIssues.length > 0 && (
                              <ul className="pl-4 list-disc text-[11px] text-rose-200 space-y-0.5">
                                {e.evaluation.criticalIssues.map((issue, i) => (
                                  <li key={i}>{issue}</li>
                                ))}
                              </ul>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {cats.map((cat) => {
                                const perfect = cat!.status === 'perfect';
                                const na = cat!.status === 'not_applicable';
                                return (
                                  <div key={cat!.name} className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10">
                                    <span className="flex items-center gap-1.5 text-stone-200 truncate">
                                      {perfect ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                      ) : na ? (
                                        <span className="w-3.5 text-stone-500 shrink-0">–</span>
                                      ) : (
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                      )}
                                      {cat!.name}
                                    </span>
                                    <span className={`font-black ${perfect ? 'text-emerald-400' : na ? 'text-stone-500' : 'text-amber-400'}`}>
                                      {na ? 'N/A' : `${cat!.score}/${cat!.maxScore}`}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
