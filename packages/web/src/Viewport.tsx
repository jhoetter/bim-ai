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

import { parseDimensionInput, type Element, type LensMode, type SavedViewElem } from '@bim-ai/core';
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
import { gripsFor, type Grip3dDescriptor } from './viewport/grip3d';
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
  type ViewerEdgeWidth,
  type ViewerGdoRuntimeState,
} from './viewport/ViewportRuntimeHelpers';
import {
  buildAxisIndicator,
  buildGripMeshes,
  type AxisIndicatorHandle,
  type GripMeshHandle,
} from './viewport/grip3dRenderer';
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
import { projectAlongT, type WallFaceRadialMenuOpen } from './viewport/wallFaceRadialMenu';
import { buildPlanOverlay3dGroup } from './viewport/planOverlay3d';
import { shouldRunWallOpeningCsg } from './viewport/wallCsgEligibility';
import { wallWith3dJoinDisallowGaps } from './viewport/wallJoinDisplay';
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
  validateWorkPlane3d,
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
  isPhysicalHostedOpeningWall,
  isWallOnActiveAuthoringLevel,
  shouldBypassLevelDatumPickForDirectAuthoring,
  shouldCommitHostedPlacementOnPointerUp,
  shouldReuseHostedPreviewCommit,
  type HostedOpeningLike,
  type HostedPlacementDedupeState,
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
  const osmContextGroupRef = useRef<THREE.Group | null>(null);
  const groupInstanceGroupRef = useRef<THREE.Group | null>(null);
  const osmVisible = useBimStore((s) => s.osmVisible);
  const setOsmVisible = useBimStore((s) => s.setOsmVisible);
  const osmLayerHidden = useBimStore((s) => s.osmLayerHidden);
  const toggleOsmLayer = useBimStore((s) => s.toggleOsmLayer);
  const osmStatus = useBimStore((s) => s.osmStatus);
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

  // Serialised key — only changes when georeference VALUES change, not on every elementsById ref update.
  const georeferenceKey = useMemo(() => {
    const ps = Object.values(elementsById).find((e) => e.kind === 'project_settings');
    const g = ps?.kind === 'project_settings' ? ps.georeference : null;
    if (!g) return null;
    return `${g.anchorLat}:${g.anchorLon}:${g.bboxNorth ?? g.contextRadiusM ?? ''}:${g.bboxSouth ?? ''}:${g.bboxEast ?? ''}:${g.bboxWest ?? ''}`;
  }, [elementsById]);

  const georeference = useMemo(() => {
    const ps = Object.values(elementsById).find((e) => e.kind === 'project_settings');
    if (ps?.kind === 'project_settings') return ps.georeference ?? null;
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [georeferenceKey]); // stable: only recalculates when values actually change

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
  const setRenderQuality = useBimStore((s) => s.setRenderQuality);
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
    let dragging: 'orbit' | 'pan' | 'grip' | 'tool-draft' | 'section-box' | null = null;
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
    let sectionBoxDrag: { face: string; dragPlane: THREE.Plane } | null = null;
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

    function placeCamera(orientationSync: 'defer' | 'immediate' = 'defer'): void {
      const snap = rig.snapshot();
      applySceneCameraPose(camera, snap);
      syncCameraOrientationState(snap, orientationSync);
      const oc = orthoCameraRef.current;
      if (oc) {
        mirrorSceneCameraPose(camera, oc, snap.target);
      }
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
        const draftLevelInfo = resolveDraftLevelInfo();
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
                  previewHostWallId: hostPreviewLock ? prev.previewHostWallId : undefined,
                  previewHostAlongT: hostPreviewLock ? prev.previewHostAlongT : undefined,
                  previewHostLock: hostPreviewLock,
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
              onSemanticCommandRef.current?.(
                polygonPreviewToSemanticCommand(
                  buildPolygonPreviewPayload({
                    tool: 'ceiling',
                    levelId: polygonDraft.levelId,
                    points: polygonDraft.points,
                  }),
                ),
              );
            } else if (tool === 'floor') {
              onSemanticCommandRef.current?.(
                polygonPreviewToSemanticCommand(
                  buildPolygonPreviewPayload({
                    tool: 'floor',
                    levelId: polygonDraft.levelId,
                    points: polygonDraft.points,
                  }),
                ),
              );
            } else if (tool === 'roof') {
              onSemanticCommandRef.current?.(
                polygonPreviewToSemanticCommand(
                  buildPolygonPreviewPayload({
                    tool: 'roof',
                    levelId: polygonDraft.levelId,
                    points: polygonDraft.points,
                  }),
                ),
              );
            } else if (tool === 'area') {
              onSemanticCommandRef.current?.(
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
                onSemanticCommandRef.current?.({
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
      const directToolAtPointer = activeDirect3dTool();
      if (
        ev.button === 0 &&
        !shouldBypassLevelDatumPickForDirectAuthoring({
          button: ev.button,
          directTool: directToolAtPointer,
          altKey: ev.altKey,
          shiftKey: ev.shiftKey,
        })
      ) {
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
      if (directToolAtPointer && ev.button === 0 && !ev.altKey && !ev.shiftKey) {
        const directTool = directToolAtPointer;
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
      // §3.1 — section-box face-handle drag.
      if (ev.button === 0 && sectionBoxRef.current?.snapshot().active) {
        const rect = renderer.domElement.getBoundingClientRect();
        ndc.set(
          ((ev.clientX - rect.left) / rect.width) * 2 - 1,
          -((ev.clientY - rect.top) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(ndc, camera);
        const handles = sectionBoxHandleGroupRef.current
          ? [...sectionBoxHandleGroupRef.current.children]
          : [];
        const hits = raycaster.intersectObjects(handles, false);
        if (hits.length > 0) {
          const hit = hits[0];
          const face = hit.object.userData.sectionBoxHandle as string;
          const normal = sectionBoxFaceAxisNormal(face);
          const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
            normal,
            hit.point.clone(),
          );
          sectionBoxDrag = { face, dragPlane };
          dragging = 'section-box';
          dragMoved = false;
          cumulativeDragPx = 0;
          lastX = ev.clientX;
          lastY = ev.clientY;
          (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
          return;
        }
      }
      if (savedViewLockedRef.current) {
        dragging = null;
        return;
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
      // §14.6 — walkthrough keyframe capture: left click with no drag captures current camera pose.
      if (!dragMoved && ev.button === 0 && planToolRef.current === 'walkthrough') {
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
      if (wasDragging === 'section-box') {
        sectionBoxDrag = null;
        const sb = sectionBoxRef.current;
        if (sb) {
          useBimStore.getState().setViewerSectionBoxExtent(sb.getExtent());
        }
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
      if (dragMoved && (wasDragging === 'orbit' || wasDragging === 'pan')) {
        syncCameraOrientationState(rig.snapshot(), 'immediate');
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
      if (dragging === 'section-box') {
        sectionBoxDrag = null;
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
                  const workPlaneCheck = validateWorkPlane3d(
                    'wall',
                    projected.snapKind ?? null,
                    Boolean(levelInfo),
                  );
                  const previewMesh = updateWallDraftPreviewGroup(
                    lineDraftStart.point,
                    projected.point,
                    levelInfo,
                    wallFlipNextSegment,
                    workPlaneCheck.previewTint === 'red' ? '#ef4444' : undefined,
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
      if (dragging === 'section-box' && sectionBoxDrag && sectionBoxRef.current) {
        const rect = renderer.domElement.getBoundingClientRect();
        ndc.set(
          ((ev.clientX - rect.left) / rect.width) * 2 - 1,
          -((ev.clientY - rect.top) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(ndc, camera);
        const hitPt = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(sectionBoxDrag.dragPlane, hitPt)) {
          const axisKey = sectionBoxFaceAxisKey(sectionBoxDrag.face);
          sectionBoxRef.current.setExtent({ [sectionBoxDrag.face]: hitPt[axisKey] });
          if (sectionBoxHandleGroupRef.current) {
            updateSectionBoxHandles(sectionBoxHandleGroupRef.current, sectionBoxRef.current);
          }
        }
        return;
      }
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
