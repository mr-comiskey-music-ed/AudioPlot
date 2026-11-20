import { CableConnection, PlacedGear } from '../../types';

/**
 * Stage monitors (wedges) that get a monitor mix: cabled with XLR from the snake's MON 1 / MON 2,
 * or daisy-chained with XLR from a wedge that does (THRU / LINK out to the next wedge's IN),
 * any number of wedges down the line.
 */
export function wedgesFedFromSnake(placedGear: PlacedGear[], connections: CableConnection[]): Set<string> {
  const wedges = new Set(placedGear.filter((g) => g.gearId === 'gear_stage_monitor').map((g) => g.instanceId));
  const links = connections.filter((c) => c.cableType === 'xlr');
  const fed = new Set<string>();
  const queue: string[] = ['snake_out_mon1', 'snake_out_mon2'];
  while (queue.length) {
    const from = queue.shift()!;
    for (const c of links) {
      const other = c.fromInstanceId === from ? c.toInstanceId : c.toInstanceId === from ? c.fromInstanceId : null;
      if (other && wedges.has(other) && !fed.has(other)) {
        fed.add(other);
        queue.push(other);
      }
    }
  }
  return fed;
}

/**
 * Live stage: is the show heard anywhere? True when a PA speaker is cabled to MAIN L/R or a wedge /
 * IEM transmitter to MON 1/2. Without one, soundcheck is silent (the mixer still shows the signal).
 */
export function hasLiveOutputs(connections: CableConnection[], placedGear: PlacedGear[]): boolean {
  const gearOf = (id: string) => placedGear.find((g) => g.instanceId === id)?.gearId;
  return connections.some((c) => {
    const port = c.fromInstanceId.startsWith('snake_out_') ? c.fromInstanceId : c.toInstanceId.startsWith('snake_out_') ? c.toInstanceId : null;
    if (!port) return false;
    const other = gearOf(port === c.fromInstanceId ? c.toInstanceId : c.fromInstanceId);
    if (port.startsWith('snake_out_main')) return other === 'gear_pa_speaker';
    return other === 'gear_stage_monitor' || other === 'gear_iem_transmitter';
  });
}
