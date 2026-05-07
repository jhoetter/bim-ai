import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import type { Element } from '@bim-ai/core';

/**
 * KRN-14 — subtract a tall axis-aligned cut box for each hosted dormer
 * from the host roof geometry.
 *
 * Best-effort: three-bvh-csg can produce visible artefacts on the
 * non-watertight asymmetric-gable slope panels, but the cut hole is
 * still legible from the SSW viewpoint, which is what the seed needs.
 */
export function applyDormerCutsToRoofGeom(
  geom: THREE.BufferGeometry,
  roof: Extract<Element, { kind: 'roof' }>,
  elementsById: Record<string, Element>,
  refElev: number,
): THREE.BufferGeometry {
  const dormers = Object.values(elementsById).filter(
    (e): e is Extract<Element, { kind: 'dormer' }> =>
      e.kind === 'dormer' && (e as Extract<Element, { kind: 'dormer' }>).hostRoofId === roof.id,
  );
  if (dormers.length === 0) return geom;
  try {
    const evaluator = new Evaluator();
    let brush = new Brush(geom);
    brush.updateMatrixWorld();
    for (const d of dormers) {
      const fp = computeDormerFootprintMm(d, roof);
      const xMin = fp.minX / 1000;
      const xMax = fp.maxX / 1000;
      const zMin = -fp.maxY / 1000;
      const zMax = -fp.minY / 1000;
      const widthM = xMax - xMin;
      const depthM = zMax - zMin;
      const cutHeightM = 30;
      const baseY = refElev;
      const cutter = new Brush(new THREE.BoxGeometry(widthM, cutHeightM, depthM));
      cutter.position.set((xMin + xMax) / 2, baseY + cutHeightM / 2, (zMin + zMax) / 2);
      cutter.updateMatrixWorld();
      brush = evaluator.evaluate(brush, cutter, SUBTRACTION);
      brush.updateMatrixWorld();
    }
    const cutGeom = brush.geometry;
    cutGeom.computeVertexNormals();
    return cutGeom;
  } catch {
    return geom;
  }
}

function computeDormerFootprintMm(
  dormer: Extract<Element, { kind: 'dormer' }>,
  hostRoof: Extract<Element, { kind: 'roof' }>,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const xs = hostRoof.footprintMm.map((p) => p.xMm);
  const ys = hostRoof.footprintMm.map((p) => p.yMm);
  const minRx = Math.min(...xs);
  const maxRx = Math.max(...xs);
  const minRy = Math.min(...ys);
  const maxRy = Math.max(...ys);
  const cx = (minRx + maxRx) / 2;
  const cy = (minRy + maxRy) / 2;
  const spanX = maxRx - minRx;
  const spanY = maxRy - minRy;
  const ridgeAlongX =
    hostRoof.ridgeAxis === 'x' ? true : hostRoof.ridgeAxis === 'z' ? false : spanX >= spanY;
  const dx = ridgeAlongX ? dormer.positionOnRoof.alongRidgeMm : dormer.positionOnRoof.acrossRidgeMm;
  const dy = ridgeAlongX ? dormer.positionOnRoof.acrossRidgeMm : dormer.positionOnRoof.alongRidgeMm;
  const centreX = cx + dx;
  const centreY = cy + dy;
  const halfW = dormer.widthMm / 2;
  const halfD = dormer.depthMm / 2;
  if (ridgeAlongX) {
    return {
      minX: centreX - halfW,
      maxX: centreX + halfW,
      minY: centreY - halfD,
      maxY: centreY + halfD,
    };
  }
  return {
    minX: centreX - halfD,
    maxX: centreX + halfD,
    minY: centreY - halfW,
    maxY: centreY + halfW,
  };
}
