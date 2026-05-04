/** Pure helpers for section viewport documentation labels (deterministic UX copy). */

export function formatSectionElevationSpanMmLabel(zMinMm: number, zMaxMm: number): string {
  const span = Math.abs(zMaxMm - zMinMm);

  return `Δz ${(span / 1000).toFixed(2)} m`;
}
