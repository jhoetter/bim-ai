import type { FamilyDiscipline } from '@bim-ai/core';

export interface FamilyParamDef {
  key: string;
  label: string;
  type: 'length_mm' | 'angle_deg' | 'material_key' | 'boolean' | 'option';
  default: unknown;
  options?: string[];
  min?: number;
  max?: number;
  instanceOverridable: boolean;
  formula?: string | null;
}

/* ─── FAM-02: Family geometry nodes ────────────────────────────────────── */

/** A sketched line segment in a 2D family-editor work plane (mm). */
export interface SketchLine {
  startMm: { xMm: number; yMm: number };
  endMm: { xMm: number; yMm: number };
  source?: { kind: 'reference_plane'; refPlaneId: string };
  locked?: boolean;
}

/**
 * FAM-03 — bind a geometry node's visibility to a host boolean param.
 *
 * The node is rendered iff `Boolean(hostParams[paramName]) === whenTrue`.
 * Default semantics (when the field is absent): always visible.
 */
export interface VisibilityBinding {
  paramName: string;
  /** Show the node when the bound param's truthiness equals this. */
  whenTrue: boolean;
}

/**
 * VIE-02 — per-detail-level visibility for a single family geometry node.
 *
 * Defaults: every level visible (i.e. an unset key reads as `true`). Set
 * a key to `false` to hide the node when the resolver runs at the
 * matching plan detail level.
 */
export interface VisibilityByDetailLevel {
  coarse?: boolean;
  medium?: boolean;
  fine?: boolean;
}

/** Sweep node — extrude a 2D profile along a 2D path. */
export interface SweepGeometryNode {
  kind: 'sweep';
  /** Open or closed polyline; vertices are derived as
   *  `[pathLines[0].startMm, pathLines[i].endMm…]`. */
  pathLines: SketchLine[];
  /** Closed loop of sketch lines describing the cross-section profile. */
  profile: SketchLine[];
  /** Where the profile is positioned: perpendicular to the path's first
   *  tangent (default) or in the active work plane (Z=0). */
  profilePlane: 'normal_to_path_start' | 'work_plane';
  /** Optional host parameter that drives the length/depth of a straight path extrusion. */
  pathLengthParam?: string;
  /** Optional: load profile from a profile family (FAM-08). */
  profileFamilyId?: string;
  materialKey?: string;
  /** Optional host material_key parameter that drives the sweep material. */
  materialKeyParam?: string;
  /** FAM-03: bind visibility to a host boolean param. */
  visibilityBinding?: VisibilityBinding;
  /** VIE-02: hide this sweep when the resolver runs at a matching plan
   *  detail level. Unset keys default to visible. */
  visibilityByDetailLevel?: VisibilityByDetailLevel;
}

/* ─── FAM-01: Nested-family parameter bindings ─────────────────────────── */

/** How a nested family's parameter takes its effective value. */
export type ParameterBinding =
  | { kind: 'literal'; value: number | string | boolean }
  | { kind: 'host_param'; paramName: string }
  | { kind: 'formula'; expression: string };

/**
 * FAM-01 — reference to a nested family instance.
 *
 * Acts like a placement of `familyId` inside the host family's geometry
 * tree. Parameter values for the nested family are computed at
 * resolution time from `parameterBindings`. Optional `visibilityBinding`
 * (used together with FAM-03 yes/no params) hides the whole subtree
 * when the bound host param's truthiness mismatches `whenTrue`.
 */
export interface FamilyInstanceRefNode {
  kind: 'family_instance_ref';
  familyId: string;
  positionMm: { xMm: number; yMm: number; zMm: number };
  rotationDeg: number;
  parameterBindings: Record<string, ParameterBinding>;
  visibilityBinding?: VisibilityBinding;
  /** VIE-02: hide this nested instance when the resolver runs at a
   *  matching plan detail level. Unset keys default to visible. */
  visibilityByDetailLevel?: VisibilityByDetailLevel;
}

/* ─── FAM-05: Array node (linear + radial, parameter-driven count) ─────── */

/**
 * FAM-05 — array of nested family instances.
 *
 * `mode: 'linear'` lays `count` copies of `target` along the segment from
 * `axisStart` to `axisEnd`. With `spacing.kind === 'fixed_mm'` the step
 * is fixed and copies extend past `axisEnd` if `count` is large; with
 * `spacing.kind === 'fit_total'` the segment is divided into
 * `count - 1` equal gaps so the end copy lands on `axisEnd`.
 *
 * `mode: 'radial'` rotates the target around the axis defined by the
 * midpoint of `(axisStart, axisEnd)` and the (axisEnd - axisStart)
 * direction by `360/count` degrees per instance, with a per-instance
 * radius equal to the target's offset from the rotation axis.
 *
 * `count` is read from the host param named `countParam` (clamped to
 * `>= 1`, floored to integer). `centerVisibilityBinding` toggles the
 * "head of table" / center copy independently — typically used by
 * radial arrays.
 */
export interface ArrayGeometryNode {
  kind: 'array';
  target: FamilyInstanceRefNode;
  mode: 'linear' | 'radial';
  countParam: string;
  spacing: { kind: 'fixed_mm'; mm: number } | { kind: 'fit_total'; totalLengthParam: string };
  axisStart: { xMm: number; yMm: number; zMm: number };
  axisEnd: { xMm: number; yMm: number; zMm: number };
  /** Toggle a "center" copy (e.g. head-of-table) via a boolean param. */
  centerVisibilityBinding?: VisibilityBinding;
  /** FAM-03: bind whole-array visibility to a host boolean param. */
  visibilityBinding?: VisibilityBinding;
  /** VIE-02: hide this whole array when the resolver runs at a matching
   *  plan detail level. Unset keys default to visible. */
  visibilityByDetailLevel?: VisibilityByDetailLevel;
}

export type FamilyGeometryNode = SweepGeometryNode | FamilyInstanceRefNode | ArrayGeometryNode;

export interface FamilyDefinition {
  id: string;
  name: string;
  discipline: FamilyDiscipline;
  thumbnail?: string;
  params: FamilyParamDef[];
  defaultTypes: {
    id: string;
    name: string;
    familyId: string;
    discipline: FamilyDiscipline;
    parameters: Record<string, unknown>;
    isBuiltIn: true;
  }[];
  /**
   * FAM-01: optional family-authored geometry tree (sweep nodes +
   * nested-family instance refs). Built-in element kinds keep their
   * bespoke `geometryFns/*.ts` builders; this field carries
   * authored/loadable family geometry that the FAM-01 resolver walks.
   */
  geometry?: FamilyGeometryNode[];
}

// Parameter resolution: instance override > type params > family default > inline fallback
export function resolveParam(
  key: string,
  instanceOverrides: Record<string, unknown> | undefined,
  typeParameters: Record<string, unknown> | undefined,
  familyDef: FamilyDefinition | undefined,
  inlineFallback: unknown,
): unknown {
  return (
    instanceOverrides?.[key] ??
    typeParameters?.[key] ??
    familyDef?.params.find((p) => p.key === key)?.default ??
    inlineFallback
  );
}
