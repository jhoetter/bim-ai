/**
 * KRN-12: resolve a window's outline polygon for rendering and CSG cutting.
 *
 * Returned polygon is in wall-face coordinates (origin at sill-center, X along
 * the wall, Y up) in millimetres. Polygon is closed in CCW order so it can be
 * used directly with three.js ExtrudeGeometry.
 */

import type { Element, WindowOutlineKind, XY } from '@bim-ai/core';
import { resolveWindowCutDimensions } from '../../viewport/hostedOpeningDimensions';
import { roofHeightAtPoint } from '../../viewport/roofHeightSampler';

type WindowElem = Extract<Element, { kind: 'window' }>;
type WallElem = Extract<Element, { kind: 'wall' }>;
type RoofElem = Extract<Element, { kind: 'roof' }>;

export function resolveWindowOutlineKind(win: WindowElem): WindowOutlineKind {
  return win.outlineKind ?? 'rectangle';
}

/**
 * Produce the polygon defining the window outline. Origin is sill-center (0,0
 * is the bottom centre of the bounding rect; the polygon may extend above by
 * up to heightMm and below by 0).
 *
 * For `gable_trapezoid` the top edge follows the slope of `attachedRoof` at the
 * window's host-wall position; this requires elementsById to look up roof
 * sampling state.
 *
 * Returns null when the window can't produce a meaningful polygon (e.g.
 * gable_trapezoid without a valid attachedRoofId — caller should fall back to
 * rectangle).
 */
export function resolveWindowOutline(
  win: WindowElem,
  hostWall: WallElem,
  elementsById: Record<string, Element>,
): XY[] | null {
  const kind = resolveWindowOutlineKind(win);
  const dims = resolveWindowCutDimensions(win, elementsById);
  const w = Math.max(1, dims.widthMm);
  const h = Math.max(1, dims.heightMm);
  const hw = w / 2;

  switch (kind) {
    case 'rectangle': {
      return [
        { xMm: -hw, yMm: 0 },
        { xMm: hw, yMm: 0 },
        { xMm: hw, yMm: h },
        { xMm: -hw, yMm: h },
      ];
    }

    case 'arched_top': {
      const r = hw;
      const segs = 32;
      const out: XY[] = [];
      out.push({ xMm: -hw, yMm: 0 });
      out.push({ xMm: hw, yMm: 0 });
      // Right-side wall up to the spring line of the arch.
      const wallTop = h - r;
      out.push({ xMm: hw, yMm: wallTop });
      // Half-circle from right (theta=0) sweeping CCW to left (theta=pi).
      for (let i = 1; i < segs; i++) {
        const theta = (Math.PI * i) / segs;
        out.push({
          xMm: hw * Math.cos(theta),
          yMm: wallTop + r * Math.sin(theta),
        });
      }
      out.push({ xMm: -hw, yMm: wallTop });
      return out;
    }

    case 'gable_trapezoid': {
      if (!win.attachedRoofId) return null;
      const roof = elementsById[win.attachedRoofId];
      if (!roof || roof.kind !== 'roof') return null;
      // Compute the world-space (xMm, yMm) of the wall-face point under the
      // window's left and right edges. Take the wall axis vector, displace from
      // the wall midpoint along it by ±hw, and sample roofHeightAtPoint.
      const dxMm = hostWall.end.xMm - hostWall.start.xMm;
      const dyMm = hostWall.end.yMm - hostWall.start.yMm;
      const lenMm = Math.max(1, Math.hypot(dxMm, dyMm));
      const ux = dxMm / lenMm;
      const uz = dyMm / lenMm;
      const winCx = hostWall.start.xMm + ux * win.alongT * lenMm;
      const winCz = hostWall.start.yMm + uz * win.alongT * lenMm;
      const leftXmm = winCx - ux * hw;
      const leftZmm = winCz - uz * hw;
      const rightXmm = winCx + ux * hw;
      const rightZmm = winCz + uz * hw;
      // roofHeightAtPoint returns world-Y in metres.
      const leftRoofY_m = roofHeightAtPoint(roof as RoofElem, elementsById, leftXmm, leftZmm);
      const rightRoofY_m = roofHeightAtPoint(roof as RoofElem, elementsById, rightXmm, rightZmm);
      // Window sill is at sillHeightMm above wall base; the window's base is
      // at y=0 in outline-space (sill-centre). The roof intersection in
      // outline-space-Y is roof world-Y - (level elev + sill height in m).
      const lvl = elementsById[hostWall.levelId];
      const lvlElevMm = lvl?.kind === 'level' ? (lvl.elevationMm ?? 0) : 0;
      const sillWorldYmm = lvlElevMm + dims.sillHeightMm;
      let leftTopMm = leftRoofY_m * 1000 - sillWorldYmm;
      let rightTopMm = rightRoofY_m * 1000 - sillWorldYmm;
      // Clamp the top edges to a sensible non-zero range so a window placed
      // entirely below the roof eave still has positive height.
      const minTop = 100;
      const maxTop = h * 4;
      leftTopMm = Math.max(minTop, Math.min(maxTop, leftTopMm));
      rightTopMm = Math.max(minTop, Math.min(maxTop, rightTopMm));
      return [
        { xMm: -hw, yMm: 0 },
        { xMm: hw, yMm: 0 },
        { xMm: hw, yMm: rightTopMm },
        { xMm: -hw, yMm: leftTopMm },
      ];
    }

    case 'circle': {
      const r = Math.min(w, h) / 2;
      const segs = 32;
      const cy = r; // centre at (0, r) so the bottom of the circle sits on sill.
      const out: XY[] = [];
      for (let i = 0; i < segs; i++) {
        const theta = (2 * Math.PI * i) / segs - Math.PI / 2; // start at bottom
        out.push({ xMm: r * Math.cos(theta), yMm: cy + r * Math.sin(theta) });
      }
      return out;
    }

    case 'octagon': {
      const segs = 8;
      const cy = h / 2;
      const rx = hw;
      const ry = h / 2;
      const out: XY[] = [];
      for (let i = 0; i < segs; i++) {
        // Start at +x axis (theta=0), step 45° CCW.
        const theta = (2 * Math.PI * i) / segs;
        out.push({ xMm: rx * Math.cos(theta), yMm: cy + ry * Math.sin(theta) });
      }
      return out;
    }

    case 'custom': {
      if (!Array.isArray(win.outlineMm) || win.outlineMm.length < 3) return null;
      return win.outlineMm.map((p) => ({ xMm: p.xMm, yMm: p.yMm }));
    }
  }
}

/** Polygon AABB in outline-space (mm). */
export function outlineBoundsMm(poly: XY[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    if (p.xMm < minX) minX = p.xMm;
    if (p.xMm > maxX) maxX = p.xMm;
    if (p.yMm < minY) minY = p.yMm;
    if (p.yMm > maxY) maxY = p.yMm;
  }
  return { minX, maxX, minY, maxY };
}
