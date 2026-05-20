/* eslint-disable bim-ai/no-hex-in-chrome -- pre-v3 hex literals; remove when this file is migrated in B4 Phase 2 */
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  reduceWallOpening,
  reduceShaft,
  type AlignState,
  type SplitState,
  type TrimState,
  type WallJoinState,
  type WallOpeningState,
  type ShaftState,
  initialColumnState,
  reduceColumn,
  type ColumnState,
  initialBeamState,
  reduceBeam,
  type BeamState,
  initialCeilingState,
  reduceCeiling,
  type CeilingState,
  initialBeamSystemState,
  reduceBeamSystem,
  type BeamSystemState,
  cycleWallLocationLine,
  reduceAreaBoundary,
  initialTextAnnotationState,
  reduceTextAnnotation,
  type TextAnnotationState,
  initialLeaderTextState,
  reduceLeaderText,
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
  reduceRevisionCloud,
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
  reduceModelLine,
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
  reduceRamp,
  type RampState,
  initialGradedRegionState,
  reduceGradedRegion,
  type GradedRegionState,
  initialTerrainSplitState,
  reduceTerrainSplit,
  type TerrainSplitState,
  initialStairRunState,
  reduceStairRun,
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
import { buildScaleCommand, distanceMm } from './scaleTool';
import { linearArrayOffsets, radialArrayAngles, radialOffsetForElement } from './arrayTool';
import { columnPositionsAtGridIntersections } from './columnAtGrids';
import { splitToposolid } from './terrainSplit';
import { handleDblClickDispatch } from './doubleClickDispatch';
import { detectCeilingBoundary } from './ceilingAutoDetect';
import { detectFloorBoundaryFromWalls } from './detectFloorBoundaryFromWalls';
import * as THREE from 'three';
import { parseDimensionInput } from '@bim-ai/core';
import type { Element } from '@bim-ai/core';

import { useBimStore, type PlanTool } from '../state/store';
import type { CategoryOverride } from '../state/storeTypes';
import { useTheme } from '../state/useTheme';
import {
  collectCenterAnchors,
  collectSnapLines,
  collectWallAnchors,
  snapPlanPoint,
  type SegmentLine,
  type SnapHit,
  type SnapKind,
} from './snapEngine';
import { SnapEngine } from './planCanvasState';
import { SnapGlyphLayer } from './SnapGlyphLayer';
import { loadSnapSettings, type SnapSettings, type ToggleableSnapKind } from './snapSettings';
import { bumpSnapTabCycle, initialSnapTabCycle, type SnapTabCycleState } from './snapTabCycle';
import { type DraftMutation, type GripDescriptor } from './gripProtocol';
import { SLICE_Y, orthoExtents, rayToPlanMm } from './interaction/planCameraMath';
import {
  resolveSnapOverrideShortcut,
  type SnapOverrideKeyState,
} from './interaction/snapOverrideShortcuts';
import { nearestWallAt } from './selection/nearestWall';
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
import {
  componentPreviewSymbolKind,
  resolveActiveComponentAsset,
} from './planCanvasComponentPreview';
import {
  handleDoorWindowToolClick,
  handleQueryToolClick,
  handleTagToolClick,
} from './planCanvasClickHandlers';
import { handleBoundaryToolClick } from './planCanvasBoundaryClicks';
import { handleMeasureDraftClick } from './planCanvasMeasureDraftClicks';
import { usePlanCanvasSelectionState } from './planCanvasSelectionState';
import { usePlanProjectionWireSync } from './usePlanProjectionWireSync';
import { usePlanCanvasToolCleanupEffects } from './usePlanCanvasToolCleanupEffects';
import { usePlanCanvasCameraControls } from './usePlanCanvasCameraControls';
import { usePlanCanvasSceneLifecycle } from './usePlanCanvasSceneLifecycle';
import {
  usePlanCanvasRenderPasses,
  type PlanCanvasDraftingPaint,
} from './usePlanCanvasRenderPasses';
import { usePlanCanvasToolActivation } from './usePlanCanvasToolActivation';
import { usePlanCanvasViewEffects } from './usePlanCanvasViewEffects';
import { usePlanCanvasGripHandlers } from './usePlanCanvasGripHandlers';
import { createPlanCanvasKeyboardAuxHandlers } from './planCanvasKeyboardAuxHandlers';
import { findLockedConstraintFor } from './tempDimensionLockState';
import { GripLayer, TempDimLayer } from './GripLayer';
import { HelperDimsLayer } from './HelperDimsLayer';
import {
  extractPlanAnnotationHints,
  extractPlanGraphicHints,
  extractPlanTagStyleHints,
} from './planProjectionWire';
import {
  resolvePlanAnnotationHints,
  resolvePlanGraphicHints,
  resolvePlanTagStyleLane,
  resolvePlanViewDisplay,
} from './planProjection';
import { type CropBounds, type CropHandleId } from './cropRegionDragHandles';
import { findAreaPlacementBoundary } from './areaPlacement';
import {
  dxfViewOverrideKey,
  queryDxfPrimitiveAtPoint,
  selectDxfUnderlaysForLevel,
  type DxfPrimitiveQueryHit,
} from './dxfUnderlay';
import { elevationFromWall } from '../lib/sectionElevationFromWall';
import { type MmToScreen, type PointerToMm } from './SketchCanvas';
import { moveDeltaMm } from './moveTool';
import { wallOffsetMoveCommandFromPoint } from './wallOffsetTool';
import { parseTypedRotateAngle, rotateDeltaAngleFromReference } from './rotateTool';
import { selectNextConnectedWallByTab } from './wallChainSelection';
import { elementInSelectionBoxMm } from './boxSelection';
import { nextTabSelection } from './tabCycleSelection';
import { buildWallRadiusFillet, type MmPoint } from './wallRadiusFillet';
import { createPlanCanvasPreviewHelpers } from './planCanvasPreviewHelpers';
import { createPlanCanvasPickHelpers } from './planCanvasPickHelpers';
import { handleGripPointerUp } from './planCanvasGripPointerUp';
import { handleSelectClick } from './planCanvasSelectClick';
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
import {
  nextWallDraftAfterCommit,
  shouldBlockWallCommitOutsideCrop,
  WALL_CROP_BLOCK_MESSAGE,
} from './wallDraftLifecycle';
import {
  createWallFromPickedLineCommand,
  hasOverlappingWallLine,
  type PickedWallLine,
} from './wallPickLines';
import {
  flipWallLocationLineSide,
  snapWallPointToConnectivity,
} from '../geometry/wallConnectivity';
import { getFamilyById as getBuiltInFamilyById } from '../families/familyCatalog';
import { validateBoundary } from './structuralValidation';
import {
  familyTypePlacesAsDetailComponent,
  familyTypeRequiresWallHost,
} from '../families/familyPlacementRuntime';
import type { FamilyDefinition } from '../families/types';
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
  columnDrawUsage,
  copyMultipleEnabled,
  mirrorCopyEnabled,
  pendingComponentRotationDeg,
  setPendingComponentRotationDeg,
  setDispatchColumnAtGridsSelectAll,
  type SubdivisionCategory,
  lineworkColorHex,
  lineworkLineWeightPx,
  getLineworkLineDash,
} from '../workspace/authoring';
import { ColorSchemeLegend } from './ColorSchemeLegend';

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
  const temporaryVisibility = useBimStore((s) => s.temporaryVisibility);
  // VIE-04: drop elements that the active temporary-visibility override hides
  // before any downstream projection or hit-test sees them. View definitions
  // (plan_view, view_template, viewpoint, …) are never gated.
  const elementsById = useMemo(() => {
    if (temporaryVisibility === null) return elementsByIdRaw;
    const VIEW_DEF_KINDS = new Set<string>([
      'plan_view',
      'view_template',
      'viewpoint',
      'sheet',
      'schedule',
      'level',
      'project_settings',
      'callout',
    ]);
    const next: Record<string, Element> = {};
    for (const [id, el] of Object.entries(elementsByIdRaw)) {
      if (VIEW_DEF_KINDS.has(el.kind)) {
        next[id] = el;
        continue;
      }
      const inSet =
        temporaryVisibility.categories.includes(el.kind) ||
        (temporaryVisibility.elementIds ?? []).includes(id);
      const visible = temporaryVisibility.mode === 'isolate' ? inSet : !inSet;
      if (visible) next[id] = el;
    }
    return next;
  }, [elementsByIdRaw, temporaryVisibility]);
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

  const display = useMemo(
    () =>
      resolvePlanViewDisplay(
        elementsById,
        activePlanViewId,
        activeLevelResolvedId || undefined,
        planPresentation,
      ),
    [elementsById, activePlanViewId, activeLevelResolvedId, planPresentation],
  );

  // PLN-02 — resolve the active plan view's crop state. The frame is drawn
  // when bounds exist AND either cropEnabled or cropRegionVisible is true.
  // When cropEnabled is on, plan rendering also clips elements outside the
  // bounds (handled in the geometry rebuild effect below).
  const activeCropState = useMemo((): {
    planViewId: string;
    cropMinMm: { xMm: number; yMm: number };
    cropMaxMm: { xMm: number; yMm: number };
    cropEnabled: boolean;
    cropRegionVisible: boolean;
  } | null => {
    if (!activePlanViewId) return null;
    const el = elementsById[activePlanViewId];
    if (!el || el.kind !== 'plan_view') return null;
    if (!el.cropMinMm || !el.cropMaxMm) return null;
    const cropEnabled = !!el.cropEnabled;
    const cropRegionVisible = el.cropRegionVisible !== false; // default visible when bounds exist
    return {
      planViewId: el.id,
      cropMinMm: el.cropMinMm,
      cropMaxMm: el.cropMaxMm,
      cropEnabled,
      cropRegionVisible,
    };
  }, [activePlanViewId, elementsById]);

  const mergedGraphicHints = useMemo(() => {
    if (wireGraphicHints) return wireGraphicHints;
    return resolvePlanGraphicHints(elementsById, activePlanViewId);
  }, [wireGraphicHints, elementsById, activePlanViewId]);

  const mergedAnnotationHints = useMemo(() => {
    if (wireAnnotationHints !== null) return wireAnnotationHints;
    return resolvePlanAnnotationHints(elementsById, activePlanViewId);
  }, [wireAnnotationHints, elementsById, activePlanViewId]);

  const planTagFontScales = useMemo(() => {
    const pvId = display.planViewElementId;
    const ro = resolvePlanTagStyleLane(elementsById, pvId, 'opening');
    const rr = resolvePlanTagStyleLane(elementsById, pvId, 'room');
    const bo = wireTagStyleHints?.opening?.textSizePt;
    const br = wireTagStyleHints?.room?.textSizePt;
    const openingPt = typeof bo === 'number' && Number.isFinite(bo) ? bo : ro.textSizePt;
    const roomPt = typeof br === 'number' && Number.isFinite(br) ? br : rr.textSizePt;
    return { opening: openingPt / 10, room: roomPt / 10 };
  }, [wireTagStyleHints, elementsById, display.planViewElementId]);

  const hiddenKey = useMemo(
    () => [...display.hiddenSemanticKinds].sort().join('|'),
    [display.hiddenSemanticKinds],
  );

  // F-102: stable key for per-element hiddenElementIds Set (used in useEffect deps).
  const hiddenElementIdsKey = useMemo(
    () => [...display.hiddenElementIds].sort().join('|'),
    [display.hiddenElementIds],
  );

  const displayLevelId = display.activeLevelId;
  const anchors = useMemo(
    () => collectWallAnchors(elementsById, displayLevelId || undefined),
    [elementsById, displayLevelId],
  );
  const centerAnchors = useMemo(
    () => collectCenterAnchors(elementsById, displayLevelId || undefined),
    [elementsById, displayLevelId],
  );
  const snapLines = useMemo(
    () => collectSnapLines(elementsById, displayLevelId || undefined),
    [elementsById, displayLevelId],
  );
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
              Object.values(elementsById).filter(
                (el): el is Extract<Element, { kind: 'wall' }> =>
                  el.kind === 'wall' && (!displayLevelId || el.levelId === displayLevelId),
              ),
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
        elementsById,
        displayLevelId,
        snapEngineRef,
        snapIndicatorRef,
        setSnapLabel,
        lastSnapLinesRef,
        anchors,
        centerAnchors,
        draftRef,
        orthoSnapHold,
        snapOverrideRef,
        snapSettings,
        snapTabCycleRef,
        lastSnapHitsRef,
        setSnapGlyphState,
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
        elementsById,
        displayLevelId,
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
            previousWall!.cornerEndpoint === 'start'
              ? fillet.previousEnd
              : previousWall!.actualStart;
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
            Math.hypot(
              pathEnd.xMm - fillet.currentStart.xMm,
              pathEnd.yMm - fillet.currentStart.yMm,
            ) > 1
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
          const wallHit = nearestWallAt(
            elementsById,
            displayLevelId || undefined,
            tMm.xMm,
            tMm.yMm,
          );
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
        const nearestWall = nearestWallAt(
          elementsById,
          displayLevelId || undefined,
          sp.xMm,
          sp.yMm,
        );
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
          const { columnDrawHeightMm, columnDrawWidthMm, columnDrawDepthMm } =
            useBimStore.getState();
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
          const {
            stairDrawBaseLevelId,
            stairDrawTopLevelId,
            stairDrawWidthMm,
            stairDrawRunWidthMm,
          } = useBimStore.getState();
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
        const { state: slNext, effect: slEffect } = reduceStairLanding(
          stairLandingStateRef.current,
          { kind: 'click', pointMm: sp, elementId: slElementId },
        );
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
          const { state: scState, effect } = reduceSteelConnection(
            steelConnectionStateRef.current,
            { kind: 'click', pickedElementId: pickedEl.id },
          );
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
        const { state: next, effect } = reduceDetailFilledRegion(
          detailFilledRegionStateRef.current,
          { kind: 'click', pointMm: { xMm: sp.xMm, yMm: sp.yMm } },
        );
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
              .setColumnAtGridsSelectedIds(
                state.phase === 'selecting' ? state.selectedGridIds : [],
              );
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
        const existingPbp = Object.values(elementsById).find(
          (e) => e.kind === 'project_base_point',
        );
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
    displayLevelId,
    elementsById,
    lvlId,
    activeLevelResolvedId,
    onSemanticCommand,
    orthoSnapHold,
    planTool,
    resizeCam,
    selectEl,
    setActiveLevelId,
    activateElevationView,
    activatePlanView,
    snapSettings,
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

  const sb = THREE.MathUtils.clamp(halfUi * 0.25, 0.2, 6);
  const plotScaleN = Math.round(halfUi * 2);
  const activeComponentAsset = resolveActiveComponentAsset({
    planTool,
    activeComponentAssetId,
    elementsById: elementsByIdRaw,
    previewEntry: activeComponentAssetPreviewEntry,
  });
  const componentPreviewScreen = hudMm && activeComponentAsset ? worldToScreen(hudMm) : null;
  const componentPreviewSymbol = componentPreviewSymbolKind(activeComponentAsset);

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
        scaleBarMeters={sb}
        plotScaleN={plotScaleN}
      />
      {/* EDT-01 — temp-dimension layer: shown when exactly one wall is selected. */}
      {selectedWall && tempDimTargets.length > 0 && (
        <TempDimLayer
          targets={tempDimTargets}
          worldToScreen={worldToScreen}
          onTargetClick={handleTempDimClick}
          onLockClick={handleTempDimLockClick}
          isLocked={(t) => !!findLockedConstraintFor(t.aId, t.bId, Object.values(elementsById))}
        />
      )}
      {/* EDT-01 — grip layer (raycast above element pick so grips win
          on hover). Renders the live draft preview during drag.
          F-088: also shown for selected dimensions (text + offset grips). */}
      {gripDescriptors.length > 0 && (
        <GripLayer
          grips={gripDescriptors}
          worldToScreen={worldToScreen}
          onGripPointerDown={handleGripPointerDown}
          onGripDoubleClick={handleGripDoubleClick}
          activeGripId={activeGripId}
          draftWall={
            draftMutation && draftMutation.kind === 'wall'
              ? { start: draftMutation.start, end: draftMutation.end }
              : null
          }
        />
      )}
      {/* EDT-V3-06 — helper dimension chips on single-element selection. */}
      <HelperDimsLayer
        selectedElemId={selectedId ?? null}
        elementsById={elementsById}
        planToScreen={worldToScreen}
        onDispatch={onSemanticCommand}
      />
      {/* EDT-05 — snap glyph layer (×, ⊥, dot+dash) above the canvas. */}
      <SnapGlyphLayer
        candidates={snapGlyphState.candidates}
        activeIndex={snapGlyphState.activeIndex}
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
