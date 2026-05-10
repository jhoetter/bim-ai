import type {
  Element,
  LensMode,
  ModelDelta,
  PerspectiveId,
  Snapshot,
  Violation,
  WorkspaceLayoutPreset,
} from '@bim-ai/core';

import type { FamilyDefinition } from '../families/types';

import type { WallLocationLine } from '../tools/toolGrammar';
import type { PlanPresentationPreset } from '../plan/symbology';
import type {
  PlanProjectionPrimitivesV1Wire,
  PlanCategoryGraphicHintsV0Wire,
  PlanRoomColorLegendRow,
  RoomProgrammeLegendEvidenceV0,
} from '../plan/planProjectionWire';
import type { LevelElevationPropagationEvidenceV0 } from '../workspace/readouts';

export type PlanRoomSchemeWireReadout = {
  roomColorLegendRows: PlanRoomColorLegendRow[];
  programmeLegendEvidence: RoomProgrammeLegendEvidenceV0 | null;
  planCategoryGraphicHintsV0?: PlanCategoryGraphicHintsV0Wire | null;
};

export type ViewerMode = 'plan_canvas' | 'orbit_3d';

export type PlanTool =
  | 'select'
  | 'wall'
  | 'floor'
  | 'floor-sketch'
  | 'roof-sketch'
  | 'room-separation-sketch'
  | 'door'
  | 'window'
  | 'room'
  | 'room_rectangle'
  | 'grid'
  | 'dimension'
  | 'tag'
  | 'elevation'
  | 'reference-plane'
  | 'property-line'
  | 'area-boundary'
  | 'masking-region'
  | 'plan-region'
  | 'align'
  | 'split'
  | 'trim'
  | 'trim-extend'
  | 'wall-join'
  | 'wall-opening'
  | 'shaft'
  | 'column'
  | 'beam'
  | 'ceiling'
  | 'detail-region'
  | 'toposolid_subdivision'
  | 'measure'
  | 'mirror'
  | 'copy'
  | 'component'
  | 'move'
  | 'rotate'
  | 'section';

export type PresencePeers = Record<
  string,
  {
    peerId?: string;
    userId?: string;
    name?: string;
    color?: string;
    cursorMm?: { xMm: number; yMm: number };
    selectionId?: string;
    viewer?: string;
  }
>;

export type UxComment = {
  id: string;
  userDisplay: string;
  body: string;
  elementId?: string | null;
  levelId?: string | null;
  anchorXMm?: number | null;
  anchorYMm?: number | null;
  resolved: boolean;
  createdAt?: string;
};

export type ActivityEvent = {
  id: number;
  userId: string;
  revisionAfter: number;
  createdAt: string;
  commandTypes: string[];
};

export type CategoryOverride = {
  projection?: {
    lineWeightFactor?: number;
    lineColor?: string | null;
    linePattern?: string | null;
    fillColor?: string | null;
    halftone?: boolean;
    transparency?: number;
  };
  cut?: {
    lineWeightFactor?: number;
    lineColor?: string | null;
    linePattern?: string | null;
    fillColor?: string | null;
    halftone?: boolean;
  };
  visible?: boolean;
};

export type CategoryOverrides = Record<string, CategoryOverride>;

export type FilterRule = {
  field: string;
  operator: 'equals' | 'not-equals' | 'contains' | 'not-contains';
  value: string;
};

export type ViewFilter = {
  id: string;
  name: string;
  rules: FilterRule[];
  override: {
    visible?: boolean;
    projection?: {
      lineColor?: string | null;
      lineWeightFactor?: number;
      fillColor?: string | null;
    };
  };
};

export type ViewerCameraActionKind = 'fit' | 'reset';

export type StoreState = {
  modelId?: string;
  revision: number;
  elementsById: Record<string, Element>;
  violations: Violation[];
  selectedId?: string;
  /** F-100: additional IDs in the multi-select set (Ctrl+Click). Does not replace `selectedId`. */
  selectedIds: string[];
  viewerMode: ViewerMode;
  planTool: PlanTool;
  activeLevelId?: string;
  planPresentationPreset: PlanPresentationPreset;
  activePlanViewId?: string;
  /** Saved 3D viewpoint whose clip/layer tweaks should persist via `updateElementProperty`. */
  activeViewpointId?: string;
  /** VIE-03: active `elevation_view` element when the user double-clicks an
   *  elevation marker. Mutually exclusive with `activePlanViewId`. */
  activeElevationViewId?: string;
  /** When set, plan canvas prefers server `planProjectionWire_v1.primitives` (WP-C02/C03). */
  planProjectionPrimitives: PlanProjectionPrimitivesV1Wire | null;
  /** Last plan wire legend + programme digest readout for workbench panels (Prompt-3 room scheme). */
  planRoomSchemeWireReadout: PlanRoomSchemeWireReadout | null;
  /** Active Schedules tab row count for browser rendering budget readout (Prompt-8). */
  scheduleBudgetHydration: { tab: string; rowCount: number } | null;
  /** Latest server `levelElevationPropagationEvidence_v0` after apply (Prompt-1). */
  lastLevelElevationPropagationEvidence: LevelElevationPropagationEvidenceV0 | null;
  /** FED-01 polish: per-source-uuid current revision, used for drift badges. */
  linkSourceRevisions: Record<string, number>;
  viewerClipElevMm: number | null;
  /** Optional lower bound — clips geometry *below* this world Y (mm) for a reproducible slab cut. */
  viewerClipFloorElevMm: number | null;
  /** When true for a semantic kind (`wall`, `roof`, …), that category is hidden in 3D. */
  viewerCategoryHidden: Record<string, boolean>;
  /** F-011: current 3D render style — shaded (default), wireframe, consistent-colors, or hidden-line. */
  viewerRenderStyle: 'shaded' | 'wireframe' | 'consistent-colors' | 'hidden-line';
  /** F-113: 3D viewport background colour. */
  viewerBackground: 'white' | 'light_grey' | 'dark';
  /** F-113: edge display in the 3D viewport. */
  viewerEdges: 'normal' | 'none';
  /** UX-11: 3D camera projection mode surfaced in View controls. */
  viewerProjection: 'perspective' | 'orthographic';
  /** UX-11: section-box clipping is a view-control state, not only a canvas button. */
  viewerSectionBoxActive: boolean;
  /** UX-11: walk mode is launched from View controls instead of canvas chrome. */
  viewerWalkModeActive: boolean;
  /** UX-11: one-shot camera commands issued by right-rail View controls. */
  viewerCameraAction: { kind: ViewerCameraActionKind; nonce: number } | null;
  /** F-014: when true, the plan canvas shows VG-hidden elements (magenta mode). */
  revealHiddenMode: boolean;
  /**
   * SKB-23 — per-phase preview filter. When set, only elements whose
   * `phaseId` is in `viewerPhaseFilter.phases` (or whose `phaseId` is
   * unset, when `includeUntagged` is true) are rendered. Cleared
   * automatically when leaving the active view; not persisted.
   */
  viewerPhaseFilter: {
    phases: string[];
    includeUntagged: boolean;
  } | null;
  wallLocationLine: WallLocationLine;
  applyAreaRules: boolean;
  floorBoundaryOffsetMm: number;
  wallDrawOffsetMm: number;
  wallDrawRadiusMm: number | null;
  wallDrawHeightMm: number;
  activeWallTypeId: string | null;
  activeFloorTypeId: string | null;
  orthoSnapHold: boolean;
  userId: string;
  userDisplayName: string;
  peerId: string;
  presencePeers: PresencePeers;
  comments: UxComment[];
  activityEvents: ActivityEvent[];
  buildingPreset: string;
  planHudMm?: { xMm: number; yMm: number };
  workspaceLayoutPreset: WorkspaceLayoutPreset;
  perspectiveId: PerspectiveId;

  /** Bump to push a saved orbit viewpoint camera into Viewport three.js rig (WP-E02/E03). */
  orbitCameraNonce: number;
  /** Optional camera pose in model mm conventions (plan x/zMm as world-up). */
  orbitCameraPoseMm: {
    position: { xMm: number; yMm: number; zMm: number };
    target: { xMm: number; yMm: number; zMm: number };
    up: { xMm: number; yMm: number; zMm: number };
  } | null;

  hydrateFromSnapshot: (snap: Snapshot) => void;
  applyDelta: (d: ModelDelta) => void;
  select: (id?: string) => void;
  /** F-100: toggle `id` in the multi-select set without changing `selectedId`. */
  toggleSelectedId: (id: string) => void;
  /** F-100: clear the multi-select set. */
  clearSelectedIds: () => void;
  /** FAM-10: paste-side merge — append elements without deleting any. */
  mergeElements: (elements: Element[]) => void;
  /** FAM-10: paste-side family imports. */
  importFamilyDefinitions: (defs: FamilyDefinition[]) => void;
  /** FAM-10: registry of imported user families (cross-project paste). */
  userFamilies?: Record<string, FamilyDefinition>;
  setViewerMode: (m: ViewerMode) => void;
  setPlanTool: (t: PlanTool) => void;
  setActiveLevelId: (id: string | undefined) => void;
  setWallLocationLine: (loc: WallLocationLine) => void;
  setApplyAreaRules: (v: boolean) => void;
  setFloorBoundaryOffsetMm: (mm: number) => void;
  setWallDrawOffsetMm: (v: number) => void;
  setWallDrawRadiusMm: (v: number | null) => void;
  setWallDrawHeightMm: (h: number) => void;
  setActiveWallTypeId: (id: string | null) => void;
  setActiveFloorTypeId: (id: string | null) => void;
  setOrthoSnapHold: (v: boolean) => void;
  setPresencePeers: (peers: PresencePeers) => void;
  setComments: (c: UxComment[]) => void;
  mergeComment: (c: UxComment) => void;
  setBuildingPreset: (preset: string) => void;
  setPlanHud: (mm?: { xMm: number; yMm: number }) => void;
  setWorkspaceLayoutPreset: (p: WorkspaceLayoutPreset) => void;
  setPerspectiveId: (p: PerspectiveId) => void;
  setPlanPresentationPreset: (p: PlanPresentationPreset) => void;
  lensMode: LensMode;
  setLensMode: (m: LensMode) => void;

  activatePlanView: (planViewElementId: string | undefined) => void;
  setActiveViewpointId: (viewpointElementId?: string) => void;
  /** VIE-03: open / close an elevation_view as the central canvas's scope. */
  activateElevationView: (elevationViewElementId: string | undefined) => void;
  setViewerClipElevMm: (mm: number | null) => void;
  setViewerClipFloorElevMm: (mm: number | null) => void;
  setPlanProjectionPrimitives: (p: PlanProjectionPrimitivesV1Wire | null) => void;
  setPlanRoomSchemeWireReadout: (readout: PlanRoomSchemeWireReadout | null) => void;
  setScheduleBudgetHydration: (v: { tab: string; rowCount: number } | null) => void;
  toggleViewerCategoryHidden: (semanticKind: string) => void;
  /** F-011: switch between shaded, wireframe, consistent-colors, and hidden-line render modes. */
  setViewerRenderStyle: (
    style: 'shaded' | 'wireframe' | 'consistent-colors' | 'hidden-line',
  ) => void;
  /** F-113: set 3D viewport background colour. */
  setViewerBackground: (bg: 'white' | 'light_grey' | 'dark') => void;
  /** F-113: set 3D viewport edge display mode. */
  setViewerEdges: (edges: 'normal' | 'none') => void;
  /** UX-11: set 3D camera projection mode. */
  setViewerProjection: (projection: 'perspective' | 'orthographic') => void;
  /** UX-11: set section-box clipping visibility. */
  setViewerSectionBoxActive: (active: boolean) => void;
  /** UX-11: enter or exit 3D walk mode. */
  setViewerWalkModeActive: (active: boolean) => void;
  /** UX-11: request a viewport camera action from chrome outside the canvas. */
  requestViewerCameraAction: (kind: ViewerCameraActionKind) => void;
  /** F-014: enter or exit Reveal Hidden Elements mode. */
  setRevealHiddenMode: (v: boolean) => void;
  /** Apply saved 3D viewpoint clip planes + semantic category hides (WP-E02/E03). */
  applyOrbitViewpointPreset: (opts: {
    capElevMm?: number | null;
    floorElevMm?: number | null;
    hideSemanticKinds?: string[];
  }) => void;
  /** Feed Viewport orbital camera rig from element camera mm payload. */
  setOrbitCameraFromViewpointMm: (opts: {
    position: { xMm: number; yMm: number; zMm: number };
    target: { xMm: number; yMm: number; zMm: number };
    up: { xMm: number; yMm: number; zMm: number };
  }) => void;

  /** OSM-V3-02: when false, neighborhood_mass elements are excluded from plan render. */
  showNeighborhoodMasses: boolean;
  /** OSM-V3-02: toggle neighborhood mass layer visibility. */
  toggleNeighborhoodMasses: () => void;

  /** F-006: QAT Thin Lines toggle — when true, all line weights are overridden to 1 px. */
  thinLinesEnabled: boolean;
  /** F-006: toggle the thin-lines override. */
  toggleThinLines: () => void;

  vvDialogOpen: boolean;
  openVVDialog: () => void;
  closeVVDialog: () => void;
  setCategoryOverride: (
    planViewId: string,
    categoryKey: string,
    override: CategoryOverride,
  ) => void;
  addViewFilter: (planViewId: string, filter: ViewFilter) => void;
  updateViewFilter: (planViewId: string, filterId: string, patch: Partial<ViewFilter>) => void;
  removeViewFilter: (planViewId: string, filterId: string) => void;

  /**
   * VIE-04: client-only temporary visibility override scoped to one view.
   * `mode: 'isolate'` shows only the listed categories / element ids;
   * `mode: 'hide'` hides them. Cleared on view change or explicit reset;
   * never persisted.
   */
  temporaryVisibility: TemporaryVisibility | null;
  setTemporaryVisibility: (next: TemporaryVisibility | null) => void;
  clearTemporaryVisibility: () => void;
  /** SKB-23 — set/clear the per-phase preview filter. */
  setViewerPhaseFilter: (next: { phases: string[]; includeUntagged: boolean } | null) => void;
  clearViewerPhaseFilter: () => void;

  setActivity: (e: ActivityEvent[]) => void;
  setIdentity: (userId: string, display: string, peerId: string) => void;
};

export type TemporaryVisibilityMode = 'isolate' | 'hide';

export type TemporaryVisibility = {
  /** plan_view, viewpoint, or other view scope this override is bound to. */
  viewId: string;
  mode: TemporaryVisibilityMode;
  /** Element kinds (`wall`, `door`, …) covered by the override. */
  categories: string[];
  /** Specific element ids covered by the override. */
  elementIds?: string[];
};

/**
 * VIE-04: returns true when an element of `kind` should be drawn under the
 * given temporary-visibility override. Pass `null` when there's no override
 * active — the helper short-circuits to "visible".
 */
export function isElementVisibleUnderTemporaryVisibility(
  kind: string,
  override: TemporaryVisibility | null,
  elementId?: string,
): boolean {
  if (override === null) return true;
  const inCategorySet = override.categories.includes(kind);
  const inElementSet = elementId ? (override.elementIds ?? []).includes(elementId) : false;
  const inSet = inCategorySet || inElementSet;
  return override.mode === 'isolate' ? inSet : !inSet;
}
