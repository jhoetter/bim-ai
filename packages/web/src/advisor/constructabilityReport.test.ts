import { describe, expect, it } from 'vitest';

import type { ConstructabilityReport } from '../lib/api';
import { summarizeConstructabilityReport } from './constructabilityReport';

describe('summarizeConstructabilityReport', () => {
  it('returns empty state for absent report', () => {
    const summary = summarizeConstructabilityReport(null);

    expect(summary.heading).toBe('Constructability');
    expect(summary.lines).toEqual([]);
    expect(summary.hasFindings).toBe(false);
  });

  it('formats deterministic constructability report lines', () => {
    const report: ConstructabilityReport = {
      format: 'constructabilityReport_v1',
      modelId: 'm1',
      revision: 4,
      profile: 'authoring_default',
      summary: {
        findingCount: 2,
        issueCount: 2,
        severityCounts: { warning: 2 },
        ruleCounts: {
          physical_duplicate_geometry: 1,
          furniture_wall_hard_clash: 1,
        },
        statusCounts: { new: 1, active: 1 },
      },
      findings: [],
      issues: [],
    };

    const summary = summarizeConstructabilityReport(report);

    expect(summary.hasFindings).toBe(true);
    expect(summary.lines).toEqual([
      'profile:authoring_default revision:4',
      'findings:2 issues:2',
      'severity:warning:2',
      'status:active:1,new:1',
      'top_rules:furniture_wall_hard_clash:1,physical_duplicate_geometry:1',
    ]);
  });
});
