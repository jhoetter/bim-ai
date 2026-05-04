import { describe, expect, it } from 'vitest';

import type { Violation } from '@bim-ai/core';

import { filterViolationsForPerspective } from './perspectiveFilter';

function row(
  partial: Pick<Violation, 'severity'> & Partial<Violation> & { discipline?: string | null },
): Violation {
  return {
    ruleId: partial.ruleId ?? 't',
    severity: partial.severity,
    message: partial.message ?? 'm',
    elementIds: partial.elementIds,
    ...(partial.discipline != null ? { discipline: partial.discipline } : {}),
  };
}

describe('filterViolationsForPerspective', () => {
  const mix: Violation[] = [
    row({ severity: 'warning', ruleId: 'a', discipline: 'architecture' }),
    row({ severity: 'warning', ruleId: 's', discipline: 'structure' }),
    row({ severity: 'error', ruleId: 'c', discipline: 'coordination' }),
    row({ severity: 'info', ruleId: 'm', discipline: 'mep' }),
  ];

  it('shows all rows in agent mode', () => {
    expect(filterViolationsForPerspective(mix, 'agent')).toHaveLength(mix.length);
  });

  it('filters by discipline buckets', () => {
    expect(filterViolationsForPerspective(mix, 'architecture').map((x) => x.ruleId)).toEqual(['a']);
    expect(filterViolationsForPerspective(mix, 'structure').map((x) => x.ruleId)).toEqual(['s']);
  });

  it('coordination retains errors regardless of discipline tag', () => {
    expect(filterViolationsForPerspective(mix, 'coordination').map((x) => x.ruleId)).toContain('c');
  });
});
