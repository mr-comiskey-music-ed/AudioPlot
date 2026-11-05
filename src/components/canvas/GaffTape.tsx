import React from 'react';
import { GaffStrip } from './cableRouting';

/**
 * Gaffer tape strips laid across cable bundles. Light gray cloth tape: straight factory edges along
 * its length, hand-torn ragged ends, a faint weave, and each strip a few degrees off square, the way
 * it ends up when someone tapes cables down in a hurry.
 */

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
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const v = dir === 1 ? -hw + (2 * hw * i) / steps : hw - (2 * hw * i) / steps;
      const bite = (r() - 0.35) * 2.6; // ragged tear, mostly outward
      pts.push([u + dir * bite, v]);
    }
  };
  tornEnd(half, 1); // one torn end
  tornEnd(-half, -1); // the other
  const angle = ((r() - 0.5) * 9 * Math.PI) / 180; // a few degrees off square
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

export const GaffTape: React.FC<{ strips: GaffStrip[] }> = ({ strips }) => {
  if (strips.length === 0) return null;
  return (
    <g pointerEvents="none">
      <defs>
        {/* Faint cloth weave */}
        <pattern id="gaff-weave" width="3" height="3" patternUnits="userSpaceOnUse">
          <rect width="3" height="3" fill="#cfcfd4" />
          <path d="M0 0.5H3M0 2H3" stroke="#a8a8ae" strokeWidth="0.45" />
          <path d="M1 0V3M2.5 0V3" stroke="#b9b9bf" strokeWidth="0.3" />
        </pattern>
      </defs>
      {strips.map((strip, i) => {
        const pts = stripPoints(strip);
        return (
          <g key={i}>
            {/* soft shadow so the tape sits on top of the cables */}
            <polygon points={pts} fill="#000" fillOpacity="0.35" transform="translate(0.8 1)" />
            <polygon points={pts} fill="url(#gaff-weave)" stroke="#8d8d94" strokeWidth="0.5" strokeLinejoin="round" opacity="0.94" />
          </g>
        );
      })}
    </g>
  );
};
