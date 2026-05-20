import * as THREE from 'three';
import type { Element, XY } from '@bim-ai/core';
import type {
  AlignState,
  ArrayState,
  BeamState,
  BeamSystemState,
  CeilingState,
  ColumnAtGridsState,
  ColumnState,
  ConicalRoofState,
  DetailFilledRegionState,
  DetailLineState,
  DomeRoofState,
  ExcavationState,
  GradedRegionState,
  LineworkState,
  MeasureAngleState,
  MeasureArcState,
  ModelLineState,
  PermanentDimState,
  PlaceGroupState,
  RampState,
  RevisionCloudState,
  RoofByExtrusionState,
  ScaleState,
  ShaftState,
  SpireRoofState,
  SplitState,
  SplitWallState,
  StairLandingState,
  StairRunState,
  SteelConnectionState,
  TerrainPadState,
  TerrainPointState,
  TerrainSplitState,
  TrimState,
  WallJoinState,
  WallOpeningState,
  cycleWallLocationLine as cycleWallLocationLineFn,
  reduceAlign as reduceAlignFn,
  reduceAreaBoundary as reduceAreaBoundaryFn,
  reduceArray as reduceArrayFn,
  reduceColumnAtGrids as reduceColumnAtGridsFn,
  reduceConicalRoof as reduceConicalRoofFn,
  reduceDetailFilledRegion as reduceDetailFilledRegionFn,
  reduceDetailLine as reduceDetailLineFn,
  reduceDomeRoof as reduceDomeRoofFn,
  reduceExcavation as reduceExcavationFn,
  reduceGradedRegion as reduceGradedRegionFn,
  reduceLinework as reduceLineworkFn,
  reduceMeasureAngle as reduceMeasureAngleFn,
  reduceMeasureArc as reduceMeasureArcFn,
  reducePermanentDim as reducePermanentDimFn,
  reducePlaceGroup as reducePlaceGroupFn,
  reduceRoofByExtrusion as reduceRoofByExtrusionFn,
  reduceScale as reduceScaleFn,
  reduceSpireRoof as reduceSpireRoofFn,
  reduceSplit as reduceSplitFn,
  reduceSplitWall as reduceSplitWallFn,
  reduceStairLanding as reduceStairLandingFn,
  reduceSteelConnection as reduceSteelConnectionFn,
  reduceTerrainPad as reduceTerrainPadFn,
  reduceTerrainPoint as reduceTerrainPointFn,
  reduceTerrainSplit as reduceTerrainSplitFn,
  reduceTrim as reduceTrimFn,
  reduceWallJoin as reduceWallJoinFn,
} from '../tools/toolGrammar';
import type { ToggleableSnapKind } from './snapSettings';
import { useBimStore } from '../state/store';
import type { PlanTool } from '../state/store';
import { useToolPrefs } from '../tools/toolPrefsStore';
import type { FamilyDefinition } from '../families/types';
import type {
  copyElementsToClipboard as copyElementsToClipboardFn,
  pasteElementsFromClipboard as pasteElementsFromClipboardFn,
  pasteFromOSClipboard as pasteFromOSClipboardFn,
} from '../clipboard/copyPaste';
import type { buildScaleCommand as buildScaleCommandFn } from './scaleTool';
import type {
  linearArrayOffsets as linearArrayOffsetsFn,
  radialArrayAngles as radialArrayAnglesFn,
  radialOffsetForElement as radialOffsetForElementFn,
} from './arrayTool';
import type { columnPositionsAtGridIntersections as columnPositionsAtGridIntersectionsFn } from './columnAtGrids';
import { createSimilarPayload } from './createSimilar';
import type { handleDblClickDispatch as handleDblClickDispatchFn } from './doubleClickDispatch';
import type { DraftMutation, GripDescriptor } from './gripProtocol';
import { HALF_MAX, HALF_MIN } from './interaction/planCameraMath';
import type { rayToPlanMm as rayToPlanMmFn } from './interaction/planCameraMath';
import type {
  resolveSnapOverrideShortcut as resolveSnapOverrideShortcutFn,
  SnapOverrideKeyState,
} from './interaction/snapOverrideShortcuts';
import type { Draft } from './planCanvasHelpers';
import type {
  PlanCanvasElementContextMenuState,
  PlanCanvasUnhideContextMenuState,
  PlanCanvasWallContextMenuState,
  PlanCanvasWallJoinContextMenuState,
} from './PlanCanvasContextOverlays';
import { PlanCamera } from './planCanvasState';
import type { PlanSemanticKind, PlanViewResolvedDisplay } from './planProjection';
import type { parseTypedRotateAngle as parseTypedRotateAngleFn } from './rotateTool';
import type { selectNextConnectedWallByTab as selectNextConnectedWallByTabFn } from './wallChainSelection';
import type { nextTabSelection as nextTabSelectionFn } from './tabCycleSelection';
import type { bumpSnapTabCycle as bumpSnapTabCycleFn, SnapTabCycleState } from './snapTabCycle';
import type { SnapHit, SnapKind } from './snapEngine';
import type { splitToposolid as splitToposolidFn } from './terrainSplit';

type MutableRef<T> = { current: T };
type StateSetter<T> = (value: T | ((prev: T) => T)) => void;
type NumericInputState = { value: string; pxX: number; pxY: number };
type ScreenPoint = { pxX: number; pxY: number };
type SemanticCommand = Record<string, unknown>;
type ParseDimensionResult = { ok: true; mm: number } | { ok: false; error?: string };
type ParseDimensionInput = (value: string) => ParseDimensionResult;
type PlanCameraMutableState = { camX: number; camZ: number; half: number };
type PlanDragState = {
  dragging: boolean;
  lastXmm: number;
  lastZmm: number;
  camX: number;
  camZ: number;
};
type PlanMarqueeState = {
  active: boolean;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  direction: 'left-to-right' | 'right-to-left' | null;
};
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
type GripDragState = {
  grip: GripDescriptor;
  startWorldMm: XY;
  lastDeltaMm: XY;
};
type MeasureAngleReadout = { angleDeg: number };
type MeasureArcReadout = { arcLengthMm: number; radiusMm: number };

function familyIdForElement(element: Element): string | undefined {
  return 'familyId' in element && typeof element.familyId === 'string'
    ? element.familyId
    : undefined;
}

export interface PlanCanvasKeyboardAuxHandlerArgs {
  activateElevationView: (id: string) => void;
  activatePlanView: (id: string) => void;
  activeLevelResolvedId: string | undefined;
  activePlanViewId: string | null | undefined;
  alignStateRef: MutableRef<AlignState>;
  arrayPhase: ArrayState['phase'];
  arrayStateRef: MutableRef<ArrayState>;
  beamStateRef: MutableRef<BeamState>;
  beamSystemStateRef: MutableRef<BeamSystemState>;
  buildScaleCommand: typeof buildScaleCommandFn;
  bumpGeom: StateSetter<number>;
  bumpSnapTabCycle: typeof bumpSnapTabCycleFn;
  camNow: THREE.Camera;
  camRef: MutableRef<PlanCameraMutableState>;
  ceilingStateRef: MutableRef<CeilingState>;
  clearMarqueeLine: () => void;
  clearPreview: () => void;
  columnAtGridsStateRef: MutableRef<ColumnAtGridsState>;
  columnPositionsAtGridIntersections: typeof columnPositionsAtGridIntersectionsFn;
  columnStateRef: MutableRef<ColumnState>;
  commitAreaBoundary: (boundaryMm: XY[]) => void;
  conicalRoofStateRef: MutableRef<ConicalRoofState>;
  copyAnchorRef: MutableRef<XY | null>;
  copyElementsToClipboard: typeof copyElementsToClipboardFn;
  cycleWallLocationLine: typeof cycleWallLocationLineFn;
  detailFilledRegionStateRef: MutableRef<DetailFilledRegionState>;
  detailLineStateRef: MutableRef<DetailLineState>;
  dimSnapCirclesRef: MutableRef<THREE.Mesh[]>;
  display: PlanViewResolvedDisplay;
  displayLevelId: string | undefined;
  domeRoofStateRef: MutableRef<DomeRoofState>;
  draftRef: MutableRef<Draft | undefined>;
  dragRef: MutableRef<PlanDragState>;
  elementsById: Record<string, Element>;
  elementInSelectionBoxMm: (
    el: Element,
    boxMinMm: XY,
    boxMaxMm: XY,
    mode: 'window' | 'crossing',
  ) => boolean;
  excavationStateRef: MutableRef<ExcavationState>;
  getBuiltInFamilyById: (id: string) => FamilyDefinition | undefined;
  gradedRegionStateRef: MutableRef<GradedRegionState>;
  gripDragRef: MutableRef<GripDragState | null>;
  grp: THREE.Group;
  handleDblClickDispatch: typeof handleDblClickDispatchFn;
  hudMmRef: MutableRef<XY | undefined>;
  initialBeamState: () => BeamState;
  initialBeamSystemState: () => BeamSystemState;
  initialCeilingState: () => CeilingState;
  initialColumnState: () => ColumnState;
  initialExcavationState: () => ExcavationState;
  initialModelLineState: () => ModelLineState;
  initialRampState: () => RampState;
  initialRevisionCloudState: () => RevisionCloudState;
  initialShaftState: () => ShaftState;
  initialStairLandingState: () => StairLandingState;
  initialStairRunState: () => StairRunState;
  initialTerrainPadState: () => TerrainPadState;
  initialTerrainPointState: () => TerrainPointState;
  initialWallOpeningState: () => WallOpeningState;
  lastKeyRef: MutableRef<SnapOverrideKeyState>;
  lastPlotScaleRef: MutableRef<number>;
  lastSnapHitsRef: MutableRef<SnapHit[]>;
  linearArrayOffsets: typeof linearArrayOffsetsFn;
  lineworkStateRef: MutableRef<LineworkState>;
  lvlId: string | undefined;
  marqueeRef: MutableRef<PlanMarqueeState>;
  measureAngleStateRef: MutableRef<MeasureAngleState>;
  measureArcStateRef: MutableRef<MeasureArcState>;
  mirrorAxisStartRef: MutableRef<XY | null>;
  modelLineStateRef: MutableRef<ModelLineState>;
  moveAnchorRef: MutableRef<XY | null>;
  nextTabSelection: typeof nextTabSelectionFn;
  numericInputRef: MutableRef<NumericInputState | null>;
  onSemanticCommand: (cmd: SemanticCommand) => void | Promise<void>;
  parseDimensionInput: ParseDimensionInput;
  parseTypedRotateAngle: typeof parseTypedRotateAngleFn;
  pasteElementsFromClipboard: typeof pasteElementsFromClipboardFn;
  pasteFromOSClipboard: typeof pasteFromOSClipboardFn;
  pendingComponentRotationDeg: number;
  pendingCsChordRef: MutableRef<ReturnType<typeof setTimeout> | null>;
  pendingPinChordRef: MutableRef<ReturnType<typeof setTimeout> | null>;
  permanentDimStateRef: MutableRef<PermanentDimState>;
  placeGroupStateRef: MutableRef<PlaceGroupState>;
  planTool: PlanTool;
  previewRef: MutableRef<THREE.Line | null>;
  radialArrayAngles: typeof radialArrayAnglesFn;
  radialOffsetForElement: typeof radialOffsetForElementFn;
  rampStateRef: MutableRef<RampState>;
  rayToPlanMm: typeof rayToPlanMmFn;
  reduceAlign: typeof reduceAlignFn;
  reduceAreaBoundary: typeof reduceAreaBoundaryFn;
  reduceArray: typeof reduceArrayFn;
  reduceColumnAtGrids: typeof reduceColumnAtGridsFn;
  reduceConicalRoof: typeof reduceConicalRoofFn;
  reduceDetailFilledRegion: typeof reduceDetailFilledRegionFn;
  reduceDetailLine: typeof reduceDetailLineFn;
  reduceDomeRoof: typeof reduceDomeRoofFn;
  reduceExcavation: typeof reduceExcavationFn;
  reduceGradedRegion: typeof reduceGradedRegionFn;
  reduceLinework: typeof reduceLineworkFn;
  reduceMeasureAngle: typeof reduceMeasureAngleFn;
  reduceMeasureArc: typeof reduceMeasureArcFn;
  reducePermanentDim: typeof reducePermanentDimFn;
  reducePlaceGroup: typeof reducePlaceGroupFn;
  reduceRoofByExtrusion: typeof reduceRoofByExtrusionFn;
  reduceScale: typeof reduceScaleFn;
  reduceSpireRoof: typeof reduceSpireRoofFn;
  reduceSplit: typeof reduceSplitFn;
  reduceSplitWall: typeof reduceSplitWallFn;
  reduceStairLanding: typeof reduceStairLandingFn;
  reduceSteelConnection: typeof reduceSteelConnectionFn;
  reduceTerrainPad: typeof reduceTerrainPadFn;
  reduceTerrainPoint: typeof reduceTerrainPointFn;
  reduceTerrainSplit: typeof reduceTerrainSplitFn;
  reduceTrim: typeof reduceTrimFn;
  reduceWallJoin: typeof reduceWallJoinFn;
  resizeCam: () => void;
  resolveSnapOverrideShortcut: typeof resolveSnapOverrideShortcutFn;
  revealHiddenMode: boolean;
  revisionCloudStateRef: MutableRef<RevisionCloudState>;
  rnd: THREE.WebGLRenderer;
  roofByExtrusionStateRef: MutableRef<RoofByExtrusionState>;
  rotateAnchorRef: MutableRef<XY | null>;
  rotateReferenceRef: MutableRef<XY | null>;
  scalePhase: ScaleState['phase'];
  scaleStateRef: MutableRef<ScaleState>;
  selectEl: (id: string | undefined) => void;
  selectNextConnectedWallByTab: typeof selectNextConnectedWallByTabFn;
  selectedId: string | undefined;
  selectedIds: string[];
  setActiveGripId: StateSetter<string | null>;
  setActiveLevelId: (id: string) => void;
  setAlignReferenceMm: StateSetter<XY | null>;
  setArrayPhase: StateSetter<ArrayState['phase']>;
  setCanvasCtxMenu: StateSetter<{ x: number; y: number } | null>;
  setCopyAnchorSet: StateSetter<boolean>;
  setDispatchColumnAtGridsSelectAll: (value: null) => void;
  setDraftMutation: StateSetter<DraftMutation | null>;
  setElementCtxMenu: StateSetter<PlanCanvasElementContextMenuState | null>;
  setMeasureAngleReadout: StateSetter<MeasureAngleReadout | null>;
  setMeasureArcReadout: StateSetter<MeasureArcReadout | null>;
  setMirrorAxisSet: StateSetter<boolean>;
  setMoveAnchorSet: StateSetter<boolean>;
  setNumericInput: StateSetter<NumericInputState | null>;
  setPendingComponentRotationDeg: (value: number) => void;
  setPlanTool: (tool: PlanTool) => void;
  setRoofByExtrusionPhase: StateSetter<RoofByExtrusionState['phase']>;
  setRotateAnchorSet: StateSetter<boolean>;
  setRotateReferenceSet: StateSetter<boolean>;
  setScalePhase: StateSetter<ScaleState['phase']>;
  setSnapGlyphState: StateSetter<SnapGlyphState>;
  setSnapOverrideDisplay: StateSetter<ToggleableSnapKind | null>;
  setTrimExtendFirstWallSet: StateSetter<boolean>;
  setUnhideContextMenu: StateSetter<PlanCanvasUnhideContextMenuState | null>;
  setWallContextMenu: StateSetter<PlanCanvasWallContextMenuState | null>;
  setWallDraftNotice: StateSetter<string | null>;
  setWallJoinCtxMenu: StateSetter<PlanCanvasWallJoinContextMenuState | null>;
  setWallPickLineHint: (value: null) => void;
  shaftStateRef: MutableRef<ShaftState>;
  snapOverrideRef: MutableRef<ToggleableSnapKind | null>;
  snapTabCycleRef: MutableRef<SnapTabCycleState>;
  spaceDownRef: MutableRef<boolean>;
  spireRoofStateRef: MutableRef<SpireRoofState>;
  splitStateRef: MutableRef<SplitState>;
  splitToposolid: typeof splitToposolidFn;
  splitWallStateRef: MutableRef<SplitWallState>;
  stairLandingStateRef: MutableRef<StairLandingState>;
  stairRunStateRef: MutableRef<StairRunState>;
  stairStateRef: MutableRef<BeamState>;
  steelConnectionStateRef: MutableRef<SteelConnectionState>;
  terrainPadStateRef: MutableRef<TerrainPadState>;
  terrainPointStateRef: MutableRef<TerrainPointState>;
  terrainSplitStateRef: MutableRef<TerrainSplitState>;
  trimExtendFirstWallRef: MutableRef<string | null>;
  trimStateRef: MutableRef<TrimState>;
  wallFlipRef: MutableRef<boolean>;
  wallJoinStateRef: MutableRef<WallJoinState>;
  wallOpeningAnchorRef: MutableRef<XY | null>;
  wallOpeningStateRef: MutableRef<WallOpeningState>;
  wallTabCycleIndexRef: MutableRef<{ selId: string; index: number }>;
  worldToScreen: (point: XY) => ScreenPoint;
}

export function createPlanCanvasKeyboardAuxHandlers<T extends PlanCanvasKeyboardAuxHandlerArgs>(
  args: T,
) {
  const {
    activateElevationView,
    activatePlanView,
    activeLevelResolvedId,
    activePlanViewId,
    alignStateRef,
    arrayPhase,
    arrayStateRef,
    beamStateRef,
    beamSystemStateRef,
    buildScaleCommand,
    bumpGeom,
    bumpSnapTabCycle,
    camNow,
    camRef,
    ceilingStateRef,
    clearMarqueeLine,
    clearPreview,
    columnAtGridsStateRef,
    columnPositionsAtGridIntersections,
    columnStateRef,
    commitAreaBoundary,
    conicalRoofStateRef,
    copyAnchorRef,
    copyElementsToClipboard,
    cycleWallLocationLine,
    detailFilledRegionStateRef,
    detailLineStateRef,
    dimSnapCirclesRef,
    display,
    displayLevelId,
    domeRoofStateRef,
    draftRef,
    dragRef,
    elementsById,
    elementInSelectionBoxMm,
    excavationStateRef,
    getBuiltInFamilyById,
    gradedRegionStateRef,
    gripDragRef,
    grp,
    handleDblClickDispatch,
    hudMmRef,
    initialBeamState,
    initialBeamSystemState,
    initialCeilingState,
    initialColumnState,
    initialExcavationState,
    initialModelLineState,
    initialRampState,
    initialRevisionCloudState,
    initialShaftState,
    initialStairLandingState,
    initialStairRunState,
    initialTerrainPadState,
    initialTerrainPointState,
    initialWallOpeningState,
    lastKeyRef,
    lastPlotScaleRef,
    lastSnapHitsRef,
    linearArrayOffsets,
    lineworkStateRef,
    lvlId,
    marqueeRef,
    measureAngleStateRef,
    measureArcStateRef,
    mirrorAxisStartRef,
    modelLineStateRef,
    moveAnchorRef,
    nextTabSelection,
    numericInputRef,
    onSemanticCommand,
    parseDimensionInput,
    parseTypedRotateAngle,
    pasteElementsFromClipboard,
    pasteFromOSClipboard,
    pendingComponentRotationDeg,
    pendingCsChordRef,
    pendingPinChordRef,
    permanentDimStateRef,
    placeGroupStateRef,
    planTool,
    previewRef,
    radialArrayAngles,
    radialOffsetForElement,
    rampStateRef,
    rayToPlanMm,
    reduceAlign,
    reduceAreaBoundary,
    reduceArray,
    reduceColumnAtGrids,
    reduceConicalRoof,
    reduceDetailFilledRegion,
    reduceDetailLine,
    reduceDomeRoof,
    reduceExcavation,
    reduceGradedRegion,
    reduceLinework,
    reduceMeasureAngle,
    reduceMeasureArc,
    reducePermanentDim,
    reducePlaceGroup,
    reduceRoofByExtrusion,
    reduceScale,
    reduceSpireRoof,
    reduceSplit,
    reduceSplitWall,
    reduceStairLanding,
    reduceSteelConnection,
    reduceTerrainPad,
    reduceTerrainPoint,
    reduceTerrainSplit,
    reduceTrim,
    reduceWallJoin,
    resizeCam,
    resolveSnapOverrideShortcut,
    revealHiddenMode,
    revisionCloudStateRef,
    rnd,
    roofByExtrusionStateRef,
    rotateAnchorRef,
    rotateReferenceRef,
    scalePhase,
    scaleStateRef,
    selectEl,
    selectNextConnectedWallByTab,
    selectedId,
    selectedIds,
    setActiveGripId,
    setActiveLevelId,
    setAlignReferenceMm,
    setArrayPhase,
    setCanvasCtxMenu,
    setCopyAnchorSet,
    setDispatchColumnAtGridsSelectAll,
    setDraftMutation,
    setElementCtxMenu,
    setMeasureAngleReadout,
    setMeasureArcReadout,
    setMirrorAxisSet,
    setMoveAnchorSet,
    setNumericInput,
    setPendingComponentRotationDeg,
    setPlanTool,
    setRoofByExtrusionPhase,
    setRotateAnchorSet,
    setRotateReferenceSet,
    setScalePhase,
    setSnapGlyphState,
    setSnapOverrideDisplay,
    setTrimExtendFirstWallSet,
    setUnhideContextMenu,
    setWallContextMenu,
    setWallDraftNotice,
    setWallJoinCtxMenu,
    setWallPickLineHint,
    shaftStateRef,
    snapOverrideRef,
    snapTabCycleRef,
    spaceDownRef,
    spireRoofStateRef,
    splitStateRef,
    splitToposolid,
    splitWallStateRef,
    stairLandingStateRef,
    stairRunStateRef,
    stairStateRef,
    steelConnectionStateRef,
    terrainPadStateRef,
    terrainPointStateRef,
    terrainSplitStateRef,
    trimExtendFirstWallRef,
    trimStateRef,
    wallFlipRef,
    wallJoinStateRef,
    wallOpeningAnchorRef,
    wallOpeningStateRef,
    wallTabCycleIndexRef,
    worldToScreen,
  } = args;

  const onWheel = (ev: WheelEvent) => {
    ev.preventDefault();
    const rect = rnd.domElement.getBoundingClientRect();
    const ndcX = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    const asp = rect.width / Math.max(1, rect.height);
    const norm = (d: number) => (ev.deltaMode === 1 ? d * 20 : ev.deltaMode === 2 ? d * 600 : d);
    const rawY = norm(ev.deltaY);
    const rawX = norm(ev.deltaX);

    if (ev.ctrlKey || ev.metaKey) {
      // Trackpad pinch — macOS sends ctrlKey+wheel. Use higher sensitivity
      // so the gesture feels 1-to-1 with finger spread/pinch.
      const oldHalf = camRef.current.half;
      const newHalf = THREE.MathUtils.clamp(oldHalf * Math.exp(rawY * 0.008), HALF_MIN, HALF_MAX);
      const dH = oldHalf - newHalf;
      camRef.current.half = newHalf;
      camRef.current.camX += ndcX * asp * dH;
      camRef.current.camZ -= ndcY * dH;
    } else {
      // Distinguish mouse wheel (large discrete steps) from trackpad two-finger swipe
      // (small continuous values). Mouse wheel: zoom. Trackpad swipe: pan.
      // Heuristic: mouse wheel produces |deltaY| > 30 with |deltaX| < 3.
      const isMouseWheel = Math.abs(rawY) > 30 && Math.abs(rawX) < 3;
      if (isMouseWheel) {
        // Mouse scroll wheel → zoom at cursor (zoom-to-pointer)
        const oldHalf = camRef.current.half;
        const newHalf = THREE.MathUtils.clamp(oldHalf * Math.exp(rawY * 0.003), HALF_MIN, HALF_MAX);
        const dH = oldHalf - newHalf;
        camRef.current.half = newHalf;
        camRef.current.camX += ndcX * asp * dH;
        camRef.current.camZ -= ndcY * dH;
      } else {
        // Trackpad two-finger swipe → pan (1:1 with finger movement)
        const worldPerPx = (2 * camRef.current.half) / Math.max(1, rect.height);
        camRef.current.camX -= rawX * worldPerPx;
        camRef.current.camZ -= rawY * worldPerPx;
      }
    }
    resizeCam();
    // B01 — rebuild meshes when zoom crosses a 20% threshold so line weights update
    const newPlotScale = (camRef.current.half * 1000) / 500;
    if (
      lastPlotScaleRef.current > 0 &&
      Math.abs(newPlotScale - lastPlotScaleRef.current) / lastPlotScaleRef.current > 0.2
    ) {
      bumpGeom((x) => x + 1);
    }
  };

  const onKey = (ev: KeyboardEvent) => {
    // F-115 — Spacebar rotates pending component placement by 90°.
    if (ev.key === ' ' && planTool === 'component') {
      ev.preventDefault();
      setPendingComponentRotationDeg((pendingComponentRotationDeg + 90) % 360);
      return;
    }
    // EDT-01 — grip drag handles its own keys: Esc cancels, digits
    // pop a numeric override input, Backspace edits it, Enter
    // commits via onNumericOverride.
    if (gripDragRef.current) {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        gripDragRef.current = null;
        setActiveGripId(null);
        setDraftMutation(null);
        setNumericInput(null);
        return;
      }
      if (/^[0-9a-zA-Z.'"\s]$/.test(ev.key)) {
        ev.preventDefault();
        setNumericInput((prev) => {
          const value = (prev?.value ?? '') + ev.key;
          const pxX = prev?.pxX ?? 0;
          const pxY = prev?.pxY ?? 0;
          return { value, pxX, pxY };
        });
        return;
      }
      if (ev.key === 'Backspace' && numericInputRef.current) {
        ev.preventDefault();
        setNumericInput((prev) => (prev ? { ...prev, value: prev.value.slice(0, -1) } : prev));
        return;
      }
      if (ev.key === 'Enter' && numericInputRef.current) {
        ev.preventDefault();
        const parsed = parseDimensionInput(numericInputRef.current.value);
        const grip = gripDragRef.current.grip;
        if (parsed.ok) {
          void onSemanticCommand(grip.onNumericOverride(parsed.mm));
        }
        gripDragRef.current = null;
        setActiveGripId(null);
        setDraftMutation(null);
        setNumericInput(null);
        return;
      }
    }
    if (planTool === 'rotate' && rotateAnchorRef.current && rotateReferenceRef.current) {
      if (/^[0-9]$/.test(ev.key) || ev.key === '.' || ev.key === '-') {
        ev.preventDefault();
        const hoverMm = hudMmRef.current;
        const seedPx = hoverMm
          ? worldToScreen(hoverMm)
          : worldToScreen(rotateReferenceRef.current ?? rotateAnchorRef.current);
        setNumericInput((prev) => {
          if (ev.key === '-' && prev?.value) return prev;
          const value = (prev?.value ?? '') + ev.key;
          return {
            value,
            pxX: prev?.pxX ?? seedPx.pxX,
            pxY: prev?.pxY ?? seedPx.pxY,
          };
        });
        return;
      }
      if (ev.key === 'Backspace' && numericInputRef.current) {
        ev.preventDefault();
        setNumericInput((prev) => (prev ? { ...prev, value: prev.value.slice(0, -1) } : prev));
        return;
      }
      if (ev.key === 'Enter' && numericInputRef.current) {
        ev.preventDefault();
        const angleDeg = parseTypedRotateAngle(numericInputRef.current.value);
        const anchor = rotateAnchorRef.current;
        if (angleDeg !== null && anchor) {
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
        }
        rotateAnchorRef.current = null;
        setRotateAnchorSet(false);
        rotateReferenceRef.current = null;
        setRotateReferenceSet(false);
        setNumericInput(null);
        bumpGeom((x) => x + 1);
        return;
      }
    }
    if (planTool === 'scale' && scalePhase === 'enter-factor') {
      if (/^[0-9]$/.test(ev.key) || ev.key === '.' || ev.key === ',') {
        ev.preventDefault();
        const char = ev.key === ',' ? '.' : ev.key;
        const hoverMm = hudMmRef.current;
        const seedPx = hoverMm ? worldToScreen(hoverMm) : { pxX: 100, pxY: 100 };
        setNumericInput((prev) => {
          const value = (prev?.value ?? '') + char;
          return { value, pxX: prev?.pxX ?? seedPx.pxX, pxY: prev?.pxY ?? seedPx.pxY };
        });
        const current = numericInputRef.current;
        const next = (current?.value ?? '') + char;
        const { state } = reduceScale(scaleStateRef.current, { kind: 'set-input', value: next });
        scaleStateRef.current = state;
        return;
      }
      if (ev.key === 'Backspace' && numericInputRef.current) {
        ev.preventDefault();
        setNumericInput((prev) => (prev ? { ...prev, value: prev.value.slice(0, -1) } : prev));
        const current = numericInputRef.current;
        const next = (current?.value ?? '').slice(0, -1);
        const { state } = reduceScale(scaleStateRef.current, { kind: 'set-input', value: next });
        scaleStateRef.current = state;
        return;
      }
      if (ev.key === 'Enter') {
        ev.preventDefault();
        const { state, effect } = reduceScale(scaleStateRef.current, { kind: 'confirm' });
        scaleStateRef.current = state;
        setScalePhase(state.phase);
        setNumericInput(null);
        if (effect.commitScale && selectedId) {
          const scaleCommand = buildScaleCommand(
            selectedId,
            effect.commitScale.originMm,
            effect.commitScale.factor,
          );
          void onSemanticCommand({ ...scaleCommand });
        }
        bumpGeom((x) => x + 1);
        return;
      }
    }
    if (planTool === 'roof-by-extrusion') {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        const phase = roofByExtrusionStateRef.current.phase;
        if (phase === 'recording') {
          const { state } = reduceRoofByExtrusion(
            roofByExtrusionStateRef.current,
            { kind: 'enter' },
            lvlId ?? '',
          );
          roofByExtrusionStateRef.current = state;
          setRoofByExtrusionPhase(state.phase);
          bumpGeom((x) => x + 1);
        } else if (phase === 'confirm-depth') {
          const { state, effect } = reduceRoofByExtrusion(
            roofByExtrusionStateRef.current,
            { kind: 'enter' },
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
          setNumericInput(null);
          bumpGeom((x) => x + 1);
        }
        return;
      }
      if (/^[0-9]$/.test(ev.key) || ev.key === '.' || ev.key === ',') {
        if (roofByExtrusionStateRef.current.phase === 'confirm-depth') {
          ev.preventDefault();
          const char = ev.key === ',' ? '.' : ev.key;
          const next =
            roofByExtrusionStateRef.current.phase === 'confirm-depth'
              ? roofByExtrusionStateRef.current.depthInput + char
              : char;
          const { state } = reduceRoofByExtrusion(
            roofByExtrusionStateRef.current,
            { kind: 'set-depth', value: next },
            lvlId ?? '',
          );
          roofByExtrusionStateRef.current = state;
          setRoofByExtrusionPhase(state.phase);
          setNumericInput((prev) => {
            const hoverMm = hudMmRef.current;
            const seedPx = hoverMm ? worldToScreen(hoverMm) : { pxX: 100, pxY: 100 };
            return { value: next, pxX: prev?.pxX ?? seedPx.pxX, pxY: prev?.pxY ?? seedPx.pxY };
          });
        }
        return;
      }
    }
    // F-104 — Tab cycles to the next endpoint-connected wall when a wall is
    // selected in select mode. Walks the wall graph: find all walls on the
    // same level whose start or end endpoint is within 10 mm of the current
    // wall's end endpoint, then advance the round-robin index and add the
    // next candidate to the multi-select chain.
    if (ev.key === 'Tab' && planTool === 'select' && selectedId) {
      const nextWallSelection = selectNextConnectedWallByTab(
        elementsById,
        selectedId,
        selectedIds,
        wallTabCycleIndexRef.current,
      );
      if (nextWallSelection) {
        ev.preventDefault();
        wallTabCycleIndexRef.current = nextWallSelection.nextCycleState;
        useBimStore.setState({
          selectedId: nextWallSelection.nextSelectedId,
          selectedIds: nextWallSelection.nextSelectedIds,
        });
        return;
      }
    }
    // §1.8.1 — Generic Tab cycle: when no wall-chain candidate was found
    // (or nothing is selected), cycle through all elements whose bounding
    // box contains the current cursor position in plan space. Sorted by id
    // for determinism. Works in select mode only.
    if (ev.key === 'Tab' && planTool === 'select') {
      const hoverMm = hudMmRef.current;
      if (hoverMm) {
        const pointRect = { xMm: hoverMm.xMm, yMm: hoverMm.yMm };
        const hoveredIds = Object.values(elementsById)
          .filter((el) => {
            if (!el) return false;
            if (displayLevelId && (el as { levelId?: string }).levelId !== displayLevelId)
              return false;
            // Point-containment: treat the cursor as a zero-area box.
            return elementInSelectionBoxMm(el, pointRect, pointRect, 'crossing');
          })
          .map((el) => el!.id)
          .sort();
        if (hoveredIds.length > 0) {
          const currentSel = useBimStore.getState().selectedId ?? null;
          const nextId = nextTabSelection(hoveredIds, currentSel);
          if (nextId) {
            ev.preventDefault();
            selectEl(nextId);
            useBimStore.setState({ selectedIds: [] });
            return;
          }
        }
      }
    }
    if (ev.key === 'Tab' && planTool === 'wall') {
      ev.preventDefault();
      const st = useBimStore.getState();
      st.setWallLocationLine(cycleWallLocationLine(st.wallLocationLine));
      return;
    }
    // EDT-05 — Tab cycles snap candidates while a draw tool is active.
    if (
      ev.key === 'Tab' &&
      planTool != null &&
      planTool !== 'select' &&
      lastSnapHitsRef.current.length > 1
    ) {
      ev.preventDefault();
      snapTabCycleRef.current = bumpSnapTabCycle(snapTabCycleRef.current, lastSnapHitsRef.current);
      setSnapGlyphState((prev) => ({
        candidates: prev.candidates,
        activeIndex: snapTabCycleRef.current.activeIndex,
      }));
      return;
    }
    // F-080 — Revit-style one-shot snap override shortcuts (SI / SE / SM / SN / SC / SP / SX / SW).
    // Two-letter sequence: press S, then within 500 ms press the second letter.
    const snapOverrideShortcut = resolveSnapOverrideShortcut(ev, lastKeyRef.current);
    lastKeyRef.current = snapOverrideShortcut.nextState;
    if (snapOverrideShortcut.override) {
      ev.preventDefault();
      snapOverrideRef.current = snapOverrideShortcut.override;
      setSnapOverrideDisplay(snapOverrideShortcut.override);
    }
    if (ev.key === 'Escape') {
      // §8.9.3: Esc exits group edit mode if active.
      if (useBimStore.getState().groupEditModeDefinitionId) {
        void onSemanticCommand({ type: 'finishEditGroup' });
        return;
      }
      // Cancel the active snap override.
      snapOverrideRef.current = null;
      setSnapOverrideDisplay(null);
      const hadDraft = Boolean(draftRef.current);
      draftRef.current = undefined;
      setWallDraftNotice(null);
      // EDT-V3-05: Esc exits loop mode as well as cancelling the in-flight segment.
      useToolPrefs.getState().setLoopMode(false);
      // TOP-V3-03: Esc clears the in-flight subdivision polygon.
      if (planTool === 'toposolid_subdivision') {
        useToolPrefs.getState().clearSubdivisionDraft();
        if (previewRef.current) {
          grp.remove(previewRef.current);
          previewRef.current.geometry.dispose();
          previewRef.current = null;
        }
        bumpGeom((x) => x + 1);
      }
      if (planTool === 'align') {
        const { state } = reduceAlign(alignStateRef.current, { kind: 'cancel' });
        alignStateRef.current = state;
        // F-121: clear reference overlay on cancel.
        setAlignReferenceMm(null);
      } else if (planTool === 'mirror') {
        mirrorAxisStartRef.current = null;
        setMirrorAxisSet(false);
      } else if (planTool === 'copy') {
        if (copyAnchorRef.current) {
          // First Escape: clear the anchor (cancel second click), stay in copy mode.
          copyAnchorRef.current = null;
          setCopyAnchorSet(false);
        } else {
          // Second Escape (or anchor already null): exit to select.
          setPlanTool('select');
        }
      } else if (planTool === 'move') {
        if (moveAnchorRef.current) {
          // First Escape: clear the anchor, stay in move mode.
          moveAnchorRef.current = null;
          setMoveAnchorSet(false);
        } else {
          // Second Escape: exit to select.
          setPlanTool('select');
        }
      } else if (planTool === 'offset') {
        setPlanTool('select');
      } else if (planTool === 'rotate') {
        rotateAnchorRef.current = null;
        setRotateAnchorSet(false);
        rotateReferenceRef.current = null;
        setRotateReferenceSet(false);
        setNumericInput(null);
      } else if (planTool === 'split') {
        const { state } = reduceSplit(splitStateRef.current, { kind: 'cancel' });
        splitStateRef.current = state;
      } else if (planTool === 'split-wall') {
        const { state } = reduceSplitWall(splitWallStateRef.current, { kind: 'cancel' });
        splitWallStateRef.current = state;
      } else if (planTool === 'trim') {
        const { state } = reduceTrim(trimStateRef.current, { kind: 'cancel' });
        trimStateRef.current = state;
      } else if (planTool === 'trim-extend') {
        trimExtendFirstWallRef.current = null;
        setTrimExtendFirstWallSet(false);
      } else if (planTool === 'wall-join') {
        const { state } = reduceWallJoin(wallJoinStateRef.current, { kind: 'cancel' });
        wallJoinStateRef.current = state;
      } else if (planTool === 'wall-opening') {
        wallOpeningStateRef.current = initialWallOpeningState();
        wallOpeningAnchorRef.current = null;
      } else if (planTool === 'shaft') {
        shaftStateRef.current = initialShaftState();
      } else if (planTool === 'column') {
        columnStateRef.current = initialColumnState();
      } else if (planTool === 'beam') {
        beamStateRef.current = initialBeamState();
      } else if (planTool === 'stair') {
        stairStateRef.current = initialBeamState();
      } else if (planTool === 'ramp') {
        rampStateRef.current = initialRampState();
      } else if (planTool === 'ceiling') {
        ceilingStateRef.current = initialCeilingState();
      } else if (planTool === 'excavation') {
        excavationStateRef.current = initialExcavationState();
      } else if (planTool === 'dimension') {
        const { state } = reducePermanentDim(permanentDimStateRef.current, { kind: 'cancel' });
        permanentDimStateRef.current = state;
        for (const c of dimSnapCirclesRef.current) {
          grp.remove(c);
          c.geometry.dispose();
        }
        dimSnapCirclesRef.current = [];
        bumpGeom((x) => x + 1);
      } else if (planTool === 'terrain-point') {
        const { state } = reduceTerrainPoint(terrainPointStateRef.current, { kind: 'cancel' });
        terrainPointStateRef.current = state;
      } else if (planTool === 'terrain-pad') {
        const { state } = reduceTerrainPad(terrainPadStateRef.current, { kind: 'cancel' });
        terrainPadStateRef.current = state;
        bumpGeom((x) => x + 1);
      } else if (planTool === 'beam-system') {
        beamSystemStateRef.current = initialBeamSystemState();
      } else if (planTool === 'steel-connection') {
        const { state: scState } = reduceSteelConnection(steelConnectionStateRef.current, {
          kind: 'cancel',
        });
        steelConnectionStateRef.current = scState;
        bumpGeom((x) => x + 1);
      } else if (planTool === 'column-at-grids') {
        const { state } = reduceColumnAtGrids(columnAtGridsStateRef.current, { kind: 'cancel' });
        columnAtGridsStateRef.current = state;
        useBimStore.getState().setColumnAtGridsSelectedIds([]);
        setDispatchColumnAtGridsSelectAll(null);
        bumpGeom((x) => x + 1);
      } else if (planTool === 'scale') {
        const { state } = reduceScale(scaleStateRef.current, { kind: 'cancel' });
        scaleStateRef.current = state;
        setScalePhase(state.phase);
        setNumericInput(null);
        bumpGeom((x) => x + 1);
      } else if (planTool === 'array') {
        const { state } = reduceArray(arrayStateRef.current, { kind: 'cancel' });
        arrayStateRef.current = state;
        setArrayPhase(state.phase);
        bumpGeom((x) => x + 1);
      } else if (planTool === 'place-group') {
        const { state } = reducePlaceGroup(placeGroupStateRef.current, { kind: 'cancel' });
        placeGroupStateRef.current = state;
        bumpGeom((x) => x + 1);
      } else if (planTool === 'roof-by-extrusion') {
        const { state } = reduceRoofByExtrusion(
          roofByExtrusionStateRef.current,
          { kind: 'escape' },
          lvlId ?? '',
        );
        roofByExtrusionStateRef.current = state;
        setRoofByExtrusionPhase(state.phase);
        setNumericInput(null);
        setPlanTool('select');
        bumpGeom((x) => x + 1);
      } else if (planTool === 'measure-angle') {
        measureAngleStateRef.current = reduceMeasureAngle(measureAngleStateRef.current, {
          type: 'cancel',
        });
        setMeasureAngleReadout(null);
        bumpGeom((x) => x + 1);
      } else if (planTool === 'measure-arc') {
        measureArcStateRef.current = reduceMeasureArc(measureArcStateRef.current, {
          type: 'cancel',
        });
        setMeasureArcReadout(null);
        bumpGeom((x) => x + 1);
      } else if (planTool === 'model-line') {
        modelLineStateRef.current = initialModelLineState();
        clearPreview();
        bumpGeom((x) => x + 1);
      } else if (planTool === 'linework') {
        const { state } = reduceLinework(lineworkStateRef.current, { kind: 'cancel' });
        lineworkStateRef.current = state;
        setPlanTool('select');
      } else if (planTool === 'conical-roof') {
        const { state } = reduceConicalRoof(conicalRoofStateRef.current, { kind: 'cancel' });
        conicalRoofStateRef.current = state;
        bumpGeom((x) => x + 1);
      } else if (planTool === 'dome-roof') {
        const { state } = reduceDomeRoof(domeRoofStateRef.current, { kind: 'cancel' });
        domeRoofStateRef.current = state;
        bumpGeom((x) => x + 1);
      } else if (planTool === 'spire-roof') {
        const { state } = reduceSpireRoof(spireRoofStateRef.current, { kind: 'cancel' });
        spireRoofStateRef.current = state;
        bumpGeom((x) => x + 1);
      } else if (planTool === 'graded-region') {
        const { state } = reduceGradedRegion(gradedRegionStateRef.current, { kind: 'cancel' });
        gradedRegionStateRef.current = state;
        bumpGeom((x) => x + 1);
      } else if (planTool === 'terrain-split') {
        const { state } = reduceTerrainSplit(terrainSplitStateRef.current, { kind: 'cancel' });
        terrainSplitStateRef.current = state;
        bumpGeom((x) => x + 1);
      } else if (planTool === 'stair-run') {
        stairRunStateRef.current = initialStairRunState();
        bumpGeom((x) => x + 1);
      } else if (planTool === 'stair-landing') {
        stairLandingStateRef.current = initialStairLandingState();
        bumpGeom((x) => x + 1);
      } else if (planTool === 'detail-line') {
        const { state } = reduceDetailLine(detailLineStateRef.current, { kind: 'cancel' });
        detailLineStateRef.current = state;
        bumpGeom((x) => x + 1);
      } else if (planTool === 'detail-filled-region') {
        const { state } = reduceDetailFilledRegion(detailFilledRegionStateRef.current, {
          kind: 'cancel',
        });
        detailFilledRegionStateRef.current = state;
        bumpGeom((x) => x + 1);
      }
      if (
        hadDraft ||
        planTool === 'wall' ||
        planTool === 'grid' ||
        planTool === 'dimension' ||
        planTool === 'measure' ||
        planTool === 'area-boundary'
      ) {
        clearPreview();
      }
      clearMarqueeLine();
      marqueeRef.current = { active: false, sx: 0, sy: 0, ex: 0, ey: 0, direction: null };
      setWallPickLineHint(null);
      bumpGeom((x) => x + 1);
    }
    // EDT-V3-05: L key toggles loop mode while a chained drawing tool is active.
    // L outside a chained tool is a no-op (does not interfere with other bindings).
    if (
      (ev.key === 'l' || ev.key === 'L') &&
      (planTool === 'wall' || planTool === 'beam') &&
      !ev.metaKey &&
      !ev.ctrlKey &&
      !ev.altKey
    ) {
      ev.preventDefault();
      useToolPrefs.getState().setLoopMode(!useToolPrefs.getState().loopMode);
    }
    if (planTool === 'wall-join' && wallJoinStateRef.current.phase === 'selected') {
      if (ev.key === 'n' || ev.key === 'N') {
        const { state } = reduceWallJoin(wallJoinStateRef.current, { kind: 'cycle' });
        wallJoinStateRef.current = state;
      } else if (ev.key === 'Enter') {
        const { state, effect } = reduceWallJoin(wallJoinStateRef.current, { kind: 'accept' });
        wallJoinStateRef.current = state;
        if (effect.commitJoin && effect.commitJoin.wallIds.length > 0) {
          onSemanticCommand({
            type: 'setWallJoinVariant',
            wallIds: effect.commitJoin.wallIds,
            variant: effect.commitJoin.variant,
          });
        }
      }
    }
    if (planTool === 'area-boundary') {
      const d = draftRef.current;
      if (d && d.kind === 'area-boundary' && ev.key === 'Enter') {
        ev.preventDefault();
        const reduced = reduceAreaBoundary({ verticesMm: d.verts }, { kind: 'commit' });
        if (reduced.effect.commitBoundaryMm) {
          commitAreaBoundary(reduced.effect.commitBoundaryMm);
        } else {
          draftRef.current = undefined;
          clearPreview();
          bumpGeom((x) => x + 1);
        }
        return;
      }
    }
    if (planTool === 'revision-cloud') {
      const d = draftRef.current;
      if (d && d.kind === 'revision-cloud') {
        if (ev.key === 'Enter' && d.points.length >= 2 && activePlanViewId) {
          ev.preventDefault();
          void onSemanticCommand({
            type: 'createRevisionCloud',
            hostViewId: activePlanViewId,
            boundaryMm: d.points,
            colour: '#e05000',
          });
          revisionCloudStateRef.current = initialRevisionCloudState();
          draftRef.current = undefined;
          clearPreview();
          bumpGeom((x) => x + 1);
          return;
        }
        if (ev.key === 'Escape') {
          ev.preventDefault();
          revisionCloudStateRef.current = initialRevisionCloudState();
          draftRef.current = undefined;
          clearPreview();
          bumpGeom((x) => x + 1);
          return;
        }
      }
    }
    if (planTool === 'model-line') {
      const d = draftRef.current;
      if (d && d.kind === 'model-line') {
        if (ev.key === 'Enter' && d.points.length >= 2 && activePlanViewId) {
          ev.preventDefault();
          const levelId = displayLevelId ?? '';
          void onSemanticCommand({
            type: 'create_model_line',
            id: crypto.randomUUID(),
            levelId,
            pointsMm: d.points,
          });
          modelLineStateRef.current = initialModelLineState();
          draftRef.current = undefined;
          clearPreview();
          bumpGeom((x) => x + 1);
          return;
        }
        if (ev.key === 'Escape') {
          ev.preventDefault();
          modelLineStateRef.current = initialModelLineState();
          draftRef.current = undefined;
          clearPreview();
          bumpGeom((x) => x + 1);
          return;
        }
      }
    }
    if (planTool === 'detail-region') {
      const dr = draftRef.current;
      if (dr && dr.kind === 'detail-region') {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          if (dr.verts.length >= 2) {
            onSemanticCommand({
              type: 'create_detail_region',
              id: crypto.randomUUID(),
              viewId: activePlanViewId,
              vertices: dr.verts.map((v) => ({ x: v.xMm, y: v.yMm })),
              closed: dr.closed,
              hatchId: dr.hatchId,
            });
          }
          draftRef.current = undefined;
          bumpGeom((x) => x + 1);
          return;
        }
        if (ev.key === 'r' || ev.key === 'R') {
          dr.closed = !dr.closed;
          bumpGeom((x) => x + 1);
          return;
        }
      }
    }
    if (planTool === 'excavation' && ev.key === 'Enter') {
      ev.preventDefault();
      if (excavationStateRef.current.verticesMm.length >= 3) {
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
        bumpGeom((x) => x + 1);
      }
      return;
    }
    if (planTool === 'terrain-point' && ev.key === 'Enter') {
      ev.preventDefault();
      if (
        terrainPointStateRef.current.phase === 'active' &&
        terrainPointStateRef.current.pendingSamples.length > 0
      ) {
        const { effect } = reduceTerrainPoint(terrainPointStateRef.current, { kind: 'commit' });
        terrainPointStateRef.current = initialTerrainPointState();
        if (effect.addTerrainPoints) {
          const { toposolidId, samples } = effect.addTerrainPoints;
          const existing =
            (
              useBimStore.getState().elementsById[toposolidId] as
                | Extract<Element, { kind: 'toposolid' }>
                | undefined
            )?.heightSamples ?? [];
          onSemanticCommand({
            type: 'update_toposolid',
            id: toposolidId,
            patch: { heightSamples: [...existing, ...samples] },
          });
        }
        bumpGeom((x) => x + 1);
      }
      return;
    }
    if (planTool === 'terrain-pad' && ev.key === 'Enter') {
      ev.preventDefault();
      if (terrainPadStateRef.current.phase === 'sketching') {
        const { effect } = reduceTerrainPad(terrainPadStateRef.current, { kind: 'commit' });
        if (effect.createTerrainPad) {
          terrainPadStateRef.current = initialTerrainPadState();
          onSemanticCommand({
            type: 'create_toposolid_pad',
            id: crypto.randomUUID(),
            toposolidId: effect.createTerrainPad.toposolidId,
            boundaryMm: effect.createTerrainPad.boundaryMm,
            elevationMm: effect.createTerrainPad.elevationMm,
          });
        }
        bumpGeom((x) => x + 1);
      }
      return;
    }
    // §8.6.2 — stair-landing commit on Enter
    if (planTool === 'stair-landing' && ev.key === 'Enter') {
      ev.preventDefault();
      const { state: slState, effect: slEffect } = reduceStairLanding(
        stairLandingStateRef.current,
        { kind: 'enter' },
      );
      stairLandingStateRef.current = slState;
      if (slEffect?.kind === 'addStairLanding') {
        void onSemanticCommand({
          type: 'addStairLanding',
          landing: { ...slEffect.landing, id: crypto.randomUUID(), kind: 'stair_landing' },
        });
      }
      bumpGeom((x) => x + 1);
      return;
    }
    // §5.1.6 — graded-region commit on Enter
    if (planTool === 'graded-region' && ev.key === 'Enter') {
      ev.preventDefault();
      const { state: grState, effect: grEffect } = reduceGradedRegion(
        gradedRegionStateRef.current,
        { kind: 'commit' },
      );
      gradedRegionStateRef.current = grState;
      if (grEffect.createGradedRegion && lvlId) {
        onSemanticCommand({
          type: 'createElement',
          element: {
            kind: 'graded_region',
            id: crypto.randomUUID(),
            hostToposolidId: null,
            boundaryMm: grEffect.createGradedRegion.perimeterMm,
            targetMode: 'slope' as const,
            perimeterMm: grEffect.createGradedRegion.perimeterMm,
            lowerElevationMm: grEffect.createGradedRegion.lowerElevationMm,
            upperElevationMm: grEffect.createGradedRegion.upperElevationMm,
            levelId: lvlId,
          },
        });
      }
      bumpGeom((x) => x + 1);
      return;
    }
    // §6.4.2 — detail-line commit on Enter
    if (planTool === 'detail-line' && ev.key === 'Enter') {
      ev.preventDefault();
      const { state: dlState, effect: dlEffect } = reduceDetailLine(detailLineStateRef.current, {
        kind: 'commit',
      });
      detailLineStateRef.current = dlState;
      if (dlEffect?.kind === 'createDetailLine') {
        void onSemanticCommand({
          type: 'addDetailLine',
          element: {
            kind: 'detail_line',
            id: crypto.randomUUID(),
            hostViewId: activePlanViewId ?? '',
            pointsMm: dlEffect.pointsMm,
            lineStyle: dlEffect.lineStyle,
            levelId: lvlId ?? null,
            viewId: activePlanViewId ?? null,
          },
        });
      }
      bumpGeom((x) => x + 1);
      return;
    }
    // §6.4.2 — detail-filled-region commit on Enter
    if (planTool === 'detail-filled-region' && ev.key === 'Enter') {
      ev.preventDefault();
      const { state: dfrState, effect: dfrEffect } = reduceDetailFilledRegion(
        detailFilledRegionStateRef.current,
        { kind: 'commit' },
      );
      detailFilledRegionStateRef.current = dfrState;
      if (dfrEffect?.kind === 'createDetailFilledRegion') {
        void onSemanticCommand({
          type: 'addDetailFilledRegion',
          element: {
            kind: 'detail_filled_region',
            id: crypto.randomUUID(),
            perimeterMm: dfrEffect.perimeterMm,
            fillPattern: dfrEffect.fillPattern,
            levelId: lvlId ?? null,
            viewId: activePlanViewId ?? null,
          },
        });
      }
      bumpGeom((x) => x + 1);
      return;
    }
    // §5.1.6 — terrain-split commit on Enter
    if (planTool === 'terrain-split' && ev.key === 'Enter') {
      ev.preventDefault();
      const { state: tsState, effect: tsEffect } = reduceTerrainSplit(
        terrainSplitStateRef.current,
        { kind: 'commit' },
      );
      terrainSplitStateRef.current = tsState;
      if (tsEffect.splitTerrain) {
        const { toposolidId, splitLineMm } = tsEffect.splitTerrain;
        const topo = useBimStore.getState().elementsById[toposolidId];
        if (topo && topo.kind === 'toposolid') {
          const [left, right] = splitToposolid(
            topo as Extract<typeof topo, { kind: 'toposolid' }>,
            splitLineMm,
          );
          onSemanticCommand({ type: 'createElement', element: left });
          onSemanticCommand({ type: 'createElement', element: right });
          onSemanticCommand({ type: 'deleteElement', elementId: toposolidId });
        }
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (planTool === 'dimension' && ev.key === 'Enter') {
      ev.preventDefault();
      const { state, effect } = reducePermanentDim(permanentDimStateRef.current, {
        kind: 'commit',
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
        clearPreview();
        for (const c of dimSnapCirclesRef.current) {
          grp.remove(c);
          c.geometry.dispose();
        }
        dimSnapCirclesRef.current = [];
        bumpGeom((x) => x + 1);
      }
      return;
    }
    if (planTool === 'column-at-grids' && ev.key === 'Enter') {
      ev.preventDefault();
      const { state: nextState, effect } = reduceColumnAtGrids(columnAtGridsStateRef.current, {
        kind: 'confirm',
      });
      columnAtGridsStateRef.current = nextState;
      if (effect.commitAtGrids && lvlId) {
        const selectedGrids = effect.commitAtGrids.selectedGridIds
          .map((id) => elementsById[id])
          .filter((e): e is Extract<Element, { kind: 'grid_line' }> => e?.kind === 'grid_line');
        const positions = columnPositionsAtGridIntersections(selectedGrids);
        for (const pos of positions) {
          onSemanticCommand({
            type: 'createColumn',
            levelId: lvlId,
            positionMm: pos,
          });
        }
        useBimStore.getState().setColumnAtGridsSelectedIds([]);
        setDispatchColumnAtGridsSelectAll(null);
      }
      bumpGeom((x) => x + 1);
      return;
    }
    if (
      planTool === 'array' &&
      (arrayPhase === 'confirm-linear' || arrayPhase === 'confirm-radial') &&
      ev.key === 'Enter'
    ) {
      ev.preventDefault();
      const { state, effect } = reduceArray(arrayStateRef.current, { kind: 'confirm' });
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
    // B03 — PageUp/PageDown level cycling via PlanCamera.cycleLevel (spec §14.6)
    if (ev.key === 'PageUp' || ev.key === 'PageDown') {
      ev.preventDefault();
      const st = useBimStore.getState();
      const lvls = Object.values(st.elementsById)
        .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
        .sort((a, b) => a.elevationMm - b.elevationMm);
      const order = lvls.map((l) => l.id);
      if (!order.length) return;
      const curId = displayLevelId || activeLevelResolvedId || order[0]!;
      const cam = new PlanCamera(
        { plotScale: 1, centerMm: { xMm: 0, yMm: 0 }, activeLevelId: curId },
        order,
      );
      const nextId = cam.cycleLevel(ev.key === 'PageUp' ? 'up' : 'down');
      st.setActiveLevelId(nextId);
    }
    if (ev.code === 'Space') {
      ev.preventDefault();
      const d = draftRef.current;
      if (planTool === 'wall' && d?.kind === 'wall') {
        wallFlipRef.current = !wallFlipRef.current;
        bumpGeom((x) => x + 1);
      } else {
        spaceDownRef.current = true;
      }
    }
    // FAM-10 — Cmd/Ctrl + C/V copy-paste handlers.
    if ((ev.metaKey || ev.ctrlKey) && (ev.key === 'c' || ev.key === 'C')) {
      const st = useBimStore.getState();
      // F-100: copy the full multi-select set (selectedIds ∪ selectedId).
      const allCopyIds = [st.selectedId, ...st.selectedIds].filter(
        (id): id is string => typeof id === 'string',
      );
      // Deduplicate in case selectedId is already in selectedIds.
      const uniqueCopyIds = [...new Set(allCopyIds)];
      const elementsToCopy = uniqueCopyIds
        .map((id) => st.elementsById[id])
        .filter((el): el is Element => el != null);
      if (elementsToCopy.length === 0) return;
      const localUserFamilies = st.userFamilies ?? {};
      const resolveFamilyById = (id: string): FamilyDefinition | undefined =>
        localUserFamilies[id] ?? getBuiltInFamilyById(id);
      const payload = copyElementsToClipboard({
        sourceProjectId: st.modelId ?? 'unknown-project',
        sourceModelId: st.modelId ?? 'unknown-model',
        elements: elementsToCopy,
        resolveFamilyById,
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bim-ai:clipboard-copy', { detail: payload }));
      }
    }
    if ((ev.metaKey || ev.ctrlKey) && (ev.key === 'v' || ev.key === 'V')) {
      const st = useBimStore.getState();
      const localUserFamilies = Object.values(st.userFamilies ?? {});
      const localBuiltins: FamilyDefinition[] = [];
      for (const id of Object.keys(st.elementsById)) {
        const familyId = familyIdForElement(st.elementsById[id]);
        if (familyId) {
          const def = getBuiltInFamilyById(familyId);
          if (def && !localBuiltins.some((b) => b.id === def.id)) localBuiltins.push(def);
        }
      }
      void pasteFromOSClipboard({
        targetProjectId: st.modelId ?? 'unknown-project',
        localFamilies: [...localUserFamilies, ...localBuiltins],
        cursorMm: st.planHudMm,
      }).then((result) => {
        if (!result) return;
        if (result.familiesToImport.length > 0) {
          st.importFamilyDefinitions(result.familiesToImport);
        }
        if (result.elements.length > 0) {
          st.mergeElements(result.elements);
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('bim-ai:clipboard-paste', { detail: result }));
        }
      });
    }
    // §1.8.1 — Ctrl+A selects all elements on the active level when in select mode.
    if ((ev.metaKey || ev.ctrlKey) && (ev.key === 'a' || ev.key === 'A') && planTool === 'select') {
      ev.preventDefault();
      const levelId = displayLevelId || activeLevelResolvedId;
      const allIds = Object.values(elementsById)
        .filter((el) => (el as { levelId?: string }).levelId === levelId)
        .map((el) => el.id);
      if (allIds.length > 0) {
        selectEl(allIds[0]);
        useBimStore.getState().clearSelectedIds();
        for (const id of allIds.slice(1)) {
          useBimStore.getState().toggleSelectedId(id);
        }
      }
      return;
    }
    // F-100 — Delete / Backspace deletes the full multi-select set.
    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      // Skip if a grip drag or numeric override input is in progress.
      if (gripDragRef.current) return;
      if (ev.key === 'Backspace' && numericInputRef.current) return;
      const st = useBimStore.getState();
      // Build the union of primary selection and multi-select set.
      const allDeleteIds = [st.selectedId, ...st.selectedIds].filter(
        (id): id is string => typeof id === 'string',
      );
      const idsToDelete = [...new Set(allDeleteIds)];
      if (idsToDelete.length === 0) return;
      if (idsToDelete.length === 1) {
        void onSemanticCommand({ type: 'deleteElement', elementId: idsToDelete[0] });
      } else {
        void onSemanticCommand({ type: 'deleteElements', elementIds: idsToDelete });
      }
      selectEl(undefined);
      useBimStore.getState().clearSelectedIds();
    }
    // B8 — PN chord: pin all selected elements (Revit parity).
    if (ev.key === 'p' || ev.key === 'P') {
      if (pendingPinChordRef.current) clearTimeout(pendingPinChordRef.current);
      pendingPinChordRef.current = setTimeout(() => {
        pendingPinChordRef.current = null;
      }, 500);
      return;
    }
    if ((ev.key === 'n' || ev.key === 'N') && pendingPinChordRef.current) {
      clearTimeout(pendingPinChordRef.current);
      pendingPinChordRef.current = null;
      const st = useBimStore.getState();
      const ids = [
        ...new Set(
          [st.selectedId, ...st.selectedIds].filter((id): id is string => typeof id === 'string'),
        ),
      ];
      if (ids.length > 0) void onSemanticCommand({ type: 'pinElements', elementIds: ids });
      return;
    }
    // §3.3.9 — CS chord: Create Similar — press C then S within 500ms.
    if (ev.key === 'c' || ev.key === 'C') {
      if (pendingCsChordRef.current) clearTimeout(pendingCsChordRef.current);
      pendingCsChordRef.current = setTimeout(() => {
        pendingCsChordRef.current = null;
      }, 500);
      return;
    }
    if ((ev.key === 's' || ev.key === 'S') && pendingCsChordRef.current) {
      clearTimeout(pendingCsChordRef.current);
      pendingCsChordRef.current = null;
      const st = useBimStore.getState();
      const selectedId = st.selectedId ?? st.selectedIds[0];
      if (selectedId) {
        const el = st.elementsById[selectedId];
        if (el) {
          const payload = createSimilarPayload(el);
          if (payload) {
            setPlanTool(payload.toolId);
          }
        }
      }
      return;
    }
  };
  const onKeyUp = (ev: KeyboardEvent) => {
    if (ev.code === 'Space') {
      spaceDownRef.current = false;
      dragRef.current.dragging = false;
    }
  };

  // ANN-02: right-click on a wall opens a context menu with
  // "Generate Section Cut" / "Generate Elevation".
  const onContextMenu = (ev: MouseEvent) => {
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
    if (!h) {
      // §1.7.1: no element hit — show canvas-level context menu with navigation commands.
      ev.preventDefault();
      setCanvasCtxMenu({ x: ev.clientX, y: ev.clientY });
      setWallContextMenu(null);
      setUnhideContextMenu(null);
      setWallJoinCtxMenu(null);
      return;
    }
    const id = (h.object.userData as { bimPickId: string }).bimPickId;
    const el = elementsById[id];
    if (!el) {
      setWallContextMenu(null);
      setUnhideContextMenu(null);
      setWallJoinCtxMenu(null);
      return;
    }

    // F-014: in reveal hidden mode, right-click on a hidden element → Unhide in View menu.
    // F-102: also handle per-element hidden IDs (check before category check).
    if (revealHiddenMode && display.hiddenElementIds.has(el.id)) {
      ev.preventDefault();
      setUnhideContextMenu({
        elementKind: el.kind,
        elementId: el.id,
        position: { x: ev.clientX, y: ev.clientY },
      });
      setWallContextMenu(null);
      setWallJoinCtxMenu(null);
      return;
    }
    if (revealHiddenMode && display.hiddenSemanticKinds.has(el.kind as PlanSemanticKind)) {
      ev.preventDefault();
      setUnhideContextMenu({ elementKind: el.kind, position: { x: ev.clientX, y: ev.clientY } });
      setWallContextMenu(null);
      setWallJoinCtxMenu(null);
      return;
    }

    if (el.kind !== 'wall') {
      // §1.7.2: show generic element context menu for non-wall elements.
      ev.preventDefault();
      setElementCtxMenu({ el, position: { x: ev.clientX, y: ev.clientY } });
      setWallContextMenu(null);
      setUnhideContextMenu(null);
      setWallJoinCtxMenu(null);
      return;
    }

    // F-040: if the right-click lands within 20mm of a wall endpoint, show
    // the Allow/Disallow Join context menu for that endpoint instead of the
    // generic wall context menu.
    const clickMm = rayToPlanMm(rnd, camNow, ev.clientX, ev.clientY);
    if (clickMm) {
      const ENDPOINT_SNAP_MM = 20;
      const wall = el;
      const distStart = Math.hypot(clickMm.xMm - wall.start.xMm, clickMm.yMm - wall.start.yMm);
      const distEnd = Math.hypot(clickMm.xMm - wall.end.xMm, clickMm.yMm - wall.end.yMm);
      const nearestEndpoint =
        distStart <= ENDPOINT_SNAP_MM && distStart <= distEnd
          ? 'start'
          : distEnd <= ENDPOINT_SNAP_MM
            ? 'end'
            : null;
      if (nearestEndpoint !== null) {
        ev.preventDefault();
        const currentlyDisallowed =
          nearestEndpoint === 'start'
            ? (wall.joinDisallowStart ?? false)
            : (wall.joinDisallowEnd ?? false);
        setWallJoinCtxMenu({
          wallId: wall.id,
          endpoint: nearestEndpoint,
          position: { x: ev.clientX, y: ev.clientY },
          currentlyDisallowed,
        });
        setWallContextMenu(null);
        setUnhideContextMenu(null);
        return;
      }
    }

    ev.preventDefault();
    setWallContextMenu({ wall: el, position: { x: ev.clientX, y: ev.clientY } });
    setWallJoinCtxMenu(null);
  };

  // VIE-03: double-click an elevation marker (or plan_view marker) to open
  // the corresponding view. Looks up bimPickId via raycast, then routes to
  // the right activation action based on element kind.
  const onDblClick = (ev: MouseEvent) => {
    if (planTool === 'dimension') {
      ev.preventDefault();
      const { state, effect } = reducePermanentDim(permanentDimStateRef.current, {
        kind: 'commit',
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
        clearPreview();
        for (const c of dimSnapCirclesRef.current) {
          grp.remove(c);
          c.geometry.dispose();
        }
        dimSnapCirclesRef.current = [];
        bumpGeom((x) => x + 1);
      }
      return;
    }
    if (planTool === 'area-boundary') {
      const d = draftRef.current;
      if (d && d.kind === 'area-boundary' && d.verts.length >= 3) {
        ev.preventDefault();
        const reduced = reduceAreaBoundary({ verticesMm: d.verts }, { kind: 'commit' });
        if (reduced.effect.commitBoundaryMm) {
          commitAreaBoundary(reduced.effect.commitBoundaryMm);
        }
        return;
      }
    }
    if (planTool === 'revision-cloud') {
      const d = draftRef.current;
      if (d && d.kind === 'revision-cloud' && d.points.length >= 2 && activePlanViewId) {
        ev.preventDefault();
        void onSemanticCommand({
          type: 'createRevisionCloud',
          hostViewId: activePlanViewId,
          boundaryMm: d.points,
          colour: '#e05000',
        });
        revisionCloudStateRef.current = initialRevisionCloudState();
        draftRef.current = undefined;
        clearPreview();
        bumpGeom((x) => x + 1);
        return;
      }
    }
    if (planTool === 'model-line') {
      const d = draftRef.current;
      if (d && d.kind === 'model-line' && d.points.length >= 2 && activePlanViewId) {
        ev.preventDefault();
        const levelId = displayLevelId ?? '';
        void onSemanticCommand({
          type: 'create_model_line',
          id: crypto.randomUUID(),
          levelId,
          pointsMm: d.points,
        });
        modelLineStateRef.current = initialModelLineState();
        draftRef.current = undefined;
        clearPreview();
        bumpGeom((x) => x + 1);
        return;
      }
    }
    if (planTool === 'excavation' && excavationStateRef.current.verticesMm.length >= 3) {
      ev.preventDefault();
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
      bumpGeom((x) => x + 1);
      return;
    }
    // §5.1.4: double-click with ≥3 points commits terrain-pad
    if (
      planTool === 'terrain-pad' &&
      terrainPadStateRef.current.phase === 'sketching' &&
      terrainPadStateRef.current.points.length >= 3
    ) {
      ev.preventDefault();
      const { effect } = reduceTerrainPad(terrainPadStateRef.current, { kind: 'commit' });
      if (effect.createTerrainPad) {
        terrainPadStateRef.current = initialTerrainPadState();
        onSemanticCommand({
          type: 'create_toposolid_pad',
          id: crypto.randomUUID(),
          toposolidId: effect.createTerrainPad.toposolidId,
          boundaryMm: effect.createTerrainPad.boundaryMm,
          elevationMm: effect.createTerrainPad.elevationMm,
        });
      }
      bumpGeom((x) => x + 1);
      return;
    }
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
    if (!h) {
      // TOP-V3-03: double-click on empty canvas while toposolid_subdivision tool
      // is active closes the in-flight polygon and emits the command.
      if (planTool === 'toposolid_subdivision') {
        const d = draftRef.current;
        if (d && d.kind === 'toposolid-subdivision' && d.verts.length >= 3) {
          const draft = useToolPrefs.getState().subdivisionDraft;
          onSemanticCommand({
            type: 'create_toposolid_subdivision',
            id: crypto.randomUUID(),
            hostToposolidId: draft?.hostToposolidId ?? null,
            boundaryMm: d.verts,
            finishCategory: d.finishCategory,
            materialKey: d.finishCategory,
          });
          draftRef.current = undefined;
          useToolPrefs.getState().clearSubdivisionDraft();
          if (previewRef.current) {
            grp.remove(previewRef.current);
            previewRef.current.geometry.dispose();
            previewRef.current = null;
          }
          bumpGeom((x) => x + 1);
        }
      }
      return;
    }
    const id = (h.object.userData as { bimPickId: string }).bimPickId;

    // §1.8.3: double-click dispatch table — group instances live in groupRegistry,
    // not in elementsById, so pass them separately.
    const groupInst = useBimStore.getState().groupRegistry.instances[id];
    if (
      handleDblClickDispatch(id, elementsById[id], groupInst, planTool, {
        selectEl,
        setActiveLevelId,
        onSemanticCommand,
      })
    ) {
      return;
    }

    const el = elementsById[id];
    if (!el) return;
    // TOP-V3-03: double-click on a toposolid element while the subdivision
    // tool is active closes the polygon on that host.
    if (planTool === 'toposolid_subdivision' && el.kind === 'toposolid') {
      const d = draftRef.current;
      if (d && d.kind === 'toposolid-subdivision' && d.verts.length >= 3) {
        onSemanticCommand({
          type: 'create_toposolid_subdivision',
          id: crypto.randomUUID(),
          hostToposolidId: el.id,
          boundaryMm: d.verts,
          finishCategory: d.finishCategory,
          materialKey: d.finishCategory,
        });
        draftRef.current = undefined;
        useToolPrefs.getState().clearSubdivisionDraft();
        if (previewRef.current) {
          grp.remove(previewRef.current);
          previewRef.current.geometry.dispose();
          previewRef.current = null;
        }
        bumpGeom((x) => x + 1);
      }
      return;
    }

    if (el.kind === 'elevation_view') {
      activateElevationView(id);
    } else if (el.kind === 'plan_view') {
      activatePlanView(id);
    }
  };

  return { onWheel, onKey, onKeyUp, onContextMenu, onDblClick };
}
