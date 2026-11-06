import { EnvironmentMode, MicStandHeight, PlacedGear } from '../../types';
import { getGearById } from '../../data/gearCatalog';

export interface StructuredCablePath {
  d: string;
  midPoint: { x: number; y: number };
  gaffPoints: Array<{ x: number; y: number; angle: number }>;
}

// Math helper to evaluate quadratic bezier curve and tangent angle
export function getQuadBezierPointAndAngle(
  x0: number,
  y0: number,
  xm: number,
  ym: number,
  x1: number,
  y1: number,
  t: number
): { x: number; y: number; angle: number } {
  const oneMinusT = 1 - t;
  const x = oneMinusT * oneMinusT * x0 + 2 * oneMinusT * t * xm + t * t * x1;
  const y = oneMinusT * oneMinusT * y0 + 2 * oneMinusT * t * ym + t * t * y1;

  const dx = 2 * oneMinusT * (xm - x0) + 2 * t * (x1 - xm);
  const dy = 2 * oneMinusT * (ym - y0) + 2 * t * (y1 - ym);
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  return { x, y, angle: angleDeg };
}

// Professional Stage & Studio Trunking Cable Route Generator with 90º Angles & Perimeter Routing
export function getOrganizedSnakeCablePath(
  gearCenter: { x: number; y: number },
  snakeSocket: { x: number; y: number },
  environment: EnvironmentMode,
  channelOffsetIndex: number = 0,
  canvasWidth: number = 1000
): StructuredCablePath {
  const gx = gearCenter.x;
  const gy = gearCenter.y;
  const sx = snakeSocket.x;
  const sy = snakeSocket.y;

  const isStudio = environment === 'recording_studio';
  const trunkY = isStudio
    ? Math.max(70, Math.min(gy, sy) - 30 + (channelOffsetIndex % 5) * 8)
    : Math.max(135, Math.min(180, sy + 38 + (channelOffsetIndex % 6) * 5));

  const isLeft = gx < sx - 40;
  const isRight = gx > sx + 40;
  
  let laneX = gx;
  if (Math.abs(gx - sx) > 40) {
    laneX = isLeft
      ? Math.max(60, sx - 180 + (channelOffsetIndex % 5) * 10)
      : isRight
      ? Math.min(canvasWidth - 60, sx + 180 - (channelOffsetIndex % 5) * 10)
      : gx;
  }

  const r = 16; // 90-degree corner rounding radius
  const waypoints: Array<{ x: number; y: number }> = [];
  waypoints.push({ x: gx, y: gy });
  
  if (Math.abs(laneX - gx) > 15) {
    waypoints.push({ x: laneX, y: gy });
    waypoints.push({ x: laneX, y: trunkY });
  } else {
    waypoints.push({ x: gx, y: trunkY });
  }
  waypoints.push({ x: sx, y: trunkY });
  waypoints.push({ x: sx, y: sy });

  // Construct SVG path with smooth filleted 90-degree rounded corners
  let pathD = `M ${waypoints[0].x} ${waypoints[0].y}`;
  for (let i = 1; i < waypoints.length - 1; i++) {
    const pPrev = waypoints[i - 1];
    const pCurr = waypoints[i];
    const pNext = waypoints[i + 1];

    const d1x = pPrev.x - pCurr.x;
    const d1y = pPrev.y - pCurr.y;
    const d2x = pNext.x - pCurr.x;
    const d2y = pNext.y - pCurr.y;

    const len1 = Math.hypot(d1x, d1y);
    const len2 = Math.hypot(d2x, d2y);
    const curR = Math.min(r, len1 / 2, len2 / 2);

    if (curR > 2) {
      const startX = pCurr.x + (d1x / len1) * curR;
      const startY = pCurr.y + (d1y / len1) * curR;
      const endX = pCurr.x + (d2x / len2) * curR;
      const endY = pCurr.y + (d2y / len2) * curR;

      pathD += ` L ${startX} ${startY} Q ${pCurr.x} ${pCurr.y} ${endX} ${endY}`;
    } else {
      pathD += ` L ${pCurr.x} ${pCurr.y}`;
    }
  }
  pathD += ` L ${waypoints[waypoints.length - 1].x} ${waypoints[waypoints.length - 1].y}`;

  // Place unpatch badge along the middle segment
  const midIdx = Math.floor(waypoints.length / 2);
  const midPoint = {
    x: (waypoints[midIdx - 1].x + waypoints[midIdx].x) / 2,
    y: (waypoints[midIdx - 1].y + waypoints[midIdx].y) / 2,
  };

  // Gaff tape intervals along trunk lines
  const gaffPoints: Array<{ x: number; y: number; angle: number }> = [];
  if (waypoints.length >= 3) {
    gaffPoints.push({
      x: (waypoints[1].x + waypoints[2].x) / 2,
      y: (waypoints[1].y + waypoints[2].y) / 2,
      angle: (Math.atan2(waypoints[2].y - waypoints[1].y, waypoints[2].x - waypoints[1].x) * 180) / Math.PI,
    });
    if (waypoints.length >= 4) {
      gaffPoints.push({
        x: (waypoints[2].x + waypoints[3].x) / 2,
        y: (waypoints[2].y + waypoints[3].y) / 2,
        angle: (Math.atan2(waypoints[3].y - waypoints[2].y, waypoints[3].x - waypoints[2].x) * 180) / Math.PI,
      });
    }
  }

  return { d: pathD, midPoint, gaffPoints };
}

// Purely acoustic instrument IDs (no electronic output jack for direct cabling)
export const isAcousticInstrument = (gearId: string): boolean => {
  const acousticIds = [
    'inst_voice',
    'inst_kick_drum',
    'inst_snare_drum',
    'inst_tom_drum',
    'inst_drum_cymbals',
    'inst_hi_hat',
    'inst_violin',
    'inst_cello',
    'inst_trumpet',
    'inst_saxophone',
    'inst_flute',
    'inst_choir',
    'inst_acoustic_piano',
  ];
  return acousticIds.includes(gearId);
};

// Helper to format shortened gear names (e.g. "Piano", "A Guit", "E Guit")
export const formatShortGearName = (name?: string, gearId?: string): string => {
  if (!name) return '';
  if (
    gearId === 'inst_acoustic_piano' ||
    gearId === 'inst_grand_piano' ||
    name.toLowerCase().includes('acoustic piano') ||
    name.toLowerCase().includes('grand piano')
  ) {
    return 'Piano';
  }
  if (gearId === 'inst_acoustic_guitar' || name.toLowerCase().includes('acoustic guitar')) {
    return 'A Guit';
  }
  if (gearId === 'inst_electric_guitar' || name.toLowerCase().includes('electric guitar')) {
    return 'E Guit';
  }
  if (gearId === 'inst_bass_guitar' || name.toLowerCase().includes('bass guitar')) {
    return 'Bass';
  }
  if (
    gearId === 'inst_double_bass' ||
    name.toLowerCase().includes('double bass') ||
    name.toLowerCase().includes('upright bass')
  ) {
    return 'Upright';
  }
  if (gearId === 'inst_keyboard' || name.toLowerCase().includes('keyboard') || name.toLowerCase().includes('synthesizer')) {
    return 'Keys';
  }
  if (
    gearId === 'inst_hi_hat' ||
    name.toLowerCase().includes('hi-hat') ||
    name.toLowerCase().includes('hihat')
  ) {
    return 'Hi-Hats';
  }
  if (
    gearId === 'inst_drum_cymbals' ||
    name.toLowerCase().includes('cymbals') ||
    name.toLowerCase().includes('overhead')
  ) {
    return 'Drum OHs';
  }
  if (gearId === 'inst_kick_drum' || name.toLowerCase().includes('kick drum')) {
    return 'Kick';
  }
  if (gearId === 'inst_snare_drum' || name.toLowerCase().includes('snare drum')) {
    return 'Snare';
  }
  if (gearId === 'inst_tom_drum' || name.toLowerCase().includes('tom drum')) {
    return 'Toms';
  }
  if (gearId === 'inst_drum_set' || name.toLowerCase().includes('drum set')) {
    return 'Drums';
  }
  if (gearId === 'inst_voice' || name.toLowerCase().includes('lead vocal') || name.toLowerCase().includes('voice')) {
    return 'Vocals';
  }
  if (gearId === 'inst_choir' || name.toLowerCase().includes('choir')) {
    return 'Choir';
  }
  if (gearId === 'inst_saxophone' || name.toLowerCase().includes('saxophone')) {
    return 'Sax';
  }
  if (gearId === 'inst_trumpet' || name.toLowerCase().includes('trumpet')) {
    return 'Trumpet';
  }
  if (gearId === 'inst_violin' || name.toLowerCase().includes('violin')) {
    return 'Violin';
  }
  if (gearId === 'inst_flute' || name.toLowerCase().includes('flute')) {
    return 'Flute';
  }
  if (gearId === 'gear_guitar_amp' || name.toLowerCase().includes('guitar amp')) {
    return 'Gtr Amp';
  }
  if (gearId === 'gear_bass_amp' || name.toLowerCase().includes('bass amp')) {
    return 'Bass Amp';
  }
  if (gearId === 'gear_di_box' || name.toLowerCase().includes('di box')) {
    return 'DI Box';
  }
  if (gearId === 'gear_stage_monitor' || name.toLowerCase().includes('stage monitor')) {
    return 'Monitor';
  }
  if (gearId === 'gear_studio_headphones' || name.toLowerCase().includes('headphones')) {
    return 'Headphones';
  }
  if (gearId === 'gear_main_speaker' || name.toLowerCase().includes('speaker')) {
    return 'Main PA';
  }
  if (name.length <= 7) return name;
  return name.slice(0, 6);
};

// Calculate coordinates and bounds of Snake Box
// The stage snake box as it is actually drawn (SnakeBox.tsx), in world units. These numbers were measured
// from the rendered box and socket centers: if SnakeBox's size or padding changes, measure them again.
export const getSnakeBoxBounds = (environment: EnvironmentMode, canvasWidth: number = 1000, canvasHeight: number = 650) => {
  const snakeBoxW = environment === 'live_stage' ? 500 : 336;
  const snakeBoxH = environment === 'live_stage' ? 175 : 165;
  const snakeX = Math.max(10, (canvasWidth - snakeBoxW) / 2);
  const snakeY = 16;
  return { x: snakeX, y: snakeY, w: snakeBoxW, h: snakeBoxH };
};

// Center of a Snake Box input socket (channels 1-8, two rows of four)
export const getSnakeChannelPosition = (
  chNum: number,
  environment: EnvironmentMode,
  canvasWidth: number = 1000,
  canvasHeight: number = 650
) => {
  const box = getSnakeBoxBounds(environment, canvasWidth, canvasHeight);
  const col = (chNum - 1) % 4;
  const row = Math.floor((chNum - 1) / 4);
  if (environment === 'live_stage') {
    return { x: box.x + 46.5 + col * 69, y: box.y + 86.2 + row * 51.4 };
  }
  return { x: box.x + 48.8 + col * 79.5, y: box.y + 66.4 + row * 59.9 };
};

// Center of a Snake Box output socket (live stage only: MON 1, MON 2, MAIN L, MAIN R)
export const getSnakeOutputPosition = (
  outputPort: 'mon1' | 'mon2' | 'main_l' | 'main_r',
  environment: EnvironmentMode,
  canvasWidth: number = 1000,
  canvasHeight: number = 650
) => {
  const box = getSnakeBoxBounds(environment, canvasWidth, canvasHeight);
  const col = outputPort === 'mon1' || outputPort === 'main_l' ? 0 : 1;
  const row = outputPort === 'mon1' || outputPort === 'mon2' ? 0 : 1;
  return { x: box.x + 347.8 + col * 93.5, y: box.y + 85.6 + row * 50.3 };
};

// Calculate gear box dimensions
export const getGearBoxDimensions = (
  gearId: string,
  isAssigned = false,
  customScale?: 'compact' | 'standard' | 'large' | number,
  customWidth?: number,
  customHeight?: number,
  isMicOnDrum = false
) => {
  if (customWidth && customHeight) {
    return { width: Math.round(customWidth), height: Math.round(customHeight) };
  }
  const isDrum = gearId.includes('drum') || gearId === 'inst_hi_hat';
  const drumScale = isDrum ? 0.75 : 1.0;
  const customScaleFactor = customScale === 'compact' ? 0.8 : customScale === 'large' ? 1.25 : 1.0;

  // Once a microphone is assigned to a source it shrinks to a compact tag,
  // the same way an assigned DI box does, so busy plots stay readable.
  if (isAssigned && getGearById(gearId)?.category === 'microphone') {
    const s = customScaleFactor;
    return { width: Math.round(76 * s), height: Math.round(72 * s) };
  }

  const micOnDrumScale = isMicOnDrum ? 0.7 : 1.0;
  const scaleFactor = (customScale === 'compact' ? 0.8 : customScale === 'large' ? 1.25 : 1.0) * drumScale * micOnDrumScale;

  if (gearId === 'gear_studio_headphones') {
    const baseW = isAssigned ? 54 : 76;
    const baseH = isAssigned ? 52 : 72;
    return { width: Math.round(baseW * scaleFactor), height: Math.round(baseH * scaleFactor) };
  }

  if (
    gearId === 'gear_iem_receiver' ||
    gearId === 'gear_in_ear_monitors' ||
    gearId === 'gear_di_box' ||
    gearId === 'gear_iem_transmitter'
  ) {
    if (isAssigned) {
      return { width: Math.round(76 * scaleFactor), height: Math.round(72 * scaleFactor) };
    }
  }

  if (gearId === 'inst_choir') {
    const baseW = 250;
    const baseH = 96;
    return { width: Math.round(baseW * scaleFactor), height: Math.round(baseH * scaleFactor) };
  }

  const def = getGearById(gearId);
  const baseW = def?.size.width || 64;
  const baseH = def?.size.height || 64;
  const width = Math.round(Math.max(124, baseW + 56) * scaleFactor);
  const height = Math.round(Math.max(116, baseH + 48) * scaleFactor);
  return { width, height };
};

// ---------- Mic placement options ----------
// What a student can pick for where a mic sits, by the source it is aimed at. The first option is the
// usual starting point. Ids are saved in student codes, so never rename or remove one: relabel it or add
// a new one instead.
type PlacementOption = { id: string; label: string };

const GENERIC_PLACEMENTS: PlacementOption[] = [
  { id: 'on_axis', label: 'On-Axis (Direct)' },
  { id: 'off_axis_45', label: 'Off-Axis (45° Angle)' },
  { id: 'distant_room', label: 'Distant Room (1-2 ft)' },
];

const OVERHEAD_PAIR: PlacementOption[] = [
  { id: 'xy_pair', label: 'XY Pair Overhead (Tight, Mono-Safe)' },
  { id: 'spaced_ab', label: 'Spaced Pair A/B (Wide)' },
  { id: 'ortf', label: 'ORTF Pair (Natural Stereo Image)' },
  { id: 'glyn_johns', label: 'Glyn Johns (One Over Kit, One at Side)' },
];

const PLACEMENTS: Record<string, PlacementOption[]> = {
  room: [
    { id: 'mid_room', label: 'Mid Room, 6-10 ft (Natural Blend)' },
    { id: 'hallway', label: 'Far Back of Room (Long Ambience)' },
    { id: 'wall_reflection', label: 'Near a Wall (Boundary Boost)' },
    { id: 'corner', label: 'In a Corner (Boosted Lows)' },
  ],
  gear_guitar_amp: [
    { id: 'cap_edge', label: 'Between Cap and Edge (Balanced)' },
    { id: 'cone_center', label: 'Cap / Center (Bright, Aggressive)' },
    { id: 'cone_edge', label: 'Cone Edge (Warmer, Fuller)' },
    { id: 'angle_45', label: '45° Off-Axis (Smoother Highs)' },
    { id: 'open_back', label: 'Back of Open-Back Cab (Roomy)' },
  ],
  gear_bass_amp: [
    { id: 'cone_center', label: 'Cone Center (Punch, Attack)' },
    { id: 'cone_edge', label: 'Cone Edge (Warmer, Rounder)' },
    { id: 'direct_port', label: 'Front Port (Big Lows, Less Definition)' },
  ],
  inst_acoustic_guitar: [
    { id: 'fret_12', label: '12th Fret, 8-12 in (Balanced Clarity)' },
    { id: 'neck_joint', label: '14th Fret / Neck Joint (Warm, Less Boomy)' },
    { id: 'bridge', label: 'Lower Bout Near Bridge (Bright Attack)' },
    { id: 'soundhole', label: 'Close to Soundhole (Boomy, Back Off)' },
  ],
  inst_double_bass: [
    { id: 'bridge_fhole', label: '6-8 in From F-Hole (Warm, Articulate)' },
    { id: 'fingerboard', label: 'End of Fingerboard (Attack, Finger Detail)' },
    { id: 'lower_bout', label: 'Lower Bout (Deep Wood Resonance)' },
  ],
  inst_cello: [
    { id: 'cello_fhole', label: '12-18 in From F-Hole (Warm, Full)' },
    { id: 'cello_over_bridge', label: 'Above Bridge, Aimed at F-Hole (Closer)' },
    { id: 'cello_distance', label: '2-3 ft Out and Up (Natural Blend)' },
  ],
  inst_violin: [
    { id: 'above_front', label: '1-2 ft Above and in Front (Natural, Sweet)' },
    { id: 'bridge_fholes', label: '6-12 in Above Bridge / F-Holes (Close)' },
    { id: 'bow_contact', label: 'Over Bow Contact Point (Bright, Scratchy)' },
  ],
  inst_voice: [
    { id: 'direct_4_6', label: '4-6 in, Straight On (Standard)' },
    { id: 'off_axis_sibilance', label: 'Slightly Off-Axis (Tames S and P Sounds)' },
    { id: 'room_air', label: '1-2 ft Back (Natural, Less Bass Boost)' },
    { id: 'close_live', label: 'Lips Near Grille, 1-2 in (Live, Strong Bass)' },
  ],
  inst_kick_drum: [
    { id: 'inside_mid', label: 'Inside, Halfway to Beater (Balanced Punch)' },
    { id: 'inside_port', label: 'Inside Through Port (Beater Click)' },
    { id: 'resonant_head', label: 'Outside Front Head (Sub Boom)' },
    { id: 'boundary_center', label: 'Inside, on a Pillow (Boundary, Round Punch)' },
  ],
  inst_snare_drum: [
    { id: 'top_rim', label: 'Top Head, 1-2 in Over Rim (Standard)' },
    { id: 'bottom_wire', label: 'Under Snare, Aimed at Wires (Sizzle)' },
  ],
  inst_tom_drum: [
    { id: 'top_head', label: '1-2 in Over Rim, Aimed at Head (Attack)' },
    { id: 'between_toms', label: 'Between Two Toms (Shared, Saves Inputs)' },
    { id: 'bottom_head', label: 'Under, at Resonant Head (Boomy Sustain)' },
  ],
  inst_drum_cymbals: OVERHEAD_PAIR,
  inst_drum_set: [...OVERHEAD_PAIR, { id: 'drum_room', label: 'Drum Room Mic, 6-10 ft Back (Big, Roomy)' }],
  inst_hi_hat: [
    { id: 'hihat_edge', label: '3-4 in Above Edge, Aimed Away From Snare' },
    { id: 'hihat_far', label: '6-12 in Above and Back (Softer, Blends)' },
  ],
  inst_trumpet: [
    { id: 'bell_45', label: '8-12 in, Off-Axis From Bell (Smooth)' },
    { id: 'bell_center', label: 'On Bell Axis, 6-12 in (Bright, Can Overload)' },
    { id: 'back_2ft', label: '2 ft Back (Soft, Room Blend)' },
  ],
  inst_saxophone: [
    { id: 'upper_keys', label: '1 ft Out, Bell to Upper Keys (Balanced)' },
    { id: 'bell_45', label: 'Above Bell at 45° (Warm, More Body)' },
    { id: 'bell_center', label: 'Aimed Into Bell (Bright, Misses Key Sound)' },
  ],
  inst_flute: [
    { id: 'flute_mid', label: '6-12 in, Mouth to First Fingers (Balanced)' },
    { id: 'flute_embouchure', label: 'Near the Mouth Hole (Breathy, Close)' },
    { id: 'flute_distance', label: '1-2 ft Back (Natural, Less Breath Noise)' },
  ],
  inst_choir: [
    { id: 'choir_ortf', label: 'ORTF Pair, High and in Front (Natural Blend)' },
    { id: 'choir_spaced', label: 'Spaced Pair Across the Front (Wide)' },
    { id: 'choir_hanging', label: 'Hanging Above the Choir (Even Pickup)' },
  ],
  inst_acoustic_piano: [
    { id: 'spaced_lid', label: 'Spaced Pair Inside Lid, Bass + Treble (Wide)' },
    { id: 'hammers', label: 'Over the Hammers, Inside Lid (Bright Attack)' },
    { id: 'soundboard', label: 'Bass-String Side of Soundboard (Warm Lows)' },
    { id: 'outside_pair', label: 'Pair Out Past the Curve (Natural Room Blend)' },
  ],
};
// Same spots, different name
PLACEMENTS.ambient = PLACEMENTS.room;

// Dynamic mic placement options based on targeted source
export const getPlacementOptionsForTarget = (sourceDefId?: string): { id: string; label: string }[] =>
  (sourceDefId && PLACEMENTS[sourceDefId]) || GENERIC_PLACEMENTS;

/**
 * Readable name for a saved placement id, for the signal map and PDF. Looks in the source's own list first,
 * then every list (so an id saved before a list changed still reads), then falls back to the id itself.
 */
export const getPlacementLabel = (placementId?: string, sourceDefId?: string): string => {
  if (!placementId) return '';
  const own = getPlacementOptionsForTarget(sourceDefId).find((o) => o.id === placementId);
  if (own) return own.label;
  for (const list of [...Object.values(PLACEMENTS), GENERIC_PLACEMENTS]) {
    const hit = list.find((o) => o.id === placementId);
    if (hit) return hit.label;
  }
  return placementId.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
};
