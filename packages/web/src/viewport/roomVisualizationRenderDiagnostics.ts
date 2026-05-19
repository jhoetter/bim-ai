import type { Element } from '@bim-ai/core';

import {
  createRendererDiagnostic,
  type RendererDiagnostic,
  type RendererDiagnosticEvidence,
} from './rendererDiagnostics';

type PointMm = { xMm: number; yMm: number };
type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
type FloorElement = Extract<Element, { kind: 'floor' }>;
type LevelElement = Extract<Element, { kind: 'level' }>;
type RoomElement = Extract<Element, { kind: 'room' }>;
type RoomSeparationElement = Extract<Element, { kind: 'room_separation' }>;

export type RoomVisualizationRenderDiagnosticsOptions = {
  evidence?: RendererDiagnosticEvidence;
  viewId?: string | null;
  floorSupportToleranceMm?: number;
};

const TRACKER_ROOM = ['BIR-I02', 'BIR-I03', 'BIR-I04', 'BIR-J06'];
const MIN_ROOM_AREA_MM2 = 1;
const MIN_ROOM_SEPARATION_LENGTH_MM = 1;
const DEFAULT_FLOOR_SUPPORT_TOLERANCE_MM = 10;

export function diagnoseRoomVisualizationRendering(
  elementsById: Record<string, Element | undefined>,
  options: RoomVisualizationRenderDiagnosticsOptions = {},
): RendererDiagnostic[] {
  const elements = Object.values(elementsById).filter((element): element is Element => !!element);
  const levelsById = new Set(
    elements
      .filter((element): element is LevelElement => element.kind === 'level')
      .map((level) => level.id),
  );
  const floorBoundsByLevel = buildFloorBoundsByLevel(
    elements.filter((element): element is FloorElement => element.kind === 'floor'),
  );
  const diagnostics: RendererDiagnostic[] = [];

  for (const room of elements.filter(
    (element): element is RoomElement => element.kind === 'room',
  )) {
    diagnostics.push(...diagnoseRoom(room, levelsById, floorBoundsByLevel, options));
  }

  for (const separation of elements.filter(
    (element): element is RoomSeparationElement => element.kind === 'room_separation',
  )) {
    diagnostics.push(
      ...diagnoseRoomSeparation(separation, levelsById, floorBoundsByLevel, options),
    );
  }

  return diagnostics.sort((a, b) =>
    `${a.severity}:${a.code}:${a.elementIds.join(',')}`.localeCompare(
      `${b.severity}:${b.code}:${b.elementIds.join(',')}`,
    ),
  );
}

function diagnoseRoom(
  room: RoomElement,
  levelsById: Set<string>,
  floorBoundsByLevel: Map<string, Bounds>,
  options: RoomVisualizationRenderDiagnosticsOptions,
): RendererDiagnostic[] {
  const diagnostics: RendererDiagnostic[] = [];
  if (!levelsById.has(room.levelId)) {
    diagnostics.push(
      diagnostic({
        code: 'renderer.room_visualization.missing_level',
        ruleId: 'renderer_room_visualization_missing_level',
        severity: 'error',
        issueClass: 'model-invalid',
        rendererArea: 'plan',
        message: 'Room overlay cannot be placed because levelId does not reference a level.',
        elementIds: [room.id, room.levelId],
        options,
      }),
    );
  }

  if (room.outlineMm.length < 3 || polygonAreaAbs(room.outlineMm) < MIN_ROOM_AREA_MM2) {
    diagnostics.push(
      diagnostic({
        code: 'renderer.room_visualization.degenerate_outline',
        ruleId: 'renderer_room_visualization_degenerate_outline',
        severity: 'error',
        issueClass: 'model-invalid',
        rendererArea: 'plan',
        message: 'Room outline is degenerate, so plan fill, tag, and space overlay can be dropped.',
        elementIds: [room.id],
        options,
      }),
    );
  }

  const supportBounds = floorBoundsByLevel.get(room.levelId);
  const roomBounds = boundsForPoints(room.outlineMm);
  if (
    supportBounds &&
    roomBounds &&
    boundsOutside(roomBounds, supportBounds, supportTolerance(options))
  ) {
    diagnostics.push(
      diagnostic({
        code: 'renderer.room_visualization.outside_floor_support',
        ruleId: 'renderer_room_visualization_outside_floor_support',
        severity: 'error',
        issueClass: 'model-invalid',
        rendererArea: 'plan',
        message:
          'Room outline extends outside its level floor support, so plan/space evidence can misrepresent the occupied area.',
        elementIds: [room.id],
        options,
      }),
    );
  }

  if (String(room.name ?? '').trim().length === 0) {
    diagnostics.push(
      diagnostic({
        code: 'renderer.room_visualization.missing_name',
        ruleId: 'renderer_room_visualization_missing_name',
        severity: 'warning',
        issueClass: 'renderer-degraded',
        rendererArea: 'plan',
        message: 'Room has no display name, so room-tag evidence can render without identity.',
        elementIds: [room.id],
        options,
      }),
    );
  }

  const props = (room.props ?? {}) as Record<string, unknown>;
  if (props.render3dVolume === true || props.showRoomVolume === true) {
    diagnostics.push(
      diagnostic({
        code: 'renderer.room_visualization.volume_unsupported',
        ruleId: 'renderer_room_visualization_volume_unsupported',
        severity: 'warning',
        issueClass: 'renderer-unsupported',
        rendererArea: 'viewport-3d',
        message:
          'Room requests 3D room/space volume rendering, but the renderer only supports diagnostic room ribbons and plan overlays.',
        elementIds: [room.id],
        options,
      }),
    );
  }

  if (room.upperLimitLevelId && !levelsById.has(room.upperLimitLevelId)) {
    diagnostics.push(
      diagnostic({
        code: 'renderer.room_visualization.upper_limit_missing',
        ruleId: 'renderer_room_visualization_upper_limit_missing',
        severity: 'warning',
        issueClass: 'renderer-degraded',
        rendererArea: 'viewport-3d',
        message:
          'Room upperLimitLevelId does not reference a level, so volume/top-boundary visualization evidence is degraded.',
        elementIds: [room.id, room.upperLimitLevelId],
        options,
      }),
    );
  }

  return diagnostics;
}

function diagnoseRoomSeparation(
  separation: RoomSeparationElement,
  levelsById: Set<string>,
  floorBoundsByLevel: Map<string, Bounds>,
  options: RoomVisualizationRenderDiagnosticsOptions,
): RendererDiagnostic[] {
  const diagnostics: RendererDiagnostic[] = [];
  if (!levelsById.has(separation.levelId)) {
    diagnostics.push(
      diagnostic({
        code: 'renderer.room_separation.missing_level',
        ruleId: 'renderer_room_separation_missing_level',
        severity: 'error',
        issueClass: 'model-invalid',
        rendererArea: 'plan',
        message:
          'Room separation line cannot augment room-boundary evidence because levelId does not reference a level.',
        elementIds: [separation.id, separation.levelId],
        options,
      }),
    );
  }

  if (distance(separation.start, separation.end) < MIN_ROOM_SEPARATION_LENGTH_MM) {
    diagnostics.push(
      diagnostic({
        code: 'renderer.room_separation.degenerate_segment',
        ruleId: 'renderer_room_separation_degenerate_segment',
        severity: 'error',
        issueClass: 'model-invalid',
        rendererArea: 'plan',
        message:
          'Room separation line has a degenerate segment, so room-boundary overlay evidence can silently omit it.',
        elementIds: [separation.id],
        options,
      }),
    );
  }

  const supportBounds = floorBoundsByLevel.get(separation.levelId);
  const separationBounds = boundsForPoints([separation.start, separation.end]);
  if (
    supportBounds &&
    separationBounds &&
    boundsOutside(separationBounds, supportBounds, supportTolerance(options))
  ) {
    diagnostics.push(
      diagnostic({
        code: 'renderer.room_separation.outside_floor_support',
        ruleId: 'renderer_room_separation_outside_floor_support',
        severity: 'error',
        issueClass: 'model-invalid',
        rendererArea: 'plan',
        message:
          'Room separation line extends outside its level floor support, so room-boundary evidence can be misleading.',
        elementIds: [separation.id],
        options,
      }),
    );
  }

  return diagnostics;
}

function diagnostic(input: {
  code: string;
  ruleId: string;
  severity: RendererDiagnostic['severity'];
  issueClass: RendererDiagnostic['issueClass'];
  rendererArea: RendererDiagnostic['rendererArea'];
  message: string;
  elementIds: string[];
  options: RoomVisualizationRenderDiagnosticsOptions;
}): RendererDiagnostic {
  return createRendererDiagnostic({
    code: input.code,
    ruleId: input.ruleId,
    severity: input.severity,
    issueClass: input.issueClass,
    rendererArea: input.rendererArea,
    feature: 'room-visualization',
    message: input.message,
    elementIds: input.elementIds,
    trackerItems: TRACKER_ROOM,
    viewId: input.options.viewId,
    evidence: input.options.evidence,
  });
}

function buildFloorBoundsByLevel(floors: FloorElement[]): Map<string, Bounds> {
  const byLevel = new Map<string, Bounds>();
  for (const floor of floors) {
    const bounds = boundsForPoints(floor.boundaryMm);
    if (!bounds) continue;
    byLevel.set(floor.levelId, mergeBounds(byLevel.get(floor.levelId), bounds));
  }
  return byLevel;
}

function boundsForPoints(points: readonly PointMm[]): Bounds | null {
  if (points.length === 0) return null;
  return {
    minX: Math.min(...points.map((point) => point.xMm)),
    minY: Math.min(...points.map((point) => point.yMm)),
    maxX: Math.max(...points.map((point) => point.xMm)),
    maxY: Math.max(...points.map((point) => point.yMm)),
  };
}

function mergeBounds(left: Bounds | undefined, right: Bounds): Bounds {
  if (!left) return right;
  return {
    minX: Math.min(left.minX, right.minX),
    minY: Math.min(left.minY, right.minY),
    maxX: Math.max(left.maxX, right.maxX),
    maxY: Math.max(left.maxY, right.maxY),
  };
}

function boundsOutside(inner: Bounds, outer: Bounds, toleranceMm: number): boolean {
  return (
    inner.minX < outer.minX - toleranceMm ||
    inner.minY < outer.minY - toleranceMm ||
    inner.maxX > outer.maxX + toleranceMm ||
    inner.maxY > outer.maxY + toleranceMm
  );
}

function polygonAreaAbs(points: readonly PointMm[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    sum += current.xMm * next.yMm - next.xMm * current.yMm;
  }
  return Math.abs(sum / 2);
}

function distance(left: PointMm, right: PointMm): number {
  return Math.hypot(left.xMm - right.xMm, left.yMm - right.yMm);
}

function supportTolerance(options: RoomVisualizationRenderDiagnosticsOptions): number {
  return options.floorSupportToleranceMm ?? DEFAULT_FLOOR_SUPPORT_TOLERANCE_MM;
}
