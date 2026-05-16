import { describe, expect, it } from 'vitest';
import { shaftPlanThree } from './shaftPlanThree';
import type { Element } from '@bim-ai/core';

type ShaftEl = Extract<Element, { kind: 'shaft' }>;

function makeShaft(overrides: Partial<ShaftEl> = {}): ShaftEl {
  return {
    kind: 'shaft',
    id: 'shaft-1',
    boundaryMm: [
      { xMm: 0, yMm: 0 },
      { xMm: 3000, yMm: 0 },
      { xMm: 3000, yMm: 1200 },
      { xMm: 0, yMm: 1200 },
    ],
    baseLevelId: 'l1',
    topLevelId: 'l2',
    ...overrides,
  };
}

describe('shaftPlanThree — §2.5.1', () => {
  it('returns Group with children for a valid shaft', () => {
    const shaft = makeShaft();
    const grp = shaftPlanThree(shaft);
    expect(grp.isGroup).toBe(true);
    expect(grp.children.length).toBeGreaterThan(0);
  });

  it('userData.bimPickId is set to shaft.id', () => {
    const shaft = makeShaft({ id: 'shaft-abc' });
    const grp = shaftPlanThree(shaft);
    expect(grp.userData.bimPickId).toBe('shaft-abc');
  });
});
