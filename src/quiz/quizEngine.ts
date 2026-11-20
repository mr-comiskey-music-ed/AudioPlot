/**
 * Quiz Mode engine: scenario draw, Part 1 checklist, Part 2 broken-setup builder and its fix checks.
 *
 * Everything here is a pure function of (seed, template) plus the student's plot, so the batch view
 * rebuilds exactly what each student was given from the code alone. Nothing is stored anywhere else.
 * Never change the draw order or the pool/template ids once codes are out: old codes would regenerate
 * a different gig.
 */
import { CableConnection, CableType, MasterBusState, MixerChannelState, PlacedGear } from '../types';
import { getGearById, isDiBoxId } from '../data/gearCatalog';
import { evaluateStudioSetup, validateChannelSignalChain } from '../services/gradingEngine';
import { getPaZones, getWorld } from '../components/canvas/stageGeometry';
import { getGearBoxDimensions } from '../components/canvas/canvasMath';

export interface QuizPlot {
  environment: 'live_stage';
  placedGear: PlacedGear[];
  connections: CableConnection[];
  mixerChannels: MixerChannelState[];
  masterBus: MasterBusState;
}

// ---------- Random ----------

/** mulberry32: small, fast, and the same on every browser. */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n: number) => Math.floor(next() * n),
    pick: <T,>(arr: T[]): T => arr[Math.floor(next() * arr.length)],
    shuffle: <T,>(arr: T[]): T[] => {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

export const newQuizSeed = () => (Math.floor(Math.random() * 0xfffffffe) + 1) >>> 0;

// ---------- Sources ----------

/** A unit drawn for the band. The kit counts as three sources. */
export type UnitKind = 'vocal' | 'acoustic_guitar' | 'electric_guitar' | 'bass' | 'keys' | 'piano' | 'kit' | 'dj_rig' | 'laptop';
/** One source the student has to get into the mixer. */
export type SourceKind = Exclude<UnitKind, 'kit'> | 'kick' | 'snare' | 'hihat';

export interface QuizSource {
  key: SourceKind;
  label: string;
}

// Draw pools. Never edit one: old codes rebuild their gig from it.
const POOL: UnitKind[] = ['vocal', 'acoustic_guitar', 'electric_guitar', 'bass', 'keys', 'piano', 'kit', 'dj_rig']; // versions 1-2
const POOL_V3: UnitKind[] = ['vocal', 'acoustic_guitar', 'electric_guitar', 'bass', 'keys', 'piano', 'kit']; // version 3 (+ laptop by its own 25% draw)
/** Order sources are listed in. */
const LIST_ORDER: UnitKind[] = [...POOL, 'laptop'];

/** The instrument each source is, as named in the equipment locker (so the prompt matches what students drag in). */
const SOURCE_GEAR: Record<SourceKind, string> = {
  vocal: 'inst_voice',
  acoustic_guitar: 'inst_acoustic_guitar',
  electric_guitar: 'inst_electric_guitar',
  bass: 'inst_bass_guitar',
  keys: 'inst_keyboard',
  piano: 'inst_acoustic_piano',
  kick: 'inst_kick_drum',
  snare: 'inst_snare_drum',
  hihat: 'inst_hi_hat',
  dj_rig: 'inst_dj_rig',
  laptop: 'inst_computer',
};
export const SOURCE_LABELS = Object.fromEntries(
  Object.entries(SOURCE_GEAR).map(([k, id]) => [k, getGearById(id)?.name ?? k])
) as Record<SourceKind, string>;

const expand = (units: UnitKind[]): QuizSource[] =>
  units.flatMap((u) =>
    u === 'kit'
      ? (['kick', 'snare', 'hihat'] as SourceKind[]).map((k) => ({ key: k, label: SOURCE_LABELS[k] }))
      : [{ key: u as SourceKind, label: SOURCE_LABELS[u as SourceKind] }]
  );

export interface QuizTemplate {
  id: string;
  title: string;
  blurb: string;
  units: UnitKind[];
  /** What this template was in codes made before version 3 (the DJ Rig left the quiz then). */
  before3?: { blurb: string; units: UnitKind[] };
}

/** Named gigs, chosen by the teacher with /quiz?t=<id>. Never rename an id. */
export const QUIZ_TEMPLATES: QuizTemplate[] = [
  { id: 'coffeehouse', title: 'Coffeehouse night', blurb: 'A quiet acoustic set in a small room.', units: ['vocal', 'acoustic_guitar', 'keys', 'bass'] },
  { id: 'rock', title: 'Rock trio', blurb: 'Loud and simple: drums, guitar, bass.', units: ['kit', 'electric_guitar', 'bass'] },
  { id: 'worship', title: 'Sunday service band', blurb: 'A singer leads a full band.', units: ['vocal', 'acoustic_guitar', 'piano', 'bass', 'electric_guitar'] },
  { id: 'jazz', title: 'Jazz trio', blurb: 'Piano, bass and a small kit in a lounge.', units: ['piano', 'bass', 'kit'] },
  {
    id: 'school-dance',
    title: 'School dance',
    blurb: 'A live drummer plays along with tracks from a laptop.',
    units: ['laptop', 'kit'],
    before3: { blurb: 'A DJ with a live drummer playing along.', units: ['dj_rig', 'kit'] },
  },
];

export interface QuizScenario {
  seed: number;
  template?: string;
  title: string;
  blurb: string;
  units: UnitKind[];
  sources: QuizSource[];
}

const units = (u: UnitKind) => (u === 'kit' ? 3 : 1);

/** The gig for this seed (and template, when the link named one). */
/**
 * The gig for this seed (and template, when the link named one).
 * version 1 = the first draw (codes made before Nov 20 2026). Version 2 puts a vocal in at least 75% of
 * gigs. Never change a version's draw: old codes must rebuild the same gig.
 */
export function buildScenario(seed: number, templateId?: string | null, version: number = QUIZ_VERSION): QuizScenario {
  const tpl = templateId ? QUIZ_TEMPLATES.find((t) => t.id === templateId) : undefined;
  if (tpl) {
    const t = version < 3 && tpl.before3 ? { ...tpl, ...tpl.before3 } : tpl;
    return { seed, template: tpl.id, title: t.title, blurb: t.blurb, units: t.units, sources: expand(t.units) };
  }
  const rng = makeRng(seed);
  const target = rng.next() < 0.5 ? 4 : 5;
  const picked: UnitKind[] = [];
  let count = 0;
  if (version >= 2 && rng.next() < 0.75) {
    picked.push('vocal');
    count = 1;
  }
  // Version 3: no DJ Rig; a Laptop / Phone (backing tracks) joins 1 gig in 4
  if (version >= 3 && rng.next() < 0.25) {
    picked.push('laptop');
    count += 1;
  }
  for (const u of rng.shuffle(version >= 3 ? POOL_V3 : POOL)) {
    if (picked.includes(u)) continue;
    if (count + units(u) > target) continue;
    picked.push(u);
    count += units(u);
    if (count === target) break;
  }
  const order = LIST_ORDER.filter((u) => picked.includes(u));
  return { seed, ...frameGig(order, count), units: order, sources: expand(order) };
}

/** 1 = first draw; 2 = Voice in 75%+; 3 = no DJ Rig, Laptop / Phone in 25%. */
export const QUIZ_VERSION = 3;

/**
 * Title and one-line setup for a drawn gig. A DJ only performs *with* live players in a few styles
 * (hip hop / EDM with a singer or drummer); next to a full band it is a band and a DJ sharing the stage.
 */
function frameGig(units: UnitKind[], count: number): { title: string; blurb: string } {
  if (!units.includes('dj_rig')) {
    const tracks = units.includes('laptop') ? ', playing along with backing tracks from a laptop' : '';
    return { title: 'Tonight\'s gig', blurb: `A ${count}-source band on a live stage${tracks}.` };
  }
  const others = units.filter((u) => u !== 'dj_rig');
  if (others.every((u) => u === 'vocal' || u === 'kit')) {
    const who = others.length === 2 ? 'a singer and a drummer' : others[0] === 'vocal' ? 'a singer' : 'a drummer';
    return { title: 'DJ set with live players', blurb: `A DJ performs with ${who} on a live stage.` };
  }
  return {
    title: 'A band and a DJ',
    blurb: 'A live band plays its sets and a DJ spins between them. Both run through the same stage, snake and mixer.',
  };
}

// ---------- Reading a plot ----------

const def = (g: PlacedGear) => getGearById(g.gearId);
const isMic = (g: PlacedGear) => def(g)?.category === 'microphone';
const needs48 = (g: PlacedGear) => !!def(g)?.requiresPhantomPower;
const touches = (c: CableConnection, id: string) => c.fromInstanceId === id || c.toInstanceId === id;
const otherEnd = (c: CableConnection, id: string) => (c.fromInstanceId === id ? c.toInstanceId : c.fromInstanceId);

/** What a mic is aimed at: its chosen Source, or the nearest instrument/amp (same rule as the signal check). */
function micTarget(p: QuizPlot, mic: PlacedGear): PlacedGear | null {
  if (mic.latchedSourceInstanceId === 'room') return null;
  if (mic.latchedSourceInstanceId === 'drummer') return null;
  if (mic.latchedSourceInstanceId) return p.placedGear.find((g) => g.instanceId === mic.latchedSourceInstanceId) ?? null;
  return (
    p.placedGear.find((g) => {
      if (g.instanceId === mic.instanceId) return false;
      const d = def(g);
      if (d?.category !== 'instrument' && d?.category !== 'amplifier') return false;
      const w = g.gearId === 'inst_choir' ? 250 : d?.size?.width || 64;
      return Math.hypot(g.x + w / 2 - (mic.x + 32), g.y + 32 - (mic.y + 32)) < Math.max(140, w / 2 + 50);
    }) ?? null
  );
}

const micsOn = (p: QuizPlot, target: PlacedGear) => p.placedGear.filter((g) => isMic(g) && micTarget(p, g)?.instanceId === target.instanceId);

/** Gear joined to `g` by a cable of one of these types. */
const cabledTo = (p: QuizPlot, g: PlacedGear, types: CableType[]) =>
  p.connections
    .filter((c) => types.includes(c.cableType) && touches(c, g.instanceId))
    .map((c) => p.placedGear.find((x) => x.instanceId === otherEnd(c, g.instanceId)))
    .filter((x): x is PlacedGear => !!x);

const channelsOf = (p: QuizPlot, g: PlacedGear) => p.mixerChannels.filter((c) => c.assignedGearInstanceId === g.instanceId);

/** Reaches the snake with signal (48V aside: that has its own check). */
function reaches(p: QuizPlot, g: PlacedGear): boolean {
  const chs = channelsOf(p, g);
  return (
    chs.length > 0 &&
    chs.every((ch) => validateChannelSignalChain({ ...ch, phantomPower: true }, p.placedGear, p.connections, p.mixerChannels, 'live_stage').hasSignal)
  );
}

type CaptureKind = 'mic' | 'di' | 'amp_out' | 'direct';
interface Capture {
  gear: PlacedGear; // the thing patched into the snake
  kind: CaptureKind;
  viaAmp?: PlacedGear;
  onInstrument?: boolean; // a mic aimed straight at an electric instrument or keys
}

/** Which instruments on the plot can stand in for each source. */
const INSTRUMENTS_FOR: Record<SourceKind, string[]> = {
  vocal: ['inst_voice'],
  acoustic_guitar: ['inst_acoustic_guitar'],
  electric_guitar: ['inst_electric_guitar'],
  bass: ['inst_bass_guitar'],
  keys: ['inst_keyboard'],
  piano: ['inst_acoustic_piano', 'inst_grand_piano', 'inst_keyboard'],
  kick: ['inst_kick_drum'],
  snare: ['inst_snare_drum'],
  hihat: ['inst_hi_hat'],
  dj_rig: ['inst_dj_rig'],
  laptop: ['inst_computer'],
};

/** Mics that are a sensible choice for each source. */
const GOOD_MICS: Partial<Record<SourceKind | 'piano_acoustic' | 'guitar_amp' | 'bass_amp', string[]>> = {
  vocal: ['mic_sm58', 'mic_sm57', 'mic_c214', 'mic_at2035', 'mic_at2020'],
  acoustic_guitar: ['mic_sm81', 'mic_adx51', 'mic_c214', 'mic_at2035', 'mic_at2020', 'mic_sm57'],
  piano_acoustic: ['mic_c214', 'mic_at2035', 'mic_at2020', 'mic_sm81', 'mic_adx51'],
  guitar_amp: ['mic_sm57', 'mic_sm58', 'mic_e604'],
  bass_amp: ['mic_beta52a', 'mic_sm57'],
  kick: ['mic_beta52a'],
  snare: ['mic_sm57', 'mic_e604'],
  hihat: ['mic_sm81', 'mic_adx51'],
};

function capturesOf(p: QuizPlot, inst: PlacedGear): Capture[] {
  const out: Capture[] = [];
  const electric = ['inst_electric_guitar', 'inst_bass_guitar', 'inst_keyboard', 'inst_dj_rig', 'inst_computer'].includes(inst.gearId);
  micsOn(p, inst).forEach((m) => out.push({ gear: m, kind: 'mic', onInstrument: electric }));
  cabledTo(p, inst, ['quarter_inch', 'breakout']).forEach((g) => {
    if (isDiBoxId(g.gearId)) out.push({ gear: g, kind: 'di' });
    if (g.gearId === 'gear_guitar_amp' || g.gearId === 'gear_bass_amp') {
      micsOn(p, g).forEach((m) => out.push({ gear: m, kind: 'mic', viaAmp: g }));
      cabledTo(p, g, ['quarter_inch']).filter((d) => isDiBoxId(d.gearId)).forEach((d) => out.push({ gear: d, kind: 'di', viaAmp: g }));
      if (g.gearId === 'gear_bass_amp' && channelsOf(p, g).length) out.push({ gear: g, kind: 'amp_out', viaAmp: g });
    }
  });
  if (channelsOf(p, inst).length) out.push({ gear: inst, kind: 'direct' });
  return out;
}

function captureOk(source: SourceKind, inst: PlacedGear, c: Capture): boolean {
  const mic = c.gear.gearId;
  if (c.onInstrument) return false;
  switch (source) {
    case 'vocal':
    case 'kick':
    case 'snare':
    case 'hihat':
      return c.kind === 'mic' && !!GOOD_MICS[source]?.includes(mic);
    case 'acoustic_guitar':
      return c.kind === 'di' || (c.kind === 'mic' && !!GOOD_MICS.acoustic_guitar?.includes(mic));
    case 'electric_guitar':
      return c.kind === 'mic' && c.viaAmp?.gearId === 'gear_guitar_amp' && !!GOOD_MICS.guitar_amp?.includes(mic);
    case 'bass':
      if (c.kind === 'di' || c.kind === 'amp_out') return true;
      return c.kind === 'mic' && c.viaAmp?.gearId === 'gear_bass_amp' && !!GOOD_MICS.bass_amp?.includes(mic);
    case 'keys':
      return c.kind === 'di';
    case 'piano':
      if (inst.gearId === 'inst_keyboard') return c.kind === 'di';
      return c.kind === 'mic' && !!GOOD_MICS.piano_acoustic?.includes(mic);
    case 'dj_rig':
      return c.kind === 'direct' || c.kind === 'di';
    case 'laptop':
      return c.kind === 'di'; // Stereo Breakout into a Stereo DI or two mono DIs
  }
}

/** Most channels a source should use before it counts as doubled up. */
const MAX_CHANNELS: Record<SourceKind, number> = {
  vocal: 1, kick: 1, snare: 1, hihat: 1, electric_guitar: 1,
  acoustic_guitar: 2, bass: 2, keys: 2, piano: 2, dj_rig: 2, laptop: 2,
};

export type CheckId = 'input' | 'cable' | 'phantom' | 'stereo' | 'channel';
export const CHECK_LABELS: Record<CheckId, string> = {
  input: 'Right input (mic / DI / direct)',
  cable: 'Cabled to the snake',
  phantom: '48V only where needed',
  stereo: 'Stereo on two channels',
  channel: 'Own channel, no doubles',
};

export interface SourceResult {
  key: SourceKind;
  label: string;
  found: boolean;
  checks: Partial<Record<CheckId, boolean>>;
  passed: boolean;
  channels: number[];
}

export interface PlanResult {
  sources: SourceResult[];
  extraChannelsOk: boolean;
  /** PA speakers in the PA zones on MAIN L/R (same check as the live grader) */
  pa: boolean;
  /** Wedge or IEM fed from MON 1/2 */
  monitors: boolean;
  earned: number;
  possible: number;
  percentage: number;
}

/**
 * Match each scenario source to an instrument on the plot. Two keyboards (keys + a digital piano)
 * could go either way, so every pairing is tried and the one that scores best wins. Ties go to the
 * instrument the quiz itself placed for that source (Part 2), then to plot order.
 */
function matchInstruments(p: QuizPlot, sources: QuizSource[]): Map<SourceKind, PlacedGear | undefined> {
  const options = sources.map((s) => p.placedGear.filter((g) => INSTRUMENTS_FOR[s.key].includes(g.gearId)));
  let best: (PlacedGear | undefined)[] = [];
  let bestScore = -1;
  const pick: (PlacedGear | undefined)[] = [];
  const used = new Set<string>();
  const walk = (i: number) => {
    if (i === sources.length) {
      let score = 0;
      sources.forEach((s, k) => {
        const g = pick[k];
        const r = evalSource(p, s, g);
        score += Object.values(r.checks).filter(Boolean).length * 10;
        if (g && g.instanceId.startsWith(`quiz_${s.key}_`)) score += 1;
      });
      if (score > bestScore) {
        bestScore = score;
        best = [...pick];
      }
      return;
    }
    const opts = options[i].filter((g) => !used.has(g.instanceId));
    if (!opts.length) {
      pick[i] = undefined;
      walk(i + 1);
      return;
    }
    for (const g of opts) {
      used.add(g.instanceId);
      pick[i] = g;
      walk(i + 1);
      used.delete(g.instanceId);
    }
  };
  walk(0);
  return new Map(sources.map((s, k) => [s.key, best[k]]));
}

function evalSource(p: QuizPlot, s: QuizSource, inst: PlacedGear | undefined): SourceResult {
  const base = { key: s.key, label: s.label };
  const stereoApplies = s.key === 'dj_rig' || s.key === 'laptop' || s.key === 'keys' || (s.key === 'piano' && inst?.gearId === 'inst_keyboard');
  if (!inst) {
    const checks: Partial<Record<CheckId, boolean>> = { input: false, cable: false, phantom: false, channel: false };
    if (stereoApplies || s.key === 'dj_rig') checks.stereo = false;
    return { ...base, found: false, checks, passed: false, channels: [] };
  }
  const caps = capturesOf(p, inst);
  const chans = [...new Set(caps.flatMap((c) => channelsOf(p, c.gear).map((ch) => ch.channelNumber)))].sort((a, b) => a - b);
  const checks: Partial<Record<CheckId, boolean>> = {};
  checks.input = caps.length > 0 && caps.every((c) => captureOk(s.key, inst, c));
  checks.cable = caps.length > 0 && caps.every((c) => reaches(p, c.gear));
  checks.phantom =
    chans.length > 0 &&
    caps.every((c) => channelsOf(p, c.gear).every((ch) => ch.phantomPower === needs48(c.gear)));
  if (stereoApplies) {
    const stereoDis = caps.filter((c) => c.gear.gearId === 'gear_di_stereo');
    if (s.key === 'dj_rig' || s.key === 'laptop') checks.stereo = chans.length >= 2;
    else checks.stereo = stereoDis.every((c) => channelsOf(p, c.gear).length === 2); // mono keys are fine
  }
  checks.channel = chans.length >= 1 && chans.length <= MAX_CHANNELS[s.key];
  const passed = Object.values(checks).every(Boolean);
  return { ...base, found: true, checks, passed, channels: chans };
}

/** Part 1 checklist on any plot (also used to check Part 2 fixes). */
export function evaluatePlan(p: QuizPlot, scenario: QuizScenario): PlanResult {
  const matched = matchInstruments(p, scenario.sources);
  const sources = scenario.sources.map((s) => evalSource(p, s, matched.get(s.key)));
  const owned = new Set(sources.flatMap((r) => r.channels));
  const extraChannelsOk = p.mixerChannels.every((ch) => !ch.assignedGearInstanceId || owned.has(ch.channelNumber));
  const outs = liveOutputsOf(p);
  let earned = (extraChannelsOk ? 1 : 0) + (outs.pa ? 1 : 0) + (outs.monitors ? 1 : 0);
  let possible = 3;
  sources.forEach((r) => {
    Object.values(r.checks).forEach((ok) => {
      possible += 1;
      if (ok) earned += 1;
    });
  });
  return { sources, extraChannelsOk, ...outs, earned, possible, percentage: Math.round((earned / possible) * 100) };
}

/** PA and stage monitors, scored the way the live-stage grader scores them. */
export function liveOutputsOf(p: QuizPlot): { pa: boolean; monitors: boolean } {
  const full = (c?: { score: number; maxScore: number }) => !!c && c.maxScore > 0 && c.score >= c.maxScore;
  // Part 1 is built on the Standard stage and Part 2 is laid out on the Large one (older Part 2 plots are
  // Standard), so the PA zones count on whichever of the two the plot fits.
  const standard = evaluateStudioSetup('live_stage', p.placedGear, p.connections, p.mixerChannels, 'open_live', 'standard');
  const large = evaluateStudioSetup('live_stage', p.placedGear, p.connections, p.mixerChannels, 'open_live', 'large');
  return {
    pa: full(standard.categories.paSpeakerSetup) || full(large.categories.paSpeakerSetup),
    monitors: full(standard.categories.monitorSetup) || full(large.categories.monitorSetup),
  };
}

// ---------- Scored items, first try and "another pass" ----------

/** One thing the quiz checks. Its id is stable so a revised attempt can be matched to the first. */
export interface ScoredItem {
  id: string;
  label: string;
  /** Plain words for "what you missed" (shown only after the student chooses to see it). */
  missed: string;
  source?: SourceKind;
  ok: boolean;
}

export type Credit = 0 | 0.5 | 1;
export interface CombinedResult {
  items: Array<ScoredItem & { credit: Credit }>;
  earned: number;
  possible: number;
  percentage: number;
  revised: boolean;
}

const MISSED_CHECK: Record<CheckId, string> = {
  input: 'not the right mic or DI for it',
  cable: 'not cabled all the way to the snake',
  phantom: '48V set wrong (it should be on only for condensers)',
  stereo: 'a stereo source needs both sides (L and R) on two channels',
  channel: 'should be on its own channel, without doubling up',
};

export function planItems(r: PlanResult): ScoredItem[] {
  const items: ScoredItem[] = [];
  r.sources.forEach((s) => {
    (Object.entries(s.checks) as [CheckId, boolean][]).forEach(([id, ok]) =>
      items.push({
        id: `${s.key}:${id}`,
        label: `${s.label}: ${CHECK_LABELS[id]}`,
        missed: s.found ? `${s.label}: ${MISSED_CHECK[id]}` : `${s.label}: not on the stage`,
        source: s.key,
        ok,
      })
    );
  });
  items.push({ id: 'extra', label: 'No extra or dead channels', missed: 'A channel is patched to something that isn\'t part of the band, or has no signal', ok: r.extraChannelsOk });
  items.push({ id: 'pa', label: 'PA speakers on MAIN L/R', missed: 'The PA speakers (in both PA zones, on MAIN L and MAIN R) weren\'t set up', ok: r.pa });
  items.push({ id: 'monitors', label: 'Stage monitors on MON 1/2', missed: 'No stage monitors (wedge or IEM) on MON 1 or MON 2', ok: r.monitors });
  return items;
}

export function fixItems(r: FixResult): ScoredItem[] {
  return [
    ...r.errors.map((e) => {
      const where = e.source ? `${SOURCE_LABELS[e.source]}: ` : '';
      return {
        id: `${e.kind}:${e.source ?? 'mix'}`,
        label: `${where}${ERROR_LABELS[e.kind]}`,
        missed: `${where}${ERROR_LABELS[e.kind].toLowerCase()} (not fixed)`,
        source: e.source,
        ok: e.fixed,
      };
    }),
    { id: 'rest', label: 'Left everything else working', missed: 'Something that was working got broken while fixing', ok: r.restOk },
  ];
}

/** First try counts in full; anything fixed on the second pass earns half. */
export function combineAttempts(first: ScoredItem[], second?: ScoredItem[] | null): CombinedResult {
  const items = first.map((it) => {
    const later = second?.find((x) => x.id === it.id);
    const credit: Credit = it.ok ? 1 : later?.ok ? 0.5 : 0;
    return { ...it, ok: it.ok || !!later?.ok, credit };
  });
  const earned = items.reduce((n, i) => n + i.credit, 0);
  return { items, earned, possible: items.length, percentage: items.length ? Math.round((earned / items.length) * 100) : 0, revised: !!second };
}

export type SourceStatus = 'pass' | 'partial' | 'missed';
/** Green when every check got full credit, red when none got any, yellow in between. */
export function statusOf(items: Array<{ credit: Credit }>): SourceStatus {
  if (items.every((i) => i.credit === 1)) return 'pass';
  if (items.every((i) => i.credit === 0)) return 'missed';
  return 'partial';
}

// ---------- Part 2: a working setup, then broken ----------

const CH_COLORS: Record<CableType, string> = { xlr: '#d9a441', quarter_inch: '#8ec5d6', speaker: '#698859', breakout: '#c08a6a' };

const freshChannels = (): MixerChannelState[] =>
  Array.from({ length: 8 }, (_, i) => ({
    channelNumber: i + 1, assignedGearInstanceId: null, label: `CH ${i + 1}`, phantomPower: false,
    gain: 72, fader: 75, pan: 0, solo: false, muted: false, meterValue: 0,
  }));

class Builder {
  p: QuizPlot = {
    environment: 'live_stage',
    placedGear: [],
    connections: [],
    mixerChannels: freshChannels(),
    masterBus: { fader: 75, gain: 50, pan: 0, muted: false, dim: false, mono: false },
  };
  add(id: string, gearId: string, x: number, y: number, extra: Partial<PlacedGear> = {}) {
    this.p.placedGear.push({ instanceId: id, gearId, x, y, rotation: 0, ...extra });
    return id;
  }
  cable(from: string, to: string, type: CableType) {
    this.p.connections.push({ id: `quiz_cable_${this.p.connections.length}`, fromInstanceId: from, toInstanceId: to, cableType: type, color: CH_COLORS[type] });
  }
  patch(id: string, label: string, opts: { phantom?: boolean; gain?: number; pan?: number } = {}) {
    const free = this.p.mixerChannels.find((c) => !c.assignedGearInstanceId);
    if (!free) return;
    Object.assign(free, { assignedGearInstanceId: id, label, phantomPower: !!opts.phantom, gain: opts.gain ?? 72, pan: opts.pan ?? 0 });
    const g = this.p.placedGear.find((x) => x.instanceId === id);
    if (g && g.assignedChannel === undefined) g.assignedChannel = free.channelNumber;
  }
}

/** Mic stand heights so the plot looks finished. */
const STAND = { vocal: 'standing_vocal', amp: 'amp_low', seated: 'seated_instrument', kit: 'drum_overhead' } as const;

const isDrumSource = (gearId: string) => gearId.includes('drum') || gearId === 'gear_drum_kit';
const boxOf = (g: PlacedGear) => getGearBoxDimensions(g.gearId, !!g.latchedSourceInstanceId, g.customScale, g.customWidth, g.customHeight);

/**
 * Where the app puts a mic once it is assigned to a source: centered right under it (a drum mic overlaps the
 * front of the drum), several mics side by side. Part 2 uses the same spots so mics sit in front of their sources.
 */
export function micSpot(src: PlacedGear, n = 1, i = 0): { x: number; y: number } {
  const sd = boxOf(src);
  const onDrum = isDrumSource(src.gearId);
  const md = getGearBoxDimensions('mic_sm57', true, undefined, undefined, undefined, onDrum);
  const GAP = 8;
  const total = md.width * n + GAP * (n - 1);
  return {
    x: Math.round(src.x + (sd.width - total) / 2 + i * (md.width + GAP)),
    y: Math.round(onDrum ? src.y + sd.height * 0.85 : src.y + sd.height + 12),
  };
}

/** Room between a source and its DI / amp: wide enough that the cable shows on both sides of the "assigned" tag. */
const DEVICE_GAP = 90;

/** A DI box sits beside its source with clear room for the cable between them (so a missing cable is easy to see). */
export function diSpot(src: PlacedGear, i = 0): { x: number; y: number } {
  const sd = boxOf(src);
  return { x: Math.round(src.x + sd.width + DEVICE_GAP), y: Math.round(src.y + 4 + i * 80) };
}

/** Rough width each unit needs on the stage (instrument, its DI / amp / mics and the cable room). */
const UNIT_W: Record<UnitKind, number> = {
  vocal: 150, acoustic_guitar: 300, electric_guitar: 370, bass: 370, keys: 300, piano: 220, kit: 390, laptop: 300, dj_rig: 300,
};

/** A correct live setup for the scenario (the student never sees this one unbroken). Laid out for the Large stage. */
export function buildWorkingSetup(scenario: QuizScenario): QuizPlot {
  const rng = makeRng((scenario.seed ^ 0x5bd1e995) >>> 0);
  const b = new Builder();
  const world = getWorld('large');
  const at = (id: string) => b.p.placedGear.find((g) => g.instanceId === id)!;
  const n = scenario.units.length;
  // Few sources: one row. Four or more: two rows, so nothing crowds and every cable and box is easy to see.
  const perRow = n >= 4 ? Math.ceil(n / 2) : n;
  const rowY = n >= 4 ? [255, 485] : [330];
  const margin = 60;
  scenario.units.forEach((u, i) => {
    const row = Math.floor(i / perRow);
    const inRow = scenario.units.slice(row * perRow, (row + 1) * perRow).length;
    const slot = (world.width - margin * 2) / inRow;
    const x = Math.round(margin + slot * (i - row * perRow) + (slot - UNIT_W[u]) / 2);
    const y = rowY[row];
    const id = (s: string) => `quiz_${u}_${s}`;
    switch (u) {
      case 'vocal': {
        const lead = b.add(id('inst'), 'inst_voice', x, y, { label: 'Voice' });
        const condenser = rng.next() < 0.35;
        const m = b.add(id('mic'), condenser ? 'mic_c214' : 'mic_sm58', 0, 0, {
          latchedSourceInstanceId: lead, standHeight: STAND.vocal, hasPopFilter: condenser,
        });
        Object.assign(at(m), micSpot(at(lead)));
        b.patch(m, 'VOX', { phantom: condenser });
        break;
      }
      case 'acoustic_guitar': {
        const g = b.add(id('inst'), 'inst_acoustic_guitar', x, y, { label: 'Acoustic Guitar' });
        if (rng.next() < 0.5) {
          const di = b.add(id('di'), 'gear_di_box', 0, 0, { latchedSourceInstanceId: g });
          Object.assign(at(di), diSpot(at(g)));
          b.cable(g, di, 'quarter_inch');
          b.patch(di, 'A GUIT DI');
        } else {
          const m = b.add(id('mic'), 'mic_sm81', 0, 0, { latchedSourceInstanceId: g, standHeight: STAND.seated });
          Object.assign(at(m), micSpot(at(g)));
          b.patch(m, 'A GUIT', { phantom: true });
        }
        break;
      }
      case 'electric_guitar': {
        // The amp is on the left with its mic in front of it; the guitar stands beside it with the cable between
        const amp = b.add(id('amp'), 'gear_guitar_amp', x, y, { label: 'Guitar Amp' });
        const g = b.add(id('inst'), 'inst_electric_guitar', x + boxOf(at(amp)).width + DEVICE_GAP, y, { label: 'Electric Guitar' });
        b.cable(g, amp, 'quarter_inch');
        const m = b.add(id('mic'), 'mic_sm57', 0, 0, { latchedSourceInstanceId: amp, standHeight: STAND.amp });
        Object.assign(at(m), micSpot(at(amp)));
        b.patch(m, 'GTR AMP');
        break;
      }
      case 'bass': {
        const g = b.add(id('inst'), 'inst_bass_guitar', x, y, { label: 'Bass Guitar' });
        if (rng.next() < 0.6) {
          const di = b.add(id('di'), 'gear_di_box', 0, 0, { latchedSourceInstanceId: g });
          Object.assign(at(di), diSpot(at(g)));
          b.cable(g, di, 'quarter_inch');
          b.patch(di, 'BASS DI');
        } else {
          const amp = b.add(id('amp'), 'gear_bass_amp', 0, 0, { label: 'Bass Amp' });
          Object.assign(at(amp), diSpot(at(g)));
          b.cable(g, amp, 'quarter_inch');
          b.patch(amp, 'BASS AMP');
        }
        break;
      }
      case 'keys': {
        const k = b.add(id('inst'), 'inst_keyboard', x, y, { label: 'Keyboard' });
        const stereo = rng.next() < 0.5;
        const di = b.add(id('di'), stereo ? 'gear_di_stereo' : 'gear_di_box', 0, 0, { latchedSourceInstanceId: k });
        Object.assign(at(di), diSpot(at(k)));
        b.cable(k, di, 'quarter_inch');
        if (stereo) {
          b.patch(di, 'KEYS DI L', { pan: -50 });
          b.patch(di, 'KEYS DI R', { pan: 50 });
        } else {
          b.patch(di, 'KEYS DI');
        }
        break;
      }
      case 'piano': {
        // The gig names an Acoustic Piano, so Part 2 always mics one (a pair of condensers).
        rng.next(); // was a coin toss (acoustic or digital); kept so the rest of the seeded setup stays the same
        const pno = b.add(id('inst'), 'inst_acoustic_piano', x, y, { label: 'Acoustic Piano' });
        const m1 = b.add(id('mic_l'), 'mic_c214', 0, 0, { latchedSourceInstanceId: pno, standHeight: STAND.seated });
        const m2 = b.add(id('mic_r'), 'mic_c214', 0, 0, { latchedSourceInstanceId: pno, standHeight: STAND.seated });
        Object.assign(at(m1), micSpot(at(pno), 2, 0));
        Object.assign(at(m2), micSpot(at(pno), 2, 1));
        b.patch(m1, 'PIANO L', { phantom: true, pan: -50 });
        b.patch(m2, 'PIANO R', { phantom: true, pan: 50 });
        break;
      }
      case 'kit': {
        const hat = b.add(id('hihat'), 'inst_hi_hat', x, y, { label: 'Hi-Hats' });
        const snare = b.add(id('snare'), 'inst_snare_drum', x + 130, y, { label: 'Snare Drum' });
        const kick = b.add(id('kick'), 'inst_kick_drum', x + 260, y, { label: 'Kick Drum' });
        const mk = b.add(id('kick_mic'), 'mic_beta52a', 0, 0, { latchedSourceInstanceId: kick, standHeight: STAND.amp });
        const ms = b.add(id('snare_mic'), 'mic_sm57', 0, 0, { latchedSourceInstanceId: snare, standHeight: 'clipped' });
        const mh = b.add(id('hihat_mic'), 'mic_sm81', 0, 0, { latchedSourceInstanceId: hat, standHeight: STAND.kit });
        Object.assign(at(mk), micSpot(at(kick)));
        Object.assign(at(ms), micSpot(at(snare)));
        Object.assign(at(mh), micSpot(at(hat)));
        b.patch(mk, 'KICK');
        b.patch(ms, 'SNARE');
        b.patch(mh, 'HI-HAT', { phantom: true });
        break;
      }
      case 'laptop': {
        const lap = b.add(id('inst'), 'inst_computer', x, y, { label: 'Laptop / Phone' });
        if (rng.next() < 0.5) {
          const di = b.add(id('di'), 'gear_di_stereo', 0, 0, { latchedSourceInstanceId: lap });
          Object.assign(at(di), diSpot(at(lap)));
          b.cable(lap, di, 'breakout');
          b.patch(di, 'LAPTOP DI L', { pan: -50 });
          b.patch(di, 'LAPTOP DI R', { pan: 50 });
        } else {
          const l = b.add(id('di'), 'gear_di_box', 0, 0, { latchedSourceInstanceId: lap });
          const r = b.add(id('di2'), 'gear_di_box', 0, 0, { latchedSourceInstanceId: lap });
          Object.assign(at(l), diSpot(at(lap), 0));
          Object.assign(at(r), diSpot(at(lap), 1));
          b.cable(lap, l, 'breakout');
          b.cable(lap, r, 'breakout');
          b.patch(l, 'LAPTOP L', { pan: -50 });
          b.patch(r, 'LAPTOP R', { pan: 50 });
        }
        break;
      }
      case 'dj_rig': {
        const rig = b.add(id('inst'), 'inst_dj_rig', x, y, { label: 'DJ Rig' });
        if (rng.next() < 0.6) {
          b.patch(rig, 'DJ L', { gain: 54, pan: -50 });
          b.patch(rig, 'DJ R', { gain: 54, pan: 50 });
        } else {
          const di = b.add(id('di'), 'gear_di_stereo', 0, 0, { latchedSourceInstanceId: rig });
          Object.assign(at(di), diSpot(at(rig)));
          b.cable(rig, di, 'quarter_inch');
          b.patch(di, 'DJ DI L', { pan: -50 });
          b.patch(di, 'DJ DI R', { pan: 50 });
        }
        break;
      }
    }
  });
  // Front of house and a wedge, so it is a whole gig
  const zones = getPaZones('large');
  b.add('quiz_pa_l', 'gear_pa_speaker', zones.left.x + 70, zones.left.y + 60);
  b.add('quiz_pa_r', 'gear_pa_speaker', zones.right.x + 70, zones.right.y + 60);
  b.cable('snake_out_main_l', 'quiz_pa_l', 'xlr');
  b.cable('snake_out_main_r', 'quiz_pa_r', 'xlr');
  b.add('quiz_wedge', 'gear_stage_monitor', Math.round(world.width / 2 - 62), 730);
  b.cable('snake_out_mon1', 'quiz_wedge', 'xlr');
  return b.p;
}

export type ErrorKind =
  | 'muted' | 'solo_other' | 'gain_zero' | 'fader_down' | 'phantom_off' | 'pan_hard' | 'main_down'
  | 'dj_gain_high' | 'wrong_di' | 'unpatched' | 'wrong_mic' | 'no_mic' | 'mic_on_instrument' | 'missing_di'
  | 'unplugged' | 'pa_unplugged' | 'monitor_unplugged';

/** Faults that live on the mixer. Part 2 uses one (or two of four), never the majority; the rest are on the plot. */
export const MIXER_FAULTS: ErrorKind[] = ['muted', 'solo_other', 'gain_zero', 'fader_down', 'phantom_off', 'pan_hard', 'main_down', 'dj_gain_high'];

export interface InjectedError {
  kind: ErrorKind;
  source?: SourceKind; // missing for the whole-mix errors
}

export const ERROR_LABELS: Record<ErrorKind, string> = {
  muted: 'Channel muted',
  solo_other: 'Another channel soloed (the rest went silent)',
  gain_zero: 'Gain turned all the way down',
  fader_down: 'Channel fader pulled down',
  phantom_off: '48V off on a condenser',
  pan_hard: 'Mono source panned hard to one side',
  main_down: 'Main level down',
  dj_gain_high: 'DJ Rig gain far too high (line level)',
  wrong_di: 'Stereo source only half connected (one side into one mono DI)',
  unpatched: 'Not patched to the snake',
  wrong_mic: 'Completely wrong mic',
  no_mic: 'No mic on the source',
  mic_on_instrument: 'Mic placed on an electric instrument',
  missing_di: 'Needs a DI but has none',
  unplugged: 'Instrument cable unplugged',
  pa_unplugged: 'A PA speaker unplugged from MAIN',
  monitor_unplugged: 'Stage monitor unplugged from MON',
};

/** The gear in the working setup that feeds this source. */
const feedIds = (p: QuizPlot, u: UnitKind, key: SourceKind) => {
  const pre = u === 'kit' ? `quiz_kit_${key}_mic` : `quiz_${u}_`;
  return p.placedGear
    .filter((g) => (u === 'kit' ? g.instanceId === pre : g.instanceId.startsWith(pre) && !g.instanceId.endsWith('_inst') && !g.instanceId.endsWith('_amp')))
    .map((g) => g.instanceId)
    .concat(u !== 'kit' && p.mixerChannels.some((c) => c.assignedGearInstanceId === `quiz_${u}_inst`) ? [`quiz_${u}_inst`] : [])
    .concat(u === 'bass' && p.mixerChannels.some((c) => c.assignedGearInstanceId === 'quiz_bass_amp') ? ['quiz_bass_amp'] : []);
};

const unitOf = (key: SourceKind): UnitKind => (key === 'kick' || key === 'snare' || key === 'hihat' ? 'kit' : key);
const chansFor = (p: QuizPlot, ids: string[]) => p.mixerChannels.filter((c) => c.assignedGearInstanceId && ids.includes(c.assignedGearInstanceId));

function removeGear(p: QuizPlot, ids: string[]) {
  const gone = new Set(ids);
  p.placedGear = p.placedGear.filter((g) => !gone.has(g.instanceId));
  p.connections = p.connections.filter((c) => !gone.has(c.fromInstanceId) && !gone.has(c.toInstanceId));
  p.mixerChannels = p.mixerChannels.map((c) =>
    c.assignedGearInstanceId && gone.has(c.assignedGearInstanceId)
      ? { ...c, assignedGearInstanceId: null, label: `CH ${c.channelNumber}`, phantomPower: false, pan: 0 }
      : c
  );
}

/** Which errors make sense for this working setup. */
function candidates(p: QuizPlot, scenario: QuizScenario): InjectedError[] {
  const out: InjectedError[] = [{ kind: 'main_down' }, { kind: 'solo_other' }, { kind: 'pa_unplugged' }, { kind: 'monitor_unplugged' }];
  scenario.sources.forEach((s) => {
    const u = unitOf(s.key);
    const ids = feedIds(p, u, s.key);
    const chs = chansFor(p, ids);
    const gear = ids.map((id) => p.placedGear.find((g) => g.instanceId === id)!).filter(Boolean);
    const hasMic = gear.some(isMic);
    const stereo = chs.length === 2;
    out.push({ kind: 'muted', source: s.key }, { kind: 'gain_zero', source: s.key }, { kind: 'fader_down', source: s.key }, { kind: 'unpatched', source: s.key });
    if (!stereo) out.push({ kind: 'pan_hard', source: s.key });
    if (gear.some(needs48)) out.push({ kind: 'phantom_off', source: s.key });
    if (hasMic && s.key !== 'piano') out.push({ kind: 'wrong_mic', source: s.key }, { kind: 'no_mic', source: s.key });
    const inst = p.placedGear.find((g) => g.instanceId === (u === 'kit' ? `quiz_kit_${s.key}` : `quiz_${u}_inst`));
    if (inst && p.connections.some((c) => (c.cableType === 'quarter_inch' || c.cableType === 'breakout') && touches(c, inst.instanceId))) {
      out.push({ kind: 'unplugged', source: s.key });
    }
    if (s.key === 'electric_guitar') out.push({ kind: 'mic_on_instrument', source: s.key });
    if (s.key === 'keys') out.push({ kind: 'mic_on_instrument', source: s.key }, { kind: 'missing_di', source: s.key });
    if ((s.key === 'bass' || s.key === 'acoustic_guitar') && gear.some((g) => isDiBoxId(g.gearId))) out.push({ kind: 'missing_di', source: s.key });
    if (s.key === 'laptop') out.push({ kind: 'wrong_di', source: s.key });
    if (s.key === 'dj_rig') {
      out.push({ kind: 'wrong_di', source: s.key });
      if (gear.some((g) => g.gearId === 'inst_dj_rig')) out.push({ kind: 'dj_gain_high', source: s.key });
    }
  });
  return out;
}

const WRONG_MIC: Partial<Record<SourceKind, string>> = {
  vocal: 'mic_beta52a', acoustic_guitar: 'mic_beta52a', electric_guitar: 'mic_beta52a',
  bass: 'mic_sm81', kick: 'mic_sm81', snare: 'mic_beta52a', hihat: 'mic_beta52a',
};

function inject(p: QuizPlot, e: InjectedError, scenario: QuizScenario) {
  const key = e.source;
  const u = key ? unitOf(key) : undefined;
  const ids = key && u ? feedIds(p, u, key) : [];
  const chs = chansFor(p, ids);
  const inst = key && u ? p.placedGear.find((g) => g.instanceId === (u === 'kit' ? `quiz_kit_${key}` : `quiz_${u}_inst`)) : undefined;
  switch (e.kind) {
    case 'main_down':
      p.masterBus = { ...p.masterBus, fader: 8 };
      break;
    case 'pa_unplugged':
      p.connections = p.connections.filter((c) => !(touches(c, 'snake_out_main_r') && touches(c, 'quiz_pa_r')));
      break;
    case 'monitor_unplugged':
      p.connections = p.connections.filter((c) => !touches(c, 'snake_out_mon1'));
      break;
    case 'unplugged':
      if (inst) p.connections = p.connections.filter((c) => !((c.cableType === 'quarter_inch' || c.cableType === 'breakout') && touches(c, inst.instanceId)));
      break;
    case 'solo_other': {
      const ch = p.mixerChannels.find((c) => c.assignedGearInstanceId);
      if (ch) ch.solo = true;
      break;
    }
    case 'muted':
      chs.forEach((c) => (c.muted = true));
      break;
    case 'gain_zero':
      chs.forEach((c) => (c.gain = 0));
      break;
    case 'fader_down':
      chs.forEach((c) => (c.fader = 3));
      break;
    case 'pan_hard':
      chs.forEach((c) => (c.pan = 50));
      break;
    case 'phantom_off':
      chs.forEach((c) => (c.phantomPower = false));
      break;
    case 'dj_gain_high':
      chs.forEach((c) => (c.gain = 100));
      break;
    case 'unpatched':
      chs.forEach((c) => Object.assign(c, { assignedGearInstanceId: null, label: `CH ${c.channelNumber}`, phantomPower: false, pan: 0 }));
      ids.forEach((id) => {
        const g = p.placedGear.find((x) => x.instanceId === id);
        if (g) g.assignedChannel = undefined;
      });
      break;
    case 'wrong_mic': {
      const mic = p.placedGear.find((g) => ids.includes(g.instanceId) && isMic(g));
      if (mic && key) {
        mic.gearId = WRONG_MIC[key] ?? 'mic_beta52a';
        mic.hasPopFilter = false;
      }
      break;
    }
    case 'no_mic':
      removeGear(p, ids.filter((id) => p.placedGear.find((g) => g.instanceId === id && isMic(g))));
      break;
    case 'missing_di':
      removeGear(p, ids.filter((id) => isDiBoxId(p.placedGear.find((g) => g.instanceId === id)?.gearId)));
      break;
    case 'mic_on_instrument': {
      if (!inst) break;
      if (key === 'electric_guitar') {
        const mic = p.placedGear.find((g) => ids.includes(g.instanceId) && isMic(g));
        if (mic) Object.assign(mic, { latchedSourceInstanceId: inst.instanceId, ...micSpot(inst), standHeight: 'seated_instrument' });
      } else {
        // Keys: the DI is gone and a mic points at the keyboard instead
        const firstCh = chs[0]?.channelNumber;
        removeGear(p, ids);
        const micId = `quiz_${u}_wrongmic`;
        p.placedGear.push({ instanceId: micId, gearId: 'mic_sm57', ...micSpot(inst), rotation: 0, latchedSourceInstanceId: inst.instanceId, standHeight: 'seated_instrument', assignedChannel: firstCh });
        const ch = p.mixerChannels.find((c) => c.channelNumber === firstCh);
        if (ch) Object.assign(ch, { assignedGearInstanceId: micId, label: 'KEYS' });
      }
      break;
    }
    case 'wrong_di': {
      if (!inst) break;
      const firstCh = chs[0]?.channelNumber;
      removeGear(p, ids.filter((id) => id !== inst.instanceId));
      p.mixerChannels.forEach((c) => {
        if (c.assignedGearInstanceId === inst.instanceId) Object.assign(c, { assignedGearInstanceId: null, label: `CH ${c.channelNumber}`, pan: 0, gain: 72 });
      });
      inst.assignedChannel = undefined;
      const diId = `quiz_${u}_monodi`;
      p.placedGear.push({ instanceId: diId, gearId: 'gear_di_box', ...diSpot(inst), rotation: 0, latchedSourceInstanceId: inst.instanceId, assignedChannel: firstCh });
      const link: CableType = key === 'laptop' ? 'breakout' : 'quarter_inch';
      p.connections.push({ id: `quiz_cable_${p.connections.length}_wd`, fromInstanceId: inst.instanceId, toInstanceId: diId, cableType: link, color: CH_COLORS[link] });
      const ch = p.mixerChannels.find((c) => c.channelNumber === firstCh);
      if (ch) Object.assign(ch, { assignedGearInstanceId: diId, label: key === 'laptop' ? 'LAPTOP DI' : 'DJ DI', pan: 0 });
      break;
    }
  }
  void scenario;
}

export interface FixScenario {
  working: QuizPlot;
  broken: QuizPlot;
  errors: InjectedError[];
}

/** Part 2: same band, set up by "someone else", with 3 or 4 problems. Seeded, so it rebuilds exactly. */
export function buildFixScenario(scenario: QuizScenario): FixScenario {
  const working = buildWorkingSetup(scenario);
  const rng = makeRng((scenario.seed ^ 0x2c1b3c6d) >>> 0);
  const want = rng.next() < 0.5 ? 3 : 4;
  const pool = rng.shuffle(candidates(working, scenario));
  const errors: InjectedError[] = [];
  const usedSources = new Set<string>();
  const isMixer = (e: InjectedError) => MIXER_FAULTS.includes(e.kind);
  const take = (e: InjectedError) => {
    const slot = e.source ?? `global:${e.kind}`;
    if (usedSources.has(slot)) return false;
    // At most one whole-stage fault on the plot and one on the mixer
    if (!e.source && errors.some((x) => !x.source && isMixer(x) === isMixer(e))) return false;
    // Not every fault on the same kind of problem
    if (errors.some((x) => x.kind === e.kind)) return false;
    errors.push(e);
    usedSources.add(slot);
    return true;
  };
  // Mostly plot problems (the app's main job): one on the mixer, or two when there are four
  const mixerWant = want === 4 && rng.next() < 0.5 ? 2 : 1;
  for (const e of pool.filter(isMixer)) {
    if (errors.length >= mixerWant) break;
    take(e);
  }
  for (const e of pool.filter((x) => !isMixer(x))) {
    if (errors.length >= want) break;
    take(e);
  }
  for (const e of pool.filter(isMixer)) {
    if (errors.length >= want) break; // only if the plot ran out of distinct faults
    take(e);
  }
  const broken: QuizPlot = JSON.parse(JSON.stringify(working));
  // Structural faults first, then mixer settings
  const structural: ErrorKind[] = ['no_mic', 'missing_di', 'mic_on_instrument', 'wrong_di', 'wrong_mic', 'unpatched', 'unplugged', 'pa_unplugged', 'monitor_unplugged'];
  [...errors]
    .sort((a, b) => Number(structural.includes(b.kind)) - Number(structural.includes(a.kind)))
    .forEach((e) => inject(broken, e, scenario));
  return { working, broken, errors };
}

// ---------- Part 2 scoring ----------

export interface FixResult {
  errors: Array<InjectedError & { fixed: boolean }>;
  restOk: boolean;
  earned: number;
  possible: number;
  percentage: number;
}

const GAIN_MIN = 30;
const FADER_MIN = 45;
const PAN_MAX = 25;
const DJ_GAIN_MAX = 64;

function mixOk(p: QuizPlot, r: SourceResult, key: SourceKind, matched: PlacedGear | undefined): Record<string, boolean> {
  const chs = p.mixerChannels.filter((c) => r.channels.includes(c.channelNumber));
  const direct = !!matched && matched.gearId === 'inst_dj_rig' && chs.some((c) => c.assignedGearInstanceId === matched.instanceId);
  return {
    unmuted: chs.length > 0 && chs.every((c) => !c.muted),
    gain: chs.length > 0 && chs.every((c) => c.gain >= GAIN_MIN),
    fader: chs.length > 0 && chs.every((c) => c.fader >= FADER_MIN),
    pan: chs.length !== 1 || Math.abs(chs[0].pan) <= PAN_MAX,
    djGain: key !== 'dj_rig' || !direct || chs.every((c) => c.gain <= DJ_GAIN_MAX),
  };
}

export function evaluateFix(p: QuizPlot, scenario: QuizScenario, errors: InjectedError[]): FixResult {
  const plan = evaluatePlan(p, scenario);
  const matched = matchInstruments(p, scenario.sources);
  const bySource = new Map(plan.sources.map((r) => [r.key, r]));
  const noSolo = !p.mixerChannels.some((c) => c.solo);
  const mainOk = p.masterBus.fader >= 55 && !p.masterBus.muted;

  const fixedOne = (e: InjectedError): boolean => {
    if (e.kind === 'main_down') return mainOk;
    if (e.kind === 'solo_other') return noSolo;
    if (e.kind === 'pa_unplugged') return plan.pa;
    if (e.kind === 'monitor_unplugged') return plan.monitors;
    const r = e.source ? bySource.get(e.source) : undefined;
    if (!r || !e.source) return false;
    const mix = mixOk(p, r, e.source, matched.get(e.source));
    switch (e.kind) {
      case 'muted': return mix.unmuted;
      case 'gain_zero': return mix.gain;
      case 'fader_down': return mix.fader;
      case 'pan_hard': return mix.pan;
      case 'phantom_off': return !!r.checks.phantom && !!r.checks.cable;
      case 'dj_gain_high': return mix.djGain && mix.gain;
      case 'unpatched': return !!r.checks.cable && !!r.checks.channel;
      default: return r.passed; // wrong_mic, no_mic, mic_on_instrument, missing_di, wrong_di
    }
  };

  const results = errors.map((e) => ({ ...e, fixed: fixedOne(e) }));
  const broken = new Set(errors.map((e) => e.source).filter(Boolean));
  const globalBroken = new Set(errors.filter((e) => !e.source).map((e) => e.kind));
  // Everything that was not broken still works (students should not break the rest while fixing)
  const restOk =
    plan.sources
      .filter((r) => !broken.has(r.key))
      .every((r) => {
        const m = mixOk(p, r, r.key, matched.get(r.key));
        return r.passed && m.unmuted && m.gain && m.fader && m.pan && m.djGain;
      }) &&
    (globalBroken.has('solo_other') || noSolo) &&
    (globalBroken.has('main_down') || mainOk) &&
    (globalBroken.has('pa_unplugged') || plan.pa) &&
    (globalBroken.has('monitor_unplugged') || plan.monitors);
  const earned = results.filter((r) => r.fixed).length + (restOk ? 1 : 0);
  const possible = results.length + 1;
  return { errors: results, restOk, earned, possible, percentage: Math.round((earned / possible) * 100) };
}

// ---------- Part 3 ----------

/** Which source the "Why did you choose…" question asks about (seeded). */
export function explainSource(scenario: QuizScenario): QuizSource {
  const rng = makeRng((scenario.seed ^ 0x7f4a7c15) >>> 0);
  return rng.pick(scenario.sources);
}

export function explainQuestion(s: QuizSource): string {
  if (s.key === 'dj_rig' || s.key === 'laptop') return `Why did you connect the ${s.label} the way you did?`;
  return `Why did you choose this mic or DI for the ${s.label}?`;
}

export const FIX_QUESTION = 'Explain one fix you made in Part 2.';

// ---------- Weights and the record kept in the code ----------

export const QUIZ_WEIGHTS = { plan: 50, fix: 30, explain: 20 };

/**
 * plan -> plan_done (score shown; choose another pass or see what was missed) -> plan_revise -> plan_final
 * fix  -> fix_done  (same choice)                                           -> fix_revise  -> fix_final
 */
export type QuizPhase =
  | 'intro' | 'plan' | 'plan_done' | 'plan_revise' | 'plan_final'
  | 'fix' | 'fix_done' | 'fix_revise' | 'fix_final' | 'explain' | 'done';

/** Saved in the student's code under `qz`. Short keys; never reuse one. */
export interface QuizRecord {
  v: number; // 1 = first draw, 2 = vocals in at least 75% (see buildScenario)
  sd: number; // seed
  tp?: string; // template id
  ph: QuizPhase;
  p1?: Record<string, unknown>; // packed Part 1 plot, frozen at submit
  p2?: Record<string, unknown>; // packed Part 2 plot, frozen at submit
  p1r?: Record<string, unknown>; // Part 1 after "another pass" (fixes earn half)
  p2r?: Record<string, unknown>; // Part 2 after "another pass"
  st?: number; // when Part 1 started (ms since 1970)
  fn?: number; // when the quiz was finished (ms since 1970)
  lc?: string[]; // Part 2 line check: sources the student ticked as heard on the mixer (not graded)
  w1?: string; // Part 3: why this mic / DI
  w2?: string; // Part 3: one fix explained
}

export function scenarioFromRecord(r: QuizRecord): QuizScenario {
  return buildScenario(r.sd, r.tp, r.v ?? 1);
}

// ---------- The hidden link ----------

/** Quiz Mode lives at /quiz (nothing in the app links to it). /quiz?t=<template> picks a named gig. */
export function readQuizLink(): { template: string | null } | null {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  if (path !== '/quiz') return null;
  const t = new URLSearchParams(window.location.search).get('t');
  return { template: t && QUIZ_TEMPLATES.some((x) => x.id === t) ? t : null };
}
