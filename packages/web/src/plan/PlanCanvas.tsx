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
  areaBoundaryCanClose,
  areaBoundaryRectangleFromDiagonal,
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
import type { Element, LensMode, ViewLensMode } from '@bim-ai/core';

import { useBimStore, type PlanTool } from '../state/store';
import type { CategoryOverride } from '../state/storeTypes';
import { useTheme } from '../state/useTheme';
import { lensFilterFromMode, resolveLensFilter } from '../viewport/useLensFilter';
import {
  collectCenterAnchors,
  collectSnapLines,
  collectWallAnchors,
  snapPlanCandidates,
  snapPlanPoint,
  type SegmentLine,
  type SnapHit,
  type SnapKind,
} from './snapEngine';
import {
  classifyPointerStart,
  draftingPaintFor,
  PlanCamera,
  SnapEngine,
  type SnapCandidate,
} from './planCanvasState';
import { SnapGlyphLayer } from './SnapGlyphLayer';
import {
  applySnapSettings,
  loadSnapSettings,
  type SnapSettings,
  type ToggleableSnapKind,
} from './snapSettings';
import {
  bumpSnapTabCycle,
  initialSnapTabCycle,
  syncSnapTabCycle,
  type SnapTabCycleState,
} from './snapTabCycle';
import { type DraftMutation, type GripDescriptor } from './gripProtocol';
import { gripsFor } from './grip-providers';
import { dimensionTextOffsetResetCommand } from './grip-providers/dimensionGripProvider';
import {
  HALF_MAX,
  HALF_MIN,
  SLICE_Y,
  orthoExtents,
  rayToPlanMm,
} from './interaction/planCameraMath';
import {
  resolveSnapOverrideShortcut,
  type SnapOverrideKeyState,
} from './interaction/snapOverrideShortcuts';
import { nearestWallAt } from './selection/nearestWall';
import { guessGridLabel, readPlanToken, type Draft } from './planCanvasHelpers';
import { PlanCanvasReadouts } from './PlanCanvasReadouts';
import { PlanCanvasToolOverlays } from './PlanCanvasToolOverlays';
import { PlanCanvasStatusOverlays } from './PlanCanvasStatusOverlays';
import { tempDimensionsFor, type TempDimTarget } from './tempDimensions';
import { findLockedConstraintFor } from './tempDimensionLockState';
import { GripLayer, TempDimLayer } from './GripLayer';
import { HelperDimsLayer } from './HelperDimsLayer';
import {
  buildPlanProjectionQuery,
  extractPlanAnnotationHints,
  extractPlanCategoryGraphicHintsV0,
  extractPlanGraphicHints,
  extractPlanPrimitives,
  extractPlanTagStyleHints,
  extractRoomColorLegend,
  extractRoomProgrammeLegendEvidenceV0,
  fetchPlanProjectionWire,
} from './planProjectionWire';
import {
  resolvePlanAnnotationHints,
  extractPlanRegionOverlays,
  resolvePlanGraphicHints,
  resolvePlanTagStyleLane,
  resolvePlanViewDisplay,
  type PlanSemanticKind,
} from './planProjection';
import { rebuildPlanMeshes } from './symbology';
import {
  applyCropHandleDrag,
  cropDragCommands,
  pickCropHandle,
  pointInsideCrop,
  type CropBounds,
  type CropHandleId,
} from './cropRegionDragHandles';
import { getCropRegionGrips, applyCropGripDrag } from './cropRegionGrips';
import { extractDetailComponentPrimitives } from './detailComponentsRender';
import { extractMaskingRegionPrimitives } from './maskingRegionRender';
import { extractAreaPrimitives } from './areaRender';
import { areaPlanPlacementContext, findAreaPlacementBoundary } from './areaPlacement';
import { manualPlacedTagLabel, placeTagByCategoryCommand } from './manualTags';
import { extractNeighborhoodMassPrimitives } from './neighborhoodMassRender';
import { planAnnotationLabelSprite, tagLeaderLineThree } from './planElementMeshBuilders';
import { createPlanTextSprite } from './planTextSprites';
import {
  dxfViewOverrideKey,
  hiddenDxfLayerNamesForView,
  isDxfLinkVisibleInView,
  makeDxfLinkTransform,
  isDxfLayerHidden,
  queryDxfPrimitiveAtPoint,
  resolveDxfPrimitiveColor,
  resolveDxfUnderlayStyle,
  selectDxfUnderlaysForLevel,
  setDxfLayerHiddenInView,
  type DxfPrimitiveQueryHit,
} from './dxfUnderlay';
import {
  buildDriftBadgeCanvas,
  driftBadgeTooltip,
  elementBadgeAnchorMm,
  selectDriftedElements,
} from './monitorDriftBadge';
import { elevationFromWall } from '../lib/sectionElevationFromWall';
import { WallContextMenu, type WallContextMenuCommand } from '../workspace/viewport';
import { ElementContextMenu } from '../workspace/ElementContextMenu';
import { contextMenuItemsForElement } from '../workspace/contextMenuItems';
import { CanvasContextMenu } from './CanvasContextMenu';
import { createSimilarPayload } from './createSimilar';
import { SketchCanvas, type MmToScreen, type PointerToMm } from './SketchCanvas';
import { snapPointToNearestWallFaceMm } from './SketchCanvasPickWalls';
import { moveDeltaMm } from './moveTool';
import { wallOffsetMoveCommandFromPoint } from './wallOffsetTool';
import { parseTypedRotateAngle, rotateDeltaAngleFromReference } from './rotateTool';
import { selectNextConnectedWallByTab } from './wallChainSelection';
import { elementInSelectionBoxMm } from './boxSelection';
import { nextTabSelection } from './tabCycleSelection';
import { buildWallRadiusFillet, type MmPoint } from './wallRadiusFillet';
import { buildMarqueePreview, disposeMarqueePreview } from './marqueeSelectionPreview';
import {
  nextWallDraftAfterCommit,
  shouldBlockWallCommitOutsideCrop,
  WALL_CROP_BLOCK_MESSAGE,
} from './wallDraftLifecycle';
import {
  createWallFromPickedLineCommand,
  hasOverlappingWallLine,
  pickDxfLineForWall,
  pickFloorBoundaryEdgeForWall,
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
import { buildComponentGhost } from './componentGhost';
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
  SubdivisionPalette,
  type SubdivisionCategory,
  lineworkColorHex,
  lineworkLineWeightPx,
  getLineworkLineDash,
} from '../workspace/authoring';
import type { ColorSchemeRoomEntry } from './ColorSchemeDialog';
import { ColorSchemeLegend } from './ColorSchemeLegend';
import { buildRoomColorSchemeLegend } from '../schedules/roomColorSchemeLegendReadout';

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
  const [roofByExtrusionPhase, setRoofByExtrusionPhase] =
    useState<RoofByExtrusionState['phase']>('idle');
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
  const draftingRef = useRef<ReturnType<typeof draftingPaintFor> | null>(null);
  const lastPlotScaleRef = useRef<number>(0);
  const lastAutoFitLevelRef = useRef<string | null>(null);
  const snapEngineRef = useRef(new SnapEngine());
  const snapIndicatorRef = useRef<THREE.Mesh | null>(null);
  // SKT-01: callback refs the SketchCanvas overlay reads to map pointer → mm
  // and mm → screen pixels using the live orthographic camera. They stay
  // attached to refs (not state) so panning / zooming updates the overlay
  // without re-rendering this component.
  const sketchPointerToMmRef = useRef<PointerToMm | null>(null);
  const sketchMmToScreenRef = useRef<MmToScreen | null>(null);
  const [snapLabel, setSnapLabel] = useState<string | null>(null);
  // WP-NEXT-49: pre-commit boundary validation error shown above the canvas.
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
  const [halfUi, setHalfUi] = useState(22);
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
  // D8 - Color fill scheme: user-selected category and color overrides.
  const [colorFillScheme, setColorFillScheme] = useState<{
    category: string;
    colorMap: Record<string, string>;
  } | null>(null);
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
  // §3.3.5 — Show Constraints toggle: whether EQ markers and lock symbols are shown.
  const showConstraints = useMemo(() => {
    if (!activePlanViewId) return false;
    const pv = elementsById[activePlanViewId];
    if (!pv || pv.kind !== 'plan_view') return false;
    return (pv as any).showConstraints ?? false;
  }, [activePlanViewId, elementsById]);
  // §2.9.4 — plan underlay ghost toggle state
  const showUnderlay = useMemo(() => {
    if (!activePlanViewId) return false;
    const pv = elementsById[activePlanViewId];
    if (!pv || pv.kind !== 'plan_view') return false;
    return (pv as any).showUnderlay ?? false;
  }, [activePlanViewId, elementsById]);
  const underlayLevelId = useMemo(() => {
    if (!activePlanViewId) return null;
    const pv = elementsById[activePlanViewId];
    if (!pv || pv.kind !== 'plan_view') return null;
    return (pv as any).underlayLevelId ?? null;
  }, [activePlanViewId, elementsById]);
  const underlayLevels = useMemo(
    () =>
      Object.values(elementsById)
        .filter((e) => e.kind === 'level')
        .map((e) => ({ id: e.id, name: (e as any).name ?? e.id })),
    [elementsById],
  );
  const selectLinkedEnabled = useBimStore((s) => s.selectLinkedEnabled);
  // §7.3.1 — active work plane name for the plan view header badge.
  const activeWorkPlaneName = useMemo(() => {
    if (!activePlanViewId) return null;
    const pv = elementsById[activePlanViewId];
    if (!pv || pv.kind !== 'plan_view') return null;
    const wpId = (pv as { activeWorkPlaneId?: string | null }).activeWorkPlaneId;
    if (!wpId) return null;
    const wp = elementsById[wpId];
    if (!wp || wp.kind !== 'reference_plane') return null;
    return (wp as { name?: string }).name ?? null;
  }, [activePlanViewId, elementsById]);
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

  // F-025 — active level element for plan canvas elevation badge.
  const activeLevelElem = useMemo(() => {
    if (!lvlId) return undefined;
    const el = elementsById[lvlId];
    if (el && el.kind === 'level') return el;
    return undefined;
  }, [lvlId, elementsById]);

  // EDT-01 — selected wall + grip / temp-dim derivation
  const selectedWall = useMemo(() => {
    if (!selectedId) return undefined;
    const el = elementsById[selectedId];
    return el && el.kind === 'wall' ? el : undefined;
  }, [selectedId, elementsById]);
  const selectedElement = useMemo(
    () => (selectedId ? elementsById[selectedId] : undefined),
    [selectedId, elementsById],
  );
  const gripDescriptors = useMemo<GripDescriptor[]>(
    () => (selectedElement ? gripsFor(selectedElement, { elementsById }) : []),
    [selectedElement, elementsById],
  );
  const tempDimTargets = useMemo<TempDimTarget[]>(
    () => (selectedWall ? tempDimensionsFor(selectedWall, elementsById) : []),
    [selectedWall, elementsById],
  );

  // EDT-01 + EDT-05 — world-mm → screen-px mapping. Cheap to recompute
  // every render because the function closes over the live refs.
  const worldToScreen = useCallback((xy: { xMm: number; yMm: number }) => {
    const cam = cameraRef.current;
    const renderer = rendererRef.current;
    if (!cam || !renderer) return { pxX: 0, pxY: 0 };
    const v = new THREE.Vector3(xy.xMm / 1000, SLICE_Y, xy.yMm / 1000);
    v.project(cam);
    const rect = renderer.domElement.getBoundingClientRect();
    return {
      pxX: ((v.x + 1) / 2) * rect.width,
      pxY: ((1 - v.y) / 2) * rect.height,
    };
  }, []);

  // B03 — empty-state detection: true when the active level has no elements on it
  const levelIsEmpty = useMemo(() => {
    const chkId = displayLevelId || activeLevelResolvedId;
    if (!chkId) return false;
    return !Object.values(elementsById).some(
      (e) => 'levelId' in e && (e as { levelId: string }).levelId === chkId,
    );
  }, [elementsById, displayLevelId, activeLevelResolvedId]);

  // D8 - Rooms on the active level (for Color Scheme dialog)
  const roomsOnLevel = useMemo((): ColorSchemeRoomEntry[] => {
    const out: ColorSchemeRoomEntry[] = [];
    for (const el of Object.values(elementsById)) {
      if (el.kind !== 'room') continue;
      if (lvlId && (el as { levelId?: string }).levelId !== lvlId) continue;
      out.push({
        id: el.id,
        name: (el as { name?: string }).name ?? '',
        department: (el as { department?: string | null }).department ?? undefined,
        area: undefined,
        occupancy: undefined,
      });
    }
    return out;
  }, [elementsById, lvlId]);

  // §13.1.3 — color fill legend rows derived from the active plan view's colorScheme field.
  const activePlanViewColorScheme = useMemo(() => {
    if (!activePlanViewId) return null;
    const el = elementsById[activePlanViewId];
    if (!el || el.kind !== 'plan_view') return null;
    return el.colorScheme ?? null;
  }, [activePlanViewId, elementsById]);

  const colorSchemeLegendRows = useMemo(
    () => buildRoomColorSchemeLegend(elementsById, activePlanViewColorScheme),
    [elementsById, activePlanViewColorScheme],
  );

  const colorSchemeLegendTitle = useMemo(() => {
    switch (activePlanViewColorScheme?.category) {
      case 'name':
        return 'By Name';
      case 'department':
        return 'By Department';
      case 'area':
        return 'By Area';
      case 'occupancy':
        return 'By Occupancy';
      default:
        return 'Color Scheme';
    }
  }, [activePlanViewColorScheme]);

  useEffect(() => {
    let cancel = false;
    if (!modelId) {
      queueMicrotask(() => {
        if (cancel) return;
        setPlanProjectionPrimitives(null);
        setPlanRoomSchemeWireReadout(null);
        setRoomColorLegend([]);
        setWireGraphicHints(null);
        setWireAnnotationHints(null);
        setWireTagStyleHints(null);
      });
      return () => {
        cancel = true;
      };
    }
    void (async () => {
      try {
        const qs = buildPlanProjectionQuery({
          planViewId: display.planViewElementId,
          fallbackLevelId: display.planViewElementId ? undefined : lvlId || undefined,
          globalPresentation: planPresentation,
        });
        const payload = await fetchPlanProjectionWire(modelId, qs);
        if (cancel) return;
        const legendRows = extractRoomColorLegend(payload);
        setPlanProjectionPrimitives(extractPlanPrimitives(payload));
        setPlanRoomSchemeWireReadout({
          roomColorLegendRows: legendRows,
          programmeLegendEvidence: extractRoomProgrammeLegendEvidenceV0(payload),
          planCategoryGraphicHintsV0: extractPlanCategoryGraphicHintsV0(payload),
        });
        setRoomColorLegend(legendRows);
        setWireGraphicHints(extractPlanGraphicHints(payload));
        setWireAnnotationHints(extractPlanAnnotationHints(payload));
        setWireTagStyleHints(extractPlanTagStyleHints(payload));
      } catch {
        if (!cancel) setPlanProjectionPrimitives(null);
        if (!cancel) setPlanRoomSchemeWireReadout(null);
        if (!cancel) setRoomColorLegend([]);
        if (!cancel) setWireGraphicHints(null);
        if (!cancel) setWireAnnotationHints(null);
        if (!cancel) setWireTagStyleHints(null);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [
    modelId,
    revision,
    display.planViewElementId,
    lvlId,
    planPresentation,
    setPlanProjectionPrimitives,
    setPlanRoomSchemeWireReadout,
  ]);

  const resizeCam = useCallback(() => {
    const host = mountRef.current;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!host || !renderer || !camera) return;
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h);
    const asp = w / h;
    const hh = camRef.current.half;
    camera.left = -hh * asp;
    camera.right = hh * asp;
    camera.top = hh;
    camera.bottom = -hh;
    camera.position.set(camRef.current.camX, 320, camRef.current.camZ);
    camera.lookAt(camRef.current.camX, 0, camRef.current.camZ);
    camera.updateProjectionMatrix();
    setHalfUi(camRef.current.half);
  }, []);

  useEffect(() => {
    if (!cameraHandleRef) return;
    cameraHandleRef.current = {
      getSnapshot: () => ({
        centerMm: { xMm: camRef.current.camX * 1000, yMm: camRef.current.camZ * 1000 },
        halfMm: camRef.current.half * 1000,
      }),
      applySnapshot: (snap) => {
        if (snap.centerMm) {
          camRef.current.camX = (snap.centerMm.xMm ?? camRef.current.camX * 1000) / 1000;
          camRef.current.camZ = (snap.centerMm.yMm ?? camRef.current.camZ * 1000) / 1000;
        }
        if (snap.halfMm !== undefined) {
          camRef.current.half = snap.halfMm / 1000;
        }
        resizeCam();
      },
    };
    return () => {
      if (cameraHandleRef) cameraHandleRef.current = null;
    };
  }, [cameraHandleRef, resizeCam]);

  const handleFitToView = useCallback(() => {
    const grp = rootRef.current;
    const rnd = rendererRef.current;
    if (!grp || !rnd) return;
    const box = new THREE.Box3().setFromObject(grp);
    if (!Number.isFinite(box.min.x)) return;
    const cx = (box.min.x + box.max.x) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    const halfX = (box.max.x - box.min.x) / 2;
    const halfZ = (box.max.z - box.min.z) / 2;
    const asp = rnd.domElement.clientWidth / Math.max(1, rnd.domElement.clientHeight);
    const half = Math.max(halfX / asp, halfZ) * 1.15;
    camRef.current.camX = cx;
    camRef.current.camZ = cz;
    camRef.current.half = THREE.MathUtils.clamp(half, HALF_MIN, HALF_MAX);
    resizeCam();
  }, [resizeCam]);

  useEffect(() => {
    draftRef.current = undefined;
    wallFlipRef.current = false;
    alignStateRef.current = initialAlignState();
    setAlignReferenceMm(null);
    mirrorAxisStartRef.current = null;
    setMirrorAxisSet(false);
    copyAnchorRef.current = null;
    setCopyAnchorSet(false);
    moveAnchorRef.current = null;
    setMoveAnchorSet(false);
    rotateAnchorRef.current = null;
    setRotateAnchorSet(false);
    rotateReferenceRef.current = null;
    setRotateReferenceSet(false);
    scaleStateRef.current = initialScaleState();
    setScalePhase('idle');
    setNumericInput(null);
    splitStateRef.current = initialSplitState();
    splitWallStateRef.current = initialSplitWallState();
    trimStateRef.current = initialTrimState();
    trimExtendFirstWallRef.current = null;
    setTrimExtendFirstWallSet(false);
    wallJoinStateRef.current = initialWallJoinState();
    if (planTool === 'align') {
      const { state } = reduceAlign(alignStateRef.current, { kind: 'activate' });
      alignStateRef.current = state;
    } else if (planTool === 'split') {
      const { state } = reduceSplit(splitStateRef.current, { kind: 'activate' });
      splitStateRef.current = state;
    } else if (planTool === 'split-wall') {
      const { state } = reduceSplitWall(splitWallStateRef.current, { kind: 'activate' });
      splitWallStateRef.current = state;
    } else if (planTool === 'trim') {
      const { state } = reduceTrim(trimStateRef.current, { kind: 'activate' });
      trimStateRef.current = state;
    } else if (planTool === 'wall-join') {
      const { state } = reduceWallJoin(wallJoinStateRef.current, { kind: 'activate' });
      wallJoinStateRef.current = state;
    } else if (planTool === 'wall-opening') {
      wallOpeningStateRef.current = initialWallOpeningState();
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
    } else if (planTool === 'beam-system') {
      beamSystemStateRef.current = initialBeamSystemState();
    } else if (planTool === 'steel-connection') {
      const { state: scState } = reduceSteelConnection(steelConnectionStateRef.current, {
        kind: 'activate',
      });
      steelConnectionStateRef.current = scState;
    } else if (planTool === 'column-at-grids') {
      const { state } = reduceColumnAtGrids(columnAtGridsStateRef.current, { kind: 'activate' });
      columnAtGridsStateRef.current = state;
      useBimStore.getState().setColumnAtGridsSelectedIds([]);
      setDispatchColumnAtGridsSelectAll((gridIds) => {
        const { state: s } = reduceColumnAtGrids(columnAtGridsStateRef.current, {
          kind: 'selectAllGrids',
          gridIds,
        });
        columnAtGridsStateRef.current = s;
        useBimStore
          .getState()
          .setColumnAtGridsSelectedIds(s.phase === 'selecting' ? s.selectedGridIds : []);
        bumpGeom((x) => x + 1);
      });
    } else if (planTool === 'scale') {
      const { state } = reduceScale(scaleStateRef.current, { kind: 'activate' });
      scaleStateRef.current = state;
      setScalePhase(state.phase);
    } else if (planTool === 'array') {
      const { state } = reduceArray(arrayStateRef.current, { kind: 'activate' });
      arrayStateRef.current = state;
      setArrayPhase(state.phase);
    } else if (planTool === 'place-group') {
      const { state } = reducePlaceGroup(placeGroupStateRef.current, { kind: 'activate' });
      placeGroupStateRef.current = state;
    } else if (planTool === 'roof-by-extrusion') {
      const { state } = reduceRoofByExtrusion(
        roofByExtrusionStateRef.current,
        { kind: 'activate' },
        '',
      );
      roofByExtrusionStateRef.current = state;
      setRoofByExtrusionPhase(state.phase);
    } else if (planTool === 'linework') {
      const { state } = reduceLinework(lineworkStateRef.current, { kind: 'activate' });
      lineworkStateRef.current = state;
    } else if (planTool === 'conical-roof') {
      const { state } = reduceConicalRoof(conicalRoofStateRef.current, { kind: 'activate' });
      conicalRoofStateRef.current = state;
    } else if (planTool === 'dome-roof') {
      const { state } = reduceDomeRoof(domeRoofStateRef.current, { kind: 'activate' });
      domeRoofStateRef.current = state;
    } else if (planTool === 'spire-roof') {
      const { state } = reduceSpireRoof(spireRoofStateRef.current, { kind: 'activate' });
      spireRoofStateRef.current = state;
    } else if (planTool === 'stair-run') {
      stairRunStateRef.current = initialStairRunState();
    } else if (planTool === 'stair-landing') {
      stairLandingStateRef.current = initialStairLandingState();
    } else if (planTool === 'detail-line') {
      const { state } = reduceDetailLine(detailLineStateRef.current, { kind: 'activate' });
      detailLineStateRef.current = state;
    } else if (planTool === 'detail-filled-region') {
      const { state } = reduceDetailFilledRegion(detailFilledRegionStateRef.current, {
        kind: 'activate',
      });
      detailFilledRegionStateRef.current = state;
    }
  }, [planTool]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 2));
    renderer.setClearColor(readPlanToken('--draft-paper', '#0b1220'), 1);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 0.76));
    const grp = new THREE.Group();
    rootRef.current = grp;
    scene.add(grp);
    const oc = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.03, 5000);
    oc.up.set(0, 1, 0);
    cameraRef.current = oc;
    // SKT-01: install coordinate-mapping callbacks for the SketchCanvas overlay.
    sketchPointerToMmRef.current = (cx, cy) => rayToPlanMm(renderer, oc, cx, cy);
    sketchMmToScreenRef.current = (pt) => {
      const v = new THREE.Vector3(pt.xMm / 1000, 0, pt.yMm / 1000);
      v.project(oc);
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: (v.x * 0.5 + 0.5) * rect.width,
        y: (-v.y * 0.5 + 0.5) * rect.height,
      };
    };
    const ro = new ResizeObserver(() => resizeCam());
    ro.observe(mount);
    resizeCam();
    let raf = 0;
    const tick = () => {
      renderer.render(scene, oc);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      sketchPointerToMmRef.current = null;
      sketchMmToScreenRef.current = null;
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
    // `theme` triggers a renderer rebuild on light/dark toggle so paper/grid
    // tokens are re-read. Spec §32 V11.
  }, [resizeCam, theme]);

  // §5.4.2 — apply planViewAngleDeg rotation to the root group when the active
  // plan view has a stored true-north rotation.
  useEffect(() => {
    const grp = rootRef.current;
    if (!grp) return;
    const pv = activePlanViewId ? elementsById[activePlanViewId] : undefined;
    const angleDeg = pv?.kind === 'plan_view' ? (pv.planViewAngleDeg ?? 0) : 0;
    grp.rotation.y = (angleDeg * Math.PI) / 180;
  }, [activePlanViewId, elementsById]);

  useEffect(() => {
    const grp = rootRef.current;
    if (!grp) return;

    // B01 — compute plot scale and resolve drafting paint for this zoom level
    const worldHalfMm = camRef.current.half * 1000;
    const plotScale = worldHalfMm / 500;
    draftingRef.current = draftingPaintFor(plotScale);
    lastPlotScaleRef.current = plotScale;

    // OSM-V3-02 — render neighborhood_mass polygons at the LOWEST z-order so
    // they appear behind all authored BIM geometry. Clear stale meshes first.
    for (let i = grp.children.length - 1; i >= 0; i--) {
      const ch = grp.children[i]!;
      if ((ch.userData as { neighborhoodMass?: unknown }).neighborhoodMass) grp.remove(ch);
    }
    {
      // Determine the current view kind from the active plan view element.
      const activePv = activePlanViewId ? elementsById[activePlanViewId] : null;
      const rawViewKind =
        activePv && 'subKind' in activePv ? (activePv.subKind as string | undefined) : undefined;
      const viewKind = rawViewKind ?? 'site_plan';

      const massPrims = extractNeighborhoodMassPrimitives(elementsById, {
        viewKind,
        showNeighborhoodMasses,
      });

      const massColor = readPlanToken('--neighborhood-mass-color', '#a8a39c');

      for (const m of massPrims) {
        if (m.footprintMm.length < 3) continue;
        const shape = new THREE.Shape();
        shape.moveTo(m.footprintMm[0]!.xMm / 1000, m.footprintMm[0]!.yMm / 1000);
        for (let i = 1; i < m.footprintMm.length; i++) {
          shape.lineTo(m.footprintMm[i]!.xMm / 1000, m.footprintMm[i]!.yMm / 1000);
        }
        shape.closePath();
        const geom = new THREE.ShapeGeometry(shape);
        // Rotate from XY (ShapeGeometry default) to XZ plan slice.
        geom.rotateX(-Math.PI / 2);
        // Sit BELOW the grid (SLICE_Y) and all other plan meshes (lowest z-order).
        geom.translate(0, SLICE_Y - 0.002, 0);
        const fill = new THREE.Mesh(
          geom,
          new THREE.MeshBasicMaterial({
            color: massColor,
            transparent: true,
            opacity: m.fillAlpha,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        fill.userData.neighborhoodMass = true;
        fill.userData.bimPickId = m.id;
        // renderOrder -1 ensures Three.js sorts these behind renderOrder 0 meshes.
        fill.renderOrder = -1;
        grp.add(fill);
      }
    }

    // F-014: in reveal-hidden mode, force the client-side path so we can tint
    // hidden elements magenta. The wire path (server projection) excludes hidden
    // elements at generation time and cannot show them.
    const wirePrimitives = modelId && !revealHiddenMode ? planProjectionPrimitives : null;

    // F-102: build filtered elementsById for per-element hide. In normal mode, remove
    // individually-hidden elements before passing to rebuildPlanMeshes. In reveal mode,
    // pass all elements (including hidden ones) so they appear, then tint them magenta below.
    const elementsByIdForRender =
      !revealHiddenMode && display.hiddenElementIds.size > 0
        ? Object.fromEntries(
            Object.entries(elementsById).filter(([id]) => !display.hiddenElementIds.has(id)),
          )
        : elementsById;

    const activePvForPhase = activePlanViewId ? elementsById[activePlanViewId] : null;
    const viewPhaseId =
      activePvForPhase?.kind === 'plan_view' ? (activePvForPhase.phaseId ?? null) : null;
    const phaseFilterMode =
      activePvForPhase?.kind === 'plan_view'
        ? ((activePvForPhase.phaseFilterMode ?? null) as
            | 'new_construction'
            | 'demolition'
            | 'existing'
            | 'as_built'
            | null)
        : null;

    rebuildPlanMeshes(grp, elementsByIdForRender, {
      activeLevelId: displayLevelId || undefined,
      activeViewId: activePlanViewId || undefined,
      selectedId,
      presentation: display.presentation,
      hiddenSemanticKinds: revealHiddenMode ? new Set<string>() : display.hiddenSemanticKinds,
      revealHiddenKinds: revealHiddenMode ? display.hiddenSemanticKinds : undefined,
      wirePrimitives,
      planGraphicHints: mergedGraphicHints,
      planAnnotationHints: mergedAnnotationHints,
      planTagFontScales,
      plotScale,
      lineWeights: thinLinesEnabled
        ? {
            cutMajor: 1,
            cutMinor: 1,
            projMajor: 1,
            projMinor: 1,
            witness: 1,
            gridMajor: draftingRef.current.lineWeights.gridMajor !== null ? 1 : null,
            gridMinor: draftingRef.current.lineWeights.gridMinor !== null ? 1 : null,
          }
        : draftingRef.current.lineWeights,
      viewPhaseId,
      phaseFilterMode,
      groupRegistry,
      groupEditModeDefinitionId,
      joinedPairs,
      lineworkOverrides:
        activePvForPhase?.kind === 'plan_view'
          ? (activePvForPhase.lineworkOverrides ?? null)
          : null,
    });

    // F-102: in reveal mode, tint individually-hidden elements magenta so users can
    // see and right-click them to unhide (same magenta as category-hidden reveal).
    if (revealHiddenMode && display.hiddenElementIds.size > 0) {
      for (const child of grp.children) {
        const pickId = (child.userData as { bimPickId?: string }).bimPickId;
        if (pickId && display.hiddenElementIds.has(pickId)) {
          child.traverse((node) => {
            const mesh = node as THREE.Mesh | THREE.Line;
            if (!(mesh instanceof THREE.Mesh) && !(mesh instanceof THREE.Line)) return;
            if (!mesh.material) return;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mesh.material = mats.map((m: THREE.Material) => {
              const c = m.clone();
              if ('color' in c) (c as unknown as { color: THREE.Color }).color.setHex(0xff00ff);
              (c as unknown as { transparent: boolean; opacity: number }).transparent = true;
              (c as unknown as { transparent: boolean; opacity: number }).opacity = 0.55;
              return c;
            });
          });
        }
      }
    }

    // B01 — apply hatch visibility per scale (no-op until hatch meshes are added)
    for (const ch of grp.children) {
      if (typeof (ch.userData as { hatchKind?: string }).hatchKind === 'string') {
        ch.visible = draftingRef.current.visibleHatches.some(
          (h) => h.kind === (ch.userData as { hatchKind: string }).hatchKind,
        );
      }
    }

    // DSC-V3-02 — discipline lens ghost pass: 25% opacity for non-matching elements.
    {
      const planView = activePlanViewId ? elementsById[activePlanViewId] : null;
      const filter =
        lensMode && lensMode !== 'all'
          ? lensFilterFromMode(lensMode as LensMode)
          : resolveLensFilter(
              planView && 'defaultLens' in planView
                ? (planView as { defaultLens?: ViewLensMode })
                : null,
            );
      if (lensMode !== 'all' || (planView && 'defaultLens' in planView)) {
        const witnessColor = readPlanToken('--draft-witness', '#64748b');
        const witnessThree = new THREE.Color(witnessColor);
        grp.traverse((ch) => {
          const pickId = (ch.userData as { bimPickId?: string }).bimPickId;
          if (typeof pickId !== 'string') return;
          const el = elementsById[pickId];
          if (!el) return;
          const isGhost = filter(el) === 'ghost';
          if (ch instanceof THREE.Mesh) {
            const mat = ch.material as THREE.Material | THREE.Material[];
            const applyGhost = (m: THREE.Material) => {
              m.transparent = true;
              m.opacity = isGhost ? 0.25 : 1.0;
              const anyMat = m as THREE.Material & { color?: THREE.Color };
              if (isGhost && anyMat.color instanceof THREE.Color) {
                anyMat.color.copy(witnessThree);
              }
            };
            if (Array.isArray(mat)) mat.forEach(applyGhost);
            else applyGhost(mat);
          }
        });
      }
    }

    for (let i = grp.children.length - 1; i >= 0; i--) {
      const ch = grp.children[i]!;
      if ((ch.userData as { draftingGrid?: unknown }).draftingGrid) grp.remove(ch);
    }
    // B01 / CAN-V3-01 — grid passes driven by lineWeights; null = suppress entirely (spec §14.5).
    const { gridMajor, gridMinor } = draftingRef.current?.lineWeights ?? {
      gridMajor: 1,
      gridMinor: null,
    };
    const span = camRef.current.half * 3.8;
    const minorStep = orthoExtents(camRef.current.half).stepMm / 1000;
    const majorStep = minorStep * 5;
    const addDraftGrid = (step: number, color: string, opacity: number) => {
      const gv: THREE.Vector3[] = [];
      for (let x = -span; x <= span; x += step) {
        gv.push(new THREE.Vector3(x, SLICE_Y, -span), new THREE.Vector3(x, SLICE_Y, span));
      }
      for (let z = -span; z <= span; z += step) {
        gv.push(new THREE.Vector3(-span, SLICE_Y, z), new THREE.Vector3(span, SLICE_Y, z));
      }
      if (!gv.length) return;
      const g = new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(gv),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
      );
      g.userData.draftingGrid = true;
      grp.add(g);
    };
    if (draftGridVisible && gridMajor !== null)
      addDraftGrid(majorStep, readPlanToken('--draft-grid-major', '#223042'), 0.45);
    if (draftGridVisible && gridMinor !== null)
      addDraftGrid(minorStep, readPlanToken('--draft-grid-minor', '#1a2738'), 0.25);

    // FED-04 — render imported DXF linework as a desaturated grey underlay
    // BEFORE the element-render loop so authored geometry sits on top.
    for (let i = grp.children.length - 1; i >= 0; i--) {
      const ch = grp.children[i]!;
      if ((ch.userData as { dxfUnderlay?: unknown }).dxfUnderlay) grp.remove(ch);
    }
    const dxfLevelId = displayLevelId || activeLevelResolvedId;
    const dxfUnderlays = selectDxfUnderlaysForLevel(elementsById, dxfLevelId || undefined);
    const activePlanView = activePlanViewId ? elementsById[activePlanViewId] : undefined;
    const dxfViewOverrides =
      activePlanView?.kind === 'plan_view'
        ? ((activePlanView.categoryOverrides ?? {}) as Record<string, CategoryOverride>)
        : {};
    for (const link of dxfUnderlays) {
      if (!link.linework || link.linework.length === 0) continue;
      const dxfOverride = dxfViewOverrides[dxfViewOverrideKey(link.id)];
      if (!isDxfLinkVisibleInView(link, dxfOverride)) continue;
      const transform = makeDxfLinkTransform(link, elementsById);
      const project = (xMm: number, yMm: number): THREE.Vector3 => {
        const p = transform({ xMm, yMm });
        return new THREE.Vector3(p.xMm / 1000, SLICE_Y - 0.001, p.yMm / 1000);
      };
      const style = resolveDxfUnderlayStyle(link, dxfOverride);
      const makeMat = (color: string) =>
        new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity: style.opacity,
          linewidth: 1,
        });
      const segmentGroups = new Map<string, THREE.Vector3[]>();
      const pushSegment = (color: string, a: THREE.Vector3, b: THREE.Vector3): void => {
        const group = segmentGroups.get(color) ?? [];
        group.push(a, b);
        segmentGroups.set(color, group);
      };
      const pushPrimSegment = (
        prim: (typeof link.linework)[number],
        a: THREE.Vector3,
        b: THREE.Vector3,
      ): void => {
        pushSegment(resolveDxfPrimitiveColor(link, prim, style), a, b);
      };
      const mat = new THREE.LineBasicMaterial({
        color: style.color,
        transparent: true,
        opacity: style.opacity,
        linewidth: 1,
      });
      const segments: THREE.Vector3[] = [];
      for (const prim of link.linework) {
        if (isDxfLayerHidden(link, prim, dxfOverride)) continue;
        if (prim.kind === 'line') {
          const a = project(prim.start.xMm, prim.start.yMm);
          const b = project(prim.end.xMm, prim.end.yMm);
          segments.push(a, b);
          pushPrimSegment(prim, a, b);
        } else if (prim.kind === 'polyline') {
          if (prim.points.length < 2) continue;
          for (let i = 0; i < prim.points.length - 1; i++) {
            const a = project(prim.points[i]!.xMm, prim.points[i]!.yMm);
            const b = project(prim.points[i + 1]!.xMm, prim.points[i + 1]!.yMm);
            segments.push(a, b);
            pushPrimSegment(prim, a, b);
          }
          if (prim.closed) {
            const lastIdx = prim.points.length - 1;
            const a = project(prim.points[lastIdx]!.xMm, prim.points[lastIdx]!.yMm);
            const b = project(prim.points[0]!.xMm, prim.points[0]!.yMm);
            segments.push(a, b);
            pushPrimSegment(prim, a, b);
          }
        } else if (prim.kind === 'arc') {
          const start = prim.startDeg;
          let end = prim.endDeg;
          if (end < start) end += 360;
          const sweep = Math.max(0.0001, end - start);
          const steps = Math.max(2, Math.ceil(sweep / 3));
          for (let i = 0; i < steps; i++) {
            const t0 = ((start + (sweep * i) / steps) * Math.PI) / 180;
            const t1 = ((start + (sweep * (i + 1)) / steps) * Math.PI) / 180;
            const a = project(
              prim.center.xMm + prim.radiusMm * Math.cos(t0),
              prim.center.yMm + prim.radiusMm * Math.sin(t0),
            );
            const b = project(
              prim.center.xMm + prim.radiusMm * Math.cos(t1),
              prim.center.yMm + prim.radiusMm * Math.sin(t1),
            );
            segments.push(a, b);
            pushPrimSegment(prim, a, b);
          }
        }
      }
      if (segments.length === 0) continue;
      if (style.colorMode === 'native') {
        for (const [color, colorSegments] of segmentGroups) {
          if (colorSegments.length === 0) continue;
          const geom = new THREE.BufferGeometry().setFromPoints(colorSegments);
          const lineSeg = new THREE.LineSegments(geom, makeMat(color));
          lineSeg.userData.dxfUnderlay = true;
          lineSeg.userData.bimPickId = link.id;
          grp.add(lineSeg);
        }
      } else {
        const geom = new THREE.BufferGeometry().setFromPoints(segments);
        const lineSeg = new THREE.LineSegments(geom, mat);
        lineSeg.userData.dxfUnderlay = true;
        lineSeg.userData.bimPickId = link.id;
        grp.add(lineSeg);
      }
    }

    // KRN-10 — render masking regions hosted on the active plan view. These
    // are opaque 2D polygons that occlude underlying linework but sit *below*
    // detail components / dimensions / tags so annotations stay visible.
    for (let i = grp.children.length - 1; i >= 0; i--) {
      const ch = grp.children[i]!;
      if ((ch.userData as { maskingRegion?: unknown }).maskingRegion) grp.remove(ch);
    }
    if (activePlanViewId) {
      const maskingPrims = extractMaskingRegionPrimitives(elementsById, activePlanViewId);
      for (const m of maskingPrims) {
        if (m.boundaryMm.length < 3) continue;
        const shape = new THREE.Shape();
        shape.moveTo(m.boundaryMm[0]!.xMm / 1000, m.boundaryMm[0]!.yMm / 1000);
        for (let i = 1; i < m.boundaryMm.length; i++) {
          shape.lineTo(m.boundaryMm[i]!.xMm / 1000, m.boundaryMm[i]!.yMm / 1000);
        }
        shape.closePath();
        for (const voidLoop of m.voidBoundariesMm) {
          if (voidLoop.length < 3) continue;
          const hole = new THREE.Path();
          hole.moveTo(voidLoop[0]!.xMm / 1000, voidLoop[0]!.yMm / 1000);
          for (let i = 1; i < voidLoop.length; i++) {
            hole.lineTo(voidLoop[i]!.xMm / 1000, voidLoop[i]!.yMm / 1000);
          }
          hole.closePath();
          shape.holes.push(hole);
        }
        const geom = new THREE.ShapeGeometry(shape);
        geom.rotateX(-Math.PI / 2);
        // Sit just above element wires (SLICE_Y) but below detail components
        // (which start at SLICE_Y + 0.003). Opaque — that's the whole point.
        geom.translate(0, SLICE_Y + 0.0015, 0);
        const fill = new THREE.Mesh(
          geom,
          new THREE.MeshBasicMaterial({
            color: m.fillColor,
            transparent: false,
            opacity: 1.0,
            side: THREE.DoubleSide,
          }),
        );
        fill.userData.maskingRegion = true;
        fill.userData.bimPickId = m.id;
        grp.add(fill);
      }
    }

    // KRN-V3-06 — render plan region boundaries as thin dashed witness lines.
    for (let i = grp.children.length - 1; i >= 0; i--) {
      const ch = grp.children[i]!;
      if ((ch.userData as { planRegion?: unknown }).planRegion) grp.remove(ch);
    }
    const planRegionLevelId = displayLevelId || activeLevelResolvedId;
    if (planRegionLevelId) {
      const witnessColor = readPlanToken('--draft-witness', '#64748b');
      const regionOverlays = extractPlanRegionOverlays(elementsById, planRegionLevelId);
      for (const r of regionOverlays) {
        if (r.outlineMm.length < 3) continue;
        const rPts = r.outlineMm.map(
          (pt) => new THREE.Vector3(pt.xMm / 1000, SLICE_Y + 0.003, pt.yMm / 1000),
        );
        rPts.push(rPts[0]!.clone());
        const rGeom = new THREE.BufferGeometry().setFromPoints(rPts);
        const rLine = new THREE.Line(
          rGeom,
          new THREE.LineDashedMaterial({
            color: witnessColor,
            dashSize: 0.12,
            gapSize: 0.06,
            linewidth: 1,
          }),
        );
        rLine.computeLineDistances();
        rLine.userData.planRegion = true;
        rLine.userData.bimPickId = r.id;
        grp.add(rLine);
      }
    }

    // F-098 — render area boundaries only in dedicated Area Plan views, filtered
    // by Area Plan scheme.
    for (let i = grp.children.length - 1; i >= 0; i--) {
      const ch = grp.children[i]!;
      if ((ch.userData as { areaElement?: unknown }).areaElement) grp.remove(ch);
    }
    const activeAreaPlan = activePlanViewId ? elementsById[activePlanViewId] : null;
    const areaPlanScheme =
      activeAreaPlan?.kind === 'plan_view' && activeAreaPlan.planViewSubtype === 'area_plan'
        ? (activeAreaPlan.areaScheme ?? 'gross_building')
        : undefined;
    const areaLevelId =
      activeAreaPlan?.kind === 'plan_view' && activeAreaPlan.planViewSubtype === 'area_plan'
        ? activeAreaPlan.levelId
        : undefined;
    if (
      areaLevelId &&
      areaPlanScheme &&
      (!display.hiddenSemanticKinds.has('area_boundary') || revealHiddenMode)
    ) {
      const areaPrims = extractAreaPrimitives(elementsById, areaLevelId, areaPlanScheme);
      const areaCategoryReveal =
        revealHiddenMode && display.hiddenSemanticKinds.has('area_boundary');
      for (const a of areaPrims) {
        // F-102: per-element hide — skip individually hidden areas in normal mode.
        if (display.hiddenElementIds.has(a.id) && !revealHiddenMode) continue;
        const areaBoundaryReveal =
          areaCategoryReveal || (revealHiddenMode && display.hiddenElementIds.has(a.id));
        if (a.boundaryMm.length >= 3) {
          const strokePts = a.boundaryMm.map(
            (pt) => new THREE.Vector3(pt.xMm / 1000, SLICE_Y + 0.0028, pt.yMm / 1000),
          );
          strokePts.push(strokePts[0]!.clone());
          const sgeom = new THREE.BufferGeometry().setFromPoints(strokePts);
          const sline = new THREE.Line(
            sgeom,
            new THREE.LineDashedMaterial({
              color: areaBoundaryReveal ? '#ff00ff' : '#d2363b',
              dashSize: 0.18,
              gapSize: 0.08,
              linewidth: 2,
            }),
          );
          sline.computeLineDistances();
          sline.userData.areaElement = true;
          sline.userData.bimPickId = a.id;
          grp.add(sline);
        }
        grp.add(
          createPlanTextSprite({
            text: a.tagLabel,
            color: areaBoundaryReveal ? '#ff00ff' : '#d2363b',
            textX: 128,
            textAlign: 'center',
            scaleX: 2.4,
            scaleY: 0.6,
            xMm: a.centroidMm.xMm,
            yMm: a.centroidMm.yMm,
            sliceY: SLICE_Y + 0.012,
            pickId: a.id,
            userData: { areaElement: true },
          }),
        );
      }
    }

    // FED-03 — render drift badges (yellow triangles) for elements whose
    // `monitorSource` has flipped to drifted. Sit above the wire-driven
    // meshes so the badge sticks to its anchor when the user pans/zooms.
    for (let i = grp.children.length - 1; i >= 0; i--) {
      const ch = grp.children[i]!;
      if ((ch.userData as { driftBadge?: unknown }).driftBadge) grp.remove(ch);
    }
    const driftedElems = selectDriftedElements(elementsById);
    for (const elem of driftedElems) {
      // Skip drifted elements whose plan-position can't be derived (e.g.
      // a `level` row — the inspector banner remains the entry point).
      const anchor = elementBadgeAnchorMm(elem);
      if (!anchor) continue;
      const badgeTexture = new THREE.CanvasTexture(buildDriftBadgeCanvas(64));
      badgeTexture.minFilter = THREE.LinearFilter;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: badgeTexture, transparent: true, depthTest: false }),
      );
      // 0.32m on plan ≈ 16px at the canonical zoom level.
      sprite.scale.set(0.32, 0.32, 1);
      sprite.position.set(anchor.xMm / 1000, SLICE_Y + 0.02, anchor.yMm / 1000);
      sprite.userData.driftBadge = true;
      sprite.userData.bimPickId = elem.id;
      sprite.userData.driftTooltip = driftBadgeTooltip(elem);
      grp.add(sprite);
    }

    // ANN-01 — render detail_line / detail_region / text_note hosted on the
    // active plan view. These are 2D-only annotations and live above the
    // wire-driven element meshes.
    for (let i = grp.children.length - 1; i >= 0; i--) {
      const ch = grp.children[i]!;
      if ((ch.userData as { detailComponent?: unknown }).detailComponent) grp.remove(ch);
    }
    if (activePlanViewId) {
      const detailPrims = extractDetailComponentPrimitives(elementsById, activePlanViewId);
      for (const p of detailPrims) {
        // F-102: per-element hide — skip individually hidden elements in normal mode.
        if (display.hiddenElementIds.has(p.id) && !revealHiddenMode) continue;
        if (p.kind === 'detail_line') {
          if (display.hiddenSemanticKinds.has('detail_line') && !revealHiddenMode) continue;
          const detailLineReveal =
            (revealHiddenMode && display.hiddenSemanticKinds.has('detail_line')) ||
            (revealHiddenMode && display.hiddenElementIds.has(p.id));
          const detailLineColor = detailLineReveal ? '#ff00ff' : p.colour;
          const pts = p.pointsMm.map(
            (pt) => new THREE.Vector3(pt.xMm / 1000, SLICE_Y + 0.004, pt.yMm / 1000),
          );
          const geom = new THREE.BufferGeometry().setFromPoints(pts);
          const mat =
            p.style === 'dashed' || p.style === 'dotted'
              ? new THREE.LineDashedMaterial({
                  color: detailLineColor,
                  dashSize: p.style === 'dotted' ? 0.05 : 0.2,
                  gapSize: p.style === 'dotted' ? 0.05 : 0.1,
                  linewidth: p.strokeMm,
                })
              : new THREE.LineBasicMaterial({ color: detailLineColor, linewidth: p.strokeMm });
          const line = new THREE.Line(geom, mat);
          if (p.style !== 'solid') line.computeLineDistances();
          line.userData.detailComponent = true;
          line.userData.bimPickId = p.id;
          grp.add(line);
        } else if (p.kind === 'detail_region') {
          const shape = new THREE.Shape();
          if (p.boundaryMm.length >= 3) {
            shape.moveTo(p.boundaryMm[0]!.xMm / 1000, p.boundaryMm[0]!.yMm / 1000);
            for (let i = 1; i < p.boundaryMm.length; i++) {
              shape.lineTo(p.boundaryMm[i]!.xMm / 1000, p.boundaryMm[i]!.yMm / 1000);
            }
            shape.closePath();
          }
          const geom = new THREE.ShapeGeometry(shape);
          // ShapeGeometry produces the polygon in XY plane; rotate it onto
          // the plan slice (XZ) so it sits flat with the rest of the canvas.
          geom.rotateX(-Math.PI / 2);
          geom.translate(0, SLICE_Y + 0.003, 0);
          const fill = new THREE.Mesh(
            geom,
            new THREE.MeshBasicMaterial({
              color: p.fillColour,
              transparent: true,
              opacity: p.fillPattern === 'solid' ? 1.0 : 0.55,
              side: THREE.DoubleSide,
            }),
          );
          fill.userData.detailComponent = true;
          fill.userData.bimPickId = p.id;
          grp.add(fill);
          // Boundary stroke
          if (p.strokeMm > 0) {
            const strokePts = p.boundaryMm.map(
              (pt) => new THREE.Vector3(pt.xMm / 1000, SLICE_Y + 0.0035, pt.yMm / 1000),
            );
            if (strokePts.length > 0) strokePts.push(strokePts[0]!.clone());
            const sgeom = new THREE.BufferGeometry().setFromPoints(strokePts);
            const sline = new THREE.Line(
              sgeom,
              new THREE.LineBasicMaterial({ color: p.strokeColour, linewidth: p.strokeMm }),
            );
            sline.userData.detailComponent = true;
            grp.add(sline);
          }
        } else if (p.kind === 'text_note') {
          if (display.hiddenSemanticKinds.has('text_note') && !revealHiddenMode) continue;
          const textNoteReveal =
            (revealHiddenMode && display.hiddenSemanticKinds.has('text_note')) ||
            (revealHiddenMode && display.hiddenElementIds.has(p.id));
          // Render the text via canvas-texture sprite. Using the existing
          // sprite pattern is heavier than necessary for a small note —
          // we draw a 1×1 m sprite scaled to the text size.
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 64;
          const ctx2 = canvas.getContext('2d');
          if (ctx2) {
            const fillColor = textNoteReveal ? '#ff00ff' : (p.colorHex ?? p.colour);
            const fontStyle = p.italic ? 'italic ' : '';
            const fontWeight = p.bold ? 'bold ' : '';
            const fontFace = p.fontFamily ?? 'sans-serif';
            const fontPx = Math.max(12, Math.round(48));
            ctx2.font = `${fontStyle}${fontWeight}${fontPx}px ${fontFace}`;
            ctx2.fillStyle = fillColor;
            ctx2.textAlign = p.horizontalAlign ?? 'left';
            ctx2.textBaseline = 'top';
            const textX =
              p.horizontalAlign === 'center' ? 128 : p.horizontalAlign === 'right' ? 252 : 4;
            ctx2.fillText(p.text, textX, 4);
            if (p.underline) {
              const metrics = ctx2.measureText(p.text);
              const lineY = 4 + fontPx + 2;
              ctx2.strokeStyle = fillColor;
              ctx2.lineWidth = Math.max(1, fontPx / 24);
              ctx2.beginPath();
              ctx2.moveTo(textX, lineY);
              ctx2.lineTo(textX + metrics.width, lineY);
              ctx2.stroke();
            }
          }
          const tex = new THREE.CanvasTexture(canvas);
          tex.minFilter = THREE.LinearFilter;
          const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
          const sprite = new THREE.Sprite(spriteMat);
          // Scale: fontSize in mm → metres → 4×height for legibility.
          const heightM = (p.fontSizeMm / 1000) * 1.4;
          sprite.scale.set(heightM * (canvas.width / canvas.height), heightM, 1);
          sprite.position.set(p.positionMm.xMm / 1000, SLICE_Y + 0.01, p.positionMm.yMm / 1000);
          sprite.userData.detailComponent = true;
          sprite.userData.bimPickId = p.id;
          grp.add(sprite);
        } else if (p.kind === 'material_tag') {
          // ANN-12 — material tag with optional leader line and tag box
          const labelText = p.textOverride ?? 'Material';
          grp.add(
            createPlanTextSprite({
              text: labelText,
              color: p.colour,
              font: '26px sans-serif',
              textX: 8,
              scaleX: 0.3 * (256 / 64),
              scaleY: 0.3,
              xMm: p.positionMm.xMm,
              yMm: p.positionMm.yMm,
              sliceY: SLICE_Y + 0.01,
              pickId: p.id,
              userData: { detailComponent: true },
              drawBeforeText: (ctx) => {
                ctx.strokeStyle = p.colour;
                ctx.lineWidth = 2;
                ctx.strokeRect(1, 1, 254, 62);
              },
            }),
          );
          // Draw leader line from tag position to leaderEndMm (if set)
          if (p.leaderEndMm) {
            const leader = tagLeaderLineThree(p.leaderEndMm, p.positionMm, SLICE_Y + 0.002);
            leader.userData.detailComponent = true;
            grp.add(leader);
          }
        } else if (
          p.kind === 'annotation_symbol' ||
          p.kind === 'spot_elevation' ||
          p.kind === 'spot_coordinate' ||
          p.kind === 'spot_slope'
        ) {
          const lt =
            p.kind === 'spot_elevation'
              ? `${p.prefix}${(p.elevationMm / 1000).toFixed(3)}${p.suffix}`
              : p.kind === 'spot_coordinate'
                ? `N${(p.northMm / 1000).toFixed(2)} E${(p.eastMm / 1000).toFixed(2)}`
                : p.kind === 'spot_slope'
                  ? `${p.slopePct.toFixed(1)}%`
                  : p.symbolType;
          const aPos = 'positionMm' in p ? p.positionMm : { xMm: 0, yMm: 0 };
          grp.add(
            createPlanTextSprite({
              text: lt,
              color: p.colour,
              scaleX: 0.3 * (256 / 64),
              scaleY: 0.3,
              xMm: aPos.xMm,
              yMm: aPos.yMm,
              sliceY: SLICE_Y + 0.01,
              pickId: p.id,
              userData: { detailComponent: true },
            }),
          );
        } else if (p.kind === 'radial_dimension' || p.kind === 'diameter_dimension') {
          const rMat = new THREE.LineBasicMaterial({ color: p.colour });
          const rLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(p.arcPointMm.xMm / 1000, SLICE_Y + 0.01, p.arcPointMm.yMm / 1000),
              new THREE.Vector3(p.centerMm.xMm / 1000, SLICE_Y + 0.01, p.centerMm.yMm / 1000),
            ]),
            rMat,
          );
          rLine.userData.detailComponent = true;
          rLine.userData.bimPickId = p.id;
          grp.add(rLine);
          const dx = p.arcPointMm.xMm - p.centerMm.xMm,
            dy = p.arcPointMm.yMm - p.centerMm.yMm;
          const rMm = Math.sqrt(dx * dx + dy * dy);
          const rLbl =
            p.kind === 'diameter_dimension' ? `ø${(rMm * 2).toFixed(0)}` : `R${rMm.toFixed(0)}`;
          grp.add(
            createPlanTextSprite({
              text: rLbl,
              color: p.colour,
              width: 192,
              scaleX: 0.25 * (192 / 64),
              scaleY: 0.25,
              xMm: (p.arcPointMm.xMm + p.centerMm.xMm) / 2,
              yMm: (p.arcPointMm.yMm + p.centerMm.yMm) / 2,
              sliceY: SLICE_Y + 0.01,
              pickId: p.id,
              userData: { detailComponent: true },
            }),
          );
        } else if (p.kind === 'arc_length_dimension') {
          const aldOffsetMm = p.offsetMm ?? 200;
          const aldInnerRadM = p.radiusMm / 1000;
          const aldDimRadM = (p.radiusMm + aldOffsetMm) / 1000;
          const aldOuterRadM = aldDimRadM + 50 / 1000;
          const aldCx = p.centerMm.xMm / 1000;
          const aldCz = p.centerMm.yMm / 1000;
          const aldColour = p.colour;
          const aldLineMat = new THREE.LineBasicMaterial({ color: aldColour });

          // Dimension arc (N=32 segments)
          const ALD_N = 32;
          const aldArcPts: THREE.Vector3[] = [];
          for (let i = 0; i <= ALD_N; i++) {
            const angRad = THREE.MathUtils.degToRad(
              p.startAngleDeg + ((p.endAngleDeg - p.startAngleDeg) * i) / ALD_N,
            );
            aldArcPts.push(
              new THREE.Vector3(
                aldCx + Math.cos(angRad) * aldDimRadM,
                SLICE_Y + 0.01,
                aldCz + Math.sin(angRad) * aldDimRadM,
              ),
            );
          }
          const aldArcGeom = new THREE.BufferGeometry().setFromPoints(aldArcPts);
          const aldArcLine = new THREE.Line(aldArcGeom, aldLineMat);
          aldArcLine.userData.detailComponent = true;
          aldArcLine.userData.bimPickId = p.id;
          grp.add(aldArcLine);

          // Extension lines at start and end angles
          [p.startAngleDeg, p.endAngleDeg].forEach((deg) => {
            const angRad = THREE.MathUtils.degToRad(deg);
            const cosA = Math.cos(angRad);
            const sinA = Math.sin(angRad);
            const extGeom = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(
                aldCx + cosA * aldInnerRadM,
                SLICE_Y + 0.01,
                aldCz + sinA * aldInnerRadM,
              ),
              new THREE.Vector3(
                aldCx + cosA * aldOuterRadM,
                SLICE_Y + 0.01,
                aldCz + sinA * aldOuterRadM,
              ),
            ]);
            const extLine = new THREE.Line(extGeom, aldLineMat);
            extLine.userData.detailComponent = true;
            extLine.userData.bimPickId = p.id;
            grp.add(extLine);
          });

          // Text label at midpoint of dimension arc
          const aldMidRad = THREE.MathUtils.degToRad((p.startAngleDeg + p.endAngleDeg) / 2);
          const arcLen = ((Math.abs(p.endAngleDeg - p.startAngleDeg) * Math.PI) / 180) * p.radiusMm;
          grp.add(
            createPlanTextSprite({
              text: `arc ${arcLen.toFixed(0)}`,
              color: aldColour,
              width: 192,
              scaleX: 0.25 * (192 / 64),
              scaleY: 0.25,
              xMm: (aldCx + Math.cos(aldMidRad) * aldDimRadM) * 1000,
              yMm: (aldCz + Math.sin(aldMidRad) * aldDimRadM) * 1000,
              sliceY: SLICE_Y + 0.015,
              pickId: p.id,
              userData: { detailComponent: true },
            }),
          );
        } else if (p.kind === 'angular_dimension') {
          const angM = new THREE.LineBasicMaterial({ color: p.colour });
          [
            [
              [p.vertexMm, p.rayAMm],
              [p.vertexMm, p.rayBMm],
            ],
          ]
            .flat()
            .forEach(([a, b], i) => {
              const l = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([
                  new THREE.Vector3(a.xMm / 1000, SLICE_Y + 0.01, a.yMm / 1000),
                  new THREE.Vector3(b.xMm / 1000, SLICE_Y + 0.01, b.yMm / 1000),
                ]),
                angM,
              );
              l.userData.detailComponent = true;
              l.userData.bimPickId = p.id;
              grp.add(l);
            });
          const aA = Math.atan2(p.rayAMm.yMm - p.vertexMm.yMm, p.rayAMm.xMm - p.vertexMm.xMm);
          const aB = Math.atan2(p.rayBMm.yMm - p.vertexMm.yMm, p.rayBMm.xMm - p.vertexMm.xMm);
          const angDeg = Math.abs(((aB - aA) * 180) / Math.PI);
          const mA = (aA + aB) / 2,
            aR = p.arcRadiusMm / 1000;
          grp.add(
            createPlanTextSprite({
              text: `${angDeg.toFixed(1)}°`,
              color: p.colour,
              width: 192,
              scaleX: 0.25 * (192 / 64),
              scaleY: 0.25,
              xMm: p.vertexMm.xMm + p.arcRadiusMm * Math.cos(mA),
              yMm: p.vertexMm.yMm + p.arcRadiusMm * Math.sin(mA),
              sliceY: SLICE_Y + 0.01,
              pickId: p.id,
              userData: { detailComponent: true },
            }),
          );
        } else if (p.kind === 'leader_text') {
          const ltMat = new THREE.LineBasicMaterial({ color: p.colour });
          const ltPts: THREE.Vector3[] = [];
          ltPts.push(
            new THREE.Vector3(p.anchorMm.xMm / 1000, SLICE_Y + 0.01, p.anchorMm.yMm / 1000),
          );
          if (p.elbowMm) {
            ltPts.push(
              new THREE.Vector3(p.elbowMm.xMm / 1000, SLICE_Y + 0.01, p.elbowMm.yMm / 1000),
            );
          }
          ltPts.push(new THREE.Vector3(p.textMm.xMm / 1000, SLICE_Y + 0.01, p.textMm.yMm / 1000));
          const ltLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ltPts), ltMat);
          ltLine.userData.detailComponent = true;
          ltLine.userData.bimPickId = p.id;
          grp.add(ltLine);
          grp.add(
            createPlanTextSprite({
              text: p.content,
              color: p.colour,
              scaleX: 0.3 * (256 / 64),
              scaleY: 0.3,
              xMm: p.textMm.xMm,
              yMm: p.textMm.yMm,
              sliceY: SLICE_Y + 0.01,
              pickId: p.id,
              userData: { detailComponent: true },
            }),
          );
        } else if (p.kind === 'revision_cloud' && p.boundaryMm.length >= 2) {
          const rcL = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(
              [...p.boundaryMm, p.boundaryMm[0]!].map(
                (v) => new THREE.Vector3(v.xMm / 1000, SLICE_Y + 0.01, v.yMm / 1000),
              ),
            ),
            new THREE.LineBasicMaterial({ color: p.colour }),
          );
          rcL.userData.detailComponent = true;
          rcL.userData.bimPickId = p.id;
          grp.add(rcL);
        } else if (p.kind === 'insulation_annotation') {
          const insL = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(p.startMm.xMm / 1000, SLICE_Y + 0.01, p.startMm.yMm / 1000),
              new THREE.Vector3(p.endMm.xMm / 1000, SLICE_Y + 0.01, p.endMm.yMm / 1000),
            ]),
            new THREE.LineBasicMaterial({ color: p.colour }),
          );
          insL.userData.detailComponent = true;
          insL.userData.bimPickId = p.id;
          grp.add(insL);
        }
      }
    }

    // ANN-01/F-006 — render manual Tag by Category annotations hosted on the
    // active view. Auto-generated room/opening labels are still controlled by
    // the view annotation hints above; placed tags are explicit elements.
    for (let i = grp.children.length - 1; i >= 0; i--) {
      const ch = grp.children[i]!;
      if ((ch.userData as { placedTag?: unknown }).placedTag) grp.remove(ch);
    }
    if (activePlanViewId && (!display.hiddenSemanticKinds.has('placed_tag') || revealHiddenMode)) {
      const placedTagReveal = revealHiddenMode && display.hiddenSemanticKinds.has('placed_tag');
      for (const tag of Object.values(elementsById)) {
        if (tag.kind !== 'placed_tag') continue;
        if (tag.hostViewId !== activePlanViewId) continue;
        if (display.hiddenElementIds.has(tag.id) && !revealHiddenMode) continue;
        const host = elementsById[tag.hostElementId];
        if (host && display.hiddenElementIds.has(host.id) && !revealHiddenMode) continue;
        const label = manualPlacedTagLabel(tag, elementsById);
        const sprite = planAnnotationLabelSprite(
          tag.positionMm.xMm / 1000,
          tag.positionMm.yMm / 1000,
          label,
          tag.id,
        );
        sprite.position.y = SLICE_Y + 0.012;
        sprite.userData.placedTag = true;
        sprite.userData.elementId = tag.id;
        if (tag.categoryKind === 'room') sprite.userData.placedTagKind = 'room';
        if (placedTagReveal || (revealHiddenMode && display.hiddenElementIds.has(tag.id))) {
          sprite.material.color.set('#ff00ff');
        }
        grp.add(sprite);
        if (tag.leaderEndMm) {
          const leader = tagLeaderLineThree(tag.leaderEndMm, tag.positionMm, SLICE_Y + 0.002);
          leader.userData.placedTag = true;
          grp.add(leader);
        }
      }
    }

    // PLN-02 — render dashed crop frame + 8 drag handles whenever a plan_view
    // has crop bounds and the frame is visible (cropRegionVisible || cropEnabled).
    // Removes the previous overlay first so the renderer never accumulates
    // stale frames during drag.
    if (cropOverlayRef.current) {
      grp.remove(cropOverlayRef.current);
      cropOverlayRef.current.traverse((c) => {
        if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose();
      });
      cropOverlayRef.current = null;
    }
    if (activeCropState && (activeCropState.cropRegionVisible || activeCropState.cropEnabled)) {
      const live = cropDragRef.current?.currentBounds;
      const minX = (live?.cropMinMm.xMm ?? activeCropState.cropMinMm.xMm) / 1000;
      const maxX = (live?.cropMaxMm.xMm ?? activeCropState.cropMaxMm.xMm) / 1000;
      const minY = (live?.cropMinMm.yMm ?? activeCropState.cropMinMm.yMm) / 1000;
      const maxY = (live?.cropMaxMm.yMm ?? activeCropState.cropMaxMm.yMm) / 1000;
      const overlay = new THREE.Group();
      overlay.userData.cropOverlay = true;
      const frameColor = readPlanToken('--draft-construction-blue', '#fcd34d');
      const framePts = [
        new THREE.Vector3(minX, SLICE_Y + 0.005, minY),
        new THREE.Vector3(maxX, SLICE_Y + 0.005, minY),
        new THREE.Vector3(maxX, SLICE_Y + 0.005, maxY),
        new THREE.Vector3(minX, SLICE_Y + 0.005, maxY),
        new THREE.Vector3(minX, SLICE_Y + 0.005, minY),
      ];
      const frameGeom = new THREE.BufferGeometry().setFromPoints(framePts);
      const frame = new THREE.Line(
        frameGeom,
        new THREE.LineDashedMaterial({
          color: frameColor,
          dashSize: 0.25,
          gapSize: 0.12,
          linewidth: 2,
        }),
      );
      frame.computeLineDistances();
      frame.userData.cropFrame = true;
      overlay.add(frame);
      // 8 handle dots at corners + edge midpoints (cx,cy in metres).
      const cxM = (minX + maxX) / 2;
      const cyM = (minY + maxY) / 2;
      const handleSizeM = Math.max(camRef.current.half * 0.012, 0.06);
      const handlePositions: Array<{ id: CropHandleId; x: number; y: number }> = [
        { id: 'corner-nw', x: minX, y: maxY },
        { id: 'corner-ne', x: maxX, y: maxY },
        { id: 'corner-sw', x: minX, y: minY },
        { id: 'corner-se', x: maxX, y: minY },
        { id: 'edge-n', x: cxM, y: maxY },
        { id: 'edge-e', x: maxX, y: cyM },
        { id: 'edge-s', x: cxM, y: minY },
        { id: 'edge-w', x: minX, y: cyM },
      ];
      for (const h of handlePositions) {
        const handle = new THREE.Mesh(
          new THREE.PlaneGeometry(handleSizeM, handleSizeM),
          new THREE.MeshBasicMaterial({ color: frameColor }),
        );
        handle.rotation.x = -Math.PI / 2;
        handle.position.set(h.x, SLICE_Y + 0.006, h.y);
        handle.userData.cropHandleId = h.id;
        overlay.add(handle);
      }
      grp.add(overlay);
      cropOverlayRef.current = overlay;
    }

    // PLN-02 — when cropEnabled, fade meshes whose source element falls
    // entirely outside the crop. We hide rather than remove so the rebuild
    // is incremental; rooms / dimensions are kept visible because they are
    // the most useful context, but per-element visibility uses the
    // pickId→element lookup below.
    if (activeCropState && activeCropState.cropEnabled) {
      const inside = (xMm: number, yMm: number) =>
        pointInsideCrop(activeCropState.cropMinMm, activeCropState.cropMaxMm, xMm, yMm);
      const elementInsideCrop = (el: Element): boolean => {
        if (el.kind === 'wall') {
          return inside(el.start.xMm, el.start.yMm) || inside(el.end.xMm, el.end.yMm);
        }
        if (el.kind === 'door' || el.kind === 'window') {
          const w = elementsById[el.wallId];
          if (w && w.kind === 'wall') {
            const mx = w.start.xMm + (w.end.xMm - w.start.xMm) * el.alongT;
            const my = w.start.yMm + (w.end.yMm - w.start.yMm) * el.alongT;
            return inside(mx, my);
          }
          return true;
        }
        if (el.kind === 'room' || el.kind === 'plan_region') {
          const o = el.outlineMm ?? [];
          if (!o.length) return true;
          let sx = 0,
            sy = 0;
          for (const p of o) {
            sx += p.xMm;
            sy += p.yMm;
          }
          return inside(sx / o.length, sy / o.length);
        }
        if (el.kind === 'grid_line') {
          return inside(el.start.xMm, el.start.yMm) || inside(el.end.xMm, el.end.yMm);
        }
        if (el.kind === 'dimension') {
          return inside(el.aMm.xMm, el.aMm.yMm) || inside(el.bMm.xMm, el.bMm.yMm);
        }
        return true;
      };
      grp.traverse((ch) => {
        const id = (ch.userData as { bimPickId?: string }).bimPickId;
        if (typeof id !== 'string') return;
        const target = elementsById[id];
        if (!target) return;
        ch.visible = elementInsideCrop(target);
      });
    }
  }, [
    mergedGraphicHints,
    mergedAnnotationHints,
    planTagFontScales,
    display.presentation,
    display.hiddenElementIds,
    display.hiddenSemanticKinds,
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
    joinedPairs,
  ]);

  // Column-at-grids: highlight selected grids + show intersection preview dots
  useEffect(() => {
    const grp = rootRef.current;
    if (!grp) return;

    const toRemove: THREE.Object3D[] = [];
    grp.traverse((ch) => {
      if ((ch.userData as { columnAtGridsHighlight?: unknown }).columnAtGridsHighlight)
        toRemove.push(ch);
    });
    for (const ch of toRemove) grp.remove(ch);

    if (planTool !== 'column-at-grids') return;

    const state = columnAtGridsStateRef.current;
    if (state.phase !== 'selecting') return;

    const { selectedGridIds } = state;
    const highlightGrp = new THREE.Group();
    highlightGrp.userData.columnAtGridsHighlight = true;

    const hovId = columnAtGridsHoverRef.current;
    if (hovId && !selectedGridIds.includes(hovId)) {
      const hel = elementsById[hovId];
      if (hel?.kind === 'grid_line') {
        const hpts = [
          new THREE.Vector3(hel.start.xMm / 1000, SLICE_Y + 0.01, hel.start.yMm / 1000),
          new THREE.Vector3(hel.end.xMm / 1000, SLICE_Y + 0.01, hel.end.yMm / 1000),
        ];
        highlightGrp.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(hpts),
            new THREE.LineBasicMaterial({ color: '#88aaff', linewidth: 2 }),
          ),
        );
      }
    }

    for (const id of selectedGridIds) {
      const el = elementsById[id];
      if (el?.kind !== 'grid_line') continue;
      const pts = [
        new THREE.Vector3(el.start.xMm / 1000, SLICE_Y + 0.01, el.start.yMm / 1000),
        new THREE.Vector3(el.end.xMm / 1000, SLICE_Y + 0.01, el.end.yMm / 1000),
      ];
      highlightGrp.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: '#0055cc', linewidth: 3 }),
        ),
      );
    }

    if (selectedGridIds.length >= 2) {
      const selectedGridElems = selectedGridIds
        .map((id) => elementsById[id])
        .filter((e): e is Extract<Element, { kind: 'grid_line' }> => e?.kind === 'grid_line');
      const positions = columnPositionsAtGridIntersections(selectedGridElems);
      for (const pt of positions) {
        const dotGeo = new THREE.CircleGeometry(0.15, 16);
        const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: '#0055cc' }));
        dot.position.set(pt.xMm / 1000, SLICE_Y + 0.011, pt.yMm / 1000);
        dot.rotation.x = -Math.PI / 2;
        dot.userData.columnAtGridsPreview = true;
        highlightGrp.add(dot);
      }
    }

    grp.add(highlightGrp);
  }, [planTool, geomEpoch, elementsById]);

  // Auto-fit camera when a level's elements first become available, and on
  // every level switch — so the model always fills the canvas on open.
  useEffect(() => {
    const lvl = activeLevelResolvedId;
    if (lastAutoFitLevelRef.current === lvl) return;
    const hasGeo = Object.values(elementsById).some(
      (el) =>
        (el.kind === 'wall' || el.kind === 'floor' || el.kind === 'room') &&
        'levelId' in el &&
        (el as { levelId?: string }).levelId === lvl,
    );
    if (!hasGeo) return;
    lastAutoFitLevelRef.current = lvl;
    handleFitToView();
  }, [activeLevelResolvedId, elementsById, handleFitToView]);

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

    const redrawSeg = (a: THREE.Vector3, b: THREE.Vector3) => {
      if (previewRef.current) {
        grp.remove(previewRef.current);
        previewRef.current.geometry.dispose();
      }
      previewRef.current = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([a, b]),
        new THREE.LineBasicMaterial({
          color: readPlanToken('--draft-construction-blue', '#fcd34d'),
        }),
      );
      grp.add(previewRef.current);
    };

    const redrawPreviewRectMm = (x0Mm: number, y0Mm: number, x1Mm: number, y1Mm: number) => {
      const xMn = Math.min(x0Mm, x1Mm) / 1000;
      const xMx = Math.max(x0Mm, x1Mm) / 1000;
      const zMn = Math.min(y0Mm, y1Mm) / 1000;
      const zMx = Math.max(y0Mm, y1Mm) / 1000;
      const pts = [
        new THREE.Vector3(xMn, SLICE_Y, zMn),
        new THREE.Vector3(xMx, SLICE_Y, zMn),
        new THREE.Vector3(xMx, SLICE_Y, zMx),
        new THREE.Vector3(xMn, SLICE_Y, zMx),
        new THREE.Vector3(xMn, SLICE_Y, zMn),
      ];
      if (previewRef.current) {
        grp.remove(previewRef.current);
        previewRef.current.geometry.dispose();
      }
      previewRef.current = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: readPlanToken('--cat-room', '#a7f3d0') }),
      );
      grp.add(previewRef.current);
    };

    const redrawAreaBoundaryPreviewMm = (
      verts: Array<{ xMm: number; yMm: number }>,
      cursorMm?: { xMm: number; yMm: number },
    ) => {
      if (previewRef.current) {
        grp.remove(previewRef.current);
        previewRef.current.geometry.dispose();
      }
      const ptsMm = cursorMm ? [...verts, cursorMm] : [...verts];
      if (ptsMm.length === 0) {
        previewRef.current = null;
        return;
      }
      if (ptsMm.length >= 3 && cursorMm && areaBoundaryCanClose(verts, cursorMm)) {
        ptsMm[ptsMm.length - 1] = verts[0]!;
      }
      const pts = ptsMm.map((pt) => new THREE.Vector3(pt.xMm / 1000, SLICE_Y, pt.yMm / 1000));
      const mat = new THREE.LineDashedMaterial({
        color: readPlanToken('--draft-construction-blue', '#fcd34d'),
        dashSize: 0.22,
        gapSize: 0.1,
      });
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
      line.computeLineDistances();
      previewRef.current = line;
      grp.add(line);
    };

    const clearPreview = () => {
      if (previewRef.current) {
        grp.remove(previewRef.current);
        previewRef.current.geometry.dispose();
        previewRef.current = null;
      }
    };

    const activeAreaPlanContext = () =>
      areaPlanPlacementContext(elementsById, activePlanViewId, lvlId);

    const areaSnapPoint = (pointMm: { xMm: number; yMm: number }) => {
      const ctx = activeAreaPlanContext();
      if (!ctx) return pointMm;
      const wallsForAreaSnap = Object.values(elementsById)
        .filter(
          (el): el is Extract<Element, { kind: 'wall' }> =>
            el.kind === 'wall' && el.levelId === ctx.levelId,
        )
        .map((w) => ({
          id: w.id,
          startMm: { xMm: w.start.xMm, yMm: w.start.yMm },
          endMm: { xMm: w.end.xMm, yMm: w.end.yMm },
          thicknessMm: w.thicknessMm,
        }));
      return snapPointToNearestWallFaceMm(wallsForAreaSnap, pointMm) ?? pointMm;
    };

    const wallPickToleranceMm = () => {
      const rect = rnd.domElement.getBoundingClientRect();
      return Math.min(
        350,
        Math.max(120, (10 / Math.max(1, rect.height)) * 2 * camRef.current.half * 1000),
      );
    };

    const dxfHitAt = (pointMm: { xMm: number; yMm: number }, toleranceMm: number) => {
      const liveElementsById = useBimStore.getState().elementsById;
      const dxfLevelId = displayLevelId || activeLevelResolvedId;
      const dxfUnderlays = selectDxfUnderlaysForLevel(liveElementsById, dxfLevelId || undefined);
      if (dxfUnderlays.length === 0) return null;
      const activePlanView = activePlanViewId ? liveElementsById[activePlanViewId] : undefined;
      const viewOverrides =
        activePlanView?.kind === 'plan_view'
          ? ((activePlanView.categoryOverrides ?? {}) as Record<string, CategoryOverride>)
          : {};
      return queryDxfPrimitiveAtPoint(dxfUnderlays, pointMm, {
        toleranceMm,
        elementsById: liveElementsById,
        viewOverridesByLinkId: Object.fromEntries(
          dxfUnderlays.map((link) => [link.id, viewOverrides[dxfViewOverrideKey(link.id)]]),
        ),
      });
    };

    const pickedWallLineAt = (
      pointMm: { xMm: number; yMm: number },
      toleranceMm: number,
    ): PickedWallLine | null => {
      const liveElementsById = useBimStore.getState().elementsById;
      const pickLevelId = displayLevelId || activeLevelResolvedId || lvlId;
      return (
        pickFloorBoundaryEdgeForWall(liveElementsById, pickLevelId, pointMm, toleranceMm) ??
        pickDxfLineForWall(dxfHitAt(pointMm, toleranceMm), pointMm, liveElementsById)
      );
    };

    const commitAreaBoundary = (boundaryMm: Array<{ xMm: number; yMm: number }>) => {
      const ctx = activeAreaPlanContext();
      if (!ctx || !ctx.levelId || boundaryMm.length < 3) return false;
      onSemanticCommand({
        type: 'createArea',
        name: 'Area',
        levelId: ctx.levelId,
        boundaryMm,
        ruleSet: ctx.ruleSet,
        areaScheme: ctx.areaScheme,
        applyAreaRules: useBimStore.getState().applyAreaRules,
      });
      draftRef.current = undefined;
      clearPreview();
      bumpGeom((x) => x + 1);
      return true;
    };

    const clearMarqueeLine = () => {
      disposeMarqueePreview(grp, {
        line: marqueeLineRef.current,
        fill: marqueeFillRef.current,
      });
      marqueeLineRef.current = null;
      marqueeFillRef.current = null;
    };

    const redrawMarqueeRect = (
      x0Mm: number,
      y0Mm: number,
      x1Mm: number,
      y1Mm: number,
      crossing: boolean,
    ) => {
      clearMarqueeLine();
      const { line, fill } = buildMarqueePreview(x0Mm, y0Mm, x1Mm, y1Mm, crossing);
      marqueeLineRef.current = line;
      grp.add(line);
      marqueeFillRef.current = fill;
      grp.add(fill);
    };

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
      // PLN-02 — live crop frame drag update
      if (cropDragRef.current) {
        const ptr = rayToPlanMm(rnd, camNow, ev.clientX, ev.clientY);
        if (ptr) {
          const dx = ptr.xMm - cropDragRef.current.startPointerMm.xMm;
          const dy = ptr.yMm - cropDragRef.current.startPointerMm.yMm;
          cropDragRef.current.currentBounds = applyCropHandleDrag(
            cropDragRef.current.handle,
            cropDragRef.current.startBounds,
            dx,
            dy,
          );
          // Trigger a re-render of the overlay (cheap — only rebuilds frame).
          bumpGeom((x) => x + 1);
          skipClickRef.current = true;
        }
        return;
      }
      // §1.6.10: live update for crop grip drag (getCropRegionGrips / applyCropGripDrag)
      if (cropGripDragRef.current) {
        const ptr = rayToPlanMm(rnd, camNow, ev.clientX, ev.clientY);
        if (ptr) {
          const deltaMm = {
            xMm: ptr.xMm - cropGripDragRef.current.startPlanPt.xMm,
            yMm: ptr.yMm - cropGripDragRef.current.startPlanPt.yMm,
          };
          const newCrop = applyCropGripDrag(
            cropGripDragRef.current.cropAtStart,
            cropGripDragRef.current.gripId,
            deltaMm,
          );
          void onSemanticCommand({
            type: 'updateCropRegion',
            planViewId: cropGripDragRef.current.planViewId,
            cropRegionMm: newCrop,
          });
          skipClickRef.current = true;
        }
        return;
      }
      if (dragRef.current.dragging) {
        const rr = rayToPlanMm(rnd, camNow, ev.clientX, ev.clientY);
        if (!rr) return;
        camRef.current.camX = dragRef.current.camX - (rr.xMm - dragRef.current.lastXmm) / 1000;
        camRef.current.camZ = dragRef.current.camZ - (rr.yMm - dragRef.current.lastZmm) / 1000;
        resizeCam();
        skipClickRef.current = true;
        return;
      }
      if (marqueeRef.current.active) {
        const rr = rayToPlanMm(rnd, camNow, ev.clientX, ev.clientY);
        if (rr) {
          const dir = rr.xMm > marqueeRef.current.sx ? 'left-to-right' : 'right-to-left';
          marqueeRef.current.direction = dir;
          marqueeRef.current.ex = rr.xMm;
          marqueeRef.current.ey = rr.yMm;
          redrawMarqueeRect(
            marqueeRef.current.sx,
            marqueeRef.current.sy,
            rr.xMm,
            rr.yMm,
            dir === 'right-to-left',
          );
          skipClickRef.current = true;
        }
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

      // B02 — snap candidates: endpoint, midpoint, and wall-wall intersection
      const isDrawing = planTool != null && planTool !== 'select' && planTool !== 'query';
      if (isDrawing) {
        const pixH = rnd.domElement.clientHeight || 1;
        const toleranceMm = (12 / pixH) * 2 * camRef.current.half * 1000;
        const candidates: SnapCandidate[] = [];
        const levelWalls = Object.values(elementsById).filter(
          (el): el is Extract<typeof el, { kind: 'wall' }> =>
            el.kind === 'wall' && (!displayLevelId || el.levelId === displayLevelId),
        );
        for (const el of levelWalls) {
          if (Math.hypot(el.start.xMm - v.xMm, el.start.yMm - v.yMm) < toleranceMm)
            candidates.push({ mode: 'endpoint', xMm: el.start.xMm, yMm: el.start.yMm });
          if (Math.hypot(el.end.xMm - v.xMm, el.end.yMm - v.yMm) < toleranceMm)
            candidates.push({ mode: 'endpoint', xMm: el.end.xMm, yMm: el.end.yMm });
          const midXMm = (el.start.xMm + el.end.xMm) / 2;
          const midYMm = (el.start.yMm + el.end.yMm) / 2;
          if (Math.hypot(midXMm - v.xMm, midYMm - v.yMm) < toleranceMm)
            candidates.push({ mode: 'midpoint', xMm: midXMm, yMm: midYMm });
        }
        // B02 — wall-wall intersection snaps (spec §14.3)
        for (let i = 0; i < levelWalls.length; i++) {
          for (let j = i + 1; j < levelWalls.length; j++) {
            const a = levelWalls[i]!;
            const b = levelWalls[j]!;
            const ax = a.start.xMm,
              az = a.start.yMm;
            const adx = a.end.xMm - ax,
              adz = a.end.yMm - az;
            const bx = b.start.xMm,
              bz = b.start.yMm;
            const bdx = b.end.xMm - bx,
              bdz = b.end.yMm - bz;
            const denom = adx * bdz - adz * bdx;
            if (Math.abs(denom) < 1e-9) continue;
            const t = ((bx - ax) * bdz - (bz - az) * bdx) / denom;
            const u = ((bx - ax) * adz - (bz - az) * adx) / denom;
            if (t < 0 || t > 1 || u < 0 || u > 1) continue;
            const ixMm = ax + adx * t;
            const iyMm = az + adz * t;
            if (Math.hypot(ixMm - v.xMm, iyMm - v.yMm) < toleranceMm)
              candidates.push({ mode: 'intersection', xMm: ixMm, yMm: iyMm });
          }
        }
        const snap = snapEngineRef.current.resolve(candidates);
        if (snap) {
          if (!snapIndicatorRef.current) {
            const indicator = new THREE.Mesh(
              new THREE.TorusGeometry(0.05, 0.01, 8, 16),
              new THREE.MeshBasicMaterial({ color: 0xfcd34d }),
            );
            indicator.userData.snapIndicator = true;
            indicator.rotation.x = Math.PI / 2;
            snapIndicatorRef.current = indicator;
            grp.add(indicator);
          }
          snapIndicatorRef.current.position.set(snap.xMm / 1000, SLICE_Y + 0.01, snap.yMm / 1000);
          snapIndicatorRef.current.visible = true;
          setSnapLabel(snapEngineRef.current.pillLabel(snap));
        } else {
          if (snapIndicatorRef.current) snapIndicatorRef.current.visible = false;
          setSnapLabel(null);
        }
        // EDT-05 — parallel pipeline that produces glyph candidates
        // (intersection / perpendicular / extension) plus the existing
        // endpoint snap, filtered by the user's per-kind toggles.
        const linesScoped = lastSnapLinesRef.current;
        const allHits = snapPlanCandidates({
          cursor: v,
          anchors,
          gridStepMm: orthoExtents(camRef.current.half).stepMm,
          chainAnchor:
            draftRef.current?.kind === 'wall'
              ? { xMm: draftRef.current.sx, yMm: draftRef.current.sy }
              : undefined,
          snapMm: orthoExtents(camRef.current.half).snapMm,
          orthoHold: orthoSnapHold,
          lines: linesScoped,
          centers: centerAnchors,
        });
        // F-080 — if a one-shot snap override is active, restrict candidates
        // to only that kind so the glyph and tab-cycle honour the override.
        const activeOverride = snapOverrideRef.current;
        const settingsForFilter: SnapSettings = activeOverride
          ? {
              endpoint: activeOverride === 'endpoint',
              midpoint: activeOverride === 'midpoint',
              nearest: activeOverride === 'nearest',
              center: activeOverride === 'center',
              intersection: activeOverride === 'intersection',
              perpendicular: activeOverride === 'perpendicular',
              extension: activeOverride === 'extension',
              parallel: activeOverride === 'parallel',
              tangent: activeOverride === 'tangent',
              workplane: activeOverride === 'workplane',
              grid: activeOverride === 'grid',
            }
          : snapSettings;
        const filtered = applySnapSettings(
          allHits.filter((h) => h.kind !== 'raw'),
          settingsForFilter,
        );
        // Resync tab cycle when the candidate-set changes; keep the
        // index stable for a stationary cursor.
        snapTabCycleRef.current = syncSnapTabCycle(snapTabCycleRef.current, filtered);
        lastSnapHitsRef.current = filtered;
        const glyphCandidates = filtered.map((h) => {
          const screen = worldToScreen(h.point);
          const out: {
            kind: SnapKind;
            pxX: number;
            pxY: number;
            extensionFromPxX?: number;
            extensionFromPxY?: number;
            associative?: boolean;
          } = {
            kind: h.kind,
            pxX: screen.pxX,
            pxY: screen.pxY,
            associative: h.kind !== 'raw' && h.kind !== 'grid',
          };
          if (h.kind === 'extension' && linesScoped.length > 0) {
            // Pick the closer endpoint of any segment that this point
            // lies on the infinite extension of, just for the dashed
            // hint back to source.
            let best: { line: SegmentLine; endpoint: { xMm: number; yMm: number } } | undefined;
            let bestD = Infinity;
            for (const line of linesScoped) {
              for (const endpt of [line.start, line.end]) {
                const d = (endpt.xMm - h.point.xMm) ** 2 + (endpt.yMm - h.point.yMm) ** 2;
                if (d < bestD) {
                  bestD = d;
                  best = { line, endpoint: endpt };
                }
              }
            }
            if (best) {
              const fromPx = worldToScreen(best.endpoint);
              out.extensionFromPxX = fromPx.pxX;
              out.extensionFromPxY = fromPx.pxY;
            }
          }
          return out;
        });
        setSnapGlyphState({
          candidates: glyphCandidates,
          activeIndex: snapTabCycleRef.current.activeIndex,
        });
      } else {
        if (snapIndicatorRef.current) snapIndicatorRef.current.visible = false;
        setSnapLabel(null);
        if (lastSnapHitsRef.current.length > 0) {
          lastSnapHitsRef.current = [];
          snapTabCycleRef.current = initialSnapTabCycle();
          setSnapGlyphState({ candidates: [], activeIndex: 0 });
        }
      }

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
      // §3.3.6 — split-wall hover: track nearest wall under cursor
      if (planTool === 'split-wall') {
        const nearest = nearestWallAt(elementsById, displayLevelId || undefined, v.xMm, v.yMm);
        if (nearest && nearest.distMm < 900 && nearest.alongT > 0.001 && nearest.alongT < 0.999) {
          const hoverPt = {
            xMm:
              nearest.wall.start.xMm +
              (nearest.wall.end.xMm - nearest.wall.start.xMm) * nearest.alongT,
            yMm:
              nearest.wall.start.yMm +
              (nearest.wall.end.yMm - nearest.wall.start.yMm) * nearest.alongT,
          };
          const { state } = reduceSplitWall(splitWallStateRef.current, {
            kind: 'hoverWall',
            wallId: nearest.wall.id,
            pointMm: hoverPt,
          });
          splitWallStateRef.current = state;
        } else {
          const { state } = reduceSplitWall(splitWallStateRef.current, { kind: 'hoverClear' });
          splitWallStateRef.current = state;
        }
        bumpGeom((x) => x + 1);
      }
      // F-115 — live ghost preview for the component placement tool.
      if (planTool === 'component') {
        const assetId = activeComponentAssetId;
        const familyTypeId = activeComponentFamilyTypeId;
        const entry = assetId
          ? (() => {
              for (const el of Object.values(elementsById)) {
                if (el.kind === 'asset_library_entry' && el.id === assetId) {
                  return el;
                }
              }
              return activeComponentAssetPreviewEntry?.id === assetId
                ? activeComponentAssetPreviewEntry
                : undefined;
            })()
          : undefined;
        const familyType = familyTypeId ? elementsById[familyTypeId] : undefined;
        const familyParams =
          familyType?.kind === 'family_type'
            ? (familyType.parameters as Record<string, unknown>)
            : undefined;
        const w =
          entry?.thumbnailWidthMm ??
          Number(familyParams?.widthMm ?? familyParams?.Width ?? familyParams?.lengthMm ?? 1000);
        const h =
          entry?.thumbnailHeightMm ??
          Number(familyParams?.depthMm ?? familyParams?.Depth ?? familyParams?.heightMm ?? 600);
        const rr = rayToPlanMm(rnd, camNow, ev.clientX, ev.clientY);
        if (rr) {
          if (componentGhostRef.current) {
            grp.remove(componentGhostRef.current);
            componentGhostRef.current = null;
          }
          const ghost = buildComponentGhost({
            activeLevelId: activeLevelResolvedId,
            entry,
            widthMm: w,
            heightMm: h,
            rotDeg: pendingComponentRotationDeg,
          });
          ghost.position.set(rr.xMm / 1000, ghost.position.y, rr.yMm / 1000);
          grp.add(ghost);
          componentGhostRef.current = ghost;
        }
      } else if (componentGhostRef.current) {
        grp.remove(componentGhostRef.current);
        componentGhostRef.current = null;
      }

      if (planTool === 'column-at-grids') {
        const ray = new THREE.Raycaster();
        ray.setFromCamera(
          new THREE.Vector2(
            ((ev.clientX - rnd.domElement.getBoundingClientRect().left) /
              rnd.domElement.getBoundingClientRect().width) *
              2 -
              1,
            -(
              ((ev.clientY - rnd.domElement.getBoundingClientRect().top) /
                rnd.domElement.getBoundingClientRect().height) *
                2 -
              1
            ),
          ),
          cameraRef.current!,
        );
        const hits = ray.intersectObjects(grp.children, true);
        const h = hits.find(
          (x) => typeof (x.object.userData as { bimPickId?: unknown }).bimPickId === 'string',
        );
        const hovId = h ? ((h.object.userData as { bimPickId: string }).bimPickId ?? null) : null;
        const el = hovId ? elementsById[hovId] : null;
        const nextHovId = el?.kind === 'grid_line' ? hovId : null;
        if (nextHovId !== columnAtGridsHoverRef.current) {
          columnAtGridsHoverRef.current = nextHovId;
          bumpGeom((x) => x + 1);
        }
      } else if (columnAtGridsHoverRef.current !== null) {
        columnAtGridsHoverRef.current = null;
      }
    };

    const onDown = (ev: PointerEvent) => {
      // PLN-02 — first chance: crop frame interaction. Only applies when a
      // plan_view with crop bounds is active and the frame is visible.
      if (
        ev.button === 0 &&
        !spaceDownRef.current &&
        activeCropState &&
        (activeCropState.cropRegionVisible || activeCropState.cropEnabled)
      ) {
        const ptr = rayToPlanMm(rnd, camNow, ev.clientX, ev.clientY);
        if (ptr) {
          const pixH = rnd.domElement.clientHeight || 1;
          const handleToleranceMm = (14 / pixH) * 2 * camRef.current.half * 1000;
          const handleId = pickCropHandle(
            activeCropState.cropMinMm,
            activeCropState.cropMaxMm,
            ptr.xMm,
            ptr.yMm,
            handleToleranceMm,
          );
          if (handleId) {
            cropDragRef.current = {
              handle: handleId,
              planViewId: activeCropState.planViewId,
              startBounds: {
                cropMinMm: activeCropState.cropMinMm,
                cropMaxMm: activeCropState.cropMaxMm,
              },
              startPointerMm: ptr,
              currentBounds: {
                cropMinMm: activeCropState.cropMinMm,
                cropMaxMm: activeCropState.cropMaxMm,
              },
            };
            skipClickRef.current = true;
            return;
          }
          // §1.6.10: crop region grip hit-test via getCropRegionGrips (4-edge midpoint grips)
          {
            const cropMinMax = {
              minXMm: activeCropState.cropMinMm.xMm,
              minYMm: activeCropState.cropMinMm.yMm,
              maxXMm: activeCropState.cropMaxMm.xMm,
              maxYMm: activeCropState.cropMaxMm.yMm,
            };
            const cropGrips = getCropRegionGrips(cropMinMax);
            const HIT_RADIUS_MM = handleToleranceMm;
            const hit = cropGrips.find(
              (g) =>
                Math.hypot(g.positionMm.xMm - ptr.xMm, g.positionMm.yMm - ptr.yMm) < HIT_RADIUS_MM,
            );
            if (hit) {
              cropGripDragRef.current = {
                gripId: hit.id,
                startPlanPt: ptr,
                cropAtStart: cropMinMax,
                planViewId: activeCropState.planViewId,
              };
              skipClickRef.current = true;
              return;
            }
          }
          // Body drag: only when select-tool active and no element under cursor.
          if (
            planTool === 'select' &&
            pointInsideCrop(activeCropState.cropMinMm, activeCropState.cropMaxMm, ptr.xMm, ptr.yMm)
          ) {
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
            const hasElementHit = hits.some(
              (x) => typeof (x.object.userData as { bimPickId?: unknown }).bimPickId === 'string',
            );
            if (!hasElementHit && ev.shiftKey) {
              cropDragRef.current = {
                handle: 'body',
                planViewId: activeCropState.planViewId,
                startBounds: {
                  cropMinMm: activeCropState.cropMinMm,
                  cropMaxMm: activeCropState.cropMaxMm,
                },
                startPointerMm: ptr,
                currentBounds: {
                  cropMinMm: activeCropState.cropMinMm,
                  cropMaxMm: activeCropState.cropMaxMm,
                },
              };
              skipClickRef.current = true;
              return;
            }
          }
        }
      }

      const intent = classifyPointerStart({
        button: ev.button,
        spacePressed: spaceDownRef.current,
        shiftKey: ev.shiftKey,
        altKey: ev.altKey,
        activeTool: planTool === 'select' ? 'select' : planTool ? 'wall' : undefined,
        dragDirection: null,
      });

      const startPan = () => {
        const rr = rayToPlanMm(rnd, camNow, ev.clientX, ev.clientY);
        if (!rr) return;
        dragRef.current = {
          dragging: true,
          lastXmm: rr.xMm,
          lastZmm: rr.yMm,
          camX: camRef.current.camX,
          camZ: camRef.current.camZ,
        };
      };

      if (intent === 'pan' || ev.button === 2) {
        startPan();
      } else if (intent === 'drag-move' && planTool === 'select') {
        // LMB + select tool: pan on element hit, start marquee on empty space.
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
        const hasHit = hits.some(
          (x) => typeof (x.object.userData as { bimPickId?: unknown }).bimPickId === 'string',
        );
        if (hasHit) {
          startPan();
        } else {
          const rr = rayToPlanMm(rnd, camNow, ev.clientX, ev.clientY);
          if (rr) {
            marqueeRef.current = {
              active: true,
              sx: rr.xMm,
              sy: rr.yMm,
              ex: rr.xMm,
              ey: rr.yMm,
              direction: null,
            };
          }
        }
      }
      skipClickRef.current = false;
    };

    const onUpWindow = (ev: PointerEvent) => {
      // EDT-01 — release a grip drag: numeric override commits if the
      // user typed a value, otherwise commit via the live delta.
      if (gripDragRef.current) {
        const grip = gripDragRef.current.grip;
        const numeric = numericInputRef.current?.value;
        if (numeric != null && numeric !== '') {
          const parsed = parseDimensionInput(numeric);
          if (parsed.ok) {
            void onSemanticCommand(grip.onNumericOverride(parsed.mm));
          }
        } else {
          const rwUp = rayToPlanMm(rnd, camNow, ev.clientX, ev.clientY);
          if (rwUp) {
            const start = gripDragRef.current.startWorldMm;
            const delta = { xMm: rwUp.xMm - start.xMm, yMm: rwUp.yMm - start.yMm };
            // Only commit if the drag actually moved — a click on a
            // grip without movement should not fire an empty command.
            if (Math.hypot(delta.xMm, delta.yMm) > 1) {
              void onSemanticCommand(grip.onCommit(delta));
            }
          }
        }
        gripDragRef.current = null;
        setActiveGripId(null);
        setDraftMutation(null);
        setNumericInput(null);
        skipClickRef.current = true;
        return;
      }
      dragRef.current.dragging = false;
      if (snapIndicatorRef.current) snapIndicatorRef.current.visible = false;
      setSnapLabel(null);

      // PLN-02 — commit crop frame drag if one is active.
      if (cropDragRef.current) {
        const drag = cropDragRef.current;
        cropDragRef.current = undefined;
        const sameMin =
          drag.currentBounds.cropMinMm.xMm === drag.startBounds.cropMinMm.xMm &&
          drag.currentBounds.cropMinMm.yMm === drag.startBounds.cropMinMm.yMm;
        const sameMax =
          drag.currentBounds.cropMaxMm.xMm === drag.startBounds.cropMaxMm.xMm &&
          drag.currentBounds.cropMaxMm.yMm === drag.startBounds.cropMaxMm.yMm;
        if (!(sameMin && sameMax)) {
          for (const cmd of cropDragCommands(drag.planViewId, drag.currentBounds)) {
            onSemanticCommand(cmd);
          }
        }
        bumpGeom((x) => x + 1);
        return;
      }
      // §1.6.10: commit/clear crop grip drag (applyCropGripDrag)
      if (cropGripDragRef.current) {
        cropGripDragRef.current = null;
        return;
      }

      if (marqueeRef.current.active && marqueeRef.current.direction) {
        const { sx, sy, ex, ey, direction } = marqueeRef.current;
        clearMarqueeLine();
        marqueeRef.current = { active: false, sx: 0, sy: 0, ex: 0, ey: 0, direction: null };

        const xMin = Math.min(sx, ex);
        const xMax = Math.max(sx, ex);
        const yMin = Math.min(sy, ey);
        const yMax = Math.max(sy, ey);
        const boxMin = { xMm: xMin, yMm: yMin };
        const boxMax = { xMm: xMax, yMm: yMax };
        const selMode = direction === 'left-to-right' ? 'window' : 'crossing';

        const ids: string[] = [];
        for (const el of Object.values(elementsById)) {
          // Level filter — use optional chaining since not all kinds have levelId.
          if (displayLevelId && (el as { levelId?: string }).levelId !== displayLevelId) continue;
          // Skip link_model elements when selectLinkedEnabled is false
          if (!selectLinkedEnabled && el.kind === 'link_model') continue;
          if (elementInSelectionBoxMm(el, boxMin, boxMax, selMode)) ids.push(el.id);
        }
        if (ids.length >= 1) {
          selectEl(ids[0]);
          for (const id of ids.slice(1)) {
            useBimStore.getState().toggleSelectedId(id);
          }
        }
        return;
      }
      clearMarqueeLine();
      marqueeRef.current = { active: false, sx: 0, sy: 0, ex: 0, ey: 0, direction: null };
      if (
        planTool === 'wall-opening' &&
        wallOpeningStateRef.current.phase === 'define-rect' &&
        wallOpeningAnchorRef.current
      ) {
        const sp = snapped(ev.clientX, ev.clientY);
        if (sp) {
          const { effect } = reduceWallOpening(wallOpeningStateRef.current, {
            kind: 'drag-end',
            cornerMm: sp,
          });
          wallOpeningStateRef.current = initialWallOpeningState();
          wallOpeningAnchorRef.current = null;
          if (effect.commitWallOpening) {
            const host = elementsById[effect.commitWallOpening.hostWallId];
            if (host && host.kind === 'wall') {
              // Project anchor + corner onto host wall's basis line to get
              // alongTStart / alongTEnd; sill / head come from the rect's
              // vertical extent (anchor & corner share Z via raycast on the
              // ground plane; for a 2D rectangle both Y components project
              // onto the wall, so derive sill/head from the absolute heights
              // of the top and bottom edges of the drawn rect — here we use
              // a default 200/2000mm window since plan rectangles don't
              // carry vertical info).
              const ax = host.start.xMm;
              const ay = host.start.yMm;
              const bx = host.end.xMm;
              const by = host.end.yMm;
              const abx = bx - ax;
              const aby = by - ay;
              const len2 = Math.max(abx * abx + aby * aby, 1e-9);
              const project = (p: { xMm: number; yMm: number }) =>
                Math.max(
                  0.0001,
                  Math.min(0.9999, ((p.xMm - ax) * abx + (p.yMm - ay) * aby) / len2),
                );
              const t0 = project(effect.commitWallOpening.anchorMm);
              const t1 = project(effect.commitWallOpening.cornerMm);
              const tStart = Math.min(t0, t1);
              const tEnd = Math.max(t0, t1);
              if (tEnd - tStart >= 0.005) {
                onSemanticCommand({
                  type: 'createWallOpening',
                  hostWallId: effect.commitWallOpening.hostWallId,
                  alongTStart: tStart,
                  alongTEnd: tEnd,
                  sillHeightMm: 200,
                  headHeightMm: Math.min(host.heightMm - 100, 2400),
                });
              }
            }
          }
        }
      }
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
        // Handle EQ toggle button click
        const eqHit = hits.find(
          (x) => (x.object.userData as { eqToggle?: boolean }).eqToggle === true,
        );
        if (eqHit) {
          const dimId = (eqHit.object.userData as { bimPickId?: string }).bimPickId;
          if (dimId) {
            void onSemanticCommand({ type: 'toggle_dim_eq', dimensionId: dimId });
            return;
          }
        }
        const h = hits.find(
          (x) => typeof (x.object.userData as { bimPickId?: unknown }).bimPickId === 'string',
        );
        const rawPickId =
          typeof (h?.object.userData as { bimPickId?: unknown }).bimPickId === 'string'
            ? (h!.object.userData as { bimPickId: string }).bimPickId
            : undefined;
        // Skip link_model elements when selectLinkedEnabled is false
        const id =
          rawPickId && !selectLinkedEnabled && elementsById[rawPickId]?.kind === 'link_model'
            ? undefined
            : rawPickId;
        const clickIntent = classifyPointerStart({
          button: ev.button,
          shiftKey: ev.shiftKey,
          altKey: ev.altKey,
          ctrlKey: ev.ctrlKey,
          metaKey: ev.metaKey,
          activeTool: 'select',
          dragDirection: null,
        });
        if ((clickIntent === 'add-to-selection' || clickIntent === 'toggle-selection') && id) {
          useBimStore.getState().toggleSelectedId(id);
        } else if (clickIntent === 'add-to-selection' || clickIntent === 'toggle-selection') {
          return;
        } else {
          selectEl(id);
        }
        return;
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
        const hit = queryDxfPrimitiveAtPoint(dxfUnderlays, sp, {
          toleranceMm,
          elementsById,
          viewOverridesByLinkId: Object.fromEntries(
            dxfUnderlays.map((link) => [link.id, viewOverrides[dxfViewOverrideKey(link.id)]]),
          ),
        });
        setDxfQueryHover(hit);
        setDxfQueryDialog(hit ? { hit, position: { x: ev.clientX, y: ev.clientY } } : null);
        return;
      }
      if (planTool === 'tag') {
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
        const id =
          typeof (h?.object.userData as { bimPickId?: unknown }).bimPickId === 'string'
            ? (h!.object.userData as { bimPickId: string }).bimPickId
            : undefined;
        const cmd = placeTagByCategoryCommand(elementsById, activePlanViewId, id, {
          xMm: sp.xMm,
          yMm: sp.yMm,
        });
        if (cmd) {
          onSemanticCommand(cmd);
        }
        return;
      }
      if (planTool === 'door') {
        const n = nearestWallAt(elementsById, displayLevelId || undefined, sp.xMm, sp.yMm);
        if (!n || n.distMm > 900) return;
        onSemanticCommand({
          type: 'insertDoorOnWall',
          wallId: n.wall.id,
          alongT: n.alongT,
          widthMm: 900,
          ...(activeComponentFamilyTypeId ? { familyTypeId: activeComponentFamilyTypeId } : {}),
        });
        return;
      }
      if (planTool === 'window') {
        const n = nearestWallAt(elementsById, displayLevelId || undefined, sp.xMm, sp.yMm);
        if (!n || n.distMm > 900) return;
        onSemanticCommand({
          type: 'insertWindowOnWall',
          wallId: n.wall.id,
          alongT: n.alongT,
          widthMm: 1200,
          sillHeightMm: 900,
          heightMm: 1500,
          ...(activeComponentFamilyTypeId ? { familyTypeId: activeComponentFamilyTypeId } : {}),
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
      if (planTool === 'room_rectangle') {
        const dr = draftRef.current;
        if (!dr || dr.kind !== 'room_rect') {
          draftRef.current = { kind: 'room_rect', sx: sp.xMm, sy: sp.yMm };
          bumpGeom((x) => x + 1);
          return;
        }
        const ox = Math.min(dr.sx, sp.xMm);
        const oy = Math.min(dr.sy, sp.yMm);
        const widthMm = Math.abs(sp.xMm - dr.sx);
        const depthMm = Math.abs(sp.yMm - dr.sy);
        if (widthMm < 200 || depthMm < 200) {
          draftRef.current = undefined;
          bumpGeom((x) => x + 1);
          return;
        }
        onSemanticCommand({
          type: 'createRoomRectangle',
          levelId: lvlId,
          origin: { xMm: ox, yMm: oy },
          widthMm,
          depthMm,
        });
        draftRef.current = undefined;
        bumpGeom((x) => x + 1);
        return;
      }
      if (planTool === 'grid') {
        const d = draftRef.current;
        if (!d || d.kind !== 'grid') {
          draftRef.current = { kind: 'grid', sx: sp.xMm, sy: sp.yMm };
          bumpGeom((x) => x + 1);
          return;
        }
        onSemanticCommand({
          type: 'createGridLine',
          label: guessGridLabel(d.sx, d.sy, sp.xMm, sp.yMm),
          levelId: lvlId,
          start: { xMm: d.sx, yMm: d.sy },
          end: { xMm: sp.xMm, yMm: sp.yMm },
        });
        draftRef.current = undefined;
        bumpGeom((x) => x + 1);
        return;
      }
      if (planTool === 'measure') {
        const d = draftRef.current;
        if (!d || d.kind !== 'measure') {
          draftRef.current = { kind: 'measure', ax: sp.xMm, ay: sp.yMm };
          bumpGeom((x) => x + 1);
          return;
        }
        const distMm = Math.hypot(sp.xMm - d.ax, sp.yMm - d.ay);
        setMeasureReadout({ distMm });
        draftRef.current = undefined;
        if (previewRef.current) {
          grp.remove(previewRef.current);
          previewRef.current.geometry.dispose();
          previewRef.current = null;
        }
        bumpGeom((x) => x + 1);
        return;
      }
      if (planTool === 'measure-angle') {
        measureAngleStateRef.current = reduceMeasureAngle(measureAngleStateRef.current, {
          type: 'click',
          positionMm: { xMm: sp.xMm, yMm: sp.yMm },
        });
        if (
          measureAngleStateRef.current.status === 'complete' &&
          measureAngleStateRef.current.angleDeg != null
        ) {
          setMeasureAngleReadout({ angleDeg: measureAngleStateRef.current.angleDeg });
        }
        bumpGeom((x) => x + 1);
        return;
      }
      if (planTool === 'measure-arc') {
        measureArcStateRef.current = reduceMeasureArc(measureArcStateRef.current, {
          type: 'click',
          positionMm: { xMm: sp.xMm, yMm: sp.yMm },
        });
        const arcState = measureArcStateRef.current;
        if (
          arcState.status === 'complete' &&
          arcState.arcLengthMm != null &&
          arcState.radiusMm != null
        ) {
          setMeasureArcReadout({ arcLengthMm: arcState.arcLengthMm, radiusMm: arcState.radiusMm });
        }
        bumpGeom((x) => x + 1);
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
      if (planTool === 'reference-plane') {
        // KRN-05: two-click reference plane on the active level.
        const d = draftRef.current;
        if (!d || d.kind !== 'reference-plane') {
          draftRef.current = { kind: 'reference-plane', sx: sp.xMm, sy: sp.yMm };
          bumpGeom((x) => x + 1);
          return;
        }
        if (!lvlId) {
          draftRef.current = undefined;
          bumpGeom((x) => x + 1);
          return;
        }
        if (Math.hypot(sp.xMm - d.sx, sp.yMm - d.sy) < 1) {
          draftRef.current = undefined;
          bumpGeom((x) => x + 1);
          return;
        }
        onSemanticCommand({
          type: 'createReferencePlane',
          levelId: lvlId,
          startMm: { xMm: d.sx, yMm: d.sy },
          endMm: { xMm: sp.xMm, yMm: sp.yMm },
        });
        draftRef.current = undefined;
        bumpGeom((x) => x + 1);
        return;
      }
      if (planTool === 'property-line') {
        // KRN-01: two-click property boundary line.
        const d = draftRef.current;
        if (!d || d.kind !== 'property-line') {
          draftRef.current = { kind: 'property-line', sx: sp.xMm, sy: sp.yMm };
          bumpGeom((x) => x + 1);
          return;
        }
        if (Math.hypot(sp.xMm - d.sx, sp.yMm - d.sy) < 1) {
          draftRef.current = undefined;
          bumpGeom((x) => x + 1);
          return;
        }
        onSemanticCommand({
          type: 'createPropertyLine',
          startMm: { xMm: d.sx, yMm: d.sy },
          endMm: { xMm: sp.xMm, yMm: sp.yMm },
        });
        draftRef.current = undefined;
        bumpGeom((x) => x + 1);
        return;
      }
      if (planTool === 'area') {
        const ctx = activeAreaPlanContext();
        if (!ctx) {
          draftRef.current = undefined;
          clearPreview();
          bumpGeom((x) => x + 1);
          return;
        }
        const clickMm = rayToPlanMm(rnd, camNow, ev.clientX, ev.clientY) ?? sp;
        const boundary = findAreaPlacementBoundary(elementsById, ctx, clickMm);
        if (!boundary) {
          draftRef.current = undefined;
          clearPreview();
          bumpGeom((x) => x + 1);
          return;
        }
        selectEl(boundary.existingAreaId);
        useBimStore.getState().clearSelectedIds();
        draftRef.current = undefined;
        clearPreview();
        bumpGeom((x) => x + 1);
        return;
      }
      if (planTool === 'area-boundary') {
        // F-095/F-098/KRN-08: area boundaries are authored only in Area Plan
        // views and inherit that view's Area Scheme. Clicks add arbitrary
        // polygon vertices; click near the first vertex, Enter, or double-click
        // closes when at least three vertices exist. Shift-click on the second
        // point preserves the previous two-click rectangle placement flow.
        if (!activeAreaPlanContext()) {
          draftRef.current = undefined;
          bumpGeom((x) => x + 1);
          return;
        }
        const areaPt = areaSnapPoint(sp);
        const d = draftRef.current;
        if (!d || d.kind !== 'area-boundary') {
          draftRef.current = { kind: 'area-boundary', verts: [areaPt] };
          redrawAreaBoundaryPreviewMm([areaPt]);
          bumpGeom((x) => x + 1);
          return;
        }
        if (d.verts.length === 1 && ev.shiftKey) {
          const rectBoundary = areaBoundaryRectangleFromDiagonal(d.verts[0]!, areaPt);
          if (rectBoundary) {
            commitAreaBoundary(rectBoundary);
          } else {
            draftRef.current = undefined;
            clearPreview();
            bumpGeom((x) => x + 1);
          }
          return;
        }
        const reduced = reduceAreaBoundary(
          { verticesMm: d.verts },
          {
            kind: 'click',
            pointMm: areaPt,
          },
        );
        if (reduced.effect.commitBoundaryMm) {
          commitAreaBoundary(reduced.effect.commitBoundaryMm);
          return;
        }
        draftRef.current = { kind: 'area-boundary', verts: reduced.state.verticesMm };
        redrawAreaBoundaryPreviewMm(reduced.state.verticesMm);
        bumpGeom((x) => x + 1);
        return;
      }
      if (planTool === 'masking-region') {
        // KRN-10: Now handled by SketchCanvas overlay. This fallback is no longer needed.
        return;
      }
      if (planTool === 'plan-region') {
        // KRN-V3-06: two-click rectangular plan-region.
        const d = draftRef.current;
        if (!d || d.kind !== 'plan-region') {
          draftRef.current = { kind: 'plan-region', sx: sp.xMm, sy: sp.yMm };
          bumpGeom((x) => x + 1);
          return;
        }
        if (Math.hypot(sp.xMm - d.sx, sp.yMm - d.sy) < 1) {
          draftRef.current = undefined;
          bumpGeom((x) => x + 1);
          return;
        }
        if (!lvlId) {
          draftRef.current = undefined;
          bumpGeom((x) => x + 1);
          return;
        }
        const x0 = Math.min(d.sx, sp.xMm);
        const x1 = Math.max(d.sx, sp.xMm);
        const y0 = Math.min(d.sy, sp.yMm);
        const y1 = Math.max(d.sy, sp.yMm);
        setPendingPlanRegion({ x0, x1, y0, y1, lvlId, cutPlaneDraft: '900' });
        draftRef.current = undefined;
        bumpGeom((x) => x + 1);
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
          const newHalf = THREE.MathUtils.clamp(
            oldHalf * Math.exp(rawY * 0.003),
            HALF_MIN,
            HALF_MAX,
          );
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
            void onSemanticCommand(
              buildScaleCommand(
                selectedId,
                effect.commitScale.originMm,
                effect.commitScale.factor,
              ) as unknown as Record<string, unknown>,
            );
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
              const { profilePoints, depthMm, levelId, slopeAngleDeg } =
                effect.createRoofByExtrusion;
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
        snapTabCycleRef.current = bumpSnapTabCycle(
          snapTabCycleRef.current,
          lastSnapHitsRef.current,
        );
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
        // Cancel any active snap override.
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
          const el = st.elementsById[id] as unknown as { familyId?: string };
          if (typeof el.familyId === 'string') {
            const def = getBuiltInFamilyById(el.familyId);
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
      if (
        (ev.metaKey || ev.ctrlKey) &&
        (ev.key === 'a' || ev.key === 'A') &&
        planTool === 'select'
      ) {
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
    display.hiddenElementIds,
    display.hiddenSemanticKinds,
    revealHiddenMode,
    selectedId,
    selectedIds,
    setPlanTool,
  ]);

  // EDT-05 — keep the snap-line ref in sync with the active level so
  // the per-pointer-move handler can read it without a closure rebuild.
  useEffect(() => {
    lastSnapLinesRef.current = snapLines;
  }, [snapLines]);

  useEffect(() => {
    if (planTool !== 'measure') setMeasureReadout(null);
  }, [planTool]);

  useEffect(() => {
    if (planTool !== 'measure-angle') {
      measureAngleStateRef.current = initialMeasureAngleState();
      setMeasureAngleReadout(null);
    }
  }, [planTool]);

  useEffect(() => {
    if (planTool !== 'measure-arc') {
      measureArcStateRef.current = initialMeasureArcState();
      setMeasureArcReadout(null);
    }
  }, [planTool]);

  useEffect(() => {
    if (planTool !== 'wall') setWallPickLineHint(null);
  }, [planTool]);

  useEffect(() => {
    if (planTool !== 'wall') setWallDraftNotice(null);
  }, [planTool]);

  useEffect(() => {
    if (planTool !== 'query') {
      setDxfQueryHover(null);
      setDxfQueryDialog(null);
    }
  }, [planTool]);

  // F-115 — reset pending component rotation when leaving the component tool;
  // also remove any lingering ghost preview from the scene.
  useEffect(() => {
    if (planTool !== 'component') {
      setPendingComponentRotationDeg(0);
      const grp = rootRef.current;
      if (grp && componentGhostRef.current) {
        grp.remove(componentGhostRef.current);
        componentGhostRef.current = null;
      }
    }
  }, [planTool]);

  // F-014 — close the Unhide in View context menu on any outside mousedown.
  useEffect(() => {
    if (!unhideContextMenu) return;
    const close = () => setUnhideContextMenu(null);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [unhideContextMenu]);

  // F-040 — close the wall-join Allow/Disallow context menu on any outside mousedown.
  useEffect(() => {
    if (!wallJoinCtxMenu) return;
    const close = () => setWallJoinCtxMenu(null);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [wallJoinCtxMenu]);

  // EDT-01 — grip pointer-down: capture starting world position so
  // onMove can compute a stable delta.
  const handleGripPointerDown = useCallback(
    (grip: GripDescriptor, ev: { clientX: number; clientY: number }) => {
      const renderer = rendererRef.current;
      const cam = cameraRef.current;
      if (!renderer || !cam) return;
      const rw = rayToPlanMm(renderer, cam, ev.clientX, ev.clientY);
      if (!rw) return;
      gripDragRef.current = {
        grip,
        startWorldMm: rw,
        lastDeltaMm: { xMm: 0, yMm: 0 },
      };
      setActiveGripId(grip.id);
      setDraftMutation(grip.onDrag({ xMm: 0, yMm: 0 }));
    },
    [],
  );

  const handleGripDoubleClick = useCallback(
    (grip: GripDescriptor) => {
      const cmd = dimensionTextOffsetResetCommand(grip.id, elementsById);
      if (!cmd) return;
      void onSemanticCommand(cmd);
    },
    [elementsById, onSemanticCommand],
  );

  const handleTempDimClick = useCallback(
    (target: TempDimTarget) => {
      void onSemanticCommand(target.onClick());
    },
    [onSemanticCommand],
  );

  const handleTempDimLockClick = useCallback(
    (target: TempDimTarget) => {
      // EDT-02 — author a `createConstraint` capturing the current
      // measured distance between the two walls. The engine rejects any
      // subsequent move that breaks the lock (error severity).
      const elementsList = Object.values(elementsById);
      const existing = findLockedConstraintFor(target.aId, target.bId, elementsList);
      if (existing) return; // already locked — no-op
      const cid = `cstr-${crypto.randomUUID().slice(0, 10)}`;
      void onSemanticCommand({
        type: 'createConstraint',
        id: cid,
        rule: 'equal_distance',
        refsA: [{ elementId: target.aId, anchor: 'center' }],
        refsB: [{ elementId: target.bId, anchor: 'center' }],
        lockedValueMm: target.distanceMm,
        severity: 'error',
      });
    },
    [elementsById, onSemanticCommand],
  );

  const sb = THREE.MathUtils.clamp(halfUi * 0.25, 0.2, 6);
  const plotScaleN = Math.round(halfUi * 2);
  const handleWallContextMenuCommand = useCallback(
    (next: WallContextMenuCommand) => {
      onSemanticCommand(next.cmd);
      if (next.kind === 'elevation_view') {
        // Activate the new elevation marker so the user lands on its view.
        activateElevationView(next.elevationViewId);
      } else {
        // Section cuts surface in the project browser; selecting puts focus on
        // the new element so the user can immediately tweak it.
        selectEl(next.sectionCutId);
      }
    },
    [activateElevationView, onSemanticCommand, selectEl],
  );
  const activeComponentAsset =
    planTool === 'component' && activeComponentAssetId
      ? (() => {
          const storeAsset = elementsByIdRaw[activeComponentAssetId];
          if (storeAsset?.kind === 'asset_library_entry') return storeAsset;
          return activeComponentAssetPreviewEntry?.id === activeComponentAssetId
            ? activeComponentAssetPreviewEntry
            : null;
        })()
      : null;
  const componentPreviewScreen = hudMm && activeComponentAsset ? worldToScreen(hudMm) : null;
  const componentPreviewSymbolKind =
    activeComponentAsset?.planSymbolKind ?? activeComponentAsset?.renderProxyKind;

  return (
    <div
      data-testid="plan-canvas"
      className="relative h-full w-full overflow-hidden bg-canvas-paper"
    >
      {/* §1.6.10 — Thin Lines toggle button */}
      <div className="pointer-events-auto absolute left-2 top-1 z-20 flex items-center gap-2">
        <button
          type="button"
          data-testid="plan-view-thin-lines-toggle"
          title="Thin Lines"
          onClick={() => useBimStore.getState().toggleThinLines()}
          style={{
            padding: '2px 8px',
            fontSize: 11,
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            cursor: 'pointer',
            background: thinLinesEnabled ? 'var(--color-accent, #2563eb)' : 'transparent',
            color: thinLinesEnabled ? '#fff' : 'var(--color-foreground)',
            whiteSpace: 'nowrap',
          }}
        >
          TL
        </button>
        {/* §3.3.5 — Show Constraints toggle button */}
        {activePlanViewId ? (
          <button
            type="button"
            data-testid="plan-view-show-constraints-btn"
            title={showConstraints ? 'Hide Constraints' : 'Show Constraints'}
            onClick={() =>
              void onSemanticCommand({ type: 'toggleShowConstraints', viewId: activePlanViewId })
            }
            style={{
              fontSize: 10,
              padding: '1px 5px',
              border: `1px solid ${showConstraints ? '#22c55e' : 'var(--border)'}`,
              borderRadius: 3,
              background: showConstraints ? 'rgba(34,197,94,0.15)' : 'transparent',
              color: showConstraints ? '#22c55e' : 'inherit',
              cursor: 'pointer',
            }}
          >
            EQ
          </button>
        ) : null}
        {/* §2.9.4 — Plan underlay toggle + level selector */}
        {activePlanViewId ? (
          <button
            type="button"
            data-testid="plan-view-underlay-btn"
            title={showUnderlay ? 'Hide Underlay' : 'Show Underlay'}
            onClick={() =>
              void onSemanticCommand({ type: 'setPlanUnderlay', viewId: activePlanViewId })
            }
            style={{
              fontSize: 10,
              padding: '1px 5px',
              border: `1px solid ${showUnderlay ? '#a78bfa' : 'var(--border)'}`,
              borderRadius: 3,
              background: showUnderlay ? 'rgba(167,139,250,0.15)' : 'transparent',
              color: showUnderlay ? '#a78bfa' : 'inherit',
              cursor: 'pointer',
            }}
          >
            UL
          </button>
        ) : null}
        {showUnderlay && activePlanViewId ? (
          <select
            data-testid="plan-view-underlay-level-select"
            value={underlayLevelId ?? ''}
            onChange={(e) =>
              void onSemanticCommand({
                type: 'setPlanUnderlay',
                viewId: activePlanViewId,
                underlayLevelId: e.target.value || null,
                showUnderlay: true,
              })
            }
            style={{
              fontSize: 10,
              padding: '1px 4px',
              background: 'transparent',
              color: 'inherit',
              border: '1px solid var(--border)',
            }}
          >
            <option value="">-- No Underlay --</option>
            {underlayLevels.map((lv) => (
              <option key={lv.id} value={lv.id}>
                {lv.name}
              </option>
            ))}
          </select>
        ) : null}
        {/* §7.3.1 — Active work plane badge */}
        {activeWorkPlaneName ? (
          <span
            data-testid="plan-view-work-plane-badge"
            style={{
              fontSize: 10,
              color: 'var(--color-muted)',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            Work Plane: {activeWorkPlaneName}
            {activePlanViewId ? (
              <button
                type="button"
                data-testid="plan-view-work-plane-clear"
                onClick={() => {
                  void onSemanticCommand({
                    type: 'updateElementProperty',
                    elementId: activePlanViewId,
                    key: 'activeWorkPlaneId',
                    value: null,
                  });
                }}
                style={{
                  fontSize: 10,
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                }}
              >
                ×
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
      {wallContextMenu && (
        <WallContextMenu
          wall={wallContextMenu.wall}
          position={wallContextMenu.position}
          onCommand={handleWallContextMenuCommand}
          onClose={() => setWallContextMenu(null)}
        />
      )}
      {/* §1.7.1: canvas right-click context menu — shown when right-clicking on empty canvas space */}
      {canvasCtxMenu && (
        <CanvasContextMenu
          x={canvasCtxMenu.x}
          y={canvasCtxMenu.y}
          onClose={() => setCanvasCtxMenu(null)}
          onZoomIn={() => {
            camRef.current.half = Math.max(HALF_MIN, camRef.current.half * Math.exp(-0.5));
            resizeCam();
          }}
          onZoomOut={() => {
            camRef.current.half = Math.min(HALF_MAX, camRef.current.half * Math.exp(0.5));
            resizeCam();
          }}
          onZoomFit={handleFitToView}
        />
      )}
      {/* §1.7.2: generic element right-click context menu for non-wall elements */}
      {elementCtxMenu && (
        <ElementContextMenu
          open
          anchorX={elementCtxMenu.position.x}
          anchorY={elementCtxMenu.position.y}
          items={contextMenuItemsForElement(
            elementCtxMenu.el,
            (cmd) => void onSemanticCommand(cmd),
            { activeLevelId: displayLevelId ?? '', planTool: planTool ?? '' },
          )}
          onClose={() => setElementCtxMenu(null)}
          data-testid="element-context-menu"
        />
      )}
      {/* F-014/F-102: Unhide in View context menu — shown when right-clicking a hidden element in reveal hidden mode */}
      {unhideContextMenu && (
        <div
          data-testid="unhide-context-menu"
          className="pointer-events-auto absolute z-50 flex flex-col overflow-hidden rounded border border-border bg-surface shadow-md"
          style={{ left: unhideContextMenu.position.x, top: unhideContextMenu.position.y }}
        >
          {/* F-102: per-element unhide action — shown only when the element is individually hidden. */}
          {unhideContextMenu.elementId && (
            <button
              type="button"
              className="px-3 py-1.5 text-left text-xs hover:bg-surface-strong"
              data-testid="unhide-context-element"
              onClick={() => {
                if (activePlanViewId && unhideContextMenu.elementId) {
                  void onSemanticCommand({
                    type: 'unhideElementInView',
                    planViewId: activePlanViewId,
                    elementId: unhideContextMenu.elementId,
                  });
                }
                setUnhideContextMenu(null);
              }}
            >
              Unhide Element
            </button>
          )}
          <button
            type="button"
            className="px-3 py-1.5 text-left text-xs hover:bg-surface-strong"
            data-testid="unhide-context-category"
            onClick={() => {
              if (activePlanViewId) {
                setCategoryOverride(activePlanViewId, unhideContextMenu.elementKind, {
                  visible: true,
                });
              }
              setUnhideContextMenu(null);
            }}
          >
            Unhide in View: {unhideContextMenu.elementKind}
          </button>
        </div>
      )}
      {dxfQueryHover && planTool === 'query' ? (
        <div
          data-testid="dxf-query-hover"
          className="pointer-events-none absolute left-3 top-3 z-40 rounded border border-border bg-surface px-2 py-1 text-[11px] shadow-sm"
        >
          {dxfQueryHover.link.name ?? 'DXF Underlay'} / {dxfQueryHover.layerName}
        </div>
      ) : null}
      {dxfQueryDialog && (
        <div
          data-testid="dxf-query-dialog"
          className="pointer-events-auto absolute z-50 w-64 rounded border border-border bg-surface p-3 text-xs shadow-md"
          style={{ left: dxfQueryDialog.position.x, top: dxfQueryDialog.position.y }}
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium">Imported CAD Query</div>
              <div className="truncate text-[11px] text-muted">
                {dxfQueryDialog.hit.link.name ?? 'DXF Underlay'}
              </div>
            </div>
            <button
              type="button"
              aria-label="Close imported CAD query"
              className="rounded border border-border px-1.5 py-0.5 text-[11px] hover:bg-surface-strong"
              onClick={() => setDxfQueryDialog(null)}
            >
              Close
            </button>
          </div>
          <dl className="grid grid-cols-[64px_1fr] gap-x-2 gap-y-1 text-[11px]">
            <dt className="text-muted">Layer</dt>
            <dd className="min-w-0 truncate" data-testid="dxf-query-layer">
              {dxfQueryDialog.hit.layerName}
            </dd>
            <dt className="text-muted">Color</dt>
            <dd className="flex min-w-0 items-center gap-1">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm border border-border"
                style={{ backgroundColor: dxfQueryDialog.hit.color }}
              />
              <span className="truncate font-mono">{dxfQueryDialog.hit.color}</span>
            </dd>
            <dt className="text-muted">Link</dt>
            <dd className="min-w-0 truncate">{dxfQueryDialog.hit.link.id}</dd>
            <dt className="text-muted">Primitive</dt>
            <dd className="min-w-0 truncate">
              {dxfQueryDialog.hit.primitive.kind} #{dxfQueryDialog.hit.primitiveIndex + 1}
            </dd>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            {(() => {
              const hit = dxfQueryDialog.hit;
              const key = dxfViewOverrideKey(hit.link.id);
              const activePlanView = activePlanViewId ? elementsById[activePlanViewId] : undefined;
              const override =
                activePlanView?.kind === 'plan_view'
                  ? ((activePlanView.categoryOverrides ?? {}) as Record<string, CategoryOverride>)[
                      key
                    ]
                  : undefined;
              const hiddenInView = (override?.dxf?.hiddenLayerNames ?? []).includes(hit.layerName);
              const hiddenGlobally = (hit.link.hiddenLayerNames ?? []).includes(hit.layerName);
              const effectiveHidden = hiddenDxfLayerNamesForView(hit.link, override).includes(
                hit.layerName,
              );
              const canShow = hiddenInView && !hiddenGlobally;
              return (
                <>
                  <button
                    type="button"
                    disabled={!activePlanViewId || effectiveHidden}
                    data-testid="dxf-query-hide-layer-view"
                    className="rounded border border-border px-2 py-1 text-[11px] hover:bg-surface-strong disabled:opacity-50"
                    onClick={() => {
                      if (!activePlanViewId) return;
                      const next = setDxfLayerHiddenInView(override, hit.layerName, true);
                      setCategoryOverride(activePlanViewId, key, next);
                      setDxfQueryDialog({
                        ...dxfQueryDialog,
                        hit,
                      });
                    }}
                  >
                    Hide Layer in View
                  </button>
                  <button
                    type="button"
                    disabled={!activePlanViewId || !canShow}
                    data-testid="dxf-query-show-layer-view"
                    className="rounded border border-border px-2 py-1 text-[11px] hover:bg-surface-strong disabled:opacity-50"
                    title={
                      hiddenGlobally
                        ? 'This layer is hidden globally in Manage Links'
                        : 'Show this layer in the active view'
                    }
                    onClick={() => {
                      if (!activePlanViewId) return;
                      const next = setDxfLayerHiddenInView(override, hit.layerName, false);
                      setCategoryOverride(activePlanViewId, key, next);
                    }}
                  >
                    Show Layer in View
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}
      {/* F-040: Allow/Disallow Join context menu shown when right-clicking near a wall endpoint */}
      {wallJoinCtxMenu && (
        <div
          data-testid="wall-join-ctx-menu"
          className="pointer-events-auto absolute z-50 flex flex-col overflow-hidden rounded border border-border bg-surface shadow-md"
          style={{ left: wallJoinCtxMenu.position.x, top: wallJoinCtxMenu.position.y }}
        >
          <button
            type="button"
            className="px-3 py-1.5 text-left text-xs hover:bg-surface-strong"
            data-testid="wall-join-ctx-toggle"
            onClick={() => {
              void onSemanticCommand({
                type: 'setWallJoinDisallow',
                wallId: wallJoinCtxMenu.wallId,
                endpoint: wallJoinCtxMenu.endpoint,
                disallow: !wallJoinCtxMenu.currentlyDisallowed,
              });
              setWallJoinCtxMenu(null);
            }}
          >
            {wallJoinCtxMenu.currentlyDisallowed ? 'Allow Join' : 'Disallow Join'} (
            {wallJoinCtxMenu.endpoint})
          </button>
        </div>
      )}
      <div className="pointer-events-none absolute right-3 bottom-14 z-10 rounded border border-border bg-surface/80 px-2 py-1 font-mono text-[10px] text-muted backdrop-blur">
        {hudMm
          ? `X ${(hudMm.xMm / 1000).toFixed(2)} m · Y ${(hudMm.yMm / 1000).toFixed(2)} m`
          : '—'}
      </div>
      {wallPickLineHint
        ? (() => {
            const start = worldToScreen(wallPickLineHint.start);
            const end = worldToScreen(wallPickLineHint.end);
            return (
              <svg
                data-testid="wall-pick-line-preview"
                className="pointer-events-none absolute inset-0 z-10"
                aria-hidden="true"
              >
                <line
                  x1={start.pxX}
                  y1={start.pxY}
                  x2={end.pxX}
                  y2={end.pxY}
                  stroke="rgba(37, 99, 235, 0.95)"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeDasharray="8 5"
                />
                <circle cx={start.pxX} cy={start.pxY} r={5} fill="rgba(37, 99, 235, 0.95)" />
                <circle
                  cx={end.pxX}
                  cy={end.pxY}
                  r={6}
                  fill="white"
                  stroke="rgba(37, 99, 235, 0.95)"
                  strokeWidth={2}
                />
              </svg>
            );
          })()
        : null}
      {planTool === 'wall' && hudMm ? (
        <div className="pointer-events-none absolute left-3 bottom-14 z-10 max-w-[min(360px,calc(100%-24px))] rounded border border-border bg-surface/90 px-2 py-1.5 text-[10px] text-foreground shadow-elev-1 backdrop-blur">
          <div className="font-semibold">Wall placement</div>
          <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-muted">
            <span>
              {draftRef.current?.kind === 'wall'
                ? 'Pick endpoint'
                : wallPickLineHint
                  ? `Click to use ${wallPickLineHint.sourceLabel}`
                  : 'Pick start point or existing boundary line'}
            </span>
            <span>line {wallLocationLine.replace(/-/g, ' ')}</span>
            <span>offset {wallDrawOffsetMm} mm</span>
            <span>radius {wallDrawRadiusMm ?? 0} mm</span>
            <span>height {wallDrawHeightMm} mm</span>
            <span>
              type{' '}
              {activeWallTypeId && elementsByIdRaw[activeWallTypeId]?.kind === 'wall_type'
                ? (elementsByIdRaw[activeWallTypeId] as Extract<Element, { kind: 'wall_type' }>)
                    .name
                : 'Default'}
            </span>
          </div>
          <div className="mt-0.5 text-[9px] text-muted">Tab cycles location line · Esc cancels</div>
          {wallDraftNotice ? (
            <div
              data-testid="wall-draft-notice"
              className="mt-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-1 text-[9px] text-amber-200"
            >
              {wallDraftNotice}
            </div>
          ) : null}
        </div>
      ) : null}
      {snapLabel && (
        <div className="pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2 rounded border border-border bg-surface/90 px-2 py-0.5 font-mono text-[10px] text-foreground backdrop-blur">
          {snapLabel}
        </div>
      )}
      <div className="pointer-events-none absolute right-3 top-14 z-10 max-w-[min(260px,calc(100%-24px))] rounded border border-border bg-surface/90 px-2 py-2 text-[10px] text-muted backdrop-blur">
        {planPresentation === 'room_scheme' && roomColorLegend.length ? (
          <div data-testid="plan-room-color-legend">
            <div className="mb-1 font-semibold text-foreground">Room colour legend</div>
            <ul className="space-y-1">
              {roomColorLegend.map((row) => {
                const subtitle = [row.programmeCode, row.department, row.functionLabel]
                  .filter((x): x is string => Boolean(x && x.trim()))
                  .filter((x, i, a) => a.indexOf(x) === i)
                  .filter((x) => x !== row.label)
                  .join(' · ');
                return (
                  <li key={`${row.label}-${row.schemeColorHex}`} className="flex items-start gap-2">
                    <span
                      className="mt-0.5 inline-block size-3 shrink-0 rounded-sm border border-border"
                      style={{ backgroundColor: row.schemeColorHex }}
                      title={row.programmeCode ?? row.label}
                    />
                    <span className="leading-tight">
                      <span className="text-foreground">{row.label}</span>
                      {subtitle ? (
                        <span className="mt-0.5 block text-[9px] text-muted">{subtitle}</span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
      {/* §13.1.3 — color fill legend panel overlay */}
      <ColorSchemeLegend
        rows={colorSchemeLegendRows}
        title={colorSchemeLegendTitle}
        visible={legendVisible}
        onClose={() => setLegendVisible(false)}
      />
      {/* B03 — empty-state overlay (spec §14.7): shown when the active level has no elements */}
      {levelIsEmpty && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-center">
          <p className="font-medium text-foreground text-sm">This level is empty.</p>
          <p className="text-muted text-xs">
            Press W to draw a wall, or insert the seed house from the Project menu.
          </p>
          <p className="text-muted text-[10px] mt-1">Use PageUp / PageDown to switch levels.</p>
        </div>
      )}
      {/* F-014 — Reveal Hidden mode chip: shown while reveal mode is active. */}
      {revealHiddenMode && (
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#ff00ff',
            color: '#fff',
            padding: '2px 10px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
            pointerEvents: 'none',
            zIndex: 20,
          }}
          data-testid="reveal-hidden-chip"
        >
          Reveal Hidden Elements — hidden categories visible
        </div>
      )}
      {/* ANN-01 text annotation typing overlay */}
      {textAnnotOverlay && (
        <div
          style={{
            position: 'absolute',
            left: textAnnotOverlay.screenX,
            top: textAnnotOverlay.screenY,
            pointerEvents: 'auto',
            zIndex: 30,
          }}
        >
          <input
            autoFocus
            type="text"
            value={textAnnotOverlay.draft}
            className="rounded border border-accent bg-surface px-1 py-0.5 text-xs shadow outline-none"
            placeholder="Type text…"
            onChange={(e) =>
              setTextAnnotOverlay((prev) => prev && { ...prev, draft: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const draft = textAnnotOverlay.draft.trim();
                if (draft && activePlanViewId) {
                  void onSemanticCommand({
                    type: 'createTextNote',
                    hostViewId: activePlanViewId,
                    positionMm: textAnnotOverlay.positionMm,
                    text: draft,
                    fontSizeMm: 200,
                    anchor: 'tl',
                  });
                }
                textAnnotStateRef.current = initialTextAnnotationState();
                setTextAnnotOverlay(null);
              } else if (e.key === 'Escape') {
                textAnnotStateRef.current = initialTextAnnotationState();
                setTextAnnotOverlay(null);
              }
            }}
          />
        </div>
      )}
      {/* ANN-16 leader-text typing overlay */}
      {leaderTextOverlay && (
        <div
          style={{
            position: 'absolute',
            left: leaderTextOverlay.screenX,
            top: leaderTextOverlay.screenY,
            pointerEvents: 'auto',
            zIndex: 30,
          }}
        >
          <input
            autoFocus
            type="text"
            value={leaderTextOverlay.draft}
            className="rounded border border-accent bg-surface px-1 py-0.5 text-xs shadow outline-none"
            placeholder="Leader text…"
            onChange={(e) =>
              setLeaderTextOverlay((prev) => prev && { ...prev, draft: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const draft = leaderTextOverlay.draft.trim();
                if (draft && activePlanViewId) {
                  void onSemanticCommand({
                    type: 'createLeaderText',
                    hostViewId: activePlanViewId,
                    anchorMm: leaderTextOverlay.anchorMm,
                    elbowMm: leaderTextOverlay.elbowMm,
                    textMm: leaderTextOverlay.textMm,
                    content: draft,
                    arrowStyle: 'arrow',
                  });
                }
                leaderTextStateRef.current = initialLeaderTextState();
                setLeaderTextOverlay(null);
              } else if (e.key === 'Escape') {
                leaderTextStateRef.current = initialLeaderTextState();
                setLeaderTextOverlay(null);
              }
            }}
          />
        </div>
      )}
      {/* Measure readout chip — shown after a two-click distance measurement */}
      {measureReadout && planTool === 'measure' ? (
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'auto',
            zIndex: 20,
          }}
          className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs shadow"
          data-testid="measure-readout"
        >
          <span className="font-mono">
            {(measureReadout.distMm / 1000).toFixed(3)} m &nbsp; (
            {Math.round(measureReadout.distMm)} mm)
          </span>
          <button
            type="button"
            className="text-muted hover:text-foreground"
            onClick={() => setMeasureReadout(null)}
          >
            ×
          </button>
        </div>
      ) : null}
      {/* Measure angle readout chip */}
      {measureAngleReadout && planTool === 'measure-angle' ? (
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'auto',
            zIndex: 20,
          }}
          className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs shadow"
          data-testid="measure-angle-readout"
        >
          <span className="font-mono">∠ {measureAngleReadout.angleDeg.toFixed(1)}°</span>
          <button
            type="button"
            className="text-muted hover:text-foreground"
            onClick={() => setMeasureAngleReadout(null)}
          >
            ×
          </button>
        </div>
      ) : null}
      {/* Measure arc readout chip */}
      {measureArcReadout && planTool === 'measure-arc' ? (
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'auto',
            zIndex: 20,
          }}
          className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs shadow"
          data-testid="measure-arc-readout"
        >
          <span className="font-mono">
            Arc: {(measureArcReadout.arcLengthMm / 1000).toFixed(3)} m &nbsp; R:{' '}
            {(measureArcReadout.radiusMm / 1000).toFixed(3)} m
          </span>
          <button
            type="button"
            className="text-muted hover:text-foreground"
            onClick={() => setMeasureArcReadout(null)}
          >
            ×
          </button>
        </div>
      ) : null}
      {/* F-100: multi-select count chip + Filter dialog */}
      {selectedIds.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'auto',
            zIndex: 20,
          }}
          className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs shadow"
          data-testid="multi-select-count"
        >
          <span>{(selectedId ? 1 : 0) + selectedIds.length} elements selected</span>
          <button
            type="button"
            className="rounded px-2 py-0.5 text-xs font-medium text-accent hover:underline"
            data-testid="filter-selection-button"
            onClick={() => setFilterOpen((v) => !v)}
          >
            Filter
          </button>
          <button
            type="button"
            className="text-muted hover:text-foreground"
            onClick={() => {
              useBimStore.getState().clearSelectedIds();
              setFilterOpen(false);
            }}
          >
            ×
          </button>
        </div>
      )}
      {filterOpen && selectedIds.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 116,
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'auto',
            zIndex: 30,
          }}
          className="flex flex-col gap-2 rounded border border-border bg-surface p-3 shadow-lg"
          data-testid="filter-selection-dialog"
        >
          <div className="text-[11px] font-semibold text-foreground">Filter Selection</div>
          {(() => {
            const allIds = [...(selectedId ? [selectedId] : []), ...selectedIds];
            const kindCounts: Record<string, number> = {};
            for (const eid of allIds) {
              const el = elementsById[eid];
              if (el) {
                kindCounts[el.kind] = (kindCounts[el.kind] ?? 0) + 1;
              }
            }
            return Object.entries(kindCounts).map(([kind, count]) => (
              <label
                key={kind}
                className="flex items-center gap-2 text-xs cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  defaultChecked
                  onChange={(e) => {
                    if (!e.target.checked) {
                      // Remove all selectedIds of this kind (but leave selectedId alone)
                      const toRemove = new Set(
                        selectedIds.filter((eid) => elementsById[eid]?.kind === kind),
                      );
                      useBimStore.setState((s) => ({
                        selectedIds: s.selectedIds.filter((eid) => !toRemove.has(eid)),
                      }));
                    }
                  }}
                />
                {kind} ({count})
              </label>
            ));
          })()}
          <button
            type="button"
            className="mt-1 rounded bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
            onClick={() => setFilterOpen(false)}
          >
            Close
          </button>
        </div>
      )}
      {pendingPlanRegion && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'auto',
            zIndex: 40,
          }}
          className="flex flex-col gap-2 rounded border border-border bg-surface p-3 shadow-lg"
          data-testid="cut-plane-dialog"
        >
          <label htmlFor="cut-plane-height" className="text-[11px] font-medium text-foreground">
            Cut-plane height (mm above level)
          </label>
          <input
            id="cut-plane-height"
            autoFocus
            type="number"
            value={pendingPlanRegion.cutPlaneDraft}
            onChange={(e) =>
              setPendingPlanRegion((p) => p && { ...p, cutPlaneDraft: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const r = pendingPlanRegion;
                setPendingPlanRegion(null);
                const offsetMm = parseFloat(r.cutPlaneDraft);
                onSemanticCommand({
                  type: 'createPlanRegion',
                  levelId: r.lvlId,
                  outlineMm: [
                    { xMm: r.x0, yMm: r.y0 },
                    { xMm: r.x1, yMm: r.y0 },
                    { xMm: r.x1, yMm: r.y1 },
                    { xMm: r.x0, yMm: r.y1 },
                  ],
                  cutPlaneOffsetMm: Number.isFinite(offsetMm) ? offsetMm : 900,
                });
              } else if (e.key === 'Escape') {
                setPendingPlanRegion(null);
              }
            }}
            className="rounded border border-border bg-background px-2 py-1 text-xs font-mono text-foreground"
            placeholder="900"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded border border-border px-2 py-0.5 text-[11px] text-muted hover:text-foreground"
              onClick={() => setPendingPlanRegion(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded border border-accent bg-accent/20 px-2 py-0.5 text-[11px] text-foreground hover:bg-accent/40"
              onClick={() => {
                const r = pendingPlanRegion;
                setPendingPlanRegion(null);
                const offsetMm = parseFloat(r.cutPlaneDraft);
                onSemanticCommand({
                  type: 'createPlanRegion',
                  levelId: r.lvlId,
                  outlineMm: [
                    { xMm: r.x0, yMm: r.y0 },
                    { xMm: r.x1, yMm: r.y0 },
                    { xMm: r.x1, yMm: r.y1 },
                    { xMm: r.x0, yMm: r.y1 },
                  ],
                  cutPlaneOffsetMm: Number.isFinite(offsetMm) ? offsetMm : 900,
                });
              }}
            >
              Place Region
            </button>
          </div>
        </div>
      )}
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
        componentPreviewSymbolKind={componentPreviewSymbolKind}
      />
      {/* SKT-01 / SKT-02 / SKT-03 — Sketch authoring overlay. Active when one
          of the *-sketch tools is selected. Commits a Create<Kind> command on
          Finish and otherwise leaves the document untouched. */}
      {(planTool === 'floor-sketch' ||
        planTool === 'roof-sketch' ||
        planTool === 'room-separation-sketch' ||
        planTool === 'masking-region') &&
      modelId &&
      lvlId ? (
        <SketchCanvas
          modelId={modelId}
          levelId={lvlId}
          elementKind={
            planTool === 'roof-sketch'
              ? 'roof'
              : planTool === 'room-separation-sketch'
                ? 'room_separation'
                : planTool === 'masking-region'
                  ? 'masking_region'
                  : 'floor'
          }
          pointerToMmRef={sketchPointerToMmRef}
          mmToScreenRef={sketchMmToScreenRef}
          wallsForPicking={Object.values(elementsById)
            .filter(
              (el): el is Extract<Element, { kind: 'wall' }> =>
                el.kind === 'wall' && (!lvlId || el.levelId === lvlId),
            )
            .map((w) => ({
              id: w.id,
              startMm: { xMm: w.start.xMm, yMm: w.start.yMm },
              endMm: { xMm: w.end.xMm, yMm: w.end.yMm },
              thicknessMm: w.thicknessMm,
            }))}
          floorTypeId={useBimStore.getState().activeFloorTypeId ?? undefined}
          extraOptions={
            planTool === 'masking-region' && activePlanViewId
              ? { hostViewId: activePlanViewId }
              : planTool === 'roof-sketch'
                ? {
                    slopeDeg: initialRoofState().slopeDeg,
                    overhangMm: initialRoofState().eaveOverhangMm,
                  }
                : planTool === 'floor-sketch'
                  ? { offsetMm: useBimStore.getState().floorDrawOffsetMm || undefined }
                  : undefined
          }
          onFinished={(createdId) => {
            setPlanTool('select');
            if (createdId) selectEl(createdId);
          }}
          onCancelled={() => setPlanTool('select')}
        />
      ) : null}
      {/* TOP-V3-03 — Subdivision palette: shown when toposolid_subdivision tool
          is active.  Lets the user pick a finish category before / during sketch. */}
      {planTool === 'toposolid_subdivision' ? (
        <div className="pointer-events-auto absolute top-3 left-1/2 z-20 -translate-x-1/2">
          <SubdivisionPalette
            activeCategory={subdivisionDraft?.finishCategory ?? 'paving'}
            onSelect={(cat) => {
              if (subdivisionDraft) {
                setSubdivisionDraft({ ...subdivisionDraft, finishCategory: cat });
              } else {
                setSubdivisionDraft({
                  hostToposolidId: null,
                  boundaryPts: [],
                  finishCategory: cat,
                });
              }
              // If a draft polygon is in progress, update its category.
              const d = draftRef.current;
              if (d && d.kind === 'toposolid-subdivision') {
                d.finishCategory = cat;
              }
            }}
            onCancel={() => {
              draftRef.current = undefined;
              clearSubdivisionDraft();
              setPlanTool('select');
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
