import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import type { Element } from '@bim-ai/core';
import { computeDormerCutVerticalExtent } from './dormerCutGeometry';
import { groupDormersByOverlap } from './dormerGrouping';

export { computeDormerCutVerticalExtent, DORMER_CUT_MARGIN_M } from './dormerCutGeometry';

/**
 * KRN-14 / IFC-03 — subtract tall axis-aligned cut boxes for roof-hosted
 * void elements from the host roof geometry.
 *
 * The roof geometry is now closed (asymmetric-gable bottom face landed
 * alongside this fix), so three-bvh-csg's SUBTRACTION produces a clean
 * hole instead of silently no-op'ing. We also validate that the cut
 * footprint actually intersects the host roof bbox before attempting
 * CSG, and surface failures via console.warn rather than swallowing.
 *
 * Issue #77 — the cutter's vertical extent is bounded BELOW by `eaveY`
 * (top of wall) minus a small margin, not by `refElev` (ground floor).
 * The previous behaviour started the cutter at refElev with a 30m
 * height; that slab carved through the wall and floor beneath the roof,
 * which let the EG storey windows behind the dormer leak through the
 * roof void. Bounding the cutter to the roof volume keeps the hole
 * strictly above the wall plate so the storey below stays opaque.
 */
export function applyDormerCutsToRoofGeom(
  geom: THREE.BufferGeometry,
  roof: Extract<Element, { kind: 'roof' }>,
  elementsById: Record<string, Element>,
  refElev: number,
  eaveY?: number,
): THREE.BufferGeometry {
  const dormers = Object.values(elementsById).filter(
    (e): e is Extract<Element, { kind: 'dormer' }> =>
      e.kind === 'dormer' && (e as Extract<Element, { kind: 'dormer' }>).hostRoofId === roof.id,
  );
  const roofOpenings = Object.values(elementsById).filter(
    (e): e is Extract<Element, { kind: 'roof_opening' }> =>
      e.kind === 'roof_opening' &&
      (e as Extract<Element, { kind: 'roof_opening' }>).hostRoofId === roof.id,
  );
  if (dormers.length === 0 && roofOpenings.length === 0) return geom;
  const roofBbox = computeRoofBboxMm(roof);
  try {
    // three-bvh-csg requires both inputs to share the same attribute
    // set, indexed, with normals. Strip everything except position then
    // re-add normal + index via the helpers — keeps both sides aligned.
    function normaliseForCsg(input: THREE.BufferGeometry): THREE.BufferGeometry {
      const g = new THREE.BufferGeometry();
      const pos = input.getAttribute('position');
      g.setAttribute('position', pos);
      if (input.index) g.setIndex(input.index);
      const indexed = g.index ? g : mergeVertices(g);
      indexed.computeVertexNormals();
      return indexed;
    }
    const csgInput = normaliseForCsg(geom);
    const evaluator = new Evaluator();
    // The roof builders emit position + normal but no uv; restrict the
    // evaluator's relevant-attribute set to match. (The lib defaults to
    // ['position', 'uv', 'normal'] and crashes on missing uv with
    // "Cannot read properties of undefined (reading 'array')".)
    evaluator.attributes = ['position', 'normal'];
    let brush = new Brush(csgInput);
    brush.updateMatrixWorld();
    let cutsApplied = 0;
    // MF-22b: cluster overlapping/near dormers and emit ONE cut per cluster.
    // Without this, two adjacent shed dormers produced two ragged-edge cuts
    // that read as a single untidy band instead of two clean openings — or,
    // with this merge, one combined opening that the surviving primary
    // dormer body fills.
    const dormerGroups = groupDormersByOverlap(dormers, roof);
    const cuts: Array<{
      id: string;
      kind: 'dormer' | 'roof_opening';
      footprint: { minX: number; maxX: number; minY: number; maxY: number };
    }> = [
      ...dormerGroups.map((g) => ({
        id: g.memberIds.length === 1 ? g.primaryId : `merged(${g.memberIds.join('+')})`,
        kind: 'dormer' as const,
        footprint: g.mergedFootprint,
      })),
      ...roofOpenings.map((o) => ({
        id: o.id,
        kind: 'roof_opening' as const,
        footprint: computeRoofOpeningFootprintMm(o),
      })),
    ];
    for (const cut of cuts) {
      const fp = cut.footprint;
      if (!bboxesOverlap(fp, roofBbox)) {
        console.warn(
          `[dormerRoofCut] ${cut.kind} ${cut.id} footprint does not intersect host roof ${roof.id} bbox; skipping CSG cut.`,
        );
        continue;
      }
      // World coords: plan-X → world-X, plan-Y → world-Z (no negation),
      // matching makeRoofMassMesh + wall builders. The earlier negated
      // convention put the cutter on the opposite side of world-origin from
      // the host roof, so SUBTRACTION ran but did nothing inside the
      // visible roof volume.
      const xMin = fp.minX / 1000;
      const xMax = fp.maxX / 1000;
      const zMin = fp.minY / 1000;
      const zMax = fp.maxY / 1000;
      const widthM = xMax - xMin;
      const depthM = zMax - zMin;
      if (widthM <= 0 || depthM <= 0) {
        console.warn(
          `[dormerRoofCut] ${cut.kind} ${cut.id} has non-positive footprint (${widthM}m x ${depthM}m); skipping CSG cut.`,
        );
        continue;
      }
      // Issue #77 — confine the cutter to the roof volume. See
      // `computeDormerCutVerticalExtent` for the bounding rationale.
      const { baseY, cutHeightM } = computeDormerCutVerticalExtent(refElev, eaveY);
      const boxRaw = new THREE.BoxGeometry(widthM, cutHeightM, depthM);
      const cutter = new Brush(normaliseForCsg(boxRaw));
      cutter.position.set((xMin + xMax) / 2, baseY + cutHeightM / 2, (zMin + zMax) / 2);
      cutter.updateMatrixWorld();
      brush = evaluator.evaluate(brush, cutter, SUBTRACTION);
      brush.updateMatrixWorld();
      cutsApplied += 1;
    }
    if (cutsApplied === 0) return geom;
    const cutGeom = brush.geometry;
    cutGeom.computeVertexNormals();
    return cutGeom;
  } catch (err) {
    console.warn(
      `[dormerRoofCut] CSG SUBTRACTION failed on roof ${roof.id} (${dormers.length} dormer(s), ${roofOpenings.length} roof opening(s)); rendering uncut.`,
      err,
    );
    return geom;
  }
}

function computeRoofBboxMm(roof: Extract<Element, { kind: 'roof' }>): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  const xs = roof.footprintMm.map((p) => p.xMm);
  const ys = roof.footprintMm.map((p) => p.yMm);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function bboxesOverlap(
  a: { minX: number; maxX: number; minY: number; maxY: number },
  b: { minX: number; maxX: number; minY: number; maxY: number },
): boolean {
  return a.maxX > b.minX && a.minX < b.maxX && a.maxY > b.minY && a.minY < b.maxY;
}

function computeRoofOpeningFootprintMm(opening: Extract<Element, { kind: 'roof_opening' }>): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  const xs = opening.boundaryMm.map((p) => p.xMm);
  const ys = opening.boundaryMm.map((p) => p.yMm);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}
