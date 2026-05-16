/**
 * WP-NEXT-49 — client-side structural validation integrated into the Advisor
 * violation channel.
 *
 * `runStructuralValidation` produces `ValidationIssue[]` from the live
 * element map; this module converts them to `Violation[]` and exposes a
 * memoised React hook so Workspace.tsx can merge them with server-side
 * violations without an extra API round-trip.
 */

import { useMemo } from 'react';

import type { Element, Violation } from '@bim-ai/core';

import { type ValidationIssue, runStructuralValidation } from '../plan/structuralValidation';

const RULE_ID_PREFIX = 'structural_authoring';

const REPAIR_COMMAND_BY_CODE: Record<string, Record<string, unknown> | null> = {
  duplicate_wall: { type: 'deleteElement' },
  orphaned_no_host_ref: { type: 'deleteElement' },
  orphaned_host_missing: { type: 'deleteElement' },
  hosted_outside_wall_span: null,
  open_loop: null,
  self_intersecting: null,
  too_small_edge: null,
};

function issueToViolation(issue: ValidationIssue): Violation {
  const ruleId = `${RULE_ID_PREFIX}.${issue.code}`;
  const quickFixCommand = REPAIR_COMMAND_BY_CODE[issue.code] ?? null;
  return {
    ruleId,
    severity: issue.severity,
    message: issue.message,
    elementIds: issue.elementIds,
    blocking: issue.severity === 'error',
    discipline: 'architecture',
    ...(quickFixCommand ? { quickFixCommand } : {}),
  };
}

/** Convert all structural validation issues to `Violation` objects. */
export function validationIssuesToViolations(issues: ValidationIssue[]): Violation[] {
  return issues.map(issueToViolation);
}

/**
 * Memoised hook — runs `runStructuralValidation` whenever `elementsById`
 * changes and returns the resulting violations in the Advisor-compatible
 * format. Pass the result to `mergeAdvisorViolations` alongside server
 * violations.
 */
export function useStructuralValidationViolations(
  elementsById: Record<string, Element>,
): Violation[] {
  return useMemo(() => {
    const issues = runStructuralValidation(elementsById);
    return validationIssuesToViolations(issues);
  }, [elementsById]);
}
