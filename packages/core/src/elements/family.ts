import type { AgentTrace, DisciplineTag, XY } from '../index';

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

export type FamilyTypeElement = {
  kind: 'family_type';
  id: string;
  name: string;
  familyId: string;
  discipline: FamilyDiscipline;
  parameters: Record<string, unknown>;
  isBuiltIn?: boolean;
  /** FAM-08 - provenance when the type was loaded from an external catalog. */
  catalogSource?: { catalogId: string; familyId: string; version: string };
};

export type FamilyInstanceElement = {
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
};

export type FamilyExtrusionElement = {
  kind: 'family_extrusion';
  id: string;
  name?: string | null;
  profilePoints: { x: number; y: number }[];
  depthMm: number;
  frameInnerWidthMm?: number;
  frameSillDepthMm?: number;
  isGlazing?: boolean;
  glazingMaterialKey?: string;
  levelId?: string | null;
};

export type FamilyBlendElement = {
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
};

export type FamilySweepElement = {
  kind: 'family_sweep';
  id: string;
  name?: string | null;
  /** 2D profile polygon (in mm, local to path start). */
  profileMm: XY[];
  /** Sweep path - list of 3D points (mm). */
  pathMm: { xMm: number; yMm: number; zMm: number }[];
  materialId?: string | null;
  levelId?: string | null;
  agentTrace?: AgentTrace;
  optionSetId?: string | null;
  optionId?: string | null;
  discipline?: DisciplineTag | null;
};

export type FamilySweptBlendElement = {
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
};

export type FamilyRevolveElement = {
  kind: 'family_revolve';
  id: string;
  name?: string | null;
  profilePoints: { x: number; y: number }[];
  axisMm?: { x: number; z: number };
  angleDeg?: number;
  levelId?: string | null;
};

export type FamilyVoidElement = {
  kind: 'family_void';
  id: string;
  name?: string | null;
  profilePoints: { x: number; y: number }[];
  depthMm?: number;
  levelId?: string | null;
};

export type FamilyOpeningCutElement = {
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
};

export type FamilyComponentElement = {
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
};

export type FamilyReferencePlaneElement = {
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
};

export type FamilyDefinitionElement = {
  /** §15.1.2: a top-level family definition element stored in the project BIM store. */
  kind: 'family_definition';
  id: string;
  /** Human-readable family name. */
  name?: string;
  /** Revit-style family category. Determines schedule, visibility controls, and object snap behavior. */
  categoryKey?: string;
};

export type FamilyParameterElement = {
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
};

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

export type FamilyElement =
  | FamilyTypeElement
  | FamilyInstanceElement
  | FamilyExtrusionElement
  | FamilyBlendElement
  | FamilySweepElement
  | FamilySweptBlendElement
  | FamilyRevolveElement
  | FamilyVoidElement
  | FamilyOpeningCutElement
  | FamilyComponentElement
  | FamilyReferencePlaneElement
  | FamilyDefinitionElement
  | FamilyParameterElement
  | FamilyConstraintElem;
