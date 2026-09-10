import React from 'react';
import { CableType } from '../../types';
import { StudioIcon } from '../StudioIcons';
import { AlertTriangle, Cable, X } from 'lucide-react';

interface CableHooksProps {
  activeCableTool: CableType | null;
  onSelectCableTool: (type: CableType | null) => void;
  isXlrHighlighted?: boolean;
  isQuarterInchHighlighted?: boolean;
}

export const CableHooks: React.FC<CableHooksProps> = ({
  activeCableTool,
  onSelectCableTool,
  isXlrHighlighted = false,
  isQuarterInchHighlighted = false,
}) => {
  return (
    <div className="absolute top-4 left-4 z-30 flex flex-row-reverse items-start gap-2.5">
      {/* Cable Hooks Panel: Stacked Vertically */}
      <div
        id="cable-hooks-panel"
        onClick={(e) => e.stopPropagation()}
        className="bg-black/80 backdrop-blur-xl border border-white/15 rounded-2xl p-2 shadow-2xl flex flex-col gap-2 shrink-0"
      >
        {/* XLR Cable Hook with Plug Icon */}
        <button
          id="btn-cable-hook-xlr"
          onClick={() => {
            onSelectCableTool(activeCableTool === 'xlr' ? null : 'xlr');
          }}
          className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all backdrop-blur-md cursor-pointer ${
            isXlrHighlighted || activeCableTool === 'xlr'
              ? 'bg-orange-500 border-orange-300 text-stone-950 shadow-2xl shadow-orange-500/80 ring-4 ring-orange-400 animate-bounce'
              : 'bg-white/5 hover:bg-white/10 border-white/10 text-orange-400 hover:border-orange-400/40'
          }`}
          title="Pick up an XLR Balanced Cable for Mics & DIs (Click or Click+Drag between snake and mic/DI)"
        >
          <div className="w-5 h-5 flex items-center justify-center shrink-0">
            <StudioIcon iconType="XlrConnector" size={20} />
          </div>
          <span>XLR Cable</span>
        </button>

        {/* 1/4" TS Instrument Cable Hook with Plug Icon */}
        <button
          id="btn-cable-hook-quarter-inch"
          onClick={() => {
            onSelectCableTool(activeCableTool === 'quarter_inch' ? null : 'quarter_inch');
          }}
          className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all backdrop-blur-md cursor-pointer ${
            isQuarterInchHighlighted || activeCableTool === 'quarter_inch'
              ? 'bg-sky-500 border-sky-300 text-stone-950 shadow-2xl shadow-sky-500/80 ring-4 ring-sky-400 animate-bounce'
              : 'bg-white/5 hover:bg-white/10 border-white/10 text-sky-400 hover:border-sky-400/40'
          }`}
          title="Pick up a 1/4&quot; TS Instrument Cable for Electric Guitars, Bass, Keys, and Amps"
        >
          <div className="w-5 h-5 flex items-center justify-center shrink-0">
            <StudioIcon iconType="QuarterInchPlug" size={20} />
          </div>
          <span>1/4&quot; Cable</span>
        </button>
      </div>
    </div>
  );
};
