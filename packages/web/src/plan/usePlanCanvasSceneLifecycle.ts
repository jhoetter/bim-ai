import { useEffect } from 'react';
import * as THREE from 'three';

import { rayToPlanMm } from './interaction/planCameraMath';
import { readPlanToken } from './planCanvasHelpers';
import type { MmToScreen, PointerToMm } from './SketchCanvas';

type MutableRef<T> = {
  current: T;
};

type Props = {
  mountRef: MutableRef<HTMLDivElement | null>;
  rendererRef: MutableRef<THREE.WebGLRenderer | null>;
  sceneRef: MutableRef<THREE.Scene | null>;
  rootRef: MutableRef<THREE.Group | null>;
  cameraRef: MutableRef<THREE.OrthographicCamera | null>;
  sketchPointerToMmRef: MutableRef<PointerToMm | null>;
  sketchMmToScreenRef: MutableRef<MmToScreen | null>;
  resizeCam: () => void;
  theme: unknown;
};

export function usePlanCanvasSceneLifecycle({
  mountRef,
  rendererRef,
  sceneRef,
  rootRef,
  cameraRef,
  sketchPointerToMmRef,
  sketchMmToScreenRef,
  resizeCam,
  theme,
}: Props) {
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 2));
    renderer.setClearColor(readPlanToken('--draft-paper', '#0b1220'), 1);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 0.76));
    const grp = new THREE.Group();
    rootRef.current = grp;
    scene.add(grp);
    const oc = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.03, 5000);
    oc.up.set(0, 1, 0);
    cameraRef.current = oc;
    sketchPointerToMmRef.current = (cx, cy) => rayToPlanMm(renderer, oc, cx, cy);
    sketchMmToScreenRef.current = (pt) => {
      const v = new THREE.Vector3(pt.xMm / 1000, 0, pt.yMm / 1000);
      v.project(oc);
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: (v.x * 0.5 + 0.5) * rect.width,
        y: (-v.y * 0.5 + 0.5) * rect.height,
      };
    };
    const ro = new ResizeObserver(() => resizeCam());
    ro.observe(mount);
    resizeCam();
    let raf = 0;
    const tick = () => {
      renderer.render(scene, oc);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      sketchPointerToMmRef.current = null;
      sketchMmToScreenRef.current = null;
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [
    cameraRef,
    mountRef,
    rendererRef,
    resizeCam,
    rootRef,
    sceneRef,
    sketchMmToScreenRef,
    sketchPointerToMmRef,
    theme,
  ]);
}
