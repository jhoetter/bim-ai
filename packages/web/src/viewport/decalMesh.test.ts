import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildDecalMesh } from './meshBuilders';
import type { Element } from '@bim-ai/core';

type DecalElem = Extract<Element, { kind: 'decal' }>;

function makeParentMesh(): THREE.Mesh {
  // 2m × 3m × 0.2m box centred at origin
  const geo = new THREE.BoxGeometry(2, 3, 0.2);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
}

function makeDecal(overrides: Partial<DecalElem> = {}): DecalElem {
  return {
    kind: 'decal',
    id: 'decal-test',
    parentElementId: 'wall-1',
    parentSurface: 'front',
    imageAssetId: '',
    uvRect: { u0: 0.25, v0: 0.25, u1: 0.75, v1: 0.75 },
    ...overrides,
  };
}

describe('buildDecalMesh — §8.1.5', () => {
  it('renders magenta fallback when no imageSrc or imageAssetsById entry', () => {
    const decal = makeDecal({ imageSrc: null });
    const mesh = buildDecalMesh(decal, makeParentMesh(), {});
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    const mat = mesh.material as THREE.MeshBasicMaterial;
    expect(mat).toBeInstanceOf(THREE.MeshBasicMaterial);
    // Magenta = 0xff00ff
    expect(mat.color.getHex()).toBe(0xff00ff);
  });

  it('uses imageSrc when provided (loads texture via TextureLoader)', () => {
    const decal = makeDecal({ imageSrc: 'data:image/png;base64,abc' });
    const mesh = buildDecalMesh(decal, makeParentMesh(), {});
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    const mat = mesh.material as THREE.MeshBasicMaterial;
    // When a texture URL is provided, the material has a map set (not magenta)
    expect(mat.color.getHex()).not.toBe(0xff00ff);
  });

  it('mesh has bimPickId userData', () => {
    const decal = makeDecal({ id: 'my-decal-id' });
    const mesh = buildDecalMesh(decal, makeParentMesh(), {});
    expect(mesh.userData.bimPickId).toBe('my-decal-id');
  });
});
