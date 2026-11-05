/**
 * Learn progress, kept in THIS browser only (localStorage), like the plot autosave.
 * No name or other student data: just how far they got, their Think First picks,
 * and whether Learn is finished. "Learn done" also travels inside the student's
 * code (`learnDone`), so the teacher sees it in batch grading.
 */

const KEY = 'audioplot:v1:learn';

export interface LearnProgress {
  /** Furthest step opened (0-based). */
  reached: number;
  done: boolean;
  /** Think First answers: step index -> option picked. */
  answers: Record<number, number>;
}

export const EMPTY_LEARN: LearnProgress = { reached: 0, done: false, answers: {} };

export function loadLearnProgress(): LearnProgress {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_LEARN;
    const p = JSON.parse(raw);
    return {
      reached: Number.isInteger(p?.reached) && p.reached >= 0 ? p.reached : 0,
      done: p?.done === true,
      answers: p?.answers && typeof p.answers === 'object' ? p.answers : {},
    };
  } catch {
    return EMPTY_LEARN;
  }
}

export function saveLearnProgress(p: LearnProgress): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* browser can't save; progress lasts for this visit */
  }
}
