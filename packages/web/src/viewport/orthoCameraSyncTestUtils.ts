/**
 * Issue #59 — test helpers for the orthographic camera sync regression.
 *
 * Kept in a sibling file (not the ``.test.ts``) so the unit test can import
 * the same ``applyViewpointMm`` math the runtime uses, without duplicating
 * the mm-to-three.js conversion. Re-exports ``syncSsaoCameraDefines`` from
 * ``useViewportSceneEffects`` so the test pins the public contract rather
 * than reaching into a hook closure.
 */
import { createCameraRig, type CameraRig } from './cameraRig';

export { syncSsaoCameraDefines } from './useViewportSceneEffects';

export interface ApplyViewpointMmInput {
  buildingCenterMm: { xMm: number; yMm: number; zMm: number };
  radiusMm: number;
  offsetUnit: { x: number; y: number; z: number };
}

export interface ApplyViewpointMmResult {
  rig: CameraRig;
  threeJsCameraPosition: { x: number; y: number; z: number };
  threeJsTarget: { x: number; y: number; z: number };
}

/**
 * Mirror the cardinal-direction viewpoint authoring math from
 * ``scripts/archive/testhouse_iter14_author_ortho_viewpoints.py`` +
 * Viewport.tsx's ``orbitRigApi.applyViewpointMm`` (mm-to-three.js axis swap:
 * ``zMm → THREE.Y``, ``yMm → THREE.Z``). Returns the rig so callers can
 * snapshot the resulting state and compute the ortho frustum.
 *
 * Used by ``orthoCameraSync.test.ts`` to assert all 4 cardinal captures
 * produce a symmetric forward vector + matching ortho frustum.
 */
export function applyViewpointMmToCardinalRig(
  input: ApplyViewpointMmInput,
): ApplyViewpointMmResult {
  const { buildingCenterMm, radiusMm, offsetUnit } = input;
  const norm = Math.hypot(offsetUnit.x, offsetUnit.y, offsetUnit.z) || 1;
  const positionMm = {
    xMm: buildingCenterMm.xMm + (radiusMm * offsetUnit.x) / norm,
    yMm: buildingCenterMm.yMm + (radiusMm * offsetUnit.y) / norm,
    zMm: buildingCenterMm.zMm + (radiusMm * offsetUnit.z) / norm,
  };
  // Match Viewport.tsx defaults so the test exercises the same rig the
  // viewer uses (radius=16, target=(0,1.35,0), azimuth=π/4, elevation=0.45)
  // before applyViewpoint is called.
  const rig = createCameraRig({
    target: { x: 0, y: 1.35, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    azimuth: Math.PI / 4,
    elevation: 0.45,
    radius: 16,
    minRadius: 4,
    maxRadius: 80,
  });
  // Same axis swap Viewport.tsx applies in orbitRigApi.applyViewpointMm.
  const threeJsCameraPosition = {
    x: positionMm.xMm / 1000,
    y: positionMm.zMm / 1000,
    z: positionMm.yMm / 1000,
  };
  const threeJsTarget = {
    x: buildingCenterMm.xMm / 1000,
    y: buildingCenterMm.zMm / 1000,
    z: buildingCenterMm.yMm / 1000,
  };
  // Saved viewpoint has up = (0, 0, 1) in mm (z-up); converts to (0, 1, 0)
  // in three.js. Normalised by the rig so the magnitude doesn't matter.
  const threeJsUp = { x: 0, y: 1, z: 0 };
  rig.applyViewpoint(threeJsCameraPosition, threeJsTarget, threeJsUp);
  return { rig, threeJsCameraPosition, threeJsTarget };
}
