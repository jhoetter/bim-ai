/**
 * Direct-3D authoring tool helpers extracted from Viewport.tsx.
 *
 * The giant mount-effect in Viewport.tsx owns the THREE scene, the camera
 * rig, and the pointer/keyboard state machine. The 3D authoring tools (wall,
 * door, window, polygon, etc.) live inside that effect as inline closures
 * sharing several mutable `let` variables (line draft, polygon draft,
 * hosted-opening dedupe, etc.).
 *
 * This module lifts the largest of those closures — the click dispatcher,
 * its hosted-opening helpers, the wall picker, the level resolvers, and the
 * line-preview dispatcher — into a session factory that takes a context
 * describing the live THREE objects + outer-closure helpers, plus a mutable
 * draft-state object shared with the in-place pointer-move/key handlers.
 */
import * as THREE from 'three';
import type { MutableRefObject } from 'react';

import type { Element } from '@bim-ai/core';

import {
  classifyWallDraftProjection,
  isDraftPlaneHitOccluded,
  buildLinePreviewPayload,
  buildPolygonPreviewPayload,
  linePreviewToSemanticCommand,
  polygonPreviewToSemanticCommand,
  projectSceneRayToLevelPlaneMm,
  resolve3dDraftLevel,
  snapDraftPointToGrid,
  type Authoring3dLinePreviewPayload,
  type Authoring3dSnapKind,
  type WallDraftProjectionClassification,
} from './authoring3d';
import {
  findHostedOpeningConflict,
  isBackfacingWallHit,
  isDuplicateHostedPlacement,
  isLinkedElementId,
  isPhysicalHostedOpeningWall,
  isWallOnActiveAuthoringLevel,
  shouldReuseHostedPreviewCommit,
  type HostedOpeningLike,
  type HostedPlacementDedupeState,
} from './directAuthoringGuards';
import { projectAlongT } from './wallFaceRadialMenu';
import {
  DIRECT_3D_AUTHORING_TOOLS,
  LINE_3D_AUTHORING_TOOLS,
  POLYGON_3D_AUTHORING_TOOLS,
  type Authoring3dOverlayState,
  type Direct3dAuthoringTool,
  type ScreenPoint,
} from './ViewportOverlays';
import {
  resolveHostedFamilyPlacement,
  type HostedFamilyTool,
} from '../families/hostedFamilySelection';
import {
  familyTypePlacesAsDetailComponent,
  familyTypeRequiresWallHost,
} from '../families/familyPlacementRuntime';
import {
  activeComponentAssetId,
  activeComponentFamilyTypeId,
  pendingComponentRotationDeg,
} from '../workspace/authoring/OptionsBar';
import {
  flipWallLocationLineSide,
  snapWallPointToConnectivity,
} from '../geometry/wallConnectivity';
import { useBimStore } from '../state/store';

export type WallDraftScreenBasis = {
  mode: 'elevation-axis';
  originScreen: ScreenPoint;
  originPointMm: { xMm: number; yMm: number };
  xPerPx: { xMm: number; yMm: number };
  yPerPx: { xMm: number; yMm: number };
  scaleMmPerPx: number;
  projection: WallDraftProjectionClassification;
};

export type DraftPlaneProjection = {
  point: { xMm: number; yMm: number };
  screen: ScreenPoint;
  distanceM: number;
  snapKind?: Authoring3dSnapKind;
  snapScreen?: ScreenPoint;
  blocker?: {
    elementId?: string;
    kind?: Element['kind'];
    distanceM: number;
  };
};

export type LineDraftStart = {
  tool: 'wall' | 'beam' | 'stair' | 'railing' | 'grid' | 'reference-plane';
  levelId: string;
  point: { xMm: number; yMm: number };
  screen?: ScreenPoint;
  wallBasis?: WallDraftScreenBasis;
  wallProjection?: WallDraftProjectionClassification;
};

export type PolygonDraft = {
  tool: 'ceiling' | 'floor' | 'roof' | 'shaft' | 'area';
  levelId: string;
  points: Array<{ xMm: number; yMm: number }>;
};

export type DraftLevelInfo = { id: string; elevationMm: number; name: string };

export type Direct3dToolDraftState = {
  lineDraftStart: LineDraftStart | null;
  polygonDraft: PolygonDraft | null;
  lastHostedPlacementScreen: HostedPlacementDedupeState | null;
  lastHostedPlacementHost: HostedPlacementDedupeState | null;
  wallFlipNextSegment: boolean;
  hostPreviewLock: boolean;
};

export function createDirect3dToolDraftState(): Direct3dToolDraftState {
  return {
    lineDraftStart: null,
    polygonDraft: null,
    lastHostedPlacementScreen: null,
    lastHostedPlacementHost: null,
    wallFlipNextSegment: false,
    hostPreviewLock: false,
  };
}

export type Direct3dToolHelpersCtx = {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  ndc: THREE.Vector2;
  raycaster: THREE.Raycaster;
  root: THREE.Group;
  elementsByIdRef: MutableRefObject<Record<string, Element>>;
  activeLevelIdRef: MutableRefObject<string | null | undefined>;
  authoringOverlayRef: MutableRefObject<Authoring3dOverlayState | null>;
  onSemanticCommandRef: MutableRefObject<((cmd: Record<string, unknown>) => void) | undefined>;
  setAuthoringOverlay: (
    next:
      | Authoring3dOverlayState
      | null
      | ((prev: Authoring3dOverlayState | null) => Authoring3dOverlayState | null),
  ) => void;
  setDraftPlaneAngleWarning: (next: boolean) => void;
  activeDirect3dTool: () => Direct3dAuthoringTool | null;
  clearWallDraftPreviewGroup: () => void;
  emitWallDebug: (phase: string, payload: Record<string, unknown>) => void;
  measureDraftPlaneProjectionMmPerPx: (
    cx: number,
    cy: number,
    elevationMm: number,
  ) => number | null;
  isDraftPlaneProjectionStable: (cx: number, cy: number, elevationMm: number) => boolean;
  projectPointerToDraftPlane: (
    cx: number,
    cy: number,
    elevationMm: number,
  ) => DraftPlaneProjection | null;
  projectPointerToVisibleDraftPlane: (
    cx: number,
    cy: number,
    elevationMm: number,
  ) => DraftPlaneProjection | null;
  pointFromWallDraftScreenBasis: (
    cx: number,
    cy: number,
    basis: WallDraftScreenBasis,
  ) => DraftPlaneProjection;
  createWallDraftScreenBasis: (
    cx: number,
    cy: number,
    elevationMm: number,
    origin: { point: { xMm: number; yMm: number }; screen: ScreenPoint },
  ) => { basis?: WallDraftScreenBasis; projection: WallDraftProjectionClassification };
  snapDraftProjectionToActiveWorkPlane: (
    projected: DraftPlaneProjection,
    levelInfo: { id: string; elevationMm: number },
    options?: { preferWallConnectivity?: boolean },
  ) => DraftPlaneProjection;
  clientToCanvasScreen: (cx: number, cy: number) => ScreenPoint;
  projectSemanticPointToScreen: (
    pointMm: { xMm: number; yMm: number; zMm: number },
    rect: DOMRect,
  ) => ScreenPoint | null;
};

export type PickWallAtPointerResult = {
  wall: Extract<Element, { kind: 'wall' }>;
  hitPointMm: { xMm: number; yMm: number; zMm: number };
  alongT: number;
};

export type HostedPreviewSegmentResult = {
  center: ScreenPoint;
  start?: ScreenPoint;
  end?: ScreenPoint;
  outline?: ScreenPoint[];
  auxLines?: Array<{ start: ScreenPoint; end: ScreenPoint }>;
  auxArcPath?: string;
  valid: boolean;
  invalidReason?: string;
};

export type Direct3dToolHelpers = {
  resolveDraftLevelInfo: () => DraftLevelInfo | null;
  resolveDraftLevels: () => DraftLevelInfo[];
  pickWallAtPointer: (
    cx: number,
    cy: number,
    options?: {
      tool?: 'door' | 'window' | 'wall-opening';
      preferWallId?: string;
      lockToPreferred?: boolean;
    },
  ) => PickWallAtPointerResult | null;
  hostedToolSpec: (tool: HostedFamilyTool) => ReturnType<typeof resolveHostedFamilyPlacement>;
  hostedPreviewSegment: (
    tool: HostedFamilyTool,
    hit: PickWallAtPointerResult,
    rect: DOMRect,
  ) => HostedPreviewSegmentResult | null;
  clampHostedAlongT: (
    tool: HostedFamilyTool,
    wall: Extract<Element, { kind: 'wall' }>,
    alongT: number,
  ) => number;
  hostedOpeningConflictFor: (
    tool: HostedFamilyTool,
    wall: Extract<Element, { kind: 'wall' }>,
    alongT: number,
  ) => ReturnType<typeof findHostedOpeningConflict>;
  dispatchLinePreviewPayload: (payload: Authoring3dLinePreviewPayload) => void;
  handle3dDirectToolClick: (cx: number, cy: number) => boolean;
};

export function createDirect3dToolHelpers(
  ctx: Direct3dToolHelpersCtx,
  state: Direct3dToolDraftState,
): Direct3dToolHelpers {
  const {
    renderer,
    camera,
    ndc,
    raycaster,
    root,
    elementsByIdRef,
    activeLevelIdRef,
    authoringOverlayRef,
    onSemanticCommandRef,
    setAuthoringOverlay,
    setDraftPlaneAngleWarning,
    activeDirect3dTool,
    clearWallDraftPreviewGroup,
    emitWallDebug,
    measureDraftPlaneProjectionMmPerPx,
    isDraftPlaneProjectionStable,
    projectPointerToDraftPlane,
    projectPointerToVisibleDraftPlane,
    pointFromWallDraftScreenBasis,
    createWallDraftScreenBasis,
    snapDraftProjectionToActiveWorkPlane,
    clientToCanvasScreen,
    projectSemanticPointToScreen,
  } = ctx;

  function resolveDraftLevelInfo(): DraftLevelInfo | null {
    const levels = Object.values(elementsByIdRef.current).filter(
      (el): el is Extract<Element, { kind: 'level' }> => el.kind === 'level',
    );
    const draftLevel = resolve3dDraftLevel(levels, activeLevelIdRef.current);
    if (!draftLevel) return null;
    const levelName =
      levels.find((level) => level.id === draftLevel.id)?.name ??
      authoringOverlayRef.current?.levelName ??
      'Active level';
    return { id: draftLevel.id, elevationMm: draftLevel.elevationMm, name: levelName };
  }

  function resolveDraftLevels(): DraftLevelInfo[] {
    return Object.values(elementsByIdRef.current)
      .filter((el): el is Extract<Element, { kind: 'level' }> => el.kind === 'level')
      .map((level) => ({ id: level.id, elevationMm: level.elevationMm, name: level.name }))
      .sort((a, b) => a.elevationMm - b.elevationMm);
  }

  function pickWallAtPointer(
    cx: number,
    cy: number,
    options?: {
      tool?: 'door' | 'window' | 'wall-opening';
      preferWallId?: string;
      lockToPreferred?: boolean;
    },
  ): PickWallAtPointerResult | null {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((cx - rect.left) / rect.width) * 2 - 1;
    ndc.y = -(((cy - rect.top) / rect.height) * 2 - 1);
    camera.updateMatrixWorld(true);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(root.children, true);
    const draftLevelInfo = resolveDraftLevelInfo();
    const candidates = new Map<
      string,
      {
        wall: Extract<Element, { kind: 'wall' }>;
        hitPointMm: { xMm: number; yMm: number; zMm: number };
        alongT: number;
        score: number;
      }
    >();
    for (const h of hits) {
      const id = h.object.userData.bimPickId as string | undefined;
      if (!id) continue;
      if (isLinkedElementId(id)) continue;
      const el = elementsByIdRef.current[id];
      if (el?.kind !== 'wall') continue;
      if (!isPhysicalHostedOpeningWall(el)) continue;
      if (isBackfacingWallHit(h.face?.normal, h.object.matrixWorld, raycaster.ray.direction))
        continue;
      const wall = el;
      if (!isWallOnActiveAuthoringLevel(wall, draftLevelInfo?.id)) continue;
      const hitPointMm = {
        xMm: h.point.x * 1000,
        yMm: h.point.z * 1000,
        zMm: h.point.y * 1000,
      };
      const alongT = projectAlongT(hitPointMm, wall.start, wall.end);
      const edgeProximity = Math.min(alongT, 1 - alongT);
      const edgePenalty =
        options?.tool && edgeProximity < 0.04 ? (0.04 - Math.max(0, edgeProximity)) * 12 : 0;
      const frontness = Math.max(
        0,
        -(h.face?.normal?.clone() ?? new THREE.Vector3(0, 0, 1))
          .transformDirection(h.object.matrixWorld)
          .dot(raycaster.ray.direction),
      );
      const grazingPenalty = (1 - Math.min(1, frontness)) * 0.25;
      const score = h.distance + edgePenalty + grazingPenalty;
      const prior = candidates.get(id);
      if (!prior || score < prior.score) {
        candidates.set(id, { wall, hitPointMm, alongT, score });
      }
    }
    if (candidates.size === 0) return null;
    const sorted = [...candidates.values()].sort((a, b) => a.score - b.score);
    let picked = sorted[0]!;
    if (options?.preferWallId) {
      const preferred = candidates.get(options.preferWallId);
      if (options.lockToPreferred) {
        if (!preferred) return null;
        picked = preferred;
      } else if (preferred && preferred.score <= picked.score + 0.08) {
        picked = preferred;
      }
    }
    return {
      wall: picked.wall,
      hitPointMm: picked.hitPointMm,
      alongT: Math.max(0, Math.min(1, picked.alongT)),
    };
  }

  function hostedToolSpec(tool: HostedFamilyTool) {
    return resolveHostedFamilyPlacement({
      tool,
      familyTypeId: activeComponentFamilyTypeId,
      elementsById: elementsByIdRef.current,
    });
  }

  function clampHostedAlongT(
    tool: HostedFamilyTool,
    wall: Extract<Element, { kind: 'wall' }>,
    alongT: number,
  ): number {
    const dx = wall.end.xMm - wall.start.xMm;
    const dy = wall.end.yMm - wall.start.yMm;
    const wallLenMm = Math.max(1, Math.hypot(dx, dy));
    const nominalWidthMm = hostedToolSpec(tool).widthMm;
    const edgeClearanceMm = nominalWidthMm / 2 + 80;
    const margin = Math.max(0.02, Math.min(0.18, edgeClearanceMm / wallLenMm));
    return Math.max(margin, Math.min(1 - margin, alongT));
  }

  function hostedOpeningConflictFor(
    tool: HostedFamilyTool,
    wall: Extract<Element, { kind: 'wall' }>,
    alongT: number,
  ) {
    const dx = wall.end.xMm - wall.start.xMm;
    const dy = wall.end.yMm - wall.start.yMm;
    const wallLengthMm = Math.max(1, Math.hypot(dx, dy));
    const widthMm = hostedToolSpec(tool).widthMm;
    const existing: HostedOpeningLike[] = [];
    for (const element of Object.values(elementsByIdRef.current)) {
      if (element.kind === 'door' || element.kind === 'window') {
        existing.push({
          kind: element.kind,
          id: element.id,
          wallId: element.wallId,
          alongT: element.alongT,
          widthMm: element.widthMm,
        });
      } else if (element.kind === 'wall_opening') {
        existing.push({
          kind: 'wall_opening',
          id: element.id,
          hostWallId: element.hostWallId,
          alongTStart: element.alongTStart,
          alongTEnd: element.alongTEnd,
        });
      }
    }
    return findHostedOpeningConflict({
      wallId: wall.id,
      wallLengthMm,
      alongT,
      widthMm,
      existing,
    });
  }

  function hostedPreviewSegment(
    tool: HostedFamilyTool,
    hit: PickWallAtPointerResult,
    rect: DOMRect,
  ): HostedPreviewSegmentResult | null {
    const center = projectSemanticPointToScreen(hit.hitPointMm, rect);
    if (!center) return null;
    const spec = hostedToolSpec(tool);
    const previewWidthMm = spec.widthMm;
    const dx = hit.wall.end.xMm - hit.wall.start.xMm;
    const dy = hit.wall.end.yMm - hit.wall.start.yMm;
    const wallLenMm = Math.hypot(dx, dy);
    if (wallLenMm < 1) return { center, valid: false };
    const levelsById = new Map(
      Object.values(elementsByIdRef.current)
        .filter((el): el is Extract<Element, { kind: 'level' }> => el.kind === 'level')
        .map((level) => [level.id, level.elevationMm]),
    );
    const baseLevelId = hit.wall.baseConstraintLevelId ?? hit.wall.levelId;
    const baseElevationMm = levelsById.get(baseLevelId) ?? 0;
    const baseZMm = baseElevationMm + (hit.wall.baseConstraintOffsetMm ?? 0);
    const topZMm = Math.max(baseZMm + 100, baseZMm + hit.wall.heightMm);
    const sillMm = tool === 'window' ? (spec.sillHeightMm ?? 900) : (spec.sillHeightMm ?? 0);
    const headMm =
      tool === 'window'
        ? (spec.sillHeightMm ?? 900) + (spec.heightMm ?? 1500)
        : tool === 'wall-opening'
          ? (spec.sillHeightMm ?? 200) + (spec.heightMm ?? 2200)
          : (spec.heightMm ?? 2100);
    const openingBottomMm = Math.min(topZMm - 50, baseZMm + sillMm);
    const openingTopMm = Math.max(openingBottomMm + 50, Math.min(topZMm, baseZMm + headMm));
    const centerT = clampHostedAlongT(tool, hit.wall, hit.alongT);
    const halfDeltaT = previewWidthMm / 2 / wallLenMm;
    const startT = Math.max(0, centerT - halfDeltaT);
    const endT = Math.min(1, centerT + halfDeltaT);
    const startMm = {
      xMm: hit.wall.start.xMm + (hit.wall.end.xMm - hit.wall.start.xMm) * startT,
      yMm: hit.wall.start.yMm + (hit.wall.end.yMm - hit.wall.start.yMm) * startT,
      zMm: hit.hitPointMm.zMm,
    };
    const endMm = {
      xMm: hit.wall.start.xMm + (hit.wall.end.xMm - hit.wall.start.xMm) * endT,
      yMm: hit.wall.start.yMm + (hit.wall.end.yMm - hit.wall.start.yMm) * endT,
      zMm: hit.hitPointMm.zMm,
    };
    const lowerStart = projectSemanticPointToScreen({ ...startMm, zMm: openingBottomMm }, rect);
    const lowerEnd = projectSemanticPointToScreen({ ...endMm, zMm: openingBottomMm }, rect);
    const upperEnd = projectSemanticPointToScreen({ ...endMm, zMm: openingTopMm }, rect);
    const upperStart = projectSemanticPointToScreen({ ...startMm, zMm: openingTopMm }, rect);
    const outline =
      lowerStart && lowerEnd && upperEnd && upperStart
        ? [lowerStart, lowerEnd, upperEnd, upperStart]
        : undefined;
    const auxLines: Array<{ start: ScreenPoint; end: ScreenPoint }> = [];
    let auxArcPath: string | undefined;
    if (tool === 'window' && lowerStart && lowerEnd && upperStart && upperEnd) {
      const midL = { x: (lowerStart.x + upperStart.x) / 2, y: (lowerStart.y + upperStart.y) / 2 };
      const midR = { x: (lowerEnd.x + upperEnd.x) / 2, y: (lowerEnd.y + upperEnd.y) / 2 };
      auxLines.push({ start: midL, end: midR });
    } else if (tool === 'door' && lowerStart && lowerEnd) {
      const mx = (lowerStart.x + lowerEnd.x) / 2;
      const my = (lowerStart.y + lowerEnd.y) / 2;
      const dxScreen = lowerEnd.x - lowerStart.x;
      const dyScreen = lowerEnd.y - lowerStart.y;
      const len = Math.max(1, Math.hypot(dxScreen, dyScreen));
      const nx = -dyScreen / len;
      const ny = dxScreen / len;
      const lift = Math.min(56, len * 0.45);
      const cx2 = mx + nx * lift;
      const cy2 = my + ny * lift;
      auxLines.push({ start: lowerStart, end: { x: mx, y: my } });
      auxArcPath = `M ${lowerStart.x} ${lowerStart.y} Q ${cx2} ${cy2} ${lowerEnd.x} ${lowerEnd.y}`;
    }
    const conflict = hostedOpeningConflictFor(tool, hit.wall, centerT);
    return {
      center,
      start: projectSemanticPointToScreen(startMm, rect) ?? undefined,
      end: projectSemanticPointToScreen(endMm, rect) ?? undefined,
      outline,
      auxLines,
      auxArcPath,
      valid: !conflict,
      invalidReason: conflict
        ? 'This wall span already contains a door/window/opening. Move along the wall.'
        : undefined,
    };
  }

  function dispatchLinePreviewPayload(payload: Authoring3dLinePreviewPayload): void {
    if (payload.tool === 'stair') {
      const levels = resolveDraftLevels();
      const baseIndex = levels.findIndex((level) => level.id === payload.levelId);
      const topLevel = baseIndex >= 0 ? levels[baseIndex + 1] : undefined;
      onSemanticCommandRef.current?.({
        ...linePreviewToSemanticCommand(payload),
        topLevelId: topLevel?.id ?? payload.levelId,
        widthMm: 1100,
        riserMm: 175,
        treadMm: 275,
      });
      return;
    }
    onSemanticCommandRef.current?.(linePreviewToSemanticCommand(payload));
  }

  function handle3dDirectToolClick(cx: number, cy: number): boolean {
    const tool = activeDirect3dTool();
    if (!tool) {
      state.lineDraftStart = null;
      state.polygonDraft = null;
      state.hostPreviewLock = false;
      setAuthoringOverlay(null);
      return false;
    }
    if (tool !== 'door' && tool !== 'window' && tool !== 'wall-opening') {
      state.hostPreviewLock = false;
    }
    if (!POLYGON_3D_AUTHORING_TOOLS.has(tool)) state.polygonDraft = null;
    if (!LINE_3D_AUTHORING_TOOLS.has(tool)) state.lineDraftStart = null;
    if (tool === 'door' || tool === 'window' || tool === 'wall-opening') {
      setDraftPlaneAngleWarning(false);
      const overlay = authoringOverlayRef.current;
      const draftLevelInfo = resolveDraftLevelInfo();
      const hit = pickWallAtPointer(cx, cy, {
        tool,
        preferWallId: overlay?.tool === tool ? overlay.previewHostWallId : undefined,
        lockToPreferred: state.hostPreviewLock,
      });
      const rect = renderer.domElement.getBoundingClientRect();
      const clickScreen = { x: cx - rect.left, y: cy - rect.top };
      let hostWall = hit?.wall ?? null;
      let alongT = hit?.alongT;
      if (
        overlay?.tool === tool &&
        overlay.previewHostWallId &&
        typeof overlay.previewHostAlongT === 'number'
      ) {
        const overlayHost = elementsByIdRef.current[overlay.previewHostWallId];
        if (
          shouldReuseHostedPreviewCommit({
            clickScreen,
            previewCenter: overlay.currentScreen,
            previewOutline: overlay.previewOutlineScreen,
          }) &&
          overlayHost?.kind === 'wall' &&
          isPhysicalHostedOpeningWall(overlayHost) &&
          isWallOnActiveAuthoringLevel(overlayHost, draftLevelInfo?.id) &&
          (!hostWall || hostWall.id !== overlayHost.id)
        ) {
          hostWall = overlayHost;
          alongT = overlay.previewHostAlongT;
        }
      }
      if (!hostWall || alongT === undefined) {
        setAuthoringOverlay((prev) =>
          prev?.tool === tool
            ? {
                ...prev,
                previewOutlineScreen: undefined,
                previewStartScreen: undefined,
                previewEndScreen: undefined,
                previewHostValid: false,
                previewHostWallId: state.hostPreviewLock ? prev.previewHostWallId : undefined,
                previewHostAlongT: state.hostPreviewLock ? prev.previewHostAlongT : undefined,
                previewHostLock: state.hostPreviewLock,
                previewHostInvalidReason: 'No wall host on the active level under the cursor.',
                previewAuxLines: undefined,
                previewAuxArcPath: undefined,
              }
            : prev,
        );
        return true;
      }
      alongT = clampHostedAlongT(tool, hostWall, Math.max(0, Math.min(1, alongT)));
      const conflict = hostedOpeningConflictFor(tool, hostWall, alongT);
      if (conflict) {
        setAuthoringOverlay((prev) =>
          prev?.tool === tool
            ? {
                ...prev,
                previewHostValid: false,
                previewHostWallId: hostWall.id,
                previewHostAlongT: alongT,
                previewHostLock: state.hostPreviewLock,
                previewHostInvalidReason:
                  'This wall span already contains a door/window/opening. Move along the wall.',
              }
            : prev,
        );
        return true;
      }
      const nextPlacementScreen: HostedPlacementDedupeState = {
        key: `${tool}:${Math.round(clickScreen.x / 8)}:${Math.round(clickScreen.y / 8)}`,
        atMs: performance.now(),
      };
      const nextPlacementHost: HostedPlacementDedupeState = {
        key: `${tool}:${hostWall.id}:${Math.round(alongT * 1000)}`,
        atMs: performance.now(),
      };
      if (
        isDuplicateHostedPlacement(state.lastHostedPlacementScreen, nextPlacementScreen, 900) ||
        isDuplicateHostedPlacement(state.lastHostedPlacementHost, nextPlacementHost, 1500)
      ) {
        return true;
      }
      state.lastHostedPlacementScreen = nextPlacementScreen;
      state.lastHostedPlacementHost = nextPlacementHost;
      const hostedSpec = hostedToolSpec(tool);
      const hostedFamilyTypeId = hostedSpec.familyTypeId;
      if (tool === 'door') {
        onSemanticCommandRef.current?.({
          type: 'insertDoorOnWall',
          wallId: hostWall.id,
          alongT,
          widthMm: hostedSpec.widthMm,
          ...(hostedFamilyTypeId ? { familyTypeId: hostedFamilyTypeId } : {}),
        });
        setAuthoringOverlay((prev) =>
          prev?.tool === 'door'
            ? {
                ...prev,
                previewOutlineScreen: undefined,
                previewHostValid: true,
                previewHostInvalidReason: undefined,
                previewAuxLines: undefined,
                previewAuxArcPath: undefined,
              }
            : prev,
        );
        return true;
      }
      if (tool === 'window') {
        onSemanticCommandRef.current?.({
          type: 'insertWindowOnWall',
          wallId: hostWall.id,
          alongT,
          widthMm: hostedSpec.widthMm,
          sillHeightMm: hostedSpec.sillHeightMm ?? 900,
          heightMm: hostedSpec.heightMm ?? 1500,
          ...(hostedFamilyTypeId ? { familyTypeId: hostedFamilyTypeId } : {}),
        });
        setAuthoringOverlay((prev) =>
          prev?.tool === 'window'
            ? {
                ...prev,
                previewOutlineScreen: undefined,
                previewHostValid: true,
                previewHostInvalidReason: undefined,
                previewAuxLines: undefined,
                previewAuxArcPath: undefined,
              }
            : prev,
        );
        return true;
      }
      onSemanticCommandRef.current?.({
        type: 'createWallOpening',
        hostWallId: hostWall.id,
        alongTStart: Math.max(0, alongT - 0.05),
        alongTEnd: Math.min(1, alongT + 0.05),
        sillHeightMm: 200,
        headHeightMm: 2400,
      });
      setAuthoringOverlay((prev) =>
        prev?.tool === 'wall-opening'
          ? {
              ...prev,
              previewOutlineScreen: undefined,
              previewHostValid: true,
              previewHostInvalidReason: undefined,
              previewAuxLines: undefined,
              previewAuxArcPath: undefined,
            }
          : prev,
      );
      return true;
    }
    const levelInfo = resolveDraftLevelInfo();
    if (!levelInfo) return false;
    if (
      (LINE_3D_AUTHORING_TOOLS.has(tool) ||
        POLYGON_3D_AUTHORING_TOOLS.has(tool) ||
        tool === 'column' ||
        tool === 'room' ||
        tool === 'component') &&
      tool !== 'wall' &&
      !isDraftPlaneProjectionStable(cx, cy, levelInfo.elevationMm)
    ) {
      emitWallDebug('blocked-unstable-plane', {
        tool,
        screen: { x: cx, y: cy },
        levelInfo,
        mmPerPx: measureDraftPlaneProjectionMmPerPx(cx, cy, levelInfo.elevationMm),
      });
      setDraftPlaneAngleWarning(true);
      return true;
    }
    setDraftPlaneAngleWarning(false);
    let projected =
      tool === 'wall'
        ? projectPointerToVisibleDraftPlane(cx, cy, levelInfo.elevationMm)
        : projectPointerToDraftPlane(cx, cy, levelInfo.elevationMm);
    if (tool === 'wall' && projected?.blocker) {
      clearWallDraftPreviewGroup();
      emitWallDebug('wall-blocked-hidden-work-plane', {
        screen: clientToCanvasScreen(cx, cy),
        levelInfo,
        blocker: projected.blocker,
        planeDistanceM: projected.distanceM,
      });
      setAuthoringOverlay({
        tool,
        phase: state.lineDraftStart?.tool === 'wall' ? 'pick-end' : 'pick-start',
        levelName: levelInfo.name,
        startScreen: state.lineDraftStart?.screen,
        currentScreen: clientToCanvasScreen(cx, cy),
        currentPointMm: undefined,
        wallProjectionMode: 'plane',
        wallAnchorRequired: true,
        wallPlaneUnreadable: false,
        wallPlaneOccluded: true,
        wallPreviewOutlineScreen: undefined,
        wallPreviewDirectionStartScreen: undefined,
        wallPreviewDirectionEndScreen: undefined,
      });
      return true;
    }
    if (
      !projected &&
      tool === 'wall' &&
      state.lineDraftStart?.tool === 'wall' &&
      state.lineDraftStart.wallBasis
    ) {
      projected = pointFromWallDraftScreenBasis(cx, cy, state.lineDraftStart.wallBasis);
    }
    if (
      !projected &&
      tool === 'wall' &&
      (!state.lineDraftStart || state.lineDraftStart.tool !== tool)
    ) {
      clearWallDraftPreviewGroup();
      emitWallDebug('wall-blocked-no-draft-plane', {
        screen: clientToCanvasScreen(cx, cy),
        levelInfo,
        rawMmPerPx: measureDraftPlaneProjectionMmPerPx(cx, cy, levelInfo.elevationMm),
      });
      setAuthoringOverlay({
        tool,
        phase: 'pick-start',
        levelName: levelInfo.name,
        currentScreen: clientToCanvasScreen(cx, cy),
        currentPointMm: undefined,
        wallProjectionMode: 'plane',
        wallAnchorRequired: true,
        wallPlaneUnreadable: true,
        wallPlaneOccluded: false,
      });
      return true;
    }
    if (!projected && tool === 'wall' && state.lineDraftStart?.tool === 'wall') {
      clearWallDraftPreviewGroup();
      emitWallDebug('wall-blocked-no-draft-plane-end', {
        screen: clientToCanvasScreen(cx, cy),
        start: state.lineDraftStart.point,
        startScreen: state.lineDraftStart.screen,
        levelInfo,
        rawMmPerPx: measureDraftPlaneProjectionMmPerPx(cx, cy, levelInfo.elevationMm),
      });
      setAuthoringOverlay((prev) =>
        prev?.tool === 'wall'
          ? {
              ...prev,
              phase: 'pick-end',
              levelName: levelInfo.name,
              currentScreen: clientToCanvasScreen(cx, cy),
              currentPointMm: undefined,
              wallAnchorRequired: true,
              wallPlaneUnreadable: true,
              wallPlaneOccluded: false,
              wallPreviewOutlineScreen: undefined,
              wallPreviewDirectionStartScreen: undefined,
              wallPreviewDirectionEndScreen: undefined,
            }
          : prev,
      );
      return true;
    }
    if (!projected) return false;
    projected = snapDraftProjectionToActiveWorkPlane(projected, levelInfo, {
      preferWallConnectivity: tool === 'wall',
    });
    if (tool === 'room') {
      onSemanticCommandRef.current?.({
        type: 'placeRoomAtPoint',
        id: crypto.randomUUID(),
        levelId: levelInfo.id,
        clickXMm: projected.point.xMm,
        clickYMm: projected.point.yMm,
        name: 'Room',
      });
      return true;
    }
    if (tool === 'column') {
      onSemanticCommandRef.current?.({
        type: 'createColumn',
        levelId: levelInfo.id,
        positionMm: projected.point,
      });
      return true;
    }
    if (tool === 'component') {
      const assetId = activeComponentAssetId;
      const familyTypeId = activeComponentFamilyTypeId;
      if (!assetId && !familyTypeId) {
        setAuthoringOverlay({
          tool,
          phase: 'pick-point',
          levelName: levelInfo.name,
          currentScreen: projected.screen,
          currentPointMm: projected.point,
          workPlaneElevationMm: levelInfo.elevationMm,
          snapKind: projected.snapKind,
          snapScreen: projected.snapScreen,
          previewHostValid: false,
        });
        return true;
      }
      if (assetId) {
        onSemanticCommandRef.current?.({
          type: 'PlaceAsset',
          assetId,
          levelId: levelInfo.id,
          positionMm: projected.point,
          rotationDeg: pendingComponentRotationDeg,
        });
        return true;
      }
      const selectedFamilyTypeId = familyTypeId as string;
      const familyType = elementsByIdRef.current[selectedFamilyTypeId];
      if (familyType?.kind !== 'family_type' || familyTypePlacesAsDetailComponent(familyType)) {
        setAuthoringOverlay({
          tool,
          phase: 'pick-point',
          levelName: levelInfo.name,
          currentScreen: projected.screen,
          currentPointMm: projected.point,
          workPlaneElevationMm: levelInfo.elevationMm,
          snapKind: projected.snapKind,
          snapScreen: projected.snapScreen,
          previewHostValid: false,
        });
        return true;
      }
      if (familyTypeRequiresWallHost(familyType)) {
        const hostHit = pickWallAtPointer(cx, cy, { tool: 'wall-opening' });
        if (!hostHit) {
          setAuthoringOverlay({
            tool,
            phase: 'pick-wall',
            levelName: levelInfo.name,
            currentScreen: projected.screen,
            currentPointMm: projected.point,
            workPlaneElevationMm: levelInfo.elevationMm,
            snapKind: projected.snapKind,
            snapScreen: projected.snapScreen,
            previewHostValid: false,
          });
          return true;
        }
        onSemanticCommandRef.current?.({
          type: 'placeFamilyInstance',
          familyTypeId: selectedFamilyTypeId,
          levelId: hostHit.wall.levelId,
          positionMm: { xMm: hostHit.hitPointMm.xMm, yMm: hostHit.hitPointMm.yMm },
          rotationDeg: pendingComponentRotationDeg,
          hostElementId: hostHit.wall.id,
          hostAlongT: hostHit.alongT,
        });
        return true;
      }
      onSemanticCommandRef.current?.({
        type: 'placeFamilyInstance',
        familyTypeId: selectedFamilyTypeId,
        levelId: levelInfo.id,
        positionMm: projected.point,
        rotationDeg: pendingComponentRotationDeg,
      });
      return true;
    }
    if (LINE_3D_AUTHORING_TOOLS.has(tool)) {
      if (!state.lineDraftStart || state.lineDraftStart.tool !== tool) {
        const wallDraft =
          tool === 'wall'
            ? createWallDraftScreenBasis(cx, cy, levelInfo.elevationMm, projected)
            : null;
        if (tool === 'wall' && wallDraft && wallDraft.projection.mode !== 'plane') {
          clearWallDraftPreviewGroup();
          emitWallDebug('wall-blocked-unreadable-work-plane', {
            screen: projected.screen,
            point: projected.point,
            levelInfo,
            projection: wallDraft.projection,
            rawMmPerPx: measureDraftPlaneProjectionMmPerPx(cx, cy, levelInfo.elevationMm),
          });
          setAuthoringOverlay({
            tool,
            phase: 'pick-start',
            levelName: levelInfo.name,
            currentScreen: projected.screen,
            currentPointMm: undefined,
            wallProjectionMode: wallDraft.projection.mode,
            wallAnchorRequired: false,
            wallPlaneUnreadable: true,
            wallPlaneOccluded: false,
          });
          return true;
        }
        state.lineDraftStart = {
          tool: tool as 'wall' | 'beam' | 'stair' | 'railing' | 'grid' | 'reference-plane',
          levelId: levelInfo.id,
          point: projected.point,
          screen: projected.screen,
          wallBasis: wallDraft?.basis,
          wallProjection: wallDraft?.projection,
        };
        if (tool === 'wall') {
          clearWallDraftPreviewGroup();
          emitWallDebug('wall-start', {
            screen: projected.screen,
            point: projected.point,
            levelInfo,
            projection: wallDraft?.projection,
            basis: wallDraft?.basis,
            rawMmPerPx: measureDraftPlaneProjectionMmPerPx(cx, cy, levelInfo.elevationMm),
          });
        }
        useBimStore.getState().select(undefined);
        setAuthoringOverlay({
          tool,
          phase: 'pick-end',
          levelName: levelInfo.name,
          startScreen: projected.screen,
          currentScreen: projected.screen,
          currentPointMm: projected.point,
          workPlaneElevationMm: levelInfo.elevationMm,
          snapKind: projected.snapKind,
          snapScreen: projected.snapScreen,
          wallFlipActive: tool === 'wall' ? state.wallFlipNextSegment : undefined,
          wallProjectionMode: tool === 'wall' ? wallDraft?.projection.mode : undefined,
          wallAnchorRequired: false,
          wallPlaneUnreadable: false,
          wallPlaneOccluded: false,
        });
        return true;
      }
      const start = state.lineDraftStart.point;
      const lineProjected =
        tool === 'wall' && state.lineDraftStart.wallBasis
          ? pointFromWallDraftScreenBasis(cx, cy, state.lineDraftStart.wallBasis)
          : projected;
      const end = lineProjected.point;
      const levelId = state.lineDraftStart.levelId;
      if (Math.hypot(end.xMm - start.xMm, end.yMm - start.yMm) < 10) {
        if (tool === 'wall') {
          clearWallDraftPreviewGroup();
          emitWallDebug('wall-short-segment-reset', {
            start,
            end,
            startScreen: state.lineDraftStart.screen,
            endScreen: lineProjected.screen,
            lengthMm: Math.hypot(end.xMm - start.xMm, end.yMm - start.yMm),
          });
        }
        state.lineDraftStart = null;
        setAuthoringOverlay({
          tool,
          phase: 'pick-start',
          levelName: levelInfo.name,
          workPlaneElevationMm: levelInfo.elevationMm,
        });
        return true;
      }
      if (tool === 'wall') {
        const runtime = useBimStore.getState();
        const flip = state.wallFlipNextSegment;
        const effectiveLocationLine = flip
          ? flipWallLocationLineSide(runtime.wallLocationLine)
          : runtime.wallLocationLine;
        const actualStart = start;
        const actualEnd = end;
        const previewPayload = buildLinePreviewPayload({
          tool: 'wall',
          levelId,
          start: actualStart,
          end: actualEnd,
          wall: {
            id: `wall-3d-${Date.now().toString(36)}-${Math.round(Math.random() * 1_000_000).toString(36)}`,
            locationLine: effectiveLocationLine,
            wallTypeId: runtime.activeWallTypeId ?? undefined,
            heightMm: runtime.wallDrawHeightMm,
          },
        });
        const command = linePreviewToSemanticCommand(previewPayload);
        emitWallDebug('wall-commit', {
          previewPayload,
          command,
          startScreen: state.lineDraftStart.screen,
          endScreen: lineProjected.screen,
          projection: state.lineDraftStart.wallProjection,
          basis: state.lineDraftStart.wallBasis,
          screenDelta: state.lineDraftStart.screen
            ? {
                x: lineProjected.screen.x - state.lineDraftStart.screen.x,
                y: lineProjected.screen.y - state.lineDraftStart.screen.y,
              }
            : undefined,
          modelDelta: {
            xMm: actualEnd.xMm - actualStart.xMm,
            yMm: actualEnd.yMm - actualStart.yMm,
          },
          lengthMm: Math.hypot(actualEnd.xMm - actualStart.xMm, actualEnd.yMm - actualStart.yMm),
        });
        state.lineDraftStart = null;
        clearWallDraftPreviewGroup();
        state.wallFlipNextSegment = false;
        dispatchLinePreviewPayload(previewPayload);
      } else {
        const previewPayload = buildLinePreviewPayload({
          tool: state.lineDraftStart.tool,
          levelId,
          start,
          end,
        });
        state.lineDraftStart = null;
        if (tool === 'beam') {
          dispatchLinePreviewPayload(previewPayload);
        } else if (tool === 'stair') {
          dispatchLinePreviewPayload(previewPayload);
        } else if (tool === 'railing') {
          dispatchLinePreviewPayload(previewPayload);
        } else if (tool === 'grid') {
          dispatchLinePreviewPayload(previewPayload);
        } else if (tool === 'reference-plane') {
          dispatchLinePreviewPayload(previewPayload);
        }
      }
      setAuthoringOverlay({
        tool,
        phase: 'pick-start',
        levelName: levelInfo.name,
        workPlaneElevationMm: levelInfo.elevationMm,
        wallFlipActive: tool === 'wall' ? state.wallFlipNextSegment : undefined,
        wallProjectionMode: undefined,
      });
      return true;
    }
    if (POLYGON_3D_AUTHORING_TOOLS.has(tool)) {
      if (!state.polygonDraft || state.polygonDraft.tool !== tool) {
        state.polygonDraft = {
          tool: tool as 'ceiling' | 'floor' | 'roof' | 'shaft' | 'area',
          levelId: levelInfo.id,
          points: [projected.point],
        };
        setAuthoringOverlay({
          tool,
          phase: 'pick-next',
          levelName: levelInfo.name,
          pointsScreen: [projected.screen],
          currentScreen: projected.screen,
          currentPointMm: projected.point,
          workPlaneElevationMm: levelInfo.elevationMm,
          snapKind: projected.snapKind,
          snapScreen: projected.snapScreen,
        });
        return true;
      }
      const priorPoints = authoringOverlayRef.current?.pointsScreen ?? [];
      if (state.polygonDraft.points.length >= 3 && priorPoints[0]) {
        const closeDistancePx = Math.hypot(
          projected.screen.x - priorPoints[0].x,
          projected.screen.y - priorPoints[0].y,
        );
        if (closeDistancePx <= 14) {
          if (tool === 'ceiling') {
            onSemanticCommandRef.current?.(
              polygonPreviewToSemanticCommand(
                buildPolygonPreviewPayload({
                  tool: 'ceiling',
                  levelId: state.polygonDraft.levelId,
                  points: state.polygonDraft.points,
                }),
              ),
            );
          } else if (tool === 'floor') {
            onSemanticCommandRef.current?.(
              polygonPreviewToSemanticCommand(
                buildPolygonPreviewPayload({
                  tool: 'floor',
                  levelId: state.polygonDraft.levelId,
                  points: state.polygonDraft.points,
                }),
              ),
            );
          } else if (tool === 'roof') {
            onSemanticCommandRef.current?.(
              polygonPreviewToSemanticCommand(
                buildPolygonPreviewPayload({
                  tool: 'roof',
                  levelId: state.polygonDraft.levelId,
                  points: state.polygonDraft.points,
                }),
              ),
            );
          } else if (tool === 'area') {
            onSemanticCommandRef.current?.(
              polygonPreviewToSemanticCommand(
                buildPolygonPreviewPayload({
                  tool: 'area',
                  levelId: state.polygonDraft.levelId,
                  points: state.polygonDraft.points,
                }),
              ),
            );
          } else if (tool === 'shaft') {
            const boundaryMm = state.polygonDraft.points.map((p) => ({ xMm: p.xMm, yMm: p.yMm }));
            const draftLevelId = state.polygonDraft.levelId;
            const floors = Object.values(elementsByIdRef.current).filter(
              (el): el is Extract<Element, { kind: 'floor' }> => el.kind === 'floor',
            );
            const hostFloor = floors.find((floor) => floor.levelId === draftLevelId) ?? floors[0];
            if (hostFloor) {
              onSemanticCommandRef.current?.({
                type: 'createSlabOpening',
                hostFloorId: hostFloor.id,
                boundaryMm,
                isShaft: true,
              });
            }
          }
          state.polygonDraft = null;
          setAuthoringOverlay({
            tool,
            phase: 'pick-vertex',
            levelName: levelInfo.name,
            pointsScreen: [],
            workPlaneElevationMm: levelInfo.elevationMm,
          });
          return true;
        }
      }
      state.polygonDraft.points.push(projected.point);
      setAuthoringOverlay({
        tool,
        phase: 'pick-next',
        levelName: levelInfo.name,
        pointsScreen: [...priorPoints, projected.screen],
        currentScreen: projected.screen,
        currentPointMm: projected.point,
        workPlaneElevationMm: levelInfo.elevationMm,
        snapKind: projected.snapKind,
        snapScreen: projected.snapScreen,
      });
    }
    return true;
  }

  return {
    resolveDraftLevelInfo,
    resolveDraftLevels,
    pickWallAtPointer,
    hostedToolSpec,
    hostedPreviewSegment,
    clampHostedAlongT,
    hostedOpeningConflictFor,
    dispatchLinePreviewPayload,
    handle3dDirectToolClick,
  };
}
