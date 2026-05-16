import { describe, it, expect } from 'vitest';
import { elementMatchesFilter, resolvePlanViewDisplay } from './planProjection';
import type { VGFilter } from '@bim-ai/core';
import type { Element } from '@bim-ai/core';

const makeWall = (overrides: Partial<Record<string, unknown>> = {}): Element =>
  ({
    kind: 'wall',
    id: 'w-1',
    levelId: 'lv-1',
    thicknessMm: 200,
    ...overrides,
  }) as unknown as Element;

describe('elementMatchesFilter', () => {
  it('equals rule matches exact string', () => {
    const filter: VGFilter = {
      id: 'f1',
      name: 'Walls only',
      categories: [],
      rules: [{ field: 'kind', operator: 'equals', value: 'wall' }],
      override: {},
    };
    expect(elementMatchesFilter(makeWall(), filter)).toBe(true);
    expect(elementMatchesFilter(makeWall({ kind: 'floor' }), filter)).toBe(false);
  });

  it('greater_than rule filters by numeric threshold', () => {
    const filter: VGFilter = {
      id: 'f2',
      name: 'Thick walls',
      categories: [],
      rules: [{ field: 'thicknessMm', operator: 'greater_than', value: '150' }],
      override: {},
    };
    expect(elementMatchesFilter(makeWall({ thicknessMm: 200 }), filter)).toBe(true);
    expect(elementMatchesFilter(makeWall({ thicknessMm: 100 }), filter)).toBe(false);
  });

  it('empty categories array matches all element kinds', () => {
    const filter: VGFilter = {
      id: 'f3',
      name: 'Any thick element',
      categories: [],
      rules: [{ field: 'thicknessMm', operator: 'greater_than', value: '100' }],
      override: {},
    };
    const floor = {
      kind: 'floor',
      id: 'fl-1',
      levelId: 'lv-1',
      thicknessMm: 300,
    } as unknown as Element;
    expect(elementMatchesFilter(makeWall({ thicknessMm: 200 }), filter)).toBe(true);
    expect(elementMatchesFilter(floor, filter)).toBe(true);
  });

  it('categories scope restricts matching to listed kinds', () => {
    const filter: VGFilter = {
      id: 'f4',
      name: 'Walls only',
      categories: ['wall'],
      rules: [],
      override: {},
    };
    const floor = { kind: 'floor', id: 'fl-1', levelId: 'lv-1' } as unknown as Element;
    expect(elementMatchesFilter(makeWall(), filter)).toBe(true);
    expect(elementMatchesFilter(floor, filter)).toBe(false);
  });
});

describe('resolvePlanViewDisplay — vgFilters visibility', () => {
  it('element with visible:false override is added to hiddenElementIds', () => {
    const pvId = 'pv-1';
    const wallId = 'w-1';
    const filter: VGFilter = {
      id: 'f1',
      name: 'Hide walls',
      categories: ['wall'],
      rules: [],
      override: { visible: false },
    };
    const elementsById: Record<string, Element> = {
      [pvId]: {
        kind: 'plan_view',
        id: pvId,
        name: 'Level 1',
        levelId: 'lv-1',
        vgFilters: [filter],
      } as unknown as Element,
      [wallId]: {
        kind: 'wall',
        id: wallId,
        levelId: 'lv-1',
        thicknessMm: 200,
      } as unknown as Element,
    };
    const display = resolvePlanViewDisplay(elementsById, pvId, undefined, 'default');
    expect(display?.hiddenElementIds.has(wallId)).toBe(true);
  });
});
