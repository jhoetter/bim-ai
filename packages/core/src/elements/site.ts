// ---------------------------------------------------------------------------
// TOP-V3-01 - Toposolid primitive types
// ---------------------------------------------------------------------------

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
// TOP-V3-02 - Toposolid subdivision (surface finish region)
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
// TOP-V3-04 - Site walls + Graded regions
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
// TOP-V3-05 - Toposolid excavation relation
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
  /** WP-D section 5.1.5: polygon-sketch excavation boundary and depth. */
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

/** WP-D section 5.1.5: polygon-sketch excavation creation command. */
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
// TOP-V3-06 - Toposolid pad
// ---------------------------------------------------------------------------

/** A flattened sub-area of a toposolid surface, placed at a fixed elevation. */
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
// WP-E 2.5.1 + 2.5.3 - Shaft floor opening
// ---------------------------------------------------------------------------

/** A vertical shaft void cutting floor openings from baseLevelId up to topLevelId. */
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
// CAN-V3-02 - Hatch pattern definition
// ---------------------------------------------------------------------------

/** CAN-V3-02 - built-in hatch pattern; scales with paper-mm at plot scale. */
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
// OSM-V3-01 - Neighborhood massing types
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
// CON-V3-02 - Concept seed handoff contract
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
