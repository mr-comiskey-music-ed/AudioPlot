import React from 'react';
import {
  EnvironmentMode,
  MicStandHeight,
  MixerChannelState,
  PlacedGear,
} from '../../types';
import { getGearById } from '../../data/gearCatalog';
import { AlertCircle, Move, Shield, Target, Unlink, Zap } from 'lucide-react';
import { getPlacementOptionsForTarget } from './canvasMath';

interface CanvasInspectorProps {
  selectedItem: PlacedGear | null;
  environment: EnvironmentMode;
  placedGear: PlacedGear[];
  mixerChannels: MixerChannelState[];
  onSelectItem: (instanceId: string | null) => void;
  onUpdateChannel?: (channelNumber: number, updates: Partial<MixerChannelState>) => void;
  onSetLatchedSource: (instanceId: string, sourceId?: string) => void;
  onSetMicPlacement: (instanceId: string, placement: string) => void;
  onSetStandHeight: (instanceId: string, height: MicStandHeight | undefined) => void;
  onTogglePopFilter: (instanceId: string) => void;
  onShowErrorToast: (title: string, message: string) => void;
}

export const CanvasInspector: React.FC<CanvasInspectorProps> = ({
  selectedItem,
  environment,
  placedGear,
  mixerChannels,
  onSelectItem,
  onUpdateChannel,
  onSetLatchedSource,
  onSetMicPlacement,
  onSetStandHeight,
  onTogglePopFilter,
  onShowErrorToast,
}) => {
  if (!selectedItem) return null;
  const selectedDef = getGearById(selectedItem.gearId);
  if (!selectedDef) return null;

  const isInspectable =
    selectedDef.category === 'microphone' ||
    selectedDef.category === 'stand' ||
    selectedDef.category === 'di_box' ||
    selectedItem.gearId === 'gear_iem_transmitter' ||
    selectedItem.gearId === 'gear_iem_receiver' ||
    selectedItem.gearId === 'gear_in_ear_monitors' ||
    selectedItem.gearId === 'gear_studio_headphones' ||
    selectedItem.gearId === 'gear_stage_monitor';

  if (!isInspectable) return null;

  const selectedAssignedChannel = mixerChannels.find(
    (ch) => ch.assignedGearInstanceId === selectedItem.instanceId || ch.channelNumber === selectedItem.assignedChannel
  );

  const availableSoundSources = placedGear.filter((g) => {
    const d = getGearById(g.gearId);
    return d?.category === 'instrument' || d?.category === 'amplifier';
  });

  const hasDrumKitPieces = placedGear.some(
    (g) =>
      g.gearId === 'inst_kick_drum' ||
      g.gearId === 'inst_snare_drum' ||
      g.gearId === 'inst_tom_drum' ||
      g.gearId === 'inst_drum_cymbals' ||
      g.gearId === 'inst_hi_hat' ||
      g.gearId === 'inst_cymbals' ||
      g.gearId === 'inst_drum_set'
  );

  const selectedTargetSource =
    selectedItem.latchedSourceInstanceId === 'room'
      ? { gearId: 'room', name: 'Room' }
      : selectedItem.latchedSourceInstanceId
      ? placedGear.find((g) => g.instanceId === selectedItem.latchedSourceInstanceId)
      : placedGear.find((g) => {
          if (g.instanceId === selectedItem.instanceId) return false;
          const gDef = getGearById(g.gearId);
          return (
            (gDef?.category === 'instrument' || gDef?.category === 'amplifier') &&
            Math.hypot(g.x - selectedItem.x, g.y - selectedItem.y) < 140
          );
        });

  const placementOptions = getPlacementOptionsForTarget(selectedTargetSource?.gearId);

  return (
    <div
      id="item-inspector-toolbar"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="bg-stone-950/40 backdrop-blur-[2px] border border-stone-700/60 rounded-2xl shadow-2xl p-2.5 flex flex-wrap items-center gap-1.5 text-stone-200 max-w-[310px] w-full animate-in fade-in duration-150"
    >
      {/* Item Name & Model */}
      <div className="pr-2 border-r border-white/10">
        <div className="text-xs font-black text-orange-400 flex items-center gap-1">
          <span>{selectedDef.name}</span>
        </div>
        {selectedDef.model && (
          <div className="text-[10px] text-stone-400">{selectedDef.model}</div>
        )}
      </div>

      {/* +48V Phantom Power Toggle Button inside Mic Options Box */}
      {selectedDef.category === 'microphone' && (
        <div className="flex items-center">
          <button
            id="btn-mic-toolbar-phantom"
            onClick={() => {
              if (selectedAssignedChannel && onUpdateChannel) {
                onUpdateChannel(selectedAssignedChannel.channelNumber, {
                  phantomPower: !selectedAssignedChannel.phantomPower,
                });
              } else {
                onShowErrorToast(
                  'Patch to Snake First',
                  'Route this microphone to an 8-Channel Snake socket, then activate +48V Phantom Power.'
                );
              }
            }}
            className={`px-2 py-0.5 rounded-full text-[11px] font-black border transition-all flex items-center gap-1 backdrop-blur-md cursor-pointer ${
              selectedAssignedChannel?.phantomPower
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
                : 'bg-white/5 border-white/10 text-stone-400 hover:text-stone-200'
            }`}
            title="Toggle +48V Phantom Power for this mic's channel strip"
          >
            <Zap className={`w-3 h-3 ${selectedAssignedChannel?.phantomPower ? 'fill-current' : ''}`} />
            <span>{selectedAssignedChannel?.phantomPower ? '+48V Active' : '+48V'}</span>
          </button>
        </div>
      )}

      {/* Audio Source / Performer Assignment */}
      {(selectedDef.category === 'microphone' ||
        selectedItem.gearId === 'gear_iem_transmitter' ||
        selectedItem.gearId === 'gear_iem_receiver' ||
        selectedItem.gearId === 'gear_in_ear_monitors' ||
        selectedItem.gearId === 'gear_studio_headphones' ||
        selectedItem.gearId === 'gear_stage_monitor' ||
        selectedItem.gearId === 'gear_di_box') && (
        <div className="flex items-center gap-1.5 w-full pt-1 border-t border-white/10">
          <span className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5 shrink-0">
            <Target className="w-3 h-3" />
            <span>
              {selectedDef.category === 'microphone' ? 'Source:' : 'Performer:'}
            </span>
          </span>
          <select
            value={selectedItem.latchedSourceInstanceId || ''}
            onChange={(e) => onSetLatchedSource(selectedItem.instanceId, e.target.value || undefined)}
            className="bg-stone-900 border border-white/10 focus:border-orange-400 rounded-lg px-1.5 py-0.5 text-xs text-stone-200 outline-none cursor-pointer flex-1 truncate"
          >
            <option value="">(none)</option>
            {selectedDef.category === 'microphone' && <option value="room">Room Ambience</option>}
            {(selectedItem.gearId === 'gear_studio_headphones' || selectedItem.gearId === 'gear_stage_monitor') &&
              hasDrumKitPieces && (
                <option value="drummer">Drummer (All Kit)</option>
              )}
            {availableSoundSources.map((source) => {
              const sDef = getGearById(source.gearId);
              return (
                <option key={source.instanceId} value={source.instanceId} className="bg-stone-900 text-stone-100">
                  {sDef?.name || source.gearId}
                </option>
              );
            })}
          </select>
          {selectedItem.latchedSourceInstanceId && (
            <button
              onClick={() => onSetLatchedSource(selectedItem.instanceId, undefined)}
              className="p-1 rounded-md bg-white/10 hover:bg-rose-500/30 text-stone-400 hover:text-rose-300 transition-colors shrink-0"
              title="Unassign source"
            >
              <Unlink className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Mic Placement Selection */}
      {selectedDef.category === 'microphone' && (
        <div className="flex items-center gap-1 w-full pt-1 border-t border-white/10">
          <span className="text-[10px] font-bold text-sky-400 flex items-center gap-0.5 shrink-0">
            <Move className="w-3 h-3" />
            <span>Placement:</span>
          </span>
          <select
            value={selectedItem.micPlacement || placementOptions[0]?.id || ''}
            onChange={(e) => onSetMicPlacement(selectedItem.instanceId, e.target.value)}
            className="bg-stone-900 border border-white/10 focus:border-sky-400 rounded-lg px-1.5 py-0.5 text-xs text-sky-300 font-bold outline-none cursor-pointer flex-1 truncate"
          >
            {placementOptions.map((opt) => (
              <option key={opt.id} value={opt.id} className="bg-stone-900 text-stone-100">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Stand Height Controls & Pop Filter */}
      {(selectedDef.category === 'microphone' || selectedDef.category === 'stand') && (
        <div className="flex flex-col gap-1.5 w-full pt-1 border-t border-white/10">
          <div className="flex items-center gap-1 w-full">
            <span className="text-[10px] text-stone-400 font-bold shrink-0">
              Mic Stand:
            </span>
            <select
              value={selectedItem.standHeight || ''}
              onChange={(e) => {
                const val = e.target.value;
                onSetStandHeight(selectedItem.instanceId, val ? (val as MicStandHeight) : undefined);
              }}
              className={`bg-stone-900 border ${!selectedItem.standHeight ? 'border-rose-500 text-rose-300' : 'border-white/10 focus:border-sky-400 text-sky-300'} rounded-lg px-1.5 py-0.5 text-xs font-bold outline-none cursor-pointer flex-1 truncate`}
            >
              <option value="" className="bg-stone-900 text-stone-400 font-normal">
                (none) — Select Stand Height
              </option>
              <option value="amp_low" className="bg-stone-900 text-stone-100">Floor</option>
              <option value="seated_instrument" className="bg-stone-900 text-stone-100">Seated</option>
              <option value="standing_vocal" className="bg-stone-900 text-stone-100">Standing</option>
              <option value="drum_overhead" className="bg-stone-900 text-stone-100">Overhead</option>
              <option value="clipped" className="bg-stone-900 text-stone-100">Rim Clip</option>
              <option value="mounted" className="bg-stone-900 text-stone-100">Mounted</option>
            </select>
          </div>
          {!selectedItem.standHeight && (
            <div className="flex items-center gap-1 text-[10px] text-rose-400 font-bold bg-rose-500/10 border border-rose-500/30 rounded px-1.5 py-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>⚠️ Mic Stand placement selection required! Please select a stand height from the dropdown.</span>
            </div>
          )}
        </div>
      )}

      {/* Pop Filter Toggle for Mics (Studio mode only) */}
      {environment === 'recording_studio' && selectedDef.category === 'microphone' && (
        <div className="w-full pt-1 border-t border-white/10 flex items-center">
          <button
            onClick={() => onTogglePopFilter(selectedItem.instanceId)}
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all flex items-center gap-1 backdrop-blur-md cursor-pointer ${
              selectedItem.hasPopFilter
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-white/5 border-white/10 text-stone-400 hover:text-stone-200'
            }`}
            title="Attach mesh Pop Filter to prevent plosives"
          >
            <Shield className="w-3 h-3" />
            <span>{selectedItem.hasPopFilter ? 'Pop Filter Active' : '+ Pop Filter'}</span>
          </button>
        </div>
      )}


    </div>
  );
};
