import { useCallback, useEffect, useRef, useState } from 'react';

import type { CameraRig } from './cameraRig';

const ORBIT_ORIENTATION_UI_SYNC_DELAY_MS = 120;
const ORBIT_ORIENTATION_EPSILON = 1e-4;

type CameraOrientationSnapshot = Pick<ReturnType<CameraRig['snapshot']>, 'azimuth' | 'elevation'>;

export function useViewportCameraOrientation() {
  const [currentAzimuth, setCurrentAzimuth] = useState(Math.PI / 4);
  const [currentElevation, setCurrentElevation] = useState(0.45);
  const currentOrientationRef = useRef({ azimuth: Math.PI / 4, elevation: 0.45 });
  const pendingOrientationSyncRef = useRef<number | null>(null);

  const commitCameraOrientationState = useCallback((azimuth: number, elevation: number): void => {
    setCurrentAzimuth((prev) =>
      Math.abs(prev - azimuth) > ORBIT_ORIENTATION_EPSILON ? azimuth : prev,
    );
    setCurrentElevation((prev) =>
      Math.abs(prev - elevation) > ORBIT_ORIENTATION_EPSILON ? elevation : prev,
    );
  }, []);

  const syncCameraOrientationState = useCallback(
    (snap: CameraOrientationSnapshot, mode: 'defer' | 'immediate' = 'defer'): void => {
      currentOrientationRef.current = {
        azimuth: snap.azimuth,
        elevation: snap.elevation,
      };
      if (mode === 'immediate') {
        if (pendingOrientationSyncRef.current !== null) {
          window.clearTimeout(pendingOrientationSyncRef.current);
          pendingOrientationSyncRef.current = null;
        }
        commitCameraOrientationState(snap.azimuth, snap.elevation);
        return;
      }
      if (pendingOrientationSyncRef.current !== null) return;
      pendingOrientationSyncRef.current = window.setTimeout(() => {
        pendingOrientationSyncRef.current = null;
        const orientation = currentOrientationRef.current;
        commitCameraOrientationState(orientation.azimuth, orientation.elevation);
      }, ORBIT_ORIENTATION_UI_SYNC_DELAY_MS);
    },
    [commitCameraOrientationState],
  );

  useEffect(() => {
    return () => {
      if (pendingOrientationSyncRef.current !== null) {
        window.clearTimeout(pendingOrientationSyncRef.current);
        pendingOrientationSyncRef.current = null;
      }
    };
  }, []);

  return {
    currentAzimuth,
    currentElevation,
    syncCameraOrientationState,
  };
}
