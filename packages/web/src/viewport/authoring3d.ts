import {
  snapPlanCandidates,
  type SegmentLine,
  type SnapAnchor,
  type SnapKind,
} from '../plan/snapEngine';
import { applySnapSettings, DEFAULT_SNAP_SETTINGS, type SnapSettings } from '../plan/snapSettings';

export interface DraftLevel {
  id: string;
  elevationMm: number;
}

export interface SceneVec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlanPointMm {
  xMm: number;
  yMm: number;
}

export type WallDraftProjectionMode = 'plane' | 'elevation-axis';
export type Authoring3dSnapKind =
  | 'level-plane'
  | 'wall-endpoint'
  | 'wall-intersection'
  | 'wall-segment'
  | SnapKind;

export interface Authoring3dSnap {
  point: PlanPointMm;
  kind: Authoring3dSnapKind;
}

export type Authoring3dLineTool =
  | 'wall'
  | 'beam'
  | 'stair'
  | 'railing'
  | 'grid'
  | 'reference-plane';

export interface Authoring3dLinePreviewPayload {
  tool: Authoring3dLineTool;
  levelId: string;
  start: PlanPointMm;
  end: PlanPointMm;
  wall?: {
    id: string;
    locationLine?: string | null;
    wallTypeId?: string;
    heightMm?: number;
  };
}

export type Authoring3dPolygonTool = 'floor' | 'roof' | 'ceiling' | 'area';

export interface Authoring3dPolygonPreviewPayload {
  tool: Authoring3dPolygonTool;
  levelId: string;
  points: PlanPointMm[];
}

export interface WallDraftProjectionClassification {
  mode: WallDraftProjectionMode;
  scaleXMmPerPx: number;
  scaleYMmPerPx: number;
  anisotropyRatio: number;
  verticalLook: number;
}

export function resolve3dDraftLevel(
  levels: readonly DraftLevel[],
  preferredLevelId?: string | null,
): DraftLevel | null {
  if (levels.length === 0) return null;
  if (preferredLevelId) {
    const preferred = levels.find((level) => level.id === preferredLevelId);
    if (preferred) return preferred;
  }
  return levels.reduce((best, level) => (level.elevationMm < best.elevationMm ? level : best));
}

export function projectSceneRayToLevelPlaneMm(
  rayOrigin: SceneVec3,
  rayDirection: SceneVec3,
  levelElevationMm: number,
): PlanPointMm | null {
  const denom = rayDirection.y;
  if (Math.abs(denom) < 1e-6) return null;
  const t = levelElevationMm / 1000 / denom - rayOrigin.y / denom;
  if (!Number.isFinite(t) || t <= 0) return null;
  return {
    xMm: (rayOrigin.x + rayDirection.x * t) * 1000,
    yMm: (rayOrigin.z + rayDirection.z * t) * 1000,
  };
}

export function classifyWallDraftProjection(
  scaleXMmPerPx: number,
  scaleYMmPerPx: number,
  cameraDirectionY: number,
): WallDraftProjectionClassification {
  const safeScaleX = Number.isFinite(scaleXMmPerPx) ? Math.max(0, scaleXMmPerPx) : Infinity;
  const safeScaleY = Number.isFinite(scaleYMmPerPx) ? Math.max(0, scaleYMmPerPx) : Infinity;
  const minScale = Math.max(1e-6, Math.min(safeScaleX, safeScaleY));
  const maxScale = Math.max(safeScaleX, safeScaleY);
  const anisotropyRatio = maxScale / minScale;
  const verticalLook = Math.min(1, Math.abs(cameraDirectionY));
  const planeReadable = maxScale <= 160 && anisotropyRatio <= 4.25;

  return {
    mode: planeReadable ? 'plane' : 'elevation-axis',
    scaleXMmPerPx: safeScaleX,
    scaleYMmPerPx: safeScaleY,
    anisotropyRatio,
    verticalLook,
  };
}

export function isDraftPlaneHitOccluded(
  planeDistanceM: number,
  blockingDistanceM: number | null | undefined,
  toleranceM = 0.05,
): boolean {
  if (!Number.isFinite(planeDistanceM) || planeDistanceM <= 0) return false;
  if (blockingDistanceM == null || !Number.isFinite(blockingDistanceM) || blockingDistanceM <= 0)
    return false;
  const safeTolerance = Number.isFinite(toleranceM) ? Math.max(0, toleranceM) : 0;
  return blockingDistanceM < planeDistanceM - safeTolerance;
}

export function snapDraftPointToGrid(
  point: PlanPointMm,
  options: { gridStepMm: number; snapMm: number },
): Authoring3dSnap {
  const step = Number.isFinite(options.gridStepMm) ? Math.max(10, options.gridStepMm) : 250;
  const tolerance = Number.isFinite(options.snapMm) ? Math.max(0, options.snapMm) : 0;
  const gridPoint = {
    xMm: Math.round(point.xMm / step) * step,
    yMm: Math.round(point.yMm / step) * step,
  };
  const distance = Math.hypot(gridPoint.xMm - point.xMm, gridPoint.yMm - point.yMm);
  if (distance <= tolerance) {
    return { point: gridPoint, kind: 'grid' };
  }
  return { point: { xMm: point.xMm, yMm: point.yMm }, kind: 'level-plane' };
}

export function snapDraftPointToPlanSnaps(
  point: PlanPointMm,
  options: {
    anchors: SnapAnchor[];
    centers?: SnapAnchor[];
    lines?: SegmentLine[];
    gridStepMm: number;
    snapMm: number;
    draftAnchor?: PlanPointMm;
    snapSettings?: SnapSettings;
  },
): Authoring3dSnap {
  const snapMm = Number.isFinite(options.snapMm) ? Math.max(0, options.snapMm) : 0;
  const hits = snapPlanCandidates({
    cursor: point,
    anchors: options.anchors,
    centers: options.centers,
    lines: options.lines,
    gridStepMm: options.gridStepMm,
    chainAnchor: options.draftAnchor,
    draftAnchor: options.draftAnchor,
    snapMm,
    orthoHold: false,
  });
  const filtered = applySnapSettings(
    hits.filter((hit) => {
      if (hit.kind === 'raw') return false;
      if (hit.kind !== 'grid') return true;
      return Math.hypot(hit.point.xMm - point.xMm, hit.point.yMm - point.yMm) <= snapMm;
    }),
    options.snapSettings ?? DEFAULT_SNAP_SETTINGS,
  );
  const active = filtered[0];
  if (!active) return { point: { xMm: point.xMm, yMm: point.yMm }, kind: 'level-plane' };
  return {
    point: { xMm: active.point.xMm, yMm: active.point.yMm },
    kind: active.kind,
  };
}

export function buildLinePreviewPayload(
  input: Authoring3dLinePreviewPayload,
): Authoring3dLinePreviewPayload {
  return {
    ...input,
    start: { ...input.start },
    end: { ...input.end },
    wall: input.wall ? { ...input.wall } : undefined,
  };
}

export function buildPolygonPreviewPayload(
  input: Authoring3dPolygonPreviewPayload,
): Authoring3dPolygonPreviewPayload {
  return {
    ...input,
    points: input.points.map((point) => ({ ...point })),
  };
}

export function authoring3dLineLengthMm(
  payload: Pick<Authoring3dLinePreviewPayload, 'start' | 'end'>,
): number {
  return Math.hypot(payload.end.xMm - payload.start.xMm, payload.end.yMm - payload.start.yMm);
}

export function resizeLinePreviewToLength(
  payload: Authoring3dLinePreviewPayload,
  lengthMm: number,
): Authoring3dLinePreviewPayload {
  const currentLength = authoring3dLineLengthMm(payload);
  if (!Number.isFinite(lengthMm) || lengthMm <= 0 || currentLength <= 1e-6) {
    return buildLinePreviewPayload(payload);
  }
  const ux = (payload.end.xMm - payload.start.xMm) / currentLength;
  const uy = (payload.end.yMm - payload.start.yMm) / currentLength;
  return buildLinePreviewPayload({
    ...payload,
    end: {
      xMm: payload.start.xMm + ux * lengthMm,
      yMm: payload.start.yMm + uy * lengthMm,
    },
  });
}

/**
 * WP-C C4 — typed semantic command shapes for wall-top host attachment.
 * These are emitted as Record<string, unknown> via onSemanticCommand; the
 * union type here provides author-time safety for callers that construct them.
 */
export type AttachWallTopCommand = {
  type: 'attachWallTop';
  wallId: string;
  hostId: string;
  hostFace: 'bottom' | 'top';
};

export type DetachWallTopCommand = {
  type: 'detachWallTop';
  wallId: string;
};

export type WallTopConstraintCommand = AttachWallTopCommand | DetachWallTopCommand;

export function linePreviewToSemanticCommand(
  payload: Authoring3dLinePreviewPayload,
): Record<string, unknown> {
  if (payload.tool === 'wall') {
    return {
      type: 'createWall',
      id: payload.wall?.id,
      levelId: payload.levelId,
      start: payload.start,
      end: payload.end,
      locationLine: payload.wall?.locationLine,
      wallTypeId: payload.wall?.wallTypeId,
      heightMm: payload.wall?.heightMm,
    };
  }
  if (payload.tool === 'beam') {
    return {
      type: 'createBeam',
      levelId: payload.levelId,
      startMm: payload.start,
      endMm: payload.end,
    };
  }
  if (payload.tool === 'stair') {
    return {
      type: 'createStair',
      baseLevelId: payload.levelId,
      runStartMm: payload.start,
      runEndMm: payload.end,
    };
  }
  if (payload.tool === 'railing') {
    return {
      type: 'createRailing',
      pathMm: [
        { xMm: payload.start.xMm, yMm: payload.start.yMm },
        { xMm: payload.end.xMm, yMm: payload.end.yMm },
      ],
    };
  }
  if (payload.tool === 'grid') {
    return {
      type: 'createGridLine',
      levelId: payload.levelId,
      start: { xMm: payload.start.xMm, yMm: payload.start.yMm },
      end: { xMm: payload.end.xMm, yMm: payload.end.yMm },
    };
  }
  return {
    type: 'createReferencePlane',
    levelId: payload.levelId,
    startMm: { xMm: payload.start.xMm, yMm: payload.start.yMm },
    endMm: { xMm: payload.end.xMm, yMm: payload.end.yMm },
  };
}

export function polygonPreviewToSemanticCommand(
  payload: Authoring3dPolygonPreviewPayload,
): Record<string, unknown> {
  const points = payload.points.map((point) => ({ xMm: point.xMm, yMm: point.yMm }));
  if (payload.tool === 'floor') {
    return {
      type: 'createFloor',
      levelId: payload.levelId,
      boundaryMm: points,
    };
  }
  if (payload.tool === 'roof') {
    return {
      type: 'createRoof',
      referenceLevelId: payload.levelId,
      footprintMm: points,
    };
  }
  if (payload.tool === 'ceiling') {
    return {
      type: 'createCeiling',
      levelId: payload.levelId,
      boundaryMm: points,
    };
  }
  return {
    type: 'createArea',
    levelId: payload.levelId,
    boundaryMm: points,
    ruleSet: 'no_rules',
    areaScheme: 'gross_building',
    applyAreaRules: true,
  };
}

export function previewPayloadMatchesCommand(
  payload: Authoring3dLinePreviewPayload | Authoring3dPolygonPreviewPayload,
  command: Record<string, unknown>,
): boolean {
  const commandType = command.type;
  if ('points' in payload) {
    const points = payload.points.map((point) => ({ xMm: point.xMm, yMm: point.yMm }));
    if (payload.tool === 'floor') {
      return (
        commandType === 'createFloor' &&
        command.levelId === payload.levelId &&
        JSON.stringify(command.boundaryMm) === JSON.stringify(points)
      );
    }
    if (payload.tool === 'roof') {
      return (
        commandType === 'createRoof' &&
        command.referenceLevelId === payload.levelId &&
        JSON.stringify(command.footprintMm) === JSON.stringify(points)
      );
    }
    if (payload.tool === 'ceiling') {
      return (
        commandType === 'createCeiling' &&
        command.levelId === payload.levelId &&
        JSON.stringify(command.boundaryMm) === JSON.stringify(points)
      );
    }
    return (
      commandType === 'createArea' &&
      command.levelId === payload.levelId &&
      JSON.stringify(command.boundaryMm) === JSON.stringify(points)
    );
  }
  if (payload.tool === 'wall') {
    return (
      commandType === 'createWall' &&
      command.levelId === payload.levelId &&
      JSON.stringify(command.start) === JSON.stringify(payload.start) &&
      JSON.stringify(command.end) === JSON.stringify(payload.end)
    );
  }
  if (payload.tool === 'beam') {
    return (
      commandType === 'createBeam' &&
      command.levelId === payload.levelId &&
      JSON.stringify(command.startMm) === JSON.stringify(payload.start) &&
      JSON.stringify(command.endMm) === JSON.stringify(payload.end)
    );
  }
  if (payload.tool === 'stair') {
    return (
      commandType === 'createStair' &&
      command.baseLevelId === payload.levelId &&
      JSON.stringify(command.runStartMm) === JSON.stringify(payload.start) &&
      JSON.stringify(command.runEndMm) === JSON.stringify(payload.end)
    );
  }
  if (payload.tool === 'railing') {
    return (
      commandType === 'createRailing' &&
      JSON.stringify(command.pathMm) ===
        JSON.stringify([
          { xMm: payload.start.xMm, yMm: payload.start.yMm },
          { xMm: payload.end.xMm, yMm: payload.end.yMm },
        ])
    );
  }
  if (payload.tool === 'grid') {
    return (
      commandType === 'createGridLine' &&
      command.levelId === payload.levelId &&
      JSON.stringify(command.start) ===
        JSON.stringify({ xMm: payload.start.xMm, yMm: payload.start.yMm }) &&
      JSON.stringify(command.end) === JSON.stringify({ xMm: payload.end.xMm, yMm: payload.end.yMm })
    );
  }
  return (
    commandType === 'createReferencePlane' &&
    command.levelId === payload.levelId &&
    JSON.stringify(command.startMm) ===
      JSON.stringify({ xMm: payload.start.xMm, yMm: payload.start.yMm }) &&
    JSON.stringify(command.endMm) === JSON.stringify({ xMm: payload.end.xMm, yMm: payload.end.yMm })
  );
}
