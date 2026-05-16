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
  hostToposolidId: string;
  boundaryMm: { xMm: number; yMm: number }[];
  targetMode: 'flat' | 'slope';
  targetZMm?: number;
  slopeAxisDeg?: number;
  slopeDegPercent?: number;
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
  | 'custom_depth';

export type ToposolidExcavationElem = {
  kind: 'toposolid_excavation';
  id: string;
  hostToposolidId: string;
  cutterElementId: string;
  cutMode: ToposolidExcavationCutMode;
  offsetMm: number;
  customDepthMm?: number | null;
  estimatedVolumeM3?: number | null;
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
  | 'presentation_canvas'
  | 'brand_template'
  | 'thermal_bridge_marker'
  | 'renovation_scenario'
  | 'building_services_handoff'
  | 'radial_dimension'
  | 'diameter_dimension'
  | 'arc_length_dimension';

export type PhaseFilter = 'all' | 'existing' | 'demolition' | 'new';

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
  brace: 'struct',
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

export type WallLayerFunction = 'structure' | 'insulation' | 'finish';
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

export type Element =
  | {
      kind: 'project_settings';
      id: string;
      lengthUnit?: string;
      angularUnitDeg?: string;
      displayLocale?: string;
      name?: string;
      projectNumber?: string | null;
      clientName?: string | null;
      projectAddress?: string | null;
      projectStatus?: string | null;
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
    }
  | {
      kind: 'door';
      id: string;
      name: string;
      wallId: string;
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
    }
  | {
      kind: 'window';
      id: string;
      name: string;
      wallId: string;
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
        | 'coordination_plan';
      /** F-098: Area Plan scheme for Gross Building / Net / Rentable grouping. */
      areaScheme?: 'gross_building' | 'net' | 'rentable';
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
    }
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
    }
  | {
      /** ANN-06 — radial dimension from arc center to arc point. */
      kind: 'radial_dimension';
      id: string;
      hostViewId: string;
      centerMm: XY;
      arcPointMm: XY;
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
      animationRange?: { startIso: string; endIso: string; intervalMinutes: number } | null;
      daylightSavingStrategy: 'auto' | 'on' | 'off';
    }
  | View
  | ToposolidElem
  | ToposolidSubdivisionElem
  | GradedRegionElem
  | ToposolidExcavationElem
  | AssetLibraryEntryElem
  | PlacedAssetElem
  | FamilyKitInstanceElem
  | HatchPatternDef
  | PropertyDefinitionElem
  | MaterialElem
  | ImageAssetElem
  | DecalElem
  | ImageUnderlayElem
  | NeighborhoodMassElem
  | NeighborhoodImportSessionElem
  | ConceptSeedElem
  | FrameElem
  | SavedViewElem
  | PresentationCanvasElem
  | BrandTemplateElem
  | ThermalBridgeMarkerElem
  | RenovationScenarioElem
  | BuildingServicesHandoffElem
  | ({
      kind: 'pipe';
      id: string;
      name?: string;
      levelId: string;
      startMm: XY;
      endMm: XY;
      elevationMm?: number;
      diameterMm?: number;
      materialKey?: string | null;
      colour?: string | null;
    } & MepCommonFields)
  | ({
      kind: 'duct';
      id: string;
      name?: string;
      levelId: string;
      startMm: XY;
      endMm: XY;
      elevationMm?: number;
      widthMm?: number;
      heightMm?: number;
      shape?: 'rectangular' | 'round' | 'oval';
      colour?: string | null;
    } & MepCommonFields)
  | ({
      kind: 'cable_tray';
      id: string;
      name?: string;
      levelId: string;
      startMm: XY;
      endMm: XY;
      elevationMm?: number;
      widthMm?: number;
      heightMm?: number;
      colour?: string | null;
    } & MepCommonFields)
  | ({
      kind: 'mep_equipment';
      id: string;
      name?: string;
      levelId: string;
      positionMm: XY;
      elevationMm?: number;
      equipmentType?: string | null;
      familyTypeId?: string | null;
      electricalLoadW?: number | null;
    } & MepCommonFields)
  | ({
      kind: 'fixture';
      id: string;
      name?: string;
      levelId: string;
      positionMm: XY;
      roomId?: string | null;
      fixtureType?: string | null;
      electricalLoadW?: number | null;
    } & MepCommonFields)
  | ({
      kind: 'mep_terminal';
      id: string;
      name?: string;
      terminalKind?: 'diffuser' | 'terminal' | 'sprinkler' | 'device';
      levelId: string;
      positionMm: XY;
      roomId?: string | null;
    } & MepCommonFields)
  | ({
      kind: 'mep_opening_request';
      id: string;
      name?: string;
      hostElementId: string;
      levelId?: string | null;
      requesterElementIds?: string[];
      openingKind?: 'wall' | 'slab' | 'roof' | 'shaft';
      status?: 'requested' | 'approved' | 'rejected' | 'installed';
      positionMm?: XY | null;
      widthMm?: number | null;
      heightMm?: number | null;
      diameterMm?: number | null;
      clearanceMm?: number;
      approvalNote?: string | null;
    } & MepCommonFields)
  | {
      kind: 'pipe_legend';
      id: string;
      hostViewId: string;
      positionMm: XY;
      title?: string;
      entries: { systemType: string; label: string; colour: string }[];
    }
  | {
      kind: 'duct_legend';
      id: string;
      hostViewId: string;
      positionMm: XY;
      title?: string;
      entries: { systemType: string; label: string; colour: string }[];
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
  cameraState?: Record<string, unknown>;
  visibilityOverrides?: Record<string, unknown>;
  detailLevel?: string;
  thumbnailDataUri?: string;
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
