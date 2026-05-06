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

export type FamilyGeometryNode = SweepGeometryNode;

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
