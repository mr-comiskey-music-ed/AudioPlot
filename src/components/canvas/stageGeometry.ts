import { PlacedGear } from '../../types';
import { getGearBoxDimensions } from './canvasMath';

/**
 * The studio floor / stage is a fixed-size "world". Gear positions are stored in
 * these units, so a plot looks (and grades) the same on every screen. The canvas
 * scales the world to fit the window, and the zoom controls scale it further.
 */
export const WORLD = { width: 1120, height: 700 };

export type PaZoneSide = 'left' | 'right';

export interface StageZone {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Where the main PA speakers belong on the live stage: the two downstage
 * (audience-side) corners. A PA speaker counts as placed when its center sits
 * inside one of these boxes. The live stage draws these boxes on the floor.
 */
export const PA_ZONES: Record<PaZoneSide, StageZone> = {
  left: { x: 24, y: 466, w: 330, h: 208 },
  right: { x: WORLD.width - 24 - 330, y: 466, w: 330, h: 208 },
};

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
export function getPaZone(item: PlacedGear): PaZoneSide | null {
  const c = getItemCenter(item);
  for (const side of ['left', 'right'] as PaZoneSide[]) {
    const z = PA_ZONES[side];
    if (c.x >= z.x && c.x <= z.x + z.w && c.y >= z.y && c.y <= z.y + z.h) return side;
  }
  return null;
}
