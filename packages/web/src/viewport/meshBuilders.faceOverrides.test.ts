import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import {
  makeWallMesh,
  resolveFaceMaterialOverride,
  wallFaceKindForMaterialIndex,
} from './meshBuilders';

type WallElem = Extract<Element, { kind: 'wall' }>;

const baseWall: WallElem = {
  kind: 'wall',
  id: 'w-face',
  name: 'Painted wall',
  levelId: 'lvl0',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 4000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 2800,
  materialKey: 'masonry_block',
};

describe('wall face material overrides — MAT-09', () => {
  it('maps BoxGeometry material slots to stable wall face kinds', () => {
    expect(wallFaceKindForMaterialIndex(4)).toBe('exterior');
    expect(wallFaceKindForMaterialIndex(5)).toBe('interior');
    expect(wallFaceKindForMaterialIndex(2)).toBe('top');
    expect(wallFaceKindForMaterialIndex(undefined)).toBeNull();
  });

  it('resolves the latest override for a stable face address', () => {
    const override = resolveFaceMaterialOverride(
      [
        { faceKind: 'exterior', materialKey: 'brick_old', source: 'paint' },
        { faceKind: 'interior', materialKey: 'plaster', source: 'finish' },
        { faceKind: 'exterior', materialKey: 'brick_new', source: 'paint' },
      ],
      'exterior',
    );

    expect(override?.materialKey).toBe('brick_new');
  });

  it('renders a face-specific material without changing the base wall material', () => {
    const wall: WallElem = {
      ...baseWall,
      faceMaterialOverrides: [
        { faceKind: 'exterior', materialKey: 'masonry_brick', source: 'paint' },
      ],
    };
    const mesh = makeWallMesh(wall, 0, null) as THREE.Mesh;
    const materials = mesh.material as THREE.Material[];

    expect(Array.isArray(materials)).toBe(true);
    expect(materials[4]?.userData.materialKey).toBe('masonry_brick');
    expect(materials[5]?.userData.materialKey).toBe('masonry_block');
    expect(mesh.userData.faceMaterialOverrides).toEqual(wall.faceMaterialOverrides);
    expect(mesh.userData.wallFaceMaterialSlots.exterior).toBe(4);
  });

  it('returns to a single base material when overrides are cleared', () => {
    const mesh = makeWallMesh({ ...baseWall, faceMaterialOverrides: null }, 0, null) as THREE.Mesh;
    expect(Array.isArray(mesh.material)).toBe(false);
    expect((mesh.material as THREE.Material).userData.materialKey).toBe('masonry_block');
  });
});
