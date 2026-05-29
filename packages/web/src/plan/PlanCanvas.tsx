/* eslint-disable bim-ai/no-hex-in-chrome -- pre-v3 hex literals; remove when this file is migrated in B4 Phase 2 */
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import {
  initialAlignState,
  initialSplitState,
  initialTrimState,
  initialWallJoinState,
  initialWallOpeningState,
  initialShaftState,
  reduceAlign,
  reduceSplit,
  reduceTrim,
  reduceWallJoin,
  type AlignState,
  type SplitState,
  type TrimState,
  type WallJoinState,
  type WallOpeningState,
  type ShaftState,
  initialColumnState,
  type ColumnState,
  initialBeamState,
  type BeamState,
  initialCeilingState,
  type CeilingState,
  initialBeamSystemState,
  type BeamSystemState,
  cycleWallLocationLine,
  reduceAreaBoundary,
  initialTextAnnotationState,
  type TextAnnotationState,
  initialLeaderTextState,
  type LeaderTextState,
  initialColumnAtGridsState,
  reduceColumnAtGrids,
  type ColumnAtGridsState,
  initialRoofState,
  initialScaleState,
  reduceScale,
  type ScaleState,
  initialRoofByExtrusionState,
  reduceRoofByExtrusion,
  type RoofByExtrusionState,
  initialRevisionCloudState,
  type RevisionCloudState,
  initialExcavationState,
  reduceExcavation,
  type ExcavationState,
  initialArrayState,
  reduceArray,
  type ArrayState,
  initialPlaceGroupState,
  reducePlaceGroup,
  type PlaceGroupState,
  initialSteelConnectionState,
  reduceSteelConnection,
  type SteelConnectionState,
  initialSplitWallState,
  reduceSplitWall,
  type SplitWallState,
  initialTerrainPadState,
  reduceTerrainPad,
  type TerrainPadState,
  initialTerrainPointState,
  reduceTerrainPoint,
  type TerrainPointState,
  initialPermanentDimState,
  reducePermanentDim,
  type PermanentDimState,
  initialMeasureAngleState,
  reduceMeasureAngle,
  type MeasureAngleState,
  initialMeasureArcState,
  reduceMeasureArc,
  type MeasureArcState,
  initialModelLineState,
  type ModelLineState,
  initialLineworkState,
  reduceLinework,
  type LineworkState,
  initialConicalRoofState,
  reduceConicalRoof,
  type ConicalRoofState,
  initialDomeRoofState,
  reduceDomeRoof,
  type DomeRoofState,
  initialSpireRoofState,
  reduceSpireRoof,
  type SpireRoofState,
  initialRampState,
  type RampState,
  initialGradedRegionState,
  reduceGradedRegion,
  type GradedRegionState,
  initialTerrainSplitState,
  reduceTerrainSplit,
  type TerrainSplitState,
  initialStairRunState,
  type StairRunState,
  initialStairLandingState,
  reduceStairLanding,
  type StairLandingState,
  initialDetailLineState,
  reduceDetailLine,
  type DetailLineState,
  initialDetailFilledRegionState,
  reduceDetailFilledRegion,
  type DetailFilledRegionState,
} from '../tools/toolGrammar';
import { buildScaleCommand } from './scaleTool';
import { linearArrayOffsets, radialArrayAngles, radialOffsetForElement } from './arrayTool';
import { columnPositionsAtGridIntersections } from './columnAtGrids';
import { splitToposolid } from './terrainSplit';
import { handleDblClickDispatch } from './doubleClickDispatch';
import * as THREE from 'three';
import { parseDimensionInput } from '@bim-ai/core';
import type { Element } from '@bim-ai/core';

import { useBimStore, type PlanTool } from '../state/store';
import { useRenderCount, useTheme } from '@bim-ai/web-state';
import type { CategoryOverride } from '../state/storeTypes';
import { snapPlanPoint, type SegmentLine, type SnapHit, type SnapKind } from './snapEngine';
import { useCoalescedSetter } from './useCoalescedSetter';
import { SnapEngine } from './planCanvasState';
import { loadSnapSettings, type SnapSettings, type ToggleableSnapKind } from './snapSettings';
import { bumpSnapTabCycle, initialSnapTabCycle, type SnapTabCycleState } from './snapTabCycle';
import { type DraftMutation, type GripDescriptor } from './gripProtocol';
import { SLICE_Y, orthoExtents, rayToPlanMm } from './interaction/planCameraMath';
import {
  resolveSnapOverrideShortcut,
  type SnapOverrideKeyState,
} from './interaction/snapOverrideShortcuts';
import { readPlanToken, type Draft } from './planCanvasHelpers';
import { PlanCanvasReadouts } from './PlanCanvasReadouts';
import { PlanCanvasToolOverlays } from './PlanCanvasToolOverlays';
import { PlanCanvasStatusOverlays } from './PlanCanvasStatusOverlays';
import { PlanCanvasWorkflowOverlays } from './PlanCanvasWorkflowOverlays';
import { PlanCanvasAuthoringOverlays } from './PlanCanvasAuthoringOverlays';
import { PlanCanvasRoomColorLegend } from './PlanCanvasRoomColorLegend';
import { PlanCanvasWallDraftOverlays } from './PlanCanvasWallDraftOverlays';
import { PlanCanvasContextOverlays } from './PlanCanvasContextOverlays';
import { PlanCanvasViewControls } from './PlanCanvasViewControls';
import { PlanCanvasSketchOverlay } from './PlanCanvasSketchOverlay';
import { usePlanCanvasContextActions } from './usePlanCanvasContextActions';
import { usePlanCanvasViewState } from './planCanvasViewState';
import { usePlanCanvasColorSchemeState } from './planCanvasColorSchemeState';
import { PlanCanvasEmptyStateOverlay } from './PlanCanvasEmptyStateOverlay';
import { usePlanCanvasSelectionState } from './planCanvasSelectionState';
import { usePlanProjectionWireSync } from './usePlanProjectionWireSync';
import { usePlanCanvasToolCleanupEffects } from './usePlanCanvasToolCleanupEffects';
import { usePlanCanvasCameraControls } from './usePlanCanvasCameraControls';
import { usePlanCanvasSceneLifecycle } from './usePlanCanvasSceneLifecycle';
import {
  usePlanCanvasRenderPasses,
  type PlanCanvasDraftingPaint,
} from './usePlanCanvasRenderPasses';
import { usePlanCanvasDerivedViewData } from './usePlanCanvasDerivedViewData';
import { usePlanCanvasToolActivation } from './usePlanCanvasToolActivation';
import { usePlanCanvasViewEffects } from './usePlanCanvasViewEffects';
import { usePlanCanvasGripHandlers } from './usePlanCanvasGripHandlers';
import { createPlanCanvasKeyboardAuxHandlers } from './planCanvasKeyboardAuxHandlers';
import { createPlanCanvasClickHandler } from './planCanvasClickHandler';
import { PlanCanvasEditLayers } from './PlanCanvasEditLayers';
import {
  extractPlanAnnotationHints,
  extractPlanGraphicHints,
  extractPlanTagStyleHints,
} from './planProjectionWire';
import { type CropBounds, type CropHandleId } from './cropRegionDragHandles';
import {
  dxfViewOverrideKey,
  queryDxfPrimitiveAtPoint,
  selectDxfUnderlaysForLevel,
  type DxfPrimitiveQueryHit,
} from './dxfUnderlay';
import { type MmToScreen, type PointerToMm } from './SketchCanvas';
import { parseTypedRotateAngle } from './rotateTool';
import { selectNextConnectedWallByTab } from './wallChainSelection';
import { elementInSelectionBoxMm } from './boxSelection';
import { nextTabSelection } from './tabCycleSelection';
import { createPlanCanvasPreviewHelpers } from './planCanvasPreviewHelpers';
import { createPlanCanvasPickHelpers } from './planCanvasPickHelpers';
import { handleGripPointerUp } from './planCanvasGripPointerUp';
import { updatePlanCanvasSnapHover } from './planCanvasSnapHover';
import {
  updateColumnAtGridsHover,
  updateComponentGhostHover,
  updateSplitWallHover,
} from './planCanvasHoverHandlers';
import {
  handleCropPointerDown,
  handleCropPointerMove,
  handleCropPointerUp,
} from './planCanvasCropInteractions';
import {
  handleMarqueePointerUp,
  handlePanMarqueePointerDown,
  handlePanMarqueePointerMove,
} from './planCanvasPanMarqueeInteractions';
import { handleWallOpeningPointerUp } from './planCanvasWallOpeningInteraction';
import { type PickedWallLine } from './wallPickLines';
import { snapWallPointToConnectivity } from '../geometry/wallConnectivity';
import { getFamilyById as getBuiltInFamilyById } from '../families/familyCatalog';
import {
  copyElementsToClipboard,
  pasteElementsFromClipboard,
  pasteFromOSClipboard,
} from '../clipboard/copyPaste';
import { useToolPrefs } from '../tools/toolPrefsStore';
import {
  activeComponentAssetId,
  activeComponentAssetPreviewEntry,
  activeComponentFamilyTypeId,
  copyMultipleEnabled,
  mirrorCopyEnabled,
  pendingComponentRotationDeg,
  setPendingComponentRotationDeg,
  setDispatchColumnAtGridsSelectAll,
} from '../workspace/authoring';
import { ColorSchemeLegend } from './ColorSchemeLegend';
import { resolvePlanCanvasHudState } from './planCanvasHudState';
import {
  beginPlanPointerMoveSample,
  classifyPlanPointerMoveScenario,
} from './planPointerMovePerformance';

/** Imperative handle so the tab host can snapshot / restore the 2D camera
 * without continuous callbacks. Fill via cameraHandleRef prop. */
export interface PlanCameraHandle {
  getSnapshot(): { centerMm: { xMm: number; yMm: number }; halfMm: number };
  applySnapshot(snap: { centerMm?: { xMm?: number; yMm?: number }; halfMm?: number }): void;
}

type Props = {
  wsConnected: boolean;
  activeLevelResolvedId: string;
  /** Pane-pinned plan view. null means this pane is a level plan, not a saved plan_view. */
  activePlanViewId?: string | null;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
  /** Ref filled with the imperative camera handle once the canvas mounts. */
  cameraHandleRef?: RefObject<PlanCameraHandle | null>;
  /** Camera to restore on mount (ignored after first render). */
  initialCamera?: { centerMm?: { xMm: number; yMm: number }; halfMm?: number };
  /** Global discipline lens from the StatusBar dropdown: 'all' | 'architecture' | 'structure' | 'mep' */
  lensMode?: string;
  /** Pane-local active authoring command. Falls back to the global store when omitted. */
  activePlanTool?: PlanTool;
  onActivePlanToolChange?: (tool: PlanTool) => void;
  /** Footer-owned snap settings; PlanCanvas only consumes them for candidate filtering. */
  snapSettings?: SnapSettings;
};

export function PlanCanvas({
  wsConnected,
  activeLevelResolvedId,
  activePlanViewId: activePlanViewIdProp,
  onSemanticCommand,
  cameraHandleRef,
  initialCamera,
  lensMode = 'all',
  activePlanTool,
  onActivePlanToolChange,
  snapSettings: controlledSnapSettings,
}: Props) {
  // PERF-G07: dev-only render-count probe. No-op in production.
  useRenderCount('PlanCanvas');
  void wsConnected;
  const theme = useTheme();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rootRef = useRef<THREE.Group | null>(null);
  const previewRef = useRef<THREE.Line | null>(null);
  const marqueeLineRef = useRef<THREE.Line | null>(null);
  const marqueeFillRef = useRef<THREE.Mesh | null>(null);
  const componentGhostRef = useRef<THREE.Group | null>(null);
  const dragRef = useRef({ dragging: false, lastXmm: 0, lastZmm: 0, camX: 0, camZ: 0 });
  const skipClickRef = useRef(false);
  const camRef = useRef({
    camX: initialCamera?.centerMm ? initialCamera.centerMm.xMm / 1000 : 0,
    camZ: initialCamera?.centerMm ? initialCamera.centerMm.yMm / 1000 : -2.8,
    half: initialCamera?.halfMm !== undefined ? initialCamera.halfMm / 1000 : 22,
  });
  const draftRef = useRef<Draft | undefined>(undefined);
  const wallFlipRef = useRef(false);
  // PLN-02 — active crop-region drag (handle id + pointer/bounds at drag start).
  const cropDragRef = useRef<
    | {
        handle: CropHandleId;
        planViewId: string;
        startBounds: CropBounds;
        startPointerMm: { xMm: number; yMm: number };
        currentBounds: CropBounds;
      }
    | undefined
  >(undefined);
  const cropOverlayRef = useRef<THREE.Group | null>(null);
  // §1.6.10: crop region grip drag state (getCropRegionGrips / applyCropGripDrag)
  const cropGripDragRef = useRef<{
    gripId: string;
    startPlanPt: { xMm: number; yMm: number };
    cropAtStart: { minXMm: number; minYMm: number; maxXMm: number; maxYMm: number };
    planViewId: string;
  } | null>(null);
  const alignStateRef = useRef<AlignState>(initialAlignState());
  // F-121: React state mirror of alignStateRef.current.referenceMm so SVG overlay re-renders.
  const [alignReferenceMm, setAlignReferenceMm] = useState<{
    xMm: number;
    yMm: number;
  } | null>(null);
  const mirrorAxisStartRef = useRef<{ xMm: number; yMm: number } | null>(null);
  const [mirrorAxisSet, setMirrorAxisSet] = useState(false);
  const copyAnchorRef = useRef<{ xMm: number; yMm: number } | null>(null);
  const [copyAnchorSet, setCopyAnchorSet] = useState(false);
  const moveAnchorRef = useRef<{ xMm: number; yMm: number } | null>(null);
  const [moveAnchorSet, setMoveAnchorSet] = useState(false);
  const rotateAnchorRef = useRef<{ xMm: number; yMm: number } | null>(null);
  const [rotateAnchorSet, setRotateAnchorSet] = useState(false);
  const rotateReferenceRef = useRef<{ xMm: number; yMm: number } | null>(null);
  const [rotateReferenceSet, setRotateReferenceSet] = useState(false);
  const scaleStateRef = useRef<ScaleState>(initialScaleState());
  const [scalePhase, setScalePhase] = useState<ScaleState['phase']>('idle');
  const arrayStateRef = useRef<ArrayState>(initialArrayState());
  const [arrayPhase, setArrayPhase] = useState<ArrayState['phase']>('idle');
  const placeGroupStateRef = useRef<PlaceGroupState>(initialPlaceGroupState());
  const roofByExtrusionStateRef = useRef<RoofByExtrusionState>(initialRoofByExtrusionState());
  const [, setRoofByExtrusionPhase] = useState<RoofByExtrusionState['phase']>('idle');
  const revisionCloudStateRef = useRef<RevisionCloudState>(initialRevisionCloudState());
  const splitStateRef = useRef<SplitState>(initialSplitState());
  const splitWallStateRef = useRef<SplitWallState>(initialSplitWallState());
  const trimStateRef = useRef<TrimState>(initialTrimState());
  const trimExtendFirstWallRef = useRef<string | null>(null);
  const [trimExtendFirstWallSet, setTrimExtendFirstWallSet] = useState(false);
  const wallJoinStateRef = useRef<WallJoinState>(initialWallJoinState());
  const textAnnotStateRef = useRef<TextAnnotationState>(initialTextAnnotationState());
  const leaderTextStateRef = useRef<LeaderTextState>(initialLeaderTextState());
  const [textAnnotOverlay, setTextAnnotOverlay] = useState<{
    positionMm: { xMm: number; yMm: number };
    screenX: number;
    screenY: number;
    draft: string;
  } | null>(null);
  const [leaderTextOverlay, setLeaderTextOverlay] = useState<{
    anchorMm: { xMm: number; yMm: number };
    elbowMm: { xMm: number; yMm: number };
    textMm: { xMm: number; yMm: number };
    screenX: number;
    screenY: number;
    draft: string;
  } | null>(null);
  const wallOpeningStateRef = useRef<WallOpeningState>(initialWallOpeningState());
  const wallOpeningAnchorRef = useRef<{ xMm: number; yMm: number } | null>(null);
  const shaftStateRef = useRef<ShaftState>(initialShaftState());
  const columnStateRef = useRef<ColumnState>(initialColumnState());
  const beamStateRef = useRef<BeamState>(initialBeamState());
  const stairStateRef = useRef<BeamState>(initialBeamState());
  const rampStateRef = useRef<RampState>(initialRampState());
  const ceilingStateRef = useRef<CeilingState>(initialCeilingState());
  const excavationStateRef = useRef<ExcavationState>(initialExcavationState());
  const beamSystemStateRef = useRef<BeamSystemState>(initialBeamSystemState());
  const columnAtGridsStateRef = useRef<ColumnAtGridsState>(initialColumnAtGridsState());
  const columnAtGridsHoverRef = useRef<string | null>(null);
  const steelConnectionStateRef = useRef<SteelConnectionState>(initialSteelConnectionState());
  const terrainPointStateRef = useRef<TerrainPointState>(initialTerrainPointState());
  const terrainPadStateRef = useRef<TerrainPadState>(initialTerrainPadState());
  const permanentDimStateRef = useRef<PermanentDimState>(initialPermanentDimState());
  const measureAngleStateRef = useRef<MeasureAngleState>(initialMeasureAngleState());
  const measureArcStateRef = useRef<MeasureArcState>(initialMeasureArcState());
  const modelLineStateRef = useRef<ModelLineState>(initialModelLineState());
  const lineworkStateRef = useRef<LineworkState>(initialLineworkState());
  const conicalRoofStateRef = useRef<ConicalRoofState>(initialConicalRoofState());
  const domeRoofStateRef = useRef<DomeRoofState>(initialDomeRoofState());
  const spireRoofStateRef = useRef<SpireRoofState>(initialSpireRoofState());
  const gradedRegionStateRef = useRef<GradedRegionState>(initialGradedRegionState());
  const terrainSplitStateRef = useRef<TerrainSplitState>(initialTerrainSplitState());
  const stairRunStateRef = useRef<StairRunState>(initialStairRunState());
  const stairLandingStateRef = useRef<StairLandingState>(initialStairLandingState());
  const detailLineStateRef = useRef<DetailLineState>(initialDetailLineState());
  const detailFilledRegionStateRef = useRef<DetailFilledRegionState>(
    initialDetailFilledRegionState(),
  );
  const dimSnapCirclesRef = useRef<THREE.Mesh[]>([]);
  const marqueeRef = useRef<{
    active: boolean;
    sx: number;
    sy: number;
    ex: number;
    ey: number;
    direction: 'left-to-right' | 'right-to-left' | null;
  }>({ active: false, sx: 0, sy: 0, ex: 0, ey: 0, direction: null });
  const spaceDownRef = useRef(false);
  const draftingRef = useRef<PlanCanvasDraftingPaint | null>(null);
  const lastPlotScaleRef = useRef<number>(0);
  const lastAutoFitLevelRef = useRef<string | null>(null);
  const snapEngineRef = useRef(new SnapEngine());
  const snapIndicatorRef = useRef<THREE.Mesh | null>(null);
  const sketchPointerToMmRef = useRef<PointerToMm | null>(null);
  const sketchMmToScreenRef = useRef<MmToScreen | null>(null);
  const [snapLabel, setSnapLabel] = useState<string | null>(null);
  // PERF-H04: pointermove fires faster than the browser paints. Coalesce
  // the snap label setter to rAF cadence so we re-render at most once
  // per frame; skip the commit entirely if the label hasn't changed.
  // The coalesced wrapper is handed only to the pointermove hot path;
  // low-frequency callers (tab cycle, clear-on-tool-change) keep the
  // raw setter so updater-function forms still work.
  const setSnapLabelCoalesced = useCoalescedSetter(setSnapLabel);
  const [boundaryValidationError, setBoundaryValidationError] = useState<string | null>(null);
  // EDT-05 — snap glyph layer state
  const [localSnapSettings] = useState<SnapSettings>(
    () => controlledSnapSettings ?? loadSnapSettings(),
  );
  const snapSettings = controlledSnapSettings ?? localSnapSettings;
  const snapTabCycleRef = useRef<SnapTabCycleState>(initialSnapTabCycle());
  // F-104 — Tab cycles to the next endpoint-connected wall in select mode.
  // Tracks which connected-wall candidate to visit next so repeated Tab presses
  // walk a branching junction in round-robin order.
  const wallTabCycleIndexRef = useRef<{ selId: string; index: number }>({
    selId: '',
    index: 0,
  });
  const [snapGlyphState, setSnapGlyphState] = useState<{
    candidates: Array<{
      kind: SnapKind;
      pxX: number;
      pxY: number;
      extensionFromPxX?: number;
      extensionFromPxY?: number;
      associative?: boolean;
    }>;
    activeIndex: number;
  }>({ candidates: [], activeIndex: 0 });
  // PERF-H04: rAF-coalesced wrapper of setSnapGlyphState. Equality check
  // inspects the candidate semantic shape (kind + position + activeIndex)
  // rather than full object identity — a fresh array with the same
  // semantic targets shouldn't re-render the glyph layer. The raw
  // setSnapGlyphState above remains for keyboard / tool-cycle callers
  // that pass updater functions; only the pointermove hot path uses
  // the coalesced wrapper.
  const setSnapGlyphStateCoalesced = useCoalescedSetter(setSnapGlyphState, (a, b) => {
    if (a === b) return true;
    if (a.activeIndex !== b.activeIndex) return false;
    if (a.candidates.length !== b.candidates.length) return false;
    for (let i = 0; i < a.candidates.length; i++) {
      const ac = a.candidates[i]!;
      const bc = b.candidates[i]!;
      if (
        ac.kind !== bc.kind ||
        ac.pxX !== bc.pxX ||
        ac.pxY !== bc.pxY ||
        ac.extensionFromPxX !== bc.extensionFromPxX ||
        ac.extensionFromPxY !== bc.extensionFromPxY ||
        ac.associative !== bc.associative
      ) {
        return false;
      }
    }
    return true;
  });
  const lastSnapHitsRef = useRef<SnapHit[]>([]);
  const lastSnapLinesRef = useRef<SegmentLine[]>([]);
  // F-080 — one-shot snap override (SI/SE/SM/SP/SX Revit-style shortcuts).
  const snapOverrideRef = useRef<ToggleableSnapKind | null>(null);
  const [snapOverrideDisplay, setSnapOverrideDisplay] = useState<ToggleableSnapKind | null>(null);
  // Tracks the first key in a two-key snap-override sequence (e.g. "S" before "I").
  const lastKeyRef = useRef<SnapOverrideKeyState>(null);
  // EDT-01 — grip + temp-dim layer state
  const gripDragRef = useRef<{
    grip: GripDescriptor;
    startWorldMm: { xMm: number; yMm: number };
    lastDeltaMm: { xMm: number; yMm: number };
  } | null>(null);
  const [draftMutation, setDraftMutation] = useState<DraftMutation | null>(null);
  const [activeGripId, setActiveGripId] = useState<string | null>(null);
  const [numericInput, setNumericInput] = useState<{
    value: string;
    pxX: number;
    pxY: number;
  } | null>(null);
  const numericInputRef = useRef<{
    value: string;
    pxX: number;
    pxY: number;
  } | null>(null);
  numericInputRef.current = numericInput;
  const pendingPinChordRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // §3.3.9: CS chord — Create Similar
  const pendingCsChordRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hudMm, setHudMm] = useState<{ xMm: number; yMm: number }>();
  const hudMmRef = useRef<{ xMm: number; yMm: number } | undefined>(undefined);
  hudMmRef.current = hudMm;
  // ANN-02: state for the right-click "Generate Section / Elevation" menu.
  const [wallContextMenu, setWallContextMenu] = useState<{
    wall: Extract<Element, { kind: 'wall' }>;
    position: { x: number; y: number };
  } | null>(null);
  // F-014: state for the right-click "Unhide in View" menu shown in reveal hidden mode.
  // F-102: extended with optional elementId for per-element unhide action.
  const [unhideContextMenu, setUnhideContextMenu] = useState<{
    elementKind: string;
    elementId?: string;
    position: { x: number; y: number };
  } | null>(null);
  // F-040: state for the right-click "Allow/Disallow Join" menu on a wall endpoint.
  const [wallJoinCtxMenu, setWallJoinCtxMenu] = useState<{
    wallId: string;
    endpoint: 'start' | 'end';
    position: { x: number; y: number };
    currentlyDisallowed: boolean;
  } | null>(null);
  // §1.7.2: state for the generic element right-click context menu.
  const [elementCtxMenu, setElementCtxMenu] = useState<{
    el: Element;
    position: { x: number; y: number };
  } | null>(null);
  // §1.7.1: state for the canvas-level right-click context menu (empty space).
  const [canvasCtxMenu, setCanvasCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [dxfQueryHover, setDxfQueryHover] = useState<DxfPrimitiveQueryHit | null>(null);
  const [dxfQueryDialog, setDxfQueryDialog] = useState<{
    hit: DxfPrimitiveQueryHit;
    position: { x: number; y: number };
  } | null>(null);
  const [geomEpoch, bumpGeom] = useState(0);
  const [measureReadout, setMeasureReadout] = useState<{ distMm: number } | null>(null);
  const [measureAngleReadout, setMeasureAngleReadout] = useState<{ angleDeg: number } | null>(null);
  const [measureArcReadout, setMeasureArcReadout] = useState<{
    arcLengthMm: number;
    radiusMm: number;
  } | null>(null);
  const [wallDraftNotice, setWallDraftNotice] = useState<string | null>(null);
  const [wallPickLineHint, setWallPickLineHint] = useState<PickedWallLine | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  // §13.1.3 — color fill legend panel visibility toggle.
  const [legendVisible, setLegendVisible] = useState(false);
  const [pendingPlanRegion, setPendingPlanRegion] = useState<{
    x0: number;
    x1: number;
    y0: number;
    y1: number;
    lvlId: string;
    cutPlaneDraft: string;
  } | null>(null);
  const [roomColorLegend, setRoomColorLegend] = useState<
    Array<{
      label: string;
      schemeColorHex: string;
      programmeCode?: string;
      department?: string;
      functionLabel?: string;
    }>
  >([]);
  const [wireGraphicHints, setWireGraphicHints] = useState<ReturnType<
    typeof extractPlanGraphicHints
  > | null>(null);
  const [wireAnnotationHints, setWireAnnotationHints] = useState<ReturnType<
    typeof extractPlanAnnotationHints
  > | null>(null);
  const [wireTagStyleHints, setWireTagStyleHints] = useState<ReturnType<
    typeof extractPlanTagStyleHints
  > | null>(null);

  const elementsByIdRaw = useBimStore((s) => s.elementsById);
  // PERF audit #4 / G04 step: narrow selectors for tool handlers' formerly-
  // full-scan paths (wall-join, wall-opening, ceiling-sketch, project-base-point).
  // The click handler still receives the broad `elementsById` for the remaining
  // tool paths; migrating those needs additional modelIndices fields.
  const modelWalls = useBimStore((s) => s.modelIndices.walls);
  const wallsByLevel = useBimStore((s) => s.modelIndices.wallsByLevel);
  const modelBeams = useBimStore((s) => s.modelIndices.beams);
  const modelColumns = useBimStore((s) => s.modelIndices.columns);
  const columnsByLevel = useBimStore((s) => s.modelIndices.columnsByLevel);
  const placedAssetsByLevel = useBimStore((s) => s.modelIndices.placedAssetsByLevel);
  const floorsByLevel = useBimStore((s) => s.modelIndices.floorsByLevel);
  const projectBasePoint = useBimStore((s) => s.modelIndices.projectBasePoint);
  const temporaryVisibility = useBimStore((s) => s.temporaryVisibility);
  const selectedId = useBimStore((s) => s.selectedId);
  const selectedIds = useBimStore((s) => s.selectedIds);
  const modelId = useBimStore((s) => s.modelId);
  const revision = useBimStore((s) => s.revision);
  const planProjectionPrimitives = useBimStore((s) => s.planProjectionPrimitives);
  const setPlanProjectionPrimitives = useBimStore((s) => s.setPlanProjectionPrimitives);
  const setPlanRoomSchemeWireReadout = useBimStore((s) => s.setPlanRoomSchemeWireReadout);
  const storeActivePlanViewId = useBimStore((s) => s.activePlanViewId);
  const activePlanViewId =
    activePlanViewIdProp === undefined
      ? storeActivePlanViewId
      : (activePlanViewIdProp ?? undefined);
  const planPresentation = useBimStore((s) => s.planPresentationPreset);
  const storePlanTool = useBimStore((s) => s.planTool);
  const wallLocationLine = useBimStore((s) => s.wallLocationLine);
  const wallDrawOffsetMm = useBimStore((s) => s.wallDrawOffsetMm);
  const wallDrawRadiusMm = useBimStore((s) => s.wallDrawRadiusMm);
  const wallDrawHeightMm = useBimStore((s) => s.wallDrawHeightMm);
  const activeWallTypeId = useBimStore((s) => s.activeWallTypeId);
  const orthoSnapHold = useBimStore((s) => s.orthoSnapHold);
  const groupRegistry = useBimStore((s) => s.groupRegistry);
  const groupEditModeDefinitionId = useBimStore((s) => s.groupEditModeDefinitionId);
  const joinedPairs = useBimStore((s) => s.joinedPairs);
  const selectEl = useBimStore((s) => s.select);
  const setActiveLevelId = useBimStore((s) => s.setActiveLevelId);
  const activateElevationView = useBimStore((s) => s.activateElevationView);
  const activatePlanView = useBimStore((s) => s.activatePlanView);
  const storeSetPlanTool = useBimStore((s) => s.setPlanTool);
  const planTool = activePlanTool ?? storePlanTool;
  const setPlanTool = onActivePlanToolChange ?? storeSetPlanTool;
  // OSM-V3-02 — neighborhood mass layer toggle.
  const showNeighborhoodMasses = useBimStore((s) => s.showNeighborhoodMasses);
  // F-006 — QAT Thin Lines toggle: overrides all line weights to 1 px when true.
  const thinLinesEnabled = useBimStore((s) => s.thinLinesEnabled);
  const selectLinkedEnabled = useBimStore((s) => s.selectLinkedEnabled);
  // F-014 — reveal hidden elements mode (lightbulb toggle).
  const revealHiddenMode = useBimStore((s) => s.revealHiddenMode);
  const setCategoryOverride = useBimStore((s) => s.setCategoryOverride);
  // EDT-V3-05 — loop mode: re-arm chained tools after each segment commit.
  const loopMode = useToolPrefs((s) => s.loopMode);
  // UX-MC — status-bar Grid switch controls whether the drafting grid is drawn.
  const draftGridVisible = useToolPrefs((s) => s.draftGridVisible);
  // TOP-V3-03 — active finish category for the subdivision palette.
  const subdivisionDraft = useToolPrefs((s) => s.subdivisionDraft);
  const setSubdivisionDraft = useToolPrefs((s) => s.setSubdivisionDraft);
  const clearSubdivisionDraft = useToolPrefs((s) => s.clearSubdivisionDraft);

  const {
    elementsById,
    display,
    activeCropState,
    mergedGraphicHints,
    mergedAnnotationHints,
    planTagFontScales,
    hiddenKey,
    hiddenElementIdsKey,
    displayLevelId,
    anchors,
    centerAnchors,
    snapLines,
  } = usePlanCanvasDerivedViewData({
    elementsByIdRaw,
    temporaryVisibility,
    activePlanViewId,
    activeLevelResolvedId,
    planPresentation,
    wireGraphicHints,
    wireAnnotationHints,
    wireTagStyleHints,
  });
  const lvlId = displayLevelId || activeLevelResolvedId;
  const {
    showConstraints,
    showUnderlay,
    underlayLevelId,
    underlayLevels,
    activeWorkPlaneName,
    activeLevelElem,
    levelIsEmpty,
  } = usePlanCanvasViewState({
    activePlanViewId,
    elementsById,
    levelId: lvlId,
    displayLevelId,
    activeLevelResolvedId,
  });

  const { selectedWall, gripDescriptors, tempDimTargets } = usePlanCanvasSelectionState({
    selectedId,
    elementsById,
  });

  const { colorSchemeLegendRows, colorSchemeLegendTitle } = usePlanCanvasColorSchemeState({
    elementsById,
    activePlanViewId,
    levelId: lvlId,
  });

  usePlanProjectionWireSync({
    modelId,
    revision,
    planViewId: display.planViewElementId,
    fallbackLevelId: lvlId,
    planPresentation,
    setPlanProjectionPrimitives,
    setPlanRoomSchemeWireReadout,
    setRoomColorLegend,
    setWireGraphicHints,
    setWireAnnotationHints,
    setWireTagStyleHints,
  });

  const { halfUi, resizeCam, handleFitToView, worldToScreen } = usePlanCanvasCameraControls({
    mountRef,
    rendererRef,
    cameraRef,
    rootRef,
    camRef,
    cameraHandleRef,
  });

  usePlanCanvasToolActivation({
    planTool,
    draftRef,
    wallFlipRef,
    alignStateRef,
    setAlignReferenceMm,
    mirrorAxisStartRef,
    setMirrorAxisSet,
    copyAnchorRef,
    setCopyAnchorSet,
    moveAnchorRef,
    setMoveAnchorSet,
    rotateAnchorRef,
    setRotateAnchorSet,
    rotateReferenceRef,
    setRotateReferenceSet,
    scaleStateRef,
    setScalePhase,
    setNumericInput,
    splitStateRef,
    splitWallStateRef,
    trimStateRef,
    trimExtendFirstWallRef,
    setTrimExtendFirstWallSet,
    wallJoinStateRef,
    wallOpeningStateRef,
    shaftStateRef,
    columnStateRef,
    beamStateRef,
    stairStateRef,
    rampStateRef,
    ceilingStateRef,
    excavationStateRef,
    beamSystemStateRef,
    steelConnectionStateRef,
    columnAtGridsStateRef,
    bumpGeom,
    arrayStateRef,
    setArrayPhase,
    placeGroupStateRef,
    roofByExtrusionStateRef,
    setRoofByExtrusionPhase,
    lineworkStateRef,
    conicalRoofStateRef,
    domeRoofStateRef,
    spireRoofStateRef,
    stairRunStateRef,
    stairLandingStateRef,
    detailLineStateRef,
    detailFilledRegionStateRef,
  });

  usePlanCanvasSceneLifecycle({
    mountRef,
    rendererRef,
    sceneRef,
    rootRef,
    cameraRef,
    sketchPointerToMmRef,
    sketchMmToScreenRef,
    resizeCam,
    theme,
  });

  usePlanCanvasViewEffects({
    rootRef,
    activePlanViewId,
    activeLevelResolvedId,
    elementsById,
    planTool,
    columnAtGridsStateRef,
    columnAtGridsHoverRef,
    geomEpoch,
    lastAutoFitLevelRef,
    onFitToView: handleFitToView,
  });

  usePlanCanvasRenderPasses({
    rootRef,
    camRef,
    draftingRef,
    lastPlotScaleRef,
    cropOverlayRef,
    cropDragRef,
    mergedGraphicHints,
    mergedAnnotationHints,
    planTagFontScales,
    display,
    displayLevelId,
    elementsById,
    geomEpoch,
    hiddenKey,
    hiddenElementIdsKey,
    planProjectionPrimitives,
    modelId,
    planTool,
    activeLevelResolvedId,
    revealHiddenMode,
    selectedId,
    activeCropState,
    activePlanViewId,
    showNeighborhoodMasses,
    thinLinesEnabled,
    draftGridVisible,
    lensMode,
    groupRegistry,
    groupEditModeDefinitionId,
    joinedPairs,
  });

  useEffect(() => {
    const canvas = rendererRef.current?.domElement;
    const rnd = rendererRef.current;
    const camNow = cameraRef.current;
    const grp = rootRef.current;
    if (!canvas || !rnd || !camNow || !grp) return;

    const snapped = (clientX: number, clientY: number) => {
      const rw = rayToPlanMm(rnd, camNow, clientX, clientY);
      if (!rw) return;
      const anchor =
        draftRef.current?.kind === 'wall'
          ? { xMm: draftRef.current.sx, yMm: draftRef.current.sy }
          : draftRef.current?.kind === 'grid'
            ? { xMm: draftRef.current.sx, yMm: draftRef.current.sy }
            : draftRef.current?.kind === 'dim'
              ? { xMm: draftRef.current.ax, yMm: draftRef.current.ay }
              : draftRef.current?.kind === 'room_rect'
                ? { xMm: draftRef.current.sx, yMm: draftRef.current.sy }
                : draftRef.current?.kind === 'area-boundary'
                  ? draftRef.current.verts[draftRef.current.verts.length - 1]
                  : undefined;
      const hs = orthoExtents(camRef.current.half);
      const topologySnap =
        planTool === 'wall'
          ? snapWallPointToConnectivity(
              rw,
              displayLevelId ? (wallsByLevel[displayLevelId] ?? []) : modelWalls,
              {
                levelId: displayLevelId || undefined,
                toleranceMm: hs.snapMm,
              },
            )
          : null;
      if (topologySnap) return topologySnap.point;
      return snapPlanPoint({
        cursor: rw,
        anchors,
        gridStepMm: hs.stepMm,
        chainAnchor: anchor,
        snapMm: hs.snapMm,
        orthoHold: orthoSnapHold,
      }).point;
    };

    const {
      clearMarqueeLine,
      clearPreview,
      redrawAreaBoundaryPreviewMm,
      redrawMarqueeRect,
      redrawPreviewRectMm,
      redrawSeg,
    } = createPlanCanvasPreviewHelpers({
      group: grp,
      previewRef,
      marqueeLineRef,
      marqueeFillRef,
    });

    const {
      activeAreaPlanContext,
      areaSnapPoint,
      commitAreaBoundary,
      pickedWallLineAt,
      wallPickToleranceMm,
    } = createPlanCanvasPickHelpers({
      renderer: rnd,
      camRef,
      displayLevelId,
      activeLevelResolvedId,
      activePlanViewId,
      lvlId,
      elementsById,
      draftRef,
      onSemanticCommand,
      clearPreview,
      bumpGeom,
    });

    const onMove = (ev: PointerEvent) => {
      const endPointerMoveSample = beginPlanPointerMoveSample({
        scenario: classifyPlanPointerMoveScenario({
          tool: planTool,
          isPanning: dragRef.current.dragging,
          isMarquee: marqueeRef.current.active,
          isGripDragging: Boolean(gripDragRef.current),
          isCropDragging: Boolean(cropDragRef.current || cropGripDragRef.current),
        }),
        tool: planTool,
        pointerType: ev.pointerType,
      });
      try {
        // EDT-01 — grip drag takes priority over every other interaction.
        if (gripDragRef.current) {
          const rwGrip = rayToPlanMm(rnd, camNow, ev.clientX, ev.clientY);
          if (rwGrip) {
            const startMm = gripDragRef.current.startWorldMm;
            const delta = {
              xMm: rwGrip.xMm - startMm.xMm,
              yMm: rwGrip.yMm - startMm.yMm,
            };
            gripDragRef.current.lastDeltaMm = delta;
            setDraftMutation(gripDragRef.current.grip.onDrag(delta));
            if (numericInputRef.current) {
              setNumericInput((prev) =>
                prev ? { ...prev, pxX: ev.clientX, pxY: ev.clientY } : prev,
              );
            }
          }
          return;
        }
        const xy = snapped(ev.clientX, ev.clientY);
        setHudMm(xy);
        useBimStore.getState().setPlanHud(xy);
        if (
          handleCropPointerMove({
            renderer: rnd,
            camera: camNow,
            event: ev,
            cropDragRef,
            cropGripDragRef,
            skipClickRef,
            onSemanticCommand,
            bumpGeom,
          })
        ) {
          return;
        }
        if (
          handlePanMarqueePointerMove({
            renderer: rnd,
            camera: camNow,
            event: ev,
            dragRef,
            camRef,
            marqueeRef,
            redrawMarqueeRect,
            resizeCam,
            skipClickRef,
          })
        ) {
          return;
        }
        const v = snapped(ev.clientX, ev.clientY);
        if (!v) return;

        if (useBimStore.getState().planTool === 'wall' && !draftRef.current) {
          setWallPickLineHint(pickedWallLineAt(v, wallPickToleranceMm()));
        } else {
          setWallPickLineHint((prev) => (prev ? null : prev));
        }

        if (planTool === 'query') {
          const dxfLevelId = displayLevelId || activeLevelResolvedId;
          const dxfUnderlays = selectDxfUnderlaysForLevel(elementsById, dxfLevelId || undefined);
          const activePlanView = activePlanViewId ? elementsById[activePlanViewId] : undefined;
          const viewOverrides =
            activePlanView?.kind === 'plan_view'
              ? ((activePlanView.categoryOverrides ?? {}) as Record<string, CategoryOverride>)
              : {};
          const rect = rnd.domElement.getBoundingClientRect();
          const toleranceMm = (12 / Math.max(1, rect.height)) * 2 * camRef.current.half * 1000;
          setDxfQueryHover(
            queryDxfPrimitiveAtPoint(dxfUnderlays, v, {
              toleranceMm,
              elementsById,
              viewOverridesByLinkId: Object.fromEntries(
                dxfUnderlays.map((link) => [link.id, viewOverrides[dxfViewOverrideKey(link.id)]]),
              ),
            }),
          );
        } else {
          setDxfQueryHover((prev) => (prev ? null : prev));
        }

        updatePlanCanvasSnapHover({
          planTool,
          cursorMm: v,
          renderer: rnd,
          group: grp,
          cameraHalf: camRef.current.half,
          levelWalls: displayLevelId ? (wallsByLevel[displayLevelId] ?? []) : modelWalls,
          snapEngineRef,
          snapIndicatorRef,
          // PERF-H04: rAF-coalesce the pointermove setters so repeated
          // pointermove events within a single frame coalesce into one
          // render and skip redundant commits.
          setSnapLabel: setSnapLabelCoalesced,
          lastSnapLinesRef,
          anchors,
          centerAnchors,
          draftRef,
          orthoSnapHold,
          snapOverrideRef,
          snapSettings,
          snapTabCycleRef,
          lastSnapHitsRef,
          setSnapGlyphState: setSnapGlyphStateCoalesced,
          worldToScreen,
        });

        const p = new THREE.Vector3(v.xMm / 1000, SLICE_Y, v.yMm / 1000);
        const d = draftRef.current;
        if (planTool === 'area-boundary' && d?.kind === 'area-boundary') {
          redrawAreaBoundaryPreviewMm(d.verts, areaSnapPoint(v));
          return;
        }
        if (planTool === 'room_rectangle' && d?.kind === 'room_rect') {
          redrawPreviewRectMm(d.sx, d.sy, v.xMm, v.yMm);
          return;
        }
        if (planTool === 'model-line' && d?.kind === 'model-line' && d.points.length >= 1) {
          const all = [...d.points, { xMm: v.xMm, yMm: v.yMm }];
          const pts = all.map((pt) => new THREE.Vector3(pt.xMm / 1000, SLICE_Y, pt.yMm / 1000));
          if (previewRef.current) {
            grp.remove(previewRef.current);
            previewRef.current.geometry.dispose();
          }
          previewRef.current = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({
              color: readPlanToken('--draft-construction-blue', '#fcd34d'),
            }),
          );
          grp.add(previewRef.current);
          return;
        }
        if (
          (planTool === 'wall' && d?.kind === 'wall') ||
          (planTool === 'grid' && d?.kind === 'grid') ||
          (planTool === 'measure' && d?.kind === 'measure')
        ) {
          const pv =
            planTool === 'wall' && d?.kind === 'wall'
              ? new THREE.Vector3(d.sx / 1000, SLICE_Y, d.sy / 1000)
              : planTool === 'grid' && d?.kind === 'grid'
                ? new THREE.Vector3(d.sx / 1000, SLICE_Y, d.sy / 1000)
                : planTool === 'measure' && d?.kind === 'measure'
                  ? new THREE.Vector3(d.ax / 1000, SLICE_Y, d.ay / 1000)
                  : p;
          redrawSeg(pv, p);
        }
        if (planTool === 'dimension') {
          const { state } = reducePermanentDim(permanentDimStateRef.current, {
            kind: 'moveMouse',
            xMm: v.xMm,
            yMm: v.yMm,
          });
          permanentDimStateRef.current = state;
          // Clean up existing snap circles
          for (const c of dimSnapCirclesRef.current) {
            grp.remove(c);
            c.geometry.dispose();
          }
          dimSnapCirclesRef.current = [];
          if (state.phase === 'picking' && state.points.length >= 1) {
            const allPts = [...state.points, { xMm: v.xMm, yMm: v.yMm }];
            const threePts = allPts.map(
              (pt) => new THREE.Vector3(pt.xMm / 1000, SLICE_Y, pt.yMm / 1000),
            );
            if (previewRef.current) {
              grp.remove(previewRef.current);
              previewRef.current.geometry.dispose();
            }
            const geo = new THREE.BufferGeometry().setFromPoints(threePts);
            const mat = new THREE.LineDashedMaterial({
              color: readPlanToken('--draft-construction-blue', '#fcd34d'),
              dashSize: 0.25,
              gapSize: 0.12,
            });
            const line = new THREE.Line(geo, mat);
            line.computeLineDistances();
            line.userData.preview = 'dim-chain';
            previewRef.current = line;
            grp.add(previewRef.current);
            // Snap circles at each already-picked point
            const snapMat = new THREE.MeshBasicMaterial({
              color: readPlanToken('--draft-construction-blue', '#fcd34d'),
              side: THREE.DoubleSide,
            });
            for (const pt of state.points) {
              const circleGeo = new THREE.CircleGeometry(0.1, 16);
              const circle = new THREE.Mesh(circleGeo, snapMat);
              circle.position.set(pt.xMm / 1000, SLICE_Y + 0.003, pt.yMm / 1000);
              circle.rotation.x = -Math.PI / 2;
              circle.userData.preview = 'dim-chain';
              grp.add(circle);
              dimSnapCirclesRef.current.push(circle);
            }
            bumpGeom((x) => x + 1);
          }
        }
        // TOP-V3-03: dashed polygon preview while sketching a subdivision region.
        if (
          planTool === 'toposolid_subdivision' &&
          d?.kind === 'toposolid-subdivision' &&
          d.verts.length >= 1
        ) {
          const pts = [
            ...d.verts.map((v2) => new THREE.Vector3(v2.xMm / 1000, SLICE_Y, v2.yMm / 1000)),
            p,
          ];
          if (previewRef.current) {
            grp.remove(previewRef.current);
            previewRef.current.geometry.dispose();
          }
          const geo = new THREE.BufferGeometry().setFromPoints(pts);
          const mat = new THREE.LineDashedMaterial({
            color: readPlanToken('--draft-construction-blue', '#fcd34d'),
            dashSize: 0.25,
            gapSize: 0.12,
          });
          const line = new THREE.Line(geo, mat);
          line.computeLineDistances();
          previewRef.current = line;
          grp.add(previewRef.current);
        }
        // §5.1.4 — terrain-pad polygon preview while sketching
        if (planTool === 'terrain-pad' && terrainPadStateRef.current.phase === 'sketching') {
          const pts = [
            ...terrainPadStateRef.current.points.map(
              (pt) => new THREE.Vector3(pt.xMm / 1000, SLICE_Y, pt.yMm / 1000),
            ),
            p,
          ];
          if (previewRef.current) {
            grp.remove(previewRef.current);
            previewRef.current.geometry.dispose();
          }
          const geo = new THREE.BufferGeometry().setFromPoints(pts);
          const mat = new THREE.LineDashedMaterial({
            color: '#c8a882',
            dashSize: 0.25,
            gapSize: 0.12,
          });
          const line = new THREE.Line(geo, mat);
          line.computeLineDistances();
          previewRef.current = line;
          grp.add(previewRef.current);
        }
        updateSplitWallHover({
          planTool,
          walls: displayLevelId ? (wallsByLevel[displayLevelId] ?? []) : modelWalls,
          cursorMm: v,
          splitWallStateRef,
          bumpGeom,
        });
        updateComponentGhostHover({
          planTool,
          renderer: rnd,
          camera: camNow,
          group: grp,
          event: ev,
          componentGhostRef,
          elementsById,
          activeLevelResolvedId,
          activeComponentAssetId,
          activeComponentFamilyTypeId,
          activeComponentAssetPreviewEntry,
          pendingComponentRotationDeg,
        });
        updateColumnAtGridsHover({
          planTool,
          renderer: rnd,
          camera: camNow,
          group: grp,
          event: ev,
          elementsById,
          columnAtGridsHoverRef,
          bumpGeom,
        });
      } finally {
        endPointerMoveSample();
      }
    };

    const onDown = (ev: PointerEvent) => {
      if (
        handleCropPointerDown({
          renderer: rnd,
          camera: camNow,
          group: grp,
          event: ev,
          activeCropState,
          spaceDownRef,
          planTool,
          cameraHalf: camRef.current.half,
          cropDragRef,
          cropGripDragRef,
          skipClickRef,
        })
      ) {
        return;
      }

      handlePanMarqueePointerDown({
        renderer: rnd,
        camera: camNow,
        group: grp,
        event: ev,
        planTool,
        spaceDownRef,
        dragRef,
        camRef,
        marqueeRef,
        skipClickRef,
      });
    };

    const onUpWindow = (ev: PointerEvent) => {
      if (
        handleGripPointerUp({
          renderer: rnd,
          camera: camNow,
          event: ev,
          gripDragRef,
          numericInputRef,
          setActiveGripId,
          setDraftMutation,
          setNumericInput,
          skipClickRef,
          onSemanticCommand,
        })
      ) {
        return;
      }
      dragRef.current.dragging = false;
      if (snapIndicatorRef.current) snapIndicatorRef.current.visible = false;
      setSnapLabel(null);

      if (
        handleCropPointerUp({
          cropDragRef,
          cropGripDragRef,
          onSemanticCommand,
          bumpGeom,
        })
      ) {
        return;
      }

      if (
        handleMarqueePointerUp({
          marqueeRef,
          clearMarqueeLine,
          elementsById,
          displayLevelId,
          selectLinkedEnabled,
          selectElement: selectEl,
        })
      ) {
        return;
      }
      handleWallOpeningPointerUp({
        planTool,
        pointerMm: snapped(ev.clientX, ev.clientY),
        wallOpeningStateRef,
        wallOpeningAnchorRef,
        elementsById,
        onSemanticCommand,
      });
    };

    const onClick = createPlanCanvasClickHandler({
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
      modelWalls,
      wallsByLevel,
      modelBeams,
      modelColumns,
      columnsByLevel,
      placedAssetsByLevel,
      floorsByLevel,
      projectBasePoint,
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
    });

    const { onWheel, onKey, onKeyUp, onContextMenu, onDblClick } =
      createPlanCanvasKeyboardAuxHandlers({
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
        canvas,
        ceilingStateRef,
        clearMarqueeLine,
        clearPreview,
        clearSubdivisionDraft,
        columnAtGridsStateRef,
        columnPositionsAtGridIntersections,
        columnStateRef,
        commitAreaBoundary,
        conicalRoofStateRef,
        copyAnchorRef,
        copyElementsToClipboard,
        copyMultipleEnabled,
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
        groupRegistry,
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
        mirrorCopyEnabled,
        modelId,
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
        wallLocationLine,
        wallOpeningAnchorRef,
        wallOpeningStateRef,
        wallTabCycleIndexRef,
        worldToScreen,
      });

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUpWindow);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('dblclick', onDblClick);
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUpWindow);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('dblclick', onDblClick);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      if (snapIndicatorRef.current) {
        grp.remove(snapIndicatorRef.current);
        snapIndicatorRef.current.geometry.dispose();
        snapIndicatorRef.current = null;
      }
      if (componentGhostRef.current) {
        grp.remove(componentGhostRef.current);
        componentGhostRef.current = null;
      }
    };
  }, [
    anchors,
    bumpGeom,
    centerAnchors,
    columnsByLevel,
    displayLevelId,
    elementsById,
    floorsByLevel,
    lvlId,
    activeLevelResolvedId,
    modelBeams,
    modelColumns,
    modelWalls,
    onSemanticCommand,
    orthoSnapHold,
    placedAssetsByLevel,
    planTool,
    projectBasePoint,
    resizeCam,
    selectEl,
    setActiveLevelId,
    activateElevationView,
    activatePlanView,
    setSnapGlyphStateCoalesced,
    setSnapLabelCoalesced,
    snapSettings,
    wallsByLevel,
    worldToScreen,
    activeCropState,
    activePlanViewId,
    arrayPhase,
    clearSubdivisionDraft,
    display,
    display.hiddenElementIds,
    display.hiddenSemanticKinds,
    groupRegistry,
    modelId,
    revealHiddenMode,
    scalePhase,
    selectedId,
    selectedIds,
    selectLinkedEnabled,
    setPlanTool,
    wallLocationLine,
  ]);

  const resetComponentRotation = useCallback(() => setPendingComponentRotationDeg(0), []);
  const contextActions = usePlanCanvasContextActions({
    activateElevationView,
    camRef,
    onSemanticCommand,
    resizeCam,
    selectEl,
    setCanvasCtxMenu,
    setDxfQueryDialog,
    setElementCtxMenu,
    setUnhideContextMenu,
    setWallContextMenu,
    setWallJoinCtxMenu,
  });
  usePlanCanvasToolCleanupEffects({
    planTool,
    snapLines,
    lastSnapLinesRef,
    measureAngleStateRef,
    measureArcStateRef,
    setMeasureReadout,
    setMeasureAngleReadout,
    setMeasureArcReadout,
    setWallPickLineHint,
    setWallDraftNotice,
    setDxfQueryHover,
    setDxfQueryDialog,
    onResetComponentRotation: resetComponentRotation,
    rootRef,
    componentGhostRef,
    unhideContextMenu,
    closeUnhideContextMenu: contextActions.closeUnhideContextMenu,
    wallJoinContextMenu: wallJoinCtxMenu,
    closeWallJoinContextMenu: contextActions.closeWallJoinContextMenu,
  });

  const {
    handleGripDoubleClick,
    handleGripPointerDown,
    handleTempDimClick,
    handleTempDimLockClick,
  } = usePlanCanvasGripHandlers({
    rendererRef,
    cameraRef,
    gripDragRef,
    setActiveGripId,
    setDraftMutation,
    elementsById,
    onSemanticCommand,
  });

  const { scaleBarMeters, plotScaleN, componentPreviewScreen, componentPreviewSymbol } =
    resolvePlanCanvasHudState({
      halfUi,
      planTool,
      activeComponentAssetId,
      elementsById: elementsByIdRaw,
      previewEntry: activeComponentAssetPreviewEntry,
      hudMm,
      worldToScreen,
    });

  return (
    <div
      data-testid="plan-canvas"
      className="relative h-full w-full overflow-hidden bg-canvas-paper"
    >
      <PlanCanvasViewControls
        thinLinesEnabled={thinLinesEnabled}
        onToggleThinLines={() => useBimStore.getState().toggleThinLines()}
        activePlanViewId={activePlanViewId}
        showConstraints={showConstraints}
        onToggleConstraints={(viewId) =>
          void onSemanticCommand({ type: 'toggleShowConstraints', viewId })
        }
        showUnderlay={showUnderlay}
        onToggleUnderlay={(viewId) => void onSemanticCommand({ type: 'setPlanUnderlay', viewId })}
        underlayLevelId={underlayLevelId}
        underlayLevels={underlayLevels}
        onSetUnderlayLevel={(viewId, underlayLevelId) =>
          void onSemanticCommand({
            type: 'setPlanUnderlay',
            viewId,
            underlayLevelId,
            showUnderlay: true,
          })
        }
        activeWorkPlaneName={activeWorkPlaneName}
        onClearWorkPlane={(elementId) => {
          void onSemanticCommand({
            type: 'updateElementProperty',
            elementId,
            key: 'activeWorkPlaneId',
            value: null,
          });
        }}
      />
      <PlanCanvasContextOverlays
        wallContextMenu={wallContextMenu}
        onWallContextCommand={contextActions.handleWallContextMenuCommand}
        onCloseWallContextMenu={contextActions.closeWallContextMenu}
        canvasContextMenu={canvasCtxMenu}
        onCloseCanvasContextMenu={contextActions.closeCanvasContextMenu}
        onCanvasZoomIn={contextActions.handleCanvasZoomIn}
        onCanvasZoomOut={contextActions.handleCanvasZoomOut}
        onCanvasZoomFit={handleFitToView}
        elementContextMenu={elementCtxMenu}
        activeLevelId={displayLevelId ?? ''}
        planTool={planTool ?? ''}
        onSemanticCommand={onSemanticCommand}
        onCloseElementContextMenu={contextActions.closeElementContextMenu}
        unhideContextMenu={unhideContextMenu}
        activePlanViewId={activePlanViewId}
        onSetCategoryOverride={setCategoryOverride}
        onCloseUnhideContextMenu={contextActions.closeUnhideContextMenu}
        dxfQueryHover={planTool === 'query' ? dxfQueryHover : null}
        dxfQueryDialog={dxfQueryDialog}
        elementsById={elementsById}
        onCloseDxfQueryDialog={contextActions.closeDxfQueryDialog}
        onUpdateDxfQueryDialog={setDxfQueryDialog}
        wallJoinContextMenu={wallJoinCtxMenu}
        onCloseWallJoinContextMenu={contextActions.closeWallJoinContextMenu}
      />
      <PlanCanvasWallDraftOverlays
        hudMm={hudMm ?? null}
        worldToScreen={worldToScreen}
        wallPickLineHint={wallPickLineHint}
        planTool={planTool}
        wallDraftActive={draftRef.current?.kind === 'wall'}
        wallLocationLine={wallLocationLine}
        wallDrawOffsetMm={wallDrawOffsetMm}
        wallDrawRadiusMm={wallDrawRadiusMm}
        wallDrawHeightMm={wallDrawHeightMm}
        activeWallTypeName={
          activeWallTypeId && elementsByIdRaw[activeWallTypeId]?.kind === 'wall_type'
            ? (elementsByIdRaw[activeWallTypeId] as Extract<Element, { kind: 'wall_type' }>).name
            : 'Default'
        }
        wallDraftNotice={wallDraftNotice}
        snapLabel={snapLabel}
      />
      <PlanCanvasRoomColorLegend planPresentation={planPresentation} rows={roomColorLegend} />
      {/* §13.1.3 — color fill legend panel overlay */}
      <ColorSchemeLegend
        rows={colorSchemeLegendRows}
        title={colorSchemeLegendTitle}
        visible={legendVisible}
        onClose={() => setLegendVisible(false)}
      />
      <PlanCanvasEmptyStateOverlay visible={levelIsEmpty} />
      <PlanCanvasAuthoringOverlays
        revealHiddenMode={revealHiddenMode}
        activePlanViewId={activePlanViewId}
        onSemanticCommand={onSemanticCommand}
        textAnnotOverlay={textAnnotOverlay}
        onTextAnnotationDraftChange={(draft) =>
          setTextAnnotOverlay((prev) => prev && { ...prev, draft })
        }
        onTextAnnotationDone={() => {
          textAnnotStateRef.current = initialTextAnnotationState();
          setTextAnnotOverlay(null);
        }}
        leaderTextOverlay={leaderTextOverlay}
        onLeaderTextDraftChange={(draft) =>
          setLeaderTextOverlay((prev) => prev && { ...prev, draft })
        }
        onLeaderTextDone={() => {
          leaderTextStateRef.current = initialLeaderTextState();
          setLeaderTextOverlay(null);
        }}
        pendingPlanRegion={pendingPlanRegion}
        onPlanRegionDraftChange={(draft) =>
          setPendingPlanRegion((prev) => prev && { ...prev, cutPlaneDraft: draft })
        }
        onPlanRegionDone={() => setPendingPlanRegion(null)}
        planTool={planTool}
        subdivisionDraft={subdivisionDraft}
        onSetSubdivisionDraft={setSubdivisionDraft}
        onUpdateCurrentSubdivisionDraftCategory={(category) => {
          const draft = draftRef.current;
          if (draft && draft.kind === 'toposolid-subdivision') {
            draft.finishCategory = category;
          }
        }}
        onCancelSubdivision={() => {
          draftRef.current = undefined;
          clearSubdivisionDraft();
          setPlanTool('select');
        }}
      />
      <PlanCanvasWorkflowOverlays
        planTool={planTool}
        measureReadout={measureReadout}
        measureAngleReadout={measureAngleReadout}
        measureArcReadout={measureArcReadout}
        onDismissMeasureReadout={() => setMeasureReadout(null)}
        onDismissMeasureAngleReadout={() => setMeasureAngleReadout(null)}
        onDismissMeasureArcReadout={() => setMeasureArcReadout(null)}
        selectedId={selectedId ?? null}
        selectedIds={selectedIds}
        elementsById={elementsById}
        filterOpen={filterOpen}
        onToggleFilter={() => setFilterOpen((v) => !v)}
        onCloseFilter={() => setFilterOpen(false)}
        onClearSelection={() => {
          useBimStore.getState().clearSelectedIds();
          setFilterOpen(false);
        }}
        onFilterOutKind={(kind) => {
          const toRemove = new Set(selectedIds.filter((eid) => elementsById[eid]?.kind === kind));
          useBimStore.setState((s) => ({
            selectedIds: s.selectedIds.filter((eid) => !toRemove.has(eid)),
          }));
        }}
      />
      <PlanCanvasToolOverlays
        planTool={planTool}
        snapOverrideDisplay={snapOverrideDisplay}
        onCancelSnapOverride={() => {
          snapOverrideRef.current = null;
          setSnapOverrideDisplay(null);
        }}
        copyAnchorSet={copyAnchorSet}
        moveAnchorSet={moveAnchorSet}
        moveAnchorMm={moveAnchorRef.current}
        rotateAnchorSet={rotateAnchorSet}
        rotateAnchorMm={rotateAnchorRef.current}
        rotateReferenceSet={rotateReferenceSet}
        rotateReferenceMm={rotateReferenceRef.current}
        alignReferenceMm={alignReferenceMm}
        mirrorAxisSet={mirrorAxisSet}
        mirrorAxisStartMm={mirrorAxisStartRef.current}
        trimExtendFirstWallSet={trimExtendFirstWallSet}
        hudMm={hudMm}
        numericInput={numericInput}
        hasGripDrag={Boolean(gripDragRef.current)}
        scalePhase={scalePhase}
        worldToScreen={worldToScreen}
      />
      <PlanCanvasReadouts
        activeLevel={activeLevelElem}
        scaleBarMeters={scaleBarMeters}
        plotScaleN={plotScaleN}
      />
      <PlanCanvasEditLayers
        showTempDimensions={!!selectedWall}
        tempDimTargets={tempDimTargets}
        worldToScreen={worldToScreen}
        onTempDimClick={handleTempDimClick}
        onTempDimLockClick={handleTempDimLockClick}
        gripDescriptors={gripDescriptors}
        onGripPointerDown={handleGripPointerDown}
        onGripDoubleClick={handleGripDoubleClick}
        activeGripId={activeGripId}
        draftWall={
          draftMutation && draftMutation.kind === 'wall'
            ? { start: draftMutation.start, end: draftMutation.end }
            : null
        }
        selectedId={selectedId ?? null}
        elementsById={elementsById}
        onDispatch={onSemanticCommand}
        snapGlyphState={snapGlyphState}
      />
      <div ref={mountRef} className="size-full cursor-crosshair" />
      <PlanCanvasStatusOverlays
        elementsById={elementsById}
        activeLevelId={lvlId}
        planTool={planTool}
        loopMode={loopMode}
        hudMm={hudMm}
        worldToScreen={worldToScreen}
        boundaryValidationError={boundaryValidationError}
        onDismissBoundaryValidationError={() => setBoundaryValidationError(null)}
        componentPreviewScreen={componentPreviewScreen}
        componentPreviewSymbolKind={componentPreviewSymbol}
      />
      <PlanCanvasSketchOverlay
        planTool={planTool}
        modelId={modelId}
        levelId={lvlId}
        activePlanViewId={activePlanViewId}
        elementsById={elementsById}
        pointerToMmRef={sketchPointerToMmRef}
        mmToScreenRef={sketchMmToScreenRef}
        floorTypeId={useBimStore.getState().activeFloorTypeId}
        floorDrawOffsetMm={useBimStore.getState().floorDrawOffsetMm}
        roofSlopeDeg={initialRoofState().slopeDeg}
        roofOverhangMm={initialRoofState().eaveOverhangMm}
        onFinished={(createdId) => {
          setPlanTool('select');
          if (createdId) selectEl(createdId);
        }}
        onCancelled={() => setPlanTool('select')}
      />
    </div>
  );
}
