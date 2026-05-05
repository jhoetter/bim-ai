import { describe, expect, it } from 'vitest';

import { ApiHttpError } from './api';
import { formatCollaboration409Status } from './collaborationConflictStatus';

describe('formatCollaboration409Status', () => {
  it('returns null when status is not 409', () => {
    const e = new ApiHttpError(404, 'missing', {});
    expect(formatCollaboration409Status('Apply', e)).toBeNull();
  });

  it('includes reason and 1-based step hint from replayDiagnostics', () => {
    const e = new ApiHttpError(409, 'constraint blocked', {
      reason: 'wall constraint',
      replayDiagnostics: { firstBlockingCommandIndex: 2 },
    });
    expect(formatCollaboration409Status('Apply', e)).toBe(
      'Apply blocked: wall constraint (step 3)',
    );
  });

  it('appends blockingViolationRuleIds and command type peek when present', () => {
    const e = new ApiHttpError(409, 'x', {
      reason: 'constraint_error',
      replayDiagnostics: {
        firstBlockingCommandIndex: 1,
        blockingViolationRuleIds: ['door_off_wall', 'wall_overlap'],
        commandTypesInOrder: ['noop', 'createWall', 'createWall'],
      },
    });
    expect(formatCollaboration409Status('Redo', e)).toBe(
      'Redo blocked: constraint_error (step 2); blocking rules: door_off_wall, wall_overlap · cmds: noop → createWall → createWall',
    );
  });

  it('truncates rule list after six entries', () => {
    const e = new ApiHttpError(409, 'x', {
      reason: 'x',
      replayDiagnostics: {
        blockingViolationRuleIds: ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7'],
      },
    });
    expect(formatCollaboration409Status('Apply', e)).toBe(
      'Apply blocked: x; blocking rules: r1, r2, r3, r4, r5, r6, …',
    );
  });

  it('uses conflict fallback when reason is missing', () => {
    const e = new ApiHttpError(409, '409 Conflict', {
      replayDiagnostics: { firstBlockingCommandIndex: 1 },
    });
    expect(formatCollaboration409Status('Undo', e)).toBe('Undo blocked (model conflict). (step 2)');
  });

  it('appends replayPerformanceBudget_v1 advisory when present', () => {
    const advisory =
      'Large command bundles raise validation latency; sanity-check merges of agent-authored payloads before pushing to shared revisions.';
    const clipped =
      advisory.length > 90 ? `${advisory.slice(0, 90)}…` : advisory;
    const e = new ApiHttpError(409, 'constraint_error', {
      reason: 'x',
      replayDiagnostics: {
        replayPerformanceBudget_v1: {
          largeBundleWarn: true,
          agentBundleAdvisory: advisory,
        },
      },
    });
    expect(formatCollaboration409Status('Apply', e)).toBe(`Apply blocked: x · bundle: ${clipped}`);
  });

  it('truncates long replayPerformanceBudget_v1 advisory', () => {
    const long = 'a'.repeat(120);
    const e = new ApiHttpError(409, 'x', {
      reason: 'x',
      replayDiagnostics: {
        replayPerformanceBudget_v1: {
          largeBundleWarn: true,
          agentBundleAdvisory: long,
        },
      },
    });
    const out = formatCollaboration409Status('Apply', e);
    expect(out).toContain('· bundle:');
    expect(out?.endsWith('…')).toBe(true);
    expect((out?.length ?? 0) < long.length + 80).toBe(true);
  });

  it('uses bundle fallback when largeBundleWarn without advisory text', () => {
    const e = new ApiHttpError(409, 'x', {
      reason: 'stale',
      replayDiagnostics: {
        replayPerformanceBudget_v1: {
          largeBundleWarn: true,
          agentBundleAdvisory: '',
        },
      },
    });
    expect(formatCollaboration409Status('Undo', e)).toBe(
      'Undo blocked: stale · bundle: large command bundle (replayPerformanceBudget_v1)',
    );
  });

  it('matches redo label', () => {
    const e = new ApiHttpError(409, 'x', { reason: 'stale' });
    expect(formatCollaboration409Status('Redo', e)).toBe('Redo blocked: stale');
  });
});
