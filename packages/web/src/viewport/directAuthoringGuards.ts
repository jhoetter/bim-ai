import * as THREE from 'three';

export interface HostedPlacementDedupeState {
  key: string;
  atMs: number;
}

export type HostedPlacementTool = 'door' | 'window' | 'wall-opening';

export interface ScreenPointLike {
  x: number;
  y: number;
}

export type HostedOpeningLike =
  | {
      kind: 'door' | 'window';
      id?: string;
      wallId: string;
      alongT: number;
      widthMm: number;
    }
  | {
      kind: 'wall_opening';
      id?: string;
      hostWallId: string;
      alongTStart: number;
      alongTEnd: number;
    };

export type HostedOpeningConflict = {
  elementId?: string;
  range: { startT: number; endT: number };
  existingRange: { startT: number; endT: number };
};

const LINKED_ID_SEPARATOR = '::';

export function isWallOnActiveAuthoringLevel(
  wall: { levelId?: string | null },
  activeLevelId: string | null | undefined,
): boolean {
  return Boolean(activeLevelId && wall.levelId === activeLevelId);
}

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

export function isHostedPlacementTool(
  tool: string | null | undefined,
): tool is HostedPlacementTool {
  return tool === 'door' || tool === 'window' || tool === 'wall-opening';
}

export function shouldCommitHostedPlacementOnPointerUp(input: {
  wasDragging: string | null;
  draftTool: string | null | undefined;
}): boolean {
  return input.wasDragging === 'tool-draft' && isHostedPlacementTool(input.draftTool);
}

export function shouldReuseHostedPreviewCommit(input: {
  clickScreen: ScreenPointLike;
  previewCenter?: ScreenPointLike;
  previewOutline?: ScreenPointLike[];
  maxCenterDistancePx?: number;
  outlinePaddingPx?: number;
}): boolean {
  const centerDistance = input.previewCenter
    ? Math.hypot(
        input.clickScreen.x - input.previewCenter.x,
        input.clickScreen.y - input.previewCenter.y,
      )
    : Number.POSITIVE_INFINITY;
  if (centerDistance <= (input.maxCenterDistancePx ?? 20)) return true;

  const outline = input.previewOutline;
  if (!outline || outline.length === 0) return false;
  const padding = input.outlinePaddingPx ?? 24;
  const xs = outline.map((point) => point.x);
  const ys = outline.map((point) => point.y);
  const minX = Math.min(...xs) - padding;
  const maxX = Math.max(...xs) + padding;
  const minY = Math.min(...ys) - padding;
  const maxY = Math.max(...ys) + padding;
  return (
    input.clickScreen.x >= minX &&
    input.clickScreen.x <= maxX &&
    input.clickScreen.y >= minY &&
    input.clickScreen.y <= maxY
  );
}

function rangesOverlap(a: { startT: number; endT: number }, b: { startT: number; endT: number }) {
  return a.startT < b.endT && b.startT < a.endT;
}

export function findHostedOpeningConflict(input: {
  wallId: string;
  wallLengthMm: number;
  alongT: number;
  widthMm: number;
  existing: HostedOpeningLike[];
  clearanceMm?: number;
}): HostedOpeningConflict | null {
  const wallLengthMm = Math.max(1, input.wallLengthMm);
  const clearanceT = Math.max(0, input.clearanceMm ?? 80) / wallLengthMm;
  const halfT = Math.max(1, input.widthMm) / 2 / wallLengthMm + clearanceT;
  const proposed = {
    startT: Math.max(0, input.alongT - halfT),
    endT: Math.min(1, input.alongT + halfT),
  };

  for (const opening of input.existing) {
    let existingRange: { startT: number; endT: number } | null = null;
    if ((opening.kind === 'door' || opening.kind === 'window') && opening.wallId === input.wallId) {
      const existingHalfT = Math.max(1, opening.widthMm) / 2 / wallLengthMm + clearanceT;
      existingRange = {
        startT: Math.max(0, opening.alongT - existingHalfT),
        endT: Math.min(1, opening.alongT + existingHalfT),
      };
    } else if (opening.kind === 'wall_opening' && opening.hostWallId === input.wallId) {
      existingRange = {
        startT: Math.max(0, opening.alongTStart - clearanceT),
        endT: Math.min(1, opening.alongTEnd + clearanceT),
      };
    }
    if (existingRange && rangesOverlap(proposed, existingRange)) {
      return { elementId: opening.id, range: proposed, existingRange };
    }
  }
  return null;
}
