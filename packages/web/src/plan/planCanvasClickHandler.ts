/**
 * Plan-canvas tool-click dispatcher extracted from PlanCanvas.tsx.
 *
 * The giant `useEffect` in PlanCanvas.tsx hosts a ~1,970-line `onClick`
 * handler that dispatches the click event across all 64 plan tools (wall,
 * dimension, elevation, copy/mirror/rotate/scale/array, paint, split,
 * trim, wall-opening, shaft, column, stair, roof variants, etc.).
 *
 * This module lifts that dispatcher into a session factory that receives
 * the live THREE refs, the per-tool state-machine refs, the React state
 * setters, the level/view selectors, and the in-place helper closures
 * (snap resolver, preview helpers, pick helpers) from the surrounding
 * `useEffect`. The behaviour is byte-identical to the inline version.
 */
import * as THREE from 'three';
import type { MutableRefObject } from 'react';
import type { Element, XY } from '@bim-ai/core';

import {
  initialBeamSystemState,
  initialCeilingState,
  initialColumnState,
  initialExcavationState,
  initialRevisionCloudState,
  initialShaftState,
  reduceAlign,
  reduceAreaBoundary,
  reduceArray,
  reduceBeam,
  reduceBeamSystem,
  reduceCeiling,
  reduceColumn,
  reduceColumnAtGrids,
  reduceConicalRoof,
  reduceDetailFilledRegion,
  reduceDetailLine,
  reduceDomeRoof,
  reduceExcavation,
  reduceGradedRegion,
  reduceLeaderText,
  reduceLinework,
  reduceMeasureAngle,
  reduceMeasureArc,
  reduceModelLine,
  reducePermanentDim,
  reducePlaceGroup,
  reduceRamp,
  reduceRevisionCloud,
  reduceRoofByExtrusion,
  reduceScale,
  reduceShaft,
  reduceSpireRoof,
  reduceSplit,
  reduceSplitWall,
  reduceStairLanding,
  reduceStairRun,
  reduceSteelConnection,
  reduceTerrainPad,
  reduceTerrainPoint,
  reduceTerrainSplit,
  reduceTextAnnotation,
  reduceTrim,
  reduceWallJoin,
  reduceWallOpening,
  type AlignState,
  type ArrayState,
  type BeamState,
  type BeamSystemState,
  type CeilingState,
  type ColumnAtGridsState,
  type ColumnState,
  type ConicalRoofState,
  type DetailFilledRegionState,
  type DetailLineState,
  type DomeRoofState,
  type ExcavationState,
  type GradedRegionState,
  type LeaderTextState,
  type LineworkState,
  type MeasureAngleState,
  type MeasureArcState,
  type ModelLineState,
  type PermanentDimState,
  type PlaceGroupState,
  type RampState,
  type RevisionCloudState,
  type RoofByExtrusionState,
  type ScaleState,
  type ShaftState,
  type SpireRoofState,
  type SplitState,
  type SplitWallState,
  type StairLandingState,
  type StairRunState,
  type SteelConnectionState,
  type TerrainPadState,
  type TerrainPointState,
  type TerrainSplitState,
  type TextAnnotationState,
  type TrimState,
  type WallJoinState,
  type WallOpeningState,
} from '../tools/toolGrammar';
import { useBimStore, type PlanTool } from '../state/store';
import type { DraftMutation, GripDescriptor } from './gripProtocol';
import type { PlanViewResolvedDisplay } from './planProjection';
import type { Draft } from './planCanvasHelpers';
import type { PickedWallLine } from './wallPickLines';
import type {
  PlanCanvasElementContextMenuState,
  PlanCanvasUnhideContextMenuState,
  PlanCanvasWallContextMenuState,
  PlanCanvasWallJoinContextMenuState,
} from './PlanCanvasContextOverlays';
import type { ToggleableSnapKind } from './snapSettings';
import type { SnapHit, SnapKind } from './snapEngine';
import {
  handleDoorWindowToolClick,
  handleQueryToolClick,
  handleTagToolClick,
} from './planCanvasClickHandlers';
import { handleBoundaryToolClick } from './planCanvasBoundaryClicks';
import { handleMeasureDraftClick } from './planCanvasMeasureDraftClicks';
import { handleSelectClick } from './planCanvasSelectClick';
import { createWallFromPickedLineCommand, hasOverlappingWallLine } from './wallPickLines';
import { flipWallLocationLineSide } from '../geometry/wallConnectivity';
import { shouldBlockWallCommitOutsideCrop, WALL_CROP_BLOCK_MESSAGE } from './wallDraftLifecycle';
import { findAreaPlacementBoundary, type AreaPlanPlacementContext } from './areaPlacement';
import { elevationFromWall } from '../lib/sectionElevationFromWall';
import { moveDeltaMm } from './moveTool';
import { wallOffsetMoveCommandFromPoint } from './wallOffsetTool';
import { parseTypedRotateAngle, rotateDeltaAngleFromReference } from './rotateTool';
import { buildWallRadiusFillet, type MmPoint } from './wallRadiusFillet';
import {
  familyTypePlacesAsDetailComponent,
  familyTypeRequiresWallHost,
} from '../families/familyPlacementRuntime';
import { detectCeilingBoundary } from './ceilingAutoDetect';
import { detectFloorBoundaryFromWalls } from './detectFloorBoundaryFromWalls';
import { validateBoundary } from './structuralValidation';
import { nearestWallAt } from './selection/nearestWall';
import { nextWallDraftAfterCommit } from './wallDraftLifecycle';
import { rayToPlanMm } from './interaction/planCameraMath';
import { initialPermanentDimState } from '../tools/toolGrammar';
import type { PlanCanvasCropRenderState } from './planCanvasRenderPasses';
import {
  activeComponentAssetId,
  activeComponentFamilyTypeId,
  columnDrawUsage,
  copyMultipleEnabled,
  lineworkColorHex,
  lineworkLineWeightPx,
  getLineworkLineDash,
  mirrorCopyEnabled,
  pendingComponentRotationDeg,
  type SubdivisionCategory,
} from '../workspace/authoring';
import type { DxfPrimitiveQueryHit } from './dxfUnderlay';
import { buildScaleCommand, distanceMm } from './scaleTool';
import { linearArrayOffsets, radialArrayAngles, radialOffsetForElement } from './arrayTool';
import { getFamilyById as getBuiltInFamilyById } from '../families/familyCatalog';
import type { FamilyDefinition } from '../families/types';
import { copyElementsToClipboard, pasteElementsFromClipboard } from '../clipboard/copyPaste';
import { useToolPrefs } from '../tools/toolPrefsStore';

type MutableRef<T> = MutableRefObject<T>;
type StateSetter<T> = (value: T | ((prev: T) => T)) => void;
type PlanCameraMutableState = { camX: number; camZ: number; half: number };
type SnapGlyphState = {
  candidates: Array<{
    kind: SnapKind;
    pxX: number;
    pxY: number;
    extensionFromPxX?: number;
    extensionFromPxY?: number;
    associative?: boolean;
  }>;
  activeIndex: number;
};
type ScreenPoint = { pxX: number; pxY: number };
type NumericInputState = { value: string; pxX: number; pxY: number };
type LeaderTextOverlay = {
  anchorMm: { xMm: number; yMm: number };
  elbowMm: { xMm: number; yMm: number };
  textMm: { xMm: number; yMm: number };
  screenX: number;
  screenY: number;
  draft: string;
};
type TextAnnotOverlay = {
  positionMm: { xMm: number; yMm: number };
  screenX: number;
  screenY: number;
  draft: string;
};
type PickWallAtPointerHit = {
  start: XY;
  end: XY;
  sourceLabel: string;
  source: string;
  associativeId?: string;
};
type AreaPlanContext = () => AreaPlanPlacementContext | null;
type ActiveCropState = (PlanCanvasCropRenderState & { planViewId: string }) | null;

export interface PlanCanvasClickHandlerArgs {
  // THREE & camera
  rnd: THREE.WebGLRenderer;
  camNow: THREE.OrthographicCamera;
  cameraRef: MutableRef<THREE.OrthographicCamera | null>;
  camRef: MutableRef<PlanCameraMutableState>;
  grp: THREE.Group;
  componentGhostRef: MutableRef<THREE.Group | null>;
  previewRef: MutableRef<THREE.Line | null>;

  // Outer view state
  planTool: PlanTool;
  lvlId: string | undefined;
  displayLevelId: string | undefined;
  activeLevelResolvedId: string;
  activePlanViewId: string | null | undefined;
  display: PlanViewResolvedDisplay;
  elementsById: Record<string, Element>;
  selectedId: string | undefined;
  selectedIds: string[];
  selectLinkedEnabled: boolean;
  revealHiddenMode: boolean;
  scalePhase: ScaleState['phase'];
  arrayPhase: ArrayState['phase'];
  activeCropState: ActiveCropState;

  // Refs (mutable component scope)
  skipClickRef: MutableRef<boolean>;
  draftRef: MutableRef<Draft | undefined>;
  wallFlipRef: MutableRef<boolean>;
  copyAnchorRef: MutableRef<XY | null>;
  moveAnchorRef: MutableRef<XY | null>;
  mirrorAxisStartRef: MutableRef<XY | null>;
  rotateAnchorRef: MutableRef<XY | null>;
  rotateReferenceRef: MutableRef<XY | null>;
  trimExtendFirstWallRef: MutableRef<string | null>;
  wallOpeningAnchorRef: MutableRef<XY | null>;
  snapOverrideRef: MutableRef<ToggleableSnapKind | null>;

  // Tool state refs
  alignStateRef: MutableRef<AlignState>;
  arrayStateRef: MutableRef<ArrayState>;
  beamStateRef: MutableRef<BeamState>;
  beamSystemStateRef: MutableRef<BeamSystemState>;
  ceilingStateRef: MutableRef<CeilingState>;
  columnAtGridsStateRef: MutableRef<ColumnAtGridsState>;
  columnStateRef: MutableRef<ColumnState>;
  conicalRoofStateRef: MutableRef<ConicalRoofState>;
  detailFilledRegionStateRef: MutableRef<DetailFilledRegionState>;
  detailLineStateRef: MutableRef<DetailLineState>;
  domeRoofStateRef: MutableRef<DomeRoofState>;
  excavationStateRef: MutableRef<ExcavationState>;
  gradedRegionStateRef: MutableRef<GradedRegionState>;
  leaderTextStateRef: MutableRef<LeaderTextState>;
  lineworkStateRef: MutableRef<LineworkState>;
  measureAngleStateRef: MutableRef<MeasureAngleState>;
  measureArcStateRef: MutableRef<MeasureArcState>;
  modelLineStateRef: MutableRef<ModelLineState>;
  permanentDimStateRef: MutableRef<PermanentDimState>;
  placeGroupStateRef: MutableRef<PlaceGroupState>;
  rampStateRef: MutableRef<RampState>;
  revisionCloudStateRef: MutableRef<RevisionCloudState>;
  roofByExtrusionStateRef: MutableRef<RoofByExtrusionState>;
  scaleStateRef: MutableRef<ScaleState>;
  shaftStateRef: MutableRef<ShaftState>;
  spireRoofStateRef: MutableRef<SpireRoofState>;
  splitStateRef: MutableRef<SplitState>;
  splitWallStateRef: MutableRef<SplitWallState>;
  stairLandingStateRef: MutableRef<StairLandingState>;
  stairRunStateRef: MutableRef<StairRunState>;
  stairStateRef: MutableRef<BeamState>;
  steelConnectionStateRef: MutableRef<SteelConnectionState>;
  terrainPadStateRef: MutableRef<TerrainPadState>;
  terrainPointStateRef: MutableRef<TerrainPointState>;
  terrainSplitStateRef: MutableRef<TerrainSplitState>;
  textAnnotStateRef: MutableRef<TextAnnotationState>;
  trimStateRef: MutableRef<TrimState>;
  wallJoinStateRef: MutableRef<WallJoinState>;
  wallOpeningStateRef: MutableRef<WallOpeningState>;

  // State setters
  bumpGeom: StateSetter<number>;
  selectEl: (id: string | undefined) => void;
  setActiveGripId: StateSetter<string | null>;
  setActiveLevelId: (id: string) => void;
  setAlignReferenceMm: StateSetter<XY | null>;
  setArrayPhase: StateSetter<ArrayState['phase']>;
  setBoundaryValidationError: StateSetter<string | null>;
  setCanvasCtxMenu: StateSetter<{ x: number; y: number } | null>;
  setCopyAnchorSet: StateSetter<boolean>;
  setDraftMutation: StateSetter<DraftMutation | null>;
  setDxfQueryDialog: StateSetter<{
    hit: DxfPrimitiveQueryHit;
    position: { x: number; y: number };
  } | null>;
  setDxfQueryHover: StateSetter<DxfPrimitiveQueryHit | null>;
  setElementCtxMenu: StateSetter<PlanCanvasElementContextMenuState | null>;
  setLeaderTextOverlay: StateSetter<LeaderTextOverlay | null>;
  setMeasureAngleReadout: StateSetter<{ angleDeg: number } | null>;
  setMeasureArcReadout: StateSetter<{ arcLengthMm: number; radiusMm: number } | null>;
  setMeasureReadout: StateSetter<{ distMm: number } | null>;
  setMirrorAxisSet: StateSetter<boolean>;
  setMoveAnchorSet: StateSetter<boolean>;
  setNumericInput: StateSetter<NumericInputState | null>;
  setPendingPlanRegion: StateSetter<{
    x0: number;
    x1: number;
    y0: number;
    y1: number;
    lvlId: string;
    cutPlaneDraft: string;
  } | null>;
  setPlanTool: (tool: PlanTool) => void;
  setRoofByExtrusionPhase: StateSetter<RoofByExtrusionState['phase']>;
  setRotateAnchorSet: StateSetter<boolean>;
  setRotateReferenceSet: StateSetter<boolean>;
  setScalePhase: StateSetter<ScaleState['phase']>;
  setSnapGlyphState: StateSetter<SnapGlyphState>;
  setSnapOverrideDisplay: StateSetter<ToggleableSnapKind | null>;
  setTextAnnotOverlay: StateSetter<TextAnnotOverlay | null>;
  setTrimExtendFirstWallSet: StateSetter<boolean>;
  setUnhideContextMenu: StateSetter<PlanCanvasUnhideContextMenuState | null>;
  setWallContextMenu: StateSetter<PlanCanvasWallContextMenuState | null>;
  setWallDraftNotice: StateSetter<string | null>;
  setWallJoinCtxMenu: StateSetter<PlanCanvasWallJoinContextMenuState | null>;
  setWallPickLineHint: (value: PickedWallLine | null) => void;

  // Methods + helpers
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
  activateElevationView: (id: string) => void;
  activatePlanView: (id: string) => void;
  worldToScreen: (point: XY) => ScreenPoint;
  clearSubdivisionDraft: () => void;

  // Locals from the surrounding useEffect (snap resolver + preview/pick helpers)
  snapped: (clientX: number, clientY: number) => XY | undefined;
  clearPreview: () => void;
  clearMarqueeLine: () => void;
  commitAreaBoundary: (boundaryMm: XY[]) => boolean;
  redrawAreaBoundaryPreviewMm: (
    verts: Array<{ xMm: number; yMm: number }>,
    cursorMm?: { xMm: number; yMm: number },
  ) => void;
  activeAreaPlanContext: AreaPlanContext;
  areaSnapPoint: (raw: XY) => XY;
  pickedWallLineAt: (point: XY, toleranceMm: number) => PickedWallLine | null;
  wallPickToleranceMm: () => number;
}

export function createPlanCanvasClickHandler(args: PlanCanvasClickHandlerArgs) {
  const {
    rnd,
    camNow,
    cameraRef,
    camRef,
    grp,
    componentGhostRef,
    previewRef,
    planTool,
    lvlId,
    displayLevelId,
    activeLevelResolvedId,
    activePlanViewId,
    display,
    elementsById,
    selectedId,
    selectedIds,
    selectLinkedEnabled,
    revealHiddenMode,
    scalePhase,
    arrayPhase,
    activeCropState,
    skipClickRef,
    draftRef,
    wallFlipRef,
    copyAnchorRef,
    moveAnchorRef,
    mirrorAxisStartRef,
    rotateAnchorRef,
    rotateReferenceRef,
    trimExtendFirstWallRef,
    wallOpeningAnchorRef,
    snapOverrideRef,
    alignStateRef,
    arrayStateRef,
    beamStateRef,
    beamSystemStateRef,
    ceilingStateRef,
    columnAtGridsStateRef,
    columnStateRef,
    conicalRoofStateRef,
    detailFilledRegionStateRef,
    detailLineStateRef,
    domeRoofStateRef,
    excavationStateRef,
    gradedRegionStateRef,
    leaderTextStateRef,
    lineworkStateRef,
    measureAngleStateRef,
    measureArcStateRef,
    modelLineStateRef,
    permanentDimStateRef,
    placeGroupStateRef,
    rampStateRef,
    revisionCloudStateRef,
    roofByExtrusionStateRef,
    scaleStateRef,
    shaftStateRef,
    spireRoofStateRef,
    splitStateRef,
    splitWallStateRef,
    stairLandingStateRef,
    stairRunStateRef,
    stairStateRef,
    steelConnectionStateRef,
    terrainPadStateRef,
    terrainPointStateRef,
    terrainSplitStateRef,
    textAnnotStateRef,
    trimStateRef,
    wallJoinStateRef,
    wallOpeningStateRef,
    bumpGeom,
    selectEl,
    setActiveGripId,
    setActiveLevelId,
    setAlignReferenceMm,
    setArrayPhase,
    setBoundaryValidationError,
    setCanvasCtxMenu,
    setCopyAnchorSet,
    setDraftMutation,
    setDxfQueryDialog,
    setDxfQueryHover,
    setElementCtxMenu,
    setLeaderTextOverlay,
    setMeasureAngleReadout,
    setMeasureArcReadout,
    setMeasureReadout,
    setMirrorAxisSet,
    setMoveAnchorSet,
    setNumericInput,
    setPendingPlanRegion,
    setPlanTool,
    setRoofByExtrusionPhase,
    setRotateAnchorSet,
    setRotateReferenceSet,
    setScalePhase,
    setSnapGlyphState,
    setSnapOverrideDisplay,
    setTextAnnotOverlay,
    setTrimExtendFirstWallSet,
    setUnhideContextMenu,
    setWallContextMenu,
    setWallDraftNotice,
    setWallJoinCtxMenu,
    setWallPickLineHint,
    onSemanticCommand,
    activateElevationView,
    activatePlanView,
    worldToScreen,
    clearSubdivisionDraft,
    snapped,
    clearPreview,
    clearMarqueeLine,
    commitAreaBoundary,
    redrawAreaBoundaryPreviewMm,
    activeAreaPlanContext,
    areaSnapPoint,
    pickedWallLineAt,
    wallPickToleranceMm,
  } = args;

  const onClick = (ev: MouseEvent) => {
    if (skipClickRef.current) {
      skipClickRef.current = false;
      return;
    }
    const sp = snapped(ev.clientX, ev.clientY);
    if (!sp || !lvlId) return;
    // F-080 — consume the one-shot snap override after the click lands.
    if (snapOverrideRef.current) {
      snapOverrideRef.current = null;
      setSnapOverrideDisplay(null);
    }
    if (planTool === 'select') {
      handleSelectClick({
        renderer: rnd,
        camera: camNow,
        group: grp,
        event: ev,
        elementsById,
        selectLinkedEnabled,
        selectElement: selectEl,
        onSemanticCommand,
      });
      return;
    }
    if (planTool === 'query') {
      handleQueryToolClick({
        renderer: rnd,
        cameraHalf: camRef.current.half,
        event: ev,
        pointMm: sp,
        elementsById,
        activeLevelResolvedId,
        displayLevelId,
        activePlanViewId,
        setDxfQueryHover,
        setDxfQueryDialog,
      });
      return;
    }
    if (planTool === 'tag') {
      handleTagToolClick({
        renderer: rnd,
        camera: camNow,
        group: grp,
        event: ev,
        pointMm: sp,
        elementsById,
        activePlanViewId,
        onSemanticCommand,
      });
      return;
    }
    if (planTool === 'door') {
      handleDoorWindowToolClick({
        tool: 'door',
        pointMm: sp,
        elementsById,
        displayLevelId,
        activeComponentFamilyTypeId,
        onSemanticCommand,
      });
      return;
    }
    if (planTool === 'window') {
      handleDoorWindowToolClick({
        tool: 'window',
        pointMm: sp,
        elementsById,
        displayLevelId,
        activeComponentFamilyTypeId,
        onSemanticCommand,
      });
      return;
    }
    if (planTool === 'wall') {
      const d = draftRef.current;
      if (!d || d.kind !== 'wall') {
        const pickedLine = pickedWallLineAt(sp, wallPickToleranceMm());
        if (pickedLine) {
          const { wallLocationLine, wallDrawHeightMm, activeWallTypeId } = useBimStore.getState();
          const pickLevelId = displayLevelId || activeLevelResolvedId || lvlId;
          if (
            hasOverlappingWallLine(
              useBimStore.getState().elementsById,
              pickLevelId,
              pickedLine,
              wallPickToleranceMm(),
            )
          ) {
            setWallDraftNotice(`Existing wall already overlaps ${pickedLine.sourceLabel}.`);
            setWallPickLineHint(pickedLine);
            return;
          }
          onSemanticCommand(
            createWallFromPickedLineCommand(pickedLine, {
              id: crypto.randomUUID(),
              levelId: pickLevelId,
              wallTypeId: activeWallTypeId,
              locationLine: wallLocationLine,
              heightMm: wallDrawHeightMm,
            }),
          );
          setWallDraftNotice(`Created wall from ${pickedLine.sourceLabel}.`);
          setWallPickLineHint(null);
          clearPreview();
          bumpGeom((x) => x + 1);
          return;
        }
        setWallDraftNotice(null);
        draftRef.current = { kind: 'wall', sx: sp.xMm, sy: sp.yMm };
        bumpGeom((x) => x + 1);
        return;
      }
      const {
        wallLocationLine,
        wallDrawHeightMm,
        activeWallTypeId,
        wallDrawOffsetMm,
        wallDrawRadiusMm,
      } = useBimStore.getState();
      let startX = d.sx;
      let startY = d.sy;
      let endX = sp.xMm;
      let endY = sp.yMm;
      if (wallDrawOffsetMm !== 0) {
        const dx = endX - startX;
        const dy = endY - startY;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          const px = (-dy / len) * wallDrawOffsetMm;
          const py = (dx / len) * wallDrawOffsetMm;
          startX += px;
          startY += py;
          endX += px;
          endY += py;
        }
      }
      const flipped = wallFlipRef.current;
      wallFlipRef.current = false;
      const effectiveLocationLine = flipped
        ? flipWallLocationLineSide(wallLocationLine)
        : wallLocationLine;
      const pathStart = { xMm: startX, yMm: startY };
      const pathEnd = { xMm: endX, yMm: endY };
      if (shouldBlockWallCommitOutsideCrop(activeCropState, pathStart, pathEnd)) {
        setWallDraftNotice(WALL_CROP_BLOCK_MESSAGE);
        bumpGeom((x) => x + 1);
        return;
      }
      setWallDraftNotice(null);
      const createWallCommand = (
        id: string,
        start: MmPoint,
        end: MmPoint,
        wallCurve?: NonNullable<Extract<Element, { kind: 'wall' }>['wallCurve']>,
      ) => ({
        type: 'createWall',
        id,
        levelId: lvlId,
        start,
        end,
        ...(wallCurve ? { wallCurve } : {}),
        locationLine: effectiveLocationLine,
        wallTypeId: activeWallTypeId ?? undefined,
        heightMm: wallDrawHeightMm,
      });
      const pendingWallCommands: Record<string, unknown>[] = [];
      const dispatchWallCommand = (id: string, start: MmPoint, end: MmPoint) => {
        const actualStart = start;
        const actualEnd = end;
        pendingWallCommands.push(createWallCommand(id, actualStart, actualEnd));
        return {
          id,
          pathStart: start,
          pathEnd: end,
          actualStart,
          actualEnd,
          cornerEndpoint: 'end' as const,
        };
      };
      let previousWallForChain:
        | NonNullable<Extract<Draft, { kind: 'wall' }>['previousWall']>
        | undefined;
      const previousWall = d.previousWall;
      const canFillet =
        wallDrawRadiusMm !== null &&
        wallDrawRadiusMm > 0 &&
        previousWall !== undefined &&
        Math.hypot(
          previousWall.pathEnd.xMm - pathStart.xMm,
          previousWall.pathEnd.yMm - pathStart.yMm,
        ) < 1;
      const fillet = canFillet
        ? buildWallRadiusFillet(
            previousWall!.pathStart,
            previousWall!.pathEnd,
            pathEnd,
            wallDrawRadiusMm ?? 0,
          )
        : null;
      if (fillet) {
        const adjustedStart =
          previousWall!.cornerEndpoint === 'start' ? fillet.previousEnd : previousWall!.actualStart;
        const adjustedEnd =
          previousWall!.cornerEndpoint === 'end' ? fillet.previousEnd : previousWall!.actualEnd;
        pendingWallCommands.push({
          type: 'moveWallEndpoints',
          wallId: previousWall!.id,
          start: adjustedStart,
          end: adjustedEnd,
        });
        const arcWallId = crypto.randomUUID();
        pendingWallCommands.push(
          createWallCommand(arcWallId, fillet.previousEnd, fillet.currentStart, fillet.wallCurve),
        );
        const arcWallForChain = {
          id: arcWallId,
          pathStart: fillet.previousEnd,
          pathEnd: fillet.currentStart,
          actualStart: fillet.previousEnd,
          actualEnd: fillet.currentStart,
          cornerEndpoint: 'end' as const,
        };
        if (
          Math.hypot(pathEnd.xMm - fillet.currentStart.xMm, pathEnd.yMm - fillet.currentStart.yMm) >
          1
        ) {
          previousWallForChain = dispatchWallCommand(
            crypto.randomUUID(),
            fillet.currentStart,
            pathEnd,
          );
        } else {
          previousWallForChain = arcWallForChain;
        }
      } else {
        previousWallForChain = dispatchWallCommand(crypto.randomUUID(), pathStart, pathEnd);
      }
      void (async () => {
        for (const cmd of pendingWallCommands) {
          await onSemanticCommand(cmd);
        }
      })();
      // EDT-V3-05: re-arm from endpoint when loop mode is on.
      draftRef.current =
        nextWallDraftAfterCommit({
          loopMode: useToolPrefs.getState().loopMode,
          endpoint: { xMm: sp.xMm, yMm: sp.yMm },
          previousWallForChain,
        }) ?? undefined;
      clearPreview();
      bumpGeom((x) => x + 1);
      return;
    }
    if (
      handleMeasureDraftClick({
        planTool,
        pointMm: sp,
        levelId: lvlId,
        draftRef,
        measureAngleStateRef,
        measureArcStateRef,
        setMeasureReadout,
        setMeasureAngleReadout,
        setMeasureArcReadout,
        onSemanticCommand,
        clearPreview,
        bumpGeom,
      })
    ) {
      return;
    }
    if (planTool === 'dimension') {
      if (permanentDimStateRef.current.phase === 'idle') {
        const { state } = reducePermanentDim(permanentDimStateRef.current, {
          kind: 'activate',
          levelId: lvlId ?? displayLevelId ?? 'lvl-0',
        });
        permanentDimStateRef.current = state;
      }
      const { state, effect } = reducePermanentDim(permanentDimStateRef.current, {
        kind: 'click',
        xMm: sp.xMm,
        yMm: sp.yMm,
      });
      permanentDimStateRef.current = state;
      if (effect.createPermanentDim) {
        const { levelId: dimLevel, witnessPointsMm, offsetMm } = effect.createPermanentDim;
        onSemanticCommand({
          type: 'create_permanent_dimension',
          id: crypto.randomUUID(),
          levelId: dimLevel,
          witnessPointsMm,
          offsetMm,
        });
        permanentDimStateRef.current = initialPermanentDimState();
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'elevation') {
      // VIE-03: drop an elevation marker. Auto-orient toward the nearest
      // exterior wall when one is reasonably close; otherwise default to
      // 'north'.
      const n = nearestWallAt(elementsById, displayLevelId || undefined, sp.xMm, sp.yMm);
      const params =
        n && n.distMm < 5000
          ? elevationFromWall(n.wall)
          : {
              direction: 'north' as const,
              customAngleDeg: null as number | null,
              cropMinMm: { xMm: sp.xMm - 4000, yMm: sp.yMm - 4000 },
              cropMaxMm: { xMm: sp.xMm + 4000, yMm: sp.yMm + 4000 },
              name: 'North Elevation',
            };
      const cmd: Record<string, unknown> = {
        type: 'createElevationView',
        name: params.name,
        direction: params.direction,
        cropMinMm: params.cropMinMm,
        cropMaxMm: params.cropMaxMm,
      };
      if (params.direction === 'custom' && params.customAngleDeg !== null) {
        cmd.customAngleDeg = params.customAngleDeg;
      }
      onSemanticCommand(cmd);
      return;
    }
    if (planTool === 'interior-elevation') {
      // D2: place a 4-direction interior elevation marker inside a room.
      // The server auto-creates four elevation_view children (N/S/E/W).
      const markerId = `iem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      onSemanticCommand({
        type: 'create_interior_elevation_marker',
        id: markerId,
        positionMm: { xMm: sp.xMm, yMm: sp.yMm },
        levelId: lvlId ?? displayLevelId ?? 'lvl-0',
        radiusMm: 3000,
      });
      return;
    }
    if (
      handleBoundaryToolClick({
        planTool,
        pointMm: sp,
        areaClickMm: rayToPlanMm(rnd, camNow, ev.clientX, ev.clientY) ?? sp,
        shiftKey: ev.shiftKey,
        levelId: lvlId,
        draftRef,
        hasActiveAreaPlanContext: () => Boolean(activeAreaPlanContext()),
        areaSnapPoint,
        findAreaBoundaryForClick: (pointMm) => {
          const ctx = activeAreaPlanContext();
          return ctx ? findAreaPlacementBoundary(elementsById, ctx, pointMm) : null;
        },
        commitAreaBoundary,
        redrawAreaBoundaryPreviewMm,
        setPendingPlanRegion,
        selectElement: (id) => {
          selectEl(id);
          useBimStore.getState().clearSelectedIds();
        },
        onSemanticCommand,
        clearPreview,
        bumpGeom,
      })
    ) {
      return;
    }
    if (planTool === 'masking-region') {
      // KRN-10: Now handled by SketchCanvas overlay. This fallback is no longer needed.
      return;
    }
    if (planTool === 'revision-cloud') {
      const { state: rcState, effect: rcEffect } = reduceRevisionCloud(
        revisionCloudStateRef.current,
        { kind: 'click', pointMm: { xMm: sp.xMm, yMm: sp.yMm } },
      );
      revisionCloudStateRef.current = rcState;
      if (rcEffect.commitPointsMm && activePlanViewId) {
        void onSemanticCommand({
          type: 'createRevisionCloud',
          hostViewId: activePlanViewId,
          boundaryMm: rcEffect.commitPointsMm,
          colour: '#e05000',
        });
        revisionCloudStateRef.current = initialRevisionCloudState();
        draftRef.current = undefined;
        clearPreview();
      } else {
        draftRef.current = { kind: 'revision-cloud', points: rcState.pointsMm };
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'model-line') {
      const { state: mlState } = reduceModelLine(modelLineStateRef.current, {
        kind: 'click',
        pointMm: { xMm: sp.xMm, yMm: sp.yMm },
      });
      modelLineStateRef.current = mlState;
      draftRef.current = { kind: 'model-line', points: mlState.pointsMm };
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'align') {
      const { state: nextState, effect } = reduceAlign(alignStateRef.current, {
        kind: 'click',
        pointMm: sp,
      });
      alignStateRef.current = nextState;
      // F-121: sync reference point into React state so the SVG overlay re-renders.
      setAlignReferenceMm(nextState.referenceMm);
      if (effect.commitAlign) {
        const tMm = effect.commitAlign.targetMm;
        const wallHit = nearestWallAt(elementsById, displayLevelId || undefined, tMm.xMm, tMm.yMm);
        let targetId: string | undefined;
        let bestDist = wallHit && wallHit.distMm < 900 ? wallHit.distMm : Infinity;
        if (wallHit && wallHit.distMm < 900) targetId = wallHit.wall.id;
        for (const el of Object.values(elementsById)) {
          if (el.kind !== 'column' && el.kind !== 'placed_asset') continue;
          if (displayLevelId && (el as { levelId?: string }).levelId !== displayLevelId) continue;
          const pos = (el as { positionMm?: { xMm: number; yMm: number } }).positionMm;
          if (!pos) continue;
          const dist = Math.hypot(pos.xMm - tMm.xMm, pos.yMm - tMm.yMm);
          if (dist < bestDist) {
            bestDist = dist;
            targetId = el.id;
          }
        }
        if (targetId) {
          onSemanticCommand({
            type: 'alignElementToReference',
            targetElementId: targetId,
            referenceMm: effect.commitAlign.referenceMm,
          });
        }
      }
      return;
    }
    if (planTool === 'mirror') {
      if (!mirrorAxisStartRef.current) {
        // First click: store axis start point
        mirrorAxisStartRef.current = sp;
        setMirrorAxisSet(true);
        bumpGeom((x) => x + 1);
        return;
      }
      // Second click: fire mirrorElements with the selected element
      const axisStart = mirrorAxisStartRef.current;
      mirrorAxisStartRef.current = null;
      setMirrorAxisSet(false);
      if (selectedId) {
        onSemanticCommand({
          type: 'mirrorElements',
          elementIds: [selectedId],
          axis: { startMm: axisStart, endMm: sp },
          alsoCopy: mirrorCopyEnabled,
        });
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'copy') {
      if (!selectedId) return;
      if (!copyAnchorRef.current) {
        // First click: store reference (source) point
        copyAnchorRef.current = sp;
        setCopyAnchorSet(true);
        bumpGeom((x) => x + 1);
        return;
      }
      // Second click: compute delta and duplicate the element
      const anchor = copyAnchorRef.current;
      // F-116: multi-copy — clear anchor but stay in copy mode if Multiple is checked.
      copyAnchorRef.current = null;
      setCopyAnchorSet(false);
      const { dxMm: dx, dyMm: dy } = moveDeltaMm(anchor, sp, ev.shiftKey);
      const st = useBimStore.getState();
      const sourceEl = st.elementsById[selectedId];
      if (sourceEl) {
        const localUserFamilies = st.userFamilies ?? {};
        const resolveFamilyById = (id: string): FamilyDefinition | undefined =>
          localUserFamilies[id] ?? getBuiltInFamilyById(id);
        const payload = copyElementsToClipboard({
          sourceProjectId: st.modelId ?? 'unknown-project',
          sourceModelId: st.modelId ?? 'unknown-model',
          elements: [sourceEl],
          resolveFamilyById,
        });
        const result = pasteElementsFromClipboard({
          payload,
          targetProjectId: st.modelId ?? 'unknown-project',
          localFamilies: [],
          // Use the destination point shifted by the element's own position
          // so the copy lands exactly where the user clicked.
          cursorMm: { xMm: dx, yMm: dy },
          sameProjectOffsetMm: 0,
        });
        if (result.elements.length > 0) {
          st.mergeElements(result.elements);
        }
      }
      // F-116: If "Multiple" is unchecked, exit back to select after placing copy.
      if (!copyMultipleEnabled) {
        setPlanTool('select');
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'move') {
      if (!moveAnchorRef.current) {
        // First click: store reference point
        moveAnchorRef.current = sp;
        setMoveAnchorSet(true);
        bumpGeom((x) => x + 1);
        return;
      }
      // Second click: compute delta and move selection
      const anchor = moveAnchorRef.current;
      moveAnchorRef.current = null;
      setMoveAnchorSet(false);
      const dx = sp.xMm - anchor.xMm;
      const dy = sp.yMm - anchor.yMm;
      const elementIds = [selectedId, ...selectedIds].filter(Boolean) as string[];
      if (elementIds.length > 0) {
        onSemanticCommand({
          type: 'moveElementsDelta',
          elementIds,
          dxMm: dx,
          dyMm: dy,
        });
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'offset') {
      const selected = selectedId ? elementsById[selectedId] : undefined;
      if (selected?.kind !== 'wall') return;
      const command = wallOffsetMoveCommandFromPoint(selected, sp, selectedIds);
      if (command) {
        onSemanticCommand(command);
        setPlanTool('select');
        bumpGeom((x) => x + 1);
      }
      return;
    }
    if (planTool === 'rotate') {
      if (!rotateAnchorRef.current) {
        // First click: store center of rotation
        rotateAnchorRef.current = sp;
        setRotateAnchorSet(true);
        rotateReferenceRef.current = null;
        setRotateReferenceSet(false);
        setNumericInput(null);
        bumpGeom((x) => x + 1);
        return;
      }
      if (!rotateReferenceRef.current) {
        // Second click: store the start-angle reference ray.
        rotateReferenceRef.current = sp;
        setRotateReferenceSet(true);
        setNumericInput(null);
        bumpGeom((x) => x + 1);
        return;
      }
      // Third click: compute delta from reference ray to endpoint and rotate selection.
      const anchor = rotateAnchorRef.current;
      const reference = rotateReferenceRef.current;
      rotateAnchorRef.current = null;
      setRotateAnchorSet(false);
      rotateReferenceRef.current = null;
      setRotateReferenceSet(false);
      setNumericInput(null);
      const angleDeg = rotateDeltaAngleFromReference(anchor, reference, sp);
      const elementIds = [selectedId, ...selectedIds].filter(Boolean) as string[];
      if (elementIds.length > 0) {
        onSemanticCommand({
          type: 'rotateElements',
          elementIds,
          centerXMm: anchor.xMm,
          centerYMm: anchor.yMm,
          angleDeg,
        });
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'scale') {
      const { state, effect } = reduceScale(scaleStateRef.current, {
        kind: 'click',
        xMm: sp.xMm,
        yMm: sp.yMm,
      });
      scaleStateRef.current = state;
      setScalePhase(state.phase);
      if (effect.commitScale) {
        const { originMm, factor } = effect.commitScale;
        if (selectedId) {
          void onSemanticCommand(
            buildScaleCommand(selectedId, originMm, factor) as unknown as Record<string, unknown>,
          );
        }
      }
      if (effect.commitGraphicalScale) {
        const { originMm, referenceMm, destinationMm } = effect.commitGraphicalScale;
        const refDist = distanceMm(originMm, referenceMm);
        const destDist = distanceMm(originMm, destinationMm);
        const factor = refDist > 0 ? destDist / refDist : 1;
        if (selectedId) {
          void onSemanticCommand(
            buildScaleCommand(selectedId, originMm, factor) as unknown as Record<string, unknown>,
          );
        }
      }
      if (!effect.stillActive) setPlanTool('select');
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'array') {
      const { state, effect } = reduceArray(arrayStateRef.current, {
        kind: 'click',
        xMm: sp.xMm,
        yMm: sp.yMm,
      });
      arrayStateRef.current = state;
      setArrayPhase(state.phase);
      if (effect.commitLinear) {
        const { startMm, endMm, count, moveToLast } = effect.commitLinear;
        const offsets = linearArrayOffsets({ mode: 'linear', startMm, endMm, count, moveToLast });
        const st = useBimStore.getState();
        const srcIds = [selectedId, ...selectedIds].filter(Boolean) as string[];
        for (let i = 1; i < offsets.length; i++) {
          const { dxMm, dyMm } = offsets[i]!;
          for (const srcId of srcIds) {
            const srcEl = st.elementsById[srcId];
            if (!srcEl) continue;
            const localUserFamilies = st.userFamilies ?? {};
            const resolveFamilyById = (id: string): FamilyDefinition | undefined =>
              localUserFamilies[id] ?? getBuiltInFamilyById(id);
            const payload = copyElementsToClipboard({
              sourceProjectId: st.modelId ?? 'unknown',
              sourceModelId: st.modelId ?? 'unknown',
              elements: [srcEl],
              resolveFamilyById,
            });
            const result = pasteElementsFromClipboard({
              payload,
              targetProjectId: st.modelId ?? 'unknown',
              localFamilies: [],
              cursorMm: { xMm: dxMm, yMm: dyMm },
              sameProjectOffsetMm: 0,
            });
            if (result.elements.length > 0) st.mergeElements(result.elements);
          }
        }
      }
      if (effect.commitRadial) {
        const { centerMm, angleDeg, count } = effect.commitRadial;
        const angles = radialArrayAngles({ mode: 'radial', centerMm, angleDeg, count });
        const st = useBimStore.getState();
        const srcIds = [selectedId, ...selectedIds].filter(Boolean) as string[];
        for (let i = 1; i < angles.length; i++) {
          const angle = angles[i]!;
          for (const srcId of srcIds) {
            const srcEl = st.elementsById[srcId];
            if (!srcEl) continue;
            const elCenterX =
              'start' in srcEl ? (srcEl as { start: { xMm: number } }).start.xMm : 0;
            const elCenterY =
              'start' in srcEl ? (srcEl as { start: { yMm: number } }).start.yMm : 0;
            const { dxMm, dyMm } = radialOffsetForElement(
              centerMm,
              { xMm: elCenterX, yMm: elCenterY },
              angle,
            );
            const localUserFamilies = st.userFamilies ?? {};
            const resolveFamilyById = (id: string): FamilyDefinition | undefined =>
              localUserFamilies[id] ?? getBuiltInFamilyById(id);
            const payload = copyElementsToClipboard({
              sourceProjectId: st.modelId ?? 'unknown',
              sourceModelId: st.modelId ?? 'unknown',
              elements: [srcEl],
              resolveFamilyById,
            });
            const result = pasteElementsFromClipboard({
              payload,
              targetProjectId: st.modelId ?? 'unknown',
              localFamilies: [],
              cursorMm: { xMm: dxMm, yMm: dyMm },
              sameProjectOffsetMm: 0,
            });
            if (result.elements.length > 0) st.mergeElements(result.elements);
          }
        }
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'place-group') {
      const { state, effect } = reducePlaceGroup(placeGroupStateRef.current, {
        kind: 'click',
        positionMm: sp,
      });
      placeGroupStateRef.current = state;
      if (effect.commitPlaceGroup) {
        const { definitionId, positionMm } = effect.commitPlaceGroup;
        void onSemanticCommand({
          type: 'placeGroup',
          groupDefinitionId: definitionId,
          insertionXMm: positionMm.xMm,
          insertionYMm: positionMm.yMm,
          rotationDeg: 0,
        });
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'roof-by-extrusion') {
      const { state, effect } = reduceRoofByExtrusion(
        roofByExtrusionStateRef.current,
        { kind: 'click', xMm: sp.xMm, yMm: sp.yMm },
        lvlId ?? '',
      );
      roofByExtrusionStateRef.current = state;
      setRoofByExtrusionPhase(state.phase);
      if (effect.createRoofByExtrusion) {
        const { profilePoints, depthMm, levelId, slopeAngleDeg } = effect.createRoofByExtrusion;
        void onSemanticCommand({
          type: 'createRoof',
          referenceLevelId: levelId,
          footprintMm: profilePoints,
          extrusionDepthMm: depthMm,
          slopeDeg: slopeAngleDeg,
        });
      }
      if (!effect.stillActive) setPlanTool('select');
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'linework') {
      const rectBox = rnd.domElement.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((ev.clientX - rectBox.left) / rectBox.width) * 2 - 1,
          -(((ev.clientY - rectBox.top) / rectBox.height) * 2 - 1),
        ),
        camNow,
      );
      const hits = ray.intersectObjects(grp.children, true);
      const h = hits.find(
        (x) => typeof (x.object.userData as { bimPickId?: unknown }).bimPickId === 'string',
      );
      const pickedElementId =
        typeof (h?.object.userData as { bimPickId?: unknown }).bimPickId === 'string'
          ? (h!.object.userData as { bimPickId: string }).bimPickId
          : undefined;
      if (pickedElementId && activePlanViewId) {
        const { effect } = reduceLinework(lineworkStateRef.current, {
          kind: 'click',
          elementId: pickedElementId,
          colorHex: lineworkColorHex,
          lineWeightPx: lineworkLineWeightPx,
          lineDash: getLineworkLineDash(),
        });
        if (effect.applyLineworkOverride) {
          void onSemanticCommand({
            type: 'apply_linework_override',
            viewId: activePlanViewId,
            ...effect.applyLineworkOverride,
          });
        }
      }
      return;
    }
    if (planTool === 'paint') {
      const rectBox = rnd.domElement.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((ev.clientX - rectBox.left) / rectBox.width) * 2 - 1,
          -(((ev.clientY - rectBox.top) / rectBox.height) * 2 - 1),
        ),
        camNow,
      );
      const hits = ray.intersectObjects(grp.children, true);
      const h = hits.find(
        (x) => typeof (x.object.userData as { bimPickId?: unknown }).bimPickId === 'string',
      );
      const pickedElementId =
        typeof (h?.object.userData as { bimPickId?: unknown }).bimPickId === 'string'
          ? (h!.object.userData as { bimPickId: string }).bimPickId
          : undefined;
      if (pickedElementId) {
        const paintMaterialKey = useBimStore.getState().activePaintMaterialId ?? 'concrete';
        void onSemanticCommand({
          type: 'paintFace',
          elementId: pickedElementId,
          faceKey: 'front',
          materialKey: paintMaterialKey,
        });
      }
      return;
    }
    if (planTool === 'component') {
      const assetId = activeComponentAssetId;
      const familyTypeId = activeComponentFamilyTypeId;
      if (assetId && lvlId) {
        onSemanticCommand({
          type: 'PlaceAsset',
          assetId,
          levelId: lvlId,
          positionMm: sp,
          rotationDeg: pendingComponentRotationDeg,
        });
        bumpGeom((x) => x + 1);
      } else if (familyTypeId) {
        const familyType = elementsById[familyTypeId];
        if (familyType?.kind === 'family_type') {
          const placesAsDetail = familyTypePlacesAsDetailComponent(familyType);
          const requiresWallHost = familyTypeRequiresWallHost(familyType);
          const wallHit = requiresWallHost
            ? nearestWallAt(elementsById, displayLevelId || undefined, sp.xMm, sp.yMm)
            : undefined;
          if (!requiresWallHost || (wallHit && wallHit.distMm <= 900)) {
            onSemanticCommand({
              type: 'placeFamilyInstance',
              familyTypeId,
              ...(placesAsDetail
                ? { hostViewId: activePlanViewId }
                : {
                    levelId: lvlId,
                    ...(requiresWallHost ? { hostViewId: activePlanViewId } : {}),
                  }),
              positionMm: sp,
              rotationDeg: pendingComponentRotationDeg,
              ...(wallHit ? { hostElementId: wallHit.wall.id, hostAlongT: wallHit.alongT } : {}),
            });
            bumpGeom((x) => x + 1);
          }
        }
      }
      // Clear ghost after placement so it does not linger if the cursor leaves the canvas.
      if (componentGhostRef.current) {
        grp.remove(componentGhostRef.current);
        componentGhostRef.current = null;
      }
      return;
    }
    if (planTool === 'split') {
      const { state: nextState, effect } = reduceSplit(splitStateRef.current, {
        kind: 'click',
        pointMm: sp,
      });
      splitStateRef.current = nextState;
      if (effect.commitSplit) {
        const nearest = nearestWallAt(
          elementsById,
          displayLevelId || undefined,
          effect.commitSplit.pointMm.xMm,
          effect.commitSplit.pointMm.yMm,
        );
        if (nearest && nearest.distMm < 900 && nearest.alongT > 0.001 && nearest.alongT < 0.999) {
          onSemanticCommand({
            type: 'splitWallAt',
            wallId: nearest.wall.id,
            alongT: nearest.alongT,
          });
        }
      }
      return;
    }
    if (planTool === 'split-wall') {
      const nearest = nearestWallAt(elementsById, displayLevelId || undefined, sp.xMm, sp.yMm);
      if (nearest && nearest.distMm < 900 && nearest.alongT > 0.001 && nearest.alongT < 0.999) {
        const pointMm = {
          xMm:
            nearest.wall.start.xMm +
            (nearest.wall.end.xMm - nearest.wall.start.xMm) * nearest.alongT,
          yMm:
            nearest.wall.start.yMm +
            (nearest.wall.end.yMm - nearest.wall.start.yMm) * nearest.alongT,
        };
        const { effect } = reduceSplitWall(splitWallStateRef.current, {
          kind: 'click',
          wallId: nearest.wall.id,
          pointMm,
        });
        splitWallStateRef.current = {
          phase: 'active',
          hoverWallId: nearest.wall.id,
          hoverPointMm: pointMm,
        };
        if (effect.splitWall) {
          void onSemanticCommand({
            type: 'split_wall',
            wallId: effect.splitWall.wallId,
            splitPointMm: effect.splitWall.splitPointMm,
          });
        }
      }
      return;
    }
    if (planTool === 'trim') {
      const rectBox = rnd.domElement.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((ev.clientX - rectBox.left) / rectBox.width) * 2 - 1,
          -(((ev.clientY - rectBox.top) / rectBox.height) * 2 - 1),
        ),
        camNow,
      );
      const hits = ray.intersectObjects(grp.children, true);
      const hitEl = hits.find(
        (x) => typeof (x.object.userData as { bimPickId?: unknown }).bimPickId === 'string',
      );
      const elementId =
        typeof (hitEl?.object.userData as { bimPickId?: unknown }).bimPickId === 'string'
          ? (hitEl!.object.userData as { bimPickId: string }).bimPickId
          : undefined;

      if (trimStateRef.current.phase === 'pick-reference') {
        if (elementId) {
          const { state: nextState } = reduceTrim(trimStateRef.current, {
            kind: 'click-reference',
            elementId,
          });
          trimStateRef.current = nextState;
        }
      } else {
        if (elementId) {
          const refEl = elementId
            ? elementsById[trimStateRef.current.referenceId ?? '']
            : undefined;
          const endHint: 'start' | 'end' = (() => {
            const target = elementsById[elementId];
            if (!target || target.kind !== 'wall') return 'start';
            const dStart = Math.hypot(sp.xMm - target.start.xMm, sp.yMm - target.start.yMm);
            const dEnd = Math.hypot(sp.xMm - target.end.xMm, sp.yMm - target.end.yMm);
            return dStart < dEnd ? 'start' : 'end';
          })();
          void refEl;
          const { state: nextState, effect } = reduceTrim(trimStateRef.current, {
            kind: 'click-target',
            elementId,
            endHint,
          });
          trimStateRef.current = nextState;
          if (effect.commitTrim) {
            const refResolved = elementsById[effect.commitTrim.referenceId];
            const tgtResolved = elementsById[effect.commitTrim.targetId];
            if (refResolved?.kind === 'wall' && tgtResolved?.kind === 'wall') {
              onSemanticCommand({
                type: 'trimElementToReference',
                referenceWallId: effect.commitTrim.referenceId,
                targetWallId: effect.commitTrim.targetId,
                endHint: effect.commitTrim.endHint,
              });
            }
          }
        }
      }
      return;
    }
    if (planTool === 'trim-extend') {
      const nearestWall = nearestWallAt(elementsById, displayLevelId || undefined, sp.xMm, sp.yMm);
      if (!nearestWall || nearestWall.distMm > 900) return;
      if (!trimExtendFirstWallRef.current) {
        // First click: pick wall A
        trimExtendFirstWallRef.current = nearestWall.wall.id;
        setTrimExtendFirstWallSet(true);
        selectEl(nearestWall.wall.id);
      } else if (trimExtendFirstWallRef.current !== nearestWall.wall.id) {
        // Second click: trim/extend both walls to their intersection
        onSemanticCommand({
          type: 'trimExtendToCorner',
          wallIdA: trimExtendFirstWallRef.current,
          wallIdB: nearestWall.wall.id,
        });
        trimExtendFirstWallRef.current = null;
        setTrimExtendFirstWallSet(false);
      }
      return;
    }
    if (planTool === 'wall-join') {
      const rect = rnd.domElement.getBoundingClientRect();
      const worldPerPxMm = (2 * camRef.current.half * 1000) / Math.max(1, rect.width);
      const threshMm = 12 * worldPerPxMm;
      let bestCorner: { xMm: number; yMm: number } | null = null;
      let bestDist = Infinity;
      for (const el of Object.values(elementsById)) {
        if (el.kind !== 'wall') continue;
        for (const pt of [el.start, el.end]) {
          const d = Math.hypot(sp.xMm - pt.xMm, sp.yMm - pt.yMm);
          if (d < bestDist) {
            bestDist = d;
            bestCorner = pt;
          }
        }
      }
      if (bestCorner && bestDist <= threshMm) {
        const cornerWallIds: string[] = [];
        for (const el of Object.values(elementsById)) {
          if (el.kind !== 'wall') continue;
          if (
            Math.hypot(bestCorner.xMm - el.start.xMm, bestCorner.yMm - el.start.yMm) < 1 ||
            Math.hypot(bestCorner.xMm - el.end.xMm, bestCorner.yMm - el.end.yMm) < 1
          ) {
            cornerWallIds.push(el.id);
          }
        }
        const { state } = reduceWallJoin(wallJoinStateRef.current, {
          kind: 'click-corner',
          cornerMm: bestCorner,
          wallIds: cornerWallIds,
        });
        wallJoinStateRef.current = state;
      }
      return;
    }
    if (planTool === 'wall-opening') {
      if (wallOpeningStateRef.current.phase === 'pick-wall') {
        // Find nearest wall
        const rect = rnd.domElement.getBoundingClientRect();
        const worldPerPxMm = (2 * camRef.current.half * 1000) / Math.max(1, rect.width);
        const threshMm = 12 * worldPerPxMm;
        let bestWall: string | null = null;
        let bestDist = Infinity;
        for (const el of Object.values(elementsById)) {
          if (el.kind !== 'wall') continue;
          const mx = (el.start.xMm + el.end.xMm) / 2;
          const mz = (el.start.yMm + el.end.yMm) / 2;
          const d = Math.hypot(sp.xMm - mx, sp.yMm - mz);
          if (d < bestDist) {
            bestDist = d;
            bestWall = el.id;
          }
        }
        if (bestWall && bestDist <= threshMm * 8) {
          const { state } = reduceWallOpening(wallOpeningStateRef.current, {
            kind: 'click-wall',
            wallId: bestWall,
            pointMm: sp,
          });
          wallOpeningStateRef.current = state;
          wallOpeningAnchorRef.current = sp;
        }
      }
      return;
    }
    if (planTool === 'shaft') {
      const fst = shaftStateRef.current.verticesMm[0];
      const rect2 = rnd.domElement.getBoundingClientRect();
      const worldPerPxMm2 = (2 * camRef.current.half * 1000) / Math.max(1, rect2.width);
      const threshMm2 = 12 * worldPerPxMm2;
      if (
        fst &&
        shaftStateRef.current.verticesMm.length >= 3 &&
        Math.hypot(sp.xMm - fst.xMm, sp.yMm - fst.yMm) <= threshMm2
      ) {
        const { effect } = reduceShaft(shaftStateRef.current, { kind: 'close-loop' });
        shaftStateRef.current = initialShaftState();
        if (effect.commitShaft) {
          const shaftBoundary = effect.commitShaft.verticesMm;
          const shaftIssues = validateBoundary('shaft-sketch', shaftBoundary);
          const shaftBlocking = shaftIssues.filter((i) => i.severity === 'error');
          if (shaftBlocking.length > 0) {
            setBoundaryValidationError(shaftBlocking.map((i) => i.message).join(' '));
            bumpGeom((x) => x + 1);
            return;
          }
          setBoundaryValidationError(null);
          // Pick the floor under the centroid of the sketch loop.
          const centroid = shaftBoundary.reduce(
            (acc, p) => ({ xMm: acc.xMm + p.xMm, yMm: acc.yMm + p.yMm }),
            { xMm: 0, yMm: 0 },
          );
          centroid.xMm /= shaftBoundary.length;
          centroid.yMm /= shaftBoundary.length;
          const hostFloor = Object.values(elementsById).find(
            (e): e is Extract<Element, { kind: 'floor' }> =>
              e.kind === 'floor' && (!displayLevelId || e.levelId === displayLevelId),
          );
          if (hostFloor) {
            onSemanticCommand({
              type: 'createSlabOpening',
              hostFloorId: hostFloor.id,
              boundaryMm: shaftBoundary.map((p) => ({ xMm: p.xMm, yMm: p.yMm })),
              isShaft: true,
            });
          }
        }
      } else {
        const { state } = reduceShaft(shaftStateRef.current, { kind: 'click', pointMm: sp });
        shaftStateRef.current = state;
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'column') {
      const { effect } = reduceColumn(columnStateRef.current, { kind: 'click', pointMm: sp });
      columnStateRef.current = initialColumnState();
      if (effect.commitColumn && lvlId) {
        const { columnDrawHeightMm, columnDrawWidthMm, columnDrawDepthMm } = useBimStore.getState();
        onSemanticCommand({
          type: 'createColumn',
          levelId: lvlId,
          positionMm: effect.commitColumn.positionMm,
          heightMm: columnDrawHeightMm,
          bMm: columnDrawWidthMm,
          hMm: columnDrawDepthMm,
          columnUsage: columnDrawUsage,
        });
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'conical-roof') {
      const { state, effect } = reduceConicalRoof(conicalRoofStateRef.current, {
        kind: 'click',
        pointMm: sp,
      });
      conicalRoofStateRef.current = state;
      if (effect.createConicalRoof) {
        onSemanticCommand({
          type: 'create_conical_roof',
          id: crypto.randomUUID(),
          centerMm: effect.createConicalRoof.centerMm,
          baseRadiusMm: effect.createConicalRoof.baseRadiusMm,
          heightMm: effect.createConicalRoof.baseRadiusMm,
          baseElevationMm: lvlId
            ? ((useBimStore.getState().elementsById[lvlId] as { elevationMm?: number })
                ?.elevationMm ?? 0) + 3000
            : 3000,
        });
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'dome-roof') {
      const { state, effect } = reduceDomeRoof(domeRoofStateRef.current, {
        kind: 'click',
        pointMm: sp,
      });
      domeRoofStateRef.current = state;
      if (effect.createDomeRoof) {
        onSemanticCommand({
          type: 'create_dome_roof',
          id: crypto.randomUUID(),
          centerMm: effect.createDomeRoof.centerMm,
          baseRadiusMm: effect.createDomeRoof.baseRadiusMm,
          riseRatio: 0.5,
          baseElevationMm: lvlId
            ? ((useBimStore.getState().elementsById[lvlId] as { elevationMm?: number })
                ?.elevationMm ?? 0) + 3000
            : 3000,
        });
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'spire-roof') {
      const { state, effect } = reduceSpireRoof(spireRoofStateRef.current, {
        kind: 'click',
        pointMm: sp,
      });
      spireRoofStateRef.current = state;
      if (effect.createSpireRoof) {
        onSemanticCommand({
          type: 'create_spire_roof',
          id: crypto.randomUUID(),
          centerMm: effect.createSpireRoof.centerMm,
          baseRadiusMm: effect.createSpireRoof.baseRadiusMm,
          heightMm: effect.createSpireRoof.baseRadiusMm * 4,
          baseElevationMm: lvlId
            ? ((useBimStore.getState().elementsById[lvlId] as { elevationMm?: number })
                ?.elevationMm ?? 0) + 3000
            : 3000,
        });
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'beam') {
      const { state, effect } = reduceBeam(beamStateRef.current, { kind: 'click', pointMm: sp });
      beamStateRef.current = state;
      if (effect.commitBeam && lvlId) {
        onSemanticCommand({
          type: 'createBeam',
          levelId: lvlId,
          startMm: effect.commitBeam.startMm,
          endMm: effect.commitBeam.endMm,
        });
        // EDT-V3-05: re-arm from endpoint when loop mode is on.
        if (useToolPrefs.getState().loopMode) {
          beamStateRef.current = { phase: 'first-point', startMm: effect.commitBeam.endMm };
        }
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'stair') {
      const { state, effect } = reduceBeam(stairStateRef.current, {
        kind: 'click',
        pointMm: sp,
      });
      stairStateRef.current = state;
      if (effect.commitBeam && lvlId) {
        const { stairDrawBaseLevelId, stairDrawTopLevelId, stairDrawWidthMm, stairDrawRunWidthMm } =
          useBimStore.getState();
        onSemanticCommand({
          type: 'createStair',
          baseLevelId: stairDrawBaseLevelId ?? lvlId,
          topLevelId: stairDrawTopLevelId ?? undefined,
          runStartMm: effect.commitBeam.startMm,
          runEndMm: effect.commitBeam.endMm,
          widthMm: stairDrawWidthMm,
          runWidthMm: stairDrawRunWidthMm,
          // §2.5.3: auto-create shaft void unless Shift is held
          autoShaft: !ev.shiftKey,
        });
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'ramp') {
      const { state: rs, effect: re } = reduceRamp(rampStateRef.current, {
        kind: 'click',
        pointMm: sp,
      });
      rampStateRef.current = rs;
      if (re.createRamp && lvlId) {
        const rdx = re.createRamp.endMm.xMm - re.createRamp.startMm.xMm;
        const rdy = re.createRamp.endMm.yMm - re.createRamp.startMm.yMm;
        const runMm = Math.hypot(rdx, rdy);
        const runAngleDeg = (Math.atan2(rdy, rdx) * 180) / Math.PI;
        onSemanticCommand({
          type: 'createElement',
          element: {
            kind: 'ramp',
            id: crypto.randomUUID(),
            name: 'Ramp',
            levelId: lvlId,
            topLevelId: lvlId,
            widthMm: re.createRamp.widthMm,
            runMm,
            runAngleDeg,
            insertionXMm: re.createRamp.startMm.xMm,
            insertionYMm: re.createRamp.startMm.yMm,
            hasRailingLeft: true,
            hasRailingRight: true,
            slopePercent: re.createRamp.slopeRatio * 100,
          },
        });
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'stair-run') {
      const srRect = rnd.domElement.getBoundingClientRect();
      const srRay = new THREE.Raycaster();
      srRay.setFromCamera(
        new THREE.Vector2(
          ((ev.clientX - srRect.left) / srRect.width) * 2 - 1,
          -(((ev.clientY - srRect.top) / srRect.height) * 2 - 1),
        ),
        camNow,
      );
      const srHits = srRay.intersectObjects(grp.children, true);
      const srHit = srHits.find(
        (x) => typeof (x.object.userData as { bimPickId?: unknown }).bimPickId === 'string',
      );
      const srElementId = srHit
        ? (srHit.object.userData as { bimPickId: string }).bimPickId
        : undefined;
      const { state: srNext, effect: srEffect } = reduceStairRun(stairRunStateRef.current, {
        kind: 'click',
        pointMm: sp,
        elementId: srElementId,
      });
      stairRunStateRef.current = srNext;
      if (srEffect?.kind === 'addStairRun') {
        void onSemanticCommand({
          type: 'addStairRun',
          run: { ...srEffect.run, id: crypto.randomUUID(), kind: 'stair_run' },
        });
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'stair-landing') {
      const slRect = rnd.domElement.getBoundingClientRect();
      const slRay = new THREE.Raycaster();
      slRay.setFromCamera(
        new THREE.Vector2(
          ((ev.clientX - slRect.left) / slRect.width) * 2 - 1,
          -(((ev.clientY - slRect.top) / slRect.height) * 2 - 1),
        ),
        camNow,
      );
      const slHits = slRay.intersectObjects(grp.children, true);
      const slHit = slHits.find(
        (x) => typeof (x.object.userData as { bimPickId?: unknown }).bimPickId === 'string',
      );
      const slElementId = slHit
        ? (slHit.object.userData as { bimPickId: string }).bimPickId
        : undefined;
      const { state: slNext, effect: slEffect } = reduceStairLanding(stairLandingStateRef.current, {
        kind: 'click',
        pointMm: sp,
        elementId: slElementId,
      });
      stairLandingStateRef.current = slNext;
      if (slEffect?.kind === 'addStairLanding') {
        void onSemanticCommand({
          type: 'addStairLanding',
          landing: { ...slEffect.landing, id: crypto.randomUUID(), kind: 'stair_landing' },
        });
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'steel-connection') {
      const px = sp.xMm / 1000;
      const pz = sp.yMm / 1000;
      const pickedEl = Object.values(elementsById).find((el) => {
        if (el.kind === 'beam') {
          const sx = el.startMm.xMm / 1000;
          const sz = el.startMm.yMm / 1000;
          const ex = el.endMm.xMm / 1000;
          const ez = el.endMm.yMm / 1000;
          const dx = ex - sx;
          const dz = ez - sz;
          const len2 = dx * dx + dz * dz;
          if (len2 < 1e-9) return false;
          const tParam = Math.max(0, Math.min(1, ((px - sx) * dx + (pz - sz) * dz) / len2));
          const dist = Math.hypot(px - (sx + tParam * dx), pz - (sz + tParam * dz));
          return dist < 0.5;
        }
        if (el.kind === 'column') {
          const cx2 = el.positionMm.xMm / 1000;
          const cz2 = el.positionMm.yMm / 1000;
          return Math.hypot(px - cx2, pz - cz2) < 0.5;
        }
        return false;
      });
      if (pickedEl) {
        const { state: scState, effect } = reduceSteelConnection(steelConnectionStateRef.current, {
          kind: 'click',
          pickedElementId: pickedEl.id,
        });
        steelConnectionStateRef.current = scState;
        if (effect.createSteelConnection) {
          onSemanticCommand({
            type: 'create_steel_connection',
            id: crypto.randomUUID(),
            hostElementId: effect.createSteelConnection.hostElementId,
            connectionType: effect.createSteelConnection.connectionType,
            targetElementId: effect.createSteelConnection.targetElementId,
            positionT: effect.createSteelConnection.positionT,
          });
        }
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'ceiling') {
      const rect = rnd.domElement.getBoundingClientRect();
      const worldPerPxMm = (2 * camRef.current.half * 1000) / Math.max(1, rect.width);
      const threshMm = 12 * worldPerPxMm;
      const fst =
        ceilingStateRef.current.phase === 'sketch'
          ? ceilingStateRef.current.verticesMm[0]
          : undefined;
      if (
        fst &&
        (ceilingStateRef.current as { verticesMm: unknown[] }).verticesMm.length >= 3 &&
        Math.hypot(sp.xMm - fst.xMm, sp.yMm - fst.yMm) <= threshMm
      ) {
        const { effect } = reduceCeiling(ceilingStateRef.current, { kind: 'close-loop' });
        ceilingStateRef.current = initialCeilingState();
        if (effect.commitCeiling && lvlId) {
          const ceilingBoundary = effect.commitCeiling.verticesMm;
          const ceilingIssues = validateBoundary('ceiling-sketch', ceilingBoundary);
          const ceilingBlocking = ceilingIssues.filter((i) => i.severity === 'error');
          if (ceilingBlocking.length > 0) {
            setBoundaryValidationError(ceilingBlocking.map((i) => i.message).join(' '));
          } else {
            setBoundaryValidationError(null);
            onSemanticCommand({
              type: 'createCeiling',
              levelId: lvlId,
              boundaryMm: ceilingBoundary.map((p) => ({ xMm: p.xMm, yMm: p.yMm })),
            });
          }
        }
      } else if (ceilingStateRef.current.phase === 'idle' && !ev.shiftKey) {
        // Single-click auto-detect: find enclosing wall boundary.
        const levelWalls = Object.values(elementsById).filter(
          (el): el is Extract<(typeof elementsById)[string], { kind: 'wall' }> =>
            el.kind === 'wall',
        );
        const autoBoundary = lvlId ? detectCeilingBoundary(sp, levelWalls, lvlId) : null;
        if (autoBoundary && autoBoundary.length >= 3 && lvlId) {
          const autoIssues = validateBoundary('ceiling-sketch', autoBoundary);
          const autoBlocking = autoIssues.filter((i) => i.severity === 'error');
          if (autoBlocking.length > 0) {
            setBoundaryValidationError(autoBlocking.map((i) => i.message).join(' '));
          } else {
            setBoundaryValidationError(null);
            onSemanticCommand({
              type: 'createCeiling',
              levelId: lvlId,
              boundaryMm: autoBoundary.map((p) => ({ xMm: p.xMm, yMm: p.yMm })),
            });
          }
        } else {
          // No enclosing boundary found — fall back to sketch mode.
          const { state } = reduceCeiling(ceilingStateRef.current, {
            kind: 'click',
            pointMm: sp,
          });
          ceilingStateRef.current = state;
        }
      } else {
        const { state } = reduceCeiling(ceilingStateRef.current, { kind: 'click', pointMm: sp });
        ceilingStateRef.current = state;
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'excavation') {
      const rect = rnd.domElement.getBoundingClientRect();
      const worldPerPxMm = (2 * camRef.current.half * 1000) / Math.max(1, rect.width);
      const threshMm = 12 * worldPerPxMm;
      const fst =
        excavationStateRef.current.phase === 'sketch'
          ? excavationStateRef.current.verticesMm[0]
          : undefined;
      if (
        fst &&
        excavationStateRef.current.verticesMm.length >= 3 &&
        Math.hypot(sp.xMm - fst.xMm, sp.yMm - fst.yMm) <= threshMm
      ) {
        const { effect } = reduceExcavation(excavationStateRef.current, { kind: 'close-loop' });
        excavationStateRef.current = initialExcavationState();
        if (effect.createExcavationEffect) {
          onSemanticCommand({
            type: 'create_toposolid_excavation',
            id: crypto.randomUUID(),
            boundaryMm: effect.createExcavationEffect.boundaryMm,
            depthMm: effect.createExcavationEffect.depthMm,
          });
        }
      } else {
        const { state } = reduceExcavation(excavationStateRef.current, {
          kind: 'click',
          pointMm: sp,
        });
        excavationStateRef.current = state;
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'terrain-point') {
      if (terrainPointStateRef.current.phase === 'idle') {
        const rectBox = rnd.domElement.getBoundingClientRect();
        const ray = new THREE.Raycaster();
        ray.setFromCamera(
          new THREE.Vector2(
            ((ev.clientX - rectBox.left) / rectBox.width) * 2 - 1,
            -(((ev.clientY - rectBox.top) / rectBox.height) * 2 - 1),
          ),
          camNow,
        );
        const hits = ray.intersectObjects(grp.children, true);
        const h = hits.find(
          (x) => typeof (x.object.userData as { bimPickId?: unknown }).bimPickId === 'string',
        );
        const pickId =
          typeof (h?.object.userData as { bimPickId?: unknown }).bimPickId === 'string'
            ? (h!.object.userData as { bimPickId: string }).bimPickId
            : undefined;
        const topoId =
          pickId && useBimStore.getState().elementsById[pickId]?.kind === 'toposolid'
            ? pickId
            : undefined;
        if (topoId) {
          const { state } = reduceTerrainPoint(terrainPointStateRef.current, {
            kind: 'activate',
            toposolidId: topoId,
          });
          terrainPointStateRef.current = state;
        }
      } else {
        const { state } = reduceTerrainPoint(terrainPointStateRef.current, {
          kind: 'click',
          xMm: sp.xMm,
          yMm: sp.yMm,
        });
        terrainPointStateRef.current = state;
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'terrain-pad') {
      if (terrainPadStateRef.current.phase === 'idle') {
        const rectBox = rnd.domElement.getBoundingClientRect();
        const ray = new THREE.Raycaster();
        ray.setFromCamera(
          new THREE.Vector2(
            ((ev.clientX - rectBox.left) / rectBox.width) * 2 - 1,
            -(((ev.clientY - rectBox.top) / rectBox.height) * 2 - 1),
          ),
          camNow,
        );
        const hits = ray.intersectObjects(grp.children, true);
        const h = hits.find(
          (x) => typeof (x.object.userData as { bimPickId?: unknown }).bimPickId === 'string',
        );
        const pickId =
          typeof (h?.object.userData as { bimPickId?: unknown }).bimPickId === 'string'
            ? (h!.object.userData as { bimPickId: string }).bimPickId
            : undefined;
        const topoId =
          pickId && useBimStore.getState().elementsById[pickId]?.kind === 'toposolid'
            ? pickId
            : undefined;
        if (topoId) {
          const topo = useBimStore.getState().elementsById[topoId] as Extract<
            Element,
            { kind: 'toposolid' }
          >;
          const elevationMm = topo.baseElevationMm ?? 0;
          const { state } = reduceTerrainPad(terrainPadStateRef.current, {
            kind: 'activate',
            toposolidId: topoId,
            elevationMm,
          });
          terrainPadStateRef.current = state;
        }
      } else {
        const { state } = reduceTerrainPad(terrainPadStateRef.current, {
          kind: 'click',
          xMm: sp.xMm,
          yMm: sp.yMm,
        });
        terrainPadStateRef.current = state;
      }
      bumpGeom((x) => x + 1);
      return;
    }
    // §5.1.6 — graded-region polygon sketch
    if (planTool === 'graded-region') {
      const { state } = reduceGradedRegion(gradedRegionStateRef.current, {
        kind: 'click',
        xMm: sp.xMm,
        yMm: sp.yMm,
      });
      gradedRegionStateRef.current = state;
      bumpGeom((x) => x + 1);
      return;
    }
    // §5.1.6 — terrain-split polyline
    if (planTool === 'terrain-split') {
      if (terrainSplitStateRef.current.phase === 'idle') {
        const rectBox = rnd.domElement.getBoundingClientRect();
        const ray = new THREE.Raycaster();
        ray.setFromCamera(
          new THREE.Vector2(
            ((ev.clientX - rectBox.left) / rectBox.width) * 2 - 1,
            -(((ev.clientY - rectBox.top) / rectBox.height) * 2 - 1),
          ),
          camNow,
        );
        const hits = ray.intersectObjects(grp.children, true);
        const h = hits.find(
          (x) => typeof (x.object.userData as { bimPickId?: unknown }).bimPickId === 'string',
        );
        const pickId =
          typeof (h?.object.userData as { bimPickId?: unknown }).bimPickId === 'string'
            ? (h!.object.userData as { bimPickId: string }).bimPickId
            : undefined;
        const topoId =
          pickId && useBimStore.getState().elementsById[pickId]?.kind === 'toposolid'
            ? pickId
            : undefined;
        if (topoId) {
          const { state } = reduceTerrainSplit(terrainSplitStateRef.current, {
            kind: 'activate',
            toposolidId: topoId,
          });
          terrainSplitStateRef.current = state;
        }
      } else {
        const { state } = reduceTerrainSplit(terrainSplitStateRef.current, {
          kind: 'click',
          xMm: sp.xMm,
          yMm: sp.yMm,
        });
        terrainSplitStateRef.current = state;
      }
      bumpGeom((x) => x + 1);
      return;
    }
    // §6.4.2 — detail-line polyline
    if (planTool === 'detail-line') {
      const { state: next, effect } = reduceDetailLine(detailLineStateRef.current, {
        kind: 'click',
        pointMm: { xMm: sp.xMm, yMm: sp.yMm },
      });
      detailLineStateRef.current = next;
      if (effect?.kind === 'createDetailLine') {
        void onSemanticCommand({
          type: 'addDetailLine',
          element: {
            kind: 'detail_line',
            id: crypto.randomUUID(),
            hostViewId: activePlanViewId ?? '',
            pointsMm: effect.pointsMm,
            lineStyle: effect.lineStyle,
            levelId: lvlId ?? null,
            viewId: activePlanViewId ?? null,
          },
        });
      }
      bumpGeom((x) => x + 1);
      return;
    }
    // §6.4.2 — detail-filled-region polygon
    if (planTool === 'detail-filled-region') {
      const { state: next, effect } = reduceDetailFilledRegion(detailFilledRegionStateRef.current, {
        kind: 'click',
        pointMm: { xMm: sp.xMm, yMm: sp.yMm },
      });
      detailFilledRegionStateRef.current = next;
      if (effect?.kind === 'createDetailFilledRegion') {
        void onSemanticCommand({
          type: 'addDetailFilledRegion',
          element: {
            kind: 'detail_filled_region',
            id: crypto.randomUUID(),
            perimeterMm: effect.perimeterMm,
            fillPattern: effect.fillPattern,
            levelId: lvlId ?? null,
            viewId: activePlanViewId ?? null,
          },
        });
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'beam-system') {
      const rect = rnd.domElement.getBoundingClientRect();
      const worldPerPxMm = (2 * camRef.current.half * 1000) / Math.max(1, rect.width);
      const threshMm = 12 * worldPerPxMm;
      const fst =
        beamSystemStateRef.current.phase === 'sketch'
          ? beamSystemStateRef.current.verticesMm[0]
          : undefined;
      if (
        fst &&
        (beamSystemStateRef.current as { verticesMm: unknown[] }).verticesMm.length >= 3 &&
        Math.hypot(sp.xMm - fst.xMm, sp.yMm - fst.yMm) <= threshMm
      ) {
        const { effect } = reduceBeamSystem(beamSystemStateRef.current, { kind: 'close-loop' });
        beamSystemStateRef.current = initialBeamSystemState();
        if (effect.commitBeamSystem && lvlId) {
          onSemanticCommand({
            type: 'createBeamSystem',
            levelId: lvlId,
            boundaryPoints: effect.commitBeamSystem.verticesMm,
            spacingMm: 1200,
            beamDirection: 0,
          });
        }
      } else {
        const { state } = reduceBeamSystem(beamSystemStateRef.current, {
          kind: 'click',
          pointMm: sp,
        });
        beamSystemStateRef.current = state;
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'column-at-grids') {
      // Pick the hovered grid line element from the raycaster
      const ray = new THREE.Raycaster();
      const rectBox = rnd.domElement.getBoundingClientRect();
      ray.setFromCamera(
        new THREE.Vector2(
          ((ev.clientX - rectBox.left) / rectBox.width) * 2 - 1,
          -(((ev.clientY - rectBox.top) / rectBox.height) * 2 - 1),
        ),
        cameraRef.current!,
      );
      const hits = ray.intersectObjects(grp.children, true);
      const h = hits.find(
        (x) => typeof (x.object.userData as { bimPickId?: unknown }).bimPickId === 'string',
      );
      if (h) {
        const id = (h.object.userData as { bimPickId: string }).bimPickId;
        const el = elementsById[id];
        if (el?.kind === 'grid_line') {
          const { state } = reduceColumnAtGrids(columnAtGridsStateRef.current, {
            kind: 'toggleGrid',
            gridId: id,
          });
          columnAtGridsStateRef.current = state;
          useBimStore
            .getState()
            .setColumnAtGridsSelectedIds(state.phase === 'selecting' ? state.selectedGridIds : []);
          bumpGeom((x) => x + 1);
        }
      }
      return;
    }
    if (planTool === 'room') {
      if (!lvlId || !sp) return;
      const { roomDrawName, roomDrawNumber, roomDrawUpperLevelId } = useBimStore.getState();
      onSemanticCommand({
        type: 'placeRoomAtPoint',
        id: crypto.randomUUID(),
        levelId: lvlId,
        clickXMm: sp.xMm,
        clickYMm: sp.yMm,
        name: roomDrawName || 'Room',
        numberLabel: roomDrawNumber || undefined,
        upperLimitLevelId: roomDrawUpperLevelId || undefined,
      });
      return;
    }
    if (planTool === 'detail-region') {
      const dr = draftRef.current;
      if (!dr || dr.kind !== 'detail-region') {
        draftRef.current = {
          kind: 'detail-region',
          verts: [{ xMm: sp.xMm, yMm: sp.yMm }],
          closed: false,
          hatchId: null,
        };
        bumpGeom((x) => x + 1);
        return;
      }
      const fst = dr.verts[0];
      if (fst && dr.verts.length >= 3 && Math.hypot(sp.xMm - fst.xMm, sp.yMm - fst.yMm) < 520) {
        onSemanticCommand({
          type: 'create_detail_region',
          id: crypto.randomUUID(),
          viewId: activePlanViewId,
          vertices: dr.verts.map((v) => ({ x: v.xMm, y: v.yMm })),
          closed: true,
          hatchId: dr.hatchId,
        });
        draftRef.current = undefined;
        bumpGeom((x) => x + 1);
        if (previewRef.current) {
          grp.remove(previewRef.current);
          previewRef.current.geometry.dispose();
          previewRef.current = null;
        }
        return;
      }
      dr.verts.push({ xMm: sp.xMm, yMm: sp.yMm });
      bumpGeom((x) => x + 1);
    }
    // TOP-V3-03: click → add vertex; double-click (detected via proximity in
    // onDblClick below) → close polygon + emit CreateToposolidSubdivisionCmd.
    if (planTool === 'toposolid_subdivision') {
      const d = draftRef.current;
      if (!d || d.kind !== 'toposolid-subdivision') {
        const draft = useToolPrefs.getState().subdivisionDraft;
        const cat: SubdivisionCategory = draft?.finishCategory ?? 'paving';
        draftRef.current = {
          kind: 'toposolid-subdivision',
          verts: [{ xMm: sp.xMm, yMm: sp.yMm }],
          finishCategory: cat,
        };
        bumpGeom((x) => x + 1);
        return;
      }
      d.verts.push({ xMm: sp.xMm, yMm: sp.yMm });
      bumpGeom((x) => x + 1);
    }
    // ANN-01 — text annotation: single click sets position, opens typing overlay
    if (planTool === 'text') {
      if (!activePlanViewId) return;
      const { state: nextState } = reduceTextAnnotation(textAnnotStateRef.current, {
        kind: 'click',
        pointMm: sp,
      });
      textAnnotStateRef.current = nextState;
      if (nextState.phase === 'typing') {
        setTextAnnotOverlay({
          positionMm: sp,
          screenX: ev.clientX,
          screenY: ev.clientY,
          draft: '',
        });
      }
      return;
    }
    // ANN-16 — leader text: 3-click anchor → elbow → text-pos, then typing overlay
    if (planTool === 'leader-text') {
      if (!activePlanViewId) return;
      const { state: nextState } = reduceLeaderText(leaderTextStateRef.current, {
        kind: 'click',
        pointMm: sp,
      });
      leaderTextStateRef.current = nextState;
      if (nextState.phase === 'typing') {
        setLeaderTextOverlay({
          anchorMm: nextState.anchorMm,
          elbowMm: nextState.elbowMm,
          textMm: nextState.textMm,
          screenX: ev.clientX,
          screenY: ev.clientY,
          draft: '',
        });
      }
      bumpGeom((x) => x + 1);
      return;
    }
    // ANN-05 — north arrow: single click places the symbol
    if (planTool === 'north-arrow') {
      if (!activePlanViewId) return;
      onSemanticCommand({
        type: 'createAnnotationSymbol',
        hostViewId: activePlanViewId,
        positionMm: sp,
        symbolType: 'north_arrow',
        rotationDeg: 0,
        scale: 1,
      });
      return;
    }
    // §2.1.3 — project base point: single click places or moves the PBP
    if (planTool === 'project-base-point') {
      const existingPbp = Object.values(elementsById).find((e) => e.kind === 'project_base_point');
      if (existingPbp) {
        onSemanticCommand({
          type: 'updateElementProperty',
          elementId: existingPbp.id,
          key: 'positionMm',
          value: { xMm: sp.xMm, yMm: sp.yMm, zMm: 0 },
        });
      } else {
        onSemanticCommand({
          type: 'createProjectBasePoint',
          id: crypto.randomUUID(),
          positionMm: { xMm: sp.xMm, yMm: sp.yMm },
          elevationMm: 0,
          isShared: false,
        });
      }
      return;
    }
    // ANN-07 — spot elevation: single click creates elevation label at level datum
    if (planTool === 'spot-elevation') {
      if (!activePlanViewId) return;
      const levelEl = lvlId ? elementsById[lvlId] : undefined;
      const elevMm = levelEl?.kind === 'level' ? levelEl.elevationMm : 0;
      onSemanticCommand({
        type: 'createSpotElevation',
        hostViewId: activePlanViewId,
        positionMm: sp,
        elevationMm: elevMm,
      });
      return;
    }
    // ANN-08 — spot coordinate: single click places N/E annotation
    if (planTool === 'spot-coordinate') {
      if (!activePlanViewId) return;
      onSemanticCommand({
        type: 'createSpotCoordinate',
        hostViewId: activePlanViewId,
        positionMm: sp,
        northMm: sp.yMm,
        eastMm: sp.xMm,
      });
      return;
    }
    // ANN-09 — slope annotation: two-click start→end, emits slope_annotation element
    if (planTool === 'slope-annotation') {
      const d = draftRef.current;
      if (!d || d.kind !== 'slope-annotation') {
        draftRef.current = { kind: 'slope-annotation', sx: sp.xMm, sy: sp.yMm };
        bumpGeom((x) => x + 1);
        return;
      }
      const dxMm = sp.xMm - d.sx;
      const dyMm = sp.yMm - d.sy;
      const dist = Math.sqrt(dxMm * dxMm + dyMm * dyMm);
      const slopePct = dist !== 0 ? Math.abs(dyMm / dist) * 100 : 0;
      onSemanticCommand({
        type: 'createElement',
        element: {
          kind: 'slope_annotation',
          id: crypto.randomUUID(),
          startMm: { xMm: d.sx, yMm: d.sy },
          endMm: { xMm: sp.xMm, yMm: sp.yMm },
          slopePct,
          levelId: displayLevelId ?? null,
        },
      });
      draftRef.current = undefined;
      bumpGeom((x) => x + 1);
      return;
    }
    // ANN-10 — material tag: click nearest wall, tag its first material layer
    if (planTool === 'material-tag') {
      if (!activePlanViewId) return;
      const nearest = nearestWallAt(elementsById, displayLevelId || undefined, sp.xMm, sp.yMm);
      if (nearest && nearest.distMm < 2000) {
        // Tag position is offset ~500mm diagonally from click; leader end touches the wall
        const tagPos = { xMm: sp.xMm + 500, yMm: sp.yMm - 500 };
        onSemanticCommand({
          type: 'createMaterialTag',
          hostViewId: activePlanViewId,
          hostElementId: nearest.wall.id,
          layerIndex: 0,
          positionMm: tagPos,
          leaderEndMm: sp,
        });
      }
      return;
    }
    // §2.4.2 — floor auto-detect: shift-click triggers boundary detection from walls
    if (planTool === 'floor' && ev.shiftKey) {
      const boundary = detectFloorBoundaryFromWalls(
        { xMm: sp.xMm, yMm: sp.yMm },
        elementsById,
        lvlId ?? null,
      );
      if (boundary && boundary.length >= 3 && lvlId) {
        void onSemanticCommand({
          type: 'createFloor',
          levelId: lvlId,
          boundaryMm: boundary.map((p) => ({ xMm: p.xMm, yMm: p.yMm })),
          autoDetectedBoundary: true,
        });
        setPlanTool('select');
      }
      return; // Don't add as a normal sketch point
    }
  };

  return onClick;
}
