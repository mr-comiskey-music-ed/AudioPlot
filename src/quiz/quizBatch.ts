import { RubricEvaluation, StudioProjectState } from '../types';
import { unpackProject } from '../services/submissionCodec';
import { DEFAULT_MASTER_BUS } from '../hooks/useUndoRedo';
import {
  CombinedResult, PlanResult, QuizPlot, QuizRecord, QuizScenario, QuizSource, QUIZ_WEIGHTS, SOURCE_LABELS,
  buildFixScenario, combineAttempts, evaluateFix, evaluatePlan, explainQuestion, explainSource, fixItems, planItems,
  scenarioFromRecord, FIX_QUESTION,
} from './quizEngine';

/** Everything the teacher sees for one quiz code, rebuilt from the seed in the code. */
export interface QuizGrade {
  scenario: QuizScenario;
  /** First Part 1 attempt (channels, which sources were found) */
  plan: PlanResult;
  /** Part 1 and Part 2 scores: first try in full, second-pass fixes at half */
  planC: CombinedResult;
  fixC: CombinedResult | null;
  /** Sources the student ticked in the Part 2 line check (not graded) */
  lineChecked: string[];
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
  const planRev = rec.p1r ? evaluatePlan(toPlot(unpackProject(rec.p1r as Record<string, any>)), scenario) : null;
  const planC = combineAttempts(planItems(plan), planRev && planItems(planRev));
  const errors = buildFixScenario(scenario).errors;
  const fixC = part2Plot
    ? combineAttempts(
        fixItems(evaluateFix(part2Plot, scenario, errors)),
        rec.p2r ? fixItems(evaluateFix(toPlot(unpackProject(rec.p2r as Record<string, any>)), scenario, errors)) : null
      )
    : null;
  const explainAbout = explainSource(scenario);
  const autoPoints = Math.round(((planC.percentage * QUIZ_WEIGHTS.plan) + ((fixC?.percentage ?? 0) * QUIZ_WEIGHTS.fix)) / 100);
  return {
    scenario, plan, planC, fixC, explainAbout,
    lineChecked: rec.lc ?? [],
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

/** Quiz items ranked by how many students missed them (anything short of full credit on the first try counts). */
export function quizPatterns(grades: QuizGrade[]): MissPattern[] {
  const by = new Map<string, MissPattern>();
  const count = (name: string, missed: boolean) => {
    const p = by.get(name) ?? { name, studentsMissing: 0, totalApplicable: 0 };
    p.totalApplicable++;
    if (missed) p.studentsMissing++;
    by.set(name, p);
  };
  for (const g of grades) {
    for (const it of g.planC.items) count(`Plan · ${it.label}`, it.credit < 1);
    for (const it of g.fixC?.items ?? []) {
      // Fault names without the source, so the same fault on different instruments adds up
      const name = it.source ? it.label.replace(`${SOURCE_LABELS[it.source]}: `, '') : it.label;
      count(`Fix · ${name}`, it.credit < 1);
    }
  }
  return [...by.values()]
    .filter((p) => p.studentsMissing > 0)
    .sort((a, b) => b.studentsMissing - a.studentsMissing || b.studentsMissing / b.totalApplicable - a.studentsMissing / a.totalApplicable);
}
