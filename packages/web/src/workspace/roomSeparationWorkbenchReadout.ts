import type { Element } from '@bim-ai/core';

import type { PlanProjectionPrimitivesV1Wire } from '../plan/planProjectionWire';

/** Matches `bim_ai.room_derivation` axis segment gate for near-horizontal / near-vertical segments. */
export const ROOM_SEPARATION_AXIS_ALIGN_TOL_MM = 25;
/** Matches `bim_ai.room_derivation` minimum segment length for boundary participation. */
export const ROOM_SEPARATION_MIN_LENGTH_MM = 80;

export type RoomSeparationWorkbenchReadout = {
  id: string;
  name: string;
  levelId: string;
  levelName: string;
  startXMm: number;
  startYMm: number;
  endXMm: number;
  endYMm: number;
  lengthMm: number;
  axisAlignedBoundarySegmentEligible: boolean;
  axisBoundarySegmentExcludedReason: string | null;
  onAuthoritativeDerivedFootprintBoundary: boolean;
  piercesDerivedRectangleInterior: boolean;
};

function readWireBool(raw: unknown): boolean | undefined {
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0) return false;
  return undefined;
}

function wireRowForSeparationId(
  wirePrimitives: PlanProjectionPrimitivesV1Wire | null,
  separationId: string,
): Record<string, unknown> | null {
  if (!wirePrimitives) return null;
  const rows = wirePrimitives.roomSeparations;
  if (!Array.isArray(rows)) return null;
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (String(o.id ?? '') === separationId) return o;
  }
  return null;
}

/** Client-side check matching server axis-aligned segment eligibility (bounded authoring). */
export function validateAxisAlignedSeparationSegmentMm(
  startXMm: number,
  startYMm: number,
  endXMm: number,
  endYMm: number,
): { ok: true } | { ok: false; message: string } {
  const dx = Math.abs(endXMm - startXMm);
  const dy = Math.abs(endYMm - startYMm);
  const len = Math.hypot(dx, dy);
  if (len < ROOM_SEPARATION_MIN_LENGTH_MM - 1e-6) {
    return {
      ok: false,
      message: `Segment length must be at least ${ROOM_SEPARATION_MIN_LENGTH_MM} mm.`,
    };
  }
  if (dx < ROOM_SEPARATION_AXIS_ALIGN_TOL_MM || dy < ROOM_SEPARATION_AXIS_ALIGN_TOL_MM) {
    return { ok: true };
  }
  return {
    ok: false,
    message: 'Segment must be axis-aligned (same X or same Y within tolerance).',
  };
}

export function buildRoomSeparationWorkbenchReadout(
  separation: Extract<Element, { kind: 'room_separation' }>,
  elementsById: Record<string, Element>,
  wirePrimitives: PlanProjectionPrimitivesV1Wire | null,
): RoomSeparationWorkbenchReadout {
  const lvl = elementsById[separation.levelId];
  const levelName = lvl?.kind === 'level' ? lvl.name : separation.levelId;
  const wr = wireRowForSeparationId(wirePrimitives, separation.id);

  const sx = separation.start.xMm;
  const sy = separation.start.yMm;
  const ex = separation.end.xMm;
  const ey = separation.end.yMm;
  const lengthMm = Math.round(Math.hypot(ex - sx, ey - sy) * 1000) / 1000;

  let axisAlignedBoundarySegmentEligible = false;
  let axisBoundarySegmentExcludedReason: string | null = null;
  let onAuthoritativeDerivedFootprintBoundary = false;
  let piercesDerivedRectangleInterior = false;

  if (wr) {
    axisAlignedBoundarySegmentEligible =
      readWireBool(wr.axisAlignedBoundarySegmentEligible) ?? false;
    const rsn = wr.axisBoundarySegmentExcludedReason ?? wr.axis_boundary_segment_excluded_reason;
    if (typeof rsn === 'string' && rsn) axisBoundarySegmentExcludedReason = rsn;
    onAuthoritativeDerivedFootprintBoundary =
      readWireBool(wr.onAuthoritativeDerivedFootprintBoundary) ??
      readWireBool(wr.on_authoritative_derived_footprint_boundary) ??
      false;
    piercesDerivedRectangleInterior =
      readWireBool(wr.piercesDerivedRectangleInterior) ??
      readWireBool(wr.pierces_derived_rectangle_interior) ??
      false;
  } else {
    const v = validateAxisAlignedSeparationSegmentMm(sx, sy, ex, ey);
    axisAlignedBoundarySegmentEligible = v.ok;
    if (!v.ok) {
      const dx = Math.abs(ex - sx);
      const dy = Math.abs(ey - sy);
      const len = Math.hypot(dx, dy);
      axisBoundarySegmentExcludedReason =
        len < ROOM_SEPARATION_MIN_LENGTH_MM - 1e-6 ? 'too_short' : 'non_axis_aligned';
    }
  }

  return {
    id: separation.id,
    name: separation.name,
    levelId: separation.levelId,
    levelName,
    startXMm: sx,
    startYMm: sy,
    endXMm: ex,
    endYMm: ey,
    lengthMm,
    axisAlignedBoundarySegmentEligible,
    axisBoundarySegmentExcludedReason,
    onAuthoritativeDerivedFootprintBoundary,
    piercesDerivedRectangleInterior,
  };
}

export function buildRoomSeparationEvidenceToken(r: RoomSeparationWorkbenchReadout): string {
  return [
    r.id,
    r.lengthMm,
    r.axisAlignedBoundarySegmentEligible ? '1' : '0',
    r.axisBoundarySegmentExcludedReason ?? '',
    r.onAuthoritativeDerivedFootprintBoundary ? '1' : '0',
    r.piercesDerivedRectangleInterior ? '1' : '0',
  ].join('|');
}
