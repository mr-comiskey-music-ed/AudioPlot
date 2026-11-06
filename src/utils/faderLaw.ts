/**
 * The one fader law for the whole app: the dB shown on a fader, the sound it makes, the scope and the
 * level meters all come from here, so "-15 dB" on the label is -15 dB in the audio.
 *
 * Fader position is 0..100. 75 is unity (0 dB); the top is +6 dB; below unity the scale falls in a straight
 * line to -48 dB at the bottom, and the very bottom is off.
 */

export const FADER_UNITY = 75;
export const FADER_TOP_DB = 6;
export const FADER_BOTTOM_DB = -48;

/** Fader position (0..100) to dB. Returns -Infinity at the very bottom. */
export function faderPositionToDb(position: number): number {
  if (position <= 0) return -Infinity;
  if (position >= FADER_UNITY) return ((Math.min(100, position) - FADER_UNITY) / (100 - FADER_UNITY)) * FADER_TOP_DB;
  return ((position - FADER_UNITY) / FADER_UNITY) * -FADER_BOTTOM_DB;
}

/** Fader position (0..100) to the linear gain the audio engine applies (10^(dB/20)). */
export function faderPositionToGain(position: number): number {
  const db = faderPositionToDb(position);
  return Number.isFinite(db) ? Math.pow(10, db / 20) : 0;
}

/** The label shown on a fader, e.g. "-15.0 dB", "0.0 dB", "+3.6 dB", "-∞ dB". */
export function formatFaderDb(position: number): string {
  const db = faderPositionToDb(position);
  if (!Number.isFinite(db)) return '-∞ dB';
  if (Math.abs(db) < 0.05) return '0.0 dB';
  return `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
}
