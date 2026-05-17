/** Readout helpers for room color scheme override evidence and legend digest (prompt-2 v1 closeout). */

import type { Element } from '@bim-ai/core';

/** A single row in the color fill legend panel (§13.1.3). */
export type LegendRow = {
  colorHex: string;
  label: string;
  count?: number;
  areaSqm?: number;
};

/**
 * Build legend rows from a plan_view colorScheme and the full element map.
 * Counts how many rooms fall into each category value so the legend panel can
 * show a count badge.
 */
export function buildRoomColorSchemeLegend(
  elementsById: Record<string, Element>,
  colorScheme: { category: string; colorMap: Record<string, string> } | null | undefined,
): LegendRow[] {
  if (!colorScheme || Object.keys(colorScheme.colorMap).length === 0) return [];

  const { category, colorMap } = colorScheme;

  // Count rooms per category value
  const counts: Record<string, number> = {};
  for (const el of Object.values(elementsById)) {
    if (el.kind !== 'room') continue;
    let value: string;
    switch (category) {
      case 'name':
        value = (el as { name?: string }).name?.trim() || '(unnamed)';
        break;
      case 'department':
        value = (el as { department?: string | null }).department?.trim() || '(no department)';
        break;
      case 'area': {
        const areaMm2 = (el as { area?: number | null }).area;
        if (areaMm2 == null) {
          value = '(no area)';
        } else {
          const sqM = areaMm2 / 1_000_000;
          const bucket = Math.floor(sqM / 10) * 10;
          value = `${bucket}–${bucket + 10} m²`;
        }
        break;
      }
      case 'occupancy':
        value = (el as { occupancy?: string | null }).occupancy?.trim() || '(no occupancy)';
        break;
      default:
        value = '—';
    }
    counts[value] = (counts[value] ?? 0) + 1;
  }

  return Object.entries(colorMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, colorHex]) => ({
      colorHex,
      label,
      count: counts[label],
    }));
}

export type RoomColorSchemeOverrideRow = {
  programmeCode?: string | null;
  department?: string | null;
  label?: string | null;
  schemeColorHex: string;
  orderIndex: number;
  advisoryCodes: string[];
};

export type RoomColorSchemeOverrideEvidence = {
  format: 'roomColorSchemeOverrideEvidence_v1';
  schemeIdentity: string | null;
  overrideRowCount: number;
  rows: RoomColorSchemeOverrideRow[];
  rowDigestSha256: string;
  advisoryFindings: { code: string; severity: string; message: string }[];
};

function asEv(ev: unknown): RoomColorSchemeOverrideEvidence | null {
  if (!ev || typeof ev !== 'object') return null;
  const o = ev as Record<string, unknown>;
  if (o.format !== 'roomColorSchemeOverrideEvidence_v1') return null;
  return o as unknown as RoomColorSchemeOverrideEvidence;
}

/** Summary readout lines for ``roomColorSchemeOverrideEvidence_v1``. */
export function roomColorSchemeLegendReadoutParts(ev: unknown): string[] {
  const o = asEv(ev);
  if (!o) return [];

  const dig = String(o.rowDigestSha256 ?? '').trim();
  const prefix = dig.length >= 16 ? `${dig.slice(0, 16)}…` : dig || '—';
  const id = o.schemeIdentity ?? '—';
  const cnt = Number(o.overrideRowCount ?? 0);
  const warns = (o.advisoryFindings ?? []).filter((f) => f.severity !== 'info');
  const infos = (o.advisoryFindings ?? []).filter((f) => f.severity === 'info');

  const lines: string[] = [`schemeIdentity ${id}`, `overrideRowCount ${cnt}`, `digest ${prefix}`];
  if (warns.length > 0) {
    lines.push(`warnings ${warns.length}`);
  }
  if (infos.length > 0) {
    lines.push(`infos ${infos.length}`);
  }
  return lines;
}

/** Whether the evidence has any advisory findings (for badge / highlight). */
export function roomColorSchemeHasAdvisories(ev: unknown): boolean {
  const o = asEv(ev);
  if (!o) return false;
  return (o.advisoryFindings ?? []).length > 0;
}

/** Per-row summary tokens for the authoring workbench or schedule readout. */
export function roomColorSchemeOverrideRowSummary(ev: unknown): {
  label: string;
  hex: string;
  orderIndex: number;
  hasAdvisory: boolean;
}[] {
  const o = asEv(ev);
  if (!o) return [];
  return o.rows.map((r) => ({
    label: r.label ?? r.programmeCode ?? r.department ?? '—',
    hex: r.schemeColorHex,
    orderIndex: r.orderIndex,
    hasAdvisory: r.advisoryCodes.length > 0,
  }));
}
