import type { MonitorSource, RoomColorSchemeRow, WallTypeLayer } from '../index';

export type ProjectSettingsElement = {
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
    contextRadiusM?: number;
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
  /** §12.4.2: per-layer name overrides for DXF export. */
  dxfLayerMapping?: Record<string, string>;
};

export type RoomColorSchemeElement = {
  kind: 'room_color_scheme';
  id: string;
  schemeRows: RoomColorSchemeRow[];
  name?: string;
};

export type WallTypeElement = {
  kind: 'wall_type';
  id: string;
  name: string;
  layers: WallTypeLayer[];
  basisLine?: 'center' | 'face_interior' | 'face_exterior';
};

export type FloorTypeElement = {
  kind: 'floor_type';
  id: string;
  name: string;
  layers: WallTypeLayer[];
};

export type RoofTypeElement = {
  kind: 'roof_type';
  id: string;
  name: string;
  layers: WallTypeLayer[];
};

export type LevelElement = {
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
};

export type BuildingBaseElement =
  | ProjectSettingsElement
  | RoomColorSchemeElement
  | WallTypeElement
  | FloorTypeElement
  | RoofTypeElement
  | LevelElement;
