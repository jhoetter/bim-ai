import type { Element } from '@bim-ai/core';

/**
 * WP-C C2: compute the total staircase height in mm for a multi-storey stair.
 */
export function multiStoreyStairTotalHeightMm(
  stair: Extract<Element, { kind: 'stair' }>,
  elementsById: Record<string, Element>,
): number {
  const base = elementsById[stair.baseLevelId];
  const top = elementsById[stair.topLevelId];
  const baseMm = base?.kind === 'level' ? base.elevationMm : 0;
  const topMm = top?.kind === 'level' ? top.elevationMm : 0;
  return Math.abs(topMm - baseMm);
}

/** Compact readout lines from server stair schedule rows (correlation + derivation status). */
export function stairScheduleEvidenceReadoutLines(rows: unknown): string[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const r = rows[0] as Record<string, unknown>;
  const tok = String(r.stairScheduleCorrelationToken ?? '').trim();
  const st = String(r.stairQuantityDerivationStatus ?? '').trim();
  if (!tok && !st) return [];
  return [`corr ${tok || '—'}`, `qty ${st || '—'}`];
}
