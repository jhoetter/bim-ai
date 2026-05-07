import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { dormerFootprintMm, makeDormerMesh } from './dormerMesh';
import type { Element } from '@bim-ai/core';

type DormerElem = Extract<Element, { kind: 'dormer' }>;
type RoofElem = Extract<Element, { kind: 'roof' }>;

const ROOF: RoofElem = {
  kind: 'roof',
  id: 'r1',
  name: 'main',
  referenceLevelId: 'lvl-1',
  footprintMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 5000, yMm: 0 },
    { xMm: 5000, yMm: 8000 },
    { xMm: 0, yMm: 8000 },
  ],
  roofGeometryMode: 'asymmetric_gable',
  ridgeOffsetTransverseMm: 1500,
  eaveHeightLeftMm: 1500,
  eaveHeightRightMm: 4000,
};

describe('dormerFootprintMm', () => {
  it('places the dormer rectangle relative to footprint centre with width along the ridge', () => {
    const dormer: DormerElem = {
      kind: 'dormer',
      id: 'd1',
      hostRoofId: 'r1',
      positionOnRoof: { alongRidgeMm: -2000, acrossRidgeMm: 1000 },
      widthMm: 2400,
      wallHeightMm: 2400,
      depthMm: 2000,
      dormerRoofKind: 'flat',
    };
    const fp = dormerFootprintMm(dormer, ROOF);
    // Roof centre at (2500, 4000). Ridge along plan-Y (longer axis).
    // alongRidgeMm = -2000 → centreY = 4000 - 2000 = 2000.
    // acrossRidgeMm = +1000 → centreX = 2500 + 1000 = 3500.
    // Width along Y, depth along X.
    expect(fp.ridgeAlongX).toBe(false);
    expect(fp.minX).toBeCloseTo(3500 - 1000, 6); // depth/2 = 1000
    expect(fp.maxX).toBeCloseTo(3500 + 1000, 6);
    expect(fp.minY).toBeCloseTo(2000 - 1200, 6); // width/2 = 1200
    expect(fp.maxY).toBeCloseTo(2000 + 1200, 6);
  });
});

describe('makeDormerMesh', () => {
  it('produces a Group with cheek + back walls + flat roof slab', () => {
    const dormer: DormerElem = {
      kind: 'dormer',
      id: 'd1',
      hostRoofId: 'r1',
      positionOnRoof: { alongRidgeMm: -2000, acrossRidgeMm: 1000 },
      widthMm: 2400,
      wallHeightMm: 2400,
      depthMm: 2000,
      dormerRoofKind: 'flat',
      wallMaterialKey: 'white_render',
    };
    const elementsById: Record<string, Element> = {
      'lvl-1': { kind: 'level', id: 'lvl-1', name: 'L1', elevationMm: 3000 },
      r1: ROOF,
    };
    const group = makeDormerMesh(dormer, elementsById, null);
    expect(group).toBeInstanceOf(THREE.Group);
    // 2 cheeks + 1 back wall + 1 roof slab = 4 mesh children (each may have
    // a child outline edges via addEdges so descendant count is higher).
    const meshes: THREE.Mesh[] = [];
    group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    });
    expect(meshes.length).toBeGreaterThanOrEqual(4);
    expect(group.userData.bimPickId).toBe('d1');
  });
});
