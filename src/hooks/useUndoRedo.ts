import { useState, useCallback, useRef, useEffect } from 'react';
import { PlacedGear, CableConnection, MixerChannelState, MasterBusState } from '../types';

export const DEFAULT_MASTER_BUS: MasterBusState = {
  fader: 75,
  gain: 50,
  pan: 0,
  muted: false,
  dim: false,
  mono: false,
};

export interface HistorySnapshot {
  placedGear: PlacedGear[];
  connections: CableConnection[];
  mixerChannels: MixerChannelState[];
  masterBus?: MasterBusState;
  actionDescription?: string;
  timestamp?: number;
}

export interface SetStateOptions {
  coalesce?: boolean;
  action?: string;
  record?: boolean;
}

export interface BatchStateUpdates {
  placedGear?: PlacedGear[] | ((prev: PlacedGear[]) => PlacedGear[]);
  connections?: CableConnection[] | ((prev: CableConnection[]) => CableConnection[]);
  mixerChannels?: MixerChannelState[] | ((prev: MixerChannelState[]) => MixerChannelState[]);
  masterBus?: MasterBusState | ((prev: MasterBusState) => MasterBusState);
}

const MAX_HISTORY_LIMIT = 50;

// Deep comparison helper for history snapshots
function areSnapshotsEqual(a: HistorySnapshot, b: HistorySnapshot): boolean {
  if (a === b) return true;
  return JSON.stringify({
    g: a.placedGear,
    c: a.connections,
    m: a.mixerChannels,
    mb: a.masterBus,
  }) === JSON.stringify({
    g: b.placedGear,
    c: b.connections,
    m: b.mixerChannels,
    mb: b.masterBus,
  });
}

export function useUndoRedo(initialState: HistorySnapshot) {
  // We use refs to store past and future stacks to prevent stale closures in rapid callbacks
  const pastRef = useRef<HistorySnapshot[]>([]);
  const futureRef = useRef<HistorySnapshot[]>([]);
  const presentRef = useRef<HistorySnapshot>(initialState);

  // React state mirrors presentRef for rendering
  const [present, setPresent] = useState<HistorySnapshot>(initialState);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  // Coalesce tracking ref (for continuous drag or knob adjustment)
  const isCoalescingRef = useRef(false);
  const coalesceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateUndoRedoAvailability = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  /**
   * Commit a snapshot to history if it has changed from the present.
   */
  const pushState = useCallback((newPresent: HistorySnapshot, options?: SetStateOptions) => {
    const isCoalescing = options?.coalesce ?? false;
    const actionDesc = options?.action || 'Edit';

    // If identical to current present, no-op
    if (areSnapshotsEqual(presentRef.current, newPresent)) {
      return;
    }

    if (isCoalescing) {
      // If we are already in a coalescing streak, just update the present in-place
      // The original baseline snapshot is already safely preserved at top of pastRef!
      if (!isCoalescingRef.current) {
        // Start of a coalesce streak: push current baseline into past
        pastRef.current = [...pastRef.current.slice(-MAX_HISTORY_LIMIT + 1), presentRef.current];
        futureRef.current = []; // Clear redo stack on new action
        isCoalescingRef.current = true;
      }

      // Reset debounce timer for coalescing streak
      if (coalesceTimerRef.current) {
        clearTimeout(coalesceTimerRef.current);
      }
      coalesceTimerRef.current = setTimeout(() => {
        isCoalescingRef.current = false;
      }, 400);
    } else {
      // Discrete action: end any coalescing streak and push to past
      if (coalesceTimerRef.current) {
        clearTimeout(coalesceTimerRef.current);
        coalesceTimerRef.current = null;
      }
      isCoalescingRef.current = false;

      pastRef.current = [...pastRef.current.slice(-MAX_HISTORY_LIMIT + 1), presentRef.current];
      futureRef.current = [];
    }

    const stampedPresent: HistorySnapshot = {
      ...newPresent,
      actionDescription: actionDesc,
      timestamp: Date.now(),
    };

    presentRef.current = stampedPresent;
    setPresent(stampedPresent);
    setLastAction(actionDesc);
    updateUndoRedoAvailability();
  }, [updateUndoRedoAvailability]);

  /**
   * Undo to previous state
   */
  const undo = useCallback((): HistorySnapshot | null => {
    // Terminate any coalescing streak
    if (coalesceTimerRef.current) {
      clearTimeout(coalesceTimerRef.current);
      coalesceTimerRef.current = null;
    }
    isCoalescingRef.current = false;

    if (pastRef.current.length === 0) return null;

    const previous = pastRef.current[pastRef.current.length - 1];
    const newPast = pastRef.current.slice(0, pastRef.current.length - 1);

    futureRef.current = [presentRef.current, ...futureRef.current.slice(0, MAX_HISTORY_LIMIT - 1)];
    pastRef.current = newPast;
    presentRef.current = previous;

    setPresent(previous);
    setLastAction(previous.actionDescription ? `Undo: ${previous.actionDescription}` : 'Undo');
    updateUndoRedoAvailability();

    return previous;
  }, [updateUndoRedoAvailability]);

  /**
   * Redo to next state
   */
  const redo = useCallback((): HistorySnapshot | null => {
    // Terminate any coalescing streak
    if (coalesceTimerRef.current) {
      clearTimeout(coalesceTimerRef.current);
      coalesceTimerRef.current = null;
    }
    isCoalescingRef.current = false;

    if (futureRef.current.length === 0) return null;

    const next = futureRef.current[0];
    const newFuture = futureRef.current.slice(1);

    pastRef.current = [...pastRef.current.slice(-MAX_HISTORY_LIMIT + 1), presentRef.current];
    futureRef.current = newFuture;
    presentRef.current = next;

    setPresent(next);
    setLastAction(next.actionDescription ? `Redo: ${next.actionDescription}` : 'Redo');
    updateUndoRedoAvailability();

    return next;
  }, [updateUndoRedoAvailability]);

  /**
   * Reset the entire history stack with a brand-new baseline
   */
  const resetHistory = useCallback((newBaseline: HistorySnapshot) => {
    if (coalesceTimerRef.current) {
      clearTimeout(coalesceTimerRef.current);
      coalesceTimerRef.current = null;
    }
    isCoalescingRef.current = false;

    const safeBaseline: HistorySnapshot = {
      ...newBaseline,
      masterBus: newBaseline.masterBus || DEFAULT_MASTER_BUS,
    };

    pastRef.current = [];
    futureRef.current = [];
    presentRef.current = safeBaseline;
    setPresent(safeBaseline);
    setLastAction(null);
    updateUndoRedoAvailability();
  }, [updateUndoRedoAvailability]);

  /**
   * Dedicated setters for placedGear
   */
  const setPlacedGear = useCallback(
    (
      valueOrUpdater: PlacedGear[] | ((prev: PlacedGear[]) => PlacedGear[]),
      options?: SetStateOptions
    ) => {
      const nextPlacedGear =
        typeof valueOrUpdater === 'function'
          ? valueOrUpdater(presentRef.current.placedGear)
          : valueOrUpdater;

      pushState(
        {
          ...presentRef.current,
          placedGear: nextPlacedGear,
        },
        { action: options?.action || 'Update Equipment', coalesce: options?.coalesce }
      );
    },
    [pushState]
  );

  /**
   * Dedicated setters for connections
   */
  const setConnections = useCallback(
    (
      valueOrUpdater: CableConnection[] | ((prev: CableConnection[]) => CableConnection[]),
      options?: SetStateOptions
    ) => {
      const nextConnections =
        typeof valueOrUpdater === 'function'
          ? valueOrUpdater(presentRef.current.connections)
          : valueOrUpdater;

      pushState(
        {
          ...presentRef.current,
          connections: nextConnections,
        },
        { action: options?.action || 'Update Cables', coalesce: options?.coalesce }
      );
    },
    [pushState]
  );

  /**
   * Dedicated setters for mixerChannels
   */
  const setMixerChannels = useCallback(
    (
      valueOrUpdater: MixerChannelState[] | ((prev: MixerChannelState[]) => MixerChannelState[]),
      options?: SetStateOptions
    ) => {
      const nextChannels =
        typeof valueOrUpdater === 'function'
          ? valueOrUpdater(presentRef.current.mixerChannels)
          : valueOrUpdater;

      pushState(
        {
          ...presentRef.current,
          mixerChannels: nextChannels,
        },
        { action: options?.action || 'Update Mixer Console', coalesce: options?.coalesce }
      );
    },
    [pushState]
  );

  /**
   * Dedicated setters for masterBus
   */
  const setMasterBus = useCallback(
    (
      valueOrUpdater: MasterBusState | ((prev: MasterBusState) => MasterBusState),
      options?: SetStateOptions
    ) => {
      const currentMaster = presentRef.current.masterBus || DEFAULT_MASTER_BUS;
      const nextMaster =
        typeof valueOrUpdater === 'function'
          ? valueOrUpdater(currentMaster)
          : valueOrUpdater;

      pushState(
        {
          ...presentRef.current,
          masterBus: nextMaster,
        },
        { action: options?.action || 'Update Master Bus', coalesce: options?.coalesce }
      );
    },
    [pushState]
  );

  /**
   * Batch update multiple state slices in a single history transaction
   */
  const setBatchState = useCallback(
    (updates: BatchStateUpdates, options?: SetStateOptions) => {
      const current = presentRef.current;
      const nextPlacedGear = updates.placedGear
        ? typeof updates.placedGear === 'function'
          ? updates.placedGear(current.placedGear)
          : updates.placedGear
        : current.placedGear;

      const nextConnections = updates.connections
        ? typeof updates.connections === 'function'
          ? updates.connections(current.connections)
          : updates.connections
        : current.connections;

      const nextMixerChannels = updates.mixerChannels
        ? typeof updates.mixerChannels === 'function'
          ? updates.mixerChannels(current.mixerChannels)
          : updates.mixerChannels
        : current.mixerChannels;

      const currentMaster = current.masterBus || DEFAULT_MASTER_BUS;
      const nextMasterBus = updates.masterBus
        ? typeof updates.masterBus === 'function'
          ? updates.masterBus(currentMaster)
          : updates.masterBus
        : current.masterBus;

      pushState(
        {
          placedGear: nextPlacedGear,
          connections: nextConnections,
          mixerChannels: nextMixerChannels,
          masterBus: nextMasterBus,
        },
        { action: options?.action || 'Batch Update', coalesce: options?.coalesce }
      );
    },
    [pushState]
  );

  // Global Keyboard shortcuts (Ctrl+Z, Cmd+Z, Ctrl+Y, Cmd+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing in a form field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (isCmdOrCtrl) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            // Redo: Cmd+Shift+Z or Ctrl+Shift+Z
            redo();
          } else {
            // Undo: Cmd+Z or Ctrl+Z
            undo();
          }
        } else if (e.key.toLowerCase() === 'y') {
          // Redo: Ctrl+Y or Cmd+Y
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    placedGear: present.placedGear,
    connections: present.connections,
    mixerChannels: present.mixerChannels,
    masterBus: present.masterBus || DEFAULT_MASTER_BUS,
    setPlacedGear,
    setConnections,
    setMixerChannels,
    setMasterBus,
    setBatchState,
    undo,
    redo,
    canUndo,
    canRedo,
    resetHistory,
    historyStats: {
      pastCount: pastRef.current.length,
      futureCount: futureRef.current.length,
      lastAction,
    },
  };
}
