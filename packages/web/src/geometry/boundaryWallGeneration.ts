import type { Element, WallLocationLine } from '@bim-ai/core';

export type BoundaryWallSource =
  | Extract<Element, { kind: 'floor' }>
  | Extract<Element, { kind: 'room' }>;

export type BoundaryWallSegmentStatus = 'create' | 'conflict' | 'invalid';

export interface BoundaryWallPlanSegment {
  id: string;
  index: number;
  start: { xMm: number; yMm: number };
  end: { xMm: number; yMm: number };
  lengthMm: number;
  status: BoundaryWallSegmentStatus;
  reason: string | null;
  existingWallIds: string[];
}

export interface BoundaryWallGenerationOptions {
  wallTypeId?: string | null;
  wallHeightMm?: number;
  wallThicknessMm?: number;
  locationLine?: WallLocationLine;
  skipExistingOverlaps?: boolean;
  overlapToleranceMm?: number;
  minimumSegmentLengthMm?: number;
}

export interface BoundaryWallPlan {
  sourceId: string;
  sourceKind: BoundaryWallSource['kind'];
  levelId: string;
  segments: BoundaryWallPlanSegment[];
  createCount: number;
  conflictCount: number;
  invalidCount: number;
  canCommit: boolean;
  command: Record<string, unknown> | null;
}

const DEFAULT_WALL_HEIGHT_MM = 3000;
const DEFAULT_WALL_THICKNESS_MM = 200;
const DEFAULT_OVERLAP_TOLERANCE_MM = 250;
const DEFAULT_MINIMUM_SEGMENT_LENGTH_MM = 100;
const PARALLEL_CROSS_TOLERANCE = 0.035;

function sourceBoundary(source: BoundaryWallSource): { xMm: number; yMm: number }[] {
  return source.kind === 'room' ? source.outlineMm : source.boundaryMm;
}

function distanceMm(a: { xMm: number; yMm: number }, b: { xMm: number; yMm: number }): number {
  return Math.hypot(a.xMm - b.xMm, a.yMm - b.yMm);
}

function sanitizeIdPart(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 72) || 'source'
  );
}

function stableHashSegment(
  index: number,
  start: { xMm: number; yMm: number },
  end: { xMm: number; yMm: number },
): string {
  const raw = [index, start.xMm, start.yMm, end.xMm, end.yMm]
    .map((value) => Math.round(value))
    .join('|');
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function deterministicWallId(
  source: BoundaryWallSource,
  index: number,
  start: { xMm: number; yMm: number },
  end: { xMm: number; yMm: number },
): string {
  return `wall-from-${source.kind}-${sanitizeIdPart(source.id)}-${index}-${stableHashSegment(index, start, end)}`;
}

function pointLineDistanceMm(
  point: { xMm: number; yMm: number },
  start: { xMm: number; yMm: number },
  end: { xMm: number; yMm: number },
): number {
  const dx = end.xMm - start.xMm;
  const dy = end.yMm - start.yMm;
  const len = Math.hypot(dx, dy);
  if (len <= 1e-6) return distanceMm(point, start);
  return Math.abs((point.xMm - start.xMm) * dy - (point.yMm - start.yMm) * dx) / len;
}

function projectedInterval(
  a: { xMm: number; yMm: number },
  b: { xMm: number; yMm: number },
  origin: { xMm: number; yMm: number },
  dir: { x: number; y: number },
): [number, number] {
  const pa = (a.xMm - origin.xMm) * dir.x + (a.yMm - origin.yMm) * dir.y;
  const pb = (b.xMm - origin.xMm) * dir.x + (b.yMm - origin.yMm) * dir.y;
  return pa <= pb ? [pa, pb] : [pb, pa];
}

function intervalOverlapMm(a: [number, number], b: [number, number]): number {
  return Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));
}

function overlappingWallIds(
  segment: Pick<BoundaryWallPlanSegment, 'start' | 'end' | 'lengthMm'>,
  walls: Array<Extract<Element, { kind: 'wall' }>>,
  levelId: string,
  toleranceMm: number,
): string[] {
  if (segment.lengthMm <= 1e-6) return [];
  const dx = segment.end.xMm - segment.start.xMm;
  const dy = segment.end.yMm - segment.start.yMm;
  const dir = { x: dx / segment.lengthMm, y: dy / segment.lengthMm };
  const segmentInterval: [number, number] = [0, segment.lengthMm];
  const ids: string[] = [];

  for (const wall of walls) {
    if (wall.levelId !== levelId) continue;
    const wallLength = distanceMm(wall.start, wall.end);
    if (wallLength <= 1e-6) continue;
    const wallDir = {
      x: (wall.end.xMm - wall.start.xMm) / wallLength,
      y: (wall.end.yMm - wall.start.yMm) / wallLength,
    };
    const cross = Math.abs(dir.x * wallDir.y - dir.y * wallDir.x);
    if (cross > PARALLEL_CROSS_TOLERANCE) continue;
    const startDistance = pointLineDistanceMm(wall.start, segment.start, segment.end);
    const endDistance = pointLineDistanceMm(wall.end, segment.start, segment.end);
    if (Math.max(startDistance, endDistance) > toleranceMm) continue;
    const wallInterval = projectedInterval(wall.start, wall.end, segment.start, dir);
    const overlap = intervalOverlapMm(segmentInterval, wallInterval);
    const requiredOverlap = Math.min(
      750,
      Math.max(100, Math.min(segment.lengthMm, wallLength) * 0.25),
    );
    if (overlap >= requiredOverlap) ids.push(wall.id);
  }

  return ids.sort();
}

export function wallThicknessFromType(
  elementsById: Record<string, Element>,
  wallTypeId: string | null | undefined,
  fallbackMm = DEFAULT_WALL_THICKNESS_MM,
): number {
  if (!wallTypeId) return fallbackMm;
  const type = elementsById[wallTypeId];
  if (type?.kind !== 'wall_type' || !Array.isArray(type.layers) || type.layers.length === 0) {
    return fallbackMm;
  }
  const sum = type.layers.reduce((acc, layer) => acc + (Number(layer.thicknessMm) || 0), 0);
  return sum > 0 ? sum : fallbackMm;
}

export function buildBoundaryWallPlan(
  source: BoundaryWallSource,
  elementsById: Record<string, Element>,
  options: BoundaryWallGenerationOptions = {},
): BoundaryWallPlan {
  const wallHeightMm = options.wallHeightMm ?? DEFAULT_WALL_HEIGHT_MM;
  const wallThicknessMm = wallThicknessFromType(
    elementsById,
    options.wallTypeId,
    options.wallThicknessMm ?? DEFAULT_WALL_THICKNESS_MM,
  );
  const locationLine = options.locationLine ?? 'wall-centerline';
  const skipExistingOverlaps = options.skipExistingOverlaps ?? true;
  const overlapToleranceMm = options.overlapToleranceMm ?? DEFAULT_OVERLAP_TOLERANCE_MM;
  const minimumSegmentLengthMm =
    options.minimumSegmentLengthMm ?? DEFAULT_MINIMUM_SEGMENT_LENGTH_MM;
  const walls = Object.values(elementsById).filter(
    (element): element is Extract<Element, { kind: 'wall' }> => element.kind === 'wall',
  );
  const boundary = sourceBoundary(source).filter(
    (point) => Number.isFinite(point.xMm) && Number.isFinite(point.yMm),
  );
  const segments: BoundaryWallPlanSegment[] = [];

  for (let index = 0; index < boundary.length; index += 1) {
    const start = boundary[index];
    const end = boundary[(index + 1) % boundary.length];
    if (!start || !end) continue;
    const lengthMm = distanceMm(start, end);
    const id = deterministicWallId(source, index, start, end);
    const existingWallIds = overlappingWallIds(
      { start, end, lengthMm },
      walls,
      source.levelId,
      overlapToleranceMm,
    );
    const idCollision = elementsById[id] !== undefined;
    const tooShort = lengthMm < minimumSegmentLengthMm;
    let status: BoundaryWallSegmentStatus = 'create';
    let reason: string | null = null;
    if (tooShort) {
      status = 'invalid';
      reason = `Segment is shorter than ${minimumSegmentLengthMm} mm`;
    } else if (idCollision) {
      status = 'conflict';
      reason = 'A deterministic generated wall already exists for this edge';
    } else if (skipExistingOverlaps && existingWallIds.length > 0) {
      status = 'conflict';
      reason = `Existing overlapping wall${existingWallIds.length === 1 ? '' : 's'}: ${existingWallIds.join(', ')}`;
    }
    segments.push({ id, index, start, end, lengthMm, status, reason, existingWallIds });
  }

  const createSegments = segments.filter((segment) => segment.status === 'create');
  const command =
    createSegments.length > 0
      ? {
          type: 'createWallChain',
          levelId: source.levelId,
          namePrefix: `${source.name || source.kind} boundary wall`,
          wallTypeId: options.wallTypeId ?? undefined,
          locationLine,
          segments: createSegments.map((segment) => ({
            id: segment.id,
            start: segment.start,
            end: segment.end,
            thicknessMm: wallThicknessMm,
            heightMm: wallHeightMm,
          })),
        }
      : null;

  const conflictCount = segments.filter((segment) => segment.status === 'conflict').length;
  const invalidCount = segments.filter((segment) => segment.status === 'invalid').length;
  return {
    sourceId: source.id,
    sourceKind: source.kind,
    levelId: source.levelId,
    segments,
    createCount: createSegments.length,
    conflictCount,
    invalidCount,
    canCommit: Boolean(command) && invalidCount === 0,
    command,
  };
}
