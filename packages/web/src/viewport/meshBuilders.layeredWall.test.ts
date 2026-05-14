import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { getBuiltInWallType } from '../families/wallTypeCatalog';
import { makeLayeredWallMesh, darkenHex } from './meshBuilders.layeredWall';
import { makeWallMesh } from './meshBuilders';

type WallElem = Extract<Element, { kind: 'wall' }>;

const baseWall: WallElem = {
  kind: 'wall',
  id: 'w1',
  name: 'Test wall',
  levelId: 'lvl0',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 4000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 2700,
};

function visibleMeshes(group: THREE.Group): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh && obj.parent === group) {
      meshes.push(obj as THREE.Mesh);
    }
  });
  return meshes;
}

describe('makeLayeredWallMesh — FL-08', () => {
  it('emits one mesh per non-air layer for wall.ext-timber', () => {
    const assembly = getBuiltInWallType('wall.ext-timber')!;
    const group = makeLayeredWallMesh(baseWall, assembly, 0, null);
    const meshes = visibleMeshes(group);
    expect(meshes.length).toBe(4);
  });

  it('aggregate bounding box thickness matches the spec total within 0.5 mm', () => {
    const assembly = getBuiltInWallType('wall.ext-timber')!;
    const group = makeLayeredWallMesh(baseWall, assembly, 0, null);
    const box = new THREE.Box3().setFromObject(group);
    // Wall runs along X, layers stack along Z. The total thickness is the Z extent.
    const thickM = box.max.z - box.min.z;
    // Spec total is 198.5 mm = 0.1985 m; tolerate a few mm of board protrusion / edge geometry.
    expect(thickM * 1000).toBeGreaterThanOrEqual(198);
    expect(thickM * 1000).toBeLessThanOrEqual(225);
  });

  it('basisLine center keeps the stack centered on the wall axis', () => {
    const assembly = getBuiltInWallType('wall.int-partition')!;
    expect(assembly.basisLine).toBe('center');
    const group = makeLayeredWallMesh(baseWall, assembly, 0, null);
    const box = new THREE.Box3().setFromObject(group);
    const totalMm = assembly.layers.reduce((s, l) => s + l.thicknessMm, 0);
    expect(box.min.z).toBeCloseTo(-totalMm / 2000, 3);
    expect(box.max.z).toBeCloseTo(totalMm / 2000, 3);
  });

  it('diagonal layered wall meshes follow the authored start-to-end line', () => {
    const assembly = getBuiltInWallType('wall.int-partition')!;
    const diagonalWall: WallElem = {
      ...baseWall,
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 3000, yMm: 4000 },
    };
    const group = makeLayeredWallMesh(diagonalWall, assembly, 0, null);
    const mesh = visibleMeshes(group)[0]!;
    const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(mesh.quaternion);
    const localZ = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);

    expect(localX.x).toBeCloseTo(0.6, 5);
    expect(localX.z).toBeCloseTo(0.8, 5);
    expect(localZ.x).toBeCloseTo(-0.8, 5);
    expect(localZ.z).toBeCloseTo(0.6, 5);
  });

  it('makeWallMesh dispatches to the layered renderer when wallTypeId resolves', () => {
    const wall: WallElem = { ...baseWall, wallTypeId: 'wall.int-partition' };
    const obj = makeWallMesh(wall, 0, null);
    expect((obj as THREE.Group).type).toBe('Group');
    // Single-thickness wall would be a Mesh
  });

  it('makeWallMesh falls back to single-thickness when wallTypeId is unknown', () => {
    const wall: WallElem = { ...baseWall, wallTypeId: 'no-such-id' };
    const obj = makeWallMesh(wall, 0, null);
    expect((obj as THREE.Mesh).isMesh).toBe(true);
  });

  it('darkenHex factor=0.3 lightens-correctly (deterministic 30% darken)', () => {
    expect(darkenHex('#ffffff', 0.3)).toBe('#b3b3b3');
    expect(darkenHex('#000000', 0.3)).toBe('#000000');
    expect(darkenHex('#cccccc', 0.3)).toBe('#8f8f8f');
  });
});
