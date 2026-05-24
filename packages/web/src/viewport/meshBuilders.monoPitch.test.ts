import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { makeRoofMassMesh } from './meshBuilders';
import { _buildMonoPitchGeometry } from './roofGeometry';
import { roofHeightAtPoint } from './roofHeightSampler';

type RoofElem = Extract<Element, { kind: 'roof' }>;
type WallElem = Extract<Element, { kind: 'wall' }>;
type LevelElem = Extract<Element, { kind: 'level' }>;

// ISSUE-53 — Pultdach mesh tests. Covers:
// - `_buildMonoPitchGeometry` produces a tilted slab whose ridge sits
//   `runM * tan(slope)` above the eave for every supported `highEdge`.
// - `makeRoofMassMesh` dispatches `roofGeometryMode: "mono_pitch"` to that
//   builder and produces a watertight mesh.
// - `roofHeightAtPoint` returns the correct ramp height for points along the
//   slope (eave → ridge).

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

// 6000 mm (X) × 4000 mm (Z) rectangle, high edge to the north. eave plate Y =
// 3.0 m (Level 0 + wall_top). Pultdach slope 15° → ridge run = 4.0 m → rise =
// 4.0 * tan(15°) ≈ 1.072 m, ridge Y ≈ 4.072 m.
const pultdachRoof: RoofElem = {
  kind: 'roof',
  id: 'roof-pult-1',
  name: 'Pultdach',
  referenceLevelId: 'lvl-0',
  footprintMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 6000, yMm: 0 },
    { xMm: 6000, yMm: 4000 },
    { xMm: 0, yMm: 4000 },
  ],
  slopeDeg: 15,
  roofGeometryMode: 'mono_pitch',
  monoPitchHighEdge: 'n',
};

const expectedRunM = 4.0;
const expectedRiseM = expectedRunM * Math.tan((15 * Math.PI) / 180);

describe('_buildMonoPitchGeometry — Pultdach', () => {
  it('places the ridge exactly runM * tan(slope) above the eave', () => {
    const geom = _buildMonoPitchGeometry(0, 6, 0, 4, 3.0, (15 * Math.PI) / 180, 'n');
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    expect(minY).toBeCloseTo(3.0, 6);
    expect(maxY).toBeCloseTo(3.0 + expectedRiseM, 6);
    expect(maxY - minY).toBeCloseTo(expectedRiseM, 6);
  });

  it('puts the ridge at the requested compass quadrant (high edge "n")', () => {
    const geom = _buildMonoPitchGeometry(0, 6, 0, 4, 3.0, (15 * Math.PI) / 180, 'n');
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    // Find the maximum-Y vertex and check its world-Z lives at +Z (north).
    let maxY = -Infinity;
    let maxYZ = 0;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > maxY) {
        maxY = y;
        maxYZ = pos.getZ(i);
      }
    }
    expect(maxYZ).toBeCloseTo(4.0, 6);
  });

  it('flips the ridge to the south side when highEdge="s"', () => {
    const geom = _buildMonoPitchGeometry(0, 6, 0, 4, 3.0, (15 * Math.PI) / 180, 's');
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    let maxY = -Infinity;
    let maxYZ = 0;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > maxY) {
        maxY = y;
        maxYZ = pos.getZ(i);
      }
    }
    // High edge to the south → ridge at z = 0
    expect(maxYZ).toBeCloseTo(0.0, 6);
  });

  it('lets the ridge run along Z when highEdge="e" (full X span = run)', () => {
    const geom = _buildMonoPitchGeometry(0, 6, 0, 4, 3.0, (15 * Math.PI) / 180, 'e');
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    let minY = Infinity;
    let maxY = -Infinity;
    let maxYX = 0;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < minY) minY = y;
      if (y > maxY) {
        maxY = y;
        maxYX = pos.getX(i);
      }
    }
    // Run is the full X span = 6 m, so rise = 6 * tan(15°) ≈ 1.608 m.
    expect(maxY - minY).toBeCloseTo(6.0 * Math.tan((15 * Math.PI) / 180), 6);
    // High edge sits on +X (east).
    expect(maxYX).toBeCloseTo(6.0, 6);
  });
});

describe('makeRoofMassMesh — dispatch to mono_pitch', () => {
  it('routes mono_pitch through _buildMonoPitchGeometry (single tilted slab)', () => {
    const mesh = makeRoofMassMesh(pultdachRoof, elementsById, null);
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    // eave plate Y = 3.0; ridge Y = 3.0 + 4.0 * tan(15°)
    expect(box.min.y).toBeCloseTo(3.0, 2);
    expect(box.max.y).toBeCloseTo(3.0 + expectedRiseM, 2);
  });

  it('uses the longer footprint span as the ridge axis when monoPitchHighEdge is omitted', () => {
    // 6000 (X) × 4000 (Z): default high edge is "n" (ridge along X, pitch along Z).
    const noHighEdge: RoofElem = { ...pultdachRoof, monoPitchHighEdge: undefined };
    const heightAtNorthEave = roofHeightAtPoint(noHighEdge, elementsById, 3000, 4000);
    const heightAtSouthEave = roofHeightAtPoint(noHighEdge, elementsById, 3000, 0);
    // Default high edge = north → north edge is at ridge height, south at eave.
    expect(heightAtNorthEave).toBeCloseTo(3.0 + expectedRiseM, 3);
    expect(heightAtSouthEave).toBeCloseTo(3.0, 3);
  });
});

describe('roofHeightAtPoint — mono_pitch sampler', () => {
  it('ramps linearly from eave (low) to ridge (high) along the across-ridge axis', () => {
    // South eave (z=0): eave Y = 3.0
    expect(roofHeightAtPoint(pultdachRoof, elementsById, 3000, 0)).toBeCloseTo(3.0, 3);
    // North ridge (z=4000): ridge Y = 3 + 4 * tan(15°)
    expect(roofHeightAtPoint(pultdachRoof, elementsById, 3000, 4000)).toBeCloseTo(
      3.0 + expectedRiseM,
      3,
    );
    // Mid (z=2000): exactly half way up.
    expect(roofHeightAtPoint(pultdachRoof, elementsById, 3000, 2000)).toBeCloseTo(
      3.0 + expectedRiseM / 2,
      3,
    );
  });

  it('respects highEdge="s" by flipping the ramp direction', () => {
    const flipped: RoofElem = { ...pultdachRoof, monoPitchHighEdge: 's' };
    // South side is now the ridge.
    expect(roofHeightAtPoint(flipped, elementsById, 3000, 0)).toBeCloseTo(3.0 + expectedRiseM, 3);
    expect(roofHeightAtPoint(flipped, elementsById, 3000, 4000)).toBeCloseTo(3.0, 3);
  });
});
