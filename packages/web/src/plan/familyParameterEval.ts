import type { Element, FamilyConstraintElem } from '@bim-ai/core';

type FamilyParam = Extract<Element, { kind: 'family_parameter' }>;

/**
 * §15.1.2: evaluates a simple arithmetic formula string against a parameter
 * value map. Supports: +, -, *, /, parentheses, numeric literals, and
 * other parameter names as identifiers.
 *
 * Example: evaluateFamilyParameterFormula("Width / 2", { Width: 900 }) → 450
 * Returns NaN if the formula is invalid or references unknown params.
 */
export function evaluateFamilyParameterFormula(
  formula: string,
  params: Record<string, number>,
): number {
  // Replace parameter name references with their values
  let expr = formula.trim();
  // Replace each known param name with its numeric value
  for (const [name, value] of Object.entries(params)) {
    // Use word-boundary replacement to avoid partial matches
    expr = expr.replace(new RegExp(`\\b${name}\\b`, 'g'), String(value));
  }
  // Safety: only allow digits, operators, parens, dots, spaces
  if (!/^[\d\s\+\-\*\/\(\)\.]+$/.test(expr)) return NaN;
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr})`)();
    return typeof result === 'number' ? result : NaN;
  } catch {
    return NaN;
  }
}

/**
 * Applies family parameter values to the linked geometry element.
 * If a parameter has linkedDimensionId + linkedProperty, updates that property.
 * §15.1.2: formula-driven params are evaluated in a second pass.
 */
export function applyFamilyParameters(
  parameters: FamilyParam[],
  elementsById: Record<string, Element | undefined>,
): Record<string, Partial<Record<string, unknown>>> {
  const updates: Record<string, Partial<Record<string, unknown>>> = {};

  // Build a map of param name → numeric value for formula evaluation
  const resolvedValues: Record<string, number> = {};
  for (const param of parameters) {
    if (typeof param.defaultValue === 'number') {
      resolvedValues[param.name] = param.defaultValue;
    }
  }

  // §15.1.2: evaluate formula-driven params (second pass after resolving base values)
  for (const param of parameters) {
    if (param.formula) {
      const formulaResult = evaluateFamilyParameterFormula(param.formula, resolvedValues);
      if (!isNaN(formulaResult)) {
        resolvedValues[param.name] = formulaResult;
      }
    }
  }

  for (const param of parameters) {
    if (!param.linkedDimensionId || !param.linkedProperty) continue;
    const target = elementsById[param.linkedDimensionId];
    if (!target) continue;
    // Use formula-resolved value if available, else fall back to defaultValue
    const resolvedValue =
      typeof param.defaultValue === 'number' && param.name in resolvedValues
        ? resolvedValues[param.name]
        : param.defaultValue;
    updates[param.linkedDimensionId] = {
      ...(updates[param.linkedDimensionId] ?? {}),
      [param.linkedProperty]: resolvedValue,
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
