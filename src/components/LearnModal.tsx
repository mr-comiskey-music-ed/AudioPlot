import React, { useEffect, useState } from 'react';
import {
  GraduationCap,
  X,
  ChevronLeft,
  ChevronRight,
  Mic,
  Zap,
  Cable,
  Ear,
  ListChecks,
  Trophy,
  Lightbulb,
  MousePointerClick,
} from 'lucide-react';
import { EnvironmentMode } from '../types';

interface LearnModalProps {
  isOpen: boolean;
  onClose: () => void;
  environment: EnvironmentMode;
  onOpenTasks: () => void;
}

/*
 * Learn teaches the four questions behind EVERY setup, instead of a guide for
 * each possible band. Students who can answer these can plot anything, and the
 * app's red "!" warnings point back to the same four questions.
 */

interface Row {
  if: string;
  then: string;
  why: string;
}

interface Step {
  key: string;
  icon: React.ElementType;
  color: string;
  question: string;
  short: string;
  intro: string;
  rows?: Row[];
  bullets?: string[];
  inApp: string;
}

const steps = (env: EnvironmentMode): Step[] => [
  {
    key: 'source',
    icon: Mic,
    color: 'text-orange-400',
    question: 'What is the source?',
    short: 'Source',
    intro:
      'Start with the sound, not the gear. Ask: is it loud or quiet? Acoustic, or does it have an output jack? The answer picks the tool.',
    rows: [
      { if: 'It has an output jack (bass, keys, acoustic-electric)', then: 'DI box', why: 'Takes the instrument signal straight in, no mic needed.' },
      { if: 'It is loud or close-up (drums, amps, brass, live vocals)', then: 'Dynamic mic (SM57, SM58, e604)', why: 'Tough, handles high volume, rejects sound from the side.' },
      { if: 'It is a kick drum or bass amp', then: 'Large dynamic (Beta 52A)', why: 'Built to capture low frequencies.' },
      { if: 'It is quiet or detailed (studio vocals, acoustic guitar, piano, strings)', then: 'Large-diaphragm condenser (C214, AT2035)', why: 'More sensitive: catches detail and air.' },
      { if: 'It is bright and fast (cymbals, hi-hats, acoustic guitar)', then: 'Small-diaphragm condenser (SM81, ADX51)', why: 'Accurate on fast, high-frequency sounds.' },
    ],
    inApp: 'Click a mic and choose its Source (the instrument it is aimed at). Once assigned, the mic shrinks to a small tag beside its source to save space.',
  },
  {
    key: 'needs',
    icon: Zap,
    color: 'text-rose-400',
    question: 'What does that gear need?',
    short: 'Needs',
    intro: 'Every choice from step 1 brings its own requirements. Missing one is the most common reason a channel stays silent.',
    rows: [
      { if: 'Condenser mic', then: 'Turn on +48V phantom power on its channel', why: 'Condensers need power to work. Dynamics do not.' },
      { if: 'DI box', then: '1/4" cable from the instrument in, XLR from the DI out', why: 'The DI turns the instrument signal into a mic-level XLR signal.' },
      { if: 'Any mic', then: 'The right stand height', why: 'Low for amps and kick, seated, standing vocal, or overhead boom for cymbals.' },
      ...(env === 'recording_studio'
        ? [{ if: 'Studio vocal on a condenser', then: 'Pop filter (and a shockmount)', why: 'The pop filter stops "P" and "B" blasts; the shockmount blocks floor rumble.' }]
        : [{ if: 'Live vocal', then: 'Keep it upstage of (behind) the PA', why: 'A mic in front of a speaker causes feedback.' }]),
    ],
    inApp: 'Click a mic to set its stand height, pop filter and +48V. A red "!" on any gear lists exactly what it is still missing.',
  },
  {
    key: 'inputs',
    icon: Cable,
    color: 'text-sky-400',
    question: 'How many inputs, and where does each one go?',
    short: 'Inputs',
    intro: 'Count before you cable. Every mic and every DI is one input, and each input needs its own channel.',
    bullets: [
      'One mic or DI = one channel. A stereo pair (like drum overheads) = two channels.',
      'Signal flow: source → mic/DI → XLR cable → snake input → mixer channel.',
      'Two cable types: 1/4" (blue) carries an instrument signal a short way to an amp or DI. XLR (orange) is balanced, so it rejects noise over long runs and carries phantom power. Only XLR goes into the snake.',
      'The snake has 8 inputs. If you need more than 8, rethink: which sources can share, and which matter most?',
      'Patch in a sensible order, for example drums, bass, guitars, keys, then vocals. Engineers call this the input list.',
    ],
    inApp: 'Pick up the XLR cable (top left), click the mic or DI, then click a snake input. Select anything to see its full signal path light up.',
  },
  {
    key: 'hear',
    icon: Ear,
    color: 'text-emerald-400',
    question: 'Who needs to hear what?',
    short: 'Monitoring',
    intro:
      env === 'recording_studio'
        ? 'In the studio the musicians are in a separate room from the speakers. They hear the session through headphones.'
        : 'On stage there are two audiences: the crowd, and the band itself. Each needs its own speakers.',
    rows:
      env === 'recording_studio'
        ? [
            { if: 'Every musician who plays', then: 'Studio headphones assigned to them', why: 'Headphones let them hear the mix without the sound leaking into the mics.' },
          ]
        : [
            { if: 'The audience', then: 'Two PA speakers in the PA zones at the front corners → MAIN L and MAIN R', why: 'Left and right on the audience side, ahead of the band.' },
            { if: 'A performer (wedge)', then: 'Stage monitor in front of them, facing them → MON 1 or MON 2', why: 'They hear themselves without turning up the PA.' },
            { if: 'A performer (in-ear)', then: 'IEM transmitter on MON 1/2 + a bodypack assigned to them', why: 'A wireless system needs both halves.' },
          ],
    inApp:
      env === 'recording_studio'
        ? 'Place headphones, click them, and choose the Performer they belong to.'
        : 'The dashed PA zones on the stage floor turn green when a PA speaker is in place. Cable PAs and monitors from the snake outputs with XLR.',
  },
];

const examples: Record<EnvironmentMode, { title: string; lines: string[][] }> = {
  recording_studio: {
    title: 'Worked example: singer-songwriter in the studio',
    lines: [
      ['Vocal', 'quiet, detailed', 'Large condenser', '+48V, pop filter, standing stand', 'CH 1'],
      ['Acoustic guitar', 'quiet, bright', 'Small condenser at the 12th fret', '+48V, seated stand', 'CH 2'],
      ['Monitoring', 'the performer', 'Studio headphones', 'assigned to the performer', '—'],
    ],
  },
  live_stage: {
    title: 'Worked example: singer-songwriter on a live stage',
    lines: [
      ['Vocal', 'live, loud stage', 'Dynamic (SM58)', 'standing stand, upstage of the PA', 'CH 1'],
      ['Acoustic guitar', 'has an output jack', 'DI box', '1/4" in, XLR out', 'CH 2'],
      ['Audience', 'the crowd', 'PA speakers L + R', 'in the PA zones', 'MAIN L/R'],
      ['Performer', 'hear themselves', 'Stage monitor', 'in front, facing them', 'MON 1'],
    ],
  },
};

export const LearnModal: React.FC<LearnModalProps> = ({ isOpen, onClose, environment, onOpenTasks }) => {
  const [index, setIndex] = useState(0);
  const [exampleEnv, setExampleEnv] = useState<EnvironmentMode>(environment);

  useEffect(() => {
    if (isOpen) setExampleEnv(environment);
  }, [isOpen, environment]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, 4));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const list = steps(environment);
  const total = list.length + 1; // + worked example
  const isExample = index === list.length;
  const step = isExample ? null : list[index];
  const example = examples[exampleEnv];

  return (
    <div
      id="learn-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      <div
        className="bg-stone-900/95 border border-white/15 rounded-3xl max-w-3xl w-full p-6 text-stone-100 shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/20 border border-orange-500/30 text-orange-400 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-stone-100">Learn: Four Questions for Any Setup</h3>
              <p className="text-xs text-stone-400">
                Every studio session and every stage, from a solo singer to a full band, comes down to the same four questions.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white border border-white/10 transition-all shrink-0"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step tabs */}
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {list.map((s, i) => {
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                onClick={() => setIndex(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  index === i
                    ? 'bg-orange-500 text-stone-950'
                    : 'bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white border border-white/10'
                }`}
              >
                <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center ${index === i ? 'bg-stone-950/20' : 'bg-white/10'}`}>
                  {i + 1}
                </span>
                <Icon className="w-3.5 h-3.5" />
                <span>{s.short}</span>
              </button>
            );
          })}
          <button
            onClick={() => setIndex(list.length)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              isExample
                ? 'bg-amber-400 text-stone-950'
                : 'bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white border border-white/10'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" />
            <span>Put it together</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto pr-1 text-sm">
          {step && (
            <div className="space-y-3">
              <h4 className="text-xl font-black text-stone-100 flex items-center gap-2">
                <step.icon className={`w-5 h-5 ${step.color}`} />
                {index + 1}. {step.question}
              </h4>
              <p className="text-stone-300 text-[13px] leading-relaxed">{step.intro}</p>

              {step.rows && (
                <div className="rounded-2xl border border-white/10 overflow-hidden">
                  <div className="grid grid-cols-[1.2fr_1fr_1.2fr] text-[10px] font-black uppercase tracking-wider text-stone-400 bg-white/5 px-3 py-2 gap-3">
                    <span>If...</span>
                    <span>Then...</span>
                    <span>Because...</span>
                  </div>
                  {step.rows.map((r, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[1.2fr_1fr_1.2fr] gap-3 px-3 py-2.5 text-[12px] border-t border-white/5 leading-snug"
                    >
                      <span className="text-stone-300">{r.if}</span>
                      <span className="font-bold text-orange-300">{r.then}</span>
                      <span className="text-stone-400">{r.why}</span>
                    </div>
                  ))}
                </div>
              )}

              {step.bullets && (
                <ul className="space-y-2">
                  {step.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2.5 text-[13px] text-stone-300 leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-2 shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-orange-500/10 border border-orange-500/25 text-[12px] text-orange-100/90 leading-relaxed">
                <MousePointerClick className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-orange-300">In AudioPlot:</strong> {step.inApp}
                </span>
              </div>
            </div>
          )}

          {isExample && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h4 className="text-xl font-black text-stone-100">{example.title}</h4>
                <div className="flex items-center p-0.5 bg-black/40 rounded-full border border-white/10 text-[11px]">
                  {(['recording_studio', 'live_stage'] as EnvironmentMode[]).map((e) => (
                    <button
                      key={e}
                      onClick={() => setExampleEnv(e)}
                      className={`px-3 py-1 rounded-full font-bold cursor-pointer ${
                        exampleEnv === e ? 'bg-orange-500 text-stone-950' : 'text-stone-400 hover:text-white'
                      }`}
                    >
                      {e === 'recording_studio' ? 'Studio' : 'Live'}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[13px] text-stone-300 leading-relaxed">
                Same performer, two rooms, different answers. Walk each source through the four questions:
              </p>
              <div className="rounded-2xl border border-white/10 overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_1.2fr_1.4fr_0.6fr] text-[10px] font-black uppercase tracking-wider text-stone-400 bg-white/5 px-3 py-2 gap-2">
                  <span>Source</span>
                  <span>1. What is it?</span>
                  <span>Tool</span>
                  <span>2. Needs</span>
                  <span>3. Goes to</span>
                </div>
                {example.lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1.2fr_1.4fr_0.6fr] gap-2 px-3 py-2.5 text-[12px] border-t border-white/5 leading-snug">
                    <span className="font-bold text-stone-100">{l[0]}</span>
                    <span className="text-stone-400">{l[1]}</span>
                    <span className="font-bold text-orange-300">{l[2]}</span>
                    <span className="text-stone-300">{l[3]}</span>
                    <span className="font-mono font-bold text-sky-300">{l[4]}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-[12px] text-amber-100/90 leading-relaxed">
                <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Notice what changed between rooms: the vocal mic (condenser in the quiet studio, dynamic on a loud stage), the
                  guitar (mic vs. DI), and how people hear (headphones vs. PA and monitors). The questions stayed the same.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenTasks}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/5 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Try a task</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-stone-500 tabular-nums">
              {index + 1} / {total}
            </span>
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {index < total - 1 ? (
              <button
                onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
                className="flex items-center gap-1 px-4 py-2 rounded-full bg-orange-500 hover:bg-orange-400 text-stone-950 text-xs font-black transition-all cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-full bg-orange-500 hover:bg-orange-400 text-stone-950 text-xs font-black transition-all cursor-pointer"
              >
                Back to the plot
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
