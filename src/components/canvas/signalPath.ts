import {
  CableConnection,
  CableType,
  EnvironmentMode,
  MixerChannelState,
  PlacedGear,
} from '../../types';
import { getGearById } from '../../data/gearCatalog';
import { isAcousticInstrument } from './canvasMath';

export interface SignalPathNode {
  id: string;
  type: 'source' | 'transducer' | 'processor' | 'snake_input' | 'mixer_channel' | 'snake_output' | 'destination';
  label: string;
  subLabel?: string;
  gearId?: string;
  cableTypeToNext?: CableType | 'acoustic' | 'rf' | 'internal';
  channelNumber?: number;
  status?: 'active' | 'warning' | 'muted' | 'unpatched';
  statusText?: string;
}

export interface HighlightedSignalPath {
  selectedGearId: string;
  gearIds: Set<string>;
  connectionIds: Set<string>;
  snakeChannelNumbers: Set<number>;
  snakeOutputPorts: Set<'mon1' | 'mon2' | 'main_l' | 'main_r'>;
  mixerChannelNumbers: Set<number>;
  acousticLinkSourceIds: Set<string>;
  rfLinkTransmitterIds: Set<string>;
  nodes: SignalPathNode[];
  summary: string;
  health: 'healthy' | 'warning' | 'muted' | 'unpatched';
  healthMessage: string;
}

/**
 * Traces the complete upstream and downstream audio signal path for a given selected gear item.
 */
export function traceSignalPath(
  selectedInstanceId: string | null,
  placedGear: PlacedGear[],
  connections: CableConnection[],
  mixerChannels: MixerChannelState[],
  environment: EnvironmentMode
): HighlightedSignalPath | null {
  if (!selectedInstanceId) return null;

  const targetItem = placedGear.find((g) => g.instanceId === selectedInstanceId);
  if (!targetItem) return null;

  const targetDef = getGearById(targetItem.gearId);
  if (!targetDef) return null;

  const gearIds = new Set<string>();
  const connectionIds = new Set<string>();
  const snakeChannelNumbers = new Set<number>();
  const snakeOutputPorts = new Set<'mon1' | 'mon2' | 'main_l' | 'main_r'>();
  const mixerChannelNumbers = new Set<number>();
  const acousticLinkSourceIds = new Set<string>();
  const rfLinkTransmitterIds = new Set<string>();

  gearIds.add(selectedInstanceId);

  // Helper to find all connections involving a gear item
  const getGearConnections = (instId: string) => {
    return connections.filter((c) => c.fromInstanceId === instId || c.toInstanceId === instId);
  };

  // 1. Identify primary Sound Sources (Instruments / Performers)
  const sourceItems: PlacedGear[] = [];
  const transducerItems: PlacedGear[] = [];
  const outputDestinationItems: PlacedGear[] = [];

  // If selected is an instrument/sound source
  if (targetDef.category === 'instrument' || targetDef.category === 'amplifier') {
    sourceItems.push(targetItem);

    // Find microphones or DIs acoustically/physically latched to this instrument
    placedGear.forEach((g) => {
      if (g.latchedSourceInstanceId === targetItem.instanceId) {
        gearIds.add(g.instanceId);
        transducerItems.push(g);
        acousticLinkSourceIds.add(targetItem.instanceId);
      }
    });

    // Find direct cable connections from this instrument (e.g. 1/4" to DI box, amp, or mixer)
    getGearConnections(targetItem.instanceId).forEach((conn) => {
      connectionIds.add(conn.id);
      const otherId = conn.fromInstanceId === targetItem.instanceId ? conn.toInstanceId : conn.fromInstanceId;
      if (otherId.startsWith('snake_in_')) {
        const ch = parseInt(otherId.replace('snake_in_', ''), 10);
        snakeChannelNumbers.add(ch);
      } else {
        const otherGear = placedGear.find((g) => g.instanceId === otherId);
        if (otherGear) {
          gearIds.add(otherGear.instanceId);
          transducerItems.push(otherGear);
        }
      }
    });
  }

  // If selected is a microphone, DI box, or amp
  else if (
    targetDef.category === 'microphone' ||
    targetDef.category === 'di_box' ||
    targetItem.gearId === 'gear_guitar_amp' ||
    targetItem.gearId === 'gear_bass_amp'
  ) {
    transducerItems.push(targetItem);

    // Upstream: latched sound source
    if (targetItem.latchedSourceInstanceId && targetItem.latchedSourceInstanceId !== 'room') {
      const src = placedGear.find((g) => g.instanceId === targetItem.latchedSourceInstanceId);
      if (src) {
        gearIds.add(src.instanceId);
        sourceItems.push(src);
        acousticLinkSourceIds.add(src.instanceId);
      }
    }

    // Upstream: incoming cable connections (e.g. Guitar -> DI or Guitar -> Amp)
    getGearConnections(targetItem.instanceId).forEach((conn) => {
      connectionIds.add(conn.id);
      const otherId = conn.fromInstanceId === targetItem.instanceId ? conn.toInstanceId : conn.fromInstanceId;
      if (otherId.startsWith('snake_in_')) {
        const ch = parseInt(otherId.replace('snake_in_', ''), 10);
        snakeChannelNumbers.add(ch);
      } else {
        const otherGear = placedGear.find((g) => g.instanceId === otherId);
        if (otherGear) {
          gearIds.add(otherGear.instanceId);
          const otherDef = getGearById(otherGear.gearId);
          if (otherDef?.category === 'instrument') {
            sourceItems.push(otherGear);
          } else {
            transducerItems.push(otherGear);
          }
        }
      }
    });
  }

  // If selected is an Output / Monitor / Speaker / IEM
  else if (
    targetDef.category === 'monitor_speaker' ||
    targetItem.gearId === 'gear_iem_transmitter' ||
    targetItem.gearId === 'gear_iem_receiver' ||
    targetItem.gearId === 'gear_in_ear_monitors' ||
    targetItem.gearId === 'gear_studio_headphones'
  ) {
    outputDestinationItems.push(targetItem);

    // If IEM Receiver / Bodypack, trace upstream RF link to IEM transmitter
    if (
      targetItem.gearId === 'gear_iem_receiver' ||
      targetItem.gearId === 'gear_in_ear_monitors'
    ) {
      if (targetItem.latchedSourceInstanceId) {
        const tx = placedGear.find(
          (g) =>
            g.gearId === 'gear_iem_transmitter' &&
            g.latchedSourceInstanceId === targetItem.latchedSourceInstanceId
        );
        if (tx) {
          gearIds.add(tx.instanceId);
          rfLinkTransmitterIds.add(tx.instanceId);
          outputDestinationItems.push(tx);
        }
      }
    }

    // If IEM transmitter, find downstream bodypacks
    if (targetItem.gearId === 'gear_iem_transmitter') {
      rfLinkTransmitterIds.add(targetItem.instanceId);
      if (targetItem.latchedSourceInstanceId) {
        placedGear.forEach((g) => {
          if (
            (g.gearId === 'gear_iem_receiver' || g.gearId === 'gear_in_ear_monitors') &&
            g.latchedSourceInstanceId === targetItem.latchedSourceInstanceId
          ) {
            gearIds.add(g.instanceId);
            outputDestinationItems.push(g);
          }
        });
      }
    }

    // Trace cable connections to snake outputs (e.g. MON 1, MON 2, MAIN L, MAIN R)
    getGearConnections(targetItem.instanceId).forEach((conn) => {
      connectionIds.add(conn.id);
      const otherId = conn.fromInstanceId === targetItem.instanceId ? conn.toInstanceId : conn.fromInstanceId;
      if (otherId.startsWith('snake_out_')) {
        const port = otherId.replace('snake_out_', '') as 'mon1' | 'mon2' | 'main_l' | 'main_r';
        snakeOutputPorts.add(port);
      } else {
        const otherGear = placedGear.find((g) => g.instanceId === otherId);
        if (otherGear) {
          gearIds.add(otherGear.instanceId);
        }
      }
    });
  }

  // 2. Trace from Transducers (Mics / DIs / Amps) to Snake Inputs & Mixer Channels
  const allTransducers = [...new Set(transducerItems)];
  allTransducers.forEach((trans) => {
    // Check assigned channel directly
    if (trans.assignedChannel) {
      snakeChannelNumbers.add(trans.assignedChannel);
      mixerChannelNumbers.add(trans.assignedChannel);
    }

    // Check mixer channels pointing to this instance
    mixerChannels.forEach((ch) => {
      if (ch.assignedGearInstanceId === trans.instanceId) {
        snakeChannelNumbers.add(ch.channelNumber);
        mixerChannelNumbers.add(ch.channelNumber);
      }
    });

    // Check cable connections from transducer to snake inputs
    getGearConnections(trans.instanceId).forEach((conn) => {
      if (conn.fromInstanceId.startsWith('snake_in_') || conn.toInstanceId.startsWith('snake_in_')) {
        connectionIds.add(conn.id);
        const socketId = conn.fromInstanceId.startsWith('snake_in_') ? conn.fromInstanceId : conn.toInstanceId;
        const ch = parseInt(socketId.replace('snake_in_', ''), 10);
        snakeChannelNumbers.add(ch);
        mixerChannelNumbers.add(ch);
      }
    });
  });

  // If selected item itself was patched to a mixer channel
  if (targetItem.assignedChannel) {
    snakeChannelNumbers.add(targetItem.assignedChannel);
    mixerChannelNumbers.add(targetItem.assignedChannel);
  }

  // Also check if any mixer channel is assigned to selected item
  mixerChannels.forEach((ch) => {
    if (ch.assignedGearInstanceId === targetItem.instanceId) {
      snakeChannelNumbers.add(ch.channelNumber);
      mixerChannelNumbers.add(ch.channelNumber);
    }
  });

  // 3. Trace from Mixer Channels to Downstream Outputs (FOH Main PA and Aux Monitor Sends)
  if (mixerChannelNumbers.size > 0) {
    // In Live Stage mode, FOH mix goes to Main L & Main R
    if (environment === 'live_stage') {
      snakeOutputPorts.add('main_l');
      snakeOutputPorts.add('main_r');
      // Aux 1 & Aux 2 monitor mixes
      snakeOutputPorts.add('mon1');
      snakeOutputPorts.add('mon2');
    }

    // Find all PA Speakers and Stage Monitors connected to these active snake outputs
    connections.forEach((conn) => {
      const isFromOut = conn.fromInstanceId.startsWith('snake_out_');
      const isToOut = conn.toInstanceId.startsWith('snake_out_');
      if (isFromOut || isToOut) {
        const outSocket = isFromOut ? conn.fromInstanceId : conn.toInstanceId;
        const port = outSocket.replace('snake_out_', '') as 'mon1' | 'mon2' | 'main_l' | 'main_r';

        if (snakeOutputPorts.has(port)) {
          connectionIds.add(conn.id);
          const speakerId = isFromOut ? conn.toInstanceId : conn.fromInstanceId;
          const speakerGear = placedGear.find((g) => g.instanceId === speakerId);
          if (speakerGear) {
            gearIds.add(speakerGear.instanceId);
            outputDestinationItems.push(speakerGear);

            // If connected to an IEM transmitter, find downstream bodypacks
            if (speakerGear.gearId === 'gear_iem_transmitter') {
              rfLinkTransmitterIds.add(speakerGear.instanceId);
              if (speakerGear.latchedSourceInstanceId) {
                placedGear.forEach((rx) => {
                  if (
                    (rx.gearId === 'gear_iem_receiver' || rx.gearId === 'gear_in_ear_monitors') &&
                    rx.latchedSourceInstanceId === speakerGear.latchedSourceInstanceId
                  ) {
                    gearIds.add(rx.instanceId);
                    outputDestinationItems.push(rx);
                  }
                });
              }
            }

            // Also check daisy-chained speakers
            getGearConnections(speakerGear.instanceId).forEach((daisyConn) => {
              if (daisyConn.id !== conn.id) {
                const daisyOtherId =
                  daisyConn.fromInstanceId === speakerGear.instanceId ? daisyConn.toInstanceId : daisyConn.fromInstanceId;
                const daisyGear = placedGear.find((g) => g.instanceId === daisyOtherId);
                if (daisyGear && (daisyGear.gearId === 'gear_pa_speaker' || daisyGear.gearId === 'gear_stage_monitor')) {
                  connectionIds.add(daisyConn.id);
                  gearIds.add(daisyGear.instanceId);
                  outputDestinationItems.push(daisyGear);
                }
              }
            });
          }
        }
      }
    });
  }

  // 4. Construct Ordered Signal Path Nodes for UI Breadcrumb / HUD Display
  const nodes: SignalPathNode[] = [];

  // Stage 1: Sound Source (Instrument / Performer)
  const primarySource = sourceItems[0] || (targetDef.category === 'instrument' ? targetItem : null);
  if (primarySource) {
    const sDef = getGearById(primarySource.gearId);
    nodes.push({
      id: primarySource.instanceId,
      type: 'source',
      label: sDef?.name || 'Sound Source',
      subLabel: isAcousticInstrument(primarySource.gearId) ? 'Acoustic Sound' : 'Instrument Output',
      gearId: primarySource.gearId,
      cableTypeToNext: isAcousticInstrument(primarySource.gearId) ? 'acoustic' : 'quarter_inch',
      status: 'active',
      statusText: 'Source Ready',
    });
  }

  // Stage 2: Transducer / Capture (Mic, DI Box, Amp)
  const primaryTransducer = transducerItems[0] || (targetDef.category === 'microphone' || targetDef.category === 'di_box' ? targetItem : null);
  if (primaryTransducer) {
    const tDef = getGearById(primaryTransducer.gearId);
    nodes.push({
      id: primaryTransducer.instanceId,
      type: 'transducer',
      label: tDef?.name || 'Transducer',
      subLabel:
        primaryTransducer.micPlacement ||
        (tDef?.category === 'microphone' ? 'Microphone' : tDef?.category === 'di_box' ? 'Direct Box' : 'Amplifier'),
      gearId: primaryTransducer.gearId,
      cableTypeToNext: 'xlr',
      status: 'active',
      statusText: primaryTransducer.hasPopFilter ? 'Pop Filter Active' : undefined,
    });
  }

  // Stage 3: Snake Stage Box Input
  const primarySnakeCh = Array.from(snakeChannelNumbers)[0];
  if (primarySnakeCh) {
    nodes.push({
      id: `snake_in_${primarySnakeCh}`,
      type: 'snake_input',
      label: `Snake IN #${primarySnakeCh}`,
      subLabel: 'Stage Box XLR Input',
      channelNumber: primarySnakeCh,
      cableTypeToNext: 'internal',
      status: 'active',
      statusText: 'Balanced Feed',
    });
  }

  // Stage 4: Console Mixer Channel Strip
  const primaryMixerChNum = Array.from(mixerChannelNumbers)[0];
  const primaryMixerCh = primaryMixerChNum
    ? mixerChannels.find((c) => c.channelNumber === primaryMixerChNum)
    : null;

  let health: 'healthy' | 'warning' | 'muted' | 'unpatched' = 'healthy';
  let healthMessage = 'Signal chain complete and routing to outputs';

  if (primaryMixerCh) {
    const isMuted = primaryMixerCh.muted;
    const transducerDef = primaryTransducer ? getGearById(primaryTransducer.gearId) : null;
    const needsPhantom =
      primaryTransducer &&
      Boolean(transducerDef?.requiresPhantomPower) &&
      !primaryMixerCh.phantomPower;

    if (isMuted) {
      health = 'muted';
      healthMessage = `Mixer CH ${primaryMixerCh.channelNumber} is currently MUTED.`;
    } else if (needsPhantom) {
      health = 'warning';
      healthMessage = `Condenser mic / Active DI requires +48V Phantom Power on CH ${primaryMixerCh.channelNumber}.`;
    }

    nodes.push({
      id: `mixer_ch_${primaryMixerCh.channelNumber}`,
      type: 'mixer_channel',
      label: `Mixer CH ${primaryMixerCh.channelNumber}`,
      subLabel: `${primaryMixerCh.label} (${primaryMixerCh.phantomPower ? '+48V ON' : 'Line/Mic'})`,
      channelNumber: primaryMixerCh.channelNumber,
      cableTypeToNext: 'internal',
      status: isMuted ? 'muted' : needsPhantom ? 'warning' : 'active',
      statusText: `Fader: ${primaryMixerCh.fader}% | Gain: ${primaryMixerCh.gain}%`,
    });
  } else if (!primarySnakeCh && (primaryTransducer || primarySource)) {
    health = 'unpatched';
    healthMessage = 'Not connected to snake box or mixer channel.';
  }

  // Stage 5: Output Destinations (FOH PA Speakers / Stage Monitors / IEMs)
  const uniqueOutputDestinations = Array.from(new Set(outputDestinationItems));
  if (uniqueOutputDestinations.length > 0) {
    const mainSpeakers = uniqueOutputDestinations.filter((g) => g.gearId === 'gear_pa_speaker');
    const monitors = uniqueOutputDestinations.filter(
      (g) =>
        g.gearId === 'gear_stage_monitor' ||
        g.gearId === 'gear_iem_transmitter' ||
        g.gearId === 'gear_iem_receiver' ||
        g.gearId === 'gear_in_ear_monitors' ||
        g.gearId === 'gear_studio_headphones'
    );

    if (mainSpeakers.length > 0) {
      nodes.push({
        id: 'dest_main_foh',
        type: 'destination',
        label: 'Main PA Speakers',
        subLabel: `FOH L/R (${mainSpeakers.length} active)`,
        gearId: 'gear_pa_speaker',
        status: 'active',
        statusText: 'Audience Mix',
      });
    }

    if (monitors.length > 0) {
      const monNames = monitors
        .map((m) => getGearById(m.gearId)?.name || 'Monitor')
        .slice(0, 2)
        .join(', ');
      nodes.push({
        id: 'dest_monitors',
        type: 'destination',
        label: 'Stage Monitors & IEMs',
        subLabel: monNames,
        status: 'active',
        statusText: 'Foldback Mix',
      });
    }
  } else if (primaryMixerCh) {
    if (environment === 'live_stage') {
      nodes.push({
        id: 'dest_snake_outs',
        type: 'snake_output',
        label: 'Snake XLR Outs',
        subLabel: 'MAIN L/R & MON 1/2',
        status: 'active',
        statusText: 'Ready for PA/Monitors',
      });
    } else {
      nodes.push({
        id: 'dest_studio_monitors',
        type: 'destination',
        label: 'Control Room Monitors',
        subLabel: 'Stereo Reference Mix',
        status: 'active',
        statusText: 'Nearfield Monitors',
      });
    }
  }

  // Build high-level summary string
  const summaryParts: string[] = [];
  if (primarySource) summaryParts.push(getGearById(primarySource.gearId)?.name || 'Source');
  if (primaryTransducer) summaryParts.push(getGearById(primaryTransducer.gearId)?.name || 'Transducer');
  if (primarySnakeCh) summaryParts.push(`Snake IN #${primarySnakeCh}`);
  if (primaryMixerCh) summaryParts.push(`Mixer CH ${primaryMixerCh.channelNumber}`);
  if (uniqueOutputDestinations.length > 0) summaryParts.push('PA / Monitors');

  const summary = summaryParts.join(' ➔ ');

  return {
    selectedGearId: selectedInstanceId,
    gearIds,
    connectionIds,
    snakeChannelNumbers,
    snakeOutputPorts,
    mixerChannelNumbers,
    acousticLinkSourceIds,
    rfLinkTransmitterIds,
    nodes,
    summary,
    health,
    healthMessage,
  };
}
