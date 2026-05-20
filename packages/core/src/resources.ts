import type { XY } from './index';

// ---------------------------------------------------------------------------
// JOB-V3-01 — long-running-operations job types
// ---------------------------------------------------------------------------

export type JobKind =
  | 'csg_solve'
  | 'ifc_export'
  | 'dxf_import'
  | 'gltf_export'
  | 'sketch_trace'
  | 'render_still'
  | 'render_video'
  | 'agent_call';

export type JobStatus = 'queued' | 'running' | 'done' | 'errored' | 'cancelled';

export type Job = {
  id: string;
  modelId: string;
  kind: JobKind;
  status: JobStatus;
  inputs: Record<string, unknown>;
  outputs?: { primaryAssetId?: string; secondaryAssetIds?: string[] };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  costEstimate?: { credits: number };
  parentJobId?: string;
};

// ---------------------------------------------------------------------------
// MRK-V3-01 — 3D-anchored comment types
// ---------------------------------------------------------------------------

export type Vec3Mm = { xMm: number; yMm: number; zMm: number };

export type ElementAnchor = {
  kind: 'element';
  elementId: string;
  offsetLocalMm?: Vec3Mm | null;
};
export type PointAnchor = { kind: 'point'; worldMm: Vec3Mm };
export type RegionAnchor = { kind: 'region'; minMm: Vec3Mm; maxMm: Vec3Mm };
export type SheetAnchor = {
  kind: 'sheet';
  sheetId: string;
  xPx: number;
  yPx: number;
  sourceViewId?: string;
  sourceElementId?: string;
};
export type CommentAnchor = ElementAnchor | PointAnchor | RegionAnchor | SheetAnchor;

export type Comment = {
  id: string;
  modelId: string;
  threadId: string;
  authorId: string;
  body: string;
  anchor: CommentAnchor;
  createdAt: number;
  resolvedAt?: number | null;
  resolvedBy?: string | null;
  isOrphaned?: boolean;
};

// ---------------------------------------------------------------------------
// MRK-V3-02 — Markup types
// ---------------------------------------------------------------------------

export type MarkupAnchor =
  | { kind: 'element'; elementId: string }
  | { kind: 'world'; worldMm: { xMm: number; yMm: number; zMm: number } }
  | { kind: 'screen'; viewId: string; xPx: number; yPx: number };

export type MarkupShape =
  | {
      kind: 'freehand';
      pathPx: Array<{ xPx: number; yPx: number }>;
      color: string;
      strokeWidthPx: number;
    }
  | {
      kind: 'arrow';
      fromMm: { xMm: number; yMm: number };
      toMm: { xMm: number; yMm: number };
      color: string;
    }
  | { kind: 'cloud'; pointsMm: Array<{ xMm: number; yMm: number }> }
  | { kind: 'text'; bodyMd: string; positionMm: { xMm: number; yMm: number } };

export type Markup = {
  id: string;
  modelId: string;
  viewId?: string;
  anchor: MarkupAnchor;
  shape: MarkupShape;
  authorId: string;
  createdAt: number;
  resolvedAt?: number;
};

// ---------------------------------------------------------------------------
// VER-V3-01 — Activity stream types
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// VER-V3-02 — Named milestone types
// ---------------------------------------------------------------------------

export type Milestone = {
  id: string;
  modelId: string;
  name: string;
  description?: string;
  snapshotId: string;
  authorId: string;
  createdAt: number;
};

export type ActivityRow = {
  id: string;
  modelId: string;
  authorId: string;
  kind:
    | 'commit'
    | 'comment_created'
    | 'comment_resolved'
    | 'markup_created'
    | 'markup_resolved'
    | 'milestone_created'
    | 'option_set_lifecycle'
    | 'collab_join'
    | 'collab_leave'
    | 'sheet_comment_chip';
  payload: Record<string, unknown>;
  ts: number;
  parentSnapshotId?: string;
  resultSnapshotId?: string;
};

// ---------------------------------------------------------------------------
// AST-V3-01 — Searchable asset library types
// ---------------------------------------------------------------------------

/** Kind discriminant for an asset library entry. */
export type AssetKind = 'family_instance' | 'block_2d' | 'kit' | 'decal' | 'profile';

/** Category facet for the left-rail filter. */
export type AssetCategory =
  | 'furniture'
  | 'kitchen'
  | 'bathroom'
  | 'door'
  | 'window'
  | 'decal'
  | 'profile'
  | 'casework';

/** Discipline filter tag that feeds LIB-V3-01 cross-theme. */
export type AssetDisciplineTag = 'arch' | 'struct' | 'mep';

export type AssetSymbolKind =
  | 'bed'
  | 'wardrobe'
  | 'lamp'
  | 'rug'
  | 'fridge'
  | 'oven'
  | 'sink'
  | 'counter'
  | 'sofa'
  | 'table'
  | 'chair'
  | 'toilet'
  | 'bath'
  | 'shower'
  | 'bathroom_layout'
  | 'generic';

/** One parameter definition in an asset's parametric schema. */
export type ParamSchemaEntry = {
  key: string;
  kind: 'mm' | 'enum' | 'material' | 'bool';
  default: unknown;
  constraints?: unknown;
};

/** AST-V3-01 — searchable asset library entry with schematic-2D thumbnail. */
export type AssetLibraryEntry = {
  id: string;
  assetKind?: AssetKind;
  name: string;
  tags: string[];
  category: AssetCategory;
  disciplineTags?: AssetDisciplineTag[];
  thumbnailKind: 'schematic_plan' | 'rendered_3d';
  thumbnailMm?: { widthMm: number; heightMm: number };
  planSymbolKind?: AssetSymbolKind;
  renderProxyKind?: AssetSymbolKind;
  paramSchema?: ParamSchemaEntry[];
  publishedFromOrgId?: string;
  description?: string;
};

/** AST-V3-01 — element shape for an AssetLibraryEntry in the document store. */
export type AssetLibraryEntryElem = {
  kind: 'asset_library_entry';
  id: string;
  assetKind: AssetKind;
  name: string;
  tags: string[];
  category: AssetCategory;
  disciplineTags?: AssetDisciplineTag[];
  thumbnailKind: 'schematic_plan' | 'rendered_3d';
  thumbnailWidthMm?: number;
  thumbnailHeightMm?: number;
  planSymbolKind?: AssetSymbolKind;
  renderProxyKind?: AssetSymbolKind;
  paramSchema?: ParamSchemaEntry[];
  publishedFromOrgId?: string;
  description?: string;
};

/** AST-V3-01 — a placed asset instance on the plan canvas. */
export type PlacedAssetElem = {
  kind: 'placed_asset';
  id: string;
  name: string;
  assetId: string;
  levelId: string;
  positionMm: XY;
  rotationDeg?: number;
  paramValues?: Record<string, unknown>;
  hostElementId?: string;
};

// ---------------------------------------------------------------------------
// AST-V3-04 — Parametric kitchen kit
// ---------------------------------------------------------------------------

export type KitComponent = {
  componentKind:
    | 'base'
    | 'upper'
    | 'oven_housing'
    | 'sink'
    | 'pantry'
    | 'countertop'
    | 'end_panel'
    | 'dishwasher'
    | 'fridge';
  widthMm?: number | null;
  heightMm?: number | null;
  depthMm?: number | null;
  doorStyle?: string | null;
  materialId?: string | null;
  hardwareFamilyId?: string | null;
};

export type FamilyKitInstanceElem = {
  kind: 'family_kit_instance';
  id: string;
  kitId: 'kitchen_modular';
  hostWallId: string;
  startMm: number;
  endMm: number;
  components: KitComponent[];
  countertopDepthMm: number;
  countertopThicknessMm: number;
  countertopMaterialId?: string | null;
  toeKickHeightMm: number;
  upperBaseClearanceMm: number;
};

export type PlaceKitCmd = {
  type: 'place_kit';
  id: string;
  kitId: 'kitchen_modular';
  hostWallId: string;
  startMm: number;
  endMm: number;
  components: KitComponent[];
};

export type UpdateKitComponentCmd = {
  type: 'update_kit_component';
  id: string;
  componentIndex: number;
  widthMm?: number | null;
  doorStyle?: string | null;
  materialId?: string | null;
};

// ---------------------------------------------------------------------------
// MAT-V3-01 — Material PBR map slots + Decals
// ---------------------------------------------------------------------------

export type MaterialAssetSource = 'builtin' | 'curated_asset' | 'project' | 'family';
export type ImageAssetMapUsage =
  | 'albedo'
  | 'normal'
  | 'roughness'
  | 'metalness'
  | 'height'
  | 'opacity';

export type ImageAssetElem = {
  kind: 'image_asset';
  id: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  widthPx?: number | null;
  heightPx?: number | null;
  contentHash: string;
  mapUsageHint: ImageAssetMapUsage;
  source?: string | null;
  license?: string | null;
  provenance?: string | null;
  dataUrl?: string | null;
};

export type MaterialGraphicsAsset = {
  useRenderAppearance?: boolean;
  shadedColor?: string;
  transparency?: number;
  surfacePatternId?: string | null;
  surfacePatternColor?: string;
  cutPatternId?: string | null;
  cutPatternColor?: string;
};

export type MaterialAppearanceAsset = {
  baseColor?: string;
  albedoMapId?: string | null;
  normalMapId?: string | null;
  roughnessMapId?: string | null;
  metallicMapId?: string | null;
  heightMapId?: string | null;
  roughness?: number;
  metalness?: number;
  opacity?: number;
  transmission?: number;
  reflectance?: number;
  uvScaleMm?: { uMm: number; vMm: number };
  uvRotationDeg?: number;
  uvOffsetMm?: { uMm: number; vMm: number };
  projection?: 'box' | 'wall-face' | 'planar-xz' | 'planar-xy' | 'cylindrical' | 'generated';
};

export type MaterialPhysicalAsset = {
  materialClass?: string;
  densityKgPerM3?: number;
  compressiveStrengthMpa?: number;
  manufacturer?: string;
  comments?: string;
};

export type MaterialThermalAsset = {
  /** Energy Lens source field name for thermal conductivity, W/(m*K). */
  lambdaWPerMK?: number;
  /** Legacy/rendering alias for lambdaWPerMK. */
  conductivityWPerMK?: number;
  rhoKgPerM3?: number;
  specificHeatJPerKgK?: number;
  mu?: number;
  thermalResistanceM2KPerW?: number;
  sourceReference?: string;
};

export type MaterialElem = {
  kind: 'material';
  id: string;
  name: string;
  displayName?: string;
  source?: MaterialAssetSource;
  category?: string;
  graphics?: MaterialGraphicsAsset;
  appearance?: MaterialAppearanceAsset;
  physical?: MaterialPhysicalAsset;
  thermal?: MaterialThermalAsset;
  albedoColor?: string;
  albedoMapId?: string;
  normalMapId?: string;
  roughnessMapId?: string;
  metallicMapId?: string;
  heightMapId?: string;
  uvScaleMm?: { uMm: number; vMm: number };
  uvRotationDeg?: number;
  uvOffsetMm?: { uMm: number; vMm: number };
  projection?: 'box' | 'wall-face' | 'planar-xz' | 'planar-xy' | 'cylindrical' | 'generated';
  hatchPatternId?: string;
};

export type DecalElem = {
  kind: 'decal';
  id: string;
  parentElementId: string;
  parentSurface: 'front' | 'back' | 'top' | 'left' | 'right' | 'bottom';
  imageAssetId: string;
  uvRect: { u0: number; v0: number; u1: number; v1: number };
  opacity?: number;
  /** F2 (WP-F): placement-based decal fields (alternative to UV-based placement). */
  positionMm?: { xMm: number; yMm: number; zMm: number };
  normalVec?: { x: number; y: number; z: number };
  imageSrc?: string | null;
  widthMm?: number;
  heightMm?: number;
};
