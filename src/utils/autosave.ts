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
