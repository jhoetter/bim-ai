import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { validationIssuesToViolations } from './structuralAdvisorViolations';
import type { ValidationIssue } from '../plan/structuralValidation';

// ---------------------------------------------------------------------------
// WP-NEXT-49 — Advisor integration for client-side structural validation
// ---------------------------------------------------------------------------

describe('WP-NEXT-49 structuralAdvisorViolations', () => {
  describe('validationIssuesToViolations', () => {
    it('maps error severity → Violation with blocking=true', () => {
      const issues: ValidationIssue[] = [
        {
          code: 'duplicate_wall',
          severity: 'error',
          elementIds: ['w1', 'w2'],
          message: 'Walls w1 and w2 are duplicates.',
        },
      ];
      const violations = validationIssuesToViolations(issues);
      expect(violations).toHaveLength(1);
      const v = violations[0]!;
      expect(v.ruleId).toBe('structural_authoring.duplicate_wall');
      expect(v.severity).toBe('error');
      expect(v.blocking).toBe(true);
      expect(v.elementIds).toEqual(['w1', 'w2']);
      expect(v.message).toBe('Walls w1 and w2 are duplicates.');
    });

    it('maps warning severity → Violation with blocking=false', () => {
      const issues: ValidationIssue[] = [
        {
          code: 'too_small_edge',
          severity: 'warning',
          elementIds: ['f1'],
          message: 'Edge shorter than 10 mm.',
        },
      ];
      const violations = validationIssuesToViolations(issues);
      const v = violations[0]!;
      expect(v.severity).toBe('warning');
      expect(v.blocking).toBe(false);
    });

    it('attaches a quick-fix command for duplicate_wall', () => {
      const issues: ValidationIssue[] = [
        {
          code: 'duplicate_wall',
          severity: 'error',
          elementIds: ['w1', 'w2'],
          message: 'Duplicate.',
        },
      ];
      const violations = validationIssuesToViolations(issues);
      expect(violations[0]!.quickFixCommand).toEqual({ type: 'deleteElement' });
    });

    it('attaches no quick-fix command for self_intersecting boundary', () => {
      const issues: ValidationIssue[] = [
        {
          code: 'self_intersecting',
          severity: 'error',
          elementIds: ['f1'],
          message: 'Self-intersecting.',
        },
      ];
      const violations = validationIssuesToViolations(issues);
      expect(violations[0]!.quickFixCommand).toBeUndefined();
    });

    it('sets discipline=architecture on all structural violations', () => {
      const issues: ValidationIssue[] = [
        { code: 'orphaned_host_missing', severity: 'error', elementIds: ['d1'], message: 'X' },
      ];
      const violations = validationIssuesToViolations(issues);
      expect(violations[0]!.discipline).toBe('architecture');
    });

    it('returns an empty array for zero issues', () => {
      expect(validationIssuesToViolations([])).toHaveLength(0);
    });
  });
});
