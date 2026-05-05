/**
 * Plan template/tag matrix readout tests (WP-C01/C02/C03/C05).
 * Covers planViewGraphicsMatrixRows (all 10 categories), planViewCategoryGraphicsSourceReadout,
 * and planViewBrowserHierarchyState with effective-source annotations.
 */
import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import {
  PLAN_CATEGORY_GRAPHIC_DISPLAY_KEYS,
  planViewBrowserHierarchyState,
  planViewCategoryGraphicsSourceReadout,
  planViewGraphicsMatrixRows,
} from './planProjection';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlanView(overrides: Record<string, unknown> = {}): Element {
  return {
    kind: 'plan_view',
    id: 'pv1',
    name: 'Test Plan',
    levelId: 'lv1',
    ...overrides,
  } as Element;
}

function makeViewTemplate(overrides: Record<string, unknown> = {}): Element {
  return {
    kind: 'view_template',
    id: 'vt1',
    name: 'Template 1',
    scale: 'scale_100',
    planDetailLevel: null,
    planRoomFillOpacityScale: 1,
    planShowOpeningTags: false,
    planShowRoomLabels: false,
    planCategoryGraphics: [],
    ...overrides,
  } as Element;
}

function makeLevel(): Element {
  return { kind: 'level', id: 'lv1', name: 'L0', elevationMm: 0 } as Element;
}

function makeTagStyle(
  id: string,
  tagTarget: string,
  overrides: Record<string, unknown> = {},
): Element {
  return {
    kind: 'plan_tag_style',
    id,
    name: `Style ${id}`,
    tagTarget,
    labelFields: [],
    textSizePt: 10,
    leaderVisible: true,
    badgeStyle: 'none',
    colorToken: 'default',
    sortKey: 0,
    ...overrides,
  } as Element;
}

// ---------------------------------------------------------------------------
// planViewGraphicsMatrixRows — 10 category rows
// ---------------------------------------------------------------------------

describe('planViewGraphicsMatrixRows — category rows', () => {
  it('returns matrix rows for an unpinned plan view', () => {
    const els: Record<string, Element> = {
      lv1: makeLevel(),
      pv1: makePlanView(),
    };
    const rows = planViewGraphicsMatrixRows(els, 'pv1');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('returns a row for every category in PLAN_CATEGORY_GRAPHIC_DISPLAY_KEYS', () => {
    const els: Record<string, Element> = {
      lv1: makeLevel(),
      pv1: makePlanView(),
    };
    const rows = planViewGraphicsMatrixRows(els, 'pv1');
    const catLabels = rows.filter((r) => r.label.startsWith('Cat ')).map((r) => r.label);
    expect(catLabels.length).toBe(PLAN_CATEGORY_GRAPHIC_DISPLAY_KEYS.length);
    for (const key of PLAN_CATEGORY_GRAPHIC_DISPLAY_KEYS) {
      expect(catLabels).toContain(`Cat ${key}`);
    }
  });

  it('category row effectiveSource is default when no overrides', () => {
    const els: Record<string, Element> = {
      lv1: makeLevel(),
      pv1: makePlanView(),
    };
    const rows = planViewGraphicsMatrixRows(els, 'pv1');
    const catRows = rows.filter((r) => r.label.startsWith('Cat '));
    for (const r of catRows) {
      expect(r.effectiveSource).toBe('default');
    }
  });

  it('category row effectiveSource is view_template when template overrides', () => {
    const els: Record<string, Element> = {
      lv1: makeLevel(),
      vt1: makeViewTemplate({
        planCategoryGraphics: [{ categoryKey: 'wall', lineWeightFactor: 2.0 }],
      }),
      pv1: makePlanView({ viewTemplateId: 'vt1' }),
    };
    const rows = planViewGraphicsMatrixRows(els, 'pv1');
    const wallRow = rows.find((r) => r.label === 'Cat wall');
    expect(wallRow).toBeDefined();
    expect(wallRow!.effectiveSource).toBe('view_template');
  });

  it('category row effectiveSource is plan_view when plan view overrides', () => {
    const els: Record<string, Element> = {
      lv1: makeLevel(),
      vt1: makeViewTemplate({
        planCategoryGraphics: [{ categoryKey: 'wall', lineWeightFactor: 2.0 }],
      }),
      pv1: makePlanView({
        viewTemplateId: 'vt1',
        planCategoryGraphics: [{ categoryKey: 'wall', lineWeightFactor: 1.5 }],
      }),
    };
    const rows = planViewGraphicsMatrixRows(els, 'pv1');
    const wallRow = rows.find((r) => r.label === 'Cat wall');
    expect(wallRow!.effectiveSource).toBe('plan_view');
  });

  it('room_separation row shows dash_short as default pattern in effective', () => {
    const els: Record<string, Element> = {
      lv1: makeLevel(),
      pv1: makePlanView(),
    };
    const rows = planViewGraphicsMatrixRows(els, 'pv1');
    const sepRow = rows.find((r) => r.label === 'Cat room_separation');
    expect(sepRow!.effective).toContain('dash_short');
  });

  it('returns empty array for unknown plan view id', () => {
    const els: Record<string, Element> = {
      lv1: makeLevel(),
    };
    expect(planViewGraphicsMatrixRows(els, 'nonexistent')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// planViewCategoryGraphicsSourceReadout
// ---------------------------------------------------------------------------

describe('planViewCategoryGraphicsSourceReadout', () => {
  it('returns 10 rows for all categories', () => {
    const els: Record<string, Element> = {
      lv1: makeLevel(),
      pv1: makePlanView(),
    };
    const rows = planViewCategoryGraphicsSourceReadout(els, 'pv1');
    expect(rows.length).toBe(10);
  });

  it('all sources default when no overrides', () => {
    const els: Record<string, Element> = {
      lv1: makeLevel(),
      pv1: makePlanView(),
    };
    const rows = planViewCategoryGraphicsSourceReadout(els, 'pv1');
    for (const r of rows) {
      expect(r.effectiveSource).toBe('default');
    }
  });

  it('maps template source correctly', () => {
    const els: Record<string, Element> = {
      lv1: makeLevel(),
      vt1: makeViewTemplate({
        planCategoryGraphics: [{ categoryKey: 'floor', lineWeightFactor: 1.5 }],
      }),
      pv1: makePlanView({ viewTemplateId: 'vt1' }),
    };
    const rows = planViewCategoryGraphicsSourceReadout(els, 'pv1');
    const floorRow = rows.find((r) => r.categoryKey === 'floor');
    expect(floorRow!.effectiveSource).toBe('view_template');
    expect(floorRow!.lineWeightSource).toBe('view_template');
  });

  it('plan_view source wins over template', () => {
    const els: Record<string, Element> = {
      lv1: makeLevel(),
      vt1: makeViewTemplate({
        planCategoryGraphics: [{ categoryKey: 'roof', lineWeightFactor: 1.5 }],
      }),
      pv1: makePlanView({
        viewTemplateId: 'vt1',
        planCategoryGraphics: [{ categoryKey: 'roof', lineWeightFactor: 2.0 }],
      }),
    };
    const rows = planViewCategoryGraphicsSourceReadout(els, 'pv1');
    const roofRow = rows.find((r) => r.categoryKey === 'roof');
    expect(roofRow!.effectiveSource).toBe('plan_view');
  });

  it('returns empty array for missing plan view', () => {
    const els: Record<string, Element> = { lv1: makeLevel() };
    expect(planViewCategoryGraphicsSourceReadout(els, 'nonexistent')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// planViewBrowserHierarchyState
// ---------------------------------------------------------------------------

describe('planViewBrowserHierarchyState', () => {
  it('all category counts at default when no overrides', () => {
    const els: Record<string, Element> = {
      lv1: makeLevel(),
      pv1: makePlanView(),
    };
    const h = planViewBrowserHierarchyState(els, 'pv1');
    expect(h.categoryDefaultCount).toBe(10);
    expect(h.categoryTemplateCount).toBe(0);
    expect(h.categoryPlanViewCount).toBe(0);
  });

  it('template category count increments for template overrides', () => {
    const els: Record<string, Element> = {
      lv1: makeLevel(),
      vt1: makeViewTemplate({
        planCategoryGraphics: [
          { categoryKey: 'wall', lineWeightFactor: 1.5 },
          { categoryKey: 'door', linePatternToken: 'dash_short' },
        ],
      }),
      pv1: makePlanView({ viewTemplateId: 'vt1' }),
    };
    const h = planViewBrowserHierarchyState(els, 'pv1');
    expect(h.categoryTemplateCount).toBe(2);
    expect(h.categoryDefaultCount).toBe(8);
  });

  it('plan_view category count increments for plan view overrides', () => {
    const els: Record<string, Element> = {
      lv1: makeLevel(),
      pv1: makePlanView({
        planCategoryGraphics: [{ categoryKey: 'stair', lineWeightFactor: 0.75 }],
      }),
    };
    const h = planViewBrowserHierarchyState(els, 'pv1');
    expect(h.categoryPlanViewCount).toBe(1);
    expect(h.categoryDefaultCount).toBe(9);
  });

  it('tag source is builtin when no style configured', () => {
    const els: Record<string, Element> = {
      lv1: makeLevel(),
      pv1: makePlanView(),
    };
    const h = planViewBrowserHierarchyState(els, 'pv1');
    expect(h.openingTagSource).toBe('builtin');
    expect(h.roomTagSource).toBe('builtin');
  });

  it('tag source is view_template when template sets default style', () => {
    const els: Record<string, Element> = {
      lv1: makeLevel(),
      'ts-open': makeTagStyle('ts-open', 'opening'),
      'ts-room': makeTagStyle('ts-room', 'room'),
      vt1: makeViewTemplate({
        defaultPlanOpeningTagStyleId: 'ts-open',
        defaultPlanRoomTagStyleId: 'ts-room',
      }),
      pv1: makePlanView({ viewTemplateId: 'vt1' }),
    };
    const h = planViewBrowserHierarchyState(els, 'pv1');
    expect(h.openingTagSource).toBe('view_template');
    expect(h.roomTagSource).toBe('view_template');
  });

  it('tag source is plan_view when plan view sets explicit style', () => {
    const els: Record<string, Element> = {
      lv1: makeLevel(),
      'ts-open': makeTagStyle('ts-open', 'opening'),
      pv1: makePlanView({ planOpeningTagStyleId: 'ts-open' }),
    };
    const h = planViewBrowserHierarchyState(els, 'pv1');
    expect(h.openingTagSource).toBe('plan_view');
    expect(h.roomTagSource).toBe('builtin');
  });

  it('viewTemplateId and viewTemplateName reflect linked template', () => {
    const els: Record<string, Element> = {
      lv1: makeLevel(),
      vt1: makeViewTemplate({ id: 'vt1', name: 'Arch Template' }),
      pv1: makePlanView({ viewTemplateId: 'vt1' }),
    };
    const h = planViewBrowserHierarchyState(els, 'pv1');
    expect(h.viewTemplateId).toBe('vt1');
    expect(h.viewTemplateName).toBe('Arch Template');
  });

  it('viewTemplateId is undefined for plan view without template', () => {
    const els: Record<string, Element> = {
      lv1: makeLevel(),
      pv1: makePlanView(),
    };
    const h = planViewBrowserHierarchyState(els, 'pv1');
    expect(h.viewTemplateId).toBeUndefined();
    expect(h.viewTemplateName).toBeUndefined();
  });
});
