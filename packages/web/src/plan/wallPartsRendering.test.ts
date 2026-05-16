import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { planWallMesh } from './planElementMeshBuilders';
import { makeWallMesh } from '../viewport/meshBuilders';

function makeWall(
  overrides: Partial<Extract<Element, { kind: 'wall' }>> = {},
): Extract<Element, { kind: 'wall' }> {
  return {
    kind: 'wall',
    id: 'wall-1',
    name: 'Wall',
    levelId: 'lvl-1',
    start: { xMm: 0, yMm: 0 },
    end: { xMm: 4000, yMm: 0 },
    thicknessMm: 200,
    heightMm: 2800,
    ...overrides,
  };
}

describe('G3 — wall parts plan rendering', () => {
  it('returns 2 filled rects (Meshes) for a 2-part wall', () => {
    const wall = makeWall({
      parts: [
        { id: 'p1', startT: 0, endT: 0.5, materialId: 'concrete' },
        { id: 'p2', startT: 0.5, endT: 1, materialId: 'brick' },
      ],
    });
    const obj = planWallMesh(wall, undefined, 1, {});
    const meshes: THREE.Mesh[] = [];
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.partId) meshes.push(child);
    });
    expect(meshes).toHaveLength(2);
  });

  it('part fills span correct x extents (startT/endT) along wall axis', () => {
    const wallLenM = 4;
    const wall = makeWall({
      start: { xMm: 0, yMm: 0 },
      end: { xMm: wallLenM * 1000, yMm: 0 },
      parts: [
        { id: 'p1', startT: 0, endT: 0.25 },
        { id: 'p2', startT: 0.25, endT: 1 },
      ],
    });
    const obj = planWallMesh(wall);
    const fills: THREE.Mesh[] = [];
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.partId) fills.push(child);
    });
    fills.sort((a, b) => a.position.x - b.position.x);

    // Part 1 center: 0.125 * 4 = 0.5 m
    expect(fills[0]!.position.x).toBeCloseTo(0.125 * wallLenM, 4);
    // Part 2 center: 0.625 * 4 = 2.5 m
    expect(fills[1]!.position.x).toBeCloseTo(0.625 * wallLenM, 4);
  });

  it('part fill colour matches materialId lookup; falls back to #cccccc for unknown', () => {
    const wall = makeWall({
      parts: [
        { id: 'p1', startT: 0, endT: 0.5, materialId: 'definitely_unknown_mat' },
        { id: 'p2', startT: 0.5, endT: 1 },
      ],
    });
    const obj = planWallMesh(wall);
    const fills: THREE.Mesh[] = [];
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.partId) fills.push(child);
    });
    expect(fills).toHaveLength(2);
    for (const fill of fills) {
      const mat = fill.material as THREE.MeshBasicMaterial;
      expect(mat.transparent).toBe(true);
      expect(mat.opacity).toBeCloseTo(0.4, 5);
      // unknown / undefined materialId → grey fallback (#cccccc)
      const grey = new THREE.Color('#cccccc');
      expect(mat.color.r).toBeCloseTo(grey.r, 2);
      expect(mat.color.g).toBeCloseTo(grey.g, 2);
      expect(mat.color.b).toBeCloseTo(grey.b, 2);
    }
  });

  it('zero-part wall renders exactly the same as before (regression)', () => {
    const wall = makeWall({ parts: [] });
    const wallNoParts = makeWall();
    const objWithEmpty = planWallMesh(wall);
    const objNoParts = planWallMesh(wallNoParts);
    // Neither should have any partId mesh
    const partMeshesEmpty: THREE.Mesh[] = [];
    objWithEmpty.traverse((c) => {
      if (c instanceof THREE.Mesh && c.userData.partId) partMeshesEmpty.push(c);
    });
    const partMeshesNone: THREE.Mesh[] = [];
    objNoParts.traverse((c) => {
      if (c instanceof THREE.Mesh && c.userData.partId) partMeshesNone.push(c);
    });
    expect(partMeshesEmpty).toHaveLength(0);
    expect(partMeshesNone).toHaveLength(0);
    // Both should have exactly one wall body mesh (bimPickId = wall.id, no partId)
    const bodyMeshesEmpty: THREE.Mesh[] = [];
    objWithEmpty.traverse((c) => {
      if (c instanceof THREE.Mesh && c.userData.bimPickId === 'wall-1' && !c.userData.partId)
        bodyMeshesEmpty.push(c);
    });
    expect(bodyMeshesEmpty).toHaveLength(1);
  });
});

describe('G3 — wall parts 3D mesh', () => {
  it('makeWallMesh with 4-part wall returns a Group with 4 named children', () => {
    const wall = makeWall({
      parts: [
        { id: 'a', startT: 0, endT: 0.25, materialId: 'concrete' },
        { id: 'b', startT: 0.25, endT: 0.5, materialId: 'brick' },
        { id: 'c', startT: 0.5, endT: 0.75 },
        { id: 'd', startT: 0.75, endT: 1 },
      ],
    });
    const obj = makeWallMesh(wall, 0, null);
    expect(obj).toBeInstanceOf(THREE.Group);
    const group = obj as THREE.Group;
    const named = group.children.filter((c) => c.name.startsWith('wall-part-'));
    expect(named).toHaveLength(4);
    expect(named.map((c) => c.name).sort()).toEqual([
      'wall-part-a',
      'wall-part-b',
      'wall-part-c',
      'wall-part-d',
    ]);
  });
});
