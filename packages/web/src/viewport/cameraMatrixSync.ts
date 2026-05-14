import * as THREE from 'three';

export interface SceneCameraPose {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  up: { x: number; y: number; z: number };
}

export function applySceneCameraPose(camera: THREE.Camera, pose: SceneCameraPose): void {
  camera.position.set(pose.position.x, pose.position.y, pose.position.z);
  camera.up.set(pose.up.x, pose.up.y, pose.up.z).normalize();
  camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
  camera.updateMatrixWorld(true);
}

export function mirrorSceneCameraPose(
  source: THREE.Camera,
  target: THREE.Camera,
  lookAtTarget: SceneCameraPose['target'],
): void {
  target.position.copy(source.position);
  target.up.copy(source.up).normalize();
  target.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z);
  target.updateMatrixWorld(true);
}
