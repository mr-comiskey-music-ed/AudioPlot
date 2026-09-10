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
export const getSnakeBoxBounds = (environment: EnvironmentMode, canvasWidth: number = 1000, canvasHeight: number = 650) => {
  if (environment === 'live_stage') {
    const snakeBoxW = 490;
    const snakeBoxH = 144;
    const snakeX = Math.max(10, (canvasWidth - snakeBoxW) / 2);
    const snakeY = 16;
    return { x: snakeX, y: snakeY, w: snakeBoxW, h: snakeBoxH };
  } else {
    const snakeBoxW = 320;
    const snakeBoxH = 144;
    const snakeX = Math.max(10, (canvasWidth - snakeBoxW) / 2);
    const snakeY = 16;
    return { x: snakeX, y: snakeY, w: snakeBoxW, h: snakeBoxH };
  }
};

// Calculate coordinates of Snake Box Channel Socket (Inputs 1-8)
export const getSnakeChannelPosition = (
  chNum: number,
  environment: EnvironmentMode,
  canvasWidth: number = 1000,
  canvasHeight: number = 650
) => {
  const box = getSnakeBoxBounds(environment, canvasWidth, canvasHeight);
  if (environment === 'live_stage') {
    const gridX = box.x + 12;
    const gridY = box.y + 36;
    const colIndex = (chNum - 1) % 4;
    const rowIndex = Math.floor((chNum - 1) / 4);
    const colWidth = 66;
    const rowHeight = 44;
    return {
      x: gridX + colIndex * (colWidth + 4) + colWidth / 2,
      y: gridY + rowIndex * (rowHeight + 6) + 14,
    };
  } else {
    const gridX = box.x + 12;
    const gridY = box.y + 36;
    const colIndex = (chNum - 1) % 4;
    const rowIndex = Math.floor((chNum - 1) / 4);
    const colWidth = (box.w - 24 - 18) / 4;
    const rowHeight = 44;
    return {
      x: gridX + colIndex * (colWidth + 6) + colWidth / 2,
      y: gridY + rowIndex * (rowHeight + 6) + 14,
    };
  }
};

// Calculate coordinates of Snake Output Sockets (Live Stage: MON 1, MON 2, MAIN L, MAIN R)
export const getSnakeOutputPosition = (
  outputPort: 'mon1' | 'mon2' | 'main_l' | 'main_r',
  environment: EnvironmentMode,
  canvasWidth: number = 1000,
  canvasHeight: number = 650
) => {
  const box = getSnakeBoxBounds(environment, canvasWidth, canvasHeight);
  const outGridX = box.x + 308;
  const outGridY = box.y + 36;
  const colWidth = 78;
  const rowHeight = 44;

  if (outputPort === 'mon1') {
    return { x: outGridX + colWidth / 2, y: outGridY + 14 };
  } else if (outputPort === 'mon2') {
    return { x: outGridX + (colWidth + 6) + colWidth / 2, y: outGridY + 14 };
  } else if (outputPort === 'main_l') {
    return { x: outGridX + colWidth / 2, y: outGridY + (rowHeight + 6) + 14 };
  } else {
    return { x: outGridX + (colWidth + 6) + colWidth / 2, y: outGridY + (rowHeight + 6) + 14 };
  }
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

// Dynamic mic placement options based on targeted source
export const getPlacementOptionsForTarget = (sourceDefId?: string): { id: string; label: string }[] => {
  if (!sourceDefId) {
    return [
      { id: 'on_axis', label: 'On-Axis (Direct)' },
      { id: 'off_axis_45', label: 'Off-Axis (45° Angle)' },
      { id: 'distant_room', label: 'Distant Room (1-2 ft)' },
    ];
  }

  if (sourceDefId === 'room' || sourceDefId === 'ambient') {
    return [
      { id: 'corner', label: 'Corner Placement (Bass Trap / Room Reinforcement)' },
      { id: 'wall_reflection', label: 'Wall Reflection Boundary' },
      { id: 'hallway', label: 'Hallway / Extended Ambience' },
    ];
  }

  if (sourceDefId === 'gear_guitar_amp') {
    return [
      { id: 'cone_center', label: 'Cone Center (Bright Edge)' },
      { id: 'cone_edge', label: 'Cone Edge (Warm Body)' },
      { id: 'angle_45', label: '45° Off-Axis (Smooth Highs)' },
      { id: 'open_back', label: 'Cabinet Back (Open Back)' },
    ];
  }

  if (sourceDefId === 'gear_bass_amp') {
    return [
      { id: 'cone_center', label: 'Cone Center (Punch)' },
      { id: 'cone_edge', label: 'Cone Edge (Deep Lows)' },
      { id: 'direct_port', label: 'Front Bass Port' },
    ];
  }

  if (sourceDefId === 'inst_acoustic_guitar') {
    return [
      { id: 'fret_12', label: '12th Fret (Balanced Clarity)' },
      { id: 'soundhole', label: 'Soundhole (Full Resonance)' },
      { id: 'bridge', label: 'Bridge / Lower Bout (Crisp Attack)' },
    ];
  }

  if (sourceDefId === 'inst_double_bass') {
    return [
      { id: 'bridge_fhole', label: '6-8" Off Bridge / F-Hole (Warm & Articulate)' },
      { id: 'fingerboard', label: 'Near Fingerboard (Attack & Slap Click)' },
      { id: 'lower_bout', label: 'Lower Bout / Body (Deep Wood Resonance)' },
    ];
  }

  if (sourceDefId === 'inst_voice') {
    return [
      { id: 'direct_4_6', label: '4-6" Direct (Center)' },
      { id: 'off_axis_sibilance', label: 'Slight Off-Axis (Sibilance Control)' },
      { id: 'room_air', label: '1-2 ft Distance (Natural Room Air)' },
    ];
  }

  if (sourceDefId === 'inst_kick_drum') {
    return [
      { id: 'inside_port', label: 'Inside Port (Beater Attack)' },
      { id: 'resonant_head', label: 'Front Resonant Head (Sub Boom)' },
      { id: 'boundary_center', label: 'Internal Boundary Pillow' },
    ];
  }

  if (sourceDefId === 'inst_snare_drum') {
    return [
      { id: 'top_rim', label: 'Top Head (1" Above Rim)' },
      { id: 'bottom_wire', label: 'Bottom Snare Wires (Sizzle)' },
    ];
  }

  if (sourceDefId === 'inst_drum_cymbals' || sourceDefId === 'inst_hi_hat') {
    return [
      { id: 'xy_pair', label: 'Overhead XY Coincident Pair' },
      { id: 'spaced_ab', label: 'Spaced Pair A/B' },
      { id: 'hihat_edge', label: 'Hi-Hats Edge (3" Above Top Cymbal)' },
    ];
  }

  if (sourceDefId === 'inst_trumpet' || sourceDefId === 'inst_saxophone') {
    return [
      { id: 'bell_center', label: 'Direct Bell 6" (Crisp)' },
      { id: 'bell_45', label: '45° Off-Bell (Warm/Smooth)' },
    ];
  }

  if (sourceDefId === 'inst_violin') {
    return [
      { id: 'bridge_fholes', label: '6" Above Bridge / F-Holes' },
      { id: 'bow_contact', label: 'Bowing Contact Zone' },
    ];
  }

  if (sourceDefId === 'inst_acoustic_piano') {
    return [
      { id: 'hammers', label: 'Over Damper Hammers' },
      { id: 'soundboard', label: 'Soundboard Lower Strings' },
      { id: 'spaced_lid', label: 'Spaced Stereo Lid' },
    ];
  }

  return [
    { id: 'on_axis', label: 'On-Axis (Direct)' },
    { id: 'off_axis_45', label: 'Off-Axis (45° Angle)' },
    { id: 'distant_room', label: 'Distant Room (1-2 ft)' },
  ];
};
