/** Persisted schedule opening filters: `widthMm` `gt` / `lt` in `filterRules` / `filter_rules`. */

export function parseWidthMmGtThreshold(filters: Record<string, unknown>): number | null {
  const raw = filters.filterRules ?? filters.filter_rules;
  if (!Array.isArray(raw)) return null;
  for (const r of raw) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue;
    const o = r as Record<string, unknown>;
    const field = String(o.field ?? '').trim();
    const op = String(o.op ?? '')
      .trim()
      .toLowerCase();
    if (field !== 'widthMm' || op !== 'gt') continue;
    const v = o.value;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim()) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/** First `widthMm` `lt` threshold (`filterRules` / `filter_rules`). */
export function parseWidthMmLtThreshold(filters: Record<string, unknown>): number | null {
  const raw = filters.filterRules ?? filters.filter_rules;
  if (!Array.isArray(raw)) return null;
  for (const r of raw) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue;
    const o = r as Record<string, unknown>;
    const field = String(o.field ?? '').trim();
    const op = String(o.op ?? '')
      .trim()
      .toLowerCase();
    if (field !== 'widthMm' || op !== 'lt') continue;
    const v = o.value;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim()) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/** Merge or clear `widthMm` `gt` in `filterRules`; preserves other filter keys and rules. */
export function schedulesFiltersWithWidthMmGt(
  base: Record<string, unknown>,
  thresholdMm: number | null,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...base };
  const raw = next.filterRules ?? next.filter_rules;
  const rest: unknown[] = [];
  if (Array.isArray(raw)) {
    for (const r of raw) {
      if (r && typeof r === 'object' && !Array.isArray(r)) {
        const o = r as Record<string, unknown>;
        const field = String(o.field ?? '').trim();
        const op = String(o.op ?? '')
          .trim()
          .toLowerCase();
        if (field === 'widthMm' && op === 'gt') continue;
      }
      rest.push(r);
    }
  }
  if (thresholdMm !== null && Number.isFinite(thresholdMm)) {
    rest.push({ field: 'widthMm', op: 'gt', value: thresholdMm });
  }
  if (rest.length) {
    next.filterRules = rest;
    delete next.filter_rules;
  } else {
    delete next.filterRules;
    delete next.filter_rules;
  }
  return next;
}

/** Merge or clear `widthMm` `lt` in `filterRules`; preserves other filter keys and rules. */
export function schedulesFiltersWithWidthMmLt(
  base: Record<string, unknown>,
  thresholdMm: number | null,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...base };
  const raw = next.filterRules ?? next.filter_rules;
  const rest: unknown[] = [];
  if (Array.isArray(raw)) {
    for (const r of raw) {
      if (r && typeof r === 'object' && !Array.isArray(r)) {
        const o = r as Record<string, unknown>;
        const field = String(o.field ?? '').trim();
        const op = String(o.op ?? '')
          .trim()
          .toLowerCase();
        if (field === 'widthMm' && op === 'lt') continue;
      }
      rest.push(r);
    }
  }
  if (thresholdMm !== null && Number.isFinite(thresholdMm)) {
    rest.push({ field: 'widthMm', op: 'lt', value: thresholdMm });
  }
  if (rest.length) {
    next.filterRules = rest;
    delete next.filter_rules;
  } else {
    delete next.filterRules;
    delete next.filter_rules;
  }
  return next;
}
