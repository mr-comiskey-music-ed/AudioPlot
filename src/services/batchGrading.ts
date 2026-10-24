import { StudioProjectState, RubricEvaluation } from '../types';
import { decodeSubmission } from './submissionCodec';
import { evaluateStudioSetup } from './gradingEngine';
import { resolveTaskId, taskTitle } from '../data/challenges';

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
  unreadable: string[]; // the name on that line, or a short preview of the code
  duplicatesRemoved: number;
}

// Every code starts with the same few characters, because every packed project
// starts with the same JSON characters. Used to find codes glued to other text.
const CODE_START = 'N4Ig';
// Codes are made only of these characters. Everything else separates words.
const NOT_CODE_CHAR = /[^A-Za-z0-9+\-$.]+/;
// Long text without a code start (class links, IDs) is ignored unless it is this long.
const SUSPICIOUS_LENGTH = 60;
// Words that appear in Google Classroom lists but are never a student's name.
const CLASSROOM_WORDS = /^(turned in|handed in|done late|missing|assigned|graded|returned|draft|submitted|not turned in|private comments?|class comments?|add (class |private )?comment|student work|instructions|all students|view (submission|work)|see more|unsubmit|mark as done|late|done|points?|\d+\/\d+)$/i;

/** Turn pasted HTML-ish text (tags, <br>, &nbsp;, invisible characters) into plain lines. */
export function cleanPastedText(text: string): string {
  const decode = (t: string) =>
    t
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&amp;/gi, '&');
  let t = decode(decode(text)); // twice: handles "&amp;lt;br&amp;gt;" style double-escaping
  t = t
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(p|div|li|tr|h\d)\s*>/gi, '\n')
    .replace(/<[^>]{0,200}>/g, ' ')
    .replace(/\\n/g, '\n') // a literal backslash-n
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, '') // invisible characters
    .replace(/[\u00A0\u2007\u202F]/g, ' '); // non-breaking spaces
  return t;
}

/** Try to read a code out of a piece of text that may have other text glued to either end. */
function readCode(piece: string): { code: string; project: StudioProjectState } | null {
  const starts = new Set<number>([0]);
  for (let i = piece.indexOf(CODE_START); i >= 0; i = piece.indexOf(CODE_START, i + 1)) starts.add(i);
  for (const start of starts) {
    const candidate = piece.slice(start).replace(/^\.+/, '');
    const dot = candidate.lastIndexOf('.');
    if (dot <= 0) continue;
    const body = candidate.slice(0, dot);
    // The checksum is up to 7 lowercase letters/digits; anything after it is glued-on text.
    const tail = (candidate.slice(dot + 1).match(/^[a-z0-9]{1,7}/) || [''])[0];
    for (let len = tail.length; len >= 1; len--) {
      const code = `${body}.${tail.slice(0, len)}`;
      const project = decodeSubmission(code);
      if (project) return { code, project };
    }
  }
  return null;
}

const isNameLike = (line: string) => {
  const words = line.trim().split(/\s+/);
  return (
    words.length >= 2 &&
    words.length <= 4 &&
    !CLASSROOM_WORDS.test(line.trim()) &&
    words.every((w) => /^[A-Z][A-Za-z'\u00C0-\u017F-]*\.?$/.test(w))
  );
};

/** Title of the task a submission was made for (old codes = the open 4-instrument task). */
export function challengeTitle(project: StudioProjectState): string {
  return taskTitle(resolveTaskId(project.activeChallengeId, project.environment));
}

export function gradeProject(project: StudioProjectState): RubricEvaluation {
  return evaluateStudioSetup(
    project.environment || 'recording_studio',
    project.placedGear || [],
    project.connections || [],
    project.mixerChannels || [],
    resolveTaskId(project.activeChallengeId, project.environment),
    project.stageSize
  );
}

/**
 * Pull every submission code out of pasted text and grade it. Copes with what
 * Google Classroom and spreadsheets paste in: names, status text ("Turned in"),
 * HTML tags and <br>s, &nbsp;, links, invisible characters, text glued to the
 * start or end of a code, and codes broken across lines.
 */
export function parseBatch(text: string): BatchParseResult {
  const lines = cleanPastedText(text).split(/\r?\n/);

  // Flatten into pieces, remembering which line each came from.
  const pieces: { text: string; line: number }[] = [];
  lines.forEach((line, i) => {
    for (const t of line.split(NOT_CODE_CHAR)) if (t.replace(/\./g, '').length) pieces.push({ text: t, line: i });
  });

  // A student's name: on the code's own line, or the nearest name-like line above it.
  const nameFor = (lineIdx: number) => {
    const own = lines[lineIdx]
      .split(NOT_CODE_CHAR)
      .filter((w) => w.length < 30 && !w.includes(CODE_START) && /^[A-Za-z]/.test(w))
      .join(' ')
      .trim();
    if (isNameLike(own)) return own;
    for (let i = lineIdx - 1; i >= 0 && i >= lineIdx - 6; i--) if (isNameLike(lines[i])) return lines[i].trim();
    return '';
  };

  const seen = new Set<string>();
  const unreadable: string[] = [];
  const entries: BatchEntry[] = [];
  let duplicatesRemoved = 0;

  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i].text;
    const looksLikeAttempt = piece.includes(CODE_START) || piece.length >= SUSPICIOUS_LENGTH;
    if (!looksLikeAttempt) continue; // names, status words, links, class IDs...

    let found = readCode(piece);
    // A code broken across lines or spaces: try joining the next few pieces.
    let used = 0;
    if (!found) {
      let joined = piece;
      for (let j = 1; j <= 6 && i + j < pieces.length; j++) {
        if (pieces[i + j].text.includes(CODE_START)) break; // the next student's code
        joined += pieces[i + j].text;
        found = readCode(joined);
        if (found) {
          used = j;
          break;
        }
      }
    }
    if (!found) {
      unreadable.push(nameFor(pieces[i].line) || `code starting ${piece.slice(0, 10)}…`);
      continue;
    }
    i += used;
    if (seen.has(found.code)) {
      duplicatesRemoved++;
      continue;
    }
    seen.add(found.code);
    entries.push({
      id: entries.length,
      project: found.project,
      evaluation: gradeProject(found.project),
      challengeTitle: challengeTitle(found.project),
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
