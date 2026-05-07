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

// Regular hexagon footprint, centered at (5000, 5000) mm with 2500 mm radius.
const hexHipRoof: RoofElem = (() => {
  const cx = 5000;
  const cz = 5000;
  const r = 2500;
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    pts.push({ xMm: cx + r * Math.cos(a), yMm: cz + r * Math.sin(a) });
  }
  return {
    kind: 'roof',
    id: 'roof-hex-1',
    name: 'Hex Hip Roof',
    referenceLevelId: 'lvl-0',
    footprintMm: pts,
    slopeDeg: 30,
    roofGeometryMode: 'hip',
  };
})();

describe('makeRoofMassMesh — hip on convex polygon (KRN-03)', () => {
  it('produces one triangular face per polygon edge', () => {
    const mesh = makeRoofMassMesh(hexHipRoof, elementsById, null);
    const positions = mesh.geometry.getAttribute('position');
    // 6 edges × 3 verts each = 18
    expect(positions.count).toBe(18);
  });

  it('apex sits above eave plate by inradius * tan(slope)', () => {
    const mesh = makeRoofMassMesh(hexHipRoof, elementsById, null);
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    // For a regular hexagon with circumradius R, the apothem (inradius) is R * cos(30°).
    // R = 2500 mm → inradius = 2500 * cos(30°) ≈ 2165 mm.
    const inradiusM = (2500 * Math.cos(Math.PI / 6)) / 1000;
    const expectedPeak = 3.0 + inradiusM * Math.tan((30 * Math.PI) / 180);
    expect(box.min.y).toBeCloseTo(3.0, 2);
    expect(box.max.y).toBeCloseTo(expectedPeak, 2);
  });

  it('all six edges share the apex point (convex pavilion)', () => {
    const mesh = makeRoofMassMesh(hexHipRoof, elementsById, null);
    const positions = mesh.geometry.getAttribute('position');
    // For each triangle, the third vertex (positions index 3*i + 2) is the apex.
    const apexes: Array<[number, number, number]> = [];
    for (let i = 0; i < positions.count; i += 3) {
      apexes.push([positions.getX(i + 2), positions.getY(i + 2), positions.getZ(i + 2)]);
    }
    expect(apexes.length).toBe(6);
    const [ax, ay, az] = apexes[0];
    for (const [x, y, z] of apexes.slice(1)) {
      expect(x).toBeCloseTo(ax, 3);
      expect(y).toBeCloseTo(ay, 3);
      expect(z).toBeCloseTo(az, 3);
    }
  });
});
