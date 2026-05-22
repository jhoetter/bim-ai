import type {
  DisciplineTag,
  StructuralAnalysisStatus,
  StructuralMaterial,
  StructuralRole,
  XY,
} from '../index';

export type ColumnElement = {
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
};

export type BeamElement = {
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
};

export type SteelConnectionElement = {
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
};

/** §9.5.4: parametric beam cross-section profile. */
export type BeamSectionProfileElement = {
  kind: 'beam_section_profile';
  id: string;
  name: string;
  profilePoints: { xMm: number; yMm: number }[];
  widthMm?: number;
  heightMm?: number;
};

export type BeamSystemElement = {
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
};

export type BraceElement = {
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
