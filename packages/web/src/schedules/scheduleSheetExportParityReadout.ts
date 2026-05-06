/**
 * Web parser + readout helpers for `scheduleSheetExportParityEvidence_v1`
 * (Wave-3 Prompt-3 re-run — schedule sheet placement / export listing
 * cross-format parity).
 *
 * Pairs with the backend module `bim_ai.schedule_sheet_export_parity` and
 * is rendered in `SchedulePanel` with
 * `data-testid="schedule-sheet-export-parity-readout"`.
 */

import type { Violation } from '@bim-ai/core';

export const SCHEDULE_SHEET_EXPORT_PARITY_FORMAT = 'scheduleSheetExportParityEvidence_v1';

export const PARITY_TOKEN_ALIGNED = 'aligned';
export const PARITY_TOKEN_CSV_DIVERGES = 'csv_diverges';
export const PARITY_TOKEN_JSON_DIVERGES = 'json_diverges';
export const PARITY_TOKEN_LISTING_DIVERGES = 'listing_diverges';
export const PARITY_TOKEN_PLACEMENT_MISSING = 'placement_missing';

export const SCHEDULE_SHEET_EXPORT_PARITY_TOKENS = [
  PARITY_TOKEN_ALIGNED,
  PARITY_TOKEN_CSV_DIVERGES,
  PARITY_TOKEN_JSON_DIVERGES,
  PARITY_TOKEN_LISTING_DIVERGES,
  PARITY_TOKEN_PLACEMENT_MISSING,
] as const;

export type ScheduleSheetExportParityToken = (typeof SCHEDULE_SHEET_EXPORT_PARITY_TOKENS)[number];

export const SCHEDULE_SHEET_EXPORT_PARITY_RULE_IDS = [
  'schedule_sheet_export_parity_csv_diverges',
  'schedule_sheet_export_parity_json_diverges',
  'schedule_sheet_export_parity_listing_diverges',
] as const;

export type ScheduleSheetExportParityRuleId =
  (typeof SCHEDULE_SHEET_EXPORT_PARITY_RULE_IDS)[number];

const PARITY_RULE_SET = new Set<string>(SCHEDULE_SHEET_EXPORT_PARITY_RULE_IDS);

export interface ScheduleSheetExportParityRow {
  scheduleId: string;
  sheetId: string | null;
  viewportId: string | null;
  csvRowCount: number;
  jsonRowCount: number;
  svgListingRowCount: number;
  paginationSegmentCount: number;
  crossFormatParityToken: ScheduleSheetExportParityToken;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asNullableString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s : null;
}

function asParityToken(v: unknown): ScheduleSheetExportParityToken {
  const s = typeof v === 'string' ? v.trim() : '';
  return (SCHEDULE_SHEET_EXPORT_PARITY_TOKENS as readonly string[]).includes(s)
    ? (s as ScheduleSheetExportParityToken)
    : PARITY_TOKEN_ALIGNED;
}

/** Parse the per-schedule or per-sheet evidence payload into ordered rows. */
export function parseScheduleSheetExportParityRows(ev: unknown): ScheduleSheetExportParityRow[] {
  const o = asRecord(ev);
  if (!o) return [];
  if (typeof o.format === 'string' && o.format !== SCHEDULE_SHEET_EXPORT_PARITY_FORMAT) {
    return [];
  }
  const raw = Array.isArray(o.rows) ? o.rows : [];
  const out: ScheduleSheetExportParityRow[] = [];
  for (const r of raw) {
    const rec = asRecord(r);
    if (!rec) continue;
    const sid = asNullableString(rec.scheduleId);
    if (!sid) continue;
    out.push({
      scheduleId: sid,
      sheetId: asNullableString(rec.sheetId),
      viewportId: asNullableString(rec.viewportId),
      csvRowCount: asNumber(rec.csvRowCount),
      jsonRowCount: asNumber(rec.jsonRowCount),
      svgListingRowCount: asNumber(rec.svgListingRowCount),
      paginationSegmentCount: asNumber(rec.paginationSegmentCount),
      crossFormatParityToken: asParityToken(rec.crossFormatParityToken),
    });
  }
  return [...out].sort((a, b) => {
    const c = a.scheduleId.localeCompare(b.scheduleId);
    if (c !== 0) return c;
    const va = a.viewportId ?? '';
    const vb = b.viewportId ?? '';
    return va.localeCompare(vb);
  });
}

/** Compact line for one parity row, used in the SchedulePanel readout. */
export function formatScheduleSheetExportParityRowLine(row: ScheduleSheetExportParityRow): string {
  const parts = [
    `schedule=${row.scheduleId}`,
    `sheet=${row.sheetId ?? '—'}`,
    `viewport=${row.viewportId ?? '—'}`,
    `parity=${row.crossFormatParityToken}`,
    `csv=${row.csvRowCount}`,
    `json=${row.jsonRowCount}`,
    `listing=${row.svgListingRowCount}`,
    `segs=${row.paginationSegmentCount}`,
  ];
  return parts.join(' · ');
}

/**
 * Filter / sort schedule-sheet export parity advisories from the violation list,
 * for surfacing in the existing advisor UI patterns.
 */
export function filterScheduleSheetExportParityAdvisories(violations: Violation[]): Violation[] {
  const matched = violations.filter((v) => PARITY_RULE_SET.has(v.ruleId));
  return [...matched].sort((a, b) => {
    const cr = a.ruleId.localeCompare(b.ruleId);
    if (cr !== 0) return cr;
    const cm = a.message.localeCompare(b.message);
    if (cm !== 0) return cm;
    const sa = [...(a.elementIds ?? [])].sort((x, y) => x.localeCompare(y)).join(',');
    const sb = [...(b.elementIds ?? [])].sort((x, y) => x.localeCompare(y)).join(',');
    return sa.localeCompare(sb);
  });
}

export function compactScheduleSheetExportParityAdvisoryLines(violations: Violation[]): string[] {
  return filterScheduleSheetExportParityAdvisories(violations).map((v) => {
    const ids = [...(v.elementIds ?? [])].sort((x, y) => x.localeCompare(y)).join(', ');
    return `${v.ruleId} · ${v.severity} · ${v.message}${ids ? ` · ${ids}` : ''}`;
  });
}
