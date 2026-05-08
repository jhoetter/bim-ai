import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { findLockedConstraintFor } from './tempDimensionLockState';

const wall = (id: string): Element => ({
  kind: 'wall',
  id,
  name: id,
  levelId: 'lvl-g',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 0, yMm: 4000 },
  thicknessMm: 200,
  heightMm: 3000,
});

const lock = (id: string, aId: string, bId: string, lockedMm = 5000): Element => ({
  kind: 'constraint',
  id,
  rule: 'equal_distance',
  refsA: [{ elementId: aId, anchor: 'center' }],
  refsB: [{ elementId: bId, anchor: 'center' }],
  lockedValueMm: lockedMm,
  severity: 'error',
});

describe('EDT-02 — findLockedConstraintFor', () => {
  it('returns the matching constraint when (aId, bId) is locked', () => {
    const els = [wall('w1'), wall('w2'), lock('c1', 'w1', 'w2')];
    const found = findLockedConstraintFor('w1', 'w2', els);
    expect(found?.id).toBe('c1');
  });

  it('matches in either ref order', () => {
    const els = [wall('w1'), wall('w2'), lock('c1', 'w2', 'w1')];
    const found = findLockedConstraintFor('w1', 'w2', els);
    expect(found?.id).toBe('c1');
  });

  it('returns undefined when no constraint matches', () => {
    const els = [wall('w1'), wall('w2')];
    expect(findLockedConstraintFor('w1', 'w2', els)).toBeUndefined();
  });

  it('ignores non-equal_distance constraints', () => {
    const c: Element = {
      kind: 'constraint',
      id: 'cp',
      rule: 'parallel',
      refsA: [{ elementId: 'w1', anchor: 'center' }],
      refsB: [{ elementId: 'w2', anchor: 'center' }],
      severity: 'error',
    };
    expect(findLockedConstraintFor('w1', 'w2', [c])).toBeUndefined();
  });

  it('returns undefined for self-pair or empty ids', () => {
    const els = [lock('c1', 'w1', 'w1')];
    expect(findLockedConstraintFor('w1', 'w1', els)).toBeUndefined();
    expect(findLockedConstraintFor('', 'w2', els)).toBeUndefined();
  });
});
