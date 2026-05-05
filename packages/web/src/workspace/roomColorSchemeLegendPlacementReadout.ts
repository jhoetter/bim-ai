/** Sheet legend placement readout helpers for ``roomColorSchemeLegendPlacementEvidence_v1`` (prompt-2 v1). */

export type RoomColorSchemePlacedRow = {
  viewportId: string;
  planViewRef: string;
  placementXMm: number;
  placementYMm: number;
  viewportWidthMm: number;
  viewportHeightMm: number;
  legendRowCount: number;
  legendDigestSha256: string;
  schemeSource: 'override' | 'hashed_fallback';
  schemeIdentity?: string;
  schemeOverrideRowCount?: number;
};

export type RoomColorSchemeLegendPlacementEvidence = {
  format: 'roomColorSchemeLegendPlacementEvidence_v1';
  placedLegendCount: number;
  placementDigestSha256: string;
  schemeIdentity: string | null;
  schemeOverrideRowCount: number;
  placedRows: RoomColorSchemePlacedRow[];
};

function asEv(ev: unknown): RoomColorSchemeLegendPlacementEvidence | null {
  if (!ev || typeof ev !== 'object') return null;
  const o = ev as Record<string, unknown>;
  if (o.format !== 'roomColorSchemeLegendPlacementEvidence_v1') return null;
  return o as unknown as RoomColorSchemeLegendPlacementEvidence;
}

/** Summary readout lines for sheet manifest legend placement evidence. */
export function roomColorSchemeLegendPlacementReadoutLines(ev: unknown): string[] {
  const o = asEv(ev);
  if (!o) return [];

  const dig = String(o.placementDigestSha256 ?? '').trim();
  const prefix = dig.length >= 16 ? `${dig.slice(0, 16)}…` : dig || '—';
  const id = o.schemeIdentity ?? '—';
  const cnt = Number(o.placedLegendCount ?? 0);
  const ovr = Number(o.schemeOverrideRowCount ?? 0);

  const lines: string[] = [
    `schemeIdentity ${id}`,
    `placedLegends ${cnt}`,
    `schemeOverrideRowCount ${ovr}`,
    `digest ${prefix}`,
  ];

  for (const row of o.placedRows ?? []) {
    const src = row.schemeSource === 'override' ? 'override' : 'hash';
    lines.push(
      `  vp=${row.viewportId} legendRows=${row.legendRowCount} src=${src} plan=${row.planViewRef}`,
    );
  }

  return lines;
}

/** One-line summary token for a placed viewport legend (sheet manifest table cell). */
export function formatPlacedLegendCell(row: RoomColorSchemePlacedRow): string {
  const src = row.schemeSource === 'override' ? 'override' : 'hash';
  const dig = row.legendDigestSha256.slice(0, 8);
  return `legend[n=${row.legendRowCount} src=${src} sha=${dig}]`;
}

/** Whether the placement evidence has any placed legends. */
export function hasPlacedLegends(ev: unknown): boolean {
  const o = asEv(ev);
  return (o?.placedLegendCount ?? 0) > 0;
}
