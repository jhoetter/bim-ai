import type { Element } from '@bim-ai/core';

import type { ScheduleFieldMeta } from './schedulePanelRegistryChrome';
import { scheduleTotalsReadoutParts } from './schedulePayloadTotals';

export const SCHEDULE_TABLE_EMPTY_V1 = 'schedule_table_empty_v1';

export type ScheduleTableColumnV1 = {
  key: string;
  headerLabel: string;
  unitLabel: string;
  roleLabel: string;
  displayWidthHintPx: number;
};

export type ScheduleTableBodyRowV1 =
  | { id: string; kind: 'groupHeader'; label: string }
  | { id: string; kind: 'data'; record: Record<string, unknown> };

export type ScheduleTableModelV1 = {
  title: string;
  columns: ScheduleTableColumnV1[];
  bodyRows: ScheduleTableBodyRowV1[];
  leafRowCount: number;
  groupCount: number;
  emptyToken: string | null;
  footerParts: string[];
};

const SCH_DOC_OK =
  /^schDoc\[id=([^[\]]+) rows=(\d+) cols=(\d+) cat=([^[\]]+)\]$/;

/** Extract a trailing parenthetical unit snippet from registry labels, e.g. "(mm)", "(m²)". */
export function unitHintFromRegistryLabel(label: string): string {
  const m = /\(([^)]+)\)\s*$/.exec(label.trim());
  return m?.[1]?.trim() ?? '';
}

function roleWidthHintPx(role: string | undefined): number {
  const r = (role ?? '').toLowerCase();
  switch (r) {
    case 'id':
      return 72;
    case 'identity':
      return 88;
    case 'integer':
      return 92;
    case 'number':
      return 96;
    case 'text':
      return 140;
    default:
      return 110;
  }
}

export function columnDisplayWidthHintPx(fieldKey: string, meta: ScheduleFieldMeta | undefined): number {
  const k = fieldKey.toLowerCase();
  if (k === 'elementid' || k.endsWith('elementid')) return 72;
  if (k.includes('display') || k === 'name' || k.includes('name')) return Math.max(roleWidthHintPx(meta?.role), 128);
  return roleWidthHintPx(meta?.role);
}

function orderedColumnKeys(
  payload: Record<string, unknown>,
  visibleColumnKeys: string[] | undefined,
): string[] {
  const all = Array.isArray(payload.columns) ? (payload.columns as string[]) : [];
  if (!visibleColumnKeys?.length) return all;
  const want = new Set(visibleColumnKeys);
  return visibleColumnKeys.filter((c) => all.includes(c));
}

function fieldMetaMap(payload: Record<string, unknown>): Record<string, ScheduleFieldMeta> {
  const raw = payload.columnMetadata as { fields?: Record<string, ScheduleFieldMeta> } | undefined;
  const fields = raw?.fields ?? {};
  return fields as Record<string, ScheduleFieldMeta>;
}

function leafRowsFromPayload(payload: Record<string, unknown>): Record<string, unknown>[] {
  const rows = payload.rows;
  if (Array.isArray(rows)) return rows as Record<string, unknown>[];

  const gs = payload.groupedSections as Record<string, unknown[]> | undefined;
  if (gs && typeof gs === 'object') {
    const out: Record<string, unknown>[] = [];
    for (const v of Object.values(gs)) {
      if (Array.isArray(v)) out.push(...(v as Record<string, unknown>[]));
    }
    return out;
  }

  return [];
}

function buildBodyRows(payload: Record<string, unknown>): {
  bodyRows: ScheduleTableBodyRowV1[];
  leafRowCount: number;
  groupCount: number;
} {
  const gs = payload.groupedSections as Record<string, Record<string, unknown>[]> | undefined;

  if (gs && typeof gs === 'object' && !Array.isArray(gs)) {
    const keys = Object.keys(gs).sort((a, b) => a.localeCompare(b));
    const nonempty = keys.filter((k) => {
      const v = gs[k];
      return Array.isArray(v) && v.length > 0;
    });
    if (nonempty.length > 0 || keys.some((k) => Array.isArray(gs[k]))) {
      const bodyRows: ScheduleTableBodyRowV1[] = [];
      let leaf = 0;
      let gix = 0;
      for (const k of keys) {
        const prow = gs[k];
        const arr = Array.isArray(prow) ? prow : [];
        bodyRows.push({
          id: `grp-${gix}-${encodeURIComponent(k)}`,
          kind: 'groupHeader',
          label: k,
        });
        gix += 1;
        arr.forEach((r, i) => {
          const rec = r as Record<string, unknown>;
          bodyRows.push({
            id: String(
              rec.elementId ?? rec.element_id ?? `row-${k}-${i}`,
            ),
            kind: 'data',
            record: rec,
          });
          leaf += 1;
        });
      }
      return { bodyRows, leafRowCount: leaf, groupCount: keys.length };
    }
  }

  const flat = Array.isArray(payload.rows) ? (payload.rows as Record<string, unknown>[]) : leafRowsFromPayload(payload);
  const bodyRows: ScheduleTableBodyRowV1[] = flat.map((r, i) => ({
    id: String(r.elementId ?? (r as { element_id?: string }).element_id ?? `row-${i}`),
    kind: 'data' as const,
    record: r,
  }));

  return { bodyRows, leafRowCount: bodyRows.length, groupCount: 0 };
}

export function buildScheduleTableModelV1(options: {
  payload: Record<string, unknown>;
  visibleColumnKeys?: string[];
}): ScheduleTableModelV1 {
  const { payload, visibleColumnKeys } = options;

  const keys = orderedColumnKeys(payload, visibleColumnKeys);
  const fmeta = fieldMetaMap(payload);

  const columns: ScheduleTableColumnV1[] = keys.map((key) => {
    const meta = fmeta[key];
    const headerLabel = meta?.label?.trim() ? meta.label.trim() : key;
    const unitLabel = unitHintFromRegistryLabel(headerLabel);
    const roleLabel = typeof meta?.role === 'string' ? meta.role.trim() : '';
    return {
      key,
      headerLabel,
      unitLabel,
      roleLabel,
      displayWidthHintPx: columnDisplayWidthHintPx(key, meta),
    };
  });

  let title = String(payload.name ?? '').trim();
  if (!title) {
    const sid = String(payload.scheduleId ?? payload.schedule_id ?? '').trim();
    title = sid ? `Schedule (${sid})` : 'Schedule';
  }

  const rawTotals = payload.totals as Record<string, unknown> | undefined;
  const footerParts = scheduleTotalsReadoutParts(rawTotals);

  const { bodyRows, leafRowCount, groupCount } = buildBodyRows(payload);

  const emptyToken = leafRowCount === 0 ? SCHEDULE_TABLE_EMPTY_V1 : null;

  return {
    title,
    columns,
    bodyRows,
    leafRowCount,
    groupCount,
    emptyToken,
    footerParts,
  };
}

export function formatScheduleTableRendererV1Readout(model: ScheduleTableModelV1): string {
  const footer = model.footerParts.length > 0 ? 'yes' : 'no';
  return `tblV1[cols=${model.columns.length} leafRows=${model.leafRowCount} groups=${model.groupCount} footer=${footer}]`;
}

/**
 * Narrow sheet-documentation readout: enrich deterministic `schDoc[…]` summary with schedule name when resolvable.
 */
export function scheduleTableRendererV1SheetReadout(
  scheduleDocumentationSegment: string,
  elementsById: Record<string, Element>,
): string | null {
  const seg = String(scheduleDocumentationSegment ?? '').trim();
  const m = SCH_DOC_OK.exec(seg);
  if (!m) return null;

  const [, idRaw, rowsStr, colsStr, catRaw] = m;
  const el = elementsById[idRaw];
  const name =
    el?.kind === 'schedule' ? String(el.name ?? '').trim().replace(/\]/g, '').replace(/\[/g, '') : '';

  const safeName = name ? ` name=${name}` : '';
  return `tblV1[id=${idRaw}${safeName} rows=${rowsStr} cols=${colsStr} cat=${catRaw}]`;
}
