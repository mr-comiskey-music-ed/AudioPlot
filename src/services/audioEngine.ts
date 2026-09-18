import * as Tone from 'tone';
import { PlacedGear, MixerChannelState, CableConnection, EnvironmentMode, MasterBusState } from '../types';
import { validateChannelSignalChain } from './gradingEngine';

// Direct ES module imports of all compressed soundcheck MP3 stems
import acousticGuitarAudio from '../assets/soundcheck/Acoustic Guitar.mp3';
import acousticPianoAudio from '../assets/soundcheck/Acoustic Piano.mp3';
import bassGuitarAudio from '../assets/soundcheck/Bass Guitar.mp3';
import celloAudio from '../assets/soundcheck/Cello.mp3';
import choirAudio from '../assets/soundcheck/Choir.mp3';
import cymbalsOverheadsAudio from '../assets/soundcheck/Cymbals_Overheads.mp3';
import doubleBassAudio from '../assets/soundcheck/Double Bass.mp3';
import electricGuitarAudio from '../assets/soundcheck/Electric Guitar.mp3';
import fluteAudio from '../assets/soundcheck/Flute.mp3';
import keyboardAudio from '../assets/soundcheck/Keyboard.mp3';
import kickDrumAudio from '../assets/soundcheck/Kick Drum.mp3';
import saxophoneAudio from '../assets/soundcheck/Saxophone.mp3';
import snareDrumAudio from '../assets/soundcheck/Snare Drum.mp3';
import tomDrumAudio from '../assets/soundcheck/Tom Drum.mp3';
import trumpetAudio from '../assets/soundcheck/Trumpet.mp3';
import violinAudio from '../assets/soundcheck/Violin.mp3';
import voiceAudio from '../assets/soundcheck/Voice.mp3';

/**
 * Mapping of all 17 studio and stage instrument sources to their corresponding
 * compressed soundcheck MP3 stems.
 */
export const INSTRUMENT_AUDIO_FILES: Record<string, string> = {
  inst_voice: voiceAudio,
  inst_acoustic_guitar: acousticGuitarAudio,
  inst_electric_guitar: electricGuitarAudio,
  inst_acoustic_piano: acousticPianoAudio,
  inst_keyboard: keyboardAudio,
  inst_bass_guitar: bassGuitarAudio,
  inst_kick_drum: kickDrumAudio,
  inst_snare_drum: snareDrumAudio,
  inst_tom_drum: tomDrumAudio,
  inst_hi_hat: cymbalsOverheadsAudio,
  inst_drum_cymbals: cymbalsOverheadsAudio,
  inst_violin: violinAudio,
  inst_cello: celloAudio,
  inst_double_bass: doubleBassAudio,
  inst_trumpet: trumpetAudio,
  inst_saxophone: saxophoneAudio,
  inst_flute: fluteAudio,
  inst_choir: choirAudio,
};

interface ActiveTrackNode {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  analyserNode: AnalyserNode;
  pannerNode: StereoPannerNode | null;
}

// 4-bar musical loop duration at 90 BPM (511,998 samples at 48kHz = 10.666625 seconds)
export const LOOP_DURATION_SECONDS = 511998 / 48000;

class StudioAudioEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private timer: number | null = null;
  private startTime = 0;
  private masterGainNode: GainNode | null = null;
  private masterBalanceNode: StereoPannerNode | null = null;
  private masterAnalyserNode: AnalyserNode | null = null;
  private masterSplitterNode: ChannelSplitterNode | null = null;
  private masterLeftAnalyser: AnalyserNode | null = null;
  private masterRightAnalyser: AnalyserNode | null = null;
  
  // Tone.ToneAudioBuffers and decoded AudioBuffers cached in memory
  private toneAudioBuffers: Tone.ToneAudioBuffers | null = null;
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private loadPromise: Promise<void> | null = null;
  
  // Active playing source & routing nodes
  private activeTracks: Map<string, ActiveTrackNode> = new Map();

  private masterBusState: MasterBusState = {
    fader: 75,
    gain: 50,
    pan: 0,
    muted: false,
    dim: false,
    mono: false,
  };

  private stateProvider: (() => {
    placedGear: PlacedGear[];
    mixerChannels: MixerChannelState[];
    connections: CableConnection[];
    environment?: EnvironmentMode;
    masterBus?: MasterBusState;
  }) | null = null;

  public async init() {
    try {
      await Tone.start();
    } catch {
      // Ignore user gesture restrictions on early init
    }
    const rawContext = Tone.getContext().rawContext as AudioContext;
    this.ctx = rawContext;
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        // Handled on first user click
      }
    }
    // Eagerly preload all audio tracks
    this.preloadAllAudio();
  }

  public setMasterBusState(updates: Partial<MasterBusState>) {
    this.masterBusState = { ...this.masterBusState, ...updates };
    this.applyMasterGainDirectly();
  }

  public getMasterBusState(): MasterBusState {
    return { ...this.masterBusState };
  }

  private applyMasterGainDirectly() {
    if (!this.ctx || !this.masterGainNode) return;
    const now = Tone.now();
    const master = this.masterBusState;

    if (master.muted || master.fader <= 2) {
      this.masterGainNode.gain.setTargetAtTime(0, now, 0.015);
    } else {
      // Fader curve: 75 = Unity (1.0), 100 = +6 dB (2.0), 0 = -∞ (0.0)
      const faderRatio = master.fader / 75;
      const faderGain = Math.min(2.5, Math.pow(faderRatio, 1.6));

      // Master Preamp Trim: 50 = Unity 1.0, 100 = 2.5x saturation, 0 = 0.0x (-24 dB)
      const rawTrim = master.gain !== undefined ? master.gain : 50;
      const trimRatio = rawTrim <= 50 ? rawTrim / 50 : 1 + ((rawTrim - 50) / 50) * 1.5;

      // Dim: -20 dB attenuation (0.1x voltage)
      const dimFactor = master.dim ? 0.1 : 1.0;

      const targetGain = Math.min(3.0, faderGain * trimRatio * dimFactor * 0.9);
      this.masterGainNode.gain.setTargetAtTime(targetGain, now, 0.015);
    }

    if (this.masterBalanceNode) {
      const targetPan = Math.max(-1, Math.min(1, (master.pan || 0) / 50));
      this.masterBalanceNode.pan.setTargetAtTime(targetPan, now, 0.015);
    }
  }

  /**
   * Trims MP3 encoder delay (~47ms / 2257 samples at 48kHz) and trailing container padding
   * to produce an exact, gapless, sample-accurate loop matching the musical 4-bar measure (10.666625s at 90 BPM).
   * Also applies a micro 2.5ms Hann taper at both loop boundaries to eliminate clicks and pops.
   */
  private prepareSeamlessBuffer(rawBuffer: AudioBuffer): AudioBuffer {
    // If already trimmed or not an elongated MP3 buffer, return as is
    if (rawBuffer.duration < 10.70) {
      return rawBuffer;
    }

    const ctx = this.ctx || (Tone.getContext().rawContext as AudioContext);
    if (!ctx) return rawBuffer;

    const sampleRate = rawBuffer.sampleRate;
    // 2257 samples at 48kHz is standard LAME MP3 encoder delay (~0.04702s)
    const delaySamples = Math.round((2257 / 48000) * sampleRate);
    // 511998 samples at 48kHz is the exact 10.666625s 4-bar loop (16 beats at 90 BPM)
    const targetSamples = Math.min(
      rawBuffer.length - delaySamples,
      Math.round((511998 / 48000) * sampleRate)
    );

    if (targetSamples <= 0) return rawBuffer;

    const seamlessBuffer = ctx.createBuffer(
      rawBuffer.numberOfChannels,
      targetSamples,
      sampleRate
    );

    const fadeLen = Math.min(Math.round(0.0025 * sampleRate), Math.floor(targetSamples / 20));

    for (let c = 0; c < rawBuffer.numberOfChannels; c++) {
      const src = rawBuffer.getChannelData(c);
      const dest = seamlessBuffer.getChannelData(c);

      // Copy the exact musical slice
      dest.set(src.subarray(delaySamples, delaySamples + targetSamples));

      // Apply seamless micro-fade at boundaries (2.5ms Hann window) to prevent zero-crossing pops
      for (let i = 0; i < fadeLen; i++) {
        const t = i / fadeLen;
        const factor = 0.5 * (1 - Math.cos(Math.PI * t)); // 0 at seam, 1 at fadeLen
        dest[i] *= factor;
        dest[targetSamples - 1 - i] *= factor;
      }
    }

    return seamlessBuffer;
  }

  /**
   * Preload and decode all audio files into Tone.ToneAudioBuffers before playback
   */
  public async preloadAllAudio(): Promise<void> {
    if (this.toneAudioBuffers && this.toneAudioBuffers.loaded && this.audioBuffers.size === Object.keys(INSTRUMENT_AUDIO_FILES).length) {
      return;
    }
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = new Promise<void>((resolve) => {
      let resolved = false;
      const syncLoadedBuffers = () => {
        Object.keys(INSTRUMENT_AUDIO_FILES).forEach((gearId) => {
          if (!this.audioBuffers.has(gearId) && this.toneAudioBuffers?.has(gearId)) {
            const toneBuffer = this.toneAudioBuffers.get(gearId);
            if (toneBuffer && toneBuffer.loaded) {
              const rawBuffer = toneBuffer.get();
              if (rawBuffer) {
                this.audioBuffers.set(gearId, this.prepareSeamlessBuffer(rawBuffer));
              }
            }
          }
        });
      };

      const finish = () => {
        if (resolved) return;
        resolved = true;
        syncLoadedBuffers();
        resolve();
      };

      // Safety timeout: never block audio start for more than 2.5 seconds
      const timer = setTimeout(finish, 2500);

      this.toneAudioBuffers = new Tone.ToneAudioBuffers(
        INSTRUMENT_AUDIO_FILES,
        () => {
          clearTimeout(timer);
          finish();
        }
      );
    });

    await this.loadPromise;
  }

  /**
   * Load and retrieve a specific decoded AudioBuffer
   */
  public async loadAudioBuffer(gearId: string): Promise<AudioBuffer | null> {
    if (this.audioBuffers.has(gearId)) {
      return this.audioBuffers.get(gearId)!;
    }
    await this.preloadAllAudio();
    let buffer = this.audioBuffers.get(gearId) || null;
    if (!buffer && this.toneAudioBuffers?.has(gearId)) {
      const toneBuf = this.toneAudioBuffers.get(gearId);
      if (toneBuf && toneBuf.loaded) {
        const raw = toneBuf.get();
        if (raw) {
          buffer = this.prepareSeamlessBuffer(raw);
          this.audioBuffers.set(gearId, buffer);
        }
      }
    }
    return buffer;
  }

  public getToneAudioBuffers(): Tone.ToneAudioBuffers | null {
    return this.toneAudioBuffers;
  }

  public setStateProvider(
    provider: () => {
      placedGear: PlacedGear[];
      mixerChannels: MixerChannelState[];
      connections: CableConnection[];
      environment?: EnvironmentMode;
      masterBus?: MasterBusState;
    }
  ) {
    this.stateProvider = provider;
  }

  /**
   * Evaluates which instruments have a fully validated signal chain:
   * e.g. Electric Guitar -> 1/4" -> Amp -> Mic -> XLR -> Mixer Channel (+48V if condenser, unmuted, fader > 5).
   * If there is an error anywhere in the signal chain, the test signal will NOT go through!
   */
  public getActiveValidatedSources(
    placedGear: PlacedGear[],
    connections: CableConnection[],
    mixerChannels: MixerChannelState[],
    environment: EnvironmentMode = 'recording_studio'
  ): Set<string> {
    const validated = new Set<string>();
    const hasAnySolo = mixerChannels.some((c) => c.solo);

    for (const ch of mixerChannels) {
      if (ch.muted || ch.fader <= 5) continue;
      if (hasAnySolo && !ch.solo) continue;

      const val = validateChannelSignalChain(ch, placedGear, connections, mixerChannels, environment);
      if (val.hasSignal && val.instrumentGear) {
        validated.add(val.instrumentGear.gearId);
        // If drummer group or full drum set is miked, activate all drum elements
        if (val.instrumentGear.gearId === 'drummer' || val.instrumentGear.gearId === 'inst_drum_set') {
          validated.add('inst_kick_drum');
          validated.add('inst_snare_drum');
          validated.add('inst_tom_drum');
          validated.add('inst_drum_cymbals');
          validated.add('inst_hi_hat');
          validated.add('inst_drum_set');
        }
      }
    }

    return validated;
  }

  public togglePlayback(
    placedGear: PlacedGear[],
    mixerChannels: MixerChannelState[],
    connections: CableConnection[] = [],
    onBeat?: (step: number) => void
  ): boolean {
    this.init();
    if (this.isPlaying) {
      this.stop();
      return false;
    } else {
      this.start(placedGear, mixerChannels, connections, onBeat);
      return true;
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  private spawnTrack(gearId: string, startTime: number, offset = 0) {
    if (!this.ctx || !this.masterGainNode || this.activeTracks.has(gearId)) return;
    let buffer = this.audioBuffers.get(gearId);
    if (!buffer && this.toneAudioBuffers?.has(gearId)) {
      const toneBuf = this.toneAudioBuffers.get(gearId);
      if (toneBuf && toneBuf.loaded) {
        const raw = toneBuf.get();
        if (raw) {
          buffer = this.prepareSeamlessBuffer(raw);
          this.audioBuffers.set(gearId, buffer);
        }
      }
    }
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = buffer.duration;

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0, this.ctx.currentTime);

    const analyserNode = this.ctx.createAnalyser();
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.75;

    let pannerNode: StereoPannerNode | null = null;
    if (this.ctx.createStereoPanner) {
      pannerNode = this.ctx.createStereoPanner();
      pannerNode.pan.setValueAtTime(0, this.ctx.currentTime);
      source.connect(gainNode);
      gainNode.connect(analyserNode);
      analyserNode.connect(pannerNode);
      pannerNode.connect(this.masterGainNode);
    } else {
      source.connect(gainNode);
      gainNode.connect(analyserNode);
      analyserNode.connect(this.masterGainNode);
    }

    if (offset > 0) {
      source.start(startTime, offset);
    } else {
      source.start(startTime);
    }
    this.activeTracks.set(gearId, { source, gainNode, analyserNode, pannerNode });
  }

  /**
   * Start sample-accurate multitrack loop playback of all uploaded soundcheck tracks.
   * All tracks loop in synchrony, with their volume & pan governed in real time
   * by the mixer faders, mutes, solos, and physical microphone & cable patch signal chains.
   */
  public async start(
    placedGear: PlacedGear[],
    mixerChannels: MixerChannelState[],
    connections: CableConnection[] = [],
    onBeat?: (step: number) => void
  ) {
    try {
      await Tone.start();
    } catch {
      // AudioContext auto-resume fallback
    }
    const rawContext = Tone.getContext().rawContext as AudioContext;
    this.ctx = rawContext;
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        // Handled by browser
      }
    }

    // Stop any existing tracks
    this.stop();
    this.isPlaying = true;

    // Make sure all stems are loaded into Tone.ToneAudioBuffers before playback
    await this.preloadAllAudio();
    if (!this.isPlaying || !this.ctx) return;

    // Create Master Output Bus & Stereo Processing
    this.masterGainNode = this.ctx.createGain();
    this.masterBalanceNode = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    this.masterAnalyserNode = this.ctx.createAnalyser();
    this.masterAnalyserNode.fftSize = 256;
    this.masterAnalyserNode.smoothingTimeConstant = 0.8;

    // Stereo Splitter and dedicated Left/Right channel analysers for live mix meter
    this.masterSplitterNode = this.ctx.createChannelSplitter ? this.ctx.createChannelSplitter(2) : null;
    this.masterLeftAnalyser = this.ctx.createAnalyser();
    this.masterLeftAnalyser.fftSize = 256;
    this.masterLeftAnalyser.smoothingTimeConstant = 0.6;
    this.masterRightAnalyser = this.ctx.createAnalyser();
    this.masterRightAnalyser.fftSize = 256;
    this.masterRightAnalyser.smoothingTimeConstant = 0.6;

    if (this.masterBalanceNode) {
      this.masterGainNode.connect(this.masterBalanceNode);
      this.masterBalanceNode.connect(this.masterAnalyserNode);
    } else {
      this.masterGainNode.connect(this.masterAnalyserNode);
    }

    if (this.masterSplitterNode) {
      this.masterAnalyserNode.connect(this.masterSplitterNode);
      this.masterSplitterNode.connect(this.masterLeftAnalyser, 0);
      this.masterSplitterNode.connect(this.masterRightAnalyser, 1);
    } else {
      this.masterAnalyserNode.connect(this.masterLeftAnalyser);
      this.masterAnalyserNode.connect(this.masterRightAnalyser);
    }

    this.masterAnalyserNode.connect(this.ctx.destination);

    // Apply current master gain state
    this.applyMasterGainDirectly();

    // Common loop start time synchronized with Tone.now() + 0.1 so loops lock in phase
    const commonStartTime = Tone.now() + 0.1;
    this.startTime = commonStartTime;

    // Spawn and synchronize all 17 audio tracks
    Object.entries(INSTRUMENT_AUDIO_FILES).forEach(([gearId]) => {
      this.spawnTrack(gearId, commonStartTime);
    });

    // Real-time synchronization loop (30ms interval)
    this.timer = window.setInterval(() => {
      if (!this.ctx || !this.isPlaying) return;

      const current = this.stateProvider
        ? this.stateProvider()
        : { placedGear, mixerChannels, connections, environment: 'recording_studio' as EnvironmentMode };

      const activeValidated = this.getActiveValidatedSources(
        current.placedGear,
        current.connections,
        current.mixerChannels,
        current.environment || 'recording_studio'
      );

      const now = Tone.now();

      // Catch any track buffer that finished decoding late and spawn it in loop sync
      Object.keys(INSTRUMENT_AUDIO_FILES).forEach((gearId) => {
        if (!this.activeTracks.has(gearId)) {
          let buffer = this.audioBuffers.get(gearId);
          if (!buffer && this.toneAudioBuffers?.has(gearId)) {
            const toneBuf = this.toneAudioBuffers.get(gearId);
            if (toneBuf && toneBuf.loaded) {
              const raw = toneBuf.get();
              if (raw) {
                buffer = this.prepareSeamlessBuffer(raw);
                this.audioBuffers.set(gearId, buffer);
              }
            }
          }
          if (buffer) {
            const elapsed = Math.max(0, now - this.startTime);
            const loopOffset = elapsed % buffer.duration;
            this.spawnTrack(gearId, now, loopOffset);
          }
        }
      });

      // Update every active track's gain & pan with smooth ramping to prevent clicks
      this.activeTracks.forEach((track, gearId) => {
        const isValidated =
          activeValidated.has(gearId) ||
          ((gearId === 'inst_kick_drum' ||
            gearId === 'inst_snare_drum' ||
            gearId === 'inst_tom_drum' ||
            gearId === 'inst_drum_cymbals' ||
            gearId === 'inst_hi_hat') &&
            activeValidated.has('inst_drum_set'));

        if (isValidated) {
          const { gain, pan, isAudible } = this.getChannelAudioParams(gearId, current);
          const targetGain = isAudible ? gain : 0;
          track.gainNode.gain.setTargetAtTime(targetGain, now, 0.03);
          if (track.pannerNode) {
            track.pannerNode.pan.setTargetAtTime(pan, now, 0.03);
          }
        } else {
          track.gainNode.gain.setTargetAtTime(0, now, 0.03);
        }
      });

      // Synchronize master output bus controls dynamically
      if (current.masterBus) {
        this.masterBusState = { ...this.masterBusState, ...current.masterBus };
      }
      this.applyMasterGainDirectly();

      // Synchronized beat indicator (sample-accurate 4-bar loop at 90 BPM)
      if (onBeat) {
        const elapsed = Math.max(0, now - this.startTime);
        const progress = (elapsed % LOOP_DURATION_SECONDS) / LOOP_DURATION_SECONDS;
        const step = Math.floor(progress * 16) % 8;
        onBeat(step);
      }
    }, 30);
  }

  public stop() {
    this.isPlaying = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.activeTracks.forEach((track) => {
      try {
        track.source.stop();
        track.source.disconnect();
        track.gainNode.disconnect();
        track.analyserNode.disconnect();
        track.pannerNode?.disconnect();
      } catch {
        // Ignore errors from already stopped nodes
      }
    });
    this.activeTracks.clear();

    if (this.masterGainNode) {
      try {
        this.masterGainNode.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.masterGainNode = null;
    }
    if (this.masterBalanceNode) {
      try {
        this.masterBalanceNode.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.masterBalanceNode = null;
    }
    if (this.masterAnalyserNode) {
      try {
        this.masterAnalyserNode.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.masterAnalyserNode = null;
    }
    if (this.masterSplitterNode) {
      try {
        this.masterSplitterNode.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.masterSplitterNode = null;
    }
    if (this.masterLeftAnalyser) {
      try {
        this.masterLeftAnalyser.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.masterLeftAnalyser = null;
    }
    if (this.masterRightAnalyser) {
      try {
        this.masterRightAnalyser.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.masterRightAnalyser = null;
    }
  }

  /**
   * Retrieves time-domain waveform data (0..255 byte array, centered at 128)
   * and calculates peak amplitude (0..1.0) for a given instrument gearId.
   */
  public getGearWaveformData(
    gearId: string,
    outputArray: Uint8Array
  ): { hasData: boolean; peakAmplitude: number; rmsAmplitude: number } {
    if (!this.isPlaying || !this.activeTracks.has(gearId)) {
      return { hasData: false, peakAmplitude: 0, rmsAmplitude: 0 };
    }
    const track = this.activeTracks.get(gearId);
    if (!track) return { hasData: false, peakAmplitude: 0, rmsAmplitude: 0 };

    track.analyserNode.getByteTimeDomainData(outputArray);

    let maxDev = 0;
    let sumSq = 0;
    for (let i = 0; i < outputArray.length; i++) {
      const dev = (outputArray[i] - 128) / 128;
      sumSq += dev * dev;
      if (Math.abs(dev) > maxDev) maxDev = Math.abs(dev);
    }
    const rms = Math.sqrt(sumSq / outputArray.length);

    return {
      hasData: true,
      peakAmplitude: maxDev,
      rmsAmplitude: rms,
    };
  }

  /**
   * Retrieves frequency spectrum data (0..255 byte array) for a given instrument gearId.
   */
  public getGearFrequencyData(
    gearId: string,
    outputArray: Uint8Array
  ): { hasData: boolean } {
    if (!this.isPlaying || !this.activeTracks.has(gearId)) {
      return { hasData: false };
    }
    const track = this.activeTracks.get(gearId);
    if (!track) return { hasData: false };

    track.analyserNode.getByteFrequencyData(outputArray);
    return { hasData: true };
  }

  /**
   * Retrieves frequency spectrum data for the Master stereo bus output.
   */
  public getMasterFrequencyData(
    outputArray: Uint8Array
  ): { hasData: boolean } {
    if (!this.isPlaying || !this.masterAnalyserNode) {
      return { hasData: false };
    }
    this.masterAnalyserNode.getByteFrequencyData(outputArray);
    return { hasData: true };
  }

  /**
   * Retrieves waveform data for the Master stereo bus output.
   */
  public getMasterWaveformData(
    outputArray: Uint8Array
  ): { hasData: boolean; peakAmplitude: number; rmsAmplitude: number } {
    if (!this.isPlaying || !this.masterAnalyserNode) {
      return { hasData: false, peakAmplitude: 0, rmsAmplitude: 0 };
    }

    this.masterAnalyserNode.getByteTimeDomainData(outputArray);

    let maxDev = 0;
    let sumSq = 0;
    for (let i = 0; i < outputArray.length; i++) {
      const dev = (outputArray[i] - 128) / 128;
      sumSq += dev * dev;
      if (Math.abs(dev) > maxDev) maxDev = Math.abs(dev);
    }
    const rms = Math.sqrt(sumSq / outputArray.length);

    return {
      hasData: true,
      peakAmplitude: maxDev,
      rmsAmplitude: rms,
    };
  }

  /**
   * Retrieves real-time calibrated stereo metering values for the Master Mix Bus.
   * Returns peak & RMS normalized values (0..1.0), decibel values (-inf to +6 dBFS),
   * and digital clipping state.
   */
  public getMasterStereoLevels(): {
    leftPeak: number;
    rightPeak: number;
    leftRms: number;
    rightRms: number;
    leftDb: number;
    rightDb: number;
    isClipping: boolean;
    hasSignal: boolean;
  } {
    if (!this.isPlaying || !this.masterGainNode) {
      return {
        leftPeak: 0,
        rightPeak: 0,
        leftRms: 0,
        rightRms: 0,
        leftDb: -Infinity,
        rightDb: -Infinity,
        isClipping: false,
        hasSignal: false,
      };
    }

    const leftData = new Uint8Array(128);
    const rightData = new Uint8Array(128);

    if (this.masterLeftAnalyser && this.masterRightAnalyser) {
      this.masterLeftAnalyser.getByteTimeDomainData(leftData);
      this.masterRightAnalyser.getByteTimeDomainData(rightData);
    } else if (this.masterAnalyserNode) {
      this.masterAnalyserNode.getByteTimeDomainData(leftData);
      this.masterAnalyserNode.getByteTimeDomainData(rightData);
    } else {
      return {
        leftPeak: 0,
        rightPeak: 0,
        leftRms: 0,
        rightRms: 0,
        leftDb: -Infinity,
        rightDb: -Infinity,
        isClipping: false,
        hasSignal: false,
      };
    }

    let leftMax = 0;
    let rightMax = 0;
    let leftSumSq = 0;
    let rightSumSq = 0;

    for (let i = 0; i < leftData.length; i++) {
      const lDev = Math.abs((leftData[i] - 128) / 128);
      const rDev = Math.abs((rightData[i] - 128) / 128);
      if (lDev > leftMax) leftMax = lDev;
      if (rDev > rightMax) rightMax = rDev;
      leftSumSq += lDev * lDev;
      rightSumSq += rDev * rDev;
    }

    const leftRms = Math.sqrt(leftSumSq / leftData.length);
    const rightRms = Math.sqrt(rightSumSq / rightData.length);

    // Dynamic dBFS calculation
    const leftDb = leftMax > 0.0001 ? 20 * Math.log10(leftMax) : -Infinity;
    const rightDb = rightMax > 0.0001 ? 20 * Math.log10(rightMax) : -Infinity;

    // Digital clipping threshold check
    const isClipping = leftMax >= 0.98 || rightMax >= 0.98 || (this.masterBusState.gain > 75 && this.masterBusState.fader > 85);
    const hasSignal = leftMax > 0.015 || rightMax > 0.015;

    return {
      leftPeak: Math.min(1.0, leftMax),
      rightPeak: Math.min(1.0, rightMax),
      leftRms: Math.min(1.0, leftRms),
      rightRms: Math.min(1.0, rightRms),
      leftDb,
      rightDb,
      isClipping,
      hasSignal,
    };
  }

  // ==================== CHANNEL AUDIO ROUTING & PARAMETERS ====================

  public getChannelAudioParams(
    instrumentGearId: string,
    current: {
      placedGear: PlacedGear[];
      mixerChannels: MixerChannelState[];
      connections: CableConnection[];
      environment?: EnvironmentMode;
    }
  ): { gain: number; pan: number; isAudible: boolean } {
    const hasAnySolo = current.mixerChannels.some((c) => c.solo);
    const matchingChannels: { ch: MixerChannelState; gain: number; pan: number }[] = [];
    let hasAnyMatching = false;

    for (const ch of current.mixerChannels) {
      const val = validateChannelSignalChain(
        ch,
        current.placedGear,
        current.connections,
        current.mixerChannels,
        current.environment || 'recording_studio'
      );
      if (val.hasSignal && val.instrumentGear) {
        const isMatch =
          val.instrumentGear.gearId === instrumentGearId ||
          ((val.instrumentGear.gearId === 'drummer' || val.instrumentGear.gearId === 'inst_drum_set') &&
            (instrumentGearId === 'inst_kick_drum' ||
              instrumentGearId === 'inst_snare_drum' ||
              instrumentGearId === 'inst_tom_drum' ||
              instrumentGearId === 'inst_drum_cymbals' ||
              instrumentGearId === 'inst_hi_hat' ||
              instrumentGearId === 'inst_drum_set'));

        if (isMatch) {
          hasAnyMatching = true;
          if (ch.muted || ch.fader <= 5) continue;
          if (hasAnySolo && !ch.solo) continue;

          // Preamp Trim Gain (0..100, where 72 is Unity 0.0dB, 0 is -inf, 100 is +12dB)
          const UNITY_VAL = 72;
          const rawTrim = ch.gain !== undefined ? ch.gain : UNITY_VAL;
          let preampGain = 1;
          if (rawTrim === 0) {
            preampGain = 0;
          } else if (rawTrim <= UNITY_VAL) {
            const db = -48 * (1 - rawTrim / UNITY_VAL);
            preampGain = Math.max(0, Math.pow(10, db / 20));
          } else {
            const db = ((rawTrim - UNITY_VAL) / (100 - UNITY_VAL)) * 12;
            preampGain = Math.pow(10, db / 20);
          }

          // Fader (0..100, where 75 is Unity 0.0dB)
          const faderRatio = ch.fader / 75;
          const faderGain = Math.min(2.0, Math.pow(faderRatio, 1.6));

          const totalGain = Math.min(3.0, preampGain * faderGain);
          const pan = Math.max(-1, Math.min(1, (ch.pan || 0) / 50));
          matchingChannels.push({ ch, gain: totalGain, pan });
        }
      }
    }

    if (matchingChannels.length > 0) {
      const active = matchingChannels[0];
      return { gain: active.gain, pan: active.pan, isAudible: true };
    }

    if (hasAnyMatching) {
      return { gain: 0, pan: 0, isAudible: false };
    }

    return { gain: 1, pan: 0, isAudible: true };
  }
}

export const audioEngine = new StudioAudioEngine();
