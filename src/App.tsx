import React, { useState, useEffect, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  EnvironmentMode,
  PlacedGear,
  CableConnection,
  MixerChannelState,
  MasterBusState,
  StudioProjectState,
  ChallengeDefinition,
  CableType,
  GearCategory,
} from './types';
import { getGearById } from './data/gearCatalog';
import { evaluateStudioSetup } from './services/gradingEngine';
import {
  deserializeStudioProject,
  printGradingReport,
  exportStudioPlotToPdf,
} from './services/shareService';
import { audioEngine } from './services/audioEngine';

import { StudioHeader } from './components/StudioHeader';
import { GearPalette } from './components/GearPalette';
import { StudioCanvas } from './components/StudioCanvas';
import { MixerConsole } from './components/MixerConsole';
import { GradingPanel } from './components/GradingPanel';
import { ShareSubmitModal } from './components/ShareSubmitModal';
import { MicPlacementGuideModal } from './components/MicPlacementGuideModal';
import { IntroWelcomeModal } from './components/IntroWelcomeModal';
import { ModeSwitchModal } from './components/ModeSwitchModal';
import { ChallengeModal } from './components/ChallengeModal';
import { PerfectionModal } from './components/PerfectionModal';
import { GuidedTourModal } from './components/GuidedTourModal';
import { MobileDeviceNotice } from './components/MobileDeviceNotice';
import { VerifiedGradeModal } from './components/VerifiedGradeModal';
import { STUDIO_CHALLENGES, LIVE_STAGE_CHALLENGES } from './data/challenges';
import { useUndoRedo, DEFAULT_MASTER_BUS } from './hooks/useUndoRedo';

const INITIAL_CHANNELS: MixerChannelState[] = [
  { channelNumber: 1, assignedGearInstanceId: null, label: 'CH 1', phantomPower: false, gain: 72, fader: 75, pan: 0, solo: false, muted: false, meterValue: 0 },
  { channelNumber: 2, assignedGearInstanceId: null, label: 'CH 2', phantomPower: false, gain: 72, fader: 75, pan: 0, solo: false, muted: false, meterValue: 0 },
  { channelNumber: 3, assignedGearInstanceId: null, label: 'CH 3', phantomPower: false, gain: 72, fader: 75, pan: 0, solo: false, muted: false, meterValue: 0 },
  { channelNumber: 4, assignedGearInstanceId: null, label: 'CH 4', phantomPower: false, gain: 72, fader: 75, pan: 0, solo: false, muted: false, meterValue: 0 },
  { channelNumber: 5, assignedGearInstanceId: null, label: 'CH 5', phantomPower: false, gain: 72, fader: 75, pan: 0, solo: false, muted: false, meterValue: 0 },
  { channelNumber: 6, assignedGearInstanceId: null, label: 'CH 6', phantomPower: false, gain: 72, fader: 75, pan: 0, solo: false, muted: false, meterValue: 0 },
  { channelNumber: 7, assignedGearInstanceId: null, label: 'CH 7', phantomPower: false, gain: 72, fader: 75, pan: 0, solo: false, muted: false, meterValue: 0 },
  { channelNumber: 8, assignedGearInstanceId: null, label: 'CH 8', phantomPower: false, gain: 72, fader: 75, pan: 0, solo: false, muted: false, meterValue: 0 },
];

export default function App() {
  const [projectTitle, setProjectTitle] = useState('Studio Recording Session Plot');
  const [studentName, setStudentName] = useState('');
  const [period, setPeriod] = useState('1');
  const [className, setClassName] = useState('Music Tech Period 1');
  const [environment, setEnvironment] = useState<EnvironmentMode>('recording_studio');
  const [pendingEnvSwitch, setPendingEnvSwitch] = useState<EnvironmentMode | null>(null);
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);

  // Undo/Redo state management for placedGear, connections, mixerChannels, and masterBus
  const {
    placedGear,
    connections,
    mixerChannels,
    masterBus,
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
  } = useUndoRedo({
    placedGear: [],
    connections: [],
    mixerChannels: INITIAL_CHANNELS,
    masterBus: DEFAULT_MASTER_BUS,
  });

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isPaletteCollapsed, setIsPaletteCollapsed] = useState(false);
  const [activeCableTool, setActiveCableTool] = useState<CableType | null>(null);
  const [cableConnectingFromId, setCableConnectingFromId] = useState<string | null>(null);
  const [gearPaletteSelectedTab, setGearPaletteSelectedTab] = useState<GearCategory | 'all'>('instrument');
  const [isDiBoxHighlighted, setIsDiBoxHighlighted] = useState(false);
  const [isSharedView, setIsSharedView] = useState(false);
  const [isMixerCollapsed, setIsMixerCollapsed] = useState(true);
  const [isGradingExpanded, setIsGradingExpanded] = useState(false);

  // Modals & Soundcheck state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [isIntroModalOpen, setIsIntroModalOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);
  const [isPerfectionModalOpen, setIsPerfectionModalOpen] = useState(false);
  const [verifiedProject, setVerifiedProject] = useState<StudioProjectState | null>(null);
  const [isVerifiedModalOpen, setIsVerifiedModalOpen] = useState(false);
  const [hasCelebratedA, setHasCelebratedA] = useState(false);

  const handleLoadProject = useCallback((loaded: StudioProjectState) => {
    setProjectTitle(loaded.title || 'Studio Setup Assignment');
    setStudentName(loaded.studentName || 'Student');
    setPeriod(loaded.period || '1');
    setClassName(loaded.className || 'Audio Production');
    setEnvironment(loaded.environment || 'recording_studio');
    resetHistory({
      placedGear: loaded.placedGear || [],
      connections: loaded.connections || [],
      mixerChannels:
        loaded.mixerChannels && loaded.mixerChannels.length > 0
          ? loaded.mixerChannels
          : INITIAL_CHANNELS,
      masterBus: loaded.masterBus || DEFAULT_MASTER_BUS,
    });
  }, [resetHistory]);

  const triggerTourIfFirstTime = useCallback(() => {
    const hasSeenTour = localStorage.getItem('audioplot_tour_seen');
    if (!hasSeenTour) {
      setTimeout(() => {
        setIsTourOpen(true);
        localStorage.setItem('audioplot_tour_seen', 'true');
      }, 150);
    }
  }, []);

  // Check if first visit for intro modal
  useEffect(() => {
    const hasSeenIntro = localStorage.getItem('audioplot_intro_seen');
    if (!hasSeenIntro) {
      setIsIntroModalOpen(true);
      localStorage.setItem('audioplot_intro_seen', 'true');
    } else {
      triggerTourIfFirstTime();
    }
  }, [triggerTourIfFirstTime]);

  // Parse URL hash on initial load and hash changes
  useEffect(() => {
    const handleHashLoad = () => {
      const hash = window.location.hash;
      if (hash && hash.includes('plot=')) {
        const match = hash.match(/plot=([^&]+)/);
        if (match && match[1]) {
          setIsSharedView(true);
          const rawEncoded = match[1];
          const loaded =
            deserializeStudioProject(rawEncoded) ||
            deserializeStudioProject(decodeURIComponent(rawEncoded));
          if (loaded) {
            setProjectTitle(loaded.title || 'Studio Setup Assignment');
            setStudentName(loaded.studentName || 'Student');
            setPeriod(loaded.period || '1');
            setClassName(loaded.className || 'Audio Production');
            setEnvironment(loaded.environment || 'recording_studio');
            resetHistory({
              placedGear: loaded.placedGear || [],
              connections: loaded.connections || [],
              mixerChannels:
                loaded.mixerChannels && loaded.mixerChannels.length > 0
                  ? loaded.mixerChannels
                  : INITIAL_CHANNELS,
              masterBus: loaded.masterBus || DEFAULT_MASTER_BUS,
            });
            return;
          }
        }
      }

      // Default blank workspace
      resetHistory({
        placedGear: [],
        connections: [],
        mixerChannels: INITIAL_CHANNELS,
        masterBus: DEFAULT_MASTER_BUS,
      });
    };

    handleHashLoad();
    window.addEventListener('hashchange', handleHashLoad);
    return () => window.removeEventListener('hashchange', handleHashLoad);
  }, [resetHistory]);

  // Helper: Derive automatic channel label from connected or latched source
  const deriveChannelLabel = useCallback(
    (gearItem: PlacedGear, placedGearList: PlacedGear[], connList: CableConnection[]): string => {
      const def = getGearById(gearItem.gearId);
      if (!def) return 'INPUT';

      // 1. Explicit latched source
      if (gearItem.latchedSourceInstanceId === 'room') {
        return 'ROOM';
      }
      if (gearItem.latchedSourceInstanceId) {
        const latchedSource = placedGearList.find((g) => g.instanceId === gearItem.latchedSourceInstanceId);
        if (latchedSource) {
          const sDef = getGearById(latchedSource.gearId);
          if (sDef) {
            if (latchedSource.gearId === 'inst_voice') return 'VOX';
            if (latchedSource.gearId === 'inst_kick_drum') return 'KICK';
            if (latchedSource.gearId === 'inst_snare_drum') return 'SNARE';
            if (latchedSource.gearId === 'inst_tom_drum') return 'TOMS';
            if (latchedSource.gearId === 'inst_hi_hat') return 'HI-HATS';
            if (latchedSource.gearId === 'inst_drum_cymbals') return 'DRUM OHS';
            if (latchedSource.gearId === 'inst_drum_set') return 'DRUMS';
            if (latchedSource.gearId === 'gear_guitar_amp') return 'GTR AMP';
            if (latchedSource.gearId === 'gear_bass_amp') return 'BASS AMP';
            if (latchedSource.gearId === 'inst_electric_guitar') return 'E GUIT';
            if (latchedSource.gearId === 'inst_bass_guitar') return 'BASS';
            if (latchedSource.gearId === 'inst_double_bass') return 'UPRIGHT';
            if (latchedSource.gearId === 'inst_acoustic_guitar') return 'A GUIT';
            if (latchedSource.gearId === 'inst_acoustic_piano' || latchedSource.gearId === 'inst_grand_piano') return 'PIANO';
            if (latchedSource.gearId === 'inst_keyboard') return 'KEYS';
            if (latchedSource.gearId === 'inst_trumpet') return 'TRUMPET';
            if (latchedSource.gearId === 'inst_saxophone') return 'SAX';
            if (latchedSource.gearId === 'inst_violin') return 'VIOLIN';
            if (latchedSource.gearId === 'inst_choir') return 'CHOIR';
            if (latchedSource.gearId === 'inst_flute') return 'FLUTE';
            return sDef.name.slice(0, 7).toUpperCase();
          }
        }
      }

      // 2. DI Box connected to instrument
      if (gearItem.gearId === 'gear_di_box') {
        const conn = connList.find(
          (c) => c.fromInstanceId === gearItem.instanceId || c.toInstanceId === gearItem.instanceId
        );
        if (conn) {
          const otherId = conn.fromInstanceId === gearItem.instanceId ? conn.toInstanceId : conn.fromInstanceId;
          const otherGear = placedGearList.find((g) => g.instanceId === otherId);
          if (otherGear) {
            if (otherGear.gearId === 'inst_bass_guitar') return 'BASS DI';
            if (otherGear.gearId === 'inst_keyboard') return 'KEYS DI';
            if (otherGear.gearId === 'inst_electric_guitar') return 'E GUIT DI';
            if (otherGear.gearId === 'inst_acoustic_guitar') return 'A GUIT DI';
            if (otherGear.gearId === 'inst_double_bass') return 'UPRIGHT DI';
          }
        }
        return 'DI BOX';
      }

      // 3. Mic near an instrument or amp
      if (def.category === 'microphone') {
        const nearby = placedGearList.find((g) => {
          if (g.instanceId === gearItem.instanceId) return false;
          const gDef = getGearById(g.gearId);
          if (gDef?.category !== 'instrument' && gDef?.category !== 'amplifier') return false;
          const dx = g.x - gearItem.x;
          const dy = g.y - gearItem.y;
          return Math.hypot(dx, dy) < 140;
        });

        if (nearby) {
          if (nearby.gearId === 'inst_voice') return 'VOX';
          if (nearby.gearId === 'inst_kick_drum') return 'KICK';
          if (nearby.gearId === 'inst_snare_drum') return 'SNARE';
          if (nearby.gearId === 'inst_tom_drum') return 'TOMS';
          if (nearby.gearId === 'inst_hi_hat') return 'HI-HATS';
          if (nearby.gearId === 'inst_drum_cymbals') return 'DRUM OHS';
          if (nearby.gearId === 'inst_drum_set') return 'DRUMS';
          if (nearby.gearId === 'gear_guitar_amp') return 'GTR AMP';
          if (nearby.gearId === 'gear_bass_amp') return 'BASS AMP';
          if (nearby.gearId === 'inst_electric_guitar') return 'E GUIT';
          if (nearby.gearId === 'inst_bass_guitar') return 'BASS';
          if (nearby.gearId === 'inst_double_bass') return 'UPRIGHT';
          if (nearby.gearId === 'inst_acoustic_guitar') return 'A GUIT';
          if (nearby.gearId === 'inst_acoustic_piano' || nearby.gearId === 'inst_grand_piano') return 'PIANO';
          if (nearby.gearId === 'inst_keyboard') return 'KEYS';
          if (nearby.gearId === 'inst_trumpet') return 'TRUMPET';
          if (nearby.gearId === 'inst_saxophone') return 'SAX';
          if (nearby.gearId === 'inst_violin') return 'VIOLIN';
          if (nearby.gearId === 'inst_choir') return 'CHOIR';
          if (nearby.gearId === 'inst_flute') return 'FLUTE';
        }

        // Default unassigned microphone is a Room Mic
        return 'ROOM';
      }

      return def.name.slice(0, 7).toUpperCase();
    },
    []
  );

  // Compute real-time automated rubric grade
  const evaluation = useMemo(() => {
    return evaluateStudioSetup(environment, placedGear, connections, mixerChannels, activeChallengeId);
  }, [environment, placedGear, connections, mixerChannels, activeChallengeId]);

  // Current & Next Challenge definition
  const allChallenges = environment === 'recording_studio' ? STUDIO_CHALLENGES : LIVE_STAGE_CHALLENGES;
  const currentChallengeIndex = allChallenges.findIndex((c) => c.id === activeChallengeId);
  const currentChallenge = currentChallengeIndex >= 0 ? allChallenges[currentChallengeIndex] : null;
  const nextChallenge =
    currentChallengeIndex >= 0 && currentChallengeIndex < allChallenges.length - 1
      ? allChallenges[currentChallengeIndex + 1]
      : null;

  // Celebrate with confetti on hitting 90%+ (Perfection!)
  useEffect(() => {
    if (evaluation.percentage >= 90 && !hasCelebratedA) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
      setHasCelebratedA(true);
      if (activeChallengeId) {
        setIsPerfectionModalOpen(true);
      }
    } else if (evaluation.percentage < 80) {
      setHasCelebratedA(false);
    }
  }, [evaluation.percentage, hasCelebratedA, activeChallengeId]);

  // Project state object for sharing & exporting
  const currentProjectState: StudioProjectState = useMemo(() => {
    return {
      id: `proj_${Date.now()}`,
      version: 1,
      title: projectTitle,
      studentName,
      period,
      className,
      environment,
      placedGear,
      connections,
      mixerChannels,
      masterBus,
      activeChallengeId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [projectTitle, studentName, period, className, environment, placedGear, connections, mixerChannels, masterBus, activeChallengeId]);

  // Clean PDF Document export handler
  const handleExportPdf = useCallback(async () => {
    try {
      await exportStudioPlotToPdf(currentProjectState, evaluation);
    } catch (err) {
      console.error('Failed to export PDF:', err);
    }
  }, [currentProjectState, evaluation]);

  // Patch gear to mixer channel
  const handlePatchGearToChannel = (gearInstanceId: string, channelNumber: number) => {
    const item = placedGear.find((g) => g.instanceId === gearInstanceId);
    const derivedLabel = item ? deriveChannelLabel(item, placedGear, connections) : 'INPUT';

    setBatchState(
      {
        mixerChannels: (prev) =>
          prev.map((ch) => {
            if (ch.channelNumber === channelNumber) {
              // If already patched to this gear, toggle off / unpatch
              if (ch.assignedGearInstanceId === gearInstanceId) {
                return { ...ch, assignedGearInstanceId: null, label: `CH ${channelNumber}` };
              }
              return {
                ...ch,
                assignedGearInstanceId: gearInstanceId,
                label: derivedLabel,
                phantomPower: ch.phantomPower,
              };
            }
            if (ch.assignedGearInstanceId === gearInstanceId) {
              return { ...ch, assignedGearInstanceId: null, label: `CH ${ch.channelNumber}` };
            }
            return ch;
          }),
        placedGear: (prev) =>
          prev.map((g) => {
            if (g.instanceId === gearInstanceId) {
              return { ...g, assignedChannel: g.assignedChannel === channelNumber ? undefined : channelNumber };
            }
            return g;
          }),
      },
      { action: `Patch to CH ${channelNumber}` }
    );
  };

  const handleUnpatchChannel = (channelNumber: number) => {
    const ch = mixerChannels.find((c) => c.channelNumber === channelNumber);
    const gearId = ch?.assignedGearInstanceId;
    setBatchState(
      {
        placedGear: (prev) =>
          gearId ? prev.map((g) => (g.instanceId === gearId ? { ...g, assignedChannel: undefined } : g)) : prev,
        mixerChannels: (prev) =>
          prev.map((c) =>
            c.channelNumber === channelNumber
              ? { ...c, assignedGearInstanceId: null, label: `CH ${channelNumber}` }
              : c
          ),
      },
      { action: `Unpatch CH ${channelNumber}` }
    );
  };

  const handleUpdateChannel = (
    channelNumber: number,
    updates: Partial<MixerChannelState>,
    options?: { coalesce?: boolean; action?: string }
  ) => {
    setMixerChannels(
      (prev) => prev.map((ch) => (ch.channelNumber === channelNumber ? { ...ch, ...updates } : ch)),
      options || {
        coalesce: true,
        action: `Adjust CH ${channelNumber}`,
      }
    );
  };

  const handleUpdateMasterBus = useCallback(
    (
      updates: Partial<MasterBusState>,
      options?: { coalesce?: boolean; action?: string }
    ) => {
      setMasterBus(
        (prev) => ({ ...prev, ...updates }),
        options || {
          coalesce: true,
          action: 'Adjust Master Bus',
        }
      );
      audioEngine.setMasterBusState(updates);
    },
    [setMasterBus]
  );

  // Keep audio engine live-synchronized with the latest plot state
  useEffect(() => {
    audioEngine.setStateProvider(() => ({
      placedGear,
      mixerChannels,
      connections,
      environment,
      masterBus,
    }));
  }, [placedGear, mixerChannels, connections, environment, masterBus]);

  // Soundcheck toggle
  const handleToggleAudio = useCallback(() => {
    const isPlaying = audioEngine.togglePlayback(placedGear, mixerChannels, connections);
    setIsPlayingAudio(isPlaying);
  }, [placedGear, mixerChannels, connections]);

  // Spacebar shortcut to toggle Soundcheck playback (unless typing in text box/input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        handleToggleAudio();
      } else if (e.key === 'c' || e.key === 'C' || e.key === 'm' || e.key === 'M' || e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        setIsMixerCollapsed((prev) => !prev);
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setIsGradingExpanded((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleToggleAudio]);

  // Preload audio and clean up on unmount
  useEffect(() => {
    // Attempt preload
    audioEngine.init();

    // In modern browsers, AudioContext might need user interaction to resume
    const handleUserGesture = () => {
      audioEngine.init();
      window.removeEventListener('click', handleUserGesture);
      window.removeEventListener('keydown', handleUserGesture);
    };
    window.addEventListener('click', handleUserGesture, { once: true });
    window.addEventListener('keydown', handleUserGesture, { once: true });

    return () => {
      window.removeEventListener('click', handleUserGesture);
      window.removeEventListener('keydown', handleUserGesture);
      audioEngine.stop();
    };
  }, []);

  const handleResetPlot = () => {
    resetHistory({
      placedGear: [],
      connections: [],
      mixerChannels: INITIAL_CHANNELS,
      masterBus: DEFAULT_MASTER_BUS,
    });
    setSelectedItemId(null);
    setActiveChallengeId(null);
    if (isPlayingAudio) {
      audioEngine.stop();
      setIsPlayingAudio(false);
    }
  };

  const handleSelectChallenge = (challenge: ChallengeDefinition | null) => {
    if (!challenge) {
      setActiveChallengeId(null);
      return;
    }
    setActiveChallengeId(challenge.id);
    setEnvironment(challenge.environment);
    setProjectTitle(challenge.title);
    setSelectedItemId(null);
    if (isPlayingAudio) {
      audioEngine.stop();
      setIsPlayingAudio(false);
    }
    // Populate pre-assigned challenge instruments
    const loadedInstruments: PlacedGear[] = challenge.instruments.map((inst, index) => ({
      instanceId: `gear_${Date.now()}_${index}`,
      gearId: inst.gearId,
      x: inst.x,
      y: inst.y,
      rotation: 0,
      hasPopFilter: false,
    }));
    resetHistory({
      placedGear: loadedInstruments,
      connections: [],
      mixerChannels: INITIAL_CHANNELS,
      masterBus: DEFAULT_MASTER_BUS,
    });
  };

  const handleRequestEnvironmentChange = (newEnv: EnvironmentMode) => {
    if (newEnv === environment) return;
    setPendingEnvSwitch(newEnv);
  };

  const handleConfirmEnvironmentChange = () => {
    if (!pendingEnvSwitch) return;
    const targetEnv = pendingEnvSwitch;
    setEnvironment(targetEnv);
    setPendingEnvSwitch(null);
    setActiveChallengeId(null);
    setSelectedItemId(null);
    if (isPlayingAudio) {
      audioEngine.stop();
      setIsPlayingAudio(false);
    }
    if (targetEnv === 'live_stage') {
      setProjectTitle('Live Concert Stage Plot');
    } else {
      setProjectTitle('Studio Recording Session Plot');
    }
    resetHistory({
      placedGear: [],
      connections: [],
      mixerChannels: INITIAL_CHANNELS,
      masterBus: DEFAULT_MASTER_BUS,
    });
  };

  const handleCancelEnvironmentChange = () => {
    setPendingEnvSwitch(null);
  };

  const handleOpenShareModal = useCallback(() => {
    setIsShareModalOpen(true);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0c0c11] overflow-hidden text-stone-100 font-sans relative">
      {/* Ambient background illumination */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_0%,rgba(249,115,22,0.07),transparent_50%),radial-gradient(circle_at_85%_70%,rgba(59,130,246,0.06),transparent_40%),radial-gradient(circle_at_15%_90%,rgba(168,85,247,0.05),transparent_40%)]" />

      {/* Top Application Navigation & Assignment Header */}
      <StudioHeader
        title={projectTitle}
        onTitleChange={setProjectTitle}
        studentName={studentName}
        onStudentNameChange={setStudentName}
        isSharedView={isSharedView}
        period={period}
        onPeriodChange={(newP) => {
          setPeriod(newP);
          setClassName(`Music Tech Period ${newP}`);
        }}
        environment={environment}
        onEnvironmentChange={handleRequestEnvironmentChange}
        onOpenShareModal={handleOpenShareModal}
        onExportPdf={handleExportPdf}
        onOpenGuideModal={() => setIsGuideModalOpen(true)}
        onOpenTour={() => setIsTourOpen(true)}
        onOpenChallengeModal={() => setIsChallengeModalOpen(true)}
        activeChallengeId={activeChallengeId}
        onResetPlot={handleResetPlot}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      {/* Main Workspace (Left: Gear Drawer | Center: Studio Canvas | Right: Progress Bar) */}
      <main className="flex-1 relative overflow-hidden flex min-h-0 min-w-0">
        {/* Left: Gear Catalog Drawer */}
        <GearPalette
          placedGear={placedGear}
          isCollapsed={isPaletteCollapsed}
          onToggleCollapse={() => setIsPaletteCollapsed(!isPaletteCollapsed)}
          activeCableTool={activeCableTool}
          connectingFromId={cableConnectingFromId}
          onCancelCableTool={() => {
            setActiveCableTool(null);
            setCableConnectingFromId(null);
          }}
          selectedTab={gearPaletteSelectedTab}
          onSelectTab={setGearPaletteSelectedTab}
          isDiBoxHighlighted={isDiBoxHighlighted}
        />

        {/* Center: Interactive Studio & Stage Floor Plan */}
        <div className="flex-1 relative h-full overflow-hidden min-w-0">
          <StudioCanvas
            environment={environment}
            placedGear={placedGear}
            onUpdateGear={setPlacedGear}
            connections={connections}
            onUpdateConnections={setConnections}
            mixerChannels={mixerChannels}
            onPatchToMixer={handlePatchGearToChannel}
            onUpdateChannel={handleUpdateChannel}
            onBatchUpdate={setBatchState}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
            onOpenPaletteDrawer={() => setIsPaletteCollapsed(false)}
            isPaletteCollapsed={isPaletteCollapsed}
            activeCableTool={activeCableTool}
            onActiveCableToolChange={setActiveCableTool}
            connectingFromId={cableConnectingFromId}
            onConnectingFromIdChange={setCableConnectingFromId}
            selectedGearTab={gearPaletteSelectedTab}
            onSelectGearTab={setGearPaletteSelectedTab}
            isDiBoxHighlighted={isDiBoxHighlighted}
            onDiBoxHighlightChange={setIsDiBoxHighlighted}
          />
        </div>

        {/* Right: Live Automated Rubrics & Diagnostics Panel */}
        <GradingPanel
          evaluation={evaluation}
          placedGear={placedGear}
          connections={connections}
          mixerChannels={mixerChannels}
          environment={environment}
          selectedItemId={selectedItemId}
          onSelectItem={setSelectedItemId}
          onUpdateChannel={handleUpdateChannel}
          isPlayingAudio={isPlayingAudio}
          onOpenShareModal={handleOpenShareModal}
          onPrintReport={() => printGradingReport(currentProjectState, evaluation)}
          onExportPdf={handleExportPdf}
          onOpenGuideModal={() => setIsGuideModalOpen(true)}
          isExpanded={isGradingExpanded}
          onToggleExpanded={() => setIsGradingExpanded((prev) => !prev)}
        />
      </main>

      {/* Bottom: 8-Channel Hardware Interface / Mixer Console */}
      <MixerConsole
        environment={environment}
        channels={mixerChannels}
        placedGear={placedGear}
        connections={connections}
        onUpdateChannel={handleUpdateChannel}
        onPatchGearToChannel={handlePatchGearToChannel}
        onUnpatchChannel={handleUnpatchChannel}
        isPlayingAudio={isPlayingAudio}
        onToggleSoundcheck={handleToggleAudio}
        selectedGearId={selectedItemId}
        masterBus={masterBus}
        onUpdateMasterBus={handleUpdateMasterBus}
        isCollapsed={isMixerCollapsed}
        onToggleCollapse={() => setIsMixerCollapsed((prev) => !prev)}
      />

      {/* Intro Welcome Modal */}
      <IntroWelcomeModal
        isOpen={isIntroModalOpen}
        onClose={() => {
          setIsIntroModalOpen(false);
          triggerTourIfFirstTime();
        }}
        onStartMode={(mode) => {
          setEnvironment(mode);
          setProjectTitle(
            mode === 'live_stage' ? 'Live Concert Stage Plot' : 'Studio Recording Session Plot'
          );
          setIsIntroModalOpen(false);
          triggerTourIfFirstTime();
        }}
        onOpenChallenges={() => {
          setIsIntroModalOpen(false);
          setIsChallengeModalOpen(true);
        }}
      />

      {/* Guided Walkthrough / Interactive Tour */}
      <GuidedTourModal
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        environment={environment}
      />

      {/* Student Name Prompt Modal when default 'Albert G Lane' is still set */}
      {/* Share & Google Classroom Modal */}
      <ShareSubmitModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        project={currentProjectState}
        evaluation={evaluation}
        studentName={studentName}
        onUpdateStudentName={setStudentName}
        onVerifyProject={(project) => {
          setVerifiedProject(project);
          setIsVerifiedModalOpen(true);
        }}
      />

      {/* Verified Grade Report Modal */}
      <VerifiedGradeModal
        isOpen={isVerifiedModalOpen}
        onClose={() => setIsVerifiedModalOpen(false)}
        studentName={verifiedProject?.studentName || ''}
        project={verifiedProject || currentProjectState}
        evaluation={verifiedProject ? evaluateStudioSetup(verifiedProject.environment || 'recording_studio', verifiedProject.placedGear || [], verifiedProject.connections || [], verifiedProject.mixerChannels || []) : evaluation}
        onLoadProject={handleLoadProject}
      />

      {/* Microphone & Signal Chain Field Guide Modal */}
      <MicPlacementGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
      />

      {/* Mode Switch Project Confirmation Modal */}
      <ModeSwitchModal
        isOpen={pendingEnvSwitch !== null}
        targetMode={pendingEnvSwitch}
        currentMode={environment}
        onConfirm={handleConfirmEnvironmentChange}
        onCancel={handleCancelEnvironmentChange}
      />

      {/* Challenge Selection Modal */}
      <ChallengeModal
        isOpen={isChallengeModalOpen}
        onClose={() => setIsChallengeModalOpen(false)}
        environment={environment}
        activeChallengeId={activeChallengeId}
        onSelectChallenge={handleSelectChallenge}
      />

      {/* Perfection Challenge Passed Modal */}
      <PerfectionModal
        isOpen={isPerfectionModalOpen}
        onClose={() => setIsPerfectionModalOpen(false)}
        challenge={currentChallenge}
        nextChallenge={nextChallenge}
        onSelectNextChallenge={() => {
          setIsPerfectionModalOpen(false);
          if (nextChallenge) {
            handleSelectChallenge(nextChallenge);
          }
        }}
        onOpenShareModal={() => {
          setIsPerfectionModalOpen(false);
          handleOpenShareModal();
        }}
        percentage={evaluation.percentage}
      />

      {/* Mobile Device Optimization Pop-up Notice */}
      <MobileDeviceNotice />
    </div>
  );
}
