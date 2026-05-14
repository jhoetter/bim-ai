import type { Element } from '@bim-ai/core';
import type { WallLocationLine } from '@bim-ai/core';

import {
  collectWallConnectivity,
  type WallConnectivityJoin,
  type WallConnectivityWall,
  type WallEndpoint,
} from '../geometry/wallConnectivity';

type WallElem = Extract<Element, { kind: 'wall' }>;

export const WALL_3D_DISALLOW_JOIN_GAP_MM = 120;
const WALL_3D_JOIN_CLEANUP_TOLERANCE_MM = 35;

type PlanPoint = { xMm: number; yMm: number };
type PlanVec = { x: number; y: number };

function locationLineOffsetFrac(loc: WallLocationLine | undefined): number {
  switch (loc) {
    case 'finish-face-exterior':
    case 'core-face-exterior':
      return 0.5;
    case 'finish-face-interior':
    case 'core-face-interior':
      return -0.5;
    default:
      return 0;
  }
}

function wallDirection(wall: Pick<WallElem, 'start' | 'end'>): PlanVec | null {
  const dx = wall.end.xMm - wall.start.xMm;
  const dy = wall.end.yMm - wall.start.yMm;
  const len = Math.hypot(dx, dy);
  if (len <= 1e-6) return null;
  return { x: dx / len, y: dy / len };
}

function wallNormal(direction: PlanVec): PlanVec {
  return { x: -direction.y, y: direction.x };
}

function addPoint(point: PlanPoint, vec: PlanVec, scale: number): PlanPoint {
  return {
    xMm: point.xMm + vec.x * scale,
    yMm: point.yMm + vec.y * scale,
  };
}

function wallCenterlineOffsetMm(wall: WallElem, normal: PlanVec): number {
  if (wall.wallTypeId) return 0;
  return (wall.thicknessMm ?? 200) * locationLineOffsetFrac(wall.locationLine);
}

function displayCenterPoint(wall: WallElem, endpoint: WallEndpoint, normal: PlanVec): PlanPoint {
  return addPoint(
    endpoint === 'start' ? wall.start : wall.end,
    normal,
    wallCenterlineOffsetMm(wall, normal),
  );
}

function lineIntersection(
  aPoint: PlanPoint,
  aDir: PlanVec,
  bPoint: PlanPoint,
  bDir: PlanVec,
): PlanPoint | null {
  const det = aDir.x * bDir.y - aDir.y * bDir.x;
  if (Math.abs(det) < 1e-8) return null;
  const qx = bPoint.xMm - aPoint.xMm;
  const qy = bPoint.yMm - aPoint.yMm;
  const t = (qx * bDir.y - qy * bDir.x) / det;
  return { xMm: aPoint.xMm + aDir.x * t, yMm: aPoint.yMm + aDir.y * t };
}

function wallAsConnectivityWall(wall: WallElem): WallConnectivityWall {
  return {
    id: wall.id,
    levelId: wall.levelId,
    start: wall.start,
    end: wall.end,
    thicknessMm: wall.thicknessMm,
    joinDisallowStart: wall.joinDisallowStart,
    joinDisallowEnd: wall.joinDisallowEnd,
  };
}

function isJoinAllowedForWall(join: WallConnectivityJoin, wallId: string): boolean {
  return join.disallowedByWallId[wallId] !== true;
}

function wallEndpointPointIndex(endpoint: WallEndpoint, sideSign: 1 | -1): 0 | 1 | 2 | 3 {
  if (endpoint === 'start') return sideSign === 1 ? 0 : 3;
  return sideSign === 1 ? 1 : 2;
}

function joinedEndpointForWall(join: WallConnectivityJoin, wallId: string): WallEndpoint | null {
  return join.endpointByWallId[wallId] ?? null;
}

function pointOnLine(start: PlanPoint, direction: PlanVec, distanceMm: number): PlanPoint {
  return { xMm: start.xMm + direction.x * distanceMm, yMm: start.yMm + direction.y * distanceMm };
}

function convexHull(points: PlanPoint[]): PlanPoint[] {
  const sorted = points
    .slice()
    .sort((a, b) => a.xMm - b.xMm || a.yMm - b.yMm)
    .filter(
      (point, index, arr) =>
        index === 0 ||
        Math.abs(point.xMm - arr[index - 1]!.xMm) > 1e-6 ||
        Math.abs(point.yMm - arr[index - 1]!.yMm) > 1e-6,
    );
  if (sorted.length <= 1) return sorted;
  const cross = (o: PlanPoint, a: PlanPoint, b: PlanPoint) =>
    (a.xMm - o.xMm) * (b.yMm - o.yMm) - (a.yMm - o.yMm) * (b.xMm - o.xMm);
  const lower: PlanPoint[] = [];
  for (const point of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0
    )
      lower.pop();
    lower.push(point);
  }
  const upper: PlanPoint[] = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const point = sorted[i]!;
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0
    )
      upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function wallRectAtJoin(
  wall: WallElem,
  joinPoint: PlanPoint,
  alongHalfMm: number,
): PlanPoint[] | null {
  const direction = wallDirection(wall);
  if (!direction) return null;
  const normal = wallNormal(direction);
  const halfThickMm = Math.max(25, (wall.thicknessMm ?? 200) / 2);
  const center = addPoint(joinPoint, normal, wallCenterlineOffsetMm(wall, normal));
  return [
    addPoint(pointOnLine(center, direction, -alongHalfMm), normal, halfThickMm),
    addPoint(pointOnLine(center, direction, alongHalfMm), normal, halfThickMm),
    addPoint(pointOnLine(center, direction, alongHalfMm), normal, -halfThickMm),
    addPoint(pointOnLine(center, direction, -alongHalfMm), normal, -halfThickMm),
  ];
}

export function wall3dDisallowedJoinEndpoints(
  wall: WallElem,
  elementsById: Record<string, Element> | undefined,
  toleranceMm = 35,
): { start: boolean; end: boolean } {
  if (!elementsById) return { start: false, end: false };
  const walls = Object.values(elementsById).filter(
    (entry): entry is WallElem => entry.kind === 'wall' && entry.levelId === wall.levelId,
  );
  if (walls.length < 2) return { start: false, end: false };

  const out = { start: false, end: false };
  for (const join of collectWallConnectivity(walls, { toleranceMm })) {
    if (join.disallowedByWallId[wall.id] !== true) continue;
    const endpoint = join.endpointByWallId[wall.id];
    if (endpoint === 'start') out.start = true;
    if (endpoint === 'end') out.end = true;
  }
  return out;
}

export function wallWith3dJoinDisallowGaps(
  wall: WallElem,
  elementsById: Record<string, Element> | undefined,
  gapMm = WALL_3D_DISALLOW_JOIN_GAP_MM,
): WallElem {
  const endpoints = wall3dDisallowedJoinEndpoints(wall, elementsById);
  if (!endpoints.start && !endpoints.end) return wall;

  const dx = wall.end.xMm - wall.start.xMm;
  const dy = wall.end.yMm - wall.start.yMm;
  const len = Math.hypot(dx, dy);
  if (len <= 1) return wall;

  let startGap = endpoints.start ? gapMm : 0;
  let endGap = endpoints.end ? gapMm : 0;
  const maxTotalGap = Math.max(0, len - 1);
  const requestedTotalGap = startGap + endGap;
  if (requestedTotalGap > maxTotalGap && requestedTotalGap > 0) {
    const scale = maxTotalGap / requestedTotalGap;
    startGap *= scale;
    endGap *= scale;
  }

  const ux = dx / len;
  const uy = dy / len;
  return {
    ...wall,
    start: {
      xMm: wall.start.xMm + ux * startGap,
      yMm: wall.start.yMm + uy * startGap,
    },
    end: {
      xMm: wall.end.xMm - ux * endGap,
      yMm: wall.end.yMm - uy * endGap,
    },
  };
}

export function wall3dCleanupFootprintMm(
  wall: WallElem,
  elementsById: Record<string, Element> | undefined,
  toleranceMm = WALL_3D_JOIN_CLEANUP_TOLERANCE_MM,
): PlanPoint[] | null {
  if (!elementsById || wall.wallCurve || wall.faceMaterialOverrides?.length) return null;
  const direction = wallDirection(wall);
  if (!direction) return null;

  const normal = wallNormal(direction);
  const halfThickMm = Math.max(25, (wall.thicknessMm ?? 200) / 2);
  const centerStart = displayCenterPoint(wall, 'start', normal);
  const centerEnd = displayCenterPoint(wall, 'end', normal);
  const footprint: PlanPoint[] = [
    addPoint(centerStart, normal, halfThickMm),
    addPoint(centerEnd, normal, halfThickMm),
    addPoint(centerEnd, normal, -halfThickMm),
    addPoint(centerStart, normal, -halfThickMm),
  ];

  const walls = Object.values(elementsById).filter(
    (entry): entry is WallElem => entry.kind === 'wall' && entry.levelId === wall.levelId,
  );
  if (walls.length < 2) return null;

  const joins = collectWallConnectivity(walls.map(wallAsConnectivityWall), { toleranceMm }).filter(
    (join) => join.wallIds.includes(wall.id) && isJoinAllowedForWall(join, wall.id),
  );

  let changed = false;
  for (const join of joins) {
    const endpoint = joinedEndpointForWall(join, wall.id);
    if (!endpoint) continue;

    if (join.kind === 'endpoint') {
      const other = walls.find((candidate) => {
        if (candidate.id === wall.id || !join.wallIds.includes(candidate.id)) return false;
        return (
          joinedEndpointForWall(join, candidate.id) != null &&
          isJoinAllowedForWall(join, candidate.id)
        );
      });
      const otherEndpoint = other ? joinedEndpointForWall(join, other.id) : null;
      const otherDirection = other ? wallDirection(other) : null;
      if (!other || !otherEndpoint || !otherDirection) continue;
      const cross = direction.x * otherDirection.y - direction.y * otherDirection.x;
      if (Math.abs(cross) < 1e-4) continue;

      const otherNormal = wallNormal(otherDirection);
      const otherHalfThickMm = Math.max(25, (other.thicknessMm ?? wall.thicknessMm ?? 200) / 2);
      const otherCenter = displayCenterPoint(other, otherEndpoint, otherNormal);
      for (const sideSign of [1, -1] as const) {
        const thisPoint = addPoint(
          endpoint === 'start' ? centerStart : centerEnd,
          normal,
          sideSign * halfThickMm,
        );
        const otherPoint = addPoint(otherCenter, otherNormal, sideSign * otherHalfThickMm);
        const intersection = lineIntersection(thisPoint, direction, otherPoint, otherDirection);
        if (!intersection) continue;
        const maxMiterMm = (halfThickMm + otherHalfThickMm) * 4;
        if (
          Math.hypot(intersection.xMm - thisPoint.xMm, intersection.yMm - thisPoint.yMm) >
          maxMiterMm
        )
          continue;
        footprint[wallEndpointPointIndex(endpoint, sideSign)] = intersection;
        changed = true;
      }
      continue;
    }

    if (join.kind === 't') {
      const host = walls.find((candidate) => {
        if (candidate.id === wall.id || !join.wallIds.includes(candidate.id)) return false;
        return (
          joinedEndpointForWall(join, candidate.id) == null &&
          isJoinAllowedForWall(join, candidate.id)
        );
      });
      if (!host) continue;
      const hostDirection = wallDirection(host);
      if (!hostDirection) continue;
      const hostNormal = wallNormal(hostDirection);
      const hostHalfThickMm = Math.max(25, (host.thicknessMm ?? wall.thicknessMm ?? 200) / 2);
      const hostCenter = addPoint(join.point, hostNormal, wallCenterlineOffsetMm(host, hostNormal));
      const away = endpoint === 'start' ? direction : { x: -direction.x, y: -direction.y };
      const sideSign = away.x * hostNormal.x + away.y * hostNormal.y >= 0 ? 1 : -1;
      const denom = away.x * hostNormal.x + away.y * hostNormal.y;
      if (Math.abs(denom) < 1e-4) continue;
      const centerAtEndpoint = endpoint === 'start' ? centerStart : centerEnd;
      const hostFacePoint = addPoint(hostCenter, hostNormal, sideSign * hostHalfThickMm);
      const travelMm =
        ((hostFacePoint.xMm - centerAtEndpoint.xMm) * hostNormal.x +
          (hostFacePoint.yMm - centerAtEndpoint.yMm) * hostNormal.y) /
        denom;
      if (travelMm <= 0 || travelMm > hostHalfThickMm * 4) continue;
      for (const sign of [1, -1] as const) {
        const index = wallEndpointPointIndex(endpoint, sign);
        footprint[index] = addPoint(footprint[index], away, travelMm);
      }
      changed = true;
    }
  }

  return changed ? footprint : null;
}

export function wall3dXJoinCleanupFootprintsMm(
  wall: WallElem,
  elementsById: Record<string, Element> | undefined,
  toleranceMm = WALL_3D_JOIN_CLEANUP_TOLERANCE_MM,
): PlanPoint[][] | null {
  if (!elementsById || wall.wallCurve || wall.faceMaterialOverrides?.length) return null;
  const direction = wallDirection(wall);
  if (!direction) return null;
  const normal = wallNormal(direction);
  const halfThickMm = Math.max(25, (wall.thicknessMm ?? 200) / 2);
  const centerStart = displayCenterPoint(wall, 'start', normal);
  const centerEnd = displayCenterPoint(wall, 'end', normal);
  const lenMm = Math.hypot(centerEnd.xMm - centerStart.xMm, centerEnd.yMm - centerStart.yMm);
  if (lenMm <= 1) return null;

  const walls = Object.values(elementsById).filter(
    (entry): entry is WallElem => entry.kind === 'wall' && entry.levelId === wall.levelId,
  );
  const joins = collectWallConnectivity(walls.map(wallAsConnectivityWall), { toleranceMm }).filter(
    (join) =>
      join.kind === 'x' &&
      join.wallIds.includes(wall.id) &&
      joinedEndpointForWall(join, wall.id) == null &&
      isJoinAllowedForWall(join, wall.id),
  );
  if (joins.length === 0) return null;

  const intervals: Array<{ start: number; end: number; join: WallConnectivityJoin }> = [];
  const caps: PlanPoint[][] = [];
  for (const join of joins) {
    const other = walls.find(
      (candidate) =>
        candidate.id !== wall.id &&
        join.wallIds.includes(candidate.id) &&
        joinedEndpointForWall(join, candidate.id) == null &&
        isJoinAllowedForWall(join, candidate.id),
    );
    if (!other) continue;
    const otherDirection = wallDirection(other);
    if (!otherDirection) continue;
    const otherNormal = wallNormal(otherDirection);
    const denom = Math.abs(direction.x * otherNormal.x + direction.y * otherNormal.y);
    if (denom < 1e-4) continue;
    const otherHalfThickMm = Math.max(25, (other.thicknessMm ?? wall.thicknessMm ?? 200) / 2);
    const joinCenter = addPoint(join.point, normal, wallCenterlineOffsetMm(wall, normal));
    const t =
      (joinCenter.xMm - centerStart.xMm) * direction.x +
      (joinCenter.yMm - centerStart.yMm) * direction.y;
    if (t <= 0 || t >= lenMm) continue;
    const gapHalfMm = Math.min(lenMm / 2, otherHalfThickMm / denom);
    intervals.push({
      start: Math.max(0, t - gapHalfMm),
      end: Math.min(lenMm, t + gapHalfMm),
      join,
    });

    const ownerId = join.wallIds.slice().sort()[0];
    if (ownerId === wall.id) {
      const rects = join.wallIds
        .map((id) => walls.find((candidate) => candidate.id === id))
        .filter((candidate): candidate is WallElem => Boolean(candidate))
        .flatMap((candidate) => {
          const candidateDirection = wallDirection(candidate);
          if (!candidateDirection) return [];
          const candidateNormal = wallNormal(candidateDirection);
          const candidateHalfThickMm = Math.max(
            25,
            (candidate.thicknessMm ?? wall.thicknessMm ?? 200) / 2,
          );
          return wallRectAtJoin(candidate, join.point, candidateHalfThickMm) ?? [];
        });
      const cap = convexHull(rects);
      if (cap.length >= 3) caps.push(cap);
    }
  }
  if (intervals.length === 0) return null;

  intervals.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Array<{ start: number; end: number }> = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (!last || interval.start > last.end) {
      merged.push({ start: interval.start, end: interval.end });
    } else {
      last.end = Math.max(last.end, interval.end);
    }
  }

  const footprints: PlanPoint[][] = [];
  let cursor = 0;
  for (const interval of merged) {
    if (interval.start - cursor > 1) {
      const start = pointOnLine(centerStart, direction, cursor);
      const end = pointOnLine(centerStart, direction, interval.start);
      footprints.push([
        addPoint(start, normal, halfThickMm),
        addPoint(end, normal, halfThickMm),
        addPoint(end, normal, -halfThickMm),
        addPoint(start, normal, -halfThickMm),
      ]);
    }
    cursor = Math.max(cursor, interval.end);
  }
  if (lenMm - cursor > 1) {
    const start = pointOnLine(centerStart, direction, cursor);
    const end = pointOnLine(centerStart, direction, lenMm);
    footprints.push([
      addPoint(start, normal, halfThickMm),
      addPoint(end, normal, halfThickMm),
      addPoint(end, normal, -halfThickMm),
      addPoint(start, normal, -halfThickMm),
    ]);
  }

  return footprints.concat(caps);
}
