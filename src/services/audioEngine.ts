import { PlacedGear, MixerChannelState, CableConnection, EnvironmentMode, MasterBusState } from '../types';
import { validateChannelSignalChain } from './gradingEngine';

/**
 * Mapping of all 17 studio and stage instrument sources to their corresponding
 * multitrack WAV audio files in /public/audio/
 */
export const INSTRUMENT_AUDIO_FILES: Record<string, string> = {
  inst_voice: '/audio/Voice.wav',
  inst_acoustic_guitar: '/audio/Acoustic%20Guitar.wav',
  inst_electric_guitar: '/audio/Electric%20Guitar.wav',
  inst_acoustic_piano: '/audio/Acoustic%20Piano.wav',
  inst_keyboard: '/audio/Keyboard.wav',
  inst_bass_guitar: '/audio/Bass%20Guitar.wav',
  inst_kick_drum: '/audio/Kick%20Drum.wav',
  inst_snare_drum: '/audio/Snare%20Drum.wav',
  inst_tom_drum: '/audio/Tom%20Drum.wav',
  inst_hi_hat: '/audio/Cymbals_Overheads.wav',
  inst_drum_cymbals: '/audio/Cymbals_Overheads.wav',
  inst_violin: '/audio/Violin.wav',
  inst_cello: '/audio/Cello.wav',
  inst_double_bass: '/audio/Double%20Bass.wav',
  inst_trumpet: '/audio/Trumpet.wav',
  inst_saxophone: '/audio/Saxophone.wav',
  inst_flute: '/audio/Flute.wav',
  inst_choir: '/audio/Choir.wav',
};

interface ActiveTrackNode {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  analyserNode: AnalyserNode;
  pannerNode: StereoPannerNode | null;
}

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
  
  // Decoded WAV AudioBuffers cached in memory
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private loadingPromises: Map<string, Promise<AudioBuffer | null>> = new Map();
  
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

  public init() {
    if (!this.ctx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
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
    const now = this.ctx.currentTime;
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
   * Preload and decode all WAV audio files into memory
   */
  public async preloadAllAudio(): Promise<void> {
    const promises = Object.entries(INSTRUMENT_AUDIO_FILES).map(([gearId, url]) =>
      this.loadAudioBuffer(gearId, url)
    );
    await Promise.all(promises);
  }

  /**
   * Load and decode a specific WAV file
   */
  public async loadAudioBuffer(gearId: string, url: string): Promise<AudioBuffer | null> {
    if (this.audioBuffers.has(gearId)) {
      return this.audioBuffers.get(gearId)!;
    }
    if (this.loadingPromises.has(gearId)) {
      return this.loadingPromises.get(gearId)!;
    }

    const loadPromise = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} fetching ${url}`);
        }
        const arrayBuf = await res.arrayBuffer();
        if (!this.ctx) {
          const AudioCtxClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          this.ctx = new AudioCtxClass();
        }
        const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
        this.audioBuffers.set(gearId, audioBuf);
        return audioBuf;
      } catch (err) {
        console.warn(`[StudioAudioEngine] Failed to load audio file for ${gearId} (${url}):`, err);
        return null;
      }
    })();

    this.loadingPromises.set(gearId, loadPromise);
    return loadPromise;
  }

  public setStateProvider(
    provider: () => {
      placedGear: PlacedGear[];
      mixerChannels: MixerChannelState[];
      connections: CableConnection[];
      environment?: EnvironmentMode;
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

  /**
   * Start sample-accurate multitrack loop playback of all uploaded WAV tracks.
   * All tracks loop in synchrony, with their volume & pan governed in real time
   * by the mixer faders, mutes, solos, and physical microphone & cable patch signal chains.
   */
  public async start(
    placedGear: PlacedGear[],
    mixerChannels: MixerChannelState[],
    connections: CableConnection[] = [],
    onBeat?: (step: number) => void
  ) {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    // Stop any existing tracks
    this.stop();
    this.isPlaying = true;

    // Make sure buffers are being loaded
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

    // Common loop start time scheduled slightly in advance for sample accuracy
    this.startTime = this.ctx.currentTime + 0.05;

    // Spawn and synchronize all 17 WAV audio tracks
    Object.entries(INSTRUMENT_AUDIO_FILES).forEach(([gearId]) => {
      if (!this.ctx || !this.masterGainNode) return;
      const buffer = this.audioBuffers.get(gearId);
      if (!buffer) return;

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = 0;
      source.loopEnd = buffer.duration;

      const gainNode = this.ctx.createGain();
      // Start silent until current signal chain & mixer validation determines audible gain
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

      source.start(this.startTime);
      this.activeTracks.set(gearId, { source, gainNode, analyserNode, pannerNode });
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

      const now = this.ctx.currentTime;

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

      // Synchronized beat indicator (10.667s loop = 16 8th notes)
      if (onBeat) {
        const elapsed = Math.max(0, now - this.startTime);
        const loopLength = 10.66667;
        const progress = (elapsed % loopLength) / loopLength;
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
