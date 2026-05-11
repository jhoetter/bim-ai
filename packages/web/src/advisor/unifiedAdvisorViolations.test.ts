import { describe, expect, it } from 'vitest';

import type { Violation } from '@bim-ai/core';

import type { ConstructabilityReport } from '../lib/api';
import {
  constructabilityFindingToViolation,
  mergeAdvisorViolations,
} from './unifiedAdvisorViolations';

describe('unifiedAdvisorViolations', () => {
  it('maps constructability report findings into advisor violations', () => {
    const violation = constructabilityFindingToViolation({
      ruleId: 'load_bearing_wall_removed_without_transfer',
      severity: 'error',
      message: 'Load-bearing wall is removed.',
      elementIds: ['wall-1'],
      discipline: 'structure',
      recommendation: 'Add transfer beam metadata.',
    });

    expect(violation).toEqual({
      ruleId: 'load_bearing_wall_removed_without_transfer',
      severity: 'error',
      message: 'Load-bearing wall is removed. Recommendation: Add transfer beam metadata.',
      elementIds: ['wall-1'],
      discipline: 'structure',
      blocking: true,
    });
  });

  it('merges report-only findings into the single advisor list and prefers stricter severity', () => {
    const base: Violation[] = [
      {
        ruleId: 'load_bearing_wall_removed_without_transfer',
        severity: 'warning',
        message: 'Base evaluator warning.',
        elementIds: ['wall-1'],
      },
      {
        ruleId: 'door_off_wall',
        severity: 'error',
        message: 'Door off wall.',
        elementIds: ['door-1'],
      },
    ];
    const report: ConstructabilityReport = {
      format: 'constructabilityReport_v1',
      revision: 2,
      profile: 'construction_readiness',
      summary: {
        findingCount: 2,
        issueCount: 0,
        severityCounts: { error: 2 },
        ruleCounts: {
          load_bearing_wall_removed_without_transfer: 1,
          constructability_metadata_requirement_missing: 1,
        },
        statusCounts: {},
      },
      findings: [
        {
          ruleId: 'load_bearing_wall_removed_without_transfer',
          severity: 'error',
          message: 'Report escalated constructability warning.',
          elementIds: ['wall-1'],
          discipline: 'structure',
        },
        {
          ruleId: 'constructability_metadata_requirement_missing',
          severity: 'error',
          message: 'Missing fire rating.',
          elementIds: ['wall-2'],
          discipline: 'coordination',
        },
      ],
      issues: [],
    };

    const merged = mergeAdvisorViolations(base, report);

    expect(merged.map((violation) => violation.ruleId)).toEqual([
      'load_bearing_wall_removed_without_transfer',
      'door_off_wall',
      'constructability_metadata_requirement_missing',
    ]);
    expect(merged[0].severity).toBe('error');
    expect(merged[2].message).toBe('Missing fire rating.');
  });
});
