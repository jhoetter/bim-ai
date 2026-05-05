import type { Element } from '@bim-ai/core';

import type { PlanProjectionPrimitivesV1Wire } from '../plan/planProjectionWire';
import { isPlanProjectionPrimitivesV1 } from '../plan/planProjectionWire';

/** Keys whose array lengths contribute to plan canvas wire work (see `symbology.rebuildPlanMeshesFromWire`). */
export const PLAN_WIRE_PRIMITIVE_ARRAY_KEYS: readonly string[] = [
  'walls',
  'gridLines',
  'rooms',
  'floors',
  'roofs',
  'roomSeparations',
  'doors',
  'windows',
  'stairs',
  'dimensions',
];

/** Heuristic: large residential / coordination models — not an SLA. */
export const BROWSER_BUDGET_WARN_ELEMENT_COUNT = 8000;

/** Sum of plan wire array entries (walls, rooms, …). */
export const BROWSER_BUDGET_WARN_PLAN_WIRE_ENTRIES = 25000;

/** Placed viewports across all sheets. */
export const BROWSER_BUDGET_WARN_SHEET_VIEWPORT_COUNT = 48;

/** Hydrated schedule table body rows (active Schedules tab). */
export const BROWSER_BUDGET_WARN_SCHEDULE_TABLE_ROWS = 5000;

export type BrowserRenderingBudgetMetricStatus = 'ok' | 'warn';

export type BrowserRenderingBudgetMetricId =
  | 'plan_wire_primitives'
  | 'model_elements'
  | 'sheet_viewports'
  | 'schedule_table_rows';

export type BrowserRenderingBudgetMetricRow = {
  id: BrowserRenderingBudgetMetricId;
  label: string;
  value: number | null;
  limit: number;
  status: BrowserRenderingBudgetMetricStatus;
  detail?: string;
};

export type BrowserRenderingBudgetReadoutV1 = {
  format: 'browserRenderingBudgetReadout_v1';
  rows: BrowserRenderingBudgetMetricRow[];
  suggestedInvestigationRoute: string;
};

export function countPlanWirePrimitiveEntries(
  primitives: PlanProjectionPrimitivesV1Wire | null,
): number {
  if (!primitives || !isPlanProjectionPrimitivesV1(primitives)) return 0;
  let n = 0;
  for (const k of PLAN_WIRE_PRIMITIVE_ARRAY_KEYS) {
    const a = primitives[k as keyof PlanProjectionPrimitivesV1Wire];
    if (Array.isArray(a)) n += a.length;
  }
  return n;
}

export function countSheetViewports(elementsById: Record<string, Element>): number {
  let n = 0;
  for (const e of Object.values(elementsById)) {
    if (e.kind !== 'sheet') continue;
    const v = e.viewportsMm;
    n += Array.isArray(v) ? v.length : 0;
  }
  return n;
}

function sortMetricRows(rows: BrowserRenderingBudgetMetricRow[]): BrowserRenderingBudgetMetricRow[] {
  return [...rows].sort((a, b) => {
    const wa = a.status === 'warn' ? 0 : 1;
    const wb = b.status === 'warn' ? 0 : 1;
    if (wa !== wb) return wa - wb;
    return a.id.localeCompare(b.id);
  });
}

function pickSuggestedRoute(rows: BrowserRenderingBudgetMetricRow[]): string {
  const warnRows = rows.filter((r) => r.status === 'warn');
  if (!warnRows.length) {
    return 'Browser rendering budget: all tracked metrics within nominal thresholds.';
  }
  const priority: BrowserRenderingBudgetMetricId[] = [
    'plan_wire_primitives',
    'model_elements',
    'sheet_viewports',
    'schedule_table_rows',
  ];
  const byId = new Map(warnRows.map((r) => [r.id, r]));
  for (const id of priority) {
    const hit = byId.get(id);
    if (!hit) continue;
    switch (id) {
      case 'plan_wire_primitives':
        return 'Investigate plan projection: reduce visible categories, simplify crop/view range, or split plan views — check PlanCanvas wire payload vs `planProjectionPrimitives_v1`.';
      case 'model_elements':
        return 'Investigate model scope: use Project Browser + Advisor to prune elements or split deliverables before sheet/plan evidence.';
      case 'sheet_viewports':
        return 'Investigate sheets: reduce placed viewports per sheet or split sheets — review Sheet canvas + documentation manifest.';
      case 'schedule_table_rows':
        return 'Investigate schedules: narrow filters/grouping, export column subsets, or split schedule elements — review Schedules panel + registry tabs.';
    }
  }
  return 'Review Workspace rendering budget readout rows for the first warn.';
}

export function buildBrowserRenderingBudgetReadoutV1(opts: {
  elementsById: Record<string, Element>;
  planProjectionPrimitives: PlanProjectionPrimitivesV1Wire | null;
  scheduleHydratedRowCount: number | null;
  scheduleHydratedTab: string | null;
}): BrowserRenderingBudgetReadoutV1 {
  const elementCount = Object.keys(opts.elementsById).length;
  const wireCount = countPlanWirePrimitiveEntries(opts.planProjectionPrimitives);
  const viewportCount = countSheetViewports(opts.elementsById);

  const scheduleValue = opts.scheduleHydratedRowCount;
  const scheduleHydrated = scheduleValue !== null && scheduleValue !== undefined;

  const rowsUncsorted: BrowserRenderingBudgetMetricRow[] = [
    {
      id: 'plan_wire_primitives',
      label: 'Plan wire primitive entries',
      value: wireCount,
      limit: BROWSER_BUDGET_WARN_PLAN_WIRE_ENTRIES,
      status: wireCount >= BROWSER_BUDGET_WARN_PLAN_WIRE_ENTRIES ? 'warn' : 'ok',
      ...(!opts.planProjectionPrimitives
        ? {
            detail:
              'No planProjectionPrimitives_v1 in client store (open a plan_view or wait for projection).',
          }
        : {}),
    },
    {
      id: 'model_elements',
      label: 'Model elements',
      value: elementCount,
      limit: BROWSER_BUDGET_WARN_ELEMENT_COUNT,
      status: elementCount >= BROWSER_BUDGET_WARN_ELEMENT_COUNT ? 'warn' : 'ok',
    },
    {
      id: 'sheet_viewports',
      label: 'Sheet viewports (placed)',
      value: viewportCount,
      limit: BROWSER_BUDGET_WARN_SHEET_VIEWPORT_COUNT,
      status: viewportCount >= BROWSER_BUDGET_WARN_SHEET_VIEWPORT_COUNT ? 'warn' : 'ok',
    },
    {
      id: 'schedule_table_rows',
      label: 'Schedules · active tab rows',
      value: scheduleHydrated ? scheduleValue : null,
      limit: BROWSER_BUDGET_WARN_SCHEDULE_TABLE_ROWS,
      status: !scheduleHydrated
        ? 'ok'
        : (scheduleValue as number) >= BROWSER_BUDGET_WARN_SCHEDULE_TABLE_ROWS
          ? 'warn'
          : 'ok',
      detail: !scheduleHydrated
        ? 'Not hydrated (Schedules panel idle, loading, or no model).'
        : opts.scheduleHydratedTab
          ? `tab=${opts.scheduleHydratedTab}`
          : undefined,
    },
  ];

  const rows = sortMetricRows(rowsUncsorted);
  return {
    format: 'browserRenderingBudgetReadout_v1',
    rows,
    suggestedInvestigationRoute: pickSuggestedRoute(rowsUncsorted),
  };
}

/** Monospace lines for Agent Review / inspector surfaces. */
export function formatBrowserRenderingBudgetLines(readout: BrowserRenderingBudgetReadoutV1): string[] {
  const lines: string[] = [];
  lines.push('browserRenderingBudgetReadout_v1');
  for (const r of readout.rows) {
    const val =
      r.value === null ? '—' : String(r.value);
    const flag = r.status === 'warn' ? 'WARN' : 'ok';
    lines.push(`${flag} ${r.id} ${val}/${r.limit}${r.detail ? ` · ${r.detail}` : ''}`);
  }
  lines.push(`route: ${readout.suggestedInvestigationRoute}`);
  return lines;
}
