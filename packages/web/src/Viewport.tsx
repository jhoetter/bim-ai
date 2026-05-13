/* eslint-disable bim-ai/no-hex-in-chrome -- pre-v3 hex literals; remove when this file is migrated in B4 Phase 2 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as THREE from 'three';
import type { CsgRequest, CsgResponse } from './viewport/csgWorker';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';

import type { Element } from '@bim-ai/core';
import type { OrbitViewpointPersistFieldPayload } from './OrbitViewpointPersistedHud';

import { useBimStore } from './state/store';
import { useTheme } from './state/useTheme';
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
  categoryColorOr,
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
  addCladdingBoards,
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
} from './viewport/meshBuilders';
import { resolveWindowOutline } from './families/geometryFns/windowOutline';
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
import { makeSweepMesh } from './viewport/sweepMesh';
import { makeDormerMesh } from './viewport/dormerMesh';
import { buildMassMesh } from './viewport/meshBuilders.mass';
import { isElementVisibleUnderPhaseFilter } from './viewport/phaseFilter';
import { applyDormerCutsToRoofGeom } from './viewport/dormerRoofCut';
import { registerDormerCutFn } from './viewport/meshBuilders';
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
  classifyWallDraftProjection,
  projectSceneRayToLevelPlaneMm,
  resolve3dDraftLevel,
  type WallDraftProjectionClassification,
  type WallDraftProjectionMode,
} from './viewport/authoring3d';
import {
  isBackfacingWallHit,
  isDuplicateHostedPlacement,
  isLinkedElementId,
  type HostedPlacementDedupeState,
} from './viewport/directAuthoringGuards';

// KRN-14 — wire the CSG cut into meshBuilders. Side-effect at module load.
registerDormerCutFn(applyDormerCutsToRoofGeom);

type Props = {
  wsConnected: boolean;
  onPersistViewpointField?: (payload: OrbitViewpointPersistFieldPayload) => void | Promise<void>;
  /** ANN-02: optional dispatcher for the right-click "Generate Section / Elevation" menu. */
  onSemanticCommand?: (cmd: Record<string, unknown>) => void;
  /** COL-V3-01: remote participant selections to render as colored halos. */
  remoteSelections?: Array<{ elementId: string; color: string }>;
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
  | 'wall-opening';
type Authoring3dOverlayState = {
  tool: Direct3dAuthoringTool;
  phase: 'pick-start' | 'pick-end' | 'pick-point' | 'pick-wall' | 'pick-vertex' | 'pick-next';
  levelName?: string;
  startScreen?: ScreenPoint;
  currentScreen?: ScreenPoint;
  currentPointMm?: { xMm: number; yMm: number };
  pointsScreen?: ScreenPoint[];
  previewStartScreen?: ScreenPoint;
  previewEndScreen?: ScreenPoint;
  previewOutlineScreen?: ScreenPoint[];
  previewHostValid?: boolean;
  previewHostWallId?: string;
  previewHostAlongT?: number;
  previewHostLock?: boolean;
  previewAuxLines?: Array<{ start: ScreenPoint; end: ScreenPoint }>;
  previewAuxArcPath?: string;
  wallPreviewOutlineScreen?: ScreenPoint[];
  wallPreviewDirectionStartScreen?: ScreenPoint;
  wallPreviewDirectionEndScreen?: ScreenPoint;
  wallFlipActive?: boolean;
  wallProjectionMode?: WallDraftProjectionMode;
  wallAnchorRequired?: boolean;
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

export function Viewport({ wsConnected, onSemanticCommand, remoteSelections }: Props) {
  void wsConnected;
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
  const prevCatHiddenRef = useRef<Record<string, boolean>>({});
  const prevLevelHiddenRef = useRef<Record<string, boolean>>({});
  const csgWorkerRef = useRef<Worker | null>(null);
  /** Maps wallId → active CSG job nonce; responses with a mismatched nonce are stale and discarded. */
  const pendingCsgRef = useRef<Map<string, number>>(new Map());
  const pendingCsgMetaRef = useRef<
    Map<string, { len: number; height: number; thick: number; materialKey?: string | null }>
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
  selectedIdRef.current = selectedId;
  const planTool = useBimStore((s) => s.planTool);
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
      setAuthoringOverlay(null);
      setDraftPlaneAngleWarning(false);
      return;
    }
    const tool = planTool as Direct3dAuthoringTool;
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
      if (tool === 'column' || tool === 'room') {
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
  }, [planTool, direct3dDraftLevelName]);

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
  const lensMode = useBimStore((s) => s.lensMode);
  const orthoMode = viewerProjection === 'orthographic';

  const viewerClipElevMm = useBimStore((s) => s.viewerClipElevMm);
  const viewerClipFloorElevMm = useBimStore((s) => s.viewerClipFloorElevMm);
  const orbitCameraNonce = useBimStore((s) => s.orbitCameraNonce);
  const orbitCameraPoseMm = useBimStore((s) => s.orbitCameraPoseMm);
  const activeViewpointId = useBimStore((s) => s.activeViewpointId);

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
  viewerEdgesRef.current = viewerEdges;
  viewerSilhouetteEdgeWidthRef.current = viewerSilhouetteEdgeWidth;

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

      // Remove the solid-wall placeholder that was shown while CSG ran.
      const placeholder = cacheNow.get(data.jobId);
      if (placeholder) {
        rootNow.remove(placeholder);
        placeholder.traverse((node) => {
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

      if (!data.ok) return; // CSG failed; no mesh to insert, done.

      // Reconstruct BufferGeometry from transferable arrays.
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(data.position, 3));
      if (data.normal) geom.setAttribute('normal', new THREE.BufferAttribute(data.normal, 3));
      if (data.uv) geom.setAttribute('uv', new THREE.BufferAttribute(data.uv, 2));
      if (data.index) geom.setIndex(new THREE.BufferAttribute(data.index, 1));

      const paintNow = paintBundleRef.current;
      const csgIsWhite =
        csgMeta?.materialKey === 'white_cladding' || csgMeta?.materialKey === 'white_render';
      const csgBaseColor = csgIsWhite ? '#f4f4f0' : categoryColorOr(paintNow, 'wall');
      const wallMat = new THREE.MeshStandardMaterial({
        color: csgBaseColor,
        roughness: csgIsWhite ? 0.92 : (paintNow?.categories.wall.roughness ?? 0.85),
        metalness: paintNow?.categories.wall.metalness ?? 0.0,
        envMapIntensity: csgIsWhite ? 0.08 : 0.65,
      });

      const mesh = new THREE.Mesh(geom, wallMat);
      mesh.position.set(data.wcx, data.wcy, data.wcz);
      mesh.rotation.y = data.yaw;
      mesh.userData.bimPickId = data.jobId;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      addEdges(mesh);
      applyModelEdgeDisplay(mesh, viewerEdgesRef.current, viewerSilhouetteEdgeWidthRef.current);
      if (csgMeta?.materialKey === 'timber_cladding')
        addCladdingBoards(mesh, csgMeta.len, csgMeta.height, csgMeta.thick);
      else if (csgMeta?.materialKey === 'white_cladding')
        addCladdingBoards(mesh, csgMeta.len, csgMeta.height, csgMeta.thick, 120, 10, '#f4f4f0');
      applyClippingPlanesToMeshes(mesh, clippingPlanesRef.current);

      cacheNow.set(data.jobId, mesh);
      rootNow.add(mesh);

      // Keep outline pass in sync if this wall is the current selection.
      const op = outlinePassRef.current;
      if (op) {
        const sid = selectedIdRef.current;
        const sel = sid ? cacheNow.get(sid) : undefined;
        op.selectedObjects = sel ? [sel] : [];
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
    let lineDraftStart: {
      tool: 'wall' | 'beam' | 'stair' | 'railing' | 'grid' | 'reference-plane';
      levelId: string;
      point: { xMm: number; yMm: number };
      screen?: ScreenPoint;
      wallBasis?: WallDraftScreenBasis;
      wallProjection?: WallDraftProjectionClassification;
      wallAnchorElementId?: string;
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
      camera.position.set(snap.position.x, snap.position.y, snap.position.z);
      camera.up.set(snap.up.x, snap.up.y, snap.up.z).normalize();
      camera.lookAt(snap.target.x, snap.target.y, snap.target.z);
      setCurrentAzimuth(snap.azimuth);
      setCurrentElevation(snap.elevation);
      const oc = orthoCameraRef.current;
      if (oc) {
        oc.position.copy(camera.position);
        oc.up.copy(camera.up);
        oc.lookAt(snap.target.x, snap.target.y, snap.target.z);
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

    function pick(cx: number, cy: number) {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((cx - rect.left) / rect.width) * 2 - 1;
      ndc.y = -(((cy - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(root.children, true);

      const first = hits.find((h) => typeof h.object.userData.bimPickId === 'string');
      useBimStore.getState().select(first?.object.userData.bimPickId as string | undefined);
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
    ): {
      point: { xMm: number; yMm: number };
      screen: ScreenPoint;
    } | null {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((cx - rect.left) / rect.width) * 2 - 1;
      ndc.y = -(((cy - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = projectSceneRayToLevelPlaneMm(
        raycaster.ray.origin,
        raycaster.ray.direction,
        elevationMm,
      );
      if (!hit) return null;
      return {
        point: hit,
        screen: clientToCanvasScreen(cx, cy),
      };
    }

    function clientToCanvasScreen(cx: number, cy: number): ScreenPoint {
      const rect = renderer.domElement.getBoundingClientRect();
      return { x: cx - rect.left, y: cy - rect.top };
    }

    function pickVisibleModelDraftAnchor(
      cx: number,
      cy: number,
    ): {
      point: { xMm: number; yMm: number };
      screen: ScreenPoint;
      elementId: string;
    } | null {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((cx - rect.left) / rect.width) * 2 - 1;
      ndc.y = -(((cy - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(root.children, true);
      const hit = hits.find((candidate) => {
        const id = candidate.object.userData.bimPickId as string | undefined;
        return Boolean(id && !isLinkedElementId(id) && elementsByIdRef.current[id]);
      });
      const elementId = hit?.object.userData.bimPickId as string | undefined;
      if (!hit || !elementId) return null;
      return {
        point: { xMm: hit.point.x * 1000, yMm: hit.point.z * 1000 },
        screen: clientToCanvasScreen(cx, cy),
        elementId,
      };
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
      basisOriginPoint?: { xMm: number; yMm: number },
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
      const cameraDirection = new THREE.Vector3();
      camera.getWorldDirection(cameraDirection);
      const projection = classifyWallDraftProjection(scaleX, scaleY, cameraDirection.y);
      if (projection.mode === 'plane') return { projection };

      const scaleMmPerPx = THREE.MathUtils.clamp(scaleX, 5, 35);
      const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const projectedRight = horizontalCameraVector(cameraRight) ??
        (sampleX
          ? horizontalCameraVector(
              new THREE.Vector3(
                sampleX.point.xMm - origin.point.xMm,
                0,
                sampleX.point.yMm - origin.point.yMm,
              ),
            )
          : null) ?? { xMm: 1, yMm: 0 };
      const xPerPx = {
        xMm: projectedRight.xMm * scaleMmPerPx,
        yMm: projectedRight.yMm * scaleMmPerPx,
      };
      return {
        projection,
        basis: {
          mode: 'elevation-axis',
          originScreen: origin.screen,
          originPointMm: basisOriginPoint ?? origin.point,
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
    ): { point: { xMm: number; yMm: number }; screen: ScreenPoint } {
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
      worldPoint.project(camera);
      if (!Number.isFinite(worldPoint.x) || !Number.isFinite(worldPoint.y)) return null;
      return {
        x: (worldPoint.x + 1) * 0.5 * rect.width,
        y: (-worldPoint.y + 1) * 0.5 * rect.height,
      };
    }

    function wallLocationLineOffsetFrac(loc: string | null | undefined): number {
      switch (loc) {
        case 'finish-face-exterior':
        case 'core-face-exterior':
          return 0.5;
        case 'finish-face-interior':
        case 'core-face-interior':
          return -0.5;
        default:
          return 0;
      }
    }

    function flipWallLocationLine(loc: string | null | undefined): string | null | undefined {
      switch (loc) {
        case 'finish-face-exterior':
          return 'finish-face-interior';
        case 'finish-face-interior':
          return 'finish-face-exterior';
        case 'core-face-exterior':
          return 'core-face-interior';
        case 'core-face-interior':
          return 'core-face-exterior';
        default:
          return loc;
      }
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

    function wallDraftPreview(
      start: { xMm: number; yMm: number },
      end: { xMm: number; yMm: number },
      levelElevationMm: number,
      heightMm: number,
      flip: boolean,
      locationLine: string | null | undefined,
      thicknessMm: number,
      rect: DOMRect,
    ): {
      outline: ScreenPoint[];
      directionStart: ScreenPoint;
      directionEnd: ScreenPoint;
    } | null {
      const actualStart = start;
      const actualEnd = end;
      const dx = actualEnd.xMm - actualStart.xMm;
      const dy = actualEnd.yMm - actualStart.yMm;
      const len = Math.hypot(dx, dy);
      if (!Number.isFinite(len) || len < 1) return null;
      const nx = -dy / len;
      const ny = dx / len;
      const thickMm = Math.max(50, thicknessMm);
      const effectiveLocationLine = flip ? flipWallLocationLine(locationLine) : locationLine;
      const offsetMm = wallLocationLineOffsetFrac(effectiveLocationLine) * thickMm;
      const plus = offsetMm + thickMm / 2;
      const minus = offsetMm - thickMm / 2;
      const bottomZMm = levelElevationMm;
      const topZMm = levelElevationMm + Math.max(250, heightMm);
      const footprint = [
        { xMm: actualStart.xMm + nx * plus, yMm: actualStart.yMm + ny * plus },
        { xMm: actualEnd.xMm + nx * plus, yMm: actualEnd.yMm + ny * plus },
        { xMm: actualEnd.xMm + nx * minus, yMm: actualEnd.yMm + ny * minus },
        { xMm: actualStart.xMm + nx * minus, yMm: actualStart.yMm + ny * minus },
      ];
      const volumePoints = [
        ...footprint.map((point) => ({ ...point, zMm: bottomZMm })),
        ...footprint.map((point) => ({ ...point, zMm: topZMm })),
      ];
      const projectedVolume = volumePoints
        .map((point) => projectSemanticPointToScreen(point, rect))
        .filter((point): point is ScreenPoint => point !== null);
      if (projectedVolume.length < 3) return null;
      const outline = convexHullScreenPoints(projectedVolume);
      if (outline.length < 3) return null;
      const directionZMm = bottomZMm + Math.min(Math.max(800, heightMm * 0.45), heightMm);
      const directionStart = projectSemanticPointToScreen(
        { xMm: actualStart.xMm, yMm: actualStart.yMm, zMm: directionZMm },
        rect,
      );
      const directionEnd = projectSemanticPointToScreen(
        { xMm: actualEnd.xMm, yMm: actualEnd.yMm, zMm: directionZMm },
        rect,
      );
      if (!directionStart || !directionEnd) return null;
      return { outline, directionStart, directionEnd };
    }

    function convexHullScreenPoints(points: ScreenPoint[]): ScreenPoint[] {
      const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
      const cross = (origin: ScreenPoint, a: ScreenPoint, b: ScreenPoint) =>
        (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
      const lower: ScreenPoint[] = [];
      for (const point of sorted) {
        while (
          lower.length >= 2 &&
          cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0
        )
          lower.pop();
        lower.push(point);
      }
      const upper: ScreenPoint[] = [];
      for (let i = sorted.length - 1; i >= 0; i -= 1) {
        const point = sorted[i]!;
        while (
          upper.length >= 2 &&
          cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0
        )
          upper.pop();
        upper.push(point);
      }
      lower.pop();
      upper.pop();
      return [...lower, ...upper];
    }

    function hostedPreviewSegment(
      tool: 'door' | 'window' | 'wall-opening',
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
    } | null {
      const center = projectSemanticPointToScreen(hit.hitPointMm, rect);
      if (!center) return null;
      const previewWidthMm = tool === 'door' ? 900 : tool === 'window' ? 1200 : 1000;
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
      const sillMm = tool === 'window' ? 900 : tool === 'wall-opening' ? 200 : 0;
      const headMm = tool === 'window' ? 2400 : tool === 'wall-opening' ? 2400 : 2100;
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
      return {
        center,
        start: projectSemanticPointToScreen(startMm, rect) ?? undefined,
        end: projectSemanticPointToScreen(endMm, rect) ?? undefined,
        outline,
        auxLines,
        auxArcPath,
        valid: true,
      };
    }

    function clampHostedAlongT(
      tool: 'door' | 'window' | 'wall-opening',
      wall: Extract<Element, { kind: 'wall' }>,
      alongT: number,
    ): number {
      const dx = wall.end.xMm - wall.start.xMm;
      const dy = wall.end.yMm - wall.start.yMm;
      const wallLenMm = Math.max(1, Math.hypot(dx, dy));
      const nominalWidthMm = tool === 'door' ? 900 : tool === 'window' ? 1200 : 1000;
      const edgeClearanceMm = nominalWidthMm / 2 + 80;
      const margin = Math.max(0.02, Math.min(0.18, edgeClearanceMm / wallLenMm));
      return Math.max(margin, Math.min(1 - margin, alongT));
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
          typeof overlay.previewHostAlongT === 'number' &&
          overlay.currentScreen
        ) {
          const distPx = Math.hypot(
            clickScreen.x - overlay.currentScreen.x,
            clickScreen.y - overlay.currentScreen.y,
          );
          const overlayHost = elementsByIdRef.current[overlay.previewHostWallId];
          if (
            distPx <= 20 &&
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
                  previewAuxLines: undefined,
                  previewAuxArcPath: undefined,
                }
              : prev,
          );
          return true;
        }
        alongT = clampHostedAlongT(tool, hostWall, Math.max(0, Math.min(1, alongT)));
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
        useBimStore.getState().select(hostWall.id);
        if (tool === 'door') {
          onSemanticCommand?.({
            type: 'insertDoorOnWall',
            wallId: hostWall.id,
            alongT,
            widthMm: 900,
          });
          setAuthoringOverlay((prev) =>
            prev?.tool === 'door'
              ? {
                  ...prev,
                  previewOutlineScreen: undefined,
                  previewHostValid: true,
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
            widthMm: 1200,
            sillHeightMm: 900,
            heightMm: 1500,
          });
          setAuthoringOverlay((prev) =>
            prev?.tool === 'window'
              ? {
                  ...prev,
                  previewOutlineScreen: undefined,
                  previewHostValid: true,
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
          tool === 'room') &&
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
      let projected = projectPointerToDraftPlane(cx, cy, levelInfo.elevationMm);
      if (
        !projected &&
        tool === 'wall' &&
        lineDraftStart?.tool === 'wall' &&
        lineDraftStart.wallBasis
      ) {
        projected = pointFromWallDraftScreenBasis(cx, cy, lineDraftStart.wallBasis);
      }
      if (!projected && tool === 'wall' && (!lineDraftStart || lineDraftStart.tool !== tool)) {
        const wallAnchor = pickVisibleModelDraftAnchor(cx, cy);
        if (wallAnchor) {
          projected = { point: wallAnchor.point, screen: wallAnchor.screen };
        } else {
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
            wallProjectionMode: 'elevation-axis',
            wallAnchorRequired: true,
          });
          return true;
        }
      }
      if (!projected) return false;
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
      if (LINE_3D_AUTHORING_TOOLS.has(tool)) {
        if (!lineDraftStart || lineDraftStart.tool !== tool) {
          let wallAnchor: ReturnType<typeof pickVisibleModelDraftAnchor> = null;
          let wallDraft =
            tool === 'wall'
              ? createWallDraftScreenBasis(cx, cy, levelInfo.elevationMm, projected)
              : null;
          if (tool === 'wall' && wallDraft?.projection.mode === 'elevation-axis') {
            wallAnchor = pickVisibleModelDraftAnchor(cx, cy);
            if (!wallAnchor) {
              emitWallDebug('wall-blocked-no-visible-anchor', {
                screen: projected.screen,
                planePoint: projected.point,
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
                wallAnchorRequired: true,
              });
              return true;
            }
            wallDraft = createWallDraftScreenBasis(
              cx,
              cy,
              levelInfo.elevationMm,
              projected,
              wallAnchor.point,
            );
          }
          const startPoint = wallDraft?.basis?.originPointMm ?? projected.point;
          lineDraftStart = {
            tool: tool as 'wall' | 'beam' | 'stair' | 'railing' | 'grid' | 'reference-plane',
            levelId: levelInfo.id,
            point: startPoint,
            screen: projected.screen,
            wallBasis: wallDraft?.basis,
            wallProjection: wallDraft?.projection,
            wallAnchorElementId: wallAnchor?.elementId,
          };
          if (tool === 'wall') {
            emitWallDebug('wall-start', {
              screen: projected.screen,
              point: startPoint,
              planePoint: projected.point,
              anchor: wallAnchor,
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
            currentPointMm: startPoint,
            wallFlipActive: tool === 'wall' ? wallFlipNextSegment : undefined,
            wallProjectionMode: tool === 'wall' ? wallDraft?.projection.mode : undefined,
            wallAnchorRequired: false,
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
            emitWallDebug('wall-short-segment-reset', {
              start,
              end,
              startScreen: lineDraftStart.screen,
              endScreen: lineProjected.screen,
              lengthMm: Math.hypot(end.xMm - start.xMm, end.yMm - start.yMm),
            });
          }
          lineDraftStart = null;
          setAuthoringOverlay({ tool, phase: 'pick-start', levelName: levelInfo.name });
          return true;
        }
        if (tool === 'wall') {
          const runtime = useBimStore.getState();
          const flip = wallFlipNextSegment;
          const effectiveLocationLine = flip
            ? flipWallLocationLine(runtime.wallLocationLine)
            : runtime.wallLocationLine;
          const actualStart = start;
          const actualEnd = end;
          const command = {
            type: 'createWall' as const,
            id: `wall-3d-${Date.now().toString(36)}-${Math.round(Math.random() * 1_000_000).toString(36)}`,
            levelId,
            start: actualStart,
            end: actualEnd,
            locationLine: effectiveLocationLine,
            wallTypeId: runtime.activeWallTypeId ?? undefined,
            heightMm: runtime.wallDrawHeightMm,
          };
          emitWallDebug('wall-commit', {
            command,
            startScreen: lineDraftStart.screen,
            endScreen: lineProjected.screen,
            projection: lineDraftStart.wallProjection,
            basis: lineDraftStart.wallBasis,
            lengthMm: Math.hypot(actualEnd.xMm - actualStart.xMm, actualEnd.yMm - actualStart.yMm),
          });
          lineDraftStart = null;
          wallFlipNextSegment = false;
          onSemanticCommand?.(command);
        } else {
          lineDraftStart = null;
          if (tool === 'beam') {
            onSemanticCommand?.({
              type: 'createBeam',
              levelId,
              startMm: start,
              endMm: end,
            });
          } else if (tool === 'stair') {
            const levels = resolveDraftLevels();
            const baseIndex = levels.findIndex((level) => level.id === levelId);
            const topLevel = baseIndex >= 0 ? levels[baseIndex + 1] : undefined;
            onSemanticCommand?.({
              type: 'createStair',
              baseLevelId: levelId,
              topLevelId: topLevel?.id ?? levelId,
              runStartMm: start,
              runEndMm: end,
              widthMm: 1100,
              riserMm: 175,
              treadMm: 275,
            });
          } else if (tool === 'railing') {
            onSemanticCommand?.({
              type: 'createRailing',
              pathMm: [
                { xMm: start.xMm, yMm: start.yMm },
                { xMm: end.xMm, yMm: end.yMm },
              ],
            });
          } else if (tool === 'grid') {
            onSemanticCommand?.({
              type: 'createGridLine',
              levelId,
              start: { xMm: start.xMm, yMm: start.yMm },
              end: { xMm: end.xMm, yMm: end.yMm },
            });
          } else if (tool === 'reference-plane') {
            onSemanticCommand?.({
              type: 'createReferencePlane',
              levelId,
              startMm: { xMm: start.xMm, yMm: start.yMm },
              endMm: { xMm: end.xMm, yMm: end.yMm },
            });
          }
        }
        setAuthoringOverlay({
          tool,
          phase: 'pick-start',
          levelName: levelInfo.name,
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
              onSemanticCommand?.({
                type: 'createCeiling',
                levelId: polygonDraft.levelId,
                boundaryMm: polygonDraft.points.map((p) => ({ xMm: p.xMm, yMm: p.yMm })),
              });
            } else if (tool === 'floor') {
              onSemanticCommand?.({
                type: 'createFloor',
                levelId: polygonDraft.levelId,
                boundaryMm: polygonDraft.points.map((p) => ({ xMm: p.xMm, yMm: p.yMm })),
              });
            } else if (tool === 'roof') {
              onSemanticCommand?.({
                type: 'createRoof',
                referenceLevelId: polygonDraft.levelId,
                footprintMm: polygonDraft.points.map((p) => ({ xMm: p.xMm, yMm: p.yMm })),
              });
            } else if (tool === 'area') {
              onSemanticCommand?.({
                type: 'createArea',
                levelId: polygonDraft.levelId,
                boundaryMm: polygonDraft.points.map((p) => ({ xMm: p.xMm, yMm: p.yMm })),
                ruleSet: 'no_rules',
                areaScheme: 'gross_building',
                applyAreaRules: true,
              });
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
      if (!dragMoved && wasDragging === 'orbit') {
        pick(ev.clientX, ev.clientY);
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
    }

    function onMove(ev: PointerEvent): void {
      const directTool = activeDirect3dTool();
      if (
        directTool &&
        (LINE_3D_AUTHORING_TOOLS.has(directTool) ||
          POLYGON_3D_AUTHORING_TOOLS.has(directTool) ||
          directTool === 'column' ||
          directTool === 'room')
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
          const projected = projectPointerToDraftPlane(
            ev.clientX,
            ev.clientY,
            levelInfo.elevationMm,
          );
          if (projected) {
            if (LINE_3D_AUTHORING_TOOLS.has(directTool) && !lineDraftStart) {
              let currentScreen = projected.screen;
              let currentPointMm: { xMm: number; yMm: number } | undefined = projected.point;
              let wallProjectionMode: WallDraftProjectionMode | undefined;
              let wallAnchorRequired = false;
              if (directTool === 'wall') {
                const wallDraft = createWallDraftScreenBasis(
                  ev.clientX,
                  ev.clientY,
                  levelInfo.elevationMm,
                  projected,
                );
                wallProjectionMode = wallDraft.projection.mode;
                if (wallDraft.projection.mode === 'elevation-axis') {
                  const anchor = pickVisibleModelDraftAnchor(ev.clientX, ev.clientY);
                  wallAnchorRequired = !anchor;
                  currentScreen = anchor?.screen ?? projected.screen;
                  currentPointMm = anchor?.point;
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
                      wallProjectionMode,
                      wallAnchorRequired,
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
                      currentScreen: projected.screen,
                      currentPointMm: projected.point,
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
                      currentScreen: projected.screen,
                      currentPointMm: projected.point,
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
                    wallProjectionMode: 'elevation-axis',
                    wallAnchorRequired: true,
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
        const projected = levelInfo
          ? lineDraftStart.tool === 'wall' && lineDraftStart.wallBasis
            ? pointFromWallDraftScreenBasis(ev.clientX, ev.clientY, lineDraftStart.wallBasis)
            : projectPointerToDraftPlane(ev.clientX, ev.clientY, levelInfo.elevationMm)
          : null;
        setAuthoringOverlay((prev) =>
          prev?.phase === 'pick-end'
            ? prev.tool === 'wall' && lineDraftStart && projected && levelInfo
              ? (() => {
                  const preview = wallDraftPreview(
                    lineDraftStart.point,
                    projected.point,
                    levelInfo.elevationMm,
                    useBimStore.getState().wallDrawHeightMm,
                    wallFlipNextSegment,
                    useBimStore.getState().wallLocationLine,
                    resolveDraftWallThicknessMm(),
                    rect,
                  );
                  emitWallDebug('wall-preview', {
                    start: lineDraftStart.point,
                    end: projected.point,
                    startScreen: lineDraftStart.screen,
                    endScreen: projected.screen,
                    projection: lineDraftStart.wallProjection,
                    basis: lineDraftStart.wallBasis,
                    lengthMm: Math.hypot(
                      projected.point.xMm - lineDraftStart.point.xMm,
                      projected.point.yMm - lineDraftStart.point.yMm,
                    ),
                    preview,
                  });
                  return {
                    ...prev,
                    currentScreen: projected.screen,
                    currentPointMm: projected.point,
                    wallFlipActive: wallFlipNextSegment,
                    wallProjectionMode: lineDraftStart.wallProjection?.mode,
                    wallPreviewOutlineScreen: preview?.outline,
                    wallPreviewDirectionStartScreen: preview?.directionStart,
                    wallPreviewDirectionEndScreen: preview?.directionEnd,
                  };
                })()
              : {
                  ...prev,
                  currentScreen: {
                    x: ev.clientX - rect.left,
                    y: ev.clientY - rect.top,
                  },
                  currentPointMm: projected?.point,
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
        const rect = renderer.domElement.getBoundingClientRect();
        setAuthoringOverlay((prev) =>
          prev?.tool === directTool
            ? {
                ...prev,
                currentScreen: {
                  x: ev.clientX - rect.left,
                  y: ev.clientY - rect.top,
                },
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
      if (ev.key === 'Escape') {
        const tool = activeDirect3dTool();
        if (tool && LINE_3D_AUTHORING_TOOLS.has(tool)) {
          if (lineDraftStart && lineDraftStart.tool === tool) {
            lineDraftStart = null;
            wallFlipNextSegment = false;
            setAuthoringOverlay((prev) =>
              prev ? { tool, phase: 'pick-start', levelName: prev.levelName } : prev,
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
      const materialElement =
        el.materialKey && elementsByIdRef.current[el.materialKey]?.kind === 'material'
          ? (elementsByIdRef.current[el.materialKey] as Extract<Element, { kind: 'material' }>)
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
        oc.position.copy(persp.position);
        oc.up.copy(persp.up);
        const snap = cameraRigRef.current.snapshot();
        oc.lookAt(snap.target.x, snap.target.y, snap.target.z);
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
    camera.position.set(snap.position.x, snap.position.y, snap.position.z);
    camera.up.set(snap.up.x, snap.up.y, snap.up.z).normalize();
    camera.lookAt(snap.target.x, snap.target.y, snap.target.z);
    const orthoCamera = orthoCameraRef.current;
    if (orthoCamera) {
      orthoCamera.position.copy(camera.position);
      orthoCamera.up.copy(camera.up);
      orthoCamera.lookAt(snap.target.x, snap.target.y, snap.target.z);
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

    // Remove stale meshes — dispose GPU resources to avoid leaks.
    for (const id of toRemove) {
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
    const planes = clippingPlanesRef.current;

    // DSC-V3-02 — resolve lens filter from the UI dropdown stored in global state.
    const lensFilter = lensFilterFromMode(lensMode);
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
            const sx = e.start.xMm / 1000;
            const sz = e.start.yMm / 1000;
            const dx = e.end.xMm / 1000 - sx;
            const dz = e.end.yMm / 1000 - sz;
            const len = Math.max(0.001, Math.hypot(dx, dz));
            const height = THREE.MathUtils.clamp(e.heightMm / 1000, 0.25, 40);
            const thick = THREE.MathUtils.clamp(e.thicknessMm / 1000, 0.05, 2);
            const nonce = ++csgNonceRef.current;
            pendingCsgRef.current.set(id, nonce);
            pendingCsgMetaRef.current.set(id, { len, height, thick, materialKey: e.materialKey });
            const job: CsgRequest = {
              jobId: id,
              nonce,
              len,
              height,
              thick,
              wcx: sx + dx / 2,
              wcy: elev + height / 2,
              wcz: sz + dz / 2,
              yaw: Math.atan2(dz, dx),
              doors: doors.map((d) => ({
                widthMm: d.widthMm,
                alongT: d.alongT,
                wallHeightMm: e.heightMm,
              })),
              windows: wins.map((w) => {
                const outlineKind = w.outlineKind ?? 'rectangle';
                let outlinePolygonMm: { xMm: number; yMm: number }[] | undefined = undefined;
                if (outlineKind !== 'rectangle') {
                  const poly = resolveWindowOutline(w, e, curr);
                  if (poly && poly.length >= 3) outlinePolygonMm = poly;
                }
                return {
                  widthMm: w.widthMm,
                  heightMm: w.heightMm,
                  sillHeightMm: w.sillHeightMm,
                  alongT: w.alongT,
                  wallHeightMm: e.heightMm,
                  ...(outlinePolygonMm ? { outlinePolygonMm } : {}),
                };
              }),
              wallOpenings: wallOps.map((wo) => ({
                alongTStart: wo.alongTStart,
                alongTEnd: wo.alongTEnd,
                sillHeightMm: wo.sillHeightMm,
                headHeightMm: wo.headHeightMm,
                wallHeightMm: e.heightMm,
              })),
            };
            csgWorkerRef.current?.postMessage(job);
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
          obj = makeDoorMesh(e, wall, elevationMForLevel(wall.levelId, curr), paint);
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
          const { mesh } = buildMassMesh(e, lvl);
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
            cam.position.set(snap.position.x, snap.position.y, snap.position.z);
            cam.up.set(snap.up.x, snap.up.y, snap.up.z).normalize();
            cam.lookAt(snap.target.x, snap.target.y, snap.target.z);
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

    // Re-sync outline pass in case the selected element's mesh was just replaced.
    const op = outlinePassRef.current;
    if (op) {
      const sid = selectedIdRef.current;
      const sel = sid ? cache.get(sid) : undefined;
      op.selectedObjects = sel ? [sel] : [];
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
    lensMode,
    theme,
    text3dRebuildTick,
  ]);

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
              map: origStd.map,
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
          if (child.material instanceof THREE.MeshStandardMaterial) {
            child.material.wireframe = false;
            if (viewerRenderStyle === 'realistic' || viewerRenderStyle === 'ray-trace') {
              child.material.flatShading = false;
            }
            child.material.needsUpdate = true;
          }
        }
      });
    }
  }, [viewerRenderStyle]);

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
    const sel = selectedId ? bimPickMapRef.current.get(selectedId) : undefined;
    op.selectedObjects = sel ? [sel] : [];
  }, [selectedId]);

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
        const dir = new THREE.Vector3();
        cam.getWorldDirection(dir);
        const yaw = Math.atan2(dir.x, dir.z);
        wc.teleport({ x: cam.position.x, y: cam.position.y, z: cam.position.z }, yaw);
        cam.fov = 75;
        cam.updateProjectionMatrix();
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
        camera.position.set(next.position.x, next.position.y, next.position.z);
        camera.up.set(next.up.x, next.up.y, next.up.z).normalize();
        camera.lookAt(next.target.x, next.target.y, next.target.z);
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
    camera.position.set(snap.position.x, snap.position.y, snap.position.z);
    camera.up.set(snap.up.x, snap.up.y, snap.up.z).normalize();
    camera.lookAt(snap.target.x, snap.target.y, snap.target.z);
    setCurrentAzimuth(snap.azimuth);
    setCurrentElevation(snap.elevation);
  }, []);

  const direct3dAuthoringActive =
    !walkActive && DIRECT_3D_AUTHORING_TOOLS.has(planTool as Direct3dAuthoringTool);

  const overlayTitleInstruction = useMemo((): { title: string; instruction: string } | null => {
    if (!direct3dAuthoringActive || !authoringOverlay) return null;
    if (
      draftPlaneAngleWarning &&
      (LINE_3D_AUTHORING_TOOLS.has(authoringOverlay.tool) ||
        POLYGON_3D_AUTHORING_TOOLS.has(authoringOverlay.tool) ||
        authoringOverlay.tool === 'column' ||
        authoringOverlay.tool === 'room')
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
      const elevationAxisMode = authoringOverlay.wallProjectionMode === 'elevation-axis';
      return {
        title: `Wall placement · ${authoringOverlay.levelName ?? 'Active level'}`,
        instruction:
          authoringOverlay.phase === 'pick-start'
            ? authoringOverlay.wallAnchorRequired
              ? 'Move over visible model geometry to start. Empty sky is not a valid 3D wall anchor.'
              : 'Click start point. Alt+drag or middle mouse to orbit/pan.'
            : elevationAxisMode
              ? `Elevation-axis mode: click end point horizontally; vertical cursor movement is ignored. Space flips side (${
                  authoringOverlay.wallFlipActive ? 'flipped' : 'default'
                }). Esc cancels segment.`
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
    if (authoringOverlay.tool === 'room') {
      return {
        title: `Room placement · ${authoringOverlay.levelName ?? 'Active level'}`,
        instruction: 'Click inside a closed boundary to place a room.',
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
    if (authoringOverlay.tool === 'door') {
      return {
        title: 'Door placement',
        instruction:
          authoringOverlay.previewHostValid === false
            ? `Move over a wall to see a valid host preview, then click to place. L ${
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
            ? `Move over a wall to see a valid host preview, then click to place. L ${
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
          ? `Move over a wall to see a valid host preview, then click to place. L ${
              authoringOverlay.previewHostLock ? 'unlocks' : 'locks'
            } host.`
          : `Hover a wall to preview, then click to insert an opening. L ${
              authoringOverlay.previewHostLock ? 'unlocks' : 'locks'
            } host.`,
    };
  }, [authoringOverlay, direct3dAuthoringActive, draftPlaneAngleWarning]);

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
      <div className="pointer-events-auto absolute right-6 top-6 z-20">
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

      {direct3dAuthoringActive &&
        authoringOverlay &&
        (LINE_3D_AUTHORING_TOOLS.has(authoringOverlay.tool) &&
        authoringOverlay.phase === 'pick-end' &&
        authoringOverlay.startScreen &&
        authoringOverlay.currentScreen ? (
          <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full">
            {authoringOverlay.tool !== 'wall' ? (
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
            ) : null}
            {authoringOverlay.tool === 'wall' &&
            authoringOverlay.wallPreviewOutlineScreen &&
            authoringOverlay.wallPreviewOutlineScreen.length >= 4 ? (
              <>
                <polygon
                  points={authoringOverlay.wallPreviewOutlineScreen
                    .map((p) => `${p.x},${p.y}`)
                    .join(' ')}
                  fill="color-mix(in srgb, var(--color-accent) 14%, transparent)"
                  stroke="var(--color-accent)"
                  strokeWidth="2"
                  opacity="0.9"
                />
                {authoringOverlay.wallPreviewDirectionStartScreen &&
                authoringOverlay.wallPreviewDirectionEndScreen ? (
                  <line
                    x1={authoringOverlay.wallPreviewDirectionStartScreen.x}
                    y1={authoringOverlay.wallPreviewDirectionStartScreen.y}
                    x2={authoringOverlay.wallPreviewDirectionEndScreen.x}
                    y2={authoringOverlay.wallPreviewDirectionEndScreen.y}
                    stroke="var(--color-accent)"
                    strokeWidth="2"
                    markerEnd="url(#wall-direction-arrow)"
                    opacity="0.9"
                  />
                ) : null}
              </>
            ) : null}
            <circle
              cx={authoringOverlay.startScreen.x}
              cy={authoringOverlay.startScreen.y}
              r="6"
              fill="var(--color-accent)"
              opacity="0.95"
            />
            <defs>
              <marker
                id="wall-direction-arrow"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <path d="M0,0 L8,4 L0,8 z" fill="var(--color-accent)" />
              </marker>
            </defs>
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
                stroke="var(--color-accent)"
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
                stroke="var(--color-accent)"
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
