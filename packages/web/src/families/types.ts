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
  /** Optional: load profile from a profile family (FAM-08). */
  profileFamilyId?: string;
  materialKey?: string;
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
  visibilityBinding?: { paramName: string; whenTrue: boolean };
}

export type FamilyGeometryNode = SweepGeometryNode | FamilyInstanceRefNode;

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
