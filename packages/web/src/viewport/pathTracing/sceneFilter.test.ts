import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { buildPathTraceScene } from './sceneFilter';

describe('path trace scene filter', () => {
  it('includes BIM model meshes and excludes untagged helpers', () => {
    const source = new THREE.Scene();
    const root = new THREE.Group();
    source.add(root);

    const modelMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 'white' }),
    );
    modelMesh.userData.bimPickId = 'wall-1';
    modelMesh.userData.renderRole = 'model';
    root.add(modelMesh);

    const helperMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 'red' }),
    );
    root.add(helperMesh);

    const result = buildPathTraceScene(source, root);

    expect(result.meshCount).toBe(1);
    expect(result.triangleCount).toBe(12);
    expect(result.scene.children.filter((child) => child instanceof THREE.Mesh)).toHaveLength(1);
  });

  it('can include explicitly tagged cut surface meshes', () => {
    const source = new THREE.Scene();
    const root = new THREE.Group();
    source.add(root);
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
    cap.userData.renderRole = 'materializedCutSurface';
    root.add(cap);

    const result = buildPathTraceScene(source, root);

    expect(result.meshCount).toBe(1);
    const tracedMesh = result.scene.children.find((child) => child instanceof THREE.Mesh);
    expect((tracedMesh as THREE.Mesh).material).toBeInstanceOf(THREE.MeshStandardMaterial);
  });
});
