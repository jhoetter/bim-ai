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
  cycleWallLocationLine,
  areaBoundaryCanClose,
  areaBoundaryRectangleFromDiagonal,
  reduceAreaBoundary,
} from '../tools/toolGrammar';
import * as THREE from 'three';
import { parseDimensionInput } from '@bim-ai/core';
import type { Element, LensMode } from '@bim-ai/core';

import { useBimStore, type PlanTool } from '../state/store';
import type { CategoryOverride } from '../state/storeTypes';
import { useTheme } from '../state/useTheme';
import { lensFilterFromMode, resolveLensFilter } from '../viewport/useLensFilter';
import { liveTokenReader } from '../viewport/materials';
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
import { extractDetailComponentPrimitives } from './detailComponentsRender';
import { extractMaskingRegionPrimitives } from './maskingRegionRender';
import { extractAreaPrimitives } from './areaRender';
import { areaPlanPlacementContext, findAreaPlacementBoundary } from './areaPlacement';
import { manualPlacedTagLabel, placeTagByCategoryCommand } from './manualTags';
import { extractNeighborhoodMassPrimitives } from './neighborhoodMassRender';
import { planAnnotationLabelSprite } from './planElementMeshBuilders';
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
import { SketchCanvas, type MmToScreen, type PointerToMm } from './SketchCanvas';
import { snapPointToNearestWallFaceMm } from './SketchCanvasPickWalls';
import { moveDeltaMm } from './moveTool';
import { wallOffsetMoveCommandFromPoint } from './wallOffsetTool';
import { parseTypedRotateAngle, rotateDeltaAngleFromReference } from './rotateTool';
import { selectNextConnectedWallByTab } from './wallChainSelection';
import { buildWallRadiusFillet, type MmPoint } from './wallRadiusFillet';
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
import {
  familyTypePlacesAsDetailComponent,
  familyTypeRequiresWallHost,
} from '../families/familyPlacementRuntime';
import type { FamilyDefinition } from '../families/types';
import { makePlacedAssetPlanSymbol } from '../viewport/placedAssetRendering';
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
  SubdivisionPalette,
  type SubdivisionCategory,
} from '../workspace/authoring';
import type { ColorSchemeRoomEntry } from './ColorSchemeDialog';

function readPlanToken(name: string, fallback: string): string {
  const v = liveTokenReader().read(name);
  return v && v.trim().length > 0 ? v : fallback;
}

const SLICE_Y = 0.02;

function ComponentPlacementPreviewGlyph({ symbolKind }: { symbolKind?: string }) {
  if (symbolKind === 'toilet') {
    return (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
        <rect x="18" y="8" width="28" height="48" rx="4" fill="#dbeafe" opacity="0.72" />
        <ellipse cx="32" cy="31" rx="15" ry="18" fill="#eff6ff" stroke="#2563eb" strokeWidth="3" />
        <rect
          x="22"
          y="8"
          width="20"
          height="15"
          rx="2"
          fill="#bfdbfe"
          stroke="#2563eb"
          strokeWidth="3"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
      <rect
        x="10"
        y="14"
        width="44"
        height="36"
        rx="3"
        fill="#dbeafe"
        opacity="0.62"
        stroke="#2563eb"
        strokeWidth="3"
      />
      <path d="M14 18 L50 46 M50 18 L14 46" stroke="#2563eb" strokeWidth="2.5" />
    </svg>
  );
}

// B03 — spec 1:5–1:5000 plan scale bounds  half = plotScale * 500mm / 1000
const HALF_MIN = 2.5; // 1:5 (very close)
const HALF_MAX = 2500; // 1:5000 (very far)

function orthoExtents(halfWorldM: number) {
  const stepMm = halfWorldM < 5 ? 250 : halfWorldM < 12 ? 500 : halfWorldM < 24 ? 1000 : 2000;
  const snapMm = Math.max(stepMm * 3, 300);
  return { stepMm, snapMm };
}

function rayToPlanMm(
  renderer: THREE.WebGLRenderer,
  camera: THREE.Camera,
  clientX: number,
  clientY: number,
) {
  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -(((clientY - rect.top) / rect.height) * 2 - 1),
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -SLICE_Y);
  const pt = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, pt)) return null;
  return { xMm: pt.x * 1000, yMm: pt.z * 1000 };
}

type Draft =
  | {
      kind: 'wall';
      sx: number;
      sy: number;
      previousWall?: {
        id: string;
        pathStart: MmPoint;
        pathEnd: MmPoint;
        actualStart: MmPoint;
        actualEnd: MmPoint;
        cornerEndpoint: 'start' | 'end';
      };
    }
  | { kind: 'grid'; sx: number; sy: number }
  | { kind: 'dim'; ax: number; ay: number }
  | { kind: 'measure'; ax: number; ay: number }
  | { kind: 'room_rect'; sx: number; sy: number }
  | { kind: 'reference-plane'; sx: number; sy: number }
  | { kind: 'property-line'; sx: number; sy: number }
  | { kind: 'area-boundary'; verts: Array<{ xMm: number; yMm: number }> }
  | { kind: 'masking-region'; sx: number; sy: number }
  | { kind: 'plan-region'; sx: number; sy: number }
  | {
      kind: 'detail-region';
      verts: Array<{ xMm: number; yMm: number }>;
      closed: boolean;
      hatchId: string | null;
    }
  | {
      kind: 'toposolid-subdivision';
      verts: Array<{ xMm: number; yMm: number }>;
      finishCategory: SubdivisionCategory;
    };

function nearestWallAt(
  elementsById: Record<string, Element>,
  activeLevelId: string | undefined,
  xMm: number,
  yMm: number,
): { wall: Extract<Element, { kind: 'wall' }>; alongT: number; distMm: number } | undefined {
  const px = xMm / 1000;
  const pz = yMm / 1000;
  let best:
    | { wall: Extract<Element, { kind: 'wall' }>; alongT: number; distMm: number }
    | undefined;
  for (const el of Object.values(elementsById)) {
    if (el.kind !== 'wall') continue;
    if (activeLevelId && el.levelId !== activeLevelId) continue;
    const ax = el.start.xMm / 1000;
    const az = el.start.yMm / 1000;
    const bx = el.end.xMm / 1000;
    const bz = el.end.yMm / 1000;
    const abx = bx - ax;
    const abz = bz - az;
    const len2 = abx * abx + abz * abz;
    const rawT = Math.max(
      0,
      Math.min(1, ((px - ax) * abx + (pz - az) * abz) / Math.max(len2, 1e-9)),
    );
    const fx = ax + abx * rawT;
    const fz = az + abz * rawT;
    const distMm = Math.hypot((px - fx) * 1000, (pz - fz) * 1000);
    if (!best || distMm < best.distMm) best = { wall: el, alongT: rawT, distMm };
  }
  return best;
}

function guessGridLabel(sxMm: number, syMm: number, exMm: number, eyMm: number) {
  const horizontal = Math.abs(eyMm - syMm) < Math.abs(exMm - sxMm);
  return horizontal
    ? `Axis ${Math.floor(Math.abs((syMm + 5000) / 3800)) + 1}`
    : String.fromCharCode(66 + Math.min(10, Math.floor(Math.abs(exMm - sxMm + 8200) / 4200)));
}

/** F-025: Format an elevation in mm as ±X.XXX m for the plan canvas badge. */
function fmtElev(mm: number): string {
  const m = mm / 1000;
  if (Math.abs(m) < 0.0005) return '±0.000 m';
  return `${m >= 0 ? '+' : '−'}${Math.abs(m).toFixed(3)} m`;
}

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
  const alignStateRef = useRef<AlignState>(initialAlignState());
  // F-121: React state mirror of alignStateRef.current.referenceMm so SVG overlay re-renders.
  const [alignReferenceMm, setAlignReferenceMm] = useState<{
    xMm: number;
    yMm: number;
  } | null>(null);
  const mirrorAxisStartRef = useRef<{ xMm: number; yMm: number } | null>(null);
  const copyAnchorRef = useRef<{ xMm: number; yMm: number } | null>(null);
  const [copyAnchorSet, setCopyAnchorSet] = useState(false);
  const moveAnchorRef = useRef<{ xMm: number; yMm: number } | null>(null);
  const [moveAnchorSet, setMoveAnchorSet] = useState(false);
  const rotateAnchorRef = useRef<{ xMm: number; yMm: number } | null>(null);
  const [rotateAnchorSet, setRotateAnchorSet] = useState(false);
  const rotateReferenceRef = useRef<{ xMm: number; yMm: number } | null>(null);
  const [rotateReferenceSet, setRotateReferenceSet] = useState(false);
  const splitStateRef = useRef<SplitState>(initialSplitState());
  const trimStateRef = useRef<TrimState>(initialTrimState());
  const trimExtendFirstWallRef = useRef<string | null>(null);
  const [trimExtendFirstWallSet, setTrimExtendFirstWallSet] = useState(false);
  const wallJoinStateRef = useRef<WallJoinState>(initialWallJoinState());
  const wallOpeningStateRef = useRef<WallOpeningState>(initialWallOpeningState());
  const wallOpeningAnchorRef = useRef<{ xMm: number; yMm: number } | null>(null);
  const shaftStateRef = useRef<ShaftState>(initialShaftState());
  const columnStateRef = useRef<ColumnState>(initialColumnState());
  const beamStateRef = useRef<BeamState>(initialBeamState());
  const ceilingStateRef = useRef<CeilingState>(initialCeilingState());
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
  const lastKeyRef = useRef<{ key: string; time: number } | null>(null);
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
  const [dxfQueryHover, setDxfQueryHover] = useState<DxfPrimitiveQueryHit | null>(null);
  const [dxfQueryDialog, setDxfQueryDialog] = useState<{
    hit: DxfPrimitiveQueryHit;
    position: { x: number; y: number };
  } | null>(null);
  const [geomEpoch, bumpGeom] = useState(0);
  const [measureReadout, setMeasureReadout] = useState<{ distMm: number } | null>(null);
  const [wallDraftNotice, setWallDraftNotice] = useState<string | null>(null);
  const [wallPickLineHint, setWallPickLineHint] = useState<PickedWallLine | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  // D8 - Color fill scheme: user-selected category and color overrides.
  const [colorFillScheme, setColorFillScheme] = useState<{
    category: string;
    colorMap: Record<string, string>;
  } | null>(null);
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
    if (el && el.kind === 'level') return el as { name: string; elevationMm: number };
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
    copyAnchorRef.current = null;
    setCopyAnchorSet(false);
    moveAnchorRef.current = null;
    setMoveAnchorSet(false);
    rotateAnchorRef.current = null;
    setRotateAnchorSet(false);
    rotateReferenceRef.current = null;
    setRotateReferenceSet(false);
    setNumericInput(null);
    splitStateRef.current = initialSplitState();
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
    } else if (planTool === 'ceiling') {
      ceilingStateRef.current = initialCeilingState();
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
          : resolveLensFilter(planView && 'defaultLens' in planView ? planView : null);
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
        // Centroid tag — canvas-texture sprite with "name · X.XX m²".
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx2 = canvas.getContext('2d');
        if (ctx2) {
          ctx2.fillStyle = areaBoundaryReveal ? '#ff00ff' : '#d2363b';
          ctx2.font = '28px sans-serif';
          ctx2.textBaseline = 'middle';
          ctx2.textAlign = 'center';
          ctx2.fillText(a.tagLabel, 128, 32);
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
        sprite.scale.set(2.4, 0.6, 1);
        sprite.position.set(a.centroidMm.xMm / 1000, SLICE_Y + 0.012, a.centroidMm.yMm / 1000);
        sprite.userData.areaElement = true;
        sprite.userData.bimPickId = a.id;
        grp.add(sprite);
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
            ctx2.fillStyle = textNoteReveal ? '#ff00ff' : p.colour;
            ctx2.font = `${Math.max(12, Math.round(48))}px sans-serif`;
            ctx2.textBaseline = 'top';
            ctx2.fillText(p.text, 4, 4);
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
        } else if (
          p.kind === 'annotation_symbol' ||
          p.kind === 'spot_elevation' ||
          p.kind === 'spot_coordinate' ||
          p.kind === 'spot_slope' ||
          p.kind === 'material_tag'
        ) {
          const lt =
            p.kind === 'spot_elevation'
              ? `${p.prefix}${(p.elevationMm / 1000).toFixed(3)}${p.suffix}`
              : p.kind === 'spot_coordinate'
                ? `N${(p.northMm / 1000).toFixed(2)} E${(p.eastMm / 1000).toFixed(2)}`
                : p.kind === 'spot_slope'
                  ? `${p.slopePct.toFixed(1)}%`
                  : p.kind === 'material_tag'
                    ? (p.textOverride ?? 'Material')
                    : p.symbolType;
          const ac = document.createElement('canvas');
          ac.width = 256;
          ac.height = 64;
          const ac2 = ac.getContext('2d');
          if (ac2) {
            ac2.fillStyle = p.colour;
            ac2.font = '28px sans-serif';
            ac2.textBaseline = 'middle';
            ac2.fillText(lt, 4, 32);
          }
          const aTex = new THREE.CanvasTexture(ac);
          aTex.minFilter = THREE.LinearFilter;
          const aS = new THREE.Sprite(new THREE.SpriteMaterial({ map: aTex, transparent: true }));
          aS.scale.set(0.3 * (256 / 64), 0.3, 1);
          const aPos = 'positionMm' in p ? p.positionMm : { xMm: 0, yMm: 0 };
          aS.position.set(aPos.xMm / 1000, SLICE_Y + 0.01, aPos.yMm / 1000);
          aS.userData.detailComponent = true;
          aS.userData.bimPickId = p.id;
          grp.add(aS);
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
          const rC = document.createElement('canvas');
          rC.width = 192;
          rC.height = 64;
          const rCtx = rC.getContext('2d');
          if (rCtx) {
            rCtx.fillStyle = p.colour;
            rCtx.font = '28px sans-serif';
            rCtx.textBaseline = 'middle';
            rCtx.fillText(rLbl, 4, 32);
          }
          const rTex = new THREE.CanvasTexture(rC);
          rTex.minFilter = THREE.LinearFilter;
          const rS = new THREE.Sprite(new THREE.SpriteMaterial({ map: rTex, transparent: true }));
          rS.scale.set(0.25 * (192 / 64), 0.25, 1);
          rS.position.set(
            (p.arcPointMm.xMm + p.centerMm.xMm) / 2 / 1000,
            SLICE_Y + 0.01,
            (p.arcPointMm.yMm + p.centerMm.yMm) / 2 / 1000,
          );
          rS.userData.detailComponent = true;
          rS.userData.bimPickId = p.id;
          grp.add(rS);
        } else if (p.kind === 'arc_length_dimension') {
          const midRad = (((p.startAngleDeg + p.endAngleDeg) / 2) * Math.PI) / 180;
          const arcLen = ((Math.abs(p.endAngleDeg - p.startAngleDeg) * Math.PI) / 180) * p.radiusMm;
          const aLC = document.createElement('canvas');
          aLC.width = 192;
          aLC.height = 64;
          const aLCtx = aLC.getContext('2d');
          if (aLCtx) {
            aLCtx.fillStyle = '#404040';
            aLCtx.font = '28px sans-serif';
            aLCtx.textBaseline = 'middle';
            aLCtx.fillText(`arc ${arcLen.toFixed(0)}`, 4, 32);
          }
          const aLTex = new THREE.CanvasTexture(aLC);
          aLTex.minFilter = THREE.LinearFilter;
          const aLS = new THREE.Sprite(new THREE.SpriteMaterial({ map: aLTex, transparent: true }));
          aLS.scale.set(0.25 * (192 / 64), 0.25, 1);
          aLS.position.set(
            p.centerMm.xMm / 1000 + (p.radiusMm / 1000) * Math.cos(midRad),
            SLICE_Y + 0.01,
            p.centerMm.yMm / 1000 + (p.radiusMm / 1000) * Math.sin(midRad),
          );
          aLS.userData.detailComponent = true;
          aLS.userData.bimPickId = p.id;
          grp.add(aLS);
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
          const angC = document.createElement('canvas');
          angC.width = 192;
          angC.height = 64;
          const angCtx = angC.getContext('2d');
          if (angCtx) {
            angCtx.fillStyle = p.colour;
            angCtx.font = '28px sans-serif';
            angCtx.textBaseline = 'middle';
            angCtx.fillText(`${angDeg.toFixed(1)}°`, 4, 32);
          }
          const angTex = new THREE.CanvasTexture(angC);
          angTex.minFilter = THREE.LinearFilter;
          const angS = new THREE.Sprite(
            new THREE.SpriteMaterial({ map: angTex, transparent: true }),
          );
          const mA = (aA + aB) / 2,
            aR = p.arcRadiusMm / 1000;
          angS.scale.set(0.25 * (192 / 64), 0.25, 1);
          angS.position.set(
            p.vertexMm.xMm / 1000 + aR * Math.cos(mA),
            SLICE_Y + 0.01,
            p.vertexMm.yMm / 1000 + aR * Math.sin(mA),
          );
          angS.userData.detailComponent = true;
          angS.userData.bimPickId = p.id;
          grp.add(angS);
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
        if (placedTagReveal || (revealHiddenMode && display.hiddenElementIds.has(tag.id))) {
          sprite.material.color.set('#ff00ff');
        }
        grp.add(sprite);
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
  ]);

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
      if (marqueeLineRef.current) {
        grp.remove(marqueeLineRef.current);
        marqueeLineRef.current.geometry.dispose();
        marqueeLineRef.current = null;
      }
    };

    const redrawMarqueeRect = (
      x0Mm: number,
      y0Mm: number,
      x1Mm: number,
      y1Mm: number,
      crossing: boolean,
    ) => {
      clearMarqueeLine();
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
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = crossing
        ? new THREE.LineDashedMaterial({
            color: readPlanToken('--draft-construction-blue', '#fcd34d'),
            dashSize: 0.3,
            gapSize: 0.15,
          })
        : new THREE.LineBasicMaterial({
            color: readPlanToken('--draft-construction-blue', '#fcd34d'),
          });
      const line = new THREE.Line(geo, mat);
      if (crossing) line.computeLineDistances();
      marqueeLineRef.current = line;
      grp.add(line);
    };

    const tintComponentGhost = (ghost: THREE.Group): THREE.Group => {
      ghost.traverse((child) => {
        const material = (child as THREE.Mesh | THREE.Line).material;
        if (!material) return;
        const materials = Array.isArray(material) ? material : [material];
        for (const mat of materials) {
          if ('transparent' in mat) mat.transparent = true;
          if ('opacity' in mat) mat.opacity = Math.min(Number(mat.opacity) || 1, 0.68);
          if ('depthWrite' in mat) mat.depthWrite = false;
        }
      });
      return ghost;
    };

    const buildComponentGhost = ({
      entry,
      widthMm,
      heightMm,
      rotDeg,
    }: {
      entry?: Extract<Element, { kind: 'asset_library_entry' }>;
      widthMm: number;
      heightMm: number;
      rotDeg: number;
    }): THREE.Group => {
      if (entry) {
        const asset: Extract<Element, { kind: 'placed_asset' }> = {
          kind: 'placed_asset',
          id: '__component_ghost__',
          name: entry.name,
          assetId: entry.id,
          levelId: activeLevelResolvedId,
          positionMm: { xMm: 0, yMm: 0 },
          rotationDeg: rotDeg,
          paramValues: {},
        };
        return tintComponentGhost(
          makePlacedAssetPlanSymbol(asset, entry, {
            y: SLICE_Y + 0.018,
            color: readPlanToken('--draft-construction-blue', '#2563eb'),
            minFootprintM: 1.8,
          }),
        );
      }
      const g = new THREE.Group();
      const hw = widthMm / 2000;
      const hd = heightMm / 2000;
      const pts = [
        -hw,
        SLICE_Y,
        -hd,
        hw,
        SLICE_Y,
        -hd,
        hw,
        SLICE_Y,
        -hd,
        hw,
        SLICE_Y,
        hd,
        hw,
        SLICE_Y,
        hd,
        -hw,
        SLICE_Y,
        hd,
        -hw,
        SLICE_Y,
        hd,
        -hw,
        SLICE_Y,
        -hd,
        // diagonal cross
        -hw,
        SLICE_Y,
        -hd,
        hw,
        SLICE_Y,
        hd,
        hw,
        SLICE_Y,
        -hd,
        -hw,
        SLICE_Y,
        hd,
      ];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const mat = new THREE.LineBasicMaterial({ color: 0x8b7355, opacity: 0.6, transparent: true });
      const mesh = new THREE.LineSegments(geo, mat);
      g.add(mesh);
      g.rotation.y = (rotDeg * Math.PI) / 180;
      return tintComponentGhost(g);
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
      if (
        (planTool === 'wall' && d?.kind === 'wall') ||
        (planTool === 'grid' && d?.kind === 'grid') ||
        (planTool === 'dimension' && d?.kind === 'dim') ||
        (planTool === 'measure' && d?.kind === 'measure')
      ) {
        const pv =
          planTool === 'wall' && d?.kind === 'wall'
            ? new THREE.Vector3(d.sx / 1000, SLICE_Y, d.sy / 1000)
            : planTool === 'grid' && d?.kind === 'grid'
              ? new THREE.Vector3(d.sx / 1000, SLICE_Y, d.sy / 1000)
              : planTool === 'dimension' && d?.kind === 'dim'
                ? new THREE.Vector3(d.ax / 1000, SLICE_Y, d.ay / 1000)
                : planTool === 'measure' && d?.kind === 'measure'
                  ? new THREE.Vector3(d.ax / 1000, SLICE_Y, d.ay / 1000)
                  : p;
        redrawSeg(pv, p);
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

      if (marqueeRef.current.active && marqueeRef.current.direction) {
        const { sx, sy, ex, ey, direction } = marqueeRef.current;
        clearMarqueeLine();
        marqueeRef.current = { active: false, sx: 0, sy: 0, ex: 0, ey: 0, direction: null };

        const xMin = Math.min(sx, ex);
        const xMax = Math.max(sx, ex);
        const yMin = Math.min(sy, ey);
        const yMax = Math.max(sy, ey);

        // Build an asset_library_entry lookup for placed_asset thumbnail sizes.
        const assetEntries: Record<
          string,
          { thumbnailWidthMm?: number; thumbnailHeightMm?: number }
        > = {};
        for (const el of Object.values(elementsById)) {
          if (el.kind === 'asset_library_entry') {
            assetEntries[el.id] = el as { thumbnailWidthMm?: number; thumbnailHeightMm?: number };
          }
        }

        // Helper: derive axis-aligned bbox for each selectable element kind.
        const getElBbox = (
          el: Element,
        ): { xMin: number; xMax: number; yMin: number; yMax: number } | null => {
          if (el.kind === 'wall') {
            return {
              xMin: Math.min(el.start.xMm, el.end.xMm),
              xMax: Math.max(el.start.xMm, el.end.xMm),
              yMin: Math.min(el.start.yMm, el.end.yMm),
              yMax: Math.max(el.start.yMm, el.end.yMm),
            };
          }
          if (el.kind === 'column') {
            const r = 200;
            return {
              xMin: el.positionMm.xMm - r,
              xMax: el.positionMm.xMm + r,
              yMin: el.positionMm.yMm - r,
              yMax: el.positionMm.yMm + r,
            };
          }
          if (el.kind === 'placed_asset') {
            const entry = assetEntries[el.assetId];
            const hw = (entry?.thumbnailWidthMm ?? 1000) / 2;
            const hd = (entry?.thumbnailHeightMm ?? 600) / 2;
            return {
              xMin: el.positionMm.xMm - hw,
              xMax: el.positionMm.xMm + hw,
              yMin: el.positionMm.yMm - hd,
              yMax: el.positionMm.yMm + hd,
            };
          }
          if (el.kind === 'room') {
            const pts = el.outlineMm;
            if (!pts || pts.length === 0) return null;
            return {
              xMin: Math.min(...pts.map((p) => p.xMm)),
              xMax: Math.max(...pts.map((p) => p.xMm)),
              yMin: Math.min(...pts.map((p) => p.yMm)),
              yMax: Math.max(...pts.map((p) => p.yMm)),
            };
          }
          if (el.kind === 'floor' || el.kind === 'area') {
            const pts = el.boundaryMm;
            if (!pts || pts.length === 0) return null;
            return {
              xMin: Math.min(...pts.map((p) => p.xMm)),
              xMax: Math.max(...pts.map((p) => p.xMm)),
              yMin: Math.min(...pts.map((p) => p.yMm)),
              yMax: Math.max(...pts.map((p) => p.yMm)),
            };
          }
          return null;
        };

        const ids: string[] = [];
        for (const el of Object.values(elementsById)) {
          // Level filter — use optional chaining since not all kinds have levelId.
          if (displayLevelId && (el as { levelId?: string }).levelId !== displayLevelId) continue;
          const bbox = getElBbox(el);
          if (!bbox) continue;
          if (direction === 'left-to-right') {
            // Window select: element bbox must be fully enclosed in marquee.
            if (bbox.xMin >= xMin && bbox.xMax <= xMax && bbox.yMin >= yMin && bbox.yMax <= yMax) {
              ids.push(el.id);
            }
          } else {
            // Crossing select: element bbox intersects marquee.
            if (bbox.xMax >= xMin && bbox.xMin <= xMax && bbox.yMax >= yMin && bbox.yMin <= yMax) {
              ids.push(el.id);
            }
          }
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
        const h = hits.find(
          (x) => typeof (x.object.userData as { bimPickId?: unknown }).bimPickId === 'string',
        );
        const id =
          typeof (h?.object.userData as { bimPickId?: unknown }).bimPickId === 'string'
            ? (h!.object.userData as { bimPickId: string }).bimPickId
            : undefined;
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
      if (planTool === 'dimension') {
        const d = draftRef.current;
        if (!d || d.kind !== 'dim') {
          draftRef.current = { kind: 'dim', ax: sp.xMm, ay: sp.yMm };
          bumpGeom((x) => x + 1);
          return;
        }
        const dx = sp.xMm - d.ax;
        const dy = sp.yMm - d.ay;
        const m = Math.hypot(dx, dy) || 1;
        onSemanticCommand({
          type: 'createDimension',
          levelId: lvlId,
          aMm: { xMm: d.ax, yMm: d.ay },
          bMm: { xMm: sp.xMm, yMm: sp.yMm },
          offsetMm: { xMm: (-dy / m) * 450, yMm: (dx / m) * 450 },
        });
        draftRef.current = undefined;
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
          bumpGeom((x) => x + 1);
          return;
        }
        // Second click: fire mirrorElements with the selected element
        const axisStart = mirrorAxisStartRef.current;
        mirrorAxisStartRef.current = null;
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
            // Pick the floor under the centroid of the sketch loop.
            const centroid = effect.commitShaft.verticesMm.reduce(
              (acc, p) => ({ xMm: acc.xMm + p.xMm, yMm: acc.yMm + p.yMm }),
              { xMm: 0, yMm: 0 },
            );
            centroid.xMm /= effect.commitShaft.verticesMm.length;
            centroid.yMm /= effect.commitShaft.verticesMm.length;
            const hostFloor = Object.values(elementsById).find(
              (e): e is Extract<Element, { kind: 'floor' }> =>
                e.kind === 'floor' && (!displayLevelId || e.levelId === displayLevelId),
            );
            if (hostFloor) {
              onSemanticCommand({
                type: 'createSlabOpening',
                hostFloorId: hostFloor.id,
                boundaryMm: effect.commitShaft.verticesMm.map((p) => ({ xMm: p.xMm, yMm: p.yMm })),
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
          onSemanticCommand({
            type: 'createColumn',
            levelId: lvlId,
            positionMm: effect.commitColumn.positionMm,
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
            onSemanticCommand({
              type: 'createCeiling',
              levelId: lvlId,
              boundaryMm: effect.commitCeiling.verticesMm.map((p) => ({
                xMm: p.xMm,
                yMm: p.yMm,
              })),
            });
          }
        } else {
          const { state } = reduceCeiling(ceilingStateRef.current, { kind: 'click', pointMm: sp });
          ceilingStateRef.current = state;
        }
        bumpGeom((x) => x + 1);
        return;
      }
      if (planTool === 'room') {
        if (!lvlId || !sp) return;
        onSemanticCommand({
          type: 'placeRoomAtPoint',
          id: crypto.randomUUID(),
          levelId: lvlId,
          clickXMm: sp.xMm,
          clickYMm: sp.yMm,
          name: 'Room',
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
      if (!ev.metaKey && !ev.ctrlKey && !ev.altKey) {
        const now = Date.now();
        const last = lastKeyRef.current;
        if (last && last.key === 's' && now - last.time <= 500) {
          type OverrideEntry = { key: string; kind: ToggleableSnapKind; label: string };
          const SNAP_OVERRIDE_MAP: OverrideEntry[] = [
            { key: 'i', kind: 'intersection', label: 'Intersection' },
            { key: 'e', kind: 'endpoint', label: 'Endpoint' },
            { key: 'm', kind: 'midpoint', label: 'Midpoint' },
            { key: 'n', kind: 'nearest', label: 'Nearest' },
            { key: 'c', kind: 'center', label: 'Center' },
            { key: 'p', kind: 'perpendicular', label: 'Perpendicular' },
            { key: 'x', kind: 'extension', label: 'Extension' },
            { key: 'w', kind: 'workplane', label: 'Work Plane' },
          ];
          const match = SNAP_OVERRIDE_MAP.find((o) => o.key === ev.key.toLowerCase());
          if (match) {
            ev.preventDefault();
            snapOverrideRef.current = match.kind;
            setSnapOverrideDisplay(match.kind);
            lastKeyRef.current = null;
          } else {
            lastKeyRef.current = null;
          }
        } else if (ev.key.toLowerCase() === 's') {
          lastKeyRef.current = { key: 's', time: now };
        } else {
          lastKeyRef.current = null;
        }
      }
      if (ev.key === 'Escape') {
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
        } else if (planTool === 'ceiling') {
          ceilingStateRef.current = initialCeilingState();
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

  return (
    <div
      data-testid="plan-canvas"
      className="relative h-full w-full overflow-hidden bg-canvas-paper"
    >
      {wallContextMenu && (
        <WallContextMenu
          wall={wallContextMenu.wall}
          position={wallContextMenu.position}
          onCommand={handleWallContextMenuCommand}
          onClose={() => setWallContextMenu(null)}
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
      {/* F-080 — snap override chip: shown when a one-shot snap override is active */}
      {snapOverrideDisplay ? (
        <div
          style={{
            position: 'absolute',
            bottom: 72,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
          }}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-400/60 bg-amber-500/10 px-3 py-1 text-xs text-amber-300 shadow"
          data-testid="snap-override-chip"
        >
          <span>
            {(() => {
              const SNAP_SHORTCODE: Partial<Record<ToggleableSnapKind, string>> = {
                intersection: 'SI',
                endpoint: 'SE',
                midpoint: 'SM',
                nearest: 'SN',
                center: 'SC',
                perpendicular: 'SP',
                extension: 'SX',
                workplane: 'SW',
                parallel: 'SA',
                tangent: 'ST',
                grid: 'SG',
              };
              const code = SNAP_SHORTCODE[snapOverrideDisplay];
              const label =
                snapOverrideDisplay === 'workplane'
                  ? 'Work Plane'
                  : snapOverrideDisplay.charAt(0).toUpperCase() + snapOverrideDisplay.slice(1);
              return `Snap: ${label}${code ? ` [${code}]` : ''} (next pick only)`;
            })()}
          </span>
          <button
            type="button"
            className="ml-1 text-amber-400 hover:text-amber-200"
            aria-label="Cancel snap override"
            onClick={() => {
              snapOverrideRef.current = null;
              setSnapOverrideDisplay(null);
            }}
          >
            ×
          </button>
        </div>
      ) : null}
      {/* Copy tool status chips — F-116 multi-copy mode */}
      {planTool === 'copy' && !copyAnchorSet ? (
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 20,
          }}
          className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs shadow"
          data-testid="copy-tool-chip"
        >
          <span>Click reference point · hold Shift to constrain</span>
        </div>
      ) : null}
      {planTool === 'copy' && copyAnchorSet ? (
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 20,
          }}
          className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs shadow"
          data-testid="copy-tool-chip"
        >
          <span>Click destination point to complete copy</span>
        </div>
      ) : null}
      {/* F-091 — Room tool status chip: single-click placement hint */}
      {planTool === 'room' ? (
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 20,
          }}
          className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs shadow"
          data-testid="room-tool-chip"
        >
          <span>Click inside an enclosed area to place a room</span>
        </div>
      ) : null}
      {/* F-103 — Move tool overlay: dot at anchor + dashed line to cursor */}
      {planTool === 'move' && moveAnchorSet && moveAnchorRef.current
        ? (() => {
            const anchorPx = worldToScreen(moveAnchorRef.current);
            const cursorPx = hudMm ? worldToScreen(hudMm) : null;
            return (
              <>
                <svg
                  data-testid="move-tool-overlay"
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 15,
                    overflow: 'visible',
                  }}
                >
                  {/* Dot at reference point */}
                  <circle
                    cx={anchorPx.pxX}
                    cy={anchorPx.pxY}
                    r="5"
                    fill="hsl(var(--color-accent, 220 90% 56%))"
                    opacity="0.9"
                  />
                  {/* Dashed line from reference to cursor */}
                  {cursorPx ? (
                    <line
                      x1={anchorPx.pxX}
                      y1={anchorPx.pxY}
                      x2={cursorPx.pxX}
                      y2={cursorPx.pxY}
                      stroke="hsl(var(--color-accent, 220 90% 56%))"
                      strokeWidth="1.5"
                      strokeDasharray="6 3"
                      opacity="0.7"
                    />
                  ) : null}
                </svg>
                <div
                  data-testid="move-tool-chip"
                  aria-live="polite"
                  style={{
                    position: 'absolute',
                    bottom: 48,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    pointerEvents: 'none',
                    zIndex: 20,
                  }}
                  className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs shadow"
                >
                  <span>Click destination point to move selection</span>
                </div>
              </>
            );
          })()
        : null}
      {planTool === 'move' && !moveAnchorSet ? (
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 20,
          }}
          className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs shadow"
          data-testid="move-tool-chip"
        >
          <span>Click reference point</span>
        </div>
      ) : null}
      {planTool === 'offset' ? (
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 20,
          }}
          className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs shadow"
          data-testid="offset-tool-chip"
        >
          <span>Click the target side/distance for the selected wall</span>
        </div>
      ) : null}
      {/* F-122 — Rotate tool overlay: shown after the first click (center set), waiting for angle click. */}
      {planTool === 'rotate' && rotateAnchorSet && rotateAnchorRef.current
        ? (() => {
            const anchorPx = worldToScreen(rotateAnchorRef.current);
            const referencePx = rotateReferenceRef.current
              ? worldToScreen(rotateReferenceRef.current)
              : null;
            const cursorPx = hudMm ? worldToScreen(hudMm) : null;
            return (
              <>
                <svg
                  data-testid="rotate-tool-overlay"
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 15,
                    overflow: 'visible',
                  }}
                >
                  {/* Circle around the rotation center */}
                  <circle
                    cx={anchorPx.pxX}
                    cy={anchorPx.pxY}
                    r="12"
                    fill="none"
                    stroke="hsl(var(--color-accent, 220 90% 56%))"
                    strokeWidth="1.5"
                    opacity="0.8"
                  />
                  {/* Center dot */}
                  <circle
                    cx={anchorPx.pxX}
                    cy={anchorPx.pxY}
                    r="3"
                    fill="hsl(var(--color-accent, 220 90% 56%))"
                    opacity="0.9"
                  />
                  {/* Start-angle reference ray, then live end-angle ray. */}
                  {referencePx ? (
                    <line
                      x1={anchorPx.pxX}
                      y1={anchorPx.pxY}
                      x2={referencePx.pxX}
                      y2={referencePx.pxY}
                      stroke="hsl(var(--color-accent, 220 90% 56%))"
                      strokeWidth="2"
                      opacity="0.85"
                    />
                  ) : null}
                  {cursorPx ? (
                    <line
                      x1={anchorPx.pxX}
                      y1={anchorPx.pxY}
                      x2={cursorPx.pxX}
                      y2={cursorPx.pxY}
                      stroke="hsl(var(--color-accent, 220 90% 56%))"
                      strokeWidth="1"
                      strokeDasharray="5 3"
                      opacity="0.7"
                    />
                  ) : null}
                </svg>
                <div
                  data-testid="rotate-tool-chip"
                  aria-live="polite"
                  style={{
                    position: 'absolute',
                    bottom: 48,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    pointerEvents: 'none',
                    zIndex: 20,
                  }}
                  className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs shadow"
                >
                  <span>
                    {rotateReferenceSet
                      ? 'Click end ray or type angle + Enter'
                      : 'Click start reference ray'}
                  </span>
                </div>
              </>
            );
          })()
        : null}
      {/* F-121 — Align tool reference line overlay: shown after the first click (reference set).
          Draws a dashed crosshair SVG at the reference point so the user can see the snap target
          before clicking a wall to align. Resets when alignment commits or Esc is pressed. */}
      {planTool === 'align' && alignReferenceMm
        ? (() => {
            const refPx = worldToScreen(alignReferenceMm);
            return (
              <>
                {/* Dashed crosshair SVG spanning the full canvas */}
                <svg
                  data-testid="align-reference-overlay"
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 15,
                    overflow: 'visible',
                  }}
                >
                  {/* Horizontal reference line */}
                  <line
                    x1="0"
                    y1={refPx.pxY}
                    x2="100%"
                    y2={refPx.pxY}
                    stroke="hsl(var(--color-accent, 220 90% 56%))"
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                    opacity="0.75"
                  />
                  {/* Vertical reference line */}
                  <line
                    x1={refPx.pxX}
                    y1="0"
                    x2={refPx.pxX}
                    y2="100%"
                    stroke="hsl(var(--color-accent, 220 90% 56%))"
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                    opacity="0.75"
                  />
                  {/* Crosshair dot at reference point */}
                  <circle
                    cx={refPx.pxX}
                    cy={refPx.pxY}
                    r="4"
                    fill="hsl(var(--color-accent, 220 90% 56%))"
                    opacity="0.9"
                  />
                  {/* Coordinate label */}
                  <text
                    x={refPx.pxX + 8}
                    y={refPx.pxY - 6}
                    fontSize="10"
                    fontFamily="var(--font-mono, monospace)"
                    fill="hsl(var(--color-accent, 220 90% 56%))"
                    opacity="0.85"
                  >
                    {`X ${(alignReferenceMm.xMm / 1000).toFixed(2)} m · Y ${(alignReferenceMm.yMm / 1000).toFixed(2)} m`}
                  </text>
                </svg>
                {/* Status chip — prompt for second click */}
                <div
                  data-testid="align-tool-chip"
                  aria-live="polite"
                  style={{
                    position: 'absolute',
                    bottom: 48,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    pointerEvents: 'none',
                    zIndex: 20,
                  }}
                  className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs shadow"
                >
                  <span>Click near a wall to align it to the reference line</span>
                </div>
              </>
            );
          })()
        : null}
      {/* Trim-extend tool status chip */}
      {planTool === 'trim-extend' ? (
        <div
          data-testid="trim-extend-tool-chip"
          aria-live="polite"
          style={{
            position: 'absolute',
            bottom: 48,
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 20,
          }}
          className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs shadow"
        >
          <span>
            {trimExtendFirstWallSet
              ? 'Click second wall to extend to corner'
              : 'Click a wall to trim/extend'}
          </span>
        </div>
      ) : null}
      {/* Scale readout — canvas-local status only (no command toolbar behavior). */}
      <div className="pointer-events-auto absolute left-3 bottom-3 z-10">
        <div
          data-testid="plan-scale-readout"
          title="Scale readout · scroll to zoom · Space+drag to pan"
          className="flex items-center gap-1.5 rounded border border-border bg-surface/80 px-2 py-1 font-mono text-[10px] text-muted backdrop-blur"
        >
          {/* Graphical scale bar: a horizontal rule + dimension text */}
          <span aria-hidden="true" className="flex flex-col items-center gap-0.5">
            <span className="flex h-[7px] w-[36px] items-end">
              <span className="h-[5px] w-[18px] border border-r-0 border-muted/60 bg-muted/20" />
              <span className="h-[5px] w-[18px] border border-muted/60 bg-surface/80" />
            </span>
            <span>{`${(sb * 100).toFixed(0)} cm`}</span>
          </span>
          <span className="ml-1 text-foreground/70">1:{plotScaleN}</span>
        </div>
      </div>
      {/* F-025: Revit-style active level datum line across the plan canvas. */}
      {activeLevelElem && (
        <>
          <div
            data-testid="plan-level-datum-line"
            className="pointer-events-none absolute left-0 right-0 top-7 z-10"
            aria-hidden="true"
          >
            <div
              className="absolute left-2 right-10 top-0 border-t border-dashed"
              style={{ borderColor: 'rgba(37, 99, 235, 0.9)' }}
            />
            <div
              className="absolute right-3 -top-[7px] h-3.5 w-3.5 rounded-full border bg-surface"
              style={{ borderColor: 'rgba(37, 99, 235, 0.9)' }}
            />
          </div>
          <div
            data-testid="plan-level-elevation-badge"
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              backgroundColor: 'rgba(30, 58, 138, 0.85)',
              color: 'white',
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 11,
              fontFamily: 'monospace',
              pointerEvents: 'none',
              zIndex: 11,
              userSelect: 'none',
            }}
          >
            <span data-testid="plan-work-plane-badge">
              Work plane · {activeLevelElem.name} | {fmtElev(activeLevelElem.elevationMm ?? 0)}
            </span>
          </div>
        </>
      )}
      {/* North point — architectural drawing convention, always aligned to grid north (up). */}
      <div className="pointer-events-none absolute left-3 bottom-14 z-10 opacity-55">
        <svg
          width="26"
          height="30"
          viewBox="0 0 26 30"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-foreground"
        >
          {/* Filled north half of circle */}
          <path d="M13 2 A11 11 0 0 1 24 13 L13 13 Z" fill="currentColor" />
          {/* Circle outline */}
          <circle cx="13" cy="13" r="11" stroke="currentColor" strokeWidth="1" />
          {/* Center crosshair dot */}
          <circle cx="13" cy="13" r="1.5" fill="currentColor" />
          {/* N label */}
          <text
            x="13"
            y="29"
            textAnchor="middle"
            fontSize="8"
            fontWeight="600"
            fontFamily="Inter,system-ui,sans-serif"
            fill="currentColor"
          >
            N
          </text>
        </svg>
      </div>
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
      {/* EDT-01 / F-122 — numeric override input rendered at the cursor. */}
      {numericInput &&
      (gripDragRef.current || (planTool === 'rotate' && rotateAnchorSet && rotateReferenceSet)) ? (
        <div
          data-testid="grip-numeric-input"
          style={{
            position: 'absolute',
            left: numericInput.pxX + 12,
            top: numericInput.pxY + 12,
            zIndex: 20,
            pointerEvents: 'none',
            background: 'rgba(20,28,42,0.92)',
            border: '1px solid var(--color-accent)',
            borderRadius: 3,
            color: 'var(--color-accent)',
            fontFamily:
              'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
            fontSize: 'var(--text-2xs, 10px)',
            lineHeight: 'var(--text-2xs-line, 14px)',
            fontFeatureSettings: '"tnum"',
            padding: '2px 6px',
            minWidth: 60,
          }}
        >
          {numericInput.value || '0'}
          <span style={{ opacity: 0.6 }}>
            {planTool === 'rotate' && rotateAnchorSet && rotateReferenceSet ? ' deg' : ' mm'} ·
            Enter
          </span>
        </div>
      ) : null}
      {/* EDT-05 — snap glyph layer (×, ⊥, dot+dash) above the canvas. */}
      <SnapGlyphLayer
        candidates={snapGlyphState.candidates}
        activeIndex={snapGlyphState.activeIndex}
      />
      {/* EDT-V3-05 — LOOP cursor chip: shown when loop mode is active and a chained
          drawing tool (Wall or Beam) is in use. Follows the cursor. */}
      {loopMode && (planTool === 'wall' || planTool === 'beam') && hudMm
        ? (() => {
            const pos = worldToScreen(hudMm);
            return (
              <div
                data-testid="loop-mode-cursor-chip"
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: pos.pxX + 14,
                  top: pos.pxY - 20,
                  pointerEvents: 'none',
                  zIndex: 20,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 5px',
                  height: 18,
                  borderRadius: 3,
                  fontSize: 'var(--text-2xs, 10px)',
                  lineHeight: 'var(--text-2xs-line, 14px)',
                  background: 'var(--color-surface-2, var(--color-surface-strong))',
                  border: '1px solid var(--color-accent)',
                  color: 'var(--color-accent-foreground, var(--color-foreground))',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontWeight: 600,
                }}
              >
                LOOP
              </div>
            );
          })()
        : null}
      <div ref={mountRef} className="size-full cursor-crosshair" />
      {componentPreviewScreen && activeComponentAsset ? (
        <div
          data-testid="component-placement-preview-glyph"
          className="pointer-events-none absolute z-20 h-12 w-12 -translate-x-1/2 -translate-y-1/2 drop-shadow-sm"
          style={{
            left: componentPreviewScreen.pxX,
            top: componentPreviewScreen.pxY,
          }}
        >
          <ComponentPlacementPreviewGlyph
            symbolKind={activeComponentAsset.planSymbolKind ?? activeComponentAsset.renderProxyKind}
          />
        </div>
      ) : null}
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
