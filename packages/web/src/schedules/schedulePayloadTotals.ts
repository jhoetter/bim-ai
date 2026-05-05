/** Schedule payload totals + sort-direction helpers (shared by SchedulePanel and scheduleTableRenderer_v1). */

/** Precedence matches server `_resolve_sort_descending` (filters, then grouping). */
export function resolveScheduleSortDescending(
  filters: Record<string, unknown>,
  grouping: Record<string, unknown> | undefined,
): boolean {
  for (const src of [filters, grouping ?? {}]) {
    const v = src.sortDescending ?? src.sort_descending;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string' && ['true', '1', 'yes'].includes(v.trim().toLowerCase())) return true;
  }
  return false;
}

export function scheduleTotalsReadoutParts(totals: Record<string, unknown> | undefined): string[] {
  if (!totals) return [];

  const kind = String(totals.kind ?? '');

  const parts: string[] = [];

  parts.push(`${totals.rowCount ?? totals.row_count ?? '?'} rows`);

  if (kind === 'room') {
    parts.push(`sum area ${Number(totals.areaM2 ?? 0).toFixed(3)} m2`);
    parts.push(`sum perimeter ${Number(totals.perimeterM ?? 0).toFixed(3)} m`);
    const tsum = totals.targetAreaM2 ?? totals.target_area_m2;
    if (tsum != null && tsum !== '' && Number.isFinite(Number(tsum))) {
      parts.push(`sum target ${Number(tsum).toFixed(3)} m²`);
    }
    const fc = totals.finishCompleteCount ?? totals.finish_complete_count;
    if (fc != null && fc !== '' && Number.isFinite(Number(fc))) {
      parts.push(`finish OK ${Number(fc)}`);
    }
    const fm = totals.finishMissingCount ?? totals.finish_missing_count;
    if (fm != null && fm !== '' && Number.isFinite(Number(fm))) {
      parts.push(`finish missing ${Number(fm)}`);
    }
    const fps = totals.finishPeerSuggestedCount ?? totals.finish_peer_suggested_count;
    if (fps != null && fps !== '' && Number.isFinite(Number(fps))) {
      parts.push(`finish peer ${Number(fps)}`);
    }
  }

  if (kind === 'door') {
    parts.push(`sum rough opening ${Number(totals.roughOpeningAreaM2 ?? 0).toFixed(6)} m²`);
  }

  if (kind === 'window') {
    parts.push(`avg width ${Number(totals.averageWidthMm ?? 0).toFixed(1)} mm`);
    parts.push(`sum rough opening ${Number(totals.roughOpeningAreaM2 ?? 0).toFixed(6)} m²`);
    const glaze = totals.totalOpeningAreaM2 ?? totals.total_opening_area_m2;
    if (glaze != null && glaze !== '' && Number.isFinite(Number(glaze))) {
      parts.push(`sum glazing ${Number(glaze).toFixed(6)} m²`);
    }
  }

  if (kind === 'floor') parts.push(`sum area ${Number(totals.areaM2 ?? 0).toFixed(3)} m²`);

  if (kind === 'roof') parts.push(`footprint ${Number(totals.footprintAreaM2 ?? 0).toFixed(3)} m²`);

  if (kind === 'stair') parts.push(`total run ${Number(totals.totalRunMm ?? 0).toFixed(1)} mm`);

  if (kind === 'sheet') parts.push(`viewports ${Number(totals.totalViewports ?? 0)}`);

  if (kind === 'material_assembly') {
    parts.push(`gross volume ${Number(totals.grossVolumeM3 ?? 0).toFixed(8)} m³`);
  }

  return parts;
}
