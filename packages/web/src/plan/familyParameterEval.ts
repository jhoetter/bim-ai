import type { Element, FamilyConstraintElem } from '@bim-ai/core';

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
 * For each constraint that matches a parameter, moves refPlane2 so the distance
 * between refPlane1 and refPlane2 equals the parameter's value in mm.
 * Returns updated elements map.
 */
export function applyFamilyConstraints(
  elementsById: Record<string, Element>,
  constraints: FamilyConstraintElem[],
  paramValues: Record<string, number>, // paramName -> valueMm
): Record<string, Element> {
  let updated = { ...elementsById };

  for (const constraint of constraints) {
    const valueMm = paramValues[constraint.paramName];
    if (valueMm === undefined) continue;

    const plane1 = updated[constraint.refPlaneId1] as any;
    const plane2 = updated[constraint.refPlaneId2] as any;
    if (!plane1 || !plane2) continue;

    // Move plane2's position so distance from plane1 equals valueMm
    if (constraint.axis === 'x') {
      const newX = (plane1.xMm ?? 0) + valueMm;
      updated = {
        ...updated,
        [plane2.id]: { ...plane2, xMm: newX },
      };
    } else {
      const newY = (plane1.yMm ?? 0) + valueMm;
      updated = {
        ...updated,
        [plane2.id]: { ...plane2, yMm: newY },
      };
    }
  }

  return updated;
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
