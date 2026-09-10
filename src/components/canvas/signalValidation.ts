import {
  CableConnection,
  CableType,
  EnvironmentMode,
  MixerChannelState,
  PlacedGear,
} from '../../types';
import { getGearById } from '../../data/gearCatalog';
import { isAcousticInstrument } from './canvasMath';

// Signal Flow Validation Logic for Gear-to-Gear
export function validateGearToGearConnection(
  fromItem: PlacedGear,
  toItem: PlacedGear,
  type: CableType
): { valid: boolean; title?: string; error?: string } {
  const fromDef = getGearById(fromItem.gearId);
  const toDef = getGearById(toItem.gearId);
  if (!fromDef || !toDef) return { valid: false, title: 'Unknown Item', error: 'Invalid gear reference.' };

  // Stage Monitor to Stage Monitor (Daisy-Chaining)
  if (fromItem.gearId === 'gear_stage_monitor' && toItem.gearId === 'gear_stage_monitor') {
    if (type !== 'xlr') {
      return {
        valid: false,
        title: 'Incorrect Cable for Stage Monitor Daisy Chain',
        error: 'Stage Monitors daisy-chain using a balanced XLR Cable from the THRU / LINK output to the next monitor IN.',
      };
    }
    return { valid: true };
  }

  // PA Speaker to PA Speaker (Daisy-Chaining)
  if (fromItem.gearId === 'gear_pa_speaker' && toItem.gearId === 'gear_pa_speaker') {
    if (type !== 'xlr') {
      return {
        valid: false,
        title: 'Incorrect Cable for PA Link',
        error: 'PA speakers link together using a balanced XLR Cable from the THRU output to the next speaker input.',
      };
    }
    return { valid: true };
  }

  // Wireless In-Ear Monitor Transmitter to IEM Bodypack
  const isIEMPair =
    (fromItem.gearId === 'gear_iem_transmitter' && (toItem.gearId === 'gear_iem_receiver' || toItem.gearId === 'gear_in_ear_monitors')) ||
    (toItem.gearId === 'gear_iem_transmitter' && (fromItem.gearId === 'gear_iem_receiver' || fromItem.gearId === 'gear_in_ear_monitors'));

  if (isIEMPair) {
    return { valid: true };
  }

  // Check acoustic guitar to DI box (Valid with 1/4" cable)
  const isAcousticGtrToDI =
    (fromItem.gearId === 'inst_acoustic_guitar' && toItem.gearId === 'gear_di_box') ||
    (toItem.gearId === 'inst_acoustic_guitar' && fromItem.gearId === 'gear_di_box');

  if (isAcousticGtrToDI) {
    if (type !== 'quarter_inch') {
      return {
        valid: false,
        title: 'Incorrect Cable for Acoustic Guitar Pickup',
        error: 'Acoustic guitar internal pickups output through a 1/4" TS jack. Use a 1/4" Instrument Cable to connect into the DI Box input.',
      };
    }
    return { valid: true };
  }

  // Check double bass to DI box (Valid with 1/4" cable - piezo pickup)
  const isDoubleBassToDI =
    (fromItem.gearId === 'inst_double_bass' && toItem.gearId === 'gear_di_box') ||
    (toItem.gearId === 'inst_double_bass' && fromItem.gearId === 'gear_di_box');

  if (isDoubleBassToDI) {
    if (type !== 'quarter_inch') {
      return {
        valid: false,
        title: 'Incorrect Cable for Double Bass Pickup',
        error: 'Double Bass piezo pickups output through a 1/4" TS jack. Use a 1/4" Instrument Cable to connect into the DI Box input.',
      };
    }
    return { valid: true };
  }

  // Check double bass to Bass Amp (Valid with 1/4" cable)
  const isDoubleBassToBassAmp =
    (fromItem.gearId === 'inst_double_bass' && toItem.gearId === 'gear_bass_amp') ||
    (toItem.gearId === 'inst_double_bass' && fromItem.gearId === 'gear_bass_amp');

  if (isDoubleBassToBassAmp) {
    if (type !== 'quarter_inch') {
      return {
        valid: false,
        title: 'Incorrect Cable for Double Bass to Amp',
        error: 'Double Bass piezo pickups plug into a Bass Amplifier using a 1/4" TS Instrument Cable.',
      };
    }
    return { valid: true };
  }

  // Check if either is purely acoustic (Voice, Drums, Horns, Violin)
  if (isAcousticInstrument(fromItem.gearId) || isAcousticInstrument(toItem.gearId)) {
    const acoustic = isAcousticInstrument(fromItem.gearId) ? fromDef : toDef;
    return {
      valid: false,
      title: 'Acoustic Sound Source (No Physical Jack)',
      error: `${acoustic.name} is an acoustic sound source and has no cable jack. Place a Microphone in front to capture sound acoustically.`,
    };
  }

  // 1. Electric Guitar to Guitar Amp (Valid with 1/4")
  const isElectricToGtrAmp =
    (fromItem.gearId === 'inst_electric_guitar' && toItem.gearId === 'gear_guitar_amp') ||
    (toItem.gearId === 'inst_electric_guitar' && fromItem.gearId === 'gear_guitar_amp');

  if (isElectricToGtrAmp) {
    if (type !== 'quarter_inch') {
      return {
        valid: false,
        title: 'Incorrect Cable Type for Guitar',
        error: 'Electric Guitars use 1/4" TS Instrument Cables to plug into amplifiers. XLR cables cannot connect directly to electric guitars.',
      };
    }
    return { valid: true };
  }

  // 2. Electric Guitar to DI Box (Valid with 1/4")
  const isElectricToDI =
    (fromItem.gearId === 'inst_electric_guitar' && toItem.gearId === 'gear_di_box') ||
    (toItem.gearId === 'inst_electric_guitar' && fromItem.gearId === 'gear_di_box');

  if (isElectricToDI) {
    if (type !== 'quarter_inch') {
      return {
        valid: false,
        title: 'Incorrect Cable for DI Input',
        error: 'Electric Guitar to DI Box requires a 1/4" TS Instrument Cable.',
      };
    }
    return { valid: true };
  }

  // 3. Bass Guitar to Bass Amp (Valid with 1/4")
  const isBassToBassAmp =
    (fromItem.gearId === 'inst_bass_guitar' && toItem.gearId === 'gear_bass_amp') ||
    (toItem.gearId === 'inst_bass_guitar' && fromItem.gearId === 'gear_bass_amp');

  if (isBassToBassAmp) {
    if (type !== 'quarter_inch') {
      return {
        valid: false,
        title: 'Incorrect Cable for Bass Guitar',
        error: 'Bass guitars plug into bass amplifiers using a 1/4" TS Instrument Cable.',
      };
    }
    return { valid: true };
  }

  // 4. Bass Guitar to DI Box (Valid with 1/4")
  const isBassToDI =
    (fromItem.gearId === 'inst_bass_guitar' && toItem.gearId === 'gear_di_box') ||
    (toItem.gearId === 'inst_bass_guitar' && fromItem.gearId === 'gear_di_box');

  if (isBassToDI) {
    if (type !== 'quarter_inch') {
      return {
        valid: false,
        title: 'Incorrect Cable for Bass DI',
        error: 'Bass guitars plug into a DI Box using a 1/4" TS Instrument Cable.',
      };
    }
    return { valid: true };
  }

  // 5. Keyboard to DI Box (Valid with 1/4")
  const isKeyboardToDI =
    (fromItem.gearId === 'inst_keyboard' && toItem.gearId === 'gear_di_box') ||
    (toItem.gearId === 'inst_keyboard' && fromItem.gearId === 'gear_di_box');

  if (isKeyboardToDI) {
    if (type !== 'quarter_inch') {
      return {
        valid: false,
        title: 'Incorrect Cable for Keyboard',
        error: 'Keyboards have 1/4" unbalanced line outputs. Connect with a 1/4" Instrument Cable into a Direct Box.',
      };
    }
    return { valid: true };
  }

  // 6. Bass Amp Thru/Direct to DI Box (Valid with 1/4")
  const isBassAmpToDI =
    (fromItem.gearId === 'gear_bass_amp' && toItem.gearId === 'gear_di_box') ||
    (toItem.gearId === 'gear_bass_amp' && fromItem.gearId === 'gear_di_box');

  if (isBassAmpToDI) {
    return { valid: true };
  }

  // 7. Microphones directly to instruments or amps (Forbidden: mics capture acoustically!)
  if (fromDef.category === 'microphone' || toDef.category === 'microphone') {
    const mic = fromDef.category === 'microphone' ? fromDef : toDef;
    const other = fromDef.category === 'microphone' ? toDef : fromDef;

    return {
      valid: false,
      title: 'Microphone Signal Routing',
      error: `${mic.name} captures ${other.name} through acoustic sound waves in the air. Aim the mic at ${other.name} on the floor, then run an XLR cable from the microphone to the snake.`,
    };
  }

  // Generic error
  return {
    valid: false,
    title: 'Incompatible Signal Routing',
    error: `Cannot cable ${fromDef.name} directly to ${toDef.name}. Check your signal chain or review the reference guide.`,
  };
}

// Signal Flow Validation Logic for Snake Outputs (Live Stage Returns)
export function validateGearToSnakeOutputConnection(
  outputPort: 'mon1' | 'mon2' | 'main_l' | 'main_r',
  item: PlacedGear,
  type: CableType
): { valid: boolean; title?: string; error?: string } {
  const def = getGearById(item.gearId);
  if (!def) return { valid: false, title: 'Unknown Item', error: 'Invalid gear.' };

  if (type !== 'xlr') {
    return {
      valid: false,
      title: 'Incorrect Cable for Snake Output',
      error: 'Snake output return channels use balanced 3-pin XLR cables to deliver line-level feeds to speakers and monitors.',
    };
  }

  if (outputPort === 'main_l' || outputPort === 'main_r') {
    if (item.gearId !== 'gear_pa_speaker') {
      return {
        valid: false,
        title: 'Main FOH Output Routing',
        error: `Snake ${outputPort === 'main_l' ? 'MAIN LEFT' : 'MAIN RIGHT'} is a speaker line output for Front of House PA Speakers (${def.name} cannot receive main PA feed directly).`,
      };
    }
    return { valid: true };
  }

  if (outputPort === 'mon1' || outputPort === 'mon2') {
    const isMonitorGear =
      item.gearId === 'gear_stage_monitor' ||
      item.gearId === 'gear_iem_transmitter' ||
      item.gearId === 'gear_iem_receiver' ||
      item.gearId === 'gear_in_ear_monitors';

    if (!isMonitorGear) {
      return {
        valid: false,
        title: 'Monitor Aux Output Routing',
        error: `Snake ${outputPort === 'mon1' ? 'MONITOR 1' : 'MONITOR 2'} is an aux monitor send output for Stage Wedge Monitors and Wireless In-Ear Monitor Transmitters.`,
      };
    }
    return { valid: true };
  }

  return { valid: true };
}

// Signal Flow Validation Logic for Snake Inputs (Channels 1-8)
export function validateGearToSnakeConnection(
  item: PlacedGear,
  type: CableType,
  environment: EnvironmentMode
): { valid: boolean; title?: string; error?: string } {
  const def = getGearById(item.gearId);
  if (!def) return { valid: false, title: 'Unknown Item', error: 'Invalid gear.' };

  // 1. Acoustic instruments
  if (isAcousticInstrument(item.gearId)) {
    return {
      valid: false,
      title: 'Acoustic Sound Source (No Cable Jack)',
      error: `${def.name} has no cable output jack. Position a microphone aimed at this instrument, then run an XLR cable from the mic to the snake.`,
    };
  }

  // 2. Electric Guitar directly to snake
  if (item.gearId === 'inst_electric_guitar') {
    return {
      valid: false,
      title: 'High-Impedance Mismatch (Direct Guitar to Snake)',
      error: 'Electric guitars have high-impedance (Hi-Z) unbalanced outputs and cannot plug directly into snake XLR jacks. Plug the guitar into a Guitar Amp (and mic the cabinet) or a DI Box first.',
    };
  }

  // 3. Bass Guitar directly to snake
  if (item.gearId === 'inst_bass_guitar') {
    return {
      valid: false,
      title: 'Direct Bass Connection Error',
      error: 'Bass guitars require a Direct Box (DI Box) or a Bass Amp to balance the signal before connecting to the snake.',
    };
  }

  // 3b. Double Bass directly to snake
  if (item.gearId === 'inst_double_bass') {
    return {
      valid: false,
      title: 'High-Impedance Double Bass Pickup',
      error: 'Upright Double Bass piezo pickups output a high-impedance (Hi-Z) 1/4" signal. Connect via 1/4" cable to a DI Box or Bass Amp first, or place an acoustic microphone (such as an AKG C214) aimed at the bridge/f-hole.',
    };
  }

  // 4. Acoustic Guitar directly to snake
  if (item.gearId === 'inst_acoustic_guitar') {
    return {
      valid: false,
      title: 'Acoustic Guitar Direct Out',
      error: 'Acoustic guitars require a DI Box to convert the high-impedance pickup to a balanced low-impedance XLR signal, or an acoustic microphone placed in front.',
    };
  }

  // 5. Keyboard directly to snake
  if (item.gearId === 'inst_keyboard') {
    return {
      valid: false,
      title: 'Line Signal Level Mismatch',
      error: 'Keyboards output 1/4" line-level signals. Connect via 1/4" cable into a DI Box, then run an XLR cable from the DI Box to the snake.',
    };
  }

  // 6. Guitar Amp directly to snake
  if (item.gearId === 'gear_guitar_amp') {
    return {
      valid: false,
      title: 'Guitar Amp Speaker Cabinet',
      error: 'Guitar amplifier cabinets produce acoustic sound in the room. Position an instrument microphone (such as a Shure SM57) in front of the speaker grille, and connect the microphone to the snake with an XLR cable.',
    };
  }

  // 7. Bass Amp XLR Direct Out to snake (Valid with XLR!)
  if (item.gearId === 'gear_bass_amp') {
    if (type !== 'xlr') {
      return {
        valid: false,
        title: 'Incorrect Cable for Bass Amp Direct Out',
        error: 'Bass Amp Direct Out uses a balanced 3-pin XLR connection. Use an XLR cable from the Cable Hooks to connect to the snake.',
      };
    }
    return { valid: true };
  }

  // 8. Microphones to snake
  if (def.category === 'microphone') {
    if (type !== 'xlr') {
      return {
        valid: false,
        title: 'Incorrect Cable for Microphone',
        error: `Microphones output balanced low-impedance signals on 3-pin XLR jacks. Use an XLR Cable from the Cable Hooks to connect to the ${
          environment === 'recording_studio' ? 'studio snake' : 'stage snake'
        }.`,
      };
    }
    return { valid: true };
  }

  // 9. DI Box to snake
  if (item.gearId === 'gear_di_box') {
    if (type !== 'xlr') {
      return {
        valid: false,
        title: 'Incorrect Cable for DI Output',
        error: 'The output of a DI box is a balanced XLR male jack. Use an XLR Cable from the Cable Hooks to patch into the snake.',
      };
    }
    return { valid: true };
  }

  return { valid: true };
}

// Inspect gear items for missing setup settings or requirements
export function getGearIssues(
  item: PlacedGear,
  placedGear: PlacedGear[],
  mixerChannels: MixerChannelState[],
  connections: CableConnection[],
  environment: EnvironmentMode
): string[] {
  const def = getGearById(item.gearId);
  if (!def) return [];
  const issues: string[] = [];

  const assignedChannel = mixerChannels.find(
    (ch) => ch.assignedGearInstanceId === item.instanceId || ch.channelNumber === item.assignedChannel
  );

  const latchedSource = item.latchedSourceInstanceId
    ? placedGear.find((g) => g.instanceId === item.latchedSourceInstanceId)
    : null;

  const nearbySources = placedGear.filter((g) => {
    if (g.instanceId === item.instanceId) return false;
    const gDef = getGearById(g.gearId);
    if (gDef?.category !== 'instrument' && gDef?.category !== 'amplifier') return false;
    const dx = g.x - item.x;
    const dy = g.y - item.y;
    return Math.hypot(dx, dy) < 140;
  });

  const targetSource = latchedSource || nearbySources[0] || null;

  // ================= 1. MICROPHONES =================
  if (def.category === 'microphone') {
    // Stand height assignment check
    if (!item.standHeight) {
      issues.push('Missing Mic Stand height: select Floor/Amp Low, Seated, Standing, or Overhead');
    }

    // Phantom power for condenser capsules
    if (def.requiresPhantomPower && !assignedChannel?.phantomPower) {
      issues.push('Missing +48V Phantom Power on mixer channel (condenser capsule requires power)');
    }

    // Pop filter validation (Only for studio vocal recording!)
    if (item.hasPopFilter) {
      const isStudioVocal =
        environment === 'recording_studio' &&
        (targetSource?.gearId === 'inst_voice' || (!targetSource && def.id === 'mic_c214'));
      if (!isStudioVocal) {
        issues.push('Unnecessary Pop Filter: Pop filters are only used for studio vocal recording to eliminate plosives.');
      }
    } else {
      if (
        targetSource?.gearId === 'inst_voice' &&
        environment === 'recording_studio' &&
        (def.transducerType === 'condenser_large' || def.id === 'mic_c214' || def.id === 'mic_at2035' || def.id === 'mic_at2020')
      ) {
        issues.push('Missing Pop Filter: Studio vocal condenser recording requires a mesh pop filter.');
      }
    }

    // Sound source targeting check
    const isRoomMic = item.latchedSourceInstanceId === 'room';
    if (!targetSource && !isRoomMic) {
      issues.push('Not positioned near or aimed at any sound source / instrument (or select Room)');
    } else if (targetSource) {
      // FORBIDDEN: Direct micing of electric or bass guitar!
      if (targetSource.gearId === 'inst_electric_guitar' || targetSource.gearId === 'inst_bass_guitar') {
        issues.push(
          'Invalid Mic Placement: Electric Guitar and Bass Guitar produce an electric signal that must be plugged into an amplifier (and miked) or a DI Box.'
        );
      }

      // Target: Vocal
      if (targetSource.gearId === 'inst_voice') {
        if (item.gearId === 'mic_beta52a') {
          issues.push(
            'Incompatible Mic: Shure Beta 52A is tailored specifically for Kick Drum/Bass, not Vocals. Use an SM58, SM7B, or C214.'
          );
        }
        if (environment === 'live_stage' && (def.transducerType === 'condenser_large' || item.gearId === 'mic_c214' || item.gearId === 'mic_at2035' || item.gearId === 'mic_at2020')) {
          issues.push('Live Stage Tip: Large condenser mics are prone to acoustic feedback on live stages. Use a dynamic SM58.');
        }
      }

      // Target: Kick Drum
      if (targetSource.gearId === 'inst_kick_drum') {
        if (item.gearId === 'mic_sm58') {
          issues.push(
            'Incompatible Mic: Shure SM58 has a vocal presence peak and lacks deep low-end punch for Kick Drum. Use a Shure Beta 52A.'
          );
        }
      }

      // Target: Guitar Amp Cab
      if (targetSource.gearId === 'gear_guitar_amp') {
        if (item.gearId === 'mic_beta52a') {
          issues.push('Beta 52A is tuned for low-end kick drums. Use an SM57 for guitar amp speaker cabs.');
        }
      }
    }

    // Patch check
    if (!assignedChannel) {
      issues.push('Not patched to snake (run an XLR cable from this mic to a snake socket)');
    }
  }

  // ================= 2. DI BOXES =================
  if (item.gearId === 'gear_di_box') {
    const hasInputConn = connections.some(
      (c) =>
        c.cableType === 'quarter_inch' &&
        (c.fromInstanceId === item.instanceId || c.toInstanceId === item.instanceId)
    );
    if (!hasInputConn) {
      issues.push('No instrument plugged into DI Box input (connect Bass, Keys, Acoustic Guitar, or Double Bass via 1/4" cable)');
    }
    if (!assignedChannel) {
      issues.push('DI Box XLR output not patched to snake');
    }
  }

  // ================= 3. GUITAR AMPS =================
  if (item.gearId === 'gear_guitar_amp') {
    const hasGtrInput = connections.some(
      (c) =>
        c.cableType === 'quarter_inch' &&
        (c.fromInstanceId === item.instanceId || c.toInstanceId === item.instanceId) &&
        placedGear.find((g) => (g.instanceId === c.fromInstanceId || g.instanceId === c.toInstanceId) && g.instanceId !== item.instanceId)?.gearId === 'inst_electric_guitar'
    );
    if (!hasGtrInput) {
      issues.push('Guitar amp is missing 1/4" cable from Electric Guitar');
    }

    const hasMic = placedGear.some((g) => {
      const gDef = getGearById(g.gearId);
      if (gDef?.category !== 'microphone') return false;
      if (g.latchedSourceInstanceId === item.instanceId) return true;
      return Math.hypot(g.x - item.x, g.y - item.y) < 140;
    });
    if (!hasMic) {
      issues.push('Guitar amp speaker cab must be miked with an instrument dynamic mic (SM57)');
    }
  }

  // ================= 4. BASS AMPS =================
  if (item.gearId === 'gear_bass_amp') {
    const hasBassInput = connections.some(
      (c) =>
        c.cableType === 'quarter_inch' &&
        (c.fromInstanceId === item.instanceId || c.toInstanceId === item.instanceId)
    );
    if (!hasBassInput) {
      issues.push('Bass amp needs 1/4" input from Bass Guitar or Double Bass');
    }
    const hasOutputOrMic =
      assignedChannel !== undefined ||
      placedGear.some((g) => {
        const gDef = getGearById(g.gearId);
        if (gDef?.category !== 'microphone') return false;
        if (g.latchedSourceInstanceId === item.instanceId) return true;
        return Math.hypot(g.x - item.x, g.y - item.y) < 140;
      });
    if (!hasOutputOrMic) {
      issues.push('Bass Amp must either be patched to snake via XLR Direct Out or miked');
    }
  }

  // ================= 5. INSTRUMENTS =================
  if (def.category === 'instrument') {
    if (item.gearId === 'inst_electric_guitar') {
      const hasCable = connections.some(
        (c) =>
          c.cableType === 'quarter_inch' &&
          (c.fromInstanceId === item.instanceId || c.toInstanceId === item.instanceId)
      );
      if (!hasCable) {
        issues.push('Electric Guitar must connect via 1/4" cable to Guitar Amp or DI Box');
      }
    } else if (item.gearId === 'inst_bass_guitar') {
      const hasCable = connections.some(
        (c) =>
          c.cableType === 'quarter_inch' &&
          (c.fromInstanceId === item.instanceId || c.toInstanceId === item.instanceId)
      );
      if (!hasCable) {
        issues.push('Bass Guitar must connect via 1/4" cable to Bass Amp or DI Box');
      }
    } else if (item.gearId === 'inst_keyboard') {
      const hasCable = connections.some(
        (c) =>
          c.cableType === 'quarter_inch' &&
          (c.fromInstanceId === item.instanceId || c.toInstanceId === item.instanceId)
      );
      if (!hasCable) {
        issues.push('Keyboard must be connected to a DI Box with a 1/4" instrument cable');
      }
    } else if (item.gearId === 'inst_acoustic_guitar') {
      const hasDiConn = connections.some(
        (c) =>
          c.cableType === 'quarter_inch' &&
          (c.fromInstanceId === item.instanceId || c.toInstanceId === item.instanceId) &&
          placedGear.find((g) => (g.instanceId === c.fromInstanceId || g.instanceId === c.toInstanceId) && g.instanceId !== item.instanceId)?.gearId === 'gear_di_box'
      );
      const hasMic = placedGear.some((g) => {
        const gDef = getGearById(g.gearId);
        if (gDef?.category !== 'microphone') return false;
        if (g.latchedSourceInstanceId === item.instanceId) return true;
        return Math.hypot(g.x - item.x, g.y - item.y) < 140;
      });
      if (!hasDiConn && !hasMic) {
        issues.push('Acoustic Guitar requires either a microphone positioned in front or a 1/4" line to a DI Box');
      }
    } else if (item.gearId === 'inst_double_bass') {
      const hasDiOrAmpConn = connections.some(
        (c) =>
          c.cableType === 'quarter_inch' &&
          (c.fromInstanceId === item.instanceId || c.toInstanceId === item.instanceId) &&
          placedGear.some(
            (g) =>
              (g.instanceId === c.fromInstanceId || g.instanceId === c.toInstanceId) &&
              g.instanceId !== item.instanceId &&
              (g.gearId === 'gear_di_box' || g.gearId === 'gear_bass_amp')
          )
      );
      const hasMic = placedGear.some((g) => {
        const gDef = getGearById(g.gearId);
        if (gDef?.category !== 'microphone') return false;
        if (g.latchedSourceInstanceId === item.instanceId) return true;
        return Math.hypot(g.x - item.x, g.y - item.y) < 140;
      });
      if (!hasDiOrAmpConn && !hasMic) {
        issues.push('Double Bass requires either a 1/4" cable to a DI Box / Bass Amp (piezo pickup) or an acoustic microphone positioned in front');
      }
    } else {
      // Purely acoustic instruments
      const hasTargetingMic = placedGear.some((g) => {
        const gDef = getGearById(g.gearId);
        if (gDef?.category !== 'microphone') return false;
        if (g.latchedSourceInstanceId === item.instanceId) return true;
        const dx = g.x - item.x;
        const dy = g.y - item.y;
        return Math.hypot(dx, dy) < 140;
      });
      if (!hasTargetingMic) {
        issues.push('No microphone positioned or aimed at this acoustic sound source');
      }
    }
  }

  // ================= 6. MONITORS & SPEAKERS & IEMS =================
  if (item.gearId === 'gear_stage_monitor') {
    const isDirectlyConnectedToSnake = connections.some(
      (c) =>
        c.cableType === 'xlr' &&
        (c.fromInstanceId === 'snake_out_mon1' ||
          c.fromInstanceId === 'snake_out_mon2' ||
          c.toInstanceId === 'snake_out_mon1' ||
          c.toInstanceId === 'snake_out_mon2') &&
        (c.fromInstanceId === item.instanceId || c.toInstanceId === item.instanceId)
    );

    const isDaisyChainedToSnake = connections.some(
      (c) =>
        c.cableType === 'xlr' &&
        (c.fromInstanceId === item.instanceId || c.toInstanceId === item.instanceId) &&
        placedGear.some(
          (other) =>
            other.gearId === 'gear_stage_monitor' &&
            other.instanceId !== item.instanceId &&
            (other.instanceId === c.fromInstanceId || other.instanceId === c.toInstanceId) &&
            connections.some(
              (c2) =>
                c2.cableType === 'xlr' &&
                (c2.fromInstanceId === 'snake_out_mon1' ||
                  c2.fromInstanceId === 'snake_out_mon2' ||
                  c2.toInstanceId === 'snake_out_mon1' ||
                  c2.toInstanceId === 'snake_out_mon2') &&
                (c2.fromInstanceId === other.instanceId || c2.toInstanceId === other.instanceId)
            )
        )
    );

    if (!isDirectlyConnectedToSnake && !isDaisyChainedToSnake) {
      issues.push('Stage Monitor must be patched to a Stage Snake Aux output (MON 1 or MON 2) via XLR cable');
    }
  }

  if (item.gearId === 'gear_pa_speaker') {
    const isDirectlyConnectedToSnake = connections.some(
      (c) =>
        c.cableType === 'xlr' &&
        (c.fromInstanceId === 'snake_out_main_l' ||
          c.fromInstanceId === 'snake_out_main_r' ||
          c.toInstanceId === 'snake_out_main_l' ||
          c.toInstanceId === 'snake_out_main_r') &&
        (c.fromInstanceId === item.instanceId || c.toInstanceId === item.instanceId)
    );

    const isDaisyChainedToSnake = connections.some(
      (c) =>
        c.cableType === 'xlr' &&
        (c.fromInstanceId === item.instanceId || c.toInstanceId === item.instanceId) &&
        placedGear.some(
          (other) =>
            other.gearId === 'gear_pa_speaker' &&
            other.instanceId !== item.instanceId &&
            (other.instanceId === c.fromInstanceId || other.instanceId === c.toInstanceId) &&
            connections.some(
              (c2) =>
                c2.cableType === 'xlr' &&
                (c2.fromInstanceId === 'snake_out_main_l' ||
                  c2.fromInstanceId === 'snake_out_main_r' ||
                  c2.toInstanceId === 'snake_out_main_l' ||
                  c2.toInstanceId === 'snake_out_main_r') &&
                (c2.fromInstanceId === other.instanceId || c2.toInstanceId === other.instanceId)
            )
        )
    );

    if (!isDirectlyConnectedToSnake && !isDaisyChainedToSnake) {
      issues.push('PA Speaker must be patched to Stage Snake Main Output (MAIN L or MAIN R) via XLR cable');
    }
  }

  if (item.gearId === 'gear_in_ear_monitors') {
    const hasMonOut = connections.some(
      (c) =>
        (c.fromInstanceId === 'snake_out_mon1' ||
          c.fromInstanceId === 'snake_out_mon2' ||
          c.toInstanceId === 'snake_out_mon1' ||
          c.toInstanceId === 'snake_out_mon2') &&
        (c.fromInstanceId === item.instanceId || c.toInstanceId === item.instanceId)
    );
    if (!hasMonOut) {
      issues.push('Wired IEM must be patched to a Stage Snake Aux output (MON 1 or MON 2) via XLR cable');
    }
  }

  if (item.gearId === 'gear_iem_receiver') {
    if (!item.latchedSourceInstanceId) {
      issues.push('Wireless IEM Bodypack/Receiver must be assigned to a performer to wear');
    } else {
      const hasMatchingReceiver = placedGear.some(
        (g) =>
          g.gearId === 'gear_iem_transmitter' &&
          g.latchedSourceInstanceId === item.latchedSourceInstanceId
      );
      if (!hasMatchingReceiver) {
        issues.push(
          'A wireless system needs both a bodypack for the performer to wear as well as a receiver to connect that to the signal from the snake'
        );
      }
    }
  }

  if (item.gearId === 'gear_iem_transmitter') {
    if (!item.latchedSourceInstanceId) {
      issues.push('Wireless IEM Rack/Transmitter must be assigned to a performer to transmit their monitor mix');
    } else {
      const hasMatchingBodypack = placedGear.some(
        (g) =>
          (g.gearId === 'gear_iem_receiver' || g.gearId === 'gear_in_ear_monitors') &&
          g.latchedSourceInstanceId === item.latchedSourceInstanceId
      );
      if (!hasMatchingBodypack) {
        issues.push(
          'A wireless system needs both a bodypack for the performer to wear as well as a receiver to connect that to the signal from the snake'
        );
      }
    }

    const hasMonOut = connections.some(
      (c) =>
        c.cableType === 'xlr' &&
        (c.fromInstanceId === 'snake_out_mon1' ||
          c.fromInstanceId === 'snake_out_mon2' ||
          c.toInstanceId === 'snake_out_mon1' ||
          c.toInstanceId === 'snake_out_mon2') &&
        (c.fromInstanceId === item.instanceId || c.toInstanceId === item.instanceId)
    );
    if (!hasMonOut) {
      issues.push('Wireless IEM Rack/Transmitter must be patched to Stage Snake Aux output (MON 1 or MON 2) via XLR cable');
    }
  }

  return issues;
}
