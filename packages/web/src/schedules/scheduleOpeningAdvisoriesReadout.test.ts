import type { Element, Violation } from '@bim-ai/core';

import { describe, expect, it } from 'vitest';

import { compactScheduleOpeningAdvisoryLines } from './scheduleOpeningAdvisoriesReadout';

describe('scheduleOpeningAdvisoriesReadout', () => {
  const doorViolation = {
    ruleId: 'schedule_opening_identifier_missing',
    severity: 'warning',
    message: 'Door has no mark/name for schedule identification.',
    elementIds: ['d-b', 'd-a'],
  } satisfies Violation;

  const windowViolation = {
    ruleId: 'schedule_opening_family_type_incomplete',
    severity: 'warning',
    message: 'Window is missing familyTypeId (type schedule columns are incomplete).',
    elementIds: ['w-z'],
  } satisfies Violation;

  const elementsById = {
    'd-a': { kind: 'door', id: 'd-a' },
    'd-b': { kind: 'door', id: 'd-b' },
    'w-z': { kind: 'window', id: 'w-z' },
  } as unknown as Record<string, Element>;

  it('filters and sorts deterministically for doors tab', () => {
    const lines = compactScheduleOpeningAdvisoryLines(
      [windowViolation, doorViolation],
      elementsById,
      'doors',
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^schedule_opening_identifier_missing · warning ·/);
    expect(lines[0]).toContain('d-a, d-b');
  });

  it('returns window rows on windows tab', () => {
    const lines = compactScheduleOpeningAdvisoryLines(
      [doorViolation, windowViolation],
      elementsById,
      'windows',
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('schedule_opening_family_type_incomplete');
    expect(lines[0]).toContain('w-z');
  });

  it('sorts by rule id then message then element ids', () => {
    const v1: Violation = {
      ruleId: 'schedule_opening_orphan_host',
      severity: 'info',
      message: 'b',
      elementIds: ['d-c'],
    };
    const v2: Violation = {
      ruleId: 'schedule_opening_orphan_host',
      severity: 'info',
      message: 'a',
      elementIds: ['d-c'],
    };
    const doors = {
      'd-c': { kind: 'door', id: 'd-c' },
    } as unknown as Record<string, Element>;
    const lines = compactScheduleOpeningAdvisoryLines([v1, v2], doors, 'doors');
    expect(lines[0]).toContain('· a ·');
    expect(lines[1]).toContain('· b ·');
  });
});
