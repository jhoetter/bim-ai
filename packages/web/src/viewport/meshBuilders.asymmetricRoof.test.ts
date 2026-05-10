import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { makeRoofMassMesh, makeSlopedWallMesh } from './meshBuilders';
import { roofHeightAtPoint } from './roofHeightSampler';

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

// 6000 mm-wide axis-aligned rectangle (z = 0..6000, x = 0..8000), ridge alongX,
// ridge offset 1500 mm toward +z. eave plate sits at 3.0 m (Level 0 + wall top).
const asymmetricRoof: RoofElem = {
  kind: 'roof',
  id: 'roof-asym-1',
  name: 'Asymmetric Roof',
  referenceLevelId: 'lvl-0',
  footprintMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 8000, yMm: 0 },
    { xMm: 8000, yMm: 6000 },
    { xMm: 0, yMm: 6000 },
  ],
  slopeDeg: 45,
  ridgeAxis: 'x',
  roofGeometryMode: 'asymmetric_gable',
  ridgeOffsetTransverseMm: 1500,
};

describe('makeRoofMassMesh — asymmetric_gable', () => {
  it('places the ridge transversely off-center by ridgeOffsetTransverseMm / 1000 m', () => {
    const mesh = makeRoofMassMesh(asymmetricRoof, elementsById, null);
    const positions = mesh.geometry.getAttribute('position');
    const peakY = (() => {
      let max = -Infinity;
      for (let i = 0; i < positions.count; i++) {
        const y = positions.getY(i);
        if (y > max) max = y;
      }
      return max;
    })();
    // Find the z coordinate of the highest vertex
    let peakZ = 0;
    for (let i = 0; i < positions.count; i++) {
      if (Math.abs(positions.getY(i) - peakY) < 1e-4) {
        peakZ = positions.getZ(i);
        break;
      }
    }
    // Center is z = 3.0 m, offset = 1.5 m → ridge at z = 4.5 m
    expect(peakZ).toBeCloseTo(4.5, 3);
  });

  it('produces visibly different left and right pitches (ridge offset means left run > right run)', () => {
    // sample heights symmetrically around the rectangle center (z = 3.0 m)
    // With ridge at z = 4.5 m, slope 45°, eaveY = 3.0 m:
    //   leftRun = 4.5 m (halfSpan + offset = 3 + 1.5)
    //   ridgeY  = 3.0 + 4.5 * tan(45°) = 7.5 m
    //   rightRun = 1.5 m
    //   right slope = (7.5 - 3.0) / 1.5 = 3.0 (i.e. ~71.6° — much steeper)
    const ridgeHeight = roofHeightAtPoint(asymmetricRoof, elementsById, 4000, 4500);
    expect(ridgeHeight).toBeCloseTo(7.5, 2);
    // 1500 mm toward south eave from ridge (z = 4500 - 1500 = 3000): on the LEFT
    // slope (longer run). Height should be 3.0 + (3000/4500) * (7.5 - 3.0) = 6.0 m.
    const southMidHeight = roofHeightAtPoint(asymmetricRoof, elementsById, 4000, 3000);
    expect(southMidHeight).toBeCloseTo(6.0, 2);
    // 1500 mm toward north eave from ridge (z = 4500 + 750 = 5250): on the RIGHT slope.
    // Height should be 7.5 + (750/1500) * (3.0 - 7.5) = 5.25 m.
    const northQuarterHeight = roofHeightAtPoint(asymmetricRoof, elementsById, 4000, 5250);
    expect(northQuarterHeight).toBeCloseTo(5.25, 2);
  });

  it('matches the symmetric gable height when offset is 0 and eaves are equal', () => {
    const symRoof: RoofElem = {
      ...asymmetricRoof,
      ridgeOffsetTransverseMm: 0,
      roofGeometryMode: 'asymmetric_gable',
    };
    // Symmetric → ridge at z = 3.0 m, halfSpan = 3.0 m, slope 45° → ridge height = 6.0 m
    expect(roofHeightAtPoint(symRoof, elementsById, 4000, 3000)).toBeCloseTo(6.0, 3);
    // South eave (z = 0): height = 3.0
    expect(roofHeightAtPoint(symRoof, elementsById, 4000, 0)).toBeCloseTo(3.0, 3);
    // North eave (z = 6000): height = 3.0
    expect(roofHeightAtPoint(symRoof, elementsById, 4000, 6000)).toBeCloseTo(3.0, 3);
  });

  it('respects per-side eaveHeightLeftMm / eaveHeightRightMm overrides', () => {
    const splitEaveRoof: RoofElem = {
      ...asymmetricRoof,
      ridgeOffsetTransverseMm: 0,
      eaveHeightLeftMm: 2000,
      eaveHeightRightMm: 4000,
    };
    // Left (south, z=0) eave at 2.0 m absolute, right (north, z=6000) eave at 4.0 m.
    expect(roofHeightAtPoint(splitEaveRoof, elementsById, 4000, 0)).toBeCloseTo(2.0, 3);
    expect(roofHeightAtPoint(splitEaveRoof, elementsById, 4000, 6000)).toBeCloseTo(4.0, 3);
  });

  it('mesh bounding box ridge sits above eaves by leftRun * tan(slope)', () => {
    const mesh = makeRoofMassMesh(asymmetricRoof, elementsById, null);
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    // eave plate Y = 3.0; max Y should equal ridge height = 7.5 m
    expect(box.min.y).toBeCloseTo(3.0, 2);
    expect(box.max.y).toBeCloseTo(7.5, 2);
  });

  it('is watertight — every triangle edge is shared with exactly one neighbour', () => {
    // Watertightness gates the dormer CSG SUBTRACTION; without it the cut
    // silently no-ops on the open underside.
    const mesh = makeRoofMassMesh(asymmetricRoof, elementsById, null);
    const positions = mesh.geometry.getAttribute('position');
    const triCount = positions.count / 3;
    expect(triCount).toBeGreaterThanOrEqual(8); // 4 surfaces + 2 gable caps + 2 bottom

    const edgeUseCount = new Map<string, number>();
    const keyOf = (a: number[], b: number[]): string => {
      const ka = a.map((n) => n.toFixed(3)).join(',');
      const kb = b.map((n) => n.toFixed(3)).join(',');
      return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    };
    for (let t = 0; t < triCount; t++) {
      const v: number[][] = [];
      for (let i = 0; i < 3; i++) {
        const idx = t * 3 + i;
        v.push([positions.getX(idx), positions.getY(idx), positions.getZ(idx)]);
      }
      for (const [a, b] of [
        [v[0]!, v[1]!],
        [v[1]!, v[2]!],
        [v[2]!, v[0]!],
      ]) {
        const k = keyOf(a, b);
        edgeUseCount.set(k, (edgeUseCount.get(k) ?? 0) + 1);
      }
    }
    const boundary: string[] = [];
    for (const [k, n] of edgeUseCount) {
      if (n !== 2) boundary.push(`${k} (used ${n}×)`);
    }
    expect(boundary).toEqual([]); // every edge shared exactly once
  });

  it('non-planar bottom face spans the split eave heights', () => {
    const splitEaveRoof: RoofElem = {
      ...asymmetricRoof,
      ridgeOffsetTransverseMm: 0,
      eaveHeightLeftMm: 2000,
      eaveHeightRightMm: 4000,
    };
    const mesh = makeRoofMassMesh(splitEaveRoof, elementsById, null);
    const positions = mesh.geometry.getAttribute('position');
    let sawLeftEaveBottom = false;
    let sawRightEaveBottom = false;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      if (Math.abs(y - 2.0) < 1e-3) sawLeftEaveBottom = true;
      if (Math.abs(y - 4.0) < 1e-3) sawRightEaveBottom = true;
    }
    expect(sawLeftEaveBottom).toBe(true);
    expect(sawRightEaveBottom).toBe(true);
  });

  it('samples roof-attached wall tops along the wall so gable ends are not rectangular', () => {
    const crossRidgeWall: WallElem = {
      ...wall3m,
      id: 'wall-cross-ridge',
      start: { xMm: 4000, yMm: 0 },
      end: { xMm: 4000, yMm: 6000 },
      roofAttachmentId: asymmetricRoof.id,
    };
    const mesh = makeSlopedWallMesh(crossRidgeWall, asymmetricRoof, 0, null, {
      ...elementsById,
      [crossRidgeWall.id]: crossRidgeWall,
      [asymmetricRoof.id]: asymmetricRoof,
    });
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);

    expect(box.min.y).toBeCloseTo(0, 2);
    expect(box.max.y).toBeCloseTo(7.5, 2);
  });
});
