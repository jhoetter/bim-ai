// ---------------------------------------------------------------------------
// TOP-V3-01 — Toposolid primitive types
// ---------------------------------------------------------------------------

export * from './parseDimensionInput';

export type BoundaryPoint = { xMm: number; yMm: number };

export type HeightSample = { xMm: number; yMm: number; zMm: number };

export type HeightmapGrid = {
  stepMm: number;
  rows: number;
  cols: number;
  values: number[];
};

export type ToposolidElem = {
  kind: 'toposolid';
  id: string;
  name?: string;
  boundaryMm: BoundaryPoint[];
  heightSamples?: HeightSample[];
  heightmapGridMm?: HeightmapGrid;
  thicknessMm: number;
  baseElevationMm?: number;
  defaultMaterialKey?: string;
  pinned?: boolean;
  phaseCreated?: string;
  phaseDemolished?: string;
  discipline?: string;
  contourIntervalMm?: number;
  perimeterMm?: { xMm: number; yMm: number }[] | null;
};

// ---------------------------------------------------------------------------
// TOP-V3-02 — Toposolid subdivision (surface finish region)
// ---------------------------------------------------------------------------

export type ToposolidSubdivisionElem = {
  kind: 'toposolid_subdivision';
  id: string;
  name?: string;
  hostToposolidId: string;
  boundaryMm: { xMm: number; yMm: number }[];
  finishCategory: 'paving' | 'lawn' | 'road' | 'planting' | 'other';
  materialKey: string;
};

export type CreateToposolidSubdivisionCmd = {
  type: 'create_toposolid_subdivision';
  id: string;
  hostToposolidId: string;
  boundaryMm: { xMm: number; yMm: number }[];
  finishCategory: 'paving' | 'lawn' | 'road' | 'planting' | 'other';
  materialKey: string;
  name?: string;
};

export type UpdateToposolidSubdivisionCmd = {
  type: 'update_toposolid_subdivision';
  id: string;
  boundaryMm?: { xMm: number; yMm: number }[];
  finishCategory?: 'paving' | 'lawn' | 'road' | 'planting' | 'other';
  materialKey?: string;
  name?: string;
};

export type DeleteToposolidSubdivisionCmd = {
  type: 'delete_toposolid_subdivision';
  id: string;
};

// ---------------------------------------------------------------------------
// TOP-V3-04 — Site walls + Graded regions
// ---------------------------------------------------------------------------

export type GradedRegionElem = {
  kind: 'graded_region';
  id: string;
  hostToposolidId: string | null;
  boundaryMm: { xMm: number; yMm: number }[];
  targetMode: 'flat' | 'slope';
  targetZMm?: number;
  slopeAxisDeg?: number;
  slopeDegPercent?: number;
  perimeterMm?: { xMm: number; yMm: number }[] | null;
  lowerElevationMm?: number | null;
  upperElevationMm?: number | null;
  levelId?: string | null;
};

export type CreateGradedRegionCmd = {
  type: 'CreateGradedRegion';
  id?: string;
  hostToposolidId: string;
  boundaryMm: { xMm: number; yMm: number }[];
  targetMode: 'flat' | 'slope';
  targetZMm?: number;
  slopeAxisDeg?: number;
  slopeDegPercent?: number;
};

export type UpdateGradedRegionCmd = {
  type: 'UpdateGradedRegion';
  id: string;
  boundaryMm?: { xMm: number; yMm: number }[];
  targetMode?: 'flat' | 'slope';
  targetZMm?: number;
  slopeAxisDeg?: number;
  slopeDegPercent?: number;
};

export type DeleteGradedRegionCmd = { type: 'DeleteGradedRegion'; id: string };

// ---------------------------------------------------------------------------
// TOP-V3-05 — Toposolid excavation relation
// ---------------------------------------------------------------------------

export type ToposolidExcavationCutMode =
  | 'to_top_of_cutter'
  | 'to_bottom_of_cutter'
  | 'custom_depth'
  | 'by_face';

export type ToposolidExcavationElem = {
  kind: 'toposolid_excavation';
  id: string;
  hostToposolidId: string;
  cutterElementId: string;
  cutMode: ToposolidExcavationCutMode;
  offsetMm: number;
  customDepthMm?: number | null;
  estimatedVolumeM3?: number | null;
  /** WP-D §5.1.5: polygon-sketch excavation boundary and depth. */
  boundaryMm?: { xMm: number; yMm: number }[];
  depthMm?: number;
};

export type CreateToposolidExcavationCmd = {
  type: 'CreateToposolidExcavation';
  id?: string;
  hostToposolidId: string;
  cutterElementId: string;
  cutMode?: ToposolidExcavationCutMode;
  offsetMm?: number;
  customDepthMm?: number | null;
  estimatedVolumeM3?: number | null;
};

/** WP-D §5.1.5: polygon-sketch excavation creation command. */
export type CreateToposolidExcavationBoundaryCmd = {
  type: 'create_toposolid_excavation';
  id: string;
  hostToposolidId?: string;
  boundaryMm: { xMm: number; yMm: number }[];
  depthMm: number;
};

export type UpdateToposolidExcavationCmd = {
  type: 'UpdateToposolidExcavation';
  id: string;
  cutMode?: ToposolidExcavationCutMode;
  offsetMm?: number;
  customDepthMm?: number | null;
  estimatedVolumeM3?: number | null;
};

export type DeleteToposolidExcavationCmd = { type: 'DeleteToposolidExcavation'; id: string };

// ---------------------------------------------------------------------------
// TOP-V3-06 — Toposolid pad (§5.1.4)
// ---------------------------------------------------------------------------

/** §5.1.4: a flattened sub-area of a toposolid surface, placed at a fixed elevation. */
export type ToposolidPadElement = {
  kind: 'toposolid_pad';
  id: string;
  /** Parent toposolid this pad is cut into. */
  toposolidId: string;
  /** Boundary polygon of the pad in plan (mm). */
  boundaryMm: BoundaryPoint[];
  /** Fixed elevation of the pad surface (mm above project datum). */
  elevationMm: number;
};

export type CreateToposolidPadCmd = {
  type: 'create_toposolid_pad';
  id: string;
  toposolidId: string;
  boundaryMm: BoundaryPoint[];
  elevationMm: number;
};

// ---------------------------------------------------------------------------
// WP-E §2.5.1 + §2.5.3 — Shaft floor opening
// ---------------------------------------------------------------------------

/** §2.5.1: a vertical shaft void cutting floor openings from baseLevelId up to topLevelId. */
export type ShaftElement = {
  kind: 'shaft';
  id: string;
  /** Boundary polygon in plan (mm). */
  boundaryMm: BoundaryPoint[];
  /** Level where the shaft starts (cuts floors from this level up). */
  baseLevelId: string;
  /** Level where the shaft ends. */
  topLevelId: string;
  /** Whether the shaft visually highlights the cut floors in the plan view. */
  showCutLevels?: boolean;
  /** The element IDs of floors that this shaft cuts through (auto-computed). */
  cutFloorIds?: string[];
};

export type CreateShaftCmd = {
  type: 'create_shaft';
  id: string;
  boundaryMm: BoundaryPoint[];
  baseLevelId: string;
  topLevelId: string;
};

export type UpdateShaftLevelsCmd = {
  type: 'updateShaftLevels';
  shaftId: string;
  baseLevelId: string | null;
  topLevelId: string | null;
};

export type RecomputeShaftCutsCmd = {
  type: 'recomputeShaftCuts';
  shaftId: string;
};

export type ApplyShaftCutCmd = {
  type: 'applyShaftCut';
  shaftId: string;
  cutFloorIds: string[];
};

// ---------------------------------------------------------------------------
// CAN-V3-02 — Hatch pattern definition
// ---------------------------------------------------------------------------

/** CAN-V3-02 — built-in hatch pattern; scales with paper-mm at plot scale. */
export type HatchPatternDef = {
  kind: 'hatch_pattern_def';
  id: string;
  name: string;
  paperMmRepeat: number;
  rotationDeg: number;
  strokeWidthMm: number;
  patternKind: 'lines' | 'crosshatch' | 'dots' | 'curve' | 'svg';
  svgSource?: string | null;
};

// ---------------------------------------------------------------------------
// OSM-V3-01 — Neighborhood massing types
// ---------------------------------------------------------------------------

export type NeighborhoodMassElem = {
  kind: 'neighborhood_mass';
  id: string;
  osmId?: string;
  footprintMm: { xMm: number; yMm: number }[];
  heightMm: number;
  baseElevationMm: number;
  source: 'osm' | 'manual';
  isReadOnly: true;
};

export type NeighborhoodImportSessionElem = {
  kind: 'neighborhood_import_session';
  id: string;
  bbox: { minLat: number; minLon: number; maxLat: number; maxLon: number };
  fetchTimestamp: string;
  osmEtag?: string;
  radiusM: number;
};

// ---------------------------------------------------------------------------
// CON-V3-02 — Concept seed handoff contract (T6 → T9)
// ---------------------------------------------------------------------------

/** CON-V3-02: envelope token describing a GBM shape around a host element. */
export type ConceptSeedEnvelopeToken = {
  hostId: string;
  t: number;
  deltaMm: number;
  scaleFactor: number;
  rho: number;
};

export type ConceptSeedElem = {
  kind: 'concept_seed';
  id: string;
  modelId: string;
  sourceUnderlayId?: string;
  envelopeTokens: ConceptSeedEnvelopeToken[];
  kernelElementDrafts: Record<string, unknown>[];
  assumptionsLog: Array<{ assumption: string; confidence: number; source: string }>;
  status: 'draft' | 'committed' | 'consumed';
  committedAt?: string;
  schemaVersion: 'con-v3.0';
};

export type CreateConceptSeedCmd = {
  type: 'create_concept_seed';
  id: string;
  modelId: string;
  sourceUnderlayId?: string;
  envelopeTokens?: ConceptSeedEnvelopeToken[];
  kernelElementDrafts?: Record<string, unknown>[];
  assumptionsLog?: Array<{ assumption: string; confidence: number; source: string }>;
};

export type CommitConceptSeedCmd = {
  type: 'commit_concept_seed';
  id: string;
  envelopeTokens?: ConceptSeedEnvelopeToken[];
  kernelElementDrafts?: Record<string, unknown>[];
  assumptionsLog?: Array<{ assumption: string; confidence: number; source: string }>;
};

export type ConsumeConceptSeedCmd = { type: 'consume_concept_seed'; id: string };
export type ElemKind =
  | 'toposolid'
  | 'toposolid_subdivision'
  | 'project_settings'
  | 'room_color_scheme'
  | 'wall_type'
  | 'floor_type'
  | 'roof_type'
  | 'level'
  | 'wall'
  | 'door'
  | 'window'
  | 'wall_opening'
  | 'room'
  | 'grid_line'
  | 'dimension'
  | 'angular_dimension'
  | 'viewpoint'
  | 'issue'
  | 'floor'
  | 'roof'
  | 'stair'
  | 'slab_opening'
  | 'roof_opening'
  | 'railing'
  | 'family_type'
  | 'family_instance'
  | 'room_separation'
  | 'plan_region'
  | 'tag_definition'
  | 'join_geometry'
  | 'section_cut'
  | 'elevation_view'
  | 'plan_tag_style'
  | 'plan_view'
  | 'view_template'
  | 'sheet'
  | 'titleblock_type'
  | 'window_legend_view'
  | 'schedule'
  | 'site'
  | 'callout'
  | 'bcf'
  | 'agent_assumption'
  | 'agent_deviation'
  | 'validation_rule'
  | 'column'
  | 'beam'
  | 'ceiling'
  | 'color_fill_legend'
  | 'shared_param_file'
  | 'project_param'
  | 'reference_plane'
  | 'property_line'
  | 'selection_set'
  | 'clash_test'
  | 'text_3d'
  | 'project_base_point'
  | 'survey_point'
  | 'internal_origin'
  | 'link_model'
  | 'link_dxf'
  | 'link_external'
  | 'placed_tag'
  | 'detail_line'
  | 'detail_arc'
  | 'detail_filled_region'
  | 'detail_region'
  | 'draft_detail_region'
  | 'text_note'
  | 'annotation_symbol'
  | 'sweep'
  | 'dormer'
  | 'balcony'
  | 'area'
  | 'masking_region'
  | 'spot_elevation'
  | 'spot_coordinate'
  | 'spot_slope'
  | 'slope_annotation'
  | 'insulation_annotation'
  | 'material_tag'
  | 'multi_category_tag'
  | 'tread_number'
  | 'keynote'
  | 'span_direction'
  | 'detail_component'
  | 'repeating_detail'
  | 'detail_group'
  | 'revision_cloud'
  | 'revision'
  | 'sheet_revision'
  | 'constraint'
  | 'mass'
  | 'phase'
  | 'soffit'
  | 'sun_settings'
  | 'view'
  | 'view_concept_board'
  | 'edge_profile_run'
  | 'roof_join'
  | 'asset_library_entry'
  | 'placed_asset'
  | 'family_kit_instance'
  | 'brace'
  | 'foundation'
  | 'duct'
  | 'pipe'
  | 'cable_tray'
  | 'mep_equipment'
  | 'mep_terminal'
  | 'mep_opening_request'
  | 'pipe_legend'
  | 'duct_legend'
  | 'mass_box'
  | 'mass_extrusion'
  | 'mass_revolution'
  | 'fixture'
  | 'material'
  | 'decal'
  | 'hatch_pattern_def'
  | 'property_definition'
  | 'image_underlay'
  | 'neighborhood_mass'
  | 'neighborhood_import_session'
  | 'graded_region'
  | 'concept_seed'
  | 'frame'
  | 'saved_view'
  | 'camera_path'
  | 'presentation_canvas'
  | 'brand_template'
  | 'thermal_bridge_marker'
  | 'renovation_scenario'
  | 'building_services_handoff'
  | 'radial_dimension'
  | 'diameter_dimension'
  | 'arc_length_dimension'
  | 'leader_text'
  | 'interior_elevation_marker'
  | 'permanent_dimension'
  | 'sheet_viewport'
  | 'steel_connection'
  | 'beam_section_profile'
  | 'toposolid_pad'
  | 'shaft'
  | 'saved_3d_view'
  | 'model_line'
  | 'conical_roof'
  | 'dome_roof'
  | 'spire_roof'
  | 'family_blend'
  | 'family_sweep'
  | 'family_swept_blend'
  | 'family_component'
  | 'family_opening_cut'
  | 'family_reference_plane'
  | 'text_tag'
  | 'link_ifc'
  | 'link_pdf'
  | 'link_pointcloud'
  | 'work_plane';

export type PhaseFilter = 'all' | 'existing' | 'demolition' | 'new' | 'show_all';

export type VGFilterRule = {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
  value: string;
};

export type VGFilter = {
  id: string;
  name: string;
  categories: string[];
  rules: VGFilterRule[];
  override: {
    visible?: boolean;
    color?: string;
    lineWeightFactor?: number;
    transparencyPct?: number;
  };
};

/** DSC-V3-01: per-element discipline tag. */
export type DisciplineTag = 'arch' | 'struct' | 'mep';

export const DEFAULT_DISCIPLINE_BY_KIND: Readonly<Partial<Record<ElemKind, DisciplineTag>>> = {
  wall: 'arch',
  door: 'arch',
  window: 'arch',
  wall_opening: 'arch',
  floor: 'arch',
  roof: 'arch',
  stair: 'arch',
  railing: 'arch',
  ceiling: 'arch',
  mass: 'arch',
  balcony: 'arch',
  sweep: 'arch',
  dormer: 'arch',
  column: 'struct',
  beam: 'struct',
  soffit: 'arch',
  toposolid: 'arch',
  toposolid_pad: 'arch',
  shaft: 'arch',
  brace: 'struct',
  steel_connection: 'struct',
  foundation: 'struct',
  duct: 'mep',
  pipe: 'mep',
  cable_tray: 'mep',
  mep_equipment: 'mep',
  mep_terminal: 'mep',
  mep_opening_request: 'mep',
  fixture: 'mep',
} as const;

export type Text3dFontFamily = 'helvetiker' | 'optimer' | 'gentilis';

export type XY = { xMm: number; yMm: number };

export interface DimWitnessPoint {
  xMm: number;
  yMm: number;
  referencedElementId?: string; // element whose face/edge this snaps to
  referenceEdge?: 'start' | 'end' | 'face1' | 'face2'; // which edge of the element
}

// ---------------------------------------------------------------------------
// VIE-V3-02 — Drafting view + callout + cut-profile + view-break types
// ---------------------------------------------------------------------------

/** Per-view per-category cut-profile override. */
export type ElementOverride = {
  categoryOrId: string;
  alternateRender: 'singleLine' | 'outline' | string;
};

/** A single view-break gap hiding a section of a long elevation. */
export type ViewBreak = {
  axisMM: number;
  widthMM: number;
};

/** VIE-V3-02 — Unified view element for drafting views, callouts, and 2D detailing. */
export type View = {
  kind: 'view';
  id: string;
  name: string;
  subKind?: 'plan' | 'section' | 'elevation' | 'drafting' | 'callout' | '3d';
  parentViewId?: string;
  clipRectInParent?: { minXY: { x: number; y: number }; maxXY: { x: number; y: number } };
  elementOverrides?: ElementOverride[];
  breaks?: ViewBreak[];
  scale?: number;
  detailLevel?: 'coarse' | 'medium' | 'fine';
  /** DSC-V3-02: per-view discipline lens; 'show_all' = foreground for all elements. */
  defaultLens?: ViewLensMode;
};

/** FED-04: 2D linework primitive parsed from a DXF underlay. */
export type DxfLineworkPrim =
  | { kind: 'line'; start: XY; end: XY; layerName?: string; layerColor?: string }
  | { kind: 'polyline'; points: XY[]; closed?: boolean; layerName?: string; layerColor?: string }
  | {
      kind: 'arc';
      center: XY;
      radiusMm: number;
      startDeg: number;
      endDeg: number;
      layerName?: string;
      layerColor?: string;
    }
  | { kind: 'circle'; center: XY; radiusMm: number; layerName?: string; layerColor?: string }
  | {
      kind: 'text';
      text: string;
      positionMm: XY;
      heightMm?: number;
      layerName?: string;
      layerColor?: string;
    }
  | { kind: 'hatch'; boundaryPoints: XY[][]; layerName?: string; layerColor?: string };

/** F-019: queryable layer summary preserved from DXF import/link. */
export type DxfLayerMeta = {
  name: string;
  color?: string;
  primitiveCount?: number;
};

export type DxfUnitOverride =
  | 'source'
  | 'unitless'
  | 'inches'
  | 'feet'
  | 'millimeters'
  | 'centimeters'
  | 'meters';

/** FED-04: engine command emitted by the DXF import flow. */
export type CreateLinkDxfCmd = {
  type: 'createLinkDxf';
  id?: string;
  name?: string;
  levelId: string;
  originMm: XY;
  originAlignmentMode?: 'origin_to_origin' | 'project_origin' | 'shared_coords';
  unitOverride?: DxfUnitOverride | number | null;
  unitScaleToMm?: number;
  rotationDeg?: number;
  scaleFactor?: number;
  linework: DxfLineworkPrim[];
  dxfLayers?: DxfLayerMeta[];
  hiddenLayerNames?: string[];
  pinned?: boolean;
  sourcePath?: string;
  cadReferenceType?: 'linked' | 'embedded';
  sourceMetadata?: Record<string, unknown>;
  reloadStatus?: 'not_reloaded' | 'ok' | 'source_missing' | 'parse_error' | 'embedded';
  lastReloadMessage?: string;
  loaded?: boolean;
  colorMode?: 'black_white' | 'custom' | 'native';
  customColor?: string;
  overlayOpacity?: number;
};

export type ExternalLinkType = 'ifc' | 'pdf' | 'image';
export type ExternalLinkStatus = 'not_reloaded' | 'ok' | 'source_missing' | 'parse_error';

/** F-024: generic reloadable external-link row for IFC, PDF, and image references. */
export type CreateExternalLinkCmd = {
  type: 'createExternalLink';
  id?: string;
  name?: string;
  externalLinkType: ExternalLinkType;
  sourcePath: string;
  sourceName?: string;
  originMm?: XY;
  originAlignmentMode?: 'origin_to_origin' | 'project_origin' | 'shared_coords';
  rotationDeg?: number;
  scaleFactor?: number;
  sourceMetadata?: Record<string, unknown>;
  reloadStatus?: ExternalLinkStatus;
  lastReloadMessage?: string;
  loaded?: boolean;
  hidden?: boolean;
  pinned?: boolean;
  overlayOpacity?: number;
};

/** KRN-V3-05: a single tread line in a by_sketch stair. */
export type StairTreadLine = {
  fromMm: XY;
  toMm: XY;
  riserHeightMm?: number | null;
  manualOverride?: boolean;
};

/** EDT-V3-09: update tread lines on a by_sketch stair (drag-to-rebalance). */
export type UpdateStairTreadsCmd = {
  type: 'update_stair_treads';
  id: string;
  treadLines: StairTreadLine[];
};

/** KRN-V3-02: one component in a stacked wall. */
export type WallStackComponent = {
  wallTypeId: string;
  heightMm: number;
};

/** KRN-V3-02: stacked wall definition (multiple wall types stacked vertically). */
export type WallStack = {
  components: WallStackComponent[];
};

/**
 * KRN-V3-08 — wall edge spec for sweep/reveal hosting.
 * `{ kind: 'top' | 'bottom' }` names a fixed edge; `{ startMm, endMm }` specifies a span.
 */
export type WallEdgeSpec = { kind: 'top' | 'bottom' } | { startMm: number; endMm: number };

/** KRN-07: a single straight flight in a multi-run stair. */
export type StairRun = {
  id: string;
  startMm: XY;
  endMm: XY;
  widthMm: number;
  riserCount: number;
};

/** KRN-07: a flat polygon landing between two runs. */
export type StairLanding = {
  id: string;
  boundaryMm: XY[];
};

export type SiteContextType = 'tree' | 'shrub' | 'neighbor_proxy' | 'entourage';

export type SiteContextObjectRow = {
  id: string;
  contextType: SiteContextType;
  label?: string;
  positionMm: XY;
  scale?: number;
  category?: string;
};

/** Floor-plan graphic detail preset (view template + optional plan_view override). */
export type PlanDetailLevelPlan = 'coarse' | 'medium' | 'fine';

export type PlanCategoryGraphicCategoryKey =
  | 'wall'
  | 'floor'
  | 'roof'
  | 'room'
  | 'door'
  | 'window'
  | 'stair'
  | 'grid_line'
  | 'room_separation'
  | 'dimension';

export type PlanLinePatternToken = 'solid' | 'dash_short' | 'dash_long' | 'dot';

export type PlanCategoryGraphicRow = {
  categoryKey: PlanCategoryGraphicCategoryKey;
  lineWeightFactor?: number | null;
  linePatternToken?: PlanLinePatternToken | null;
};

export type ViewTemplateControlledField =
  | 'scale'
  | 'detailLevel'
  | 'elementOverrides'
  | 'phase'
  | 'phaseFilter';

export type ViewTemplateFieldControl = {
  included: boolean;
  locked?: boolean;
};

export type ViewTemplateControlMatrix = Partial<
  Record<ViewTemplateControlledField, ViewTemplateFieldControl>
>;

export type PlanTagTarget = 'opening' | 'room';

export type PlanTagBadgeStyle = 'none' | 'rounded' | 'flag';

export type XYZ = { xMm: number; yMm: number; zMm: number };

export type RoomColorSchemeRow = {
  programmeCode?: string | null;
  department?: string | null;
  schemeColorHex: string;
};

export type WallLayerFunction = 'structure' | 'insulation' | 'finish' | 'membrane' | 'air';
export type StructuralRole =
  | 'unknown'
  | 'load_bearing'
  | 'non_load_bearing'
  | 'bearing_wall'
  | 'shear_wall'
  | 'slab'
  | 'beam'
  | 'column'
  | 'foundation'
  | 'brace';
export type WallStructuralRole = StructuralRole;
export type StructuralMaterial =
  | 'concrete'
  | 'steel'
  | 'timber'
  | 'masonry'
  | 'composite'
  | 'other';
export type StructuralAnalysisStatus = 'not_modeled' | 'ready_for_export' | 'needs_review';

export type ThermalEnvelopeClassification =
  | 'exterior_wall_outside_air'
  | 'wall_against_ground'
  | 'wall_against_unheated_space'
  | 'roof_or_top_floor_ceiling_outside_air'
  | 'floor_slab_against_ground'
  | 'floor_against_unheated_basement'
  | 'window_or_door_thermal_envelope'
  | 'internal_outside_thermal_envelope';

export type ThermalClassificationSource = 'auto' | 'manual' | 'batch' | 'imported';

export type EnergyHeatingStatus = 'heated' | 'low_heated' | 'unheated';
export type EnergyUsageProfile = 'residential' | 'office' | 'school' | 'retail' | 'other';

export type ThermalBridgeMarkerType =
  | 'balcony_slab'
  | 'window_reveal'
  | 'roof_wall_junction'
  | 'floor_wall_junction'
  | 'basement_transition'
  | 'cantilever'
  | 'user_defined';

export type RenovationScenarioStatus = 'as_is' | 'scenario_a' | 'scenario_b' | 'target';

export type EnergyCarrier =
  | 'gas'
  | 'oil'
  | 'district_heat'
  | 'electricity'
  | 'biomass'
  | 'heat_pump'
  | 'solar_thermal'
  | 'other';

export type EnergyServicesHandoff = {
  heatingGeneratorType?: string | null;
  energyCarrier?: EnergyCarrier | null;
  distributionType?: string | null;
  domesticHotWaterSystem?: string | null;
  ventilationSystem?: string | null;
  renewableEnergyNotes?: string | null;
  knownSystemAge?: string | null;
  measureCandidateNotes?: string | null;
};

export type ThermalBridgeMarkerElem = {
  kind: 'thermal_bridge_marker';
  id: string;
  name?: string;
  markerType: ThermalBridgeMarkerType;
  locationMm: XYZ;
  hostElementIds?: string[];
  description?: string | null;
  suggestedMitigation?: string | null;
  handoffNote?: string | null;
  psiValueReference?: string | null;
};

export type RenovationScenarioElem = {
  kind: 'renovation_scenario';
  id: string;
  name: string;
  scenarioStatus: RenovationScenarioStatus;
  baseScenarioId?: string | null;
  typeLayerOverrides?: Record<string, unknown>;
  openingTypeOverrides?: Record<string, unknown>;
  heatingStatusOverrides?: Record<string, EnergyHeatingStatus>;
  systemsNotes?: string | null;
  measurePackages?: Array<{ id: string; name: string; notes?: string; costPlaceholder?: number }>;
};

export type BuildingServicesHandoffElem = {
  kind: 'building_services_handoff';
  id: string;
  name: string;
  scenarioId?: string | null;
  services: EnergyServicesHandoff;
  handoffNote?: string | null;
};

export type WallTypeLayer = {
  thicknessMm: number;
  function: WallLayerFunction;
  materialKey?: string | null;
  wrapsAtEnds?: boolean | null;
  wrapsAtInserts?: boolean | null;
  /** Revit-style layer priority (1 = highest, 5 = lowest). Controls which layer dominates at wall joins. Default: 3. */
  priority?: number | null;
};

export type MaterialFaceKind =
  | 'exterior'
  | 'interior'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'generated';

export type MaterialFaceOverride = {
  faceKind: MaterialFaceKind;
  materialKey: string;
  generatedFaceId?: string | null;
  source?: 'paint' | 'finish' | null;
  uvScaleMm?: { uMm: number; vMm: number } | null;
  uvRotationDeg?: number | null;
  uvOffsetMm?: { uMm: number; vMm: number } | null;
};

export type EvidenceRefKind =
  | 'sheet'
  | 'viewpoint'
  | 'plan_view'
  | 'section_cut'
  | 'deterministic_png';

export type EvidenceRef = {
  kind: EvidenceRefKind;
  sheetId?: string | null;
  viewpointId?: string | null;
  planViewId?: string | null;
  sectionCutId?: string | null;
  pngBasename?: string | null;
};

export type ConstructionProgressStatus =
  | 'not_started'
  | 'in_progress'
  | 'installed'
  | 'inspected'
  | 'accepted';

export type ConstructionLogisticsKind =
  | 'temporary_partition'
  | 'scaffolding_zone'
  | 'crane_lift_zone'
  | 'laydown_area'
  | 'access_route'
  | 'site_safety_zone';

export type ConstructionChecklistItem = {
  id: string;
  label: string;
  status: 'open' | 'pass' | 'fail' | 'na';
  evidenceRefs?: EvidenceRef[];
};

export type DimensionAnchor = {
  kind: 'free' | 'feature';
  feature?: {
    elementId: string;
    anchor: 'start' | 'end' | 'mid' | 'center';
  };
  fallbackPositionMm: XY;
};

export type FamilyDiscipline =
  | 'door'
  | 'window'
  | 'stair'
  | 'railing'
  | 'wall_type'
  | 'floor_type'
  | 'roof_type'
  | 'column'
  | 'beam'
  | 'generic';

export type DoorOperationType =
  | 'swing_single'
  | 'swing_double'
  | 'sliding_single'
  | 'sliding_double'
  | 'bi_fold'
  | 'pocket'
  | 'pivot'
  | 'automatic_double';

export type WindowOutlineKind =
  | 'rectangle'
  | 'arched_top'
  | 'gable_trapezoid'
  | 'circle'
  | 'octagon'
  | 'custom';

export type WallLocationLine =
  | 'wall-centerline'
  | 'finish-face-exterior'
  | 'finish-face-interior'
  | 'core-centerline'
  | 'core-face-exterior'
  | 'core-face-interior';

export type WallArcCurve = {
  kind: 'arc';
  center: XY;
  radiusMm: number;
  /** Degrees in model XY, positive sweep = counter-clockwise from start to end. */
  startAngleDeg: number;
  endAngleDeg: number;
  sweepDeg: number;
};

export type WallBezierCurve = {
  kind: 'bezier';
  /** Four cubic Bezier control points in model XY millimetres. */
  controlPoints: [XY, XY, XY, XY];
};

export type WallCurve = WallArcCurve | WallBezierCurve;

/**
 * KRN-09 — kind of substitution applied to a curtain-wall grid cell.
 *
 * - `empty`: leave the cell open (no glass, no solid panel; mullions stay).
 * - `system`: render the cell as a solid panel using a registered
 *   `materialKey`. Falls back to glass if no `materialKey` is supplied.
 * - `family_instance`: instantiate a custom family at this cell. Until
 *   FAM-01 lands the renderer paints a placeholder panel and emits a TODO.
 */
export type CurtainPanelOverrideKind = 'empty' | 'system' | 'family_instance';

export type CurtainPanelOverride = {
  kind: CurtainPanelOverrideKind;
  /** For `family_instance` overrides — id of the family type to instantiate. */
  familyTypeId?: string | null;
  /** For `system` overrides — `materialKey` resolved against the MAT-01 registry. */
  materialKey?: string | null;
};

/** Build the deterministic `gridCellId` used as the key in
 * `wall.curtainPanelOverrides`. */
export function curtainGridCellId(vIndex: number, hIndex: number): string {
  return `v${vIndex}h${hIndex}`;
}

export type SharedParamEntry = {
  guid: string;
  name: string;
  dataType: 'text' | 'number' | 'integer' | 'yesno' | 'length' | 'area' | 'volume';
};

export type SharedParamGroup = {
  groupName: string;
  parameters: SharedParamEntry[];
};

export type SelectionSetRule = {
  field: 'category' | 'level' | 'typeName';
  operator: 'equals' | 'contains';
  value: string;
  /**
   * FED-02: which models the rule resolves against. `'host'` (default) only
   * matches host elements; `'all_links'` walks every `link_model` element and
   * matches inside source models too; `{ specificLinkId }` restricts to one
   * link. Linked element AABBs are transformed by the link's positionMm +
   * rotationDeg before clash-checking.
   */
  linkScope?: 'host' | 'all_links' | { specificLinkId: string };
};

/**
 * FED-03: structured monitor-source pointer used by Copy/Monitor.
 *
 * `linkId` (when set) names a `link_model` element in the host whose source
 * model contains the monitored element; intra-host monitors omit it.
 * `elementId` is the **source-side** id (not the `<linkId>::<sourceElemId>`
 * prefixed form). `sourceRevisionAtCopy` is the source model's revision
 * counter at the moment of the copy; the BumpMonitoredRevisions command
 * compares it against the latest revision and flags drift.
 *
 * `drifted` and `driftedFields` are computed by BumpMonitoredRevisions; they
 * persist on the host element so the constraint evaluator can emit a
 * `monitored_source_drift` advisory without needing live source access.
 */
export type MonitorSource = {
  linkId?: string | null;
  elementId: string;
  sourceRevisionAtCopy: number;
  drifted?: boolean;
  driftedFields?: string[];
};

export type ClashResult = {
  elementIdA: string;
  elementIdB: string;
  distanceMm: number;
  /**
   * FED-02: provenance chain for cross-link clashes. Empty array for host
   * elements; otherwise a single-element array `[linkId]` identifying the
   * `link_model` row whose source contains the element. (Multi-hop transitive
   * links are deferred — the FED-01 expander is single-hop only.)
   */
  linkChainA?: string[];
  linkChainB?: string[];
};

/** EDT-02 — supported geometric constraint rules. Only `equal_distance`
 *  is currently evaluated by the engine; the others are accepted shapes
 *  for forward compatibility. */
export type ConstraintRule =
  | 'equal_distance'
  | 'equal_length'
  | 'parallel'
  | 'perpendicular'
  | 'collinear';

/** EDT-02 — anchor point on a referenced element used by the evaluator. */
export type ConstraintAnchor = 'start' | 'end' | 'mid' | 'center';

export type ConstraintSeverity = 'warning' | 'error';

export type ConstraintRefRow = {
  elementId: string;
  anchor?: ConstraintAnchor;
};

/** EDT-02 — engine command authored by the padlock UI on a temp-dim.
 *  Captures the current measured distance between two element groups
 *  as a locked constraint; subsequent moves that break the lock are
 *  rejected by the engine. */
export type CreateConstraintCmd = {
  type: 'createConstraint';
  id: string;
  rule: ConstraintRule;
  refsA: ConstraintRefRow[];
  refsB: ConstraintRefRow[];
  lockedValueMm?: number;
  severity?: ConstraintSeverity;
  name?: string;
};

/** KRN-V3-11 — baluster spacing rule for a railing. */
export type BalusterPattern = {
  rule: 'regular' | 'glass_panel' | 'cable';
  spacingMm?: number;
  profileFamilyId?: string;
};

/** KRN-V3-11 — wall-bracket support along a railing. */
export type HandrailSupport = {
  intervalMm: number;
  bracketFamilyId: string;
  hostWallId: string;
};

// ---------------------------------------------------------------------------
// SHT-V3-01 — Sheet, TitleblockType, WindowLegendView
// ---------------------------------------------------------------------------

export type ViewPlacement = {
  viewId: string;
  minXY: { x: number; y: number };
  size: { x: number; y: number };
  scale?: number;
};

export type SheetMetadata = {
  projectName?: string;
  drawnBy?: string;
  checkedBy?: string;
  date?: string;
  revision?: string;
};

export type Sheet = {
  kind: 'sheet';
  id: string;
  name: string;
  number?: string;
  size?: 'A0' | 'A1' | 'A2' | 'A3';
  orientation?: 'landscape' | 'portrait';
  titleblockTypeId?: string;
  revisionId?: string;
  viewPlacements?: ViewPlacement[];
  metadata?: SheetMetadata;
  brandTemplateId?: string;
  // Legacy v2 fields preserved for backwards compatibility
  titleBlock?: string | null;
  viewportsMm?: unknown[];
  paperWidthMm?: number;
  paperHeightMm?: number;
  titleblockParameters?: Record<string, string>;
};

export type TokenSlot = {
  name: string;
  xMm: number;
  yMm: number;
  fontSizeMm?: number;
};

export type TitleblockType = {
  kind: 'titleblock_type';
  id: string;
  name: string;
  svgTemplate: string;
  tokenSlots: TokenSlot[];
};

export type WindowLegendView = {
  kind: 'window_legend_view';
  id: string;
  name: string;
  scope: 'all' | 'sheet' | 'project';
  sortBy: 'type' | 'width' | 'count';
  parentSheetId?: string;
};

export type MepSystemType =
  | 'hvac_supply'
  | 'hvac_return'
  | 'heating'
  | 'cooling'
  | 'domestic_water'
  | 'wastewater'
  | 'electrical'
  | 'data'
  | 'fire_protection'
  | 'other'
  | string;

export type MepConnectorSpec = {
  id: string;
  systemType?: MepSystemType;
  flowDirection?: 'supply' | 'return' | 'exhaust' | 'bidirectional' | 'none' | 'unknown';
  diameterMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  positionMm?: XYZ | null;
  connectedTo?: string | null;
};

export type MepCommonFields = {
  systemType?: MepSystemType;
  systemName?: string | null;
  flowDirection?: 'supply' | 'return' | 'exhaust' | 'bidirectional' | 'none' | 'unknown';
  insulation?: string | null;
  serviceLevel?: string | null;
  clearanceZone?: Record<string, unknown> | null;
  maintainAccessZone?: Record<string, unknown> | null;
  connectors?: MepConnectorSpec[];
  discipline?: DisciplineTag | null;
  props?: Record<string, unknown>;
  pinned?: boolean;
};

/** Reference to a specific face on a mass element. */
export type MassFaceRef = {
  elementId: string;
  faceIndex: number;
};

/** §3.4.2 — Individual drainage slope control point on a floor slab. */
export interface FloorSlopePoint {
  id: string;
  xMm: number;
  yMm: number;
  elevationOffsetMm: number; // offset from floor base elevation (positive = raised, negative = lower)
}

/** §15.1.3: links two reference planes with a named parameter so changing the parameter value drives geometry dimensions. */
export interface FamilyConstraintElem {
  id: string;
  kind: 'family_constraint';
  familyId: string; // the family element this constraint belongs to
  paramName: string; // name of the family_parameter that drives this constraint
  refPlaneId1: string; // first reference plane element id
  refPlaneId2: string; // second reference plane element id (driven by distance)
  axis: 'x' | 'y'; // which coordinate axis the constraint measures
}

export type Element =
  | {
      kind: 'project_settings';
      id: string;
      lengthUnit?: string;
      angularUnitDeg?: string;
      displayLocale?: string;
      areaUnit?: string | null;
      volumeUnit?: string | null;
      decimalSymbol?: string | null;
      numberGrouping?: string | null;
      lengthUnitFull?: string | null;
      name?: string;
      projectNumber?: string | null;
      clientName?: string | null;
      projectAddress?: string | null;
      projectStatus?: string | null;
      authorName?: string | null;
      issueDate?: string | null;
      checkDate?: string | null;
      projectDescription?: string | null;
      /** F6: angle (degrees) from project north to true geographic north. */
      projectNorthAngleDeg?: number | null;
      worksetId?: string | null;
      startingViewId?: string | null;
      checkpointRetentionLimit?: number;
      volumeComputedAt?: 'finish_faces' | 'core_faces';
      roomAreaComputationBasis?:
        | 'wall_finish'
        | 'wall_centerline'
        | 'wall_core_layer'
        | 'wall_core_center';
      georeference?: {
        anchorLat: number;
        anchorLon: number;
        bboxNorth: number;
        bboxSouth: number;
        bboxEast: number;
        bboxWest: number;
        contextRadiusM?: number; // legacy field kept for backward compat
      };
      /** F1 (WP-F): project-wide named parameters for formula-driven design values. */
      globalParams?: Array<{
        id: string;
        name: string;
        /** Stored as string; e.g. "3000 + 500" or "2 * 1500". */
        formula: string;
        /** Evaluated result cached on save (mm). */
        valueMm: number;
      }>;
      /** §5.4.2: clockwise degrees from project north to true geographic north. */
      angleToTrueNorthDeg?: number;
      /** §5.3: real-world elevation of the project base point (mm above sea level). */
      projectElevationMm?: number;
      /** §4.2.4: project-wide dimension style settings. */
      dimensionStyle?: {
        textHeightMm?: number;
        witnessLineExtensionMm?: number;
        witnessLineGapMm?: number;
        arrowStyle?: 'arrow' | 'dot' | 'tick' | 'none';
        showUnit?: boolean;
      } | null;
      /** §12.4.2: per-layer name overrides for DXF export. Keys are default layer names (e.g. 'A-WALL'), values are custom names. */
      dxfLayerMapping?: Record<string, string>;
    }
  | {
      kind: 'room_color_scheme';
      id: string;
      schemeRows: RoomColorSchemeRow[];
      name?: string;
    }
  | {
      kind: 'wall_type';
      id: string;
      name: string;
      layers: WallTypeLayer[];
      basisLine?: 'center' | 'face_interior' | 'face_exterior';
    }
  | {
      kind: 'floor_type';
      id: string;
      name: string;
      layers: WallTypeLayer[];
    }
  | {
      kind: 'roof_type';
      id: string;
      name: string;
      layers: WallTypeLayer[];
    }
  | {
      kind: 'level';
      id: string;
      name: string;
      elevationMm: number;
      datumKind?: string | null;
      parentLevelId?: string | null;
      offsetFromParentMm?: number;
      worksetId?: string | null;
      /**
       * FED-03 legacy: pre-FED-03 copies of levels stored a bare source id.
       * Readers MUST treat a non-null `monitorSourceId` as
       * `{ elementId: monitorSourceId, sourceRevisionAtCopy: 0 }` if no
       * `monitorSource` is present. New writes should use `monitorSource`.
       */
      monitorSourceId?: string | null;
      monitorSource?: MonitorSource | null;
      pinned?: boolean;
    }
  | {
      kind: 'wall';
      id: string;
      name: string;
      levelId: string;
      start: XY;
      end: XY;
      /** F-043: optional native curved-wall baseline. start/end remain tangent endpoints. */
      wallCurve?: WallCurve | null;
      thicknessMm: number;
      heightMm: number;
      materialKey?: string | null;
      /** MAT-09 — Revit-like Paint tool overrides for individual wall faces. */
      faceMaterialOverrides?: MaterialFaceOverride[] | null;
      /** §3.3.7 Paint surface: per-face material override. Key: face identifier (e.g. 'front', 'back', 'top', 'bottom'). Value: materialKey string. */
      faceOverrides?: Record<string, string>;
      loadBearing?: boolean | null;
      structuralRole?: WallStructuralRole;
      structuralMaterial?: StructuralMaterial | string | null;
      analyticalParticipation?: boolean;
      analysisStatus?: StructuralAnalysisStatus;
      structuralMaterialKey?: string | null;
      structuralIntentConfidence?: number | null;
      fireResistanceRating?: string | null;
      wallTypeId?: string | null;
      baseConstraintLevelId?: string | null;
      topConstraintLevelId?: string | null;
      /** WP-C C4: host element id (roof or floor) that constrains the wall top. When set, wall top follows host geometry. */
      topConstraintHostId?: string | null;
      /** WP-C C4: which face of the host element the wall attaches to ('bottom' for underside of roof/floor). */
      topConstraintHostFace?: 'bottom' | 'top' | null;
      baseConstraintOffsetMm?: number;
      topConstraintOffsetMm?: number;
      roofAttachmentId?: string | null;
      insulationExtensionMm?: number;
      isCurtainWall?: boolean;
      curtainWallVCount?: number | null;
      curtainWallHCount?: number | null;
      /** WP-C C2: default panel type for curtain wall cells. */
      curtainWallPanelType?: string | null;
      /** WP-C C2: mullion profile type for curtain wall. */
      curtainWallMullionType?: string | null;
      /**
       * KRN-09 — per-cell panel overrides for curtain walls.
       *
       * Keys are deterministic grid-cell ids of the form `v<col>h<row>`
       * (zero-indexed; `v` = vertical column, `h` = horizontal row). Cells
       * without an override fall back to the default glass panel.
       */
      curtainPanelOverrides?: {
        [gridCellId: string]: CurtainPanelOverride;
      } | null;
      /** G9: Structured curtain wall authoring data. Supersedes curtainWallVCount/HCount when set. */
      curtainWallData?: {
        gridH: { count?: number; spacingMm?: number; offsets?: number[] };
        gridV: { count?: number; spacingMm?: number; offsets?: number[] };
        defaultPanelType?: 'glass' | 'opaque' | 'door' | 'empty';
        /** WP-B: panel type for the curtain wall grid cells. */
        panelType?: 'glass' | 'solid' | 'empty';
        mullionType?: string;
        panelOverrides?: { [cellKey: string]: string };
        pinnedGridLines?: string[];
        /** WP-C C2: custom V-division positions as t∈[0,1] along wall length. */
        customVDivisions?: number[];
      } | null;
      locationLine?: WallLocationLine;
      worksetId?: string | null;
      /** GAP-R5: opt out of the per-wall slab-edge expression strip on
       * elevated walls. When unset / null, the strip is emitted on any
       * single-thickness wall at level elevation > 0. */
      floorEdgeStripDisabled?: boolean | null;
      /**
       * KRN-16 — wall recess / setback zones along the wall's alongT axis.
       *
       * When set, the wall plane steps back by `setbackMm` (toward its
       * interior normal) over the alongT range `[alongTStart, alongTEnd]`.
       * Hosted openings whose alongT falls inside the zone are repositioned
       * onto the recessed surface. Use cases: loggias, deep entry porches,
       * bay windows.
       */
      recessZones?: {
        alongTStart: number;
        alongTEnd: number;
        setbackMm: number;
        sillHeightMm?: number;
        headHeightMm?: number;
        floorContinues?: boolean;
      }[];
      /** IFC-04: optional OmniClass / Uniclass / NSCC code emitted as
       *  IfcClassificationReference on the IFC product. */
      ifcClassificationCode?: string | null;
      pinned?: boolean;
      /** SKB-08 phase tag — carried forward when materialised from a mass. */
      phaseId?: string | null;
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
      /** KRN-V3-02: stacked wall definition. When set, components are stacked base-up. */
      stack?: WallStack;
      /** KRN-V3-07: top-vs-base XY offset for leaning walls (mm). */
      leanMm?: { xMm: number; yMm: number } | null;
      /** KRN-V3-07: top thickness / base thickness ratio; 1 = prismatic, must be in (0.1, 10). */
      taperRatio?: number | null;
      /** §3.5.7 Wall lean angle in degrees. Positive = top shifts in +X direction of wall local frame. Default 0 (plumb). */
      slopeAngleDeg?: number | null;
      /** §3.5.7 If set, wall top is narrower than base. Top thickness = this value (mm). 0 or null = no taper. */
      topThicknessMm?: number | null;
      /** CMD-V3-02: provenance trace linking this element to its originating bundle. */
      agentTrace?: AgentTrace;
      /** KRN-V3-04: design option membership. */
      optionSetId?: string | null;
      optionId?: string | null;
      /** DSC-V3-01: discipline tag. */
      discipline?: DisciplineTag | null;
      /** SCH-V3-01: custom property values. */
      props?: Record<string, unknown>;
      thermalClassification?: ThermalEnvelopeClassification | null;
      thermalClassificationSource?: ThermalClassificationSource | null;
      energyScenarioId?: string | null;
      /** TOP-V3-04: site wall binding — base elevation per-segment follows the toposolid surface. */
      siteHostId?: string | null;
      /** F-040: per-endpoint Allow/Disallow Join flag (mirrors Revit right-click → Allow/Disallow Join). */
      joinDisallowStart?: boolean;
      /** F-040: per-endpoint Allow/Disallow Join flag (mirrors Revit right-click → Allow/Disallow Join). */
      joinDisallowEnd?: boolean;
      /** G7: reference to the mass face this wall was generated from. */
      massFaceRef?: MassFaceRef | null;
      /** G3: wall parts — segments of the wall with independent material assignment. */
      parts?: Array<{
        id: string;
        /** Normalised position along wall length (0.0 = start, 1.0 = end). */
        startT: number;
        endT: number;
        materialId?: string | null;
        /** User-set part label (e.g. "Left panel"). */
        label?: string | null;
      }>;
      /**
       * §3.5.5 — Custom cross-section profile points for the wall elevation face.
       * Points are in local wall space: xPct = horizontal (0 to 1 = wall length ratio),
       * yPct = vertical (0 to 1 = height ratio).
       * When set, the wall mesh uses this profile instead of a rectangular box.
       * Points form a closed polygon.
       */
      profilePoints?: { xPct: number; yPct: number }[];
      /** §3.5.5 — Whether the wall is in edit-profile mode (UI flag only, not persisted). */
      editProfileActive?: boolean;
      /** §2.1.4 per-element graphics override — fill/line color in plan, surface color in 3D. */
      graphicsOverride?: {
        fillColorHex?: string | null;
        lineColorHex?: string | null;
        surfaceColorHex?: string | null;
      } | null;
      /** §3.3.4: IDs of elements that cut voids into this wall element. */
      cutBy?: string[];
      /** §3.5.5: per-endpoint join variant overrides. Key = adjacent wall ID, value = join variant. */
      joinOverrides?: Record<string, 'miter' | 'butt' | 'square'> | null;
    }
  | {
      kind: 'door';
      id: string;
      name: string;
      wallId: string;
      levelId?: string | null;
      alongT: number;
      widthMm: number;
      familyTypeId?: string | null;
      materialKey?: string | null;
      materialSlots?: Record<string, string | null>;
      hostCutDepthMm?: number | null;
      revealInteriorMm?: number | null;
      interlockGrade?: string | null;
      lodPlan?: 'simple' | 'detailed' | null;
      operationType?: DoorOperationType;
      slidingTrackSide?: 'wall_face' | 'in_pocket';
      overrideParams?: Record<string, unknown>;
      /** IFC-04: optional classification code; emitted as IfcClassificationReference. */
      ifcClassificationCode?: string | null;
      pinned?: boolean;
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
      /** CMD-V3-02: provenance trace linking this element to its originating bundle. */
      agentTrace?: AgentTrace;
      /** KRN-V3-04: design option membership. */
      optionSetId?: string | null;
      optionId?: string | null;
      /** DSC-V3-01: discipline tag. */
      discipline?: DisciplineTag | null;
      /** SCH-V3-01: custom property values. */
      props?: Record<string, unknown>;
      thermalClassification?: ThermalEnvelopeClassification | null;
      thermalClassificationSource?: ThermalClassificationSource | null;
      uValue?: number | null;
      gValue?: number | null;
      frameFraction?: number | null;
      airTightnessClass?: string | null;
      installationThermalBridgeNote?: string | null;
      shadingDevice?: string | null;
      annualShadingFactorEstimate?: number | null;
      /** §3.6.2: operation style of the door. */
      doorStyle?: 'single' | 'sliding' | 'double_leaf' | 'pocket' | null;
    }
  | {
      kind: 'window';
      id: string;
      name: string;
      wallId: string;
      levelId?: string | null;
      alongT: number;
      widthMm: number;
      sillHeightMm: number;
      heightMm: number;
      familyTypeId?: string | null;
      materialKey?: string | null;
      materialSlots?: Record<string, string | null>;
      hostCutDepthMm?: number | null;
      revealInteriorMm?: number | null;
      interlockGrade?: string | null;
      sealRebateMm?: number | null;
      lodPlan?: 'simple' | 'detailed' | null;
      outlineKind?: WindowOutlineKind;
      outlineMm?: XY[];
      attachedRoofId?: string | null;
      overrideParams?: Record<string, unknown>;
      /** IFC-04: optional classification code; emitted as IfcClassificationReference. */
      ifcClassificationCode?: string | null;
      pinned?: boolean;
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
      /** CMD-V3-02: provenance trace linking this element to its originating bundle. */
      agentTrace?: AgentTrace;
      /** KRN-V3-04: design option membership. */
      optionSetId?: string | null;
      optionId?: string | null;
      /** DSC-V3-01: discipline tag. */
      discipline?: DisciplineTag | null;
      /** SCH-V3-01: custom property values. */
      props?: Record<string, unknown>;
      thermalClassification?: ThermalEnvelopeClassification | null;
      thermalClassificationSource?: ThermalClassificationSource | null;
      uValue?: number | null;
      gValue?: number | null;
      frameFraction?: number | null;
      airTightnessClass?: string | null;
      installationThermalBridgeNote?: string | null;
      shadingDevice?: string | null;
      annualShadingFactorEstimate?: number | null;
      /** §3.6.2: visual/operation style of the window. */
      windowStyle?: 'casement' | 'double_hung' | 'awning' | 'fixed' | 'sliding' | null;
    }
  | {
      kind: 'wall_opening';
      id: string;
      name?: string;
      hostWallId: string;
      alongTStart: number;
      alongTEnd: number;
      sillHeightMm: number;
      headHeightMm: number;
      /** DSC-V3-01: discipline tag. */
      discipline?: DisciplineTag | null;
      /** SCH-V3-01: custom property values. */
      props?: Record<string, unknown>;
    }
  | {
      kind: 'room';
      id: string;
      name: string;
      levelId: string;
      outlineMm: XY[];
      upperLimitLevelId?: string | null;
      volumeCeilingOffsetMm?: number | null;
      programmeCode?: string | null;
      department?: string | null;
      functionLabel?: string | null;
      finishSet?: string | null;
      targetAreaM2?: number | null;
      ventilationZone?: string | null;
      heatingCoolingZone?: string | null;
      designAirChangeRate?: number | null;
      fixtureEquipmentLoads?: Record<string, unknown> | null;
      electricalLoadSummary?: Record<string, unknown> | null;
      serviceRequirements?: string[];
      volumeM3?: number | null;
      /** F-093: per-room plan fill override, matching Revit's by-element graphics override. */
      roomFillOverrideHex?: string | null;
      /** F-093: per-room interior fill pattern override for plan/VG parity. */
      roomFillPatternOverride?: 'solid' | 'hatch_45' | 'hatch_90' | 'crosshatch' | 'dots' | null;
      /** IFC-04: optional classification code; emitted as IfcClassificationReference. */
      ifcClassificationCode?: string | null;
      pinned?: boolean;
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
      /** SCH-V3-01: custom property values. */
      props?: Record<string, unknown>;
      heatingStatus?: EnergyHeatingStatus | null;
      usageProfile?: EnergyUsageProfile | null;
      setpointC?: number | null;
      airChangeRate?: number | null;
      zoneId?: string | null;
      conditionedVolumeIncluded?: boolean | null;
      /** User-assigned room number (e.g. "101", "K1"). Displayed in plan tag alongside name. */
      numberLabel?: string | null;
    }
  | {
      kind: 'grid_line';
      id: string;
      name: string;
      start: XY;
      end: XY;
      label: string;
      levelId?: string | null;
      worksetId?: string | null;
      /** FED-03 legacy — see comment on `level.monitorSourceId`. */
      monitorSourceId?: string | null;
      monitorSource?: MonitorSource | null;
      pinned?: boolean;
    }
  | {
      kind: 'dimension';
      id: string;
      name: string;
      levelId: string;
      aMm: XY;
      bMm: XY;
      offsetMm: XY;
      /** F-088 — optional text-label offset from the default midpoint position.
       *  When set, the dimension measurement label is shifted by this vector
       *  relative to the midpoint of (aMm → bMm) + offsetMm. */
      textOffsetMm?: { xMm: number; yMm: number } | null;
      anchorA?: DimensionAnchor | null;
      anchorB?: DimensionAnchor | null;
      state?: 'linked' | 'partial' | 'unlinked';
      refElementIdA?: string | null;
      refElementIdB?: string | null;
      tagDefinitionId?: string | null;
      /** PLN-01 — set by the Auto-Dimension tools so a re-run can clear them. */
      autoGenerated?: boolean;
      pinned?: boolean;
      /** ANN-11 — optional text decoration. textOverride replaces the measured value;
       *  textPrefix/textSuffix are prepended/appended to the measured value. */
      textPrefix?: string;
      textSuffix?: string;
      textOverride?: string;
    }
  | {
      /** ANN-04 — angular dimension between two rays from a shared vertex. */
      kind: 'angular_dimension';
      id: string;
      hostViewId: string;
      vertexMm: XY;
      rayAMm: XY;
      rayBMm: XY;
      arcRadiusMm?: number;
      offsetMm?: XY | null;
      textOverride?: string | null;
      textPrefix?: string | null;
      textSuffix?: string | null;
      colour?: string;
      autoGenerated?: boolean;
    }
  | {
      kind: 'viewpoint';
      id: string;
      name: string;
      camera: { position: XYZ; target: XYZ; up: XYZ };
      mode: 'plan_2d' | 'orbit_3d' | 'plan_canvas';
      viewerClipCapElevMm?: number | null;
      viewerClipFloorElevMm?: number | null;
      hiddenSemanticKinds3d?: string[];
      cutawayStyle?: 'none' | 'cap' | 'floor' | 'box' | null;
      /** F-113 — saved 3D graphic display option: cast/receive shadows. */
      viewerShadowsEnabled?: boolean;
      /** F-113 — saved 3D graphic display option: screen-space ambient occlusion. */
      viewerAmbientOcclusionEnabled?: boolean;
      /** F-113 — saved 3D graphic display option: distance fade / depth cue. */
      viewerDepthCueEnabled?: boolean;
      /** F-113 — saved 3D graphic display option: silhouette/model edge width in px. */
      viewerSilhouetteEdgeWidth?: 1 | 2 | 3 | 4;
      /** F-113 — saved 3D photographic exposure value in stops; renderer maps EV to toneMappingExposure. */
      viewerPhotographicExposureEv?: number;
      /** F-123 — show a plan-view drawing as a registered world-space overlay in orbit 3D. */
      planOverlayEnabled?: boolean;
      /** F-123 — source plan_view element rendered as the 3D overlay. */
      planOverlaySourcePlanViewId?: string | null;
      /** F-123 — vertical offset above the source level datum in millimetres. */
      planOverlayOffsetMm?: number | null;
      /** F-123 — background sheet/fill opacity for the 3D plan overlay. */
      planOverlayOpacity?: number | null;
      /** F-123 — linework opacity for the 3D plan overlay. */
      planOverlayLineOpacity?: number | null;
      /** F-123 — room/fill opacity for the 3D plan overlay. */
      planOverlayFillOpacity?: number | null;
      /** F-123 — when true, labels and supported annotation hints render on the overlay. */
      planOverlayAnnotationsVisible?: boolean | null;
      /** F-123 — when true, dashed projection lines connect overlay extents down to model level. */
      planOverlayWitnessLinesVisible?: boolean | null;
      sectionBoxEnabled?: boolean | null;
      sectionBoxMinMm?: { xMm: number; yMm: number; zMm: number } | null;
      sectionBoxMaxMm?: { xMm: number; yMm: number; zMm: number } | null;
      hiddenElementIds?: string[];
      isolatedElementIds?: string[];
      /** KRN-V3-04: per-set option lock; key = optionSetId, value = optionId. */
      optionLocks?: Record<string, string>;
    }
  | {
      kind: 'issue';
      id: string;
      title: string;
      status: 'open' | 'in_progress' | 'done';
      elementIds?: string[];
      viewpointId?: string | null;
      evidenceRefs?: EvidenceRef[];
    }
  | {
      kind: 'construction_package';
      id: string;
      name: string;
      code?: string | null;
      phaseId?: string | null;
      plannedStart?: string | null;
      plannedEnd?: string | null;
      actualStart?: string | null;
      actualEnd?: string | null;
      responsibleCompany?: string | null;
      dependencies?: string[];
    }
  | {
      kind: 'construction_logistics';
      id: string;
      name: string;
      logisticsKind: ConstructionLogisticsKind;
      boundaryMm?: XY[];
      pathMm?: XY[];
      phaseId?: string | null;
      constructionPackageId?: string | null;
      plannedStart?: string | null;
      plannedEnd?: string | null;
      actualStart?: string | null;
      actualEnd?: string | null;
      progressStatus?: ConstructionProgressStatus;
      responsibleCompany?: string | null;
      evidenceRefs?: EvidenceRef[];
      issueIds?: string[];
    }
  | {
      kind: 'construction_qa_checklist';
      id: string;
      name: string;
      targetElementIds?: string[];
      constructionPackageId?: string | null;
      phaseId?: string | null;
      responsibleCompany?: string | null;
      progressStatus?: ConstructionProgressStatus;
      checklist?: ConstructionChecklistItem[];
      evidenceRefs?: EvidenceRef[];
      issueIds?: string[];
    }
  | {
      kind: 'floor';
      id: string;
      name: string;
      levelId: string;
      boundaryMm: XY[];
      thicknessMm: number;
      structureThicknessMm?: number;
      finishThicknessMm?: number;
      floorTypeId?: string | null;
      insulationExtensionMm?: number;
      roomBounded?: boolean;
      loadBearing?: boolean | null;
      structuralRole?: StructuralRole;
      structuralMaterial?: StructuralMaterial | string | null;
      analysisStatus?: StructuralAnalysisStatus;
      fireResistanceRating?: string | null;
      worksetId?: string | null;
      /** IFC-04: optional classification code; emitted as IfcClassificationReference. */
      ifcClassificationCode?: string | null;
      pinned?: boolean;
      /** SKB-08 phase tag — carried forward when materialised from a mass. */
      phaseId?: string | null;
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
      /** CMD-V3-02: provenance trace linking this element to its originating bundle. */
      agentTrace?: AgentTrace;
      /** KRN-V3-04: design option membership. */
      optionSetId?: string | null;
      optionId?: string | null;
      /** DSC-V3-01: discipline tag. */
      discipline?: DisciplineTag | null;
      /** SCH-V3-01: custom property values. */
      props?: Record<string, unknown>;
      thermalClassification?: ThermalEnvelopeClassification | null;
      thermalClassificationSource?: ThermalClassificationSource | null;
      energyScenarioId?: string | null;
      /** §2.1.4 per-element graphics override — fill/line color in plan, surface color in 3D. */
      graphicsOverride?: {
        fillColorHex?: string | null;
        lineColorHex?: string | null;
        surfaceColorHex?: string | null;
      } | null;
      /** §3.4.1 slope arrow tail point in plan (mm). The low end of the slope. */
      slopeArrowTailMm?: { xMm: number; yMm: number } | null;
      /** §3.4.1 slope arrow head point in plan (mm). The high end of the slope. */
      slopeArrowHeadMm?: { xMm: number; yMm: number } | null;
      /** §3.4.1 slope as percentage (e.g. 10 = 10% = 10mm rise per 100mm run). Positive = head is higher than tail. */
      slopePercent?: number | null;
      /** §3.3.4 Paint tool face material overrides. Key = faceId string, value = materialId. */
      faceMaterialOverrides?: Record<string, string> | null;
      /** §3.3.7 Paint surface: per-face material override. Key: face identifier (e.g. 'front', 'back', 'top', 'bottom'). Value: materialKey string. */
      faceOverrides?: Record<string, string>;
      /** §3.4.1: when set, the floor's top face is snapped to the underside of this roof element. */
      attachedToRoofId?: string | null;
      /** §3.4.1: computed top-face elevation (mm above datum). Set by attach command; used by mesh builder. */
      topFaceElevationMm?: number | null;
      /** §2.4.2: optional edge cross-section profile points (mm). */
      edgeProfileMm?: { xMm: number; yMm: number }[];
      /** §2.4.2: true when the boundary was auto-detected from surrounding walls. */
      autoDetectedBoundary?: boolean;
      /** §3.4.2: drainage slope control points for sub-element slope editing. */
      slopePoints?: FloorSlopePoint[];
      /** §3.3.4: IDs of elements that cut voids into this floor element. */
      cutBy?: string[];
      /** §3.4.2: optional structural base pad thickness beneath the floor slab (mm). */
      subFloorThicknessMm?: number | null;
    }
  | {
      kind: 'roof';
      id: string;
      name: string;
      referenceLevelId: string;
      footprintMm: XY[];
      overhangMm?: number;
      slopeDeg?: number | null;
      edgeSlopeFlags?: Record<string, boolean>;
      ridgeAxis?: 'x' | 'z' | null;
      roofGeometryMode?:
        | 'mass_box'
        | 'gable_pitched_rectangle'
        | 'asymmetric_gable'
        | 'gable_pitched_l_shape'
        | 'hip'
        | 'flat';
      ridgeOffsetTransverseMm?: number;
      eaveHeightLeftMm?: number;
      eaveHeightRightMm?: number;
      roofTypeId?: string | null;
      materialKey?: string | null;
      loadBearing?: boolean | null;
      structuralRole?: StructuralRole;
      structuralMaterial?: StructuralMaterial | string | null;
      analysisStatus?: StructuralAnalysisStatus;
      fireResistanceRating?: string | null;
      /** IFC-04: optional classification code; emitted as IfcClassificationReference. */
      ifcClassificationCode?: string | null;
      pinned?: boolean;
      /** SKB-08 phase tag — carried forward when materialised from a mass. */
      phaseId?: string | null;
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
      /** CMD-V3-02: provenance trace linking this element to its originating bundle. */
      agentTrace?: AgentTrace;
      /** KRN-V3-04: design option membership. */
      optionSetId?: string | null;
      optionId?: string | null;
      /** DSC-V3-01: discipline tag. */
      discipline?: DisciplineTag | null;
      /** SCH-V3-01: custom property values. */
      props?: Record<string, unknown>;
      thermalClassification?: ThermalEnvelopeClassification | null;
      thermalClassificationSource?: ThermalClassificationSource | null;
      energyScenarioId?: string | null;
      /** G6: reference to the mass face this roof was generated from. */
      massFaceRef?: MassFaceRef | null;
      /** G2: extrusion depth for roof-by-extrusion tool (mm). */
      extrusionDepthMm?: number;
      /** §2.1.4 per-element graphics override — fill/line color in plan, surface color in 3D. */
      graphicsOverride?: {
        fillColorHex?: string | null;
        lineColorHex?: string | null;
        surfaceColorHex?: string | null;
      } | null;
      /** §3.3.4 Paint tool face material overrides. Key = faceId string, value = materialId. */
      faceMaterialOverrides?: Record<string, string> | null;
      /** §3.4.1: base (eave) elevation of this roof above datum (mm). Used as floor attach reference. */
      baseElevationMm?: number;
      useSlopeArrow?: boolean;
      slopeArrow?: { tailMm: XY; headMm: XY; slopeRatio: number } | null;
    }
  | {
      kind: 'stair';
      id: string;
      name: string;
      baseLevelId: string;
      topLevelId: string;
      runStartMm: XY;
      runEndMm: XY;
      widthMm: number;
      riserMm: number;
      treadMm: number;
      /** KRN-07: stair shape kind. Defaults to 'straight'; multi-run shapes carry runs+landings. */
      shape?: 'straight' | 'l_shape' | 'u_shape' | 'spiral' | 'sketch';
      /** KRN-07: ordered runs for multi-run stairs. Empty = legacy single-run from runStartMm/runEndMm. */
      runs?: StairRun[];
      /** KRN-07: landings between runs (one per gap). */
      landings?: StairLanding[];
      /** IFC-04: optional OmniClass / Uniclass / NSCC code emitted as IfcClassificationReference. */
      ifcClassificationCode?: string | null;
      /** KRN-07 closeout: spiral pivot (in plan mm). Required when shape='spiral'. */
      centerMm?: XY;
      /** KRN-07 closeout: spiral inner radius. Required when shape='spiral'. */
      innerRadiusMm?: number;
      /** KRN-07 closeout: spiral outer radius. Required when shape='spiral'. */
      outerRadiusMm?: number;
      /** KRN-07 closeout: total spiral arc in degrees (signed). Required when shape='spiral'. */
      totalRotationDeg?: number;
      /** KRN-07 closeout: arbitrary closed/open polyline for shape='sketch' stairs. */
      sketchPathMm?: XY[];
      /** KRN-V3-05: authoring mode — 'by_component' (default) or 'by_sketch'. */
      authoringMode?: 'by_component' | 'by_sketch';
      /** KRN-V3-05: stair footprint polygon for by_sketch mode. */
      boundaryMm?: XY[];
      /** KRN-V3-05: tread lines for by_sketch mode. */
      treadLines?: StairTreadLine[];
      /** KRN-V3-05: total rise in mm for by_sketch mode. */
      totalRiseMm?: number;
      /** KRN-V3-10: sub-kind — 'standard' (default), 'monolithic', or 'floating'. */
      subKind?: 'standard' | 'monolithic' | 'floating';
      /** KRN-V3-10: material id for monolithic concrete stairs. */
      monolithicMaterial?: string;
      /** KRN-V3-10: tread depth override for floating stairs (mm). */
      floatingTreadDepthMm?: number;
      /** KRN-V3-10: wall element id that hosts cantilever treads for floating stairs. */
      floatingHostWallId?: string;
      /** WP-C C3: when true, corner transition uses wedge (winder) treads instead of a flat landing. */
      winderAtCorner?: boolean;
      /** RMP-05: subcomponent materials, e.g. tread, riser, stringer, landing, support. */
      materialSlots?: Record<string, string | null>;
      overrideParams?: Record<string, unknown>;
      pinned?: boolean;
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
      /** CMD-V3-02: provenance trace linking this element to its originating bundle. */
      agentTrace?: AgentTrace;
      /** KRN-V3-04: design option membership. */
      optionSetId?: string | null;
      optionId?: string | null;
      /** DSC-V3-01: discipline tag. */
      discipline?: DisciplineTag | null;
      /** WP-C C2: when true, the stair spans from baseLevelId to topLevelId across all intermediate levels. */
      multiStorey?: boolean;
      /** §2.5.3: id of the shaft void that was auto-created when this stair was placed. */
      linkedShaftId?: string | null;
      riserCount?: number;
      treadDepthMm?: number;
      /** §8.6.4: run width in mm (alias for widthMm for multi-run grip editing). */
      runWidthMm?: number;
      /** §8.6.4: landing depth in mm between runs (only applicable for ≥2-run stairs). */
      landingDepthMm?: number;
      /** §8.6.4: total stair height in mm (read-only computed or authored override). */
      totalHeightMm?: number;
      /** §8.6.4: riser height per step in mm (overrides riserMm when set). */
      riserHeightMm?: number;
      /** §8.6.4: when true, the stair component edit panel is shown in the inspector. */
      editStairActive?: boolean;
    }
  | {
      kind: 'slab_opening';
      id: string;
      name: string;
      hostFloorId: string;
      boundaryMm: XY[];
      isShaft?: boolean;
      pinned?: boolean;
    }
  | {
      /** IFC-03: opening hosted on a roof (skylight / roof penetration). */
      kind: 'roof_opening';
      id: string;
      name: string;
      hostRoofId: string;
      boundaryMm: XY[];
      pinned?: boolean;
    }
  | {
      kind: 'railing';
      id: string;
      name: string;
      hostedStairId?: string | null;
      pathMm: XY[];
      guardHeightMm?: number;
      /** KRN-V3-11: parametric baluster spacing pattern. */
      balusterPattern?: BalusterPattern;
      /** KRN-V3-11: wall-mounted handrail support brackets. */
      handrailSupports?: HandrailSupport[];
      /** WP-C C7: railing height in mm. */
      railingHeightMm?: number;
      /** WP-C C7: top rail profile type identifier. */
      topRailProfile?: string;
      /** WP-C C7: baluster/balustrade spacing in mm. */
      balustradeSpacingMm?: number;
      /** RMP-05: subcomponent materials, e.g. topRail, post, baluster, panel, cable, bracket. */
      materialSlots?: Record<string, string | null>;
      structuralRole?: StructuralRole;
      analysisStatus?: StructuralAnalysisStatus;
      overrideParams?: Record<string, unknown>;
      pinned?: boolean;
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
      /** CMD-V3-02: provenance trace linking this element to its originating bundle. */
      agentTrace?: AgentTrace;
      /** DSC-V3-01: discipline tag. */
      discipline?: DisciplineTag | null;
    }
  | {
      kind: 'ramp';
      id: string;
      name: string;
      levelId: string;
      topLevelId: string;
      widthMm: number;
      runMm: number;
      runAngleDeg: number;
      insertionXMm: number;
      insertionYMm: number;
      hasRailingLeft: boolean;
      hasRailingRight: boolean;
      slopePercent: number;
      material?: string;
      pinned?: boolean;
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
    }
  | {
      kind: 'family_type';
      id: string;
      name: string;
      familyId: string;
      discipline: FamilyDiscipline;
      parameters: Record<string, unknown>;
      isBuiltIn?: boolean;
      /** FAM-08 — provenance when the type was loaded from an external catalog. */
      catalogSource?: { catalogId: string; familyId: string; version: string };
    }
  | {
      kind: 'family_instance';
      id: string;
      name: string;
      familyTypeId: string;
      levelId?: string;
      hostViewId?: string;
      positionMm: XY;
      rotationDeg?: number;
      paramValues?: Record<string, unknown>;
      hostElementId?: string;
      hostAlongT?: number;
      discipline?: DisciplineTag | null;
    }
  | {
      kind: 'balcony';
      id: string;
      name: string;
      wallId: string;
      elevationMm: number;
      projectionMm?: number;
      slabThicknessMm?: number;
      balustradeHeightMm?: number;
      pinned?: boolean;
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
      /** DSC-V3-01: discipline tag. */
      discipline?: DisciplineTag | null;
    }
  | {
      kind: 'room_separation';
      id: string;
      name: string;
      levelId: string;
      start: XY;
      end: XY;
      pinned?: boolean;
    }
  | {
      kind: 'plan_region';
      id: string;
      name: string;
      levelId: string;
      outlineMm: XY[];
      cutPlaneOffsetMm?: number;
    }
  | {
      kind: 'tag_definition';
      id: string;
      name: string;
      tagKind: 'room' | 'sill' | 'slab_finish' | 'custom';
      discipline?: string;
    }
  | { kind: 'join_geometry'; id: string; joinedElementIds: string[]; notes?: string }
  | {
      kind: 'section_cut';
      id: string;
      name: string;
      lineStartMm: XY;
      lineEndMm: XY;
      cropDepthMm?: number;
      segmentedPathMm?: XY[];
      pinned?: boolean;
      /** §6.1.6: when true, draws horizontal level datum lines in the section SVG. */
      showLevelLines?: boolean;
    }
  | {
      /** VIE-03: first-class N/S/E/W elevation view (sibling to section_cut). */
      kind: 'elevation_view';
      id: string;
      name: string;
      direction: 'north' | 'south' | 'east' | 'west' | 'custom';
      customAngleDeg?: number | null;
      cropMinMm?: XY | null;
      cropMaxMm?: XY | null;
      scale?: number;
      planDetailLevel?: 'coarse' | 'medium' | 'fine' | null;
      markerGroupId?: string | null;
      markerSlot?: 'north' | 'south' | 'east' | 'west' | 'custom' | null;
      pinned?: boolean;
    }
  | {
      kind: 'plan_tag_style';
      id: string;
      name: string;
      tagTarget: PlanTagTarget;
      labelFields: string[];
      textSizePt: number;
      leaderVisible: boolean;
      badgeStyle: PlanTagBadgeStyle;
      colorToken: string;
      sortKey: number;
    }
  | {
      kind: 'plan_view';
      id: string;
      name: string;
      levelId: string;
      viewTemplateId?: string | null;
      /** VIE-V3-03: new-style view template binding (distinct from viewTemplateId). */
      templateId?: string | null;
      /** VIE-V3-03: numeric drawing scale propagated from the bound view template. */
      scale?: number | null;
      planPresentation?: 'default' | 'opening_focus' | 'room_scheme';
      underlayLevelId?: string | null;
      discipline?: string;
      viewSubdiscipline?: string | null;
      phaseId?: string | null;
      phaseFilter?: PhaseFilter;
      cropMinMm?: XY | null;
      cropMaxMm?: XY | null;
      /** PLN-02 — when true, plan rendering clips elements outside crop bounds. */
      cropEnabled?: boolean | null;
      /** PLN-02 — when true, the dashed crop frame is drawn on the plan canvas
       * even when cropEnabled is false. */
      cropRegionVisible?: boolean | null;
      viewRangeBottomMm?: number | null;
      viewRangeTopMm?: number | null;
      cutPlaneOffsetMm?: number | null;
      /** D3: depth below viewRangeBottomMm for hidden-line elements (renders dashed). */
      viewDepth?: number | null;
      categoriesHidden?: string[];
      /** F-102: per-element IDs hidden in this plan view (Revit "Hide in View → Element"). */
      hiddenElementIds?: string[];
      planDetailLevel?: PlanDetailLevelPlan | null;
      planRoomFillOpacityScale?: number | null;
      planShowOpeningTags?: boolean;
      planShowRoomLabels?: boolean;
      planOpeningTagStyleId?: string | null;
      planRoomTagStyleId?: string | null;
      planCategoryGraphics?: PlanCategoryGraphicRow[];
      categoryOverrides?: Record<string, unknown>;
      viewFilters?: unknown[];
      vgFilters?: VGFilter[];
      elementOverrides?: Array<{ categoryOrId: string; alternateRender: string }>;
      /** KRN-V3-04: per-set option lock; key = optionSetId, value = optionId. */
      optionLocks?: Record<string, string>;
      /** DSC-V3-02: per-view discipline lens; 'show_all' = foreground for all elements. */
      defaultLens?: ViewLensMode;
      /** F-028: view subtype for tracking and Project Browser display. */
      planViewSubtype?:
        | 'floor_plan'
        | 'area_plan'
        | 'lighting_plan'
        | 'power_plan'
        | 'coordination_plan'
        | 'callout'
        | 'ceiling_plan'
        | 'drafting';
      /** D4: id of the parent plan_view this callout enlarges. */
      parentViewId?: string | null;
      /** D4: numeric scale multiplier relative to the parent view (default 5). */
      calloutScaleFactor?: number | null;
      /** §6.4.1: For callout views: the rectangle in parent-view space that this callout zooms into. */
      calloutBoundaryMm?: { xMm: number; yMm: number; widthMm: number; heightMm: number } | null;
      /** §6.4.1: Explicit display scale denominator for callout (e.g. 20 means 1:20). Overrides auto-fit. */
      calloutScaleOverride?: number | null;
      /** §6.4.1: The plan_view id this callout is scoped to (same level + filter settings). */
      calloutHostViewId?: string | null;
      /** F-098: Area Plan scheme for Gross Building / Net / Rentable grouping. */
      areaScheme?: 'gross_building' | 'net' | 'rentable';
      /** F2: phase filter display mode — controls per-phase graphic overrides in plan views. */
      phaseFilterMode?: 'new_construction' | 'demolition' | 'existing' | 'as_built' | null;
      /** §7.3.1: active work plane — id of a reference_plane element bound to this view. */
      activeWorkPlaneId?: string | null;
      /** §1.6.10: when true, all plan line weights are overridden to 1 px (thin lines mode). */
      thinLines?: boolean | null;
      /** §13.1.3: color fill scheme applied to this plan view (category + per-value colorMap). */
      colorScheme?: { category: string; colorMap: Record<string, string> } | null;
      /** §1.6.10: per-view category visibility/graphics overrides; these shadow global project overrides. */
      viewCategoryOverrides?: CategoryVisualOverride[] | null;
      /** §3.3.7: per-element linework overrides applied in this plan view. */
      lineworkOverrides?: Array<{
        elementId: string;
        colorHex: string;
        lineWeightPx: number;
        lineDash?: number[];
      }> | null;
      /** §5.4.2: per-view rotation applied when "Rotate to True North" is active (degrees). */
      planViewAngleDeg?: number;
      /** §1.6.10: crop region bounding box in plan-view space (mm). When set, only geometry inside is shown. */
      cropRegionMm?: { xMm: number; yMm: number; widthMm: number; heightMm: number } | null;
      /** §1.6.10: whether the crop region is active (visible + clipping enabled). */
      cropRegionEnabled?: boolean;
      /** §3.3.5: when true, EQ equality markers and lock symbols are shown on permanent_dimension elements. */
      showConstraints?: boolean;
      /** §2.9.4: when true, the underlay level is rendered as semi-transparent ghost lines. */
      showUnderlay?: boolean;
    }
  | {
      kind: 'view_template';
      id: string;
      name: string;
      /** Legacy string-enum scale (old view templates). */
      scale?: 'scale_50' | 'scale_100' | 'scale_200' | number | null;
      disciplinesVisible?: string[];
      hiddenCategories?: string[];
      planDetailLevel?: PlanDetailLevelPlan | null;
      planRoomFillOpacityScale?: number;
      planShowOpeningTags?: boolean;
      planShowRoomLabels?: boolean;
      defaultPlanOpeningTagStyleId?: string | null;
      defaultPlanRoomTagStyleId?: string | null;
      planCategoryGraphics?: PlanCategoryGraphicRow[];
      /** VIE-V3-03 fields */
      detailLevel?: 'coarse' | 'medium' | 'fine' | null;
      cropDefault?: Record<string, unknown> | null;
      visibilityFilters?: unknown[];
      elementOverrides?: Array<{ categoryOrId: string; alternateRender: string }>;
      phase?: string | null;
      phaseFilter?: string | null;
      templateControlMatrix?: ViewTemplateControlMatrix;
    }
  | Sheet
  | TitleblockType
  | WindowLegendView
  | {
      kind: 'schedule';
      id: string;
      name: string;
      sheetId?: string | null;
      filters?: Record<string, unknown>;
      grouping?: Record<string, unknown>;
      /** SCH-V3-01: ElemKind value for filtering rows. */
      category?: string | null;
      /** SCH-V3-01: column definitions for the schedule view. */
      columns?: Array<{ fieldKey: string; label: string; width?: number }>;
      /** SCH-V3-01: default filter expression. */
      filterExpr?: string | null;
      /** SCH-V3-01: default sort field key. */
      sortKey?: string | null;
      /** SCH-V3-01: default sort direction. */
      sortDir?: 'asc' | 'desc' | null;
    }
  | {
      kind: 'view_concept_board';
      id: string;
      name: string;
      attachments: Array<{
        id: string;
        kind: 'image' | 'pdf_page' | 'note' | 'model_link';
        rectMm: { xMm: number; yMm: number; widthMm: number; heightMm: number };
        payload: unknown;
        commentThreadIds?: string[];
      }>;
    }
  | {
      kind: 'site';
      id: string;
      name: string;
      referenceLevelId: string;
      boundaryMm: XY[];
      padThicknessMm?: number;
      baseOffsetMm?: number;
      northDegCwFromPlanX?: number | null;
      uniformSetbackMm?: number | null;
      contextObjects?: SiteContextObjectRow[];
    }
  | { kind: 'callout'; id: string; name: string; parentSheetId: string; outlineMm: XY[] }
  | {
      kind: 'bcf';
      id: string;
      title: string;
      viewpointRef?: string | null;
      status?: string;
      elementIds?: string[];
      planViewId?: string | null;
      sectionCutId?: string | null;
      evidenceRefs?: EvidenceRef[];
    }
  | {
      kind: 'agent_assumption';
      id: string;
      statement: string;
      source?: 'manual' | 'bundle_dry_run' | 'evidence_summary';
      closureStatus?: 'open' | 'resolved' | 'accepted' | 'deferred';
      relatedElementIds?: string[];
      relatedTopicId?: string | null;
    }
  | {
      kind: 'agent_deviation';
      id: string;
      statement: string;
      severity?: 'info' | 'warning' | 'error';
      acknowledged?: boolean;
      relatedAssumptionId?: string | null;
      relatedElementIds?: string[];
    }
  | { kind: 'validation_rule'; id: string; name: string; ruleJson: Record<string, unknown> }
  | {
      /** PLN-01 / ANN-01 — view-local placed tag (room / door / window).
       * `autoGenerated:true` marks tags emitted by the Auto-Tag tools so a
       * re-run can remove them before regenerating. */
      kind: 'placed_tag';
      id: string;
      hostElementId: string;
      hostViewId: string;
      positionMm: XY;
      tagDefinitionId?: string | null;
      textOverride?: string | null;
      autoGenerated?: boolean;
      /** §4.11 — element kind being tagged ('door' | 'window' | 'room' | 'wall'). */
      categoryKind?: string | null;
      /** §4.11 — leader line tip pointing at the tagged element in plan view. */
      leaderEndMm?: XY | null;
      /** §13.1.2 — which fields are shown in the room tag label. */
      showRoomName?: boolean | null;
      showRoomNumber?: boolean | null;
      showRoomArea?: boolean | null;
      /** §4.11 — display fields derived from the tagged element. */
      fields?: {
        mark?: string | null;
        typeName?: string | null;
        widthMm?: number | null;
        heightMm?: number | null;
        roomName?: string | null;
        roomNumber?: string | null;
        roomArea?: number | null; // area in mm²
      } | null;
    }
  | {
      /** ANN-01 — view-local 2D polyline (annotation only; not visible in 3D). */
      kind: 'detail_line';
      id: string;
      hostViewId: string;
      pointsMm: XY[];
      strokeMm?: number;
      colour?: string;
      style?: 'solid' | 'dashed' | 'dotted';
      /** §6.4.2 drafting fields */
      lineWeightPx?: number;
      colorHex?: string;
      lineStyle?: 'solid' | 'dashed' | 'dotted' | 'center';
      viewId?: string | null;
      levelId?: string | null;
    }
  | {
      /** §6.4.2 — view-local 2D arc (drafting element, not visible in 3D). */
      kind: 'detail_arc';
      id: string;
      centerMm: { xMm: number; yMm: number };
      radiusMm: number;
      startAngleDeg: number;
      endAngleDeg: number;
      lineWeightPx?: number;
      colorHex?: string;
      viewId?: string | null;
      levelId?: string | null;
    }
  | {
      /** §6.4.2 — view-local 2D filled region (drafting element, not visible in 3D). */
      kind: 'detail_filled_region';
      id: string;
      /** Closed polygon boundary. */
      perimeterMm: { xMm: number; yMm: number }[];
      /** Alias for perimeterMm — §6.4.2 drafting fields. */
      boundaryMm?: { xMm: number; yMm: number }[];
      /** Fill pattern: solid | hatch-45 | hatch-90 | cross | diagonal. */
      fillPattern?: 'solid' | 'hatch-45' | 'hatch-90' | 'cross' | 'diagonal';
      fillPatternId?: string | null;
      /** Fill color hex. */
      colorHex?: string;
      viewId?: string | null;
      levelId?: string | null;
    }
  | {
      /** ANN-01 / ANN-V3-01 — view-local 2D filled region (annotation only). */
      kind: 'detail_region';
      id: string;
      // v2 fields (ANN-01)
      hostViewId?: string;
      boundaryMm?: XY[];
      fillColour?: string;
      fillPattern?: 'solid' | 'hatch_45' | 'hatch_90' | 'crosshatch' | 'dots';
      strokeMm?: number;
      strokeColour?: string;
      // v3 fields (ANN-V3-01)
      viewId?: string | null;
      vertices?: Array<{ x: number; y: number }> | null;
      closed?: boolean | null;
      hatchId?: string | null;
      lineweightOverride?: number | null;
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
    }
  | {
      /** ANN-01 — view-local text note (annotation only). */
      kind: 'text_note';
      id: string;
      hostViewId: string;
      positionMm: XY;
      text: string;
      fontSizeMm: number;
      anchor?: 'tl' | 'tc' | 'tr' | 'cl' | 'c' | 'cr' | 'bl' | 'bc' | 'br';
      rotationDeg?: number;
      colour?: string;
      bold?: boolean | null;
      italic?: boolean | null;
      underline?: boolean | null;
      fontFamily?: string | null;
      colorHex?: string | null;
      horizontalAlign?: 'left' | 'center' | 'right' | null;
    }
  | {
      /** ANN-05 — view-local graphical symbol (North Arrow, Stair Path, Centerline). */
      kind: 'annotation_symbol';
      id: string;
      hostViewId: string;
      positionMm: XY;
      symbolType: 'north_arrow' | 'stair_up' | 'stair_down' | 'centerline';
      rotationDeg?: number;
      scale?: number;
      colour?: string;
    }
  | {
      /** ANN-16 — view-local leader annotation: arrow line + optional elbow + text block. */
      kind: 'leader_text';
      id: string;
      hostViewId: string;
      anchorMm: XY;
      elbowMm?: XY;
      textMm: XY;
      content: string;
      arrowStyle?: 'arrow' | 'dot' | 'none';
      colour?: string;
      bold?: boolean | null;
      italic?: boolean | null;
      underline?: boolean | null;
      fontFamily?: string | null;
      colorHex?: string | null;
      horizontalAlign?: 'left' | 'center' | 'right' | null;
    }
  | {
      kind: 'column';
      id: string;
      name: string;
      levelId: string;
      positionMm: XY;
      bMm: number;
      hMm: number;
      heightMm: number;
      rotationDeg?: number;
      materialKey?: string | null;
      loadBearing?: boolean | null;
      structuralRole?: StructuralRole;
      structuralMaterial?: StructuralMaterial | string | null;
      analysisStatus?: StructuralAnalysisStatus;
      fireResistanceRating?: string | null;
      baseConstraintOffsetMm?: number;
      topConstraintLevelId?: string | null;
      topConstraintOffsetMm?: number;
      /** IFC-04: optional OmniClass / Uniclass / NSCC code emitted as IfcClassificationReference. */
      ifcClassificationCode?: string | null;
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
      /** DSC-V3-01: discipline tag. */
      discipline?: DisciplineTag | null;
      /** SCH-V3-01: custom property values. */
      props?: Record<string, unknown>;
      /** F3 (WP-F): horizontal X shift of column top from base in mm (default 0 = vertical). */
      topOffsetXMm?: number;
      /** F3 (WP-F): horizontal Y shift of column top from base in mm (default 0 = vertical). */
      topOffsetYMm?: number;
      /** §9.1.1 — structural vs architectural usage classification. */
      columnUsage?: 'architectural' | 'structural' | null;
      /** §2.1.4 per-element graphics override — fill/line color in plan, surface color in 3D. */
      graphicsOverride?: {
        fillColorHex?: string | null;
        lineColorHex?: string | null;
        surfaceColorHex?: string | null;
      } | null;
      /** §9.1.3: when true, this is a decorative/architectural column (non-load-bearing). */
      isNonStructural?: boolean;
      /** §3.3.4: IDs of elements that cut voids into this column element. */
      cutBy?: string[];
    }
  | {
      kind: 'beam';
      id: string;
      name: string;
      levelId: string;
      startMm: XY;
      endMm: XY;
      widthMm: number;
      heightMm: number;
      materialKey?: string | null;
      loadBearing?: boolean | null;
      structuralRole?: StructuralRole;
      structuralMaterial?: StructuralMaterial | string | null;
      analysisStatus?: StructuralAnalysisStatus;
      fireResistanceRating?: string | null;
      startColumnId?: string | null;
      endColumnId?: string | null;
      /** IFC-04: optional OmniClass / Uniclass / NSCC code emitted as IfcClassificationReference. */
      ifcClassificationCode?: string | null;
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
      /** DSC-V3-01: discipline tag. */
      discipline?: DisciplineTag | null;
      /** SCH-V3-01: custom property values. */
      props?: Record<string, unknown>;
      /** §9.2: section profile type (I/H/C/L/T/HSS) for cross-section shape. */
      sectionProfile?: 'rectangular' | 'I' | 'H' | 'C' | 'L' | 'T' | 'HSS' | null;
      /** §9.5.4: optional custom parametric cross-section profile element. */
      sectionProfileId?: string | null;
      /** §9.2: flange width in mm — used for I, H, C profiles. */
      flangeWidthMm?: number | null;
      /** §9.2: flange thickness in mm — used for I, H profiles. */
      flangeThicknessMm?: number | null;
      /** §9.2: web thickness in mm — used for I, H profiles. */
      webThicknessMm?: number | null;
      /** §9.2 (WP-B): beam profile type for 3D mesh geometry. */
      beamProfileType?: 'rectangular' | 'I-beam' | 'H-beam' | 'HSS-round' | 'HSS-square' | null;
      /** §9.2 (WP-B): wall thickness in mm — used for HSS profiles. */
      wallThicknessMm?: number | null;
      /** §2.1.4 per-element graphics override — fill/line color in plan, surface color in 3D. */
      graphicsOverride?: {
        fillColorHex?: string | null;
        lineColorHex?: string | null;
        surfaceColorHex?: string | null;
      } | null;
    }
  | {
      kind: 'steel_connection';
      id: string;
      connectionType: 'end_plate' | 'bolted_flange' | 'shear_tab';
      hostElementId: string;
      targetElementId?: string;
      positionT?: number;
      plateSizeMm?: { width: number; height: number; thickness: number };
      boltRows?: number;
      boltCols?: number;
      boltDiameterMm?: number;
    }
  | {
      /** §9.5.4: parametric beam cross-section profile. */
      kind: 'beam_section_profile';
      id: string;
      name: string;
      profilePoints: { xMm: number; yMm: number }[];
      widthMm?: number;
      heightMm?: number;
    }
  | ToposolidPadElement
  | {
      kind: 'ceiling';
      id: string;
      name: string;
      levelId: string;
      boundaryMm: XY[];
      heightOffsetMm: number;
      thicknessMm: number;
      ceilingTypeId?: string | null;
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
      /** DSC-V3-01: discipline tag. */
      discipline?: DisciplineTag | null;
      /** SCH-V3-01: custom property values. */
      props?: Record<string, unknown>;
      /** §2.1.4 per-element graphics override — fill/line color in plan, surface color in 3D. */
      graphicsOverride?: {
        fillColorHex?: string | null;
        lineColorHex?: string | null;
        surfaceColorHex?: string | null;
      } | null;
      /** §3.3.4 Paint tool face material overrides. Key = faceId string, value = materialId. */
      faceMaterialOverrides?: Record<string, string> | null;
      /** §8.2 Grid pattern tile size for plan hatch. When set, plan view shows a grid hatch. */
      gridPatternMm?: number | null;
      /** §8.2 Origin offset for grid alignment. */
      gridOffsetMm?: { xMm: number; yMm: number } | null;
      /** §8.2 Rotation of grid lines in degrees, default 0. */
      gridAngleDeg?: number | null;
    }
  | {
      kind: 'color_fill_legend';
      id: string;
      hostViewId: string;
      positionMm: XY;
      schemeParameter: string;
      title: string;
    }
  | {
      kind: 'shared_param_file';
      id: string;
      name: string;
      groups: SharedParamGroup[];
    }
  | {
      kind: 'project_param';
      id: string;
      name: string;
      sharedParamGuid: string;
      categories: string[];
      instanceOrType: 'instance' | 'type';
    }
  | {
      kind: 'reference_plane';
      id: string;
      name: string;
      familyEditorId: string;
      isVertical: boolean;
      offsetMm: number;
      isSymmetryRef?: boolean;
    }
  | {
      /**
       * KRN-05 project-scope reference plane: a level-anchored sketch / work-plane
       * primitive distinct from the family-editor variant above. Discriminated by
       * presence of `levelId` (and absence of `familyEditorId`).
       */
      kind: 'reference_plane';
      id: string;
      name?: string;
      levelId: string;
      startMm: XY;
      endMm: XY;
      isWorkPlane?: boolean;
      pinned?: boolean;
    }
  | {
      /**
       * KRN-01: site / zoning property boundary line. Optional `setbackMm`
       * authors a parallel offset toward the property interior.
       */
      kind: 'property_line';
      id: string;
      name?: string;
      startMm: XY;
      endMm: XY;
      setbackMm?: number;
      classification?: 'street' | 'rear' | 'side' | 'other';
      authoringMode?: 'draw' | 'bearing_table';
      boundaryMm?: XY[];
      bearingTable?: {
        rows: Array<{ bearing: string; distanceMm: number }>;
        closesAt?: XY;
      };
      closureErrorMm?: number;
      pinned?: boolean;
    }
  | {
      kind: 'selection_set';
      id: string;
      name: string;
      filterRules: SelectionSetRule[];
    }
  | {
      kind: 'clash_test';
      id: string;
      name: string;
      setAIds: string[];
      setBIds: string[];
      toleranceMm: number;
      results?: ClashResult[];
    }
  | {
      kind: 'text_3d';
      id: string;
      text: string;
      fontFamily: Text3dFontFamily;
      fontSizeMm: number;
      depthMm: number;
      positionMm: XYZ;
      rotationDeg: number;
      materialKey?: string | null;
    }
  | {
      kind: 'project_base_point';
      id: string;
      positionMm: XYZ;
      angleToTrueNorthDeg: number;
      clipped?: boolean;
    }
  | {
      kind: 'survey_point';
      id: string;
      positionMm: XYZ;
      sharedElevationMm: number;
      clipped?: boolean;
    }
  | {
      kind: 'internal_origin';
      id: string;
    }
  | {
      /**
       * FED-01: a link to another bim-ai model in the same DB. The host treats
       * the source's elements as read-only renderable context. Snapshot
       * expansion (`?expandLinks=true`) inlines the source's elements with
       * provenance markers so renderers can ghost them.
       */
      kind: 'link_model';
      id: string;
      name: string;
      /** UUID of another bim-ai model in the same DB. */
      sourceModelId: string;
      /**
       * `null` (or omitted) follows the source's latest revision; an integer
       * pins the snapshot to that revision. Pin/unpin UI is deferred to a
       * follow-up WP.
       */
      sourceModelRevision?: number | null;
      positionMm: XYZ;
      /** Rotation around Z applied at the source origin (degrees). */
      rotationDeg: number;
      /**
       * `origin_to_origin`: source coordinates are translated by `positionMm`.
       * `project_origin`: source's project base point is aligned to host's PBP
       *   (KRN-06), then `positionMm` adds an extra offset; rotation gets the
       *   trueNorth delta added.
       * `shared_coords`: source's survey point is aligned to host's survey
       *   point, with `sharedElevationMm` reconciled on Z.
       */
      originAlignmentMode: 'origin_to_origin' | 'project_origin' | 'shared_coords';
      /**
       * `host_view`: linked elements obey the host's view filters / VV.
       * `linked_view`: linked elements use the source model's stored view
       *   definitions (rendered via the source's own VV / categories).
       */
      visibilityMode?: 'host_view' | 'linked_view';
      hidden?: boolean;
      pinned?: boolean;
    }
  | {
      /**
       * FED-04 — DXF underlay parsed from a customer's 2D site plan.
       *
       * The host materialises this element after `parse_dxf_to_linework`
       * runs server-side; the plan canvas renders `linework[]` as
       * desaturated grey strokes beneath authored geometry on `levelId`.
       * `scaleFactor` carries the unit conversion the parser inferred from
       * the DXF `$INSUNITS` header.
       */
      kind: 'link_dxf';
      id: string;
      name?: string;
      levelId: string;
      originMm: XY;
      /**
       * F-021: CAD positioning mode. For DXF, project/shared modes align the
       * DXF internal origin to the host Project Base Point or Survey Point;
       * `originMm` remains an additional per-link offset.
       */
      originAlignmentMode?: 'origin_to_origin' | 'project_origin' | 'shared_coords';
      /** F-017: import-time DXF unit override; omitted/source means use `$INSUNITS`. */
      unitOverride?: DxfUnitOverride | number | null;
      /** F-017: effective source-unit to millimetre scale applied while parsing. */
      unitScaleToMm?: number;
      rotationDeg?: number;
      scaleFactor?: number;
      linework: DxfLineworkPrim[];
      /** F-019: queryable DXF layer names/colors and primitive counts. */
      dxfLayers?: DxfLayerMeta[];
      /** F-019: layer names hidden for this linked/imported DXF in the current host view. */
      hiddenLayerNames?: string[];
      pinned?: boolean;
      sourcePath?: string;
      /** F-015/F-016/F-024: distinguishes reloadable linked CAD from embedded/imported CAD. */
      cadReferenceType?: 'linked' | 'embedded';
      /** F-015/F-024: source-file metadata captured on import/reload. */
      sourceMetadata?: Record<string, unknown>;
      reloadStatus?: 'not_reloaded' | 'ok' | 'source_missing' | 'parse_error' | 'embedded';
      lastReloadMessage?: string;
      loaded?: boolean;
      /** F-017 / F-020: render color mode. 'black_white' = desaturated grey (default); 'native' = use DXF layer colors. */
      colorMode?: 'black_white' | 'custom' | 'native';
      /** F-017: hex color used when colorMode === 'custom'. */
      customColor?: string;
      /** F-020: per-link opacity 0.0–1.0 (default 0.5). */
      overlayOpacity?: number;
    }
  | {
      /**
       * F-024 — generic external-link row for file references that are managed
       * like Revit links but do not have parsed host geometry in this slice.
       * Typed variants cover IFC, PDF, and raster-image links.
       */
      kind: 'link_external';
      id: string;
      name: string;
      externalLinkType: ExternalLinkType;
      sourcePath: string;
      sourceName?: string;
      sourceMetadata?: Record<string, unknown>;
      reloadStatus?: ExternalLinkStatus;
      lastReloadMessage?: string;
      loaded?: boolean;
      hidden?: boolean;
      pinned?: boolean;
      originMm?: XY;
      originAlignmentMode?: 'origin_to_origin' | 'project_origin' | 'shared_coords';
      rotationDeg?: number;
      scaleFactor?: number;
      overlayOpacity?: number;
    }
  | {
      /**
       * §12.1.1 — Link IFC File.
       *
       * Parses an IFC STEP file client-side and stores both the raw content
       * (for re-parsing on reload) and the converted bim-ai elements. Linked
       * elements are rendered as blue ghost meshes in the viewport.
       */
      kind: 'link_ifc';
      id: string;
      /** Display name of the linked IFC file. */
      name: string;
      /** The raw IFC STEP string content (stored for re-parsing). */
      ifcContent: string;
      /** Converted bim-ai elements derived from the IFC. */
      linkedElements: Element[];
      /** Whether the linked IFC is visible. */
      visible: boolean;
      /** Translation offset applied to all linked elements. */
      offsetMm?: { xMm: number; yMm: number; zMm: number };
      /** Whether the link is pinned (cannot be accidentally moved). */
      pinned?: boolean;
    }
  | {
      /**
       * §12.1.1 — Link PDF as plan underlay.
       *
       * Stores a PDF page (as a data URL or blob URL) as a translucent visual
       * underlay for tracing over in plan view.
       */
      kind: 'link_pdf';
      id: string;
      /** Data URL or blob URL of the PDF page image (client-side only). */
      url: string;
      /** Page index (0-based). */
      pageIndex: number;
      /** Opacity 0–1. Default 0.5. */
      opacity: number;
      /** Origin position in plan (mm). */
      positionMm: { xMm: number; yMm: number };
      /** Scale factor: mm per pixel of the original image. Default 1. */
      scaleMm: number;
      levelId: string;
      hidden?: boolean;
    }
  | {
      // §12.1.1: point cloud link element
      kind: 'link_pointcloud';
      id: string;
      name: string;
      /** Display color (hex number). Default 0xffa500 (orange). */
      color?: number;
      /** Whether the point cloud is visible in the viewport. */
      visible?: boolean;
      /** Approximate point count (informational). */
      pointCount?: number;
    }
  | {
      /**
       * KRN-15 — project-level swept solid.
       *
       * Extrudes a closed 2D `profileMm` along an open or closed
       * `pathMm` polyline. Used for fascia, gutters, mullion bodies,
       * picture-frame outlines around recessed loggias, and any
       * linear architectural feature with a constant cross-section.
       */
      kind: 'sweep';
      id: string;
      name?: string;
      levelId: string;
      pathMm: { xMm: number; yMm: number; zMm?: number }[];
      profileMm: { uMm: number; vMm: number }[];
      profilePlane: 'normal_to_path_start' | 'work_plane';
      materialKey?: string | null;
      worksetId?: string | null;
      pinned?: boolean;
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
      /** DSC-V3-01: discipline tag. */
      discipline?: DisciplineTag | null;
    }
  | {
      /**
       * KRN-14 — dormer load-bearing slice.
       *
       * Cuts the host roof and adds dormer walls + roof at the
       * `positionOnRoof` (local roof coords; alongRidgeMm is along
       * the ridge axis, acrossRidgeMm is the perpendicular distance
       * from ridge midpoint).
       */
      kind: 'dormer';
      id: string;
      name?: string;
      hostRoofId: string;
      positionOnRoof: { alongRidgeMm: number; acrossRidgeMm: number };
      widthMm: number;
      wallHeightMm: number;
      depthMm: number;
      dormerRoofKind: 'flat' | 'shed' | 'gable' | 'hipped';
      dormerRoofPitchDeg?: number;
      ridgeHeightMm?: number;
      wallMaterialKey?: string | null;
      roofMaterialKey?: string | null;
      hasFloorOpening?: boolean;
      pinned?: boolean;
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
      /** DSC-V3-01: discipline tag. */
      discipline?: DisciplineTag | null;
    }
  | {
      /**
       * KRN-08 — `area` element kind for legal/permit area calculations.
       *
       * Distinct from `room`: areas may include exterior porches and exclude
       * interior shafts based on `ruleSet`. Authored via SKT-01 sketch session.
       * `computedAreaSqMm` is recomputed by the engine after every command apply.
       */
      kind: 'area';
      id: string;
      name: string;
      levelId: string;
      boundaryMm: XY[];
      ruleSet: 'gross' | 'net' | 'no_rules';
      areaScheme?: 'gross_building' | 'net' | 'rentable';
      computedAreaSqMm?: number;
      pinned?: boolean;
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
    }
  | {
      /**
       * KRN-10 — view-local 2D filled region that occludes underlying linework.
       * Renders on plan / section / elevation as an opaque polygon above element
       * linework but below text/dimension annotations. Not visible in 3D.
       */
      kind: 'masking_region';
      id: string;
      hostViewId: string;
      boundaryMm: XY[];
      voidBoundariesMm?: XY[][];
      fillColor?: string;
    }
  | {
      /** ANN-02 — view-local spot elevation annotation (diamond symbol + text). */
      kind: 'spot_elevation';
      id: string;
      hostViewId: string;
      positionMm: XY;
      elevationMm: number;
      prefix?: string;
      suffix?: string;
      colour?: string;
      /** Show this annotation in the 3D viewport as a floating label. Default true. */
      showIn3D?: boolean | null;
      /** Elevation displayed relative to project base point (absolute) or to the active level (relative). */
      elevationMode?: 'absolute' | 'relative-to-level' | null;
      /** When set, replaces the computed elevation text entirely. */
      textOverride?: string | null;
    }
  | {
      /** ANN-06 — radial dimension from arc center to arc point. */
      kind: 'radial_dimension';
      id: string;
      hostViewId: string;
      centerMm: XY;
      arcPointMm: XY;
      radiusMm?: number | null;
      textOverride?: string | null;
      textPrefix?: string | null;
      flipped?: boolean | null;
      colour?: string;
      autoGenerated?: boolean;
    }
  | {
      /** ANN-07 — diameter dimension across a circle. */
      kind: 'diameter_dimension';
      id: string;
      hostViewId: string;
      centerMm: XY;
      arcPointMm: XY;
      radiusMm?: number | null;
      textOverride?: string | null;
      textPrefix?: string | null;
      flipped?: boolean | null;
      colour?: string;
      autoGenerated?: boolean;
    }
  | {
      /** ANN-08 — arc length dimension on a curved segment. */
      kind: 'arc_length_dimension';
      id: string;
      hostViewId: string;
      centerMm: XY;
      radiusMm: number;
      startAngleDeg: number;
      endAngleDeg: number;
      /** Radial offset of the dimension arc from the element arc (mm). Defaults to 200. */
      offsetMm?: number;
      colour?: string;
      autoGenerated?: boolean;
    }
  | {
      /** ANN-09 — view-local spot coordinate annotation (N/E at a point). */
      kind: 'spot_coordinate';
      id: string;
      hostViewId: string;
      positionMm: XY;
      northMm: number;
      eastMm: number;
      /** Optional real-world northing (mm) — editable in inspector. */
      coordinateN?: number;
      /** Optional real-world easting (mm) — editable in inspector. */
      coordinateE?: number;
      /** Z elevation at the point (optional, from terrain/slab). */
      elevationMm?: number;
      /** Label prefix string, e.g. 'N' / 'E'. */
      labelPrefix?: string;
      /** Level this annotation is associated with. */
      levelId?: string | null;
      colour?: string;
    }
  | {
      /** ANN-10 — view-local spot slope annotation. */
      kind: 'spot_slope';
      id: string;
      hostViewId: string;
      positionMm: XY;
      slopePct: number;
      slopeFormat?: 'percent' | 'ratio' | 'degree';
      colour?: string;
    }
  | {
      /** ANN-10b — two-point slope annotation arrow (start→end with slopePct). */
      kind: 'slope_annotation';
      id: string;
      startMm: XY;
      endMm: XY;
      /** Rise/run × 100, e.g. 8.33 for 1:12. */
      slopePct: number;
      levelId?: string | null;
    }
  | {
      /** ANN-11 — view-local insulation annotation (zigzag line). */
      kind: 'insulation_annotation';
      id: string;
      hostViewId: string;
      startMm: XY;
      endMm: XY;
      widthMm?: number;
      colour?: string;
    }
  | {
      /** ANN-12 — view-local material layer tag. */
      kind: 'material_tag';
      id: string;
      hostViewId: string;
      hostElementId: string;
      layerIndex?: number;
      positionMm: XY;
      textOverride?: string | null;
      /** Optional leader line end point (tip touching the element). */
      leaderEndMm?: XY | null;
      colour?: string;
    }
  | {
      /** ANN-13 — view-local multi-category tag (type mark). */
      kind: 'multi_category_tag';
      id: string;
      hostViewId: string;
      hostElementId: string;
      positionMm: XY;
      parameterName?: string;
      textOverride?: string | null;
      colour?: string;
    }
  | {
      /** ANN-14 — auto-numbered tread annotation for a stair. */
      kind: 'tread_number';
      id: string;
      hostViewId: string;
      stairElementId: string;
      startNumber?: number;
      colour?: string;
    }
  | {
      /** ANN-15 — view-local keynote annotation linking to a key/description. */
      kind: 'keynote';
      id: string;
      hostViewId: string;
      positionMm: XY;
      keynoteKey: string;
      keynoteText?: string;
      target?: 'element' | 'material' | 'user';
      hostElementId?: string | null;
      colour?: string;
    }
  | {
      /** ANN-16 — floor slab span direction arrow annotation. */
      kind: 'span_direction';
      id: string;
      hostViewId: string;
      positionMm: XY;
      directionDeg?: number;
      lengthMm?: number;
      colour?: string;
    }
  | {
      /** ANN-17 — view-local 2D detail component (predefined shape). */
      kind: 'detail_component';
      id: string;
      hostViewId: string;
      positionMm: XY;
      componentShape: string;
      rotationDeg?: number;
      scale?: number;
      colour?: string;
    }
  | {
      /** ANN-18 — view-local repeating detail component pattern along a line. */
      kind: 'repeating_detail';
      id: string;
      hostViewId: string;
      startMm: XY;
      endMm: XY;
      componentShape: string;
      spacingMm?: number;
      colour?: string;
    }
  | {
      /** ANN-19 — named group of view-local detail elements. */
      kind: 'detail_group';
      id: string;
      hostViewId: string;
      name?: string;
      memberIds: string[];
    }
  | {
      /** ANN-03 — view-local revision cloud (cloud-shaped closed annotation). */
      kind: 'revision_cloud';
      id: string;
      hostViewId: string;
      boundaryMm: XY[];
      colour?: string;
      strokeMm?: number;
    }
  | {
      /**
       * D6 — project-level revision entry. Tracks a single issued revision with
       * its number (e.g. "01"), date (ISO 8601), description, and issue metadata.
       */
      kind: 'revision';
      id: string;
      number: string;
      date: string;
      description: string;
      issuedBy?: string;
      issuedTo?: string;
    }
  | {
      /**
       * D6 — join table linking a revision to a specific sheet. Multiple
       * revisions may apply to a single sheet; each gets one sheet_revision row.
       */
      kind: 'sheet_revision';
      id: string;
      sheetId: string;
      revisionId: string;
    }
  | {
      /**
       * EDT-02 — geometric constraint between element groups. The engine
       * evaluates constraints after each command apply and rejects the
       * bundle when any `error`-severity constraint is violated. The most
       * common case is `equal_distance` with a `lockedValueMm` captured
       * from the padlock UI on a temp-dimension.
       */
      kind: 'constraint';
      id: string;
      name?: string;
      rule: ConstraintRule;
      refsA: ConstraintRefRow[];
      refsB: ConstraintRefRow[];
      lockedValueMm?: number | null;
      severity?: ConstraintSeverity;
      pinned?: boolean;
    }
  | {
      /**
       * SKB-02 — volumetric massing primitive used during the SKB-12
       * cookbook's massing phase. A `materializeMassToWalls` engine
       * command auto-extracts walls + floor + roof-stub from each mass
       * once the agent commits the volume.
       */
      kind: 'mass';
      id: string;
      name?: string;
      levelId: string;
      footprintMm: XY[];
      heightMm: number;
      rotationDeg?: number;
      materialKey?: string | null;
      phaseId?: string | null;
      pinned?: boolean;
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
      /** DSC-V3-01: discipline tag. */
      discipline?: DisciplineTag | null;
    }
  | {
      /** KRN-V3-01 — project-level phasing primitive. Default chain: Existing → Demolition → New. */
      kind: 'phase';
      id: string;
      name: string;
      ord: number;
      description?: string | null;
    }
  | {
      /**
       * KRN-V3-03 G11 — derived overlay joining two roof solids along a seam.
       *
       * Does NOT mutate the source `roof` records. The renderer computes the seam
       * polyline on the fly from the two roof footprints.
       * Pre-commit (PENDING state): seam renders in `var(--draft-warning)` colour.
       * Post-commit: seam renders as a thin ridge line using the primary roof's materialKey.
       */
      kind: 'roof_join';
      id: string;
      name?: string;
      primaryRoofId: string;
      secondaryRoofId: string;
      seamMode: 'clip_secondary_into_primary' | 'merge_at_ridge';
      pinned?: boolean;
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
    }
  | {
      /**
       * KRN-V3-03 G12 / KRN-V3-08 — swept profile run along a host element edge.
       *
       * Resolves to a swept solid (2D profile × edge polyline) at render time.
       * Profile families: fascia, gutter, downpipe, plinth, cornice, water-table.
       * `hostEdge` accepts roof edge tokens ('eave', 'rake', 'ridge') or a WallEdgeSpec.
       * `mode` defaults to 'sweep' (additive); 'reveal' subtracts from the host.
       * Colour must use material tokens from T5, not inline hex literals.
       */
      kind: 'edge_profile_run';
      id: string;
      name?: string;
      hostElementId: string;
      hostEdge: 'eave' | 'rake' | 'ridge' | WallEdgeSpec;
      profileFamilyId: string;
      offsetMm: { xMm: number; yMm: number };
      miterMode: 'auto' | 'manual';
      mode?: 'sweep' | 'reveal';
      pinned?: boolean;
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
    }
  | {
      /**
       * KRN-V3-03 G13 — horizontal soffit panel under a roof eave.
       *
       * `boundaryMm` is a closed plan polygon (≥ 3 vertices).
       * `zMm` is the underside elevation (filled by the engine from the host
       * roof's eave elevation when the command omits it).
       */
      kind: 'soffit';
      id: string;
      name?: string;
      boundaryMm: XY[];
      hostRoofId?: string | null;
      thicknessMm: number;
      zMm: number;
      pinned?: boolean;
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
      /** DSC-V3-01: discipline tag. */
      discipline?: DisciplineTag | null;
    }
  | {
      /** SUN-V3-01 — project-level sun & shadow study singleton. */
      kind: 'sun_settings';
      id: string;
      latitudeDeg: number;
      longitudeDeg: number;
      dateIso: string;
      timeOfDay: { hours: number; minutes: number };
      daylightSavingStrategy?: 'auto' | 'on' | 'off' | null;
    }
  | {
      kind: 'beam_system';
      id: string;
      name?: string;
      levelId: string;
      boundaryPoints: { xMm: number; yMm: number }[];
      beamDirection: number;
      spacingMm: number;
      directionDeg: number;
      beamCount?: number | null;
      beamTypeId?: string | null;
      profileId?: string;
      materialKey?: string | null;
      justification?:
        | 'beginning'
        | 'center'
        | 'end'
        | 'centre'
        | 'bearing_line_1'
        | 'bearing_line_2'
        | null;
      structuralRole?: 'structural' | 'non-structural';
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
      discipline?: DisciplineTag | null;
    }
  | {
      kind: 'brace';
      id: string;
      name?: string;
      startXMm: number;
      startYMm: number;
      startElevationMm: number;
      endXMm: number;
      endYMm: number;
      endElevationMm: number;
      profileId?: string;
      materialKey?: string | null;
      structuralRole: 'structural';
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
      discipline?: DisciplineTag | null;
    }
  | {
      /** G5a: Box mass primitive for conceptual massing. */
      kind: 'mass_box';
      id: string;
      name?: string;
      widthMm: number;
      depthMm: number;
      heightMm: number;
      insertionXMm: number;
      insertionYMm: number;
      baseElevationMm: number;
      rotationDeg?: number;
      materialKey?: string | null;
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
      discipline?: DisciplineTag | null;
    }
  | {
      /** G5b: Extruded mass — a polygon footprint extruded to a height. */
      kind: 'mass_extrusion';
      id: string;
      name?: string;
      profilePoints: { xMm: number; yMm: number }[];
      heightMm: number;
      baseElevationMm: number;
      materialKey?: string | null;
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
      discipline?: DisciplineTag | null;
    }
  | {
      /** G5c: Revolved mass — a profile rotated around an axis. */
      kind: 'mass_revolution';
      id: string;
      name?: string;
      profilePoints: { xMm: number; yMm: number }[];
      axisPt1: { xMm: number; yMm: number };
      axisPt2: { xMm: number; yMm: number };
      startAngleDeg?: number;
      endAngleDeg?: number;
      baseElevationMm: number;
      materialKey?: string | null;
      phaseCreated?: string | null;
      phaseDemolished?: string | null;
      discipline?: DisciplineTag | null;
    }
  | {
      /**
       * D2 — 4-direction interior elevation marker. Placed inside a room; the
       * engine auto-creates four `elevation_view` children (N/S/E/W) keyed by
       * `elevationViewIds`. Renders as a 4-quadrant circle on plan.
       */
      kind: 'interior_elevation_marker';
      id: string;
      positionMm: XY;
      levelId: string;
      /** Half-extent of the crop box for each elevation view, in mm (default 3000). */
      radiusMm?: number;
      /** Which of the four elevation views are active. Defaults to all four when omitted. */
      activeQuadrants?: ('N' | 'S' | 'E' | 'W')[];
      /** IDs of the four auto-created elevation_view elements. */
      elevationViewIds: { north: string; south: string; east: string; west: string };
    }
  | {
      /**
       * ANN-P2 — permanent aligned dimension chain with N witness points.
       * EQ mode drives all segments to equal spacing (visual only).
       */
      kind: 'permanent_dimension';
      id: string;
      levelId: string;
      /** Ordered witness points (plan mm). Must have ≥2 points. */
      witnessPointsMm: DimWitnessPoint[];
      /** Offset of dimension line from the witness point chain, in mm. */
      offsetMm: XY;
      /** When true, display "EQ" instead of individual segment values. */
      eqEnabled?: boolean;
      /** When true, dimension line is on the opposite side of the witness chain. */
      flipped?: boolean | null;
      /** §3.3.5: When true, this dimension drives an equality constraint (EQ). */
      isEqualityDimension?: boolean;
      /** §3.3.5: When true, the dimension is locked (cannot be changed by moving elements). */
      isLocked?: boolean;
    }
  | {
      kind: 'sheet_viewport';
      id: string;
      sheetId: string;
      viewId: string;
      xMm: number;
      yMm: number;
      widthMm: number;
      heightMm: number;
      scaleDenom: number;
    }
  | CameraPathElem
  | ShaftElement
  | ModelLineElement
  | {
      kind: 'conical_roof';
      id: string;
      centerMm: { xMm: number; yMm: number };
      baseRadiusMm: number;
      heightMm: number;
      baseElevationMm: number;
      materialId?: string | null;
      levelId?: string | null;
    }
  | {
      kind: 'dome_roof';
      id: string;
      centerMm: { xMm: number; yMm: number };
      baseRadiusMm: number;
      riseRatio: number;
      baseElevationMm: number;
      materialId?: string | null;
      levelId?: string | null;
    }
  | {
      kind: 'spire_roof';
      id: string;
      centerMm: { xMm: number; yMm: number };
      baseRadiusMm: number;
      heightMm: number;
      baseElevationMm: number;
      materialId?: string | null;
      levelId?: string | null;
    }
  | {
      kind: 'family_blend';
      id: string;
      name?: string | null;
      /** Bottom profile polygon (closed, in mm from family origin). */
      bottomProfileMm: XY[];
      /** Top profile polygon (closed, in mm from family origin). */
      topProfileMm: XY[];
      /** Height of the blend (mm). */
      heightMm: number;
      /** Bottom elevation (mm). */
      baseElevationMm?: number;
      materialId?: string | null;
      levelId?: string | null;
      agentTrace?: AgentTrace;
      optionSetId?: string | null;
      optionId?: string | null;
      discipline?: DisciplineTag | null;
    }
  | {
      kind: 'family_sweep';
      id: string;
      name?: string | null;
      /** 2D profile polygon (in mm, local to path start). */
      profileMm: XY[];
      /** Sweep path — list of 3D points (mm). */
      pathMm: { xMm: number; yMm: number; zMm: number }[];
      materialId?: string | null;
      levelId?: string | null;
      agentTrace?: AgentTrace;
      optionSetId?: string | null;
      optionId?: string | null;
      discipline?: DisciplineTag | null;
    }
  | {
      kind: 'family_swept_blend';
      id: string;
      name?: string | null;
      /** Start profile polygon in local XY plane (mm). */
      startProfileMm: Array<{ xMm: number; yMm: number }>;
      /** End profile polygon in local XY plane (mm, may differ in shape/size). */
      endProfileMm: Array<{ xMm: number; yMm: number }>;
      /** Path points that the cross-section is swept along (mm). */
      pathMm: Array<{ xMm: number; yMm: number; zMm?: number }>;
      baseElevationMm?: number;
      materialKey?: string;
      materialId?: string | null;
      levelId?: string | null;
      agentTrace?: AgentTrace;
      optionSetId?: string | null;
      optionId?: string | null;
      discipline?: DisciplineTag | null;
    }
  | {
      kind: 'family_revolve';
      id: string;
      name?: string | null;
      profilePoints: { x: number; y: number }[];
      axisMm?: { x: number; z: number };
      angleDeg?: number;
      levelId?: string | null;
    }
  | {
      kind: 'family_void';
      id: string;
      name?: string | null;
      profilePoints: { x: number; y: number }[];
      depthMm?: number;
      levelId?: string | null;
    }
  | {
      /** §15.1.3: parametric opening cut shape within a wall-hosted family definition.
       *  When the family is placed in a wall, this geometry defines the void cut. */
      kind: 'family_opening_cut';
      id: string;
      /** Parent family definition element ID. */
      familyId: string;
      /** Width of the opening cut in mm (local family X axis). */
      widthMm: number;
      /** Height of the opening cut in mm (local family Z axis). */
      heightMm: number;
      /** Vertical offset from sill (bottom of opening) in mm. Defaults to 0. */
      sillOffsetMm?: number;
    }
  | {
      /** §15.1.2: a nested sub-component instance placed inside a family definition. */
      kind: 'family_component';
      id: string;
      /** The parent family definition's element ID. */
      familyId: string;
      /** Which catalog family type this component represents (e.g. 'door-hardware', 'hinge'). */
      componentTypeId: string;
      /** Label shown in FamilyEditorWorkbench. */
      label?: string;
      /** Position within the family's local coordinate system (mm). */
      originMm: { xMm: number; yMm: number; zMm: number };
      /** Rotation in degrees around the vertical (Z) axis. */
      rotationDeg?: number;
    }
  | {
      /** §15.1.3: a construction reference plane in a family definition. Defines parametric axes and origins. */
      kind: 'family_reference_plane';
      id: string;
      familyId: string;
      /** Human-readable name (e.g. "Center (Left/Right)", "Width Reference"). */
      name: string;
      /** Axis direction in the family's local XZ plane: 'x' (vertical line) or 'z' (horizontal line). */
      axis: 'x' | 'z';
      /** Offset from origin along the perpendicular axis, in mm. */
      offsetMm: number;
      /** Whether this is a strong reference (can be dimensioned to from the project). */
      isReference?: boolean;
    }
  | {
      /** §15.1.2: a top-level family definition element stored in the project BIM store. */
      kind: 'family_definition';
      id: string;
      /** Human-readable family name. */
      name?: string;
      /** Revit-style family category. Determines schedule, visibility controls, and object snap behavior. */
      categoryKey?: string;
    }
  | {
      kind: 'group_definition';
      id: string;
      name?: string | null;
      elementIds: string[];
    }
  | {
      kind: 'group_instance';
      id: string;
      name?: string | null;
      groupDefinitionId: string;
      insertionXMm?: number;
      insertionYMm?: number;
      levelId?: string | null;
    }
  | ToposolidElem
  | ToposolidSubdivisionElem
  | ToposolidExcavationElem
  | GradedRegionElem
  | HatchPatternDef
  | NeighborhoodMassElem
  | NeighborhoodImportSessionElem
  | ConceptSeedElem
  | View
  | ThermalBridgeMarkerElem
  | RenovationScenarioElem
  | BuildingServicesHandoffElem
  | AssetLibraryEntryElem
  | PlacedAssetElem
  | FamilyKitInstanceElem
  | ImageAssetElem
  | MaterialElem
  | DecalElem
  | PropertyDefinitionElem
  | ImageUnderlayElem
  | FrameElem
  | SavedViewElem
  | PresentationCanvasElem
  | BrandTemplateElem
  | {
      kind: 'pipe';
      id: string;
      name?: string | null;
      levelId: string;
      startMm: XY;
      endMm: XY;
      diameterMm?: number;
      elevationMm?: number | null;
      materialKey?: string | null;
      systemType?: string | null;
      systemName?: string | null;
      flowDirection?: string | null;
      serviceLevel?: string | null;
      insulation?: Record<string, unknown> | null;
      connectors?: Record<string, unknown>[];
      clearanceZone?: Record<string, unknown> | null;
      maintainAccessZone?: Record<string, unknown> | null;
      agentTrace?: AgentTrace;
      optionSetId?: string | null;
      optionId?: string | null;
      discipline?: DisciplineTag | string | null;
    }
  | {
      kind: 'duct';
      id: string;
      name?: string | null;
      levelId: string;
      startMm: XY;
      endMm: XY;
      widthMm?: number;
      heightMm?: number;
      shape?: string | null;
      elevationMm?: number | null;
      systemType?: string | null;
      systemName?: string | null;
      flowDirection?: string | null;
      serviceLevel?: string | null;
      insulation?: Record<string, unknown> | null;
      connectors?: Record<string, unknown>[];
      clearanceZone?: Record<string, unknown> | null;
      maintainAccessZone?: Record<string, unknown> | null;
      agentTrace?: AgentTrace;
      optionSetId?: string | null;
      optionId?: string | null;
      discipline?: DisciplineTag | string | null;
    }
  | {
      kind: 'pipe_legend';
      id: string;
      title?: string;
      hostViewId?: string | null;
      positionMm?: XY;
      entries?: Record<string, unknown>[];
      discipline?: DisciplineTag | string | null;
    }
  | {
      kind: 'duct_legend';
      id: string;
      title?: string;
      hostViewId?: string | null;
      positionMm?: XY;
      entries?: Record<string, unknown>[];
      discipline?: DisciplineTag | string | null;
    }
  | {
      kind: 'cable_tray';
      id: string;
      name?: string | null;
      levelId: string;
      startMm: XY;
      endMm: XY;
      widthMm?: number;
      heightMm?: number | null;
      elevationMm?: number | null;
      systemType?: string | null;
      systemName?: string | null;
      discipline?: DisciplineTag | string | null;
      agentTrace?: AgentTrace;
      optionSetId?: string | null;
      optionId?: string | null;
    }
  | {
      kind: 'mep_equipment';
      id: string;
      name?: string | null;
      levelId: string;
      positionMm: XY;
      equipmentType?: string | null;
      familyTypeId?: string | null;
      elevationMm?: number | null;
      electricalLoadW?: number | null;
      systemType?: string | null;
      systemName?: string | null;
      discipline?: DisciplineTag | string | null;
      agentTrace?: AgentTrace;
      optionSetId?: string | null;
      optionId?: string | null;
      [key: string]: unknown;
    }
  | {
      kind: 'mep_terminal';
      id: string;
      name?: string | null;
      levelId: string;
      positionMm: XY;
      terminalKind?: string | null;
      roomId?: string | null;
      systemType?: string | null;
      systemName?: string | null;
      flowDirection?: string | null;
      discipline?: DisciplineTag | string | null;
      agentTrace?: AgentTrace;
      optionSetId?: string | null;
      optionId?: string | null;
    }
  | {
      kind: 'fixture';
      id: string;
      name?: string | null;
      levelId: string;
      positionMm: XY;
      fixtureType?: string | null;
      roomId?: string | null;
      electricalLoadW?: number | null;
      systemType?: string | null;
      systemName?: string | null;
      discipline?: DisciplineTag | string | null;
      agentTrace?: AgentTrace;
      optionSetId?: string | null;
      optionId?: string | null;
    }
  | {
      kind: 'mep_opening_request';
      id: string;
      name?: string | null;
      hostElementId: string;
      levelId?: string | null;
      openingKind?: string | null;
      status?: string | null;
      widthMm?: number | null;
      heightMm?: number | null;
      diameterMm?: number | null;
      clearanceMm?: number | null;
      requesterElementIds?: string[];
      approvalNote?: string | null;
      requestedBy?: string | null;
      discipline?: DisciplineTag | string | null;
      agentTrace?: AgentTrace;
      optionSetId?: string | null;
      optionId?: string | null;
    }
  | {
      kind: 'text_tag';
      id: string;
      positionMm: XY;
      label: string;
      levelId: string;
      hostViewId?: string | null;
      discipline?: DisciplineTag | null;
      agentTrace?: AgentTrace;
      optionSetId?: string | null;
      optionId?: string | null;
    }
  | Saved3dViewElement
  | {
      kind: 'family_parameter';
      id: string;
      /** Human-readable parameter name (e.g. "Width", "Breite"). */
      name: string;
      /** Parameter type. */
      paramType: 'length' | 'angle' | 'number' | 'boolean' | 'string';
      /** Current default value (in mm for length, degrees for angle). */
      defaultValue: number | boolean | string;
      /** Whether this parameter is an instance parameter (vs type parameter). */
      isInstance: boolean;
      /** Family ID this parameter belongs to. */
      familyId: string | null;
      /** Optional: link to a dimension on a geometry element. */
      linkedDimensionId?: string | null;
      /** Optional: which property of the geometry element is driven (e.g. 'widthMm', 'heightMm'). */
      linkedProperty?: string | null;
      /** §15.1.2: optional formula string (e.g. "Width / 2" or "Height * 0.6"). Evaluated at apply time. */
      formula?: string;
    }
  | FamilyConstraintElem
  | {
      /** §8.6.2: individual stair run segment belonging to a parent stair. */
      kind: 'stair_run';
      id: string;
      /** Parent stair this run belongs to. */
      stairId: string;
      startMm: { xMm: number; yMm: number };
      endMm: { xMm: number; yMm: number };
      runWidthMm: number;
      riserCount: number;
      /** Run index in stair (0-based). */
      runIndex: number;
    }
  | {
      /** §8.6.2: flat landing connecting two stair runs. */
      kind: 'stair_landing';
      id: string;
      /** Parent stair this landing belongs to. */
      stairId: string;
      /** Polygon corners of the landing slab. */
      perimeterMm: { xMm: number; yMm: number }[];
      /** Absolute elevation of the landing top surface. */
      elevationMm: number;
      /** Landing index (0-based). */
      landingIndex: number;
    }
  | {
      /** §7.3.2: active work plane derived from a wall/floor face or a level elevation. */
      kind: 'work_plane';
      id: string;
      /** Display name for the work plane. */
      name: string;
      /** Host element ID (wall, floor, roof) whose face defines the plane. */
      hostElementId?: string;
      /** Elevation of the work plane in mm (for horizontal planes). */
      elevationMm: number;
      /** Normal vector in plan (degrees from +X axis). 0 = XY plane (horizontal). */
      normalDeg?: number;
      levelId: string;
    };

export type Violation = {
  ruleId: string;

  severity: 'info' | 'warning' | 'error';

  message: string;

  elementIds?: string[];

  blocking?: boolean;

  quickFixCommand?: Record<string, unknown> | null;

  /** When set (by constraints), Advisor can filter rows by discipline perspective */
  discipline?: string | null;
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
// IMG-V3-01 — StructuredLayout wire types
// ---------------------------------------------------------------------------

export type Advisory = { code: string; message?: string };

export type PointMm = { x: number; y: number };

export type BboxMm = { x: number; y: number; w: number; h: number };

export type RoomRegion = {
  id: string;
  polygonMm: PointMm[];
  detectedTypeKey?: string;
  detectedAreaMm2?: number;
};

export type WallSegment = {
  id: string;
  aMm: PointMm;
  bMm: PointMm;
  thicknessMm?: number;
};

export type OpeningHint = {
  id: string;
  hostWallId: string;
  tAlongWall: number;
  widthMm?: number;
  kindHint?: 'door' | 'window';
};

export type OcrLabel = {
  text: string;
  bboxMm: BboxMm;
  confidence: number;
};

export type ImageMetadata = {
  widthPx: number;
  heightPx: number;
  calibrationMmPerPx?: number;
};

export type StructuredLayout = {
  schemaVersion: 'img-v3.0';
  imageMetadata: ImageMetadata;
  rooms: RoomRegion[];
  walls: WallSegment[];
  openings: OpeningHint[];
  ocrLabels: OcrLabel[];
  advisories: Advisory[];
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

export type { FamilySweptBlend };

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
  profilePoints: { xMm: number; yMm: number }[] | null;
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
