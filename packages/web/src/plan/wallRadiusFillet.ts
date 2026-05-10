export type MmPoint = { xMm: number; yMm: number };

export type WallFilletSegment = {
  start: MmPoint;
  end: MmPoint;
};

export type WallFilletArc = {
  kind: 'arc';
  center: MmPoint;
  radiusMm: number;
  startAngleDeg: number;
  endAngleDeg: number;
  sweepDeg: number;
};

export type WallFilletResult = {
  previousEnd: MmPoint;
  wallCurve: WallFilletArc;
  arcSegments: WallFilletSegment[];
  currentStart: MmPoint;
  effectiveRadiusMm: number;
};

const EPS = 1e-6;

function distance(a: MmPoint, b: MmPoint): number {
  return Math.hypot(b.xMm - a.xMm, b.yMm - a.yMm);
}

function normalize(v: { x: number; y: number }): { x: number; y: number } | null {
  const len = Math.hypot(v.x, v.y);
  if (len <= EPS) return null;
  return { x: v.x / len, y: v.y / len };
}

function pointNear(a: MmPoint, b: MmPoint): boolean {
  return distance(a, b) <= 0.001;
}

function normalizeSweep(rad: number): number {
  let out = rad;
  while (out <= -Math.PI) out += Math.PI * 2;
  while (out > Math.PI) out -= Math.PI * 2;
  return out;
}

function radToDeg(rad: number): number {
  const deg = (rad * 180) / Math.PI;
  return Math.abs(deg) < 1e-9 ? 0 : deg;
}

/**
 * Builds a tangent circular fillet for two connected wall baselines.
 *
 * F-043 now returns semantic arc metadata for a native curved wall. `arcSegments`
 * remains as a compatibility fallback for callers or old data paths that still
 * need tessellated straight wall pieces.
 */
export function buildWallRadiusFillet(
  previousStart: MmPoint,
  corner: MmPoint,
  currentEnd: MmPoint,
  requestedRadiusMm: number,
): WallFilletResult | null {
  if (!Number.isFinite(requestedRadiusMm) || requestedRadiusMm <= 0) return null;

  const prevLen = distance(previousStart, corner);
  const currLen = distance(corner, currentEnd);
  if (prevLen <= EPS || currLen <= EPS) return null;

  const intoPrevious = normalize({
    x: previousStart.xMm - corner.xMm,
    y: previousStart.yMm - corner.yMm,
  });
  const intoCurrent = normalize({
    x: currentEnd.xMm - corner.xMm,
    y: currentEnd.yMm - corner.yMm,
  });
  if (!intoPrevious || !intoCurrent) return null;

  const dot = Math.max(
    -1,
    Math.min(1, intoPrevious.x * intoCurrent.x + intoPrevious.y * intoCurrent.y),
  );
  const theta = Math.acos(dot);
  if (theta < 0.05 || Math.abs(Math.PI - theta) < 0.05) return null;

  const tangentForRequested = requestedRadiusMm / Math.tan(theta / 2);
  const tangentMm = Math.min(tangentForRequested, prevLen * 0.5, currLen * 0.5);
  if (tangentMm <= EPS) return null;
  const effectiveRadiusMm = tangentMm * Math.tan(theta / 2);

  const previousEnd = {
    xMm: corner.xMm + intoPrevious.x * tangentMm,
    yMm: corner.yMm + intoPrevious.y * tangentMm,
  };
  const currentStart = {
    xMm: corner.xMm + intoCurrent.x * tangentMm,
    yMm: corner.yMm + intoCurrent.y * tangentMm,
  };

  const centerDir = normalize({
    x: intoPrevious.x + intoCurrent.x,
    y: intoPrevious.y + intoCurrent.y,
  });
  if (!centerDir) return null;
  const centerDistance = effectiveRadiusMm / Math.sin(theta / 2);
  const center = {
    xMm: corner.xMm + centerDir.x * centerDistance,
    yMm: corner.yMm + centerDir.y * centerDistance,
  };

  const startAngle = Math.atan2(previousEnd.yMm - center.yMm, previousEnd.xMm - center.xMm);
  const endAngle = Math.atan2(currentStart.yMm - center.yMm, currentStart.xMm - center.xMm);
  const sweep = normalizeSweep(endAngle - startAngle);
  if (Math.abs(sweep) <= EPS) return null;

  const wallCurve: WallFilletArc = {
    kind: 'arc',
    center,
    radiusMm: effectiveRadiusMm,
    startAngleDeg: radToDeg(startAngle),
    endAngleDeg: radToDeg(endAngle),
    sweepDeg: radToDeg(sweep),
  };

  const steps = Math.max(3, Math.ceil(Math.abs(sweep) / (Math.PI / 12)));
  const arcPoints: MmPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = startAngle + (sweep * i) / steps;
    arcPoints.push({
      xMm: center.xMm + Math.cos(a) * effectiveRadiusMm,
      yMm: center.yMm + Math.sin(a) * effectiveRadiusMm,
    });
  }
  arcPoints[0] = previousEnd;
  arcPoints[arcPoints.length - 1] = currentStart;

  const arcSegments: WallFilletSegment[] = [];
  for (let i = 0; i < arcPoints.length - 1; i++) {
    const start = arcPoints[i]!;
    const end = arcPoints[i + 1]!;
    if (!pointNear(start, end)) arcSegments.push({ start, end });
  }
  if (arcSegments.length === 0) return null;

  return { previousEnd, wallCurve, arcSegments, currentStart, effectiveRadiusMm };
}
