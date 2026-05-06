/** Readout helpers for room color scheme override evidence and legend digest (prompt-2 v1 closeout). */

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
