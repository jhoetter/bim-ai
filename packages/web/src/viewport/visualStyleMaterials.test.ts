import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { applyTextureVisibilityToMesh } from './visualStyleMaterials';

describe('visual style material map visibility', () => {
  it('removes texture maps for shaded mode and restores them for realistic mode', () => {
    const map = new THREE.Texture();
    const bumpMap = new THREE.Texture();
    const material = new THREE.MeshStandardMaterial({ map, bumpMap });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);

    applyTextureVisibilityToMesh(mesh, false);
    expect(material.map).toBeNull();
    expect(material.bumpMap).toBeNull();

    applyTextureVisibilityToMesh(mesh, true);
    expect(material.map).toBe(map);
    expect(material.bumpMap).toBe(bumpMap);
  });

  it('handles per-face material arrays', () => {
    const map = new THREE.Texture();
    const materials = [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial({ map })];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials);

    applyTextureVisibilityToMesh(mesh, false);
    expect(materials[1].map).toBeNull();

    applyTextureVisibilityToMesh(mesh, true);
    expect(materials[1].map).toBe(map);
  });
});
