import type { Element } from '@bim-ai/core';

type RoofElem = Extract<Element, { kind: 'roof' }>;

function elevationMForLevel(levelId: string, elementsById: Record<string, Element>): number {
  const lv = elementsById[levelId];
  return lv?.kind === 'level' ? ((lv as Extract<Element, { kind: 'level' }>).elevationMm ?? 0) / 1000 : 0;
}

function xzBoundsMm(poly: Array<{ xMm: number; yMm: number }>) {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const p of poly) {
    if (p.xMm < minX) minX = p.xMm;
    if (p.xMm > maxX) maxX = p.xMm;
    if (p.yMm < minZ) minZ = p.yMm;
    if (p.yMm > maxZ) maxZ = p.yMm;
  }
  return { minX, maxX, minZ, maxZ, spanX: maxX - minX, spanZ: maxZ - minZ };
}

export function roofHeightAtPoint(
  roof: RoofElem,
  elementsById: Record<string, Element>,
  xMm: number,
  zMm: number,
): number {
  const refElev = elevationMForLevel(roof.referenceLevelId, elementsById);
  const wallsAtRefLevel = Object.values(elementsById).filter(
    (e): e is Extract<Element, { kind: 'wall' }> =>
      e.kind === 'wall' && (e as Extract<Element, { kind: 'wall' }>).levelId === roof.referenceLevelId,
  );
  const wallTopM =
    wallsAtRefLevel.length > 0
      ? Math.max(...wallsAtRefLevel.map((w) => (w.heightMm ?? 0) / 1000))
      : 0;
  const eaveY = refElev + wallTopM;

  if (roof.roofGeometryMode === 'mass_box') {
    return eaveY;
  }

  const rawSlopeDeg = roof.slopeDeg ?? 25;
  const clampedDeg = Math.min(70, Math.max(5, Number(rawSlopeDeg)));
  const slopeRad = (clampedDeg * Math.PI) / 180;

  const b = xzBoundsMm(roof.footprintMm ?? []);
  const ox0 = b.minX / 1000;
  const ox1 = b.maxX / 1000;
  const oz0 = b.minZ / 1000;
  const oz1 = b.maxZ / 1000;

  const spanXm = b.spanX / 1000;
  const spanZm = b.spanZ / 1000;

  let ridgeAlongX: boolean;
  if (roof.ridgeAxis === 'x') ridgeAlongX = true;
  else if (roof.ridgeAxis === 'z') ridgeAlongX = false;
  else ridgeAlongX = spanXm >= spanZm;

  const x = xMm / 1000;
  const z = zMm / 1000;
  const tan = Math.tan(slopeRad);

  if (roof.roofGeometryMode === 'hip') {
    if (ridgeAlongX) {
      const halfSpanZ = (oz1 - oz0) / 2;
      const dz = halfSpanZ - Math.abs(z - (oz0 + oz1) / 2);
      const rx0 = ox0 + halfSpanZ;
      const rx1 = ox1 - halfSpanZ;
      let dx: number;
      if (rx0 >= rx1) {
        dx = (ox1 - ox0) / 2 - Math.abs(x - (ox0 + ox1) / 2);
      } else {
        dx = x < rx0 ? x - ox0 : x > rx1 ? ox1 - x : halfSpanZ;
      }
      return eaveY + Math.max(0, Math.min(dz, dx)) * tan;
    } else {
      const halfSpanX = (ox1 - ox0) / 2;
      const dx = halfSpanX - Math.abs(x - (ox0 + ox1) / 2);
      const rz0 = oz0 + halfSpanX;
      const rz1 = oz1 - halfSpanX;
      let dz: number;
      if (rz0 >= rz1) {
        dz = (oz1 - oz0) / 2 - Math.abs(z - (oz0 + oz1) / 2);
      } else {
        dz = z < rz0 ? z - oz0 : z > rz1 ? oz1 - z : halfSpanX;
      }
      return eaveY + Math.max(0, Math.min(dx, dz)) * tan;
    }
  }

  // gable (default)
  if (ridgeAlongX) {
    const halfSpan = (oz1 - oz0) / 2;
    return eaveY + Math.max(0, halfSpan - Math.abs(z - (oz0 + oz1) / 2)) * tan;
  } else {
    const halfSpan = (ox1 - ox0) / 2;
    return eaveY + Math.max(0, halfSpan - Math.abs(x - (ox0 + ox1) / 2)) * tan;
  }
}
