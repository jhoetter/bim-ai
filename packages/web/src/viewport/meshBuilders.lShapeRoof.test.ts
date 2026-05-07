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

const wall3m: WallElem = {
  kind: 'wall',
  id: 'wall-1',
  name: 'Wall',
  levelId: 'lvl-0',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 1000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 3000,
};

const elementsById: Record<string, Element> = {
  'lvl-0': level0,
  'wall-1': wall3m,
};

// L-shape footprint, AABB 6000 × 6000 mm with the NE 3000 × 3000 corner cut.
const lShapeRoof: RoofElem = {
  kind: 'roof',
  id: 'roof-l-1',
  name: 'L-shape Roof',
  referenceLevelId: 'lvl-0',
  footprintMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 6000, yMm: 0 },
    { xMm: 6000, yMm: 3000 },
    { xMm: 3000, yMm: 3000 },
    { xMm: 3000, yMm: 6000 },
    { xMm: 0, yMm: 6000 },
  ],
  slopeDeg: 30,
  roofGeometryMode: 'gable_pitched_l_shape',
};

describe('makeRoofMassMesh — gable_pitched_l_shape (KRN-02)', () => {
  it('produces a non-empty mesh with two ridges and a valley face', () => {
    const mesh = makeRoofMassMesh(lShapeRoof, elementsById, null);
    const positions = mesh.geometry.getAttribute('position');
    expect(positions).toBeTruthy();
    // Two gables (18 verts each) + 1 valley triangle (3 verts) = 39
    expect(positions.count).toBe(39);
  });

  it('places the highest vertex above the eave plate by halfSpan * tan(slope)', () => {
    const mesh = makeRoofMassMesh(lShapeRoof, elementsById, null);
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    // eave plate Y = 3.0 m. Each gable spans 3000 mm transversely → half-span 1500 mm.
    // ridgeY = 3.0 + 1.5 * tan(30°) ≈ 3.866 m
    expect(box.min.y).toBeCloseTo(3.0, 2);
    expect(box.max.y).toBeCloseTo(3.0 + 1.5 * Math.tan((30 * Math.PI) / 180), 2);
  });

  it('mesh footprint covers both arms of the L (AABB ≥ 6 m × 6 m)', () => {
    const mesh = makeRoofMassMesh(lShapeRoof, elementsById, null);
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    expect(box.max.x - box.min.x).toBeGreaterThanOrEqual(5.99);
    expect(box.max.z - box.min.z).toBeGreaterThanOrEqual(5.99);
  });
});
