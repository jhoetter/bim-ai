/** Persisted numeric schedule filters: field-scoped `gt` / `lt` in `filterRules` / `filter_rules`. */

type NumericRuleOp = 'gt' | 'lt';

function numericRuleValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function parseNumericFilterRuleThreshold(
  filters: Record<string, unknown>,
  fieldName: string,
  opName: NumericRuleOp,
): number | null {
  const raw = filters.filterRules ?? filters.filter_rules;
  if (!Array.isArray(raw)) return null;
  for (const r of raw) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue;
    const o = r as Record<string, unknown>;
    const field = String(o.field ?? '').trim();
    const op = String(o.op ?? '')
      .trim()
      .toLowerCase();
    if (field !== fieldName || op !== opName) continue;
    const v = numericRuleValue(o.value);
    if (v !== null) return v;
  }
  return null;
}

/** Merge or clear one numeric rule in `filterRules`; preserves other filter keys and rules. */
export function schedulesFiltersWithNumericRule(
  base: Record<string, unknown>,
  fieldName: string,
  opName: NumericRuleOp,
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
        if (field === fieldName && op === opName) continue;
      }
      rest.push(r);
    }
  }
  if (thresholdMm !== null && Number.isFinite(thresholdMm)) {
    rest.push({ field: fieldName, op: opName, value: thresholdMm });
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

export function parseWidthMmGtThreshold(filters: Record<string, unknown>): number | null {
  return parseNumericFilterRuleThreshold(filters, 'widthMm', 'gt');
}

/** First `widthMm` `lt` threshold (`filterRules` / `filter_rules`). */
export function parseWidthMmLtThreshold(filters: Record<string, unknown>): number | null {
  return parseNumericFilterRuleThreshold(filters, 'widthMm', 'lt');
}

/** Merge or clear `widthMm` `gt` in `filterRules`; preserves other filter keys and rules. */
export function schedulesFiltersWithWidthMmGt(
  base: Record<string, unknown>,
  thresholdMm: number | null,
): Record<string, unknown> {
  return schedulesFiltersWithNumericRule(base, 'widthMm', 'gt', thresholdMm);
}

/** Merge or clear `widthMm` `lt` in `filterRules`; preserves other filter keys and rules. */
export function schedulesFiltersWithWidthMmLt(
  base: Record<string, unknown>,
  thresholdMm: number | null,
): Record<string, unknown> {
  return schedulesFiltersWithNumericRule(base, 'widthMm', 'lt', thresholdMm);
}
