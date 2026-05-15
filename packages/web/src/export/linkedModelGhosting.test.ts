import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  applyLinkedGhosting,
  LINKED_GHOST_OPACITY,
  LINKED_GHOST_TINT,
} from '../viewport/linkedGhosting';

describe('applyLinkedGhosting', () => {
  it('sets opacity to LINKED_GHOST_OPACITY on mesh materials', () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: '#ff0000' }),
    );
    applyLinkedGhosting(mesh);
    const mat = mesh.material as THREE.MeshStandardMaterial;
    expect(mat.opacity).toBe(LINKED_GHOST_OPACITY);
    expect(mat.transparent).toBe(true);
  });

  it('marks the object with userData.linked', () => {
    const obj = new THREE.Object3D();
    applyLinkedGhosting(obj);
    expect(obj.userData.linked).toBe(true);
  });

  it('is idempotent — applying twice does not double-ghost', () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: '#0000ff' }),
    );
    applyLinkedGhosting(mesh);
    const mat1 = mesh.material as THREE.MeshStandardMaterial;
    const opacity1 = mat1.opacity;
    applyLinkedGhosting(mesh);
    const mat2 = mesh.material as THREE.MeshStandardMaterial;
    expect(mat2.opacity).toBe(opacity1); // unchanged
  });

  it('clones the material rather than mutating the original', () => {
    const original = new THREE.MeshStandardMaterial({ color: '#ffffff' });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), original);
    applyLinkedGhosting(mesh);
    // Ghost material is a new instance; source material stays opaque
    expect(mesh.material).not.toBe(original);
    expect(original.transparent).toBe(false);
    expect(original.opacity).toBe(1);
  });

  it('applies a blue tint — LINKED_GHOST_TINT is the expected color', () => {
    const tint = new THREE.Color(LINKED_GHOST_TINT);
    // Tint should have a blue-dominant channel (b > r)
    expect(tint.b).toBeGreaterThan(tint.r);
  });

  it('handles array materials on a single mesh', () => {
    const mat1 = new THREE.MeshStandardMaterial({ color: '#ff0000' });
    const mat2 = new THREE.MeshStandardMaterial({ color: '#00ff00' });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [mat1, mat2]);
    applyLinkedGhosting(mesh);
    const arr = mesh.material as THREE.MeshStandardMaterial[];
    expect(arr).toHaveLength(2);
    arr.forEach((m) => {
      expect(m.transparent).toBe(true);
      expect(m.opacity).toBeCloseTo(LINKED_GHOST_OPACITY);
    });
  });
});
