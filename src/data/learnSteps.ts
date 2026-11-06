import {
  CableConnection,
  CableType,
  EnvironmentMode,
  MasterBusState,
  MixerChannelState,
  PlacedGear,
} from '../types';
import { getGearById } from './gearCatalog';
import { evaluateStudioSetup, validateChannelSignalChain } from '../services/gradingEngine';
import { getPaZone, getPaZones } from '../components/canvas/stageGeometry';

/**
 * Learn: one guided build, studio first, then the same band at a live gig.
 * Each step has missions that are checked live against the plot, and some have
 * a "Think First" question that asks why before the student does it.
 *
 * Steps build on each other. `enter` runs when a step opens (the live gig step
 * moves the plot onto the stage), `solve` is the step done right. Together they
 * rebuild the plot any step starts from, so a student can resume or jump back.
 */

export interface LearnPlot {
  environment: EnvironmentMode;
  placedGear: PlacedGear[];
  connections: CableConnection[];
  mixerChannels: MixerChannelState[];
  masterBus: MasterBusState;
}

export interface ThinkFirst {
  question: string;
  options: { text: string; correct?: boolean; explain: string }[];
  /** Ask after this many missions are done (0 or missing = before any). */
  afterMissions?: number;
}

export interface LearnMission {
  text: string;
  check: (p: LearnPlot) => boolean;
  /** A nudge shown under the task while it isn't done yet, when the plot shows a likely wrong turn. */
  hint?: (p: LearnPlot) => string | null;
}

export interface LearnStep {
  part: 'studio' | 'live';
  title: string;
  /** Shown once at the top when the story moves on (the move to the live stage). */
  intro?: string;
  what: string;
  think?: ThinkFirst;
  missions: LearnMission[];
  /** What to listen for once the step is done. */
  hear?: string;
  /** An extra fact shown with the step (not required). */
  note?: string;
  /** An explanation shown only once the step is done (so it can't give the answer away). */
  doneNote?: string;
  /** Open the mixer when the step starts. */
  openMixer?: boolean;
  /** Open the mixer once the step is done (to soundcheck what was just built). */
  openMixerWhenDone?: boolean;
  enter?: (p: LearnPlot) => LearnPlot;
  solve: (p: LearnPlot) => LearnPlot;
}

// ---------- Plot helpers ----------

const COLORS: Record<CableType, string> = { xlr: '#d9a441', quarter_inch: '#8ec5d6', speaker: '#8f9a47' };
const MASTER: MasterBusState = { fader: 75, gain: 50, pan: 0, muted: false, dim: false, mono: false };

const freshChannels = (): MixerChannelState[] =>
  Array.from({ length: 8 }, (_, i) => ({
    channelNumber: i + 1,
    assignedGearInstanceId: null,
    label: `CH ${i + 1}`,
    phantomPower: false,
    gain: 72,
    fader: 75,
    pan: 0,
    solo: false,
    muted: false,
    meterValue: 0,
  }));

const def = (g: PlacedGear) => getGearById(g.gearId);
const isMic = (g: PlacedGear) => def(g)?.category === 'microphone';
const transducer = (g: PlacedGear) => def(g)?.transducerType;
const isCondenser = (g: PlacedGear) => transducer(g) === 'condenser_large' || transducer(g) === 'condenser_small';
const first = (p: LearnPlot, gearId: string) => p.placedGear.find((g) => g.gearId === gearId);

/** What a mic is aimed at: its chosen Source, or the nearest instrument/amp (same rule as the signal check). */
function targetOf(p: LearnPlot, mic: PlacedGear): PlacedGear | null {
  if (mic.latchedSourceInstanceId === 'room') return null;
  if (mic.latchedSourceInstanceId) return p.placedGear.find((g) => g.instanceId === mic.latchedSourceInstanceId) ?? null;
  return (
    p.placedGear.find((g) => {
      if (g.instanceId === mic.instanceId) return false;
      const d = def(g);
      if (d?.category !== 'instrument' && d?.category !== 'amplifier') return false;
      const w = d?.size?.width || 64;
      return Math.hypot(g.x + w / 2 - (mic.x + 32), g.y + 32 - (mic.y + 32)) < Math.max(140, w / 2 + 50);
    }) ?? null
  );
}

const micsOn = (p: LearnPlot, sourceGearId: string) =>
  p.placedGear.filter((g) => isMic(g) && targetOf(p, g)?.gearId === sourceGearId);

const channelOf = (p: LearnPlot, g: PlacedGear) => p.mixerChannels.find((c) => c.assignedGearInstanceId === g.instanceId);

/** Patched to the snake AND passing the same signal check soundcheck uses. */
function hasSignal(p: LearnPlot, g: PlacedGear): boolean {
  const ch = channelOf(p, g);
  return !!ch && validateChannelSignalChain(ch, p.placedGear, p.connections, p.mixerChannels, p.environment).hasSignal;
}

const cabled = (p: LearnPlot, a: PlacedGear | undefined, b: PlacedGear | undefined, type: CableType) =>
  !!a &&
  !!b &&
  p.connections.some(
    (c) =>
      c.cableType === type &&
      ((c.fromInstanceId === a.instanceId && c.toInstanceId === b.instanceId) ||
        (c.fromInstanceId === b.instanceId && c.toInstanceId === a.instanceId))
  );

const grade = (p: LearnPlot) =>
  evaluateStudioSetup(p.environment, p.placedGear, p.connections, p.mixerChannels, null, 'standard');

// ---------- Plot editing (used by the canonical solutions) ----------

const add = (p: LearnPlot, g: Omit<PlacedGear, 'rotation'>): LearnPlot => ({
  ...p,
  placedGear: [...p.placedGear, { rotation: 0, ...g }],
});

const update = (p: LearnPlot, id: string, changes: Partial<PlacedGear>): LearnPlot => ({
  ...p,
  placedGear: p.placedGear.map((g) => (g.instanceId === id ? { ...g, ...changes } : g)),
});

const cable = (p: LearnPlot, from: string, to: string, type: CableType): LearnPlot => ({
  ...p,
  connections: [
    ...p.connections,
    { id: `learn_cable_${p.connections.length}_${from}_${to}`, fromInstanceId: from, toInstanceId: to, cableType: type, color: COLORS[type] },
  ],
});

/** Patch gear into the first free snake input. */
function patch(p: LearnPlot, id: string, label: string, phantom = false): LearnPlot {
  if (p.mixerChannels.some((c) => c.assignedGearInstanceId === id)) {
    return { ...p, mixerChannels: p.mixerChannels.map((c) => (c.assignedGearInstanceId === id ? { ...c, phantomPower: c.phantomPower || phantom } : c)) };
  }
  const free = p.mixerChannels.find((c) => !c.assignedGearInstanceId);
  if (!free) return p;
  return {
    ...update(p, id, { assignedChannel: free.channelNumber }),
    mixerChannels: p.mixerChannels.map((c) =>
      c.channelNumber === free.channelNumber ? { ...c, assignedGearInstanceId: id, label, phantomPower: phantom } : c
    ),
  };
}

/** Take gear off the plot along with its cables and snake patch. */
function remove(p: LearnPlot, ids: string[]): LearnPlot {
  const gone = new Set(ids);
  return {
    ...p,
    placedGear: p.placedGear
      .filter((g) => !gone.has(g.instanceId))
      .map((g) => (g.latchedSourceInstanceId && gone.has(g.latchedSourceInstanceId) ? { ...g, latchedSourceInstanceId: undefined } : g)),
    connections: p.connections.filter((c) => !gone.has(c.fromInstanceId) && !gone.has(c.toInstanceId)),
    mixerChannels: p.mixerChannels.map((c) =>
      c.assignedGearInstanceId && gone.has(c.assignedGearInstanceId)
        ? { ...c, assignedGearInstanceId: null, label: `CH ${c.channelNumber}`, phantomPower: false }
        : c
    ),
  };
}

const need = (g: PlacedGear | undefined | null): PlacedGear => {
  if (!g) throw new Error('Learn plot is missing something a step needs');
  return g;
};

// ---------- Where things go ----------

const POS = {
  voice: { x: 600, y: 330 },
  acoustic: { x: 400, y: 330 },
  eguitar: { x: 150, y: 340 },
  amp: { x: 150, y: 190 },
  kick: { x: 860, y: 240 },
  wedge: { x: 520, y: 450 },
};

export function learnBasePlot(): LearnPlot {
  return {
    environment: 'recording_studio',
    placedGear: [
      { instanceId: 'learn_voice', gearId: 'inst_voice', ...POS.voice, rotation: 0, label: 'Singer' },
      { instanceId: 'learn_acoustic', gearId: 'inst_acoustic_guitar', ...POS.acoustic, rotation: 0, label: 'Acoustic Guitar' },
    ],
    connections: [],
    mixerChannels: freshChannels(),
    masterBus: { ...MASTER },
  };
}

const voice = (p: LearnPlot) => first(p, 'inst_voice');
const acoustic = (p: LearnPlot) => first(p, 'inst_acoustic_guitar');
const eguitar = (p: LearnPlot) => first(p, 'inst_electric_guitar');
const amp = (p: LearnPlot) => first(p, 'gear_guitar_amp');
const vocalCondenser = (p: LearnPlot) => micsOn(p, 'inst_voice').find((m) => transducer(m) === 'condenser_large');
const vocalDynamic = (p: LearnPlot) => micsOn(p, 'inst_voice').find((m) => transducer(m) === 'dynamic');
const acousticDi = (p: LearnPlot) =>
  p.placedGear.find((g) => g.gearId === 'gear_di_box' && cabled(p, g, acoustic(p), 'quarter_inch'));

// ---------- The steps ----------

export const LEARN_STEPS: LearnStep[] = [
  // ===== Studio =====
  {
    part: 'studio',
    title: 'Start with the source',
    what:
      'A singer and an acoustic guitarist are recording a song together. Right now nothing is capturing them: a voice is sound waves in the air, and a microphone is what turns those waves into an electrical signal.',
    missions: [
      {
        text: 'Drag any microphone onto the plot. Click it and set its Source to the Voice.',
        check: (p) => micsOn(p, 'inst_voice').length > 0,
      },
    ],
    solve: (p) =>
      micsOn(p, 'inst_voice').length
        ? p
        : add(p, { instanceId: 'learn_vox_mic', gearId: 'mic_sm58', x: POS.voice.x + 80, y: POS.voice.y, latchedSourceInstanceId: need(voice(p)).instanceId }),
  },
  {
    part: 'studio',
    title: 'Pick the right mic',
    what:
      'Mics are not all the same. Dynamic mics are tough and handle loud sounds. Condenser mics are more sensitive, so they catch detail and air. The source decides which one you want.',
    think: {
      question: 'A quiet vocal in a studio, sung up close. Which mic catches the most detail?',
      options: [
        { text: 'A dynamic vocal mic (SM58)', explain: 'The SM58 is rugged and handles loud stages well, but it is less sensitive, so it misses some of the detail a studio vocal needs.' },
        { text: 'A large-diaphragm condenser (C214 or AT2035)', correct: true, explain: 'A large-diaphragm condenser is sensitive and detailed, which is why it is the standard studio vocal mic.' },
        { text: 'A small-diaphragm condenser (SM81)', explain: 'Small condensers are great on bright, fast sounds like acoustic guitar and cymbals. For vocals, the large-diaphragm condenser is the usual pick.' },
      ],
    },
    missions: [
      {
        text: 'Make the vocal mic a large-diaphragm condenser (C214 or AT2035). Drop the new mic on top of the old one to swap it.',
        check: (p) => !!vocalCondenser(p),
      },
    ],
    solve: (p) => {
      if (vocalCondenser(p)) return p;
      const mic = micsOn(p, 'inst_voice')[0];
      return mic
        ? update(p, mic.instanceId, { gearId: 'mic_c214' })
        : add(p, { instanceId: 'learn_vox_mic', gearId: 'mic_c214', x: POS.voice.x + 80, y: POS.voice.y, latchedSourceInstanceId: need(voice(p)).instanceId });
    },
  },
  {
    part: 'studio',
    title: 'Cable it, then power it',
    what:
      'A mic sends its signal down an XLR cable to the snake. Each snake input feeds one channel on the mixer.',
    think: {
      afterMissions: 1,
      question: 'The condenser is cabled and patched, but its channel is silent. Why?',
      options: [
        { text: 'It needs a different cable', explain: 'XLR is the right cable: only XLR plugs into the snake. The cable is not the problem.' },
        { text: 'Condenser mics need power to work', correct: true, explain: 'A condenser has electronics inside that need power. The mixer sends it down the XLR cable as +48V phantom power. Dynamic mics need none.' },
        { text: 'The fader is all the way down', explain: 'The faders start at unity (normal level), so the fader is not it.' },
      ],
    },
    missions: [
      {
        text: 'Pick up the XLR cable, click the vocal mic, then click a snake input.',
        check: (p) => { const m = vocalCondenser(p); return !!m && !!channelOf(p, m); },
      },
      {
        text: 'Turn on +48V: click the vocal mic and press its +48V button.',
        check: (p) => { const m = vocalCondenser(p); return !!m && hasSignal(p, m); },
      },
    ],
    hear: 'Press Soundcheck (or the space bar). The vocal now plays on its channel and its meter moves.',
    solve: (p) => patch(p, need(vocalCondenser(p)).instanceId, 'VOX', true),
  },
  {
    part: 'studio',
    title: 'A jack and a mic',
    what:
      'This acoustic guitar has a pickup with a 1/4" jack. A DI box turns that instrument signal into a mic-level signal on XLR, so it can go into the snake.',
    think: {
      question: 'In the studio, how should you record an acoustic guitar that has a pickup?',
      options: [
        { text: 'Only the DI', explain: 'The DI is clean and picks up nothing else in the room, but a pickup on its own sounds thin. It misses the sound of the wood and the air.' },
        { text: 'Only a mic', explain: 'A mic gets the full sound of the guitar, and that is fine. But engineers usually grab the DI as well, so they have both to work with.' },
        { text: 'Both: a DI and a mic', correct: true, explain: 'One source, two inputs: the DI for a clean signal, the mic for the body and air. In the mix you blend the two.' },
      ],
    },
    missions: [
      {
        text: 'Run a 1/4" cable from the guitar to a DI box, then an XLR cable from the DI to a snake input.',
        check: (p) => { const di = acousticDi(p); return !!di && hasSignal(p, di); },
      },
      {
        text: 'Add a condenser mic on the guitar (a small-diaphragm SM81 or ADX51 is ideal), cable it to its own snake input, and turn on its +48V.',
        check: (p) => micsOn(p, 'inst_acoustic_guitar').some((m) => isCondenser(m) && hasSignal(p, m)),
      },
    ],
    note: 'Count your inputs: vocal, guitar DI and guitar mic make three channels. One source can use more than one input.',
    hear: 'Solo each guitar channel on the mixer. In AudioPlot both play the same recording, but in a real studio the DI sounds cleaner and drier, and the mic sounds more like the room.',
    solve: (p) => {
      const ag = need(acoustic(p));
      let q = p;
      if (!acousticDi(q)) {
        q = add(q, { instanceId: 'learn_ag_di', gearId: 'gear_di_box', x: POS.acoustic.x - 40, y: POS.acoustic.y + 110 });
        q = cable(q, ag.instanceId, 'learn_ag_di', 'quarter_inch');
      }
      q = patch(q, need(acousticDi(q)).instanceId, 'A GUIT DI');
      let mic = micsOn(q, 'inst_acoustic_guitar').find(isCondenser);
      if (!mic) {
        q = add(q, { instanceId: 'learn_ag_mic', gearId: 'mic_sm81', x: POS.acoustic.x - 90, y: POS.acoustic.y, latchedSourceInstanceId: ag.instanceId });
        mic = need(first(q, 'mic_sm81'));
      }
      return patch(q, mic.instanceId, 'A GUIT', true);
    },
  },
  {
    part: 'studio',
    title: 'Stands and a pop filter',
    what:
      'Every mic sits on a stand at the right height for its source. A studio vocal on a condenser also gets a pop filter: a screen that stops the bursts of air from "P" and "B" sounds.',
    missions: [
      {
        text: 'Click the vocal mic: set its stand height to Standing and turn on its pop filter.',
        check: (p) => { const m = vocalCondenser(p); return !!m && m.standHeight === 'standing_vocal' && !!m.hasPopFilter; },
      },
      {
        text: 'Click the guitar mic and set its stand height to Seated.',
        check: (p) => micsOn(p, 'inst_acoustic_guitar').some((m) => isCondenser(m) && m.standHeight === 'seated_instrument'),
      },
    ],
    solve: (p) => {
      let q = update(p, need(vocalCondenser(p)).instanceId, { standHeight: 'standing_vocal', hasPopFilter: true });
      for (const m of micsOn(q, 'inst_acoustic_guitar')) q = update(q, m.instanceId, { standHeight: 'seated_instrument' });
      return q;
    },
  },
  {
    part: 'studio',
    title: 'Who hears what?',
    what:
      'In a studio, the musicians are in a different room from the speakers. They hear the session through headphones, which also keeps the sound from leaking back into the mics.',
    missions: [
      {
        text: 'Place Studio Headphones for the singer and for the guitarist. Click each pair and set its Performer.',
        check: (p) =>
          [voice(p), acoustic(p)].every(
            (inst) =>
              !!inst &&
              p.placedGear.some(
                (g) =>
                  g.gearId === 'gear_studio_headphones' &&
                  (g.latchedSourceInstanceId === inst.instanceId || Math.hypot(g.x - inst.x, g.y - inst.y) < 95)
              )
          ),
      },
    ],
    openMixerWhenDone: true,
    hear: 'That is a complete studio session: every source captured, powered, patched, and every musician can hear. The mixer is open below: press Soundcheck and watch each channel\'s meter.',
    solve: (p) => {
      let q = p;
      for (const inst of [need(voice(q)), need(acoustic(q))]) {
        const has = q.placedGear.some((g) => g.gearId === 'gear_studio_headphones' && g.latchedSourceInstanceId === inst.instanceId);
        if (!has) q = add(q, { instanceId: `learn_hp_${inst.instanceId}`, gearId: 'gear_studio_headphones', x: inst.x, y: inst.y + 100, latchedSourceInstanceId: inst.instanceId });
      }
      return q;
    },
  },

  // ===== Live =====
  {
    part: 'live',
    title: 'A live vocal mic',
    intro:
      'Same band, now playing a gig, with two new players: an electric guitarist and a drummer. (A real drummer plays a whole kit, but to keep this short we will only mic the kick.) The studio headphones are gone (monitors come later). The mic on the acoustic guitar is gone too: on a loud stage it would pick up everything around it and invite feedback, so the DI does the job on its own.',
    what:
      'A stage is loud: drums, amps and speakers all at once. The vocal mic should hear the singer and as little else as possible.',
    think: {
      question: 'The studio condenser is still on the vocal. Why is it the wrong mic for a loud stage?',
      options: [
        { text: 'It is not loud enough', explain: 'Condensers are more sensitive than dynamics, not less. That sensitivity is the problem here.' },
        { text: 'It hears too much: the drums, the amps and the PA', correct: true, explain: 'A sensitive condenser picks up the whole stage and the speakers, and that leads to feedback. A dynamic mic like the SM58 mostly hears what is right in front of it.' },
        { text: 'Phantom power does not work on stage', explain: 'Phantom power works fine live. The issue is how much of the stage the condenser hears.' },
      ],
    },
    missions: [
      {
        text: 'Take the condenser off the vocal (delete it, or drop an SM58 on top to swap it).',
        check: (p) => !!voice(p) && !vocalCondenser(p),
      },
      {
        text: 'Put a dynamic vocal mic (SM58) on the singer, set its stand height to Standing, and cable it to a snake input.',
        check: (p) => { const m = vocalDynamic(p); return !!m && m.standHeight === 'standing_vocal' && hasSignal(p, m); },
      },
    ],
    note: 'The pop filter came off in the move to the stage. Live, the singer works close to the SM58, and its built-in grille handles the "P" sounds.',
    hear: 'Press Soundcheck. The vocal and the guitar DI play. The SM58 needs no +48V, since it is a dynamic mic.',
    enter: (p) => {
      if (p.environment === 'live_stage') return p;
      let q: LearnPlot = { ...p, environment: 'live_stage' };
      const drop = q.placedGear
        .filter((g) => g.gearId === 'gear_studio_headphones' || (isMic(g) && targetOf(q, g)?.gearId === 'inst_acoustic_guitar'))
        .map((g) => g.instanceId);
      q = remove(q, drop);
      // Pop filters are a studio tool (the live inspector has no pop filter switch), so they come off here.
      q = { ...q, placedGear: q.placedGear.map((g) => (g.hasPopFilter ? { ...g, hasPopFilter: false } : g)) };
      q = add(q, { instanceId: 'learn_eguitar', gearId: 'inst_electric_guitar', ...POS.eguitar, label: 'Electric Guitar' });
      q = add(q, { instanceId: 'learn_amp', gearId: 'gear_guitar_amp', ...POS.amp, label: 'Guitar Amp' });
      q = add(q, { instanceId: 'learn_kick', gearId: 'inst_kick_drum', ...POS.kick, label: 'Kick Drum' });
      return q;
    },
    solve: (p) => {
      let q = remove(p, micsOn(p, 'inst_voice').filter((m) => transducer(m) !== 'dynamic').map((m) => m.instanceId));
      let mic = vocalDynamic(q);
      if (!mic) {
        q = add(q, { instanceId: 'learn_live_vox', gearId: 'mic_sm58', x: POS.voice.x + 80, y: POS.voice.y, latchedSourceInstanceId: need(voice(q)).instanceId });
        mic = need(vocalDynamic(q));
      }
      q = update(q, mic.instanceId, { standHeight: 'standing_vocal' });
      return patch(q, mic.instanceId, 'VOX');
    },
  },
  {
    part: 'live',
    title: 'Instrument, amp, mic',
    what:
      'An electric guitar\'s strings make almost no sound on their own. The guitar sends its signal down a 1/4" cable to an amp, and the amp\'s speaker makes the sound you hear.',
    think: {
      question: 'Where should the mic go to capture the electric guitar?',
      options: [
        { text: 'Pointed at the guitar', explain: 'Unplugged, an electric guitar is nearly silent. Its sound comes out of the amp.' },
        { text: 'In front of the amp\'s speaker', correct: true, explain: 'Mic the speaker: that is where the guitar\'s sound actually comes from.' },
        { text: 'Skip the mic: cable the guitar straight to the snake', explain: 'A guitar\'s 1/4" signal cannot plug straight into the snake. It needs an amp (then a mic) or a DI first.' },
      ],
    },
    missions: [
      {
        text: 'Run a 1/4" cable from the electric guitar to the guitar amp.',
        check: (p) => cabled(p, eguitar(p), amp(p), 'quarter_inch'),
      },
      {
        text: 'Pick a mic for the amp. The speaker is loud and the mic sits inches from it, and a guitar lives in the middle of the sound, not the deep lows. Set its stand height to Floor and cable it to a snake input.',
        check: (p) =>
          micsOn(p, 'gear_guitar_amp').some(
            (m) => transducer(m) === 'dynamic' && m.gearId !== 'mic_beta52a' && m.standHeight === 'amp_low' && hasSignal(p, m)
          ),
        hint: (p) => {
          const mics = micsOn(p, 'gear_guitar_amp');
          if (mics.some((m) => isCondenser(m))) return 'A condenser is too sensitive this close to a loud amp, and it hears the whole stage. Try a dynamic mic.';
          if (mics.some((m) => m.gearId === 'mic_beta52a')) return 'The Beta 52A is built for the deep lows of a kick drum. A guitar amp needs a mic made for the middle of the sound.';
          return null;
        },
      },
    ],
    doneNote: 'The Shure SM57 is the classic amp mic: a dynamic that takes a loud speaker inches away, hears mostly what is in front of it, and focuses on the guitar\'s midrange.',
    hear: 'Press Soundcheck. Now the electric guitar plays too: guitar → 1/4" → amp → mic → XLR → snake.',
    solve: (p) => {
      let q = p;
      if (!cabled(q, eguitar(q), amp(q), 'quarter_inch')) q = cable(q, need(eguitar(q)).instanceId, need(amp(q)).instanceId, 'quarter_inch');
      let mic = micsOn(q, 'gear_guitar_amp').find((m) => transducer(m) === 'dynamic' && m.gearId !== 'mic_beta52a');
      if (!mic) {
        q = add(q, { instanceId: 'learn_amp_mic', gearId: 'mic_sm57', x: POS.amp.x + 130, y: POS.amp.y, latchedSourceInstanceId: need(amp(q)).instanceId });
        mic = need(first(q, 'mic_sm57'));
      }
      q = update(q, mic.instanceId, { standHeight: 'amp_low' });
      return patch(q, mic.instanceId, 'GTR AMP');
    },
  },
  {
    part: 'live',
    title: 'The kick drum',
    what: 'The kick drum is the low thump that drives the band. The drummer\'s other drums would each get a mic too; here we will do just the kick.',
    think: {
      question: 'Why does a kick drum get its own kind of mic?',
      options: [
        { text: 'Because it is the loudest drum', explain: 'It is loud, but an SM57 handles loud sounds too. The real reason is how low the kick goes.' },
        { text: 'Because most of its sound is very low', correct: true, explain: 'A large dynamic kick mic like the Beta 52A is built to capture deep lows and handle the hit of a kick drum.' },
        { text: 'Because it needs phantom power', explain: 'The Beta 52A is a dynamic mic, so it needs no phantom power.' },
      ],
    },
    missions: [
      {
        text: 'Put a Beta 52A on the kick drum, set its stand height to Floor, and cable it to a snake input.',
        check: (p) => micsOn(p, 'inst_kick_drum').some((m) => m.gearId === 'mic_beta52a' && m.standHeight === 'amp_low' && hasSignal(p, m)),
      },
    ],
    hear: 'Press Soundcheck: vocal, acoustic DI, guitar amp and kick. Four sources, four channels.',
    solve: (p) => {
      let q = p;
      let mic = micsOn(q, 'inst_kick_drum').find((m) => m.gearId === 'mic_beta52a');
      if (!mic) {
        q = add(q, { instanceId: 'learn_kick_mic', gearId: 'mic_beta52a', x: POS.kick.x - 90, y: POS.kick.y, latchedSourceInstanceId: need(first(q, 'inst_kick_drum')).instanceId });
        mic = need(first(q, 'mic_beta52a'));
      }
      q = update(q, mic.instanceId, { standHeight: 'amp_low' });
      return patch(q, mic.instanceId, 'KICK');
    },
  },
  {
    part: 'live',
    title: 'Sound for the audience',
    what:
      'On stage there are two audiences: the crowd and the band. The crowd hears the PA: two speakers at the front corners of the stage, fed by the snake\'s MAIN L and MAIN R outputs.',
    missions: [
      {
        text: 'Place two PA speakers, one in each dashed PA zone at the front corners.',
        check: (p) => {
          const zones = p.placedGear.filter((g) => g.gearId === 'gear_pa_speaker').map((g) => getPaZone(g, 'standard'));
          return zones.includes('left') && zones.includes('right');
        },
      },
      {
        text: 'Run XLR from the snake\'s MAIN L to the left PA, and MAIN R to the right PA.',
        check: (p) => grade(p).categories.paSpeakerSetup?.score === 10,
      },
    ],
    note: 'Notice where things ended up: the PA is downstage (toward the audience) and the vocal mic is upstage, behind it. A mic in front of a PA hears its own sound coming back and loops it. That howl is feedback.',
    solve: (p) => {
      const zones = getPaZones('standard');
      let q = remove(p, p.placedGear.filter((g) => g.gearId === 'gear_pa_speaker').map((g) => g.instanceId));
      q = add(q, { instanceId: 'learn_pa_l', gearId: 'gear_pa_speaker', x: zones.left.x + 60, y: zones.left.y + 60 });
      q = add(q, { instanceId: 'learn_pa_r', gearId: 'gear_pa_speaker', x: zones.right.x + 60, y: zones.right.y + 60 });
      q = cable(q, 'snake_out_main_l', 'learn_pa_l', 'xlr');
      return cable(q, 'snake_out_main_r', 'learn_pa_r', 'xlr');
    },
  },
  {
    part: 'live',
    title: 'Sound for the band',
    what:
      'The PA faces the crowd, so the band can barely hear it. Performers get their own speakers, called monitors, fed from the snake\'s MON 1 and MON 2 outputs.',
    missions: [
      {
        text: 'Place a stage monitor (wedge) in front of the performers and run XLR to it from MON 1 or MON 2.',
        check: (p) => {
          const g = grade(p).categories.monitorSetup;
          return !!g && g.score === 10;
        },
      },
    ],
    note: 'Players can share. One wedge can cover two people standing close together, and wedges can be daisy-chained: run XLR from one wedge to the next so the same mix feeds both. The other option is in-ear monitors (IEMs): an IEM transmitter cabled to MON 1 or MON 2, plus a bodypack set to the performer who wears it. Either wedges or IEMs finish this step.',
    hear: 'That is a full gig: every source in the snake, the crowd on the PA, and the band on monitors.',
    solve: (p) => {
      if (grade(p).categories.monitorSetup?.score === 10) return p;
      const q = add(p, { instanceId: 'learn_wedge', gearId: 'gear_stage_monitor', ...POS.wedge });
      return cable(q, 'snake_out_mon1', 'learn_wedge', 'xlr');
    },
  },
];

/** True when every mission in the step passes on this plot. */
export const stepDone = (step: LearnStep, p: LearnPlot) => step.missions.every((m) => m.check(p));

/** The plot a step starts from, built from the steps before it done right. */
export function learnStartPlot(index: number): LearnPlot {
  let p = learnBasePlot();
  for (let i = 0; i < index; i++) {
    const s = LEARN_STEPS[i];
    if (s.enter) p = s.enter(p);
    p = s.solve(p);
  }
  const s = LEARN_STEPS[index];
  return s?.enter ? s.enter(p) : p;
}
