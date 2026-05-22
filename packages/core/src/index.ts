export * from './parseDimensionInput';
import type {
  BuildingBaseElement,
  DimensionElement,
  FloorTypeElement,
  GridLineElement,
  LevelElement,
  ProjectSettingsElement,
  RoofTypeElement,
  RoomElement,
  RoomColorSchemeElement,
  WallTypeElement,
} from './elements/building';
import type { DocumentationElement } from './elements/documentation';
import type {
  CableTrayElement,
  DuctElement,
  DuctLegendElement,
  FixtureElement,
  MepEquipmentElement,
  MepOpeningRequestElement,
  MepTerminalElement,
  PipeElement,
  PipeLegendElement,
} from './elements/mep';
import type {
  BeamElement,
  BeamSectionProfileElement,
  BeamSystemElement,
  BraceElement,
  ColumnElement,
  SteelConnectionElement,
} from './elements/structural';
import type {
  AnnotationSymbolElement,
  ColorFillLegendElement,
  DetailArcElement,
  DetailFilledRegionElement,
  DetailLineElement,
  DetailRegionElement,
  LeaderTextElement,
  PlacedTagElement,
  Text3dElement,
  TextNoteElement,
  TextTagElement,
} from './elements/annotations';

export type {
  CableTrayElement,
  DuctElement,
  DuctLegendElement,
  FixtureElement,
  MepEquipmentElement,
  MepOpeningRequestElement,
  MepTerminalElement,
  PipeElement,
  PipeLegendElement,
} from './elements/mep';
export type {
  BeamElement,
  BeamSectionProfileElement,
  BeamSystemElement,
  BraceElement,
  ColumnElement,
  SteelConnectionElement,
} from './elements/structural';
export type {
  AnnotationSymbolElement,
  ColorFillLegendElement,
  DetailArcElement,
  DetailFilledRegionElement,
  DetailLineElement,
  DetailRegionElement,
  LeaderTextElement,
  PlacedTagElement,
  Text3dElement,
  TextNoteElement,
  TextTagElement,
} from './elements/annotations';
import type {
  AssetLibraryEntryElem,
  DecalElem,
  FamilyKitInstanceElem,
  ImageAssetElem,
  MaterialElem,
  PlacedAssetElem,
} from './resources';
import type { FamilyConstraintElem, FamilyElement } from './elements/family';
import type {
  ConceptSeedElem,
  GradedRegionElem,
  HatchPatternDef,
  NeighborhoodImportSessionElem,
  NeighborhoodMassElem,
  ShaftElement,
  ToposolidElem,
  ToposolidExcavationElem,
  ToposolidPadElement,
  ToposolidSubdivisionElem,
} from './elements/site';
import type {
  AgentTrace,
  BrandTemplateElem,
  CameraPathElem,
  CategoryVisualOverride,
  FrameElem,
  ImageUnderlayElem,
  ModelLineElement,
  PresentationCanvasElem,
  PropertyDefinitionElem,
  Saved3dViewElement,
  SavedViewElem,
  ViewLensMode,
} from './modelContracts';

export type {
  BuildingBaseElement,
  DimensionElement,
  FloorTypeElement,
  GridLineElement,
  LevelElement,
  ProjectSettingsElement,
  RoofTypeElement,
  RoomElement,
  RoomColorSchemeElement,
  WallTypeElement,
} from './elements/building';

export type {
  ActivityRow,
  AssetCategory,
  AssetDisciplineTag,
  AssetKind,
  AssetLibraryEntry,
  AssetLibraryEntryElem,
  AssetSymbolKind,
  Comment,
  CommentAnchor,
  DecalElem,
  ElementAnchor,
  FamilyKitInstanceElem,
  ImageAssetElem,
  ImageAssetMapUsage,
  Job,
  JobKind,
  JobStatus,
  KitComponent,
  Markup,
  MarkupAnchor,
  MarkupShape,
  MaterialAppearanceAsset,
  MaterialAssetSource,
  MaterialElem,
  MaterialGraphicsAsset,
  MaterialPhysicalAsset,
  MaterialThermalAsset,
  Milestone,
  ParamSchemaEntry,
  PlaceKitCmd,
  PlacedAssetElem,
  PointAnchor,
  RegionAnchor,
  SheetAnchor,
  UpdateKitComponentCmd,
  Vec3Mm,
} from './resources';

export type {
  DocumentationElement,
  Sheet,
  SheetMetadata,
  TitleblockType,
  TokenSlot,
  ViewPlacement,
  WindowLegendView,
} from './elements/documentation';

export type {
  FamilyBlendElement,
  FamilyComponentElement,
  FamilyConstraintElem,
  FamilyDefinitionElement,
  FamilyDiscipline,
  FamilyElement,
  FamilyExtrusionElement,
  FamilyInstanceElement,
  FamilyOpeningCutElement,
  FamilyParameterElement,
  FamilyReferencePlaneElement,
  FamilyRevolveElement,
  FamilySweepElement,
  FamilySweptBlendElement,
  FamilyTypeElement,
  FamilyVoidElement,
} from './elements/family';

export type {
  ApplyShaftCutCmd,
  BoundaryPoint,
  CommitConceptSeedCmd,
  ConceptSeedElem,
  ConceptSeedEnvelopeToken,
  ConsumeConceptSeedCmd,
  CreateConceptSeedCmd,
  CreateGradedRegionCmd,
  CreateShaftCmd,
  CreateToposolidExcavationBoundaryCmd,
  CreateToposolidExcavationCmd,
  CreateToposolidPadCmd,
  CreateToposolidSubdivisionCmd,
  DeleteGradedRegionCmd,
  DeleteToposolidExcavationCmd,
  DeleteToposolidSubdivisionCmd,
  GradedRegionElem,
  HatchPatternDef,
  HeightSample,
  HeightmapGrid,
  NeighborhoodImportSessionElem,
  NeighborhoodMassElem,
  RecomputeShaftCutsCmd,
  ShaftElement,
  ToposolidElem,
  ToposolidExcavationCutMode,
  ToposolidExcavationElem,
  ToposolidPadElement,
  ToposolidSubdivisionElem,
  UpdateGradedRegionCmd,
  UpdateShaftLevelsCmd,
  UpdateToposolidExcavationCmd,
  UpdateToposolidSubdivisionCmd,
} from './elements/site';

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
  | 'source_view_evidence'
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

export type Element =
  | BuildingBaseElement
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
      hostFloorId?: string | null;
      hostWallId?: string | null;
      hostEdgeId?: string | null;
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
      /** SCH-V3-01: custom property values. */
      props?: Record<string, unknown>;
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
  | FamilyElement
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
      /**
       * TH-X-F006: source-derived view evidence attached to a section_cut /
       * elevation_view / detail (callout plan_view). Joins to the view by
       * viewElementId; status drives the project-browser evidence pill.
       */
      kind: 'source_view_evidence';
      id: string;
      viewElementId: string;
      /**
       * Which sidebar category the view sits in. Drives the pill icon and
       * helps the project-browser dedupe one evidence row per view.
       */
      category: 'exterior' | 'detail' | 'section';
      status:
        | 'missing_source_link'
        | 'source_linked'
        | 'screenshot_captured'
        | 'overlay_compared'
        | 'findings_open'
        | 'accepted';
      sourceDocumentId?: string | null;
      sourcePage?: number | null;
      /** Optional page-region polygon in page-pixel or normalized coords. */
      sourceRegion?: XY[] | null;
      comparisonType?: 'overlay' | 'screenshot' | 'side_by_side' | 'not_applicable' | null;
      screenshotPath?: string | null;
      overlayPath?: string | null;
      findingIds?: string[];
      notes?: string | null;
      updatedAt?: string | null;
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
  | DocumentationElement
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
  | PlacedTagElement
  | DetailLineElement
  | DetailArcElement
  | DetailFilledRegionElement
  | DetailRegionElement
  | TextNoteElement
  | AnnotationSymbolElement
  | LeaderTextElement
  | ColumnElement
  | BeamElement
  | SteelConnectionElement
  | BeamSectionProfileElement
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
  | ColorFillLegendElement
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
  | Text3dElement
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
  | BeamSystemElement
  | BraceElement
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
  | PipeElement
  | DuctElement
  | PipeLegendElement
  | DuctLegendElement
  | CableTrayElement
  | MepEquipmentElement
  | MepTerminalElement
  | FixtureElement
  | MepOpeningRequestElement
  | TextTagElement
  | Saved3dViewElement
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

export * from './modelContracts';
