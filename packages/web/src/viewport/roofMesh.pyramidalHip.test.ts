import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { makeRoofMassMesh } from './meshBuilders';
import { _buildPyramidalHipGeometry } from './roofGeometry';

// ISSUE-110 — Zeltdach / Pyramidendach (pyramidal hip) mesh tests. Covers:
// - `_buildPyramidalHipGeometry` produces 4 triangular faces meeting at one apex
//   (12 vertex positions total — 4 × 3, no shared verts in the non-indexed mesh).
// - For a square footprint the apex sits above the centroid at
//   `eaveY + halfSpan * tan(slope)`.
// - For a non-square rectangle the apex still sits above the centroid; rise is
//   driven by the SHORT half-span so the steep faces hit the requested slope.
// - The `makeRoofMassMesh` dispatcher routes `roofGeometryMode: 'pyramidal_hip'`
//   to `_buildPyramidalHipGeometry` regardless of the inferred ridge axis.
// - The four triangles cover the full eave perimeter (each footprint edge is
//   used exactly once as a triangle base).

type RoofElem = Extract<Element, { kind: 'roof' }>;
type WallElem = Extract<Element, { kind: 'wall' }>;
type LevelElem = Extract<Element, { kind: 'level' }>;

const level0: LevelElem = {
  kind: 'level',
  id: 'lvl-0',
  name: 'Ground',
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

// 6 m × 6 m square footprint. Slope 35° → apex rise = 3 * tan(35°) ≈ 2.101 m.
const squareZeltdachRoof: RoofElem = {
  kind: 'roof',
  id: 'roof-pyr-1',
  name: 'Square Zeltdach',
  referenceLevelId: 'lvl-0',
  footprintMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 6000, yMm: 0 },
    { xMm: 6000, yMm: 6000 },
    { xMm: 0, yMm: 6000 },
  ],
  slopeDeg: 35,
  roofGeometryMode: 'pyramidal_hip',
};

// 5.4 × 5.6 m near-square — typical Stadtvilla; renderer should still build a
// single-apex pyramid where the short half-span drives the apex height.
const nearSquareZeltdachRoof: RoofElem = {
  kind: 'roof',
  id: 'roof-pyr-2',
  name: 'Near-square Zeltdach',
  referenceLevelId: 'lvl-0',
  footprintMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 5400, yMm: 0 },
    { xMm: 5400, yMm: 5600 },
    { xMm: 0, yMm: 5600 },
  ],
  slopeDeg: 35,
  roofGeometryMode: 'pyramidal_hip',
};

describe('_buildPyramidalHipGeometry — pure builder', () => {
  it('produces four triangular faces (12 vertex positions)', () => {
    const geom = _buildPyramidalHipGeometry(0, 6, 0, 6, 3.0, (35 * Math.PI) / 180);
    const positions = geom.getAttribute('position');
    // 4 triangles × 3 vertices each (non-indexed mesh).
    expect(positions.count).toBe(12);
  });

  it('apex for a square sits above the centroid at halfSpan * tan(slope)', () => {
    const geom = _buildPyramidalHipGeometry(0, 6, 0, 6, 3.0, (35 * Math.PI) / 180);
    const positions = geom.getAttribute('position');
    // The apex vertex is the 3rd vertex of each triangle. Collect & assert
    // they are all identical, above the eave plate at the predicted height.
    const expectedApexY = 3.0 + 3.0 * Math.tan((35 * Math.PI) / 180);
    for (let i = 0; i < 4; i++) {
      const offset = i * 9 + 6; // third vertex of triangle i (positions 6..8)
      const ax = positions.getX(i * 3 + 2);
      const ay = positions.getY(i * 3 + 2);
      const az = positions.getZ(i * 3 + 2);
      expect(ax).toBeCloseTo(3.0, 6);
      expect(az).toBeCloseTo(3.0, 6);
      expect(ay).toBeCloseTo(expectedApexY, 6);
      // Sanity-check the byte offset arithmetic (Float32 layout = 3 floats per vert):
      expect(offset).toBe(i * 9 + 6);
    }
  });

  it('apex for a rectangle uses the SHORT half-span to determine rise', () => {
    // 4 m × 8 m rectangle, slope 30°. Short half-span = 2 m so rise = 2 * tan(30°).
    const eaveY = 3.0;
    const geom = _buildPyramidalHipGeometry(0, 8, 0, 4, eaveY, (30 * Math.PI) / 180);
    const positions = geom.getAttribute('position');
    const expectedApexY = eaveY + 2.0 * Math.tan((30 * Math.PI) / 180);
    for (let i = 0; i < 4; i++) {
      expect(positions.getY(i * 3 + 2)).toBeCloseTo(expectedApexY, 6);
      // Apex still above centroid (4, 2).
      expect(positions.getX(i * 3 + 2)).toBeCloseTo(4.0, 6);
      expect(positions.getZ(i * 3 + 2)).toBeCloseTo(2.0, 6);
    }
  });

  it('non-apex vertices lie at the four footprint corners on the eave plate', () => {
    const eaveY = 3.0;
    const geom = _buildPyramidalHipGeometry(0, 6, 0, 6, eaveY, (35 * Math.PI) / 180);
    const positions = geom.getAttribute('position');
    // Collect the 8 non-apex vertex positions (verts 0/1 of each of 4 triangles).
    const corners = new Set<string>();
    for (let t = 0; t < 4; t++) {
      for (let v = 0; v < 2; v++) {
        const x = positions.getX(t * 3 + v);
        const y = positions.getY(t * 3 + v);
        const z = positions.getZ(t * 3 + v);
        expect(y).toBeCloseTo(eaveY, 6);
        corners.add(`${x.toFixed(3)},${z.toFixed(3)}`);
      }
    }
    // Only 4 unique corner positions on the eave plate.
    expect(corners.size).toBe(4);
    expect(corners.has('0.000,0.000')).toBe(true);
    expect(corners.has('6.000,0.000')).toBe(true);
    expect(corners.has('6.000,6.000')).toBe(true);
    expect(corners.has('0.000,6.000')).toBe(true);
  });

  it('each footprint edge appears as exactly one triangle base', () => {
    const geom = _buildPyramidalHipGeometry(0, 6, 0, 6, 3.0, (35 * Math.PI) / 180);
    const positions = geom.getAttribute('position');
    const edges = new Set<string>();
    for (let t = 0; t < 4; t++) {
      const ax = positions.getX(t * 3).toFixed(3);
      const az = positions.getZ(t * 3).toFixed(3);
      const bx = positions.getX(t * 3 + 1).toFixed(3);
      const bz = positions.getZ(t * 3 + 1).toFixed(3);
      // Canonicalise edge as the lexicographically smaller endpoint first.
      const a = `${ax},${az}`;
      const b = `${bx},${bz}`;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      edges.add(key);
    }
    expect(edges.size).toBe(4);
  });
});

describe('makeRoofMassMesh — pyramidal_hip dispatch', () => {
  it('routes roofGeometryMode="pyramidal_hip" to the pyramid builder (12 positions)', () => {
    const mesh = makeRoofMassMesh(squareZeltdachRoof, elementsById, null);
    const positions = mesh.geometry.getAttribute('position');
    // 4 triangles × 3 vertices (non-indexed) — exactly the pyramid topology.
    expect(positions.count).toBe(12);
  });

  it('apex above the eave at the expected square-roof height', () => {
    const mesh = makeRoofMassMesh(squareZeltdachRoof, elementsById, null);
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    // Eave plate Y = wall height = 3.0 m. Apex rise = 3 m * tan(35°).
    const expectedPeak = 3.0 + 3.0 * Math.tan((35 * Math.PI) / 180);
    expect(box.min.y).toBeCloseTo(3.0, 2);
    expect(box.max.y).toBeCloseTo(expectedPeak, 2);
  });

  it('non-square rectangle still resolves to a single apex above the centroid', () => {
    const mesh = makeRoofMassMesh(nearSquareZeltdachRoof, elementsById, null);
    mesh.updateMatrixWorld(true);
    const positions = mesh.geometry.getAttribute('position');
    expect(positions.count).toBe(12);
    // Collect apex world positions.
    const apex = new THREE.Vector3();
    apex.fromBufferAttribute(positions, 2);
    mesh.localToWorld(apex);
    // Centroid lives at (2.7, 2.8) in plan; height = 2.7 * tan(35°) above eave 3.0.
    // (Plan Y -> world Z is negated by the renderer; assert via tight bounding box.)
    const box = new THREE.Box3().setFromObject(mesh);
    const expectedPeak = 3.0 + (Math.min(5.4, 5.6) / 2.0) * Math.tan((35 * Math.PI) / 180);
    expect(box.min.y).toBeCloseTo(3.0, 2);
    expect(box.max.y).toBeCloseTo(expectedPeak, 2);
  });

  it('apex height is independent of ridgeAlongX heuristic', () => {
    // Swap the wide axis — for a true pyramidal hip the ridge token is
    // irrelevant (the ridge has collapsed to a point). The mesh peak must
    // match for both orientations.
    const a = makeRoofMassMesh(squareZeltdachRoof, elementsById, null);
    const b = makeRoofMassMesh(
      { ...squareZeltdachRoof, ridgeAlongX: true } as RoofElem,
      elementsById,
      null,
    );
    a.updateMatrixWorld(true);
    b.updateMatrixWorld(true);
    const boxA = new THREE.Box3().setFromObject(a);
    const boxB = new THREE.Box3().setFromObject(b);
    expect(boxA.max.y).toBeCloseTo(boxB.max.y, 6);
  });
});
