import { StudioProjectState, RubricEvaluation } from '../types';
import { decodeSubmission } from './submissionCodec';
import { evaluateStudioSetup } from './gradingEngine';
import { STUDIO_CHALLENGES, LIVE_STAGE_CHALLENGES } from '../data/challenges';

export interface BatchEntry {
  id: number;
  project: StudioProjectState;
  evaluation: RubricEvaluation;
  challengeTitle: string;
  /** True when the same student name appears with more than one different code. */
  hasMultipleSubmissions: boolean;
}

export interface BatchParseResult {
  entries: BatchEntry[];
  unreadable: string[]; // shortened previews of codes that could not be read
  duplicatesRemoved: number;
}

// A submission code is <compressed text>.<checksum>. Anything shorter is a name, a header, etc.
const LOOKS_LIKE_CODE = /^[A-Za-z0-9+\-$]{20,}\.[a-z0-9]{1,8}$/;
const LONG_TOKEN = 30;

const ALL_CHALLENGES = [...STUDIO_CHALLENGES, ...LIVE_STAGE_CHALLENGES];

export function challengeTitle(id?: string | null): string {
  if (!id) return 'Free build';
  return ALL_CHALLENGES.find((c) => c.id === id)?.title ?? 'Challenge';
}

export function gradeProject(project: StudioProjectState): RubricEvaluation {
  return evaluateStudioSetup(
    project.environment || 'recording_studio',
    project.placedGear || [],
    project.connections || [],
    project.mixerChannels || [],
    project.activeChallengeId
  );
}

/**
 * Pull every submission code out of pasted text (a column from Classroom or a
 * spreadsheet, one per line, comma-separated, mixed with names...), then
 * decode and grade each one.
 */
export function parseBatch(text: string): BatchParseResult {
  const tokens = text.split(/[\s,;"'|]+/).filter(Boolean);
  const seen = new Set<string>();
  const unreadable: string[] = [];
  const entries: BatchEntry[] = [];
  let duplicatesRemoved = 0;

  for (const token of tokens) {
    const looksLikeCode = LOOKS_LIKE_CODE.test(token);
    if (!looksLikeCode && token.length < LONG_TOKEN) continue; // names, headers, short words
    if (seen.has(token)) {
      duplicatesRemoved++;
      continue;
    }
    seen.add(token);
    const project = looksLikeCode ? decodeSubmission(token) : null;
    if (!project) {
      unreadable.push(token.length > 24 ? `${token.slice(0, 12)}…${token.slice(-8)}` : token);
      continue;
    }
    entries.push({
      id: entries.length,
      project,
      evaluation: gradeProject(project),
      challengeTitle: challengeTitle(project.activeChallengeId),
      hasMultipleSubmissions: false,
    });
  }

  const nameCounts = new Map<string, number>();
  for (const e of entries) {
    const key = (e.project.studentName || '').trim().toLowerCase();
    nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
  }
  for (const e of entries) {
    const key = (e.project.studentName || '').trim().toLowerCase();
    e.hasMultipleSubmissions = key !== '' && (nameCounts.get(key) || 0) > 1;
  }

  return { entries, unreadable, duplicatesRemoved };
}

export interface ClassPattern {
  name: string;
  studentsMissing: number;
  totalApplicable: number;
}

/** Rubric areas ranked by how many students did not get full marks. */
export function classPatterns(entries: BatchEntry[]): ClassPattern[] {
  const byName = new Map<string, ClassPattern>();
  for (const e of entries) {
    for (const cat of Object.values(e.evaluation.categories)) {
      if (!cat || cat.status === 'not_applicable') continue;
      const p = byName.get(cat.name) ?? { name: cat.name, studentsMissing: 0, totalApplicable: 0 };
      p.totalApplicable++;
      if (cat.score < cat.maxScore) p.studentsMissing++;
      byName.set(cat.name, p);
    }
  }
  return [...byName.values()]
    .filter((p) => p.studentsMissing > 0)
    .sort((a, b) => b.studentsMissing / b.totalApplicable - a.studentsMissing / a.totalApplicable);
}

/** Gradebook CSV, downloaded straight to the teacher's computer. */
export function downloadBatchCsv(entries: BatchEntry[]) {
  const categoryNames: string[] = [];
  for (const e of entries) {
    for (const cat of Object.values(e.evaluation.categories)) {
      if (cat && !categoryNames.includes(cat.name)) categoryNames.push(cat.name);
    }
  }
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Student', 'Period', 'Challenge', 'Mode', 'Score', 'Max Score', 'Percent', 'Letter', 'Issues', ...categoryNames];
  const rows = entries.map((e) => {
    const cats = Object.values(e.evaluation.categories);
    return [
      e.project.studentName,
      e.project.period,
      e.challengeTitle,
      e.project.environment === 'live_stage' ? 'Live Stage' : 'Studio',
      e.evaluation.totalScore,
      e.evaluation.maxTotalScore,
      e.evaluation.percentage,
      e.evaluation.gradeLetter,
      e.evaluation.criticalIssues.length,
      ...categoryNames.map((n) => {
        const c = cats.find((x) => x?.name === n);
        return !c || c.status === 'not_applicable' ? 'N/A' : `${c.score}/${c.maxScore}`;
      }),
    ].map(esc).join(',');
  });
  const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audioplot-grades-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
