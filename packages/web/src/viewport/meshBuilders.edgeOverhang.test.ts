/**
 * MF-modeling-3a (#56) — RoofElem.edgeOverhangMm per-edge cantilever rendering.
 *
 * Asserts that the rendered roof mesh extends past the wall footprint by the
 * per-edge override (rather than the uniform scalar) when ``edgeOverhangMm``
 * is present, and that omitting the map preserves the byte-stable scalar path.
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { makeRoofMassMesh } from './meshBuilders';

type RoofElem = Extract<Element, { kind: 'roof' }>;
type WallElem = Extract<Element, { kind: 'wall' }>;
type LevelElem = Extract<Element, { kind: 'level' }>;

const level0: LevelElem = {
  kind: 'level',
  id: 'lvl-0',
  name: 'Level 0',
  elevationMm: 0,
};

// 3 m tall wall on the south edge of the rectangle (purely to establish the
// eave plate elevation for the roof; the renderer reads the tallest wall at
// the reference level).
const wall3m: WallElem = {
  kind: 'wall',
  id: 'wall-1',
  name: 'Wall',
  levelId: 'lvl-0',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 6000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 3000,
};

const elementsById: Record<string, Element> = {
  'lvl-0': level0,
  'wall-1': wall3m,
};

// 6 m × 4 m flat roof on a single-storey footprint.
const baseFootprintMm = [
  { xMm: 0, yMm: 0 },
  { xMm: 6000, yMm: 0 },
  { xMm: 6000, yMm: 4000 },
  { xMm: 0, yMm: 4000 },
];

function flatRoof(extra: Partial<RoofElem>): RoofElem {
  return {
    kind: 'roof',
    id: 'roof-flat',
    name: 'Roof',
    referenceLevelId: 'lvl-0',
    footprintMm: baseFootprintMm,
    roofGeometryMode: 'flat',
    overhangMm: 400,
    ...extra,
  };
}

describe('makeRoofMassMesh — edgeOverhangMm (per-edge cantilevers, #56)', () => {
  it('falls back to the uniform scalar when edgeOverhangMm is omitted', () => {
    const mesh = makeRoofMassMesh(flatRoof({}), elementsById, null);
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    // Uniform 400 mm overhang on every side → footprint extends 0.4 m outward.
    expect(box.min.x).toBeCloseTo(-0.4, 3);
    expect(box.max.x).toBeCloseTo(6.4, 3);
    expect(box.min.z).toBeCloseTo(-0.4, 3);
    expect(box.max.z).toBeCloseTo(4.4, 3);
  });

  it('extends the roof past the wall footprint on the specified edge only', () => {
    // Cantilever terrace on the east edge: 2500 mm overhang east, 400 mm elsewhere.
    const roof = flatRoof({ edgeOverhangMm: { e: 2500 } });
    const mesh = makeRoofMassMesh(roof, elementsById, null);
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    // East side extends 2.5 m past the wall footprint…
    expect(box.max.x).toBeCloseTo(6.0 + 2.5, 3);
    // …while the other three sides keep the scalar 400 mm.
    expect(box.min.x).toBeCloseTo(-0.4, 3);
    expect(box.min.z).toBeCloseTo(-0.4, 3);
    expect(box.max.z).toBeCloseTo(4.4, 3);
  });

  it('honours every cardinal override independently', () => {
    const roof = flatRoof({
      edgeOverhangMm: { n: 100, e: 2500, s: 800, w: 1200 },
    });
    const mesh = makeRoofMassMesh(roof, elementsById, null);
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    // w → -X, e → +X, n → -Z, s → +Z (documented in the renderer).
    expect(box.min.x).toBeCloseTo(0 - 1.2, 3);
    expect(box.max.x).toBeCloseTo(6 + 2.5, 3);
    expect(box.min.z).toBeCloseTo(0 - 0.1, 3);
    expect(box.max.z).toBeCloseTo(4 + 0.8, 3);
  });

  it('explicit 0 for an edge overrides the scalar (flush eave on that side)', () => {
    const roof = flatRoof({ edgeOverhangMm: { n: 0, s: 0 } });
    const mesh = makeRoofMassMesh(roof, elementsById, null);
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    // North + south edges are flush with the footprint (no overhang).
    expect(box.min.z).toBeCloseTo(0, 3);
    expect(box.max.z).toBeCloseTo(4, 3);
    // East + west edges keep the scalar 400 mm overhang.
    expect(box.min.x).toBeCloseTo(-0.4, 3);
    expect(box.max.x).toBeCloseTo(6.4, 3);
  });

  it('all-edges-equal map is observably equivalent to the scalar', () => {
    const scalarMesh = makeRoofMassMesh(flatRoof({ overhangMm: 400 }), elementsById, null);
    const perEdgeMesh = makeRoofMassMesh(
      flatRoof({ overhangMm: 400, edgeOverhangMm: { n: 400, e: 400, s: 400, w: 400 } }),
      elementsById,
      null,
    );
    scalarMesh.updateMatrixWorld(true);
    perEdgeMesh.updateMatrixWorld(true);
    const sb = new THREE.Box3().setFromObject(scalarMesh);
    const pb = new THREE.Box3().setFromObject(perEdgeMesh);
    expect(pb.min.x).toBeCloseTo(sb.min.x, 4);
    expect(pb.max.x).toBeCloseTo(sb.max.x, 4);
    expect(pb.min.z).toBeCloseTo(sb.min.z, 4);
    expect(pb.max.z).toBeCloseTo(sb.max.z, 4);
  });
});
