import type { Element } from '@bim-ai/core';
import { describe, expect, it } from 'vitest';

import type { PlanProjectionPrimitivesV1Wire } from '../plan/planProjectionWire';

import {
  BROWSER_BUDGET_WARN_ELEMENT_COUNT,
  BROWSER_BUDGET_WARN_PLAN_WIRE_ENTRIES,
  BROWSER_BUDGET_WARN_SCHEDULE_TABLE_ROWS,
  BROWSER_BUDGET_WARN_SHEET_VIEWPORT_COUNT,
  buildBrowserRenderingBudgetReadoutV1,
  countPlanWirePrimitiveEntries,
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
    const viewports = Array.from({ length: BROWSER_BUDGET_WARN_SHEET_VIEWPORT_COUNT - 1 }, () => ({}));
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

    const oksSorted = [...oks].sort((a, b) => a.localeCompare(b));
    expect(oks).toEqual(oksSorted);
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
});
