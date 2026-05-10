import type { Element } from '@bim-ai/core';
import { describe, expect, it } from 'vitest';

import type { PlanProjectionPrimitivesV1Wire } from '../../plan/planProjectionWire';

import {
  BROWSER_BUDGET_OVER_BUDGET_ELEMENT_COUNT,
  BROWSER_BUDGET_OVER_BUDGET_PLAN_WIRE_ENTRIES,
  BROWSER_BUDGET_OVER_BUDGET_SAVED_3D_CLIP_VIEWS,
  BROWSER_BUDGET_OVER_BUDGET_SCHEDULE_TABLE_ROWS,
  BROWSER_BUDGET_OVER_BUDGET_SHEET_VIEWPORT_COUNT,
  BROWSER_BUDGET_WARN_ELEMENT_COUNT,
  BROWSER_BUDGET_WARN_PLAN_WIRE_ENTRIES,
  BROWSER_BUDGET_WARN_SAVED_3D_CLIP_VIEWS,
  BROWSER_BUDGET_WARN_SCHEDULE_TABLE_ROWS,
  BROWSER_BUDGET_WARN_SHEET_VIEWPORT_COUNT,
  buildBrowserRenderingBudgetReadoutV1,
  countPlanWirePrimitiveEntries,
  countSaved3dViewClipFields,
  countSheetViewports,
  formatBrowserRenderingBudgetLines,
} from './browserRenderingBudgetReadout';

function emptyWire(n: number): PlanProjectionPrimitivesV1Wire {
  const base = {
    format: 'planProjectionPrimitives_v1' as const,
    walls: [] as unknown[],
    floors: [] as unknown[],
    rooms: [] as unknown[],
    doors: [] as unknown[],
    windows: [] as unknown[],
    stairs: [] as unknown[],
    roofs: [] as unknown[],
    gridLines: [] as unknown[],
    roomSeparations: [] as unknown[],
    dimensions: [] as unknown[],
  };
  base.walls = Array.from({ length: n }, (_, i) => ({ id: `w${i}` }));
  return base as PlanProjectionPrimitivesV1Wire;
}

function minimalElements(count: number): Record<string, Element> {
  const out: Record<string, Element> = {};
  for (let i = 0; i < count; i++) {
    const id = `e${i}`;
    out[id] = {
      kind: 'level',
      id,
      name: id,
      elevationMm: i * 1000,
    };
  }
  return out;
}

describe('browserRenderingBudgetReadout', () => {
  it('countPlanWirePrimitiveEntries sums symbology-aligned arrays', () => {
    const w = emptyWire(0);
    w.walls = [{ id: 'a' }, { id: 'b' }];
    w.rooms = [{ id: 'r' }];
    expect(countPlanWirePrimitiveEntries(w)).toBe(3);
    expect(countPlanWirePrimitiveEntries(null)).toBe(0);
  });

  it('countSheetViewports sums viewportsMm on sheets', () => {
    const els: Record<string, Element> = {
      s1: {
        kind: 'sheet',
        id: 's1',
        name: 'A',
        viewportsMm: [{}, {}, {}],
        paperWidthMm: 100,
        paperHeightMm: 100,
      },
      s2: {
        kind: 'sheet',
        id: 's2',
        name: 'B',
        viewportsMm: [{}],
        paperWidthMm: 100,
        paperHeightMm: 100,
      },
    };
    expect(countSheetViewports(els)).toBe(4);
  });

  it('warns on plan wire entries at and above limit', () => {
    const under = emptyWire(BROWSER_BUDGET_WARN_PLAN_WIRE_ENTRIES - 1);
    const r0 = buildBrowserRenderingBudgetReadoutV1({
      elementsById: {},
      planProjectionPrimitives: under,
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    expect(r0.rows.find((x) => x.id === 'plan_wire_primitives')?.status).toBe('ok');

    const at = emptyWire(BROWSER_BUDGET_WARN_PLAN_WIRE_ENTRIES);
    const r1 = buildBrowserRenderingBudgetReadoutV1({
      elementsById: {},
      planProjectionPrimitives: at,
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    expect(r1.rows.find((x) => x.id === 'plan_wire_primitives')?.status).toBe('warn');
  });

  it('warns on element count at and above limit', () => {
    const elsUnder = minimalElements(BROWSER_BUDGET_WARN_ELEMENT_COUNT - 1);
    const ok = buildBrowserRenderingBudgetReadoutV1({
      elementsById: elsUnder,
      planProjectionPrimitives: null,
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    expect(ok.rows.find((x) => x.id === 'model_elements')?.status).toBe('ok');

    const elsAt = minimalElements(BROWSER_BUDGET_WARN_ELEMENT_COUNT);
    const warn = buildBrowserRenderingBudgetReadoutV1({
      elementsById: elsAt,
      planProjectionPrimitives: null,
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    expect(warn.rows.find((x) => x.id === 'model_elements')?.status).toBe('warn');
  });

  it('warns on sheet viewports at and above limit', () => {
    const viewports = Array.from(
      { length: BROWSER_BUDGET_WARN_SHEET_VIEWPORT_COUNT - 1 },
      () => ({}),
    );
    const els: Record<string, Element> = {
      s1: {
        kind: 'sheet',
        id: 's1',
        name: 'S',
        viewportsMm: viewports,
        paperWidthMm: 100,
        paperHeightMm: 100,
      },
    };
    const ok = buildBrowserRenderingBudgetReadoutV1({
      elementsById: els,
      planProjectionPrimitives: null,
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    expect(ok.rows.find((x) => x.id === 'sheet_viewports')?.status).toBe('ok');

    const elsWarn: Record<string, Element> = {
      s1: {
        kind: 'sheet',
        id: 's1',
        name: 'S',
        viewportsMm: [...viewports, {}],
        paperWidthMm: 100,
        paperHeightMm: 100,
      },
    };
    const w = buildBrowserRenderingBudgetReadoutV1({
      elementsById: elsWarn,
      planProjectionPrimitives: null,
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    expect(w.rows.find((x) => x.id === 'sheet_viewports')?.status).toBe('warn');
  });

  it('warns on hydrated schedule rows at and above limit', () => {
    const ok = buildBrowserRenderingBudgetReadoutV1({
      elementsById: {},
      planProjectionPrimitives: null,
      scheduleHydratedRowCount: BROWSER_BUDGET_WARN_SCHEDULE_TABLE_ROWS - 1,
      scheduleHydratedTab: 'rooms',
    });
    expect(ok.rows.find((x) => x.id === 'schedule_table_rows')?.status).toBe('ok');

    const warn = buildBrowserRenderingBudgetReadoutV1({
      elementsById: {},
      planProjectionPrimitives: null,
      scheduleHydratedRowCount: BROWSER_BUDGET_WARN_SCHEDULE_TABLE_ROWS,
      scheduleHydratedTab: 'rooms',
    });
    expect(warn.rows.find((x) => x.id === 'schedule_table_rows')?.status).toBe('warn');
  });

  it('sorts rows: warn before ok, then id', () => {
    const els = minimalElements(BROWSER_BUDGET_WARN_ELEMENT_COUNT);
    const w = emptyWire(BROWSER_BUDGET_WARN_PLAN_WIRE_ENTRIES);
    const r = buildBrowserRenderingBudgetReadoutV1({
      elementsById: els,
      planProjectionPrimitives: w,
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    const warns = r.rows.filter((x) => x.status === 'warn').map((x) => x.id);
    const oks = r.rows.filter((x) => x.status === 'ok').map((x) => x.id);
    expect(warns.length).toBeGreaterThan(0);
    expect(oks.length).toBeGreaterThan(0);
    const idxFirstOk = r.rows.findIndex((x) => x.status === 'ok');
    const idxLastWarn = r.rows.map((x) => x.status).lastIndexOf('warn');
    expect(idxLastWarn).toBeLessThan(idxFirstOk);

    const warnsSorted = [...warns].sort((a, b) => a.localeCompare(b));
    expect(warns).toEqual(warnsSorted);

    // ok rows: stale before in_budget (by progressiveState), then alphabetically within each state
    const staleOks = r.rows
      .filter((x) => x.status === 'ok' && x.progressiveState === 'stale')
      .map((x) => x.id);
    const inBudgetOks = r.rows
      .filter((x) => x.status === 'ok' && x.progressiveState === 'in_budget')
      .map((x) => x.id);
    // stale rows appear before in_budget rows in the sorted output
    for (const staleId of staleOks) {
      for (const inBudgetId of inBudgetOks) {
        const staleIdx = r.rows.findIndex((x) => x.id === staleId);
        const inBudgetIdx = r.rows.findIndex((x) => x.id === inBudgetId);
        expect(staleIdx).toBeLessThan(inBudgetIdx);
      }
    }
    // within each state group, rows are alphabetically sorted
    expect(staleOks).toEqual([...staleOks].sort((a, b) => a.localeCompare(b)));
    expect(inBudgetOks).toEqual([...inBudgetOks].sort((a, b) => a.localeCompare(b)));
  });

  it('suggested route prioritizes plan wire over elements when both warn', () => {
    const els = minimalElements(BROWSER_BUDGET_WARN_ELEMENT_COUNT);
    const w = emptyWire(BROWSER_BUDGET_WARN_PLAN_WIRE_ENTRIES);
    const r = buildBrowserRenderingBudgetReadoutV1({
      elementsById: els,
      planProjectionPrimitives: w,
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    expect(r.suggestedInvestigationRoute).toMatch(/plan projection/i);
  });

  it('suggested route mentions schedules when only schedule rows warn', () => {
    const r = buildBrowserRenderingBudgetReadoutV1({
      elementsById: {},
      planProjectionPrimitives: null,
      scheduleHydratedRowCount: BROWSER_BUDGET_WARN_SCHEDULE_TABLE_ROWS,
      scheduleHydratedTab: 'floors',
    });
    const onlyScheduleWarns =
      r.rows.filter((x) => x.status === 'warn').length === 1 &&
      r.rows.find((x) => x.status === 'warn')?.id === 'schedule_table_rows';
    expect(onlyScheduleWarns).toBe(true);
    expect(r.suggestedInvestigationRoute).toMatch(/schedules/i);
  });

  it('formatBrowserRenderingBudgetLines includes route line', () => {
    const r = buildBrowserRenderingBudgetReadoutV1({
      elementsById: {},
      planProjectionPrimitives: null,
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    const lines = formatBrowserRenderingBudgetLines(r);
    expect(lines[0]).toContain('browserRenderingBudgetReadout_v1');
    expect(lines.some((l) => l.startsWith('route:'))).toBe(true);
  });

  // --- Progressive rendering state tests ---

  describe('progressive states: plan wire primitives', () => {
    it('in_budget below warn threshold', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: {},
        planProjectionPrimitives: emptyWire(BROWSER_BUDGET_WARN_PLAN_WIRE_ENTRIES - 1),
        scheduleHydratedRowCount: null,
        scheduleHydratedTab: null,
      });
      const row = r.rows.find((x) => x.id === 'plan_wire_primitives')!;
      expect(row.progressiveState).toBe('in_budget');
      expect(row.reasonCode).toBe('plan_wire_in_budget');
    });

    it('deferred at warn threshold', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: {},
        planProjectionPrimitives: emptyWire(BROWSER_BUDGET_WARN_PLAN_WIRE_ENTRIES),
        scheduleHydratedRowCount: null,
        scheduleHydratedTab: null,
      });
      const row = r.rows.find((x) => x.id === 'plan_wire_primitives')!;
      expect(row.progressiveState).toBe('deferred');
      expect(row.reasonCode).toBe('plan_wire_deferred_large_primitive_count');
    });

    it('deferred just below over-budget threshold', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: {},
        planProjectionPrimitives: emptyWire(BROWSER_BUDGET_OVER_BUDGET_PLAN_WIRE_ENTRIES - 1),
        scheduleHydratedRowCount: null,
        scheduleHydratedTab: null,
      });
      const row = r.rows.find((x) => x.id === 'plan_wire_primitives')!;
      expect(row.progressiveState).toBe('deferred');
      expect(row.reasonCode).toBe('plan_wire_deferred_large_primitive_count');
    });

    it('over_budget at over-budget threshold', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: {},
        planProjectionPrimitives: emptyWire(BROWSER_BUDGET_OVER_BUDGET_PLAN_WIRE_ENTRIES),
        scheduleHydratedRowCount: null,
        scheduleHydratedTab: null,
      });
      const row = r.rows.find((x) => x.id === 'plan_wire_primitives')!;
      expect(row.progressiveState).toBe('over_budget');
      expect(row.reasonCode).toBe('plan_wire_over_budget_very_large_primitive_count');
      expect(row.status).toBe('warn');
    });

    it('stale when no projection primitives', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: {},
        planProjectionPrimitives: null,
        scheduleHydratedRowCount: null,
        scheduleHydratedTab: null,
      });
      const row = r.rows.find((x) => x.id === 'plan_wire_primitives')!;
      expect(row.progressiveState).toBe('stale');
      expect(row.reasonCode).toBe('plan_wire_stale_no_projection');
      expect(row.status).toBe('ok');
      expect(row.value).toBeNull();
    });
  });

  describe('progressive states: model elements', () => {
    it('in_budget below warn threshold', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: minimalElements(BROWSER_BUDGET_WARN_ELEMENT_COUNT - 1),
        planProjectionPrimitives: null,
        scheduleHydratedRowCount: null,
        scheduleHydratedTab: null,
      });
      const row = r.rows.find((x) => x.id === 'model_elements')!;
      expect(row.progressiveState).toBe('in_budget');
      expect(row.reasonCode).toBe('model_elements_in_budget');
    });

    it('deferred at warn threshold', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: minimalElements(BROWSER_BUDGET_WARN_ELEMENT_COUNT),
        planProjectionPrimitives: null,
        scheduleHydratedRowCount: null,
        scheduleHydratedTab: null,
      });
      const row = r.rows.find((x) => x.id === 'model_elements')!;
      expect(row.progressiveState).toBe('deferred');
      expect(row.reasonCode).toBe('model_elements_deferred_large_count');
    });

    it('over_budget at over-budget threshold', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: minimalElements(BROWSER_BUDGET_OVER_BUDGET_ELEMENT_COUNT),
        planProjectionPrimitives: null,
        scheduleHydratedRowCount: null,
        scheduleHydratedTab: null,
      });
      const row = r.rows.find((x) => x.id === 'model_elements')!;
      expect(row.progressiveState).toBe('over_budget');
      expect(row.reasonCode).toBe('model_elements_over_budget_very_large_count');
      expect(row.status).toBe('warn');
    });
  });

  describe('progressive states: sheet viewports', () => {
    function sheetWithViewports(n: number): Record<string, Element> {
      return {
        s1: {
          kind: 'sheet',
          id: 's1',
          name: 'S',
          viewportsMm: Array.from({ length: n }, () => ({})),
          paperWidthMm: 100,
          paperHeightMm: 100,
        },
      };
    }

    it('in_budget below warn threshold', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: sheetWithViewports(BROWSER_BUDGET_WARN_SHEET_VIEWPORT_COUNT - 1),
        planProjectionPrimitives: null,
        scheduleHydratedRowCount: null,
        scheduleHydratedTab: null,
      });
      const row = r.rows.find((x) => x.id === 'sheet_viewports')!;
      expect(row.progressiveState).toBe('in_budget');
      expect(row.reasonCode).toBe('sheet_viewports_in_budget');
    });

    it('deferred at warn threshold', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: sheetWithViewports(BROWSER_BUDGET_WARN_SHEET_VIEWPORT_COUNT),
        planProjectionPrimitives: null,
        scheduleHydratedRowCount: null,
        scheduleHydratedTab: null,
      });
      const row = r.rows.find((x) => x.id === 'sheet_viewports')!;
      expect(row.progressiveState).toBe('deferred');
      expect(row.reasonCode).toBe('sheet_viewports_deferred_large_count');
    });

    it('over_budget at over-budget threshold', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: sheetWithViewports(BROWSER_BUDGET_OVER_BUDGET_SHEET_VIEWPORT_COUNT),
        planProjectionPrimitives: null,
        scheduleHydratedRowCount: null,
        scheduleHydratedTab: null,
      });
      const row = r.rows.find((x) => x.id === 'sheet_viewports')!;
      expect(row.progressiveState).toBe('over_budget');
      expect(row.reasonCode).toBe('sheet_viewports_over_budget_very_large_count');
      expect(row.status).toBe('warn');
    });
  });

  describe('progressive states: schedule table rows', () => {
    it('stale when not hydrated', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: {},
        planProjectionPrimitives: null,
        scheduleHydratedRowCount: null,
        scheduleHydratedTab: null,
      });
      const row = r.rows.find((x) => x.id === 'schedule_table_rows')!;
      expect(row.progressiveState).toBe('stale');
      expect(row.reasonCode).toBe('schedule_stale_not_hydrated');
      expect(row.status).toBe('ok');
      expect(row.value).toBeNull();
    });

    it('in_budget below warn threshold', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: {},
        planProjectionPrimitives: null,
        scheduleHydratedRowCount: BROWSER_BUDGET_WARN_SCHEDULE_TABLE_ROWS - 1,
        scheduleHydratedTab: 'rooms',
      });
      const row = r.rows.find((x) => x.id === 'schedule_table_rows')!;
      expect(row.progressiveState).toBe('in_budget');
      expect(row.reasonCode).toBe('schedule_in_budget');
    });

    it('deferred at warn threshold', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: {},
        planProjectionPrimitives: null,
        scheduleHydratedRowCount: BROWSER_BUDGET_WARN_SCHEDULE_TABLE_ROWS,
        scheduleHydratedTab: 'doors',
      });
      const row = r.rows.find((x) => x.id === 'schedule_table_rows')!;
      expect(row.progressiveState).toBe('deferred');
      expect(row.reasonCode).toBe('schedule_deferred_large_row_count');
      expect(row.status).toBe('warn');
    });

    it('over_budget at over-budget threshold', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: {},
        planProjectionPrimitives: null,
        scheduleHydratedRowCount: BROWSER_BUDGET_OVER_BUDGET_SCHEDULE_TABLE_ROWS,
        scheduleHydratedTab: 'windows',
      });
      const row = r.rows.find((x) => x.id === 'schedule_table_rows')!;
      expect(row.progressiveState).toBe('over_budget');
      expect(row.reasonCode).toBe('schedule_over_budget_very_large_row_count');
      expect(row.status).toBe('warn');
    });
  });

  describe('over-budget thresholds are 2× warn thresholds', () => {
    it('plan wire over-budget is 2× warn', () => {
      expect(BROWSER_BUDGET_OVER_BUDGET_PLAN_WIRE_ENTRIES).toBe(
        BROWSER_BUDGET_WARN_PLAN_WIRE_ENTRIES * 2,
      );
    });

    it('element count over-budget is 2× warn', () => {
      expect(BROWSER_BUDGET_OVER_BUDGET_ELEMENT_COUNT).toBe(BROWSER_BUDGET_WARN_ELEMENT_COUNT * 2);
    });

    it('sheet viewports over-budget is 2× warn', () => {
      expect(BROWSER_BUDGET_OVER_BUDGET_SHEET_VIEWPORT_COUNT).toBe(
        BROWSER_BUDGET_WARN_SHEET_VIEWPORT_COUNT * 2,
      );
    });

    it('schedule rows over-budget is 2× warn', () => {
      expect(BROWSER_BUDGET_OVER_BUDGET_SCHEDULE_TABLE_ROWS).toBe(
        BROWSER_BUDGET_WARN_SCHEDULE_TABLE_ROWS * 2,
      );
    });
  });

  describe('large-model proof summary', () => {
    it('in_budget summary when all metrics are nominal', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: {},
        planProjectionPrimitives: emptyWire(0),
        scheduleHydratedRowCount: 0,
        scheduleHydratedTab: 'rooms',
      });
      expect(r.largeModelProofSummary).toMatch(/in_budget/);
    });

    it('deferred summary when at least one metric is deferred', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: {},
        planProjectionPrimitives: emptyWire(BROWSER_BUDGET_WARN_PLAN_WIRE_ENTRIES),
        scheduleHydratedRowCount: null,
        scheduleHydratedTab: null,
      });
      expect(r.largeModelProofSummary).toMatch(/deferred/);
      expect(r.largeModelProofSummary).toContain('plan_wire_primitives');
    });

    it('over_budget summary when at least one metric is over-budget', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: {},
        planProjectionPrimitives: emptyWire(BROWSER_BUDGET_OVER_BUDGET_PLAN_WIRE_ENTRIES),
        scheduleHydratedRowCount: null,
        scheduleHydratedTab: null,
      });
      expect(r.largeModelProofSummary).toMatch(/over_budget/);
      expect(r.largeModelProofSummary).toContain('plan_wire_primitives');
    });

    it('over_budget takes priority over deferred in summary', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: minimalElements(BROWSER_BUDGET_WARN_ELEMENT_COUNT),
        planProjectionPrimitives: emptyWire(BROWSER_BUDGET_OVER_BUDGET_PLAN_WIRE_ENTRIES),
        scheduleHydratedRowCount: null,
        scheduleHydratedTab: null,
      });
      expect(r.largeModelProofSummary).toMatch(/over_budget/);
    });
  });

  describe('sort order: over_budget before deferred within warn tier', () => {
    it('over_budget rows sort before deferred rows', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: minimalElements(BROWSER_BUDGET_WARN_ELEMENT_COUNT),
        planProjectionPrimitives: emptyWire(BROWSER_BUDGET_OVER_BUDGET_PLAN_WIRE_ENTRIES),
        scheduleHydratedRowCount: null,
        scheduleHydratedTab: null,
      });
      const warnRows = r.rows.filter((x) => x.status === 'warn');
      const idxOverBudget = warnRows.findIndex((x) => x.progressiveState === 'over_budget');
      const idxDeferred = warnRows.findIndex((x) => x.progressiveState === 'deferred');
      expect(idxOverBudget).toBeLessThan(idxDeferred);
    });
  });

  describe('format lines include progressive state and reason code', () => {
    it('line contains state token and reason code in brackets', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: {},
        planProjectionPrimitives: emptyWire(BROWSER_BUDGET_WARN_PLAN_WIRE_ENTRIES),
        scheduleHydratedRowCount: null,
        scheduleHydratedTab: null,
      });
      const lines = formatBrowserRenderingBudgetLines(r);
      const planLine = lines.find((l) => l.includes('plan_wire_primitives'))!;
      expect(planLine).toContain('deferred');
      expect(planLine).toContain('[plan_wire_deferred_large_primitive_count]');
    });

    it('stale line contains stale state and reason code', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: {},
        planProjectionPrimitives: null,
        scheduleHydratedRowCount: null,
        scheduleHydratedTab: null,
      });
      const lines = formatBrowserRenderingBudgetLines(r);
      const planLine = lines.find((l) => l.includes('plan_wire_primitives'))!;
      expect(planLine).toContain('stale');
      expect(planLine).toContain('[plan_wire_stale_no_projection]');
    });

    it('over_budget line contains over_budget state and reason code', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: {},
        planProjectionPrimitives: emptyWire(BROWSER_BUDGET_OVER_BUDGET_PLAN_WIRE_ENTRIES),
        scheduleHydratedRowCount: null,
        scheduleHydratedTab: null,
      });
      const lines = formatBrowserRenderingBudgetLines(r);
      const planLine = lines.find((l) => l.includes('plan_wire_primitives'))!;
      expect(planLine).toContain('over_budget');
      expect(planLine).toContain('[plan_wire_over_budget_very_large_primitive_count]');
    });

    it('format includes large_model_proof summary line', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: {},
        planProjectionPrimitives: null,
        scheduleHydratedRowCount: null,
        scheduleHydratedTab: null,
      });
      const lines = formatBrowserRenderingBudgetLines(r);
      expect(lines.some((l) => l.startsWith('large_model_proof:'))).toBe(true);
    });

    it('format includes warn limit and over-budget limit in row line', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: {},
        planProjectionPrimitives: emptyWire(0),
        scheduleHydratedRowCount: null,
        scheduleHydratedTab: null,
      });
      const lines = formatBrowserRenderingBudgetLines(r);
      const planLine = lines.find((l) => l.includes('plan_wire_primitives'))!;
      expect(planLine).toContain(
        `/${BROWSER_BUDGET_WARN_PLAN_WIRE_ENTRIES}/${BROWSER_BUDGET_OVER_BUDGET_PLAN_WIRE_ENTRIES}`,
      );
    });
  });

  describe('metric row fields: overBudgetLimit is set correctly', () => {
    it('each row carries overBudgetLimit matching exported constants', () => {
      const r = buildBrowserRenderingBudgetReadoutV1({
        elementsById: {},
        planProjectionPrimitives: null,
        scheduleHydratedRowCount: null,
        scheduleHydratedTab: null,
      });
      const byId = new Map(r.rows.map((row) => [row.id, row]));
      expect(byId.get('plan_wire_primitives')!.overBudgetLimit).toBe(
        BROWSER_BUDGET_OVER_BUDGET_PLAN_WIRE_ENTRIES,
      );
      expect(byId.get('model_elements')!.overBudgetLimit).toBe(
        BROWSER_BUDGET_OVER_BUDGET_ELEMENT_COUNT,
      );
      expect(byId.get('sheet_viewports')!.overBudgetLimit).toBe(
        BROWSER_BUDGET_OVER_BUDGET_SHEET_VIEWPORT_COUNT,
      );
      expect(byId.get('schedule_table_rows')!.overBudgetLimit).toBe(
        BROWSER_BUDGET_OVER_BUDGET_SCHEDULE_TABLE_ROWS,
      );
      expect(byId.get('saved_3d_view_clip_fields')!.overBudgetLimit).toBe(
        BROWSER_BUDGET_OVER_BUDGET_SAVED_3D_CLIP_VIEWS,
      );
    });
  });
});

describe('countSaved3dViewClipFields', () => {
  it('counts orbit_3d viewpoints only', () => {
    const els: Record<string, Element> = {
      vp1: {
        kind: 'viewpoint',
        id: 'vp1',
        name: 'A',
        mode: 'orbit_3d',
        camera: {
          position: { xMm: 0, yMm: 0, zMm: 0 },
          target: { xMm: 0, yMm: 0, zMm: 0 },
          up: { xMm: 0, yMm: 1, zMm: 0 },
        },
      },
      vp2: {
        kind: 'viewpoint',
        id: 'vp2',
        name: 'B',
        mode: 'orbit_3d',
        camera: {
          position: { xMm: 0, yMm: 0, zMm: 0 },
          target: { xMm: 0, yMm: 0, zMm: 0 },
          up: { xMm: 0, yMm: 1, zMm: 0 },
        },
      },
      vp3: {
        kind: 'viewpoint',
        id: 'vp3',
        name: 'C',
        mode: 'plan_2d',
        camera: {
          position: { xMm: 0, yMm: 0, zMm: 0 },
          target: { xMm: 0, yMm: 0, zMm: 0 },
          up: { xMm: 0, yMm: 1, zMm: 0 },
        },
      },
      lvl: { kind: 'level', id: 'lvl', name: 'L0', elevationMm: 0 },
    };
    expect(countSaved3dViewClipFields(els)).toBe(2);
  });

  it('returns 0 when no orbit_3d viewpoints', () => {
    expect(countSaved3dViewClipFields({})).toBe(0);
  });
});

describe('saved_3d_view_clip_fields budget metric', () => {
  function makeOrbit3dElements(count: number): Record<string, Element> {
    const out: Record<string, Element> = {};
    for (let i = 0; i < count; i++) {
      const id = `vp${i}`;
      out[id] = {
        kind: 'viewpoint',
        id,
        name: id,
        mode: 'orbit_3d',
        camera: {
          position: { xMm: 0, yMm: 0, zMm: 5000 },
          target: { xMm: 0, yMm: 0, zMm: 0 },
          up: { xMm: 0, yMm: 1, zMm: 0 },
        },
      };
    }
    return out;
  }

  it('is in_budget when orbit_3d count is below warn threshold', () => {
    const els = makeOrbit3dElements(BROWSER_BUDGET_WARN_SAVED_3D_CLIP_VIEWS - 1);
    const r = buildBrowserRenderingBudgetReadoutV1({
      elementsById: els,
      planProjectionPrimitives: null,
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    const row = r.rows.find((x) => x.id === 'saved_3d_view_clip_fields')!;
    expect(row).toBeDefined();
    expect(row.progressiveState).toBe('in_budget');
    expect(row.reasonCode).toBe('saved_3d_clip_in_budget');
    expect(row.value).toBe(BROWSER_BUDGET_WARN_SAVED_3D_CLIP_VIEWS - 1);
  });

  it('is deferred at warn threshold', () => {
    const els = makeOrbit3dElements(BROWSER_BUDGET_WARN_SAVED_3D_CLIP_VIEWS);
    const r = buildBrowserRenderingBudgetReadoutV1({
      elementsById: els,
      planProjectionPrimitives: null,
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    const row = r.rows.find((x) => x.id === 'saved_3d_view_clip_fields')!;
    expect(row.progressiveState).toBe('deferred');
    expect(row.reasonCode).toBe('saved_3d_clip_deferred_large_count');
    expect(row.status).toBe('warn');
  });

  it('is over_budget at over-budget threshold', () => {
    const els = makeOrbit3dElements(BROWSER_BUDGET_OVER_BUDGET_SAVED_3D_CLIP_VIEWS);
    const r = buildBrowserRenderingBudgetReadoutV1({
      elementsById: els,
      planProjectionPrimitives: null,
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    const row = r.rows.find((x) => x.id === 'saved_3d_view_clip_fields')!;
    expect(row.progressiveState).toBe('over_budget');
    expect(row.reasonCode).toBe('saved_3d_clip_over_budget_very_large_count');
  });

  it('formats budget line for saved_3d_view_clip_fields', () => {
    const els = makeOrbit3dElements(3);
    const r = buildBrowserRenderingBudgetReadoutV1({
      elementsById: els,
      planProjectionPrimitives: null,
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    const lines = formatBrowserRenderingBudgetLines(r);
    const clipLine = lines.find((l) => l.includes('saved_3d_view_clip_fields'));
    expect(clipLine).toBeDefined();
    expect(clipLine).toContain('saved_3d_clip_in_budget');
    expect(clipLine).toContain('3/');
  });

  it('suggests investigation route when saved_3d_view_clip_fields is in warn state', () => {
    const els = makeOrbit3dElements(BROWSER_BUDGET_WARN_SAVED_3D_CLIP_VIEWS + 5);
    const r = buildBrowserRenderingBudgetReadoutV1({
      elementsById: els,
      planProjectionPrimitives: null,
      scheduleHydratedRowCount: null,
      scheduleHydratedTab: null,
    });
    expect(r.suggestedInvestigationRoute).toContain('3D saved views');
  });
});
