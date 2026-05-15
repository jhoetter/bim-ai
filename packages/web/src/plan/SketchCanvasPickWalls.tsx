/* eslint-disable bim-ai/no-hex-in-chrome -- pre-v3 hex literals; remove when this file is migrated in B4 Phase 2 */
/**
 * SKT-02 — Pick Walls helpers (hit-testing + offset-mode chip).
 *
 * Hit-test is pure 2D: distance from the cursor (in level-local mm) to each
 * wall's centre-axis segment. A wall is "under the cursor" when this distance
 * is within `(thickness/2 + tol)`. The hit-tested wall id is then sent through
 * `pickWall(sessionId, wallId)` which toggles its membership in the sketch
 * session's `picked_walls`.
 *
 * Re-clicking a picked wall toggles it off (server-side), so the UI doesn't
 * need to track the pick set itself — it just renders whatever the server
 * returns as session lines.
 */
import { type CSSProperties, type JSX } from 'react';

import type { PickWallsOffsetMode } from './sketchApi';

export type WallForPicking = {
  id: string;
  startMm: { xMm: number; yMm: number };
  endMm: { xMm: number; yMm: number };
  thicknessMm: number;
};
export type WallScreenProjector = (pt: {
  xMm: number;
  yMm: number;
}) => { x: number; y: number } | null;

const HIT_PADDING_MM = 75;
const MIN_SCREEN_HIT_PX = 12;
const MAX_SCREEN_HIT_PX = 48;

function _distancePointToSegmentMm(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.hypot(px - ax, py - ay);
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function _distancePointToSegmentPx(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.hypot(px - ax, py - ay);
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Returns the wall whose centre-axis segment is closest to the cursor (in mm),
 * if that distance is within `thickness/2 + HIT_PADDING_MM`. Otherwise null.
 *
 * When multiple walls qualify (e.g. at a corner) the closest one wins.
 */
export function hitTestWallAtMm(
  walls: WallForPicking[],
  ptMm: { xMm: number; yMm: number },
): string | null {
  let best: { id: string; dist: number } | null = null;
  for (const w of walls) {
    const dist = _distancePointToSegmentMm(
      ptMm.xMm,
      ptMm.yMm,
      w.startMm.xMm,
      w.startMm.yMm,
      w.endMm.xMm,
      w.endMm.yMm,
    );
    const tol = w.thicknessMm / 2 + HIT_PADDING_MM;
    if (dist > tol) continue;
    if (best === null || dist < best.dist) {
      best = { id: w.id, dist };
    }
  }
  return best?.id ?? null;
}

/**
 * Returns the wall whose projected screen segment is closest to the cursor.
 *
 * Pick Walls is a visual command: the wall under the cursor should be the wall
 * the user can see, even if the plan's model-coordinate readout is panned,
 * rotated, or temporarily stale. We therefore prefer screen-space hit testing
 * against `mmToScreen` projections and use model-space hit testing only as a
 * fallback in the component.
 */
export function hitTestWallAtScreen(
  walls: WallForPicking[],
  screenPt: { x: number; y: number },
  project: WallScreenProjector | null | undefined,
): string | null {
  if (!project) return null;
  let best: { id: string; dist: number } | null = null;
  for (const wall of walls) {
    const a = project(wall.startMm);
    const b = project(wall.endMm);
    if (!a || !b) continue;
    const dxMm = wall.endMm.xMm - wall.startMm.xMm;
    const dyMm = wall.endMm.yMm - wall.startMm.yMm;
    const lenMm = Math.hypot(dxMm, dyMm);
    if (lenMm === 0) continue;
    const nx = -dyMm / lenMm;
    const ny = dxMm / lenMm;
    const tolProbe = project({
      xMm: wall.startMm.xMm + nx * (wall.thicknessMm / 2 + HIT_PADDING_MM),
      yMm: wall.startMm.yMm + ny * (wall.thicknessMm / 2 + HIT_PADDING_MM),
    });
    const projectedTol = tolProbe
      ? Math.hypot(tolProbe.x - a.x, tolProbe.y - a.y)
      : MIN_SCREEN_HIT_PX;
    const tol = Math.max(MIN_SCREEN_HIT_PX, Math.min(MAX_SCREEN_HIT_PX, projectedTol));
    const dist = _distancePointToSegmentPx(screenPt.x, screenPt.y, a.x, a.y, b.x, b.y);
    if (dist > tol) continue;
    if (best === null || dist < best.dist) {
      best = { id: wall.id, dist };
    }
  }
  return best?.id ?? null;
}

export function snapPointToNearestWallFaceMm(
  walls: WallForPicking[],
  ptMm: { xMm: number; yMm: number },
): { xMm: number; yMm: number } | null {
  let best: { wall: WallForPicking; dist: number; cx: number; cy: number } | null = null;
  for (const wall of walls) {
    const ax = wall.startMm.xMm;
    const ay = wall.startMm.yMm;
    const bx = wall.endMm.xMm;
    const by = wall.endMm.yMm;
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;
    const t = Math.max(0, Math.min(1, ((ptMm.xMm - ax) * dx + (ptMm.yMm - ay) * dy) / lenSq));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const dist = Math.hypot(ptMm.xMm - cx, ptMm.yMm - cy);
    if (dist > wall.thicknessMm / 2 + HIT_PADDING_MM) continue;
    if (best === null || dist < best.dist) best = { wall, dist, cx, cy };
  }
  if (best === null) return null;
  const wx = best.wall.endMm.xMm - best.wall.startMm.xMm;
  const wy = best.wall.endMm.yMm - best.wall.startMm.yMm;
  const len = Math.hypot(wx, wy);
  if (len === 0) return null;
  const nx = -wy / len;
  const ny = wx / len;
  const side = (ptMm.xMm - best.cx) * nx + (ptMm.yMm - best.cy) * ny >= 0 ? 1 : -1;
  return {
    xMm: best.cx + nx * side * (best.wall.thicknessMm / 2),
    yMm: best.cy + ny * side * (best.wall.thicknessMm / 2),
  };
}

interface OffsetModeChipProps {
  mode: PickWallsOffsetMode;
  onChange: (next: PickWallsOffsetMode) => void;
  disabled?: boolean;
}

/**
 * Inline two-state toggle for the Pick Walls offset mode (interior face vs.
 * centerline). Lives next to the Pick Walls button on the sketch toolbar.
 */
export function OffsetModeChip({ mode, onChange, disabled }: OffsetModeChipProps): JSX.Element {
  const baseStyle: CSSProperties = {
    padding: '3px 8px',
    fontSize: 10,
    border: '1px solid #33424d',
    backgroundColor: 'transparent',
    color: '#cfd6db',
    cursor: disabled ? 'not-allowed' : 'pointer',
    borderRadius: 4,
  };
  const activeStyle: CSSProperties = {
    backgroundColor: '#3fc5d3',
    color: '#0d1216',
    borderColor: '#3fc5d3',
  };
  return (
    <div style={{ display: 'inline-flex', gap: 2 }} data-testid="sketch-pick-walls-offset-chip">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('interior_face')}
        style={mode === 'interior_face' ? { ...baseStyle, ...activeStyle } : baseStyle}
        title="Offset by half wall thickness toward the interior face (Revit default)"
      >
        Interior
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('centerline')}
        style={mode === 'centerline' ? { ...baseStyle, ...activeStyle } : baseStyle}
        title="Use wall centerlines (no offset)"
      >
        Centerline
      </button>
    </div>
  );
}
