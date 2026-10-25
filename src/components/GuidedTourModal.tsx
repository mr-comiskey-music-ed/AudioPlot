import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  GripVertical,
  Cable,
  Sliders,
  Award,
  Share2,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  Headphones,
  Radio,
  GraduationCap,
  Trophy,
  ArrowRight,
} from 'lucide-react';
import { EnvironmentMode } from '../types';
import { AppLogo } from './AppLogo';

export interface TourStep {
  id: string;
  stepNumber: number;
  title: string;
  tagline: string;
  description: string;
  targetSelectors: string[];
  directionHint: string;
  icon: React.ReactNode;
  accentColor: 'orange' | 'blue' | 'purple' | 'emerald' | 'amber';
  keyTip?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    stepNumber: 1,
    title: 'Welcome to AudioPlot',
    tagline: 'Plan a studio session or a live show',
    description:
      'Place instruments, choose the right mics and DIs, cable everything to the snake, and set up the mixer. Hit Soundcheck to hear your setup. This quick tour shows you where everything is.',
    targetSelectors: [],
    directionHint: '',
    icon: <Sparkles className="w-5 h-5 text-orange-400" />,
    accentColor: 'orange',
  },
  {
    id: 'gear_locker',
    stepNumber: 2,
    title: 'Gear Locker',
    tagline: 'Drag instruments, mics and DIs onto the floor',
    description:
      'Everything lives in the drawer on the left. Drag any item onto the floor to place it, or drop it on top of existing gear to swap it.',
    targetSelectors: ['#gear-palette-drawer', 'aside#gear-palette-drawer'],
    directionHint: '',
    icon: <GripVertical className="w-5 h-5 text-orange-400" />,
    accentColor: 'orange',
    keyTip: 'Use the tabs (Instruments, Microphones, DIs & Amps, Monitoring & PA) to find gear.',
  },
  {
    id: 'cables_patching',
    stepNumber: 3,
    title: 'Cables',
    tagline: 'Connect gear to DIs, amps and the snake',
    description:
      'Pick up an XLR or 1/4" cable here, then drag from a mic, DI or instrument to where it should go.',
    targetSelectors: ['#cable-hooks-panel'],
    directionHint: '',
    icon: <Cable className="w-5 h-5 text-blue-400" />,
    accentColor: 'blue',
    keyTip: 'XLR goes from mics and DIs into the snake. 1/4" goes from guitars and keys into amps or DIs.',
  },
  {
    id: 'snake_and_console',
    stepNumber: 4,
    title: 'Snake & Mixer',
    tagline: 'Where every input lands',
    description:
      'Everything you plug into the snake shows up on the mixer at the bottom. Set gain, faders and +48V there, and press Soundcheck to hear it. "Meter & Gear List" shows a live meter and everything you have placed.',
    targetSelectors: ['#stage-snake-box', '#mixer-console-container'],
    directionHint: '',
    icon: <Sliders className="w-5 h-5 text-purple-400" />,
    accentColor: 'purple',
  },
  {
    id: 'progress_and_rubric',
    stepNumber: 5,
    title: 'Progress & Checks',
    tagline: 'See what is working and what is missing',
    description:
      'The panel on the right checks your setup as you build. In the sandbox nothing is graded; in a task it shows your score. Red "!" badges on gear tell you exactly what each item still needs.',
    targetSelectors: ['#grading-rubric-collapsed-bar', '#grading-rubric-panel', '#grading-panel'],
    directionHint: '',
    icon: <Award className="w-5 h-5 text-emerald-400" />,
    accentColor: 'emerald',
  },
  {
    id: 'metadata_and_submit',
    stepNumber: 6,
    title: 'Share & Submit',
    tagline: 'Turn in your work',
    description:
      'When you are done, click Share & Submit, type your name, and copy your code into Google Classroom. You can also download a PDF of your plot.',
    targetSelectors: ['#btn-share-submit'],
    directionHint: '',
    icon: <Share2 className="w-5 h-5 text-amber-400" />,
    accentColor: 'amber',
  },
  {
    id: 'start',
    stepNumber: 7,
    title: 'Where do you want to start?',
    tagline: 'You can switch any time from the top bar',
    description: '',
    targetSelectors: [],
    directionHint: '',
    icon: <ArrowRight className="w-5 h-5 text-orange-400" />,
    accentColor: 'orange',
  },
];

interface GuidedTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  environment?: EnvironmentMode;
  /** Final step choices */
  onChooseRoom?: (env: EnvironmentMode) => void;
  onOpenLearn?: () => void;
  onOpenTasks?: () => void;
  /** Task opened from a teacher's assignment link (replaces the room choice) */
  assignedTaskTitle?: string | null;
}

export const GuidedTourModal: React.FC<GuidedTourModalProps> = ({
  isOpen,
  onClose,
  onChooseRoom,
  onOpenLearn,
  onOpenTasks,
  assignedTaskTitle,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Every time the How-To opens, start again from step 1.
  useEffect(() => {
    if (isOpen) setCurrentStepIndex(0);
  }, [isOpen]);
  const [targetRects, setTargetRects] = useState<DOMRect[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);

  const step = TOUR_STEPS[currentStepIndex];

  // Update bounding rects of all matching target elements for current step
  const updateTargetPositions = useCallback(() => {
    if (!isOpen) return;
    const currentStep = TOUR_STEPS[currentStepIndex];
    if (!currentStep) return;

    const rects: DOMRect[] = [];
    currentStep.targetSelectors.forEach((selector) => {
      const els = document.querySelectorAll(selector);
      els.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          rects.push(r);
        }
      });
    });

    setTargetRects(rects);
  }, [isOpen, currentStepIndex]);

  useEffect(() => {
    updateTargetPositions();
    const t = setTimeout(updateTargetPositions, 60);
    window.addEventListener('resize', updateTargetPositions);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', updateTargetPositions);
    };
  }, [updateTargetPositions, isOpen, currentStepIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (currentStepIndex < TOUR_STEPS.length - 1) {
          setCurrentStepIndex((prev) => prev + 1);
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentStepIndex > 0) {
          setCurrentStepIndex((prev) => prev - 1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex, onClose]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const accentColorClasses = {
    orange: {
      border: 'border-orange-500',
      badgeBg: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
      glow: 'shadow-[0_0_40px_rgba(249,115,22,0.4)]',
      dot: 'bg-orange-400',
      button: 'bg-orange-500 hover:bg-orange-400 text-stone-950 shadow-lg shadow-orange-950/60 font-bold',
      highlightBorder: 'border-orange-400 shadow-[0_0_24px_rgba(249,115,22,0.9)] ring-4 ring-orange-400/40',
      badgeLabel: 'border-orange-500 bg-orange-500 text-stone-950 font-black',
    },
    blue: {
      border: 'border-blue-500',
      badgeBg: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      glow: 'shadow-[0_0_40px_rgba(59,130,246,0.4)]',
      dot: 'bg-blue-400',
      button: 'bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-950/60 font-bold',
      highlightBorder: 'border-blue-400 shadow-[0_0_24px_rgba(59,130,246,0.9)] ring-4 ring-blue-400/40',
      badgeLabel: 'border-blue-500 bg-blue-500 text-white font-black',
    },
    purple: {
      border: 'border-purple-500',
      badgeBg: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
      glow: 'shadow-[0_0_40px_rgba(168,85,247,0.4)]',
      dot: 'bg-purple-400',
      button: 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-950/60 font-bold',
      highlightBorder: 'border-purple-400 shadow-[0_0_24px_rgba(168,85,247,0.9)] ring-4 ring-purple-400/40',
      badgeLabel: 'border-purple-500 bg-purple-500 text-white font-black',
    },
    emerald: {
      border: 'border-emerald-500',
      badgeBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
      glow: 'shadow-[0_0_40px_rgba(52,211,153,0.4)]',
      dot: 'bg-emerald-400',
      button: 'bg-emerald-500 hover:bg-emerald-400 text-stone-950 shadow-lg shadow-emerald-950/60 font-bold',
      highlightBorder: 'border-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.9)] ring-4 ring-emerald-400/40',
      badgeLabel: 'border-emerald-500 bg-emerald-500 text-stone-950 font-black',
    },
    amber: {
      border: 'border-amber-500',
      badgeBg: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
      glow: 'shadow-[0_0_40px_rgba(251,191,36,0.4)]',
      dot: 'bg-amber-400',
      button: 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-lg shadow-amber-950/60 font-bold',
      highlightBorder: 'border-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.9)] ring-4 ring-amber-400/40',
      badgeLabel: 'border-amber-500 bg-amber-500 text-stone-950 font-black',
    },
  }[step.accentColor];

  // Dynamic positioning for tour card (never obscuring the highlighted targets)
  const getCardStyle = (): React.CSSProperties => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) {
      return {
        position: 'fixed',
        bottom: '16px',
        left: '16px',
        right: '16px',
        maxWidth: 'calc(100vw - 32px)',
        zIndex: 60,
      };
    }

    if (step.id === 'gear_locker') {
      const primaryRect = targetRects[0];
      return {
        position: 'fixed',
        top: '100px',
        left: primaryRect ? `${Math.min(primaryRect.right + 24, window.innerWidth - 460)}px` : '340px',
        maxWidth: '430px',
        zIndex: 60,
      };
    }

    if (step.id === 'cables_patching') {
      const primaryRect = targetRects[0];
      return {
        position: 'fixed',
        top: primaryRect ? `${Math.max(76, primaryRect.top + 8)}px` : '100px',
        left: primaryRect ? `${Math.min(primaryRect.right + 24, window.innerWidth - 460)}px` : '340px',
        maxWidth: '430px',
        zIndex: 60,
      };
    }

    if (step.id === 'snake_and_console') {
      const snakeRect = targetRects[0];
      return {
        position: 'fixed',
        top: snakeRect ? `${snakeRect.bottom + 20}px` : '220px',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '490px',
        zIndex: 60,
      };
    }

    if (step.id === 'progress_and_rubric') {
      const primaryRect = targetRects[0];
      return {
        position: 'fixed',
        top: '100px',
        right: primaryRect ? `${Math.min(window.innerWidth - primaryRect.left + 24, window.innerWidth - 460)}px` : '340px',
        maxWidth: '430px',
        zIndex: 60,
      };
    }

    if (step.id === 'metadata_and_submit') {
      return {
        position: 'fixed',
        top: '76px',
        right: '24px',
        maxWidth: '440px',
        zIndex: 60,
      };
    }

    return {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      maxWidth: '460px',
      zIndex: 60,
    };
  };

  return (
    <div
      id="guided-tour-overlay"
      className="fixed inset-0 z-50 pointer-events-auto select-none"
      onClick={onClose}
    >
      {/* Subtle translucent scrim with a light 0.5px blur allowing elements underneath to remain easily identifiable */}
      <div
        className="absolute inset-0 bg-black/25 pointer-events-none transition-opacity duration-300 backdrop-blur-[0.5px]"
      />

      {/* Target Element Spotlight Frames (Highlighting all target items like Snake + Console) */}
      {targetRects.map((rect, idx) => (
        <div
          key={`${step.id}-target-${idx}`}
          className={`absolute rounded-2xl border-2 pointer-events-none transition-all duration-300 ${accentColorClasses.highlightBorder} animate-pulse`}
          style={{
            top: `${Math.max(2, rect.top - 4)}px`,
            left: `${Math.max(2, rect.left - 4)}px`,
            width: `${rect.width + 8}px`,
            height: `${rect.height + 8}px`,
            boxShadow: '0 0 0 2px rgba(255,255,255,0.4), 0 0 35px rgba(0,0,0,0.5)',
          }}
        >
          {/* Dynamic Floating Label Tag on highlighted elements */}
          {step.id === 'snake_and_console' && (
            <div
              className={`absolute -top-3.5 left-4 px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider shadow-lg border border-white/20 ${accentColorClasses.badgeLabel}`}
            >
              {idx === 0 ? 'Stage Snake Inputs 1–8' : 'Mixing Console / Soundcheck'}
            </div>
          )}
        </div>
      ))}

      {/* Floating Tour Card */}
      <div
        ref={cardRef}
        id="guided-tour-card"
        style={getCardStyle()}
        onClick={(e) => e.stopPropagation()}
        className={`bg-stone-950 text-stone-100 border-2 ${accentColorClasses.border} rounded-3xl p-5 sm:p-6 shadow-2xl ${accentColorClasses.glow} transition-all duration-300 animate-in fade-in zoom-in-95`}
      >
        {/* Top Bar with Step counter & Close/Skip button */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800 mb-3.5">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wider uppercase border ${accentColorClasses.badgeBg}`}
            >
              <Sparkles className="w-3 h-3" />
              <span>{step.id === 'welcome' ? 'Quick tour' : step.id === 'start' ? 'Ready' : `Step ${currentStepIndex} of ${TOUR_STEPS.length - 2}`}</span>
            </span>
          </div>

          <button
            id="btn-tour-skip"
            onClick={onClose}
            className="flex items-center gap-1 text-[11px] font-semibold text-stone-400 hover:text-stone-100 px-2.5 py-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer border border-stone-700 bg-stone-900"
            title="Skip interactive tour"
          >
            <span>{step.id === 'start' ? 'Close' : 'Skip'}</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Header Content */}
        <div className="flex items-start gap-3.5 mb-3">
          {step.id === 'welcome' ? (
            <AppLogo size="lg" />
          ) : (
            <div className={`p-2.5 rounded-2xl border ${accentColorClasses.badgeBg} shrink-0 bg-stone-900`}>
              {step.icon}
            </div>
          )}
          <div>
            <h3 className="text-base sm:text-lg font-black text-stone-100 tracking-tight leading-tight">
              {step.title}
            </h3>
            <p className="text-xs font-semibold text-stone-400 mt-0.5">
              {step.tagline}
            </p>
          </div>
        </div>

        {/* Description Body */}
        {step.id === 'start' ? (
          assignedTaskTitle ? (
            <div className="mb-4 space-y-2">
              <button
                onClick={onClose}
                className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-sm transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Trophy className="w-4 h-4" /> Start your task: {assignedTaskTitle}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onOpenLearn}
                className="w-full flex items-center gap-2 p-3 rounded-2xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 text-xs font-bold transition-colors cursor-pointer"
              >
                <GraduationCap className="w-4 h-4 text-orange-400" /> Learn the basics first
              </button>
            </div>
          ) : (
            <div className="mb-4 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { key: 'studio', label: 'Studio', sub: 'Recording session', Icon: Headphones, cls: 'hover:border-orange-400 text-orange-300' },
                    { key: 'stage', label: 'Live Stage', sub: 'Concert setup', Icon: Radio, cls: 'hover:border-purple-400 text-purple-300' },
                    { key: 'learn', label: 'Learn', sub: 'The basics first', Icon: GraduationCap, cls: 'hover:border-emerald-400 text-emerald-300' },
                  ] as const
                ).map(({ key, label, sub, Icon, cls }) => (
                  <button
                    key={key}
                    onClick={() =>
                      key === 'learn' ? onOpenLearn?.() : onChooseRoom?.(key === 'studio' ? 'recording_studio' : 'live_stage')
                    }
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-stone-900 border border-stone-700 transition-colors cursor-pointer ${cls}`}
                  >
                    <Icon className="w-6 h-6" />
                    <span className="text-xs font-black text-stone-100">{label}</span>
                    <span className="text-[10px] text-stone-400">{sub}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={onOpenTasks}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-stone-400 hover:text-amber-300 transition-colors cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-400" /> I have a task from my teacher
              </button>
            </div>
          )
        ) : (
          <p className="text-xs sm:text-[13px] text-stone-200 leading-relaxed mb-4 bg-stone-900/80 p-3.5 rounded-2xl border border-stone-800">
            {step.description}
            {step.keyTip && <span className="block mt-2 text-stone-400">{step.keyTip}</span>}
          </p>
        )}

        {/* Footer Navigation Controls & Dots */}
        <div className="flex items-center justify-between pt-2.5 border-t border-stone-800 mt-1">
          {/* Step Progress Dots */}
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setCurrentStepIndex(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === currentStepIndex
                    ? `w-6 ${accentColorClasses.dot}`
                    : 'w-2 bg-stone-700 hover:bg-stone-500'
                }`}
                title={`Jump to ${s.title}`}
              />
            ))}
          </div>

          {/* Action Buttons (Back & Next / Finish) */}
          <div className="flex items-center gap-2">
            {currentStepIndex > 0 && (
              <button
                id="btn-tour-prev"
                onClick={handlePrev}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 hover:text-white border border-stone-700 text-xs font-bold transition-all cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            {step.id !== 'start' && (
            <button
              id="btn-tour-next"
              onClick={handleNext}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-black text-xs shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${accentColorClasses.button}`}
            >
              <span>{step.id === 'welcome' ? 'Show me around' : 'Next'}</span>
              <ChevronRight className="w-3.5 h-3.5 stroke-[3]" />
            </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
