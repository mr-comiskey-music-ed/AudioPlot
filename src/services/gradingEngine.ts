import {
  EnvironmentMode,
  PlacedGear,
  CableConnection,
  MixerChannelState,
  RubricEvaluation,
  RubricCategoryScore,
} from '../types';
import { getGearById } from '../data/gearCatalog';

export interface SignalChainCheckResult {
  valid: boolean;
  error?: string;
  channelNumber?: number;
}

export interface ChannelSignalValidation {
  hasSignal: boolean;
  error?: string;
  sourceGear?: PlacedGear;
  instrumentGear?: PlacedGear;
}

/**
 * Validates whether a specific mixer channel has an intact, powered, error-free audio signal chain.
 * If there is an error anywhere in the signal chain (unplugged 1/4" cable, missing mic on amp,
 * condenser mic without +48V phantom power, unassigned mic, muted, or invalid transducer),
 * this function returns `hasSignal: false` and the specific error reason.
 */
export function validateChannelSignalChain(
  channel: MixerChannelState,
  placedGear: PlacedGear[],
  connections: CableConnection[],
  mixerChannels: MixerChannelState[],
  environment: EnvironmentMode = 'recording_studio'
): ChannelSignalValidation {
  if (!channel.assignedGearInstanceId) {
    return { hasSignal: false, error: 'Channel is unpatched' };
  }

  const assignedGear = placedGear.find((g) => g.instanceId === channel.assignedGearInstanceId);
  if (!assignedGear) {
    return { hasSignal: false, error: 'Assigned gear not found on plot' };
  }

  const gearDef = getGearById(assignedGear.gearId);
  if (!gearDef) {
    return { hasSignal: false, error: 'Unknown gear definition' };
  }

  // 1. Assigned Gear is a MICROPHONE
  if (gearDef.category === 'microphone') {
    // 1A. Phantom Power Requirement Check
    if (gearDef.requiresPhantomPower && !channel.phantomPower) {
      return {
        hasSignal: false,
        error: `No Signal: ${gearDef.name} is a condenser mic and requires +48V Phantom Power on CH ${channel.channelNumber}`,
        sourceGear: assignedGear,
      };
    }

    // 1B. Target Sound Source Check
    let target: PlacedGear | null = null;
    if (assignedGear.latchedSourceInstanceId === 'room') {
      return {
        hasSignal: true,
        sourceGear: assignedGear,
      };
    } else if (assignedGear.latchedSourceInstanceId === 'drummer') {
      const drumInst = placedGear.find((g) => {
        const d = getGearById(g.gearId);
        return (
          d?.category === 'instrument' &&
          (g.gearId.startsWith('inst_drum') ||
            g.gearId.startsWith('inst_kick') ||
            g.gearId.startsWith('inst_snare') ||
            g.gearId.startsWith('inst_tom'))
        );
      });
      return {
        hasSignal: true,
        sourceGear: assignedGear,
        instrumentGear: drumInst || (assignedGear as PlacedGear),
      };
    } else if (assignedGear.latchedSourceInstanceId) {
      target = placedGear.find((g) => g.instanceId === assignedGear.latchedSourceInstanceId) || null;
    }

    if (!target) {
      // Proximity search (< 140px, adapted for wide instruments like Choir)
      target =
        placedGear.find((g) => {
          if (g.instanceId === assignedGear.instanceId) return false;
          const gDef = getGearById(g.gearId);
          if (gDef?.category !== 'instrument' && gDef?.category !== 'amplifier') return false;
          const gWidth = g.gearId === 'inst_choir' ? 250 : gDef?.size?.width || 64;
          const gCenterX = g.x + gWidth / 2;
          const gCenterY = g.y + 32;
          const micCenterX = assignedGear.x + 32;
          const micCenterY = assignedGear.y + 32;
          return Math.hypot(gCenterX - micCenterX, gCenterY - micCenterY) < Math.max(140, gWidth / 2 + 50);
        }) || null;
    }

    if (!target) {
      return {
        hasSignal: false,
        error: `No Signal: ${gearDef.name} is not positioned near or assigned to any instrument or performer`,
        sourceGear: assignedGear,
      };
    }

    // Direct micing of electric solidbody guitar / bass (Invalid acoustic source)
    if (target.gearId === 'inst_electric_guitar' || target.gearId === 'inst_bass_guitar') {
      return {
        hasSignal: false,
        error: `No Signal: Electric instruments produce electronic output and cannot be miked directly. Plug into an amp or DI Box.`,
        sourceGear: assignedGear,
        instrumentGear: target,
      };
    }

    // Target is Guitar Amplifier
    if (target.gearId === 'gear_guitar_amp') {
      const quarterConn = connections.find(
        (c) =>
          (c.fromInstanceId === target!.instanceId || c.toInstanceId === target!.instanceId) &&
          c.cableType === 'quarter_inch'
      );
      if (!quarterConn) {
        return {
          hasSignal: false,
          error: `No Signal: Guitar Amp has no 1/4" instrument cable connected from an electric guitar`,
          sourceGear: assignedGear,
          instrumentGear: target,
        };
      }
      const instId = quarterConn.fromInstanceId === target.instanceId ? quarterConn.toInstanceId : quarterConn.fromInstanceId;
      const instGear = placedGear.find((g) => g.instanceId === instId);
      return {
        hasSignal: true,
        sourceGear: assignedGear,
        instrumentGear: instGear || target,
      };
    }

    // Target is Bass Amplifier
    if (target.gearId === 'gear_bass_amp') {
      const quarterConn = connections.find(
        (c) =>
          (c.fromInstanceId === target!.instanceId || c.toInstanceId === target!.instanceId) &&
          c.cableType === 'quarter_inch'
      );
      if (!quarterConn) {
        return {
          hasSignal: false,
          error: `No Signal: Bass Amp has no 1/4" cable connected from a bass guitar`,
          sourceGear: assignedGear,
          instrumentGear: target,
        };
      }
      const instId = quarterConn.fromInstanceId === target.instanceId ? quarterConn.toInstanceId : quarterConn.fromInstanceId;
      const instGear = placedGear.find((g) => g.instanceId === instId);
      return {
        hasSignal: true,
        sourceGear: assignedGear,
        instrumentGear: instGear || target,
      };
    }

    // Valid acoustic instrument / voice
    return {
      hasSignal: true,
      sourceGear: assignedGear,
      instrumentGear: target,
    };
  }

  // 2. Assigned Gear is a DI BOX
  if (gearDef.category === 'di_box') {
    const quarterConn = connections.find(
      (c) =>
        (c.fromInstanceId === assignedGear.instanceId || c.toInstanceId === assignedGear.instanceId) &&
        c.cableType === 'quarter_inch'
    );
    if (!quarterConn) {
      return {
        hasSignal: false,
        error: `No Signal: DI Box has no 1/4" instrument cable connected from an instrument`,
        sourceGear: assignedGear,
      };
    }
    const instId = quarterConn.fromInstanceId === assignedGear.instanceId ? quarterConn.toInstanceId : quarterConn.fromInstanceId;
    const instGear = placedGear.find((g) => g.instanceId === instId);
    return {
      hasSignal: true,
      sourceGear: assignedGear,
      instrumentGear: instGear,
    };
  }

  // 3. Assigned Gear is an AMPLIFIER with Direct Out (e.g. Bass Amp XLR Out)
  if (gearDef.category === 'amplifier') {
    const quarterConn = connections.find(
      (c) =>
        (c.fromInstanceId === assignedGear.instanceId || c.toInstanceId === assignedGear.instanceId) &&
        c.cableType === 'quarter_inch'
    );
    if (!quarterConn) {
      return {
        hasSignal: false,
        error: `No Signal: Amplifier direct out is patched, but no instrument is plugged in via 1/4" cable`,
        sourceGear: assignedGear,
      };
    }
    const instId = quarterConn.fromInstanceId === assignedGear.instanceId ? quarterConn.toInstanceId : quarterConn.fromInstanceId;
    const instGear = placedGear.find((g) => g.instanceId === instId);
    return {
      hasSignal: true,
      sourceGear: assignedGear,
      instrumentGear: instGear,
    };
  }

  // 4. Assigned Gear is an INSTRUMENT directly
  if (gearDef.category === 'instrument') {
    return {
      hasSignal: true,
      sourceGear: assignedGear,
      instrumentGear: assignedGear,
    };
  }

  return { hasSignal: false, error: 'No audio signal generator' };
}

/**
 * Validates whether an instrument's full audio signal chain is complete and error-free.
 * Used by grading engine, audio playback engine, and mixer console.
 */
export function getInstrumentSignalChainStatus(
  inst: PlacedGear,
  placedGear: PlacedGear[],
  connections: CableConnection[],
  mixerChannels: MixerChannelState[],
  environment: EnvironmentMode
): SignalChainCheckResult {
  const def = getGearById(inst.gearId);
  if (!def) return { valid: false, error: 'Unknown gear' };

  // 1. Electric Guitar
  if (inst.gearId === 'inst_electric_guitar') {
    const quarterConn = connections.find(
      (c) =>
        (c.fromInstanceId === inst.instanceId || c.toInstanceId === inst.instanceId) &&
        c.cableType === 'quarter_inch'
    );
    if (!quarterConn) {
      return { valid: false, error: 'Electric Guitar requires a 1/4" instrument cable to a Guitar Amp or DI Box' };
    }
    const targetId = quarterConn.fromInstanceId === inst.instanceId ? quarterConn.toInstanceId : quarterConn.fromInstanceId;
    const targetGear = placedGear.find((g) => g.instanceId === targetId);
    if (!targetGear) {
      return { valid: false, error: 'Cable is unplugged' };
    }

    if (targetGear.gearId === 'gear_guitar_amp') {
      // Amp must have a dynamic mic aimed at it and patched
      const ampMic = placedGear.find((g) => {
        const gDef = getGearById(g.gearId);
        if (gDef?.category !== 'microphone') return false;
        if (g.latchedSourceInstanceId === targetGear.instanceId) return true;
        return Math.hypot(g.x - targetGear.x, g.y - targetGear.y) < 140;
      });
      if (!ampMic) {
        return { valid: false, error: 'Guitar Amp speaker cab must be miked with an instrument dynamic mic (SM57)' };
      }
      const ch = mixerChannels.find(
        (c) => c.assignedGearInstanceId === ampMic.instanceId || c.channelNumber === ampMic.assignedChannel
      );
      if (!ch) {
        return { valid: false, error: 'Guitar Amp microphone is not patched to a snake channel' };
      }
      const micDef = getGearById(ampMic.gearId);
      if (micDef?.requiresPhantomPower && !ch.phantomPower) {
        return { valid: false, error: `Guitar Amp mic (${micDef.name}) requires +48V Phantom Power on CH ${ch.channelNumber}` };
      }
      return { valid: true, channelNumber: ch.channelNumber };
    } else if (targetGear.gearId === 'gear_di_box') {
      const ch = mixerChannels.find(
        (c) => c.assignedGearInstanceId === targetGear.instanceId || c.channelNumber === targetGear.assignedChannel
      );
      if (!ch) {
        return { valid: false, error: 'DI Box XLR output is not patched to a snake channel' };
      }
      return { valid: true, channelNumber: ch.channelNumber };
    }
    return { valid: false, error: 'Electric Guitar must plug into a Guitar Amp or DI Box' };
  }

  // 2. Bass Guitar
  if (inst.gearId === 'inst_bass_guitar') {
    const quarterConn = connections.find(
      (c) =>
        (c.fromInstanceId === inst.instanceId || c.toInstanceId === inst.instanceId) &&
        c.cableType === 'quarter_inch'
    );
    if (!quarterConn) {
      return { valid: false, error: 'Bass Guitar requires a 1/4" cable to a Bass Amp or DI Box' };
    }
    const targetId = quarterConn.fromInstanceId === inst.instanceId ? quarterConn.toInstanceId : quarterConn.fromInstanceId;
    const targetGear = placedGear.find((g) => g.instanceId === targetId);
    if (!targetGear) {
      return { valid: false, error: 'Bass cable is unplugged' };
    }

    if (targetGear.gearId === 'gear_bass_amp') {
      const ch = mixerChannels.find(
        (c) => c.assignedGearInstanceId === targetGear.instanceId || c.channelNumber === targetGear.assignedChannel
      );
      const ampMic = placedGear.find((g) => {
        const gDef = getGearById(g.gearId);
        if (gDef?.category !== 'microphone') return false;
        if (g.latchedSourceInstanceId === targetGear.instanceId) return true;
        return Math.hypot(g.x - targetGear.x, g.y - targetGear.y) < 140;
      });
      const micCh = ampMic
        ? mixerChannels.find((c) => c.assignedGearInstanceId === ampMic.instanceId || c.channelNumber === ampMic.assignedChannel)
        : null;

      if (!ch && !micCh) {
        return { valid: false, error: 'Bass Amp must be patched to snake via XLR Direct Out or miked' };
      }
      const activeCh = ch || micCh!;
      if (ampMic && !ch) {
        const micDef = getGearById(ampMic.gearId);
        if (micDef?.requiresPhantomPower && !activeCh.phantomPower) {
          return { valid: false, error: `Bass Amp mic (${micDef.name}) requires +48V Phantom Power on CH ${activeCh.channelNumber}` };
        }
      }
      return { valid: true, channelNumber: activeCh.channelNumber };
    } else if (targetGear.gearId === 'gear_di_box') {
      const ch = mixerChannels.find(
        (c) => c.assignedGearInstanceId === targetGear.instanceId || c.channelNumber === targetGear.assignedChannel
      );
      if (!ch) {
        return { valid: false, error: 'DI Box XLR output is not patched to a snake channel' };
      }
      return { valid: true, channelNumber: ch.channelNumber };
    }
    return { valid: false, error: 'Bass Guitar must plug into a Bass Amp or DI Box' };
  }

  // 3. Keyboard
  if (inst.gearId === 'inst_keyboard') {
    const quarterConn = connections.find(
      (c) =>
        (c.fromInstanceId === inst.instanceId || c.toInstanceId === inst.instanceId) &&
        c.cableType === 'quarter_inch'
    );
    if (!quarterConn) {
      return { valid: false, error: 'Keyboard requires a 1/4" cable to a DI Box' };
    }
    const targetId = quarterConn.fromInstanceId === inst.instanceId ? quarterConn.toInstanceId : quarterConn.fromInstanceId;
    const targetGear = placedGear.find((g) => g.instanceId === targetId);
    if (!targetGear || targetGear.gearId !== 'gear_di_box') {
      return { valid: false, error: 'Keyboard must plug into a DI Box' };
    }
    const ch = mixerChannels.find(
      (c) => c.assignedGearInstanceId === targetGear.instanceId || c.channelNumber === targetGear.assignedChannel
    );
    if (!ch) {
      return { valid: false, error: 'Keyboard DI Box is not patched to a snake channel' };
    }
    return { valid: true, channelNumber: ch.channelNumber };
  }

  // 4. Acoustic Guitar
  if (inst.gearId === 'inst_acoustic_guitar') {
    const quarterConn = connections.find(
      (c) =>
        (c.fromInstanceId === inst.instanceId || c.toInstanceId === inst.instanceId) &&
        c.cableType === 'quarter_inch'
    );
    if (quarterConn) {
      const targetId = quarterConn.fromInstanceId === inst.instanceId ? quarterConn.toInstanceId : quarterConn.fromInstanceId;
      const targetGear = placedGear.find((g) => g.instanceId === targetId);
      if (targetGear?.gearId === 'gear_di_box') {
        const ch = mixerChannels.find(
          (c) => c.assignedGearInstanceId === targetGear.instanceId || c.channelNumber === targetGear.assignedChannel
        );
        if (!ch) {
          return { valid: false, error: 'Acoustic Guitar DI Box is not patched to a snake channel' };
        }
        return { valid: true, channelNumber: ch.channelNumber };
      }
    }

    const mic = placedGear.find((g) => {
      const gDef = getGearById(g.gearId);
      if (gDef?.category !== 'microphone') return false;
      if (g.latchedSourceInstanceId === inst.instanceId) return true;
      return Math.hypot(g.x - inst.x, g.y - inst.y) < 140;
    });
    if (!mic) {
      return { valid: false, error: 'Acoustic Guitar requires a microphone or a 1/4" connection to a DI Box' };
    }
    const micDef = getGearById(mic.gearId);
    const ch = mixerChannels.find(
      (c) => c.assignedGearInstanceId === mic.instanceId || c.channelNumber === mic.assignedChannel
    );
    if (!ch) {
      return { valid: false, error: 'Acoustic Guitar microphone is not patched to a snake channel' };
    }
    if (micDef?.requiresPhantomPower && !ch.phantomPower) {
      return { valid: false, error: `${micDef.name} is a condenser and requires +48V Phantom Power on Ch ${ch.channelNumber}` };
    }
    return { valid: true, channelNumber: ch.channelNumber };
  }

  // 5. Double Bass (Supports 1/4" Pickup to Bass Amp or DI Box, or Acoustic Microphone)
  if (inst.gearId === 'inst_double_bass') {
    const quarterConn = connections.find(
      (c) =>
        (c.fromInstanceId === inst.instanceId || c.toInstanceId === inst.instanceId) &&
        c.cableType === 'quarter_inch'
    );
    if (quarterConn) {
      const targetId = quarterConn.fromInstanceId === inst.instanceId ? quarterConn.toInstanceId : quarterConn.fromInstanceId;
      const targetGear = placedGear.find((g) => g.instanceId === targetId);
      if (targetGear?.gearId === 'gear_di_box') {
        const ch = mixerChannels.find(
          (c) => c.assignedGearInstanceId === targetGear.instanceId || c.channelNumber === targetGear.assignedChannel
        );
        if (!ch) {
          return { valid: false, error: 'Double Bass DI Box is not patched to a snake channel' };
        }
        return { valid: true, channelNumber: ch.channelNumber };
      }
      if (targetGear?.gearId === 'gear_bass_amp') {
        const ch = mixerChannels.find(
          (c) => c.assignedGearInstanceId === targetGear.instanceId || c.channelNumber === targetGear.assignedChannel
        );
        const ampMic = placedGear.find((g) => {
          const gDef = getGearById(g.gearId);
          if (gDef?.category !== 'microphone') return false;
          if (g.latchedSourceInstanceId === targetGear.instanceId) return true;
          return Math.hypot(g.x - targetGear.x, g.y - targetGear.y) < 140;
        });
        const micCh = ampMic
          ? mixerChannels.find((c) => c.assignedGearInstanceId === ampMic.instanceId || c.channelNumber === ampMic.assignedChannel)
          : null;

        if (!ch && !micCh) {
          return { valid: false, error: 'Bass Amp must be patched to snake via XLR Direct Out or miked' };
        }
        const activeCh = ch || micCh!;
        if (ampMic && !ch) {
          const micDef = getGearById(ampMic.gearId);
          if (micDef?.requiresPhantomPower && !activeCh.phantomPower) {
            return { valid: false, error: `Bass Amp mic (${micDef.name}) requires +48V Phantom Power on CH ${activeCh.channelNumber}` };
          }
        }
        return { valid: true, channelNumber: activeCh.channelNumber };
      }
    }

    const mic = placedGear.find((g) => {
      const gDef = getGearById(g.gearId);
      if (gDef?.category !== 'microphone') return false;
      if (g.latchedSourceInstanceId === inst.instanceId) return true;
      return Math.hypot(g.x - inst.x, g.y - inst.y) < 140;
    });
    if (!mic) {
      return { valid: false, error: 'Double Bass requires a microphone or a 1/4" pickup connection to a Bass Amp / DI Box' };
    }
    const micDef = getGearById(mic.gearId);
    const ch = mixerChannels.find(
      (c) => c.assignedGearInstanceId === mic.instanceId || c.channelNumber === mic.assignedChannel
    );
    if (!ch) {
      return { valid: false, error: 'Double Bass microphone is not patched to a snake channel' };
    }
    if (micDef?.requiresPhantomPower && !ch.phantomPower) {
      return { valid: false, error: `${micDef.name} requires +48V Phantom Power turned ON on Ch ${ch.channelNumber}` };
    }
    return { valid: true, channelNumber: ch.channelNumber };
  }

  // 5. Vocals and other acoustic instruments (Voice, Drums, Brass, Strings, Piano, etc.)
  const isDrum =
    inst.gearId === 'inst_kick_drum' ||
    inst.gearId === 'inst_snare_drum' ||
    inst.gearId === 'inst_tom_drum' ||
    inst.gearId === 'inst_drum_cymbals' ||
    inst.gearId === 'inst_hi_hat' ||
    inst.gearId === 'inst_drum_set';

  const mic = placedGear.find((g) => {
    const gDef = getGearById(g.gearId);
    if (gDef?.category !== 'microphone') return false;
    if (g.latchedSourceInstanceId === inst.instanceId) return true;
    if (isDrum && (g.latchedSourceInstanceId === 'drummer' || g.latchedSourceInstanceId === 'inst_drum_set')) return true;
    return Math.hypot(g.x - inst.x, g.y - inst.y) < 140;
  });

  if (!mic) {
    return { valid: false, error: `No microphone positioned at ${def.name}` };
  }

  const micDef = getGearById(mic.gearId);
  const ch = mixerChannels.find(
    (c) => c.assignedGearInstanceId === mic.instanceId || c.channelNumber === mic.assignedChannel
  );
  if (!ch) {
    return { valid: false, error: `${def.name} microphone is not patched to a snake channel` };
  }

  if (micDef?.requiresPhantomPower && !ch.phantomPower) {
    return { valid: false, error: `${micDef.name} requires +48V Phantom Power turned ON on Ch ${ch.channelNumber}` };
  }

  return { valid: true, channelNumber: ch.channelNumber };
}

export function evaluateStudioSetup(
  environment: EnvironmentMode,
  placedGear: PlacedGear[],
  connections: CableConnection[],
  mixerChannels: MixerChannelState[],
  activeChallengeId?: string | null
): RubricEvaluation {
  const criticalIssues: string[] = [];
  const suggestions: string[] = [];
  const positives: string[] = [];

  // Filter items by category
  const placedInstruments = placedGear.filter((item) => {
    const def = getGearById(item.gearId);
    return def?.category === 'instrument';
  });

  const placedMics = placedGear.filter((item) => {
    const def = getGearById(item.gearId);
    return def?.category === 'microphone';
  });

  const placedDIs = placedGear.filter((item) => {
    const def = getGearById(item.gearId);
    return def?.category === 'di_box';
  });

  const placedAmps = placedGear.filter((item) => {
    const def = getGearById(item.gearId);
    return def?.category === 'amplifier';
  });

  const placedHeadphones = placedGear.filter((item) => item.gearId === 'gear_studio_headphones');
  const paSpeakers = placedGear.filter((g) => g.gearId === 'gear_pa_speaker');
  const stageMonitors = placedGear.filter((g) => g.gearId === 'gear_stage_monitor');
  const iemTransmitters = placedGear.filter((g) => g.gearId === 'gear_iem_transmitter'); // Wireless IEM Rack/Transmitter (base station)
  const iemBodypacks = placedGear.filter((g) => g.gearId === 'gear_iem_receiver'); // Wireless IEM Bodypack/Receiver (worn by performer)

  // Helper to find what sound source or amp a mic is targeting
  const getMicTarget = (mic: PlacedGear) => {
    if (mic.latchedSourceInstanceId === 'room') return null;
    if (mic.latchedSourceInstanceId) {
      const latched = placedGear.find((g) => g.instanceId === mic.latchedSourceInstanceId);
      if (latched) return latched;
    }
    // Proximity search (< 140px)
    return (
      placedGear.find((g) => {
        if (g.instanceId === mic.instanceId) return false;
        const gDef = getGearById(g.gearId);
        if (gDef?.category !== 'instrument' && gDef?.category !== 'amplifier') return false;
        const dx = g.x - mic.x;
        const dy = g.y - mic.y;
        return Math.hypot(dx, dy) < 140;
      }) || null
    );
  };

  // ==================== 1. MINIMUM INPUTS CHECK (20 pts) ====================
  const minInputsScore: RubricCategoryScore = {
    name: activeChallengeId ? 'Challenge Pre-Assigned Instruments' : 'Selected Input Sources (Min 4 Required)',
    score: 0,
    maxScore: 20,
    passed: false,
    status: 'error',
    feedback: '',
    details: [],
  };

  const instrumentCount = placedInstruments.length;
  if (activeChallengeId) {
    minInputsScore.score = 20;
    minInputsScore.passed = true;
    minInputsScore.status = 'perfect';
    minInputsScore.feedback = `Challenge mode active: Instruments are pre-assigned (${instrumentCount} input sources).`;
  } else if (instrumentCount >= 4) {
    minInputsScore.score = 20;
    minInputsScore.passed = true;
    minInputsScore.status = 'perfect';
    minInputsScore.feedback = `Excellent! You placed ${instrumentCount} musical input sources (met the minimum 4 requirement).`;
    positives.push(`Selected ${instrumentCount} varied musical input sources.`);
  } else {
    minInputsScore.score = Math.round((instrumentCount / 4) * 20);
    minInputsScore.passed = false;
    minInputsScore.status = instrumentCount >= 2 ? 'warning' : 'error';
    minInputsScore.feedback = `You currently have ${instrumentCount}/4 required audio inputs. Add at least ${4 - instrumentCount} more instrument(s).`;
    criticalIssues.push(`Requirement: At least 4 distinct instrument/input sources must be selected.`);
  }

  // ==================== 2. SIGNAL CHAIN & CABLE COMPLETENESS (25 pts) ====================
  const signalChainScore: RubricCategoryScore = {
    name: 'Signal Chain & Cable Routing',
    score: 0,
    maxScore: 25,
    passed: false,
    status: 'error',
    feedback: '',
    details: [],
  };

  if (placedInstruments.length === 0 && placedMics.length === 0 && placedDIs.length === 0) {
    signalChainScore.status = 'not_applicable';
    signalChainScore.score = 0;
    signalChainScore.passed = true;
    signalChainScore.feedback = 'Not Applicable: Place instruments or microphones to establish audio signal chains.';
  } else {
    let chainPoints = 0;
    const maxChainPoints = 25;
    const chainIssues: string[] = [];

    placedInstruments.forEach((inst) => {
      const status = getInstrumentSignalChainStatus(inst, placedGear, connections, mixerChannels, environment);
      if (status.valid) {
        chainPoints += 5;
        const def = getGearById(inst.gearId);
        positives.push(`${def?.name || 'Instrument'} signal chain is verified & patched.`);
      } else if (status.error) {
        chainIssues.push(status.error);
      }
    });

    // Check XLR lines from Mics, DIs, and Bass Amps
    const activeSources = [...placedMics, ...placedDIs];
    let xlrConnectedCount = 0;
    activeSources.forEach((src) => {
      const hasXlr =
        connections.some(
          (c) =>
            (c.fromInstanceId === src.instanceId || c.toInstanceId === src.instanceId) &&
            c.cableType === 'xlr'
        ) || (src.assignedChannel && src.assignedChannel > 0);

      if (hasXlr) {
        xlrConnectedCount++;
      }
    });

    if (activeSources.length > 0) {
      const xlrRatio = xlrConnectedCount / activeSources.length;
      chainPoints += Math.round(xlrRatio * 5);
      if (xlrRatio < 0.7) {
        chainIssues.push(`Connect your microphones and DI boxes with XLR cables to the snake / interface.`);
      }
    }

    signalChainScore.score = Math.min(maxChainPoints, Math.max(0, chainPoints));
    signalChainScore.passed = signalChainScore.score >= 18;
    signalChainScore.status = signalChainScore.score >= 22 ? 'perfect' : signalChainScore.score >= 15 ? 'warning' : 'error';
    signalChainScore.feedback =
      chainIssues.length === 0
        ? 'All instrument signal paths, 1/4" lines, and XLR cables are wired correctly!'
        : chainIssues.join(' ');
    if (chainIssues.length > 0) {
      criticalIssues.push(...chainIssues);
    }
  }

  // ==================== 3. MICROPHONE SELECTION & SUITABILITY (25 pts) ====================
  const micScore: RubricCategoryScore = {
    name: 'Microphone & Transducer Selection',
    score: 0,
    maxScore: 25,
    passed: false,
    status: 'error',
    feedback: '',
    details: [],
  };

  if (placedMics.length === 0) {
    micScore.status = 'not_applicable';
    micScore.score = 0;
    micScore.passed = true;
    micScore.feedback = 'Not Applicable: No microphones currently placed on the plot.';
  } else {
    let micPoints = 25;
    const micWarnings: string[] = [];

    // Check for direct micing of electric or bass guitar (Forbidden!)
    placedMics.forEach((mic) => {
      const def = getGearById(mic.gearId);
      const target = getMicTarget(mic);
      if (target) {
        if (target.gearId === 'inst_electric_guitar' || target.gearId === 'inst_bass_guitar') {
          micPoints -= 6;
          const msg = `Invalid Mic Placement: Electric Guitar and Bass Guitar produce an electronic output and cannot be miked directly. Plug the instrument into an amplifier (and mic the amp) or use a DI Box.`;
          micWarnings.push(msg);
          criticalIssues.push(msg);
        }

        if (mic.gearId === 'mic_e604') {
          if (target.gearId === 'inst_tom_drum' || target.gearId === 'inst_snare_drum') {
            positives.push('Sennheiser e604 clip-on dynamic mic selected for drums/percussion.');
          }
        }
      } else {
        if (def) {
          if (def.transducerType === 'condenser_large' || def.transducerType === 'condenser_small') {
            positives.push(`Room Mic: ${def.name} condenser mic deployed to capture natural acoustic space & room ambience.`);
          } else {
            suggestions.push(`Room Mic Tip: Condenser microphones (like AKG C214 or AT2035) offer greater sensitivity and transient capture for Room Mics.`);
          }
        }
      }
    });

    // Check live vs studio vocal mic choice
    const vocalInst = placedInstruments.find((i) => i.gearId === 'inst_voice');
    if (vocalInst) {
      const vocalMics = placedMics.filter((m) => getMicTarget(m)?.gearId === 'inst_voice');
      const hasLDC = vocalMics.some((m) => {
        const def = getGearById(m.gearId);
        return def?.transducerType === 'condenser_large' || m.gearId === 'mic_c214' || m.gearId === 'mic_at2020' || m.gearId === 'mic_at2035';
      });
      const hasSDC = vocalMics.some((m) => {
        const def = getGearById(m.gearId);
        return def?.transducerType === 'condenser_small' || m.gearId === 'mic_sm81' || m.gearId === 'mic_adx51';
      });
      const hasSM58 = vocalMics.some((m) => m.gearId === 'mic_sm58');
      const hasBeta52 = vocalMics.some((m) => m.gearId === 'mic_beta52a');

      if (hasBeta52) {
        micPoints -= 5;
        const msg = 'Incompatible Mic: Shure Beta 52A is tailored specifically for Kick Drum and should not be used on Vocals.';
        micWarnings.push(msg);
        criticalIssues.push(msg);
      }

      if (hasSDC) {
        micPoints -= 4;
        const msg = 'Incompatible Mic: Small diaphragm condensers are generally unsuitable for lead vocals due to their narrow transient response and lack of warm vocal body. Use a large diaphragm condenser.';
        micWarnings.push(msg);
        criticalIssues.push(msg);
      }

      if (environment === 'live_stage') {
        if (hasLDC && !hasSM58) {
          micPoints -= 3;
          micWarnings.push(
            'Live Stage Notice: Large diaphragm condensers are prone to acoustic feedback on live stages. An SM58 dynamic mic is standard for live vocals.'
          );
        } else if (hasSM58) {
          positives.push('Great choice using a Shure SM58 dynamic mic for live vocals.');
        }
      } else {
        // Studio environment
        if (hasSM58) {
          micPoints -= 4;
          const msg = 'Studio Vocal Notice: Although it has been done, SM58s in general don’t have the hi-end crispiness that gives a vocal its presence, so it would not be the standard choice for most voices in the studio. Use a large diaphragm condenser (C214, AT2035).';
          micWarnings.push(msg);
          criticalIssues.push(msg);
        } else if (hasLDC) {
          positives.push('Excellent choice using a studio large-diaphragm condenser for pristine vocal capture.');
        }
      }
    }

    // Check Kick Drum mic
    const drumInst = placedInstruments.find((i) => i.gearId === 'inst_kick_drum');
    if (drumInst) {
      const kickMics = placedMics.filter((m) => {
        const t = getMicTarget(m);
        return t?.gearId === 'inst_kick_drum';
      });
      const hasBeta52 = kickMics.some((m) => m.gearId === 'mic_beta52a');
      const hasLDCOnKick = kickMics.some((m) => {
        const def = getGearById(m.gearId);
        return def?.transducerType === 'condenser_large' || m.gearId === 'mic_c214' || m.gearId === 'mic_at2020' || m.gearId === 'mic_at2035';
      });
      const hasSDCOnKick = kickMics.some((m) => {
        const def = getGearById(m.gearId);
        return def?.transducerType === 'condenser_small' || m.gearId === 'mic_sm81' || m.gearId === 'mic_adx51';
      });
      const hasSM58OnKick = kickMics.some((m) => m.gearId === 'mic_sm58');

      if (hasSM58OnKick) {
        micPoints -= 4;
        const msg = 'Incompatible Mic: Shure SM58 lacks the deep low-frequency extension for Kick Drum. Use a Shure Beta 52A or Large Diaphragm Condenser.';
        micWarnings.push(msg);
        criticalIssues.push(msg);
      }

      if (hasSDCOnKick) {
        micPoints -= 4;
        const msg = 'Incompatible Mic: Small diaphragm condensers should not be used on kick drum as they lack the diaphragm excursion and low-end punch. Use a Shure Beta 52A or Large Diaphragm Condenser.';
        micWarnings.push(msg);
        criticalIssues.push(msg);
      }

      if (hasBeta52) {
        positives.push('Shure Beta 52A selected for kick drum (tuned low-frequency punch).');
      } else if (hasLDCOnKick && environment !== 'live_stage') {
        positives.push('Large diaphragm condenser accepted on kick drum in the studio setting.');
      }
    }

    // Check Acoustic Guitar mic choice
    const acousticInst = placedInstruments.find((i) => i.gearId === 'inst_acoustic_guitar');
    if (acousticInst) {
      const acousticMics = placedMics.filter((m) => getMicTarget(m)?.gearId === 'inst_acoustic_guitar');
      const hasBeta52OnAcoustic = acousticMics.some((m) => m.gearId === 'mic_beta52a');
      const hasSM58OnAcoustic = acousticMics.some((m) => m.gearId === 'mic_sm58');
      const hasOptimalCondenser = acousticMics.some(
        (m) =>
          m.gearId === 'mic_sm81' ||
          m.gearId === 'mic_adx51' ||
          m.gearId === 'mic_c214' ||
          m.gearId === 'mic_at2035'
      );

      if (hasBeta52OnAcoustic) {
        micPoints -= 5;
        const msg =
          'Incompatible Mic: Shure Beta 52A is a kick & bass-centric microphone with scooped mids and massive low-end boost, making it completely unsuitable for Acoustic Guitar. Use a small diaphragm condenser (SM81/ADX51) or large diaphragm condenser (C214/AT2035).';
        micWarnings.push(msg);
        criticalIssues.push(msg);
      }
      if (hasSM58OnAcoustic) {
        micPoints -= 4;
        const msg =
          'Incompatible Mic: Shure SM58 is a handheld dynamic vocal microphone. While rugged for live vocals, it lacks the high-frequency air, transient detail, and frequency response required for Acoustic Guitar. Use an SM81 or C214 condenser.';
        micWarnings.push(msg);
        criticalIssues.push(msg);
      }
      if (hasOptimalCondenser && !hasBeta52OnAcoustic && !hasSM58OnAcoustic) {
        positives.push('Condenser microphone (SM81, ADX51, or C214) correctly selected for Acoustic Guitar transients and harmonics.');
      }
    }

    // Check Double Bass mic choice
    const doubleBassInst = placedInstruments.find((i) => i.gearId === 'inst_double_bass');
    if (doubleBassInst) {
      const dbMics = placedMics.filter((m) => getMicTarget(m)?.instanceId === doubleBassInst.instanceId);
      const hasBadMic = dbMics.some((m) => m.gearId === 'mic_sm58' || m.gearId === 'mic_sm57' || m.gearId === 'mic_sm81' || m.gearId === 'mic_adx51');
      if (hasBadMic) {
        micPoints -= 5;
        const msg = 'Incompatible Mic for Double Bass: SM58, SM57, and small diaphragm condensers are unsuitable for double bass due to lack of deep woody body response. Use a Large Diaphragm Condenser, Beta 52A, or 1/4" DI Box output.';
        micWarnings.push(msg);
        criticalIssues.push(msg);
      }
    }

    // Check Piano & Delicate Strings (Violin, Cello, Piano)
    const delicateInsts = placedInstruments.filter(
      (i) =>
        i.gearId === 'inst_violin' ||
        i.gearId === 'inst_cello' ||
        i.gearId === 'inst_acoustic_piano'
    );
    delicateInsts.forEach((inst) => {
      const instMics = placedMics.filter((m) => getMicTarget(m)?.instanceId === inst.instanceId);
      const hasDynamicOrBeta = instMics.some((m) => m.gearId === 'mic_beta52a' || m.gearId === 'mic_sm58' || m.gearId === 'mic_sm57');
      if (hasDynamicOrBeta) {
        micPoints -= 5;
        const def = getGearById(inst.gearId);
        const msg = `Incompatible Mic: SM58, SM57, or Beta 52A are not suitable for ${
          def?.name || 'delicate acoustic instruments'
        } especially in the studio. Their lack of high-end detail and need for close proximity make them sub-optimal. Use studio condensers (SM81, ADX51, C214).`;
        micWarnings.push(msg);
        criticalIssues.push(msg);
      }
    });

    // Check Choir
    const choirInst = placedInstruments.find((i) => i.gearId === 'inst_choir');
    if (choirInst) {
      const choirMics = placedMics.filter((m) => getMicTarget(m)?.instanceId === choirInst.instanceId);
      const hasCondenser = choirMics.some((m) => {
        const def = getGearById(m.gearId);
        return def?.transducerType === 'condenser_large' || def?.transducerType === 'condenser_small';
      });
      if (choirMics.length > 0 && !hasCondenser) {
        micPoints -= 4;
        const msg = 'Choir Mic Notice: For a choir, condenser microphones (LDC or SDC) should be used to capture the ensemble resonance and wide soundstage accurately.';
        micWarnings.push(msg);
      }
    }

    // Check Brass & Woodwinds (Trumpet, Saxophone, Flute)
    const hornWoodwindInsts = placedInstruments.filter(
      (i) => i.gearId === 'inst_trumpet' || i.gearId === 'inst_saxophone' || i.gearId === 'inst_flute'
    );
    hornWoodwindInsts.forEach((inst) => {
      const instMics = placedMics.filter((m) => getMicTarget(m)?.instanceId === inst.instanceId);
      const hasDynamic = instMics.some((m) => m.gearId === 'mic_sm57' || m.gearId === 'mic_sm58');
      if (environment === 'live_stage') {
        if (hasDynamic) {
          positives.push('Dynamic mic (SM57/SM58) correctly selected for horn/woodwind on live stage.');
        }
      } else {
        // Studio
        if (hasDynamic) {
          micPoints -= 4;
          const def = getGearById(inst.gearId);
          const msg = `Studio Horn/Woodwind Notice: In the studio, dynamic mics like SM57/SM58 on ${def?.name || 'horns/woodwinds'} lack pristine air and detail. Condensers (C214, SM81) are preferred.`;
          micWarnings.push(msg);
        }
      }
    });

    // Check Amp micing
    placedAmps.forEach((amp) => {
      const ampMics = placedMics.filter((m) => getMicTarget(m)?.instanceId === amp.instanceId);
      const hasDynMic = ampMics.some((m) => m.gearId === 'mic_sm57' || m.gearId === 'mic_sm58' || m.gearId === 'mic_e604');
      const hasLDCOnAmp = ampMics.some((m) => {
        const def = getGearById(m.gearId);
        return def?.transducerType === 'condenser_large' || m.gearId === 'mic_c214' || m.gearId === 'mic_at2020' || m.gearId === 'mic_at2035';
      });
      const hasBeta52OnGtr = ampMics.some((m) => m.gearId === 'mic_beta52a');

      if (amp.gearId === 'gear_guitar_amp') {
        if (hasBeta52OnGtr) {
          micPoints -= 3;
          micWarnings.push('Beta 52A is tailored for kick drums and has a scooped mid EQ not suitable for guitar amp cabs. Use an SM57.');
        }
        if (environment === 'live_stage' && hasLDCOnAmp) {
          micPoints -= 4;
          const msg = 'Live Stage Amp Warning: Large diaphragm condensers should not be used on guitar cabinets on live stages due to severe stage bleed from nearby drums. Use a Shure SM57 dynamic mic.';
          micWarnings.push(msg);
          criticalIssues.push(msg);
        }
        if (!hasDynMic && !hasBeta52OnGtr && !(environment !== 'live_stage' && hasLDCOnAmp)) {
          micWarnings.push('Remember to place a dynamic mic (like Shure SM57) in front of the guitar amp speaker grille.');
          micPoints -= 3;
        }
      }
    });

    // Check Cymbals (Requires 2 microphones for stereo overheads)
    const cymbalsInst = placedInstruments.filter((i) => i.gearId === 'inst_drum_cymbals' || i.gearId === 'inst_cymbals');
    cymbalsInst.forEach((cymbal) => {
      const cymbalsMics = placedMics.filter((m) => getMicTarget(m)?.instanceId === cymbal.instanceId);
      if (cymbalsMics.length < 2) {
        micPoints -= 5;
        const msg = 'While sometimes only one microphone is acceptable for a mono overhead, for the purposes of this assignment, we are using the very standard process of utilizing two microphones to capture a stereo image of the drum with the overheads.';
        micWarnings.push(msg);
        criticalIssues.push(msg);
      } else {
        positives.push('Stereo Overhead Pair: Two microphones assigned to Cymbals/Overhead to capture a wide stereo drum image.');
      }
    });

    micScore.score = Math.max(0, micPoints);
    micScore.passed = micScore.score >= 18;
    micScore.status = micScore.score >= 22 ? 'perfect' : micScore.score >= 15 ? 'warning' : 'error';
    micScore.feedback = micWarnings.length === 0 ? 'Optimal microphone models selected for your instruments!' : micWarnings.join(' ');
    if (micWarnings.length > 0) suggestions.push(...micWarnings);
  }

  // ==================== 4. PHANTOM POWER (+48V) LOGIC (15 pts) ====================
  const phantomScore: RubricCategoryScore = {
    name: '+48V Phantom Power Management',
    score: 0,
    maxScore: 15,
    passed: false,
    status: 'error',
    feedback: '',
    details: [],
  };

  const phantomRequiringGear = [...placedMics, ...placedDIs].filter((item) => {
    const def = getGearById(item.gearId);
    return def?.requiresPhantomPower;
  });

  if (phantomRequiringGear.length === 0) {
    phantomScore.status = 'not_applicable';
    phantomScore.score = 0;
    phantomScore.passed = true;
    phantomScore.feedback = 'Not Applicable: No condenser microphones or equipment requiring +48V Phantom Power are currently placed on the plot.';
  } else {
    let phantomPoints = 15;
    const phantomIssues: string[] = [];

    phantomRequiringGear.forEach((mic) => {
      const def = getGearById(mic.gearId);
      if (!def) return;

      if (def.requiresPhantomPower) {
        const channel = mixerChannels.find(
          (ch) => ch.assignedGearInstanceId === mic.instanceId || ch.channelNumber === mic.assignedChannel
        );

        if (channel) {
          if (!channel.phantomPower) {
            phantomPoints -= 4;
            phantomIssues.push(
              `${def.name} on Channel ${channel.channelNumber} is a condenser mic and REQUIRES +48V Phantom Power turned ON!`
            );
          } else {
            positives.push(`+48V Phantom Power engaged for ${def.name} on Ch ${channel.channelNumber}.`);
          }
        } else {
          phantomPoints -= 2;
          phantomIssues.push(`${def.name} needs to be assigned to a snake channel with +48V enabled.`);
        }
      }
    });

    phantomScore.score = Math.max(0, phantomPoints);
    phantomScore.passed = phantomScore.score >= 12;
    phantomScore.status = phantomScore.score >= 14 ? 'perfect' : phantomScore.score >= 9 ? 'warning' : 'error';
    phantomScore.feedback =
      phantomIssues.length === 0
        ? '+48V Phantom Power correctly supplied to all active condenser microphones.'
        : phantomIssues.join(' ');
    if (phantomIssues.length > 0) criticalIssues.push(...phantomIssues);
  }

  // ==================== 5. STANDS, HEIGHTS & ACCESSORIES (10 pts) ====================
  const standsScore: RubricCategoryScore = {
    name: 'Mic Stands, Placement & Accessories',
    score: 0,
    maxScore: 10,
    passed: false,
    status: 'error',
    feedback: '',
    details: [],
  };

  if (placedMics.length === 0) {
    standsScore.status = 'not_applicable';
    standsScore.score = 0;
    standsScore.passed = true;
    standsScore.feedback = 'Not Applicable: No microphones placed on plot to configure stands or accessories.';
  } else {
    let standPoints = 10;
    const standIssues: string[] = [];
    const vocalInst = placedInstruments.find((i) => i.gearId === 'inst_voice');

    // Pop filter check
    placedGear.forEach((gear) => {
      if (gear.hasPopFilter) {
        const target = getMicTarget(gear);
        const isStudioVocal =
          environment === 'recording_studio' &&
          (target?.gearId === 'inst_voice' || (!target && (gear.gearId === 'mic_c214' || gear.gearId === 'mic_at2035')));
        if (!isStudioVocal) {
          standPoints -= 2;
          const msg =
            'Unnecessary Pop Filter: Pop filters are only used for studio vocal recording to eliminate plosives. Remove pop filter from instruments, room mics, or live stage setups.';
          standIssues.push(msg);
          criticalIssues.push(msg);
        }
      }
    });

    // Studio vocal missing pop filter
    if (environment === 'recording_studio' && vocalInst) {
      const vocalMics = placedMics.filter((m) => getMicTarget(m)?.gearId === 'inst_voice');
      const vocalCondenser = vocalMics.find((m) => {
        const def = getGearById(m.gearId);
        return def?.transducerType === 'condenser_large' || m.gearId === 'mic_c214' || m.gearId === 'mic_at2020' || m.gearId === 'mic_at2035';
      });
      if (vocalCondenser && !vocalCondenser.hasPopFilter) {
        standPoints -= 2;
        standIssues.push('Studio Vocal Recording: A Pop Filter is required in front of the condenser mic to prevent plosive distortion.');
      } else if (vocalCondenser && vocalCondenser.hasPopFilter) {
        positives.push('Studio Pop Filter deployed in front of vocal condenser mic.');
      }
    }

    // Stand height checks
    placedMics.forEach((mic) => {
      const def = getGearById(mic.gearId);
      if (!def) return;
      const target = getMicTarget(mic);

      if (!mic.standHeight) {
        standPoints -= 1;
        standIssues.push(`${def.name} missing Mic Stand height selection.`);
      } else {
        if (
          target?.gearId === 'inst_voice' &&
          (mic.standHeight === 'amp_low' || mic.standHeight === 'drum_overhead' || mic.standHeight === 'clipped')
        ) {
          standPoints -= 2;
          standIssues.push('Vocal mic stand should be set to Standing Vocal or Seated height.');
        } else if (
          (target?.gearId === 'gear_guitar_amp' || target?.gearId === 'inst_kick_drum') &&
          mic.standHeight !== 'amp_low'
        ) {
          standPoints -= 2;
          standIssues.push(`Microphone on ${target.gearId === 'gear_guitar_amp' ? 'guitar amp' : 'kick drum'} must use Floor/Amp Low stand height.`);
        } else if (
          (target?.gearId === 'inst_tom_drum' || target?.gearId === 'inst_snare_drum') &&
          mic.gearId === 'mic_e604' &&
          (mic.standHeight === 'clipped' || mic.standHeight === 'mounted')
        ) {
          positives.push('Sennheiser e604 quick-mount rim clip securely attached to drum hoop.');
        }
      }
    });

    // Studio Headphones check (Recording Studio mode: every instrument/performer must have headphones assigned)
    if (environment === 'recording_studio' && placedInstruments.length > 0) {
      let unassignedCount = 0;
      const hasDrummerHeadphones = placedHeadphones.some(
        (hp) => hp.latchedSourceInstanceId === 'drummer' || hp.latchedSourceInstanceId === 'inst_drum_set'
      );

      placedInstruments.forEach((inst) => {
        const isDrumPiece =
          inst.gearId === 'inst_kick_drum' ||
          inst.gearId === 'inst_snare_drum' ||
          inst.gearId === 'inst_tom_drum' ||
          inst.gearId === 'inst_drum_cymbals' ||
          inst.gearId === 'inst_hi_hat' ||
          inst.gearId === 'inst_drum_set';

        if (isDrumPiece && hasDrummerHeadphones) {
          return; // Drummer assignment satisfies all kit pieces!
        }

        const hasHeadphones = placedHeadphones.some(
          (hp) =>
            hp.latchedSourceInstanceId === inst.instanceId ||
            Math.hypot(hp.x - inst.x, hp.y - inst.y) < 95
        );
        if (!hasHeadphones) {
          unassignedCount++;
        }
      });

      if (unassignedCount > 0) {
        standPoints -= Math.min(3, unassignedCount);
        const msg = `Recording Studio: Place and assign Studio Headphones to each musician/instrument (${unassignedCount} performer(s) need headphones for tracking foldback).`;
        standIssues.push(msg);
      } else {
        positives.push('Studio Headphones assigned to all musicians on the floor.');
      }
    }

    standsScore.score = Math.max(0, standPoints);
    standsScore.passed = standsScore.score >= 8;
    standsScore.status = standsScore.score >= 9 ? 'perfect' : standsScore.score >= 6 ? 'warning' : 'error';
    standsScore.feedback =
      standIssues.length === 0
        ? 'Mic stands, heights, and accessories are configured accurately!'
        : standIssues.join(' ');
    if (standIssues.length > 0) suggestions.push(...standIssues);
  }

  // ==================== 6. CONSOLE / SNAKE ROUTING (5 pts) ====================
  const mixerScore: RubricCategoryScore = {
    name: 'Console / Snake Channel Patching',
    score: 0,
    maxScore: 5,
    passed: false,
    status: 'error',
    feedback: '',
    details: [],
  };

  if (placedMics.length === 0 && placedDIs.length === 0) {
    mixerScore.status = 'not_applicable';
    mixerScore.score = 0;
    mixerScore.passed = true;
    mixerScore.feedback = 'Not Applicable: Place microphones or direct boxes to route into the snake/mixer.';
  } else {
    const assignedCount = mixerChannels.filter((ch) => ch.assignedGearInstanceId !== null).length;
    if (assignedCount >= 4) {
      mixerScore.score = 5;
      mixerScore.passed = true;
      mixerScore.status = 'perfect';
      mixerScore.feedback = `All ${assignedCount} active channels are patched cleanly on the snake and console.`;
    } else if (assignedCount >= 2) {
      mixerScore.score = 3;
      mixerScore.passed = false;
      mixerScore.status = 'warning';
      mixerScore.feedback = `You have ${assignedCount} channels patched. Route your remaining inputs into the snake.`;
    } else {
      mixerScore.score = 1;
      mixerScore.passed = false;
      mixerScore.status = 'error';
      mixerScore.feedback = `Connect microphones / DIs to the snake channels.`;
    }
  }

  // ==================== 7. PA SPEAKER SETUP & PATCHING (Live Stage: 10 pts) ====================
  const paScore: RubricCategoryScore = {
    name: 'PA Speaker Setup & Patching',
    score: 0,
    maxScore: 10,
    passed: false,
    status: environment === 'live_stage' ? 'error' : 'not_applicable',
    feedback: '',
    details: [],
  };

  if (environment === 'live_stage') {
    let paPoints = 10;
    const paIssues: string[] = [];

    if (paSpeakers.length === 0) {
      paPoints = 0;
      paIssues.push('Place PA Speakers on the stage plot for audience sound reinforcement.');
    } else if (paSpeakers.length < 2) {
      paPoints = 5;
      paIssues.push('Stereo PA Required: Place both Downstage Left and Downstage Right PA speakers.');
    } else {
      // Check corner placement in bottom 15% (canvas height ~450px, bottom 15% is y >= 340)
      const leftPA = paSpeakers.find((pa) => pa.x < 360);
      const rightPA = paSpeakers.find((pa) => pa.x >= 360);

      paSpeakers.forEach((pa) => {
        // Bottom 15% test: y must be >= 340
        if (pa.y < 340) {
          paPoints -= 3;
          paIssues.push('PA Speaker Placement Error: PA speakers must be positioned in the bottom 15% corner areas of the stage plot.');
        }
      });

      const leftConn = leftPA
        ? connections.find(
            (c) =>
              ((c.fromInstanceId === 'snake_out_main_l' && c.toInstanceId === leftPA.instanceId) ||
                (c.toInstanceId === 'snake_out_main_l' && c.fromInstanceId === leftPA.instanceId)) &&
              c.cableType === 'xlr'
          )
        : null;

      const rightConn = rightPA
        ? connections.find(
            (c) =>
              ((c.fromInstanceId === 'snake_out_main_r' && c.toInstanceId === rightPA.instanceId) ||
                (c.toInstanceId === 'snake_out_main_r' && c.fromInstanceId === rightPA.instanceId)) &&
              c.cableType === 'xlr'
          )
        : null;

      if (!leftConn) {
        paPoints -= 3;
        paIssues.push('Left PA Speaker must be connected via XLR to Snake MAIN L output.');
      }
      if (!rightConn) {
        paPoints -= 3;
        paIssues.push('Right PA Speaker must be connected via XLR to Snake MAIN R output.');
      }

      if (leftConn && rightConn && paSpeakers.every((p) => p.y >= 340)) {
        positives.push('FOH Main Stereo PA Speakers positioned in bottom corners and connected via XLR.');
      }
    }

    paScore.score = Math.max(0, paPoints);
    paScore.passed = paScore.score >= 8;
    paScore.status = paScore.score >= 9 ? 'perfect' : paScore.score >= 5 ? 'warning' : 'error';
    paScore.feedback = paIssues.length === 0 ? 'PA Speakers configured & wired correctly in downstage corners.' : paIssues.join(' ');
    if (paIssues.length > 0) criticalIssues.push(...paIssues);
  }

  // ==================== 8. MONITOR SETUP & PATCHING (Live Stage: 10 pts) ====================
  const monitorScore: RubricCategoryScore = {
    name: 'Monitor Setup & Patching',
    score: 0,
    maxScore: 10,
    passed: false,
    status: environment === 'live_stage' ? 'error' : 'not_applicable',
    feedback: '',
    details: [],
  };

  if (environment === 'live_stage') {
    let monPoints = 10;
    const monIssues: string[] = [];

    // Stage Monitors check
    stageMonitors.forEach((mon) => {
      const monConn = connections.find(
        (c) =>
          ((c.fromInstanceId === 'snake_out_mon1' && c.toInstanceId === mon.instanceId) ||
            (c.toInstanceId === 'snake_out_mon1' && c.fromInstanceId === mon.instanceId) ||
            (c.fromInstanceId === 'snake_out_mon2' && c.toInstanceId === mon.instanceId) ||
            (c.toInstanceId === 'snake_out_mon2' && c.fromInstanceId === mon.instanceId)) &&
          c.cableType === 'xlr'
      );
      if (!monConn) {
        monPoints -= 3;
        monIssues.push('Stage Monitor speaker requires an XLR connection to Snake MON 1 or MON 2 output.');
      }
    });

    // IEM Base Station Transmitter check
    iemTransmitters.forEach((tx) => {
      const txConn = connections.find(
        (c) =>
          ((c.fromInstanceId === 'snake_out_mon1' && c.toInstanceId === tx.instanceId) ||
            (c.toInstanceId === 'snake_out_mon1' && c.fromInstanceId === tx.instanceId) ||
            (c.fromInstanceId === 'snake_out_mon2' && c.toInstanceId === tx.instanceId) ||
            (c.toInstanceId === 'snake_out_mon2' && c.fromInstanceId === tx.instanceId)) &&
          c.cableType === 'xlr'
      );
      if (!txConn) {
        monPoints -= 3;
        monIssues.push('Wireless IEM Rack/Transmitter base unit requires an XLR connection from Snake MON 1 or MON 2 output.');
      }
    });

    // Wireless IEM pairing check (Rack/Transmitter + Bodypack/Receiver)
    iemTransmitters.forEach((tx) => {
      if (!tx.latchedSourceInstanceId) {
        monPoints -= 2;
        monIssues.push('Wireless IEM Rack/Transmitter must be assigned to a performer to transmit their monitor mix.');
      } else {
        const hasMatchingBodypack = iemBodypacks.some((bp) => bp.latchedSourceInstanceId === tx.latchedSourceInstanceId);
        if (!hasMatchingBodypack) {
          monPoints -= 3;
          monIssues.push(
            'Incomplete Wireless System: A wireless system needs both a bodypack for the performer to wear as well as a receiver to connect that to the signal from the snake.'
          );
        }
      }
    });

    iemBodypacks.forEach((bp) => {
      if (!bp.latchedSourceInstanceId) {
        monPoints -= 2;
        monIssues.push('Wireless IEM Bodypack/Receiver must be assigned to a performer to wear.');
      } else {
        const hasMatchingTransmitter = iemTransmitters.some((tx) => tx.latchedSourceInstanceId === bp.latchedSourceInstanceId);
        if (!hasMatchingTransmitter) {
          monPoints -= 3;
          monIssues.push(
            'Incomplete Wireless System: A wireless system needs both a bodypack for the performer to wear as well as a receiver to connect that to the signal from the snake.'
          );
        }
      }
    });

    if (stageMonitors.length === 0 && iemTransmitters.length === 0 && iemBodypacks.length === 0) {
      monPoints = 5;
      suggestions.push('Live Stage Tip: Add Stage Monitors or Wireless IEMs so performers can hear their mix on stage.');
    }

    monitorScore.score = Math.max(0, monPoints);
    monitorScore.passed = monitorScore.score >= 8;
    monitorScore.status = monitorScore.score >= 9 ? 'perfect' : monitorScore.score >= 5 ? 'warning' : 'error';
    monitorScore.feedback = monIssues.length === 0 ? 'Foldback monitors & IEMs patched cleanly to snake aux outputs.' : monIssues.join(' ');
    if (monIssues.length > 0) criticalIssues.push(...monIssues);
  }

  // Calculate total (out of applicable categories)
  const allCategories = [
    minInputsScore,
    signalChainScore,
    micScore,
    phantomScore,
    standsScore,
    mixerScore,
    environment === 'live_stage' ? paScore : null,
    environment === 'live_stage' ? monitorScore : null,
  ].filter(Boolean) as RubricCategoryScore[];

  let totalScore = 0;
  let maxTotalScore = 0;

  allCategories.forEach((cat) => {
    if (cat.status !== 'not_applicable') {
      totalScore += cat.score;
      maxTotalScore += cat.maxScore;
    }
  });

  const percentage =
    maxTotalScore > 0 ? Math.min(100, Math.max(0, Math.round((totalScore / maxTotalScore) * 100))) : 0;

  // Specific Grade Labels:
  // "That's what I'm talking about!" (A / 90-100%)
  // "Just a few more things" (B / 80-89%)
  // "Getting there" (C / 70-79%)
  // "Long way to go" (D / 60-69%)
  // "Not good enough" (F / <60%)
  let gradeLetter = 'F';
  let gradePhrase = 'Not good enough';

  if (percentage >= 90) {
    gradeLetter = 'A';
    gradePhrase = "That's what I'm talking about!";
  } else if (percentage >= 80) {
    gradeLetter = 'B';
    gradePhrase = 'Just a few more things';
  } else if (percentage >= 70) {
    gradeLetter = 'C';
    gradePhrase = 'Getting there';
  } else if (percentage >= 60) {
    gradeLetter = 'D';
    gradePhrase = 'Long way to go';
  } else {
    gradeLetter = 'F';
    gradePhrase = 'Not good enough';
  }

  return {
    totalScore,
    maxTotalScore,
    percentage,
    gradeLetter,
    gradePhrase,
    categories: {
      minimumInputs: minInputsScore,
      signalChain: signalChainScore,
      micSelection: micScore,
      phantomPower: phantomScore,
      accessoriesAndStands: standsScore,
      mixerRouting: mixerScore,
      paSpeakerSetup: paScore,
      monitorSetup: monitorScore,
    },
    criticalIssues,
    suggestions,
    positives,
  };
}
