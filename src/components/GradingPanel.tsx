import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MinusCircle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Award,
  Activity,
  ListChecks,
  FileText,
  Download,
} from 'lucide-react';
import {
  RubricEvaluation,
  PlacedGear,
  CableConnection,
  MixerChannelState,
  EnvironmentMode,
} from '../types';
import { SignalFlowMap } from './SignalFlowMap';

interface GradingPanelProps {
  evaluation: RubricEvaluation;
  placedGear?: PlacedGear[];
  connections?: CableConnection[];
  mixerChannels?: MixerChannelState[];
  environment?: EnvironmentMode;
  selectedItemId?: string | null;
  onSelectItem?: (id: string | null) => void;
  onUpdateChannel?: (channelNumber: number, updates: Partial<MixerChannelState>) => void;
  isPlayingAudio?: boolean;
  onOpenShareModal?: () => void;
  onPrintReport?: () => void;
  onExportPdf?: () => void;
  onOpenGuideModal?: () => void;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

export const GradingPanel: React.FC<GradingPanelProps> = ({
  evaluation,
  placedGear = [],
  connections = [],
  mixerChannels = [],
  environment = 'recording_studio',
  selectedItemId,
  onSelectItem,
  onUpdateChannel,
  isPlayingAudio = false,
  onOpenShareModal,
  onExportPdf,
  isExpanded: propIsExpanded,
  onToggleExpanded,
}) => {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = propIsExpanded !== undefined ? propIsExpanded : internalExpanded;
  const setIsExpanded = (val: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof val === 'function' ? val(isExpanded) : val;
    if (onToggleExpanded) {
      onToggleExpanded();
    } else {
      setInternalExpanded(nextVal);
    }
  };
  const [activeTab, setActiveTab] = useState<'rubric' | 'flow'>('rubric');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getStatusIcon = (status: 'perfect' | 'warning' | 'error' | 'not_applicable') => {
    switch (status) {
      case 'perfect':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'not_applicable':
        return <MinusCircle className="w-4 h-4 text-stone-500 shrink-0" />;
    }
  };

  if (!isExpanded) {
    const isHigh = evaluation.percentage >= 90;
    const isMedium = evaluation.percentage >= 70 && evaluation.percentage < 90;

    return (
      <div
        id="grading-rubric-collapsed-bar"
        onClick={() => setIsExpanded(true)}
        className="w-14 bg-stone-950/90 hover:bg-stone-900/95 cursor-pointer backdrop-blur-xl border-l border-white/10 flex flex-col items-center py-4 text-stone-200 select-none z-20 shrink-0 transition-all group shadow-2xl relative h-full"
        title="Click anywhere to expand Progress Bar & Signal Flow Map"
      >
        {/* Top Controls & Badges */}
        <div className="flex flex-col items-center z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(true);
            }}
            className="p-2 rounded-xl bg-white/5 group-hover:bg-orange-500/20 text-stone-300 group-hover:text-orange-300 border border-white/10 group-hover:border-orange-500/40 mb-3 transition-all cursor-pointer"
            title="Expand Progress Bar & Signal Flow Map"
          >
            <ChevronLeft className="w-5 h-5 text-orange-400 group-hover:scale-110 transition-transform" />
          </button>

          {/* Prominent Circular/Squircle Progress Badge */}
          <div className="relative flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-2xl flex flex-col items-center justify-center font-black border-2 transition-all group-hover:scale-110 ${
                isHigh
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.5)] ring-2 ring-emerald-400/30'
                  : isMedium
                  ? 'bg-orange-950/90 text-orange-300 border-orange-400 shadow-[0_0_16px_rgba(251,146,60,0.5)] ring-2 ring-orange-400/30'
                  : 'bg-rose-950/90 text-rose-300 border-rose-400 shadow-[0_0_16px_rgba(244,63,94,0.5)] ring-2 ring-rose-400/30'
              }`}
            >
              <span className="text-[12px] font-black tracking-tight leading-none">{evaluation.percentage}%</span>
            </div>

            {/* Mini vertical progress meter */}
            <div className="w-1.5 h-12 bg-white/10 rounded-full overflow-hidden mt-2.5 border border-white/10 flex flex-col justify-end">
              <div
                className={`w-full rounded-full transition-all duration-300 ${
                  isHigh
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]'
                    : isMedium
                    ? 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.9)]'
                    : 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.9)]'
                }`}
                style={{ height: `${Math.max(6, evaluation.percentage)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Vertically Re-Centered Progress Bar Text across the entire vertical height */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="rotate-90 whitespace-nowrap text-xs font-black uppercase tracking-widest text-stone-400 group-hover:text-stone-100 transition-colors">
            Progress & Signal Map
          </span>
        </div>
      </div>
    );
  }

  return (
    <aside
      id="grading-rubric-panel"
      className="w-84 md:w-96 bg-black/80 backdrop-blur-2xl border-l border-white/10 flex flex-col h-full text-stone-200 select-none shadow-2xl z-20 shrink-0 relative transition-all"
    >
      {/* Header */}
      <div className="p-3 border-b border-white/10 bg-black/30 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-orange-400" />
          <h2 className="text-xs font-black uppercase tracking-wider text-stone-100">
            Diagnostics & Rubrics
          </h2>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="flex items-center gap-1 text-stone-400 hover:text-stone-200 text-xs font-bold px-2 py-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
          title="Collapse panel to gain full canvas space"
        >
          <span>Collapse</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Navigation Switcher Tabs (Signal Flow Map vs Rubric Checklist) */}
      <div className="p-2 border-b border-white/10 bg-white/[0.02] flex items-center gap-1.5">
        <button
          id="btn-tab-flow-map"
          onClick={() => setActiveTab('flow')}
          className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'flow'
              ? 'bg-orange-500/20 text-orange-300 border border-orange-400/50 shadow-sm'
              : 'text-stone-400 hover:text-stone-200 hover:bg-white/5 border border-transparent'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-orange-400" />
          <span>Signal Flow Map</span>
        </button>

        <button
          id="btn-tab-rubric"
          onClick={() => setActiveTab('rubric')}
          className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'rubric'
              ? 'bg-orange-500/20 text-orange-300 border border-orange-400/50 shadow-sm'
              : 'text-stone-400 hover:text-stone-200 hover:bg-white/5 border border-transparent'
          }`}
        >
          <ListChecks className="w-3.5 h-3.5 text-orange-400" />
          <span>Rubric Checklist</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-stone-300">
            {evaluation.percentage}%
          </span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeTab === 'flow' ? (
          /* Visual Connection Map Component */
          <SignalFlowMap
            channels={mixerChannels}
            placedGear={placedGear}
            connections={connections}
            environment={environment}
            selectedItemId={selectedItemId}
            onSelectItem={onSelectItem}
            onUpdateChannel={onUpdateChannel}
            isPlayingAudio={isPlayingAudio}
          />
        ) : (
          /* Rubric Checklist View */
          <>
            {/* Top Score Hero Card */}
            <div
              className={`p-3.5 rounded-2xl border backdrop-blur-md shadow-inner transition-all ${
                evaluation.percentage >= 90
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : evaluation.percentage >= 70
                  ? 'bg-orange-500/10 border-orange-500/30'
                  : 'bg-rose-500/10 border-rose-500/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Current Progress</div>
                  <div className="text-2xl sm:text-3xl font-black text-stone-100 tracking-tight flex items-baseline gap-2 mt-0.5 flex-wrap">
                    <span>{evaluation.percentage}%</span>
                    <span className="text-xs sm:text-sm font-bold text-orange-400">
                      &ldquo;{evaluation.gradePhrase}&rdquo;
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden mt-3 border border-white/5">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    evaluation.percentage >= 90
                      ? 'bg-emerald-400'
                      : evaluation.percentage >= 70
                      ? 'bg-orange-400'
                      : 'bg-rose-400'
                  }`}
                  style={{ width: `${evaluation.percentage}%` }}
                />
              </div>
            </div>

            {/* Critical Fixes Warning Box */}
            {evaluation.criticalIssues.length > 0 && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs space-y-1.5 backdrop-blur-md">
                <div className="font-bold text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Attention Needed ({evaluation.criticalIssues.length}):</span>
                </div>
                <ul className="space-y-1 pl-4 list-disc text-rose-200 text-[11px]">
                  {evaluation.criticalIssues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Categories List (Icons only, NO numerical points) */}
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wider text-stone-400 px-1">
                Setup Criteria Checklist
              </div>

              {(
                Object.entries(evaluation.categories) as [
                  keyof RubricEvaluation['categories'],
                  RubricEvaluation['categories'][keyof RubricEvaluation['categories']]
                ][]
              ).map(([key, cat]) => {
                const isCategoryExpanded = expandedCategories[key] !== false; // default open
                const isNA = cat.status === 'not_applicable';

                return (
                  <div
                    key={key}
                    className={`border rounded-2xl p-3 backdrop-blur-md text-xs transition-all ${
                      isNA
                        ? 'bg-white/[0.02] border-white/5 opacity-60 text-stone-400'
                        : 'bg-white/5 border-white/10 hover:border-white/20 text-stone-200'
                    }`}
                  >
                    <div
                      onClick={() => toggleCategory(String(key))}
                      className="flex items-center justify-between cursor-pointer gap-1.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getStatusIcon(cat.status)}
                        <span className={`font-bold truncate ${isNA ? 'text-stone-400' : 'text-stone-200'}`}>
                          {cat.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isNA && (
                          <span className="text-[9px] font-black uppercase tracking-wider text-stone-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md">
                            N/A
                          </span>
                        )}
                        <button className="text-stone-400 hover:text-stone-200 p-0.5 cursor-pointer">
                          {isCategoryExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {isCategoryExpanded && (
                      <div className="mt-2 text-[11px] text-stone-400 pl-6 border-t border-white/5 pt-2 leading-relaxed">
                        <p>{cat.feedback}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Positive Confirmations */}
            {evaluation.positives.length > 0 && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs space-y-1.5 backdrop-blur-md">
                <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Completed Validations:</span>
                </div>
                <ul className="space-y-1 pl-4 list-disc text-emerald-200/90 text-[11px]">
                  {evaluation.positives.map((pos, idx) => (
                    <li key={idx}>{pos}</li>
                  ))}
                </ul>
              </div>
            )}


          </>
        )}
      </div>
    </aside>
  );
};

