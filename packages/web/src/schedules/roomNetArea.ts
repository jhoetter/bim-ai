import type { Element } from '@bim-ai/core';

type XY = { xMm: number; yMm: number };

function shoelaceAreaMm2(pts: XY[]): number {
  const n = pts.length;
  if (n < 3) return 0;
  let a = 0;
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % n]!;
    a += p.xMm * q.yMm - q.xMm * p.yMm;
  }
  return Math.abs(a / 2);
}

function pointInPolygon(pt: XY, poly: XY[]): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i]!.xMm;
    const yi = poly[i]!.yMm;
    const xj = poly[j]!.xMm;
    const yj = poly[j]!.yMm;
    const intersect =
      yi > pt.yMm !== yj > pt.yMm && pt.xMm < ((xj - xi) * (pt.yMm - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function computeRoomNetAreaMm2(
  room: Extract<Element, { kind: 'room' }>,
  elementsById: Record<string, Element>,
): number {
  const gross = shoelaceAreaMm2(room.outlineMm);
  let deduction = 0;

  for (const el of Object.values(elementsById)) {
    if (el.kind === 'column') {
      if (pointInPolygon(el.positionMm, room.outlineMm)) {
        deduction += el.bMm * el.hMm;
      }
    } else if (el.kind === 'wall') {
      const mid: XY = {
        xMm: (el.start.xMm + el.end.xMm) / 2,
        yMm: (el.start.yMm + el.end.yMm) / 2,
      };
      if (pointInPolygon(mid, room.outlineMm)) {
        const dx = el.end.xMm - el.start.xMm;
        const dy = el.end.yMm - el.start.yMm;
        deduction += el.thicknessMm * Math.sqrt(dx * dx + dy * dy);
      }
    }
  }

  return Math.max(0, gross - deduction);
}
