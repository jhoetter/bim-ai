import { describe, expect, it } from 'vitest';

import {
  buildCollaborationConflictQueueV1,
  collaborationConflictQueueInspectionLinesFromHints,
} from './collaborationConflictQueue';

describe('buildCollaborationConflictQueueV1', () => {
  it('returns null for non-object detail', () => {
    expect(buildCollaborationConflictQueueV1(undefined)).toBeNull();
    expect(buildCollaborationConflictQueueV1('slug clash')).toBeNull();
    expect(buildCollaborationConflictQueueV1([])).toBeNull();
  });

  it('returns null when there is no collaboration signal', () => {
    expect(buildCollaborationConflictQueueV1({})).toBeNull();
  });

  it('builds queue for constraint_error with blocking index, command type, and sorted rows', () => {
    const q = buildCollaborationConflictQueueV1({
      reason: 'constraint_error',
      violations: [
        {
          ruleId: 'wall_overlap',
          severity: 'error',
          message: 'm2',
          elementIds: ['w-b'],
          blocking: true,
        },
        {
          ruleId: 'door_off_wall',
          severity: 'error',
          message: 'm1',
          elementIds: ['d-a'],
          blocking: true,
        },
      ],
      replayDiagnostics: {
        firstBlockingCommandIndex: 1,
        blockingViolationRuleIds: ['door_off_wall', 'wall_overlap'],
        commandTypesInOrder: ['noop', 'createWall', 'createWall'],
      },
    });
    expect(q).not.toBeNull();
    expect(q?.format).toBe('collaborationConflictQueue_v1');
    expect(q?.firstBlockingCommandIndex).toBe(1);
    expect(q?.firstBlockingCommandStep1Based).toBe(2);
    expect(q?.blockingCommandType).toBe('createWall');
    expect(q?.blockingRuleIds).toEqual(['door_off_wall', 'wall_overlap']);
    expect(q?.retryAdvice).toBe('blocked');
    expect(q?.rows.map((r) => r.ruleId)).toEqual(['door_off_wall', 'wall_overlap']);
    expect(q?.affectedElementIds).toEqual(['d-a', 'w-b']);
    expect(q?.inspectionReadout).toContain('Blocking step 2');
    expect(q?.inspectionReadout).toContain('createWall');
    expect(q?.inspectionReadoutSecondary).toContain('not safe');
  });

  it('filters rows when blockingViolationRuleIds is present', () => {
    const q = buildCollaborationConflictQueueV1({
      reason: 'constraint_error',
      violations: [
        {
          ruleId: 'door_off_wall',
          severity: 'error',
          elementIds: ['d1'],
          blocking: true,
        },
        {
          ruleId: 'other_rule',
          severity: 'error',
          elementIds: ['x1'],
          blocking: true,
        },
      ],
      replayDiagnostics: {
        blockingViolationRuleIds: ['door_off_wall'],
        commandTypesInOrder: ['createWall'],
      },
    });
    expect(q?.rows.map((r) => r.ruleId)).toEqual(['door_off_wall']);
    expect(q?.blockingRuleIds).toEqual(['door_off_wall']);
  });

  it('uses derived rule ids when blockingViolationRuleIds omitted', () => {
    const q = buildCollaborationConflictQueueV1({
      reason: 'constraint_error',
      violations: [
        { ruleId: 'b_rule', severity: 'error', elementIds: ['e2'], blocking: true },
        { ruleId: 'a_rule', severity: 'error', elementIds: ['e1'], blocking: true },
      ],
    });
    expect(q?.blockingRuleIds).toEqual(['a_rule', 'b_rule']);
    expect(q?.rows.map((r) => r.ruleId)).toEqual(['a_rule', 'b_rule']);
  });

  it('maps merge_id_collision to requires_manual_edit', () => {
    const q = buildCollaborationConflictQueueV1({
      reason: 'merge_id_collision',
      violations: [],
      replayDiagnostics: { commandTypesInOrder: ['createWall'] },
    });
    expect(q).not.toBeNull();
    expect(q?.retryAdvice).toBe('requires_manual_edit');
    expect(q?.rows).toEqual([]);
    expect(q?.inspectionReadoutSecondary).toContain('references');
  });

  it('accepts reason-only merge failure with empty violations', () => {
    const q = buildCollaborationConflictQueueV1({
      reason: 'merge_reference_unresolved',
    });
    expect(q?.retryAdvice).toBe('requires_manual_edit');
  });

  it('returns queue when only replayDiagnostics object is present', () => {
    const q = buildCollaborationConflictQueueV1({
      replayDiagnostics: { commandCount: 1, commandTypesInOrder: ['createWall'] },
    });
    expect(q).not.toBeNull();
    expect(q?.rows).toEqual([]);
  });
});

describe('collaborationConflictQueueInspectionLinesFromHints', () => {
  it('returns stable non-empty lines', () => {
    const lines = collaborationConflictQueueInspectionLinesFromHints();
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines[0]).toContain('firstBlockingCommandIndex');
  });
});
