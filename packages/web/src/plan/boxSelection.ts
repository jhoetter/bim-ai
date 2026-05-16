import type { Element } from '@bim-ai/core';

type Bbox = { xMin: number; xMax: number; yMin: number; yMax: number };

function bboxForElement(el: Element): Bbox | null {
  if (el.kind === 'wall') {
    return {
      xMin: Math.min(el.start.xMm, el.end.xMm),
      xMax: Math.max(el.start.xMm, el.end.xMm),
      yMin: Math.min(el.start.yMm, el.end.yMm),
      yMax: Math.max(el.start.yMm, el.end.yMm),
    };
  }
  if (el.kind === 'room_separation') {
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

/** Returns whether element el is inside or crossing the selection rectangle. */
export function elementInSelectionBoxMm(
  el: Element,
  boxMinMm: { xMm: number; yMm: number },
  boxMaxMm: { xMm: number; yMm: number },
  mode: 'window' | 'crossing',
): boolean {
  const bbox = bboxForElement(el);
  if (!bbox) return false;
  if (mode === 'window') {
    return (
      bbox.xMin >= boxMinMm.xMm &&
      bbox.xMax <= boxMaxMm.xMm &&
      bbox.yMin >= boxMinMm.yMm &&
      bbox.yMax <= boxMaxMm.yMm
    );
  }
  // crossing: bbox intersects the selection rect
  return (
    bbox.xMax >= boxMinMm.xMm &&
    bbox.xMin <= boxMaxMm.xMm &&
    bbox.yMax >= boxMinMm.yMm &&
    bbox.yMin <= boxMaxMm.yMm
  );
}
