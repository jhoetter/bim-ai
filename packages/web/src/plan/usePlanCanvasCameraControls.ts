import { useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';

import { HALF_MAX, HALF_MIN, SLICE_Y } from './interaction/planCameraMath';

type MutableRef<T> = {
  current: T;
};

type CameraState = {
  camX: number;
  camZ: number;
  half: number;
};

type CameraHandle = {
  getSnapshot(): { centerMm: { xMm: number; yMm: number }; halfMm: number };
  applySnapshot(snap: { centerMm?: { xMm?: number; yMm?: number }; halfMm?: number }): void;
};

type Props = {
  mountRef: MutableRef<HTMLDivElement | null>;
  rendererRef: MutableRef<THREE.WebGLRenderer | null>;
  cameraRef: MutableRef<THREE.OrthographicCamera | null>;
  rootRef: MutableRef<THREE.Group | null>;
  camRef: MutableRef<CameraState>;
  cameraHandleRef?: MutableRef<CameraHandle | null>;
};

export function usePlanCanvasCameraControls({
  mountRef,
  rendererRef,
  cameraRef,
  rootRef,
  camRef,
  cameraHandleRef,
}: Props) {
  const [halfUi, setHalfUi] = useState(22);

  const resizeCam = useCallback(() => {
    const host = mountRef.current;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!host || !renderer || !camera) return;
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h);
    const asp = w / h;
    const hh = camRef.current.half;
    camera.left = -hh * asp;
    camera.right = hh * asp;
    camera.top = hh;
    camera.bottom = -hh;
    camera.position.set(camRef.current.camX, 320, camRef.current.camZ);
    camera.lookAt(camRef.current.camX, 0, camRef.current.camZ);
    camera.updateProjectionMatrix();
    setHalfUi(camRef.current.half);
  }, [camRef, cameraRef, mountRef, rendererRef]);

  useEffect(() => {
    if (!cameraHandleRef) return;
    cameraHandleRef.current = {
      getSnapshot: () => ({
        centerMm: { xMm: camRef.current.camX * 1000, yMm: camRef.current.camZ * 1000 },
        halfMm: camRef.current.half * 1000,
      }),
      applySnapshot: (snap) => {
        if (snap.centerMm) {
          camRef.current.camX = (snap.centerMm.xMm ?? camRef.current.camX * 1000) / 1000;
          camRef.current.camZ = (snap.centerMm.yMm ?? camRef.current.camZ * 1000) / 1000;
        }
        if (snap.halfMm !== undefined) {
          camRef.current.half = snap.halfMm / 1000;
        }
        resizeCam();
      },
    };
    return () => {
      cameraHandleRef.current = null;
    };
  }, [camRef, cameraHandleRef, resizeCam]);

  const handleFitToView = useCallback(() => {
    const grp = rootRef.current;
    const rnd = rendererRef.current;
    if (!grp || !rnd) return;
    const box = new THREE.Box3().setFromObject(grp);
    if (!Number.isFinite(box.min.x)) return;
    const cx = (box.min.x + box.max.x) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    const halfX = (box.max.x - box.min.x) / 2;
    const halfZ = (box.max.z - box.min.z) / 2;
    const asp = rnd.domElement.clientWidth / Math.max(1, rnd.domElement.clientHeight);
    const half = Math.max(halfX / asp, halfZ) * 1.15;
    camRef.current.camX = cx;
    camRef.current.camZ = cz;
    camRef.current.half = THREE.MathUtils.clamp(half, HALF_MIN, HALF_MAX);
    resizeCam();
  }, [camRef, rendererRef, resizeCam, rootRef]);

  const worldToScreen = useCallback(
    (xy: { xMm: number; yMm: number }) => {
      const cam = cameraRef.current;
      const renderer = rendererRef.current;
      if (!cam || !renderer) return { pxX: 0, pxY: 0 };
      const v = new THREE.Vector3(xy.xMm / 1000, SLICE_Y, xy.yMm / 1000);
      v.project(cam);
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        pxX: ((v.x + 1) / 2) * rect.width,
        pxY: ((1 - v.y) / 2) * rect.height,
      };
    },
    [cameraRef, rendererRef],
  );

  return { halfUi, resizeCam, handleFitToView, worldToScreen };
}
