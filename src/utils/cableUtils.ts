import { CableConnection, MixerChannelState, PlacedGear } from '../types';

export const calculateXlrCablesCount = (
  connections: CableConnection[] = [],
  channels: MixerChannelState[] = [],
  placedGear: PlacedGear[] = []
): number => {
  const connectedGearIds = new Set<string>();
  connections.forEach((c) => {
    if (c.cableType === 'xlr' || c.fromInstanceId.startsWith('snake_') || c.toInstanceId.startsWith('snake_')) {
      connectedGearIds.add(c.fromInstanceId);
      connectedGearIds.add(c.toInstanceId);
    }
  });

  let count = connections.filter(
    (c) =>
      c.cableType === 'xlr' ||
      c.fromInstanceId.startsWith('snake_') ||
      c.toInstanceId.startsWith('snake_')
  ).length;

  channels.forEach((ch) => {
    if (ch.assignedGearInstanceId) {
      if (!connectedGearIds.has(ch.assignedGearInstanceId)) {
        count += 1;
      }
    }
  });

  placedGear.forEach((g) => {
    if (g.assignedChannel && g.assignedChannel > 0) {
      if (!connectedGearIds.has(g.instanceId) && !channels.some((ch) => ch.assignedGearInstanceId === g.instanceId)) {
        count += 1;
      }
    }
  });

  return Math.max(count, channels.filter((ch) => ch.assignedGearInstanceId !== null).length);
};
