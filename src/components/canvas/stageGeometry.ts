import { PlacedGear } from '../../types';
import { getGearBoxDimensions } from './canvasMath';

/**
 * The studio floor / stage is a fixed-size "world". Gear positions are stored in
 * these units, so a plot looks (and grades) the same on every screen. The canvas
 * scales the world to fit the window.
 *
 * Students can make the room bigger (more floor for more musicians). Gear keeps
 * its size in world units, so on screen everything gets smaller and there is
 * more empty floor to work with.
 */
export type StageSize = 'standard' | 'large' | 'xl';

export const STAGE_SIZES: { id: StageSize; label: string; scale: number }[] = [
  { id: 'standard', label: 'Standard', scale: 1 },
  { id: 'large', label: 'Large', scale: 1.3 },
  { id: 'xl', label: 'Extra Large', scale: 1.6 },
];

const BASE = { width: 1120, height: 700 };

/** Standard room (used when nothing else is specified, e.g. older plots). */
export const WORLD = BASE;

export function getWorld(size?: StageSize | null): { width: number; height: number } {
  const s = STAGE_SIZES.find((x) => x.id === size)?.scale ?? 1;
  return { width: Math.round(BASE.width * s), height: Math.round(BASE.height * s) };
}

export type PaZoneSide = 'left' | 'right';

export interface StageZone {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ZONE_W = 210;
const ZONE_H = 208;
const ZONE_MARGIN = 24;

/**
 * Where the main PA speakers belong on the live stage: the two downstage
 * (audience-side) corners. A PA speaker counts as placed when its center sits
 * inside one of these boxes. The live stage draws these boxes on the floor.
 */
export function getPaZones(size?: StageSize | null): Record<PaZoneSide, StageZone> {
  const w = getWorld(size);
  const y = w.height - ZONE_MARGIN - ZONE_H - 2;
  return {
    left: { x: ZONE_MARGIN, y, w: ZONE_W, h: ZONE_H },
    right: { x: w.width - ZONE_MARGIN - ZONE_W, y, w: ZONE_W, h: ZONE_H },
  };
}

export function getItemCenter(item: PlacedGear): { x: number; y: number } {
  const dims = getGearBoxDimensions(
    item.gearId,
    !!item.latchedSourceInstanceId,
    item.customScale,
    item.customWidth,
    item.customHeight
  );
  return { x: item.x + dims.width / 2, y: item.y + dims.height / 2 };
}

/** Which PA zone (if any) the item's center is inside. */
export function getPaZone(item: PlacedGear, size?: StageSize | null): PaZoneSide | null {
  const c = getItemCenter(item);
  const zones = getPaZones(size);
  for (const side of ['left', 'right'] as PaZoneSide[]) {
    const z = zones[side];
    if (c.x >= z.x && c.x <= z.x + z.w && c.y >= z.y && c.y <= z.y + z.h) return side;
  }
  return null;
}
