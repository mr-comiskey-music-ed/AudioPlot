import React from 'react';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';

interface ZoomControlsProps {
  zoom: number;
  min: number;
  max: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({ zoom, min, max, onZoomIn, onZoomOut, onFit }) => {
  const btn =
    'w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-stone-300 hover:text-white hover:bg-white/10';

  return (
    <div
      id="canvas-zoom-controls"
      data-no-marquee
      className="absolute bottom-4 right-4 z-40 flex items-center gap-0.5 p-1 rounded-xl bg-stone-950/90 border border-white/15 shadow-2xl backdrop-blur-md select-none"
      title="Zoom the stage (Ctrl + scroll or pinch also works)"
    >
      <button className={btn} onClick={onZoomOut} disabled={zoom <= min} title="Zoom out">
        <ZoomOut className="w-4 h-4" />
      </button>
      <span className="w-11 text-center text-[11px] font-black tabular-nums text-stone-200">
        {Math.round(zoom * 100)}%
      </span>
      <button className={btn} onClick={onZoomIn} disabled={zoom >= max} title="Zoom in">
        <ZoomIn className="w-4 h-4" />
      </button>
      <div className="w-px h-5 bg-white/10 mx-0.5" />
      <button
        className={`${btn} w-auto px-2 gap-1 text-[11px] font-bold`}
        onClick={onFit}
        disabled={zoom === min}
        title="Fit the whole stage on screen"
      >
        <Maximize2 className="w-3.5 h-3.5" />
        <span>Fit</span>
      </button>
    </div>
  );
};
