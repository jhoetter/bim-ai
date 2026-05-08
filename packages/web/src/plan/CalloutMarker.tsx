import type { ReactElement } from 'react';

type ClipXY = { x: number; y: number };

type CalloutMarkerProps = {
  clipRect: { minXY: ClipXY; maxXY: ClipXY };
  viewNumber: string | number;
  onDoubleClick?: () => void;
};

const CIRCLE_DIAMETER = 18;
const CIRCLE_RADIUS = CIRCLE_DIAMETER / 2;

export function CalloutMarker({
  clipRect,
  viewNumber,
  onDoubleClick,
}: CalloutMarkerProps): ReactElement {
  const { minXY, maxXY } = clipRect;

  const x = Math.min(minXY.x, maxXY.x);
  const y = Math.min(minXY.y, maxXY.y);
  const w = Math.abs(maxXY.x - minXY.x);
  const h = Math.abs(maxXY.y - minXY.y);

  const circleX = x + w;
  const circleY = y + h;

  const leaderStartX = circleX - CIRCLE_RADIUS;
  const leaderStartY = circleY - CIRCLE_RADIUS;
  const leaderEndX = x + w;
  const leaderEndY = y + h;

  return (
    <g onDoubleClick={onDoubleClick} style={{ cursor: onDoubleClick ? 'pointer' : undefined }}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="none"
        stroke="var(--color-annotation)"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      <line
        x1={leaderStartX}
        y1={leaderStartY}
        x2={leaderEndX}
        y2={leaderEndY}
        stroke="var(--color-annotation)"
        strokeWidth={1}
      />
      <circle
        cx={circleX}
        cy={circleY}
        r={CIRCLE_RADIUS}
        fill="var(--color-surface-1)"
        stroke="var(--color-annotation)"
        strokeWidth={1}
      />
      <text
        x={circleX}
        y={circleY}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="var(--text-2xs)"
        fill="var(--color-annotation)"
      >
        {viewNumber}
      </text>
    </g>
  );
}
