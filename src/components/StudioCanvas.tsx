import React, { useState, useRef, useEffect } from 'react';
import {
  EnvironmentMode,
  PlacedGear,
  CableConnection,
  CableType,
  MicStandHeight,
  MixerChannelState,
  GearCategory,
} from '../types';
import { getGearById } from '../data/gearCatalog';
import { Cable, Trash2 } from 'lucide-react';
import {
  getGearBoxDimensions,
  getSnakeChannelPosition,
  getSnakeOutputPosition,
  isAcousticInstrument,
} from './canvas/canvasMath';
import {
  validateGearToGearConnection,
  validateGearToSnakeConnection,
  validateGearToSnakeOutputConnection,
} from './canvas/signalValidation';
import { CableHooks } from './canvas/CableHooks';
import { SnakeBox } from './canvas/SnakeBox';
import { CableLayer } from './canvas/CableLayer';
import { GearItemNode } from './canvas/GearItemNode';
import { CanvasInspector } from './canvas/CanvasInspector';
import { traceSignalPath, HighlightedSignalPath } from './canvas/signalPath';
import { SignalFlowHUD } from './canvas/SignalFlowHUD';

interface StudioCanvasProps {
  environment: EnvironmentMode;
  placedGear: PlacedGear[];
  onUpdateGear: (updated: PlacedGear[], options?: { coalesce?: boolean; action?: string }) => void;
  connections: CableConnection[];
  onUpdateConnections: (updated: CableConnection[], options?: { coalesce?: boolean; action?: string }) => void;
  mixerChannels: MixerChannelState[];
  onPatchToMixer: (gearInstanceId: string, channelNumber: number) => void;
  onUpdateChannel?: (channelNumber: number, updates: Partial<MixerChannelState>, options?: { coalesce?: boolean; action?: string }) => void;
  onBatchUpdate?: (
    updates: {
      placedGear?: PlacedGear[] | ((prev: PlacedGear[]) => PlacedGear[]);
      connections?: CableConnection[] | ((prev: CableConnection[]) => CableConnection[]);
      mixerChannels?: MixerChannelState[] | ((prev: MixerChannelState[]) => MixerChannelState[]);
    },
    options?: { action?: string; coalesce?: boolean }
  ) => void;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onOpenPaletteDrawer?: () => void;
  isPaletteCollapsed?: boolean;
  activeCableTool?: CableType | null;
  onActiveCableToolChange?: (type: CableType | null) => void;
  connectingFromId?: string | null;
  onConnectingFromIdChange?: (id: string | null) => void;
  selectedGearTab?: GearCategory | 'all';
  onSelectGearTab?: (tab: GearCategory | 'all') => void;
  isDiBoxHighlighted?: boolean;
  onDiBoxHighlightChange?: (highlighted: boolean) => void;
}

interface MarqueeBoxState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isAdditive: boolean;
  initialSelectedIds: string[];
}

export const StudioCanvas: React.FC<StudioCanvasProps> = ({
  environment,
  placedGear,
  onUpdateGear,
  connections,
  onUpdateConnections,
  mixerChannels,
  onPatchToMixer,
  onUpdateChannel,
  onBatchUpdate,
  selectedItemId,
  onSelectItem,
  onOpenPaletteDrawer,
  isPaletteCollapsed = false,
  activeCableTool: activeCableToolProp,
  onActiveCableToolChange,
  connectingFromId: connectingFromIdProp,
  onConnectingFromIdChange,
  selectedGearTab,
  onSelectGearTab,
  isDiBoxHighlighted = false,
  onDiBoxHighlightChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Multi-element selection and marquee box state
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [marqueeBox, setMarqueeBox] = useState<MarqueeBoxState | null>(null);
  const hasMarqueeMovedRef = useRef(false);

  // Signal Path Highlighting state & calculation
  const [isHighlightSignalPathEnabled, setIsHighlightSignalPathEnabled] = useState(true);

  const highlightedSignalPath = React.useMemo(() => {
    if (!selectedItemId) return null;
    return traceSignalPath(selectedItemId, placedGear, connections, mixerChannels, environment);
  }, [selectedItemId, placedGear, connections, mixerChannels, environment]);

  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    instanceIds: string[];
    title: string;
    description: string;
  } | null>(null);

  // Sync selectedItemIds with selectedItemId prop
  useEffect(() => {
    if (selectedItemId && !selectedItemIds.includes(selectedItemId)) {
      setSelectedItemIds([selectedItemId]);
    } else if (!selectedItemId && selectedItemIds.length === 1) {
      setSelectedItemIds([]);
    }
  }, [selectedItemId]);

  const openDeleteConfirm = (idsToDelete: string[]) => {
    if (idsToDelete.length === 0) return;
    if (idsToDelete.length === 1) {
      const item = placedGear.find((g) => g.instanceId === idsToDelete[0]);
      const def = item ? getGearById(item.gearId) : null;
      setDeleteConfirmDialog({
        instanceIds: idsToDelete,
        title: `Delete ${def?.name || 'Equipment'}?`,
        description: `Are you sure you want to remove this ${def?.name || 'item'} from the stage plot? Any connected cables will also be removed.`,
      });
    } else {
      setDeleteConfirmDialog({
        instanceIds: idsToDelete,
        title: `Delete ${idsToDelete.length} Selected Items?`,
        description: `Are you sure you want to delete these ${idsToDelete.length} selected equipment items? All attached cables will be disconnected.`,
      });
    }
  };

  // Keyboard shortcut listener (Delete/Backspace triggers confirmation)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const idsToDelete = selectedItemIds.length > 0 ? selectedItemIds : selectedItemId ? [selectedItemId] : [];
        if (idsToDelete.length > 0) {
          e.preventDefault();
          openDeleteConfirm(idsToDelete);
        }
      }
      if (e.key === 'Escape') {
        setSelectedItemIds([]);
        onSelectItem(null);
        setDeleteConfirmDialog(null);
        setMarqueeBox(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemIds, selectedItemId, placedGear, onSelectItem]);

  // Canvas container dimensions tracking for accurate cable routing
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 1000, height: 650 });

  // Dynamic click & drag box resizing state
  const [resizingId, setResizingId] = useState<string | null>(null);
  const resizeStartRef = useRef<{
    startX: number;
    startY: number;
    initWidth: number;
    initHeight: number;
  }>({ startX: 0, startY: 0, initWidth: 0, initHeight: 0 });

  useEffect(() => {
    if (!resizingId) return;

    let rafId: number | null = null;
    let latestEvent: MouseEvent | null = null;

    const handleWindowMouseMove = (e: MouseEvent) => {
      latestEvent = e;
      if (rafId !== null) return;

      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!latestEvent) return;

        const deltaX = latestEvent.clientX - resizeStartRef.current.startX;
        const deltaY = latestEvent.clientY - resizeStartRef.current.startY;
        const initW = resizeStartRef.current.initWidth;
        const initH = resizeStartRef.current.initHeight;
        const aspectRatio = initW / (initH || 1);

        // Project drag delta onto diagonal to strictly preserve the box aspect ratio
        const delta = (deltaX + deltaY * aspectRatio) / (1 + aspectRatio * aspectRatio);
        let newWidth = Math.round(initW + delta);
        newWidth = Math.max(70, Math.min(480, newWidth));
        let newHeight = Math.round(newWidth / aspectRatio);
        newHeight = Math.max(65, Math.min(480, newHeight));
        newWidth = Math.round(newHeight * aspectRatio);

        onUpdateGear(
          placedGear.map((g) =>
            g.instanceId === resizingId
              ? { ...g, customWidth: newWidth, customHeight: newHeight }
              : g
          ),
          { coalesce: true, action: 'Resize Equipment' }
        );
      });
    };

    const handleWindowMouseUp = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      setResizingId(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [resizingId, placedGear, onUpdateGear]);

  // Marquee selection window listeners (handling drag outside container/viewport)
  useEffect(() => {
    if (!marqueeBox) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const curX = e.clientX - rect.left;
      const curY = e.clientY - rect.top;

      if (Math.hypot(curX - marqueeBox.startX, curY - marqueeBox.startY) > 3) {
        hasMarqueeMovedRef.current = true;
      }

      setMarqueeBox((prev) => {
        if (!prev) return null;
        const updated = { ...prev, currentX: curX, currentY: curY };

        const boxLeft = Math.min(updated.startX, updated.currentX);
        const boxTop = Math.min(updated.startY, updated.currentY);
        const boxRight = Math.max(updated.startX, updated.currentX);
        const boxBottom = Math.max(updated.startY, updated.currentY);

        const intersectedIds = placedGear
          .filter((item) => {
            const dims = getGearBoxDimensions(
              item.gearId,
              !!item.latchedSourceInstanceId,
              item.customScale,
              item.customWidth,
              item.customHeight
            );
            const itemLeft = item.x;
            const itemTop = item.y;
            const itemRight = item.x + dims.width;
            const itemBottom = item.y + dims.height;

            // Bounding box intersection check
            return !(
              boxRight < itemLeft ||
              boxLeft > itemRight ||
              boxBottom < itemTop ||
              boxTop > itemBottom
            );
          })
          .map((item) => item.instanceId);

        let combinedIds: string[];
        if (updated.isAdditive) {
          combinedIds = Array.from(new Set([...updated.initialSelectedIds, ...intersectedIds]));
        } else {
          combinedIds = intersectedIds;
        }

        setSelectedItemIds(combinedIds);
        if (combinedIds.length === 1) {
          onSelectItem(combinedIds[0]);
        } else if (combinedIds.length === 0) {
          onSelectItem(null);
        } else if (!selectedItemId || !combinedIds.includes(selectedItemId)) {
          onSelectItem(combinedIds[0]);
        }

        return updated;
      });
    };

    const handleWindowMouseUp = () => {
      setMarqueeBox(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [marqueeBox, placedGear, selectedItemId, onSelectItem]);

  // Window mouseup listener for gear dragging (handles releasing outside canvas)
  useEffect(() => {
    if (!draggingId) return;

    let rafId: number | null = null;
    let latestEvent: MouseEvent | null = null;

    const handleWindowMouseMove = (e: MouseEvent) => {
      latestEvent = e;
      if (rafId !== null) return;

      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!latestEvent || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const curX = latestEvent.clientX - rect.left;
        const curY = latestEvent.clientY - rect.top;
        setMousePos({ x: curX, y: curY });

        const deltaX = curX - dragOriginRef.current.x;
        const deltaY = curY - dragOriginRef.current.y;
        const startPosMap = dragStartPositionsRef.current;

        onUpdateGear(
          placedGear.map((g) => {
            const startPos = startPosMap.get(g.instanceId);
            if (!startPos) return g;

            const dims = getGearBoxDimensions(
              g.gearId,
              !!g.latchedSourceInstanceId,
              g.customScale,
              g.customWidth,
              g.customHeight
            );

            const newX = Math.max(10, Math.min(rect.width - dims.width - 10, startPos.x + deltaX));
            const newY = Math.max(10, Math.min(rect.height - dims.height - 10, startPos.y + deltaY));
            return { ...g, x: newX, y: newY };
          }),
          { coalesce: true, action: 'Move Equipment' }
        );
      });
    };

    const handleWindowMouseUp = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      setDraggingId(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [draggingId, placedGear, onUpdateGear]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Cable dragging & tool states
  const [internalConnectingFromId, setInternalConnectingFromId] = useState<string | null>(null);
  const [internalActiveCableTool, setInternalActiveCableTool] = useState<CableType | null>(null);
  const [cableTypeToConnect, setCableTypeToConnect] = useState<CableType>('xlr');
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isMouseDraggingCable, setIsMouseDraggingCable] = useState(false);

  const connectingFromId = connectingFromIdProp !== undefined ? connectingFromIdProp : internalConnectingFromId;
  const setConnectingFromId = (id: string | null) => {
    setInternalConnectingFromId(id);
    onConnectingFromIdChange?.(id);
  };

  const activeCableTool = activeCableToolProp !== undefined ? activeCableToolProp : internalActiveCableTool;
  const setActiveCableTool = (type: CableType | null) => {
    setInternalActiveCableTool(type);
    onActiveCableToolChange?.(type);
  };

  // Signal flow error toast notification state
  const [errorNotification, setErrorNotification] = useState<{ title: string; message: string } | null>(null);
  const [isXlrErrorHighlighted, setIsXlrErrorHighlighted] = useState(false);
  const [isQuarterInchErrorHighlighted, setIsQuarterInchErrorHighlighted] = useState(false);
  const errorTimeoutRef = useRef<number | null>(null);
  const xlrHighlightTimeoutRef = useRef<number | null>(null);
  const quarterHighlightTimeoutRef = useRef<number | null>(null);
  const diBoxHighlightTimeoutRef = useRef<number | null>(null);

  const showErrorToast = (title: string, message: string) => {
    if (errorTimeoutRef.current) {
      window.clearTimeout(errorTimeoutRef.current);
    }
    if (xlrHighlightTimeoutRef.current) {
      window.clearTimeout(xlrHighlightTimeoutRef.current);
    }
    if (quarterHighlightTimeoutRef.current) {
      window.clearTimeout(quarterHighlightTimeoutRef.current);
    }
    if (diBoxHighlightTimeoutRef.current) {
      window.clearTimeout(diBoxHighlightTimeoutRef.current);
    }
    setErrorNotification({ title, message });

    if (title === 'Select XLR Cable First') {
      setIsXlrErrorHighlighted(true);
      xlrHighlightTimeoutRef.current = window.setTimeout(() => {
        setIsXlrErrorHighlighted(false);
      }, 3500);
    } else {
      setIsXlrErrorHighlighted(false);
    }

    if (
      title.toLowerCase().includes('1/4') ||
      message.toLowerCase().includes('1/4') ||
      title.toLowerCase().includes('quarter') ||
      message.toLowerCase().includes('quarter') ||
      title === 'Select 1/4" Cable First'
    ) {
      setIsQuarterInchErrorHighlighted(true);
      quarterHighlightTimeoutRef.current = window.setTimeout(() => {
        setIsQuarterInchErrorHighlighted(false);
      }, 3500);
    } else {
      setIsQuarterInchErrorHighlighted(false);
    }

    if (title.toLowerCase().includes('di box') || message.toLowerCase().includes('di box')) {
      onOpenPaletteDrawer?.();
      onSelectGearTab?.('di_box');
      onDiBoxHighlightChange?.(true);
      diBoxHighlightTimeoutRef.current = window.setTimeout(() => {
        onDiBoxHighlightChange?.(false);
      }, 3500);
    } else {
      onDiBoxHighlightChange?.(false);
    }

    errorTimeoutRef.current = window.setTimeout(() => {
      setErrorNotification(null);
    }, 4000);
  };

  const getGearCenter = (item: PlacedGear) => {
    const isAssigned =
      !!item.latchedSourceInstanceId ||
      mixerChannels.some((ch) => ch.assignedGearInstanceId === item.instanceId || ch.channelNumber === item.assignedChannel) ||
      connections.some((c) => c.fromInstanceId === item.instanceId || c.toInstanceId === item.instanceId);
    const dims = getGearBoxDimensions(
      item.gearId,
      isAssigned,
      item.customScale,
      item.customWidth,
      item.customHeight
    );
    return {
      x: item.x + dims.width / 2,
      y: item.y + dims.height / 2,
    };
  };

  const getPortOrGearCenter = (instanceId: string): { x: number; y: number } => {
    if (instanceId.startsWith('snake_in_')) {
      const chNum = parseInt(instanceId.replace('snake_in_', ''), 10);
      return getSnakeChannelPosition(chNum, environment, canvasSize.width, canvasSize.height);
    }
    if (instanceId === 'snake_out_mon1') return getSnakeOutputPosition('mon1', environment, canvasSize.width, canvasSize.height);
    if (instanceId === 'snake_out_mon2') return getSnakeOutputPosition('mon2', environment, canvasSize.width, canvasSize.height);
    if (instanceId === 'snake_out_main_l') return getSnakeOutputPosition('main_l', environment, canvasSize.width, canvasSize.height);
    if (instanceId === 'snake_out_main_r') return getSnakeOutputPosition('main_r', environment, canvasSize.width, canvasSize.height);
    const item = placedGear.find((g) => g.instanceId === instanceId);
    if (item) return getGearCenter(item);
    return { x: 0, y: 0 };
  };

  const handleStartResize = (e: React.MouseEvent, item: PlacedGear) => {
    e.stopPropagation();
    e.preventDefault();
    onSelectItem(item.instanceId);
    const dims = getGearBoxDimensions(
      item.gearId,
      !!item.latchedSourceInstanceId,
      item.customScale,
      item.customWidth,
      item.customHeight
    );
    setResizingId(item.instanceId);
    resizeStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initWidth: dims.width,
      initHeight: dims.height,
    };
  };

  const handleMouseDown = (e: React.MouseEvent, item: PlacedGear) => {
    e.stopPropagation();

    // If cable tool is active
    if (activeCableTool) {
      if (connectingFromId) {
        if (connectingFromId !== item.instanceId) {
          completeConnection(connectingFromId, item.instanceId, cableTypeToConnect || activeCableTool);
        }
        setActiveCableTool(null);
        setConnectingFromId(null);
        setIsMouseDraggingCable(false);
        return;
      }

      if (isAcousticInstrument(item.gearId)) {
        const def = getGearById(item.gearId);
        showErrorToast(
          'Acoustic Sound Source',
          `${def?.name || 'This instrument'} has no cable output jack. Position a microphone aimed at it to capture the sound.`
        );
        setActiveCableTool(null);
        setConnectingFromId(null);
        setIsMouseDraggingCable(false);
        return;
      }

      setConnectingFromId(item.instanceId);
      setCableTypeToConnect(activeCableTool);
      setIsMouseDraggingCable(true);
      return;
    }

    const isAlreadySelected = selectedItemIds.includes(item.instanceId);
    const isAdditive = e.shiftKey || e.metaKey || e.ctrlKey;

    let newSelectedIds: string[];
    if (isAdditive) {
      if (isAlreadySelected) {
        newSelectedIds = selectedItemIds.filter((id) => id !== item.instanceId);
      } else {
        newSelectedIds = [...selectedItemIds, item.instanceId];
      }
    } else {
      if (isAlreadySelected && selectedItemIds.length > 1) {
        // Keep group selection so user can immediately drag all selected items at once!
        newSelectedIds = selectedItemIds;
      } else {
        newSelectedIds = [item.instanceId];
      }
    }

    setSelectedItemIds(newSelectedIds);
    if (newSelectedIds.length === 1) {
      onSelectItem(newSelectedIds[0]);
    } else if (newSelectedIds.length === 0) {
      onSelectItem(null);
    } else {
      onSelectItem(newSelectedIds.includes(item.instanceId) ? item.instanceId : newSelectedIds[0]);
    }

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      setDraggingId(item.instanceId);
      dragOriginRef.current = { x: clickX, y: clickY };

      // Collect all items to move: selected items + their latched children
      const movingIds = new Set<string>();
      if (newSelectedIds.includes(item.instanceId)) {
        newSelectedIds.forEach((id) => movingIds.add(id));
      } else {
        movingIds.add(item.instanceId);
      }

      placedGear.forEach((g) => {
        if (g.latchedSourceInstanceId && movingIds.has(g.latchedSourceInstanceId)) {
          if (g.gearId !== 'gear_iem_transmitter') {
            movingIds.add(g.instanceId);
          }
        }
      });

      const startPosMap = new Map<string, { x: number; y: number }>();
      placedGear.forEach((g) => {
        if (movingIds.has(g.instanceId)) {
          startPosMap.set(g.instanceId, { x: g.x, y: g.y });
        }
      });
      dragStartPositionsRef.current = startPosMap;
    }
  };

  const handleStartCableDragFromSnakeChannel = (e: React.MouseEvent, channelNumber: number) => {
    e.stopPropagation();
    const socketId = `snake_in_${channelNumber}`;

    if (!activeCableTool) {
      showErrorToast(
        'Select XLR Cable First',
        'Click the "XLR Cable" button in the top-left cable rack to pick up a cable before patching.'
      );
      return;
    }

    if (activeCableTool !== 'xlr') {
      showErrorToast(
        '1/4" Cable Incompatible',
        'The snake stage box only accepts balanced XLR cables. Route your instrument to a DI box or amplifier first.'
      );
      setActiveCableTool(null);
      setConnectingFromId(null);
      setIsMouseDraggingCable(false);
      return;
    }

    if (connectingFromId) {
      if (connectingFromId !== socketId) {
        completeConnection(connectingFromId, socketId, 'xlr');
      }
      setActiveCableTool(null);
      setConnectingFromId(null);
      setIsMouseDraggingCable(false);
      return;
    }

    setConnectingFromId(socketId);
    setCableTypeToConnect('xlr');
    setIsMouseDraggingCable(true);
  };

  const handleStartCableDragFromSnakeOutput = (
    e: React.MouseEvent,
    outputPort: 'mon1' | 'mon2' | 'main_l' | 'main_r'
  ) => {
    e.stopPropagation();
    const portInstanceId = `snake_out_${outputPort}`;

    if (!activeCableTool) {
      showErrorToast(
        'Select XLR Cable First',
        'Click the "XLR Cable" button in the top-left cable rack to pick up a cable before patching.'
      );
      return;
    }

    if (activeCableTool !== 'xlr') {
      showErrorToast(
        '1/4" Cable Incompatible',
        'The snake stage box only accepts balanced XLR cables. Connect to stage monitors or PA speakers using XLR.'
      );
      setActiveCableTool(null);
      setConnectingFromId(null);
      setIsMouseDraggingCable(false);
      return;
    }

    if (connectingFromId) {
      if (connectingFromId !== portInstanceId) {
        completeConnection(connectingFromId, portInstanceId, 'xlr');
      }
      setActiveCableTool(null);
      setConnectingFromId(null);
      setIsMouseDraggingCable(false);
      return;
    }

    setConnectingFromId(portInstanceId);
    setCableTypeToConnect('xlr');
    setIsMouseDraggingCable(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;
    setMousePos({ x: curX, y: curY });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (draggingId) {
      setDraggingId(null);
    }

    if (isMouseDraggingCable && connectingFromId) {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const curX = e.clientX - rect.left;
        const curY = e.clientY - rect.top;

        // Check snake channel inputs (CH 1-8)
        let handled = false;
        for (let ch = 1; ch <= 8; ch++) {
          const socketPos = getSnakeChannelPosition(ch, environment, canvasSize.width, canvasSize.height);
          if (Math.hypot(curX - socketPos.x, curY - socketPos.y) < 36) {
            const socketId = `snake_in_${ch}`;
            if (connectingFromId !== socketId) {
              if (activeCableTool !== 'xlr') {
                showErrorToast('1/4" Cable Incompatible', 'The snake stage box only accepts balanced XLR cables.');
              } else {
                completeConnection(connectingFromId, socketId, 'xlr');
              }
            }
            handled = true;
            break;
          }
        }

        // Check snake outputs (MON 1, MON 2, MAIN L, MAIN R)
        if (!handled && environment === 'live_stage') {
          const outputs: Array<'mon1' | 'mon2' | 'main_l' | 'main_r'> = ['mon1', 'mon2', 'main_l', 'main_r'];
          for (const port of outputs) {
            const socketPos = getSnakeOutputPosition(port, environment, canvasSize.width, canvasSize.height);
            if (Math.hypot(curX - socketPos.x, curY - socketPos.y) < 36) {
              const portInstanceId = `snake_out_${port}`;
              if (connectingFromId !== portInstanceId) {
                if (activeCableTool !== 'xlr') {
                  showErrorToast('1/4" Cable Incompatible', 'The snake stage box only accepts balanced XLR cables.');
                } else {
                  completeConnection(connectingFromId, portInstanceId, 'xlr');
                }
              }
              handled = true;
              break;
            }
          }
        }

        // Check gear items
        if (!handled) {
          const target = placedGear.find((g) => {
            if (g.instanceId === connectingFromId) return false;
            const dims = getGearBoxDimensions(
              g.gearId,
              !!g.latchedSourceInstanceId,
              g.customScale,
              g.customWidth,
              g.customHeight
            );
            return curX >= g.x && curX <= g.x + dims.width && curY >= g.y && curY <= g.y + dims.height;
          });

          if (target) {
            completeConnection(connectingFromId, target.instanceId, cableTypeToConnect || activeCableTool || 'xlr');
          }
        }

        setActiveCableTool(null);
        setConnectingFromId(null);
      }
      setIsMouseDraggingCable(false);
    }
  };

  const handleContainerMouseDown = (e: React.MouseEvent) => {
    // Only respond to left clicks
    if (e.button !== 0) return;

    // Ignore if cable tool is active
    if (activeCableTool || connectingFromId || resizingId) return;

    // Ignore if clicked directly on an interactive item or button
    const target = e.target as HTMLElement | null;
    if (
      target?.closest('[id^="placed-gear-"]') ||
      target?.closest('button') ||
      target?.closest('select') ||
      target?.closest('option') ||
      target?.closest('#item-inspector-toolbar') ||
      target?.closest('#signal-flow-hud-container') ||
      target?.closest('.canvas-inspector') ||
      target?.closest('[data-no-marquee]')
    ) {
      return;
    }

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const isAdditive = e.shiftKey || e.metaKey || e.ctrlKey;
    const initialIds = isAdditive ? [...selectedItemIds] : [];

    if (!isAdditive) {
      setSelectedItemIds([]);
      onSelectItem(null);
    }

    hasMarqueeMovedRef.current = false;
    setMarqueeBox({
      startX: clickX,
      startY: clickY,
      currentX: clickX,
      currentY: clickY,
      isAdditive,
      initialSelectedIds: initialIds,
    });
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (hasMarqueeMovedRef.current) {
      hasMarqueeMovedRef.current = false;
      return;
    }

    const target = e.target as HTMLElement | null;
    if (
      target?.closest('[id^="placed-gear-"]') ||
      target?.closest('button') ||
      target?.closest('select') ||
      target?.closest('option') ||
      target?.closest('#item-inspector-toolbar') ||
      target?.closest('#signal-flow-hud-container') ||
      target?.closest('.canvas-inspector') ||
      target?.closest('[data-no-marquee]')
    ) {
      return;
    }

    if (connectingFromId || activeCableTool) {
      setActiveCableTool(null);
      setConnectingFromId(null);
      setIsMouseDraggingCable(false);
    }
  };

  const handleDropOnCanvas = (e: React.DragEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    try {
      const rawData = e.dataTransfer.getData('application/json');
      if (!rawData) return;
      const data = JSON.parse(rawData);

      if (data.type !== 'gear_catalog_item' || !data.gearId) return;

      const rect = containerRef.current.getBoundingClientRect();
      const dropX = e.clientX - rect.left;
      const dropY = e.clientY - rect.top;

      const newDef = getGearById(data.gearId);
      if (!newDef) return;

      // Check if dropped onto existing gear to swap
      const targetItem = placedGear.find((item) => {
        const dims = getGearBoxDimensions(
          item.gearId,
          !!item.latchedSourceInstanceId,
          item.customScale,
          item.customWidth,
          item.customHeight
        );
        const withinX = dropX >= item.x - 20 && dropX <= item.x + dims.width + 20;
        const withinY = dropY >= item.y - 20 && dropY <= item.y + dims.height + 20;
        return withinX && withinY;
      });

      if (targetItem) {
        const targetDef = getGearById(targetItem.gearId);
        const isSameCategory =
          targetDef?.category === newDef.category ||
          (targetDef?.category === 'amplifier' && newDef.category === 'amplifier') ||
          (targetDef?.category === 'di_box' && newDef.category === 'di_box');

        if (isSameCategory) {
          onUpdateGear(
            placedGear.map((g) =>
              g.instanceId === targetItem.instanceId
                ? { ...g, gearId: data.gearId }
                : g
            ),
            { action: `Swap to ${newDef.name}` }
          );
          setSelectedItemIds([targetItem.instanceId]);
          onSelectItem(targetItem.instanceId);
          showErrorToast('Gear Swapped', `Swapped ${targetDef?.name} with ${newDef.name}`);
          return;
        } else if (newDef.category === 'microphone' && (targetItem.gearId.includes('drum') || targetItem.gearId === 'gear_drum_kit')) {
          const sourceDims = getGearBoxDimensions(
            targetItem.gearId,
            !!targetItem.latchedSourceInstanceId,
            targetItem.customScale,
            targetItem.customWidth,
            targetItem.customHeight
          );
          const itemDims = getGearBoxDimensions(data.gearId, true, undefined, undefined, undefined, true);
          const centeredX = targetItem.x + (sourceDims.width - itemDims.width) / 2;
          const posX = Math.max(10, Math.min(rect.width - itemDims.width - 10, centeredX));
          const posY = Math.max(10, Math.min(rect.height - itemDims.height - 10, targetItem.y + sourceDims.height * 0.85));

          const instanceId = `gear_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const newGear: PlacedGear = {
            instanceId,
            gearId: data.gearId,
            x: posX,
            y: posY,
            rotation: 0,
            latchedSourceInstanceId: targetItem.instanceId,
            standHeight: undefined,
            hasPopFilter: false,
          };
          onUpdateGear([...placedGear, newGear], { action: `Add ${newDef.name} on ${targetDef?.name}` });
          setSelectedItemIds([instanceId]);
          onSelectItem(instanceId);
          showErrorToast('Microphone Attached', `Placed ${newDef.name} on ${targetDef?.name}`);
          return;
        }
      }

      if (data.gearId === 'inst_drum_set') {
        const timestamp = Date.now();
        const baseRandom = Math.random().toString(36).substring(2, 6);

        const kitPieces = [
          { gearId: 'inst_kick_drum', offsetX: 0, offsetY: 0, label: 'Kick Drum' },
          { gearId: 'inst_tom_drum', offsetX: -95, offsetY: -85, label: 'Rack Tom 1' },
          { gearId: 'inst_snare_drum', offsetX: 95, offsetY: -85, label: 'Snare Drum' },
          { gearId: 'inst_hi_hat', offsetX: 240, offsetY: -95, label: 'Hi-Hats' },
          { gearId: 'inst_drum_cymbals', offsetX: -160, offsetY: 0, label: 'Cymbals / OH (Left)' },
          { gearId: 'inst_drum_cymbals', offsetX: 160, offsetY: 0, label: 'Cymbals / OH (Right)' },
          { gearId: 'inst_tom_drum', offsetX: -95, offsetY: 85, label: 'Floor Tom 1' },
          { gearId: 'inst_tom_drum', offsetX: 95, offsetY: 85, label: 'Floor Tom 2' },
        ];

        const newGearItems: PlacedGear[] = kitPieces.map((piece, index) => {
          const itemDef = getGearById(piece.gearId);
          const defWidth = itemDef?.size.width || 50;
          const defHeight = itemDef?.size.height || 50;
          const posX = Math.max(10, Math.min(rect.width - defWidth - 10, dropX + piece.offsetX - defWidth / 2));
          const posY = Math.max(10, Math.min(rect.height - defHeight - 10, dropY + piece.offsetY - defHeight / 2));

          return {
            instanceId: `gear_${timestamp}_${index}_${baseRandom}`,
            gearId: piece.gearId,
            x: posX,
            y: posY,
            rotation: 0,
            label: piece.label,
            standHeight: undefined,
            hasPopFilter: false,
          };
        });

        onUpdateGear([...placedGear, ...newGearItems], { action: 'Add 5-Piece Drum Set' });
        setSelectedItemIds(newGearItems.map((g) => g.instanceId));
        onSelectItem(newGearItems[0].instanceId);
        showErrorToast('5-Piece Drum Set Added', 'Placed Kick, Snare, 3 Toms, and 2 Overheads oriented as a drum kit.');
        return;
      }

      const dims = getGearBoxDimensions(data.gearId);
      const posX = Math.max(10, Math.min(rect.width - dims.width - 10, dropX - dims.width / 2));
      const posY = Math.max(10, Math.min(rect.height - dims.height - 10, dropY - dims.height / 2));

      const instanceId = `gear_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newGear: PlacedGear = {
        instanceId,
        gearId: data.gearId,
        x: posX,
        y: posY,
        rotation: 0,
        standHeight: undefined,
        hasPopFilter: false,
      };

      onUpdateGear([...placedGear, newGear], { action: `Add ${newDef.name}` });
      setSelectedItemIds([instanceId]);
      onSelectItem(instanceId);
    } catch {
      // ignore
    }
  };

  const completeConnection = (fromId: string, toId: string, type: CableType) => {
    // Snake inputs
    if (fromId.startsWith('snake_in_') || toId.startsWith('snake_in_')) {
      const snakeId = fromId.startsWith('snake_in_') ? fromId : toId;
      const gearId = fromId.startsWith('snake_in_') ? toId : fromId;
      const chNum = parseInt(snakeId.replace('snake_in_', ''), 10);
      const gear = placedGear.find((g) => g.instanceId === gearId);
      if (gear) {
        const validation = validateGearToSnakeConnection(gear, type, environment);
        if (!validation.valid) {
          showErrorToast(validation.title || 'Invalid Signal Routing', validation.error || 'Signal flow mismatch.');
          return;
        }
        onPatchToMixer(gear.instanceId, chNum);
        return;
      }
    }

    // Snake outputs
    if (fromId.startsWith('snake_out_') || toId.startsWith('snake_out_')) {
      const snakeId = fromId.startsWith('snake_out_') ? fromId : toId;
      const gearId = fromId.startsWith('snake_out_') ? toId : fromId;
      const outputPort = snakeId.replace('snake_out_', '') as 'mon1' | 'mon2' | 'main_l' | 'main_r';
      const gear = placedGear.find((g) => g.instanceId === gearId);
      if (gear) {
        const validation = validateGearToSnakeOutputConnection(outputPort, gear, type);
        if (!validation.valid) {
          showErrorToast(validation.title || 'Invalid Snake Output Connection', validation.error || 'Signal flow mismatch.');
          return;
        }

        const exists = connections.some(
          (c) =>
            (c.fromInstanceId === fromId && c.toInstanceId === toId) ||
            (c.fromInstanceId === toId && c.toInstanceId === fromId)
        );
        if (!exists) {
          const newConnection: CableConnection = {
            id: `cable_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            fromInstanceId: fromId,
            toInstanceId: toId,
            cableType: type,
            color: '#F97316',
          };
          onUpdateConnections([...connections, newConnection], {
            action: `Connect ${type === 'quarter_inch' ? '1/4" TS' : type.toUpperCase()} Cable`,
          });
        }
        return;
      }
    }

    // Gear-to-gear
    const fromItem = placedGear.find((g) => g.instanceId === fromId);
    const toItem = placedGear.find((g) => g.instanceId === toId);
    if (!fromItem || !toItem) return;

    const validation = validateGearToGearConnection(fromItem, toItem, type);
    if (!validation.valid) {
      showErrorToast(validation.title || 'Signal Routing Error', validation.error || 'Incompatible connection.');
      return;
    }

    const exists = connections.some(
      (c) =>
        (c.fromInstanceId === fromId && c.toInstanceId === toId) ||
        (c.fromInstanceId === toId && c.toInstanceId === fromId)
    );
    if (exists) return;

    const newConnection: CableConnection = {
      id: `cable_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      fromInstanceId: fromId,
      toInstanceId: toId,
      cableType: type,
      color: type === 'quarter_inch' ? '#38BDF8' : type === 'xlr' ? '#F97316' : '#22C55E',
    };

    onUpdateConnections([...connections, newConnection], {
      action: `Connect ${type === 'quarter_inch' ? '1/4" TS' : type.toUpperCase()} Cable`,
    });
  };

  const handleConnectToSnakeOutput = (outputPort: 'mon1' | 'mon2' | 'main_l' | 'main_r') => {
    const portInstanceId = `snake_out_${outputPort}`;
    if (connectingFromId) {
      if (connectingFromId === portInstanceId) {
        setActiveCableTool(null);
        setConnectingFromId(null);
        setIsMouseDraggingCable(false);
        return;
      }
      const fromItem = placedGear.find((g) => g.instanceId === connectingFromId);
      if (fromItem) {
        const validation = validateGearToSnakeOutputConnection(outputPort, fromItem, cableTypeToConnect || activeCableTool || 'xlr');
        if (!validation.valid) {
          showErrorToast(validation.title || 'Invalid Snake Output Connection', validation.error || 'Signal flow mismatch.');
          setActiveCableTool(null);
          setConnectingFromId(null);
          setIsMouseDraggingCable(false);
          return;
        }

        const exists = connections.some(
          (c) =>
            (c.fromInstanceId === portInstanceId && c.toInstanceId === fromItem.instanceId) ||
            (c.toInstanceId === portInstanceId && c.fromInstanceId === fromItem.instanceId)
        );
        if (!exists) {
          const newConnection: CableConnection = {
            id: `cable_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            fromInstanceId: portInstanceId,
            toInstanceId: fromItem.instanceId,
            cableType: 'xlr',
            color: '#F97316',
          };
          onUpdateConnections([...connections, newConnection], {
            action: 'Connect Snake Output Cable',
          });
        }
        setActiveCableTool(null);
        setConnectingFromId(null);
        setIsMouseDraggingCable(false);
        return;
      }
      completeConnection(connectingFromId, portInstanceId, cableTypeToConnect || activeCableTool || 'xlr');
      setActiveCableTool(null);
      setConnectingFromId(null);
      setIsMouseDraggingCable(false);
      return;
    }

    if (!activeCableTool) {
      showErrorToast(
        'Select XLR Cable First',
        'Click the "XLR Cable" button in the top-left cable rack to pick up a cable before patching.'
      );
      return;
    }
    if (activeCableTool !== 'xlr') {
      showErrorToast(
        '1/4" Cable Incompatible',
        'The snake stage box only accepts balanced XLR cables. Route to stage monitors or PA speakers using XLR.'
      );
      setActiveCableTool(null);
      setConnectingFromId(null);
      setIsMouseDraggingCable(false);
      return;
    }

    setConnectingFromId(portInstanceId);
    setCableTypeToConnect('xlr');
    setIsMouseDraggingCable(false);
  };

  const handleConnectToSnakeChannel = (channelNumber: number) => {
    const socketId = `snake_in_${channelNumber}`;
    if (connectingFromId) {
      if (connectingFromId === socketId) {
        setActiveCableTool(null);
        setConnectingFromId(null);
        setIsMouseDraggingCable(false);
        return;
      }
      const fromItem = placedGear.find((g) => g.instanceId === connectingFromId);
      if (fromItem) {
        const validation = validateGearToSnakeConnection(fromItem, cableTypeToConnect || activeCableTool || 'xlr', environment);
        if (!validation.valid) {
          showErrorToast(validation.title || 'Invalid Snake Patch', validation.error || 'Signal mismatch.');
          setActiveCableTool(null);
          setConnectingFromId(null);
          setIsMouseDraggingCable(false);
          return;
        }
        onPatchToMixer(fromItem.instanceId, channelNumber);
        setActiveCableTool(null);
        setConnectingFromId(null);
        setIsMouseDraggingCable(false);
        return;
      }
      completeConnection(connectingFromId, socketId, cableTypeToConnect || activeCableTool || 'xlr');
      setActiveCableTool(null);
      setConnectingFromId(null);
      setIsMouseDraggingCable(false);
      return;
    }

    if (!activeCableTool) {
      showErrorToast(
        'Select XLR Cable First',
        'Click the "XLR Cable" button in the top-left cable rack to pick up a cable before patching.'
      );
      return;
    }
    if (activeCableTool !== 'xlr') {
      showErrorToast(
        '1/4" Cable Incompatible',
        'The snake stage box only accepts balanced XLR cables. Route your instrument to a DI box or amplifier first.'
      );
      setActiveCableTool(null);
      setConnectingFromId(null);
      setIsMouseDraggingCable(false);
      return;
    }

    setConnectingFromId(socketId);
    setCableTypeToConnect('xlr');
    setIsMouseDraggingCable(false);
  };

  const deleteConnection = (id: string) => {
    onUpdateConnections(
      connections.filter((c) => c.id !== id),
      { action: 'Disconnect Cable' }
    );
  };

  const setStandHeight = (instanceId: string, height: MicStandHeight | undefined) => {
    onUpdateGear(
      placedGear.map((g) =>
        g.instanceId === instanceId ? { ...g, standHeight: height } : g
      ),
      { action: `Stand Height: ${height || 'none'}` }
    );
  };

  const togglePopFilter = (instanceId: string) => {
    onUpdateGear(
      placedGear.map((g) =>
        g.instanceId === instanceId ? { ...g, hasPopFilter: !g.hasPopFilter } : g
      ),
      { action: 'Toggle Pop Filter' }
    );
  };

  const setMicPlacement = (instanceId: string, placement: string) => {
    onUpdateGear(
      placedGear.map((g) =>
        g.instanceId === instanceId ? { ...g, micPlacement: placement } : g
      ),
      { action: `Mic Position: ${placement}` }
    );
  };

  const setLatchedSource = (instanceId: string, sourceId: string | undefined) => {
    const isDrummerTarget = sourceId === 'drummer';
    const targetSource = isDrummerTarget
      ? placedGear.find((g) => g.gearId === 'gear_drum_kit')
      : sourceId
      ? placedGear.find((g) => g.instanceId === sourceId)
      : null;
    const currentItem = placedGear.find((g) => g.instanceId === instanceId);
    const currentDef = currentItem ? getGearById(currentItem.gearId) : null;

    let snappedX = currentItem?.x || 100;
    let snappedY = currentItem?.y || 100;

    if (targetSource && containerRef.current) {
      const sourceDims = getGearBoxDimensions(
        targetSource.gearId,
        !!targetSource.latchedSourceInstanceId,
        targetSource.customScale,
        targetSource.customWidth,
        targetSource.customHeight
      );
      const itemDims = currentItem
        ? getGearBoxDimensions(
            currentItem.gearId,
            true,
            currentItem.customScale,
            currentItem.customWidth,
            currentItem.customHeight
          )
        : { width: 76, height: 72 };
      const rect = containerRef.current.getBoundingClientRect();

      const otherLatched = placedGear.filter(
        (g) => g.latchedSourceInstanceId === (isDrummerTarget ? 'drummer' : targetSource.instanceId) && g.instanceId !== instanceId
      );

      if (currentItem?.gearId === 'gear_iem_transmitter') {
        const otherAssignedReceivers = placedGear.filter(
          (g) => g.gearId === 'gear_iem_transmitter' && g.latchedSourceInstanceId && g.instanceId !== instanceId
        );
        const stackIndex = otherAssignedReceivers.length;
        snappedX = Math.max(10, rect.width - itemDims.width - 24);
        snappedY = 20 + stackIndex * (itemDims.height + 8);
      } else if (currentItem?.gearId === 'gear_iem_receiver' || currentItem?.gearId === 'gear_in_ear_monitors') {
        snappedX = Math.max(10, targetSource.x - itemDims.width - 12);
        snappedY = targetSource.y + 4;
      } else if (currentItem?.gearId === 'gear_di_box') {
        snappedX = Math.min(rect.width - itemDims.width - 10, targetSource.x + sourceDims.width + 12);
        snappedY = targetSource.y + 4;
      } else if (currentDef?.category === 'microphone') {
        const isMicOnDrum = targetSource.gearId.includes('drum') || targetSource.gearId === 'gear_drum_kit';
        const itemDims = currentItem
          ? getGearBoxDimensions(
              currentItem.gearId,
              true,
              currentItem.customScale,
              currentItem.customWidth,
              currentItem.customHeight,
              isMicOnDrum
            )
          : { width: Math.round(76 * (isMicOnDrum ? 0.7 : 1.0)), height: Math.round(72 * (isMicOnDrum ? 0.7 : 1.0)) };
        const centeredX = targetSource.x + (sourceDims.width - itemDims.width) / 2;
        snappedX = Math.max(10, Math.min(rect.width - itemDims.width - 10, centeredX));
        if (isMicOnDrum) {
          snappedY = Math.max(10, Math.min(rect.height - itemDims.height - 10, targetSource.y + sourceDims.height * 0.85));
        } else {
          snappedY = Math.max(10, Math.min(rect.height - itemDims.height - 10, targetSource.y + sourceDims.height + 12));
        }
      } else if (currentItem?.gearId === 'gear_stage_monitor') {
        const centeredX = targetSource.x + (sourceDims.width - itemDims.width) / 2;
        snappedX = Math.max(10, Math.min(rect.width - itemDims.width - 10, centeredX));
        const hasLatchedMic = otherLatched.some((g) => getGearById(g.gearId)?.category === 'microphone');
        const offset = hasLatchedMic ? 84 : 14;
        snappedY = Math.max(10, Math.min(rect.height - itemDims.height - 10, targetSource.y + sourceDims.height + offset));
      } else {
        if (targetSource.x + sourceDims.width + itemDims.width + 16 < rect.width) {
          snappedX = targetSource.x + sourceDims.width + 12;
          snappedY = targetSource.y + 4;
        } else if (targetSource.x - itemDims.width - 12 > 10) {
          snappedX = targetSource.x - itemDims.width - 12;
          snappedY = targetSource.y + 4;
        } else {
          snappedX = targetSource.x;
          snappedY = targetSource.y + sourceDims.height + 12;
        }
      }
    }

    const updatedGear = placedGear.map((g) =>
      g.instanceId === instanceId
        ? {
            ...g,
            latchedSourceInstanceId: sourceId,
            x: targetSource ? snappedX : g.x,
            y: targetSource ? snappedY : g.y,
          }
        : g
    );
    onUpdateGear(updatedGear, { action: `Latch to ${sourceId || 'None'}` });

    const targetGear = updatedGear.find((g) => g.instanceId === instanceId);
    if (targetGear?.assignedChannel) {
      onPatchToMixer(instanceId, targetGear.assignedChannel);
    }
  };

  const deleteItem = (instanceId: string) => {
    if (onBatchUpdate) {
      onBatchUpdate(
        {
          placedGear: (prev) =>
            prev
              .filter((g) => g.instanceId !== instanceId)
              .map((g) => (g.latchedSourceInstanceId === instanceId ? { ...g, latchedSourceInstanceId: undefined } : g)),
          connections: (prev) =>
            prev.filter((c) => c.fromInstanceId !== instanceId && c.toInstanceId !== instanceId),
          mixerChannels: (prev) =>
            prev.map((ch) =>
              ch.assignedGearInstanceId === instanceId
                ? { ...ch, assignedGearInstanceId: null, label: `CH ${ch.channelNumber}` }
                : ch
            ),
        },
        { action: 'Delete Equipment' }
      );
    } else {
      onUpdateGear(
        placedGear
          .filter((g) => g.instanceId !== instanceId)
          .map((g) => (g.latchedSourceInstanceId === instanceId ? { ...g, latchedSourceInstanceId: undefined } : g))
      );
      onUpdateConnections(
        connections.filter((c) => c.fromInstanceId !== instanceId && c.toInstanceId !== instanceId)
      );
      mixerChannels.forEach((ch) => {
        if (ch.assignedGearInstanceId === instanceId && onUpdateChannel) {
          onUpdateChannel(ch.channelNumber, {
            assignedGearInstanceId: null,
            label: `CH ${ch.channelNumber}`,
          });
        }
      });
    }
    setSelectedItemIds((prev) => prev.filter((id) => id !== instanceId));
    if (selectedItemId === instanceId) onSelectItem(null);
  };

  const selectedItem = placedGear.find((g) => g.instanceId === selectedItemId) || null;

  return (
    <div
      ref={containerRef}
      id="studio-canvas-container"
      onMouseDown={handleContainerMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={handleDropOnCanvas}
      onClick={handleContainerClick}
      className="relative flex-1 h-full w-full bg-stone-950 overflow-hidden select-none cursor-default"
    >
      {/* Background Floor Plan Blueprint SVG */}
      <svg viewBox="0 0 1000 700" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <pattern id="studio-hardwood-pattern" width="160" height="48" patternUnits="userSpaceOnUse">
            <rect width="160" height="48" fill="#171310" />
            <rect x="0" y="0" width="80" height="24" fill="#1b1713" fillOpacity="0.75" />
            <rect x="80" y="0" width="80" height="24" fill="#14110e" fillOpacity="0.6" />
            <rect x="0" y="24" width="80" height="24" fill="#13100d" fillOpacity="0.6" />
            <rect x="80" y="24" width="80" height="24" fill="#1b1713" fillOpacity="0.75" />
            <line x1="0" y1="0" x2="160" y2="0" stroke="#0e0b09" strokeWidth="1.2" />
            <line x1="0" y1="1" x2="160" y2="1" stroke="#2c221a" strokeWidth="0.5" strokeOpacity="0.4" />
            <line x1="0" y1="24" x2="160" y2="24" stroke="#0e0b09" strokeWidth="1.2" />
            <line x1="0" y1="25" x2="160" y2="25" stroke="#2c221a" strokeWidth="0.5" strokeOpacity="0.4" />
            <line x1="0" y1="48" x2="160" y2="48" stroke="#0e0b09" strokeWidth="1.2" />
            <line x1="80" y1="0" x2="80" y2="24" stroke="#0e0b09" strokeWidth="1.2" />
            <line x1="0" y1="24" x2="0" y2="48" stroke="#0e0b09" strokeWidth="1.2" />
            <line x1="160" y1="24" x2="160" y2="48" stroke="#0e0b09" strokeWidth="1.2" />
          </pattern>

          <radialGradient id="studio-ambient-lighting" cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.04" />
            <stop offset="60%" stopColor="#78350f" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.12" />
          </radialGradient>

          <pattern id="stage-planks-pattern" width="160" height="40" patternUnits="userSpaceOnUse">
            <rect width="160" height="40" fill="#0d0c0b" />
            <rect x="0" y="0" width="80" height="20" fill="#12100e" fillOpacity="0.5" />
            <rect x="80" y="20" width="80" height="20" fill="#12100e" fillOpacity="0.5" />
            <line x1="0" y1="0" x2="160" y2="0" stroke="#1f1c19" strokeWidth="1" />
            <line x1="0" y1="20" x2="160" y2="20" stroke="#1f1c19" strokeWidth="1" />
            <line x1="80" y1="0" x2="80" y2="20" stroke="#1f1c19" strokeWidth="1" />
            <line x1="0" y1="20" x2="0" y2="40" stroke="#1f1c19" strokeWidth="1" />
            <line x1="160" y1="20" x2="160" y2="40" stroke="#1f1c19" strokeWidth="1" />
          </pattern>

          <radialGradient id="stage-spotlight" cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="#818CF8" stopOpacity="0.08" />
            <stop offset="60%" stopColor="#4F46E5" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.0" />
          </radialGradient>
        </defs>

        <rect
          width="100%"
          height="100%"
          fill={environment === 'recording_studio' ? 'url(#studio-hardwood-pattern)' : 'url(#stage-planks-pattern)'}
        />

        {environment === 'recording_studio' ? (
          <>
            <rect width="100%" height="100%" fill="url(#studio-ambient-lighting)" />
            <rect
              x="16"
              y="16"
              width="968"
              height="668"
              rx="16"
              fill="none"
              stroke="#D97706"
              strokeWidth="1.5"
              strokeDasharray="8 6"
              strokeOpacity="0.4"
            />
            <text
              x="500"
              y="670"
              textAnchor="middle"
              fill="#38BDF8"
              fontSize="10"
              fontWeight="bold"
              letterSpacing="1.5"
            >
              CONTROL ROOM WINDOW
            </text>
            <rect
              x="350"
              y="680"
              width="300"
              height="12"
              rx="3"
              fill="#0284C7"
              fillOpacity="0.3"
              stroke="#38BDF8"
              strokeWidth="1.5"
            />
          </>
        ) : (
          <>
            <rect width="100%" height="100%" fill="url(#stage-spotlight)" />
            <rect
              x="16"
              y="16"
              width="968"
              height="668"
              rx="12"
              fill="none"
              stroke="#6366F1"
              strokeWidth="1.5"
              strokeDasharray="8 6"
              strokeOpacity="0.35"
            />
            <text x="500" y="28" textAnchor="middle" fill="#71717A" fontSize="9" fontWeight="bold" letterSpacing="1.5">
              UPSTAGE BACKDROP
            </text>
            <line
              x1="20"
              y1="682"
              x2="980"
              y2="682"
              stroke="#818CF8"
              strokeWidth="2"
              strokeDasharray="6 4"
              strokeOpacity="0.6"
            />
            <text x="500" y="676" textAnchor="middle" fill="#A5B4FC" fontSize="9" fontWeight="bold" letterSpacing="1">
              AUDIENCE / FRONT-OF-HOUSE
            </text>
          </>
        )}
      </svg>

      {/* Empty Canvas State Indicator */}
      {placedGear.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-stone-500 z-10 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3 text-stone-400 shadow-lg">
            <Cable className="w-8 h-8 opacity-60" />
          </div>
          <h2 className="text-base font-extrabold text-stone-300 mb-1">
            {environment === 'recording_studio' ? 'Studio Floor is Empty' : 'Live Stage is Empty'}
          </h2>
          <p className="text-xs text-stone-400 max-w-lg leading-relaxed">
            {environment === 'recording_studio'
              ? 'Drag instruments, microphones, and studio headphones from the Equipment Locker onto the floor to build your tracking session signal chain.'
              : 'Drag instruments, microphones, Front of House (FOH) PA speakers, and stage/IEM monitors onto the stage.'}
          </p>
        </div>
      )}

      {/* Cable Hooks & Active Signal Flow Toast */}
      <CableHooks
        activeCableTool={activeCableTool}
        onSelectCableTool={(type) => {
          setActiveCableTool(type);
          setCableTypeToConnect(type || 'xlr');
          setConnectingFromId(null);
          setIsMouseDraggingCable(false);
        }}
        isXlrHighlighted={isXlrErrorHighlighted}
        isQuarterInchHighlighted={isQuarterInchErrorHighlighted}
      />

      {/* Signal Flow Path Tracing HUD */}
      <SignalFlowHUD
        highlightedPath={highlightedSignalPath}
        isHighlightEnabled={isHighlightSignalPathEnabled}
        onToggleHighlight={() => setIsHighlightSignalPathEnabled((prev) => !prev)}
        onSelectGear={onSelectItem}
        onUpdateChannel={onUpdateChannel}
        mixerChannels={mixerChannels}
        placedGear={placedGear}
      />

      {/* Snake Box (Stage or Studio Snake) */}
      <SnakeBox
        environment={environment}
        mixerChannels={mixerChannels}
        placedGear={placedGear}
        connections={connections}
        onStartCableDragFromSnakeChannel={handleStartCableDragFromSnakeChannel}
        onConnectToSnakeChannel={handleConnectToSnakeChannel}
        onStartCableDragFromSnakeOutput={handleStartCableDragFromSnakeOutput}
        onConnectToSnakeOutput={handleConnectToSnakeOutput}
        errorNotification={errorNotification}
        onDismissError={() => setErrorNotification(null)}
        highlightedSnakeChannels={
          isHighlightSignalPathEnabled && highlightedSignalPath
            ? highlightedSignalPath.snakeChannelNumbers
            : undefined
        }
        highlightedSnakeOutputs={
          isHighlightSignalPathEnabled && highlightedSignalPath
            ? highlightedSignalPath.snakeOutputPortIds
            : undefined
        }
        isHighlightPathActive={isHighlightSignalPathEnabled && !!highlightedSignalPath}
      />

      {/* Cable Connection Layer */}
      <CableLayer
        environment={environment}
        placedGear={placedGear}
        connections={connections}
        mixerChannels={mixerChannels}
        canvasSize={canvasSize}
        connectingFromId={connectingFromId}
        activeCableTool={activeCableTool}
        cableTypeToConnect={cableTypeToConnect}
        mousePos={mousePos}
        onDeleteConnection={deleteConnection}
        onPatchToMixer={onPatchToMixer}
        getGearCenter={getGearCenter}
        getPortOrGearCenter={getPortOrGearCenter}
        highlightedPath={highlightedSignalPath}
        isHighlightPathActive={isHighlightSignalPathEnabled}
      />

      {/* Placed Gear Nodes */}
      {placedGear.map((item) => {
        const isHighlightedInPath =
          isHighlightSignalPathEnabled &&
          !!highlightedSignalPath &&
          highlightedSignalPath.gearIds.has(item.instanceId);

        return (
          <GearItemNode
            key={item.instanceId}
            item={item}
            environment={environment}
            placedGear={placedGear}
            connections={connections}
            mixerChannels={mixerChannels}
            isSelected={selectedItemId === item.instanceId || selectedItemIds.includes(item.instanceId)}
            selectedItemIds={selectedItemIds}
            isSourceForCable={connectingFromId === item.instanceId}
            resizingId={resizingId}
            onMouseDown={handleMouseDown}
            onSelect={(id) => onSelectItem(id)}
            onDelete={(id) => deleteItem(id)}
            onMultiDelete={(ids) => openDeleteConfirm(ids)}
            onStartResize={handleStartResize}
            connectingFromId={connectingFromId}
            activeCableTool={activeCableTool}
            isHighlightedInSignalPath={isHighlightedInPath}
            hasAnySignalPathActive={isHighlightSignalPathEnabled && !!highlightedSignalPath}
            signalPathRole={
              isHighlightedInPath
                ? highlightedSignalPath?.selectedGearId === item.instanceId
                  ? 'Selected'
                  : highlightedSignalPath?.nodes.find((n) => n.id === item.instanceId)?.label
                : undefined
            }
          />
        );
      })}

      {/* Multi-item Selection Marquee Box */}
      {marqueeBox && (
        <div
          className="absolute pointer-events-none border border-sky-400/90 bg-sky-500/15 rounded-sm z-40 shadow-[0_0_15px_rgba(56,189,248,0.25)] ring-1 ring-sky-400/30"
          style={{
            left: `${Math.min(marqueeBox.startX, marqueeBox.currentX)}px`,
            top: `${Math.min(marqueeBox.startY, marqueeBox.currentY)}px`,
            width: `${Math.abs(marqueeBox.currentX - marqueeBox.startX)}px`,
            height: `${Math.abs(marqueeBox.currentY - marqueeBox.startY)}px`,
          }}
        >
          {/* Subtle corner indicator anchors */}
          <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-sky-400" />
          <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-sky-400" />
          <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-sky-400" />
          <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-sky-400" />
        </div>
      )}

      {/* Multi-Selection Status Pill */}
      {selectedItemIds.length > 1 && !marqueeBox && !draggingId && (
        <div className="absolute top-4 right-4 z-40 bg-stone-900/95 border border-orange-500/40 text-stone-200 px-3.5 py-2 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3 text-xs animate-in fade-in">
          <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          <span className="font-semibold text-orange-300">{selectedItemIds.length} items selected</span>
          <span className="text-stone-400 border-l border-stone-700 pl-2">Drag any item to move all</span>
        </div>
      )}

      {/* Floating Inspector Toolbar */}
      {!connectingFromId && !activeCableTool && selectedItem && (() => {
        const dims = getGearBoxDimensions(
          selectedItem.gearId,
          !!selectedItem.latchedSourceInstanceId,
          selectedItem.customScale,
          selectedItem.customWidth,
          selectedItem.customHeight
        );
        const popupWidth = 340;
        const popupHeight = 160;
        const inspectorLeft = Math.max(80, Math.min(canvasSize.width - popupWidth - 16, selectedItem.x + dims.width / 2 - popupWidth / 2));
        const inspectorTop = selectedItem.y > canvasSize.height / 2
          ? Math.max(60, selectedItem.y - popupHeight - 16)
          : Math.min(canvasSize.height - popupHeight - 70, selectedItem.y + dims.height + 12);

        return (
          <div
            className="absolute z-50 transition-all duration-150 pointer-events-auto"
            style={{
              left: `${inspectorLeft}px`,
              top: `${inspectorTop}px`,
            }}
          >
            <CanvasInspector
              selectedItem={selectedItem}
              environment={environment}
              placedGear={placedGear}
              mixerChannels={mixerChannels}
              onSelectItem={onSelectItem}
              onUpdateChannel={onUpdateChannel}
              onSetLatchedSource={setLatchedSource}
              onSetMicPlacement={setMicPlacement}
              onSetStandHeight={setStandHeight}
              onTogglePopFilter={togglePopFilter}
              onShowErrorToast={showErrorToast}
            />
          </div>
        );
      })()}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-stone-100">{deleteConfirmDialog.title}</h3>
                <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                  {deleteConfirmDialog.description}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmDialog(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-300 hover:text-stone-100 hover:bg-stone-800 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const idsToDelete = new Set(deleteConfirmDialog.instanceIds);
                  if (onBatchUpdate) {
                    onBatchUpdate(
                      {
                        placedGear: (prev) =>
                          prev
                            .filter((g) => !idsToDelete.has(g.instanceId))
                            .map((g) =>
                              g.latchedSourceInstanceId && idsToDelete.has(g.latchedSourceInstanceId)
                                ? { ...g, latchedSourceInstanceId: undefined }
                                : g
                            ),
                        connections: (prev) =>
                          prev.filter(
                            (c) => !idsToDelete.has(c.fromInstanceId) && !idsToDelete.has(c.toInstanceId)
                          ),
                        mixerChannels: (prev) =>
                          prev.map((ch) =>
                            ch.assignedGearInstanceId && idsToDelete.has(ch.assignedGearInstanceId)
                              ? { ...ch, assignedGearInstanceId: null, label: `CH ${ch.channelNumber}` }
                              : ch
                          ),
                      },
                      {
                        action: `Delete ${
                          deleteConfirmDialog.instanceIds.length > 1
                            ? `${deleteConfirmDialog.instanceIds.length} Items`
                            : 'Equipment'
                        }`,
                      }
                    );
                  } else {
                    onUpdateGear(
                      placedGear
                        .filter((g) => !idsToDelete.has(g.instanceId))
                        .map((g) =>
                          g.latchedSourceInstanceId && idsToDelete.has(g.latchedSourceInstanceId)
                            ? { ...g, latchedSourceInstanceId: undefined }
                            : g
                        )
                    );
                    onUpdateConnections(
                      connections.filter(
                        (c) => !idsToDelete.has(c.fromInstanceId) && !idsToDelete.has(c.toInstanceId)
                      )
                    );
                    mixerChannels.forEach((ch) => {
                      if (ch.assignedGearInstanceId && idsToDelete.has(ch.assignedGearInstanceId) && onUpdateChannel) {
                        onUpdateChannel(ch.channelNumber, {
                          assignedGearInstanceId: null,
                          label: `CH ${ch.channelNumber}`,
                        });
                      }
                    });
                  }
                  setSelectedItemIds([]);
                  onSelectItem(null);
                  setDeleteConfirmDialog(null);
                }}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg transition"
              >
                Delete {deleteConfirmDialog.instanceIds.length > 1 ? `(${deleteConfirmDialog.instanceIds.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
