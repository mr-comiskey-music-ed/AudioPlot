import React, { useState } from 'react';
import {
  BookOpen,
  Mic,
  Sparkles,
  Zap,
  Sliders,
  Shield,
  Volume2,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';

interface MicPlacementGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MicPlacementGuideModal: React.FC<MicPlacementGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'mics' | 'stands' | 'live_vs_studio' | 'cables'>('mics');

  if (!isOpen) return null;

  return (
    <div
      id="mic-guide-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200 select-none"
    >
      <div
        id="mic-guide-modal-card"
        className="bg-black/60 backdrop-blur-2xl border border-white/15 rounded-3xl max-w-3xl w-full p-6 text-stone-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/20 border border-orange-500/30 text-orange-400 flex items-center justify-center shadow-inner backdrop-blur-md">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-stone-100">
                Microphone Placement & Audio Physics Field Guide
              </h3>
              <p className="text-xs text-stone-400">
                Quick Engineering Reference for Studio Recording & Live Sound Setup
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white border border-white/10 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-white/10 pb-3 mb-4 flex-wrap">
          <button
            onClick={() => setActiveTab('mics')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeTab === 'mics'
                ? 'bg-orange-500 text-stone-950 font-black shadow-lg shadow-orange-950/40'
                : 'bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white border border-white/10 backdrop-blur-md'
            }`}
          >
            Microphone Types & Transducers
          </button>
          <button
            onClick={() => setActiveTab('stands')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeTab === 'stands'
                ? 'bg-orange-500 text-stone-950 font-black shadow-lg shadow-orange-950/40'
                : 'bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white border border-white/10 backdrop-blur-md'
            }`}
          >
            Mic Stand Heights & Pop Filters
          </button>
          <button
            onClick={() => setActiveTab('live_vs_studio')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeTab === 'live_vs_studio'
                ? 'bg-orange-500 text-stone-950 font-black shadow-lg shadow-orange-950/40'
                : 'bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white border border-white/10 backdrop-blur-md'
            }`}
          >
            Studio vs. Live Stage Rules
          </button>
          <button
            onClick={() => setActiveTab('cables')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeTab === 'cables'
                ? 'bg-orange-500 text-stone-950 font-black shadow-lg shadow-orange-950/40'
                : 'bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white border border-white/10 backdrop-blur-md'
            }`}
          >
            Signal Flow & DI Boxes
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs text-stone-300">
          {activeTab === 'mics' && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                {/* Dynamic Mics */}
                <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl space-y-1.5 backdrop-blur-md">
                  <div className="flex items-center gap-2 text-orange-400 font-bold">
                    <Mic className="w-4 h-4" />
                    <span>Dynamic Microphones (SM58, SM57, Beta 52A)</span>
                  </div>
                  <p className="text-[11px] text-stone-400 leading-relaxed">
                    Uses electromagnetic induction (moving coil in a magnetic field). Rugged, handles high Sound Pressure Levels (SPL &gt; 150dB), and requires <strong>NO +48V phantom power</strong>.
                  </p>
                  <div className="text-[10px] text-emerald-400 font-medium">
                    Best on: Guitar Amps (SM57), Kick Drums (Beta 52A), Live Vocals (SM58), Snare Drums & Loud Brass.
                  </div>
                </div>

                {/* Large Diaphragm Condensers */}
                <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl space-y-1.5 backdrop-blur-md">
                  <div className="flex items-center gap-2 text-blue-400 font-bold">
                    <Sparkles className="w-4 h-4" />
                    <span>Large Diaphragm Condensers (AKG C214, AT2020)</span>
                  </div>
                  <p className="text-[11px] text-stone-400 leading-relaxed">
                    Uses an electrostatic charged capacitor capsule. Highly sensitive, wide frequency response, and captures subtle air and harmonic warmth. <strong>REQUIRES +48V PHANTOM POWER</strong>.
                  </p>
                  <div className="text-[10px] text-emerald-400 font-medium">
                    Best on: Studio Lead Vocals, Acoustic Grand Piano, Acoustic Guitar, Voiceovers.
                  </div>
                </div>

                {/* Small Diaphragm Condensers */}
                <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl space-y-1.5 backdrop-blur-md">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold">
                    <Sliders className="w-4 h-4" />
                    <span>Small Diaphragm Condensers / Pencil Mics (SM81, ADX51)</span>
                  </div>
                  <p className="text-[11px] text-stone-400 leading-relaxed">
                    Fast transient response with uncolored, flat frequency reproduction. <strong>REQUIRES +48V PHANTOM POWER</strong>.
                  </p>
                  <div className="text-[10px] text-emerald-400 font-medium">
                    Best on: Drum Overheads, Cymbals, Hi-Hats, Acoustic Violins & Classical Guitars.
                  </div>
                </div>

                {/* DI Boxes */}
                <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl space-y-1.5 backdrop-blur-md">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <Zap className="w-4 h-4" />
                    <span>Direct Injection (DI) Boxes</span>
                  </div>
                  <p className="text-[11px] text-stone-400 leading-relaxed">
                    Matches impedance: converts high-Z unbalanced 1/4&quot; instrument cables to balanced low-Z XLR lines without loss of tone or high-frequency degradation.
                  </p>
                  <div className="text-[10px] text-emerald-400 font-medium">
                    Best on: Electric Bass Guitar, Electronic Keyboards, Synthesizers, Acoustic-Electric Pickups.
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'stands' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl space-y-2 backdrop-blur-md">
                <h4 className="font-bold text-orange-400 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4" />
                  Mic Stand Height Guidelines
                </h4>
                <div className="grid sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-black/30 p-2.5 rounded-xl border border-white/10">
                    <strong className="text-stone-200">Floor / Amp Low:</strong> Positioned 1–3 inches from speaker grill cloth or inside the kick drum port hole. Used for: Guitar amp cab, Bass cab, Kick drum.
                  </div>
                  <div className="bg-black/30 p-2.5 rounded-xl border border-white/10">
                    <strong className="text-stone-200">Seated Instrument:</strong> Positioned ~12 inches away aiming at 12th fret. Used for: Seated acoustic guitar, Cello, Upright bass.
                  </div>
                  <div className="bg-black/30 p-2.5 rounded-xl border border-white/10">
                    <strong className="text-stone-200">Standing Vocal:</strong> Mouth level (5–6 feet tall). Used for: Lead singer, Standing saxophone, Trumpet bell.
                  </div>
                  <div className="bg-black/30 p-2.5 rounded-xl border border-white/10">
                    <strong className="text-stone-200">Drum Overhead / Tall Boom:</strong> 3–4 feet above cymbal kit pointing down in spaced pair (A/B) or XY configuration.
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-1.5 backdrop-blur-md">
                <h4 className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  Why Pop Filters & Shockmounts are Essential in Studio
                </h4>
                <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                  Fast blasts of air from plosive consonants (&quot;P&quot;, &quot;B&quot;, &quot;T&quot;) hit delicate condenser diaphragms, causing severe low-end clipping. A mesh pop filter diffuses air turbulence while passing high frequencies smoothly. Elastic shockmounts eliminate floor footstep rumbles.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'live_vs_studio' && (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-white/5 border border-orange-500/30 rounded-2xl space-y-2 backdrop-blur-md">
                  <h4 className="font-bold text-orange-400">Digital Recording Studio Mode</h4>
                  <ul className="space-y-1.5 text-[11px] list-disc pl-4 text-stone-300">
                    <li>Goal: Maximum fidelity, nuance, and dynamic capture.</li>
                    <li>Large diaphragm condensers (AKG C214, AT2020) are celebrated for lead vocals.</li>
                    <li>Acoustic panels & Persian rugs absorb wall/floor flutter reflections.</li>
                    <li>Pop filters required on studio condenser vocal lines.</li>
                  </ul>
                </div>

                <div className="p-3.5 bg-white/5 border border-blue-500/30 rounded-2xl space-y-2 backdrop-blur-md">
                  <h4 className="font-bold text-blue-400">Live Stage & Club Concert Mode</h4>
                  <ul className="space-y-1.5 text-[11px] list-disc pl-4 text-stone-300">
                    <li>Goal: High sound reinforcement, high SPL tolerance, and acoustic feedback rejection.</li>
                    <li>Shure SM58 dynamic mics are preferred on vocals to reject loud stage monitor bleed.</li>
                    <li>Stage monitor foldback wedges or In-Ear Monitors (IEMs) needed so performers hear themselves.</li>
                    <li>Front-of-House Main PA speakers project sound to audience.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cables' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl space-y-2 backdrop-blur-md">
                <h4 className="font-bold text-blue-400">Audio Cables & Signal Chains</h4>
                <div className="space-y-2 text-[11px]">
                  <div className="p-2.5 bg-black/30 rounded-xl border border-white/10">
                    <strong className="text-blue-300">1/4&quot; TS Instrument Cable (Blue):</strong> Carries high-impedance unbalanced analog instrument signals from Electric Guitars, Basses, and Keyboards into Amps or DI boxes. Maximum clean run ~15-20ft before treble loss.
                  </div>
                  <div className="p-2.5 bg-black/30 rounded-xl border border-white/10">
                    <strong className="text-orange-300">XLR Balanced Mic Cable (Orange):</strong> 3-pin balanced cable with ground shielding. Rejects EMI/RFI noise over long runs (up to 300ft) and carries +48V phantom power safely to condenser mics.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-orange-500 hover:bg-orange-400 text-stone-950 text-xs font-black shadow-lg shadow-orange-950/40 transition-all"
          >
            Got it, Back to Plot
          </button>
        </div>
      </div>
    </div>
  );
};
