import React from 'react';
import { Expand } from 'lucide-react';
import { EnvironmentMode } from '../../types';
import { STAGE_SIZES, StageSize } from './stageGeometry';

interface StageSizeControlProps {
  environment: EnvironmentMode;
  value: StageSize;
  onChange: (size: StageSize) => void;
}

/**
 * Makes the room/stage itself bigger so there is floor space for more
 * musicians and gear. Everything already placed keeps its spot.
 */
export const StageSizeControl: React.FC<StageSizeControlProps> = ({ environment, value, onChange }) => {
  const noun = environment === 'live_stage' ? 'Stage' : 'Room';
  return (
    <div
      id="stage-size-control"
      data-no-marquee
      className="absolute bottom-4 right-4 z-40 flex items-center gap-1 p-1 rounded-xl bg-stone-950/90 border border-white/15 shadow-2xl backdrop-blur-md select-none"
      title={`Make the ${noun.toLowerCase()} bigger to fit more musicians and gear`}
    >
      <span className="flex items-center gap-1 pl-1.5 pr-1 text-[10px] font-black uppercase tracking-wider text-stone-400">
        <Expand className="w-3.5 h-3.5" />
        {noun} size
      </span>
      {STAGE_SIZES.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          title={`${s.label} ${noun.toLowerCase()}`}
          className={`h-7 min-w-7 px-2 rounded-lg text-[11px] font-black transition-colors cursor-pointer ${
            value === s.id ? 'bg-orange-500 text-stone-950' : 'text-stone-300 hover:text-white hover:bg-white/10'
          }`}
        >
          {s.id === 'standard' ? 'S' : s.id === 'large' ? 'L' : 'XL'}
        </button>
      ))}
    </div>
  );
};
