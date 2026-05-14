/* eslint-disable bim-ai/no-hex-in-chrome -- pre-v3 hex literals; remove when this file is migrated in B4 Phase 2 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as THREE from 'three';
import type { CsgBaseFootprintPoint, CsgRequest, CsgResponse } from './viewport/csgWorker';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';

import { parseDimensionInput, type Element, type LensMode } from '@bim-ai/core';
import type { OrbitViewpointPersistFieldPayload } from './OrbitViewpointPersistedHud';

import { useBimStore, type PlanTool } from './state/store';
import { useTheme } from './state/useTheme';
import type { SnapSettings } from './plan/snapSettings';
import {
  CameraRig,
  classifyHotkey,
  classifyPointer,
  createCameraRig,
  wheelDelta,
} from './viewport/cameraRig';
import { resolveViewportPaintBundle, type ViewportPaintBundle } from './viewport/materials';
import { ViewCube } from './viewport/ViewCube';
import { applyLinkedGhosting } from './viewport/linkedGhosting';
import { applyLensGhosting } from './viewport/applyLensGhosting';
import { lensFilterFromMode } from './viewport/useLensFilter';
import { applySceneCameraPose, mirrorSceneCameraPose } from './viewport/cameraMatrixSync';
import { yawForPlanSegment } from './viewport/planSegmentOrientation';
import {
  buildDriftBadgeCanvas,
  driftBadgeTooltip,
  elementBadgeAnchorMm,
  selectDriftedElements,
} from './plan/monitorDriftBadge';
import { type ViewCubePick } from './viewport/viewCubeAlignment';
import { SectionBox } from './viewport/sectionBox';
import { WalkController, classifyKey as classifyWalkKey } from './viewport/walkMode';
import {
  readToken,
  readColorToken,
  sunPositionFromAzEl,
  buildSkyEnvMap,
  addEdges,
} from './viewport/sceneHelpers';
import {
  type WallElem,
  CSG_ENABLED,
  elevationMForLevel,
  makeFloorSlabMesh,
  makeRoofJoinPreviewMesh,
  makeRoofMassMesh,
  makeStairVolumeMesh,
  makeWallMesh,
  makeCurtainWallMesh,
  makeDoorMesh,
  makeWindowMesh,
  makeRoomRibbon,
  makeBalconyMesh,
  makeRailingMesh,
  makeSiteMesh,
  makeColumnMesh,
  makeBeamMesh,
  makeCeilingMesh,
  wallPlanOffsetM,
  wallVerticalSpanM,
  wallFaceKindForMaterialIndex,
  resolveFaceMaterialOverride,
  resolveWallTypeAssembly,
} from './viewport/meshBuilders';
import { resolveWallAssemblyExposedLayers } from './families/wallTypeCatalog';
import { resolveWindowOutline } from './families/geometryFns/windowOutline';
import {
  resolveDoorCutDimensions,
  resolveWindowCutDimensions,
} from './viewport/hostedOpeningDimensions';
import {
  elemViewerCategory,
  computeRootBoundingBox,
  aabbWireframeVertices,
  applyClippingPlanesToMeshes,
  makeClipPlaneCap,
} from './viewport/sceneUtils';
import { getResolvedText3dFont, loadText3dFont, makeText3dMesh } from './viewport/text3dGeometry';
import {
  makeInternalOriginMarker,
  makeProjectBasePointMarker,
  makeSurveyPointMarker,
} from './viewport/originMarkers';
import { makeReferencePlaneMarker } from './viewport/referencePlaneMarker';
import {
  levelDatumBoundsFromBox,
  makeLevelDatum3dGroup,
  resolveLevelDatum3dRows,
  selectableLevelDatumId,
} from './viewport/levelDatums3d';
import { makeSweepMesh } from './viewport/sweepMesh';
import { makeDormerMesh } from './viewport/dormerMesh';
import { buildMassMesh } from './viewport/meshBuilders.mass';
import { isElementVisibleUnderPhaseFilter } from './viewport/phaseFilter';
import { applyDormerCutsToRoofGeom } from './viewport/dormerRoofCut';
import { registerDormerCutFn } from './viewport/meshBuilders';
import {
  activeComponentAssetId,
  activeComponentFamilyTypeId,
  pendingComponentRotationDeg,
} from './workspace/authoring/OptionsBar';
import {
  familyTypePlacesAsDetailComponent,
  familyTypeRequiresWallHost,
} from './families/familyPlacementRuntime';
import {
  resolveHostedFamilyPlacement,
  type HostedFamilyTool,
} from './families/hostedFamilySelection';
import { WallContextMenu, type WallContextMenuCommand } from './workspace/viewport';
import { gripsFor, type Grip3dDescriptor } from './viewport/grip3d';
import { computeSunPositionNoaa } from './viewport/sunPositionNoaa';
import { useSunStore } from './sunStore';
import {
  buildAxisIndicator,
  buildGripMeshes,
  type AxisIndicatorHandle,
  type GripMeshHandle,
} from './viewport/grip3dRenderer';
import { makePlacedAssetMesh } from './viewport/placedAssetRendering';
import { makeFamilyInstanceMesh } from './viewport/familyInstance3d';
import { makeCsgWallMaterial } from './viewport/csgWallMaterial';
import { applyTextureVisibilityToMesh } from './viewport/visualStyleMaterials';
// Side-effect import: registers floor/roof/column/beam/door/window 3D grip providers.
import './viewport/grip3dProviders';
import {
  WallFaceRadialMenu,
  projectAlongT,
  type WallFaceRadialMenuOpen,
  type WallFaceRadialCommand,
} from './viewport/wallFaceRadialMenu';
import { buildPlanOverlay3dGroup } from './viewport/planOverlay3d';
import { shouldRunWallOpeningCsg } from './viewport/wallCsgEligibility';
import {
  wall3dCleanupFootprintMm,
  wall3dXJoinCleanupFootprintsMm,
  wallWith3dJoinDisallowGaps,
} from './viewport/wallJoinDisplay';
import {
  buildLinePreviewPayload,
  buildPolygonPreviewPayload,
  linePreviewToSemanticCommand,
  polygonPreviewToSemanticCommand,
  resizeLinePreviewToLength,
  classifyWallDraftProjection,
  isDraftPlaneHitOccluded,
  projectSceneRayToLevelPlaneMm,
  resolve3dDraftLevel,
  snapDraftPointToGrid,
  type Authoring3dLinePreviewPayload,
  type Authoring3dSnapKind,
  type WallDraftProjectionClassification,
  type WallDraftProjectionMode,
} from './viewport/authoring3d';
import {
  findHostedOpeningConflict,
  isBackfacingWallHit,
  isDuplicateHostedPlacement,
  isLinkedElementId,
  shouldCommitHostedPlacementOnPointerUp,
  shouldReuseHostedPreviewCommit,
  type HostedOpeningLike,
  type HostedPlacementDedupeState,
} from './viewport/directAuthoringGuards';
import { flipWallLocationLineSide, snapWallPointToConnectivity } from './geometry/wallConnectivity';

// KRN-14 — wire the CSG cut into meshBuilders. Side-effect at module load.
registerDormerCutFn(applyDormerCutsToRoofGeom);

type Props = {
  wsConnected: boolean;
  onPersistViewpointField?: (payload: OrbitViewpointPersistFieldPayload) => void | Promise<void>;
  /** ANN-02: optional dispatcher for the right-click "Generate Section / Elevation" menu. */
  onSemanticCommand?: (cmd: Record<string, unknown>) => void;
  /** COL-V3-01: remote participant selections to render as colored halos. */
  remoteSelections?: Array<{ elementId: string; color: string }>;
  /** Discipline lens for this viewport instance. Falls back to the store default. */
  lensMode?: LensMode;
  /** Pane-local active authoring command. Falls back to the store default. */
  activePlanTool?: PlanTool;
  /** Pane-local snap toggles shared with plan and 3D authoring tools. */
  snapSettings?: SnapSettings;
  /** Right-side overlay inset reserved by pane chrome, such as the element sidebar. */
  viewOverlayRightInset?: string;
};

type DoorElem = Extract<Element, { kind: 'door' }>;
type WindowElem = Extract<Element, { kind: 'window' }>;
type WallOpeningElem = Extract<Element, { kind: 'wall_opening' }>;

/** Small key+label hint chip used in the navigation HUD. */
function NavHint({ k, label }: { k: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <kbd className="rounded border border-border/70 bg-surface-strong px-1 py-0.5 font-mono leading-none">
        {k}
      </kbd>
      <span>{label}</span>
    </span>
  );
}

function Sep() {
  return <span className="opacity-30">·</span>;
}

type ViewerEdgeWidth = 1 | 2 | 3 | 4;
type ViewerGdoRuntimeState = {
  viewerShadowsEnabled?: boolean;
  viewerAmbientOcclusionEnabled?: boolean;
  viewerDepthCueEnabled?: boolean;
  viewerSilhouetteEdgeWidth?: ViewerEdgeWidth;
  viewerPhotographicExposureEv?: number;
};

type ScreenPoint = { x: number; y: number };
type Direct3dAuthoringTool =
  | 'wall'
  | 'floor'
  | 'roof'
  | 'shaft'
  | 'stair'
  | 'railing'
  | 'column'
  | 'beam'
  | 'ceiling'
  | 'room'
  | 'area'
  | 'grid'
  | 'reference-plane'
  | 'door'
  | 'window'
  | 'wall-opening'
  | 'component';
type Authoring3dOverlayState = {
  tool: Direct3dAuthoringTool;
  phase: 'pick-start' | 'pick-end' | 'pick-point' | 'pick-wall' | 'pick-vertex' | 'pick-next';
  levelName?: string;
  startScreen?: ScreenPoint;
  currentScreen?: ScreenPoint;
  currentPointMm?: { xMm: number; yMm: number };
  workPlaneElevationMm?: number;
  snapKind?: Authoring3dSnapKind;
  snapScreen?: ScreenPoint;
  numericInputValue?: string;
  pointsScreen?: ScreenPoint[];
  previewStartScreen?: ScreenPoint;
  previewEndScreen?: ScreenPoint;
  previewOutlineScreen?: ScreenPoint[];
  previewHostValid?: boolean;
  previewHostWallId?: string;
  previewHostAlongT?: number;
  previewHostLock?: boolean;
  previewHostInvalidReason?: string;
  previewAuxLines?: Array<{ start: ScreenPoint; end: ScreenPoint }>;
  previewAuxArcPath?: string;
  wallPreviewOutlineScreen?: ScreenPoint[];
  wallPreviewDirectionStartScreen?: ScreenPoint;
  wallPreviewDirectionEndScreen?: ScreenPoint;
  wallFlipActive?: boolean;
  wallProjectionMode?: WallDraftProjectionMode;
  wallAnchorRequired?: boolean;
  wallPlaneUnreadable?: boolean;
  wallPlaneOccluded?: boolean;
};

const DIRECT_3D_AUTHORING_TOOLS = new Set<Direct3dAuthoringTool>([
  'wall',
  'floor',
  'roof',
  'shaft',
  'stair',
  'railing',
  'column',
  'beam',
  'ceiling',
  'room',
  'area',
  'grid',
  'reference-plane',
  'door',
  'window',
  'wall-opening',
  'component',
]);

const LINE_3D_AUTHORING_TOOLS = new Set<Direct3dAuthoringTool>([
  'wall',
  'beam',
  'stair',
  'railing',
  'grid',
  'reference-plane',
]);

const POLYGON_3D_AUTHORING_TOOLS = new Set<Direct3dAuthoringTool>([
  'floor',
  'roof',
  'shaft',
  'ceiling',
  'area',
]);

const GDO_STORAGE_KEYS = {
  shadows: 'bim.viewer.shadowsEnabled',
  ambientOcclusion: 'bim.viewer.ambientOcclusionEnabled',
  depthCue: 'bim.viewer.depthCueEnabled',
  silhouetteEdgeWidth: 'bim.viewer.silhouetteEdgeWidth',
  photographicExposureEv: 'bim.viewer.photographicExposureEv',
} as const;

const PHOTOGRAPHIC_EXPOSURE_EV_MIN = -2;
const PHOTOGRAPHIC_EXPOSURE_EV_MAX = 2;
const PHOTOGRAPHIC_EXPOSURE_EV_STEP = 0.25;

function readStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch {
    /* noop */
  }
  return fallback;
}

function readStoredEdgeWidth(): ViewerEdgeWidth {
  try {
    const raw = Number(localStorage.getItem(GDO_STORAGE_KEYS.silhouetteEdgeWidth));
    if (raw === 1 || raw === 2 || raw === 3 || raw === 4) return raw;
  } catch {
    /* noop */
  }
  return 1;
}

function normalizeExposureEv(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const stepped = Math.round(n / PHOTOGRAPHIC_EXPOSURE_EV_STEP) * PHOTOGRAPHIC_EXPOSURE_EV_STEP;
  return Math.min(PHOTOGRAPHIC_EXPOSURE_EV_MAX, Math.max(PHOTOGRAPHIC_EXPOSURE_EV_MIN, stepped));
}

function readStoredExposureEv(): number {
  try {
    const raw = localStorage.getItem(GDO_STORAGE_KEYS.photographicExposureEv);
    if (raw != null) return normalizeExposureEv(raw);
  } catch {
    /* noop */
  }
  return 0;
}

function applyModelEdgeDisplay(
  root: THREE.Object3D,
  edgeMode: 'normal' | 'none',
  width: ViewerEdgeWidth,
): void {
  const visible = edgeMode === 'normal' && width > 0;
  root.traverse((obj) => {
    if (!(obj instanceof THREE.LineSegments) || !(obj.parent instanceof THREE.Mesh)) return;
    obj.visible = visible;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      if (!(material instanceof THREE.LineBasicMaterial)) continue;
      material.linewidth = width;
      material.opacity = visible ? Math.min(0.7, 0.3 + width * 0.1) : 0;
      material.needsUpdate = true;
    }
  });
}

function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((node) => {
    if (
      node instanceof THREE.Mesh ||
      node instanceof THREE.Line ||
      node instanceof THREE.LineSegments ||
      node instanceof THREE.Sprite
    ) {
      node.geometry?.dispose();
      const material = node.material;
      const materials = Array.isArray(material) ? material : [material];
      for (const mat of materials) {
        const spriteMap =
          mat instanceof THREE.SpriteMaterial && mat.map instanceof THREE.Texture ? mat.map : null;
        spriteMap?.dispose();
        mat.dispose();
      }
    }
  });
}

function csgWallSurfaceMaterialKey(
  wall: WallElem,
  elementsById: Record<string, Element>,
): string | null | undefined {
  const exteriorOverride = resolveFaceMaterialOverride(wall.faceMaterialOverrides, 'exterior');
  if (exteriorOverride?.materialKey) return exteriorOverride.materialKey;
  if (!wall.wallTypeId) return wall.materialKey;
  const assembly = resolveWallTypeAssembly(wall.wallTypeId, elementsById);
  if (!assembly) return wall.materialKey;
  return resolveWallAssemblyExposedLayers(assembly).exterior?.materialKey ?? wall.materialKey;
}

function csgBaseFootprintsForWall(
  wall: WallElem,
  elementsById: Record<string, Element>,
  originXM: number,
  originZM: number,
  dxM: number,
  dzM: number,
  lenM: number,
): CsgBaseFootprintPoint[][] | undefined {
  const xCleanup = wall3dXJoinCleanupFootprintsMm(wall, elementsById);
  const endpointCleanup = xCleanup ? null : wall3dCleanupFootprintMm(wall, elementsById);
  const footprints = xCleanup ?? (endpointCleanup ? [endpointCleanup] : null);
  if (!footprints || lenM <= 1e-6) return undefined;

  const ux = dxM / lenM;
  const uz = dzM / lenM;
  const nx = -uz;
  const nz = ux;
  return footprints
    .map((footprint) =>
      footprint.map((point) => {
        const wx = point.xMm / 1000 - originXM;
        const wz = point.yMm / 1000 - originZM;
        return {
          xM: wx * ux + wz * uz,
          zM: wx * nx + wz * nz,
        };
      }),
    )
    .filter((footprint) => footprint.length >= 3);
}

export function Viewport({
  wsConnected,
  onSemanticCommand,
  remoteSelections,
  lensMode,
  activePlanTool,
  snapSettings,
  viewOverlayRightInset,
}: Props) {
  void wsConnected;
  void snapSettings;
  const { t } = useTranslation();

  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orthoCameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rootGroupRef = useRef<THREE.Group | null>(null);
  const planOverlayGroupRef = useRef<THREE.Group | null>(null);
  const rafRef = useRef<number | null>(null);
  /** Live paint bundle for the rendered scene. Rebuilt on theme change. */
  const paintBundleRef = useRef<ViewportPaintBundle | null>(null);
  const wallDraftPreviewGroupRef = useRef<THREE.Object3D | null>(null);
  const levelDatumGroupRef = useRef<THREE.Group | null>(null);
  const clearWallDraftPreviewGroup = useCallback(() => {
    const group = wallDraftPreviewGroupRef.current;
    if (!group) return;
    group.parent?.remove(group);
    disposeObject3D(group);
    wallDraftPreviewGroupRef.current = null;
  }, []);
  const composerRef = useRef<EffectComposer | null>(null);
  const renderPassRef = useRef<RenderPass | null>(null);
  const ssaoPassRef = useRef<SSAOPass | null>(null);
  const outlinePassRef = useRef<OutlinePass | null>(null);
  /** COL-V3-01: per-remote-user outline passes keyed by CSS color string. */
  const remoteOutlinePassesRef = useRef<Map<string, OutlinePass>>(new Map());
  const bimPickMapRef = useRef<Map<string, THREE.Object3D>>(new Map());
  /** Snapshot of elementsById from the previous render — used to diff for incremental updates. */
  const prevElementsByIdRef = useRef<Record<string, Element>>({});
  /** Current active clipping planes — applied to newly added meshes without re-traversing the whole scene. */
  const clippingPlanesRef = useRef<THREE.Plane[]>([]);
  /** Ref-copy of selectedId so the geometry effect can read it without adding it to deps. */
  const selectedIdRef = useRef<string | undefined>(undefined);
  const selectedIdsRef = useRef<string[]>([]);
  const prevCatHiddenRef = useRef<Record<string, boolean>>({});
  const prevLevelHiddenRef = useRef<Record<string, boolean>>({});
  const prevLensModeRef = useRef<LensMode | null>(null);
  const csgWorkerRef = useRef<Worker | null>(null);
  /** Maps wallId → active CSG job nonce; responses with a mismatched nonce are stale and discarded. */
  const pendingCsgRef = useRef<Map<string, number>>(new Map());
  const pendingCsgMetaRef = useRef<
    Map<
      string,
      {
        len: number;
        height: number;
        thick: number;
        materialKey?: string | null;
        retainExisting?: boolean;
      }
    >
  >(new Map());
  const csgNonceRef = useRef(0);
  const sunRef = useRef<THREE.DirectionalLight | null>(null);
  const envMapRef = useRef<THREE.Texture | null>(null);
  /** Live CameraRig instance — replaces the legacy ad-hoc spherical rig. */
  const cameraRigRef = useRef<CameraRig | null>(null);
  const hasAutoFittedRef = useRef(false);
  /** Set by the mount effect so we can snap the orbit rig to saved `viewpoint` cameras. */
  const orbitRigApiRef = useRef<{
    applyViewpointMm: (pose: {
      position: { xMm: number; yMm: number; zMm: number };
      target: { xMm: number; yMm: number; zMm: number };
      up: { xMm: number; yMm: number; zMm: number };
    }) => void;
  } | null>(null);

  const [currentAzimuth, setCurrentAzimuth] = useState(Math.PI / 4);
  const [currentElevation, setCurrentElevation] = useState(0.45);
  const [text3dRebuildTick, setText3dRebuildTick] = useState(0);
  // ANN-02: state for the right-click "Generate Section / Elevation" menu in 3D.
  const [wallContextMenu, setWallContextMenu] = useState<{
    wall: Extract<Element, { kind: 'wall' }>;
    position: { x: number; y: number };
  } | null>(null);
  // EDT-03: state for the wall-face radial menu (Insert Door / Window / Opening).
  const [wallFaceRadialMenu, setWallFaceRadialMenu] = useState<WallFaceRadialMenuOpen | null>(null);
  // VIS-V3-04: sun state lifted to sunStore
  const sunOverlayValues = useSunStore((s) => s.values);
  /** Pickable grip meshes for the current selection — populated by the grip-rebuild effect. */
  const gripPickablesRef = useRef<THREE.Object3D[]>([]);
  const gripHandleRef = useRef<GripMeshHandle | null>(null);
  const text3dPendingRef = useRef<Set<string>>(new Set());
  const walkControllerRef = useRef<WalkController | null>(null);
  const sectionBoxRef = useRef<SectionBox | null>(null);
  const sectionBoxCageRef = useRef<THREE.LineSegments | null>(null);
  const clipCapsRef = useRef<THREE.Mesh[]>([]);

  const elementsById = useBimStore((s) => s.elementsById);
  // ANN-02: ref-copy so the 3D contextmenu listener (registered once in the
  // mount effect) sees up-to-date elements without rerunning that effect.
  const elementsByIdRef = useRef(elementsById);
  elementsByIdRef.current = elementsById;
  const theme = useTheme();

  const walkLevels = useMemo(
    () =>
      Object.values(elementsById)
        .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
        .map((e) => e.elevationMm / 1000)
        .sort((a, b) => a - b),
    [elementsById],
  );
  const walkLevelsRef = useRef<number[]>([]);
  walkLevelsRef.current = walkLevels;

  const selectedId = useBimStore((s) => s.selectedId);
  const selectedIds = useBimStore((s) => s.selectedIds);
  selectedIdRef.current = selectedId;
  selectedIdsRef.current = selectedIds;
  const setActiveLevelId = useBimStore((s) => s.setActiveLevelId);
  const storePlanTool = useBimStore((s) => s.planTool);
  const planTool = activePlanTool ?? storePlanTool;
  const activeLevelId = useBimStore((s) => s.activeLevelId);
  const [authoringOverlay, setAuthoringOverlay] = useState<Authoring3dOverlayState | null>(null);
  const [draftPlaneAngleWarning, setDraftPlaneAngleWarning] = useState(false);
  const draftPlaneAngleWarningRef = useRef(draftPlaneAngleWarning);
  draftPlaneAngleWarningRef.current = draftPlaneAngleWarning;
  const planToolRef = useRef(planTool);
  const activeLevelIdRef = useRef(activeLevelId);
  planToolRef.current = planTool;
  activeLevelIdRef.current = activeLevelId;
  const authoringOverlayRef = useRef<Authoring3dOverlayState | null>(null);
  authoringOverlayRef.current = authoringOverlay;
  // ANN-02: store actions for the wall context menu's command flow.
  const activateElevationView = useBimStore((s) => s.activateElevationView);
  const selectStoreEl = useBimStore((s) => s.select);

  const handleWallContextMenuCommand = useCallback(
    (next: WallContextMenuCommand) => {
      onSemanticCommand?.(next.cmd);
      if (next.kind === 'elevation_view') {
        activateElevationView(next.elevationViewId);
      } else {
        selectStoreEl(next.sectionCutId);
      }
    },
    [activateElevationView, onSemanticCommand, selectStoreEl],
  );

  // EDT-03: dispatch slice grip commands as engine commands. Slice
  // payloads use `{ elementId, property, valueMm | value, ... }`; the
  // engine's UpdateElementPropertyCmd uses `{ elementId, key, value }`.
  // Translate here so providers stay decoupled from the engine schema.
  const handleGripCommand = useCallback(
    (cmd: { type: string; payload: Record<string, unknown> }) => {
      if (!onSemanticCommand) return;
      if (cmd.type === 'updateElementProperty') {
        const p = cmd.payload;
        const key = String(p.property ?? '');
        const value = p.value !== undefined ? p.value : p.valueMm;
        onSemanticCommand({
          type: 'updateElementProperty',
          elementId: p.elementId,
          key,
          value,
        });
        return;
      }
      if (cmd.type === 'moveBeamEndpoints') {
        const p = cmd.payload;
        onSemanticCommand({
          type: 'moveBeamEndpoints',
          beamId: p.beamId,
          startMm: p.startMm,
          endMm: p.endMm,
        });
        return;
      }
      // Forward unknown slice types verbatim — the engine will reject
      // with a clear error rather than silently dropping.
      onSemanticCommand({ type: cmd.type, ...cmd.payload });
    },
    [onSemanticCommand],
  );
  // Keep a ref-copy so the mount-effect closure (registered once) reads
  // the latest dispatcher.
  const handleGripCommandRef = useRef(handleGripCommand);
  handleGripCommandRef.current = handleGripCommand;

  const handleWallFaceRadialCommand = useCallback(
    (next: WallFaceRadialCommand) => {
      onSemanticCommand?.(next.cmd as unknown as Record<string, unknown>);
    },
    [onSemanticCommand],
  );

  const direct3dDraftLevelName = useMemo(() => {
    const levels = Object.values(elementsById)
      .filter((el): el is Extract<Element, { kind: 'level' }> => el.kind === 'level')
      .map((level) => ({ id: level.id, elevationMm: level.elevationMm, name: level.name }));
    const resolved = resolve3dDraftLevel(levels, activeLevelId);
    const resolvedName = resolved ? levels.find((level) => level.id === resolved.id)?.name : null;
    return resolvedName ?? 'Active level';
  }, [activeLevelId, elementsById]);

  useEffect(() => {
    if (!DIRECT_3D_AUTHORING_TOOLS.has(planTool as Direct3dAuthoringTool)) {
      clearWallDraftPreviewGroup();
      setAuthoringOverlay(null);
      setDraftPlaneAngleWarning(false);
      return;
    }
    const tool = planTool as Direct3dAuthoringTool;
    if (tool !== 'wall') clearWallDraftPreviewGroup();
    setAuthoringOverlay((prev) => {
      if (prev?.tool === tool) {
        return {
          ...prev,
          levelName:
            tool === 'door' || tool === 'window' || tool === 'wall-opening'
              ? undefined
              : direct3dDraftLevelName,
        };
      }
      if (LINE_3D_AUTHORING_TOOLS.has(tool)) {
        return { tool, phase: 'pick-start', levelName: direct3dDraftLevelName };
      }
      if (tool === 'column' || tool === 'room' || tool === 'component') {
        return { tool, phase: 'pick-point', levelName: direct3dDraftLevelName };
      }
      if (POLYGON_3D_AUTHORING_TOOLS.has(tool)) {
        return { tool, phase: 'pick-vertex', levelName: direct3dDraftLevelName, pointsScreen: [] };
      }
      return {
        tool,
        phase: 'pick-wall',
        previewHostValid: false,
        previewHostLock: false,
        previewAuxLines: undefined,
        previewAuxArcPath: undefined,
      };
    });
    setDraftPlaneAngleWarning(false);
  }, [planTool, direct3dDraftLevelName, clearWallDraftPreviewGroup]);

  // VIS-V3-04: sync sun_settings element → sunStore
  useEffect(() => {
    const el = elementsById['sun_settings'];
    if (!el || el.kind !== 'sun_settings') return;
    const s = el as Extract<Element, { kind: 'sun_settings' }>;
    useSunStore.getState().setValues({
      latitudeDeg: s.latitudeDeg,
      longitudeDeg: s.longitudeDeg,
      dateIso: s.dateIso,
      hours: s.timeOfDay.hours,
      minutes: s.timeOfDay.minutes,
      daylightSavingStrategy: s.daylightSavingStrategy,
    });
  }, [elementsById]);

  // VIS-V3-04: recompute sun position when store values change; propagate to Three.js and store
  useEffect(() => {
    const { azimuthDeg, elevationDeg } = computeSunPositionNoaa(
      sunOverlayValues.latitudeDeg,
      sunOverlayValues.longitudeDeg,
      sunOverlayValues.dateIso,
      sunOverlayValues.hours,
      sunOverlayValues.minutes,
      sunOverlayValues.daylightSavingStrategy,
    );
    useSunStore.getState().setComputedPosition(azimuthDeg, elevationDeg);
    const sun = sunRef.current;
    if (sun) {
      sun.position.copy(sunPositionFromAzEl(azimuthDeg, elevationDeg));
    }
  }, [sunOverlayValues]);

  const viewerCategoryHidden = useBimStore((s) => s.viewerCategoryHidden);
  const viewerLevelHidden = useBimStore((s) => s.viewerLevelHidden);
  const viewerPhaseFilter = useBimStore((s) => s.viewerPhaseFilter);
  const viewerRenderStyle = useBimStore((s) => s.viewerRenderStyle);
  const viewerBackground = useBimStore((s) => s.viewerBackground);
  const viewerEdges = useBimStore((s) => s.viewerEdges);
  const viewerGdoRuntime = useBimStore((s) => s as typeof s & ViewerGdoRuntimeState);
  const viewerProjection = useBimStore((s) => s.viewerProjection);
  const sectionBoxActive = useBimStore((s) => s.viewerSectionBoxActive);
  const walkActive = useBimStore((s) => s.viewerWalkModeActive);
  const roofJoinPreview = useBimStore((s) => s.roofJoinPreview);
  const viewerCameraAction = useBimStore((s) => s.viewerCameraAction);
  const storeLensMode = useBimStore((s) => s.lensMode);
  const activeLensMode = lensMode ?? storeLensMode;
  const orthoMode = viewerProjection === 'orthographic';

  const viewerClipElevMm = useBimStore((s) => s.viewerClipElevMm);
  const viewerClipFloorElevMm = useBimStore((s) => s.viewerClipFloorElevMm);
  const orbitCameraNonce = useBimStore((s) => s.orbitCameraNonce);
  const orbitCameraPoseMm = useBimStore((s) => s.orbitCameraPoseMm);
  const activeViewpointId = useBimStore((s) => s.activeViewpointId);
  const direct3dAuthoringActive =
    !walkActive && DIRECT_3D_AUTHORING_TOOLS.has(planTool as Direct3dAuthoringTool);

  const persistedOrbitViewpoint = useMemo(() => {
    const id = activeViewpointId;
    if (!id) return null;
    const el = elementsById[id];
    if (!el || el.kind !== 'viewpoint' || el.mode !== 'orbit_3d') return null;
    return el;
  }, [activeViewpointId, elementsById]);
  const viewerShadowsEnabled =
    viewerGdoRuntime.viewerShadowsEnabled ??
    persistedOrbitViewpoint?.viewerShadowsEnabled ??
    readStoredBoolean(GDO_STORAGE_KEYS.shadows, true);
  const viewerAmbientOcclusionEnabled =
    viewerGdoRuntime.viewerAmbientOcclusionEnabled ??
    persistedOrbitViewpoint?.viewerAmbientOcclusionEnabled ??
    readStoredBoolean(GDO_STORAGE_KEYS.ambientOcclusion, true);
  const viewerDepthCueEnabled =
    viewerGdoRuntime.viewerDepthCueEnabled ??
    persistedOrbitViewpoint?.viewerDepthCueEnabled ??
    readStoredBoolean(GDO_STORAGE_KEYS.depthCue, false);
  const viewerSilhouetteEdgeWidth =
    viewerGdoRuntime.viewerSilhouetteEdgeWidth ??
    persistedOrbitViewpoint?.viewerSilhouetteEdgeWidth ??
    readStoredEdgeWidth();
  const viewerPhotographicExposureEv = normalizeExposureEv(
    viewerGdoRuntime.viewerPhotographicExposureEv ??
      persistedOrbitViewpoint?.viewerPhotographicExposureEv ??
      readStoredExposureEv(),
  );
  const viewerEdgesRef = useRef(viewerEdges);
  const viewerSilhouetteEdgeWidthRef = useRef(viewerSilhouetteEdgeWidth);
  const viewerRenderStyleRef = useRef(viewerRenderStyle);
  viewerEdgesRef.current = viewerEdges;
  viewerSilhouetteEdgeWidthRef.current = viewerSilhouetteEdgeWidth;
  viewerRenderStyleRef.current = viewerRenderStyle;

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const host = el;

    /** Resolve drafting + lighting tokens once at mount; theme switches will
     * trigger a rebuild via the dependency on `elementsById` etc. */
    const paint = resolveViewportPaintBundle({ theme: theme === 'dark' ? 'dark' : 'light' });
    paintBundleRef.current = paint;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, stencil: true });
    renderer.localClippingEnabled = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    rendererRef.current = renderer;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    sceneRef.current = scene;
    const hemi = new THREE.HemisphereLight(
      new THREE.Color(paint.lighting.hemi.skyColor),
      new THREE.Color(paint.lighting.hemi.groundColor),
      paint.lighting.hemi.intensity,
    );
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(
      new THREE.Color(paint.lighting.sun.color),
      paint.lighting.sun.intensity,
    );
    dir.castShadow = true;
    dir.shadow.mapSize.set(paint.lighting.sun.shadowMapSize, paint.lighting.sun.shadowMapSize);
    dir.shadow.bias = -0.001;
    dir.shadow.camera.left = -30;
    dir.shadow.camera.right = 30;
    dir.shadow.camera.top = 30;
    dir.shadow.camera.bottom = -30;
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 200;
    dir.shadow.camera.updateProjectionMatrix();
    dir.position.copy(
      sunPositionFromAzEl(paint.lighting.sun.azimuthDeg, paint.lighting.sun.elevationDeg),
    );
    dir.target.position.set(0, 0, 0);
    scene.add(dir);
    scene.add(dir.target);
    sunRef.current = dir;

    const envMap = buildSkyEnvMap(
      renderer,
      paint.lighting.sun.azimuthDeg,
      paint.lighting.sun.elevationDeg,
    );
    scene.environment = envMap;
    envMapRef.current = envMap;

    const grid = new THREE.GridHelper(
      80,
      32,
      readToken('--draft-grid-major', '#223042'),
      readToken('--draft-grid-minor', '#1a2738'),
    );
    if (Array.isArray(grid.material)) {
      grid.material.forEach((m) => {
        m.opacity = 0.25;
        m.transparent = true;
      });
    } else {
      grid.material.opacity = 0.25;
      grid.material.transparent = true;
    }
    scene.add(grid);

    const root = new THREE.Group();

    rootGroupRef.current = root;
    scene.add(root);

    const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 500);
    camera.up.set(0, 1, 0);

    cameraRef.current = camera;

    const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 500);
    orthoCamera.up.set(0, 1, 0);
    orthoCameraRef.current = orthoCamera;

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    renderPassRef.current = renderPass;
    const ssao = new SSAOPass(scene, camera, host.clientWidth || 1, host.clientHeight || 1);
    ssao.kernelRadius = paint.lighting.ssao.kernelRadius;
    ssao.minDistance = paint.lighting.ssao.minDistance;
    ssao.maxDistance = paint.lighting.ssao.maxDistance;
    ssao.output = SSAOPass.OUTPUT.Default;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ssao.enabled = false;
    }
    composer.addPass(ssao);
    ssaoPassRef.current = ssao;
    const outlinePass = new OutlinePass(
      new THREE.Vector2(host.clientWidth || 1, host.clientHeight || 1),
      scene,
      camera,
    );
    outlinePass.edgeStrength = 3.0;
    outlinePass.edgeGlow = 0.3;
    outlinePass.edgeThickness = 1.5;
    outlinePass.visibleEdgeColor.set(paint.selection.selectedColor);
    outlinePass.hiddenEdgeColor.set(paint.selection.selectedColor);
    composer.addPass(outlinePass);
    outlinePassRef.current = outlinePass;
    composer.addPass(new OutputPass());
    composerRef.current = composer;

    /** Spec §15.3 walk-mode controller — the actual key/mouse wiring is
     * a few lines below; this just creates the math state. */
    const walkController = new WalkController({}, {});
    walkControllerRef.current = walkController;

    /** Spec §15.6 section box — toggled on/off via the React state below.
     * The mount effect re-applies clipping planes on every scene rebuild. */
    const sectionBox = new SectionBox({});
    sectionBoxRef.current = sectionBox;

    // CSG Web Worker — wall-opening cuts run off the main thread.
    const csgWorker = new Worker(new URL('./viewport/csgWorker.ts', import.meta.url), {
      type: 'module',
    });
    csgWorkerRef.current = csgWorker;

    csgWorker.onmessage = (evt: MessageEvent<CsgResponse>) => {
      const data = evt.data;

      // Discard stale results (wall was dirtied again before this job finished).
      if (pendingCsgRef.current.get(data.jobId) !== data.nonce) return;
      pendingCsgRef.current.delete(data.jobId);
      const csgMeta = pendingCsgMetaRef.current.get(data.jobId);
      pendingCsgMetaRef.current.delete(data.jobId);

      const rootNow = rootGroupRef.current;
      const cacheNow = bimPickMapRef.current;
      if (!rootNow) return;

      const existing = cacheNow.get(data.jobId);
      if (!data.ok) {
        if (!csgMeta?.retainExisting && existing) {
          rootNow.remove(existing);
          existing.traverse((node) => {
            const m = node as THREE.Mesh;
            if (!m.isMesh) return;
            m.geometry?.dispose();
            if (Array.isArray(m.material)) {
              m.material.forEach((mat: THREE.Material) => mat.dispose());
            } else {
              (m.material as THREE.Material)?.dispose();
            }
          });
          cacheNow.delete(data.jobId);
        }
        return;
      }

      // Reconstruct BufferGeometry from transferable arrays.
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(data.position, 3));
      if (data.normal) geom.setAttribute('normal', new THREE.BufferAttribute(data.normal, 3));
      if (data.uv) geom.setAttribute('uv', new THREE.BufferAttribute(data.uv, 2));
      if (data.index) geom.setIndex(new THREE.BufferAttribute(data.index, 1));

      const renderStyleNow = viewerRenderStyleRef.current;
      const { material: wallMat } = makeCsgWallMaterial({
        materialKey: csgMeta?.materialKey,
        paint: paintBundleRef.current,
        elementsById: elementsByIdRef.current,
        lenM: csgMeta?.len ?? 1,
        heightM: csgMeta?.height ?? 1,
        textureMapsVisible: renderStyleNow === 'realistic' || renderStyleNow === 'ray-trace',
      });

      const mesh = new THREE.Mesh(geom, wallMat);
      mesh.position.set(data.wcx, data.wcy, data.wcz);
      mesh.rotation.y = data.yaw;
      mesh.userData.bimPickId = data.jobId;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      addEdges(mesh);
      applyModelEdgeDisplay(mesh, viewerEdgesRef.current, viewerSilhouetteEdgeWidthRef.current);
      applyClippingPlanesToMeshes(mesh, clippingPlanesRef.current);

      if (existing) {
        rootNow.remove(existing);
        existing.traverse((node) => {
          const m = node as THREE.Mesh;
          if (!m.isMesh) return;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat: THREE.Material) => mat.dispose());
          } else {
            (m.material as THREE.Material)?.dispose();
          }
        });
      }
      cacheNow.set(data.jobId, mesh);
      rootNow.add(mesh);

      // Keep outline pass in sync if this wall is the current selection.
      const op = outlinePassRef.current;
      if (op) {
        const selectedObjects = [selectedIdRef.current, ...selectedIdsRef.current]
          .filter((id): id is string => typeof id === 'string')
          .map((id) => cacheNow.get(id))
          .filter((obj): obj is THREE.Object3D => Boolean(obj));
        op.selectedObjects = selectedObjects;
      }
    };

    /** Spec §15.3 camera rig replaces the legacy in-line spherical rig. */
    hasAutoFittedRef.current = false;
    const rig = createCameraRig({
      target: { x: 0, y: 1.35, z: 0 },
      up: { x: 0, y: 1, z: 0 },
      azimuth: Math.PI / 4,
      elevation: 0.45,
      radius: 16,
      minRadius: 4,
      maxRadius: 80,
    });
    cameraRigRef.current = rig;
    let dragging: 'orbit' | 'pan' | 'grip' | 'tool-draft' | null = null;
    let dragMoved = false;
    let cumulativeDragPx = 0;
    let inertiaVx = 0;
    let inertiaVy = 0;
    const INERTIA_DECAY = 0.92; // smoother Rhino-like glide after release
    const DRAG_THRESHOLD_PX = 5;
    let lastX = 0;
    let lastY = 0;
    let toolDraftTool: Direct3dAuthoringTool | null = null;
    let toolDraftStartedLineOnDown = false;
    let toolDraftConsumedOnDown = false;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    /** EDT-03 — active grip drag state, set on grip-pointer-down and cleared on up. */
    let activeGrip: {
      descriptor: Grip3dDescriptor;
      anchorScene: THREE.Vector3;
      indicator: AxisIndicatorHandle | null;
      lastDeltaMm: number;
    } | null = null;
    type WallDraftScreenBasis = {
      mode: 'elevation-axis';
      originScreen: ScreenPoint;
      originPointMm: { xMm: number; yMm: number };
      xPerPx: { xMm: number; yMm: number };
      yPerPx: { xMm: number; yMm: number };
      scaleMmPerPx: number;
      projection: WallDraftProjectionClassification;
    };
    type DraftPlaneProjection = {
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
    let lineDraftStart: {
      tool: 'wall' | 'beam' | 'stair' | 'railing' | 'grid' | 'reference-plane';
      levelId: string;
      point: { xMm: number; yMm: number };
      screen?: ScreenPoint;
      wallBasis?: WallDraftScreenBasis;
      wallProjection?: WallDraftProjectionClassification;
    } | null = null;
    let polygonDraft: {
      tool: 'ceiling' | 'floor' | 'roof' | 'shaft' | 'area';
      levelId: string;
      points: Array<{ xMm: number; yMm: number }>;
    } | null = null;
    let lastHostedPlacementScreen: HostedPlacementDedupeState | null = null;
    let lastHostedPlacementHost: HostedPlacementDedupeState | null = null;
    let wallFlipNextSegment = false;
    let hostPreviewLock = false;

    function measureDraftPlaneProjectionMmPerPx(
      cx: number,
      cy: number,
      elevationMm: number,
    ): number | null {
      const samplePx = 10;
      const origin = projectPointerToDraftPlane(cx, cy, elevationMm);
      const sampleX = projectPointerToDraftPlane(cx + samplePx, cy, elevationMm);
      const sampleY = projectPointerToDraftPlane(cx, cy + samplePx, elevationMm);
      if (!origin || !sampleX || !sampleY) return null;
      const deltaX = Math.hypot(
        sampleX.point.xMm - origin.point.xMm,
        sampleX.point.yMm - origin.point.yMm,
      );
      const deltaY = Math.hypot(
        sampleY.point.xMm - origin.point.xMm,
        sampleY.point.yMm - origin.point.yMm,
      );
      return Math.max(deltaX, deltaY) / samplePx;
    }

    function isDraftPlaneProjectionStable(cx: number, cy: number, elevationMm: number): boolean {
      const mmPerPx = measureDraftPlaneProjectionMmPerPx(cx, cy, elevationMm);
      // Past this range, one pixel of cursor motion can jump the draft point
      // by multiple wall thicknesses, which causes direction/orientation drift.
      return mmPerPx !== null && mmPerPx <= 320;
    }

    function wallDebugCameraSnapshot(): Record<string, unknown> {
      const direction = new THREE.Vector3();
      camera.updateMatrixWorld(true);
      camera.getWorldDirection(direction);
      const snap = rig.snapshot();
      return {
        position: snap.position,
        target: snap.target,
        up: snap.up,
        direction: { x: direction.x, y: direction.y, z: direction.z },
        azimuth: snap.azimuth,
        elevation: snap.elevation,
        radius: snap.radius,
      };
    }

    function emitWallDebug(phase: string, payload: Record<string, unknown>): void {
      try {
        const debugEnabled =
          import.meta.env.DEV || window.localStorage.getItem('bim.debug.3dWall') === 'true';
        if (!debugEnabled) return;
        const record: Record<string, unknown> = {
          phase,
          atMs: performance.now(),
          camera: wallDebugCameraSnapshot(),
          ...payload,
        };
        const debugWindow = window as Window & {
          __BIM_AI_3D_WALL_DEBUG__?: Array<Record<string, unknown>>;
        };
        const log = debugWindow.__BIM_AI_3D_WALL_DEBUG__ ?? [];
        log.push(record);
        if (log.length > 300) log.splice(0, log.length - 300);
        debugWindow.__BIM_AI_3D_WALL_DEBUG__ = log;
        const command = record.command as
          | { type?: string; start?: unknown; end?: unknown }
          | undefined;
        const consoleRecord = {
          phase: record.phase,
          mode: (record.projection as { mode?: string } | undefined)?.mode,
          lengthMm: record.lengthMm,
          point: record.point,
          planePoint: record.planePoint,
          anchor: record.anchor,
          start: record.start,
          end: record.end,
          screenDelta: record.screenDelta,
          modelDelta: record.modelDelta,
          startScreen: record.startScreen,
          endScreen: record.endScreen,
          command: command?.type
            ? { type: command.type, start: command.start, end: command.end }
            : undefined,
        };
        if (phase !== 'wall-preview' || log.length % 12 === 0) {
          console.info('[bim:3d-wall]', JSON.stringify(consoleRecord));
        }
        window.dispatchEvent(new CustomEvent('bim:debug:3d-wall', { detail: record }));
      } catch {
        /* debug-only path */
      }
    }

    function placeCamera(): void {
      const snap = rig.snapshot();
      applySceneCameraPose(camera, snap);
      setCurrentAzimuth(snap.azimuth);
      setCurrentElevation(snap.elevation);
      const oc = orthoCameraRef.current;
      if (oc) {
        mirrorSceneCameraPose(camera, oc, snap.target);
      }
    }

    placeCamera();

    orbitRigApiRef.current = {
      applyViewpointMm: (pose) => {
        // Existing axis convention: pose.target.zMm → THREE.Y; pose.target.yMm → THREE.Z.
        rig.applyViewpoint(
          {
            x: pose.position.xMm / 1000,
            y: pose.position.zMm / 1000,
            z: pose.position.yMm / 1000,
          },
          {
            x: pose.target.xMm / 1000,
            y: pose.target.zMm / 1000,
            z: pose.target.yMm / 1000,
          },
          {
            x: pose.up.xMm / 1000,
            y: pose.up.zMm / 1000,
            z: pose.up.yMm / 1000,
          },
        );
        placeCamera();
      },
    };

    function pick(cx: number, cy: number, additive = false) {
      const levelDatumId = pickLevelDatumId(cx, cy);
      if (levelDatumId) {
        const store = useBimStore.getState();
        if (additive) store.toggleSelectedId(levelDatumId);
        else store.select(levelDatumId);
        store.setActiveLevelId(levelDatumId);
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((cx - rect.left) / rect.width) * 2 - 1;
      ndc.y = -(((cy - rect.top) / rect.height) * 2 - 1);
      camera.updateMatrixWorld(true);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(root.children, true);

      const first = hits.find((h) => typeof h.object.userData.bimPickId === 'string');
      const id = first?.object.userData.bimPickId as string | undefined;
      const store = useBimStore.getState();
      if (additive) {
        if (id) store.toggleSelectedId(id);
        return;
      }
      store.select(id);
    }

    function pickLevelDatumId(cx: number, cy: number): string | null {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((cx - rect.left) / rect.width) * 2 - 1;
      ndc.y = -(((cy - rect.top) / rect.height) * 2 - 1);
      camera.updateMatrixWorld(true);
      raycaster.setFromCamera(ndc, camera);
      const datumGroup = levelDatumGroupRef.current;
      if (!datumGroup) return null;
      const hits = raycaster.intersectObjects(datumGroup.children, true);
      for (const hit of hits) {
        const levelId = selectableLevelDatumId(hit.object);
        if (levelId) return levelId;
      }
      return null;
    }

    function activeDirect3dTool(): Direct3dAuthoringTool | null {
      const tool = planToolRef.current as Direct3dAuthoringTool;
      return DIRECT_3D_AUTHORING_TOOLS.has(tool) ? tool : null;
    }

    function resolveDraftLevelInfo(): {
      id: string;
      elevationMm: number;
      name: string;
    } | null {
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

    function resolveDraftLevels(): Array<{ id: string; elevationMm: number; name: string }> {
      return Object.values(elementsByIdRef.current)
        .filter((el): el is Extract<Element, { kind: 'level' }> => el.kind === 'level')
        .map((level) => ({ id: level.id, elevationMm: level.elevationMm, name: level.name }))
        .sort((a, b) => a.elevationMm - b.elevationMm);
    }

    function projectPointerToDraftPlane(
      cx: number,
      cy: number,
      elevationMm: number,
    ): DraftPlaneProjection | null {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((cx - rect.left) / rect.width) * 2 - 1;
      ndc.y = -(((cy - rect.top) / rect.height) * 2 - 1);
      camera.updateMatrixWorld(true);
      raycaster.setFromCamera(ndc, camera);
      const denom = raycaster.ray.direction.y;
      if (Math.abs(denom) < 1e-6) return null;
      const distanceM = elevationMm / 1000 / denom - raycaster.ray.origin.y / denom;
      if (!Number.isFinite(distanceM) || distanceM <= 0) return null;
      const hit = projectSceneRayToLevelPlaneMm(
        raycaster.ray.origin,
        raycaster.ray.direction,
        elevationMm,
      );
      if (!hit) return null;
      return {
        point: hit,
        screen: clientToCanvasScreen(cx, cy),
        distanceM,
      };
    }

    function findDraftPlaneBlocker(
      planeDistanceM: number,
      elevationMm: number,
    ): DraftPlaneProjection['blocker'] | undefined {
      const hits = raycaster.intersectObjects(root.children, true);
      for (const hit of hits) {
        if (!isDraftPlaneHitOccluded(planeDistanceM, hit.distance)) continue;
        const elementId = hit.object.userData.bimPickId as string | undefined;
        if (!elementId || isLinkedElementId(elementId)) continue;
        const element = elementsByIdRef.current[elementId];
        if (!element) continue;
        const hitElevationMm = hit.point.y * 1000;
        if (
          (element.kind === 'floor' || element.kind === 'site') &&
          Math.abs(hitElevationMm - elevationMm) <= 350
        ) {
          continue;
        }
        return { elementId, kind: element.kind, distanceM: hit.distance };
      }
      return undefined;
    }

    function projectPointerToVisibleDraftPlane(
      cx: number,
      cy: number,
      elevationMm: number,
    ): DraftPlaneProjection | null {
      const projected = projectPointerToDraftPlane(cx, cy, elevationMm);
      if (!projected) return null;
      const blocker = findDraftPlaneBlocker(projected.distanceM, elevationMm);
      return blocker ? { ...projected, blocker } : projected;
    }

    function clientToCanvasScreen(cx: number, cy: number): ScreenPoint {
      const rect = renderer.domElement.getBoundingClientRect();
      return { x: cx - rect.left, y: cy - rect.top };
    }

    function horizontalCameraVector(vec: THREE.Vector3): { xMm: number; yMm: number } | null {
      const len = Math.hypot(vec.x, vec.z);
      if (!Number.isFinite(len) || len < 1e-4) return null;
      return { xMm: vec.x / len, yMm: vec.z / len };
    }

    function createWallDraftScreenBasis(
      cx: number,
      cy: number,
      elevationMm: number,
      origin: { point: { xMm: number; yMm: number }; screen: ScreenPoint },
    ): { basis?: WallDraftScreenBasis; projection: WallDraftProjectionClassification } {
      const samplePx = 12;
      const sampleX = projectPointerToDraftPlane(cx + samplePx, cy, elevationMm);
      const sampleY = projectPointerToDraftPlane(cx, cy + samplePx, elevationMm);
      const scaleX = sampleX
        ? Math.hypot(
            (sampleX.point.xMm - origin.point.xMm) / samplePx,
            (sampleX.point.yMm - origin.point.yMm) / samplePx,
          )
        : 40;
      const scaleY = sampleY
        ? Math.hypot(
            (sampleY.point.xMm - origin.point.xMm) / samplePx,
            (sampleY.point.yMm - origin.point.yMm) / samplePx,
          )
        : scaleX;
      camera.updateMatrixWorld(true);
      const cameraDirection = new THREE.Vector3();
      camera.getWorldDirection(cameraDirection);
      const projection = classifyWallDraftProjection(scaleX, scaleY, cameraDirection.y);
      if (projection.mode === 'plane') return { projection };

      const scaleMmPerPx = THREE.MathUtils.clamp(scaleX, 5, 35);
      const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const sampledScreenRight = sampleX
        ? horizontalCameraVector(
            new THREE.Vector3(
              sampleX.point.xMm - origin.point.xMm,
              0,
              sampleX.point.yMm - origin.point.yMm,
            ),
          )
        : null;
      const projectedRight = sampledScreenRight ??
        horizontalCameraVector(cameraRight) ?? {
          xMm: 1,
          yMm: 0,
        };
      const xPerPx = {
        xMm: projectedRight.xMm * scaleMmPerPx,
        yMm: projectedRight.yMm * scaleMmPerPx,
      };
      return {
        projection,
        basis: {
          mode: 'elevation-axis',
          originScreen: origin.screen,
          originPointMm: origin.point,
          xPerPx,
          yPerPx: { xMm: 0, yMm: 0 },
          scaleMmPerPx,
          projection,
        },
      };
    }

    function pointFromWallDraftScreenBasis(
      cx: number,
      cy: number,
      basis: WallDraftScreenBasis,
    ): DraftPlaneProjection {
      const rect = renderer.domElement.getBoundingClientRect();
      const screen = { x: cx - rect.left, y: cy - rect.top };
      const dx = screen.x - basis.originScreen.x;
      const dy = screen.y - basis.originScreen.y;
      return {
        point: {
          xMm: basis.originPointMm.xMm + basis.xPerPx.xMm * dx + basis.yPerPx.xMm * dy,
          yMm: basis.originPointMm.yMm + basis.xPerPx.yMm * dx + basis.yPerPx.yMm * dy,
        },
        screen,
        distanceM: 0,
      };
    }

    function pickWallAtPointer(
      cx: number,
      cy: number,
      options?: {
        tool?: 'door' | 'window' | 'wall-opening';
        preferWallId?: string;
        lockToPreferred?: boolean;
      },
    ): {
      wall: Extract<Element, { kind: 'wall' }>;
      hitPointMm: { xMm: number; yMm: number; zMm: number };
      alongT: number;
    } | null {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((cx - rect.left) / rect.width) * 2 - 1;
      ndc.y = -(((cy - rect.top) / rect.height) * 2 - 1);
      camera.updateMatrixWorld(true);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(root.children, true);
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
        if (isBackfacingWallHit(h.face?.normal, h.object.matrixWorld, raycaster.ray.direction))
          continue;
        const wall = el;
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

    function projectSemanticPointToScreen(
      pointMm: { xMm: number; yMm: number; zMm: number },
      rect: DOMRect,
    ): ScreenPoint | null {
      const worldPoint = new THREE.Vector3(
        pointMm.xMm / 1000,
        pointMm.zMm / 1000,
        pointMm.yMm / 1000,
      );
      camera.updateMatrixWorld(true);
      worldPoint.project(camera);
      if (!Number.isFinite(worldPoint.x) || !Number.isFinite(worldPoint.y)) return null;
      return {
        x: (worldPoint.x + 1) * 0.5 * rect.width,
        y: (-worldPoint.y + 1) * 0.5 * rect.height,
      };
    }

    function snapDraftProjectionToActiveWorkPlane(
      projected: DraftPlaneProjection,
      levelInfo: { id: string; elevationMm: number },
      options: { preferWallConnectivity?: boolean } = {},
    ): DraftPlaneProjection {
      if (options.preferWallConnectivity) {
        const wallSnap = snapWallPointToConnectivity(
          projected.point,
          Object.values(elementsByIdRef.current).filter(
            (element): element is WallElem =>
              element.kind === 'wall' && element.levelId === levelInfo.id,
          ),
          {
            levelId: levelInfo.id,
            toleranceMm: 160,
          },
        );
        if (wallSnap) {
          const screen =
            projectSemanticPointToScreen(
              { ...wallSnap.point, zMm: levelInfo.elevationMm },
              renderer.domElement.getBoundingClientRect(),
            ) ?? projected.screen;
          const snapKind: Authoring3dSnapKind =
            wallSnap.kind === 'endpoint'
              ? 'wall-endpoint'
              : wallSnap.kind === 'intersection'
                ? 'wall-intersection'
                : 'wall-segment';
          return {
            ...projected,
            point: wallSnap.point,
            screen,
            snapKind,
            snapScreen: screen,
          };
        }
      }
      const snapped = snapDraftPointToGrid(projected.point, {
        gridStepMm: 250,
        snapMm: 85,
      });
      if (snapped.kind === 'level-plane') {
        return { ...projected, snapKind: 'level-plane', snapScreen: projected.screen };
      }
      const screen =
        projectSemanticPointToScreen(
          { ...snapped.point, zMm: levelInfo.elevationMm },
          renderer.domElement.getBoundingClientRect(),
        ) ?? projected.screen;
      return {
        ...projected,
        point: snapped.point,
        screen,
        snapKind: snapped.kind,
        snapScreen: screen,
      };
    }

    function resolveDraftWallThicknessMm(): number {
      const runtime = useBimStore.getState();
      const activeTypeId = runtime.activeWallTypeId;
      if (activeTypeId) {
        const typeEl = elementsByIdRef.current[activeTypeId];
        if (typeEl?.kind === 'wall_type' && Array.isArray(typeEl.layers)) {
          const sumMm = typeEl.layers.reduce(
            (acc, layer) => acc + Math.max(0, Number(layer.thicknessMm) || 0),
            0,
          );
          if (sumMm > 0) return sumMm;
        }
      }
      return 200;
    }

    function tintWallDraftPreviewObject(object: THREE.Object3D): void {
      const accent = readToken('--color-accent', '#2563eb');
      object.userData.isAuthoringPreview = true;
      delete object.userData.bimPickId;
      object.traverse((node) => {
        delete node.userData.bimPickId;
        node.userData.isAuthoringPreview = true;
        if (node instanceof THREE.LineSegments) {
          const oldMaterial = node.material;
          node.material = new THREE.LineBasicMaterial({
            color: accent,
            transparent: true,
            opacity: 0.92,
            depthTest: false,
            depthWrite: false,
          });
          const oldMaterials = Array.isArray(oldMaterial) ? oldMaterial : [oldMaterial];
          oldMaterials.forEach((material) => material.dispose());
          node.renderOrder = 18;
          return;
        }
        if (!(node instanceof THREE.Mesh)) return;
        const oldMaterial = node.material;
        node.material = new THREE.MeshBasicMaterial({
          color: accent,
          transparent: true,
          opacity: 0.48,
          depthTest: false,
          depthWrite: false,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        });
        const oldMaterials = Array.isArray(oldMaterial) ? oldMaterial : [oldMaterial];
        oldMaterials.forEach((material) => material.dispose());
        node.castShadow = false;
        node.receiveShadow = false;
        node.renderOrder = 17;
      });
    }

    function updateWallDraftPreviewGroup(
      start: { xMm: number; yMm: number },
      end: { xMm: number; yMm: number },
      levelInfo: { id: string; elevationMm: number },
      flip: boolean,
    ): THREE.Object3D | null {
      const runtime = useBimStore.getState();
      const lengthMm = Math.hypot(end.xMm - start.xMm, end.yMm - start.yMm);
      clearWallDraftPreviewGroup();
      if (!Number.isFinite(lengthMm) || lengthMm < 10) return null;
      const effectiveLocationLine = flip
        ? flipWallLocationLineSide(runtime.wallLocationLine)
        : runtime.wallLocationLine;
      const wall: WallElem = {
        kind: 'wall',
        id: '__wall-draft-preview__',
        name: 'Wall preview',
        levelId: levelInfo.id,
        start,
        end,
        thicknessMm: resolveDraftWallThicknessMm(),
        heightMm: runtime.wallDrawHeightMm,
        wallTypeId: runtime.activeWallTypeId ?? undefined,
        locationLine: effectiveLocationLine as WallElem['locationLine'],
      };
      const preview = makeWallMesh(
        wall,
        levelInfo.elevationMm / 1000,
        paintBundleRef.current,
        elementsByIdRef.current,
      );
      tintWallDraftPreviewObject(preview);
      applyClippingPlanesToMeshes(preview, clippingPlanesRef.current);
      applyModelEdgeDisplay(preview, viewerEdgesRef.current, viewerSilhouetteEdgeWidthRef.current);
      scene.add(preview);
      wallDraftPreviewGroupRef.current = preview;
      return preview;
    }

    function dispatchLinePreviewPayload(payload: Authoring3dLinePreviewPayload): void {
      if (payload.tool === 'stair') {
        const levels = resolveDraftLevels();
        const baseIndex = levels.findIndex((level) => level.id === payload.levelId);
        const topLevel = baseIndex >= 0 ? levels[baseIndex + 1] : undefined;
        onSemanticCommand?.({
          ...linePreviewToSemanticCommand(payload),
          topLevelId: topLevel?.id ?? payload.levelId,
          widthMm: 1100,
          riserMm: 175,
          treadMm: 275,
        });
        return;
      }
      onSemanticCommand?.(linePreviewToSemanticCommand(payload));
    }

    function hostedToolSpec(tool: HostedFamilyTool) {
      return resolveHostedFamilyPlacement({
        tool,
        familyTypeId: activeComponentFamilyTypeId,
        elementsById: elementsByIdRef.current,
      });
    }

    function hostedPreviewSegment(
      tool: HostedFamilyTool,
      hit: {
        wall: Extract<Element, { kind: 'wall' }>;
        hitPointMm: { xMm: number; yMm: number; zMm: number };
        alongT: number;
      },
      rect: DOMRect,
    ): {
      center: ScreenPoint;
      start?: ScreenPoint;
      end?: ScreenPoint;
      outline?: ScreenPoint[];
      auxLines?: Array<{ start: ScreenPoint; end: ScreenPoint }>;
      auxArcPath?: string;
      valid: boolean;
      invalidReason?: string;
    } | null {
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
        const dx = lowerEnd.x - lowerStart.x;
        const dy = lowerEnd.y - lowerStart.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        const nx = -dy / len;
        const ny = dx / len;
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

    function handle3dDirectToolClick(cx: number, cy: number): boolean {
      const tool = activeDirect3dTool();
      if (!tool) {
        lineDraftStart = null;
        polygonDraft = null;
        hostPreviewLock = false;
        setAuthoringOverlay(null);
        return false;
      }
      if (tool !== 'door' && tool !== 'window' && tool !== 'wall-opening') {
        hostPreviewLock = false;
      }
      if (!POLYGON_3D_AUTHORING_TOOLS.has(tool)) polygonDraft = null;
      if (!LINE_3D_AUTHORING_TOOLS.has(tool)) lineDraftStart = null;
      if (tool === 'door' || tool === 'window' || tool === 'wall-opening') {
        setDraftPlaneAngleWarning(false);
        const overlay = authoringOverlayRef.current;
        const hit = pickWallAtPointer(cx, cy, {
          tool,
          preferWallId: overlay?.tool === tool ? overlay.previewHostWallId : undefined,
          lockToPreferred: hostPreviewLock,
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
                  previewHostWallId: hostPreviewLock ? prev.previewHostWallId : undefined,
                  previewHostAlongT: hostPreviewLock ? prev.previewHostAlongT : undefined,
                  previewHostLock: hostPreviewLock,
                  previewHostInvalidReason: 'No visible wall host under the cursor.',
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
                  previewHostLock: hostPreviewLock,
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
          isDuplicateHostedPlacement(lastHostedPlacementScreen, nextPlacementScreen, 900) ||
          isDuplicateHostedPlacement(lastHostedPlacementHost, nextPlacementHost, 1500)
        ) {
          return true;
        }
        lastHostedPlacementScreen = nextPlacementScreen;
        lastHostedPlacementHost = nextPlacementHost;
        const hostedSpec = hostedToolSpec(tool);
        const hostedFamilyTypeId = hostedSpec.familyTypeId;
        if (tool === 'door') {
          onSemanticCommand?.({
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
          onSemanticCommand?.({
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
        onSemanticCommand?.({
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
          phase: lineDraftStart?.tool === 'wall' ? 'pick-end' : 'pick-start',
          levelName: levelInfo.name,
          startScreen: lineDraftStart?.screen,
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
        lineDraftStart?.tool === 'wall' &&
        lineDraftStart.wallBasis
      ) {
        projected = pointFromWallDraftScreenBasis(cx, cy, lineDraftStart.wallBasis);
      }
      if (!projected && tool === 'wall' && (!lineDraftStart || lineDraftStart.tool !== tool)) {
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
      if (!projected && tool === 'wall' && lineDraftStart?.tool === 'wall') {
        clearWallDraftPreviewGroup();
        emitWallDebug('wall-blocked-no-draft-plane-end', {
          screen: clientToCanvasScreen(cx, cy),
          start: lineDraftStart.point,
          startScreen: lineDraftStart.screen,
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
        onSemanticCommand?.({
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
        onSemanticCommand?.({
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
          onSemanticCommand?.({
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
          onSemanticCommand?.({
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
        onSemanticCommand?.({
          type: 'placeFamilyInstance',
          familyTypeId: selectedFamilyTypeId,
          levelId: levelInfo.id,
          positionMm: projected.point,
          rotationDeg: pendingComponentRotationDeg,
        });
        return true;
      }
      if (LINE_3D_AUTHORING_TOOLS.has(tool)) {
        if (!lineDraftStart || lineDraftStart.tool !== tool) {
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
          lineDraftStart = {
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
            wallFlipActive: tool === 'wall' ? wallFlipNextSegment : undefined,
            wallProjectionMode: tool === 'wall' ? wallDraft?.projection.mode : undefined,
            wallAnchorRequired: false,
            wallPlaneUnreadable: false,
            wallPlaneOccluded: false,
          });
          return true;
        }
        const start = lineDraftStart.point;
        const lineProjected =
          tool === 'wall' && lineDraftStart.wallBasis
            ? pointFromWallDraftScreenBasis(cx, cy, lineDraftStart.wallBasis)
            : projected;
        const end = lineProjected.point;
        const levelId = lineDraftStart.levelId;
        if (Math.hypot(end.xMm - start.xMm, end.yMm - start.yMm) < 10) {
          if (tool === 'wall') {
            clearWallDraftPreviewGroup();
            emitWallDebug('wall-short-segment-reset', {
              start,
              end,
              startScreen: lineDraftStart.screen,
              endScreen: lineProjected.screen,
              lengthMm: Math.hypot(end.xMm - start.xMm, end.yMm - start.yMm),
            });
          }
          lineDraftStart = null;
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
          const flip = wallFlipNextSegment;
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
            startScreen: lineDraftStart.screen,
            endScreen: lineProjected.screen,
            projection: lineDraftStart.wallProjection,
            basis: lineDraftStart.wallBasis,
            screenDelta: lineDraftStart.screen
              ? {
                  x: lineProjected.screen.x - lineDraftStart.screen.x,
                  y: lineProjected.screen.y - lineDraftStart.screen.y,
                }
              : undefined,
            modelDelta: {
              xMm: actualEnd.xMm - actualStart.xMm,
              yMm: actualEnd.yMm - actualStart.yMm,
            },
            lengthMm: Math.hypot(actualEnd.xMm - actualStart.xMm, actualEnd.yMm - actualStart.yMm),
          });
          lineDraftStart = null;
          clearWallDraftPreviewGroup();
          wallFlipNextSegment = false;
          dispatchLinePreviewPayload(previewPayload);
        } else {
          const previewPayload = buildLinePreviewPayload({
            tool: lineDraftStart.tool,
            levelId,
            start,
            end,
          });
          lineDraftStart = null;
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
          wallFlipActive: tool === 'wall' ? wallFlipNextSegment : undefined,
          wallProjectionMode: undefined,
        });
        return true;
      }
      if (POLYGON_3D_AUTHORING_TOOLS.has(tool)) {
        if (!polygonDraft || polygonDraft.tool !== tool) {
          polygonDraft = {
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
        if (polygonDraft.points.length >= 3 && priorPoints[0]) {
          const closeDistancePx = Math.hypot(
            projected.screen.x - priorPoints[0].x,
            projected.screen.y - priorPoints[0].y,
          );
          if (closeDistancePx <= 14) {
            if (tool === 'ceiling') {
              onSemanticCommand?.(
                polygonPreviewToSemanticCommand(
                  buildPolygonPreviewPayload({
                    tool: 'ceiling',
                    levelId: polygonDraft.levelId,
                    points: polygonDraft.points,
                  }),
                ),
              );
            } else if (tool === 'floor') {
              onSemanticCommand?.(
                polygonPreviewToSemanticCommand(
                  buildPolygonPreviewPayload({
                    tool: 'floor',
                    levelId: polygonDraft.levelId,
                    points: polygonDraft.points,
                  }),
                ),
              );
            } else if (tool === 'roof') {
              onSemanticCommand?.(
                polygonPreviewToSemanticCommand(
                  buildPolygonPreviewPayload({
                    tool: 'roof',
                    levelId: polygonDraft.levelId,
                    points: polygonDraft.points,
                  }),
                ),
              );
            } else if (tool === 'area') {
              onSemanticCommand?.(
                polygonPreviewToSemanticCommand(
                  buildPolygonPreviewPayload({
                    tool: 'area',
                    levelId: polygonDraft.levelId,
                    points: polygonDraft.points,
                  }),
                ),
              );
            } else if (tool === 'shaft') {
              const boundaryMm = polygonDraft.points.map((p) => ({ xMm: p.xMm, yMm: p.yMm }));
              const draftLevelId = polygonDraft.levelId;
              const floors = Object.values(elementsByIdRef.current).filter(
                (el): el is Extract<Element, { kind: 'floor' }> => el.kind === 'floor',
              );
              const hostFloor = floors.find((floor) => floor.levelId === draftLevelId) ?? floors[0];
              if (hostFloor) {
                onSemanticCommand?.({
                  type: 'createSlabOpening',
                  hostFloorId: hostFloor.id,
                  boundaryMm,
                  isShaft: true,
                });
              }
            }
            polygonDraft = null;
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
        polygonDraft.points.push(projected.point);
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

    /** EDT-03 — raycast against the current selection's grip pickables. */
    function gripPreRaycast(
      cx: number,
      cy: number,
    ): {
      hit: boolean;
      descriptor?: Grip3dDescriptor;
      mesh?: THREE.Object3D;
    } {
      const pickables = gripPickablesRef.current;
      if (!pickables || pickables.length === 0) return { hit: false };
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((cx - rect.left) / rect.width) * 2 - 1;
      ndc.y = -(((cy - rect.top) / rect.height) * 2 - 1);
      camera.updateMatrixWorld(true);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(pickables, false);
      const first = hits[0];
      if (!first) return { hit: false };
      const desc = first.object.userData.grip3dDescriptor as Grip3dDescriptor | undefined;
      if (!desc) return { hit: false };
      return { hit: true, descriptor: desc, mesh: first.object };
    }

    /**
     * Project the cursor ray onto the grip's drag axis through the
     * descriptor's anchor; return the world-space delta in millimetres
     * along that axis. For free-axis grips ('xy' / 'xyz') we project
     * onto the horizontal plane through the anchor and return the
     * planar magnitude (signed by X movement direction).
     */
    function projectGripDelta(
      descriptor: Grip3dDescriptor,
      cx: number,
      cy: number,
      anchorScene: THREE.Vector3,
    ): number {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((cx - rect.left) / rect.width) * 2 - 1;
      ndc.y = -(((cy - rect.top) / rect.height) * 2 - 1);
      camera.updateMatrixWorld(true);
      raycaster.setFromCamera(ndc, camera);
      const ray = raycaster.ray;
      const axisDir = new THREE.Vector3();
      switch (descriptor.axis) {
        case 'x':
          axisDir.set(1, 0, 0);
          break;
        case 'y':
          axisDir.set(0, 0, 1); // semantic-Y → scene-Z
          break;
        case 'z':
          axisDir.set(0, 1, 0); // semantic-Z (elev) → scene-Y
          break;
        default: {
          // 'xy' / 'xyz' — project onto horizontal plane through anchor.
          const planeY = anchorScene.y;
          const t = (planeY - ray.origin.y) / (ray.direction.y || 1e-9);
          const hit = ray.origin.clone().add(ray.direction.clone().multiplyScalar(t));
          const dx = hit.x - anchorScene.x;
          const dz = hit.z - anchorScene.z;
          const planar = Math.hypot(dx, dz) * Math.sign(dx === 0 ? dz : dx);
          return planar * 1000;
        }
      }
      // Closest point on line { anchor + s * axisDir } to ray { origin + t * dir }.
      const w = anchorScene.clone().sub(ray.origin);
      const a = axisDir.dot(axisDir);
      const b = axisDir.dot(ray.direction);
      const c = ray.direction.dot(ray.direction);
      const d = axisDir.dot(w);
      const e = ray.direction.dot(w);
      const denom = a * c - b * b;
      const s = denom === 0 ? 0 : (b * e - c * d) / denom;
      return s * 1000;
    }

    function onResize() {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h);
      composer.setSize(w, h);
      ssao.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const oc = orthoCameraRef.current;
      if (oc) {
        const f = rig.orthoFrustum(w / h);
        oc.left = f.left;
        oc.right = f.right;
        oc.top = f.top;
        oc.bottom = f.bottom;
        oc.near = f.near;
        oc.far = f.far;
        oc.updateProjectionMatrix();
      }
    }

    const ro = new ResizeObserver(onResize);
    ro.observe(host);
    onResize();

    function onDown(ev: PointerEvent): void {
      if (walkController.snapshot().active && !document.pointerLockElement) {
        host.requestPointerLock();
        return;
      }
      if (ev.button === 0) {
        const levelDatumId = pickLevelDatumId(ev.clientX, ev.clientY);
        if (levelDatumId) {
          const store = useBimStore.getState();
          store.select(levelDatumId);
          store.setActiveLevelId(levelDatumId);
          dragMoved = false;
          dragging = null;
          ev.preventDefault();
          return;
        }
      }
      if (
        DIRECT_3D_AUTHORING_TOOLS.has(planToolRef.current as Direct3dAuthoringTool) &&
        ev.button === 0 &&
        !ev.altKey &&
        !ev.shiftKey
      ) {
        const directTool = planToolRef.current as Direct3dAuthoringTool;
        dragging = 'tool-draft';
        toolDraftTool = directTool;
        toolDraftStartedLineOnDown = false;
        toolDraftConsumedOnDown = false;
        dragMoved = false;
        cumulativeDragPx = 0;
        lastX = ev.clientX;
        lastY = ev.clientY;
        (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
        if (LINE_3D_AUTHORING_TOOLS.has(directTool) && !lineDraftStart) {
          toolDraftConsumedOnDown = handle3dDirectToolClick(ev.clientX, ev.clientY);
          const currentDraft = lineDraftStart as { tool: Direct3dAuthoringTool } | null;
          toolDraftStartedLineOnDown = currentDraft?.tool === directTool;
        }
        return;
      }
      // EDT-03 — grip pre-pass. If the pointer is over a grip pickable,
      // start a grip drag instead of an orbit/pan.
      if (ev.button === 0) {
        const pre = gripPreRaycast(ev.clientX, ev.clientY);
        if (pre.hit && pre.descriptor) {
          const desc = pre.descriptor;
          // Scene convention: semantic-Y → scene-Z; semantic-Z → scene-Y.
          const anchorScene = new THREE.Vector3(
            desc.position.xMm / 1000,
            desc.position.zMm / 1000,
            desc.position.yMm / 1000,
          );
          const indicator =
            desc.axis === 'x' || desc.axis === 'y' || desc.axis === 'z'
              ? buildAxisIndicator(scene, desc.position, desc.axis, 1500)
              : null;
          activeGrip = { descriptor: desc, anchorScene, indicator, lastDeltaMm: 0 };
          dragging = 'grip';
          dragMoved = false;
          cumulativeDragPx = 0;
          lastX = ev.clientX;
          lastY = ev.clientY;
          (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
          return;
        }
      }
      const intent = classifyPointer({
        button: ev.button,
        altKey: ev.altKey,
        shiftKey: ev.shiftKey,
      });
      if (intent === 'pan') dragging = 'pan';
      else if (intent === 'orbit') dragging = 'orbit';
      else if (ev.button === 0)
        dragging = 'orbit'; // LMB drag = orbit (trackpad primary)
      else dragging = null;
      dragMoved = false;
      cumulativeDragPx = 0;
      inertiaVx = 0;
      inertiaVy = 0;
      lastX = ev.clientX;
      lastY = ev.clientY;
      (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
    }

    function onUp(ev: PointerEvent): void {
      const wasDragging = dragging;
      const draftTool = toolDraftTool;
      const startedLineOnDown = toolDraftStartedLineOnDown;
      const consumedOnDown = toolDraftConsumedOnDown;
      dragging = null;
      toolDraftTool = null;
      toolDraftStartedLineOnDown = false;
      toolDraftConsumedOnDown = false;
      try {
        (ev.target as HTMLElement).releasePointerCapture(ev.pointerId);
      } catch {
        /* noop */
      }
      if (wasDragging === 'grip' && activeGrip) {
        // EDT-03 — commit the grip drag through the engine bus.
        const spec = activeGrip.descriptor.onCommit(activeGrip.lastDeltaMm);
        if (spec) {
          const dispatch = handleGripCommandRef.current;
          if (dispatch) dispatch(spec);
        }
        activeGrip.indicator?.dispose();
        activeGrip = null;
        return;
      }
      if (shouldCommitHostedPlacementOnPointerUp({ wasDragging, draftTool })) {
        handle3dDirectToolClick(ev.clientX, ev.clientY);
        return;
      }
      if (
        wasDragging === 'tool-draft' &&
        dragMoved &&
        draftTool &&
        LINE_3D_AUTHORING_TOOLS.has(draftTool) &&
        lineDraftStart?.tool === draftTool
      ) {
        handle3dDirectToolClick(ev.clientX, ev.clientY);
        return;
      }
      if (!dragMoved && wasDragging === 'tool-draft' && !startedLineOnDown && !consumedOnDown) {
        handle3dDirectToolClick(ev.clientX, ev.clientY);
        return;
      }
      if (!dragMoved && ev.button === 0 && (wasDragging === 'orbit' || wasDragging === 'pan')) {
        pick(ev.clientX, ev.clientY, ev.shiftKey || ev.ctrlKey || ev.metaKey || ev.altKey);
      }
    }

    function onPointerCancel(ev: PointerEvent): void {
      try {
        (ev.target as HTMLElement).releasePointerCapture(ev.pointerId);
      } catch {
        /* noop */
      }
      if (dragging === 'grip' && activeGrip) {
        activeGrip.indicator?.dispose();
        activeGrip = null;
      }
      dragging = null;
      toolDraftTool = null;
      toolDraftStartedLineOnDown = false;
      toolDraftConsumedOnDown = false;
      dragMoved = false;
      cumulativeDragPx = 0;
      clearWallDraftPreviewGroup();
    }

    function onMove(ev: PointerEvent): void {
      const directTool = activeDirect3dTool();
      if (
        directTool &&
        (LINE_3D_AUTHORING_TOOLS.has(directTool) ||
          POLYGON_3D_AUTHORING_TOOLS.has(directTool) ||
          directTool === 'column' ||
          directTool === 'room' ||
          directTool === 'component')
      ) {
        const levelInfo = resolveDraftLevelInfo();
        if (levelInfo) {
          const stable = isDraftPlaneProjectionStable(
            ev.clientX,
            ev.clientY,
            levelInfo.elevationMm,
          );
          const requireStablePlane = directTool !== 'wall';
          if (requireStablePlane && stable === draftPlaneAngleWarningRef.current)
            setDraftPlaneAngleWarning(!stable);
          if (requireStablePlane && !stable) {
            setAuthoringOverlay((prev) =>
              prev?.tool === directTool
                ? {
                    ...prev,
                    currentPointMm: undefined,
                    wallPreviewOutlineScreen: undefined,
                    wallPreviewDirectionStartScreen: undefined,
                    wallPreviewDirectionEndScreen: undefined,
                  }
                : prev,
            );
            return;
          }
          let projected =
            directTool === 'wall'
              ? projectPointerToVisibleDraftPlane(ev.clientX, ev.clientY, levelInfo.elevationMm)
              : projectPointerToDraftPlane(ev.clientX, ev.clientY, levelInfo.elevationMm);
          if (projected) {
            if (directTool === 'wall' && projected.blocker && !lineDraftStart) {
              const blockedProjection = projected;
              setAuthoringOverlay((prev) =>
                prev?.tool === directTool
                  ? {
                      ...prev,
                      phase: 'pick-start',
                      levelName: levelInfo.name,
                      currentScreen: blockedProjection.screen,
                      currentPointMm: undefined,
                      wallProjectionMode: 'plane',
                      wallAnchorRequired: true,
                      wallPlaneUnreadable: false,
                      wallPlaneOccluded: true,
                      wallPreviewOutlineScreen: undefined,
                      wallPreviewDirectionStartScreen: undefined,
                      wallPreviewDirectionEndScreen: undefined,
                    }
                  : prev,
              );
              return;
            }
            const snappedProjection = snapDraftProjectionToActiveWorkPlane(projected, levelInfo, {
              preferWallConnectivity: directTool === 'wall',
            });
            if (!snappedProjection) return;
            projected = snappedProjection;
            const activeProjection = projected;
            if (LINE_3D_AUTHORING_TOOLS.has(directTool) && !lineDraftStart) {
              let currentScreen = activeProjection.screen;
              let currentPointMm: { xMm: number; yMm: number } | undefined = activeProjection.point;
              let wallProjectionMode: WallDraftProjectionMode | undefined;
              const wallAnchorRequired = false;
              let wallPlaneUnreadable = false;
              const wallPlaneOccluded = false;
              if (directTool === 'wall') {
                const wallDraft = createWallDraftScreenBasis(
                  ev.clientX,
                  ev.clientY,
                  levelInfo.elevationMm,
                  activeProjection,
                );
                wallProjectionMode = wallDraft.projection.mode;
                if (wallDraft.projection.mode !== 'plane') {
                  currentScreen = activeProjection.screen;
                  currentPointMm = undefined;
                  wallPlaneUnreadable = true;
                }
              }
              setAuthoringOverlay((prev) =>
                prev?.tool === directTool
                  ? {
                      ...prev,
                      phase: 'pick-start',
                      levelName: levelInfo.name,
                      currentScreen,
                      currentPointMm,
                      workPlaneElevationMm: levelInfo.elevationMm,
                      snapKind: activeProjection.snapKind,
                      snapScreen: activeProjection.snapScreen,
                      wallProjectionMode,
                      wallAnchorRequired,
                      wallPlaneUnreadable,
                      wallPlaneOccluded,
                      wallPreviewOutlineScreen: undefined,
                      wallPreviewDirectionStartScreen: undefined,
                      wallPreviewDirectionEndScreen: undefined,
                    }
                  : prev,
              );
            } else if ((directTool === 'column' || directTool === 'room') && !lineDraftStart) {
              setAuthoringOverlay((prev) =>
                prev?.tool === directTool
                  ? {
                      ...prev,
                      phase: 'pick-point',
                      levelName: levelInfo.name,
                      currentScreen: activeProjection.screen,
                      currentPointMm: activeProjection.point,
                      workPlaneElevationMm: levelInfo.elevationMm,
                      snapKind: activeProjection.snapKind,
                      snapScreen: activeProjection.snapScreen,
                    }
                  : prev,
              );
            } else if (
              POLYGON_3D_AUTHORING_TOOLS.has(directTool) &&
              (!polygonDraft || polygonDraft.points.length === 0)
            ) {
              setAuthoringOverlay((prev) =>
                prev?.tool === directTool
                  ? {
                      ...prev,
                      phase: 'pick-vertex',
                      levelName: levelInfo.name,
                      currentScreen: activeProjection.screen,
                      currentPointMm: activeProjection.point,
                      workPlaneElevationMm: levelInfo.elevationMm,
                      snapKind: activeProjection.snapKind,
                      snapScreen: activeProjection.snapScreen,
                    }
                  : prev,
              );
            }
          } else if (directTool === 'wall' && !lineDraftStart) {
            setAuthoringOverlay((prev) =>
              prev?.tool === directTool
                ? {
                    ...prev,
                    phase: 'pick-start',
                    levelName: levelInfo.name,
                    currentScreen: clientToCanvasScreen(ev.clientX, ev.clientY),
                    currentPointMm: undefined,
                    wallProjectionMode: 'plane',
                    wallAnchorRequired: true,
                    wallPlaneUnreadable: true,
                    wallPlaneOccluded: false,
                    wallPreviewOutlineScreen: undefined,
                    wallPreviewDirectionStartScreen: undefined,
                    wallPreviewDirectionEndScreen: undefined,
                  }
                : prev,
            );
          }
        }
      }
      if (
        directTool &&
        lineDraftStart &&
        authoringOverlayRef.current?.tool === lineDraftStart.tool &&
        authoringOverlayRef.current?.phase === 'pick-end'
      ) {
        const rect = renderer.domElement.getBoundingClientRect();
        const levelInfo = resolveDraftLevelInfo();
        let projected = levelInfo
          ? lineDraftStart.tool === 'wall' && lineDraftStart.wallBasis
            ? pointFromWallDraftScreenBasis(ev.clientX, ev.clientY, lineDraftStart.wallBasis)
            : lineDraftStart.tool === 'wall'
              ? projectPointerToVisibleDraftPlane(ev.clientX, ev.clientY, levelInfo.elevationMm)
              : projectPointerToDraftPlane(ev.clientX, ev.clientY, levelInfo.elevationMm)
          : null;
        if (lineDraftStart.tool === 'wall' && (!projected || projected.blocker || !levelInfo)) {
          clearWallDraftPreviewGroup();
        }
        if (projected && levelInfo && !projected.blocker) {
          projected = snapDraftProjectionToActiveWorkPlane(projected, levelInfo, {
            preferWallConnectivity: lineDraftStart.tool === 'wall',
          });
        }
        setAuthoringOverlay((prev) =>
          prev?.phase === 'pick-end'
            ? prev.tool === 'wall' && lineDraftStart && projected && !projected.blocker && levelInfo
              ? (() => {
                  const previewMesh = updateWallDraftPreviewGroup(
                    lineDraftStart.point,
                    projected.point,
                    levelInfo,
                    wallFlipNextSegment,
                  );
                  emitWallDebug('wall-preview', {
                    start: lineDraftStart.point,
                    end: projected.point,
                    startScreen: lineDraftStart.screen,
                    endScreen: projected.screen,
                    projection: lineDraftStart.wallProjection,
                    basis: lineDraftStart.wallBasis,
                    screenDelta: lineDraftStart.screen
                      ? {
                          x: projected.screen.x - lineDraftStart.screen.x,
                          y: projected.screen.y - lineDraftStart.screen.y,
                        }
                      : undefined,
                    modelDelta: {
                      xMm: projected.point.xMm - lineDraftStart.point.xMm,
                      yMm: projected.point.yMm - lineDraftStart.point.yMm,
                    },
                    lengthMm: Math.hypot(
                      projected.point.xMm - lineDraftStart.point.xMm,
                      projected.point.yMm - lineDraftStart.point.yMm,
                    ),
                    previewMesh: Boolean(previewMesh),
                  });
                  return {
                    ...prev,
                    currentScreen: projected.screen,
                    currentPointMm: projected.point,
                    workPlaneElevationMm: levelInfo.elevationMm,
                    snapKind: projected.snapKind,
                    snapScreen: projected.snapScreen,
                    wallFlipActive: wallFlipNextSegment,
                    wallProjectionMode: lineDraftStart.wallProjection?.mode,
                    wallPreviewOutlineScreen: undefined,
                    wallPreviewDirectionStartScreen: undefined,
                    wallPreviewDirectionEndScreen: undefined,
                    wallAnchorRequired: false,
                    wallPlaneUnreadable: false,
                    wallPlaneOccluded: false,
                  };
                })()
              : {
                  ...prev,
                  currentScreen: {
                    x: ev.clientX - rect.left,
                    y: ev.clientY - rect.top,
                  },
                  currentPointMm: prev.tool === 'wall' ? undefined : projected?.point,
                  workPlaneElevationMm: levelInfo?.elevationMm,
                  snapKind: projected?.snapKind,
                  snapScreen: projected?.snapScreen,
                  wallPreviewOutlineScreen: undefined,
                  wallPreviewDirectionStartScreen: undefined,
                  wallPreviewDirectionEndScreen: undefined,
                  wallAnchorRequired: prev.tool === 'wall' ? true : prev.wallAnchorRequired,
                  wallPlaneUnreadable:
                    prev.tool === 'wall' ? !projected || !levelInfo : prev.wallPlaneUnreadable,
                  wallPlaneOccluded:
                    prev.tool === 'wall' ? Boolean(projected?.blocker) : prev.wallPlaneOccluded,
                }
            : prev,
        );
      }
      if (
        directTool &&
        POLYGON_3D_AUTHORING_TOOLS.has(directTool) &&
        polygonDraft &&
        polygonDraft.tool === directTool &&
        polygonDraft.points.length > 0 &&
        authoringOverlayRef.current?.tool === directTool
      ) {
        const levelInfo = resolveDraftLevelInfo();
        const projected = levelInfo
          ? projectPointerToDraftPlane(ev.clientX, ev.clientY, levelInfo.elevationMm)
          : null;
        const snapped =
          projected && levelInfo
            ? snapDraftProjectionToActiveWorkPlane(projected, levelInfo)
            : null;
        setAuthoringOverlay((prev) =>
          prev?.tool === directTool
            ? {
                ...prev,
                currentScreen: snapped?.screen ?? clientToCanvasScreen(ev.clientX, ev.clientY),
                currentPointMm: snapped?.point,
                workPlaneElevationMm: levelInfo?.elevationMm,
                snapKind: snapped?.snapKind,
                snapScreen: snapped?.snapScreen,
              }
            : prev,
        );
      }
      if (directTool === 'door' || directTool === 'window' || directTool === 'wall-opening') {
        const rect = renderer.domElement.getBoundingClientRect();
        const hit = pickWallAtPointer(ev.clientX, ev.clientY, {
          tool: directTool,
          preferWallId:
            authoringOverlayRef.current?.tool === directTool
              ? authoringOverlayRef.current.previewHostWallId
              : undefined,
          lockToPreferred: hostPreviewLock,
        });
        if (!hit) {
          setAuthoringOverlay((prev) =>
            prev?.tool === directTool
              ? {
                  ...prev,
                  currentScreen: {
                    x: ev.clientX - rect.left,
                    y: ev.clientY - rect.top,
                  },
                  previewOutlineScreen: undefined,
                  previewStartScreen: undefined,
                  previewEndScreen: undefined,
                  previewHostValid: false,
                  previewHostWallId: hostPreviewLock ? prev.previewHostWallId : undefined,
                  previewHostAlongT: hostPreviewLock ? prev.previewHostAlongT : undefined,
                  previewHostLock: hostPreviewLock,
                  previewHostInvalidReason: 'No visible wall host under the cursor.',
                  previewAuxLines: undefined,
                  previewAuxArcPath: undefined,
                }
              : prev,
          );
        } else {
          const preview = hostedPreviewSegment(directTool, hit, rect);
          if (preview) {
            setAuthoringOverlay((prev) =>
              prev?.tool === directTool
                ? {
                    ...prev,
                    currentScreen: preview.center,
                    previewOutlineScreen: preview.outline,
                    previewStartScreen: preview.start,
                    previewEndScreen: preview.end,
                    previewHostValid: preview.valid,
                    previewHostWallId: hit.wall.id,
                    previewHostAlongT: hit.alongT,
                    previewHostLock: hostPreviewLock,
                    previewHostInvalidReason: preview.invalidReason,
                    previewAuxLines: preview.auxLines,
                    previewAuxArcPath: preview.auxArcPath,
                  }
                : prev,
            );
          }
        }
      }
      if (!dragging) return;
      const dx = ev.clientX - lastX;
      const dy = ev.clientY - lastY;
      lastX = ev.clientX;
      lastY = ev.clientY;
      cumulativeDragPx += Math.hypot(dx, dy);
      if (cumulativeDragPx > DRAG_THRESHOLD_PX) dragMoved = true;
      if (!dragMoved) return;
      if (dragging === 'tool-draft') return;
      if (dragging === 'grip' && activeGrip) {
        const deltaMm = projectGripDelta(
          activeGrip.descriptor,
          ev.clientX,
          ev.clientY,
          activeGrip.anchorScene,
        );
        activeGrip.lastDeltaMm = deltaMm;
        // Emit live preview via onDrag so listeners (e.g. property HUD)
        // can show the in-progress value without writing to the store.
        activeGrip.descriptor.onDrag(deltaMm);
        activeGrip.indicator?.update(deltaMm);
        return;
      }
      if (dragging === 'orbit') {
        rig.orbit(dx, dy);
        inertiaVx = dx;
        inertiaVy = dy;
      } else {
        rig.pan(dx, dy);
      }
      placeCamera();
    }

    function onWheel(ev: WheelEvent): void {
      ev.preventDefault();

      // Normalize cursor position to NDC for cursor-anchored zoom
      const rect = renderer.domElement.getBoundingClientRect();
      const ndcX = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);

      // Normalize wheel delta (handles deltaMode: pixel/line/page)
      const normY = wheelDelta({ deltaY: ev.deltaY, deltaMode: ev.deltaMode });

      const beforeSnap = rig.snapshot();

      // Multiplicative zoom: ~30 % per mouse notch, consistent at all distances.
      // Pinch (ctrlKey) already arrives half-scaled by wheelDelta; zoomBy handles the rest.
      rig.zoomBy(Math.exp(normY * 0.003));

      // Cursor-anchored zoom: keep the world point under the cursor fixed.
      // Formula: nudge = deltaR * (cursorRayDir + sphericalDir)
      // This is the exact solution for pinning the focal-plane point to the cursor.
      const afterSnap = rig.snapshot();
      const deltaR = beforeSnap.radius - afterSnap.radius;
      if (Math.abs(deltaR) > 1e-4) {
        ndc.set(ndcX, ndcY);
        camera.updateMatrixWorld(true);
        raycaster.setFromCamera(ndc, camera);
        const D = raycaster.ray.direction; // cursor ray unit vector
        // Spherical unit vector: from target to camera
        const br = beforeSnap.radius;
        const Sx = (beforeSnap.position.x - beforeSnap.target.x) / br;
        const Sy = (beforeSnap.position.y - beforeSnap.target.y) / br;
        const Sz = (beforeSnap.position.z - beforeSnap.target.z) / br;
        rig.nudgeTarget({
          x: deltaR * (D.x + Sx),
          y: deltaR * (D.y + Sy),
          z: deltaR * (D.z + Sz),
        });
      }

      // Trackpad two-finger horizontal swipe → pan X
      if (!ev.ctrlKey && Math.abs(ev.deltaX) > 1) {
        const normX = wheelDelta({ deltaY: ev.deltaX, deltaMode: ev.deltaMode });
        rig.pan(normX * 0.3, 0);
      }

      placeCamera();
    }

    function onKey(ev: KeyboardEvent): void {
      const target = ev.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (target.isContentEditable) return;
      }
      const activeLineTool = activeDirect3dTool();
      if (
        activeLineTool &&
        LINE_3D_AUTHORING_TOOLS.has(activeLineTool) &&
        lineDraftStart &&
        lineDraftStart.tool === activeLineTool
      ) {
        if (/^[0-9.'"\s]$/.test(ev.key)) {
          ev.preventDefault();
          setAuthoringOverlay((prev) =>
            prev?.tool === activeLineTool
              ? {
                  ...prev,
                  numericInputValue: `${prev.numericInputValue ?? ''}${ev.key}`,
                }
              : prev,
          );
          return;
        }
        if (ev.key === 'Backspace') {
          const currentValue = authoringOverlayRef.current?.numericInputValue;
          if (currentValue) {
            ev.preventDefault();
            setAuthoringOverlay((prev) =>
              prev?.tool === activeLineTool
                ? { ...prev, numericInputValue: currentValue.slice(0, -1) }
                : prev,
            );
            return;
          }
        }
        const numericInputValue = authoringOverlayRef.current?.numericInputValue;
        if (ev.key === 'Enter' && numericInputValue) {
          ev.preventDefault();
          const overlay = authoringOverlayRef.current;
          if (!overlay) return;
          const parsed = parseDimensionInput(numericInputValue);
          const currentEnd = overlay.currentPointMm;
          const levelInfo = resolveDraftLevelInfo();
          if (parsed.ok && currentEnd && levelInfo) {
            const runtime = useBimStore.getState();
            const effectiveLocationLine =
              activeLineTool === 'wall' && wallFlipNextSegment
                ? flipWallLocationLineSide(runtime.wallLocationLine)
                : runtime.wallLocationLine;
            const basePayload = buildLinePreviewPayload({
              tool: lineDraftStart.tool,
              levelId: lineDraftStart.levelId,
              start: lineDraftStart.point,
              end: currentEnd,
              wall:
                activeLineTool === 'wall'
                  ? {
                      id: `wall-3d-${Date.now().toString(36)}-${Math.round(Math.random() * 1_000_000).toString(36)}`,
                      locationLine: effectiveLocationLine,
                      wallTypeId: runtime.activeWallTypeId ?? undefined,
                      heightMm: runtime.wallDrawHeightMm,
                    }
                  : undefined,
            });
            const resizedPayload = resizeLinePreviewToLength(basePayload, parsed.mm);
            if (activeLineTool === 'wall') {
              updateWallDraftPreviewGroup(
                resizedPayload.start,
                resizedPayload.end,
                levelInfo,
                wallFlipNextSegment,
              );
              clearWallDraftPreviewGroup();
              wallFlipNextSegment = false;
            }
            dispatchLinePreviewPayload(resizedPayload);
            lineDraftStart = null;
            setAuthoringOverlay({
              tool: activeLineTool,
              phase: 'pick-start',
              levelName: levelInfo.name,
              workPlaneElevationMm: levelInfo.elevationMm,
            });
          }
          return;
        }
      }
      if (ev.key === 'Escape') {
        const tool = activeDirect3dTool();
        if (tool && LINE_3D_AUTHORING_TOOLS.has(tool)) {
          if (lineDraftStart && lineDraftStart.tool === tool) {
            lineDraftStart = null;
            wallFlipNextSegment = false;
            clearWallDraftPreviewGroup();
            setAuthoringOverlay((prev) =>
              prev
                ? {
                    tool,
                    phase: 'pick-start',
                    levelName: prev.levelName,
                    workPlaneElevationMm: prev.workPlaneElevationMm,
                  }
                : prev,
            );
            ev.preventDefault();
            return;
          }
        } else if (tool && POLYGON_3D_AUTHORING_TOOLS.has(tool) && polygonDraft) {
          polygonDraft = null;
          setAuthoringOverlay((prev) =>
            prev
              ? { tool, phase: 'pick-vertex', levelName: prev.levelName, pointsScreen: [] }
              : prev,
          );
          ev.preventDefault();
          return;
        }
      }
      if (ev.key === 'Escape' && walkController.snapshot().active) {
        ev.preventDefault();
      }
      if (ev.key === 'Escape') {
        const tool = activeDirect3dTool();
        if (tool === 'door' || tool === 'window' || tool === 'wall-opening') {
          hostPreviewLock = false;
          setAuthoringOverlay((prev) =>
            prev?.tool === tool
              ? {
                  ...prev,
                  previewHostLock: false,
                }
              : prev,
          );
        }
      }
      if (ev.key === 'Tab' || ev.key.toLowerCase() === 'l') {
        const tool = activeDirect3dTool();
        if (tool === 'door' || tool === 'window' || tool === 'wall-opening') {
          hostPreviewLock = !hostPreviewLock;
          setAuthoringOverlay((prev) =>
            prev?.tool === tool
              ? {
                  ...prev,
                  previewHostLock: hostPreviewLock,
                }
              : prev,
          );
          ev.preventDefault();
          return;
        }
      }
      if (ev.code === 'Space') {
        const tool = activeDirect3dTool();
        if (tool === 'wall' && lineDraftStart && lineDraftStart.tool === 'wall') {
          wallFlipNextSegment = !wallFlipNextSegment;
          const overlay = authoringOverlayRef.current;
          const levelInfo = resolveDraftLevelInfo();
          if (overlay?.currentPointMm && levelInfo) {
            updateWallDraftPreviewGroup(
              lineDraftStart.point,
              overlay.currentPointMm,
              levelInfo,
              wallFlipNextSegment,
            );
          }
          setAuthoringOverlay((prev) =>
            prev?.tool === 'wall'
              ? {
                  ...prev,
                  wallFlipActive: wallFlipNextSegment,
                }
              : prev,
          );
          ev.preventDefault();
          return;
        }
      }
      const hk = classifyHotkey({ key: ev.key, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey });
      if (!hk) return;
      ev.preventDefault();
      if (hk.kind === 'frame-all') {
        const box = computeRootBoundingBox(root);
        if (box) {
          rig.frame(box);
          rig.setHome();
        }
      } else if (hk.kind === 'frame-selection') {
        // For now the same effect as frame-all; selection-aware framing comes
        // with the inspector parameter wiring.
        const box = computeRootBoundingBox(root);
        if (box) {
          rig.frame(box);
          rig.setHome();
        }
      } else if (hk.kind === 'reset') {
        rig.reset();
      } else if (hk.kind === 'zoom-in') {
        rig.zoomBy(0.85);
      } else if (hk.kind === 'zoom-out') {
        rig.zoomBy(1.18);
      }
      placeCamera();
    }

    renderer.domElement.addEventListener('pointerdown', onDown);
    const onContextMenu = (ev: Event): void => {
      ev.preventDefault();
      // ANN-02: open the wall context menu when the right-click lands on a wall.
      // EDT-03: also open the wall-face radial menu (Insert Door / Window /
      // Opening) anchored to the same hit, with the world-space hit point so
      // the radial menu can resolve `alongT`.
      const me = ev as MouseEvent;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((me.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -(((me.clientY - rect.top) / rect.height) * 2 - 1);
      camera.updateMatrixWorld(true);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(root.children, true);
      const first = hits.find((h) => typeof h.object.userData.bimPickId === 'string');
      const id =
        typeof first?.object.userData.bimPickId === 'string'
          ? (first.object.userData.bimPickId as string)
          : null;
      if (!id) {
        setWallContextMenu(null);
        setWallFaceRadialMenu(null);
        return;
      }
      const el = elementsByIdRef.current[id];
      if (!el || el.kind !== 'wall') {
        setWallContextMenu(null);
        setWallFaceRadialMenu(null);
        return;
      }
      setWallContextMenu({
        wall: el,
        position: { x: me.clientX, y: me.clientY },
      });
      // Convert raycast hit point from scene metres back to semantic mm.
      const hitPointScene = first?.point ?? new THREE.Vector3(0, 0, 0);
      const hitFaceKind = wallFaceKindForMaterialIndex(first?.face?.materialIndex);
      const faceOverride =
        hitFaceKind && el.faceMaterialOverrides
          ? [...el.faceMaterialOverrides]
              .reverse()
              .find((override) => override.faceKind === hitFaceKind)
          : null;
      const hitMaterialKey = faceOverride?.materialKey ?? el.materialKey ?? undefined;
      const materialElement =
        hitMaterialKey && elementsByIdRef.current[hitMaterialKey]?.kind === 'material'
          ? (elementsByIdRef.current[hitMaterialKey] as Extract<Element, { kind: 'material' }>)
          : null;
      setWallFaceRadialMenu({
        wallId: el.id,
        hitPoint: {
          xMm: hitPointScene.x * 1000,
          yMm: hitPointScene.z * 1000,
          zMm: hitPointScene.y * 1000,
        },
        wallStartMm: el.start,
        wallEndMm: el.end,
        screen: { x: me.clientX + 240, y: me.clientY },
        ...(hitFaceKind
          ? {
              faceKind: hitFaceKind,
              faceMaterialOverrides: el.faceMaterialOverrides ?? [],
              paintMaterialKey: hitMaterialKey,
            }
          : {}),
        ...(materialElement
          ? {
              materialId: materialElement.id,
              currentUvRotationDeg: materialElement.uvRotationDeg ?? 0,
            }
          : {}),
      });
    };
    renderer.domElement.addEventListener('contextmenu', onContextMenu);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointercancel', onPointerCancel);
    renderer.domElement.addEventListener('lostpointercapture', onPointerCancel);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('keydown', onKey);

    /* ── Walk mode wiring (§15.3) ──────────────────────────────────── */
    function onWalkKeyDown(ev: KeyboardEvent): void {
      const target = ev.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      }
      if (!walkController.snapshot().active) return;
      if (ev.key === 'Escape') {
        walkController.setActive(false);
        useBimStore.getState().setViewerWalkModeActive(false);
        return;
      }
      if (ev.key === 'Shift') walkController.setRunning(true);
      if (ev.key === 'PageUp') {
        walkController.jumpFloor(1);
        ev.preventDefault();
        return;
      }
      if (ev.key === 'PageDown') {
        walkController.jumpFloor(-1);
        ev.preventDefault();
        return;
      }
      const wk = classifyWalkKey(ev.key);
      if (wk) {
        walkController.setKey(wk, true);
        ev.preventDefault();
      }
    }
    function onWalkKeyUp(ev: KeyboardEvent): void {
      if (ev.key === 'Shift') walkController.setRunning(false);
      const wk = classifyWalkKey(ev.key);
      if (wk) walkController.setKey(wk, false);
    }
    function onWalkPointerMove(ev: PointerEvent): void {
      if (!walkController.snapshot().active) return;
      walkController.mouseLook(ev.movementX, ev.movementY);
    }
    document.addEventListener('keydown', onWalkKeyDown);
    document.addEventListener('keyup', onWalkKeyUp);
    document.addEventListener('pointermove', onWalkPointerMove);

    function onPointerLockChange(): void {
      if (!document.pointerLockElement && walkController.snapshot().active) {
        walkController.setActive(false);
        useBimStore.getState().setViewerWalkModeActive(false);
      }
    }
    document.addEventListener('pointerlockchange', onPointerLockChange);

    let lastFrameMs = performance.now();
    function tick() {
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastFrameMs) / 1000);
      lastFrameMs = now;

      // Walk-mode integration drives the camera target through walkController.
      if (walkController.snapshot().active) {
        walkController.update(dt);
        const snap = walkController.snapshot();
        const dir = walkController.viewDirection();
        camera.position.set(snap.position.x, snap.position.y, snap.position.z);
        camera.up.set(0, 1, 0);
        camera.lookAt(snap.position.x + dir.x, snap.position.y + dir.y, snap.position.z + dir.z);
        camera.updateMatrixWorld(true);
      }

      // Orbit inertia: continue rotating after mouse release, decaying to stop
      if (!dragging && Math.hypot(inertiaVx, inertiaVy) > 0.06) {
        rig.orbit(inertiaVx, inertiaVy);
        inertiaVx *= INERTIA_DECAY;
        inertiaVy *= INERTIA_DECAY;
        placeCamera();
      }

      composer.render();
      rafRef.current = requestAnimationFrame(tick);
    }

    tick();

    const pendingCsg = pendingCsgRef.current;
    const pendingCsgMeta = pendingCsgMetaRef.current;

    return () => {
      orbitRigApiRef.current = null;
      cameraRigRef.current = null;
      paintBundleRef.current = null;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      ro.disconnect();
      clearWallDraftPreviewGroup();

      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel);
      renderer.domElement.removeEventListener('lostpointercapture', onPointerCancel);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('wheel', onWheel);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keydown', onWalkKeyDown);
      document.removeEventListener('keyup', onWalkKeyUp);
      document.removeEventListener('pointermove', onWalkPointerMove);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      walkControllerRef.current = null;
      sectionBoxRef.current = null;
      sectionBoxCageRef.current = null;

      composerRef.current?.dispose();
      composerRef.current = null;
      orthoCameraRef.current = null;
      renderPassRef.current = null;
      ssaoPassRef.current = null;
      sunRef.current = null;
      envMapRef.current?.dispose();
      envMapRef.current = null;
      renderer.dispose();

      // Reset incremental scene state so the next mount starts fresh.
      bimPickMapRef.current = new Map();
      prevElementsByIdRef.current = {};
      hasAutoFittedRef.current = false;
      csgWorkerRef.current?.terminate();
      csgWorkerRef.current = null;
      pendingCsg.clear();
      pendingCsgMeta.clear();

      host.removeChild(renderer.domElement);
    };
    // `theme` is included so the renderer rebuilds when the user toggles
    // light/dark — token-driven materials are resolved at mount time and
    // need fresh values when the data-theme attribute flips. Spec §32 V11.
  }, [theme]);

  useEffect(() => {
    if (!orbitCameraPoseMm) return;
    orbitRigApiRef.current?.applyViewpointMm(orbitCameraPoseMm);
  }, [orbitCameraNonce, orbitCameraPoseMm]);

  useEffect(() => {
    const cam = orthoMode ? (orthoCameraRef.current ?? cameraRef.current!) : cameraRef.current!;
    if (!cam) return;
    if (renderPassRef.current) renderPassRef.current.camera = cam;
    if (ssaoPassRef.current) ssaoPassRef.current.camera = cam;
    if (outlinePassRef.current) outlinePassRef.current.renderCamera = cam;
    if (orthoMode && orthoCameraRef.current && cameraRigRef.current) {
      const renderer = rendererRef.current;
      const w = renderer?.domElement.clientWidth || 1;
      const h = renderer?.domElement.clientHeight || 1;
      const f = cameraRigRef.current.orthoFrustum(w / h);
      const oc = orthoCameraRef.current;
      oc.left = f.left;
      oc.right = f.right;
      oc.top = f.top;
      oc.bottom = f.bottom;
      oc.near = f.near;
      oc.far = f.far;
      oc.updateProjectionMatrix();
      const persp = cameraRef.current;
      if (persp) {
        const snap = cameraRigRef.current.snapshot();
        mirrorSceneCameraPose(persp, oc, snap.target);
      }
    }
  }, [orthoMode]);

  useEffect(() => {
    if (!viewerCameraAction) return;
    const rig = cameraRigRef.current;
    const camera = cameraRef.current;
    if (!rig || !camera) return;

    if (viewerCameraAction.kind === 'fit') {
      const root = rootGroupRef.current;
      const box = root ? computeRootBoundingBox(root) : null;
      if (box) {
        rig.frame(box);
        rig.setHome();
      }
    } else {
      rig.reset();
    }

    const snap = rig.snapshot();
    applySceneCameraPose(camera, snap);
    const orthoCamera = orthoCameraRef.current;
    if (orthoCamera) {
      mirrorSceneCameraPose(camera, orthoCamera, snap.target);
    }
    setCurrentAzimuth(snap.azimuth);
    setCurrentElevation(snap.elevation);
  }, [viewerCameraAction]);

  // ── Incremental geometry effect ──────────────────────────────────────────
  // Diffs elementsById against the previous snapshot and surgically adds,
  // updates, or removes only the Three.js meshes that actually changed.
  // This turns O(N) full-rebuild into O(delta) per edit.
  useEffect(() => {
    const root = rootGroupRef.current;
    if (!root) return;

    const curr = elementsById;
    const prev = prevElementsByIdRef.current;
    const cache = bimPickMapRef.current;
    const paint = paintBundleRef.current;

    // Single pass: bucket hosted elements and build reverse maps for dep propagation.
    const doorsByWall = new Map<string, DoorElem[]>();
    const winsByWall = new Map<string, WindowElem[]>();
    const wallOpeningsByWall = new Map<string, WallOpeningElem[]>();
    const railingsByStair = new Map<string, string[]>();
    const elemsByLevel = new Map<string, string[]>();
    const placedAssetsByAssetEntry = new Map<string, string[]>();

    for (const [id, e] of Object.entries(curr)) {
      if (e.kind === 'door') {
        const d = e as DoorElem;
        const arr = doorsByWall.get(d.wallId) ?? [];
        arr.push(d);
        doorsByWall.set(d.wallId, arr);
      } else if (e.kind === 'window') {
        const w = e as WindowElem;
        const arr = winsByWall.get(w.wallId) ?? [];
        arr.push(w);
        winsByWall.set(w.wallId, arr);
      } else if (e.kind === 'wall_opening') {
        const wo = e as WallOpeningElem;
        const arr = wallOpeningsByWall.get(wo.hostWallId) ?? [];
        arr.push(wo);
        wallOpeningsByWall.set(wo.hostWallId, arr);
      }
      if (e.kind === 'railing') {
        const rl = e as Extract<Element, { kind: 'railing' }>;
        if (rl.hostedStairId) {
          const arr = railingsByStair.get(rl.hostedStairId) ?? [];
          arr.push(id);
          railingsByStair.set(rl.hostedStairId, arr);
        }
      }
      if (e.kind === 'placed_asset') {
        const pa = e as Extract<Element, { kind: 'placed_asset' }>;
        const arr = placedAssetsByAssetEntry.get(pa.assetId) ?? [];
        arr.push(id);
        placedAssetsByAssetEntry.set(pa.assetId, arr);
      }
      if (
        e.kind === 'wall' ||
        e.kind === 'room' ||
        e.kind === 'floor' ||
        e.kind === 'placed_asset' ||
        e.kind === 'family_instance'
      ) {
        const lid = (e as { levelId: string }).levelId;
        const arr = elemsByLevel.get(lid) ?? [];
        arr.push(id);
        elemsByLevel.set(lid, arr);
      } else if (e.kind === 'roof' || e.kind === 'site') {
        const lid = (e as { referenceLevelId: string }).referenceLevelId;
        const arr = elemsByLevel.get(lid) ?? [];
        arr.push(id);
        elemsByLevel.set(lid, arr);
      } else if (e.kind === 'stair') {
        const s = e as Extract<Element, { kind: 'stair' }>;
        for (const lid of [s.baseLevelId, s.topLevelId]) {
          const arr = elemsByLevel.get(lid) ?? [];
          arr.push(id);
          elemsByLevel.set(lid, arr);
        }
      }
    }

    // Diff against previous snapshot.
    const addedIds = new Set<string>();
    const removedIds = new Set<string>();
    const changedIds = new Set<string>();

    for (const id of Object.keys(curr)) {
      if (!(id in prev)) addedIds.add(id);
      else if (prev[id] !== curr[id]) changedIds.add(id);
    }
    for (const id of Object.keys(prev)) {
      if (!(id in curr)) removedIds.add(id);
    }

    // Propagate dependency relationships so dependent meshes are also rebuilt.
    const extraDirty = new Set<string>();
    const propagateOne = (id: string, e: Element) => {
      switch (e.kind) {
        case 'wall':
          // Wall geometry change → its hosted openings need new positions.
          for (const d of doorsByWall.get(id) ?? []) extraDirty.add(d.id);
          for (const w of winsByWall.get(id) ?? []) extraDirty.add(w.id);
          for (const wo of wallOpeningsByWall.get(id) ?? []) extraDirty.add(wo.id);
          break;
        case 'door':
          extraDirty.add((e as DoorElem).wallId);
          break;
        case 'window':
          extraDirty.add((e as WindowElem).wallId);
          break;
        case 'wall_opening':
          extraDirty.add((e as WallOpeningElem).hostWallId);
          break;
        case 'level':
          for (const eid of elemsByLevel.get(id) ?? []) extraDirty.add(eid);
          break;
        case 'stair':
          for (const rid of railingsByStair.get(id) ?? []) extraDirty.add(rid);
          break;
        case 'dormer':
          // KRN-14: dormer change → host roof needs to re-CSG.
          extraDirty.add((e as Extract<Element, { kind: 'dormer' }>).hostRoofId);
          break;
        case 'asset_library_entry':
          for (const assetId of placedAssetsByAssetEntry.get(id) ?? []) extraDirty.add(assetId);
          break;
      }
    };

    for (const id of changedIds) propagateOne(id, curr[id] ?? prev[id]!);
    // Added/removed hosted elements must also rebuild their host wall (CSG opening changes).
    for (const id of addedIds) {
      const e = curr[id];
      if (e?.kind === 'asset_library_entry') {
        for (const assetId of placedAssetsByAssetEntry.get(id) ?? []) extraDirty.add(assetId);
      }
      if (e?.kind === 'door') extraDirty.add((e as DoorElem).wallId);
      if (e?.kind === 'window') extraDirty.add((e as WindowElem).wallId);
      if (e?.kind === 'wall_opening') extraDirty.add((e as WallOpeningElem).hostWallId);
    }
    for (const id of removedIds) {
      const e = prev[id];
      if (e?.kind === 'asset_library_entry') {
        for (const [assetId, pa] of Object.entries(curr)) {
          if (pa.kind === 'placed_asset' && pa.assetId === id) extraDirty.add(assetId);
        }
      }
      if (e?.kind === 'door') extraDirty.add((e as DoorElem).wallId);
      if (e?.kind === 'window') extraDirty.add((e as WindowElem).wallId);
      if (e?.kind === 'wall_opening') extraDirty.add((e as WallOpeningElem).hostWallId);
      if (e?.kind === 'dormer')
        extraDirty.add((e as Extract<Element, { kind: 'dormer' }>).hostRoofId);
    }
    for (const id of addedIds) {
      const e = curr[id];
      if (e?.kind === 'dormer')
        extraDirty.add((e as Extract<Element, { kind: 'dormer' }>).hostRoofId);
    }
    const priorRoofJoinPreview = cache.get('roof-join-preview');
    if (priorRoofJoinPreview) {
      root.remove(priorRoofJoinPreview);
      priorRoofJoinPreview.traverse((node) => {
        const m = node as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat: THREE.Material) => mat.dispose());
        } else {
          (m.material as THREE.Material)?.dispose();
        }
      });
      cache.delete('roof-join-preview');
    }
    for (const id of extraDirty) {
      if (!addedIds.has(id) && !removedIds.has(id)) changedIds.add(id);
    }
    // If a wall became dirty, also dirty its current hosted elements.
    for (const id of [...changedIds]) {
      if (curr[id]?.kind === 'wall') {
        for (const d of doorsByWall.get(id) ?? []) {
          if (!addedIds.has(d.id) && !removedIds.has(d.id)) changedIds.add(d.id);
        }
        for (const w of winsByWall.get(id) ?? []) {
          if (!addedIds.has(w.id) && !removedIds.has(w.id)) changedIds.add(w.id);
        }
        for (const wo of wallOpeningsByWall.get(id) ?? []) {
          if (!addedIds.has(wo.id) && !removedIds.has(wo.id)) changedIds.add(wo.id);
        }
      }
    }

    const toRemove = new Set([...removedIds, ...changedIds]);
    const toRebuild = new Set([...addedIds, ...changedIds]);
    // text_3d rebuilds that were skipped because their font wasn't loaded yet
    // are re-attempted on tick bump.
    for (const tid of text3dPendingRef.current) {
      if (curr[tid]?.kind === 'text_3d' && !cache.has(tid)) {
        toRebuild.add(tid);
      } else {
        text3dPendingRef.current.delete(tid);
      }
    }

    const catHidden = viewerCategoryHidden;
    const levelHidden = viewerLevelHidden;
    const skipCat = (e: Element) => {
      const ck = elemViewerCategory(e);
      return ck != null && Boolean(catHidden[ck]);
    };
    const skipLevel = (e: Element): boolean => {
      if ('levelId' in e && typeof e.levelId === 'string') return Boolean(levelHidden[e.levelId]);
      if ('referenceLevelId' in e && typeof e.referenceLevelId === 'string') {
        return Boolean(levelHidden[e.referenceLevelId]);
      }
      if (e.kind === 'door' || e.kind === 'window') {
        const host = curr[e.wallId];
        return host?.kind === 'wall' ? Boolean(levelHidden[host.levelId]) : false;
      }
      if (e.kind === 'wall_opening') {
        const host = curr[e.hostWallId];
        return host?.kind === 'wall' ? Boolean(levelHidden[host.levelId]) : false;
      }
      if (e.kind === 'balcony') {
        const host = curr[e.wallId];
        return host?.kind === 'wall' ? Boolean(levelHidden[host.levelId]) : false;
      }
      if (e.kind === 'dormer') {
        const host = curr[e.hostRoofId];
        return host?.kind === 'roof' ? Boolean(levelHidden[host.referenceLevelId]) : false;
      }
      if (e.kind === 'stair') {
        return Boolean(levelHidden[e.baseLevelId]) && Boolean(levelHidden[e.topLevelId]);
      }
      if (e.kind === 'railing' && e.hostedStairId) {
        const stair = curr[e.hostedStairId];
        if (stair?.kind === 'stair') {
          return Boolean(levelHidden[stair.baseLevelId]) && Boolean(levelHidden[stair.topLevelId]);
        }
      }
      return false;
    };
    const retainPendingCsgWallIds = new Set<string>();
    for (const id of toRemove) {
      const e = curr[id];
      if (e?.kind !== 'wall' || !cache.has(id) || skipCat(e) || skipLevel(e)) continue;
      if (
        shouldRunWallOpeningCsg({
          csgEnabled: CSG_ENABLED,
          hostedDoorCount: doorsByWall.get(id)?.length ?? 0,
          hostedWindowCount: winsByWall.get(id)?.length ?? 0,
          hostedWallOpeningCount: wallOpeningsByWall.get(id)?.length ?? 0,
          roofAttachmentId: e.roofAttachmentId,
          isCurtainWall: e.isCurtainWall,
        })
      ) {
        retainPendingCsgWallIds.add(id);
      }
    }

    // Remove stale meshes — dispose GPU resources to avoid leaks.
    for (const id of toRemove) {
      if (retainPendingCsgWallIds.has(id)) continue;
      const obj = cache.get(id);
      if (!obj) continue;
      root.remove(obj);
      obj.traverse((node) => {
        const m = node as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat: THREE.Material) => mat.dispose());
        } else {
          (m.material as THREE.Material)?.dispose();
        }
      });
      cache.delete(id);
    }

    // Build and insert new meshes.
    const planes = clippingPlanesRef.current;

    // DSC-V3-02 — resolve lens filter from the UI dropdown stored in global state.
    const lensFilter = lensFilterFromMode(activeLensMode);
    const witnessHex = readToken('--draft-witness', '#64748b');

    for (const id of toRebuild) {
      const e = curr[id];
      if (!e) continue;

      let obj: THREE.Object3D | null = null;
      switch (e.kind) {
        case 'floor':
          obj = makeFloorSlabMesh(e, curr, paint);
          break;
        case 'wall': {
          const elev = elevationMForLevel(e.levelId, curr);
          const doors = doorsByWall.get(id) ?? [];
          const wins = winsByWall.get(id) ?? [];
          const wallOps = wallOpeningsByWall.get(id) ?? [];
          if (
            shouldRunWallOpeningCsg({
              csgEnabled: CSG_ENABLED,
              hostedDoorCount: doors.length,
              hostedWindowCount: wins.length,
              hostedWallOpeningCount: wallOps.length,
              roofAttachmentId: e.roofAttachmentId,
              isCurtainWall: e.isCurtainWall,
            })
          ) {
            // Dispatch CSG to the worker; show a solid-wall placeholder immediately.
            const displayWall = wallWith3dJoinDisallowGaps(e, curr);
            const sx = displayWall.start.xMm / 1000;
            const sz = displayWall.start.yMm / 1000;
            const dx = displayWall.end.xMm / 1000 - sx;
            const dz = displayWall.end.yMm / 1000 - sz;
            const len = Math.max(0.001, Math.hypot(dx, dz));
            const { yBase, height } = wallVerticalSpanM(displayWall, elev, curr);
            const thick = THREE.MathUtils.clamp(displayWall.thicknessMm / 1000, 0.05, 2);
            const wallOffset = wallPlanOffsetM(displayWall);
            const wcx = sx + dx / 2 + wallOffset.xM;
            const wcz = sz + dz / 2 + wallOffset.zM;
            const wallHeightMm = height * 1000;
            const retainExisting = retainPendingCsgWallIds.has(id);
            const nonce = ++csgNonceRef.current;
            pendingCsgRef.current.set(id, nonce);
            pendingCsgMetaRef.current.set(id, {
              len,
              height,
              thick,
              materialKey: csgWallSurfaceMaterialKey(e, curr),
              retainExisting,
            });
            const job: CsgRequest = {
              jobId: id,
              nonce,
              len,
              height,
              thick,
              baseFootprints: csgBaseFootprintsForWall(displayWall, curr, wcx, wcz, dx, dz, len),
              wcx,
              wcy: yBase + height / 2,
              wcz,
              yaw: yawForPlanSegment(dx, dz),
              doors: doors.map((d) => {
                const doorDims = resolveDoorCutDimensions(d, curr, wallHeightMm);
                return {
                  widthMm: doorDims.widthMm,
                  heightMm: doorDims.heightMm,
                  alongT: d.alongT,
                  wallHeightMm,
                };
              }),
              windows: wins.map((w) => {
                const outlineKind = w.outlineKind ?? 'rectangle';
                const winDims = resolveWindowCutDimensions(w, curr);
                let outlinePolygonMm: { xMm: number; yMm: number }[] | undefined = undefined;
                if (outlineKind !== 'rectangle') {
                  const poly = resolveWindowOutline(w, e, curr);
                  if (poly && poly.length >= 3) outlinePolygonMm = poly;
                }
                return {
                  widthMm: winDims.widthMm,
                  heightMm: winDims.heightMm,
                  sillHeightMm: winDims.sillHeightMm,
                  alongT: w.alongT,
                  wallHeightMm,
                  ...(outlinePolygonMm ? { outlinePolygonMm } : {}),
                };
              }),
              wallOpenings: wallOps.map((wo) => ({
                alongTStart: wo.alongTStart,
                alongTEnd: wo.alongTEnd,
                sillHeightMm: wo.sillHeightMm,
                headHeightMm: wo.headHeightMm,
                wallHeightMm,
              })),
            };
            csgWorkerRef.current?.postMessage(job);
            if (retainExisting) break;
          }
          if (e.isCurtainWall) {
            obj = makeCurtainWallMesh(e, elev, paint, curr);
            break;
          }
          // Always produce a placeholder (solid wall); the worker will swap it
          // with the CSG result when ready, or it stays if CSG is disabled.
          obj = makeWallMesh(e, elev, paint, curr);
          break;
        }
        case 'door': {
          const wall = curr[(e as DoorElem).wallId] as WallElem | undefined;
          if (!wall) break;
          obj = makeDoorMesh(e, wall, elevationMForLevel(wall.levelId, curr), paint, curr);
          break;
        }
        case 'window': {
          const w = e as WindowElem;
          const wall = curr[w.wallId] as WallElem | undefined;
          if (!wall) break;
          obj = makeWindowMesh(w, wall, elevationMForLevel(wall.levelId, curr), paint, curr);
          break;
        }
        case 'stair':
          obj = makeStairVolumeMesh(e, curr, paint);
          break;
        case 'room':
          obj = makeRoomRibbon(e, elevationMForLevel(e.levelId, curr), paint);
          break;
        case 'roof':
          obj = makeRoofMassMesh(e, curr, paint);
          break;
        case 'roof_join':
          obj = makeRoofJoinPreviewMesh(e, curr, false);
          break;
        case 'railing':
          obj = makeRailingMesh(e, curr, paint);
          break;
        case 'balcony':
          obj = makeBalconyMesh(e, curr, paint);
          break;
        case 'column': {
          const elev = elevationMForLevel(e.levelId, curr);
          obj = makeColumnMesh(e, elev, paint);
          break;
        }
        case 'beam': {
          const elev = elevationMForLevel(e.levelId, curr);
          obj = makeBeamMesh(e, elev, paint);
          break;
        }
        case 'ceiling':
          obj = makeCeilingMesh(e, curr, paint);
          break;
        case 'site':
          obj = makeSiteMesh(e, curr, paint);
          break;
        case 'text_3d': {
          const t = e as Extract<Element, { kind: 'text_3d' }>;
          const font = getResolvedText3dFont(t.fontFamily);
          if (!font) {
            // Font not yet loaded — kick off async load and bump the rebuild
            // tick when ready so this element gets re-attempted.
            text3dPendingRef.current.add(id);
            void loadText3dFont(t.fontFamily).then(
              () => setText3dRebuildTick((n) => n + 1),
              () => {
                /* swallow — error will surface next tick */
              },
            );
            break;
          }
          obj = makeText3dMesh(t, font, paint);
          text3dPendingRef.current.delete(id);
          break;
        }
        case 'sweep':
          obj = makeSweepMesh(e, curr, paint);
          break;
        case 'dormer':
          obj = makeDormerMesh(e, curr, paint);
          break;
        case 'mass': {
          if (!isElementVisibleUnderPhaseFilter(viewerPhaseFilter, e)) break;
          const lvl = curr[e.levelId];
          if (!lvl || lvl.kind !== 'level') break;
          const { mesh } = buildMassMesh(e, lvl, curr);
          obj = mesh;
          break;
        }
        case 'placed_asset':
          obj = makePlacedAssetMesh(e, curr, paint);
          break;
        case 'family_instance':
          obj = makeFamilyInstanceMesh(e, curr);
          break;
        case 'internal_origin':
          obj = makeInternalOriginMarker(e);
          break;
        case 'project_base_point':
          obj = makeProjectBasePointMarker(e);
          break;
        case 'survey_point':
          obj = makeSurveyPointMarker(e);
          break;
        case 'reference_plane':
          obj = makeReferencePlaneMarker(e, curr);
          break;
        default:
          break;
      }

      if (!obj) continue;

      if (!obj.userData.bimPickId) obj.userData.bimPickId = id;
      obj.visible = !skipCat(e) && !skipLevel(e);

      // FED-01: ghost any element resolved through a `link_model` link.
      // Linked element ids are prefixed `<linkId>::<sourceElemId>` by the
      // snapshot expansion path; that's the load-bearing signal.
      if (id.includes('::')) {
        applyLinkedGhosting(obj);
      }

      // Shadow: site meshes are receivers only.
      const isSite = e.kind === 'site';
      obj.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        node.castShadow = !isSite;
        node.receiveShadow = true;
      });
      applyModelEdgeDisplay(obj, viewerEdgesRef.current, viewerSilhouetteEdgeWidthRef.current);

      // Apply current clipping planes to this new mesh without re-traversing the whole scene.
      if (planes.length) {
        applyClippingPlanesToMeshes(obj, planes);
      }

      // DSC-V3-02 — lens ghost pass (opacity only; element stays in scene).
      applyLensGhosting(obj, lensFilter(e), witnessHex);

      cache.set(id, obj);
      root.add(obj);
    }

    if (roofJoinPreview) {
      const previewObj = makeRoofJoinPreviewMesh(
        {
          id: 'roof-join-preview',
          primaryRoofId: roofJoinPreview.primaryRoofId,
          secondaryRoofId: roofJoinPreview.secondaryRoofId,
        },
        curr,
        true,
      );
      previewObj.userData.bimTransient = true;
      cache.set('roof-join-preview', previewObj);
      root.add(previewObj);
    }

    // Update shadow camera frustum and outline-pass selection after any geometry change.
    if (toRebuild.size > 0 || toRemove.size > 0) {
      const sun = sunRef.current;
      if (sun) {
        const sceneBox = new THREE.Box3().setFromObject(root);
        if (Number.isFinite(sceneBox.min.x)) {
          const size = new THREE.Vector3();
          sceneBox.getSize(size);
          const sceneRadiusM = Math.max(size.length() / 2, 5);
          const frustumHalf = Math.max(sceneRadiusM * 1.2, 20);
          sun.shadow.camera.left = -frustumHalf;
          sun.shadow.camera.right = frustumHalf;
          sun.shadow.camera.top = frustumHalf;
          sun.shadow.camera.bottom = -frustumHalf;
          sun.shadow.camera.near = 0.5;
          sun.shadow.camera.far = sceneRadiusM * 4 + 50;
          sun.shadow.camera.updateProjectionMatrix();
        }
      }

      if (!hasAutoFittedRef.current) {
        const box = computeRootBoundingBox(root);
        const rig = cameraRigRef.current;
        const cam = cameraRef.current;
        if (box && rig && cam) {
          // Prefer a saved orbit_3d viewpoint named 'vp-main-iso' (the
          // model's authored "main isometric" SSW preset, per SKB-16).
          // Falls back to bounding-box fit if no such viewpoint exists.
          const mainIso = curr['vp-main-iso'];
          const rigApi = orbitRigApiRef.current;
          if (
            mainIso &&
            mainIso.kind === 'viewpoint' &&
            mainIso.mode === 'orbit_3d' &&
            mainIso.camera &&
            rigApi
          ) {
            rigApi.applyViewpointMm({
              position: mainIso.camera.position,
              target: mainIso.camera.target,
              up: mainIso.camera.up,
            });
            rig.setHome();
          } else {
            rig.frame(box);
            rig.setHome();
            const snap = rig.snapshot();
            applySceneCameraPose(cam, snap);
          }
          hasAutoFittedRef.current = true;
        }
      }
    }

    // When category or level visibility changes, sweep all cached meshes to update visible flags.
    if (prevCatHiddenRef.current !== catHidden || prevLevelHiddenRef.current !== levelHidden) {
      for (const [id, obj] of cache) {
        const e = curr[id];
        if (e) obj.visible = !skipCat(e) && !skipLevel(e);
      }
      prevCatHiddenRef.current = catHidden;
      prevLevelHiddenRef.current = levelHidden;
    }

    if (prevLensModeRef.current !== activeLensMode) {
      for (const [id, obj] of cache) {
        const e = curr[id];
        if (e) applyLensGhosting(obj, lensFilter(e), witnessHex);
      }
      prevLensModeRef.current = activeLensMode;
    }

    // Re-sync outline pass in case the selected element's mesh was just replaced.
    const op = outlinePassRef.current;
    if (op) {
      const selectedObjects = [selectedIdRef.current, ...selectedIdsRef.current]
        .filter((id): id is string => typeof id === 'string')
        .map((id) => cache.get(id))
        .filter((obj): obj is THREE.Object3D => Boolean(obj));
      op.selectedObjects = selectedObjects;
      op.visibleEdgeColor.set(paint?.selection.selectedColor ?? '#fb923c');
      op.hiddenEdgeColor.set(paint?.selection.selectedColor ?? '#fb923c');
    }

    prevElementsByIdRef.current = curr;
  }, [
    elementsById,
    roofJoinPreview,
    viewerCategoryHidden,
    viewerLevelHidden,
    viewerPhaseFilter,
    activeLensMode,
    theme,
    text3dRebuildTick,
  ]);

  // Revit-style 3D authoring datum: levels stay visible as named horizontal datums,
  // and the active work plane gets the blue plane emphasis Revit shows for selected levels.
  useEffect(() => {
    const root = rootGroupRef.current;
    const previous = levelDatumGroupRef.current;
    if (previous) {
      previous.parent?.remove(previous);
      disposeObject3D(previous);
      levelDatumGroupRef.current = null;
    }
    if (!root || !direct3dAuthoringActive) return;

    const rows = resolveLevelDatum3dRows(elementsById, activeLevelId, viewerLevelHidden);
    if (rows.length === 0) return;
    const bounds = levelDatumBoundsFromBox(computeRootBoundingBox(root));
    const group = makeLevelDatum3dGroup(rows, bounds);
    root.add(group);
    levelDatumGroupRef.current = group;

    return () => {
      if (levelDatumGroupRef.current === group) levelDatumGroupRef.current = null;
      group.parent?.remove(group);
      disposeObject3D(group);
    };
  }, [activeLevelId, direct3dAuthoringActive, elementsById, viewerLevelHidden]);

  // ── F-011: visual style (shaded / wireframe / consistent-colors / hidden-line / realistic / ray-trace) ──
  useEffect(() => {
    const cache = bimPickMapRef.current;
    for (const [, obj] of cache) {
      obj.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;

        if (viewerRenderStyle === 'wireframe') {
          // Restore original if we previously swapped it, then enable wireframe.
          if (child.userData.originalMaterial) {
            child.material = child.userData.originalMaterial as THREE.Material;
            delete child.userData.originalMaterial;
          }
          if (child.material instanceof THREE.MeshStandardMaterial) {
            child.material.wireframe = true;
            child.material.needsUpdate = true;
          }
        } else if (viewerRenderStyle === 'consistent-colors') {
          // Replace with MeshBasicMaterial (flat, no lighting).
          // Handles direct switch from hidden-line (already a MeshBasicMaterial).
          const origStd =
            (child.userData.originalMaterial as THREE.MeshStandardMaterial | undefined) ??
            (child.material instanceof THREE.MeshStandardMaterial ? child.material : null);
          if (origStd) {
            if (!child.userData.originalMaterial) {
              child.userData.originalMaterial = origStd;
            }
            child.material = new THREE.MeshBasicMaterial({
              color: origStd.color.clone(),
              side: origStd.side,
              transparent: origStd.transparent,
              opacity: origStd.opacity,
            });
            child.material.needsUpdate = true;
          }
        } else if (viewerRenderStyle === 'hidden-line') {
          // White opaque surfaces — back-faces occluded, no lighting.
          // Handles direct switch from consistent-colors (already a MeshBasicMaterial).
          const origStd2 =
            (child.userData.originalMaterial as THREE.MeshStandardMaterial | undefined) ??
            (child.material instanceof THREE.MeshStandardMaterial ? child.material : null);
          if (origStd2) {
            if (!child.userData.originalMaterial) {
              child.userData.originalMaterial = origStd2;
            }
            child.material = new THREE.MeshBasicMaterial({
              color: new THREE.Color(1, 1, 1),
              side: THREE.FrontSide,
            });
            child.material.needsUpdate = true;
          }
        } else {
          // Shaded / realistic / ray-trace: restore original MeshStandardMaterial.
          if (child.userData.originalMaterial) {
            child.material = child.userData.originalMaterial as THREE.Material;
            delete child.userData.originalMaterial;
          }
          const textureMapsVisible =
            viewerRenderStyle === 'realistic' || viewerRenderStyle === 'ray-trace';
          applyTextureVisibilityToMesh(child, textureMapsVisible);
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          for (const material of materials) {
            if (!(material instanceof THREE.MeshStandardMaterial)) continue;
            material.wireframe = false;
            if (viewerRenderStyle === 'realistic' || viewerRenderStyle === 'ray-trace') {
              material.flatShading = false;
            }
            material.needsUpdate = true;
          }
        }
      });
    }
  }, [elementsById, viewerRenderStyle]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.shadowMap.type =
      viewerRenderStyle === 'ray-trace' ? THREE.VSMShadowMap : THREE.PCFSoftShadowMap;
    renderer.shadowMap.needsUpdate = true;
  }, [viewerRenderStyle]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = Math.pow(2, viewerPhotographicExposureEv);
  }, [viewerPhotographicExposureEv]);

  // ── F-113: background colour ──────────────────────────────────────────────
  useEffect(() => {
    const rnd = rendererRef.current;
    if (!rnd) return;
    if (viewerBackground === 'light_grey') {
      // Let the CSS sky gradient show through.
      rnd.setClearColor(0x000000, 0);
    } else {
      const colorMap: Record<'white' | 'dark', number> = { white: 0xffffff, dark: 0x1a1a2e };
      rnd.setClearColor(colorMap[viewerBackground], 1);
    }
  }, [viewerBackground]);

  // ── F-113: shadows, ambient occlusion, depth cue, and silhouette edges ──
  useEffect(() => {
    const renderer = rendererRef.current;
    const root = rootGroupRef.current;
    const sun = sunRef.current;
    if (renderer) {
      renderer.shadowMap.enabled = viewerShadowsEnabled;
      renderer.shadowMap.needsUpdate = true;
    }
    if (sun) sun.castShadow = viewerShadowsEnabled;
    if (!root) return;
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh) || obj.userData.isClipCap) return;
      obj.castShadow = viewerShadowsEnabled;
      obj.receiveShadow = viewerShadowsEnabled;
    });
  }, [viewerShadowsEnabled]);

  useEffect(() => {
    const scene = sceneRef.current;
    const previous = planOverlayGroupRef.current;
    if (previous) {
      scene?.remove(previous);
      disposeObject3D(previous);
      planOverlayGroupRef.current = null;
    }
    if (!scene || !persistedOrbitViewpoint) return;
    const group = buildPlanOverlay3dGroup(elementsById, persistedOrbitViewpoint, {
      sheetColor: readToken('--color-surface', '#ffffff'),
      lineColor: readToken('--color-foreground', '#111827'),
      roomColor: readToken('--color-accent', '#2563eb'),
      openingColor: readToken('--color-warning', '#d97706'),
      assetColor: readToken('--color-success', '#15803d'),
      stairColor: readToken('--color-danger', '#dc2626'),
      witnessColor: readToken('--draft-witness', '#64748b'),
    });
    if (!group) return;
    scene.add(group);
    planOverlayGroupRef.current = group;
    return () => {
      if (planOverlayGroupRef.current !== group) return;
      scene.remove(group);
      disposeObject3D(group);
      planOverlayGroupRef.current = null;
    };
  }, [elementsById, persistedOrbitViewpoint, theme]);

  useEffect(() => {
    const ssao = ssaoPassRef.current;
    if (!ssao) return;
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ssao.enabled =
      viewerAmbientOcclusionEnabled && !reducedMotion && viewerRenderStyle !== 'hidden-line';
  }, [viewerAmbientOcclusionEnabled, viewerRenderStyle]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (!viewerDepthCueEnabled) {
      scene.fog = null;
      return;
    }
    const fogColor =
      viewerBackground === 'dark'
        ? new THREE.Color(0x1a1a2e)
        : viewerBackground === 'white'
          ? new THREE.Color(0xffffff)
          : new THREE.Color(0xe8f4fd);
    scene.fog = new THREE.Fog(fogColor, 28, 140);
  }, [viewerBackground, viewerDepthCueEnabled]);

  useEffect(() => {
    const root = rootGroupRef.current;
    if (root) applyModelEdgeDisplay(root, viewerEdges, viewerSilhouetteEdgeWidth);
    const selectedThickness = Math.max(1, viewerSilhouetteEdgeWidth * 1.2);
    if (outlinePassRef.current) outlinePassRef.current.edgeThickness = selectedThickness;
    for (const pass of remoteOutlinePassesRef.current.values()) {
      pass.edgeThickness = selectedThickness;
    }
  }, [viewerEdges, viewerSilhouetteEdgeWidth]);

  // ── Clipping planes + section-box cage ───────────────────────────────────
  // Runs only when clip elevation or section box changes — not on every element edit.
  useEffect(() => {
    const root = rootGroupRef.current;
    const rnd = rendererRef.current;
    if (!root) return;

    // Remove stale cap meshes from the previous rebuild.
    for (const c of clipCapsRef.current) sceneRef.current?.remove(c);
    clipCapsRef.current = [];

    const sectionBox = sectionBoxRef.current;
    const sectionPlanes = sectionBox && sectionBoxActive ? sectionBox.clippingPlanes() : [];
    const clipElevM =
      viewerClipElevMm != null && Number.isFinite(viewerClipElevMm) && viewerClipElevMm >= 0
        ? viewerClipElevMm / 1000
        : null;
    const clipFloorM =
      viewerClipFloorElevMm != null &&
      Number.isFinite(viewerClipFloorElevMm) &&
      viewerClipFloorElevMm >= 0
        ? viewerClipFloorElevMm / 1000
        : null;

    if (rnd)
      rnd.localClippingEnabled =
        clipElevM != null || clipFloorM != null || sectionPlanes.length > 0;

    const planes: THREE.Plane[] = [];
    for (const p of sectionPlanes) {
      planes.push(
        new THREE.Plane(new THREE.Vector3(p.normal.x, p.normal.y, p.normal.z), p.constant),
      );
    }
    if (clipElevM != null) {
      const plane = new THREE.Plane();
      plane.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(0, clipElevM, 0),
      );
      planes.push(plane);
    }
    if (clipFloorM != null) {
      const planeLo = new THREE.Plane();
      planeLo.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, clipFloorM, 0),
      );
      planes.push(planeLo);
    }

    clippingPlanesRef.current = planes;
    applyClippingPlanesToMeshes(root, planes);

    // Configure stencil on every scene mesh so clipped back-faces write stencil value 1.
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh) || obj.userData.isClipCap) return;
      const mat = obj.material as THREE.MeshStandardMaterial;
      mat.stencilWrite = true;
      mat.stencilRef = 1;
      mat.stencilFunc = THREE.AlwaysStencilFunc;
      mat.stencilFail = THREE.KeepStencilOp;
      mat.stencilZFail = THREE.ReplaceStencilOp;
      mat.stencilZPass = THREE.KeepStencilOp;
    });

    // Section-box wireframe cage.
    if (sectionBoxCageRef.current) {
      root.remove(sectionBoxCageRef.current);
      sectionBoxCageRef.current = null;
    }
    if (sectionBoxActive && sectionBox) {
      const snap = sectionBox.snapshot();
      const verts = aabbWireframeVertices(snap.min, snap.max);
      const cage = new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(verts),
        new THREE.LineBasicMaterial({
          color: readToken('--color-accent', '#fcd34d'),
          transparent: true,
          opacity: 0.85,
        }),
      );
      cage.userData.bimPickId = '__section_box_cage';
      sectionBoxCageRef.current = cage;
      root.add(cage);
    }

    // Build stencil cap meshes for each active clipping plane.
    if (sectionBoxActive && planes.length > 0) {
      const capColor = readColorToken('--color-surface-strong', '#f0f0f0');
      const newCaps: THREE.Mesh[] = [];
      for (const plane of planes) {
        const cap = makeClipPlaneCap(plane, capColor);
        (cap.material as THREE.MeshBasicMaterial).clippingPlanes = planes.filter(
          (p) => p !== plane,
        );
        sceneRef.current?.add(cap);
        newCaps.push(cap);
      }
      clipCapsRef.current = newCaps;
    }
  }, [viewerClipElevMm, viewerClipFloorElevMm, sectionBoxActive]);

  useEffect(() => {
    const op = outlinePassRef.current;
    if (!op) return;
    const selectedObjects = [selectedId, ...selectedIds]
      .filter((id): id is string => typeof id === 'string')
      .map((id) => bimPickMapRef.current.get(id))
      .filter((obj): obj is THREE.Object3D => Boolean(obj));
    op.selectedObjects = selectedObjects;
  }, [selectedId, selectedIds]);

  // COL-V3-01 — render colored outline halos for remote participant selections.
  // One OutlinePass per unique color is inserted before the OutputPass so each
  // remote user's halo uses their assigned --cat-* palette color.
  useEffect(() => {
    const composer = composerRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!composer || !scene || !camera) return;

    const pickMap = bimPickMapRef.current;
    const remotePasses = remoteOutlinePassesRef.current;

    // Group remote selections by color so we can share one pass per color.
    const byColor = new Map<string, THREE.Object3D[]>();
    for (const { elementId, color } of remoteSelections ?? []) {
      const obj = pickMap.get(elementId);
      if (!obj) continue;
      if (!byColor.has(color)) byColor.set(color, []);
      byColor.get(color)!.push(obj);
    }

    // Remove passes for colors that are no longer present.
    for (const [color, pass] of remotePasses) {
      if (!byColor.has(color)) {
        // Splice out from composer.passes (OutputPass is always last).
        const idx = composer.passes.indexOf(pass);
        if (idx !== -1) composer.passes.splice(idx, 1);
        remotePasses.delete(color);
      }
    }

    // Add or update passes for current colors.
    const outputPassIdx = composer.passes.length - 1; // OutputPass is last
    for (const [color, objs] of byColor) {
      let pass = remotePasses.get(color);
      if (!pass) {
        const size = new THREE.Vector2(1, 1);
        pass = new OutlinePass(size, scene, camera);
        pass.edgeStrength = 2.5;
        pass.edgeGlow = 0.0;
        pass.edgeThickness = 1.5;
        pass.visibleEdgeColor.set(color);
        pass.hiddenEdgeColor.set(color);
        composer.passes.splice(outputPassIdx, 0, pass);
        remotePasses.set(color, pass);
      }
      pass.selectedObjects = objs;
    }
  }, [remoteSelections]);

  // EDT-03 — rebuild 3D grip meshes when the selection (or its element
  // shape) changes. The pointer handlers raycast against
  // `gripPickablesRef.current` first so grips take precedence over
  // element picks.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    gripHandleRef.current?.dispose();
    gripHandleRef.current = null;
    gripPickablesRef.current = [];
    if (!selectedId) return;
    const el = elementsById[selectedId];
    if (!el) return;
    const grips = gripsFor(el as { kind?: string });
    // Filter out elevation-only grips while in 3D orbit view.
    const visible = grips.filter((g) => g.visibleIn !== 'elevation');
    if (visible.length === 0) return;
    const handle = buildGripMeshes(scene, visible);
    gripHandleRef.current = handle;
    gripPickablesRef.current = handle.pickables;
    return () => {
      handle.dispose();
      if (gripHandleRef.current === handle) {
        gripHandleRef.current = null;
        gripPickablesRef.current = [];
      }
    };
  }, [selectedId, elementsById]);

  // FED-03 — render drift badges as billboarded sprites at the centroid
  // of every element with a drifted `monitorSource`. The 2D plan canvas
  // also paints a yellow-triangle badge; using the same Canvas-rendered
  // texture here keeps the cue visually identical across views.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const sprites: THREE.Sprite[] = [];
    const drifted = selectDriftedElements(elementsById);
    if (drifted.length === 0) return;
    const tex = new THREE.CanvasTexture(buildDriftBadgeCanvas(64));
    tex.minFilter = THREE.LinearFilter;
    for (const elem of drifted) {
      const anchor = elementBadgeAnchorMm(elem);
      if (!anchor) continue;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.35, 0.35, 1);
      sprite.position.set(anchor.xMm / 1000, 2.5, anchor.yMm / 1000);
      sprite.userData.driftBadge = true;
      sprite.userData.bimPickId = elem.id;
      sprite.userData.driftTooltip = driftBadgeTooltip(elem);
      scene.add(sprite);
      sprites.push(sprite);
    }
    return () => {
      for (const s of sprites) {
        scene.remove(s);
        s.material.dispose();
      }
      tex.dispose();
    };
  }, [elementsById]);

  // Sync the section-box controller's `active` flag with React state.
  useEffect(() => {
    sectionBoxRef.current?.setActive(sectionBoxActive);
  }, [sectionBoxActive]);

  // Walk mode activation: seed position from orbit camera, request pointer lock, switch FOV.
  useEffect(() => {
    const wc = walkControllerRef.current;
    const cam = cameraRef.current;
    if (!wc) return;
    if (walkActive) {
      if (cam) {
        cam.updateMatrixWorld(true);
        const dir = new THREE.Vector3();
        cam.getWorldDirection(dir);
        const yaw = Math.atan2(dir.x, dir.z);
        wc.teleport({ x: cam.position.x, y: cam.position.y, z: cam.position.z }, yaw);
        cam.fov = 75;
        cam.updateProjectionMatrix();
        cam.updateMatrixWorld(true);
      }
      wc.setLevels(walkLevelsRef.current);
      wc.setActive(true);
      try {
        const pointerLockRequest = mountRef.current?.requestPointerLock();
        if (pointerLockRequest && 'catch' in pointerLockRequest) {
          void pointerLockRequest.catch(() => {
            /* Browser may require the next canvas click; keep walk mode armed. */
          });
        }
      } catch {
        /* Browser may require the next canvas click; keep walk mode armed. */
      }
    } else {
      wc.setActive(false);
      if (cam) {
        cam.fov = 55;
        cam.updateProjectionMatrix();
      }
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }, [walkActive]);

  const handleViewCubePick = useCallback(
    (
      _pick: ViewCubePick,
      alignment: { azimuth: number; elevation: number; up: { x: number; y: number; z: number } },
    ): void => {
      const rig = cameraRigRef.current;
      if (!rig) return;
      const snap = rig.snapshot();
      rig.applyViewpoint(
        {
          x:
            snap.target.x +
            snap.radius * Math.cos(alignment.elevation) * Math.sin(alignment.azimuth),
          y: snap.target.y + snap.radius * Math.sin(alignment.elevation),
          z:
            snap.target.z +
            snap.radius * Math.cos(alignment.elevation) * Math.cos(alignment.azimuth),
        },
        snap.target,
        alignment.up,
      );
      const camera = cameraRef.current;
      if (camera) {
        const next = rig.snapshot();
        applySceneCameraPose(camera, next);
        const orthoCamera = orthoCameraRef.current;
        if (orthoCamera) {
          mirrorSceneCameraPose(camera, orthoCamera, next.target);
        }
        setCurrentAzimuth(next.azimuth);
        setCurrentElevation(next.elevation);
      }
    },
    [],
  );

  const handleViewCubeDrag = useCallback((dxPx: number, dyPx: number): void => {
    const rig = cameraRigRef.current;
    const camera = cameraRef.current;
    if (!rig || !camera) return;
    rig.orbit(dxPx, dyPx);
    const snap = rig.snapshot();
    applySceneCameraPose(camera, snap);
    const orthoCamera = orthoCameraRef.current;
    if (orthoCamera) {
      mirrorSceneCameraPose(camera, orthoCamera, snap.target);
    }
    setCurrentAzimuth(snap.azimuth);
    setCurrentElevation(snap.elevation);
  }, []);

  const overlayTitleInstruction = useMemo((): { title: string; instruction: string } | null => {
    if (!direct3dAuthoringActive || !authoringOverlay) return null;
    if (
      draftPlaneAngleWarning &&
      (LINE_3D_AUTHORING_TOOLS.has(authoringOverlay.tool) ||
        POLYGON_3D_AUTHORING_TOOLS.has(authoringOverlay.tool) ||
        authoringOverlay.tool === 'column' ||
        authoringOverlay.tool === 'room' ||
        authoringOverlay.tool === 'component')
    ) {
      return {
        title: `${authoringOverlay.tool.replace('-', ' ')} placement`,
        instruction:
          'View is too edge-on to the active level plane. Orbit slightly toward top/plan before placing.',
      };
    }
    if (authoringOverlay.tool === 'floor') {
      return {
        title: `Floor boundary · ${authoringOverlay.levelName ?? 'Active level'}`,
        instruction:
          authoringOverlay.phase === 'pick-vertex'
            ? 'Click first floor boundary point.'
            : 'Click next boundary points. Click near first point to close. Esc cancels sketch.',
      };
    }
    if (authoringOverlay.tool === 'roof') {
      return {
        title: `Roof footprint · ${authoringOverlay.levelName ?? 'Active level'}`,
        instruction:
          authoringOverlay.phase === 'pick-vertex'
            ? 'Click first roof footprint point.'
            : 'Click next footprint points. Click near first point to close. Esc cancels sketch.',
      };
    }
    if (authoringOverlay.tool === 'shaft') {
      return {
        title: `Shaft opening · ${authoringOverlay.levelName ?? 'Active level'}`,
        instruction:
          authoringOverlay.phase === 'pick-vertex'
            ? 'Click first shaft boundary point.'
            : 'Click next boundary points. Click near first point to close. Esc cancels sketch.',
      };
    }
    if (authoringOverlay.tool === 'area') {
      return {
        title: `Area boundary · ${authoringOverlay.levelName ?? 'Active level'}`,
        instruction:
          authoringOverlay.phase === 'pick-vertex'
            ? 'Click first area boundary point.'
            : 'Click next boundary points. Click near first point to close. Esc cancels sketch.',
      };
    }
    if (authoringOverlay.tool === 'wall') {
      return {
        title: `Wall placement · ${authoringOverlay.levelName ?? 'Active level'}`,
        instruction:
          authoringOverlay.phase === 'pick-start'
            ? authoringOverlay.wallPlaneUnreadable
              ? 'Rotate toward the active level work plane or open the associated plan. This view cannot place walls accurately.'
              : authoringOverlay.wallPlaneOccluded
                ? 'Move to visible active level grid. Walls cannot start through existing model geometry.'
                : authoringOverlay.wallAnchorRequired
                  ? 'Move over the visible active level grid. Empty sky is not a valid 3D wall start.'
                  : 'Click start point. Alt+drag or middle mouse to orbit/pan.'
            : authoringOverlay.wallPlaneUnreadable
              ? 'Move the endpoint back onto the readable active level work plane. Esc cancels segment.'
              : authoringOverlay.wallPlaneOccluded
                ? 'Move the endpoint onto visible active level grid; current cursor is behind model geometry. Esc cancels segment.'
                : `Click end point. Space flips side (${
                    authoringOverlay.wallFlipActive ? 'flipped' : 'default'
                  }). Esc cancels segment.`,
      };
    }
    if (authoringOverlay.tool === 'beam') {
      return {
        title: `Beam placement · ${authoringOverlay.levelName ?? 'Active level'}`,
        instruction:
          authoringOverlay.phase === 'pick-start'
            ? 'Click beam start point. Alt+drag or middle mouse to orbit/pan.'
            : 'Click beam end point. Esc cancels segment.',
      };
    }
    if (authoringOverlay.tool === 'stair') {
      return {
        title: `Stair run · ${authoringOverlay.levelName ?? 'Active level'}`,
        instruction:
          authoringOverlay.phase === 'pick-start'
            ? 'Click stair run start. Alt+drag or middle mouse to orbit/pan.'
            : 'Click stair run end. Esc cancels segment.',
      };
    }
    if (authoringOverlay.tool === 'railing') {
      return {
        title: `Railing path · ${authoringOverlay.levelName ?? 'Active level'}`,
        instruction:
          authoringOverlay.phase === 'pick-start'
            ? 'Click railing path start. Alt+drag or middle mouse to orbit/pan.'
            : 'Click railing path end. Esc cancels segment.',
      };
    }
    if (authoringOverlay.tool === 'grid') {
      return {
        title: `Grid line · ${authoringOverlay.levelName ?? 'Active level'}`,
        instruction:
          authoringOverlay.phase === 'pick-start'
            ? 'Click grid start point. Alt+drag or middle mouse to orbit/pan.'
            : 'Click grid end point. Esc cancels segment.',
      };
    }
    if (authoringOverlay.tool === 'reference-plane') {
      return {
        title: `Reference plane · ${authoringOverlay.levelName ?? 'Active level'}`,
        instruction:
          authoringOverlay.phase === 'pick-start'
            ? 'Click reference plane start point. Alt+drag or middle mouse to orbit/pan.'
            : 'Click reference plane end point. Esc cancels segment.',
      };
    }
    if (authoringOverlay.tool === 'column') {
      return {
        title: `Column placement · ${authoringOverlay.levelName ?? 'Active level'}`,
        instruction: 'Click a point to place a column. Alt+drag or middle mouse to orbit/pan.',
      };
    }
    if (authoringOverlay.tool === 'component') {
      const hasSelection = Boolean(activeComponentAssetId || activeComponentFamilyTypeId);
      return {
        title: `Component placement · ${authoringOverlay.levelName ?? 'Active level'}`,
        instruction: hasSelection
          ? 'Click a visible point to place the selected family or asset. Use Load Family to choose another.'
          : 'Use Insert > Load Family to choose an asset or loaded family before placing a component.',
      };
    }
    if (authoringOverlay.tool === 'ceiling') {
      return {
        title: `Ceiling boundary · ${authoringOverlay.levelName ?? 'Active level'}`,
        instruction:
          authoringOverlay.phase === 'pick-vertex'
            ? 'Click first ceiling boundary point.'
            : 'Click next boundary points. Click near first point to close. Esc cancels sketch.',
      };
    }
    if (authoringOverlay.tool === 'room') {
      return {
        title: `Room placement · ${authoringOverlay.levelName ?? 'Active level'}`,
        instruction: 'Click inside a closed boundary to place a room.',
      };
    }
    if (authoringOverlay.tool === 'door') {
      return {
        title: 'Door placement',
        instruction:
          authoringOverlay.previewHostValid === false
            ? `${authoringOverlay.previewHostInvalidReason ?? 'Move over a wall to see a valid host preview.'} L ${
                authoringOverlay.previewHostLock ? 'unlocks' : 'locks'
              } host.`
            : `Hover a wall to preview, then click to insert a door. L ${
                authoringOverlay.previewHostLock ? 'unlocks' : 'locks'
              } host.`,
      };
    }
    if (authoringOverlay.tool === 'window') {
      return {
        title: 'Window placement',
        instruction:
          authoringOverlay.previewHostValid === false
            ? `${authoringOverlay.previewHostInvalidReason ?? 'Move over a wall to see a valid host preview.'} L ${
                authoringOverlay.previewHostLock ? 'unlocks' : 'locks'
              } host.`
            : `Hover a wall to preview, then click to insert a window. L ${
                authoringOverlay.previewHostLock ? 'unlocks' : 'locks'
              } host.`,
      };
    }
    return {
      title: 'Opening placement',
      instruction:
        authoringOverlay.previewHostValid === false
          ? `${authoringOverlay.previewHostInvalidReason ?? 'Move over a wall to see a valid host preview.'} L ${
              authoringOverlay.previewHostLock ? 'unlocks' : 'locks'
            } host.`
          : `Hover a wall to preview, then click to insert an opening. L ${
              authoringOverlay.previewHostLock ? 'unlocks' : 'locks'
            } host.`,
    };
  }, [authoringOverlay, direct3dAuthoringActive, draftPlaneAngleWarning]);

  const direct3dLevelOptions = useMemo(
    () =>
      Object.values(elementsById)
        .filter((el): el is Extract<Element, { kind: 'level' }> => el.kind === 'level')
        .map((level) => ({ id: level.id, name: level.name, elevationMm: level.elevationMm }))
        .sort((a, b) => a.elevationMm - b.elevationMm),
    [elementsById],
  );
  const activeWorkPlaneLevel = useMemo(
    () => resolve3dDraftLevel(direct3dLevelOptions, activeLevelId),
    [activeLevelId, direct3dLevelOptions],
  );
  const setAuthoringWorkPlaneLevel = useCallback(
    (levelId: string): void => {
      if (!levelId) return;
      setActiveLevelId(levelId);
      selectStoreEl(levelId);
    },
    [selectStoreEl, setActiveLevelId],
  );
  const stepAuthoringWorkPlaneLevel = useCallback(
    (direction: -1 | 1): void => {
      if (direct3dLevelOptions.length === 0) return;
      const activeIndex = activeWorkPlaneLevel
        ? direct3dLevelOptions.findIndex((level) => level.id === activeWorkPlaneLevel.id)
        : -1;
      const fallbackIndex = direction > 0 ? 0 : direct3dLevelOptions.length - 1;
      const nextIndex =
        activeIndex < 0
          ? fallbackIndex
          : Math.max(0, Math.min(direct3dLevelOptions.length - 1, activeIndex + direction));
      setAuthoringWorkPlaneLevel(direct3dLevelOptions[nextIndex]!.id);
    },
    [activeWorkPlaneLevel, direct3dLevelOptions, setAuthoringWorkPlaneLevel],
  );

  return (
    <div
      data-testid="orbit-3d-viewport"
      className="relative h-full w-full overflow-hidden bg-background"
    >
      {wallContextMenu && (
        <WallContextMenu
          wall={wallContextMenu.wall}
          position={wallContextMenu.position}
          onCommand={handleWallContextMenuCommand}
          onClose={() => setWallContextMenu(null)}
        />
      )}
      <WallFaceRadialMenu
        open={wallFaceRadialMenu}
        onSelect={handleWallFaceRadialCommand}
        onDismiss={() => setWallFaceRadialMenu(null)}
      />
      <div
        className="pointer-events-auto absolute top-6 z-20"
        data-testid="viewport-viewcube-anchor"
        style={{
          right: viewOverlayRightInset ? `calc(${viewOverlayRightInset} + 1.5rem)` : '1.5rem',
        }}
      >
        <ViewCube
          currentAzimuth={currentAzimuth}
          currentElevation={currentElevation}
          onPick={handleViewCubePick}
          onDrag={handleViewCubeDrag}
        />
      </div>

      {overlayTitleInstruction ? (
        <div className="pointer-events-none absolute left-3 top-3 z-20">
          <div className="rounded border border-accent/60 bg-surface/95 px-3 py-2 text-xs text-foreground shadow-sm">
            <div className="font-medium text-accent">{overlayTitleInstruction.title}</div>
            <div className="text-muted">{overlayTitleInstruction.instruction}</div>
          </div>
        </div>
      ) : null}

      {direct3dAuthoringActive && authoringOverlay?.levelName ? (
        <div className="pointer-events-auto absolute left-3 top-[74px] z-20">
          <div
            data-testid="viewport-work-plane-badge"
            className="flex max-w-[min(520px,calc(100vw-2rem))] items-center gap-2 rounded border border-accent/40 bg-surface/95 px-2.5 py-1.5 text-[11px] text-foreground shadow-sm"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span className="font-mono font-semibold text-accent">Work plane</span>
            <button
              type="button"
              data-testid="viewport-work-plane-prev"
              aria-label="Previous level"
              title="Previous level"
              disabled={direct3dLevelOptions.length < 2}
              className="grid size-6 place-items-center rounded border border-border bg-surface text-xs text-muted disabled:opacity-40"
              onClick={() => stepAuthoringWorkPlaneLevel(-1)}
            >
              ^
            </button>
            <select
              data-testid="viewport-work-plane-level-select"
              aria-label="Active work plane level"
              className="h-6 min-w-[170px] max-w-[260px] rounded border border-border bg-surface px-2 font-mono text-[11px] text-foreground"
              value={activeWorkPlaneLevel?.id ?? ''}
              onChange={(event) => setAuthoringWorkPlaneLevel(event.currentTarget.value)}
            >
              {direct3dLevelOptions.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name} {(level.elevationMm / 1000).toFixed(2)} m
                </option>
              ))}
            </select>
            <button
              type="button"
              data-testid="viewport-work-plane-next"
              aria-label="Next level"
              title="Next level"
              disabled={direct3dLevelOptions.length < 2}
              className="grid size-6 place-items-center rounded border border-border bg-surface text-xs text-muted disabled:opacity-40"
              onClick={() => stepAuthoringWorkPlaneLevel(1)}
            >
              v
            </button>
          </div>
        </div>
      ) : null}

      {direct3dAuthoringActive && authoringOverlay?.snapScreen ? (
        <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full">
          <g data-testid="viewport-3d-snap-glyph">
            <circle
              cx={authoringOverlay.snapScreen.x}
              cy={authoringOverlay.snapScreen.y}
              r="8"
              fill="var(--color-surface)"
              stroke="var(--color-accent)"
              strokeWidth="2"
              opacity="0.96"
            />
            <circle
              cx={authoringOverlay.snapScreen.x}
              cy={authoringOverlay.snapScreen.y}
              r="2.5"
              fill="var(--color-accent)"
              opacity="0.96"
            />
            <text
              x={authoringOverlay.snapScreen.x + 12}
              y={authoringOverlay.snapScreen.y - 10}
              fontSize="10"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fill="var(--color-accent)"
            >
              {authoringOverlay.snapKind === 'grid' ? 'grid snap' : 'level plane'}
            </text>
          </g>
        </svg>
      ) : null}

      {direct3dAuthoringActive &&
      authoringOverlay?.numericInputValue &&
      authoringOverlay.currentScreen ? (
        <div
          data-testid="viewport-3d-numeric-input"
          className="pointer-events-none absolute z-30 rounded border border-accent bg-surface/95 px-2 py-1 font-mono text-[11px] text-accent shadow-sm"
          style={{
            left: authoringOverlay.currentScreen.x + 14,
            top: authoringOverlay.currentScreen.y + 14,
          }}
        >
          {authoringOverlay.numericInputValue}
          <span className="ml-1 text-muted">mm · Enter</span>
        </div>
      ) : null}

      {direct3dAuthoringActive &&
        authoringOverlay &&
        (LINE_3D_AUTHORING_TOOLS.has(authoringOverlay.tool) &&
        authoringOverlay.phase === 'pick-end' &&
        authoringOverlay.startScreen &&
        authoringOverlay.currentScreen ? (
          <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full">
            {authoringOverlay.tool === 'wall' ? (
              <line
                data-testid="wall-cursor-path"
                x1={authoringOverlay.startScreen.x}
                y1={authoringOverlay.startScreen.y}
                x2={authoringOverlay.currentScreen.x}
                y2={authoringOverlay.currentScreen.y}
                stroke="var(--color-accent)"
                strokeWidth="1.5"
                strokeDasharray="3 5"
                opacity="0.62"
              />
            ) : (
              <line
                x1={authoringOverlay.startScreen.x}
                y1={authoringOverlay.startScreen.y}
                x2={authoringOverlay.currentScreen.x}
                y2={authoringOverlay.currentScreen.y}
                stroke="var(--color-accent)"
                strokeWidth="2"
                strokeDasharray="6 4"
                opacity="0.95"
              />
            )}
            <circle
              cx={authoringOverlay.startScreen.x}
              cy={authoringOverlay.startScreen.y}
              r="6"
              fill="var(--color-accent)"
              opacity="0.95"
            />
            {authoringOverlay.tool === 'wall' ? (
              <circle
                data-testid="wall-cursor-end"
                cx={authoringOverlay.currentScreen.x}
                cy={authoringOverlay.currentScreen.y}
                r="5"
                fill="var(--color-surface)"
                stroke="var(--color-accent)"
                strokeWidth="2"
                opacity="0.96"
              />
            ) : null}
          </svg>
        ) : LINE_3D_AUTHORING_TOOLS.has(authoringOverlay.tool) && authoringOverlay.currentScreen ? (
          <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full">
            <circle
              cx={authoringOverlay.currentScreen.x}
              cy={authoringOverlay.currentScreen.y}
              r="6"
              fill="transparent"
              stroke="var(--color-accent)"
              strokeWidth="2"
              opacity="0.95"
            />
          </svg>
        ) : POLYGON_3D_AUTHORING_TOOLS.has(authoringOverlay.tool) &&
          authoringOverlay.pointsScreen &&
          authoringOverlay.pointsScreen.length > 0 ? (
          <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full">
            <polyline
              points={authoringOverlay.pointsScreen.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2"
              opacity="0.95"
            />
            {authoringOverlay.currentScreen ? (
              <line
                x1={authoringOverlay.pointsScreen[authoringOverlay.pointsScreen.length - 1]!.x}
                y1={authoringOverlay.pointsScreen[authoringOverlay.pointsScreen.length - 1]!.y}
                x2={authoringOverlay.currentScreen.x}
                y2={authoringOverlay.currentScreen.y}
                stroke="var(--color-accent)"
                strokeWidth="2"
                strokeDasharray="6 4"
                opacity="0.95"
              />
            ) : null}
            <circle
              cx={authoringOverlay.pointsScreen[0]!.x}
              cy={authoringOverlay.pointsScreen[0]!.y}
              r="6"
              fill="var(--color-accent)"
              opacity="0.95"
            />
          </svg>
        ) : POLYGON_3D_AUTHORING_TOOLS.has(authoringOverlay.tool) &&
          authoringOverlay.currentScreen ? (
          <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full">
            <circle
              cx={authoringOverlay.currentScreen.x}
              cy={authoringOverlay.currentScreen.y}
              r="6"
              fill="transparent"
              stroke="var(--color-accent)"
              strokeWidth="2"
              opacity="0.95"
            />
          </svg>
        ) : (authoringOverlay.tool === 'column' || authoringOverlay.tool === 'room') &&
          authoringOverlay.currentScreen ? (
          <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full">
            <circle
              cx={authoringOverlay.currentScreen.x}
              cy={authoringOverlay.currentScreen.y}
              r="9"
              fill="transparent"
              stroke="var(--color-accent)"
              strokeWidth="2"
              opacity="0.95"
            />
            <circle
              cx={authoringOverlay.currentScreen.x}
              cy={authoringOverlay.currentScreen.y}
              r="3"
              fill="var(--color-accent)"
              opacity="0.95"
            />
          </svg>
        ) : (authoringOverlay.tool === 'door' ||
            authoringOverlay.tool === 'window' ||
            authoringOverlay.tool === 'wall-opening') &&
          authoringOverlay.currentScreen ? (
          <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full">
            {authoringOverlay.previewOutlineScreen &&
            authoringOverlay.previewOutlineScreen.length >= 4 ? (
              <polygon
                points={authoringOverlay.previewOutlineScreen.map((p) => `${p.x},${p.y}`).join(' ')}
                fill={
                  authoringOverlay.previewHostValid === false
                    ? 'color-mix(in srgb, var(--color-danger-500, #dc2626) 18%, transparent)'
                    : 'color-mix(in srgb, var(--color-accent) 16%, transparent)'
                }
                stroke={
                  authoringOverlay.previewHostValid === false
                    ? 'var(--color-danger-500, #dc2626)'
                    : 'var(--color-accent)'
                }
                strokeWidth="2"
                opacity="0.95"
              />
            ) : null}
            {authoringOverlay.previewStartScreen && authoringOverlay.previewEndScreen ? (
              <line
                x1={authoringOverlay.previewStartScreen.x}
                y1={authoringOverlay.previewStartScreen.y}
                x2={authoringOverlay.previewEndScreen.x}
                y2={authoringOverlay.previewEndScreen.y}
                stroke={
                  authoringOverlay.previewHostValid === false
                    ? 'var(--color-danger-500, #dc2626)'
                    : 'var(--color-accent)'
                }
                strokeWidth="3"
                strokeDasharray="6 4"
                opacity="0.95"
              />
            ) : null}
            {authoringOverlay.previewAuxArcPath ? (
              <path
                d={authoringOverlay.previewAuxArcPath}
                fill="none"
                stroke={
                  authoringOverlay.previewHostValid === false
                    ? 'var(--color-danger-500, #dc2626)'
                    : 'var(--color-accent)'
                }
                strokeWidth="2"
                opacity="0.9"
              />
            ) : null}
            {authoringOverlay.previewAuxLines?.map((seg, idx) => (
              <line
                key={`host-preview-aux-${idx}`}
                x1={seg.start.x}
                y1={seg.start.y}
                x2={seg.end.x}
                y2={seg.end.y}
                stroke={
                  authoringOverlay.previewHostValid === false
                    ? 'var(--color-danger-500, #dc2626)'
                    : 'var(--color-accent)'
                }
                strokeWidth="2"
                opacity="0.9"
              />
            ))}
            {authoringOverlay.previewHostLock ? (
              <>
                <rect
                  x={authoringOverlay.currentScreen.x + 12}
                  y={authoringOverlay.currentScreen.y - 26}
                  width={72}
                  height={18}
                  rx={9}
                  fill="color-mix(in srgb, var(--color-accent) 22%, var(--color-surface))"
                  stroke="var(--color-accent)"
                  strokeWidth="1"
                  opacity="0.95"
                />
                <text
                  x={authoringOverlay.currentScreen.x + 48}
                  y={authoringOverlay.currentScreen.y - 14}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="600"
                  fill="var(--color-accent)"
                >
                  HOST LOCK
                </text>
              </>
            ) : null}
            <circle
              cx={authoringOverlay.currentScreen.x}
              cy={authoringOverlay.currentScreen.y}
              r="8"
              fill="transparent"
              stroke={
                authoringOverlay.previewHostValid === false
                  ? 'var(--color-danger-500, #dc2626)'
                  : 'var(--color-accent)'
              }
              strokeWidth="2"
              opacity="0.95"
            />
          </svg>
        ) : null)}

      {/* Walk mode controls bar — shown while pointer is locked */}
      {walkActive ? (
        <div
          data-testid="viewport-walk-hints"
          className="pointer-events-none absolute bottom-12 left-1/2 z-20 -translate-x-1/2"
        >
          <div className="flex items-center gap-2 rounded-full border border-border bg-surface/90 px-4 py-1.5 text-[11px] text-muted shadow-md backdrop-blur-sm">
            <NavHint k="WASD" label={t('viewport.walkHints.move')} />
            <Sep />
            <NavHint k="Mouse" label={t('viewport.walkHints.look')} />
            <Sep />
            <NavHint k="Shift" label={t('viewport.walkHints.run')} />
            <Sep />
            <NavHint k="Q/E" label={t('viewport.walkHints.upDown')} />
            <Sep />
            <NavHint k="PgUp/PgDn" label={t('viewport.walkHints.floor')} />
            <Sep />
            <NavHint k="Esc" label={t('viewport.walkHints.exit')} />
          </div>
        </div>
      ) : null}

      {sectionBoxActive && sectionBoxRef.current ? (
        <div className="pointer-events-none absolute left-3 bottom-3 z-20">
          <span
            data-testid="section-box-summary"
            className="rounded-pill border border-border bg-surface/85 px-2 py-0.5 text-[11px] font-mono text-muted backdrop-blur-sm"
          >
            {sectionBoxRef.current.summary()}
          </span>
        </div>
      ) : null}

      {/* Architectural sky gradient — visible through the transparent Three.js canvas */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'linear-gradient(to bottom, #cce8f4 0%, #e8f4fd 40%, #f5f9fc 75%, #e8e4d8 100%)',
        }}
      />
      <div
        ref={mountRef}
        className={`relative z-[1] size-full ${
          direct3dAuthoringActive ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
        }`}
      />
    </div>
  );
}
