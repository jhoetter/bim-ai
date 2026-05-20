import type {
  DimWitnessPoint,
  Element,
  FamilyConstraintElem,
  FloorSlopePoint,
  ViewTemplateControlMatrix,
  XY,
} from './index';

export type FloorElem = Extract<Element, { kind: 'floor' }>;
export type RailingElem = Extract<Element, { kind: 'railing' }>;

export type Violation = {
  ruleId: string;

  severity: 'info' | 'warning' | 'error';

  message: string;

  elementIds?: string[];

  blocking?: boolean;

  quickFixCommand?: Record<string, unknown> | null;

  viewpointRef?: string | null;

  evidenceRefs?: Array<Record<string, unknown>>;

  viewpointEvidence?: Record<string, unknown> | null;

  /** When set (by constraints), Advisor can filter rows by discipline perspective */
  discipline?: string | null;

  priority?: string | null;

  priorityRank?: number | null;

  rootCauseGroupId?: string | null;

  rootCauseGroup?: {
    id?: string;
    family?: string;
  } | null;

  audienceText?: {
    ui?: string;
    agent?: string;
    docs?: string;
  } | null;
};

export type DesignOptionProvenance = {
  submitter: 'agent' | 'human' | 'ci';
  bundleId: string;
  createdAt: number;
};

export type DesignOption = {
  id: string;
  name: string;
  isPrimary?: boolean;
  provenance?: DesignOptionProvenance;
};

export type DesignOptionSet = {
  id: string;
  name: string;
  options: DesignOption[];
};

export type CommandBundle = {
  schemaVersion: 'cmd-v3.0';
  commands: Command[];
  assumptions: AssumptionEntry[];
  parentRevision: number;
  targetOptionId?: string;
  tolerances?: { advisoryClass: string; reason: string }[] | null;
};

export type Snapshot = {
  modelId: string;

  revision: number;

  elements: Record<string, unknown>;

  violations: Violation[];

  /**
   * FED-01 polish: per-source-uuid current revision for every `link_model`
   * row, used by the UI to render drift badges on pinned links. Omitted when
   * the host has no links.
   */
  linkSourceRevisions?: Record<string, number>;

  /** KRN-V3-04: design option sets for this document. */
  designOptionSets?: DesignOptionSet[];
};

/** Server delta payload (camelCase aliases). */
export type ModelDelta = {
  revision: number;

  removedIds: string[];

  elements: Record<string, unknown>;

  violations: Violation[];

  clientOpId?: string;
};

export type Command = Record<string, unknown> & {
  type: string;
};

/** WP-A §8.1.1: attach/detach wall top to a host roof/floor/ceiling. */
export type AttachWallTopCmd = { type: 'attach_wall_top'; wallId: string; hostId: string };
export type DetachWallTopCmd = { type: 'detach_wall_top'; wallId: string };

/** §3.4.1: attach a floor's top face to a roof underside. roofId='' to detach. */
export type AttachFloorToRoofCmd = {
  type: 'attach_floor_to_roof';
  floorId: string;
  roofId: string;
};

/** WP-B: update the curtain wall grid configuration on a wall element. */
export type UpdateCurtainGridCmd = {
  type: 'update_curtain_grid';
  wallId: string;
  hGridCount?: number;
  vGridCount?: number;
  panelType?: string;
  mullionType?: string;
};

/**
 * SKB-02 — auto-extract walls + floor + roof-stub from a `mass` element.
 * The engine emits one wall per footprint segment, one floor matching
 * the footprint at level base, and one flat roof at level base + heightMm,
 * promotes phase to `'skeleton'` on emitted elements, and deletes the mass.
 */
export type MaterializeMassToWallsCmd = {
  type: 'materializeMassToWalls';
  massId: string;
};

/** §5.1.1: patch heightSamples, thicknessMm, or baseElevationMm on a toposolid element. */
export type UpdateToposolidCmd = {
  type: 'update_toposolid';
  id: string;
  patch: Partial<
    Pick<
      Extract<Element, { kind: 'toposolid' }>,
      'heightSamples' | 'thicknessMm' | 'baseElevationMm'
    >
  >;
};

/** §9.3: patch spacing, direction, count, type, or justification on a beam_system element. */
export type UpdateBeamSystemCmd = {
  type: 'update_beam_system';
  id: string;
  patch: Partial<
    Pick<
      Extract<Element, { kind: 'beam_system' }>,
      'spacingMm' | 'directionDeg' | 'beamCount' | 'beamTypeId' | 'justification'
    >
  >;
};

/** §1.6.7: patch name, layers, or basisLine on a wall_type / floor_type / roof_type element. */
export type UpdateWallTypeCmd = {
  type: 'update_wall_type';
  id: string;
  patch: Partial<Omit<Extract<Element, { kind: 'wall_type' }>, 'kind' | 'id'>>;
};

/** §3.3.6: split a wall at a point on its centreline, yielding two walls. */
export type SplitWallCmd = {
  type: 'split_wall';
  wallId: string;
  /** The point on the wall centreline where the split occurs, in mm. */
  splitPointMm: XY;
};

/** §3.5.5: override the join variant for a pair of walls at a shared corner. */
export type SetWallJoinCmd = {
  type: 'setWallJoin';
  /** IDs of the two walls whose join is being overridden */
  wallIds: [string, string];
  variant: 'miter' | 'butt' | 'square';
};

/** §6.4.2: add a detail_line element (view-local 2D polyline). */
export type AddDetailLineCmd = {
  type: 'addDetailLine';
  element: Extract<Element, { kind: 'detail_line' }>;
};

/** §6.4.2: add a detail_filled_region element (view-local 2D filled region). */
export type AddDetailFilledRegionCmd = {
  type: 'addDetailFilledRegion';
  element: Extract<Element, { kind: 'detail_filled_region' }>;
};

/** §6.4.2: remove a detail drafting element. */
export type RemoveDetailElementCmd = {
  type: 'removeDetailElement';
  elementId: string;
};

/** Evidence-package subtree: deterministic PNG inventory + digest hygiene (WP-F02/F03). */
export type CorrelationDigestConsistencyV1 = {
  format: 'correlationDigestConsistency_v1';

  staleRowsRelativeToPackageDigest: Record<string, unknown>[];

  rowsMissingCorrelationDigest: { kind: string; id: string }[];

  isFullyConsistent: boolean;
};

export type EvidencePixelDiffExpectationV1 = {
  format: 'pixelDiffExpectation_v1';

  status: string;

  baselineRole?: string;

  diffArtifactBasenameSuffix?: string;

  metricsPlaceholder?: Record<string, number | null>;

  thresholdPolicy_v1?: {
    format: 'pixelDiffThresholdPolicy_v1';
    enforcement?: string;
    mismatchPixelRatioFailAbove?: number;
    maxChannelDeltaFailAbove?: number;
    notes?: string;
  };

  notes?: string;
};

export type EvidenceClosureReviewV1 = {
  format: 'evidenceClosureReview_v1';

  packageSemanticDigestSha256: string;

  expectedDeterministicPngBasenames: string[];

  primaryScreenshotArtifactCount: number;

  correlationDigestConsistency: CorrelationDigestConsistencyV1;

  pixelDiffExpectation: EvidencePixelDiffExpectationV1;
};

export type { PerspectiveId, WorkspaceLayoutPreset } from './workbench';

// ---------------------------------------------------------------------------
// VIE-V3-03 — View template v3 named types
// ---------------------------------------------------------------------------

export type ViewTemplate = {
  kind: 'view_template';
  id: string;
  name: string;
  scale?: number;
  detailLevel?: 'coarse' | 'medium' | 'fine';
  cropDefault?: Record<string, unknown>;
  visibilityFilters?: unknown[];
  elementOverrides?: Array<{ categoryOrId: string; alternateRender: string }>;
  phase?: string;
  phaseFilter?: string;
  templateControlMatrix?: ViewTemplateControlMatrix;
};

export type ViewTemplatePropagation = {
  event: 'ViewTemplatePropagation';
  templateId: string;
  affected: string[];
  unbound: string[];
};

// ---------------------------------------------------------------------------
// COL-V3-01 — collab session types
// ---------------------------------------------------------------------------

export type {
  ParticipantRole,
  Participant,
  CollabSession,
  InFlightCommand,
  CollabAwarenessState,
  CollabPresenceState,
} from './collab';
export { PARTICIPANT_COLOR_TOKENS, participantColorToken } from './collab';

// ---------------------------------------------------------------------------
// COL-V3-02 — permission tiers
// ---------------------------------------------------------------------------

export type Role = 'admin' | 'editor' | 'viewer' | 'public-link-viewer';

export type RoleAssignment = {
  id: string;
  modelId: string;
  subjectKind: 'user' | 'public-link';
  subjectId: string;
  role: Role;
  grantedBy: string;
  grantedAt: number;
  expiresAt?: number;
};

export type PublicLink = {
  id: string;
  modelId: string;
  token: string;
  createdBy: string;
  createdAt: number;
  expiresAt?: number;
  isRevoked: boolean;
  displayName?: string;
  openCount: number;
};

// ---------------------------------------------------------------------------
// OUT-V3-01 — Live presentation link
// ---------------------------------------------------------------------------

export type PresentationLink = {
  kind: 'presentation_link';
  id: string;
  modelId: string;
  pageScopeIds: string[];
  token: string;
  permission: 'viewer';
  allowMeasurement: boolean;
  allowComment: boolean;
  expiresAt?: number;
  createdAt: number;
  revokedAt?: number;
};

// ---------------------------------------------------------------------------
// TKN-V3-01 — tokenised kernel representation
// ---------------------------------------------------------------------------

export type TknScale = { x: number; y: number; z: number };

export type EntityToken = {
  elementId: string;
  hostId: string;
  hostKind: 'wall' | 'floor' | 'roof' | 'level' | 'room';
  tAlongHost: number;
  offsetNormalMm: number;
  scale: TknScale;
  rotationRad: number;
  classKey: string;
  catalogKey?: string | null;
};

export type EnvelopeToken = {
  roomId: string;
  roomTypeKey: string;
  layoutAttrs: Record<string, number | string>;
  hostWallIds: string[];
  hostFloorId: string | null;
  doorIds: string[];
  windowIds: string[];
};

export type TokenSequence = {
  schemaVersion: 'tkn-v3.0';
  envelopes: EnvelopeToken[];
  entities: EntityToken[];
};

export type TokenSequenceDelta = {
  addedEnvelopes: { envelope: EnvelopeToken }[];
  removedEnvelopes: { roomId: string }[];
  modifiedEnvelopes: { before: EnvelopeToken; after: EnvelopeToken }[];
  addedEntities: { entity: EntityToken }[];
  removedEntities: { elementId: string }[];
  modifiedEntities: { before: EntityToken; after: EntityToken }[];
};

// ---------------------------------------------------------------------------
// CMD-V3-02 — AgentTrace + AssumptionEntry
// ---------------------------------------------------------------------------

/** CMD-V3-02: provenance trace stamped on every element created/modified by a bundle. */
export type AgentTrace = {
  bundleId: string;
  assumptionKeys: string[];
  appliedAt: string;
};

/** CMD-V3-02: one assumption entry in a CommandBundle's assumptions array. */
export type AssumptionEntry = {
  key: string;
  value: string | number | boolean;
  confidence: number;
  source: string;
  contestable?: boolean;
  evidence?: string | null;
};

/** CHR-V3-03 — workspace-level status-bar discipline filter (LNS-V3-01 UI). */
export type LensMode =
  | 'all'
  | 'architecture'
  | 'structure'
  | 'mep'
  | 'fire-safety'
  | 'cost-quantity'
  | 'energy'
  | 'coordination'
  | 'construction'
  | 'sustainability';

/** DSC-V3-02 — per-view discipline lens stored on view elements. */
export type ViewLensMode =
  | 'show_arch'
  | 'show_struct'
  | 'show_mep'
  | 'show_fire_safety'
  | 'show_cost_quantity'
  | 'show_all';

/** LNS-V3-01/DSC-V3-02 — undoable command dispatched by the lens dropdown. */
export type SetViewLensCmd = { type: 'set_view_lens'; viewId: string; lens: ViewLensMode };

// ---------------------------------------------------------------------------
// SCH-V3-01 — Custom property definition
// ---------------------------------------------------------------------------

/** SCH-V3-01 — project-scoped custom property definition. */
export type PropertyDefinitionElem = {
  kind: 'property_definition';
  id: string;
  key: string;
  label: string;
  propKind: 'mm' | 'm2' | 'currency' | 'enum' | 'string' | 'bool' | 'date';
  enumValues?: string[];
  defaultValue?: unknown;
  appliesTo: string[];
  showInSchedule: boolean;
};

/** SCH-V3-01 — V3 schedule-view element (extends the existing schedule kind). */
export type ScheduleViewElem = {
  kind: 'schedule';
  id: string;
  name: string;
  category: string;
  columns: Array<{ fieldKey: string; label: string; width?: number }>;
  filterExpr?: string | null;
  sortKey?: string | null;
  sortDir?: 'asc' | 'desc' | null;
};

// ---------------------------------------------------------------------------
// ANN-V3-01 — Detail-region drawing-mode authoring
// ---------------------------------------------------------------------------

export type DetailRegionElem = {
  kind: 'detail_region';
  id: string;
  viewId: string;
  vertices: Array<{ x: number; y: number }>;
  closed: boolean;
  hatchId?: string | null;
  lineweightOverride?: number | null;
  phaseCreated?: string | null;
  phaseDemolished?: string | null;
};

/** Transient: live-preview vertices before commit. Never persisted. */
export type DraftDetailRegionElem = {
  kind: 'draft_detail_region';
  viewId: string;
  vertices: Array<{ x: number; y: number }>;
  closed: boolean;
  hatchId?: string | null;
};

// ---------------------------------------------------------------------------
// EDT-V3-06 — Helper dimension descriptor
// ---------------------------------------------------------------------------

export type HelperDimensionDescriptor = {
  id: string;
  label: string;
  valueMm: number;
  /** Start and end points in plan mm coordinates, for drawing the dimension line. */
  fromPoint: XY;
  toPoint: XY;
  /** Called when user commits a new value; returns the command to dispatch. */
  onCommit: (newValueMm: number) => Record<string, unknown>;
  /** When true the chip is display-only and clicking it does nothing. */
  readOnly?: boolean;
};

/** Convenience alias — the full BimElem union (same as Element). */
export type BimElem = Element;

// ---------------------------------------------------------------------------
// IMP-V3-01 — Image-as-underlay element + commands
// ---------------------------------------------------------------------------

export type ImageUnderlayElem = {
  kind: 'image_underlay';
  id: string;
  src: string;
  rectMm: { xMm: number; yMm: number; widthMm: number; heightMm: number };
  rotationDeg: number;
  opacity: number;
  lockedScale: boolean;
};

export type ImportImageUnderlayCmd = {
  type: 'import_image_underlay';
  id: string;
  src: string;
  rectMm: { xMm: number; yMm: number; widthMm: number; heightMm: number };
  rotationDeg?: number;
  opacity?: number;
  lockedScale?: boolean;
};

export type MoveImageUnderlayCmd = {
  type: 'move_image_underlay';
  id: string;
  rectMm: { xMm: number; yMm: number; widthMm: number; heightMm: number };
};

export type ScaleImageUnderlayCmd = {
  type: 'scale_image_underlay';
  id: string;
  widthMm: number;
  heightMm: number;
};

export type RotateImageUnderlayCmd = {
  type: 'rotate_image_underlay';
  id: string;
  rotationDeg: number;
};

export type DeleteImageUnderlayCmd = { type: 'delete_image_underlay'; id: string };

// ---------------------------------------------------------------------------
// VG-V3-01 — Render-and-compare result type
// ---------------------------------------------------------------------------

export type CompareResult = {
  schemaVersion: 'vg-v3.0';
  metric: 'ssim' | 'mse' | 'pixel-diff';
  score: number;
  thresholdPassed?: boolean;
  perRegionScores: Record<string, number>;
  prePngPath: string;
  postPngPath: string;
  diffPngPath: string;
};

// ---------------------------------------------------------------------------
// CTL-V3-01 — Catalog query types
// ---------------------------------------------------------------------------

export type CatalogQuery = {
  kind?: string;
  maxWidthMm?: number;
  minWidthMm?: number;
  tag?: string;
  style?: string;
  page?: number;
  pageSize?: number;
};

export type CatalogQueryResult = {
  schemaVersion: 'ctl-v3.0';
  items: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
};

// ---------------------------------------------------------------------------
// OUT-V3-02 — Presentation canvas, frames, saved views
// ---------------------------------------------------------------------------

export type FrameElem = {
  kind: 'frame';
  id: string;
  presentationCanvasId: string;
  viewId: string;
  positionMm: { xMm: number; yMm: number };
  sizeMm: { widthMm: number; heightMm: number };
  caption?: string;
  brandTemplateId?: string;
  sortOrder: number;
};

export type SavedViewElem = {
  kind: 'saved_view';
  id: string;
  baseViewId: string;
  name: string;
  isLocked?: boolean;
  cameraState?: Record<string, unknown>;
  visibilityOverrides?: Record<string, unknown>;
  detailLevel?: string;
  thumbnailDataUri?: string;
};

/** §15.1.2 — family editor extrusion form. profilePoints are in mm (local XY plane). */
export type FamilyExtrusion = {
  kind: 'family_extrusion';
  id: string;
  profilePoints: { x: number; y: number }[];
  depthMm: number;
  /** When this extrusion represents a frame, inner cavity width subtracted from outer to form the frame. */
  frameInnerWidthMm?: number;
  /** Sill depth for window frame (Z offset). */
  frameSillDepthMm?: number;
  /** Whether this extrusion represents a glazing panel. */
  isGlazing?: boolean;
  /** Material key for glazing. */
  glazingMaterialKey?: string;
};

/** §15.1.3 — family editor revolve form. profilePoints are in mm; axis is the revolution axis. */
export type FamilyRevolve = {
  kind: 'family_revolve';
  id: string;
  profilePoints: { x: number; y: number }[];
  axisMm: { x: number; z: number };
  angleDeg: number;
};

/** §15.1.x — family editor void cut form. Renders as a wireframe to indicate a subtracted volume. */
export type FamilyVoid = {
  kind: 'family_void';
  id: string;
  profilePoints: { x: number; y: number }[];
  depthMm: number;
};

/** §15.1.3: family sweep — profile extruded along a path curve. */
export type FamilySweep = {
  kind: 'family_sweep';
  id: string;
  /** 2D profile polygon (mm) — cross-section shape. */
  profilePoints: { x: number; y: number }[];
  /** Path control points (mm) in 3D — the sweep spine. */
  pathPoints: { x: number; y: number; z: number }[];
};

/** §15.1.4: family blend — transition between two 2D profiles at different elevations. */
export type FamilyBlend = {
  kind: 'family_blend';
  id: string;
  /** Bottom profile polygon (mm). */
  bottomProfilePoints: { x: number; y: number }[];
  /** Top profile polygon (mm). */
  topProfilePoints: { x: number; y: number }[];
  /** Blend height in mm. */
  heightMm: number;
};

/** §15.1.2: family swept blend — solid swept along a path while interpolating between two profiles. */
export interface FamilySweptBlend {
  id: string;
  kind: 'family_swept_blend';
  /** Start profile polygon in local XY plane */
  startProfileMm: Array<{ xMm: number; yMm: number }>;
  /** End profile polygon in local XY plane (may have different shape/size) */
  endProfileMm: Array<{ xMm: number; yMm: number }>;
  /** Path points that the cross-section is swept along */
  pathMm: Array<{ xMm: number; yMm: number; zMm?: number }>;
  baseElevationMm?: number;
  materialKey?: string;
}

export type WalkthroughKeyframe = {
  positionMm: { x: number; y: number; z: number };
  targetMm: { x: number; y: number; z: number };
  fovDeg: number;
  /** Playback time in seconds from the start of the path. */
  timeSec: number;
};

export type CameraPathElem = {
  kind: 'camera_path';
  id: string;
  name: string;
  keyframes: WalkthroughKeyframe[];
};

export type CreateCameraPathCmd = {
  type: 'create_camera_path';
  id: string;
  name: string;
  keyframes: WalkthroughKeyframe[];
};

export type PresentationCanvasElem = {
  kind: 'presentation_canvas';
  id: string;
  name: string;
  frameIds: string[];
};

export type CreateFrameCmd = {
  type: 'create_frame';
  id: string;
  presentationCanvasId: string;
  viewId: string;
  positionMm: { xMm: number; yMm: number };
  sizeMm: { widthMm: number; heightMm: number };
  caption?: string;
  brandTemplateId?: string;
  sortOrder?: number;
};

export type UpdateFrameCmd = {
  type: 'update_frame';
  id: string;
  caption?: string;
  positionMm?: { xMm: number; yMm: number };
  sizeMm?: { widthMm: number; heightMm: number };
  sortOrder?: number;
};

export type DeleteFrameCmd = { type: 'delete_frame'; id: string };

export type ReorderFrameCmd = { type: 'reorder_frame'; id: string; newSortOrder: number };

/** CHR-V3-07 — move a viewpoint or saved_view to a new sort position in the project browser. */
export type ReorderViewCmd = {
  type: 'reorder_view';
  viewId: string;
  newSortOrder: number;
};

export type CreateSavedViewCmd = {
  type: 'create_saved_view';
  id: string;
  baseViewId: string;
  name: string;
  cameraState?: Record<string, unknown>;
  visibilityOverrides?: Record<string, unknown>;
  detailLevel?: string;
};

export type UpdateSavedViewCmd = {
  type: 'update_saved_view';
  id: string;
  name?: string;
  cameraState?: Record<string, unknown>;
  visibilityOverrides?: Record<string, unknown>;
  detailLevel?: string;
  thumbnailDataUri?: string;
  isLocked?: boolean;
};

export type DeleteSavedViewCmd = { type: 'delete_saved_view'; id: string };

export type CreatePresentationCanvasCmd = {
  type: 'create_presentation_canvas';
  id: string;
  name: string;
};

export type UpdatePresentationCanvasCmd = {
  type: 'update_presentation_canvas';
  id: string;
  name?: string;
};

// ---------------------------------------------------------------------------
// OUT-V3-03 — BrandTemplate element + export types
// ---------------------------------------------------------------------------

export type BrandTemplateElem = {
  kind: 'brand_template';
  id: string;
  name: string;
  accentHex: string;
  accentForegroundHex: string;
  typeface: string;
  logoMarkSvgUri?: string;
  cssOverrideSnippet?: string;
};

export type CreateBrandTemplateCmd = {
  type: 'create_brand_template';
  id: string;
  name: string;
  accentHex: string;
  accentForegroundHex: string;
  typeface?: string;
  logoMarkSvgUri?: string;
  cssOverrideSnippet?: string;
};

export type UpdateBrandTemplateCmd = {
  type: 'update_brand_template';
  id: string;
  name?: string;
  accentHex?: string;
  accentForegroundHex?: string;
  typeface?: string;
  logoMarkSvgUri?: string;
  cssOverrideSnippet?: string;
};

export type DeleteBrandTemplateCmd = { type: 'delete_brand_template'; id: string };

export type BrandedExportBundle = {
  schemaVersion: 'out-v3.0';
  format: 'pdf' | 'pptx';
  brandTemplateId?: string;
  brandLayer?: {
    accentHex: string;
    accentForegroundHex: string;
    typeface: string;
    logoMarkSvgUri?: string;
    cssOverrideSnippet?: string;
  };
  sheets: Array<{ sheetId: string; name: string }>;
  invariantCheck: 'layer-c-only';
};

// ---------------------------------------------------------------------------
// EXP-V3-01 — Render-pipeline export types
// ---------------------------------------------------------------------------

export type RenderExportFormat = 'gltf' | 'gltf-pbr' | 'ifc-bundle' | 'metadata-only';

export type RenderExportBundle = {
  schemaVersion: 'exp-v3.0';
  format: RenderExportFormat;
  primaryAsset?: { kind: string; pathInArchive: string };
  metadata: {
    cameras: Array<{
      viewId: string;
      positionMm: { xMm: number; yMm: number; zMm: number };
      targetMm: { xMm: number; yMm: number; zMm: number };
      fovDeg: number;
    }>;
    sunSettings: { azimuthDeg: number; elevationDeg: number; intensity: number };
    materials: Array<{ id: string; pbr: Record<string, unknown> }>;
    annotations: Array<{
      id: string;
      text: string;
      positionMm: { xMm: number; yMm: number; zMm: number };
    }>;
  };
  exportTimestamp: string;
};

// ---------------------------------------------------------------------------
// D6 — Sheet Revision Management commands
// ---------------------------------------------------------------------------

export type CreateRevisionCmd = {
  type: 'create_revision';
  id: string;
  number: string;
  date: string;
  description: string;
  issuedBy?: string;
  issuedTo?: string;
};

export type UpdateRevisionCmd = {
  type: 'update_revision';
  id: string;
  number?: string;
  date?: string;
  description?: string;
  issuedBy?: string;
  issuedTo?: string;
};

export type DeleteRevisionCmd = { type: 'delete_revision'; id: string };

export type AddSheetRevisionCmd = {
  type: 'add_sheet_revision';
  id: string;
  sheetId: string;
  revisionId: string;
};

export type RemoveSheetRevisionCmd = {
  type: 'remove_sheet_revision';
  id: string;
};

// ---------------------------------------------------------------------------
// D2 — Interior Elevation Marker command
// ---------------------------------------------------------------------------

export type CreateInteriorElevationMarkerCmd = {
  type: 'create_interior_elevation_marker';
  id: string;
  positionMm: { xMm: number; yMm: number };
  levelId: string;
  /** Half-extent of crop box in mm. Defaults to 3000 on the server. */
  radiusMm?: number;
};

// ---------------------------------------------------------------------------
// §9.5.1 — Steel connection commands
// ---------------------------------------------------------------------------

export type CreateSteelConnectionCmd = {
  type: 'create_steel_connection';
  id: string;
  hostElementId: string;
  connectionType: 'end_plate' | 'bolted_flange' | 'shear_tab';
  targetElementId?: string;
  positionT?: number;
};

export type UpdateSteelConnectionCmd = {
  type: 'update_steel_connection';
  id: string;
  patch: Partial<Omit<Extract<Element, { kind: 'steel_connection' }>, 'kind' | 'id'>>;
};

export type SetBeamSectionProfileCmd = {
  type: 'setBeamSectionProfile';
  beamId: string;
  /** ID of a beam_section_profile element, or null to reset to the default section. */
  profileId: string | null;
};

export type CreatePermanentDimensionCmd = {
  type: 'create_permanent_dimension';
  id: string;
  levelId: string;
  witnessPointsMm: DimWitnessPoint[];
  offsetMm: XY;
};

/** §4.1 — Auto-dimension all walls on a level with permanent_dimension elements. */
export type AutoDimensionWallsCmd = {
  type: 'autoDimensionWalls';
  levelId: string | null;
  offsetMm?: number;
};

/** §4.2.6 — Stack parallel permanent_dimension elements at even spacing offsets. */
export type StackDimensionsCmd = {
  type: 'stackDimensions';
  /** IDs of the permanent_dimension elements to stack. If empty, stacks all in active view. */
  dimensionIds?: string[];
  /** Spacing between stacked dim lines in mm. Default 7. */
  spacingMm?: number;
};

// ---------------------------------------------------------------------------
// COL-V3-06 — Offline-tolerant authoring: display-only sync badge type
// ---------------------------------------------------------------------------

/**
 * COL-V3-06: display-only badge shown in the status bar when commands have
 * been queued while offline and are awaiting sync on reconnect.
 * Not a kernel element; not part of the Command union.
 */
export type OfflineSyncBadge = {
  kind: 'offline_sync_badge';
  commandCount: number;
  offlineQueuedAt: string;
  syncedAt: string;
};

// ---------------------------------------------------------------------------
// §3.3.4 — Paint tool: face material override command
// ---------------------------------------------------------------------------

export type PaintFaceCmd = {
  type: 'paint_face';
  elementId: string;
  /** Face identifier string, e.g. 'front' | 'back' | 'top' | 'bottom'. */
  faceId: string;
  /** materialId to apply, or null to remove the override (restore to type default). */
  materialId: string | null;
};

// ---------------------------------------------------------------------------
// §3.3.7 — Paint surface: per-face material override commands (Wave 26 WP-A)
// ---------------------------------------------------------------------------

export type PaintFaceSurfaceCmd = {
  type: 'paintFace';
  elementId: string;
  /** Face identifier: 'front' | 'back' | 'top' | 'bottom' | 'inner' | 'outer' */
  faceKey: string;
  materialKey: string;
};

export type UnpaintFaceCmd = {
  type: 'unpaintFace';
  elementId: string;
  faceKey: string;
};

/** Per-category visual overrides for the plan view (§2.1.4). */
export interface CategoryVisualOverride {
  hidden?: boolean;
  /** Hex colour string, e.g. '#2563eb'. null = use default. */
  colorHex?: string | null;
  /** Line weight in px (0.5–4). null = use default. */
  lineWeightPx?: number | null;
}

export type UpdateCategoryOverrideCmd = {
  type: 'update_category_override';
  planViewId: string;
  category: string;
  /** null = clear override for this category. */
  patch: CategoryVisualOverride | null;
};

// ---------------------------------------------------------------------------
// §6.1.3 — Named / locked 3D views
// ---------------------------------------------------------------------------

export interface Saved3dViewElement {
  kind: 'saved_3d_view';
  id: string;
  name: string;
  cameraMm: { x: number; y: number; z: number };
  targetMm: { x: number; y: number; z: number };
  upVector?: { x: number; y: number; z: number } | null;
  locked?: boolean | null;
  sectionBox?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  } | null;
  /** §14.5 — true = perspective camera view, false/null = orthographic */
  perspective?: boolean | null;
  /** §14.5 — perspective field of view in degrees (default 60) */
  fovDeg?: number | null;
}

export type Save3dViewCmd = { type: 'save_3d_view'; name: string };
export type Restore3dViewCmd = { type: 'restore_3d_view'; viewId: string };
export type Delete3dViewCmd = { type: 'delete_3d_view'; viewId: string };
export type ToggleLock3dViewCmd = { type: 'toggle_3d_view_lock'; viewId: string };
export type Rename3dViewCmd = { type: 'rename_3d_view'; viewId: string; name: string };

// ---------------------------------------------------------------------------
// §7.1.1 — Model Lines (project-environment polyline, visible in all plan views)
// ---------------------------------------------------------------------------

export type ModelLineElement = {
  kind: 'model_line';
  id: string;
  name?: string;
  /** Polyline vertices in plan millimetres (world coords — not view-local). */
  pointsMm: { xMm: number; yMm: number }[];
  levelId: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted' | null;
  colourHex?: string | null;
  strokeMm?: number | null;
};

export type CreateModelLineCmd = {
  type: 'create_model_line';
  id: string;
  levelId: string;
  pointsMm: { xMm: number; yMm: number }[];
  lineStyle?: 'solid' | 'dashed' | 'dotted' | null;
  colourHex?: string | null;
};

/** §2.1.3 — Place or move the project base point on the plan. */
export type CreateProjectBasePointCmd = {
  type: 'createProjectBasePoint';
  id: string;
  /** Position in plan (mm from project origin). */
  positionMm: { xMm: number; yMm: number };
  /** Elevation above datum (mm). */
  elevationMm: number;
  /** True if base point represents shared (survey) coordinates. */
  isShared?: boolean;
  /** Optional user label. */
  name?: string | null;
};

// ---------------------------------------------------------------------------
// §10.3.1-3 — Conical / Dome / Spire roof shapes
// ---------------------------------------------------------------------------

export type CreateConicalRoofCmd = {
  type: 'create_conical_roof';
  id: string;
  centerMm: { xMm: number; yMm: number };
  baseRadiusMm: number;
  heightMm: number;
  baseElevationMm: number;
  materialId?: string | null;
};

export type CreateDomeRoofCmd = {
  type: 'create_dome_roof';
  id: string;
  centerMm: { xMm: number; yMm: number };
  baseRadiusMm: number;
  riseRatio: number;
  baseElevationMm: number;
  materialId?: string | null;
};

export type CreateSpireRoofCmd = {
  type: 'create_spire_roof';
  id: string;
  centerMm: { xMm: number; yMm: number };
  baseRadiusMm: number;
  heightMm: number;
  baseElevationMm: number;
  materialId?: string | null;
};

// ---------------------------------------------------------------------------
// §15.1.2 — Family Editor Blend + Sweep Forms
// ---------------------------------------------------------------------------

export type CreateFamilyBlendCmd = {
  type: 'create_family_blend';
  id: string;
  bottomProfileMm: { xMm: number; yMm: number }[];
  topProfileMm: { xMm: number; yMm: number }[];
  heightMm: number;
  baseElevationMm: number;
  materialId?: string | null;
};

export type CreateFamilySweepCmd = {
  type: 'create_family_sweep';
  id: string;
  profileMm: { xMm: number; yMm: number }[];
  pathMm: { xMm: number; yMm: number; zMm: number }[];
  materialId?: string | null;
};

/** §3.3.6 Scale tool — uniform scale of selected elements about a base point. */
export type ScaleElementsCmd = {
  type: 'scaleElements';
  elementIds: string[];
  basePtMm: { xMm: number; yMm: number };
  scaleFactor: number;
};

/** §15.1.3: add a new family parameter to the current family. */
export type AddFamilyParameterCmd = {
  type: 'addFamilyParameter';
  parameter: Extract<Element, { kind: 'family_parameter' }>;
};

/** §15.1.3: remove a family parameter by id. */
export type DeleteFamilyParameterCmd = {
  type: 'deleteFamilyParameter';
  parameterId: string;
};

/** §15.1.3: update the default value of a family parameter. */
export type SetFamilyParameterValueCmd = {
  type: 'setFamilyParameterValue';
  parameterId: string;
  value: number | boolean | string;
};

/** §15.1.3: add a new family constraint (reference-plane-driven geometry). */
export type AddFamilyConstraintCmd = {
  type: 'addFamilyConstraint';
  constraint: FamilyConstraintElem;
};

/** §15.1.3: remove a family constraint by id. */
export type RemoveFamilyConstraintCmd = {
  type: 'removeFamilyConstraint';
  constraintId: string;
};

/** §15.1.3: add a new reference plane element to a family definition. */
export type AddFamilyReferencePlaneCmd = {
  type: 'addFamilyReferencePlane';
  familyId: string;
  name: string;
  axis: 'x' | 'z';
  offsetMm: number;
  isReference?: boolean;
};

/** §5.4.2: set the angle from project north to true geographic north on project_settings. */
export type SetAngleToTrueNorthCmd = {
  type: 'setAngleToTrueNorth';
  angleDeg: number;
};

/** §5.3: set the real-world elevation of the project base point on project_settings. */
export type SetProjectElevationCmd = {
  type: 'setProjectElevation';
  elevationMm: number;
};

/** §12.1.1: add a parsed IFC link element client-side. */
export type AddIfcLinkCmd = {
  type: 'addIfcLink';
  element: Extract<Element, { kind: 'link_ifc' }>;
};

/** §12.1.1: remove an IFC link element by id. */
export type RemoveIfcLinkCmd = {
  type: 'removeIfcLink';
  linkId: string;
};

/** §12.1.1: toggle visibility of an IFC link element. */
export type ToggleIfcLinkVisibilityCmd = {
  type: 'toggleIfcLinkVisibility';
  linkId: string;
};

/** §12.1.1: add a PDF underlay link element client-side. */
export type AddPdfLinkCmd = {
  type: 'addPdfLink';
  url: string;
  pageIndex?: number;
  opacity?: number;
  positionMm?: { xMm: number; yMm: number };
  scaleMm?: number;
  levelId: string;
};

/** §12.1.1: remove a PDF underlay link element by id. */
export type RemovePdfLinkCmd = {
  type: 'removePdfLink';
  linkId: string;
};

/** §12.1.1: toggle hidden flag of a PDF underlay link element. */
export type TogglePdfLinkCmd = {
  type: 'togglePdfLink';
  linkId: string;
};

/** §12.1.1: add a point cloud link element client-side. */
export type AddPointCloudCmd = {
  type: 'addPointCloud';
  name: string;
  color?: number;
};

/** §12.1.1: remove a point cloud link element by id. */
export type RemovePointCloudCmd = {
  type: 'removePointCloud';
  linkId: string;
};

/** §12.1.1: toggle visibility of a point cloud link element. */
export type TogglePointCloudCmd = {
  type: 'togglePointCloud';
  linkId: string;
};

/** §3.5.5 — commit a custom wall profile polygon for a specific wall. */
export type CommitWallProfileCmd = {
  type: 'commitWallProfile';
  wallId: string;
  points: { xPct: number; yPct: number }[];
};

/** §3.5.5: inspector profile editor — update wall profile points directly from the inspector panel. */
export type UpdateWallProfileCmd = {
  type: 'updateWallProfile';
  wallId: string;
  /** New profile points. Pass null or [] to reset to rectangular. */
  profilePoints: { xPct: number; yPct: number }[] | null;
};

// ---------------------------------------------------------------------------
// §8.6.2 — Stair by component commands
// ---------------------------------------------------------------------------

/** §8.6.2: add an individual stair run segment to an existing stair. */
export type AddStairRunCmd = {
  type: 'addStairRun';
  run: Extract<Element, { kind: 'stair_run' }>;
};

/** §8.6.2: add a stair landing to an existing stair. */
export type AddStairLandingCmd = {
  type: 'addStairLanding';
  landing: Extract<Element, { kind: 'stair_landing' }>;
};

/** §8.6.2: remove a stair_run or stair_landing component by id. */
export type RemoveStairComponentCmd = {
  type: 'removeStairComponent';
  componentId: string;
};

// ---------------------------------------------------------------------------
// §8.6.4 — Stair edit mode commands
// ---------------------------------------------------------------------------

/** §8.6.4: enter component-level stair edit mode for a given stair. */
export type EnterStairEditModeCmd = {
  type: 'enterStairEditMode';
  stairId: string;
};

/** §8.6.4: exit component-level stair edit mode for a given stair. */
export type ExitStairEditModeCmd = {
  type: 'exitStairEditMode';
  stairId: string;
};

/** §8.6.4: update riser count or run width on an individual run within the stair edit panel. */
export type UpdateStairRunCmd = {
  type: 'updateStairRun';
  stairId: string;
  runIndex: number;
  riserCount?: number;
  runWidthMm?: number;
};

/** §8.6.4: mirror a stair's run geometry horizontally or vertically about its bounding box center. */
export type FlipStairCmd = {
  type: 'flipStair';
  stairId: string;
  /** 'horizontal' mirrors along the vertical axis (left↔right), 'vertical' mirrors top↔bottom */
  axis: 'horizontal' | 'vertical';
};

// ---------------------------------------------------------------------------
// §3.4.2 — Floor drainage slope point commands
// ---------------------------------------------------------------------------

/** §3.4.2: add a drainage slope control point to a floor. */
export type AddFloorSlopePointCmd = {
  type: 'addFloorSlopePoint';
  floorId: string;
  point: FloorSlopePoint;
};

/** §3.4.2: remove a drainage slope control point from a floor by id. */
export type RemoveFloorSlopePointCmd = {
  type: 'removeFloorSlopePoint';
  floorId: string;
  pointId: string;
};

/** §3.4.2: update the elevation offset of a drainage slope control point. */
export type UpdateFloorSlopePointCmd = {
  type: 'updateFloorSlopePoint';
  floorId: string;
  pointId: string;
  elevationOffsetMm: number;
};

// ---------------------------------------------------------------------------
// §3.4.2 — Sub-floor thickness command
// ---------------------------------------------------------------------------

/** §3.4.2: set the structural base pad thickness beneath the floor slab. */
export type SetSubFloorThicknessCmd = {
  type: 'setSubFloorThickness';
  floorId: string;
  subFloorThicknessMm: number | null;
};

// ---------------------------------------------------------------------------
// §3.3.4 — Cut Geometry commands
// ---------------------------------------------------------------------------

/** §3.3.4: apply a void cut from a cutter element into a host element. */
export type ApplyCutGeometryCmd = {
  type: 'applyCutGeometry';
  cutterId: string;
  hostId: string;
};

/** §3.3.4: remove a void cut from a host element. */
export type RemoveCutGeometryCmd = {
  type: 'removeCutGeometry';
  cutterId: string;
  hostId: string;
};

export type JoinGeometryCmd = {
  type: 'joinGeometry';
  elementId1: string;
  elementId2: string;
};

export type UnjoinGeometryCmd = {
  type: 'unjoinGeometry';
  elementId1: string;
  elementId2: string;
};

// ---------------------------------------------------------------------------
// §1.6.11 — Project Browser Groups commands
// ---------------------------------------------------------------------------

/** §1.6.11: select all elements belonging to a model group definition. */
export type SelectGroupElementsCmd = {
  type: 'selectGroupElements';
  groupDefinitionId: string;
};

/** §15.1.2: place a nested sub-component instance inside a family definition. */
export type AddFamilyComponentCmd = {
  type: 'addFamilyComponent';
  familyId: string;
  componentTypeId: string;
  label?: string;
  originMm: { xMm: number; yMm: number; zMm: number };
  rotationDeg?: number;
};

// ---------------------------------------------------------------------------
// §1.6.2 — File Menu: Save As / Revert commands
// ---------------------------------------------------------------------------

/** §1.6.2: duplicate the current project with a new name (Save As). */
export type DuplicateProjectCmd = {
  type: 'duplicateProject';
  /** New name for the duplicated project. */
  newName: string;
};

/** §1.6.2: discard unsaved changes and reload the last saved state (Revert). */
export type RevertProjectCmd = {
  type: 'revertProject';
};

/** §15.1.3: add or update the parametric opening cut on a wall-hosted family definition. */
export type SetFamilyOpeningCutCmd = {
  type: 'setFamilyOpeningCut';
  familyId: string;
  widthMm: number;
  heightMm: number;
  sillOffsetMm?: number;
};

/** §15.1.2: assign a Revit-style category to a family definition element. */
export type SetFamilyCategoryCmd = {
  type: 'setFamilyCategory';
  familyId: string;
  categoryKey: string;
};

export type SaveFamilyToLibraryCmd = {
  type: 'saveFamilyToLibrary';
  /** ID of the element type element to save as a reusable family_definition. */
  elementId: string;
  /** Human-readable name to save under; defaults to the source element name. */
  familyName?: string;
};

// ---------------------------------------------------------------------------
// §7.3.2 — Work Plane Face Orientation
// ---------------------------------------------------------------------------

/** §7.3.2: pick a wall/floor face and store its normal as the active work plane. */
export type SetWorkPlaneFaceCmd = {
  type: 'setWorkPlaneFace';
  /** ID of the wall/floor element whose face to use as the work plane. */
  hostElementId: string;
  /** Which face: 'front' | 'back' | 'top' | 'bottom'. Default 'front'. */
  faceKey?: string;
  /** Display name. */
  name?: string;
};

/** §3.3.5: toggle Show Constraints mode on a plan view — shows EQ markers and lock symbols. */
export type ToggleShowConstraintsCmd = {
  type: 'toggleShowConstraints';
  /** plan_view element ID. */
  viewId: string;
};

/** §2.9.4: set the plan underlay level and toggle ghost rendering. */
export type SetPlanUnderlayCmd = {
  type: 'setPlanUnderlay';
  /** plan_view element ID. */
  viewId: string;
  /** Level ID to use as underlay, or null to clear. */
  underlayLevelId?: string | null;
  /** Whether to show the underlay. */
  showUnderlay?: boolean;
};

/** §9.1.3: toggle isNonStructural on a column element (structural ↔ architectural/decorative). */
export type ToggleColumnStructuralCmd = {
  type: 'toggleColumnStructural';
  /** Column element ID. */
  columnId: string;
};

/** §12.4.2: merge partial update to dxfLayerMapping on project_settings. */
export type SetDxfLayerMappingCmd = {
  type: 'setDxfLayerMapping';
  /** Merged partial update to dxfLayerMapping on project_settings. */
  mapping: Record<string, string>;
};

/** §1.6.12: toggle split plan/3D view mode. */
export type ToggleSplitViewCmd = {
  type: 'toggleSplitView';
};

/** §6.4.2: create a drafting (detail) view — a plan_view with planViewSubtype='drafting'. */
export type CreateDraftingViewCmd = {
  type: 'createDraftingView';
  /** Human-readable name for the drafting view. */
  name: string;
};

/** §1.10: reset the workspace UI layout to factory defaults. */
export type ResetWorkspaceCmd = {
  type: 'resetWorkspace';
};

/** §1.6.3: pin a command palette command to the Quick Access Toolbar. */
export type AddToQuickAccessCmd = {
  type: 'addToQuickAccess';
  commandId: string;
};

/** §1.6.3: unpin a command palette command from the Quick Access Toolbar. */
export type RemoveFromQuickAccessCmd = {
  type: 'removeFromQuickAccess';
  commandId: string;
};

/** §1.6.11: Apply (or clear) a view_template on a plan_view element. */
export type ApplyViewTemplateCmd = {
  type: 'applyViewTemplate';
  /** ID of the plan_view to update. */
  planViewId: string;
  /** ID of the view_template to apply. Pass null to clear. */
  templateId: string | null;
};

/** §1.5: open a recently used project by its ID. */
export type OpenRecentProjectCmd = {
  type: 'openRecentProject';
  projectId: string;
};

export type RestoreMilestoneCmd = {
  type: 'restoreMilestone';
  milestoneId: string;
};
