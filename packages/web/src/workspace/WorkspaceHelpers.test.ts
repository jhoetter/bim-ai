import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import { resolvePlanTabTarget } from './WorkspaceHelpers';

describe('resolvePlanTabTarget', () => {
  const elementsById: Record<string, Element> = {
    'lvl-ground': {
      kind: 'level',
      id: 'lvl-ground',
      name: 'Ground Floor',
      elevationMm: 0,
    } as Extract<Element, { kind: 'level' }>,
    'pv-ground': {
      kind: 'plan_view',
      id: 'pv-ground',
      name: 'GF plan',
      levelId: 'lvl-ground',
    } as Extract<Element, { kind: 'plan_view' }>,
  };

  it('resolves plan_view tabs to their pinned level and active plan view id', () => {
    expect(resolvePlanTabTarget(elementsById, 'pv-ground', 'fallback')).toEqual({
      activeLevelId: 'lvl-ground',
      activePlanViewId: 'pv-ground',
    });
  });

  it('resolves level tabs directly to the level without a plan view id', () => {
    expect(resolvePlanTabTarget(elementsById, 'lvl-ground', 'fallback')).toEqual({
      activeLevelId: 'lvl-ground',
    });
  });
});
