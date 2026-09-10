import React from 'react';
import { AlertTriangle, ArrowRight, RotateCcw, X } from 'lucide-react';
import { EnvironmentMode } from '../types';

interface ModeSwitchModalProps {
  isOpen: boolean;
  targetMode: EnvironmentMode | null;
  currentMode: EnvironmentMode;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ModeSwitchModal: React.FC<ModeSwitchModalProps> = ({
  isOpen,
  targetMode,
  currentMode,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen || !targetMode || targetMode === currentMode) return null;

  const targetTitle = targetMode === 'live_stage' ? 'Live Stage' : 'Recording Studio';
  const currentTitle = currentMode === 'live_stage' ? 'Live Stage' : 'Recording Studio';

  return (
    <div
      id="mode-switch-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div
        id="mode-switch-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-stone-900/95 border border-amber-500/40 rounded-2xl p-6 shadow-2xl text-stone-100 relative overflow-hidden"
      >
        {/* Subtle Top Glow Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600" />

        {/* Modal Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-white">
                Switch Project Mode?
              </h3>
              <p className="text-xs text-amber-400 font-bold">
                {currentTitle} <ArrowRight className="inline w-3 h-3 mx-0.5" /> {targetTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Prompt Question */}
        <div className="p-4 rounded-xl bg-black/40 border border-white/10 mb-4">
          <p className="text-sm font-semibold text-stone-200 leading-relaxed">
            Would you like to clear your plot and switch to{' '}
            <span className="text-amber-400 font-bold">&quot;{targetTitle} mode&quot;</span>?
          </p>
          <p className="text-xs text-stone-400 mt-2 leading-relaxed">
            Each mode operates as a distinct production project with specialized snake routing,
            monitoring configurations, and gear requirements. Switching will reset the stage plot,
            cables, and mixer channels.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            id="btn-cancel-mode-switch"
            type="button"
            onClick={onCancel}
            className="whitespace-nowrap px-4 py-2.5 rounded-xl text-xs font-bold text-stone-300 hover:text-white hover:bg-white/10 border border-white/10 transition-colors shrink-0"
          >
            Keep Current Plot
          </button>
          <button
            id="btn-confirm-mode-switch"
            type="button"
            onClick={onConfirm}
            className="whitespace-nowrap px-4 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 shadow-lg shadow-orange-500/20 transition-colors flex items-center gap-1.5 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">Clear Plot & Switch to {targetTitle}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
