import type { Element } from '@bim-ai/core';

type ElevationViewEl = Extract<Element, { kind: 'elevation_view' }>;

export interface ElevationLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lineWeight?: number;
  dash?: boolean;
}

/**
 * Projects wall/floor outlines into 2D elevation space.
 *
 * direction: 'north' — camera is placed at +Y looking south (–Y).
 *   elevation x-axis = model x, y-axis = vertical (0 = project base).
 *
 * Axis mapping per direction (horizontal → x, vertical → elevation):
 *   north  (looking south):  h = +xMm,  depth = +yMm
 *   south  (looking north):  h = -xMm,  depth = -yMm
 *   east   (looking west):   h = +yMm,  depth = +xMm
 *   west   (looking east):   h = -yMm,  depth = -xMm
 *
 * Returns a set of 2D SVG lines where:
 *   x-axis = horizontal (left–right along the observed wall face)
 *   y-axis = vertical elevation (mm from project base)
 *
 * §6.1.4
 */
export function buildElevationLines(
  view: ElevationViewEl,
  elementsById: Record<string, Element | undefined>,
): ElevationLine[] {
  const lines: ElevationLine[] = [];
  const dir = view.direction ?? 'north';

  /** Project a plan-space (xMm, yMm) point to elevation-space horizontal coordinate. */
  const projectH = (xMm: number, yMm: number): number => {
    switch (dir) {
      case 'north':
        return xMm;
      case 'south':
        return -xMm || 0;
      case 'east':
        return yMm;
      case 'west':
        return -yMm || 0;
      case 'custom': {
        const angleDeg = view.customAngleDeg ?? 0;
        const rad = (angleDeg * Math.PI) / 180;
        return xMm * Math.cos(rad) + yMm * Math.sin(rad);
      }
    }
  };

  /** Look up a level's elevation in mm (0 if not found). */
  const levelElevMm = (levelId: string): number => {
    const lvl = elementsById[levelId];
    if (lvl?.kind === 'level') return lvl.elevationMm;
    return 0;
  };

  for (const el of Object.values(elementsById)) {
    if (!el) continue;

    if (el.kind === 'wall') {
      const baseElev = levelElevMm(el.levelId);
      const topElev = baseElev + el.heightMm;
      const hStart = projectH(el.start.xMm, el.start.yMm);
      const hEnd = projectH(el.end.xMm, el.end.yMm);
      // Bottom horizontal line
      lines.push({ x1: hStart, y1: baseElev, x2: hEnd, y2: baseElev });
      // Top horizontal line
      lines.push({ x1: hStart, y1: topElev, x2: hEnd, y2: topElev });
      // Left vertical line
      lines.push({ x1: hStart, y1: baseElev, x2: hStart, y2: topElev });
      // Right vertical line
      lines.push({ x1: hEnd, y1: baseElev, x2: hEnd, y2: topElev });
    }

    if (el.kind === 'floor') {
      const baseElev = levelElevMm(el.levelId);
      const pts = el.boundaryMm;
      if (pts && pts.length >= 2) {
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i]!;
          const b = pts[(i + 1) % pts.length]!;
          const ha = projectH(a.xMm, a.yMm);
          const hb = projectH(b.xMm, b.yMm);
          lines.push({ x1: ha, y1: baseElev, x2: hb, y2: baseElev });
        }
      }
    }
  }

  return lines;
}
