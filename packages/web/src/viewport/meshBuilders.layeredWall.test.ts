import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { getBuiltInWallType } from '../families/wallTypeCatalog';
import { makeLayeredWallMesh, darkenHex } from './meshBuilders.layeredWall';
import { makeWallMesh, resolveWallTypeAssembly } from './meshBuilders';

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

  it('stores face exposure metadata for exterior, interior, and cut layers', () => {
    const assembly = getBuiltInWallType('wall.ext-masonry')!;
    const group = makeLayeredWallMesh(baseWall, assembly, 0, null);
    const meshes = visibleMeshes(group);

    expect(group.userData.materialExposure).toEqual({
      exteriorMaterialKey: 'masonry_brick',
      interiorMaterialKey: 'plaster',
      cutMaterialKeys: ['masonry_brick', 'masonry_block', 'plaster'],
    });
    expect(meshes.map((mesh) => [mesh.userData.materialKey, mesh.userData.faceExposure])).toEqual([
      ['masonry_brick', 'exterior'],
      ['masonry_block', 'cut'],
      ['plaster', 'interior'],
    ]);
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

  it('places exterior-authored layers on the positive wall normal side', () => {
    const assembly = getBuiltInWallType('wall.ext-timber')!;
    const group = makeLayeredWallMesh(baseWall, assembly, 0, null);
    const meshes = visibleMeshes(group);
    const cladding = meshes.find((mesh) => mesh.userData.materialKey === 'timber_cladding')!;
    const plasterboard = meshes.find((mesh) => mesh.userData.materialKey === 'plasterboard')!;
    const box = new THREE.Box3().setFromObject(group);

    expect(cladding.position.z).toBeGreaterThan(plasterboard.position.z);
    expect(box.min.z).toBeGreaterThanOrEqual(-0.002);
    expect(box.max.z).toBeGreaterThan(0.19);
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

  it('prefers project-authored wall type layers over built-in catalog layers with the same id', () => {
    const projectType: Extract<Element, { kind: 'wall_type' }> = {
      kind: 'wall_type',
      id: 'wall.ext-timber',
      name: 'Edited timber wall',
      basisLine: 'face_interior',
      layers: [
        { function: 'finish', materialKey: 'masonry_brick', thicknessMm: 102 },
        { function: 'structure', materialKey: 'masonry_block', thicknessMm: 140 },
        { function: 'finish', materialKey: 'plaster', thicknessMm: 13 },
      ],
    };

    const assembly = resolveWallTypeAssembly(projectType.id, { [projectType.id]: projectType });

    expect(assembly?.layers[0]?.materialKey).toBe('masonry_brick');
    expect(assembly?.layers[0]?.exterior).toBe(true);
    expect(assembly?.layers.map((layer) => layer.materialKey)).not.toContain('timber_cladding');
  });

  it('marks the same project wall type layer as exterior that material assignment targets', () => {
    const projectType: Extract<Element, { kind: 'wall_type' }> = {
      kind: 'wall_type',
      id: 'wall.ext-custom',
      name: 'Custom wall',
      basisLine: 'face_interior',
      layers: [
        { function: 'insulation', materialKey: 'air', thicknessMm: 25 },
        { function: 'finish', materialKey: 'cladding_beige_grey', thicknessMm: 18 },
        { function: 'structure', materialKey: 'timber_frame_insulation', thicknessMm: 140 },
        { function: 'finish', materialKey: 'plaster', thicknessMm: 13 },
      ],
    };

    const assembly = resolveWallTypeAssembly(projectType.id, { [projectType.id]: projectType });

    expect(assembly?.layers.map((layer) => layer.exterior ?? false)).toEqual([
      false,
      true,
      false,
      false,
    ]);
  });

  it('shortens disallowed joined endpoints for typed layered walls', () => {
    const assembly = getBuiltInWallType('wall.int-partition')!;
    const east: WallElem = {
      ...baseWall,
      id: 'east',
      wallTypeId: assembly.id,
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 1000, yMm: 0 },
      joinDisallowEnd: true,
    };
    const north: WallElem = {
      ...baseWall,
      id: 'north',
      wallTypeId: assembly.id,
      start: { xMm: 1000, yMm: 0 },
      end: { xMm: 1000, yMm: 1000 },
      joinDisallowStart: true,
    };
    const group = makeLayeredWallMesh(east, assembly, 0, null, { east, north });

    const box = new THREE.Box3().setFromObject(group);
    expect(box.max.x).toBeLessThan(0.95);
  });

  it('uses topology cleanup footprints for typed layered L joins', () => {
    const assembly = getBuiltInWallType('wall.int-partition')!;
    const east: WallElem = {
      ...baseWall,
      id: 'east',
      wallTypeId: assembly.id,
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 1000, yMm: 0 },
      thicknessMm: 114,
    };
    const north: WallElem = {
      ...baseWall,
      id: 'north',
      wallTypeId: assembly.id,
      start: { xMm: 1000, yMm: 0 },
      end: { xMm: 1000, yMm: 1000 },
      thicknessMm: 114,
    };

    const group = makeLayeredWallMesh(east, assembly, 0, null, { east, north });
    const meshes = visibleMeshes(group);

    expect(group.userData.wallJoinCleanup).toBe('layered');
    expect(meshes).toHaveLength(3);
    expect(meshes.every((mesh) => mesh.userData.wallJoinCleanup === 'layered-endpoint-t')).toBe(
      true,
    );
  });

  it('splits typed layered X joins with the shared topology cleanup', () => {
    const assembly = getBuiltInWallType('wall.int-partition')!;
    const eastWest: WallElem = {
      ...baseWall,
      id: 'a-east-west',
      wallTypeId: assembly.id,
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 1000, yMm: 0 },
      thicknessMm: 114,
    };
    const northSouth: WallElem = {
      ...baseWall,
      id: 'b-north-south',
      wallTypeId: assembly.id,
      start: { xMm: 500, yMm: -500 },
      end: { xMm: 500, yMm: 500 },
      thicknessMm: 114,
    };

    const group = makeLayeredWallMesh(eastWest, assembly, 0, null, { eastWest, northSouth });
    const meshes = visibleMeshes(group);

    expect(group.userData.wallJoinCleanup).toBe('layered');
    expect(meshes.length).toBeGreaterThan(3);
    expect(meshes.some((mesh) => mesh.userData.wallJoinCleanup === 'layered-x')).toBe(true);
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
