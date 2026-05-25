import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react';

import * as THREE from 'three';
import type { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import type { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import type { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';

import type { CsgRequest } from './csgWorker';
import { recordViewportRebuild } from './viewportRebuildStats';
import type { Element, LensMode } from '@bim-ai/core';
import { useBimStore } from '../state/store';
import type { StoreState } from '../state/storeTypes';
import type { GroupRegistry } from '../groups/groupTypes';
import type { CameraRig, CameraRigSnapshot } from './cameraRig';
import type { SectionBox } from './sectionBox';
import type { WalkController } from './walkMode';
import type { ViewportPaintBundle } from './materials';
import type { GripMeshHandle } from './grip3dRenderer';
import type { WallElem } from './meshBuilders';

type DoorElem = Extract<Element, { kind: 'door' }>;
type WindowElem = Extract<Element, { kind: 'window' }>;
type WallOpeningElem = Extract<Element, { kind: 'wall_opening' }>;
type ViewpointElem = Extract<Element, { kind: 'viewpoint' }>;
type ProjectSettingsElem = Extract<Element, { kind: 'project_settings' }>;
type ProjectGeoreference = NonNullable<ProjectSettingsElem['georeference']>;
type ElementsById = Record<string, Element>;
type OrbitCameraPoseMm = NonNullable<StoreState['orbitCameraPoseMm']>;
type OrbitRigApi = {
  applyViewpointMm: (pose: OrbitCameraPoseMm) => void;
};
type PendingCsgMeta = {
  len: number;
  height: number;
  thick: number;
  materialKey?: string | null;
  wall?: WallElem;
  retainExisting?: boolean;
};
type RemoteSelection = { elementId: string; color: string };
type CameraOrientationSync = (
  snap: Pick<CameraRigSnapshot, 'azimuth' | 'elevation'>,
  mode?: 'defer' | 'immediate',
) => void;

/**
 * Issue #59 — sync three.js's bundled SSAOPass to the active camera's
 * projection mode.
 *
 * The pass owns two shaders (``ssaoMaterial`` + ``depthRenderMaterial``) that
 * each carry a compile-time ``PERSPECTIVE_CAMERA`` define. When the define is
 * ``1`` the depth probe uses ``perspectiveDepthToViewZ``; when it's ``0`` the
 * probe uses ``orthographicDepthToViewZ``. Swapping ``ssao.camera`` at runtime
 * (Viewport.tsx does this when ``viewerProjection`` toggles) does **not**
 * touch the define — three.js leaves it pinned at the original perspective
 * setting. With an orthographic camera, ``perspectiveDepthToViewZ`` collapses
 * to a near-zero range, the SSAO occlusion factor reads ~1 everywhere, and
 * the SSAO copy pass (``blendSrc: DstColorFactor, blendDst: ZeroFactor``)
 * multiplies the rendered scene by ~0 — producing the opaque-black-silhouette
 * symptom of issue #59 (E/S/N ortho captures after PR #58).
 *
 * Re-publishing the projection matrix + ``cameraNear/cameraFar`` is also
 * required so the next probe samples the right depth range for the swapped
 * camera (otherwise even with the correct define, stale uniforms keep the
 * pass calibrated to the previous camera).
 */
export function syncSsaoCameraDefines(ssaoPass: SSAOPass, camera: THREE.Camera): void {
  const persp = camera as THREE.PerspectiveCamera;
  const ortho = camera as THREE.OrthographicCamera;
  const isPerspective = persp.isPerspectiveCamera ? 1 : 0;
  const cameraNear = persp.isPerspectiveCamera
    ? persp.near
    : ortho.isOrthographicCamera
      ? ortho.near
      : 0.05;
  const cameraFar = persp.isPerspectiveCamera
    ? persp.far
    : ortho.isOrthographicCamera
      ? ortho.far
      : 500;
  const ssaoMaterial = (ssaoPass as unknown as { ssaoMaterial?: THREE.ShaderMaterial })
    .ssaoMaterial;
  const depthRenderMaterial = (
    ssaoPass as unknown as { depthRenderMaterial?: THREE.ShaderMaterial }
  ).depthRenderMaterial;
  if (ssaoMaterial?.defines) {
    const defs = ssaoMaterial.defines as Record<string, number>;
    if (defs.PERSPECTIVE_CAMERA !== isPerspective) {
      defs.PERSPECTIVE_CAMERA = isPerspective;
      ssaoMaterial.needsUpdate = true;
    }
    const uniforms = ssaoMaterial.uniforms as Record<string, { value: unknown }> | undefined;
    if (uniforms?.cameraNear) uniforms.cameraNear.value = cameraNear;
    if (uniforms?.cameraFar) uniforms.cameraFar.value = cameraFar;
    if (uniforms?.cameraProjectionMatrix) {
      (uniforms.cameraProjectionMatrix.value as THREE.Matrix4).copy(camera.projectionMatrix);
    }
    if (uniforms?.cameraInverseProjectionMatrix) {
      (uniforms.cameraInverseProjectionMatrix.value as THREE.Matrix4).copy(
        camera.projectionMatrixInverse,
      );
    }
  }
  if (depthRenderMaterial?.defines) {
    const defs = depthRenderMaterial.defines as Record<string, number>;
    if (defs.PERSPECTIVE_CAMERA !== isPerspective) {
      defs.PERSPECTIVE_CAMERA = isPerspective;
      depthRenderMaterial.needsUpdate = true;
    }
    const uniforms = depthRenderMaterial.uniforms as Record<string, { value: unknown }> | undefined;
    if (uniforms?.cameraNear) uniforms.cameraNear.value = cameraNear;
    if (uniforms?.cameraFar) uniforms.cameraFar.value = cameraFar;
  }
}

type ViewportSceneEffectsArgs = {
  activeLensMode: LensMode;
  activeLevelId: StoreState['activeLevelId'];
  applyClippingPlanesToMeshes: typeof import('./sceneUtils').applyClippingPlanesToMeshes;
  applyLensGhosting: typeof import('./applyLensGhosting').applyLensGhosting;
  applyLinkedGhosting: typeof import('./linkedGhosting').applyLinkedGhosting;
  applyModelEdgeDisplay: typeof import('./ViewportRuntimeHelpers').applyModelEdgeDisplay;
  applyRenderRole: typeof import('./ViewportRuntimeHelpers').applyRenderRole;
  applySceneCameraPose: typeof import('./cameraMatrixSync').applySceneCameraPose;
  applyTextureVisibilityToMesh: typeof import('./visualStyleMaterials').applyTextureVisibilityToMesh;
  aabbWireframeVertices: typeof import('./sceneUtils').aabbWireframeVertices;
  bimPickMapRef: RefObject<Map<string, THREE.Object3D>>;
  buildGripMeshes: typeof import('./grip3dRenderer').buildGripMeshes;
  buildConicalRoofMesh: typeof import('./meshBuilders.coneRoof').buildConicalRoofMesh;
  buildDomeRoofMesh: typeof import('./meshBuilders.coneRoof').buildDomeRoofMesh;
  buildDriftBadgeCanvas: typeof import('../plan/monitorDriftBadge').buildDriftBadgeCanvas;
  buildExcavationMesh: typeof import('./meshBuilders').buildExcavationMesh;
  buildFamilyBlendMesh: typeof import('./meshBuilders.familyBlend').buildFamilyBlendMesh;
  buildFamilySweepMesh: typeof import('./meshBuilders.familySweep').buildFamilySweepMesh;
  buildGradedRegionMesh: typeof import('./meshBuilders.gradedRegion').buildGradedRegionMesh;
  buildGroupInstance3d: typeof import('./groupInstance3d').buildGroupInstance3d;
  buildMassMesh: typeof import('./meshBuilders.mass').buildMassMesh;
  buildPlanOverlay3dGroup: typeof import('./planOverlay3d').buildPlanOverlay3dGroup;
  buildSpireRoofMesh: typeof import('./meshBuilders.coneRoof').buildSpireRoofMesh;
  cameraRef: RefObject<THREE.PerspectiveCamera | null>;
  cameraRigRef: RefObject<CameraRig | null>;
  clipCapsRef: RefObject<THREE.Mesh[]>;
  clippingPlanesRef: RefObject<THREE.Plane[]>;
  composerRef: RefObject<EffectComposer | null>;
  computeRootBoundingBox: typeof import('./sceneUtils').computeRootBoundingBox;
  CSG_ENABLED: boolean;
  csgBaseFootprintsForWall: typeof import('./ViewportRuntimeHelpers').csgBaseFootprintsForWall;
  csgNonceRef: RefObject<number>;
  csgWallSurfaceMaterialKey: typeof import('./ViewportRuntimeHelpers').csgWallSurfaceMaterialKey;
  csgWorkerRef: RefObject<Worker | null>;
  direct3dAuthoringActive: boolean;
  disposeObject3D: typeof import('./ViewportRuntimeHelpers').disposeObject3D;
  driftBadgeTooltip: typeof import('../plan/monitorDriftBadge').driftBadgeTooltip;
  elemViewerCategory: typeof import('./sceneUtils').elemViewerCategory;
  elementBadgeAnchorMm: typeof import('../plan/monitorDriftBadge').elementBadgeAnchorMm;
  elementsById: ElementsById;
  elevationMForLevel: typeof import('./meshBuilders').elevationMForLevel;
  fetchOsmContext: typeof import('../osm/fetchOverpass').fetchOsmContext;
  georeference: ProjectGeoreference | null;
  getResolvedText3dFont: typeof import('./text3dGeometry').getResolvedText3dFont;
  gripsFor: typeof import('./grip3d').gripsFor;
  groupInstanceGroupRef: RefObject<THREE.Group | null>;
  groupRegistry: GroupRegistry;
  gripHandleRef: RefObject<GripMeshHandle | null>;
  gripPickablesRef: RefObject<THREE.Object3D[]>;
  hasAutoFittedRef: RefObject<boolean>;
  isElementVisibleUnderPhaseFilter: typeof import('./phaseFilter').isElementVisibleUnderPhaseFilter;
  isRasterHighFidelityRenderStyle: typeof import('./renderStyles').isRasterHighFidelityRenderStyle;
  isTextureRichRenderStyle: typeof import('./renderStyles').isTextureRichRenderStyle;
  levelDatumBoundsFromBox: typeof import('./levelDatums3d').levelDatumBoundsFromBox;
  levelDatumGroupRef: RefObject<THREE.Group | null>;
  lensFilterFromMode: typeof import('./useLensFilter').lensFilterFromMode;
  loadText3dFont: typeof import('./text3dGeometry').loadText3dFont;
  makeBalconyMesh: typeof import('./meshBuilders').makeBalconyMesh;
  makeFacadeBayMesh: typeof import('./meshBuilders').makeFacadeBayMesh;
  makeBeamMesh: typeof import('./meshBuilders').makeBeamMesh;
  makeBeamSystemMesh: typeof import('./meshBuilders.beamSystem').makeBeamSystemMesh;
  makeBraceMesh: typeof import('./meshBuilders.brace').makeBraceMesh;
  makeCeilingMesh: typeof import('./meshBuilders').makeCeilingMesh;
  makeClipPlaneCap: typeof import('./sceneUtils').makeClipPlaneCap;
  makeColumnMesh: typeof import('./meshBuilders').makeColumnMesh;
  makeCurtainWallMesh: typeof import('./meshBuilders').makeCurtainWallMesh;
  makeDoorMesh: typeof import('./meshBuilders').makeDoorMesh;
  makeDormerMesh: typeof import('./dormerMesh').makeDormerMesh;
  makeFamilyInstanceMesh: typeof import('./familyInstance3d').makeFamilyInstanceMesh;
  makeFloorSlabMesh: typeof import('./meshBuilders').makeFloorSlabMesh;
  makeInternalOriginMarker: typeof import('./originMarkers').makeInternalOriginMarker;
  makeLevelDatum3dGroup: typeof import('./levelDatums3d').makeLevelDatum3dGroup;
  makeMassBoxMesh: typeof import('./meshBuilders.massBox').makeMassBoxMesh;
  makeMassExtrusionMesh: typeof import('./meshBuilders.massExtrusion').makeMassExtrusionMesh;
  makeMassRevolutionMesh: typeof import('./meshBuilders.massRevolution').makeMassRevolutionMesh;
  makeOsmContextGroup: typeof import('./meshBuilders.osmContext').makeOsmContextGroup;
  makePlacedAssetMesh: typeof import('./placedAssetRendering').makePlacedAssetMesh;
  makeProjectBasePointMarker: typeof import('./originMarkers').makeProjectBasePointMarker;
  makeRailingMesh: typeof import('./meshBuilders').makeRailingMesh;
  makeReferencePlaneMarker: typeof import('./referencePlaneMarker').makeReferencePlaneMarker;
  makeRoofJoinPreviewMesh: typeof import('./meshBuilders').makeRoofJoinPreviewMesh;
  makeRoofMassMesh: typeof import('./meshBuilders').makeRoofMassMesh;
  makeRoomRibbon: typeof import('./meshBuilders').makeRoomRibbon;
  makeSiteMesh: typeof import('./meshBuilders').makeSiteMesh;
  makeStairVolumeMesh: typeof import('./meshBuilders').makeStairVolumeMesh;
  makeSurveyPointMarker: typeof import('./originMarkers').makeSurveyPointMarker;
  makeSweepMesh: typeof import('./sweepMesh').makeSweepMesh;
  makeText3dMesh: typeof import('./text3dGeometry').makeText3dMesh;
  makeToposolidMesh: typeof import('./meshBuilders').makeToposolidMesh;
  makeWallMesh: typeof import('./meshBuilders').makeWallMesh;
  makeWindowMesh: typeof import('./meshBuilders').makeWindowMesh;
  materialDependencyDirtyIds: typeof import('./materialDependencyInvalidation').materialDependencyDirtyIds;
  mirrorSceneCameraPose: typeof import('./cameraMatrixSync').mirrorSceneCameraPose;
  modelLevels: readonly Extract<Element, { kind: 'level' }>[];
  mountRef: RefObject<HTMLDivElement | null>;
  orbitCameraNonce: StoreState['orbitCameraNonce'];
  orbitCameraPoseMm: StoreState['orbitCameraPoseMm'];
  orbitRigApiRef: RefObject<OrbitRigApi | null>;
  orthoCameraRef: RefObject<THREE.OrthographicCamera | null>;
  orthoMode: boolean;
  osmContextGroupRef: RefObject<THREE.Group | null>;
  osmLayerHidden: StoreState['osmLayerHidden'];
  osmVisible: StoreState['osmVisible'];
  outlinePassRef: RefObject<OutlinePass | null>;
  paintBundleRef: RefObject<ViewportPaintBundle | null>;
  pendingCsgMetaRef: RefObject<Map<string, PendingCsgMeta>>;
  pendingCsgRef: RefObject<Map<string, number>>;
  persistedOrbitViewpoint: ViewpointElem | null;
  planOverlayGroupRef: RefObject<THREE.Group | null>;
  prevCatHiddenRef: RefObject<Record<string, boolean>>;
  prevElementsByIdRef: RefObject<ElementsById>;
  prevLensModeRef: RefObject<LensMode | null>;
  prevLevelHiddenRef: RefObject<Record<string, boolean>>;
  readColorToken: typeof import('./sceneHelpers').readColorToken;
  readToken: typeof import('./sceneHelpers').readToken;
  remoteOutlinePassesRef: RefObject<Map<string, OutlinePass>>;
  remoteSelections: RemoteSelection[] | undefined;
  renderPassRef: RefObject<RenderPass | null>;
  renderQuality: StoreState['renderQuality'];
  rendererRef: RefObject<THREE.WebGLRenderer | null>;
  resolveDoorCutDimensions: typeof import('./hostedOpeningDimensions').resolveDoorCutDimensions;
  resolveLevelDatum3dRows: typeof import('./levelDatums3d').resolveLevelDatum3dRows;
  resolveWindowCutDimensions: typeof import('./hostedOpeningDimensions').resolveWindowCutDimensions;
  resolveWindowOutline: typeof import('../families/geometryFns/windowOutline').resolveWindowOutline;
  roofJoinPreview: StoreState['roofJoinPreview'];
  rootGroupRef: RefObject<THREE.Group | null>;
  sceneRef: RefObject<THREE.Scene | null>;
  sectionBoxActive: StoreState['viewerSectionBoxActive'];
  sectionBoxCageRef: RefObject<THREE.LineSegments | null>;
  sectionBoxHandleGroupRef: RefObject<THREE.Group | null>;
  sectionBoxPrevActiveRef: RefObject<boolean>;
  sectionBoxRef: RefObject<SectionBox | null>;
  selectDriftedElements: typeof import('../plan/monitorDriftBadge').selectDriftedElements;
  selectedId: StoreState['selectedId'];
  selectedIds: StoreState['selectedIds'];
  selectedIdRef: RefObject<string | undefined>;
  selectedIdsRef: RefObject<string[]>;
  setOsmStatus: (status: StoreState['osmStatus']) => void;
  setText3dRebuildTick: Dispatch<SetStateAction<number>>;
  shouldRunWallOpeningCsg: typeof import('./wallCsgEligibility').shouldRunWallOpeningCsg;
  skyBackground: StoreState['skyBackground'];
  skyBackgroundColor: StoreState['skyBackgroundColor'];
  spotElevationThree: typeof import('./meshBuilders').spotElevationThree;
  ssaoPassRef: RefObject<SSAOPass | null>;
  sunRef: RefObject<THREE.DirectionalLight | null>;
  syncCameraOrientationState: CameraOrientationSync;
  text3dPendingRef: RefObject<Set<string>>;
  text3dRebuildTick: number;
  theme: string;
  updateSectionBoxHandles: typeof import('./ViewportRuntimeHelpers').updateSectionBoxHandles;
  viewerAmbientOcclusionEnabled: boolean;
  viewerBackground: StoreState['viewerBackground'];
  viewerCameraAction: StoreState['viewerCameraAction'];
  viewerCategoryHidden: StoreState['viewerCategoryHidden'];
  viewerClipElevMm: StoreState['viewerClipElevMm'];
  viewerClipFloorElevMm: StoreState['viewerClipFloorElevMm'];
  viewerDepthCueEnabled: boolean;
  viewerEdges: StoreState['viewerEdges'];
  viewerEdgesRef: RefObject<StoreState['viewerEdges']>;
  viewerLevelHidden: StoreState['viewerLevelHidden'];
  viewerPhaseFilter: StoreState['viewerPhaseFilter'];
  viewerPhotographicExposureEv: number;
  viewerRenderStyle: StoreState['viewerRenderStyle'];
  viewerShadowsEnabled: boolean;
  viewerSilhouetteEdgeWidth: NonNullable<StoreState['viewerSilhouetteEdgeWidth']>;
  viewerSilhouetteEdgeWidthRef: RefObject<NonNullable<StoreState['viewerSilhouetteEdgeWidth']>>;
  walkActive: StoreState['viewerWalkModeActive'];
  walkControllerRef: RefObject<WalkController | null>;
  walkLevelsRef: RefObject<number[]>;
  wallPlanOffsetM: typeof import('./meshBuilders').wallPlanOffsetM;
  wallVerticalSpanM: typeof import('./meshBuilders').wallVerticalSpanM;
  wallWith3dJoinDisallowGaps: typeof import('./wallJoinDisplay').wallWith3dJoinDisallowGaps;
  yawForPlanSegment: typeof import('./planSegmentOrientation').yawForPlanSegment;
};

export function useViewportSceneEffects(args: ViewportSceneEffectsArgs): void {
  const {
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
    buildExcavationMesh,
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
    makeFacadeBayMesh,
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
    modelLevels,
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
  } = args;

  useEffect(() => {
    if (!orbitCameraPoseMm) return;
    orbitRigApiRef.current?.applyViewpointMm(orbitCameraPoseMm);
  }, [orbitCameraNonce, orbitCameraPoseMm, orbitRigApiRef]);

  useEffect(() => {
    const cam = orthoMode ? (orthoCameraRef.current ?? cameraRef.current!) : cameraRef.current!;
    if (!cam) return;
    if (renderPassRef.current) renderPassRef.current.camera = cam;
    if (ssaoPassRef.current) ssaoPassRef.current.camera = cam;
    if (outlinePassRef.current) outlinePassRef.current.renderCamera = cam;
    // Issue #59: SSAOPass's shader has a compile-time ``PERSPECTIVE_CAMERA``
    // define that selects between ``perspectiveDepthToViewZ`` and
    // ``orthographicDepthToViewZ`` for depth reconstruction. The pass leaves
    // it pinned at ``1`` (perspective) when ``ssao.camera`` is swapped at
    // runtime. With an orthographic camera, the perspective depth math
    // collapses to a tiny range near 0 → SSAO reports near-total occlusion
    // for every visible pixel → the copy pass (``blendSrc: DstColorFactor,
    // blendDst: ZeroFactor``) multiplies the rendered scene by ~0 and the
    // building reads as an opaque black silhouette against the (background-
    // cleared) sky. PR #58 enabled this code path via ``?projection=
    // orthographic`` and surfaced the regression on E/S/N captures. Toggle
    // the shader define + uniforms whenever the active camera changes so
    // the depth probe matches the actual projection.
    const ssaoPass = ssaoPassRef.current;
    if (ssaoPass) {
      syncSsaoCameraDefines(ssaoPass, cam);
    }
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
      // Issue #59: re-publish the (now ortho) projection matrix + near/far
      // to the SSAO uniforms so the next render samples the right depths.
      if (ssaoPass) {
        syncSsaoCameraDefines(ssaoPass, oc);
      }
    }
  }, [
    cameraRef,
    cameraRigRef,
    mirrorSceneCameraPose,
    orbitCameraNonce,
    orbitCameraPoseMm,
    orthoCameraRef,
    orthoMode,
    outlinePassRef,
    renderPassRef,
    rendererRef,
    ssaoPassRef,
  ]);

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
    } else if (viewerCameraAction.kind === 'fit-context') {
      const root = rootGroupRef.current;
      const box = root ? computeRootBoundingBox(root) : null;
      if (box) rig.frame(box);
    } else {
      rig.reset();
    }

    const snap = rig.snapshot();
    applySceneCameraPose(camera, snap);
    const orthoCamera = orthoCameraRef.current;
    if (orthoCamera) {
      mirrorSceneCameraPose(camera, orthoCamera, snap.target);
    }
    syncCameraOrientationState(snap, 'immediate');
  }, [
    applySceneCameraPose,
    cameraRef,
    cameraRigRef,
    computeRootBoundingBox,
    mirrorSceneCameraPose,
    orthoCameraRef,
    rootGroupRef,
    syncCameraOrientationState,
    viewerCameraAction,
  ]);

  // ── Incremental geometry effect ──────────────────────────────────────────
  // Diffs elementsById against the previous snapshot and surgically adds,
  // updates, or removes only the Three.js meshes that actually changed.
  // This turns O(N) full-rebuild into O(delta) per edit.
  useEffect(() => {
    const root = rootGroupRef.current;
    if (!root) return;

    // PERF-I04: time the diff + rebuild pass so the probe can report rebuild
    // cadence + mesh churn after a scenario.
    const rebuildStart = performance.now();

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
    for (const id of materialDependencyDirtyIds(curr, changedIds)) extraDirty.add(id);
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
      if (e.kind === 'facade_bay') {
        // Issue #102 — Erker is hidden when its host wall's level is hidden.
        const host = curr[e.hostWallId];
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
              wall: e,
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
        case 'facade_bay':
          // Issue #102 — render Erker (bay window) extrusions.
          obj = makeFacadeBayMesh(e, curr, paint);
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
        case 'beam_system': {
          const elev = elevationMForLevel(e.levelId, curr);
          obj = makeBeamSystemMesh(e, elev, paint);
          break;
        }
        case 'brace':
          obj = makeBraceMesh(e, paint);
          break;
        case 'conical_roof':
          obj = buildConicalRoofMesh(e);
          break;
        case 'dome_roof':
          obj = buildDomeRoofMesh(e);
          break;
        case 'spire_roof':
          obj = buildSpireRoofMesh(e);
          break;
        case 'family_blend':
          obj = buildFamilyBlendMesh(e);
          break;
        case 'family_sweep':
          obj = buildFamilySweepMesh(e);
          break;
        case 'mass_box':
          obj = makeMassBoxMesh(e);
          break;
        case 'mass_extrusion':
          obj = makeMassExtrusionMesh(e);
          break;
        case 'mass_revolution':
          obj = makeMassRevolutionMesh(e);
          break;
        case 'ceiling':
          obj = makeCeilingMesh(e, curr, paint);
          break;
        case 'site':
          obj = makeSiteMesh(e, curr, paint);
          break;
        case 'toposolid':
          obj = makeToposolidMesh(e, paint, curr);
          break;
        case 'toposolid_excavation':
          obj = buildExcavationMesh(e, curr);
          break;
        case 'graded_region':
          obj = buildGradedRegionMesh(e);
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
        case 'spot_elevation': {
          if (e.showIn3D === false) break;
          const planView = curr[e.hostViewId];
          const levelId =
            planView && 'levelId' in planView ? (planView as { levelId: string }).levelId : null;
          const level = levelId ? curr[levelId] : null;
          const levelElevMm = level && level.kind === 'level' ? level.elevationMm : 0;
          obj = spotElevationThree(e, levelElevMm);
          break;
        }
        default:
          break;
      }

      if (!obj) continue;

      if (!obj.userData.bimPickId) obj.userData.bimPickId = id;
      applyRenderRole(obj, 'model');
      // Issue #75: an invisible CSG cutter (toposolid_excavation) drives the
      // hole in the host toposolid but must never rasterise itself, and an
      // orphan-balcony authoring placeholder must not be mistaken for real
      // geometry. Honor those flags before applying the category/level
      // visibility gate.
      const isHiddenCutterOrPlaceholder =
        obj.userData.isInvisibleCsgCutter === true || obj.userData.isAuthoringPlaceholder === true;
      obj.visible = !isHiddenCutterOrPlaceholder && !skipCat(e) && !skipLevel(e);

      // FED-01: ghost any element resolved through a `link_model` link.
      // Linked element ids are prefixed `<linkId>::<sourceElemId>` by the
      // snapshot expansion path; that's the load-bearing signal.
      if (id.includes('::')) {
        applyLinkedGhosting(obj);
      }

      // Shadow: site meshes are receivers only.
      const isSite = e.kind === 'site' || e.kind === 'toposolid';
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

    // §12.1.1 — link_ifc ghost rendering.
    // For each visible link_ifc element, build ghost meshes for its linkedElements.
    for (const [id, e] of Object.entries(curr)) {
      if (e.kind !== 'link_ifc') continue;
      const ifcLink = e as Extract<Element, { kind: 'link_ifc' }>;

      // Remove any previously-built ghost meshes for this link's children.
      const ghostPrefix = `${id}::`;
      for (const cachedId of [...cache.keys()]) {
        if (cachedId.startsWith(ghostPrefix)) {
          const old = cache.get(cachedId);
          if (old) {
            root.remove(old);
            old.traverse((node) => {
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
          cache.delete(cachedId);
        }
      }

      if (!ifcLink.visible) continue;

      for (const linkedElem of ifcLink.linkedElements) {
        const ghostId = `${id}::${linkedElem.id}`;
        let ghostObj: THREE.Object3D | null = null;
        switch (linkedElem.kind) {
          case 'wall':
            ghostObj = makeWallMesh(linkedElem, 0, paint, curr);
            break;
          case 'floor':
            ghostObj = makeFloorSlabMesh(linkedElem, curr, paint);
            break;
          case 'roof':
            ghostObj = makeRoofMassMesh(linkedElem, curr, paint);
            break;
          case 'column':
            ghostObj = makeColumnMesh(linkedElem, 0, paint);
            break;
          case 'beam':
            ghostObj = makeBeamMesh(linkedElem, 0, paint);
            break;
          default:
            break;
        }
        if (!ghostObj) continue;
        ghostObj.userData.bimPickId = ghostId;
        applyLinkedGhosting(ghostObj);
        applyRenderRole(ghostObj, 'model');
        cache.set(ghostId, ghostObj);
        root.add(ghostObj);
      }
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
      applyRenderRole(previewObj, 'helper');
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

    // PERF-I04: emit diff sizes + wall-clock to the dev probe.
    recordViewportRebuild({
      addedCount: addedIds.size,
      removedCount: removedIds.size,
      changedCount: changedIds.size,
      extraDirtyCount: extraDirty.size,
      rebuildMs: performance.now() - rebuildStart,
    });
  }, [
    elementsById,
    roofJoinPreview,
    viewerCategoryHidden,
    viewerLevelHidden,
    viewerPhaseFilter,
    activeLensMode,
    theme,
    text3dRebuildTick,
    CSG_ENABLED,
    applyClippingPlanesToMeshes,
    applyLensGhosting,
    applyLinkedGhosting,
    applyModelEdgeDisplay,
    applyRenderRole,
    applySceneCameraPose,
    bimPickMapRef,
    buildConicalRoofMesh,
    buildDomeRoofMesh,
    buildFamilyBlendMesh,
    buildFamilySweepMesh,
    buildGradedRegionMesh,
    buildMassMesh,
    buildSpireRoofMesh,
    cameraRef,
    cameraRigRef,
    clippingPlanesRef,
    computeRootBoundingBox,
    csgBaseFootprintsForWall,
    csgNonceRef,
    csgWallSurfaceMaterialKey,
    csgWorkerRef,
    elemViewerCategory,
    elevationMForLevel,
    getResolvedText3dFont,
    hasAutoFittedRef,
    isElementVisibleUnderPhaseFilter,
    lensFilterFromMode,
    loadText3dFont,
    makeBalconyMesh,
    makeFacadeBayMesh,
    makeBeamMesh,
    makeBeamSystemMesh,
    makeBraceMesh,
    makeCeilingMesh,
    makeColumnMesh,
    makeCurtainWallMesh,
    makeDoorMesh,
    makeDormerMesh,
    makeFamilyInstanceMesh,
    makeFloorSlabMesh,
    makeInternalOriginMarker,
    makeMassBoxMesh,
    makeMassExtrusionMesh,
    makeMassRevolutionMesh,
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
    orbitRigApiRef,
    outlinePassRef,
    paintBundleRef,
    pendingCsgMetaRef,
    pendingCsgRef,
    prevCatHiddenRef,
    prevElementsByIdRef,
    prevLensModeRef,
    prevLevelHiddenRef,
    readToken,
    resolveDoorCutDimensions,
    resolveWindowCutDimensions,
    resolveWindowOutline,
    rootGroupRef,
    selectedIdRef,
    selectedIdsRef,
    setText3dRebuildTick,
    shouldRunWallOpeningCsg,
    spotElevationThree,
    sunRef,
    text3dPendingRef,
    viewerEdgesRef,
    viewerSilhouetteEdgeWidthRef,
    wallPlanOffsetM,
    wallVerticalSpanM,
    wallWith3dJoinDisallowGaps,
    yawForPlanSegment,
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

    const rows = resolveLevelDatum3dRows(modelLevels, activeLevelId, viewerLevelHidden);
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
  }, [
    activeLevelId,
    computeRootBoundingBox,
    direct3dAuthoringActive,
    disposeObject3D,
    levelDatumBoundsFromBox,
    levelDatumGroupRef,
    makeLevelDatum3dGroup,
    modelLevels,
    resolveLevelDatum3dRows,
    rootGroupRef,
    viewerLevelHidden,
  ]);

  // ── OSM site context: fetch neighbouring buildings/roads/trees from Overpass API ──
  useEffect(() => {
    const root = rootGroupRef.current;

    function removePrevious() {
      const prev = osmContextGroupRef.current;
      if (prev) {
        prev.parent?.remove(prev);
        disposeObject3D(prev);
        osmContextGroupRef.current = null;
      }
    }

    if (!root || !georeference) {
      removePrevious();
      setOsmStatus('idle');
      return;
    }

    let cancelled = false;
    setOsmStatus('loading');

    // Derive bbox — new data has explicit bbox fields; old data (contextRadiusM) falls back.
    const bbox =
      georeference.bboxNorth != null
        ? {
            north: georeference.bboxNorth,
            south: georeference.bboxSouth!,
            east: georeference.bboxEast!,
            west: georeference.bboxWest!,
          }
        : (() => {
            const r = georeference.contextRadiusM ?? 300;
            const dLat = r / 111_319.5;
            const dLon = r / (111_319.5 * Math.cos((georeference.anchorLat * Math.PI) / 180));
            return {
              north: georeference.anchorLat + dLat,
              south: georeference.anchorLat - dLat,
              east: georeference.anchorLon + dLon,
              west: georeference.anchorLon - dLon,
            };
          })();
    fetchOsmContext(georeference.anchorLat, georeference.anchorLon, bbox)
      .then((features) => {
        if (cancelled) return;
        const isFirstLoad = !osmContextGroupRef.current;
        removePrevious();
        const group = makeOsmContextGroup(features);
        group.visible = useBimStore.getState().osmVisible;
        root.add(group);
        osmContextGroupRef.current = group;
        setOsmStatus(features.length > 0 ? 'ok' : 'error');
        // Auto-fit camera to show house + context on first load.
        if (isFirstLoad && features.length > 0) {
          const rig = cameraRigRef.current;
          if (rig) {
            const box = computeRootBoundingBox(root);
            if (box) rig.frame(box);
          }
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('[OSM] fetch failed:', err);
        setOsmStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [
    cameraRigRef,
    computeRootBoundingBox,
    disposeObject3D,
    fetchOsmContext,
    georeference,
    makeOsmContextGroup,
    osmContextGroupRef,
    rootGroupRef,
    setOsmStatus,
  ]); // osmLayerHidden/osmVisible intentionally excluded — effects below sync them

  // Sync osmVisible store state → Three.js group visibility.
  useEffect(() => {
    const group = osmContextGroupRef.current;
    if (group) group.visible = osmVisible;
  }, [osmContextGroupRef, osmVisible]);

  // Sync osmLayerHidden store state → individual sub-group visibility.
  useEffect(() => {
    const group = osmContextGroupRef.current;
    if (!group) return;
    group.children.forEach((child) => {
      const layer = child.userData.osmLayer as string | undefined;
      if (layer) child.visible = !osmLayerHidden[layer as keyof typeof osmLayerHidden];
    });
  }, [osmContextGroupRef, osmLayerHidden]);

  // ── F-011: visual style (shaded / wireframe / colors / hidden / realistic / high fidelity) ──
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
          // Shaded / realistic / high fidelity: restore original MeshStandardMaterial.
          if (child.userData.originalMaterial) {
            child.material = child.userData.originalMaterial as THREE.Material;
            delete child.userData.originalMaterial;
          }
          const textureMapsVisible = isTextureRichRenderStyle(viewerRenderStyle);
          applyTextureVisibilityToMesh(child, textureMapsVisible);
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          for (const material of materials) {
            if (!(material instanceof THREE.MeshStandardMaterial)) continue;
            material.wireframe = false;
            if (isTextureRichRenderStyle(viewerRenderStyle)) {
              material.flatShading = false;
            }
            material.needsUpdate = true;
          }
        }
      });
    }
  }, [
    applyTextureVisibilityToMesh,
    bimPickMapRef,
    elementsById,
    isTextureRichRenderStyle,
    viewerRenderStyle,
  ]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.shadowMap.type = isRasterHighFidelityRenderStyle(viewerRenderStyle)
      ? THREE.VSMShadowMap
      : THREE.PCFSoftShadowMap;
    renderer.shadowMap.needsUpdate = true;
  }, [isRasterHighFidelityRenderStyle, rendererRef, viewerRenderStyle]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = Math.pow(2, viewerPhotographicExposureEv);
  }, [rendererRef, viewerPhotographicExposureEv]);

  // ── F-113 + §14.4: background colour / sky environment ───────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    if (!scene || !renderer) return;

    let fogColor: THREE.ColorRepresentation | null = null;

    if (skyBackground === 'gradient-sky') {
      scene.background = new THREE.Color('#87ceeb');
      renderer.setClearColor('#87ceeb', 1);
      fogColor = '#e8f4ff';
    } else if (skyBackground === 'overcast') {
      scene.background = new THREE.Color('#c8c8c8');
      renderer.setClearColor('#c8c8c8', 1);
      fogColor = '#c8c8c8';
    } else if (skyBackground === 'solid') {
      scene.background = new THREE.Color(skyBackgroundColor);
      renderer.setClearColor(skyBackgroundColor, 1);
      fogColor = skyBackgroundColor;
    } else {
      // Let the renderer clear colour drive the default background controls.
      scene.background = null;
      if (viewerBackground === 'light_grey') {
        // Let the CSS sky gradient show through the transparent canvas.
        renderer.setClearColor(0x000000, 0);
        fogColor = '#e8f4fd';
      } else {
        const colorMap: Record<'white' | 'dark', number> = { white: 0xffffff, dark: 0x1a1a2e };
        const color = colorMap[viewerBackground];
        renderer.setClearColor(color, 1);
        fogColor = color;
      }
    }

    scene.fog = viewerDepthCueEnabled && fogColor != null ? new THREE.Fog(fogColor, 28, 140) : null;
  }, [
    rendererRef,
    sceneRef,
    skyBackground,
    skyBackgroundColor,
    viewerBackground,
    viewerDepthCueEnabled,
  ]);

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
  }, [rendererRef, rootGroupRef, sunRef, viewerShadowsEnabled]);

  // ── §14.3: render quality (shadows, tone mapping, pixel ratio) ──
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const { shadowsEnabled, toneMappingExposure, pixelRatioScale } = renderQuality;
    renderer.shadowMap.enabled = shadowsEnabled;
    renderer.shadowMap.type = shadowsEnabled ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = toneMappingExposure;
    const pr =
      pixelRatioScale === '1x'
        ? 1
        : pixelRatioScale === '2x'
          ? 2
          : Math.min(window.devicePixelRatio ?? 1, 2);
    renderer.setPixelRatio(pr);
  }, [renderQuality, rendererRef]);

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
  }, [
    buildPlanOverlay3dGroup,
    disposeObject3D,
    elementsById,
    persistedOrbitViewpoint,
    planOverlayGroupRef,
    readToken,
    sceneRef,
    theme,
  ]);

  useEffect(() => {
    const ssao = ssaoPassRef.current;
    if (!ssao) return;
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ssao.enabled =
      viewerAmbientOcclusionEnabled && !reducedMotion && viewerRenderStyle !== 'hidden-line';
  }, [ssaoPassRef, viewerAmbientOcclusionEnabled, viewerRenderStyle]);

  useEffect(() => {
    const root = rootGroupRef.current;
    if (root) applyModelEdgeDisplay(root, viewerEdges, viewerSilhouetteEdgeWidth);
    const selectedThickness = Math.max(1, viewerSilhouetteEdgeWidth * 1.2);
    if (outlinePassRef.current) outlinePassRef.current.edgeThickness = selectedThickness;
    for (const pass of remoteOutlinePassesRef.current.values()) {
      pass.edgeThickness = selectedThickness;
    }
  }, [
    applyModelEdgeDisplay,
    outlinePassRef,
    remoteOutlinePassesRef,
    rootGroupRef,
    viewerEdges,
    viewerSilhouetteEdgeWidth,
  ]);

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
    // §3.1 — on first activation, restore persisted extent or seed from scene bounding box.
    if (sectionBoxActive && sectionBox && !sectionBoxPrevActiveRef.current) {
      const savedExtent = useBimStore.getState().viewerSectionBoxExtent;
      if (savedExtent) {
        sectionBox.setExtent(savedExtent);
      } else {
        const bbox = computeRootBoundingBox(root);
        if (bbox) {
          sectionBox.setBox(bbox.min, bbox.max);
        }
      }
    }
    sectionBoxPrevActiveRef.current = sectionBoxActive;
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

    // §3.1 — section-box face drag handles (6 orange disc meshes, one per face).
    if (sectionBoxHandleGroupRef.current) {
      root.remove(sectionBoxHandleGroupRef.current);
      sectionBoxHandleGroupRef.current = null;
    }
    if (sectionBoxActive && sectionBox) {
      const handleGroup = new THREE.Group();
      handleGroup.name = 'section-box-handles';
      const handleMat = new THREE.MeshBasicMaterial({
        color: 0xf97316,
        depthTest: false,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
      });
      const faceRotations: [string, number, number, number][] = [
        ['maxX', 0, -Math.PI / 2, 0],
        ['minX', 0, Math.PI / 2, 0],
        ['maxY', -Math.PI / 2, 0, 0],
        ['minY', Math.PI / 2, 0, 0],
        ['maxZ', 0, 0, 0],
        ['minZ', 0, Math.PI, 0],
      ];
      for (const [faceId, rx, ry, rz] of faceRotations) {
        const geom = new THREE.PlaneGeometry(0.15, 0.15);
        const mesh = new THREE.Mesh(geom, handleMat);
        mesh.userData.sectionBoxHandle = faceId;
        mesh.rotation.set(rx, ry, rz);
        handleGroup.add(mesh);
      }
      updateSectionBoxHandles(handleGroup, sectionBox);
      sectionBoxHandleGroupRef.current = handleGroup;
      root.add(handleGroup);
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
  }, [
    aabbWireframeVertices,
    applyClippingPlanesToMeshes,
    clipCapsRef,
    clippingPlanesRef,
    computeRootBoundingBox,
    makeClipPlaneCap,
    readColorToken,
    readToken,
    rendererRef,
    rootGroupRef,
    sceneRef,
    sectionBoxActive,
    sectionBoxCageRef,
    sectionBoxHandleGroupRef,
    sectionBoxPrevActiveRef,
    sectionBoxRef,
    updateSectionBoxHandles,
    viewerClipElevMm,
    viewerClipFloorElevMm,
  ]);

  useEffect(() => {
    const op = outlinePassRef.current;
    if (!op) return;
    const selectedObjects = [selectedId, ...selectedIds]
      .filter((id): id is string => typeof id === 'string')
      .map((id) => bimPickMapRef.current.get(id))
      .filter((obj): obj is THREE.Object3D => Boolean(obj));
    op.selectedObjects = selectedObjects;
  }, [bimPickMapRef, outlinePassRef, selectedId, selectedIds]);

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
  }, [bimPickMapRef, cameraRef, composerRef, remoteOutlinePassesRef, remoteSelections, sceneRef]);

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
  }, [
    buildGripMeshes,
    elementsById,
    gripHandleRef,
    gripPickablesRef,
    gripsFor,
    sceneRef,
    selectedId,
  ]);

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
  }, [
    buildDriftBadgeCanvas,
    driftBadgeTooltip,
    elementBadgeAnchorMm,
    elementsById,
    sceneRef,
    selectDriftedElements,
  ]);

  // WP-B B3 — rebuild 3D group instance meshes when groupRegistry changes.
  useEffect(() => {
    const root = rootGroupRef.current;
    if (!root) return;
    const prev = groupInstanceGroupRef.current;
    if (prev) {
      root.remove(prev);
      groupInstanceGroupRef.current = null;
    }
    if (!groupRegistry) return;
    const { definitions, instances } = groupRegistry;
    const container = new THREE.Group();
    container.name = 'group-instances';
    for (const instance of Object.values(instances)) {
      const definition = definitions[instance.groupDefinitionId];
      if (!definition) continue;
      container.add(
        buildGroupInstance3d(instance, definition, elementsById, paintBundleRef.current),
      );
    }
    groupInstanceGroupRef.current = container;
    root.add(container);
  }, [
    buildGroupInstance3d,
    elementsById,
    groupRegistry,
    groupInstanceGroupRef,
    paintBundleRef,
    rootGroupRef,
  ]);

  // Sync the section-box controller's `active` flag with React state.
  useEffect(() => {
    sectionBoxRef.current?.setActive(sectionBoxActive);
  }, [sectionBoxActive, sectionBoxRef]);

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
  }, [cameraRef, mountRef, walkActive, walkControllerRef, walkLevelsRef]);
}
