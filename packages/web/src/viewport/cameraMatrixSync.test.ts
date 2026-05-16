import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

import { applySceneCameraPose, mirrorSceneCameraPose } from './cameraMatrixSync';

describe('cameraMatrixSync', () => {
  it('applies an orbit pose and forces the camera matrix current for raycasts', () => {
    const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 500);
    const updateSpy = vi.spyOn(camera, 'updateMatrixWorld');

    applySceneCameraPose(camera, {
      position: { x: 12, y: 8, z: -5 },
      target: { x: 2, y: 1, z: 3 },
      up: { x: 0, y: 1, z: 0 },
    });

    expect(camera.position.toArray()).toEqual([12, 8, -5]);
    expect(camera.up.toArray()).toEqual([0, 1, 0]);
    expect(updateSpy).toHaveBeenCalledWith(true);
    expect(camera.matrixWorldNeedsUpdate).toBe(false);
  });

  it('mirrors a perspective camera into the orthographic camera and updates that matrix too', () => {
    const perspective = new THREE.PerspectiveCamera(55, 1, 0.05, 500);
    const orthographic = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 500);
    const updateSpy = vi.spyOn(orthographic, 'updateMatrixWorld');

    applySceneCameraPose(perspective, {
      position: { x: -4, y: 9, z: 11 },
      target: { x: 1, y: 2, z: 3 },
      up: { x: 0, y: 1, z: 0 },
    });
    mirrorSceneCameraPose(perspective, orthographic, { x: 1, y: 2, z: 3 });

    expect(orthographic.position.toArray()).toEqual(perspective.position.toArray());
    expect(orthographic.up.toArray()).toEqual(perspective.up.toArray());
    expect(updateSpy).toHaveBeenCalledWith(true);
    expect(orthographic.matrixWorldNeedsUpdate).toBe(false);
  });

  it('WP-NEXT-41 — screen-to-model is stable across successive ViewCube-like rotations', () => {
    // Simulate a user clicking three different ViewCube faces in sequence.
    // Each rotation must leave the camera matrix fully updated (matrixWorldNeedsUpdate===false)
    // so the next authoring raycast reads a consistent world matrix.
    const camera = new THREE.PerspectiveCamera(55, 1.6, 0.05, 500);
    const poses = [
      // Front face
      { position: { x: 0, y: 0, z: 15 }, target: { x: 0, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 } },
      // Right face
      { position: { x: 15, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 } },
      // Top face (plan-like)
      { position: { x: 0, y: 15, z: 0 }, target: { x: 0, y: 0, z: 0 }, up: { x: 0, y: 0, z: -1 } },
    ];

    for (const pose of poses) {
      applySceneCameraPose(camera, pose);
      // After each pose update the matrix must be current — not stale.
      expect(camera.matrixWorldNeedsUpdate).toBe(false);
      // Position must match what was set.
      expect(camera.position.x).toBeCloseTo(pose.position.x, 5);
      expect(camera.position.y).toBeCloseTo(pose.position.y, 5);
      expect(camera.position.z).toBeCloseTo(pose.position.z, 5);
    }
  });

  it('WP-NEXT-41 — per-pane mirror sync keeps orthographic matrix current independently of perspective updates', () => {
    // Each pane can have its own camera pair. Updating pane-A must not
    // leave pane-B's orthographic camera stale.
    const perspA = new THREE.PerspectiveCamera(55, 1, 0.05, 500);
    const orthoA = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 500);
    const perspB = new THREE.PerspectiveCamera(55, 1, 0.05, 500);
    const orthoB = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 500);

    const target = { x: 0, y: 0, z: 0 };

    applySceneCameraPose(perspA, {
      position: { x: 0, y: 10, z: 0 },
      target,
      up: { x: 0, y: 0, z: -1 },
    });
    mirrorSceneCameraPose(perspA, orthoA, target);

    applySceneCameraPose(perspB, {
      position: { x: 10, y: 0, z: 0 },
      target,
      up: { x: 0, y: 1, z: 0 },
    });
    mirrorSceneCameraPose(perspB, orthoB, target);

    // Both ortho cameras must be up-to-date independently.
    expect(orthoA.matrixWorldNeedsUpdate).toBe(false);
    expect(orthoB.matrixWorldNeedsUpdate).toBe(false);
    // Positions must differ — pane-A is looking down, pane-B is looking sideways.
    expect(orthoA.position.y).toBeGreaterThan(orthoB.position.y);
    expect(orthoB.position.x).toBeGreaterThan(orthoA.position.x);
  });
});
