import * as THREE from 'three';

export interface HostedPlacementDedupeState {
  key: string;
  atMs: number;
}

const LINKED_ID_SEPARATOR = '::';

export function isLinkedElementId(id: string): boolean {
  return id.includes(LINKED_ID_SEPARATOR);
}

export function isBackfacingWallHit(
  faceNormalObjectSpace: THREE.Vector3 | null | undefined,
  objectWorldMatrix: THREE.Matrix4,
  rayDirectionWorld: THREE.Vector3,
): boolean {
  if (!faceNormalObjectSpace) return false;
  const worldNormal = faceNormalObjectSpace.clone().transformDirection(objectWorldMatrix);
  // A wall face is front-facing for placement when its outward normal points
  // against the pick ray (dot < 0). Dot >= 0 means the cursor hit the backface.
  return worldNormal.dot(rayDirectionWorld) >= 0;
}

export function isDuplicateHostedPlacement(
  prev: HostedPlacementDedupeState | null,
  next: HostedPlacementDedupeState,
  windowMs = 420,
): boolean {
  if (!prev) return false;
  return prev.key === next.key && next.atMs - prev.atMs <= windowMs;
}
