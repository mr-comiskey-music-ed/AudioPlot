import React, { useState, useRef, useEffect } from 'react';
import { CableConnection, EnvironmentMode, MixerChannelState, PlacedGear } from '../../types';
import { getGearById } from '../../data/gearCatalog';
import { StudioIcon } from '../StudioIcons';
import { Activity, AlertCircle, Cable, Target, Trash2 } from 'lucide-react';
import {
  formatShortGearName,
  getGearBoxDimensions,
  isAcousticInstrument,
} from './canvasMath';
import { getGearIssues } from './signalValidation';

interface GearItemNodeProps {
  item: PlacedGear;
  environment: EnvironmentMode;
  placedGear: PlacedGear[];
  connections: CableConnection[];
  mixerChannels: MixerChannelState[];
  isSelected: boolean;
  selectedItemIds: string[];
  isSourceForCable: boolean;
  resizingId: string | null;
  onMouseDown: (e: React.MouseEvent, item: PlacedGear) => void;
  onSelect: (instanceId: string) => void;
  onDelete: (instanceId: string) => void;
  onMultiDelete: (instanceIds: string[]) => void;
  onStartResize: (e: React.MouseEvent, item: PlacedGear) => void;
  connectingFromId: string | null;
  activeCableTool: any;
  isHighlightedInSignalPath?: boolean;
  hasAnySignalPathActive?: boolean;
  signalPathRole?: string;
}

export const GearItemNode: React.FC<GearItemNodeProps> = ({
  item,
  environment,
  placedGear,
  connections,
  mixerChannels,
  isSelected,
  selectedItemIds,
  isSourceForCable,
  resizingId,
  onMouseDown,
  onSelect,
  onDelete,
  onMultiDelete,
  onStartResize,
  connectingFromId,
  activeCableTool,
  isHighlightedInSignalPath = false,
  hasAnySignalPathActive = false,
  signalPathRole,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);

  // Click outside / Escape listener to dismiss confirmation popover
  useEffect(() => {
    if (!showDeleteConfirm) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (confirmRef.current && !confirmRef.current.contains(e.target as Node)) {
        setShowDeleteConfirm(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDeleteConfirm(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handleClickOutside, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showDeleteConfirm]);
  const def = getGearById(item.gearId);
  if (!def) return null;

  // Latched source
  const latchedSource = item.latchedSourceInstanceId
    ? placedGear.find((g) => g.instanceId === item.latchedSourceInstanceId)
    : null;
  const isMicOnDrum =
    def.category === 'microphone' &&
    latchedSource !== null &&
    latchedSource !== undefined &&
    (latchedSource.gearId.includes('drum') || latchedSource.gearId === 'gear_drum_kit');

  const isAssigned = !!item.latchedSourceInstanceId;
  const dims = getGearBoxDimensions(
    item.gearId,
    isAssigned,
    item.customScale,
    item.customWidth,
    item.customHeight,
    isMicOnDrum
  );
  const latchedDef = latchedSource ? getGearById(latchedSource.gearId) : null;

  // Assigned mixer channel
  const assignedChannel = mixerChannels.find(
    (ch) => ch.assignedGearInstanceId === item.instanceId || ch.channelNumber === item.assignedChannel
  );

  // Setup warnings
  const itemIssues = getGearIssues(item, placedGear, mixerChannels, connections, environment);

  // Cable connection check
  const isCabled = (() => {
    if (def.category === 'microphone') {
      return assignedChannel !== undefined;
    }
    if (item.gearId === 'gear_di_box') {
      const hasInput = connections.some(
        (c) => c.fromInstanceId === item.instanceId || c.toInstanceId === item.instanceId
      );
      const hasOutput = assignedChannel !== undefined;
      return hasInput && hasOutput;
    }
    if (item.gearId === 'gear_guitar_amp') {
      return connections.some(
        (c) => c.fromInstanceId === item.instanceId || c.toInstanceId === item.instanceId
      );
    }
    if (item.gearId === 'gear_bass_amp') {
      return (
        assignedChannel !== undefined ||
        connections.some(
          (c) => c.fromInstanceId === item.instanceId || c.toInstanceId === item.instanceId
        )
      );
    }
    if (def.category === 'instrument') {
      if (isAcousticInstrument(item.gearId)) return null;
      return connections.some(
        (c) => c.fromInstanceId === item.instanceId || c.toInstanceId === item.instanceId
      );
    }
    return assignedChannel !== undefined;
  })();

  const isDimmed = hasAnySignalPathActive && !isHighlightedInSignalPath && !isSelected;

  return (
    <div
      id={`placed-gear-${item.instanceId}`}
      onMouseDown={(e) => onMouseDown(e, item)}
      onClick={(e) => {
        e.stopPropagation();
      }}
      className={`absolute rounded-2xl transition-all select-none flex flex-col items-center justify-between p-2 backdrop-blur-md cursor-grab active:cursor-grabbing group shadow-xl ${
        showDeleteConfirm || isSelected ? 'z-50' : isHighlightedInSignalPath ? 'z-30' : 'z-20'
      } ${
        isDimmed ? 'opacity-35 hover:opacity-100' : 'opacity-100'
      } ${
        isHighlightedInSignalPath && !isSelected
          ? 'ring-2 ring-cyan-400 bg-stone-950/95 border-2 border-cyan-400 shadow-[0_0_24px_rgba(6,182,212,0.45)] scale-102'
          : itemIssues.length > 0
          ? isSelected
            ? 'ring-2 ring-rose-500 bg-rose-950/70 border-2 border-rose-500 scale-105'
            : 'ring-1 ring-rose-500/60 bg-stone-950/80 border border-rose-500/50'
          : isSelected
          ? 'ring-2 ring-orange-400 bg-stone-950/90 border border-orange-400 scale-105 shadow-[0_0_20px_rgba(249,115,22,0.3)]'
          : isSourceForCable
          ? 'ring-2 ring-orange-500 animate-pulse bg-stone-950/90 border border-orange-500'
          : 'hover:ring-1 hover:ring-white/40 bg-stone-950/75 hover:bg-stone-950/90 border border-white/20'
      }`}
      style={{
        left: `${item.x}px`,
        top: `${item.y}px`,
        width: `${dims.width}px`,
        height: `${dims.height}px`,
        transform: `rotate(${item.rotation}deg)`,
        borderColor: item.hasPopFilter ? '#10B981' : isHighlightedInSignalPath ? '#22D3EE' : undefined,
      }}
    >
      {/* Active Signal Path Role Tag Badge */}
      {isHighlightedInSignalPath && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 z-40 px-2 py-0.5 rounded-full bg-cyan-500 text-stone-950 font-black text-[8.5px] uppercase tracking-wider flex items-center gap-1 shadow-lg shadow-cyan-950/80 border border-cyan-200 animate-pulse whitespace-nowrap"
          title="Active Audio Signal Flow"
        >
          <Activity className="w-2.5 h-2.5 stroke-[2.5]" />
          <span>{signalPathRole || 'SIGNAL PATH'}</span>
        </div>
      )}

      {/* Red Exclamation Mark Error Badge with Hover Tooltip */}
      {itemIssues.length > 0 && !isHighlightedInSignalPath && (
        <div
          className="absolute -top-2 -left-2 z-40 group/err cursor-pointer hover:z-50"
          title={`${itemIssues.length} Setup Attention Needed`}
        >
          <span className="w-5 h-5 rounded-full bg-rose-600 text-white font-black text-xs flex items-center justify-center shadow-lg shadow-rose-950/80 border-2 border-rose-300 animate-bounce">
            !
          </span>

          {/* Floating Error Tooltip on Hover */}
          <div className="absolute left-6 top-0 hidden group-hover/err:flex flex-col z-[100] w-56 p-2.5 bg-stone-950/95 border-2 border-rose-500 text-rose-100 rounded-xl shadow-2xl backdrop-blur-xl pointer-events-none text-left animate-in fade-in duration-150">
            <div className="text-[10px] font-extrabold text-rose-300 uppercase tracking-wide flex items-center gap-1 mb-1">
              <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
              <span>Setup Attention Needed:</span>
            </div>
            <ul className="space-y-1 pl-3.5 list-disc text-[10px] text-stone-200/90 leading-tight">
              {itemIssues.map((issue, idx) => (
                <li key={idx}>{issue}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Delete button at top-right with confirmation trigger */}
      <button
        id={`btn-delete-gear-${item.instanceId}`}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (selectedItemIds.length > 1 && selectedItemIds.includes(item.instanceId)) {
            onMultiDelete(selectedItemIds);
          } else {
            setShowDeleteConfirm((prev) => !prev);
          }
        }}
        className={`absolute -top-2 -right-2 z-30 w-5 h-5 rounded-full text-white flex items-center justify-center shadow-md border transition-transform hover:scale-110 cursor-pointer ${
          showDeleteConfirm
            ? 'bg-rose-500 border-rose-200 ring-2 ring-rose-400 scale-110'
            : 'bg-rose-600 hover:bg-rose-500 border-rose-300'
        }`}
        title={`Delete ${def.name}`}
      >
        <Trash2 className="w-3 h-3" />
      </button>

      {/* Confirmation Dialog / Popover */}
      {showDeleteConfirm && (
        <div
          ref={confirmRef}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute -top-24 left-1/2 -translate-x-1/2 z-50 w-56 p-3 bg-stone-950 border-2 border-rose-500 rounded-2xl shadow-2xl backdrop-blur-2xl text-stone-200 text-center animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="text-xs font-black text-rose-300 mb-1">Remove Equipment?</div>
          <div className="text-[10px] text-stone-300 mb-2.5 leading-snug">
            Delete <span className="text-white font-bold">{def.name}</span> and all its connected cables?
          </div>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-[10px] font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowDeleteConfirm(false);
                onDelete(item.instanceId);
              }}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black transition-colors shadow-md cursor-pointer"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Resize Handle at Bottom-Right Corner */}
      <button
        id={`btn-scale-gear-${item.instanceId}`}
        onMouseDown={(e) => onStartResize(e, item)}
        onClick={(e) => {
          e.stopPropagation();
        }}
        className={`absolute -bottom-2 -right-2 z-30 w-5 h-5 rounded-full flex items-center justify-center shadow-md border cursor-se-resize transition-all ${
          resizingId === item.instanceId
            ? 'bg-orange-500 text-stone-950 border-orange-300 ring-2 ring-orange-400/60 scale-110'
            : 'bg-stone-800 hover:bg-orange-600 active:bg-orange-500 text-stone-300 hover:text-white border-stone-600 hover:border-orange-300'
        }`}
        title="Click & drag to resize box (Aspect ratio locked)"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-90">
          <line x1="8.5" y1="2" x2="2" y2="8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="8.5" y1="5.5" x2="5.5" y2="8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>

      {/* Visual Icon Illustration */}
      <div
        className="flex items-center justify-center shrink-0 my-auto pointer-events-none w-full"
        style={{
          height: `${Math.max(26, dims.height - 44)}px`,
        }}
      >
        <StudioIcon
          iconType={def.iconType}
          size={Math.max(22, Math.min(dims.height - 44, dims.width - 22, 140))}
          color={isHighlightedInSignalPath ? '#38BDF8' : def.color}
        />
      </div>

      {/* Stand Height, Phantom, Pop Filter, Placement & Latch Badges */}
      <div className="flex items-center justify-center flex-wrap gap-1 my-0.5 max-w-full">
        {item.hasPopFilter && (
          <span
            className="px-1.5 py-0.2 rounded-full text-[8px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs"
            title="Pop Filter Attached"
          >
            Pop Filter
          </span>
        )}
        {def.requiresPhantomPower && (
          <span
            className={`px-1.5 py-0.2 rounded-full text-[8px] font-bold border transition-colors ${
              assignedChannel?.phantomPower
                ? 'bg-rose-500/30 text-rose-300 border-rose-400 shadow-[0_0_6px_#f43f5e]'
                : 'bg-white/10 text-stone-400 border-white/15'
            }`}
            title={assignedChannel?.phantomPower ? '+48V Phantom Power Active' : '+48V Needed'}
          >
            +48V
          </span>
        )}
        {item.standHeight && (
          <span className="text-[8px] bg-white/10 px-1.5 py-0.2 rounded-full text-stone-300 font-mono border border-white/10 font-bold">
            {item.standHeight === 'amp_low'
              ? 'Low'
              : item.standHeight === 'seated_instrument'
              ? 'Seated'
              : item.standHeight === 'standing_vocal'
              ? 'Stand'
              : item.standHeight === 'clipped'
              ? 'Clip'
              : item.standHeight === 'mounted'
              ? 'Mounted'
              : 'Overhead'}
          </span>
        )}
        {item.latchedSourceInstanceId === 'room' ? (
          <span
            className="px-1.5 py-0.2 rounded-full text-[8px] font-extrabold bg-sky-500/20 text-sky-300 border border-sky-500/40 flex items-center gap-0.5"
            title="Capturing Room Ambience"
          >
            <Target className="w-2.5 h-2.5" />
            <span>Room</span>
          </span>
        ) : item.latchedSourceInstanceId === 'drummer' ? (
          <span
            className="px-1.5 py-0.2 rounded-full text-[8px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-0.5"
            title="Monitoring: Drummer (All Pieces)"
          >
            <Target className="w-2.5 h-2.5" />
            <span>Drummer</span>
          </span>
        ) : latchedDef ? (
          <span
            className="px-1.5 py-0.2 rounded-full text-[8px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-0.5"
            title={`Aimed at / capturing: ${latchedDef.name}`}
          >
            <Target className="w-2.5 h-2.5" />
            <span>{formatShortGearName(latchedDef.name, latchedDef.id)}</span>
          </span>
        ) : null}
      </div>

      {/* Equipment Name Label */}
      <div className="w-full flex flex-col items-center pointer-events-none">
        <div
          className="font-black text-stone-100 text-center leading-snug line-clamp-1 px-1 break-words"
          style={{
            fontSize: `${Math.max(8, Math.min(13, dims.width / 11))}px`,
          }}
        >
          {def.name}
        </div>
      </div>

      {/* Combined Patched Channel & Cable Indicator Badge at Bottom Center */}
      {assignedChannel ? (
        <div
          className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-30 px-2 py-0.5 rounded-full font-black text-[9px] flex items-center gap-1 shadow-lg whitespace-nowrap ${
            isHighlightedInSignalPath
              ? 'bg-cyan-400 text-stone-950 border border-cyan-200 shadow-cyan-950/80 ring-1 ring-cyan-300 animate-pulse'
              : 'bg-emerald-500 text-stone-950 border border-emerald-300 shadow-emerald-950/70'
          }`}
          title={`Patched to Snake Channel ${assignedChannel.channelNumber}`}
        >
          <Cable className="w-2.5 h-2.5 stroke-[2.5]" />
          <span>CH {assignedChannel.channelNumber}</span>
        </div>
      ) : isCabled ? (
        <div
          className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-30 px-2 py-0.5 rounded-full font-black text-[8.5px] flex items-center gap-1 shadow-lg whitespace-nowrap ${
            isHighlightedInSignalPath
              ? 'bg-cyan-400 text-stone-950 border border-cyan-200 shadow-cyan-950/80 ring-1 ring-cyan-300 animate-pulse'
              : 'bg-sky-500 text-stone-950 border border-sky-300 shadow-sky-950/70'
          }`}
          title="Connected via Cable"
        >
          <Cable className="w-2.5 h-2.5 stroke-[2.5]" />
          <span>CABLED</span>
        </div>
      ) : def.category === 'microphone' || def.category === 'di_box' ? (
        <div
          className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-30 px-1.5 py-0.5 rounded-full bg-stone-900/90 text-stone-400 font-bold text-[8px] flex items-center gap-1 border border-white/10 shadow-md whitespace-nowrap"
          title="Unpatched: Route XLR cable to Snake"
        >
          <Cable className="w-2 h-2" />
          <span>UNPATCHED</span>
        </div>
      ) : null}
    </div>
  );
};
