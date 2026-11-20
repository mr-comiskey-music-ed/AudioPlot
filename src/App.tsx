import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { getGearById, isDiBoxId, isStereoGearId } from './data/gearCatalog';
import { evaluateStudioSetup } from './services/gradingEngine';
import {
  deserializeStudioProject,
  printGradingReport,
  exportStudioPlotToPdf,
} from './services/shareService';
import { audioEngine, DJ_RIG_START_GAIN } from './services/audioEngine';

import { StudioHeader } from './components/StudioHeader';
import { GearPalette } from './components/GearPalette';
import { StudioCanvas } from './components/StudioCanvas';
import { MixerConsole } from './components/MixerConsole';
import { GradingPanel } from './components/GradingPanel';
import { ShareSubmitModal } from './components/ShareSubmitModal';
import { ModeSwitchModal } from './components/ModeSwitchModal';
import { ChallengeModal } from './components/ChallengeModal';
import { LearnModal } from './components/LearnModal';
import { LearnPanel } from './components/LearnPanel';
import { LEARN_STEPS, LearnPlot, learnStartPlot, stepDone } from './data/learnSteps';
import { LearnProgress, loadLearnProgress, saveLearnProgress } from './utils/learnProgress';
import { PerfectionModal } from './components/PerfectionModal';
import { GuidedTourModal } from './components/GuidedTourModal';
import { MobileDeviceNotice } from './components/MobileDeviceNotice';
import { BatchGradeModal } from './components/BatchGradeModal';
import { BatchReviewBar } from './components/BatchReviewBar';
import { parseBatch, BatchParseResult } from './services/batchGrading';
import { STUDIO_CHALLENGES, LIVE_STAGE_CHALLENGES, OPEN_TASKS, getTaskById, resolveTaskId, SANDBOX_ID, lockedGivenInstruments } from './data/challenges';
import { useUndoRedo, DEFAULT_MASTER_BUS } from './hooks/useUndoRedo';
import { StageSize, getWorld } from './components/canvas/stageGeometry';
import { encodeSubmission, decodeSubmission } from './services/submissionCodec';
import { slotFor, loadSaved, writeSaved, clearSaved, getLastSlot, setLastSlot, hasSaved, loadDone, markDone, clearDone } from './utils/autosave';
import { SaveIndicator, RestorePrompt, type SaveStatus } from './components/AutosaveUI';
import { getGearBoxDimensions } from './components/canvas/canvasMath';
import { hasLiveOutputs } from './components/canvas/monitorChain';
import { packProject, unpackProject } from './services/submissionCodec';
import {
  QuizRecord, QuizPlot, buildFixScenario, evaluateFix, evaluatePlan, explainSource, newQuizSeed, readQuizLink, scenarioFromRecord,
  combineAttempts, fixItems, liveOutputsOf, planItems,
} from './quiz/quizEngine';
import { QuizPanel } from './quiz/QuizPanel';
import { QuizReviewPanel } from './quiz/QuizReviewPanel';
import { QuietChecksContext } from './quiz/quietChecks';
import { loadQuiz, saveQuiz } from './quiz/quizStore';

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
  // null = open sandbox (the default, not graded). Otherwise the id of an open task or challenge.
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);
  // Task the teacher assigned via an assignment link (?task=...), if any.
  const [assignedTaskId, setAssignedTaskId] = useState<string | null>(null);
  // The Four Questions reference (a modal). Learn itself is the guided build below.
  const [isLearnOpen, setIsLearnOpen] = useState(false);
  // Guided Learn: null = not in Learn. step === LEARN_STEPS.length is the finish screen.
  const [learn, setLearn] = useState<{ step: number } | null>(null);
  const [learnProgress, setLearnProgressState] = useState<LearnProgress>(() => loadLearnProgress());
  const setLearnProgress = (update: (p: LearnProgress) => LearnProgress) =>
    setLearnProgressState((prev) => {
      const next = update(prev);
      saveLearnProgress(next);
      return next;
    });
  // The student's own plot, set aside while they are in Learn.
  const learnSavedRef = useRef<StudioProjectState | null>(null);
  // The student's Learn plots for each part (studio / live), so moving between steps never loses work.
  const learnPartPlotsRef = useRef<{ studio?: LearnPlot; live?: LearnPlot }>({});
  // Room/stage size: bigger rooms give more floor for more musicians and gear.
  const [stageSize, setStageSize] = useState<StageSize>('standard');
  // Quiz Mode: only at the hidden /quiz link. Its own plot and record; autosave and the tour stay off.
  const quizLink = useMemo(() => readQuizLink(), []);
  const [quizRec, setQuizRec] = useState<QuizRecord | null>(null);
  const [quizCode, setQuizCode] = useState<string | null>(null);

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
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);
  const [isPerfectionModalOpen, setIsPerfectionModalOpen] = useState(false);
  const [hasCelebratedA, setHasCelebratedA] = useState(false);

  // Batch grading (kept in memory only; nothing is stored)
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchResult, setBatchResult] = useState<BatchParseResult | null>(null);
  const [review, setReview] = useState<{ order: number[]; pos: number } | null>(null);
  const [savedWorkspace, setSavedWorkspace] = useState<StudioProjectState | null>(null);

  const handleLoadProject = useCallback((loaded: StudioProjectState) => {
    setProjectTitle(loaded.title || 'Studio Setup Assignment');
    setStudentName(loaded.studentName || 'Student');
    setPeriod(loaded.period || '1');
    setClassName(loaded.className || 'Audio Production');
    setEnvironment(loaded.environment || 'recording_studio');
    setActiveChallengeId(resolveTaskId(loaded.activeChallengeId, loaded.environment));
    setStageSize(loaded.stageSize || 'standard');
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

  // First visit: open the How-To tour (it starts with the welcome and ends
  // with a choice of Studio / Live Stage / Learn).
  useEffect(() => {
    if (quizLink) return; // the quiz starts straight in
    try {
      if (!localStorage.getItem('audioplot_tour_seen')) {
        setTimeout(() => setIsTourOpen(true), 150);
        localStorage.setItem('audioplot_tour_seen', 'true');
      }
    } catch {
      setTimeout(() => setIsTourOpen(true), 150);
    }
  }, []);

  // Parse URL parameters on initial load and popstate
  useEffect(() => {
    const handleUrlLoad = () => {
      if (readQuizLink()) return; // Quiz Mode sets up its own plot
      const params = new URLSearchParams(window.location.search);
      let plotParam = params.get('plot');

      if (!plotParam) {
        const hash = window.location.hash;
        if (hash && hash.includes('plot=')) {
          const match = hash.match(/plot=([^&]+)/);
          if (match && match[1]) {
            plotParam = match[1];
          }
        }
      }

      if (plotParam) {
        setIsSharedView(true);
        const loaded =
          deserializeStudioProject(plotParam) ||
          deserializeStudioProject(decodeURIComponent(plotParam));
        if (loaded) {
          setProjectTitle(loaded.title || 'Studio Setup Assignment');
          setStudentName(loaded.studentName || 'Student');
          setPeriod(loaded.period || '1');
          setClassName(loaded.className || 'Audio Production');
          setEnvironment(loaded.environment || 'recording_studio');
          setActiveChallengeId(resolveTaskId(loaded.activeChallengeId, loaded.environment));
          setStageSize(loaded.stageSize || 'standard');
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

      // Assignment link from the teacher: open straight into that task.
      const assigned = getTaskById(params.get('task'));
      if (assigned) {
        setAssignedTaskId(assigned.id);
        startTask(assigned, { forceReset: true });
        return;
      }

      // Default: blank, ungraded sandbox
      resetHistory({
        placedGear: [],
        connections: [],
        mixerChannels: INITIAL_CHANNELS,
        masterBus: DEFAULT_MASTER_BUS,
      });
    };

    handleUrlLoad();
    window.addEventListener('popstate', handleUrlLoad);
    return () => window.removeEventListener('popstate', handleUrlLoad);
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

      if (gearItem.gearId === 'inst_dj_rig') return 'DJ';

      // 2. DI Box connected to instrument
      if (isDiBoxId(gearItem.gearId)) {
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
            if (otherGear.gearId === 'inst_dj_rig' || otherGear.gearId === 'inst_computer') {
              const name = otherGear.gearId === 'inst_dj_rig' ? 'DJ' : 'LAPTOP';
              // One breakout leg into each of two mono DIs: name them L and R in the order they were cabled
              const legs = connList.filter(
                (c) => c.cableType === 'breakout' && (c.fromInstanceId === otherGear.instanceId || c.toInstanceId === otherGear.instanceId)
              );
              const i = legs.findIndex((c) => c.fromInstanceId === gearItem.instanceId || c.toInstanceId === gearItem.instanceId);
              return legs.length === 2 && gearItem.gearId === 'gear_di_box' ? `${name} ${i === 0 ? 'L' : 'R'}` : `${name} DI`;
            }
          }
        }
        return gearItem.gearId === 'gear_di_stereo' ? 'ST DI' : 'DI BOX';
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
    return evaluateStudioSetup(environment, placedGear, connections, mixerChannels, activeChallengeId, stageSize);
  }, [environment, placedGear, connections, mixerChannels, activeChallengeId, stageSize]);

  const currentChallenge = getTaskById(activeChallengeId);

  // Which tasks are finished / have saved work (read when the Tasks window or the finish window opens)
  const doneTasks = useMemo(() => loadDone(), [isChallengeModalOpen, isPerfectionModalOpen, activeChallengeId]);
  const savedTaskIds = useMemo(
    () => [...STUDIO_CHALLENGES, ...LIVE_STAGE_CHALLENGES, ...OPEN_TASKS].filter((t) => hasSaved(t.id)).map((t) => t.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isChallengeModalOpen, isPerfectionModalOpen, activeChallengeId]
  );

  // Celebrate with confetti on hitting 90%+ (Perfection!)
  useEffect(() => {
    if (review) return; // no celebrations while the teacher reviews student plots
    if (!activeChallengeId) return; // the sandbox is not graded
    if (evaluation.percentage >= 90 && !hasCelebratedA) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
      setHasCelebratedA(true);
      if (activeChallengeId) {
        markDone(activeChallengeId, evaluation.percentage);
        setIsPerfectionModalOpen(true);
      }
    } else if (evaluation.percentage < 80) {
      setHasCelebratedA(false);
    }
  }, [evaluation.percentage, hasCelebratedA, activeChallengeId, review]);

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
      // Sandbox work is marked so batch grading knows it was not a graded task.
      activeChallengeId: activeChallengeId ?? SANDBOX_ID,
      stageSize: stageSize === 'standard' ? undefined : stageSize,
      learnDone: learnProgress.done || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [projectTitle, studentName, period, className, environment, placedGear, connections, mixerChannels, masterBus, activeChallengeId, stageSize, learnProgress.done]);

  // ---------- Autosave (kept in this browser only; see utils/autosave.ts) ----------
  // Not used for shared-plot links. Each assignment link has its own slot. If a plot was saved on an
  // earlier visit, ask before doing anything; autosave stays off until the student answers, so a blank
  // plot can never overwrite saved work.
  // Each task has its own saved plot, so moving between tasks never loses work. On load, an assignment link
  // opens its own task's plot; a plain visit offers back whatever the student was last working on.
  const autosaveSlot = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('plot') || window.location.hash.includes('plot=')) return null;
    if (readQuizLink()) return null; // the quiz keeps its own record (quiz/quizStore.ts)
    const task = params.get('task');
    return task ? slotFor(task) : getLastSlot() ?? slotFor(null);
  }, []);
  const [restoreOffer, setRestoreOffer] = useState<{ project: StudioProjectState; code: string; savedAt: number } | null>(() => {
    if (!autosaveSlot) return null;
    const saved = loadSaved(autosaveSlot);
    const project = saved ? decodeSubmission(saved.code) : null;
    return saved && project ? { project, code: saved.code, savedAt: saved.savedAt } : null;
  });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // True from a change until the debounced save has run, so the header never says "Saved" for unsaved work
  const [savePending, setSavePending] = useState(false);
  const lastCodeRef = useRef<string>('');
  const autosaveOn = autosaveSlot !== null && restoreOffer === null;
  const projectRef = useRef(currentProjectState);
  projectRef.current = currentProjectState;
  const reviewActiveRef = useRef(false);
  // Teacher review, shared views and Learn are not the student's own plot, so they are never autosaved.
  reviewActiveRef.current = review !== null || isSharedView || learn !== null || quizRec !== null;

  /** Has the student done anything beyond what a fresh sandbox or task already shows? */
  const hasWorkNow = () => {
    const p = projectRef.current;
    const baseline = currentChallenge?.instruments?.length ?? 0;
    return (
      p.placedGear.length > baseline ||
      p.connections.length > 0 ||
      JSON.stringify(p.mixerChannels) !== JSON.stringify(INITIAL_CHANNELS) ||
      JSON.stringify(p.masterBus) !== JSON.stringify(DEFAULT_MASTER_BUS)
    );
  };

  // Where the plot on screen is saved: the active task's slot (or the sandbox's)
  const currentSlot = autosaveSlot ? slotFor(activeChallengeId) : null;
  const currentSlotRef = useRef(currentSlot);
  currentSlotRef.current = currentSlot;

  const saveNow = () => {
    const slot = currentSlotRef.current;
    if (!slot || restoreOffer || reviewActiveRef.current) return; // teacher review / shared views are not the student's work
    if (!hasWorkNow()) {
      // The student cleared everything on purpose: don't offer the old plot back next time.
      if (lastCodeRef.current) {
        clearSaved(slot);
        lastCodeRef.current = '';
        setSaveStatus('idle');
      }
      return;
    }
    // The name is never saved: it is typed only when making the code to turn in.
    const code = encodeSubmission({ ...projectRef.current, studentName: '', studentId: undefined, teacherName: undefined });
    if (code === lastCodeRef.current) return;
    if (writeSaved(slot, code)) {
      setLastSlot(slot);
      lastCodeRef.current = code;
      setSaveStatus('saved');
      setSavedAt(Date.now());
    } else {
      setSaveStatus('failed');
    }
  };
  const saveNowRef = useRef(saveNow);
  saveNowRef.current = saveNow;
  const hasWorkRef = useRef(hasWorkNow);
  hasWorkRef.current = hasWorkNow;

  // Save shortly after the student stops changing things
  useEffect(() => {
    if (!autosaveOn) return;
    setSavePending(true);
    const timer = window.setTimeout(() => {
      saveNowRef.current();
      setSavePending(false);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [autosaveOn, placedGear, connections, mixerChannels, masterBus, environment, activeChallengeId, stageSize, projectTitle]);

  // Save right away when the tab is hidden or closed, so a quick close doesn't lose the last change
  useEffect(() => {
    if (!autosaveOn) return;
    const flush = () => saveNowRef.current();
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [autosaveOn]);

  // Only warn on leaving when the browser can't save (otherwise leaving is safe)
  useEffect(() => {
    if (saveStatus !== 'failed') return;
    const warn = (e: BeforeUnloadEvent) => {
      if (!hasWorkRef.current()) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveStatus]);

  const handleRestoreSaved = () => {
    if (!restoreOffer) return;
    handleLoadProject(restoreOffer.project);
    if (restoreOffer.project.learnDone) setLearnProgress((p) => ({ ...p, done: true }));
    lastCodeRef.current = restoreOffer.code;
    setSavedAt(restoreOffer.savedAt);
    setSaveStatus('saved');
    setRestoreOffer(null);
  };

  const handleStartFresh = () => {
    if (autosaveSlot) clearSaved(autosaveSlot);
    lastCodeRef.current = '';
    setRestoreOffer(null);
  };

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

    // Stereo gear (Stereo DI, DJ Rig) feeds two channels: lower number is L, higher is R
    if (item && isStereoGearId(item.gearId)) {
      setBatchState(
        {
          mixerChannels: (prev) => {
            const mine = prev.filter((c) => c.assignedGearInstanceId === gearInstanceId).map((c) => c.channelNumber);
            let keep: number[];
            if (mine.includes(channelNumber)) keep = mine.filter((n) => n !== channelNumber); // toggle off
            else keep = [...mine.slice(-1), channelNumber]; // at most two sides
            keep.sort((a, b) => a - b);
            return prev.map((ch) => {
              if (keep.includes(ch.channelNumber)) {
                const side = keep.length === 2 ? (ch.channelNumber === keep[0] ? ' L' : ' R') : '';
                const fresh = ch.assignedGearInstanceId !== gearInstanceId;
                // Line-level DJ Rig outs: gain starts low when first patched
                const gain = fresh && item.gearId === 'inst_dj_rig' && ch.gain === 72 ? DJ_RIG_START_GAIN : ch.gain;
                return { ...ch, assignedGearInstanceId: gearInstanceId, label: `${derivedLabel}${side}`, gain };
              }
              if (ch.assignedGearInstanceId === gearInstanceId || ch.channelNumber === channelNumber) {
                return { ...ch, assignedGearInstanceId: null, label: `CH ${ch.channelNumber}` };
              }
              return ch;
            });
          },
          placedGear: (prev) =>
            prev.map((g) => {
              if (g.instanceId === gearInstanceId) {
                const mine = mixerChannels.filter((c) => c.assignedGearInstanceId === gearInstanceId).map((c) => c.channelNumber);
                const keep = mine.includes(channelNumber)
                  ? mine.filter((n) => n !== channelNumber)
                  : [...mine.slice(-1), channelNumber];
                return { ...g, assignedChannel: keep.length ? Math.min(...keep) : undefined };
              }
              // Patching over another item's channel takes that channel away from it
              if (g.assignedChannel === channelNumber) return { ...g, assignedChannel: undefined };
              return g;
            }),
        },
        { action: `Patch to CH ${channelNumber}` }
      );
      return;
    }

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
        placedGear: (prev) => {
          if (!gearId) return prev;
          // Stereo gear keeps its other side
          const other = mixerChannels.find((c) => c.assignedGearInstanceId === gearId && c.channelNumber !== channelNumber);
          return prev.map((g) => (g.instanceId === gearId ? { ...g, assignedChannel: other?.channelNumber } : g));
        },
        mixerChannels: (prev) =>
          prev.map((c) =>
            c.channelNumber === channelNumber
              ? { ...c, assignedGearInstanceId: null, label: `CH ${channelNumber}` }
              : gearId && c.assignedGearInstanceId === gearId
              ? { ...c, label: c.label.replace(/ [LR]$/, '') }
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
  // Live stage: with no PA or monitors cabled, nobody can hear the show. Soundcheck still runs on the
  // mixer (meters move) but nothing comes out, and the student is told why. Learn builds its PA later, so it is exempt.
  const liveSilent = environment === 'live_stage' && !learn && !hasLiveOutputs(connections, placedGear);
  const [soundNotice, setSoundNotice] = useState<string | null>(null);
  const soundNoticeTimer = useRef<number | null>(null);
  const showSoundNotice = (msg: string) => {
    setSoundNotice(msg);
    if (soundNoticeTimer.current) window.clearTimeout(soundNoticeTimer.current);
    soundNoticeTimer.current = window.setTimeout(() => setSoundNotice(null), 6000);
  };
  const LIVE_SILENT_MSG =
    'No sound: nothing is hooked up to hear the show. Cable PA speakers to MAIN L/R or stage monitors to MON 1/2. The mixer still shows the signal.';
  useEffect(() => {
    audioEngine.setOutputsConnected(!liveSilent);
    if (liveSilent && isPlayingAudio) showSoundNotice(LIVE_SILENT_MSG);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveSilent]);

  const handleToggleAudio = useCallback(() => {
    const isPlaying = audioEngine.togglePlayback(placedGear, mixerChannels, connections);
    setIsPlayingAudio(isPlaying);
    if (isPlaying && liveSilent) showSoundNotice(LIVE_SILENT_MSG);
    if (!isPlaying) setSoundNotice(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placedGear, mixerChannels, connections, liveSilent]);

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
    // Inside a task, clearing starts that task over (given instruments come back).
    const task = getTaskById(activeChallengeId);
    if (task) {
      startTask(task, { forceReset: true });
      return;
    }
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

  /** Put a saved plot on screen (used when going back to a task or the sandbox). */
  const showSavedPlot = (project: StudioProjectState, code: string, savedTime: number) => {
    setProjectTitle(project.title || 'Studio Setup Assignment');
    setEnvironment(project.environment || 'recording_studio');
    setStageSize(project.stageSize || 'standard');
    setSelectedItemId(null);
    resetHistory({
      placedGear: project.placedGear || [],
      connections: project.connections || [],
      mixerChannels: project.mixerChannels && project.mixerChannels.length > 0 ? project.mixerChannels : INITIAL_CHANNELS,
      masterBus: project.masterBus || DEFAULT_MASTER_BUS,
    });
    lastCodeRef.current = code;
    setSavedAt(savedTime);
    setSaveStatus('saved');
  };

  const stopSoundcheck = () => {
    if (isPlayingAudio) {
      audioEngine.stop();
      setIsPlayingAudio(false);
    }
  };

  const handleSelectChallenge = (challenge: ChallengeDefinition | null, options: { startOver?: boolean } = {}) => {
    // Whatever is on screen belongs to the task being left: save it now rather than waiting for the autosave
    saveNowRef.current();
    if (!challenge) {
      if (activeChallengeId === null) return; // already in the sandbox
      // The sandbox has its own plot: bring it back, or open an empty one. The task's work stays saved.
      const saved = loadSaved(slotFor(null));
      const project = saved ? decodeSubmission(saved.code) : null;
      setActiveChallengeId(null);
      stopSoundcheck();
      setLastSlot(slotFor(null));
      if (saved && project) {
        showSavedPlot(project, saved.code, saved.savedAt);
      } else {
        setSelectedItemId(null);
        resetHistory({ placedGear: [], connections: [], mixerChannels: INITIAL_CHANNELS, masterBus: DEFAULT_MASTER_BUS });
        lastCodeRef.current = '';
      }
      return;
    }
    if (options.startOver) {
      clearSaved(slotFor(challenge.id));
      clearDone(challenge.id);
      startTask(challenge, { forceReset: true });
      return;
    }
    if (challenge.id === activeChallengeId) return; // already here
    startTask(challenge);
  };

  function startTask(challenge: ChallengeDefinition, options: { forceReset?: boolean } = {}) {
    // Going back to a task that has saved work: put that work back exactly as it was (completed tasks included)
    if (!options.forceReset) {
      const saved = loadSaved(slotFor(challenge.id));
      const project = saved ? decodeSubmission(saved.code) : null;
      if (saved && project) {
        setActiveChallengeId(challenge.id);
        stopSoundcheck();
        setLastSlot(slotFor(challenge.id));
        showSavedPlot(project, saved.code, saved.savedAt);
        if (loadDone()[challenge.id]) setHasCelebratedA(true); // already passed: no second celebration
        return;
      }
    }
    setLastSlot(slotFor(challenge.id));
    // An open task in the same room keeps what the student already built in the sandbox.
    if (challenge.openEnded && challenge.environment === environment && !options.forceReset) {
      setActiveChallengeId(challenge.id);
      setProjectTitle(challenge.title);
      lastCodeRef.current = ''; // so the carried-over plot is saved under this task's slot
      return;
    }
    lastCodeRef.current = '';
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
      // Challenge layouts were drawn for a smaller floor: spread them out and
      // start them below the snake so nothing hides underneath it.
      x: Math.round(60 + inst.x * 1.25),
      y: Math.round(175 + Math.max(0, inst.y - 120) * 1.1),
      rotation: 0,
      hasPopFilter: false,
    }));
    resetHistory({
      placedGear: loadedInstruments,
      connections: [],
      mixerChannels: INITIAL_CHANNELS,
      masterBus: DEFAULT_MASTER_BUS,
    });
  }

  // Changing the room size keeps every item where it is; when the room gets
  // smaller, anything that would fall outside is pulled back in.
  const handleStageSizeChange = (size: StageSize) => {
    if (size === stageSize) return;
    const world = getWorld(size);
    setPlacedGear(
      (prev) =>
        prev.map((g) => {
          const d = getGearBoxDimensions(g.gearId, !!g.latchedSourceInstanceId, g.customScale, g.customWidth, g.customHeight);
          return {
            ...g,
            x: Math.max(10, Math.min(world.width - d.width - 10, g.x)),
            y: Math.max(10, Math.min(world.height - d.height - 10, g.y)),
          };
        }),
      { action: 'Change room size' }
    );
    setStageSize(size);
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

  // ---------- Learn (guided build on its own plot) ----------
  const loadLearnPlot = (plot: LearnPlot, stepIndex: number) => {
    if (isPlayingAudio) {
      audioEngine.stop();
      setIsPlayingAudio(false);
    }
    setEnvironment(plot.environment);
    setStageSize('standard');
    setActiveChallengeId(null);
    setSelectedItemId(null);
    setActiveCableTool(null);
    setCableConnectingFromId(null);
    resetHistory({
      placedGear: plot.placedGear,
      connections: plot.connections,
      mixerChannels: plot.mixerChannels,
      masterBus: plot.masterBus,
    });
    showLearnMixer(stepIndex);
  };

  // When a step that ends in a soundcheck is finished (the end of the studio part), open the mixer.
  const learnStepFinished =
    !!learn && !!LEARN_STEPS[learn.step] && stepDone(LEARN_STEPS[learn.step], { environment, placedGear, connections, mixerChannels, masterBus });
  useEffect(() => {
    if (learn && LEARN_STEPS[learn.step]?.openMixerWhenDone && learnStepFinished) setIsMixerCollapsed(false);
  }, [learn?.step, learnStepFinished]);

  // The mixer pops up on steps that use it and tucks away again on steps about the plot.
  const showLearnMixer = (stepIndex: number) => setIsMixerCollapsed(!LEARN_STEPS[stepIndex]?.openMixer);
  const learnPartOf = (stepIndex: number) => (LEARN_STEPS[stepIndex]?.part ?? 'live');
  const currentLearnPlot = (): LearnPlot => ({ environment, placedGear, connections, mixerChannels, masterBus });
  /** A ready-made plot for a part the student has no plot for yet (e.g. after a reload): as far
   *  along as they have already got in that part, so going back never shows undone work. */
  const learnPartFallback = (index: number): LearnPlot => {
    const inPart = LEARN_STEPS.map((_, i) => i).filter((i) => learnPartOf(i) === learnPartOf(index));
    const last = inPart[inPart.length - 1];
    const reached = learnProgress.done ? LEARN_STEPS.length : learnProgress.reached;
    if (reached > last) return LEARN_STEPS[last].solve(learnStartPlot(last));
    return learnStartPlot(Math.max(index, Math.min(reached, last)));
  };

  const handleEnterLearn = () => {
    setIsLearnOpen(false);
    if (learn) return;
    learnSavedRef.current = currentProjectState;
    const start = learnProgress.done ? 0 : Math.min(learnProgress.reached, LEARN_STEPS.length - 1);
    // Back in Learn during the same visit: pick up the plot they left.
    loadLearnPlot(learnPartPlotsRef.current[learnPartOf(start)] ?? learnStartPlot(start), start);
    setProjectTitle('Learn');
    setLearn({ step: start });
  };

  /** Move to a step. The student's plot stays as it is within a part; crossing between studio and live
   *  swaps to the other part's plot (theirs if they built one, otherwise a ready-made one). */
  const handleLearnGoTo = (index: number) => {
    if (!learn) return;
    const fromPart = learnPartOf(learn.step);
    const toPart = learnPartOf(index);
    if (fromPart === toPart) {
      setSelectedItemId(null);
      showLearnMixer(index);
    } else {
      learnPartPlotsRef.current[fromPart] = currentLearnPlot();
      loadLearnPlot(learnPartPlotsRef.current[toPart] ?? learnPartFallback(index), index);
    }
    setLearn({ step: index });
  };

  /** Start this step over from a ready-made plot (the Restart button and Clear). */
  const handleLearnRestartStep = (index: number) => {
    const plot = learnStartPlot(index);
    learnPartPlotsRef.current[learnPartOf(index)] = plot;
    loadLearnPlot(plot, index);
    setLearn({ step: index });
  };

  const handleLearnNext = () => {
    if (!learn) return;
    const next = learn.step + 1;
    if (next >= LEARN_STEPS.length) {
      setLearnProgress((p) => ({ ...p, reached: LEARN_STEPS.length, done: true }));
      if (isPlayingAudio) {
        audioEngine.stop();
        setIsPlayingAudio(false);
      }
      setLearn({ step: LEARN_STEPS.length });
      return;
    }
    // Carry the student's own plot forward. Within a part nothing reloads; moving to the stage
    // builds the live plot from their studio plot (or returns to the live plot they already have).
    const current = currentLearnPlot();
    if (learnPartOf(next) === learnPartOf(learn.step)) {
      setSelectedItemId(null);
      showLearnMixer(next);
    } else {
      learnPartPlotsRef.current[learnPartOf(learn.step)] = current;
      const enter = LEARN_STEPS[next].enter;
      loadLearnPlot(learnPartPlotsRef.current[learnPartOf(next)] ?? (enter ? enter(current) : current), next);
    }
    setLearnProgress((p) => ({ ...p, reached: Math.max(p.reached, next) }));
    setLearn({ step: next });
  };

  const handleLearnAnswer = (option: number) => {
    if (!learn) return;
    const step = learn.step;
    setLearnProgress((p) => ({ ...p, answers: { ...p.answers, [step]: option } }));
  };

  const handleExitLearn = () => {
    if (learn) learnPartPlotsRef.current[learnPartOf(learn.step)] = currentLearnPlot();
    const saved = learnSavedRef.current;
    learnSavedRef.current = null;
    setLearn(null);
    if (isPlayingAudio) {
      audioEngine.stop();
      setIsPlayingAudio(false);
    }
    setSelectedItemId(null);
    if (!saved) return;
    setProjectTitle(saved.title);
    setEnvironment(saved.environment);
    setActiveChallengeId(resolveTaskId(saved.activeChallengeId, saved.environment));
    setStageSize(saved.stageSize || 'standard');
    resetHistory({
      placedGear: saved.placedGear,
      connections: saved.connections,
      mixerChannels: saved.mixerChannels,
      masterBus: saved.masterBus || DEFAULT_MASTER_BUS,
    });
  };

  /** Leave Learn first (restoring the student's plot), then do something with their own work. */
  const outOfLearn = (then: () => void) => () => {
    if (learn) handleExitLearn();
    then();
  };

  // In Learn, the instruments on the plot are part of the lesson.
  const learnLockedIds = (ids: string[]) =>
    ids.filter((id) => {
      const g = placedGear.find((x) => x.instanceId === id);
      const cat = g ? getGearById(g.gearId)?.category : undefined;
      return cat === 'instrument' || g?.gearId === 'gear_guitar_amp';
    });

  // ---------- Quiz Mode (/quiz) ----------
  const quizScenario = useMemo(() => (quizRec ? scenarioFromRecord(quizRec) : null), [quizRec?.sd, quizRec?.tp]);
  const quizFix = useMemo(() => (quizScenario ? buildFixScenario(quizScenario) : null), [quizScenario]);
  const packPlot = (p: QuizPlot) => packProject(p as unknown as StudioProjectState);
  const unpackPlot = (packed: Record<string, unknown>): QuizPlot => {
    const u = unpackProject(packed as Record<string, any>);
    return { environment: 'live_stage', placedGear: u.placedGear, connections: u.connections, mixerChannels: u.mixerChannels, masterBus: u.masterBus || DEFAULT_MASTER_BUS };
  };
  const quizPlotNow = (): QuizPlot => ({ environment: 'live_stage', placedGear, connections, mixerChannels, masterBus });
  const emptyQuizPlot = (): QuizPlot => ({ environment: 'live_stage', placedGear: [], connections: [], mixerChannels: INITIAL_CHANNELS, masterBus: DEFAULT_MASTER_BUS });
  const loadQuizPlot = (p: QuizPlot) => {
    setEnvironment('live_stage');
    setStageSize('standard');
    setSelectedItemId(null);
    resetHistory({ placedGear: p.placedGear, connections: p.connections, mixerChannels: p.mixerChannels, masterBus: p.masterBus });
  };
  const stopAudio = () => {
    if (isPlayingAudio) {
      audioEngine.stop();
      setIsPlayingAudio(false);
    }
  };

  // Start (or pick up) the quiz once, on the hidden link
  useEffect(() => {
    if (!quizLink) return;
    const stored = loadQuiz();
    setProjectTitle('Quiz');
    setActiveChallengeId(null);
    if (stored && (stored.rec.tp ?? null) === quizLink.template) {
      setQuizRec(stored.rec);
      loadQuizPlot(stored.plot ? unpackPlot(stored.plot) : emptyQuizPlot());
      if (stored.rec.ph === 'fix') setIsMixerCollapsed(false);
    } else {
      setQuizRec({ v: 1, sd: newQuizSeed(), tp: quizLink.template ?? undefined, ph: 'intro' });
      loadQuizPlot(emptyQuizPlot());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the quiz in this browser (no name) so a reload doesn't lose it
  useEffect(() => {
    if (!quizRec) return;
    const t = window.setTimeout(() => {
      saveQuiz({ rec: quizRec, plot: packPlot({ environment: 'live_stage', placedGear, connections, mixerChannels, masterBus }) });
    }, 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizRec, placedGear, connections, mixerChannels, masterBus]);

  // First try counts in full; a second pass earns half for whatever it fixes
  const quizPlan = useMemo(() => {
    if (!quizRec?.p1 || !quizScenario) return null;
    const first = planItems(evaluatePlan(unpackPlot(quizRec.p1), quizScenario));
    const second = quizRec.p1r ? planItems(evaluatePlan(unpackPlot(quizRec.p1r), quizScenario)) : null;
    return combineAttempts(first, second);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizRec?.p1, quizRec?.p1r, quizScenario]);
  const quizFixResult = useMemo(() => {
    if (!quizRec?.p2 || !quizScenario || !quizFix) return null;
    const first = fixItems(evaluateFix(unpackPlot(quizRec.p2), quizScenario, quizFix.errors));
    const second = quizRec.p2r ? fixItems(evaluateFix(unpackPlot(quizRec.p2r), quizScenario, quizFix.errors)) : null;
    return combineAttempts(first, second);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizRec?.p2, quizRec?.p2r, quizScenario, quizFix]);
  const updateQuiz = (changes: Partial<QuizRecord>) => {
    setQuizRec((r) => (r ? { ...r, ...changes } : r));
    setQuizCode(null);
  };

  const handleQuizStart = () => {
    loadQuizPlot(emptyQuizPlot());
    updateQuiz({ ph: 'plan' });
  };
  const handleQuizSubmitPlan = () => {
    const second = quizRec?.ph === 'plan_revise';
    // Easy to forget on a live stage: remind (not required) before submitting without a PA or monitors
    const outs = liveOutputsOf(quizPlotNow());
    const forgot = [!outs.pa && 'PA speakers (MAIN L/R)', !outs.monitors && 'stage monitors (MON 1/2)'].filter(Boolean);
    const reminder = forgot.length ? `Heads up: your stage has no ${forgot.join(' and no ')} set up. The audience and the band need to hear the show.\n\n` : '';
    const ask = second ? 'Submit your second pass?' : 'Submit Part 1? Your plot is checked and you get your score.';
    if (!window.confirm(reminder + ask)) return;
    stopAudio();
    updateQuiz(second ? { ph: 'plan_final', p1r: packPlot(quizPlotNow()) } : { ph: 'plan_done', p1: packPlot(quizPlotNow()) });
  };
  const handleQuizRevisePlan = () => {
    if (quizRec?.p1) loadQuizPlot(unpackPlot(quizRec.p1));
    updateQuiz({ ph: 'plan_revise' });
  };
  const handleQuizReviseFix = () => {
    if (quizRec?.p2) loadQuizPlot(unpackPlot(quizRec.p2));
    setIsMixerCollapsed(false);
    updateQuiz({ ph: 'fix_revise' });
  };
  const handleQuizStartFix = () => {
    if (!quizFix) return;
    loadQuizPlot(JSON.parse(JSON.stringify(quizFix.broken)));
    setIsMixerCollapsed(false);
    updateQuiz({ ph: 'fix' });
  };
  const handleQuizResetFix = () => {
    if (!quizFix || !window.confirm('Start Part 2 over? Your fixes so far are undone.')) return;
    stopAudio();
    loadQuizPlot(JSON.parse(JSON.stringify(quizFix.broken)));
  };
  const handleQuizSubmitFix = () => {
    const second = quizRec?.ph === 'fix_revise';
    // The line check is the student's own: remind them about any source they haven't ticked
    const unchecked = quizScenario ? quizScenario.sources.filter((s) => !(quizRec?.lc ?? []).includes(s.key)).map((s) => s.label) : [];
    const reminder = !second && unchecked.length ? `You haven't line-checked: ${unchecked.join(', ')}.\n\n` : '';
    if (!window.confirm(reminder + (second ? 'Submit your second pass?' : 'Submit Part 2? Your fixes are checked and you get your score.'))) return;
    stopAudio();
    updateQuiz(second ? { ph: 'fix_final', p2r: packPlot(quizPlotNow()) } : { ph: 'fix_done', p2: packPlot(quizPlotNow()) });
  };
  const handleQuizMakeCode = () => {
    if (!quizRec?.p1 || !quizScenario) return;
    const plan = unpackPlot(quizRec.p1);
    // The code's main plot is Part 1; Part 2 and the written answers ride along in `quiz`.
    setQuizCode(
      encodeSubmission({
        ...currentProjectState,
        title: `Quiz: ${quizScenario.title}`,
        studentName: studentName.trim(),
        environment: 'live_stage',
        activeChallengeId: 'quiz',
        stageSize: undefined,
        learnDone: undefined,
        placedGear: plan.placedGear,
        connections: plan.connections,
        mixerChannels: plan.mixerChannels,
        masterBus: plan.masterBus,
        quiz: quizRec,
      })
    );
  };
  const handleQuizResetPlot = () => {
    if (quizRec?.ph === 'plan' || quizRec?.ph === 'plan_revise') {
      if (window.confirm('Clear the whole plot?')) loadQuizPlot(emptyQuizPlot());
    } else if (quizRec?.ph === 'fix') {
      handleQuizResetFix();
    }
  };
  // In Part 2 the band's instruments and amps are given
  const quizLockedIds = (ids: string[]) =>
    quizRec?.ph.startsWith('fix') ? learnLockedIds(ids) : [];

  // ---------- Batch review ----------
  const [reviewQuizPart, setReviewQuizPart] = useState<1 | 2>(1);
  const showReviewAt = (order: number[], pos: number, quizPart: 1 | 2 = 1) => {
    const entry = batchResult?.entries[order[pos]];
    if (!entry) return;
    const plot = entry.quiz && quizPart === 2 && entry.quiz.part2Plot ? entry.quiz.part2Plot : null;
    handleLoadProject(plot ? { ...entry.project, ...plot } : entry.project);
    setReviewQuizPart(plot ? 2 : 1);
    setSelectedItemId(null);
    setReview({ order, pos });
  };
  const handleStartReview = (order: number[], start: number) => {
    if (!review) setSavedWorkspace(currentProjectState); // remember the teacher's own work
    setIsBatchOpen(false);
    showReviewAt(order, start);
  };
  const handleExitReview = () => {
    if (savedWorkspace) handleLoadProject(savedWorkspace);
    setSavedWorkspace(null);
    setReview(null);
  };
  const reviewEntry = review && batchResult ? batchResult.entries[review.order[review.pos]] : null;

  return (
    <QuietChecksContext.Provider value={quizRec !== null}>
    <div className="flex flex-col h-screen w-screen bg-[#0c0c11] overflow-hidden text-stone-100 font-sans relative">
      {/* Ambient background illumination */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_0%,rgba(217,164,65,0.07),transparent_50%),radial-gradient(circle_at_85%_70%,rgba(95,159,184,0.06),transparent_40%),radial-gradient(circle_at_15%_90%,rgba(207,98,64,0.05),transparent_40%)]" />

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
        onEnvironmentChange={(env) => !learn && handleRequestEnvironmentChange(env)}
        onOpenShareModal={outOfLearn(handleOpenShareModal)}
        onExportPdf={handleExportPdf}
        onOpenGuideModal={() => setIsLearnOpen(true)}
        onOpenTour={() => setIsTourOpen(true)}
        onOpenChallengeModal={outOfLearn(() => setIsChallengeModalOpen(true))}
        onOpenLearn={handleEnterLearn}
        activeChallengeId={activeChallengeId}
        activeTaskLabel={currentChallenge ? currentChallenge.title.split(':').pop()!.trim() : null}
        onResetPlot={quizRec ? handleQuizResetPlot : learn ? () => learn.step < LEARN_STEPS.length && handleLearnRestartStep(learn.step) : handleResetPlot}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        statusSlot={quizRec ? null : <SaveIndicator status={saveStatus} savedAt={savedAt} pending={savePending} />}
        quizLabel={quizRec ? 'Quiz · Live Stage' : null}
      />

      {restoreOffer && !learn && !quizRec && (
        <RestorePrompt savedAt={restoreOffer.savedAt} onRestore={handleRestoreSaved} onStartFresh={handleStartFresh} />
      )}

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
            stageSize={stageSize}
            onStageSizeChange={handleStageSizeChange}
            getLockedIds={
              review ? undefined : quizRec ? quizLockedIds : learn ? learnLockedIds : (ids) => lockedGivenInstruments(currentChallenge, placedGear, ids)
            }
          />
        </div>

        {/* Right: the quiz, the Learn guide while in Learn, otherwise the live rubric panel */}
        {review && reviewEntry?.quiz ? (
          <QuizReviewPanel
            grade={reviewEntry.quiz}
            part={reviewQuizPart}
            onPart={(p) => showReviewAt(review.order, review.pos, p)}
          />
        ) : quizRec && quizScenario ? (
          <QuizPanel
            phase={quizRec.ph}
            scenario={quizScenario}
            plan={quizPlan}
            fix={quizFixResult}
            onRevisePlan={handleQuizRevisePlan}
            onRevealPlan={() => updateQuiz({ ph: 'plan_final' })}
            onReviseFix={handleQuizReviseFix}
            onRevealFix={() => updateQuiz({ ph: 'fix_final' })}
            lineChecked={quizRec.lc ?? []}
            onLineCheck={(key, on) =>
              updateQuiz({ lc: on ? [...new Set([...(quizRec.lc ?? []), key])] : (quizRec.lc ?? []).filter((k) => k !== key) })
            }
            explainAbout={explainSource(quizScenario)}
            why={quizRec.w1 ?? ''}
            fixNote={quizRec.w2 ?? ''}
            studentName={studentName}
            code={quizCode}
            isPlayingAudio={isPlayingAudio}
            onToggleSoundcheck={handleToggleAudio}
            onStart={handleQuizStart}
            onSubmitPlan={handleQuizSubmitPlan}
            onStartFix={handleQuizStartFix}
            onSubmitFix={handleQuizSubmitFix}
            onStartExplain={() => updateQuiz({ ph: 'explain' })}
            onWhyChange={(v) => updateQuiz({ w1: v })}
            onFixNoteChange={(v) => updateQuiz({ w2: v })}
            onFinish={() => updateQuiz({ ph: 'done' })}
            onNameChange={(v) => {
              setStudentName(v);
              setQuizCode(null);
            }}
            onMakeCode={handleQuizMakeCode}
            onResetFix={handleQuizResetFix}
          />
        ) : learn ? (
          <LearnPanel
            stepIndex={learn.step}
            plot={{ environment, placedGear, connections, mixerChannels, masterBus }}
            reached={learnProgress.reached}
            finished={learnProgress.done}
            answers={learnProgress.answers}
            isPlayingAudio={isPlayingAudio}
            onAnswer={handleLearnAnswer}
            onGoTo={handleLearnGoTo}
            onNext={handleLearnNext}
            onRestartStep={() => handleLearnRestartStep(learn.step)}
            onToggleSoundcheck={handleToggleAudio}
            onOpenReference={() => setIsLearnOpen(true)}
            onTryItYourself={outOfLearn(() => setIsChallengeModalOpen(true))}
            onExit={handleExitLearn}
          />
        ) : (
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
          onOpenGuideModal={() => setIsLearnOpen(true)}
          isExpanded={isGradingExpanded}
          onToggleExpanded={() => setIsGradingExpanded((prev) => !prev)}
          onOpenTasks={() => setIsChallengeModalOpen(true)}
        />
        )}
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

      {/* Guided Walkthrough / Interactive Tour */}
      <GuidedTourModal
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        environment={environment}
        assignedTaskTitle={assignedTaskId && assignedTaskId === activeChallengeId ? getTaskById(assignedTaskId)?.title.split(':').pop()?.trim() : null}
        onChooseRoom={(env) => {
          setIsTourOpen(false);
          // Same room: just start building. Different room: the usual switch (asks first if there is work).
          if (env !== environment) {
            if (placedGear.length === 0) {
              setEnvironment(env);
              setActiveChallengeId(null);
              setProjectTitle(env === 'live_stage' ? 'Live Concert Stage Plot' : 'Studio Recording Session Plot');
            } else {
              handleRequestEnvironmentChange(env);
            }
          }
        }}
        onOpenLearn={() => {
          setIsTourOpen(false);
          handleEnterLearn();
        }}
        onOpenTasks={() => {
          setIsTourOpen(false);
          setIsChallengeModalOpen(true);
        }}
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
        hasWork={placedGear.length > 0 || connections.length > 0}
        onRestoreCode={(text) => {
          // The same forgiving reader the teacher uses, so a code pasted with extra text around it still works
          const entry = parseBatch(text).entries[0];
          if (!entry) return false;
          if (isPlayingAudio) {
            audioEngine.stop();
            setIsPlayingAudio(false);
          }
          handleLoadProject(entry.project);
          setSelectedItemId(null);
          if (entry.project.learnDone) setLearnProgress((p) => ({ ...p, done: true }));
          return true;
        }}
        onGradeCodes={(text) => {
          const result = parseBatch(text);
          if (result.entries.length === 0) return false;
          setBatchText(text);
          setBatchResult(result);
          setIsBatchOpen(true);
          return true;
        }}
      />

      {/* Batch Grading */}
      <BatchGradeModal
        isOpen={isBatchOpen}
        onClose={() => setIsBatchOpen(false)}
        text={batchText}
        onTextChange={setBatchText}
        result={batchResult}
        onGrade={() => setBatchResult(parseBatch(batchText))}
        onClear={() => {
          if (review) handleExitReview();
          setBatchResult(null);
          setBatchText('');
        }}
        onReview={handleStartReview}
      />
      {reviewEntry && review && !isBatchOpen && (
        <BatchReviewBar
          entry={reviewEntry}
          position={review.pos}
          total={review.order.length}
          onPrev={() => showReviewAt(review.order, review.pos - 1)}
          onNext={() => showReviewAt(review.order, review.pos + 1)}
          onBackToList={() => setIsBatchOpen(true)}
          onExit={handleExitReview}
        />
      )}

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
        assignedTaskId={assignedTaskId}
        onSelectChallenge={handleSelectChallenge}
        doneTaskIds={Object.keys(doneTasks)}
        savedTaskIds={savedTaskIds}
      />

      {/* Learn: the questions behind every setup */}
      <LearnModal
        isOpen={isLearnOpen}
        onClose={() => setIsLearnOpen(false)}
        environment={environment}
        onOpenTasks={() => {
          setIsLearnOpen(false);
          setIsChallengeModalOpen(true);
        }}
      />

      {/* Perfection Challenge Passed Modal */}
      <PerfectionModal
        isOpen={isPerfectionModalOpen}
        onClose={() => setIsPerfectionModalOpen(false)}
        challenge={currentChallenge}
        onStartNewTask={() => {
          setIsPerfectionModalOpen(false);
          setIsChallengeModalOpen(true);
        }}
        onOpenSandbox={() => {
          setIsPerfectionModalOpen(false);
          handleSelectChallenge(null);
        }}
        onOpenShareModal={() => {
          setIsPerfectionModalOpen(false);
          handleOpenShareModal();
        }}
        percentage={evaluation.percentage}
      />

      {soundNotice && (
        <div
          id="soundcheck-notice"
          role="alert"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] max-w-md w-[calc(100vw-32px)] px-4 py-3 rounded-2xl bg-stone-950/95 border-2 border-rose-500/70 text-rose-100 text-[13px] leading-snug shadow-2xl backdrop-blur-xl flex items-start gap-2"
        >
          <span className="w-5 h-5 rounded-full bg-rose-600 text-white font-black text-xs flex items-center justify-center shrink-0">!</span>
          <span>{soundNotice}</span>
        </div>
      )}

      {/* Mobile Device Optimization Pop-up Notice */}
      <MobileDeviceNotice />
    </div>
    </QuietChecksContext.Provider>
  );
}
