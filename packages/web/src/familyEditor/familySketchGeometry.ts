import type { SketchLine } from '../families/types';

export type FamilySketchRefPlane = {
  id: string;
  isVertical: boolean;
  offsetMm: number;
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

export function rederiveLockedSketchLines(
  lines: SketchLine[],
  refPlanes: FamilySketchRefPlane[],
  extentMm = 1000,
): SketchLine[] {
  const byId = new Map(refPlanes.map((plane) => [plane.id, plane]));
  return lines.map((line) => {
    if (!line.locked || line.source?.kind !== 'reference_plane') return cloneLine(line);
    const plane = byId.get(line.source.refPlaneId);
    if (!plane) return cloneLine(line);
    return {
      ...lineFromReferencePlane(plane, extentMm),
      source: { ...line.source },
      locked: true,
    };
  });
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
