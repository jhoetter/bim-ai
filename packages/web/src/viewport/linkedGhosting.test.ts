import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

import { applyLinkedGhosting, LINKED_GHOST_OPACITY, LINKED_GHOST_TINT } from './linkedGhosting';

describe('applyLinkedGhosting (FED-01)', () => {
  it('marks the object and clones each material with reduced opacity', () => {
    const original = new THREE.MeshStandardMaterial({ color: '#ffffff' });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), original);

    applyLinkedGhosting(mesh);

    expect(mesh.userData.linkedGhost).toBe(true);
    expect(mesh.userData.linked).toBe(true);
    // Material was cloned (not mutated in place) so the cached source
    // material keeps its full opacity.
    expect(mesh.material).not.toBe(original);
    const ghosted = mesh.material as THREE.MeshStandardMaterial;
    expect(ghosted.transparent).toBe(true);
    expect(ghosted.opacity).toBeCloseTo(LINKED_GHOST_OPACITY);
    expect(original.transparent).toBe(false);
  });

  it('lerps the cloned material color toward the linked tint', () => {
    const original = new THREE.MeshStandardMaterial({ color: '#ffffff' });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), original);

    applyLinkedGhosting(mesh);

    const ghosted = mesh.material as THREE.MeshStandardMaterial;
    const tint = new THREE.Color(LINKED_GHOST_TINT);
    // White (1,1,1) lerped 40% toward tint shifts every channel toward tint.
    expect(ghosted.color.r).toBeLessThan(1);
    expect(ghosted.color.g).toBeLessThan(1);
    // Blue tint should keep blue dominant or close to it after the shift.
    expect(ghosted.color.b).toBeGreaterThan(tint.b * 0.9);
  });

  it('is idempotent — second apply does not re-clone', () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: '#888' }),
    );
    applyLinkedGhosting(mesh);
    const firstClone = mesh.material;
    applyLinkedGhosting(mesh);
    expect(mesh.material).toBe(firstClone);
  });

  it('handles array materials and groups recursively', () => {
    const mat1 = new THREE.MeshStandardMaterial({ color: '#ff0000' });
    const mat2 = new THREE.MeshStandardMaterial({ color: '#00ff00' });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [mat1, mat2]);
    const group = new THREE.Group();
    group.add(mesh);

    applyLinkedGhosting(group);

    const arr = mesh.material as THREE.MeshStandardMaterial[];
    expect(arr).toHaveLength(2);
    arr.forEach((m) => {
      expect(m.transparent).toBe(true);
      expect(m.opacity).toBeCloseTo(LINKED_GHOST_OPACITY);
    });
  });
});
