/** Pure helpers for SchedulePanel “registry chrome”: payload readouts + server CSV URL shape. */

export type ScheduleFieldMeta = {
  label?: string;
  role?: string;
};

export function buildScheduleTableCsvUrl(
  modelId: string,
  scheduleId: string,
  opts?: { columns?: string[]; includeScheduleTotalsCsv?: boolean },
): string {
  const mid = encodeURIComponent(modelId);
  const sc = encodeURIComponent(scheduleId);
  const includeTotals = opts?.includeScheduleTotalsCsv !== false;
  let url = `/api/models/${mid}/schedules/${sc}/table?format=csv`;
  if (includeTotals) url += '&includeScheduleTotalsCsv=true';
  const cols = opts?.columns;
  if (cols && cols.length > 0) url += `&columns=${cols.map(encodeURIComponent).join(',')}`;
  return url;
}

export function columnFieldRoleHint(fieldMeta: ScheduleFieldMeta | undefined): string {
  const r = fieldMeta?.role;
  if (typeof r !== 'string' || !r.trim()) return '';
  return ` · ${r}`;
}

export function formatSchedulePlacementReadout(placement: unknown): string | null {
  if (typeof placement !== 'object' || placement === null) return null;
  const o = placement as Record<string, unknown>;
  const sheetName = String(o.sheetName ?? o.sheet_name ?? '').trim();
  const sheetId = String(o.sheetId ?? o.sheet_id ?? '').trim();
  if (!sheetId && !sheetName) return null;
  if (sheetName && sheetId) return `Sheet placement: ${sheetName} (${sheetId})`;
  if (sheetName) return `Sheet placement: ${sheetName}`;
  return `Sheet placement: ${sheetId}`;
}

function str(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return undefined;
}

function stringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

export function columnMetadataCategoryLine(payload: Record<string, unknown>): string | null {
  const cm = payload.columnMetadata;
  if (typeof cm !== 'object' || cm === null) return null;
  const cat = (cm as { category?: unknown }).category;
  if (typeof cat !== 'string' || !cat.trim()) return null;
  return `Field registry · ${cat.trim()}`;
}

/**
 * Compact machine-friendly fragments for the registry chrome row (join with " · ").
 * Uses server `scheduleEngine` and mirrors top-level `groupKeys` when present.
 */
export function scheduleRegistryEngineReadoutParts(payload: Record<string, unknown>): string[] {
  const eng = payload.scheduleEngine;
  if (typeof eng !== 'object' || eng === null) return [];

  const e = eng as Record<string, unknown>;
  const parts: string[] = [];

  const fmt = str(e.format);
  if (fmt) parts.push(fmt);

  const cat = str(e.category);
  if (cat) parts.push(`cat ${cat}`);

  const topGk = stringArray(payload.groupKeys);
  const engGk = stringArray(e.groupKeys);
  const gk = engGk.length ? engGk : topGk;
  if (gk.length) parts.push(`group ${gk.join(', ')}`);

  const sortBy = str(e.sortBy);
  if (sortBy) parts.push(`sort ${sortBy}`);

  const tie = str(e.sortTieBreak);
  if (tie) parts.push(`tie ${tie}`);

  const sd = e.sortDescending ?? e.sort_descending;
  if (sd === true || sd === 'true' || sd === 1) parts.push('desc');

  const sup = e.supportsCsv ?? e.supports_csv;
  if (sup === true) parts.push('CSV export');
  else if (sup === false) parts.push('no CSV flag');

  const fe = e.filterEquals ?? e.filter_equals;
  if (typeof fe === 'object' && fe !== null && !Array.isArray(fe)) {
    const keys = Object.keys(fe as Record<string, unknown>).filter((k) => {
      const val = (fe as Record<string, unknown>)[k];
      return val != null && String(val).trim() !== '';
    });
    if (keys.length) parts.push(`equals ${keys.join(', ')}`);
  }

  const fr = e.filterRules ?? e.filter_rules;
  if (Array.isArray(fr) && fr.length) parts.push(`${fr.length} rule(s)`);

  return parts;
}
