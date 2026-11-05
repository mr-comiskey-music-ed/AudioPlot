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
