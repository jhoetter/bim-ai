import type { Element, XY } from '@bim-ai/core';

/**
 * ANN-02 — derive section_cut / elevation_view parameters from a wall.
 *
 * Both helpers anchor on the wall midpoint. The section cuts perpendicular to
 * the wall direction (length = wall length + 2 × `padMm`); the elevation
 * direction snaps to the closest cardinal so users get a clean N/S/E/W
 * label whenever the wall is roughly axis-aligned.
 */

export type WallElement = Extract<Element, { kind: 'wall' }>;

export type SectionCutParamsFromWall = {
  lineStartMm: XY;
  lineEndMm: XY;
  cropDepthMm: number;
  name: string;
};

export type ElevationParamsFromWall = {
  direction: 'north' | 'south' | 'east' | 'west' | 'custom';
  customAngleDeg: number | null;
  cropMinMm: XY;
  cropMaxMm: XY;
  name: string;
};

const DEFAULT_PAD_MM = 2000;

function _wallMidpoint(w: WallElement): { mx: number; my: number } {
  return {
    mx: 0.5 * (w.start.xMm + w.end.xMm),
    my: 0.5 * (w.start.yMm + w.end.yMm),
  };
}

function _wallLengthMm(w: WallElement): number {
  const dx = w.end.xMm - w.start.xMm;
  const dy = w.end.yMm - w.start.yMm;
  return Math.hypot(dx, dy);
}

function _wallTangent(w: WallElement): { tx: number; ty: number } {
  const dx = w.end.xMm - w.start.xMm;
  const dy = w.end.yMm - w.start.yMm;
  const len = Math.hypot(dx, dy) || 1;
  return { tx: dx / len, ty: dy / len };
}

/**
 * ANN-02 — generate a section_cut perpendicular to the wall through its
 * midpoint. Crop sized to the wall length + `padMm` on each side.
 */
export function sectionCutFromWall(
  wall: WallElement,
  opts: { padMm?: number } = {},
): SectionCutParamsFromWall {
  const padMm = opts.padMm ?? DEFAULT_PAD_MM;
  const { mx, my } = _wallMidpoint(wall);
  const { tx, ty } = _wallTangent(wall);
  // Section line is perpendicular to wall direction.
  const nx = -ty;
  const ny = tx;
  const halfLen = _wallLengthMm(wall) / 2 + padMm;
  return {
    lineStartMm: { xMm: mx - nx * halfLen, yMm: my - ny * halfLen },
    lineEndMm: { xMm: mx + nx * halfLen, yMm: my + ny * halfLen },
    cropDepthMm: _wallLengthMm(wall) + 2 * padMm,
    name: wall.name ? `Section through ${wall.name}` : 'Section through wall',
  };
}

/**
 * Snap a viewing-direction unit vector (pointing AT the wall) to the closest
 * cardinal compass label. The wall normal is what the elevation looks at, so
 * a wall running east-west has elevation directions north and south.
 */
function _cardinalForViewDir(
  vx: number,
  vy: number,
): {
  direction: 'north' | 'south' | 'east' | 'west' | 'custom';
  angleDeg: number | null;
} {
  const ax = Math.abs(vx);
  const ay = Math.abs(vy);
  // Snap when the off-axis component is < 5° (~tan 5° ≈ 0.087).
  const SNAP_TAN = Math.tan((5 * Math.PI) / 180);
  if (ay >= ax && ax / (ay || 1) <= SNAP_TAN) {
    return { direction: vy >= 0 ? 'north' : 'south', angleDeg: null };
  }
  if (ax > ay && ay / (ax || 1) <= SNAP_TAN) {
    return { direction: vx >= 0 ? 'east' : 'west', angleDeg: null };
  }
  return { direction: 'custom', angleDeg: (Math.atan2(vy, vx) * 180) / Math.PI };
}

/**
 * ANN-02 — generate an elevation_view oriented to face the wall. The crop
 * rectangle is sized to the wall length + a small pad; the centre of the
 * crop sits on the wall midpoint.
 */
export function elevationFromWall(
  wall: WallElement,
  opts: { padMm?: number; viewSide?: 'left' | 'right' } = {},
): ElevationParamsFromWall {
  const padMm = opts.padMm ?? DEFAULT_PAD_MM;
  const side = opts.viewSide ?? 'left';
  const { mx, my } = _wallMidpoint(wall);
  const { tx, ty } = _wallTangent(wall);
  // Wall has two normals (left = (-ty, tx), right = (ty, -tx)). The viewer
  // stands on `side`; the elevation looks toward the *opposite* side, i.e.
  // toward the wall.
  const nLx = -ty;
  const nLy = tx;
  const viewDirX = side === 'left' ? nLx : -nLx;
  const viewDirY = side === 'left' ? nLy : -nLy;
  const { direction, angleDeg } = _cardinalForViewDir(viewDirX, viewDirY);
  const halfLen = _wallLengthMm(wall) / 2 + padMm;
  // Crop runs along the wall tangent for the X span, plus a tall vertical
  // extent — but elevation crop is in *plan* mm here, so the height
  // axis is the world Y. We approximate as a square box around the midpoint.
  return {
    direction,
    customAngleDeg: angleDeg,
    cropMinMm: { xMm: mx - halfLen, yMm: my - halfLen },
    cropMaxMm: { xMm: mx + halfLen, yMm: my + halfLen },
    name:
      direction === 'custom'
        ? wall.name
          ? `Elevation of ${wall.name}`
          : 'Elevation of wall'
        : `${direction[0].toUpperCase()}${direction.slice(1)} Elevation${
            wall.name ? ` (${wall.name})` : ''
          }`,
  };
}
