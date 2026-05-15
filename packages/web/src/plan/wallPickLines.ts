import type { DxfLineworkPrim, Element, WallLocationLine, XY } from '@bim-ai/core';

import { makeDxfLinkTransform, type DxfPrimitiveQueryHit } from './dxfUnderlay';

export type PickedWallLineSource = 'floor-edge' | 'dxf-line';

export type PickedWallLine = {
  source: PickedWallLineSource;
  sourceId: string;
  sourceLabel: string;
  start: XY;
  end: XY;
  distanceMm: number;
};

export type PickedWallLineCommandOptions = {
  id: string;
  levelId: string;
  wallTypeId?: string | null;
  locationLine: WallLocationLine;
  heightMm: number;
};

const MIN_PICKED_WALL_LENGTH_MM = 100;
const PARALLEL_CROSS_TOLERANCE = 0.035;

function distanceMm(a: XY, b: XY): number {
  return Math.hypot(a.xMm - b.xMm, a.yMm - b.yMm);
}

function distancePointToSegmentMm(point: XY, start: XY, end: XY): number {
  const dx = end.xMm - start.xMm;
  const dy = end.yMm - start.yMm;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 1e-9) return distanceMm(point, start);
  const t = Math.max(
    0,
    Math.min(1, ((point.xMm - start.xMm) * dx + (point.yMm - start.yMm) * dy) / len2),
  );
  return distanceMm(point, { xMm: start.xMm + dx * t, yMm: start.yMm + dy * t });
}

function arcToPolylineSegments(arc: Extract<DxfLineworkPrim, { kind: 'arc' }>): XY[] {
  const start = arc.startDeg;
  let end = arc.endDeg;
  if (end < start) end += 360;
  const sweep = Math.max(0.0001, end - start);
  const stepDeg = 6;
  const steps = Math.max(2, Math.ceil(sweep / stepDeg));
  const out: XY[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const deg = start + (sweep * i) / steps;
    const rad = (deg * Math.PI) / 180;
    out.push({
      xMm: arc.center.xMm + arc.radiusMm * Math.cos(rad),
      yMm: arc.center.yMm + arc.radiusMm * Math.sin(rad),
    });
  }
  return out;
}

function primitiveSegmentsMm(prim: DxfLineworkPrim): Array<[XY, XY]> {
  if (prim.kind === 'line') return [[prim.start, prim.end]];
  if (prim.kind === 'polyline') {
    const segments: Array<[XY, XY]> = [];
    for (let i = 0; i < prim.points.length - 1; i += 1) {
      segments.push([prim.points[i]!, prim.points[i + 1]!]);
    }
    if (prim.closed && prim.points.length > 2) {
      segments.push([prim.points[prim.points.length - 1]!, prim.points[0]!]);
    }
    return segments;
  }
  const points = arcToPolylineSegments(prim);
  const segments: Array<[XY, XY]> = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    segments.push([points[i]!, points[i + 1]!]);
  }
  return segments;
}

function maybeBestSegment(
  current: PickedWallLine | null,
  candidate: Omit<PickedWallLine, 'distanceMm'>,
  point: XY,
): PickedWallLine | null {
  const length = distanceMm(candidate.start, candidate.end);
  if (length < MIN_PICKED_WALL_LENGTH_MM) return current;
  const distance = distancePointToSegmentMm(point, candidate.start, candidate.end);
  if (current && current.distanceMm <= distance) return current;
  return { ...candidate, distanceMm: distance };
}

export function pickFloorBoundaryEdgeForWall(
  elementsById: Record<string, Element>,
  levelId: string | undefined,
  point: XY,
  toleranceMm: number,
): PickedWallLine | null {
  let best: PickedWallLine | null = null;
  for (const element of Object.values(elementsById)) {
    if (element.kind !== 'floor') continue;
    if (levelId && element.levelId !== levelId) continue;
    const boundary = element.boundaryMm ?? [];
    for (let index = 0; index < boundary.length; index += 1) {
      const start = boundary[index];
      const end = boundary[(index + 1) % boundary.length];
      if (!start || !end) continue;
      const candidate = maybeBestSegment(
        best,
        {
          source: 'floor-edge',
          sourceId: element.id,
          sourceLabel: `${element.name || 'Floor'} edge ${index + 1}`,
          start,
          end,
        },
        point,
      );
      if (candidate && candidate.distanceMm <= toleranceMm) best = candidate;
    }
  }
  return best && best.distanceMm <= toleranceMm ? best : null;
}

export function pickDxfLineForWall(
  hit: DxfPrimitiveQueryHit | null,
  point: XY,
  elementsById: Record<string, Element>,
): PickedWallLine | null {
  if (!hit) return null;
  const transform = makeDxfLinkTransform(hit.link, elementsById);
  let best: PickedWallLine | null = null;
  for (const [rawStart, rawEnd] of primitiveSegmentsMm(hit.primitive)) {
    best = maybeBestSegment(
      best,
      {
        source: 'dxf-line',
        sourceId: hit.link.id,
        sourceLabel: `${hit.link.name || 'DXF'} / ${hit.layerName}`,
        start: transform(rawStart),
        end: transform(rawEnd),
      },
      point,
    );
  }
  return best;
}

function projectedInterval(
  a: XY,
  b: XY,
  origin: XY,
  dir: { x: number; y: number },
): [number, number] {
  const pa = (a.xMm - origin.xMm) * dir.x + (a.yMm - origin.yMm) * dir.y;
  const pb = (b.xMm - origin.xMm) * dir.x + (b.yMm - origin.yMm) * dir.y;
  return pa <= pb ? [pa, pb] : [pb, pa];
}

function intervalOverlapMm(a: [number, number], b: [number, number]): number {
  return Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));
}

export function hasOverlappingWallLine(
  elementsById: Record<string, Element>,
  levelId: string | undefined,
  line: Pick<PickedWallLine, 'start' | 'end'>,
  toleranceMm: number,
): boolean {
  const length = distanceMm(line.start, line.end);
  if (length < MIN_PICKED_WALL_LENGTH_MM) return false;
  const dir = {
    x: (line.end.xMm - line.start.xMm) / length,
    y: (line.end.yMm - line.start.yMm) / length,
  };
  for (const element of Object.values(elementsById)) {
    if (element.kind !== 'wall') continue;
    if (levelId && element.levelId !== levelId) continue;
    const wallLength = distanceMm(element.start, element.end);
    if (wallLength < MIN_PICKED_WALL_LENGTH_MM) continue;
    const wallDir = {
      x: (element.end.xMm - element.start.xMm) / wallLength,
      y: (element.end.yMm - element.start.yMm) / wallLength,
    };
    const cross = Math.abs(dir.x * wallDir.y - dir.y * wallDir.x);
    if (cross > PARALLEL_CROSS_TOLERANCE) continue;
    if (
      Math.max(
        distancePointToSegmentMm(element.start, line.start, line.end),
        distancePointToSegmentMm(element.end, line.start, line.end),
      ) > toleranceMm
    ) {
      continue;
    }
    const overlap = intervalOverlapMm(
      [0, length],
      projectedInterval(element.start, element.end, line.start, dir),
    );
    if (overlap >= Math.min(length, wallLength) * 0.25) return true;
  }
  return false;
}

export function createWallFromPickedLineCommand(
  line: PickedWallLine,
  options: PickedWallLineCommandOptions,
): Record<string, unknown> {
  return {
    type: 'createWall',
    id: options.id,
    levelId: options.levelId,
    start: line.start,
    end: line.end,
    locationLine: options.locationLine,
    wallTypeId: options.wallTypeId ?? undefined,
    heightMm: options.heightMm,
  };
}
