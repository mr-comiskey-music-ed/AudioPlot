import { QuizRecord } from './quizEngine';

/**
 * The quiz in progress, kept in this browser only so a reload or a closed lid doesn't lose it:
 * the quiz record (seed, part, frozen plots, written answers) and the plot on screen, packed.
 * Never the student's name, and never sent anywhere.
 */
const KEY = 'audioplot:v1:quiz';

/** How long a finished quiz stays on this browser before /quiz starts a new one */
export const QUIZ_DONE_KEEP_MS = 12 * 60 * 60 * 1000;

export interface StoredQuiz {
  rec: QuizRecord;
  plot?: Record<string, unknown>;
}

export function loadQuiz(): StoredQuiz | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && data.rec && typeof data.rec.sd === 'number' ? (data as StoredQuiz) : null;
  } catch {
    return null;
  }
}

export function saveQuiz(data: StoredQuiz): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearQuiz() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
