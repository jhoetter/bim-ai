import type { Element } from '@bim-ai/core';

import type { PlanProjectionPrimitivesV1Wire } from '../../plan/planProjectionWire';
import { isPlanProjectionPrimitivesV1 } from '../../plan/planProjectionWire';

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

/**
 * Saved orbit_3d viewpoints with clip/section-box metadata shown as evidence lines in
 * ProjectBrowser. Each viewpoint with a section box renders a longer subtitle row.
 */
export const BROWSER_BUDGET_WARN_SAVED_3D_CLIP_VIEWS = 20;

/** Over-budget: 2× warn. Rendering is significantly impacted at or above this threshold. */
export const BROWSER_BUDGET_OVER_BUDGET_PLAN_WIRE_ENTRIES = 50000;

/** Over-budget: 2× warn. */
export const BROWSER_BUDGET_OVER_BUDGET_ELEMENT_COUNT = 16000;

/** Over-budget: 2× warn. */
export const BROWSER_BUDGET_OVER_BUDGET_SHEET_VIEWPORT_COUNT = 96;

/** Over-budget: 2× warn. */
export const BROWSER_BUDGET_OVER_BUDGET_SCHEDULE_TABLE_ROWS = 10000;

/** Over-budget: 2× warn. */
export const BROWSER_BUDGET_OVER_BUDGET_SAVED_3D_CLIP_VIEWS = 40;

export type BrowserRenderingBudgetMetricStatus = 'ok' | 'warn';

/**
 * Progressive rendering budget state for a single metric.
 *
 * - `in_budget`: value is below the warn threshold; nominal rendering.
 * - `deferred`: value is at or above warn but below over-budget; rendering may defer some work.
 * - `stale`: metric data is unavailable or not yet hydrated; cannot determine rendering cost.
 * - `over_budget`: value is at or above the over-budget threshold; rendering is significantly impacted.
 */
export type ProgressiveRenderingBudgetState = 'in_budget' | 'deferred' | 'stale' | 'over_budget';

/**
 * Stable reason codes for progressive rendering budget states.
 * These are assertable by tests, diagnostics, and replay consumers.
 */
export type ProgressiveRenderingReasonCode =
  | 'plan_wire_in_budget'
  | 'plan_wire_stale_no_projection'
  | 'plan_wire_deferred_large_primitive_count'
  | 'plan_wire_over_budget_very_large_primitive_count'
  | 'model_elements_in_budget'
  | 'model_elements_deferred_large_count'
  | 'model_elements_over_budget_very_large_count'
  | 'sheet_viewports_in_budget'
  | 'sheet_viewports_deferred_large_count'
  | 'sheet_viewports_over_budget_very_large_count'
  | 'schedule_stale_not_hydrated'
  | 'schedule_in_budget'
  | 'schedule_deferred_large_row_count'
  | 'schedule_over_budget_very_large_row_count'
  | 'saved_3d_clip_in_budget'
  | 'saved_3d_clip_deferred_large_count'
  | 'saved_3d_clip_over_budget_very_large_count';

export type BrowserRenderingBudgetMetricId =
  | 'plan_wire_primitives'
  | 'model_elements'
  | 'sheet_viewports'
  | 'schedule_table_rows'
  | 'saved_3d_view_clip_fields';

export type BrowserRenderingBudgetMetricRow = {
  id: BrowserRenderingBudgetMetricId;
  label: string;
  value: number | null;
  /** Warn threshold (deferred at/above this). Kept as `limit` for backward compatibility. */
  limit: number;
  /** Over-budget threshold (over_budget at/above this). */
  overBudgetLimit: number;
  /** Backward-compatible status: `ok` = in_budget or stale; `warn` = deferred or over_budget. */
  status: BrowserRenderingBudgetMetricStatus;
  progressiveState: ProgressiveRenderingBudgetState;
  reasonCode: ProgressiveRenderingReasonCode;
  detail?: string;
};

export type BrowserRenderingBudgetReadoutV1 = {
  format: 'browserRenderingBudgetReadout_v1';
  rows: BrowserRenderingBudgetMetricRow[];
  suggestedInvestigationRoute: string;
  /** One-line large-model proof summary for Agent Review and Workspace surfaces. */
  largeModelProofSummary: string;
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

/**
 * Count saved orbit_3d viewpoints whose clip/section-box evidence fields are rendered as
 * evidence lines in ProjectBrowser. Each entry adds a subtitle row (WP-E02/WP-X02/WP-P01).
 */
export function countSaved3dViewClipFields(elementsById: Record<string, Element>): number {
  let n = 0;
  for (const e of Object.values(elementsById)) {
    if (e.kind === 'viewpoint' && e.mode === 'orbit_3d') n += 1;
  }
  return n;
}

function computeProgressiveState(
  value: number,
  warnLimit: number,
  overBudgetLimit: number,
): ProgressiveRenderingBudgetState {
  if (value >= overBudgetLimit) return 'over_budget';
  if (value >= warnLimit) return 'deferred';
  return 'in_budget';
}

function progressiveStateToStatus(
  state: ProgressiveRenderingBudgetState,
): BrowserRenderingBudgetMetricStatus {
  return state === 'in_budget' || state === 'stale' ? 'ok' : 'warn';
}

function sortMetricRows(
  rows: BrowserRenderingBudgetMetricRow[],
): BrowserRenderingBudgetMetricRow[] {
  const stateOrder: Record<ProgressiveRenderingBudgetState, number> = {
    over_budget: 0,
    deferred: 1,
    stale: 2,
    in_budget: 3,
  };
  return [...rows].sort((a, b) => {
    const wa = a.status === 'warn' ? 0 : 1;
    const wb = b.status === 'warn' ? 0 : 1;
    if (wa !== wb) return wa - wb;
    const sa = stateOrder[a.progressiveState];
    const sb = stateOrder[b.progressiveState];
    if (sa !== sb) return sa - sb;
    return a.id.localeCompare(b.id);
  });
}

function pickSuggestedRoute(rows: BrowserRenderingBudgetMetricRow[]): string {
  const actionableRows = rows.filter((r) => r.status === 'warn');
  if (!actionableRows.length) {
    return 'Browser rendering budget: all tracked metrics within nominal thresholds.';
  }
  const priority: BrowserRenderingBudgetMetricId[] = [
    'plan_wire_primitives',
    'model_elements',
    'sheet_viewports',
    'schedule_table_rows',
    'saved_3d_view_clip_fields',
  ];
  const byId = new Map(actionableRows.map((r) => [r.id, r]));
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
      case 'saved_3d_view_clip_fields':
        return 'Investigate 3D saved views: reduce saved orbit_3d viewpoints or consolidate clip/section-box evidence — review Project Browser 3D saved-view band and `saved3dViewClipEvidence_v1` in the export manifest.';
    }
  }
  return 'Review Workspace rendering budget readout rows for the first warn.';
}

function buildLargeModelProofSummary(rows: BrowserRenderingBudgetMetricRow[]): string {
  const anyOverBudget = rows.some((r) => r.progressiveState === 'over_budget');
  const anyDeferred = rows.some((r) => r.progressiveState === 'deferred');
  if (anyOverBudget) {
    const ids = rows
      .filter((r) => r.progressiveState === 'over_budget')
      .map((r) => r.id)
      .join(', ');
    return `Large-model proof: over_budget — metrics exceeding maximum thresholds: ${ids}.`;
  }
  if (anyDeferred) {
    const ids = rows
      .filter((r) => r.progressiveState === 'deferred')
      .map((r) => r.id)
      .join(', ');
    return `Large-model proof: deferred — metrics in deferred rendering range: ${ids}.`;
  }
  return 'Large-model proof: in_budget — all metrics below warn thresholds.';
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
  const saved3dClipCount = countSaved3dViewClipFields(opts.elementsById);

  const scheduleValue = opts.scheduleHydratedRowCount;
  const scheduleHydrated = scheduleValue !== null && scheduleValue !== undefined;

  // Plan wire primitives
  const planState: ProgressiveRenderingBudgetState = !opts.planProjectionPrimitives
    ? 'stale'
    : computeProgressiveState(
        wireCount,
        BROWSER_BUDGET_WARN_PLAN_WIRE_ENTRIES,
        BROWSER_BUDGET_OVER_BUDGET_PLAN_WIRE_ENTRIES,
      );
  const planReasonCode: ProgressiveRenderingReasonCode =
    planState === 'stale'
      ? 'plan_wire_stale_no_projection'
      : planState === 'over_budget'
        ? 'plan_wire_over_budget_very_large_primitive_count'
        : planState === 'deferred'
          ? 'plan_wire_deferred_large_primitive_count'
          : 'plan_wire_in_budget';

  // Model elements
  const elemState = computeProgressiveState(
    elementCount,
    BROWSER_BUDGET_WARN_ELEMENT_COUNT,
    BROWSER_BUDGET_OVER_BUDGET_ELEMENT_COUNT,
  );
  const elemReasonCode: ProgressiveRenderingReasonCode =
    elemState === 'over_budget'
      ? 'model_elements_over_budget_very_large_count'
      : elemState === 'deferred'
        ? 'model_elements_deferred_large_count'
        : 'model_elements_in_budget';

  // Sheet viewports
  const sheetState = computeProgressiveState(
    viewportCount,
    BROWSER_BUDGET_WARN_SHEET_VIEWPORT_COUNT,
    BROWSER_BUDGET_OVER_BUDGET_SHEET_VIEWPORT_COUNT,
  );
  const sheetReasonCode: ProgressiveRenderingReasonCode =
    sheetState === 'over_budget'
      ? 'sheet_viewports_over_budget_very_large_count'
      : sheetState === 'deferred'
        ? 'sheet_viewports_deferred_large_count'
        : 'sheet_viewports_in_budget';

  // Schedule rows
  const schedState: ProgressiveRenderingBudgetState = !scheduleHydrated
    ? 'stale'
    : computeProgressiveState(
        scheduleValue as number,
        BROWSER_BUDGET_WARN_SCHEDULE_TABLE_ROWS,
        BROWSER_BUDGET_OVER_BUDGET_SCHEDULE_TABLE_ROWS,
      );
  const schedReasonCode: ProgressiveRenderingReasonCode =
    schedState === 'stale'
      ? 'schedule_stale_not_hydrated'
      : schedState === 'over_budget'
        ? 'schedule_over_budget_very_large_row_count'
        : schedState === 'deferred'
          ? 'schedule_deferred_large_row_count'
          : 'schedule_in_budget';

  // Saved 3D view clip fields (orbit_3d viewpoints with clip/section-box evidence in ProjectBrowser)
  const saved3dClipState = computeProgressiveState(
    saved3dClipCount,
    BROWSER_BUDGET_WARN_SAVED_3D_CLIP_VIEWS,
    BROWSER_BUDGET_OVER_BUDGET_SAVED_3D_CLIP_VIEWS,
  );
  const saved3dClipReasonCode: ProgressiveRenderingReasonCode =
    saved3dClipState === 'over_budget'
      ? 'saved_3d_clip_over_budget_very_large_count'
      : saved3dClipState === 'deferred'
        ? 'saved_3d_clip_deferred_large_count'
        : 'saved_3d_clip_in_budget';

  const rowsUnsorted: BrowserRenderingBudgetMetricRow[] = [
    {
      id: 'plan_wire_primitives',
      label: 'Plan wire primitive entries',
      value: opts.planProjectionPrimitives ? wireCount : null,
      limit: BROWSER_BUDGET_WARN_PLAN_WIRE_ENTRIES,
      overBudgetLimit: BROWSER_BUDGET_OVER_BUDGET_PLAN_WIRE_ENTRIES,
      status: progressiveStateToStatus(planState),
      progressiveState: planState,
      reasonCode: planReasonCode,
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
      overBudgetLimit: BROWSER_BUDGET_OVER_BUDGET_ELEMENT_COUNT,
      status: progressiveStateToStatus(elemState),
      progressiveState: elemState,
      reasonCode: elemReasonCode,
    },
    {
      id: 'sheet_viewports',
      label: 'Sheet viewports (placed)',
      value: viewportCount,
      limit: BROWSER_BUDGET_WARN_SHEET_VIEWPORT_COUNT,
      overBudgetLimit: BROWSER_BUDGET_OVER_BUDGET_SHEET_VIEWPORT_COUNT,
      status: progressiveStateToStatus(sheetState),
      progressiveState: sheetState,
      reasonCode: sheetReasonCode,
    },
    {
      id: 'schedule_table_rows',
      label: 'Schedules · active tab rows',
      value: scheduleHydrated ? scheduleValue : null,
      limit: BROWSER_BUDGET_WARN_SCHEDULE_TABLE_ROWS,
      overBudgetLimit: BROWSER_BUDGET_OVER_BUDGET_SCHEDULE_TABLE_ROWS,
      status: progressiveStateToStatus(schedState),
      progressiveState: schedState,
      reasonCode: schedReasonCode,
      detail: !scheduleHydrated
        ? 'Not hydrated (Schedules panel idle, loading, or no model).'
        : opts.scheduleHydratedTab
          ? `tab=${opts.scheduleHydratedTab}`
          : undefined,
    },
    {
      id: 'saved_3d_view_clip_fields',
      label: 'Saved 3D views · clip/section-box evidence rows',
      value: saved3dClipCount,
      limit: BROWSER_BUDGET_WARN_SAVED_3D_CLIP_VIEWS,
      overBudgetLimit: BROWSER_BUDGET_OVER_BUDGET_SAVED_3D_CLIP_VIEWS,
      status: progressiveStateToStatus(saved3dClipState),
      progressiveState: saved3dClipState,
      reasonCode: saved3dClipReasonCode,
    },
  ];

  const rows = sortMetricRows(rowsUnsorted);
  return {
    format: 'browserRenderingBudgetReadout_v1',
    rows,
    suggestedInvestigationRoute: pickSuggestedRoute(rowsUnsorted),
    largeModelProofSummary: buildLargeModelProofSummary(rowsUnsorted),
  };
}

/** Monospace lines for Agent Review / inspector surfaces. */
export function formatBrowserRenderingBudgetLines(
  readout: BrowserRenderingBudgetReadoutV1,
): string[] {
  const lines: string[] = [];
  lines.push('browserRenderingBudgetReadout_v1');
  for (const r of readout.rows) {
    const val = r.value === null ? '—' : String(r.value);
    lines.push(
      `${r.progressiveState} ${r.id} ${val}/${r.limit}/${r.overBudgetLimit} [${r.reasonCode}]${r.detail ? ` · ${r.detail}` : ''}`,
    );
  }
  lines.push(`large_model_proof: ${readout.largeModelProofSummary}`);
  lines.push(`route: ${readout.suggestedInvestigationRoute}`);
  return lines;
}
