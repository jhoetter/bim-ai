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
});
