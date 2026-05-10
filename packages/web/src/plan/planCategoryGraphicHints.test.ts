import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { resolvePlanCategoryGraphics } from './planProjection';
import { extractPlanCategoryGraphicHintsV0 } from './planProjectionWire';
import { planLinePatternDashWorldUnits } from './symbology';

describe('planCategoryGraphicHints slice', () => {
  it('planLinePatternDashWorldUnits maps tokens deterministically', () => {
    expect(planLinePatternDashWorldUnits('solid')).toBeNull();
    expect(planLinePatternDashWorldUnits(undefined)).toBeNull();
    expect(planLinePatternDashWorldUnits('dash_short')).toEqual({
      dashSize: 0.06,
      gapSize: 0.04,
    });
    expect(planLinePatternDashWorldUnits('dash_long')).toEqual({
      dashSize: 0.12,
      gapSize: 0.06,
    });
    expect(planLinePatternDashWorldUnits('dot')).toEqual({ dashSize: 0.02, gapSize: 0.05 });
    expect(planLinePatternDashWorldUnits('unknown_token')).toBeNull();
  });

  it('extractPlanCategoryGraphicHintsV0 reads v0 block', () => {
    const h = extractPlanCategoryGraphicHintsV0({
      planCategoryGraphicHints_v0: {
        format: 'planCategoryGraphicHints_v0',
        planViewElementId: 'pv',
        rows: [
          {
            categoryKey: 'wall',
            lineWeightFactor: 1.2,
            linePatternToken: 'solid',
            lineWeightSource: 'template',
            linePatternSource: 'default',
            lineWeightIsDefaulted: false,
            linePatternIsDefaulted: true,
          },
        ],
        rowsDigestSha256: 'abc',
      },
    });
    expect(h?.format).toBe('planCategoryGraphicHints_v0');
    expect(h?.rows.length).toBe(1);
    expect(h?.rows[0]?.categoryKey).toBe('wall');
    expect(h?.planViewElementId).toBe('pv');
    expect(h?.rowsDigestSha256).toBe('abc');
  });

  it('resolvePlanCategoryGraphics merges template then plan_view', () => {
    const elementsById = {
      vt: {
        kind: 'view_template',
        id: 'vt',
        name: 'T',
        scale: 'scale_100',
        planCategoryGraphics: [
          { categoryKey: 'wall', lineWeightFactor: 1.25 },
          { categoryKey: 'grid_line', linePatternToken: 'dash_short' },
        ],
      },
      pv: {
        kind: 'plan_view',
        id: 'pv',
        name: 'P',
        levelId: 'lv',
        viewTemplateId: 'vt',
        planCategoryGraphics: [{ categoryKey: 'grid_line', linePatternToken: 'dot' }],
      },
      lv: { kind: 'level', id: 'lv', name: 'L', elevationMm: 0 },
    } as Record<string, Element>;
    const r = resolvePlanCategoryGraphics(elementsById, 'pv');
    expect(r).not.toBeNull();
    expect(r!.wall.lineWeightFactor).toBe(1.25);
    expect(r!.wall.lineWeightSource).toBe('template');
    expect(r!.grid_line.linePatternToken).toBe('dot');
    expect(r!.grid_line.linePatternSource).toBe('plan_view');
  });

  it('resolvePlanCategoryGraphics carries per-view projection and cut transparency overrides', () => {
    const elementsById = {
      pv: {
        kind: 'plan_view',
        id: 'pv',
        name: 'P',
        levelId: 'lv',
        categoryOverrides: {
          wall: {
            projection: { transparency: 35 },
            cut: { transparency: 150 },
          },
        },
      },
      lv: { kind: 'level', id: 'lv', name: 'L', elevationMm: 0 },
    } as Record<string, Element>;

    const r = resolvePlanCategoryGraphics(elementsById, 'pv');

    expect(r).not.toBeNull();
    expect(r!.wall.projectionTransparency).toBe(35);
    expect(r!.wall.projectionOpacity).toBe(0.65);
    expect(r!.wall.cutTransparency).toBe(100);
    expect(r!.wall.cutOpacity).toBe(0);
    expect(r!.floor.projectionTransparency).toBe(0);
    expect(r!.floor.projectionOpacity).toBe(1);
  });
});
