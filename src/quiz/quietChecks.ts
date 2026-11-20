import { createContext, useContext } from 'react';

/**
 * True while a quiz is running: the plot shows no live checks (no "!" badges, no mixer chain
 * warnings, no signal-path HUD) and refused cables get a plain message with no explanation.
 * Quiz Mode checks whether the learning stuck, so it must not coach.
 */
export const QuietChecksContext = createContext(false);
export const useQuietChecks = () => useContext(QuietChecksContext);

/** Toasts that only report what happened (not why something is wrong); they stay as they are. */
const INFO_TOASTS = new Set(['Gear Swapped', 'Microphone Attached', '5-Piece Drum Set Added', 'Part of this setup', 'Select XLR Cable First']);

export function quietToast(quiet: boolean, title: string, message: string): { title: string; message: string } {
  if (!quiet || INFO_TOASTS.has(title)) return { title, message };
  return { title: 'Won\'t connect', message: 'That connection isn\'t possible.' };
}
