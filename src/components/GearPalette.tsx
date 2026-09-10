import React, { useState } from 'react';
import {
  Info,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Cable,
  X,
  ArrowRight,
} from 'lucide-react';
import { GEAR_CATALOG, getGearById } from '../data/gearCatalog';
import { GearDefinition, GearCategory, PlacedGear, CableType } from '../types';
import { StudioIcon } from './StudioIcons';

interface GearPaletteProps {
  onAddGear?: (gearId: string) => void;
  placedGear: PlacedGear[];
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  activeCableTool?: CableType | null;
  connectingFromId?: string | null;
  onCancelCableTool?: () => void;
  selectedTab?: GearCategory | 'all';
  onSelectTab?: (tab: GearCategory | 'all') => void;
  isDiBoxHighlighted?: boolean;
}

const CATEGORY_TABS: { id: GearCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'instrument', label: 'Instruments' },
  { id: 'microphone', label: 'Microphones' },
  { id: 'di_box', label: 'DIs & Amps' },
  { id: 'monitor_speaker', label: 'Monitoring & PA' },
];

export const GearPalette: React.FC<GearPaletteProps> = ({
  placedGear,
  isCollapsed = false,
  onToggleCollapse,
  activeCableTool,
  connectingFromId,
  onCancelCableTool,
  selectedTab: selectedTabProp,
  onSelectTab,
  isDiBoxHighlighted = false,
}) => {
  const [internalSelectedTab, setInternalSelectedTab] = useState<GearCategory | 'all'>('instrument');
  const selectedTab = selectedTabProp !== undefined ? selectedTabProp : internalSelectedTab;
  const setSelectedTab = (tab: GearCategory | 'all') => {
    setInternalSelectedTab(tab);
    onSelectTab?.(tab);
  };
  const [activeTooltip, setActiveTooltip] = useState<GearDefinition | null>(null);

  // Helper to format start node name
  const getNodeDisplayName = (id: string): string => {
    if (id.startsWith('snake_in_')) {
      return `Snake Input CH ${id.replace('snake_in_', '')}`;
    }
    if (id.startsWith('snake_out_')) {
      const port = id.replace('snake_out_', '');
      if (port === 'mon1') return 'Snake Output MON 1';
      if (port === 'mon2') return 'Snake Output MON 2';
      if (port === 'main_l') return 'Snake Output MAIN LEFT';
      if (port === 'main_r') return 'Snake Output MAIN RIGHT';
      return `Snake Output ${port.toUpperCase()}`;
    }
    const gear = placedGear.find((g) => g.instanceId === id);
    if (gear) {
      const def = getGearById(gear.gearId);
      return def?.name || 'Equipment';
    }
    return 'Equipment';
  };

  const filteredGear = GEAR_CATALOG.filter((item) => {
    // Hide stand & accessory category items from direct palette tabs as requested
    if (item.category === 'stand' || item.category === 'accessory' || item.category === 'acoustic_treatment') {
      return false;
    }

    if (selectedTab === 'di_box') {
      if (item.category !== 'di_box' && item.category !== 'amplifier') return false;
    } else if (selectedTab !== 'all' && item.category !== selectedTab) {
      return false;
    }

    return true;
  });

  // Cable overlay box UI content
  const renderCableInstructionsBox = () => {
    if (!activeCableTool) return null;
    const isXlr = activeCableTool === 'xlr';
    const accentBorder = isXlr ? 'border-orange-500/50 shadow-orange-950/40' : 'border-sky-500/50 shadow-sky-950/40';
    const accentText = isXlr ? 'text-orange-400' : 'text-sky-400';
    const accentBadge = isXlr ? 'bg-orange-500/15 text-orange-200 border-orange-500/30' : 'bg-sky-500/15 text-sky-200 border-sky-500/30';

    return (
      <div
        id="cable-patching-locker-overlay"
        className={`absolute top-3 left-3 right-3 z-50 bg-stone-950/85 backdrop-blur-md border ${accentBorder} rounded-xl p-3 shadow-2xl flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-150 select-none`}
      >
        {/* Top Title & Dismiss Button */}
        <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              {isXlr ? (
                <StudioIcon iconType="XlrConnector" size={20} />
              ) : (
                <StudioIcon iconType="QuarterInchPlug" size={20} />
              )}
            </div>
            <div>
              <span className={`text-xs font-black uppercase tracking-wide ${accentText}`}>
                {isXlr ? 'XLR Cable Active' : '1/4" Cable Active'}
              </span>
            </div>
          </div>
          {onCancelCableTool && (
            <button
              onClick={onCancelCableTool}
              className="p-1 rounded-lg bg-white/5 hover:bg-rose-500/20 text-stone-400 hover:text-rose-300 border border-white/10 transition-colors"
              title="Cancel cable connection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Simplified Guide Card */}
        <div className={`p-2.5 rounded-lg border text-xs leading-relaxed ${accentBadge}`}>
          {connectingFromId ? (
            <span>
              Started at <strong className="font-bold text-white underline">{getNodeDisplayName(connectingFromId)}</strong>. Click or release on target equipment to connect.
            </span>
          ) : (
            <span>click+drag to connect instruments and equipment to each other or to the snake.</span>
          )}
        </div>
      </div>
    );
  };

  if (isCollapsed) {
    return (
      <div className="w-12 bg-black/40 backdrop-blur-xl border-r border-white/10 flex flex-col items-center py-4 text-stone-200 select-none z-20 shrink-0 relative">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-stone-300 border border-white/10 mb-6 transition-all"
          title="Expand Equipment Drawer"
        >
          <ChevronRight className="w-5 h-5 text-orange-400" />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <span className="rotate-90 whitespace-nowrap text-xs font-black uppercase tracking-widest text-stone-400">
            Equipment Locker
          </span>
        </div>

        {/* Floating pop-up if collapsed during cable patching */}
        {activeCableTool && (
          <div
            id="cable-patching-floating-popup"
            className={`absolute left-14 top-4 w-64 z-50 bg-stone-950/85 backdrop-blur-md border ${
              activeCableTool === 'xlr' ? 'border-orange-500/50 shadow-orange-950/50' : 'border-sky-500/50 shadow-sky-950/50'
            } rounded-xl p-3 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col gap-2`}
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
              <span className={`text-xs font-black uppercase ${activeCableTool === 'xlr' ? 'text-orange-400' : 'text-sky-400'}`}>
                {activeCableTool === 'xlr' ? 'XLR Cable Active' : '1/4" Cable Active'}
              </span>
              {onCancelCableTool && (
                <button onClick={onCancelCableTool} className="text-stone-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-xs text-stone-200 leading-snug">
              {connectingFromId
                ? `Started at ${getNodeDisplayName(connectingFromId)}. Click or release on target equipment to connect.`
                : 'click+drag to connect instruments and equipment to each other or to the snake.'}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <aside
      id="gear-palette-drawer"
      className="w-72 lg:w-80 bg-black/80 backdrop-blur-2xl border-r border-white/10 flex flex-col h-full text-stone-200 select-none shadow-2xl z-20 shrink-0 relative transition-all"
    >
      {/* Cable Instructions Overlay Pop-up Box */}
      {renderCableInstructionsBox()}
      {/* Header & Status Indicator */}
      <div className="p-3 border-b border-white/10 bg-black/80 backdrop-blur-md relative z-10 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-stone-100">Equipment Locker</span>
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-white/10 transition-all"
                title="Collapse drawer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Drag Hint */}
        <div className="mb-2 text-[10.5px] text-orange-400/95 font-semibold flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 px-2.5 py-1.5 rounded-lg leading-snug">
          <GripVertical className="w-3.5 h-3.5 shrink-0 text-orange-400" />
          <span>Drag gear onto the plot to add it or on top of existing gear to swap it in.</span>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-1 mt-1">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all backdrop-blur-sm ${
                selectedTab === tab.id
                  ? 'bg-orange-500 text-stone-950 font-bold shadow-md shadow-orange-950/40'
                  : 'bg-white/5 text-stone-400 hover:text-stone-200 hover:bg-white/10 border border-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Items Grid */}
      <div className="flex-1 overflow-y-auto p-2.5 pt-4 space-y-2 relative z-0">
        {filteredGear.length === 0 ? (
          <div className="p-6 text-center text-xs text-stone-500">
            No equipment in this category.
          </div>
        ) : (
          filteredGear.map((item) => {
            const countPlaced = placedGear.filter((g) => g.gearId === item.id).length;
            const isDiBox = item.id === 'gear_di_box';

            return (
              <div
                key={item.id}
                id={`gear-item-${item.id}`}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    'application/json',
                    JSON.stringify({
                      type: 'gear_catalog_item',
                      gearId: item.id,
                      category: item.category,
                    })
                  );
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                className={`group relative rounded-2xl p-2.5 transition-all shadow-sm backdrop-blur-md flex items-start gap-2.5 cursor-grab active:cursor-grabbing hover:shadow-lg active:scale-95 ${
                  isDiBox && isDiBoxHighlighted
                    ? 'bg-orange-500/30 border-2 border-orange-300 shadow-2xl shadow-orange-500/80 ring-4 ring-orange-400 animate-bounce'
                    : 'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange-400/50'
                }`}
              >
                {/* Drag Handle Grip Icon */}
                <div className="self-center text-stone-500 group-hover:text-orange-400 transition-colors">
                  <GripVertical className="w-3.5 h-3.5" />
                </div>

                {/* Visual Equipment Icon */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-inner border border-white/10 bg-black/40 backdrop-blur-md p-1 overflow-hidden"
                >
                  <StudioIcon iconType={item.iconType} size={34} color={item.color} />
                </div>

                {/* Info & Badges */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="text-xs font-black text-stone-100 truncate">{item.name}</h3>
                    {countPlaced > 0 && (
                      <span className="bg-orange-500/20 text-orange-300 border border-orange-500/30 text-[10px] px-2 py-0.2 rounded-full font-bold shrink-0">
                        {countPlaced} placed
                      </span>
                    )}
                  </div>

                  {/* Show model subtitle strictly for Dynamic Microphones (polar pattern removed) */}
                  {item.category === 'microphone' && item.transducerType === 'dynamic' && item.model && (
                    <p className="text-[10px] text-stone-400 truncate mt-0.5">{item.model}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    {item.transducerType === 'dynamic' && (
                      <span className="bg-white/5 text-stone-300 border border-white/10 text-[9px] px-2 py-0.2 rounded-full font-medium">
                        Dynamic
                      </span>
                    )}
                    {item.transducerType === 'condenser_large' && (
                      <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] px-2 py-0.2 rounded-full font-medium">
                        Large Diaphragm Condenser
                      </span>
                    )}
                    {item.transducerType === 'condenser_small' && (
                      <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[9px] px-2 py-0.2 rounded-full font-medium">
                        Small Diaphragm Condenser
                      </span>
                    )}
                    {item.transducerType === 'di' && (
                      <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] px-2 py-0.2 rounded-full font-medium">
                        Direct Box
                      </span>
                    )}
                    {item.category === 'microphone' && item.polarPattern && (
                      <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] px-2 py-0.2 rounded-full font-medium">
                        {item.polarPattern}
                      </span>
                    )}
                  </div>
                </div>

                {/* Info Tooltip Button */}
                <div className="flex flex-col gap-1 items-center shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTooltip(activeTooltip?.id === item.id ? null : item);
                    }}
                    className="p-1 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-white/10 transition-all"
                    title="View technical details"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Expanded Spec Modal / Drawer bottom */}
      {activeTooltip && (
        <div className="p-3.5 bg-black/70 backdrop-blur-2xl border-t border-white/10 text-xs animate-in slide-in-from-bottom duration-150">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-orange-400 flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              {activeTooltip.name} Technical Details
            </span>
            <button
              onClick={() => setActiveTooltip(null)}
              className="text-stone-400 hover:text-white text-[11px] font-bold"
            >
              ✕ Close
            </button>
          </div>
          <p className="text-stone-300 text-[11px] mb-2">{activeTooltip.description}</p>
          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 text-[11px] text-stone-300 space-y-1 backdrop-blur-md">
            <div>
              <strong className="text-stone-100">Specs:</strong> {activeTooltip.specs}
            </div>
            <div>
              <strong className="text-stone-100">Ideal for:</strong> {activeTooltip.idealSources.join(', ')}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
