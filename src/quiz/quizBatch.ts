import { RubricEvaluation, StudioProjectState } from '../types';
import { unpackProject } from '../services/submissionCodec';
import { DEFAULT_MASTER_BUS } from '../hooks/useUndoRedo';
import {
  CHECK_LABELS, CheckId, ERROR_LABELS, FixResult, PlanResult, QuizPlot, QuizRecord, QuizScenario, QuizSource,
  QUIZ_WEIGHTS, buildFixScenario, evaluateFix, evaluatePlan, explainQuestion, explainSource, scenarioFromRecord, FIX_QUESTION,
} from './quizEngine';

/** Everything the teacher sees for one quiz code, rebuilt from the seed in the code. */
export interface QuizGrade {
  scenario: QuizScenario;
  plan: PlanResult;
  fix: FixResult | null;
  explainAbout: QuizSource;
  whyQuestion: string;
  fixQuestion: string;
  why: string;
  fixNote: string;
  finished: boolean;
  /** Parts 1 and 2 as points out of their 80 */
  autoPoints: number;
  part1Plot: QuizPlot;
  part2Plot: QuizPlot | null;
}

const toPlot = (u: StudioProjectState): QuizPlot => ({
  environment: 'live_stage',
  placedGear: u.placedGear || [],
  connections: u.connections || [],
  mixerChannels: u.mixerChannels || [],
  masterBus: u.masterBus || DEFAULT_MASTER_BUS,
});

export function gradeQuiz(project: StudioProjectState): QuizGrade | null {
  const rec = project.quiz as QuizRecord | undefined;
  if (!rec || typeof rec.sd !== 'number') return null;
  const scenario = scenarioFromRecord(rec);
  // Part 1 is the code's own plot (also kept in p1)
  const part1Plot = rec.p1 ? toPlot(unpackProject(rec.p1 as Record<string, any>)) : toPlot(project);
  const part2Plot = rec.p2 ? toPlot(unpackProject(rec.p2 as Record<string, any>)) : null;
  const plan = evaluatePlan(part1Plot, scenario);
  const fix = part2Plot ? evaluateFix(part2Plot, scenario, buildFixScenario(scenario).errors) : null;
  const explainAbout = explainSource(scenario);
  const autoPoints = Math.round(((plan.percentage * QUIZ_WEIGHTS.plan) + ((fix?.percentage ?? 0) * QUIZ_WEIGHTS.fix)) / 100);
  return {
    scenario, plan, fix, explainAbout,
    whyQuestion: explainQuestion(explainAbout),
    fixQuestion: FIX_QUESTION,
    why: rec.w1 ?? '',
    fixNote: rec.w2 ?? '',
    finished: rec.ph === 'done',
    autoPoints,
    part1Plot,
    part2Plot,
  };
}

/** Final percentage once the teacher has scored Part 3 (0-100), or null until then. */
export function quizTotal(g: QuizGrade, part3?: number | null): number | null {
  if (part3 == null || Number.isNaN(part3)) return null;
  return Math.round(g.autoPoints + (Math.max(0, Math.min(100, part3)) * QUIZ_WEIGHTS.explain) / 100);
}

/** Stand-in rubric so quiz codes sort, average and export alongside the other tasks: Parts 1-2 as a percentage of their 80 points. */
export function quizEvaluation(g: QuizGrade): RubricEvaluation {
  const max = QUIZ_WEIGHTS.plan + QUIZ_WEIGHTS.fix;
  const pct = Math.round((g.autoPoints / max) * 100);
  return {
    totalScore: g.autoPoints,
    maxTotalScore: max,
    percentage: pct,
    gradeLetter: pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F',
    gradePhrase: '',
    categories: {} as RubricEvaluation['categories'],
    criticalIssues: [],
    suggestions: [],
    positives: [],
  };
}

export interface MissPattern {
  name: string;
  studentsMissing: number;
  totalApplicable: number;
}

/** Quiz items ranked by how many students missed them: each source check, then each Part 2 fault. */
export function quizPatterns(grades: QuizGrade[]): MissPattern[] {
  const by = new Map<string, MissPattern>();
  const count = (name: string, missed: boolean) => {
    const p = by.get(name) ?? { name, studentsMissing: 0, totalApplicable: 0 };
    p.totalApplicable++;
    if (missed) p.studentsMissing++;
    by.set(name, p);
  };
  for (const g of grades) {
    for (const s of g.plan.sources) {
      for (const [id, ok] of Object.entries(s.checks)) count(`Plan · ${s.label}: ${CHECK_LABELS[id as CheckId]}`, !ok);
    }
    count('Plan · No extra or dead channels', !g.plan.extraChannelsOk);
    if (g.fix) {
      for (const e of g.fix.errors) count(`Fix · ${ERROR_LABELS[e.kind]}`, !e.fixed);
      count('Fix · Left the rest working', !g.fix.restOk);
    }
  }
  return [...by.values()]
    .filter((p) => p.studentsMissing > 0)
    .sort((a, b) => b.studentsMissing / b.totalApplicable - a.studentsMissing / a.totalApplicable || b.studentsMissing - a.studentsMissing);
}
