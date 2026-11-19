/**
 * Autosave: keeps a student's plot in THEIR OWN browser (localStorage) so closing the tab or reloading
 * doesn't lose it. Nothing is sent anywhere and the student's name is never saved (it lives only inside
 * the code they make to turn in). The plot is stored in the same compact format as a student code
 * (src/services/submissionCodec.ts), so it is checked for damage when it is read back.
 *
 * Each assignment link (?task=...) gets its own save slot, and the open sandbox has one.
 */

const PREFIX = 'audioplot:v1:autosave:';
const VERSION = 1;

export const slotFor = (taskId: string | null | undefined) => PREFIX + (taskId || 'sandbox');

export function loadSaved(slot: string): { code: string; savedAt: number } | null {
  try {
    const raw = window.localStorage.getItem(slot);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== VERSION || typeof parsed.code !== 'string' || !parsed.code) return null;
    return { code: parsed.code, savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now() };
  } catch {
    return null;
  }
}

/** Returns true if the save worked. */
export function writeSaved(slot: string, code: string): boolean {
  try {
    window.localStorage.setItem(slot, JSON.stringify({ v: VERSION, savedAt: Date.now(), code }));
    return true;
  } catch {
    return false;
  }
}

export function clearSaved(slot: string): void {
  try {
    window.localStorage.removeItem(slot);
  } catch {
    /* nothing to clear */
  }
}

/** The slot the student last worked in, so a plain visit (no assignment link) offers the right plot back. */
const LAST_KEY = PREFIX + '__last';

export function getLastSlot(): string | null {
  try {
    const v = window.localStorage.getItem(LAST_KEY);
    return v && v.startsWith(PREFIX) && v !== LAST_KEY ? v : null;
  } catch {
    return null;
  }
}

export function setLastSlot(slot: string): void {
  try {
    window.localStorage.setItem(LAST_KEY, slot);
  } catch {
    /* nothing to remember */
  }
}

/** Does this task (or the sandbox, with no id) have saved work in this browser? */
export const hasSaved = (taskId: string | null | undefined) => loadSaved(slotFor(taskId)) !== null;

/**
 * Tasks the student has completed (reached the passing score), kept in this browser next to their saved plots.
 * Only task ids, percentages and times: no names.
 */
const DONE_KEY = 'audioplot:v1:done';

export function loadDone(): Record<string, { pct: number; at: number }> {
  try {
    const raw = window.localStorage.getItem(DONE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function markDone(taskId: string, pct: number): void {
  try {
    const all = loadDone();
    all[taskId] = { pct, at: Date.now() };
    window.localStorage.setItem(DONE_KEY, JSON.stringify(all));
  } catch {
    /* nothing to record */
  }
}

export function clearDone(taskId: string): void {
  try {
    const all = loadDone();
    delete all[taskId];
    window.localStorage.setItem(DONE_KEY, JSON.stringify(all));
  } catch {
    /* nothing to clear */
  }
}
