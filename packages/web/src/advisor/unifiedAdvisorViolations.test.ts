import { describe, expect, it } from 'vitest';

import type { Violation } from '@bim-ai/core';

import type { ConstructabilityReport } from '../lib/api';
import {
  advisorFindingViewpointBridge,
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
      safeCommandHints: [
        {
          label: 'Save focused review viewpoint',
          safety: 'context_only',
          command: {
            type: 'saveViewpoint',
            id: 'vp-constructability-abc',
            mode: 'orbit_3d',
            sectionBoxEnabled: true,
            sectionBoxMinMm: { xMm: 0, yMm: 0, zMm: 0 },
            sectionBoxMaxMm: { xMm: 4000, yMm: 200, zMm: 3000 },
            camera: {
              position: { xMm: 5000, yMm: -1000, zMm: 3500 },
              target: { xMm: 2000, yMm: 100, zMm: 1500 },
              up: { xMm: 0, yMm: 0, zMm: 1 },
            },
          },
        },
      ],
      viewpointEvidence: {
        schemaVersion: 'advisorFindingViewpointBridge_v1',
        ruleId: 'load_bearing_wall_removed_without_transfer',
        viewId: 'vp-constructability-abc',
        viewpointId: 'vp-constructability-abc',
        elementIds: ['wall-1'],
        sectionBoxEnabled: true,
        sectionBoxMinMm: { xMm: 0, yMm: 0, zMm: 0 },
        sectionBoxMaxMm: { xMm: 4000, yMm: 200, zMm: 3000 },
        camera: {
          position: { xMm: 5000, yMm: -1000, zMm: 3500 },
          target: { xMm: 2000, yMm: 100, zMm: 1500 },
          up: { xMm: 0, yMm: 0, zMm: 1 },
        },
      },
      evidenceRefs: [{ kind: 'viewpoint', viewpointId: 'vp-constructability-abc' }],
    });

    expect(violation).toEqual({
      ruleId: 'load_bearing_wall_removed_without_transfer',
      severity: 'error',
      message: 'Load-bearing wall is removed. Recommendation: Add transfer beam metadata.',
      elementIds: ['wall-1'],
      discipline: 'structure',
      blocking: true,
      quickFixCommand: {
        type: 'saveViewpoint',
        id: 'vp-constructability-abc',
        mode: 'orbit_3d',
        sectionBoxEnabled: true,
        sectionBoxMinMm: { xMm: 0, yMm: 0, zMm: 0 },
        sectionBoxMaxMm: { xMm: 4000, yMm: 200, zMm: 3000 },
        camera: {
          position: { xMm: 5000, yMm: -1000, zMm: 3500 },
          target: { xMm: 2000, yMm: 100, zMm: 1500 },
          up: { xMm: 0, yMm: 0, zMm: 1 },
        },
      },
      viewpointRef: 'vp-constructability-abc',
      evidenceRefs: [{ kind: 'viewpoint', viewpointId: 'vp-constructability-abc' }],
      viewpointEvidence: {
        schemaVersion: 'advisorFindingViewpointBridge_v1',
        ruleId: 'load_bearing_wall_removed_without_transfer',
        viewId: 'vp-constructability-abc',
        viewpointId: 'vp-constructability-abc',
        elementIds: ['wall-1'],
        camera: {
          position: { xMm: 5000, yMm: -1000, zMm: 3500 },
          target: { xMm: 2000, yMm: 100, zMm: 1500 },
          up: { xMm: 0, yMm: 0, zMm: 1 },
        },
        sectionBoxEnabled: true,
        sectionBoxMinMm: { xMm: 0, yMm: 0, zMm: 0 },
        sectionBoxMaxMm: { xMm: 4000, yMm: 200, zMm: 3000 },
      },
    });
  });

  it('builds a machine-checkable Advisor finding-to-viewpoint bridge from command metadata', () => {
    const bridge = advisorFindingViewpointBridge({
      ruleId: 'furniture_wall_hard_clash',
      severity: 'warning',
      message: 'Furniture intersects wall.',
      elementIds: ['wall-1', 'shelf-1'],
      viewpointRef: 'vp-constructability-deadbeef',
      safeCommandHints: [
        {
          label: 'Save focused review viewpoint',
          safety: 'context_only',
          command: {
            type: 'saveViewpoint',
            id: 'vp-constructability-deadbeef',
            mode: 'orbit_3d',
            camera: {
              position: { xMm: 5000, yMm: -1000, zMm: 3500 },
              target: { xMm: 2000, yMm: 100, zMm: 1500 },
              up: { xMm: 0, yMm: 0, zMm: 1 },
            },
            sectionBoxEnabled: true,
            sectionBoxMinMm: { xMm: 0, yMm: 0, zMm: 0 },
            sectionBoxMaxMm: { xMm: 4000, yMm: 200, zMm: 3000 },
            bboxMm: { minX: 0, minY: 0, minZ: 0, maxX: 4000, maxY: 200, maxZ: 3000 },
          },
        },
      ],
    });

    expect(bridge).toEqual({
      schemaVersion: 'advisorFindingViewpointBridge_v1',
      ruleId: 'furniture_wall_hard_clash',
      viewId: 'vp-constructability-deadbeef',
      viewpointId: 'vp-constructability-deadbeef',
      elementIds: ['shelf-1', 'wall-1'],
      camera: {
        position: { xMm: 5000, yMm: -1000, zMm: 3500 },
        target: { xMm: 2000, yMm: 100, zMm: 1500 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
      sectionBoxEnabled: true,
      sectionBoxMinMm: { xMm: 0, yMm: 0, zMm: 0 },
      sectionBoxMaxMm: { xMm: 4000, yMm: 200, zMm: 3000 },
      bboxMm: { minX: 0, minY: 0, minZ: 0, maxX: 4000, maxY: 200, maxZ: 3000 },
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
