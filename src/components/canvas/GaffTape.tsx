import React from 'react';
import { GaffStrip } from './cableRouting';

/**
 * Gaffer tape strips laid across cable bundles. Cloth tape: straight factory edges along its length,
 * ends torn nearly straight across (a little rough, not ragged), a faint weave, and each strip a hair off
 * square, the way a pro leaves it.
 */

export type TapeTone = 'white' | 'black';
/** Color of the tape on the plot: black, what venues use most (white also works: set TAPE_TONE to 'white'). */
export const TAPE_TONE: TapeTone = 'black';

const PALETTE: Record<TapeTone, { base: string; weaveA: string; weaveB: string; edge: string; shadow: number }> = {
  white: { base: '#f4f4f5', weaveA: '#ddd0bc', weaveB: '#e4e4e7', edge: '#b4b4bb', shadow: 0.45 },
  black: { base: '#17171a', weaveA: '#2c2c32', weaveB: '#222227', edge: '#6b6b75', shadow: 0.6 },
};

const TAPE_WIDTH = 11; // along the cables

/** Small deterministic random numbers, so a strip looks the same on every render. */
function rand(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function stripPoints(strip: GaffStrip): string {
  const r = rand(strip.seed + 7);
  const half = strip.length / 2;
  const hw = TAPE_WIDTH / 2;
  // u: across the bundle (the strip's length); v: along the cables (the strip's width)
  const pts: Array<[number, number]> = [];
  const tornEnd = (u: number, dir: 1 | -1) => {
    const steps = 3;
    for (let i = 0; i <= steps; i++) {
      const v = dir === 1 ? -hw + (2 * hw * i) / steps : hw - (2 * hw * i) / steps;
      const bite = (r() - 0.5) * 0.9; // a slightly rough edge
      pts.push([u + dir * bite, v]);
    }
  };
  tornEnd(half, 1); // one torn end
  tornEnd(-half, -1); // the other
  const angle = ((r() - 0.5) * 3 * Math.PI) / 180; // a hair off square
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return pts
    .map(([u, v]) => {
      // rotate, then map u/v onto x/y for the strip's direction
      const ru = u * cos - v * sin;
      const rv = u * sin + v * cos;
      const x = strip.orientation === 'v' ? strip.x + rv : strip.x + ru;
      const y = strip.orientation === 'v' ? strip.y + ru : strip.y + rv;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

export const GaffTape: React.FC<{ strips: GaffStrip[]; tone?: TapeTone }> = ({ strips, tone = TAPE_TONE }) => {
  if (strips.length === 0) return null;
  const c = PALETTE[tone];
  return (
    <g pointerEvents="none">
      <defs>
        {/* Faint cloth weave */}
        <pattern id="gaff-weave" width="3" height="3" patternUnits="userSpaceOnUse">
          <rect width="3" height="3" fill={c.base} />
          <path d="M0 0.5H3M0 2H3" stroke={c.weaveA} strokeWidth="0.45" />
          <path d="M1 0V3M2.5 0V3" stroke={c.weaveB} strokeWidth="0.3" />
        </pattern>
      </defs>
      {strips.map((strip, i) => {
        const pts = stripPoints(strip);
        return (
          <g key={i}>
            {/* soft shadow so the tape sits on top of the cables */}
            <polygon points={pts} fill="#000" fillOpacity={c.shadow} transform="translate(0.8 1)" />
            <polygon points={pts} fill="url(#gaff-weave)" stroke={c.edge} strokeWidth="0.5" strokeLinejoin="round" />
          </g>
        );
      })}
    </g>
  );
};
