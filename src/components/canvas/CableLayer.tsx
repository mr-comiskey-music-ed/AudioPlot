import React from 'react';
import { CableConnection, CableType, EnvironmentMode, MixerChannelState, PlacedGear } from '../../types';
import {
  getGearBoxDimensions,
  getOrganizedSnakeCablePath,
  getQuadBezierPointAndAngle,
  getSnakeChannelPosition,
  getSnakeOutputPosition,
} from './canvasMath';
import { HighlightedSignalPath } from './signalPath';

interface CableLayerProps {
  environment: EnvironmentMode;
  placedGear: PlacedGear[];
  connections: CableConnection[];
  mixerChannels: MixerChannelState[];
  canvasSize: { width: number; height: number };
  connectingFromId: string | null;
  activeCableTool: CableType | null;
  cableTypeToConnect: CableType;
  mousePos: { x: number; y: number };
  onDeleteConnection: (connectionId: string) => void;
  onPatchToMixer: (gearInstanceId: string, channelNumber: number) => void;
  getGearCenter: (gear: PlacedGear) => { x: number; y: number };
  getPortOrGearCenter: (id: string) => { x: number; y: number };
  highlightedPath?: HighlightedSignalPath | null;
  isHighlightPathActive?: boolean;
}

export const CableLayer: React.FC<CableLayerProps> = ({
  environment,
  placedGear,
  connections,
  mixerChannels,
  canvasSize,
  connectingFromId,
  activeCableTool,
  cableTypeToConnect,
  mousePos,
  onDeleteConnection,
  onPatchToMixer,
  getGearCenter,
  getPortOrGearCenter,
  highlightedPath = null,
  isHighlightPathActive = false,
}) => {
  const hasActiveHighlight = isHighlightPathActive && highlightedPath !== null;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
      <defs>
        {/* Glowing Neon Drop Shadow Filters */}
        <filter id="signal-glow-cyan" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#38BDF8" floodOpacity="0.9" />
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#0284C7" floodOpacity="0.6" />
        </filter>
        <filter id="signal-glow-amber" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#FB923C" floodOpacity="0.9" />
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#EA580C" floodOpacity="0.6" />
        </filter>
        <filter id="signal-glow-emerald" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#34D399" floodOpacity="0.9" />
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#059669" floodOpacity="0.6" />
        </filter>

        {/* Directional Signal Flow Arrow Markers */}
        <marker
          id="signal-arrow-cyan"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#38BDF8" />
        </marker>
        <marker
          id="signal-arrow-amber"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#FB923C" />
        </marker>
      </defs>

      {/* Render Assigned Sound Source Brackets & Acoustic Coupling Indicator */}
      {placedGear.map((micOrDi) => {
        if (!micOrDi.latchedSourceInstanceId || micOrDi.latchedSourceInstanceId === 'room') return null;
        const source = placedGear.find((g) => g.instanceId === micOrDi.latchedSourceInstanceId);
        if (!source) return null;

        const isAcousticHighlighted =
          hasActiveHighlight &&
          (highlightedPath.acousticLinkSourceIds.has(source.instanceId) ||
            highlightedPath.gearIds.has(micOrDi.instanceId));

        const micCenter = getGearCenter(micOrDi);
        const srcCenter = getGearCenter(source);
        const micDims = getGearBoxDimensions(micOrDi.gearId);
        const srcDims = getGearBoxDimensions(source.gearId);

        const midX = (micCenter.x + srcCenter.x) / 2;
        const midY = (micCenter.y + srcCenter.y) / 2;
        const bSize = 8;

        return (
          <g
            key={`assigned-bracket-${micOrDi.instanceId}`}
            className="pointer-events-none transition-opacity duration-300"
            opacity={hasActiveHighlight ? (isAcousticHighlighted ? 1 : 0.2) : 1}
          >
            {/* Subtle Acoustic Coupling Connector Line */}
            <line
              x1={micCenter.x}
              y1={micCenter.y}
              x2={srcCenter.x}
              y2={srcCenter.y}
              stroke={isAcousticHighlighted ? '#38BDF8' : '#3B82F6'}
              strokeWidth={isAcousticHighlighted ? '2.5' : '1.8'}
              strokeDasharray={isAcousticHighlighted ? '5 3' : '4 3'}
              className={isAcousticHighlighted ? 'animate-signal-flow' : undefined}
              filter={isAcousticHighlighted ? 'url(#signal-glow-cyan)' : undefined}
            />

            {/* Source Box Corner Brackets */}
            <path
              d={`
                M ${source.x} ${source.y + bSize} L ${source.x} ${source.y} L ${source.x + bSize} ${source.y}
                M ${source.x + srcDims.width - bSize} ${source.y} L ${source.x + srcDims.width} ${source.y} L ${source.x + srcDims.width} ${source.y + bSize}
                M ${source.x} ${source.y + srcDims.height - bSize} L ${source.x} ${source.y + srcDims.height} L ${source.x + bSize} ${source.y + srcDims.height}
                M ${source.x + srcDims.width - bSize} ${source.y + srcDims.height} L ${source.x + srcDims.width} ${source.y + srcDims.height} L ${source.x + srcDims.width} ${source.y + srcDims.height - bSize}
              `}
              fill="none"
              stroke={isAcousticHighlighted ? '#38BDF8' : '#3B82F6'}
              strokeWidth={isAcousticHighlighted ? '2.8' : '2.2'}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={isAcousticHighlighted ? 'url(#signal-glow-cyan)' : undefined}
            />

            {/* Mic / DI / IEM Box Corner Brackets */}
            <path
              d={`
                M ${micOrDi.x} ${micOrDi.y + bSize} L ${micOrDi.x} ${micOrDi.y} L ${micOrDi.x + bSize} ${micOrDi.y}
                M ${micOrDi.x + micDims.width - bSize} ${micOrDi.y} L ${micOrDi.x + micDims.width} ${micOrDi.y} L ${micOrDi.x + micDims.width} ${micOrDi.y + bSize}
                M ${micOrDi.x} ${micOrDi.y + micDims.height - bSize} L ${micOrDi.x} ${micOrDi.y + micDims.height} L ${micOrDi.x + bSize} ${micOrDi.y + micDims.height}
                M ${micOrDi.x + micDims.width - bSize} ${micOrDi.y + micDims.height} L ${micOrDi.x + micDims.width} ${micOrDi.y + micDims.height} L ${micOrDi.x + micDims.width} ${micOrDi.y + micDims.height - bSize}
              `}
              fill="none"
              stroke={isAcousticHighlighted ? '#38BDF8' : '#3B82F6'}
              strokeWidth={isAcousticHighlighted ? '2.8' : '2.2'}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={isAcousticHighlighted ? 'url(#signal-glow-cyan)' : undefined}
            />

            {/* Center Assigned Bracket Badge */}
            <g transform={`translate(${midX}, ${midY})`}>
              <rect
                x="-36"
                y="-10"
                width="72"
                height="20"
                rx="10"
                fill="#18181B"
                stroke={isAcousticHighlighted ? '#38BDF8' : '#3B82F6'}
                strokeWidth={isAcousticHighlighted ? '1.8' : '1.4'}
                filter={isAcousticHighlighted ? 'url(#signal-glow-cyan)' : undefined}
              />
              <text
                x="0"
                y="3.5"
                fill={isAcousticHighlighted ? '#E0F2FE' : '#93C5FD'}
                fontSize="8.5"
                fontWeight="bold"
                textAnchor="middle"
                letterSpacing="0.5"
              >
                {isAcousticHighlighted ? 'SIGNAL LINK' : 'ASSIGNED'}
              </text>
            </g>
          </g>
        );
      })}

      {/* Render Wireless IEM RF Links */}
      {placedGear
        .filter((g) => g.gearId === 'gear_iem_transmitter' && !!g.latchedSourceInstanceId)
        .map((tx) => {
          const txCenter = getGearCenter(tx);
          const bodypacks = placedGear.filter(
            (g) =>
              (g.gearId === 'gear_iem_receiver' || g.gearId === 'gear_in_ear_monitors') &&
              g.latchedSourceInstanceId === tx.latchedSourceInstanceId
          );
          return bodypacks.map((rx) => {
            const rxCenter = getGearCenter(rx);
            const midX = (txCenter.x + rxCenter.x) / 2;
            const midY = (txCenter.y + rxCenter.y) / 2;

            const isRfHighlighted =
              hasActiveHighlight &&
              (highlightedPath.rfLinkTransmitterIds.has(tx.instanceId) ||
                highlightedPath.gearIds.has(rx.instanceId) ||
                highlightedPath.gearIds.has(tx.instanceId));

            return (
              <g
                key={`iem-rf-${tx.instanceId}-${rx.instanceId}`}
                className="pointer-events-none transition-opacity duration-300"
                opacity={hasActiveHighlight ? (isRfHighlighted ? 1 : 0.2) : 1}
              >
                {/* RF Green Dotted Link Line */}
                <line
                  x1={txCenter.x}
                  y1={txCenter.y}
                  x2={rxCenter.x}
                  y2={rxCenter.y}
                  stroke="#22C55E"
                  strokeWidth={isRfHighlighted ? '3.5' : '2.5'}
                  strokeDasharray="6 4"
                  className={isRfHighlighted ? 'animate-signal-flow' : 'animate-pulse'}
                  filter={isRfHighlighted ? 'url(#signal-glow-emerald)' : undefined}
                />
                {/* RF Link Badge */}
                <g transform={`translate(${midX}, ${midY})`}>
                  <rect
                    x="-38"
                    y="-10"
                    width="76"
                    height="20"
                    rx="10"
                    fill="#052E16"
                    stroke="#22C55E"
                    strokeWidth={isRfHighlighted ? '2' : '1.5'}
                    filter={isRfHighlighted ? 'url(#signal-glow-emerald)' : undefined}
                  />
                  <text
                    x="0"
                    y="3.5"
                    fill="#86EFAC"
                    fontSize="8.5"
                    fontWeight="900"
                    textAnchor="middle"
                    letterSpacing="0.6"
                  >
                    {isRfHighlighted ? 'ACTIVE RF LINK' : 'RF LINK'}
                  </text>
                </g>
              </g>
            );
          });
        })}

      {/* Interactive active cable drag indicator */}
      {(connectingFromId || activeCableTool) && (
        <path
          d={`M ${
            connectingFromId
              ? `${getPortOrGearCenter(connectingFromId).x} ${getPortOrGearCenter(connectingFromId).y}`
              : `${mousePos.x} ${mousePos.y}`
          } Q ${mousePos.x} ${mousePos.y + 40} ${mousePos.x} ${mousePos.y}`}
          fill="none"
          stroke={cableTypeToConnect === 'quarter_inch' ? '#38BDF8' : '#F97316'}
          strokeWidth="3.5"
          strokeDasharray="6 4"
          className="animate-pulse"
        />
      )}

      {/* Established Gear-to-Gear & Snake-Output Connections */}
      {connections.map((conn, connIdx) => {
        const isFromSnake = conn.fromInstanceId.startsWith('snake_');
        const isToSnake = conn.toInstanceId.startsWith('snake_');
        const isHighlighted = hasActiveHighlight && highlightedPath.connectionIds.has(conn.id);

        if (isFromSnake || isToSnake) {
          const socketId = isFromSnake ? conn.fromInstanceId : conn.toInstanceId;
          const gearInstanceId = isFromSnake ? conn.toInstanceId : conn.fromInstanceId;
          const targetGear = placedGear.find((g) => g.instanceId === gearInstanceId);
          if (!targetGear) return null;

          const gearCenter = getGearCenter(targetGear);
          const snakeSocket = getPortOrGearCenter(socketId);
          const route = getOrganizedSnakeCablePath(
            gearCenter,
            snakeSocket,
            environment,
            connIdx + 4,
            canvasSize.width
          );

          return (
            <g
              key={conn.id}
              className="cursor-pointer pointer-events-auto group transition-opacity duration-300"
              onClick={() => onDeleteConnection(conn.id)}
              title="Click to unpatch snake output cable"
              opacity={hasActiveHighlight ? (isHighlighted ? 1 : 0.22) : 1}
            >
              {/* Thick transparent hover hitbox */}
              <path
                d={route.d}
                fill="none"
                stroke="transparent"
                strokeWidth="16"
              />

              {/* Cable Outer Shadow */}
              <path
                d={route.d}
                fill="none"
                stroke="#000"
                strokeWidth="4.5"
                strokeOpacity="0.6"
              />

              {/* Core Cable */}
              <path
                d={route.d}
                fill="none"
                stroke={conn.color}
                strokeWidth={isHighlighted ? '4' : '3'}
                className="group-hover:stroke-rose-400 transition-colors"
                filter={isHighlighted ? 'url(#signal-glow-cyan)' : undefined}
              />

              {/* Glowing High-Speed Animated Signal Flow Overlay */}
              {isHighlighted && (
                <>
                  <path
                    d={route.d}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="3"
                    strokeDasharray="10 16"
                    strokeLinecap="round"
                    className="animate-signal-flow-fast"
                  />
                  {/* Flow Direction Pulse Bead */}
                  <circle r="4.5" fill="#38BDF8" filter="url(#signal-glow-cyan)">
                    <animateMotion path={route.d} dur="1.4s" repeatCount="indefinite" />
                  </circle>
                </>
              )}

              {/* Gaffer Tape Strips anchored along the trunk run */}
              <g pointerEvents="none">
                {route.gaffPoints.map((gaff, gIdx) => (
                  <rect
                    key={gIdx}
                    x={gaff.x - 6}
                    y={gaff.y - 3}
                    width="12"
                    height="6"
                    rx="1"
                    fill="#1C1917"
                    stroke="#57534E"
                    strokeWidth="0.75"
                    transform={`rotate(${gaff.angle + 90} ${gaff.x} ${gaff.y})`}
                  />
                ))}
              </g>

              {/* Unpatch 'X' node sitting directly ON the cable run */}
              <circle
                cx={route.midPoint.x}
                cy={route.midPoint.y}
                r="8.5"
                fill="#18181B"
                stroke={conn.color}
                strokeWidth="1.5"
                className="group-hover:fill-rose-600 group-hover:stroke-rose-300 transition-colors shadow-lg"
              />
              <text
                x={route.midPoint.x}
                y={route.midPoint.y + 3.5}
                fill="#FFF"
                fontSize="9"
                textAnchor="middle"
                fontWeight="bold"
              >
                ✕
              </text>
            </g>
          );
        }

        // Pure gear-to-gear connections
        const fromCenter = getPortOrGearCenter(conn.fromInstanceId);
        const toCenter = getPortOrGearCenter(conn.toInstanceId);
        if (!fromCenter.x || !toCenter.x) return null;

        const isXlr = conn.cableType === 'xlr';
        const route = isXlr
          ? getOrganizedSnakeCablePath(fromCenter, toCenter, environment, connIdx + 10, canvasSize.width)
          : (() => {
              const midX = (fromCenter.x + toCenter.x) / 2;
              const midY = (fromCenter.y + toCenter.y) / 2 + 25;
              const ptTape1 = getQuadBezierPointAndAngle(fromCenter.x, fromCenter.y, midX, midY, toCenter.x, toCenter.y, 0.3);
              const ptTape2 = getQuadBezierPointAndAngle(fromCenter.x, fromCenter.y, midX, midY, toCenter.x, toCenter.y, 0.7);
              const ptCenter = getQuadBezierPointAndAngle(fromCenter.x, fromCenter.y, midX, midY, toCenter.x, toCenter.y, 0.5);
              return {
                d: `M ${fromCenter.x} ${fromCenter.y} Q ${midX} ${midY} ${toCenter.x} ${toCenter.y}`,
                midPoint: { x: ptCenter.x, y: ptCenter.y },
                gaffPoints: [
                  { x: ptTape1.x, y: ptTape1.y, angle: ptTape1.angle },
                  { x: ptTape2.x, y: ptTape2.y, angle: ptTape2.angle },
                ],
              };
            })();

        const pathD = route.d;

        return (
          <g
            key={conn.id}
            className="cursor-pointer pointer-events-auto group transition-opacity duration-300"
            onClick={() => onDeleteConnection(conn.id)}
            opacity={hasActiveHighlight ? (isHighlighted ? 1 : 0.22) : 1}
          >
            {/* Thick transparent hover hitbox */}
            <path
              d={pathD}
              fill="none"
              stroke="transparent"
              strokeWidth="16"
            />

            {/* Cable Outer Shadow */}
            <path
              d={pathD}
              fill="none"
              stroke="#000"
              strokeWidth="4.5"
              strokeOpacity="0.6"
            />

            {/* Core Cable */}
            <path
              d={pathD}
              fill="none"
              stroke={conn.color}
              strokeWidth={isHighlighted ? '4' : '3'}
              className="group-hover:stroke-rose-400 transition-colors"
              filter={isHighlighted ? 'url(#signal-glow-cyan)' : undefined}
            />

            {/* Glowing High-Speed Animated Signal Flow Overlay */}
            {isHighlighted && (
              <>
                <path
                  d={pathD}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="3"
                  strokeDasharray="10 16"
                  strokeLinecap="round"
                  className="animate-signal-flow-fast"
                />
                {/* Moving Pulse Particle */}
                <circle r="4.5" fill="#38BDF8" filter="url(#signal-glow-cyan)">
                  <animateMotion path={pathD} dur="1.2s" repeatCount="indefinite" />
                </circle>
              </>
            )}

            {/* Gaffer Tape Strips anchored along the trunk run */}
            <g pointerEvents="none">
              {route.gaffPoints.map((gaff, gIdx) => (
                <rect
                  key={gIdx}
                  x={gaff.x - 6}
                  y={gaff.y - 3}
                  width="12"
                  height="6"
                  rx="1"
                  fill="#1C1917"
                  stroke="#57534E"
                  strokeWidth="0.75"
                  transform={`rotate(${gaff.angle + 90} ${gaff.x} ${gaff.y})`}
                />
              ))}
            </g>

            {/* Unpatch 'X' node sitting directly ON the cable run */}
            <circle
              cx={route.midPoint.x}
              cy={route.midPoint.y}
              r="8.5"
              fill="#18181B"
              stroke={conn.color}
              strokeWidth="1.5"
              className="group-hover:fill-rose-600 group-hover:stroke-rose-300 transition-colors shadow-lg"
            />
            <text x={route.midPoint.x} y={route.midPoint.y + 3.5} fill="#FFF" fontSize="9" textAnchor="middle" fontWeight="bold">
              ✕
            </text>
          </g>
        );
      })}

      {/* Persistent Snake Input Connections */}
      {mixerChannels.map((ch) => {
        if (!ch.assignedGearInstanceId) return null;
        const assignedGear = placedGear.find((g) => g.instanceId === ch.assignedGearInstanceId);
        if (!assignedGear) return null;

        const isSnakeHighlighted =
          hasActiveHighlight &&
          (highlightedPath.snakeChannelNumbers.has(ch.channelNumber) ||
            highlightedPath.mixerChannelNumbers.has(ch.channelNumber) ||
            highlightedPath.gearIds.has(assignedGear.instanceId));

        const gearCenter = getGearCenter(assignedGear);
        const snakeSocket = getSnakeChannelPosition(ch.channelNumber, environment, canvasSize.width, canvasSize.height);
        const route = getOrganizedSnakeCablePath(
          gearCenter,
          snakeSocket,
          environment,
          ch.channelNumber - 1,
          canvasSize.width
        );

        return (
          <g
            key={`snake-cable-${ch.channelNumber}`}
            className="cursor-pointer pointer-events-auto group transition-opacity duration-300"
            onClick={() => onPatchToMixer(assignedGear.instanceId, ch.channelNumber)}
            title={`Click to unpatch Channel ${ch.channelNumber}`}
            opacity={hasActiveHighlight ? (isSnakeHighlighted ? 1 : 0.22) : 1}
          >
            {/* Hitbox */}
            <path
              d={route.d}
              fill="none"
              stroke="transparent"
              strokeWidth="16"
            />

            {/* Drop Shadow */}
            <path
              d={route.d}
              fill="none"
              stroke="#000"
              strokeWidth="4.5"
              strokeOpacity="0.6"
            />

            {/* Main Cable Line */}
            <path
              d={route.d}
              fill="none"
              stroke="#F97316"
              strokeWidth={isSnakeHighlighted ? '4.5' : '3'}
              className="group-hover:stroke-rose-400 transition-colors"
              filter={isSnakeHighlighted ? 'url(#signal-glow-amber)' : undefined}
            />

            {/* Glowing High-Speed Animated Signal Flow Overlay */}
            {isSnakeHighlighted && (
              <>
                <path
                  d={route.d}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="3.5"
                  strokeDasharray="10 16"
                  strokeLinecap="round"
                  className="animate-signal-flow-fast"
                />
                {/* Moving Signal Energy Bead */}
                <circle r="4.5" fill="#FB923C" filter="url(#signal-glow-amber)">
                  <animateMotion path={route.d} dur="1.3s" repeatCount="indefinite" />
                </circle>
              </>
            )}

            {/* Gaffer Tape Interval Ties on Snake Runs */}
            <g pointerEvents="none">
              {route.gaffPoints.map((gaff, gIdx) => (
                <rect
                  key={gIdx}
                  x={gaff.x - 6}
                  y={gaff.y - 3}
                  width="12"
                  height="6"
                  rx="1"
                  fill="#1C1917"
                  stroke="#57534E"
                  strokeWidth="0.75"
                  transform={`rotate(${gaff.angle + 90} ${gaff.x} ${gaff.y})`}
                />
              ))}
            </g>

            {/* Interactive Unpatch Badge */}
            <circle
              cx={route.midPoint.x}
              cy={route.midPoint.y}
              r={isSnakeHighlighted ? '10' : '8.5'}
              fill={isSnakeHighlighted ? '#7C2D12' : '#18181B'}
              stroke="#F97316"
              strokeWidth={isSnakeHighlighted ? '2' : '1.5'}
              className="group-hover:fill-rose-600 group-hover:stroke-rose-300 transition-colors shadow-lg"
              filter={isSnakeHighlighted ? 'url(#signal-glow-amber)' : undefined}
            />
            <text
              x={route.midPoint.x}
              y={route.midPoint.y + 3.5}
              fill="#FFF"
              fontSize={isSnakeHighlighted ? '10' : '9'}
              textAnchor="middle"
              fontWeight="bold"
            >
              ✕
            </text>
          </g>
        );
      })}
    </svg>
  );
};
