import type { WallLocationLine } from '@bim-ai/core';

export type WallEndpoint = 'start' | 'end';

export interface WallConnectivityWall {
  id: string;
  levelId: string;
  start: { xMm: number; yMm: number };
  end: { xMm: number; yMm: number };
  thicknessMm?: number;
  joinDisallowStart?: boolean;
  joinDisallowEnd?: boolean;
}

export type WallConnectivityJoinKind = 'endpoint' | 't' | 'x';

export interface WallConnectivityJoin {
  id: string;
  kind: WallConnectivityJoinKind;
  levelId: string;
  point: { xMm: number; yMm: number };
  wallIds: string[];
  endpointByWallId: Record<string, WallEndpoint | null>;
  disallowedByWallId: Record<string, boolean>;
}

export interface WallConnectivitySnap {
  point: { xMm: number; yMm: number };
  kind: 'endpoint' | 'intersection' | 'segment';
  wallIds: string[];
  distanceMm: number;
}

const DEFAULT_TOLERANCE_MM = 35;

function roundKey(point: { xMm: number; yMm: number }, toleranceMm: number): string {
  const step = Math.max(1, toleranceMm);
  return `${Math.round(point.xMm / step) * step}:${Math.round(point.yMm / step) * step}`;
}

function endpointPoint(
  wall: WallConnectivityWall,
  endpoint: WallEndpoint,
): { xMm: number; yMm: number } {
  return endpoint === 'start' ? wall.start : wall.end;
}

function endpointForPoint(
  wall: WallConnectivityWall,
  point: { xMm: number; yMm: number },
  toleranceMm: number,
): WallEndpoint | null {
  if (distanceMm(wall.start, point) <= toleranceMm) return 'start';
  if (distanceMm(wall.end, point) <= toleranceMm) return 'end';
  return null;
}

function isJoinDisallowed(wall: WallConnectivityWall, endpoint: WallEndpoint | null): boolean {
  if (endpoint === 'start') return wall.joinDisallowStart === true;
  if (endpoint === 'end') return wall.joinDisallowEnd === true;
  return false;
}

function distanceMm(a: { xMm: number; yMm: number }, b: { xMm: number; yMm: number }): number {
  return Math.hypot(a.xMm - b.xMm, a.yMm - b.yMm);
}

function segmentProjection(
  point: { xMm: number; yMm: number },
  wall: WallConnectivityWall,
): { point: { xMm: number; yMm: number }; t: number; distanceMm: number } {
  const dx = wall.end.xMm - wall.start.xMm;
  const dy = wall.end.yMm - wall.start.yMm;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-6) {
    return { point: wall.start, t: 0, distanceMm: distanceMm(point, wall.start) };
  }
  const rawT = ((point.xMm - wall.start.xMm) * dx + (point.yMm - wall.start.yMm) * dy) / lenSq;
  const t = Math.max(0, Math.min(1, rawT));
  const projected = {
    xMm: wall.start.xMm + dx * t,
    yMm: wall.start.yMm + dy * t,
  };
  return { point: projected, t, distanceMm: distanceMm(point, projected) };
}

function segmentIntersection(
  a: WallConnectivityWall,
  b: WallConnectivityWall,
  toleranceMm: number,
): { point: { xMm: number; yMm: number }; ta: number; tb: number } | null {
  const ax = a.start.xMm;
  const ay = a.start.yMm;
  const adx = a.end.xMm - ax;
  const ady = a.end.yMm - ay;
  const bx = b.start.xMm;
  const by = b.start.yMm;
  const bdx = b.end.xMm - bx;
  const bdy = b.end.yMm - by;
  const cross = adx * bdy - ady * bdx;
  if (Math.abs(cross) < 1e-6) return null;
  const qx = bx - ax;
  const qy = by - ay;
  const ta = (qx * bdy - qy * bdx) / cross;
  const tb = (qx * ady - qy * adx) / cross;
  const toleranceRatioA = toleranceMm / Math.max(1, Math.hypot(adx, ady));
  const toleranceRatioB = toleranceMm / Math.max(1, Math.hypot(bdx, bdy));
  if (ta < -toleranceRatioA || ta > 1 + toleranceRatioA) return null;
  if (tb < -toleranceRatioB || tb > 1 + toleranceRatioB) return null;
  const clampedTa = Math.max(0, Math.min(1, ta));
  return {
    point: { xMm: ax + adx * clampedTa, yMm: ay + ady * clampedTa },
    ta,
    tb,
  };
}

function uniqueJoinId(
  kind: WallConnectivityJoinKind,
  levelId: string,
  point: { xMm: number; yMm: number },
  wallIds: string[],
): string {
  return [
    'wall-join',
    kind,
    levelId,
    Math.round(point.xMm * 1000) / 1000,
    Math.round(point.yMm * 1000) / 1000,
    ...wallIds.slice().sort(),
  ].join(':');
}

function makeJoin(
  kind: WallConnectivityJoinKind,
  point: { xMm: number; yMm: number },
  walls: WallConnectivityWall[],
  toleranceMm: number,
): WallConnectivityJoin {
  const wallIds = Array.from(new Set(walls.map((wall) => wall.id))).sort();
  const endpointByWallId: Record<string, WallEndpoint | null> = {};
  const disallowedByWallId: Record<string, boolean> = {};
  for (const wall of walls) {
    const endpoint = endpointForPoint(wall, point, toleranceMm);
    endpointByWallId[wall.id] = endpoint;
    disallowedByWallId[wall.id] = isJoinDisallowed(wall, endpoint);
  }
  return {
    id: uniqueJoinId(kind, walls[0]?.levelId ?? '', point, wallIds),
    kind,
    levelId: walls[0]?.levelId ?? '',
    point,
    wallIds,
    endpointByWallId,
    disallowedByWallId,
  };
}

export function collectWallConnectivity(
  walls: WallConnectivityWall[],
  options: { toleranceMm?: number } = {},
): WallConnectivityJoin[] {
  const toleranceMm = options.toleranceMm ?? DEFAULT_TOLERANCE_MM;
  const joinsById = new Map<string, WallConnectivityJoin>();
  const byLevel = new Map<string, WallConnectivityWall[]>();
  for (const wall of walls) {
    const levelWalls = byLevel.get(wall.levelId) ?? [];
    levelWalls.push(wall);
    byLevel.set(wall.levelId, levelWalls);
  }

  for (const levelWalls of byLevel.values()) {
    const endpointBuckets = new Map<
      string,
      Array<{ wall: WallConnectivityWall; endpoint: WallEndpoint }>
    >();
    for (const wall of levelWalls) {
      for (const endpoint of ['start', 'end'] as const) {
        const point = endpointPoint(wall, endpoint);
        const bucket = endpointBuckets.get(roundKey(point, toleranceMm)) ?? [];
        bucket.push({ wall, endpoint });
        endpointBuckets.set(roundKey(point, toleranceMm), bucket);
      }
    }
    for (const bucket of endpointBuckets.values()) {
      const uniqueWalls = Array.from(
        new Map(bucket.map((entry) => [entry.wall.id, entry.wall])).values(),
      );
      if (uniqueWalls.length < 2) continue;
      const point = {
        xMm:
          bucket.reduce((sum, entry) => sum + endpointPoint(entry.wall, entry.endpoint).xMm, 0) /
          bucket.length,
        yMm:
          bucket.reduce((sum, entry) => sum + endpointPoint(entry.wall, entry.endpoint).yMm, 0) /
          bucket.length,
      };
      const join = makeJoin('endpoint', point, uniqueWalls, toleranceMm);
      joinsById.set(join.id, join);
    }

    for (let i = 0; i < levelWalls.length; i += 1) {
      for (let j = i + 1; j < levelWalls.length; j += 1) {
        const a = levelWalls[i]!;
        const b = levelWalls[j]!;
        const intersection = segmentIntersection(a, b, toleranceMm);
        if (!intersection) continue;
        const aEndpoint = endpointForPoint(a, intersection.point, toleranceMm);
        const bEndpoint = endpointForPoint(b, intersection.point, toleranceMm);
        if (aEndpoint && bEndpoint) continue;
        const kind: WallConnectivityJoinKind = aEndpoint || bEndpoint ? 't' : 'x';
        const join = makeJoin(kind, intersection.point, [a, b], toleranceMm);
        joinsById.set(join.id, join);
      }
    }
  }

  return Array.from(joinsById.values()).sort((a, b) => a.id.localeCompare(b.id));
}

export function snapWallPointToConnectivity(
  point: { xMm: number; yMm: number },
  walls: WallConnectivityWall[],
  options: { toleranceMm?: number; levelId?: string } = {},
): WallConnectivitySnap | null {
  const toleranceMm = options.toleranceMm ?? DEFAULT_TOLERANCE_MM;
  const candidates: WallConnectivitySnap[] = [];
  const eligible = options.levelId
    ? walls.filter((wall) => wall.levelId === options.levelId)
    : walls;

  for (const wall of eligible) {
    for (const endpoint of ['start', 'end'] as const) {
      const target = endpointPoint(wall, endpoint);
      const d = distanceMm(point, target);
      if (d <= toleranceMm) {
        candidates.push({ point: target, kind: 'endpoint', wallIds: [wall.id], distanceMm: d });
      }
    }
    const projected = segmentProjection(point, wall);
    const isInterior = projected.t > 1e-4 && projected.t < 1 - 1e-4;
    if (isInterior && projected.distanceMm <= toleranceMm) {
      candidates.push({
        point: projected.point,
        kind: 'segment',
        wallIds: [wall.id],
        distanceMm: projected.distanceMm,
      });
    }
  }

  const joins = collectWallConnectivity(eligible, { toleranceMm });
  for (const join of joins) {
    const d = distanceMm(point, join.point);
    if (d <= toleranceMm) {
      candidates.push({
        point: join.point,
        kind: join.kind === 'endpoint' ? 'endpoint' : 'intersection',
        wallIds: join.wallIds,
        distanceMm: d,
      });
    }
  }

  candidates.sort((a, b) => {
    const rank = { endpoint: 0, intersection: 1, segment: 2 } as const;
    return rank[a.kind] - rank[b.kind] || a.distanceMm - b.distanceMm;
  });
  return candidates[0] ?? null;
}

export function flipWallLocationLineSide(locationLine: WallLocationLine): WallLocationLine {
  switch (locationLine) {
    case 'finish-face-exterior':
      return 'finish-face-interior';
    case 'finish-face-interior':
      return 'finish-face-exterior';
    case 'core-face-exterior':
      return 'core-face-interior';
    case 'core-face-interior':
      return 'core-face-exterior';
    default:
      return locationLine;
  }
}
