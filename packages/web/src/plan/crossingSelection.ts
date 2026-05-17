/**
 * §1.8.1 — Crossing window selection.
 *
 * Exposes a pure helper that decides which elements fall inside a
 * selection rectangle, supporting both window (fully contained) and
 * crossing (intersects) modes.
 *
 * A left-to-right drag is "window" mode — only elements fully enclosed
 * by the rectangle are included. A right-to-left drag is "crossing"
 * mode — elements whose bounding box intersects the rectangle at all
 * (even partially) are included.
 */

import type { Element } from '@bim-ai/core';

/** Axis-aligned bounding box in plan mm coordinates. */
type Bbox = { xMin: number; xMax: number; yMin: number; yMax: number };

function bboxForElement(el: Element): Bbox | null {
  if (el.kind === 'wall' || el.kind === 'room_separation') {
    return {
      xMin: Math.min(el.start.xMm, el.end.xMm),
      xMax: Math.max(el.start.xMm, el.end.xMm),
      yMin: Math.min(el.start.yMm, el.end.yMm),
      yMax: Math.max(el.start.yMm, el.end.yMm),
    };
  }
  if (el.kind === 'column') {
    const hw = el.bMm / 2;
    const hd = el.hMm / 2;
    return {
      xMin: el.positionMm.xMm - hw,
      xMax: el.positionMm.xMm + hw,
      yMin: el.positionMm.yMm - hd,
      yMax: el.positionMm.yMm + hd,
    };
  }
  if (el.kind === 'room') {
    const pts = el.outlineMm;
    if (!pts || pts.length === 0) return null;
    return {
      xMin: Math.min(...pts.map((p) => p.xMm)),
      xMax: Math.max(...pts.map((p) => p.xMm)),
      yMin: Math.min(...pts.map((p) => p.yMm)),
      yMax: Math.max(...pts.map((p) => p.yMm)),
    };
  }
  if (el.kind === 'floor' || el.kind === 'area') {
    const pts = el.boundaryMm;
    if (!pts || pts.length === 0) return null;
    return {
      xMin: Math.min(...pts.map((p) => p.xMm)),
      xMax: Math.max(...pts.map((p) => p.xMm)),
      yMin: Math.min(...pts.map((p) => p.yMm)),
      yMax: Math.max(...pts.map((p) => p.yMm)),
    };
  }
  if (el.kind === 'placed_asset' || el.kind === 'family_instance') {
    const pos = el.positionMm;
    return { xMin: pos.xMm, xMax: pos.xMm, yMin: pos.yMm, yMax: pos.yMm };
  }
  return null;
}

/**
 * Return the ids of all elements that fall within (or intersect) the
 * given rectangle.
 *
 * @param elements  Elements to test.
 * @param rect      Selection rectangle in plan mm, given as two corners
 *                  (x1,y1) and (x2,y2); order does not matter.
 * @param crossing  When false (window mode) only fully contained
 *                  elements are returned. When true (crossing mode)
 *                  elements whose bounding box intersects the rectangle
 *                  are included too.
 */
export function elementsInCrossingBox(
  elements: Element[],
  rect: { x1: number; y1: number; x2: number; y2: number },
  crossing: boolean,
): string[] {
  const xMin = Math.min(rect.x1, rect.x2);
  const xMax = Math.max(rect.x1, rect.x2);
  const yMin = Math.min(rect.y1, rect.y2);
  const yMax = Math.max(rect.y1, rect.y2);

  const result: string[] = [];
  for (const el of elements) {
    const bbox = bboxForElement(el);
    if (!bbox) continue;
    if (crossing) {
      // Intersection: bounding boxes overlap in both axes.
      if (bbox.xMax >= xMin && bbox.xMin <= xMax && bbox.yMax >= yMin && bbox.yMin <= yMax) {
        result.push(el.id);
      }
    } else {
      // Window: element bbox fully inside the selection rect.
      if (bbox.xMin >= xMin && bbox.xMax <= xMax && bbox.yMin >= yMin && bbox.yMax <= yMax) {
        result.push(el.id);
      }
    }
  }
  return result;
}
