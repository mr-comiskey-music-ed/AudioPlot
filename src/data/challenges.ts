import { ChallengeDefinition } from '../types';

export const STUDIO_CHALLENGES: ChallengeDefinition[] = [
  {
    id: 'studio_singer_songwriter',
    title: 'Challenge #1: Singer-Songwriter',
    subtitle: 'Acoustic Guitar & Vocals',
    environment: 'recording_studio',
    description:
      'Set up proper microphone placement, stands, pop filters/shockmounts, headphones for each musician, and XLR cabling to the 8-channel snake for a solo acoustic performer.',
    instruments: [
      { gearId: 'inst_acoustic_guitar', x: 260, y: 310, label: 'Acoustic Guitar' },
      { gearId: 'inst_voice', x: 440, y: 310, label: 'Lead Vocalist' },
    ],
    hint: 'Use a Large Diaphragm Condenser with pop filter on vocals (+48V) and either a Small Condenser or dynamic/DI on the acoustic guitar.',
  },
  {
    id: 'studio_jazz_trio',
    title: 'Challenge #2: Jazz Trio',
    subtitle: 'Grand Piano, Vocals, Upright/Electric Bass, and Saxophone',
    environment: 'recording_studio',
    description:
      'Position appropriate microphones for grand piano, upright/electric bass, saxophone, and vocal performer. Ensure studio headphones are assigned to every musician and phantom power is engaged where necessary.',
    instruments: [
      { gearId: 'inst_acoustic_piano', x: 180, y: 220, label: 'Grand Piano' },
      { gearId: 'inst_voice', x: 380, y: 350, label: 'Jazz Vocalist' },
      { gearId: 'inst_bass_guitar', x: 540, y: 230, label: 'Bass' },
      { gearId: 'inst_saxophone', x: 380, y: 190, label: 'Saxophone' },
    ],
    hint: 'Piano often benefits from Condensers, Bass can use a DI Box or Dynamic mic, and Saxophone shines with ribbon/large condenser or dynamic mics.',
  },
  {
    id: 'studio_drum_set',
    title: 'Challenge #3: Drum Set',
    subtitle: 'Kick, Snare, 3 Toms, and Cymbals (Stereo Overheads)',
    environment: 'recording_studio',
    description:
      'Fully mic a studio drum kit with Kick mic, Snare mic, 3 individual Tom mics, and TWO Overhead microphones assigned to the Cymbals to capture a complete stereo image.',
    instruments: [
      { gearId: 'inst_kick_drum', x: 350, y: 290, label: 'Kick Drum' },
      { gearId: 'inst_snare_drum', x: 240, y: 270, label: 'Snare Drum' },
      { gearId: 'inst_tom_drum', x: 270, y: 180, label: 'Rack Tom 1' },
      { gearId: 'inst_tom_drum', x: 380, y: 170, label: 'Rack Tom 2' },
      { gearId: 'inst_tom_drum', x: 460, y: 250, label: 'Floor Tom' },
      { gearId: 'inst_drum_cymbals', x: 350, y: 220, label: 'Cymbals & Overheads' },
    ],
    hint: 'Use a dynamic low-frequency mic for Kick, dynamic mic on Snare, clip/stands for Toms, and two matching condenser mics on high stands for Cymbals.',
  },
  {
    id: 'studio_rock_band',
    title: 'Challenge #4: Rock Band',
    subtitle: 'Kick, Snare, Cymbals, Bass, Electric Guitar Amp, Keyboard, and Vocals',
    environment: 'recording_studio',
    description:
      'Engineer a full 7-piece tracking session: mic the drum elements (with stereo cymbals), guitar amplifier, direct-inject or mic the bass & keyboard, and setup lead vocals with monitoring headphones for all.',
    instruments: [
      { gearId: 'inst_kick_drum', x: 230, y: 180, label: 'Kick' },
      { gearId: 'inst_snare_drum', x: 150, y: 210, label: 'Snare' },
      { gearId: 'inst_drum_cymbals', x: 200, y: 130, label: 'Cymbals (Stereo)' },
      { gearId: 'gear_bass_amp', x: 390, y: 160, label: 'Bass Rig' },
      { gearId: 'gear_guitar_amp', x: 530, y: 160, label: 'Guitar Cab' },
      { gearId: 'inst_keyboard', x: 560, y: 310, label: 'Keyboards' },
      { gearId: 'inst_voice', x: 350, y: 330, label: 'Lead Vocals' },
    ],
    hint: 'Remember to patch each mic/DI into the 8-Channel Snake Box and ensure every performer has a pair of studio headphones.',
  },
];

export const LIVE_STAGE_CHALLENGES: ChallengeDefinition[] = [
  {
    id: 'live_classical_duo',
    title: 'Challenge #1: Classical Duo',
    subtitle: 'Acoustic Grand Piano & Violin',
    environment: 'live_stage',
    description:
      'Mic acoustic piano and violin on the live stage. Deploy Downstage Left & Right PA speakers connected to Snake MAIN L/R, and set up stage foldback monitoring connected to MON 1/2.',
    instruments: [
      { gearId: 'inst_acoustic_piano', x: 250, y: 220, label: 'Grand Piano' },
      { gearId: 'inst_violin', x: 470, y: 240, label: 'Violin' },
    ],
    hint: 'Downstage Left & Right PA speakers must be powered from Snake MAIN L/R outputs. Place stage wedges or IEMs for the duo.',
  },
  {
    id: 'live_small_band',
    title: 'Challenge #2: Small Band',
    subtitle: 'Vocals, Electric Guitar Cab, and Keyboard',
    environment: 'live_stage',
    description:
      'Set up a live gig with vocals, guitar amp, and keyboard. Ensure FOH PA speakers (MAIN L/R) and stage foldback monitors (MON 1/2) are properly routed.',
    instruments: [
      { gearId: 'gear_guitar_amp', x: 230, y: 190, label: 'Guitar Amp' },
      { gearId: 'inst_voice', x: 360, y: 260, label: 'Lead Vocal' },
      { gearId: 'inst_keyboard', x: 500, y: 210, label: 'Stage Keyboard' },
    ],
    hint: 'Position vocal mics upstage of PA speakers to prevent acoustic feedback!',
  },
  {
    id: 'live_blues_band',
    title: 'Challenge #3: Blues Band',
    subtitle: 'Kick, Snare, Cymbals, Bass Rig, Electric Guitar Amp, and Vocals',
    environment: 'live_stage',
    description:
      'Mic up a 6-piece live blues outfit. Connect all stage sources to Snake inputs 1-8, route Main PA speakers to MAIN L/R, and assign stage monitors or wireless IEMs to MON 1/2.',
    instruments: [
      { gearId: 'inst_kick_drum', x: 320, y: 160, label: 'Kick' },
      { gearId: 'inst_snare_drum', x: 240, y: 180, label: 'Snare' },
      { gearId: 'inst_drum_cymbals', x: 280, y: 120, label: 'Cymbals' },
      { gearId: 'gear_bass_amp', x: 160, y: 190, label: 'Bass Amp' },
      { gearId: 'gear_guitar_amp', x: 500, y: 190, label: 'Guitar Amp' },
      { gearId: 'inst_voice', x: 360, y: 280, label: 'Blues Vocalist' },
    ],
    hint: 'Use two overhead mics on the cymbals for stereo coverage and connect Downstage PA speakers via XLR to Snake MAIN L and R.',
  },
  {
    id: 'live_jazz_quintet',
    title: 'Challenge #4: Jazz Quintet',
    subtitle: 'Trumpet, Saxophone, Bass, Piano, Kick, Snare, and Cymbals',
    environment: 'live_stage',
    description:
      'Set up a high-caliber 5-piece jazz ensemble: horns up front, rhythm section in back, FOH PA speakers on audience edge, and stage foldback / IEM monitoring.',
    instruments: [
      { gearId: 'inst_trumpet', x: 260, y: 280, label: 'Trumpet' },
      { gearId: 'inst_saxophone', x: 440, y: 280, label: 'Saxophone' },
      { gearId: 'inst_acoustic_piano', x: 170, y: 180, label: 'Piano' },
      { gearId: 'gear_bass_amp', x: 530, y: 180, label: 'Bass' },
      { gearId: 'inst_kick_drum', x: 350, y: 150, label: 'Kick' },
      { gearId: 'inst_snare_drum', x: 300, y: 180, label: 'Snare' },
      { gearId: 'inst_drum_cymbals', x: 370, y: 120, label: 'Cymbals' },
    ],
    hint: 'Ensure all mics are routed into the Snake, Main Left & Right PA speakers are placed downstage, and foldback monitoring is active.',
  },
];
