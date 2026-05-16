import type { Element } from '@bim-ai/core';

/** Shoelace formula on room outlineMm (closed polygon). Returns m². */
export function roomAreaM2(outlineMm: ReadonlyArray<{ xMm: number; yMm: number }>): number {
  if (outlineMm.length < 3) return 0;
  let area = 0;
  const n = outlineMm.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    area += (outlineMm[j]!.xMm + outlineMm[i]!.xMm) * (outlineMm[j]!.yMm - outlineMm[i]!.yMm);
  }
  return Math.abs(area) / 2 / 1_000_000;
}

/** Net room area: gross minus sum of column footprint areas inside the room. */
export function roomNetAreaM2(
  outlineMm: ReadonlyArray<{ xMm: number; yMm: number }>,
  columns: ReadonlyArray<Extract<Element, { kind: 'column' }>>,
): number {
  const gross = roomAreaM2(outlineMm);
  if (gross === 0) return 0;
  let columnAreaMm2 = 0;
  for (const col of columns) {
    if (pointInPolygon(col.positionMm, outlineMm)) {
      columnAreaMm2 += (col.bMm ?? 300) * (col.hMm ?? 300);
    }
  }
  return gross - columnAreaMm2 / 1_000_000;
}

function pointInPolygon(
  pt: { xMm: number; yMm: number },
  polygon: ReadonlyArray<{ xMm: number; yMm: number }>,
): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i]!.xMm,
      yi = polygon[i]!.yMm;
    const xj = polygon[j]!.xMm,
      yj = polygon[j]!.yMm;
    const intersect =
      yi > pt.yMm !== yj > pt.yMm && pt.xMm < ((xj - xi) * (pt.yMm - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
