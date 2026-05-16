import type { Element } from '@bim-ai/core';

type WallElem = Extract<Element, { kind: 'wall' }>;
type FloorElem = Extract<Element, { kind: 'floor' }>;
type LevelElem = Extract<Element, { kind: 'level' }>;

export interface RoofByFootprintParams {
  footprintMm: { xMm: number; yMm: number }[];
  referenceLevelId: string;
  overhangMm: number;
  slopeDeg: number;
}

/** Signed area — positive = counterclockwise, negative = clockwise (screen coords). */
function signedArea(pts: { xMm: number; yMm: number }[]): number {
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % n]!;
    area += a.xMm * b.yMm - b.xMm * a.yMm;
  }
  return area / 2;
}

/** Expand a polygon outward by overhangMm in each vertex bisector direction. */
export function expandFootprintByOverhang(
  pts: { xMm: number; yMm: number }[],
  overhangMm: number,
): { xMm: number; yMm: number }[] {
  if (pts.length < 3 || overhangMm <= 0) return pts;
  const n = pts.length;
  // Determine winding: CCW = +1, CW = -1. Outward normals are CW of edge direction for CCW.
  const sign = signedArea(pts) >= 0 ? 1 : -1;
  return pts.map((p, i) => {
    const prev = pts[(i - 1 + n) % n]!;
    const next = pts[(i + 1) % n]!;
    const ex = p.xMm - prev.xMm;
    const ey = p.yMm - prev.yMm;
    const el = Math.hypot(ex, ey);
    // Outward normal of in-edge: perpendicular rotated by sign
    const nx1 = el > 1e-6 ? (sign * ey) / el : 0;
    const ny1 = el > 1e-6 ? (-sign * ex) / el : 0;
    const fx = next.xMm - p.xMm;
    const fy = next.yMm - p.yMm;
    const fl = Math.hypot(fx, fy);
    // Outward normal of out-edge
    const nx2 = fl > 1e-6 ? (sign * fy) / fl : 0;
    const ny2 = fl > 1e-6 ? (-sign * fx) / fl : 0;
    const bx = nx1 + nx2;
    const by = ny1 + ny2;
    const bl = Math.hypot(bx, by);
    const scale = bl > 1e-6 ? overhangMm / bl : overhangMm;
    return { xMm: p.xMm + bx * scale, yMm: p.yMm + by * scale };
  });
}

/** Derive a roof-by-footprint command payload from a closed wall loop or floor boundary. */
export function roofParamsFromWallLoop(
  walls: WallElem[],
  levelId: string,
  overhangMm: number,
  slopeDeg: number,
): RoofByFootprintParams | null {
  if (walls.length < 3) return null;
  const footprint: { xMm: number; yMm: number }[] = walls.map((w) => ({
    xMm: w.start.xMm,
    yMm: w.start.yMm,
  }));
  const expanded = expandFootprintByOverhang(footprint, overhangMm);
  return { footprintMm: expanded, referenceLevelId: levelId, overhangMm, slopeDeg };
}

/** Derive a roof-by-footprint command payload from a floor element boundary. */
export function roofParamsFromFloor(
  floor: FloorElem,
  overhangMm: number,
  slopeDeg: number,
): RoofByFootprintParams | null {
  const boundary = floor.boundaryMm ?? [];
  if (boundary.length < 3) return null;
  const expanded = expandFootprintByOverhang(boundary, overhangMm);
  return {
    footprintMm: expanded,
    referenceLevelId: floor.levelId,
    overhangMm,
    slopeDeg,
  };
}

/** Derive ceiling boundary from a room element or wall-enclosed area. */
export function ceilingBoundaryFromRoom(
  roomId: string,
  elementsById: Record<string, Element>,
): { xMm: number; yMm: number }[] | null {
  const room = elementsById[roomId];
  if (!room || room.kind !== 'room') return null;
  const r = room as Extract<Element, { kind: 'room' }>;
  const boundary = (r as unknown as { boundaryMm?: { xMm: number; yMm: number }[] }).boundaryMm;
  return boundary && boundary.length >= 3 ? boundary : null;
}

/** Validate that a shaft span is contiguous — it must not skip any levels between baseLevelId and topLevelId. */
export function validateShaftSpan(
  baseLevelId: string,
  topLevelId: string,
  elementsById: Record<string, Element>,
): { valid: boolean; reason: string | null } {
  const levels = Object.values(elementsById)
    .filter((e): e is LevelElem => e.kind === 'level')
    .sort((a, b) => (a.elevationMm ?? 0) - (b.elevationMm ?? 0));

  const baseIdx = levels.findIndex((l) => l.id === baseLevelId);
  const topIdx = levels.findIndex((l) => l.id === topLevelId);

  if (baseIdx === -1) return { valid: false, reason: 'base_level_not_found' };
  if (topIdx === -1) return { valid: false, reason: 'top_level_not_found' };
  if (baseIdx >= topIdx) return { valid: false, reason: 'base_level_not_below_top' };

  const baseElev = levels[baseIdx]!.elevationMm ?? 0;
  const topElev = levels[topIdx]!.elevationMm ?? 0;
  if (topElev <= baseElev) return { valid: false, reason: 'top_not_above_base' };

  return { valid: true, reason: null };
}

/** Build an attachWallTop command payload. */
export function buildAttachTopCommand(
  wallId: string,
  targetKind: 'roof' | 'floor' | 'level',
  targetId: string,
): Record<string, unknown> {
  return {
    type: 'attachWallTop',
    wallId,
    targetKind,
    targetId,
  };
}

/** Build a detachWallTop command payload. */
export function buildDetachTopCommand(wallId: string): Record<string, unknown> {
  return {
    type: 'detachWallTop',
    wallId,
  };
}
