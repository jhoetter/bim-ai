/** Pure helpers for section viewport documentation labels (deterministic UX copy). */

export type SectionSheetCalloutRow = { id: string; name: string };

export function formatSectionElevationSpanMmLabel(zMinMm: number, zMaxMm: number): string {
  const span = Math.abs(zMaxMm - zMinMm);

  return `Δz ${(span / 1000).toFixed(2)} m`;
}

/** Single-line caption for `sheetCallouts` on section primitives (sorted by id). */
export function formatSectionSheetCalloutsLabel(rows: SectionSheetCalloutRow[]): string {
  if (rows.length === 0) return '';
  const ordered = [...rows].sort((a, b) => a.id.localeCompare(b.id));
  const parts = ordered.map((r) => (r.name && r.name !== r.id ? `${r.name} (${r.id})` : r.id));
  return `Callouts · ${parts.join(', ')}`;
}
