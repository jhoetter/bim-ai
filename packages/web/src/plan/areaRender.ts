/**
 * KRN-08 — pure rendering helpers for `area` elements.
 *
 * An `area` is a level-anchored polygon used for legal/permit area
 * calculations. The plan canvas draws the boundary as a thick dashed red
 * outline (distinct from room separation lines), with a tag at the centroid
 * showing `name · <area> m²`.
 */
import type { Element, XY } from '@bim-ai/core';

export type AreaPrimitive = {
  kind: 'area';
  id: string;
  name: string;
  boundaryMm: XY[];
  centroidMm: XY;
  ruleSet: 'gross' | 'net' | 'no_rules';
  computedAreaSqMm: number;
  /** Pre-formatted tag label, e.g. "Porch · 20.00 m²". */
  tagLabel: string;
};

export function polygonCentroidMm(boundary: XY[]): XY {
  if (boundary.length === 0) return { xMm: 0, yMm: 0 };
  // Polygon centroid via the standard signed-area formula. Falls back to the
  // arithmetic mean for degenerate (collinear) polygons.
  let sx = 0;
  let sy = 0;
  let a2 = 0;
  for (let i = 0; i < boundary.length; i++) {
    const p1 = boundary[i]!;
    const p2 = boundary[(i + 1) % boundary.length]!;
    const cross = p1.xMm * p2.yMm - p2.xMm * p1.yMm;
    sx += (p1.xMm + p2.xMm) * cross;
    sy += (p1.yMm + p2.yMm) * cross;
    a2 += cross;
  }
  if (Math.abs(a2) < 1e-9) {
    let mx = 0;
    let my = 0;
    for (const p of boundary) {
      mx += p.xMm;
      my += p.yMm;
    }
    return { xMm: mx / boundary.length, yMm: my / boundary.length };
  }
  const a = a2 / 2.0;
  return { xMm: sx / (6 * a), yMm: sy / (6 * a) };
}

function polygonAreaAbsSqMm(boundary: XY[]): number {
  if (boundary.length < 3) return 0;
  let acc = 0;
  for (let i = 0; i < boundary.length; i++) {
    const p1 = boundary[i]!;
    const p2 = boundary[(i + 1) % boundary.length]!;
    acc += p1.xMm * p2.yMm - p2.xMm * p1.yMm;
  }
  return Math.abs(acc / 2);
}

/**
 * Extract area-element rendering primitives for a given level. Pass the
 * `levelId` of the active plan view; areas anchored to other levels are
 * filtered out so each plan view shows only its own areas.
 */
export function extractAreaPrimitives(
  elementsById: Record<string, Element>,
  levelId: string | undefined,
): AreaPrimitive[] {
  if (!levelId) return [];
  const out: AreaPrimitive[] = [];
  for (const el of Object.values(elementsById)) {
    if (el.kind === 'area' && el.levelId === levelId) {
      const computed = el.computedAreaSqMm ?? polygonAreaAbsSqMm(el.boundaryMm);
      const sqM = computed / 1_000_000;
      const tagLabel = `${el.name} · ${sqM.toFixed(2)} m²`;
      out.push({
        kind: 'area',
        id: el.id,
        name: el.name,
        boundaryMm: el.boundaryMm,
        centroidMm: polygonCentroidMm(el.boundaryMm),
        ruleSet: el.ruleSet,
        computedAreaSqMm: computed,
        tagLabel,
      });
    }
  }
  return out;
}
