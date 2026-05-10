import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { selectNextConnectedWallByTab } from './wallChainSelection';

const wall = (
  id: string,
  start: { xMm: number; yMm: number },
  end: { xMm: number; yMm: number },
): Extract<Element, { kind: 'wall' }> => ({
  kind: 'wall',
  id,
  name: id,
  levelId: 'L1',
  start,
  end,
  thicknessMm: 200,
  heightMm: 2800,
});

describe('F-100/F-104 — wall chain Tab selection', () => {
  it('advances to a connected wall and keeps the previous wall in multi-select', () => {
    const elementsById: Record<string, Element> = {
      a: wall('a', { xMm: 0, yMm: 0 }, { xMm: 1000, yMm: 0 }),
      b: wall('b', { xMm: 1000, yMm: 0 }, { xMm: 2000, yMm: 0 }),
    };

    expect(selectNextConnectedWallByTab(elementsById, 'a', [], { selId: '', index: 0 })).toEqual({
      nextSelectedId: 'b',
      nextSelectedIds: ['a'],
      nextCycleState: { selId: 'a', index: 0 },
    });
  });

  it('round-robins branching connections while preserving the chain set', () => {
    const elementsById: Record<string, Element> = {
      a: wall('a', { xMm: 0, yMm: 0 }, { xMm: 1000, yMm: 0 }),
      b: wall('b', { xMm: 1000, yMm: 0 }, { xMm: 2000, yMm: 0 }),
      c: wall('c', { xMm: 1000, yMm: 0 }, { xMm: 1000, yMm: 1000 }),
    };

    const result = selectNextConnectedWallByTab(elementsById, 'a', ['c'], { selId: 'a', index: 0 });

    expect(result?.nextSelectedId).toBe('c');
    expect(new Set(result?.nextSelectedIds)).toEqual(new Set(['a']));
    expect(result?.nextCycleState).toEqual({ selId: 'a', index: 1 });
  });
});
