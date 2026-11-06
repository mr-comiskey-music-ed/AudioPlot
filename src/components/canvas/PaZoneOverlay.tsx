import React from 'react';
import { CheckCircle2, Speaker } from 'lucide-react';
import { PlacedGear } from '../../types';
import { getPaZones, PaZoneSide, getPaZone, StageSize } from './stageGeometry';

interface PaZoneOverlayProps {
  placedGear: PlacedGear[];
  selectedItemId: string | null;
  draggingId: string | null;
  stageSize?: StageSize;
}

/**
 * Draws the two downstage PA zones on the live stage floor so students can see
 * exactly where the main speakers are expected. A zone turns green once a PA
 * speaker's center is inside it, and glows while a PA speaker is being moved.
 */
export const PaZoneOverlay: React.FC<PaZoneOverlayProps> = ({ placedGear, selectedItemId, draggingId, stageSize }) => {
  const paSpeakers = placedGear.filter((g) => g.gearId === 'gear_pa_speaker');
  const activePa = paSpeakers.find((g) => g.instanceId === selectedItemId || g.instanceId === draggingId);

  return (
    <>
      {(['left', 'right'] as PaZoneSide[]).map((side) => {
        const zone = getPaZones(stageSize)[side];
        const isFilled = paSpeakers.some((g) => getPaZone(g, stageSize) === side);
        const isTarget = !!activePa && !isFilled;
        const output = side === 'left' ? 'MAIN L' : 'MAIN R';

        return (
          <div
            key={side}
            data-pa-zone={side}
            className={`absolute pointer-events-none rounded-2xl border-2 border-dashed transition-colors duration-200 ${
              isFilled
                ? 'border-emerald-700/70 bg-emerald-700/[0.10]'
                : isTarget
                ? 'border-amber-600 bg-amber-500/[0.18] animate-pulse'
                : 'border-sky-700/60 bg-sky-700/[0.07]'
            }`}
            style={{ left: zone.x, top: zone.y, width: zone.w, height: zone.h }}
          >
            <div
              className={`absolute top-2 ${side === 'left' ? 'left-3' : 'right-3'} flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider ${
                isFilled ? 'text-emerald-800' : isTarget ? 'text-amber-800' : 'text-sky-800'
              }`}
            >
              {isFilled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Speaker className="w-3.5 h-3.5" />}
              <span>PA {side === 'left' ? 'Left' : 'Right'} Zone</span>
              <span className="font-bold normal-case tracking-normal opacity-80">→ {output}</span>
            </div>
          </div>
        );
      })}
    </>
  );
};
