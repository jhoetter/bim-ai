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
  reason?: 'overlap' | 'endpoint_clearance' | 'host_capacity_exceeded';
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

export function isPhysicalHostedOpeningWall(wall: {
  kind?: string;
  name?: string | null;
  props?: Record<string, unknown> | null;
}): boolean {
  if (wall.kind !== 'wall') return false;
  const props = wall.props ?? {};
  if (truthy(props.nonPhysical) || truthy(props.analysisOnly)) return false;
  if (props.physical === false) return false;
  const physicalRole = String(props.physicalRole ?? '')
    .trim()
    .toLowerCase();
  if (physicalRole === 'helper' || physicalRole === 'analysis' || physicalRole === 'nonphysical') {
    return false;
  }
  const role = String(props.role ?? '')
    .trim()
    .toLowerCase();
  if (role === 'access_proxy' || role === 'helper' || role === 'room_graph') return false;
  if (truthy(props.accessProxy) || truthy(props.helper)) return false;
  if (
    /(\baccess control\b|\broom graph\b|\bhelper\b|\bsynthetic\b|\bdiagnostic\b|\banalysis[- ]?only\b|\bnonphysical\b)/i.test(
      wall.name ?? '',
    )
  ) {
    return false;
  }
  return true;
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

export function shouldBypassLevelDatumPickForDirectAuthoring(input: {
  button: number;
  directTool: string | null | undefined;
  altKey: boolean;
  shiftKey: boolean;
}): boolean {
  return input.button === 0 && Boolean(input.directTool) && !input.altKey && !input.shiftKey;
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

export function isPointAttachedToWallFace(input: {
  pointMm: { xMm: number; yMm: number };
  wall: {
    start: { xMm: number; yMm: number };
    end: { xMm: number; yMm: number };
    thicknessMm?: number | null;
  };
  hostAlongT?: number | null;
  toleranceMm?: number;
}): boolean {
  const ax = input.wall.start.xMm;
  const ay = input.wall.start.yMm;
  const bx = input.wall.end.xMm;
  const by = input.wall.end.yMm;
  const dx = bx - ax;
  const dy = by - ay;
  const denom = dx * dx + dy * dy;
  if (denom <= 1e-9) return false;
  const alongT = ((input.pointMm.xMm - ax) * dx + (input.pointMm.yMm - ay) * dy) / denom;
  if (alongT < -1e-6 || alongT > 1 + 1e-6) return false;
  if (typeof input.hostAlongT === 'number' && Math.abs(input.hostAlongT - alongT) > 0.05) {
    return false;
  }
  const nearestX = ax + alongT * dx;
  const nearestY = ay + alongT * dy;
  const distanceMm = Math.hypot(input.pointMm.xMm - nearestX, input.pointMm.yMm - nearestY);
  const faceToleranceMm =
    input.toleranceMm ?? Math.max(25, (input.wall.thicknessMm ?? 200) / 2 + 25);
  return distanceMm <= faceToleranceMm;
}

function rangesOverlap(a: { startT: number; endT: number }, b: { startT: number; endT: number }) {
  return a.startT < b.endT && b.startT < a.endT;
}

function truthy(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string')
    return ['1', 'true', 'yes', 'y', 'on'].includes(value.trim().toLowerCase());
  return Boolean(value);
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
  const clearanceMm = Math.max(0, input.clearanceMm ?? 80);
  const clearanceT = clearanceMm / wallLengthMm;
  const openingWidthMm = Math.max(1, input.widthMm);
  const halfOpeningT = openingWidthMm / 2 / wallLengthMm;
  const rawProposed = {
    startT: input.alongT - halfOpeningT,
    endT: input.alongT + halfOpeningT,
  };
  const halfT = halfOpeningT + clearanceT;
  const proposed = {
    startT: Math.max(0, input.alongT - halfT),
    endT: Math.min(1, input.alongT + halfT),
  };
  let existingWidthMm = 0;
  let sameWallOpeningCount = 0;
  const existingRanges: Array<{
    elementId?: string;
    range: { startT: number; endT: number };
  }> = [];

  for (const opening of input.existing) {
    let existingRange: { startT: number; endT: number } | null = null;
    if ((opening.kind === 'door' || opening.kind === 'window') && opening.wallId === input.wallId) {
      sameWallOpeningCount += 1;
      existingWidthMm += Math.max(1, opening.widthMm);
      const existingHalfT = Math.max(1, opening.widthMm) / 2 / wallLengthMm + clearanceT;
      existingRange = {
        startT: Math.max(0, opening.alongT - existingHalfT),
        endT: Math.min(1, opening.alongT + existingHalfT),
      };
    } else if (opening.kind === 'wall_opening' && opening.hostWallId === input.wallId) {
      sameWallOpeningCount += 1;
      existingWidthMm += Math.max(0, opening.alongTEnd - opening.alongTStart) * wallLengthMm;
      existingRange = {
        startT: Math.max(0, opening.alongTStart - clearanceT),
        endT: Math.min(1, opening.alongTEnd + clearanceT),
      };
    }
    if (existingRange) existingRanges.push({ elementId: opening.id, range: existingRange });
  }
  const requiredLengthMm =
    existingWidthMm + openingWidthMm + 2 * clearanceMm + sameWallOpeningCount * clearanceMm;
  if (requiredLengthMm > wallLengthMm) {
    return {
      reason: 'host_capacity_exceeded',
      range: proposed,
      existingRange: { startT: 0, endT: 1 },
    };
  }
  if (
    rawProposed.startT * wallLengthMm < clearanceMm ||
    (1 - rawProposed.endT) * wallLengthMm < clearanceMm
  ) {
    return {
      reason: 'endpoint_clearance',
      range: proposed,
      existingRange: { startT: 0, endT: 1 },
    };
  }
  for (const existing of existingRanges) {
    if (rangesOverlap(proposed, existing.range)) {
      return {
        elementId: existing.elementId,
        reason: 'overlap',
        range: proposed,
        existingRange: existing.range,
      };
    }
  }
  return null;
}
