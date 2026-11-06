import React from 'react';

/**
 * The paper floor of the plot. The world is drawn like a plan on warm paper, with just enough texture to say
 * "wood floor" (studio) or "painted stage deck" (live). Texture stays faint so labels, cables and gear stay legible.
 * `floor` picks the style: 'wood' (default), 'paper' (plain), 'graph' (graph paper).
 */
export type FloorStyle = 'wood' | 'paper' | 'graph';

export const PAPER_INK = '#5a4a36';

export function getFloorStyle(): FloorStyle {
  try {
    const v = new URLSearchParams(window.location.search).get('floor') || window.localStorage.getItem('audioplot:floor');
    if (v === 'paper' || v === 'graph' || v === 'wood') return v;
  } catch {
    /* ignore */
  }
  return 'wood';
}

interface Props {
  width: number;
  height: number;
  environment: 'recording_studio' | 'live_stage';
  style: FloorStyle;
}

export const CanvasFloor: React.FC<Props> = ({ width, height, environment, style }) => {
  const studio = environment === 'recording_studio';
  const base = studio ? '#e6dcc7' : '#d4ccbc';
  return (
    <>
      <defs>
        {/* Soft uneven tone, like paper or paint that is not perfectly flat */}
        <filter id="floor-mottle" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="3" seed="4" />
          <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.28  0 0 0 0 0.2  0 0 0 0.9 -0.28" />
        </filter>
        {/* Fine grain */}
        <filter id="floor-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9 0.7" numOctaves="2" seed="9" />
          <feColorMatrix values="0 0 0 0 0.3  0 0 0 0 0.24  0 0 0 0 0.16  0 0 0 0.8 -0.3" />
        </filter>
        <pattern id="floor-planks" width="240" height="56" patternUnits="userSpaceOnUse">
          <rect width="240" height="56" fill="#e6dcc7" />
          <rect x="0" y="0" width="150" height="28" fill="#e8ddc8" />
          <rect x="150" y="0" width="90" height="28" fill="#e3d8c1" />
          <rect x="0" y="28" width="70" height="28" fill="#e3d8c1" />
          <rect x="70" y="28" width="170" height="28" fill="#e8ddc8" />
          <g stroke="#bfae8b" strokeWidth="0.9" strokeOpacity="0.75">
            <line x1="0" y1="0" x2="240" y2="0" />
            <line x1="0" y1="28" x2="240" y2="28" />
            <line x1="150" y1="0" x2="150" y2="28" />
            <line x1="70" y1="28" x2="70" y2="56" />
          </g>
          <g stroke="#b9a782" strokeWidth="0.6" strokeOpacity="0.35" fill="none">
            <path d="M12 9 q30 -3 58 0" />
            <path d="M170 18 q24 3 50 0" />
            <path d="M90 40 q40 -3 70 1" />
            <path d="M10 46 q20 3 40 0" />
          </g>
        </pattern>
        <pattern id="floor-graph-fine" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke="#b9a782" strokeWidth="0.6" strokeOpacity="0.45" />
        </pattern>
        <pattern id="floor-graph-bold" width="120" height="120" patternUnits="userSpaceOnUse">
          <path d="M120 0H0V120" fill="none" stroke="#a8946b" strokeWidth="1" strokeOpacity="0.5" />
        </pattern>
        <radialGradient id="floor-vignette" cx="50%" cy="48%" r="70%">
          <stop offset="60%" stopColor="#5a4a36" stopOpacity="0" />
          <stop offset="100%" stopColor="#5a4a36" stopOpacity="0.14" />
        </radialGradient>
      </defs>

      <rect width="100%" height="100%" fill={base} />
      {style === 'wood' && studio && <rect width="100%" height="100%" fill="url(#floor-planks)" />}
      {style === 'graph' && (
        <>
          <rect width="100%" height="100%" fill="url(#floor-graph-fine)" />
          <rect width="100%" height="100%" fill="url(#floor-graph-bold)" />
        </>
      )}
      <rect width="100%" height="100%" filter="url(#floor-mottle)" opacity={studio ? 0.12 : 0.4} />
      <rect width="100%" height="100%" filter="url(#floor-grain)" opacity={studio ? 0.1 : 0.22} />
      <rect width="100%" height="100%" fill="url(#floor-vignette)" />

      {studio ? (
        <>
          <rect x="16" y="16" width={width - 32} height={height - 32} rx="16" fill="none" stroke="#8f6620" strokeWidth="1.5" strokeDasharray="8 6" strokeOpacity="0.55" />
          <text x={width / 2} y={height - 30} textAnchor="middle" fill="#2f5f7a" fontSize="10" fontWeight="bold" letterSpacing="1.5">
            CONTROL ROOM WINDOW
          </text>
          <rect x={width / 2 - 150} y={height - 20} width="300" height="12" rx="3" fill="#2f5f7a" fillOpacity="0.22" stroke="#2f5f7a" strokeWidth="1.5" />
        </>
      ) : (
        <>
          <rect x="16" y="16" width={width - 32} height={height - 32} rx="12" fill="none" stroke="#8f3f25" strokeWidth="1.5" strokeDasharray="8 6" strokeOpacity="0.5" />
          <text x={width / 2} y="28" textAnchor="middle" fill={PAPER_INK} fillOpacity="0.8" fontSize="9" fontWeight="bold" letterSpacing="1.5">
            UPSTAGE BACKDROP
          </text>
          <line x1="20" y1={height - 18} x2={width - 20} y2={height - 18} stroke="#8f3f25" strokeWidth="2" strokeDasharray="6 4" strokeOpacity="0.6" />
          <text x={width / 2} y={height - 24} textAnchor="middle" fill="#8f3f25" fontSize="9" fontWeight="bold" letterSpacing="1">
            AUDIENCE / FRONT-OF-HOUSE
          </text>
        </>
      )}
    </>
  );
};
