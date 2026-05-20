import { useCallback } from 'react';
import type * as THREE from 'three';
import type { Saved3dViewElement } from '@bim-ai/core';

import { useBimStore } from '../state/store';
import type { CameraRig } from './cameraRig';
import { applySceneCameraPose, mirrorSceneCameraPose } from './cameraMatrixSync';
import type { ViewCubePick } from './viewCubeAlignment';

type MutableRef<T> = {
  current: T;
};

type CameraRigSnapshot = ReturnType<CameraRig['snapshot']>;

export function useViewportViewCubeHandlers({
  cameraRigRef,
  cameraRef,
  orthoCameraRef,
  syncCameraOrientationState,
}: {
  cameraRigRef: MutableRef<CameraRig | null>;
  cameraRef: MutableRef<THREE.PerspectiveCamera | null>;
  orthoCameraRef: MutableRef<THREE.OrthographicCamera | null>;
  syncCameraOrientationState: (
    snapshot: CameraRigSnapshot,
    orientationSync: 'defer' | 'immediate',
  ) => void;
}) {
  const handleViewCubePick = useCallback(
    (
      _pick: ViewCubePick,
      alignment: { azimuth: number; elevation: number; up: { x: number; y: number; z: number } },
    ): void => {
      const rig = cameraRigRef.current;
      if (!rig) return;
      const snap = rig.snapshot();
      rig.applyViewpoint(
        {
          x:
            snap.target.x +
            snap.radius * Math.cos(alignment.elevation) * Math.sin(alignment.azimuth),
          y: snap.target.y + snap.radius * Math.sin(alignment.elevation),
          z:
            snap.target.z +
            snap.radius * Math.cos(alignment.elevation) * Math.cos(alignment.azimuth),
        },
        snap.target,
        alignment.up,
      );
      const camera = cameraRef.current;
      if (camera) {
        const next = rig.snapshot();
        applySceneCameraPose(camera, next);
        const orthoCamera = orthoCameraRef.current;
        if (orthoCamera) {
          mirrorSceneCameraPose(camera, orthoCamera, next.target);
        }
        syncCameraOrientationState(next, 'immediate');
      }
    },
    [cameraRef, cameraRigRef, orthoCameraRef, syncCameraOrientationState],
  );

  const handleViewCubeDrag = useCallback(
    (dxPx: number, dyPx: number): void => {
      const rig = cameraRigRef.current;
      const camera = cameraRef.current;
      if (!rig || !camera) return;
      rig.orbit(dxPx, dyPx);
      const snap = rig.snapshot();
      applySceneCameraPose(camera, snap);
      const orthoCamera = orthoCameraRef.current;
      if (orthoCamera) {
        mirrorSceneCameraPose(camera, orthoCamera, snap.target);
      }
      syncCameraOrientationState(snap, 'immediate');
    },
    [cameraRef, cameraRigRef, orthoCameraRef, syncCameraOrientationState],
  );

  const handleOrientSaved = useCallback((view: Saved3dViewElement): void => {
    useBimStore.getState().setOrbitCameraFromViewpointMm({
      position: { xMm: view.cameraMm.x, yMm: view.cameraMm.y, zMm: view.cameraMm.z },
      target: { xMm: view.targetMm.x, yMm: view.targetMm.y, zMm: view.targetMm.z },
      up: view.upVector
        ? { xMm: view.upVector.x, yMm: view.upVector.y, zMm: view.upVector.z }
        : { xMm: 0, yMm: 1, zMm: 0 },
    });
  }, []);

  return {
    handleViewCubePick,
    handleViewCubeDrag,
    handleOrientSaved,
  };
}
