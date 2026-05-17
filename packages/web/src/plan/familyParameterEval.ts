import type { Element } from '@bim-ai/core';

type FamilyParam = Extract<Element, { kind: 'family_parameter' }>;

/**
 * Applies family parameter values to the linked geometry element.
 * If a parameter has linkedDimensionId + linkedProperty, updates that property.
 */
export function applyFamilyParameters(
  parameters: FamilyParam[],
  elementsById: Record<string, Element | undefined>,
): Record<string, Partial<Record<string, unknown>>> {
  const updates: Record<string, Partial<Record<string, unknown>>> = {};

  for (const param of parameters) {
    if (!param.linkedDimensionId || !param.linkedProperty) continue;
    const target = elementsById[param.linkedDimensionId];
    if (!target) continue;
    updates[param.linkedDimensionId] = {
      ...(updates[param.linkedDimensionId] ?? {}),
      [param.linkedProperty]: param.defaultValue,
    };
  }

  return updates;
}

/**
 * Validates that all parameter names are unique within a family.
 */
export function validateFamilyParameters(parameters: FamilyParam[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const p of parameters) {
    if (seen.has(p.name)) {
      errors.push(`Duplicate parameter name: "${p.name}"`);
    }
    seen.add(p.name);
    if (!p.name.trim()) {
      errors.push('Parameter name cannot be empty');
    }
  }
  return errors;
}
