import type { FamilyDiscipline } from '@bim-ai/core';

export interface FamilyParamDef {
  key:      string;
  label:    string;
  type:     'length_mm' | 'angle_deg' | 'material_key' | 'boolean' | 'option';
  default:  unknown;
  options?: string[];
  min?:     number;
  max?:     number;
  instanceOverridable: boolean;
}

export interface FamilyDefinition {
  id:           string;
  name:         string;
  discipline:   FamilyDiscipline;
  thumbnail?:   string;
  params:       FamilyParamDef[];
  defaultTypes: {
    id:         string;
    name:       string;
    familyId:   string;
    discipline: FamilyDiscipline;
    parameters: Record<string, unknown>;
    isBuiltIn:  true;
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
    familyDef?.params.find(p => p.key === key)?.default ??
    inlineFallback
  );
}
