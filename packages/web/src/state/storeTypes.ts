import type {
  Element,
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
import type { LevelElevationPropagationEvidenceV0 } from '../workspace/levelDatumPropagationReadout';

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
  | 'door'
  | 'window'
  | 'room'
  | 'room_rectangle'
  | 'grid'
  | 'dimension'
  | 'elevation'
  | 'reference-plane'
  | 'property-line'
  | 'align'
  | 'split'
  | 'trim'
  | 'wall-join'
  | 'wall-opening'
  | 'shaft'
  | 'column'
  | 'beam'
  | 'ceiling';

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

export type StoreState = {
  modelId?: string;
  revision: number;
  elementsById: Record<string, Element>;
  violations: Violation[];
  selectedId?: string;
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
  viewerClipElevMm: number | null;
  /** Optional lower bound — clips geometry *below* this world Y (mm) for a reproducible slab cut. */
  viewerClipFloorElevMm: number | null;
  /** When true for a semantic kind (`wall`, `roof`, …), that category is hidden in 3D. */
  viewerCategoryHidden: Record<string, boolean>;
  wallLocationLine: WallLocationLine;
  floorBoundaryOffsetMm: number;
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
  setFloorBoundaryOffsetMm: (mm: number) => void;
  setOrthoSnapHold: (v: boolean) => void;
  setPresencePeers: (peers: PresencePeers) => void;
  setComments: (c: UxComment[]) => void;
  mergeComment: (c: UxComment) => void;
  setBuildingPreset: (preset: string) => void;
  setPlanHud: (mm?: { xMm: number; yMm: number }) => void;
  setWorkspaceLayoutPreset: (p: WorkspaceLayoutPreset) => void;
  setPerspectiveId: (p: PerspectiveId) => void;
  setPlanPresentationPreset: (p: PlanPresentationPreset) => void;

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
   * `mode: 'isolate'` shows only the listed categories; `mode: 'hide'` hides
   * them. Cleared on view change or explicit reset; never persisted.
   */
  temporaryVisibility: TemporaryVisibility | null;
  setTemporaryVisibility: (next: TemporaryVisibility | null) => void;
  clearTemporaryVisibility: () => void;

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
};

/**
 * VIE-04: returns true when an element of `kind` should be drawn under the
 * given temporary-visibility override. Pass `null` when there's no override
 * active — the helper short-circuits to "visible".
 */
export function isElementVisibleUnderTemporaryVisibility(
  kind: string,
  override: TemporaryVisibility | null,
): boolean {
  if (override === null) return true;
  const inSet = override.categories.includes(kind);
  return override.mode === 'isolate' ? inSet : !inSet;
}
