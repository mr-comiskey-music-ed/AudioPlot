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
import { validateChannelSignalChain } from '../services/gradingEngine';
import { getPaZones } from '../components/canvas/stageGeometry';

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
export type UnitKind = 'vocal' | 'acoustic_guitar' | 'electric_guitar' | 'bass' | 'keys' | 'piano' | 'kit' | 'dj_rig';
/** One source the student has to get into the mixer. */
export type SourceKind = Exclude<UnitKind, 'kit'> | 'kick' | 'snare' | 'hihat';

export interface QuizSource {
  key: SourceKind;
  label: string;
}

const POOL: UnitKind[] = ['vocal', 'acoustic_guitar', 'electric_guitar', 'bass', 'keys', 'piano', 'kit', 'dj_rig'];

export const SOURCE_LABELS: Record<SourceKind, string> = {
  vocal: 'Lead vocal',
  acoustic_guitar: 'Acoustic guitar',
  electric_guitar: 'Electric guitar',
  bass: 'Bass guitar',
  keys: 'Keys (stage piano / synth)',
  piano: 'Piano',
  kick: 'Kick drum',
  snare: 'Snare drum',
  hihat: 'Hi-hat',
  dj_rig: 'DJ Rig',
};

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
}

/** Named gigs, chosen by the teacher with /quiz?t=<id>. Never rename an id. */
export const QUIZ_TEMPLATES: QuizTemplate[] = [
  { id: 'wedding', title: 'Wedding reception', blurb: 'A DJ spins between sets from a live drummer and a singer.', units: ['dj_rig', 'kit', 'vocal'] },
  { id: 'coffeehouse', title: 'Coffeehouse night', blurb: 'A quiet acoustic set in a small room.', units: ['vocal', 'acoustic_guitar', 'keys', 'bass'] },
  { id: 'rock', title: 'Rock trio', blurb: 'Loud and simple: drums, guitar, bass.', units: ['kit', 'electric_guitar', 'bass'] },
  { id: 'worship', title: 'Sunday service band', blurb: 'A singer leads a full band.', units: ['vocal', 'acoustic_guitar', 'piano', 'bass', 'electric_guitar'] },
  { id: 'jazz', title: 'Jazz trio', blurb: 'Piano, bass and a small kit in a lounge.', units: ['piano', 'bass', 'kit'] },
  { id: 'school-dance', title: 'School dance', blurb: 'A DJ plus a singer and keys for the live set.', units: ['dj_rig', 'vocal', 'keys', 'electric_guitar'] },
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
export function buildScenario(seed: number, templateId?: string | null): QuizScenario {
  const tpl = templateId ? QUIZ_TEMPLATES.find((t) => t.id === templateId) : undefined;
  if (tpl) {
    return { seed, template: tpl.id, title: tpl.title, blurb: tpl.blurb, units: tpl.units, sources: expand(tpl.units) };
  }
  const rng = makeRng(seed);
  const target = rng.next() < 0.5 ? 4 : 5;
  const picked: UnitKind[] = [];
  let count = 0;
  for (const u of rng.shuffle(POOL)) {
    if (count + units(u) > target) continue;
    picked.push(u);
    count += units(u);
    if (count === target) break;
  }
  const order = POOL.filter((u) => picked.includes(u));
  return {
    seed,
    title: 'Tonight\'s gig',
    blurb: `A ${count}-source band on a live stage.`,
    units: order,
    sources: expand(order),
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
  const electric = ['inst_electric_guitar', 'inst_bass_guitar', 'inst_keyboard', 'inst_dj_rig'].includes(inst.gearId);
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
  }
}

/** Most channels a source should use before it counts as doubled up. */
const MAX_CHANNELS: Record<SourceKind, number> = {
  vocal: 1, kick: 1, snare: 1, hihat: 1, electric_guitar: 1,
  acoustic_guitar: 2, bass: 2, keys: 2, piano: 2, dj_rig: 2,
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
  const stereoApplies = s.key === 'dj_rig' || s.key === 'keys' || (s.key === 'piano' && inst?.gearId === 'inst_keyboard');
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
    if (s.key === 'dj_rig') checks.stereo = chans.length >= 2;
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
  let earned = extraChannelsOk ? 1 : 0;
  let possible = 1;
  sources.forEach((r) => {
    Object.values(r.checks).forEach((ok) => {
      possible += 1;
      if (ok) earned += 1;
    });
  });
  return { sources, extraChannelsOk, earned, possible, percentage: Math.round((earned / possible) * 100) };
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

/** A correct live setup for the scenario (the student never sees this one unbroken). */
export function buildWorkingSetup(scenario: QuizScenario): QuizPlot {
  const rng = makeRng((scenario.seed ^ 0x5bd1e995) >>> 0);
  const b = new Builder();
  const slots = scenario.units.length;
  const left = 70;
  const span = 980 - left;
  scenario.units.forEach((u, i) => {
    const x = Math.round(left + (span * (i + 0.5)) / slots - 40);
    const y = 360;
    const id = (s: string) => `quiz_${u}_${s}`;
    switch (u) {
      case 'vocal': {
        const lead = b.add(id('inst'), 'inst_voice', x, y + 20, { label: 'Singer' });
        const condenser = rng.next() < 0.35;
        const m = b.add(id('mic'), condenser ? 'mic_c214' : 'mic_sm58', x + 70, y + 10, {
          latchedSourceInstanceId: lead, standHeight: STAND.vocal, hasPopFilter: condenser,
        });
        b.patch(m, 'VOX', { phantom: condenser });
        break;
      }
      case 'acoustic_guitar': {
        const g = b.add(id('inst'), 'inst_acoustic_guitar', x, y, { label: 'Acoustic Guitar' });
        if (rng.next() < 0.5) {
          const di = b.add(id('di'), 'gear_di_box', x + 80, y + 10, { latchedSourceInstanceId: g });
          b.cable(g, di, 'quarter_inch');
          b.patch(di, 'A GUIT DI');
        } else {
          const m = b.add(id('mic'), 'mic_sm81', x + 70, y - 20, { latchedSourceInstanceId: g, standHeight: STAND.seated });
          b.patch(m, 'A GUIT', { phantom: true });
        }
        break;
      }
      case 'electric_guitar': {
        const g = b.add(id('inst'), 'inst_electric_guitar', x, y + 40, { label: 'Electric Guitar' });
        const amp = b.add(id('amp'), 'gear_guitar_amp', x, y - 110, { label: 'Guitar Amp' });
        b.cable(g, amp, 'quarter_inch');
        const m = b.add(id('mic'), 'mic_sm57', x + 80, y - 110, { latchedSourceInstanceId: amp, standHeight: STAND.amp });
        b.patch(m, 'GTR AMP');
        break;
      }
      case 'bass': {
        const g = b.add(id('inst'), 'inst_bass_guitar', x, y + 40, { label: 'Bass Guitar' });
        if (rng.next() < 0.6) {
          const di = b.add(id('di'), 'gear_di_box', x + 80, y + 50, { latchedSourceInstanceId: g });
          b.cable(g, di, 'quarter_inch');
          b.patch(di, 'BASS DI');
        } else {
          const amp = b.add(id('amp'), 'gear_bass_amp', x, y - 110, { label: 'Bass Amp' });
          b.cable(g, amp, 'quarter_inch');
          b.patch(amp, 'BASS AMP');
        }
        break;
      }
      case 'keys': {
        const k = b.add(id('inst'), 'inst_keyboard', x, y, { label: 'Keys' });
        if (rng.next() < 0.5) {
          const di = b.add(id('di'), 'gear_di_stereo', x + 85, y + 10, { latchedSourceInstanceId: k });
          b.cable(k, di, 'quarter_inch');
          b.patch(di, 'KEYS DI L', { pan: -50 });
          b.patch(di, 'KEYS DI R', { pan: 50 });
        } else {
          const di = b.add(id('di'), 'gear_di_box', x + 85, y + 10, { latchedSourceInstanceId: k });
          b.cable(k, di, 'quarter_inch');
          b.patch(di, 'KEYS DI');
        }
        break;
      }
      case 'piano': {
        if (rng.next() < 0.5) {
          const pno = b.add(id('inst'), 'inst_acoustic_piano', x, y - 20, { label: 'Piano' });
          const m1 = b.add(id('mic_l'), 'mic_c214', x - 10, y - 110, { latchedSourceInstanceId: pno, standHeight: STAND.seated });
          const m2 = b.add(id('mic_r'), 'mic_c214', x + 70, y - 110, { latchedSourceInstanceId: pno, standHeight: STAND.seated });
          b.patch(m1, 'PIANO L', { phantom: true, pan: -50 });
          b.patch(m2, 'PIANO R', { phantom: true, pan: 50 });
        } else {
          const k = b.add(id('inst'), 'inst_keyboard', x, y, { label: 'Digital Piano' });
          const di = b.add(id('di'), 'gear_di_stereo', x + 85, y + 10, { latchedSourceInstanceId: k });
          b.cable(k, di, 'quarter_inch');
          b.patch(di, 'PIANO DI L', { pan: -50 });
          b.patch(di, 'PIANO DI R', { pan: 50 });
        }
        break;
      }
      case 'kit': {
        const kick = b.add(id('kick'), 'inst_kick_drum', x + 20, y - 60, { label: 'Kick Drum' });
        const snare = b.add(id('snare'), 'inst_snare_drum', x - 50, y + 10, { label: 'Snare Drum' });
        const hat = b.add(id('hihat'), 'inst_hi_hat', x - 120, y - 40, { label: 'Hi-Hat' });
        const mk = b.add(id('kick_mic'), 'mic_beta52a', x + 30, y + 30, { latchedSourceInstanceId: kick, standHeight: STAND.amp });
        const ms = b.add(id('snare_mic'), 'mic_sm57', x - 30, y + 80, { latchedSourceInstanceId: snare, standHeight: 'clipped' });
        const mh = b.add(id('hihat_mic'), 'mic_sm81', x - 130, y + 30, { latchedSourceInstanceId: hat, standHeight: STAND.kit });
        b.patch(mk, 'KICK');
        b.patch(ms, 'SNARE');
        b.patch(mh, 'HI-HAT', { phantom: true });
        break;
      }
      case 'dj_rig': {
        const rig = b.add(id('inst'), 'inst_dj_rig', x, y, { label: 'DJ Rig' });
        if (rng.next() < 0.6) {
          b.patch(rig, 'DJ L', { gain: 54, pan: -50 });
          b.patch(rig, 'DJ R', { gain: 54, pan: 50 });
        } else {
          const di = b.add(id('di'), 'gear_di_stereo', x + 90, y + 10, { latchedSourceInstanceId: rig });
          b.cable(rig, di, 'breakout');
          b.patch(di, 'DJ DI L', { pan: -50 });
          b.patch(di, 'DJ DI R', { pan: 50 });
        }
        break;
      }
    }
  });
  // Front of house and a wedge, so it is a whole gig
  const zones = getPaZones('standard');
  b.add('quiz_pa_l', 'gear_pa_speaker', zones.left.x + 70, zones.left.y + 60);
  b.add('quiz_pa_r', 'gear_pa_speaker', zones.right.x + 70, zones.right.y + 60);
  b.cable('snake_out_main_l', 'quiz_pa_l', 'xlr');
  b.cable('snake_out_main_r', 'quiz_pa_r', 'xlr');
  b.add('quiz_wedge', 'gear_stage_monitor', 520, 560);
  b.cable('snake_out_mon1', 'quiz_wedge', 'xlr');
  return b.p;
}

export type ErrorKind =
  | 'muted' | 'solo_other' | 'gain_zero' | 'fader_down' | 'phantom_off' | 'pan_hard' | 'main_down'
  | 'dj_gain_high' | 'wrong_di' | 'unpatched' | 'wrong_mic' | 'no_mic' | 'mic_on_instrument' | 'missing_di';

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
  wrong_di: 'Wrong DI: stereo DJ Rig through a mono DI',
  unpatched: 'Not patched to the snake',
  wrong_mic: 'Completely wrong mic',
  no_mic: 'No mic on the source',
  mic_on_instrument: 'Mic placed on an electric instrument',
  missing_di: 'Needs a DI but has none',
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
  const out: InjectedError[] = [{ kind: 'main_down' }, { kind: 'solo_other' }];
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
    if (s.key === 'electric_guitar') out.push({ kind: 'mic_on_instrument', source: s.key });
    if (s.key === 'keys') out.push({ kind: 'mic_on_instrument', source: s.key }, { kind: 'missing_di', source: s.key });
    if ((s.key === 'bass' || s.key === 'acoustic_guitar') && gear.some((g) => isDiBoxId(g.gearId))) out.push({ kind: 'missing_di', source: s.key });
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
        if (mic) Object.assign(mic, { latchedSourceInstanceId: inst.instanceId, x: inst.x + 80, y: inst.y, standHeight: 'seated_instrument' });
      } else {
        // Keys: the DI is gone and a mic points at the keyboard instead
        const firstCh = chs[0]?.channelNumber;
        removeGear(p, ids);
        const micId = `quiz_${u}_wrongmic`;
        p.placedGear.push({ instanceId: micId, gearId: 'mic_sm57', x: inst.x + 85, y: inst.y, rotation: 0, latchedSourceInstanceId: inst.instanceId, standHeight: 'seated_instrument', assignedChannel: firstCh });
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
      p.placedGear.push({ instanceId: diId, gearId: 'gear_di_box', x: inst.x + 90, y: inst.y + 10, rotation: 0, latchedSourceInstanceId: inst.instanceId, assignedChannel: firstCh });
      p.connections.push({ id: `quiz_cable_${p.connections.length}_wd`, fromInstanceId: inst.instanceId, toInstanceId: diId, cableType: 'breakout', color: CH_COLORS.breakout });
      const ch = p.mixerChannels.find((c) => c.channelNumber === firstCh);
      if (ch) Object.assign(ch, { assignedGearInstanceId: diId, label: 'DJ DI', pan: 0 });
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
  for (const e of pool) {
    if (errors.length >= want) break;
    const slot = e.source ?? `global:${e.kind}`;
    if (usedSources.has(slot)) continue;
    // Only one whole-mix error, so the other faults can still be heard and found
    if (!e.source && errors.some((x) => !x.source)) continue;
    // Not every fault on the same kind of problem
    if (errors.filter((x) => x.kind === e.kind).length >= 1) continue;
    errors.push(e);
    usedSources.add(slot);
  }
  const broken: QuizPlot = JSON.parse(JSON.stringify(working));
  // Structural faults first, then mixer settings
  const structural: ErrorKind[] = ['no_mic', 'missing_di', 'mic_on_instrument', 'wrong_di', 'wrong_mic', 'unpatched'];
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
    (globalBroken.has('main_down') || mainOk);
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

/** "Lead vocal" -> "lead vocal", but "DJ Rig" keeps its capitals. */
const inSentence = (label: string) => (/^[A-Z][a-z]/.test(label) ? label[0].toLowerCase() + label.slice(1) : label);

export function explainQuestion(s: QuizSource): string {
  if (s.key === 'dj_rig') return 'Why did you connect the DJ Rig the way you did?';
  return `Why did you choose this mic or DI for the ${inSentence(s.label)}?`;
}

export const FIX_QUESTION = 'Explain one fix you made in Part 2.';

// ---------- Weights and the record kept in the code ----------

export const QUIZ_WEIGHTS = { plan: 50, fix: 30, explain: 20 };

export type QuizPhase = 'intro' | 'plan' | 'plan_done' | 'fix' | 'fix_done' | 'explain' | 'done';

/** Saved in the student's code under `qz`. Short keys; never reuse one. */
export interface QuizRecord {
  v: 1;
  sd: number; // seed
  tp?: string; // template id
  ph: QuizPhase;
  p1?: Record<string, unknown>; // packed Part 1 plot, frozen at submit
  p2?: Record<string, unknown>; // packed Part 2 plot, frozen at submit
  w1?: string; // Part 3: why this mic / DI
  w2?: string; // Part 3: one fix explained
}

export function scenarioFromRecord(r: QuizRecord): QuizScenario {
  return buildScenario(r.sd, r.tp);
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
