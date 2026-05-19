import * as THREE from 'three';

export const SLICE_Y = 0.02;

// B03 - spec 1:5-1:5000 plan scale bounds: half = plotScale * 500mm / 1000.
export const HALF_MIN = 2.5;
export const HALF_MAX = 2500;

export function orthoExtents(halfWorldM: number): { stepMm: number; snapMm: number } {
  const stepMm = halfWorldM < 5 ? 250 : halfWorldM < 12 ? 500 : halfWorldM < 24 ? 1000 : 2000;
  const snapMm = Math.max(stepMm * 3, 300);
  return { stepMm, snapMm };
}

export function rayToPlanMm(
  renderer: THREE.WebGLRenderer,
  camera: THREE.Camera,
  clientX: number,
  clientY: number,
): { xMm: number; yMm: number } | null {
  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -(((clientY - rect.top) / rect.height) * 2 - 1),
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -SLICE_Y);
  const pt = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, pt)) return null;
  return { xMm: pt.x * 1000, yMm: pt.z * 1000 };
}
