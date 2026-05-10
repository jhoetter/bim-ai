import type { SketchLine } from '../families/types';

export type FamilySketchRefPlane = {
  id: string;
  isVertical: boolean;
  offsetMm: number;
  locked?: boolean;
};

export type FamilySketchDimensionConstraint = {
  refAId: string;
  refBId: string;
  paramKey: string;
  lockedValueMm?: number;
};

type Point = { xMm: number; yMm: number };

function normalizeCoordinate(value: number): number {
  return Math.abs(value) < 1e-9 ? 0 : value;
}

function cloneLine(line: SketchLine): SketchLine {
  return {
    ...line,
    startMm: { ...line.startMm },
    endMm: { ...line.endMm },
    ...(line.source ? { source: { ...line.source } } : {}),
  };
}

export function lineFromReferencePlane(plane: FamilySketchRefPlane, extentMm = 1000): SketchLine {
  if (plane.isVertical) {
    return {
      startMm: { xMm: plane.offsetMm, yMm: -extentMm },
      endMm: { xMm: plane.offsetMm, yMm: extentMm },
    };
  }
  return {
    startMm: { xMm: -extentMm, yMm: plane.offsetMm },
    endMm: { xMm: extentMm, yMm: plane.offsetMm },
  };
}

export function pickedReferencePlaneLine(
  plane: FamilySketchRefPlane,
  locked: boolean,
  extentMm = 1000,
): SketchLine {
  return {
    ...lineFromReferencePlane(plane, extentMm),
    source: { kind: 'reference_plane', refPlaneId: plane.id },
    locked,
  };
}

export function pickedFamilyGeometryLine(
  line: SketchLine,
  source: Extract<NonNullable<SketchLine['source']>, { kind: 'family_geometry' }>,
  locked: boolean,
): SketchLine {
  return {
    ...cloneLine(line),
    source: { ...source },
    locked,
  };
}

export function rederiveLockedSketchLines(
  lines: SketchLine[],
  refPlanes: FamilySketchRefPlane[],
  familyGeometryLinesOrExtentMm: SketchLine[] | number = [],
  extentMmArg = 1000,
): SketchLine[] {
  const familyGeometryLines = Array.isArray(familyGeometryLinesOrExtentMm)
    ? familyGeometryLinesOrExtentMm
    : [];
  const extentMm =
    typeof familyGeometryLinesOrExtentMm === 'number' ? familyGeometryLinesOrExtentMm : extentMmArg;
  const byId = new Map(refPlanes.map((plane) => [plane.id, plane]));
  return lines.map((line) => {
    if (!line.locked) return cloneLine(line);
    if (line.source?.kind === 'reference_plane') {
      const plane = byId.get(line.source.refPlaneId);
      if (!plane) return cloneLine(line);
      return {
        ...lineFromReferencePlane(plane, extentMm),
        source: { ...line.source },
        locked: true,
      };
    }
    if (line.source?.kind === 'family_geometry') {
      const sourceLine = familyGeometryLines[line.source.index];
      if (!sourceLine) return cloneLine(line);
      return {
        ...cloneLine(sourceLine),
        source: { ...line.source },
        locked: true,
      };
    }
    return cloneLine(line);
  });
}

function dimensionTargetMm(
  constraint: FamilySketchDimensionConstraint,
  paramValues: Record<string, unknown>,
): number | null {
  const raw = paramValues[constraint.paramKey];
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, raw);
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return typeof constraint.lockedValueMm === 'number' && Number.isFinite(constraint.lockedValueMm)
    ? Math.max(0, constraint.lockedValueMm)
    : null;
}

export function solveReferencePlaneDimensionConstraints<T extends FamilySketchRefPlane>(
  refPlanes: T[],
  constraints: FamilySketchDimensionConstraint[],
  paramValues: Record<string, unknown>,
): T[] {
  const next = refPlanes.map((plane) => ({ ...plane }));
  const byId = new Map(next.map((plane) => [plane.id, plane]));
  for (const constraint of constraints) {
    const a = byId.get(constraint.refAId);
    const b = byId.get(constraint.refBId);
    const targetMm = dimensionTargetMm(constraint, paramValues);
    if (!a || !b || targetMm === null || a.isVertical !== b.isVertical) continue;
    const direction = b.offsetMm >= a.offsetMm ? 1 : -1;
    if (!b.locked) {
      b.offsetMm = Math.round(a.offsetMm + direction * targetMm);
    } else if (!a.locked) {
      a.offsetMm = Math.round(b.offsetMm - direction * targetMm);
    }
  }
  return next;
}

function infiniteLineIntersection(a: SketchLine, b: SketchLine): Point | null {
  const x1 = a.startMm.xMm;
  const y1 = a.startMm.yMm;
  const x2 = a.endMm.xMm;
  const y2 = a.endMm.yMm;
  const x3 = b.startMm.xMm;
  const y3 = b.startMm.yMm;
  const x4 = b.endMm.xMm;
  const y4 = b.endMm.yMm;
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-9) return null;
  return {
    xMm: normalizeCoordinate(
      ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denom,
    ),
    yMm: normalizeCoordinate(
      ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denom,
    ),
  };
}

function distanceSq(a: Point, b: Point): number {
  const dx = a.xMm - b.xMm;
  const dy = a.yMm - b.yMm;
  return dx * dx + dy * dy;
}

function moveNearestEndpointToCorner(line: SketchLine, corner: Point): SketchLine {
  const startDist = distanceSq(line.startMm, corner);
  const endDist = distanceSq(line.endMm, corner);
  if (startDist <= endDist) {
    return { ...cloneLine(line), startMm: { ...corner } };
  }
  return { ...cloneLine(line), endMm: { ...corner } };
}

export function trimExtendSketchLinesToCorner(
  lines: SketchLine[],
  firstIndex: number,
  secondIndex: number,
): SketchLine[] {
  if (firstIndex === secondIndex || !lines[firstIndex] || !lines[secondIndex]) {
    return lines.map(cloneLine);
  }
  const corner = infiniteLineIntersection(lines[firstIndex], lines[secondIndex]);
  if (!corner) return lines.map(cloneLine);
  return lines.map((line, index) => {
    if (index === firstIndex || index === secondIndex) {
      return moveNearestEndpointToCorner(line, corner);
    }
    return cloneLine(line);
  });
}
