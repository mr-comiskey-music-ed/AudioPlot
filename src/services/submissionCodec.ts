import LZString from 'lz-string';
import {
  StudioProjectState,
  PlacedGear,
  CableConnection,
  CableType,
  MixerChannelState,
  MasterBusState,
} from '../types';

/**
 * Compact, lossless submission format.
 *
 * Student work is packed into a small structure before compression:
 *   - long instance IDs (gear_1760539200000_4f2a) become list positions (0, 1, 2...)
 *   - mixer channels still at their starting settings are left out
 *   - values the app can rebuild (cable colors from cable type, cable IDs,
 *     meter animation levels, timestamps) are left out
 *   - short keys replace long field names
 *
 * Unpacking restores a full StudioProjectState, so grading, loading and the
 * PDF report see the same data the student had. Nothing leaves the browser.
 */

// ---------- Defaults (must match INITIAL_CHANNELS / DEFAULT_MASTER_BUS in App.tsx) ----------
const DEFAULT_CHANNEL_COUNT = 8;
const CH_DEFAULTS = { phantomPower: false, gain: 72, fader: 75, pan: 0, solo: false, muted: false };
const MASTER_DEFAULTS: MasterBusState = { fader: 75, gain: 50, pan: 0, muted: false, dim: false, mono: false };
const CABLE_COLORS: Record<CableType, string> = { xlr: '#F97316', quarter_inch: '#38BDF8', speaker: '#22C55E' };
const defaultLabel = (n: number) => `CH ${n}`;

// ---------- Short keys ----------
const GEAR_KEYS: Record<string, string> = {
  rotation: 'r', label: 'l', instrumentType: 'it', standHeight: 'sh', micPlacement: 'mp',
  hasPopFilter: 'pf', hasShockmount: 'sm', latchedSourceInstanceId: 'ls', assignedChannel: 'ac',
  isMuted: 'mu', gain: 'gn', customScale: 'cs', customWidth: 'cw', customHeight: 'ch',
};
const PROJECT_KEYS: Record<string, string> = {
  title: 't', studentName: 's', studentId: 'si', period: 'p', className: 'k',
  teacherName: 'tn', environment: 'e', activeChallengeId: 'a', notes: 'n',
};
const CHANNEL_KEYS: Record<string, string> = {
  label: 'l', phantomPower: 'p', gain: 'g', fader: 'f', pan: 'pn', solo: 'so', muted: 'mu',
};
const CABLE_CODES: Record<string, string> = { xlr: 'x', quarter_inch: 'q', speaker: 's' };
// Fields left out on purpose (rebuilt on unpack, or not needed to review the work).
const DROPPED_PROJECT = new Set(['id', 'version', 'createdAt', 'updatedAt', 'placedGear', 'connections', 'mixerChannels', 'masterBus']);
const HANDLED_GEAR = new Set(['instanceId', 'gearId', 'x', 'y']);
const HANDLED_CABLE = new Set(['id', 'fromInstanceId', 'toInstanceId', 'fromPort', 'toPort', 'cableType', 'color']);

const invert = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]));
const GEAR_LONG = invert(GEAR_KEYS);
const PROJECT_LONG = invert(PROJECT_KEYS);
const CHANNEL_LONG = invert(CHANNEL_KEYS);
const CABLE_LONG = invert(CABLE_CODES);

// Booleans travel as 1/0; positions keep one decimal place.
const packVal = (v: unknown) => (v === true ? 1 : v === false ? 0 : v);
const round1 = (n: number) => Math.round(n * 10) / 10;
const BOOL_GEAR = new Set(['hasPopFilter', 'hasShockmount', 'isMuted']);
const BOOL_CHANNEL = new Set(['phantomPower', 'solo', 'muted']);

// ---------- Pack ----------
export function packProject(project: StudioProjectState): Record<string, unknown> {
  const gear = project.placedGear || [];
  const index = new Map<string, number>();
  gear.forEach((g, i) => index.set(g.instanceId, i));
  // Gear references become numbers; anything else (mixer ports, etc.) stays a string.
  const ref = (id: string | null | undefined) => (id == null ? id : index.has(id) ? index.get(id)! : id);

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(project)) {
    if (DROPPED_PROJECT.has(k) || v === undefined || v === null || v === '') continue;
    out[PROJECT_KEYS[k] ?? k] = v;
  }

  // Gear: [gearId, x, y, extras?]
  out.g = gear.map((g) => {
    const extras: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(g)) {
      if (HANDLED_GEAR.has(k) || v === undefined) continue;
      if (k === 'rotation' && v === 0) continue;
      extras[GEAR_KEYS[k] ?? k] = k === 'latchedSourceInstanceId' ? ref(v as string) : packVal(v);
    }
    const row: unknown[] = [g.gearId, round1(g.x), round1(g.y)];
    if (Object.keys(extras).length) row.push(extras);
    return row;
  });

  // Cables: [from, to, typeCode, extras?]
  const cables = project.connections || [];
  if (cables.length) {
    out.c = cables.map((c) => {
      const extras: Record<string, unknown> = {};
      if (c.fromPort !== undefined) extras.fp = c.fromPort;
      if (c.toPort !== undefined) extras.tp = c.toPort;
      if (c.color !== CABLE_COLORS[c.cableType]) extras.co = c.color;
      for (const [k, v] of Object.entries(c)) if (!HANDLED_CABLE.has(k) && v !== undefined) extras[k] = v;
      const row: unknown[] = [ref(c.fromInstanceId), ref(c.toInstanceId), CABLE_CODES[c.cableType] ?? c.cableType];
      if (Object.keys(extras).length) row.push(extras);
      return row;
    });
  }

  // Mixer: only channels that differ from their starting state.
  const channels = project.mixerChannels || [];
  if (channels.length !== DEFAULT_CHANNEL_COUNT) out.mc = channels.length;
  const changed = channels
    .map((ch) => {
      const extras: Record<string, unknown> = {};
      if (ch.label !== defaultLabel(ch.channelNumber)) extras.l = ch.label;
      for (const k of Object.keys(CH_DEFAULTS) as (keyof typeof CH_DEFAULTS)[]) {
        if (ch[k] !== CH_DEFAULTS[k]) extras[CHANNEL_KEYS[k]] = packVal(ch[k]);
      }
      if (ch.assignedGearInstanceId == null && !Object.keys(extras).length) return null;
      const row: unknown[] = [ch.channelNumber, ref(ch.assignedGearInstanceId) ?? null];
      if (Object.keys(extras).length) row.push(extras);
      return row;
    })
    .filter(Boolean);
  if (changed.length) out.m = changed;

  // Master bus: only settings that differ from the default.
  if (project.masterBus) {
    const mb: Record<string, unknown> = {};
    for (const k of Object.keys(MASTER_DEFAULTS) as (keyof MasterBusState)[]) {
      if (project.masterBus[k] !== MASTER_DEFAULTS[k]) mb[k] = packVal(project.masterBus[k]);
    }
    if (Object.keys(mb).length) out.b = mb;
  }
  return out;
}

// ---------- Unpack ----------
export function unpackProject(packed: Record<string, any>): StudioProjectState {
  const gearRows: any[] = Array.isArray(packed.g) ? packed.g : [];
  const idFor = (i: number) => `gear_${i}`;
  const unref = (r: any) => (typeof r === 'number' ? idFor(r) : r);

  const placedGear: PlacedGear[] = gearRows.map(([gearId, x, y, extras = {}], i) => {
    const g: any = { instanceId: idFor(i), gearId, x, y, rotation: 0 };
    for (const [k, v] of Object.entries(extras as Record<string, any>)) {
      const long = GEAR_LONG[k] ?? k;
      g[long] = long === 'latchedSourceInstanceId' ? unref(v) : BOOL_GEAR.has(long) ? v === 1 : v;
    }
    return g as PlacedGear;
  });

  const connections: CableConnection[] = (packed.c || []).map(([from, to, code, extras = {}]: any[], i: number) => {
    const cableType = (CABLE_LONG[code] ?? code) as CableType;
    const { fp, tp, co, ...rest } = extras;
    const c: any = { id: `cable_${i}`, fromInstanceId: unref(from), toInstanceId: unref(to) };
    if (fp !== undefined) c.fromPort = fp;
    if (tp !== undefined) c.toPort = tp;
    Object.assign(c, { cableType, color: co ?? CABLE_COLORS[cableType] }, rest);
    return c as CableConnection;
  });

  const count = packed.mc ?? DEFAULT_CHANNEL_COUNT;
  const mixerChannels: MixerChannelState[] = Array.from({ length: count }, (_, i) => ({
    channelNumber: i + 1, assignedGearInstanceId: null, label: defaultLabel(i + 1), ...CH_DEFAULTS, meterValue: 0,
  }));
  for (const [n, assigned, extras = {}] of packed.m || []) {
    const ch: any = mixerChannels.find((c) => c.channelNumber === n);
    if (!ch) continue;
    ch.assignedGearInstanceId = assigned == null ? null : unref(assigned);
    for (const [k, v] of Object.entries(extras as Record<string, any>)) {
      const long = CHANNEL_LONG[k] ?? k;
      ch[long] = BOOL_CHANNEL.has(long) ? v === 1 : v;
    }
  }

  const masterBus: MasterBusState = { ...MASTER_DEFAULTS };
  for (const [k, v] of Object.entries((packed.b || {}) as Record<string, any>)) {
    (masterBus as any)[k] = typeof MASTER_DEFAULTS[k as keyof MasterBusState] === 'boolean' ? v === 1 : v;
  }

  const project: any = {};
  for (const [k, v] of Object.entries(packed)) {
    if (['g', 'c', 'm', 'mc', 'b'].includes(k)) continue;
    project[PROJECT_LONG[k] ?? k] = v;
  }
  const now = new Date().toISOString();
  return {
    id: 'submission',
    version: 1,
    title: '',
    studentName: '',
    className: '',
    environment: 'recording_studio',
    createdAt: now,
    updatedAt: now,
    ...project,
    placedGear,
    connections,
    mixerChannels,
    masterBus,
  } as StudioProjectState;
}

// ---------- Code / link helpers ----------
function hash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h << 5) - h + text.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(36);
}

/** Student code: compressed project + "." + checksum. Safe to paste anywhere. */
export function encodeSubmission(project: StudioProjectState): string {
  const json = JSON.stringify(packProject(project));
  return `${LZString.compressToEncodedURIComponent(json)}.${hash(json)}`;
}

/** Returns the project, or null if the code is incomplete, mistyped or edited. */
export function decodeSubmission(code: string): StudioProjectState | null {
  const raw = code.trim().replace(/\s+/g, '');
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return null;
  const json = LZString.decompressFromEncodedURIComponent(raw.slice(0, dot));
  if (!json || hash(json) !== raw.slice(dot + 1)) return null;
  try {
    return unpackProject(JSON.parse(json));
  } catch {
    return null;
  }
}

/** Shorter share links: same packed data, no checksum needed. */
export function encodeForLink(project: StudioProjectState): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(packProject(project)));
}

export function decodeFromLink(encoded: string): StudioProjectState | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    return json ? unpackProject(JSON.parse(json)) : null;
  } catch {
    return null;
  }
}
