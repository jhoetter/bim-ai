import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import { isAboveCutPlane, resolveViewRange, VIEW_RANGE_DEFAULTS } from './planProjection';

describe('D3 resolveViewRange', () => {
  it('returns defaults when planViewId is undefined', () => {
    const result = resolveViewRange({}, undefined);
    expect(result).toEqual(VIEW_RANGE_DEFAULTS);
  });

  it('returns defaults when plan_view is not found', () => {
    const result = resolveViewRange({}, 'missing-id');
    expect(result).toEqual(VIEW_RANGE_DEFAULTS);
  });

  it('returns defaults when element is not a plan_view', () => {
    const elementsById: Record<string, Element> = {
      lv: { kind: 'level', id: 'lv', name: 'Level 1', elevationMm: 0 } as Element,
    };
    const result = resolveViewRange(elementsById, 'lv');
    expect(result).toEqual(VIEW_RANGE_DEFAULTS);
  });

  it('reads explicit values from the plan_view element', () => {
    const elementsById: Record<string, Element> = {
      pv: {
        kind: 'plan_view',
        id: 'pv',
        name: 'Level 1 Plan',
        levelId: 'lv',
        viewRangeTopMm: 4000,
        cutPlaneOffsetMm: 900,
        viewRangeBottomMm: -500,
        viewDepth: 200,
      } as unknown as Element,
    };
    const result = resolveViewRange(elementsById, 'pv');
    expect(result.viewRangeTopMm).toBe(4000);
    expect(result.cutPlaneOffsetMm).toBe(900);
    expect(result.viewRangeBottomMm).toBe(-500);
    expect(result.viewDepth).toBe(200);
  });

  it('falls back to defaults for unset fields', () => {
    const elementsById: Record<string, Element> = {
      pv: {
        kind: 'plan_view',
        id: 'pv',
        name: 'Level 1 Plan',
        levelId: 'lv',
      } as unknown as Element,
    };
    const result = resolveViewRange(elementsById, 'pv');
    expect(result.viewRangeTopMm).toBe(VIEW_RANGE_DEFAULTS.viewRangeTopMm);
    expect(result.cutPlaneOffsetMm).toBe(VIEW_RANGE_DEFAULTS.cutPlaneOffsetMm);
    expect(result.viewRangeBottomMm).toBe(VIEW_RANGE_DEFAULTS.viewRangeBottomMm);
    expect(result.viewDepth).toBe(VIEW_RANGE_DEFAULTS.viewDepth);
  });
});

describe('D3 isAboveCutPlane', () => {
  it('a window sill at 1000mm is above a 900mm cut plane', () => {
    expect(isAboveCutPlane(1000, 900)).toBe(true);
  });

  it('a window sill at 800mm is below a 900mm cut plane', () => {
    expect(isAboveCutPlane(800, 900)).toBe(false);
  });

  it('a window sill exactly at cut plane height is at the boundary', () => {
    expect(isAboveCutPlane(1200, 1200)).toBe(true);
  });

  it('cut plane at 900mm: window with sill at 1000mm is not cut through', () => {
    expect(isAboveCutPlane(1000, 900)).toBe(true);
  });
});
