import type { CategoryVisualOverride } from '@bim-ai/core';

/**
 * §1.6.10 — Merge global project-level and per-view CategoryVisualOverride arrays.
 * View-level overrides shadow global overrides for the same category.
 * Overrides are matched by a `category` property added by the per-view VG dialog.
 */
export function mergeOverrides(
  global: CategoryVisualOverride[],
  view: CategoryVisualOverride[],
): CategoryVisualOverride[] {
  type WithCat = CategoryVisualOverride & { category?: string };
  const map = new Map<string, WithCat>();
  for (const ovr of global) {
    const cat = (ovr as WithCat).category;
    if (cat) map.set(cat, ovr as WithCat);
  }
  for (const ovr of view) {
    const cat = (ovr as WithCat).category;
    if (cat) map.set(cat, ovr as WithCat);
  }
  return Array.from(map.values());
}
