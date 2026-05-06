import { describe, expect, it } from 'vitest';
import { evaluateViewFilters } from './planProjection';
import type { ViewFilter } from '../state/storeTypes';
import type { Element } from '@bim-ai/core';

const makeWall = (extra: Record<string, unknown> = {}): Element =>
  ({
    kind: 'wall',
    id: 'w1',
    name: 'Test',
    start: { xMm: 0, yMm: 0 },
    end: { xMm: 1000, yMm: 0 },
    heightMm: 3000,
    thicknessMm: 200,
    levelId: 'l1',
    ...extra,
  }) as unknown as Element;

describe('evaluateViewFilters', () => {
  it('returns visible=true with no filters', () => {
    expect(evaluateViewFilters(makeWall(), [])).toMatchObject({ visible: true });
  });

  it('returns visible=false when a matching filter hides the element', () => {
    const filter: ViewFilter = {
      id: 'f1',
      name: 'Hide walls',
      rules: [{ field: 'kind', operator: 'equals', value: 'wall' }],
      override: { visible: false },
    };
    expect(evaluateViewFilters(makeWall(), [filter])).toMatchObject({ visible: false });
  });

  it('does not hide when the rule does not match', () => {
    const filter: ViewFilter = {
      id: 'f1',
      name: 'Hide floors',
      rules: [{ field: 'kind', operator: 'equals', value: 'floor' }],
      override: { visible: false },
    };
    expect(evaluateViewFilters(makeWall(), [filter])).toMatchObject({ visible: true });
  });

  it('applies lineWeightFactor from matching filter', () => {
    const filter: ViewFilter = {
      id: 'f1',
      name: 'Heavy walls',
      rules: [{ field: 'kind', operator: 'equals', value: 'wall' }],
      override: { projection: { lineWeightFactor: 2 } },
    };
    expect(evaluateViewFilters(makeWall(), [filter]).lineWeightFactor).toBe(2);
  });

  it('AND logic: all rules must match', () => {
    const filter: ViewFilter = {
      id: 'f1',
      name: 'Concrete walls',
      rules: [
        { field: 'kind', operator: 'equals', value: 'wall' },
        { field: 'materialKey', operator: 'equals', value: 'concrete' },
      ],
      override: { visible: false },
    };
    // Wall without materialKey — should NOT be hidden
    expect(evaluateViewFilters(makeWall(), [filter])).toMatchObject({ visible: true });
    // Wall with materialKey=concrete — should be hidden
    expect(evaluateViewFilters(makeWall({ materialKey: 'concrete' }), [filter])).toMatchObject({
      visible: false,
    });
  });

  it('later filters win (last match wins)', () => {
    const f1: ViewFilter = {
      id: 'f1',
      name: 'First',
      rules: [{ field: 'kind', operator: 'equals', value: 'wall' }],
      override: { projection: { lineWeightFactor: 2 } },
    };
    const f2: ViewFilter = {
      id: 'f2',
      name: 'Second',
      rules: [{ field: 'kind', operator: 'equals', value: 'wall' }],
      override: { projection: { lineWeightFactor: 3 } },
    };
    expect(evaluateViewFilters(makeWall(), [f1, f2]).lineWeightFactor).toBe(3);
  });

  it('not-equals operator matches correctly', () => {
    const filter: ViewFilter = {
      id: 'f1',
      name: 'Non-walls',
      rules: [{ field: 'kind', operator: 'not-equals', value: 'floor' }],
      override: { visible: false },
    };
    // wall kind != floor → matches → hidden
    expect(evaluateViewFilters(makeWall(), [filter])).toMatchObject({ visible: false });
  });
});
