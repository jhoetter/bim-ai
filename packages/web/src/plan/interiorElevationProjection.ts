import type { Element } from '@bim-ai/core';

export type ElevationLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeWidth: number;
  kind: 'wall' | 'floor' | 'opening' | 'silhouette';
};

/**
 * Projects elements visible from `marker` in one view direction into 2D screen space.
 * direction: 'N' | 'S' | 'E' | 'W' — the camera looks in this direction.
 * viewWidthMm: horizontal extent of the view (e.g. 6000mm)
 * viewHeightMm: vertical extent (e.g. 3000mm)
 *
 * Axis mapping per direction (horizontal = left–right in the elevation, vertical = Z/elevation):
 *   N (camera looks north, -Y):  h = +xMm,  depth = -yMm
 *   S (camera looks south, +Y):  h = -xMm,  depth = +yMm
 *   E (camera looks east,  +X):  h = +yMm,  depth = +xMm
 *   W (camera looks west,  -X):  h = -yMm,  depth = -xMm
 *
 * §6.1.5
 */
export function buildInteriorElevationLines(
  marker: Extract<Element, { kind: 'interior_elevation_marker' }>,
  direction: 'N' | 'S' | 'E' | 'W',
  elementsById: Record<string, Element | undefined>,
  viewWidthMm?: number,
  viewHeightMm?: number,
): ElevationLine[] {
  const lines: ElevationLine[] = [];

  const radiusMm = marker.radiusMm ?? 3000;
  const halfW = (viewWidthMm ?? radiusMm * 2) / 2;
  const vHeightMm = viewHeightMm ?? 3000;

  const cx = marker.positionMm.xMm;
  const cy = marker.positionMm.yMm;

  /** Project plan-space (xMm, yMm) to elevation horizontal coordinate (relative to marker). */
  function projectH(xMm: number, yMm: number): number {
    switch (direction) {
      case 'N':
        return xMm - cx;
      case 'S':
        return -(xMm - cx);
      case 'E':
        return yMm - cy;
      case 'W':
        return -(yMm - cy);
    }
  }

  /** Project plan-space (xMm, yMm) to depth (positive = further from camera). */
  function projectDepth(xMm: number, yMm: number): number {
    switch (direction) {
      case 'N':
        return -(yMm - cy);
      case 'S':
        return yMm - cy;
      case 'E':
        return xMm - cx;
      case 'W':
        return -(xMm - cx);
    }
  }

  /** Look up a level's elevation in mm (0 if not found). */
  function levelElevMm(levelId: string): number {
    const lvl = elementsById[levelId];
    if (lvl?.kind === 'level') return lvl.elevationMm;
    return 0;
  }

  for (const el of Object.values(elementsById)) {
    if (!el) continue;

    if (el.kind === 'wall') {
      const hStart = projectH(el.start.xMm, el.start.yMm);
      const hEnd = projectH(el.end.xMm, el.end.yMm);
      const dStart = projectDepth(el.start.xMm, el.start.yMm);
      const dEnd = projectDepth(el.end.xMm, el.end.yMm);

      // Only include walls within the frustum (at least partially)
      const hMin = Math.min(hStart, hEnd);
      const hMax = Math.max(hStart, hEnd);
      const dMin = Math.min(dStart, dEnd);
      const dMax = Math.max(dStart, dEnd);

      // Frustum check: horizontal within ±halfW, depth within [0, radiusMm]
      if (hMax < -halfW || hMin > halfW) continue;
      if (dMax < 0 || dMin > radiusMm) continue;

      const baseElev = levelElevMm(el.levelId);
      const topElev = baseElev + el.heightMm;

      // Clamp horizontal to view width
      const hStartClamped = Math.max(-halfW, Math.min(halfW, hStart));
      const hEndClamped = Math.max(-halfW, Math.min(halfW, hEnd));

      // Walls in or near cut plane get heavier weight
      const isNearCutPlane = dMin <= 50; // within 50mm of the cut plane
      const sw = isNearCutPlane ? 2 : 1;

      // Clamp to view height
      const yBot = Math.max(0, baseElev);
      const yTop = Math.min(vHeightMm, topElev);
      if (yTop <= yBot) continue;

      // Bottom horizontal line
      lines.push({
        x1: hStartClamped,
        y1: yBot,
        x2: hEndClamped,
        y2: yBot,
        strokeWidth: sw,
        kind: 'wall',
      });
      // Top horizontal line
      lines.push({
        x1: hStartClamped,
        y1: yTop,
        x2: hEndClamped,
        y2: yTop,
        strokeWidth: sw,
        kind: 'wall',
      });
      // Left vertical
      lines.push({
        x1: hStartClamped,
        y1: yBot,
        x2: hStartClamped,
        y2: yTop,
        strokeWidth: sw,
        kind: 'wall',
      });
      // Right vertical
      lines.push({
        x1: hEndClamped,
        y1: yBot,
        x2: hEndClamped,
        y2: yTop,
        strokeWidth: sw,
        kind: 'wall',
      });
    }

    if (el.kind === 'floor') {
      const baseElev = levelElevMm(el.levelId);
      const pts = el.boundaryMm;
      if (!pts || pts.length < 2) continue;

      // Check if any point is within the frustum
      let anyInFrustum = false;
      for (const pt of pts) {
        const h = projectH(pt.xMm, pt.yMm);
        const d = projectDepth(pt.xMm, pt.yMm);
        if (h >= -halfW && h <= halfW && d >= 0 && d <= radiusMm) {
          anyInFrustum = true;
          break;
        }
      }
      if (!anyInFrustum) continue;
      if (baseElev < 0 || baseElev > vHeightMm) continue;

      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]!;
        const b = pts[(i + 1) % pts.length]!;
        const ha = projectH(a.xMm, a.yMm);
        const hb = projectH(b.xMm, b.yMm);
        lines.push({
          x1: ha,
          y1: baseElev,
          x2: hb,
          y2: baseElev,
          strokeWidth: 1.5,
          kind: 'floor',
        });
      }
    }
  }

  return lines;
}
