/** Compact readout lines from server stair schedule rows (correlation + derivation status). */

export function stairScheduleEvidenceReadoutLines(rows: unknown): string[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const r = rows[0] as Record<string, unknown>;
  const tok = String(r.stairScheduleCorrelationToken ?? '').trim();
  const st = String(r.stairQuantityDerivationStatus ?? '').trim();
  if (!tok && !st) return [];
  return [`corr ${tok || '—'}`, `qty ${st || '—'}`];
}
