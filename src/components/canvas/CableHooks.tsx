import React from 'react';
import { CableType } from '../../types';
import { StudioIcon } from '../StudioIcons';
import { AlertTriangle, Cable, X } from 'lucide-react';

interface CableHooksProps {
  activeCableTool: CableType | null;
  onSelectCableTool: (type: CableType | null) => void;
  isXlrHighlighted?: boolean;
  isQuarterInchHighlighted?: boolean;
  /** The Stereo Breakout (1/8" to two 1/4") shows only while a Laptop / Phone is on the plot */
  showBreakout?: boolean;
}

export const CableHooks: React.FC<CableHooksProps> = ({
  activeCableTool,
  onSelectCableTool,
  isXlrHighlighted = false,
  isQuarterInchHighlighted = false,
  showBreakout = false,
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
            activeCableTool === 'xlr'
              ? 'bg-orange-500 border-orange-300 text-stone-950 shadow-2xl shadow-orange-500/80 ring-4 ring-orange-400'
              : isXlrHighlighted
              ? 'bg-orange-500/10 border-orange-400 border-dashed text-orange-300 ring-2 ring-orange-400/60 animate-pulse'
              : 'bg-white/5 hover:bg-white/10 border-white/10 text-orange-400 hover:border-orange-400/40'
          }`}
          title="Pick up an XLR Balanced Cable for Mics & DIs (Click or Click+Drag between snake and mic/DI)"
        >
          <div className="w-5 h-5 flex items-center justify-center shrink-0">
            <StudioIcon iconType="XlrConnector" size={20} />
          </div>
          <span>{activeCableTool === 'xlr' ? 'XLR in hand' : 'XLR Cable'}</span>
        </button>

        {/* 1/4" TS Instrument Cable Hook with Plug Icon */}
        <button
          id="btn-cable-hook-quarter-inch"
          onClick={() => {
            onSelectCableTool(activeCableTool === 'quarter_inch' ? null : 'quarter_inch');
          }}
          className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all backdrop-blur-md cursor-pointer ${
            activeCableTool === 'quarter_inch'
              ? 'bg-sky-500 border-sky-300 text-stone-950 shadow-2xl shadow-sky-500/80 ring-4 ring-sky-400'
              : isQuarterInchHighlighted
              ? 'bg-sky-500/10 border-sky-400 border-dashed text-sky-300 ring-2 ring-sky-400/60 animate-pulse'
              : 'bg-white/5 hover:bg-white/10 border-white/10 text-sky-400 hover:border-sky-400/40'
          }`}
          title="Pick up a 1/4&quot; TS Instrument Cable for Electric Guitars, Bass, Keys, and Amps"
        >
          <div className="w-5 h-5 flex items-center justify-center shrink-0">
            <StudioIcon iconType="QuarterInchPlug" size={20} />
          </div>
          <span>{activeCableTool === 'quarter_inch' ? '1/4" in hand' : '1/4" Cable'}</span>
        </button>

        {showBreakout && (
          <button
            id="btn-cable-hook-breakout"
            onClick={() => {
              onSelectCableTool(activeCableTool === 'breakout' ? null : 'breakout');
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all backdrop-blur-md cursor-pointer ${
              activeCableTool === 'breakout'
                ? 'bg-purple-500 border-purple-300 text-stone-950 shadow-2xl shadow-purple-500/80 ring-4 ring-purple-400'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-purple-300 hover:border-purple-400/40'
            }`}
            title='Stereo Breakout: 1/8" (3.5 mm) stereo plug to two 1/4" plugs (L and R). From a Laptop / Phone headphone out into a DI.'
          >
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              <StudioIcon iconType="BreakoutCable" size={20} />
            </div>
            <span className="text-left leading-tight">
              {activeCableTool === 'breakout' ? 'Breakout in hand' : 'Stereo Breakout'}
              <span className="block text-[9px] font-semibold opacity-70">1/8" → 2× 1/4"</span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
