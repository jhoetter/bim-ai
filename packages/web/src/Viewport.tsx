/* eslint-disable bim-ai/no-hex-in-chrome -- pre-v3 hex literals; remove when this file is migrated in B4 Phase 2 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as THREE from 'three';
import type { CsgResponse } from './viewport/csgWorker';
import { recordViewportFrame } from './viewport/viewportFrameStats';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';

import { parseDimensionInput, type Element, type LensMode, type SavedViewElem } from '@bim-ai/core';
import type { OrbitViewpointPersistFieldPayload } from './OrbitViewpointPersistedHud';

import { useBimStore, type PlanTool } from './state/store';
import { useRenderCount } from './state/renderCountProbe';
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
import { SectionBox } from './viewport/sectionBox';
import { WalkController, classifyKey as classifyWalkKey } from './viewport/walkMode';
import {
  readToken,
  readColorToken,
  sunPositionFromAzEl,
  buildSkyEnvMap,
  addEdges,
} from './viewport/sceneHelpers';
// PERF-I05 — accelerate viewport raycast picking via three-mesh-bvh.
// `installBvhExtensions` patches THREE.Mesh.prototype.raycast once at module
// init; the ensure/dispose helpers gate BVH builds on the static element
// meshes used by hover/click picking.
import {
  disposeBvhForObject,
  ensureBvhForPickables,
  installBvhExtensions,
} from './viewport/bvhRegistry';

installBvhExtensions();
import {
  type WallElem,
  CSG_ENABLED,
  elevationMForLevel,
  makeFloorSlabMesh,
  buildExcavationMesh,
  makeRoofJoinPreviewMesh,
  makeRoofMassMesh,
  makeStairVolumeMesh,
  makeWallMesh,
  makeCurtainWallMesh,
  makeDoorMesh,
  makeWindowMesh,
  makeRoomRibbon,
  makeBalconyMesh,
  makeFacadeBayMesh,
  makeStructuralFacadeGridMesh,
  makeRailingMesh,
  makeSiteMesh,
  makeToposolidMesh,
  makeColumnMesh,
  makeBeamMesh,
  makeCeilingMesh,
  wallPlanOffsetM,
  wallVerticalSpanM,
  wallFaceKindForMaterialIndex,
  spotElevationThree,
} from './viewport/meshBuilders';
import { makeOsmContextGroup } from './viewport/meshBuilders.osmContext';
import { fetchOsmContext } from './osm/fetchOverpass';
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
import { makeBeamSystemMesh } from './viewport/meshBuilders.beamSystem';
import { makeBraceMesh } from './viewport/meshBuilders.brace';
import {
  buildConicalRoofMesh,
  buildDomeRoofMesh,
  buildSpireRoofMesh,
} from './viewport/meshBuilders.coneRoof';
import { buildFamilyBlendMesh } from './viewport/meshBuilders.familyBlend';
import { buildFamilySweepMesh } from './viewport/meshBuilders.familySweep';
import { buildGradedRegionMesh } from './viewport/meshBuilders.gradedRegion';
import { makeMassBoxMesh } from './viewport/meshBuilders.massBox';
import { makeMassExtrusionMesh } from './viewport/meshBuilders.massExtrusion';
import { makeMassRevolutionMesh } from './viewport/meshBuilders.massRevolution';
import { isElementVisibleUnderPhaseFilter } from './viewport/phaseFilter';
import { applyDormerCutsToRoofGeom } from './viewport/dormerRoofCut';
import { buildRoofJoinUnionGeometry } from './viewport/roofJoinCsg';
import { registerDormerCutFn, registerRoofJoinUnionFn } from './viewport/meshBuilders';
import {
  activeComponentAssetId,
  activeComponentFamilyTypeId,
} from './workspace/authoring/OptionsBar';
import { gripsFor, type Grip3dDescriptor } from './viewport/grip3d';
import { Drag3dController } from './viewport/Drag3dController';
import { computeSunPositionNoaa } from './viewport/sunPositionNoaa';
import { useSunStore } from './sunStore';
import {
  GDO_STORAGE_KEYS,
  applyModelEdgeDisplay,
  applyRenderRole,
  csgBaseFootprintsForWall,
  csgWallSurfaceMaterialKey,
  disposeObject3D,
  normalizeExposureEv,
  readStoredBoolean,
  readStoredEdgeWidth,
  readStoredExposureEv,
  sectionBoxFaceAxisKey,
  sectionBoxFaceAxisNormal,
  updateSectionBoxHandles,
  type ViewerGdoRuntimeState,
} from './viewport/ViewportRuntimeHelpers';
import { buildGripMeshes, type GripMeshHandle } from './viewport/grip3dRenderer';
import { makePlacedAssetMesh } from './viewport/placedAssetRendering';
import { makeFamilyInstanceMesh } from './viewport/familyInstance3d';
import { applyCsgWallFaceMaterialGroups, makeCsgWallMaterial } from './viewport/csgWallMaterial';
import { materialDependencyDirtyIds } from './viewport/materialDependencyInvalidation';
import { applyTextureVisibilityToMesh } from './viewport/visualStyleMaterials';
import {
  isRasterHighFidelityRenderStyle,
  isTextureRichRenderStyle,
  normalizeViewerRenderStyle,
} from './viewport/renderStyles';
// Side-effect import: registers floor/roof/column/beam/door/window 3D grip providers.
import './viewport/grip3dProviders';
import type { WallFaceRadialMenuOpen } from './viewport/wallFaceRadialMenu';
import { buildPlanOverlay3dGroup } from './viewport/planOverlay3d';
import { shouldRunWallOpeningCsg } from './viewport/wallCsgEligibility';
import { wallWith3dJoinDisallowGaps } from './viewport/wallJoinDisplay';
import {
  buildLinePreviewPayload,
  resizeLinePreviewToLength,
  classifyWallDraftProjection,
  isDraftPlaneHitOccluded,
  projectSceneRayToLevelPlaneMm,
  resolve3dDraftLevel,
  snapDraftPointToGrid,
  validateWorkPlane3d,
  type Authoring3dSnapKind,
  type WallDraftProjectionClassification,
  type WallDraftProjectionMode,
} from './viewport/authoring3d';
import {
  isLinkedElementId,
  shouldBypassLevelDatumPickForDirectAuthoring,
  shouldCommitHostedPlacementOnPointerUp,
} from './viewport/directAuthoringGuards';
import { flipWallLocationLineSide, snapWallPointToConnectivity } from './geometry/wallConnectivity';
import { buildGroupInstance3d } from './viewport/groupInstance3d';
import { useViewportCameraOrientation } from './viewport/useViewportCameraOrientation';
import { useViewportCommandHandlers } from './viewport/useViewportCommandHandlers';
import { useViewportOverlayControls } from './viewport/useViewportOverlayControls';
import { useViewportSceneEffects } from './viewport/useViewportSceneEffects';
import { useViewportViewCubeHandlers } from './viewport/useViewportViewCubeHandlers';
import {
  initialWalkthroughState,
  reduceWalkthrough,
  type WalkthroughState,
} from './tools/toolGrammar';
import {
  DIRECT_3D_AUTHORING_TOOLS,
  LINE_3D_AUTHORING_TOOLS,
  POLYGON_3D_AUTHORING_TOOLS,
  ViewportOverlays,
  type Authoring3dOverlayState,
  type Direct3dAuthoringTool,
  type ScreenPoint,
} from './viewport/ViewportOverlays';
import {
  createDirect3dToolDraftState,
  createDirect3dToolHelpers,
  type DraftPlaneProjection,
  type WallDraftScreenBasis,
} from './viewport/direct3dToolHelpers';

// KRN-14 — wire the CSG cut into meshBuilders. Side-effect at module load.
registerDormerCutFn(applyDormerCutsToRoofGeom);
// MF-rendering-X (#65) — wire the roof-join CSG union into meshBuilders so
// Zwerchgiebel renders as a continuous merged solid in the browser. Tests
// that import meshBuilders directly leave this null and degrade to the
// seam-line preview.
registerRoofJoinUnionFn(buildRoofJoinUnionGeometry);

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

export function Viewport({
  wsConnected,
  onSemanticCommand,
  remoteSelections,
  lensMode,
  activePlanTool,
  snapSettings,
  viewOverlayRightInset,
}: Props) {
  // PERF-G07: dev-only render-count probe. No-op in production.
  useRenderCount('Viewport');
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
  const requestViewportRenderRef = useRef<(() => void) | null>(null);
  /** Live paint bundle for the rendered scene. Rebuilt on theme change. */
  const paintBundleRef = useRef<ViewportPaintBundle | null>(null);
  const wallDraftPreviewGroupRef = useRef<THREE.Object3D | null>(null);
  const levelDatumGroupRef = useRef<THREE.Group | null>(null);
  const osmContextGroupRef = useRef<THREE.Group | null>(null);
  const groupInstanceGroupRef = useRef<THREE.Group | null>(null);
  const osmVisible = useBimStore((s) => s.osmVisible);
  const osmLayerHidden = useBimStore((s) => s.osmLayerHidden);
  const setOsmStatus = useBimStore((s) => s.setOsmStatus);
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
        wall?: WallElem;
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

  const { currentAzimuth, currentElevation, syncCameraOrientationState } =
    useViewportCameraOrientation();
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
  const savedViewLockedRef = useRef(false);
  const sectionBoxRef = useRef<SectionBox | null>(null);
  const sectionBoxCageRef = useRef<THREE.LineSegments | null>(null);
  const sectionBoxHandleGroupRef = useRef<THREE.Group | null>(null);
  const sectionBoxPrevActiveRef = useRef(false);
  const clipCapsRef = useRef<THREE.Mesh[]>([]);

  const elementsById = useBimStore((s) => s.elementsById);
  // ANN-02: ref-copy so the 3D contextmenu listener (registered once in the
  // mount effect) sees up-to-date elements without rerunning that effect.
  const elementsByIdRef = useRef(elementsById);
  elementsByIdRef.current = elementsById;
  const groupRegistry = useBimStore((s) => s.groupRegistry);
  const theme = useTheme();
  // PERF-G05: read derived indices instead of scanning Object.values per memo.
  const projectSettings = useBimStore((s) => s.modelIndices.projectSettings);
  const levelsIndex = useBimStore((s) => s.modelIndices.levels);
  const wallsByLevelIndex = useBimStore((s) => s.modelIndices.wallsByLevel);
  const wallsByLevelRef = useRef(wallsByLevelIndex);
  wallsByLevelRef.current = wallsByLevelIndex;

  // Serialised key — only changes when georeference VALUES change, not on every elementsById ref update.
  const georeferenceKey = useMemo(() => {
    const g = projectSettings?.georeference ?? null;
    if (!g) return null;
    return `${g.anchorLat}:${g.anchorLon}:${g.bboxNorth ?? g.contextRadiusM ?? ''}:${g.bboxSouth ?? ''}:${g.bboxEast ?? ''}:${g.bboxWest ?? ''}`;
  }, [projectSettings]);

  const georeference = useMemo(() => {
    return projectSettings?.georeference ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [georeferenceKey]); // stable: only recalculates when values actually change

  const walkLevels = useMemo(
    () => levelsIndex.map((e) => e.elevationMm / 1000).sort((a, b) => a - b),
    [levelsIndex],
  );
  const walkLevelsRef = useRef<number[]>([]);
  walkLevelsRef.current = walkLevels;

  const selectedId = useBimStore((s) => s.selectedId);
  const selectedIds = useBimStore((s) => s.selectedIds);
  selectedIdRef.current = selectedId;
  selectedIdsRef.current = selectedIds;

  const activeSavedView = useMemo(() => {
    if (!selectedId) return null;
    const el = elementsById[selectedId];
    return el?.kind === 'saved_view' ? (el as SavedViewElem) : null;
  }, [selectedId, elementsById]);
  const viewLocked = useBimStore((s) => s.viewLocked);
  const setViewLocked = useBimStore((s) => s.setViewLocked);
  const savedViewLocked = activeSavedView?.isLocked === true || viewLocked;
  savedViewLockedRef.current = savedViewLocked;
  const setActiveLevelId = useBimStore((s) => s.setActiveLevelId);
  const storePlanTool = useBimStore((s) => s.planTool);
  const planTool = activePlanTool ?? storePlanTool;
  const activeLevelId = useBimStore((s) => s.activeLevelId);
  const [authoringOverlay, setAuthoringOverlay] = useState<Authoring3dOverlayState | null>(null);
  const [draftPlaneAngleWarning, setDraftPlaneAngleWarning] = useState(false);
  const [skyPanelOpen, setSkyPanelOpen] = useState(false);
  const [renderQualityOpen, setRenderQualityOpen] = useState(false);
  // §1.6.12: split plan/3D view toggle
  const splitViewEnabled = useBimStore((s) => s.splitViewEnabled);
  const draftPlaneAngleWarningRef = useRef(draftPlaneAngleWarning);
  draftPlaneAngleWarningRef.current = draftPlaneAngleWarning;
  const planToolRef = useRef(planTool);
  const activeLevelIdRef = useRef(activeLevelId);
  planToolRef.current = planTool;
  activeLevelIdRef.current = activeLevelId;
  const walkthroughStateRef = useRef<WalkthroughState>(initialWalkthroughState());
  const authoringOverlayRef = useRef<Authoring3dOverlayState | null>(null);
  authoringOverlayRef.current = authoringOverlay;
  // ANN-02: store actions for the wall context menu's command flow.
  const activateElevationView = useBimStore((s) => s.activateElevationView);
  const selectStoreEl = useBimStore((s) => s.select);
  const onSemanticCommandRef = useRef(onSemanticCommand);
  onSemanticCommandRef.current = onSemanticCommand;

  const { handleGripCommand, handleWallContextMenuCommand, handleWallFaceRadialCommand } =
    useViewportCommandHandlers({
      activateElevationView,
      onSemanticCommand,
      onSemanticCommandRef,
      selectStoreEl,
    });
  // Keep a ref-copy so the mount-effect closure (registered once) reads
  // the latest dispatcher.
  const handleGripCommandRef = useRef(handleGripCommand);
  handleGripCommandRef.current = handleGripCommand;

  const direct3dDraftLevelName = useMemo(() => {
    const levels = levelsIndex.map((level) => ({
      id: level.id,
      elevationMm: level.elevationMm,
      name: level.name,
    }));
    const resolved = resolve3dDraftLevel(levels, activeLevelId);
    const resolvedName = resolved ? levels.find((level) => level.id === resolved.id)?.name : null;
    return resolvedName ?? 'Active level';
  }, [activeLevelId, levelsIndex]);

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
      daylightSavingStrategy: s.daylightSavingStrategy ?? undefined,
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
  const viewerRenderStyleRaw = useBimStore((s) => s.viewerRenderStyle);
  const viewerRenderStyle = normalizeViewerRenderStyle(viewerRenderStyleRaw);
  const viewerBackground = useBimStore((s) => s.viewerBackground);
  const viewerEdges = useBimStore((s) => s.viewerEdges);
  const skyBackground = useBimStore((s) => s.skyBackground);
  const skyBackgroundColor = useBimStore((s) => s.skyBackgroundColor);
  const renderQuality = useBimStore((s) => s.renderQuality);
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
    renderer.domElement.setAttribute('data-testid', 'orbit-3d-canvas');
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
          // PERF-I05 — release the BVH before the geometry it indexes.
          disposeBvhForObject(existing);
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
          scheduleViewportRender();
        }
        return;
      }

      // Reconstruct BufferGeometry from transferable arrays.
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(data.position, 3));
      if (data.normal) geom.setAttribute('normal', new THREE.BufferAttribute(data.normal, 3));
      if (data.uv) geom.setAttribute('uv', new THREE.BufferAttribute(data.uv, 2));
      if (data.index) geom.setIndex(new THREE.BufferAttribute(data.index, 1));
      if (csgMeta?.wall) {
        applyCsgWallFaceMaterialGroups(geom, {
          lenM: csgMeta.len,
          heightM: csgMeta.height,
          thickM: csgMeta.thick,
        });
      }

      const renderStyleNow = viewerRenderStyleRef.current;
      const { material: wallMat } = makeCsgWallMaterial({
        materialKey: csgMeta?.materialKey,
        wall: csgMeta?.wall,
        paint: paintBundleRef.current,
        elementsById: elementsByIdRef.current,
        lenM: csgMeta?.len ?? 1,
        heightM: csgMeta?.height ?? 1,
        textureMapsVisible: isTextureRichRenderStyle(renderStyleNow),
      });

      const mesh = new THREE.Mesh(geom, wallMat);
      mesh.position.set(data.wcx, data.wcy, data.wcz);
      mesh.rotation.y = data.yaw;
      mesh.userData.bimPickId = data.jobId;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      applyRenderRole(mesh, 'model');
      // MF-cosmetic (issue #9): match meshBuilders.makeWallMesh — 30° edge
      // threshold suppresses CSG triangulation seams on the async-loaded
      // cut wall geometry so the worker swap-in doesn't look "sketched".
      addEdges(mesh, 30);
      applyModelEdgeDisplay(mesh, viewerEdgesRef.current, viewerSilhouetteEdgeWidthRef.current);
      applyClippingPlanesToMeshes(mesh, clippingPlanesRef.current);

      if (existing) {
        rootNow.remove(existing);
        // PERF-I05 — release the BVH before the geometry it indexes.
        disposeBvhForObject(existing);
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
      scheduleViewportRender();

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
    // REF-CQ-03 — drag/inertia/tool-draft/grip/section-box state lives on
    // a dedicated controller (`Drag3dController`) so the state machine is
    // independently unit-testable. Mutable public fields preserve the
    // closure-driven assignment pattern used by the pointer handlers below.
    const drag = new Drag3dController();
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let viewportRenderFrameQueued = false;
    let viewportRenderDisposed = false;
    let lastFrameMs = performance.now();

    function shouldAnimateViewport(): boolean {
      return walkController.snapshot().active || drag.hasMotion();
    }

    function scheduleViewportRender(): void {
      if (viewportRenderDisposed || viewportRenderFrameQueued) return;
      viewportRenderFrameQueued = true;
      rafRef.current = requestAnimationFrame(tick);
    }

    requestViewportRenderRef.current = scheduleViewportRender;
    // Mutable draft state shared between the in-place pointer handlers and the
    // 3D-authoring-tool click dispatcher (extracted to direct3dToolHelpers.ts).
    const draftState = createDirect3dToolDraftState();

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

    function placeCamera(orientationSync: 'defer' | 'immediate' = 'defer'): void {
      const snap = rig.snapshot();
      applySceneCameraPose(camera, snap);
      syncCameraOrientationState(snap, orientationSync);
      const oc = orthoCameraRef.current;
      if (oc) {
        // Issue #59: the ortho camera position must mirror the perspective
        // pose, *and* its frustum extents must scale with the rig radius —
        // otherwise a viewpoint applied after mount (any cardinal ortho
        // capture URL) ends up positioned correctly but framed against a
        // stale frustum sized for the rig's default radius=16 m, which
        // crops the model and (combined with SSAO mis-projection) renders
        // E/S/N captures as opaque black silhouettes.
        const rendererEl = rendererRef.current?.domElement;
        const w = rendererEl?.clientWidth || 1;
        const h = rendererEl?.clientHeight || 1;
        const frustum = rig.orthoFrustum(w / h);
        oc.left = frustum.left;
        oc.right = frustum.right;
        oc.top = frustum.top;
        oc.bottom = frustum.bottom;
        oc.near = frustum.near;
        oc.far = frustum.far;
        oc.updateProjectionMatrix();
        mirrorSceneCameraPose(camera, oc, snap.target);
      }
      scheduleViewportRender();
    }

    placeCamera('immediate');

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
        placeCamera('immediate');
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
      // PERF-I05 — lazy BVH build on static pickable meshes; idempotent
      // after the first call so the per-click cost decays to a scene walk.
      ensureBvhForPickables(root);
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
      // PERF-I05 — same BVH preflight as the click/hover paths.
      ensureBvhForPickables(root);
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
          (wallsByLevelRef.current[levelInfo.id] ?? []) as readonly WallElem[],
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

    function tintWallDraftPreviewObject(object: THREE.Object3D, overrideColor?: string): void {
      const accent = overrideColor ?? readToken('--color-accent', '#2563eb');
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
      tintColor?: string,
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
      tintWallDraftPreviewObject(preview, tintColor);
      applyClippingPlanesToMeshes(preview, clippingPlanesRef.current);
      applyModelEdgeDisplay(preview, viewerEdgesRef.current, viewerSilhouetteEdgeWidthRef.current);
      scene.add(preview);
      wallDraftPreviewGroupRef.current = preview;
      return preview;
    }

    // 3D direct-authoring tool helpers — the giant tool-click dispatcher, the
    // hosted-opening preview math, the wall picker, and the draft-level
    // resolvers live in `viewport/direct3dToolHelpers.ts`. We bind them once
    // here with closures over the THREE refs and the kept inline helpers, so
    // the in-place pointer handlers can call them by name below.
    const {
      resolveDraftLevelInfo,
      pickWallAtPointer,
      hostedPreviewSegment,
      dispatchLinePreviewPayload,
      handle3dDirectToolClick,
    } = createDirect3dToolHelpers(
      {
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
      },
      draftState,
    );

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
      scheduleViewportRender();
    }

    const ro = new ResizeObserver(onResize);
    ro.observe(host);
    onResize();

    function onDown(ev: PointerEvent): void {
      if (walkController.snapshot().active && !document.pointerLockElement) {
        host.requestPointerLock();
        return;
      }
      const directToolAtPointer = activeDirect3dTool();
      const shouldTryLevelDatumPick =
        ev.button === 0 &&
        !shouldBypassLevelDatumPickForDirectAuthoring({
          button: ev.button,
          directTool: directToolAtPointer,
          altKey: ev.altKey,
          shiftKey: ev.shiftKey,
        });
      if (shouldTryLevelDatumPick) {
        const levelDatumId = pickLevelDatumId(ev.clientX, ev.clientY);
        if (levelDatumId) {
          const store = useBimStore.getState();
          store.select(levelDatumId);
          store.setActiveLevelId(levelDatumId);
          drag.dragMoved = false;
          drag.dragging = null;
          ev.preventDefault();
          return;
        }
      }
      if (directToolAtPointer && ev.button === 0 && !ev.altKey && !ev.shiftKey) {
        drag.beginToolDraft(directToolAtPointer, ev, {
          lineTools: LINE_3D_AUTHORING_TOOLS,
          hasLineDraftStart: draftState.lineDraftStart !== null,
          currentLineDraftTool: () =>
            (draftState.lineDraftStart as { tool: Direct3dAuthoringTool } | null)?.tool ?? null,
          handleClick: handle3dDirectToolClick,
        });
        (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
        return;
      }
      // EDT-03 — grip pre-pass. If the pointer is over a grip pickable,
      // start a grip drag instead of an orbit/pan.
      if (ev.button === 0 && drag.tryBeginGrip(ev, { scene, gripPreRaycast })) {
        (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
        return;
      }
      // §3.1 — section-box face-handle drag.
      if (ev.button === 0 && sectionBoxRef.current?.snapshot().active) {
        const started = drag.tryBeginSectionBoxFace(ev, {
          renderer,
          raycaster,
          ndc,
          camera,
          handles: sectionBoxHandleGroupRef.current?.children ?? [],
          faceAxisNormal: sectionBoxFaceAxisNormal,
        });
        if (started) {
          (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
          return;
        }
      }
      if (savedViewLockedRef.current) {
        drag.dragging = null;
        return;
      }
      const intent = classifyPointer({
        button: ev.button,
        altKey: ev.altKey,
        shiftKey: ev.shiftKey,
      });
      drag.beginOrbitOrPan(intent, ev);
      (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
    }

    function onUp(ev: PointerEvent): void {
      const wasDragging = drag.dragging;
      const draftTool = drag.toolDraftTool;
      const startedLineOnDown = drag.toolDraftStartedLineOnDown;
      const consumedOnDown = drag.toolDraftConsumedOnDown;
      drag.dragging = null;
      scheduleViewportRender();
      drag.clearTool();
      try {
        (ev.target as HTMLElement).releasePointerCapture(ev.pointerId);
      } catch {
        /* noop */
      }
      // §14.6 — walkthrough keyframe capture: left click with no drag captures current camera pose.
      if (!drag.dragMoved && ev.button === 0 && planToolRef.current === 'walkthrough') {
        const pose = useBimStore.getState().orbitCameraPoseMm;
        if (pose) {
          const keyframe = {
            positionMm: { x: pose.position.xMm, y: pose.position.yMm, z: pose.position.zMm },
            targetMm: { x: pose.target.xMm, y: pose.target.yMm, z: pose.target.zMm },
            fovDeg: 60,
            timeSec: walkthroughStateRef.current.keyframes.length * 3,
          };
          const { state } = reduceWalkthrough(walkthroughStateRef.current, {
            kind: 'capture-keyframe',
            keyframe,
          });
          walkthroughStateRef.current = state;
        }
        return;
      }
      if (wasDragging === 'grip') {
        // EDT-03 — commit the grip drag through the engine bus.
        const spec = drag.commitGrip();
        if (spec) handleGripCommandRef.current?.(spec);
        return;
      }
      if (wasDragging === 'section-box') {
        drag.commitSectionBoxDrag(sectionBoxRef.current, (extent) =>
          useBimStore.getState().setViewerSectionBoxExtent(extent),
        );
        return;
      }
      if (shouldCommitHostedPlacementOnPointerUp({ wasDragging, draftTool })) {
        handle3dDirectToolClick(ev.clientX, ev.clientY);
        return;
      }
      if (
        wasDragging === 'tool-draft' &&
        drag.dragMoved &&
        draftTool &&
        LINE_3D_AUTHORING_TOOLS.has(draftTool) &&
        draftState.lineDraftStart?.tool === draftTool
      ) {
        handle3dDirectToolClick(ev.clientX, ev.clientY);
        return;
      }
      if (
        !drag.dragMoved &&
        wasDragging === 'tool-draft' &&
        !startedLineOnDown &&
        !consumedOnDown
      ) {
        handle3dDirectToolClick(ev.clientX, ev.clientY);
        return;
      }
      if (drag.dragMoved && (wasDragging === 'orbit' || wasDragging === 'pan')) {
        syncCameraOrientationState(rig.snapshot(), 'immediate');
      }
      if (
        !drag.dragMoved &&
        ev.button === 0 &&
        (wasDragging === 'orbit' || wasDragging === 'pan')
      ) {
        pick(ev.clientX, ev.clientY, ev.shiftKey || ev.ctrlKey || ev.metaKey || ev.altKey);
      }
    }

    function onPointerCancel(ev: PointerEvent): void {
      try {
        (ev.target as HTMLElement).releasePointerCapture(ev.pointerId);
      } catch {
        /* noop */
      }
      if (drag.dragging === 'grip') {
        drag.clearGrip();
      }
      if (drag.dragging === 'section-box') {
        drag.sectionBoxDrag = null;
      }
      drag.clearTransient();
      clearWallDraftPreviewGroup();
      scheduleViewportRender();
    }

    function onMove(ev: PointerEvent): void {
      const directTool = activeDirect3dTool();
      if (drag.dragging || directTool) scheduleViewportRender();
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
            if (directTool === 'wall' && projected.blocker && !draftState.lineDraftStart) {
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
            if (LINE_3D_AUTHORING_TOOLS.has(directTool) && !draftState.lineDraftStart) {
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
            } else if (
              (directTool === 'column' || directTool === 'room') &&
              !draftState.lineDraftStart
            ) {
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
              (!draftState.polygonDraft || draftState.polygonDraft.points.length === 0)
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
          } else if (directTool === 'wall' && !draftState.lineDraftStart) {
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
        draftState.lineDraftStart &&
        authoringOverlayRef.current?.tool === draftState.lineDraftStart.tool &&
        authoringOverlayRef.current?.phase === 'pick-end'
      ) {
        const rect = renderer.domElement.getBoundingClientRect();
        const levelInfo = resolveDraftLevelInfo();
        let projected = levelInfo
          ? draftState.lineDraftStart.tool === 'wall' && draftState.lineDraftStart.wallBasis
            ? pointFromWallDraftScreenBasis(
                ev.clientX,
                ev.clientY,
                draftState.lineDraftStart.wallBasis,
              )
            : draftState.lineDraftStart.tool === 'wall'
              ? projectPointerToVisibleDraftPlane(ev.clientX, ev.clientY, levelInfo.elevationMm)
              : projectPointerToDraftPlane(ev.clientX, ev.clientY, levelInfo.elevationMm)
          : null;
        if (
          draftState.lineDraftStart.tool === 'wall' &&
          (!projected || projected.blocker || !levelInfo)
        ) {
          clearWallDraftPreviewGroup();
        }
        if (projected && levelInfo && !projected.blocker) {
          projected = snapDraftProjectionToActiveWorkPlane(projected, levelInfo, {
            preferWallConnectivity: draftState.lineDraftStart.tool === 'wall',
          });
        }
        setAuthoringOverlay((prev) =>
          prev?.phase === 'pick-end'
            ? prev.tool === 'wall' &&
              draftState.lineDraftStart &&
              projected &&
              !projected.blocker &&
              levelInfo
              ? (() => {
                  const workPlaneCheck = validateWorkPlane3d(
                    'wall',
                    projected.snapKind ?? null,
                    Boolean(levelInfo),
                  );
                  const previewMesh = updateWallDraftPreviewGroup(
                    draftState.lineDraftStart.point,
                    projected.point,
                    levelInfo,
                    draftState.wallFlipNextSegment,
                    workPlaneCheck.previewTint === 'red' ? '#ef4444' : undefined,
                  );
                  emitWallDebug('wall-preview', {
                    start: draftState.lineDraftStart.point,
                    end: projected.point,
                    startScreen: draftState.lineDraftStart.screen,
                    endScreen: projected.screen,
                    projection: draftState.lineDraftStart.wallProjection,
                    basis: draftState.lineDraftStart.wallBasis,
                    screenDelta: draftState.lineDraftStart.screen
                      ? {
                          x: projected.screen.x - draftState.lineDraftStart.screen.x,
                          y: projected.screen.y - draftState.lineDraftStart.screen.y,
                        }
                      : undefined,
                    modelDelta: {
                      xMm: projected.point.xMm - draftState.lineDraftStart.point.xMm,
                      yMm: projected.point.yMm - draftState.lineDraftStart.point.yMm,
                    },
                    lengthMm: Math.hypot(
                      projected.point.xMm - draftState.lineDraftStart.point.xMm,
                      projected.point.yMm - draftState.lineDraftStart.point.yMm,
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
                    wallFlipActive: draftState.wallFlipNextSegment,
                    wallProjectionMode: draftState.lineDraftStart.wallProjection?.mode,
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
        draftState.polygonDraft &&
        draftState.polygonDraft.tool === directTool &&
        draftState.polygonDraft.points.length > 0 &&
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
          lockToPreferred: draftState.hostPreviewLock,
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
                  previewHostWallId: draftState.hostPreviewLock
                    ? prev.previewHostWallId
                    : undefined,
                  previewHostAlongT: draftState.hostPreviewLock
                    ? prev.previewHostAlongT
                    : undefined,
                  previewHostLock: draftState.hostPreviewLock,
                  previewHostInvalidReason: 'No wall host on the active level under the cursor.',
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
                    previewHostLock: draftState.hostPreviewLock,
                    previewHostInvalidReason: preview.invalidReason,
                    previewAuxLines: preview.auxLines,
                    previewAuxArcPath: preview.auxArcPath,
                  }
                : prev,
            );
          }
        }
      }
      if (!drag.dragging) return;
      const { dx, dy, moved } = drag.accumulateMove(ev.clientX, ev.clientY);
      if (!moved) return;
      if (drag.dragging === 'tool-draft') return;
      if (drag.dragging === 'section-box' && sectionBoxRef.current) {
        drag.updateSectionBoxDrag(ev, {
          renderer,
          raycaster,
          ndc,
          camera,
          faceAxisKey: sectionBoxFaceAxisKey,
          sectionBox: sectionBoxRef.current,
          onHandlesChanged: () => {
            if (sectionBoxHandleGroupRef.current && sectionBoxRef.current) {
              updateSectionBoxHandles(sectionBoxHandleGroupRef.current, sectionBoxRef.current);
            }
          },
        });
        return;
      }
      if (drag.dragging === 'grip' && drag.activeGrip) {
        // Emit live preview via onDrag so listeners (e.g. property HUD)
        // can show the in-progress value without writing to the store.
        const deltaMm = projectGripDelta(
          drag.activeGrip.descriptor,
          ev.clientX,
          ev.clientY,
          drag.activeGrip.anchorScene,
        );
        drag.applyGripDelta(deltaMm);
        return;
      }
      if (drag.dragging === 'orbit') {
        rig.orbit(dx, dy);
        drag.recordOrbitVelocity(dx, dy);
      } else {
        rig.pan(dx, dy);
      }
      placeCamera();
    }

    function onWheel(ev: WheelEvent): void {
      ev.preventDefault();
      if (savedViewLockedRef.current) return;

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
      // §14.6 — walkthrough commit (Enter) or cancel (Escape) while tool is active.
      if (planToolRef.current === 'walkthrough') {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          const { state, effect } = reduceWalkthrough(walkthroughStateRef.current, {
            kind: 'commit',
          });
          walkthroughStateRef.current = state;
          if (effect.createCameraPath) {
            const id = `cp-${Date.now().toString(36)}`;
            useBimStore.getState().addCameraPath({
              kind: 'camera_path',
              id,
              name: effect.createCameraPath.name,
              keyframes: effect.createCameraPath.keyframes,
            });
          }
        } else if (ev.key === 'Escape') {
          walkthroughStateRef.current = initialWalkthroughState();
        }
        return;
      }
      const activeLineTool = activeDirect3dTool();
      if (
        activeLineTool &&
        LINE_3D_AUTHORING_TOOLS.has(activeLineTool) &&
        draftState.lineDraftStart &&
        draftState.lineDraftStart.tool === activeLineTool
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
              activeLineTool === 'wall' && draftState.wallFlipNextSegment
                ? flipWallLocationLineSide(runtime.wallLocationLine)
                : runtime.wallLocationLine;
            const basePayload = buildLinePreviewPayload({
              tool: draftState.lineDraftStart.tool,
              levelId: draftState.lineDraftStart.levelId,
              start: draftState.lineDraftStart.point,
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
                draftState.wallFlipNextSegment,
              );
              clearWallDraftPreviewGroup();
              draftState.wallFlipNextSegment = false;
            }
            dispatchLinePreviewPayload(resizedPayload);
            draftState.lineDraftStart = null;
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
          if (draftState.lineDraftStart && draftState.lineDraftStart.tool === tool) {
            draftState.lineDraftStart = null;
            draftState.wallFlipNextSegment = false;
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
        } else if (tool && POLYGON_3D_AUTHORING_TOOLS.has(tool) && draftState.polygonDraft) {
          draftState.polygonDraft = null;
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
          draftState.hostPreviewLock = false;
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
          draftState.hostPreviewLock = !draftState.hostPreviewLock;
          setAuthoringOverlay((prev) =>
            prev?.tool === tool
              ? {
                  ...prev,
                  previewHostLock: draftState.hostPreviewLock,
                }
              : prev,
          );
          ev.preventDefault();
          return;
        }
      }
      if (ev.code === 'Space') {
        const tool = activeDirect3dTool();
        if (
          tool === 'wall' &&
          draftState.lineDraftStart &&
          draftState.lineDraftStart.tool === 'wall'
        ) {
          draftState.wallFlipNextSegment = !draftState.wallFlipNextSegment;
          const overlay = authoringOverlayRef.current;
          const levelInfo = resolveDraftLevelInfo();
          if (overlay?.currentPointMm && levelInfo) {
            updateWallDraftPreviewGroup(
              draftState.lineDraftStart.point,
              overlay.currentPointMm,
              levelInfo,
              draftState.wallFlipNextSegment,
            );
          }
          setAuthoringOverlay((prev) =>
            prev?.tool === 'wall'
              ? {
                  ...prev,
                  wallFlipActive: draftState.wallFlipNextSegment,
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
      // PERF-I05 — BVH preflight before the right-click intersect walk.
      ensureBvhForPickables(root);
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

    function tick() {
      viewportRenderFrameQueued = false;
      rafRef.current = null;
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastFrameMs) / 1000);
      // PERF-I03: frame interval for the FPS / frame-time probe.
      const frameIntervalMs = lastFrameMs === 0 ? 0 : now - lastFrameMs;
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
      if (!drag.dragging && drag.inertiaSpeed() > 0.06) {
        rig.orbit(drag.inertiaVx, drag.inertiaVy);
        drag.tickInertia();
        placeCamera();
      }

      const renderStart = performance.now();
      composer.render();
      // PERF-I03: record dev-only frame-time + renderer.info stats.
      recordViewportFrame(renderer, performance.now() - renderStart, frameIntervalMs);
      if (shouldAnimateViewport()) scheduleViewportRender();
    }

    scheduleViewportRender();

    const pendingCsg = pendingCsgRef.current;
    const pendingCsgMeta = pendingCsgMetaRef.current;

    return () => {
      orbitRigApiRef.current = null;
      cameraRigRef.current = null;
      paintBundleRef.current = null;
      viewportRenderDisposed = true;
      requestViewportRenderRef.current = null;

      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
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
      sectionBoxHandleGroupRef.current = null;

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
  }, [clearWallDraftPreviewGroup, syncCameraOrientationState, theme]);

  useViewportSceneEffects({
    activeLensMode,
    activeLevelId,
    applyClippingPlanesToMeshes,
    applyLensGhosting,
    applyLinkedGhosting,
    applyModelEdgeDisplay,
    applyRenderRole,
    applySceneCameraPose,
    applyTextureVisibilityToMesh,
    aabbWireframeVertices,
    bimPickMapRef,
    buildGripMeshes,
    buildConicalRoofMesh,
    buildDomeRoofMesh,
    buildDriftBadgeCanvas,
    buildFamilyBlendMesh,
    buildExcavationMesh,
    buildFamilySweepMesh,
    buildGradedRegionMesh,
    buildGroupInstance3d,
    buildMassMesh,
    buildPlanOverlay3dGroup,
    buildSpireRoofMesh,
    cameraRef,
    cameraRigRef,
    clipCapsRef,
    clippingPlanesRef,
    composerRef,
    computeRootBoundingBox,
    CSG_ENABLED,
    csgBaseFootprintsForWall,
    csgNonceRef,
    csgWallSurfaceMaterialKey,
    csgWorkerRef,
    direct3dAuthoringActive,
    disposeObject3D,
    driftBadgeTooltip,
    elemViewerCategory,
    elementBadgeAnchorMm,
    elementsById,
    elevationMForLevel,
    fetchOsmContext,
    georeference,
    getResolvedText3dFont,
    gripsFor,
    groupInstanceGroupRef,
    groupRegistry,
    gripHandleRef,
    gripPickablesRef,
    hasAutoFittedRef,
    isElementVisibleUnderPhaseFilter,
    isRasterHighFidelityRenderStyle,
    isTextureRichRenderStyle,
    levelDatumBoundsFromBox,
    levelDatumGroupRef,
    lensFilterFromMode,
    loadText3dFont,
    makeBalconyMesh,
    makeFacadeBayMesh,
    makeStructuralFacadeGridMesh,
    makeBeamMesh,
    makeBeamSystemMesh,
    makeBraceMesh,
    makeCeilingMesh,
    makeClipPlaneCap,
    makeColumnMesh,
    makeCurtainWallMesh,
    makeDoorMesh,
    makeDormerMesh,
    makeFamilyInstanceMesh,
    makeFloorSlabMesh,
    makeInternalOriginMarker,
    makeLevelDatum3dGroup,
    makeMassBoxMesh,
    makeMassExtrusionMesh,
    makeMassRevolutionMesh,
    makeOsmContextGroup,
    makePlacedAssetMesh,
    makeProjectBasePointMarker,
    makeRailingMesh,
    makeReferencePlaneMarker,
    makeRoofJoinPreviewMesh,
    makeRoofMassMesh,
    makeRoomRibbon,
    makeSiteMesh,
    makeStairVolumeMesh,
    makeSurveyPointMarker,
    makeSweepMesh,
    makeText3dMesh,
    makeToposolidMesh,
    makeWallMesh,
    makeWindowMesh,
    materialDependencyDirtyIds,
    mirrorSceneCameraPose,
    modelLevels: levelsIndex,
    mountRef,
    orbitCameraNonce,
    orbitCameraPoseMm,
    orbitRigApiRef,
    orthoCameraRef,
    orthoMode,
    osmContextGroupRef,
    osmLayerHidden,
    osmVisible,
    outlinePassRef,
    paintBundleRef,
    pendingCsgMetaRef,
    pendingCsgRef,
    persistedOrbitViewpoint,
    planOverlayGroupRef,
    prevCatHiddenRef,
    prevElementsByIdRef,
    prevLensModeRef,
    prevLevelHiddenRef,
    readColorToken,
    readToken,
    remoteOutlinePassesRef,
    remoteSelections,
    renderPassRef,
    renderQuality,
    rendererRef,
    resolveDoorCutDimensions,
    resolveLevelDatum3dRows,
    resolveWindowCutDimensions,
    resolveWindowOutline,
    roofJoinPreview,
    rootGroupRef,
    sceneRef,
    sectionBoxActive,
    sectionBoxCageRef,
    sectionBoxHandleGroupRef,
    sectionBoxPrevActiveRef,
    sectionBoxRef,
    selectDriftedElements,
    selectedId,
    selectedIds,
    selectedIdRef,
    selectedIdsRef,
    setOsmStatus,
    setText3dRebuildTick,
    shouldRunWallOpeningCsg,
    skyBackground,
    skyBackgroundColor,
    spotElevationThree,
    ssaoPassRef,
    sunRef,
    syncCameraOrientationState,
    text3dPendingRef,
    text3dRebuildTick,
    theme,
    updateSectionBoxHandles,
    viewerAmbientOcclusionEnabled,
    viewerBackground,
    viewerCameraAction,
    viewerCategoryHidden,
    viewerClipElevMm,
    viewerClipFloorElevMm,
    viewerDepthCueEnabled,
    viewerEdges,
    viewerEdgesRef,
    viewerLevelHidden,
    viewerPhaseFilter,
    viewerPhotographicExposureEv,
    viewerRenderStyle,
    viewerShadowsEnabled,
    viewerSilhouetteEdgeWidth,
    viewerSilhouetteEdgeWidthRef,
    walkActive,
    walkControllerRef,
    walkLevelsRef,
    wallPlanOffsetM,
    wallVerticalSpanM,
    wallWith3dJoinDisallowGaps,
    yawForPlanSegment,
  });

  useEffect(() => {
    requestViewportRenderRef.current?.();
  });

  const { handleViewCubePick, handleViewCubeDrag, handleOrientSaved } = useViewportViewCubeHandlers(
    {
      cameraRigRef,
      cameraRef,
      orthoCameraRef,
      syncCameraOrientationState,
    },
  );

  const {
    saved3dViewsList,
    direct3dLevelOptions,
    activeWorkPlaneLevel,
    setAuthoringWorkPlaneLevel,
    stepAuthoringWorkPlaneLevel,
  } = useViewportOverlayControls({
    elementsById,
    activeLevelId,
    setActiveLevelId,
    selectElement: selectStoreEl,
  });

  return (
    <div
      data-testid="orbit-3d-viewport"
      className="relative h-full w-full overflow-hidden bg-background"
    >
      <ViewportOverlays
        mountRef={mountRef}
        wallContextMenu={wallContextMenu}
        onWallContextMenuCommand={handleWallContextMenuCommand}
        onCloseWallContextMenu={() => setWallContextMenu(null)}
        wallFaceRadialMenu={wallFaceRadialMenu}
        onWallFaceRadialCommand={handleWallFaceRadialCommand}
        onDismissWallFaceRadialMenu={() => setWallFaceRadialMenu(null)}
        viewOverlayRightInset={viewOverlayRightInset}
        currentAzimuth={currentAzimuth}
        currentElevation={currentElevation}
        onViewCubePick={handleViewCubePick}
        onViewCubeDrag={handleViewCubeDrag}
        saved3dViewsList={saved3dViewsList}
        onOrientSaved={handleOrientSaved}
        direct3dAuthoringActive={direct3dAuthoringActive}
        authoringOverlay={authoringOverlay}
        draftPlaneAngleWarning={draftPlaneAngleWarning}
        hasActiveComponentSelection={Boolean(activeComponentAssetId || activeComponentFamilyTypeId)}
        direct3dLevelOptions={direct3dLevelOptions}
        activeWorkPlaneLevel={activeWorkPlaneLevel}
        onSetAuthoringWorkPlaneLevel={setAuthoringWorkPlaneLevel}
        onStepAuthoringWorkPlaneLevel={stepAuthoringWorkPlaneLevel}
        walkActive={walkActive}
        translate={t}
        sectionBoxSummary={
          sectionBoxActive && sectionBoxRef.current ? sectionBoxRef.current.summary() : null
        }
        savedViewLocked={savedViewLocked}
        activeSavedView={activeSavedView}
        viewLocked={viewLocked}
        onSetViewLocked={setViewLocked}
        skyPanelOpen={skyPanelOpen}
        onSetSkyPanelOpen={setSkyPanelOpen}
        renderQualityOpen={renderQualityOpen}
        onSetRenderQualityOpen={setRenderQualityOpen}
        splitViewEnabled={splitViewEnabled}
        onToggleSplitView={() => onSemanticCommand?.({ type: 'toggleSplitView' })}
      />
    </div>
  );
}
