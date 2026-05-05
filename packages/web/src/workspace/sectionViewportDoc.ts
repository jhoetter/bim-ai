/** Pure helpers for section viewport documentation labels (deterministic UX copy). */

export type SectionWallCutHatchKind = 'edgeOn' | 'alongCut';

export type SectionSheetCalloutRow = { id: string; name: string };

export type SectionMaterialCutHintRow = {
  hostKind: string;
  hostElementId: string;
  label: string;
};

/** Parse server `cutHatchKind`; legacy payloads default to along-cut. */
export function parseSectionWallCutHatchKind(raw: unknown): SectionWallCutHatchKind {
  return raw === 'edgeOn' ? 'edgeOn' : 'alongCut';
}

export function formatSectionElevationSpanMmLabel(zMinMm: number, zMaxMm: number): string {
  const span = Math.abs(zMaxMm - zMinMm);

  return `Δz ${(span / 1000).toFixed(2)} m`;
}

/** Along-cut horizontal extent in section coordinates (matches `sectionGeometryExtentMm` u axis). */
export function formatSectionAlongCutSpanMmLabel(uMinMm: number, uMaxMm: number): string {
  const span = Math.abs(uMaxMm - uMinMm);
  return `Δu ${(span / 1000).toFixed(2)} m`;
}

/** Single-line caption for `sheetCallouts` on section primitives (sorted by id). */
export function formatSectionSheetCalloutsLabel(rows: SectionSheetCalloutRow[]): string {
  if (rows.length === 0) return '';
  const ordered = [...rows].sort((a, b) => a.id.localeCompare(b.id));
  const parts = ordered.map((r) => (r.name && r.name !== r.id ? `${r.name} (${r.id})` : r.id));
  return `Callouts · ${parts.join(', ')}`;
}

/** Single-line caption for typed assembly material cut-pattern hints in section primitives. */
export function formatSectionMaterialCutHintsLabel(rows: SectionMaterialCutHintRow[]): string {
  if (rows.length === 0) return '';
  const ordered = [...rows].sort((a, b) => {
    const ak = `${a.hostKind}:${a.hostElementId}`;
    const bk = `${b.hostKind}:${b.hostElementId}`;
    return ak.localeCompare(bk);
  });
  const parts = ordered.map((r) => `${r.hostElementId}: ${r.label || r.hostKind}`);
  return `Materials · ${parts.join('; ')}`;
}

/** Count wall `cutHatchKind` values for section viewport doc lines (legacy rows default to alongCut). */
export function summarizeWallCutHatchKinds(rows: ReadonlyArray<{ cutHatchKind?: string }>): {
  edgeOn: number;
  alongCut: number;
} {
  let edgeOn = 0;
  let alongCut = 0;
  for (const r of rows) {
    const k = r.cutHatchKind ?? 'alongCut';
    if (k === 'edgeOn') {
      edgeOn += 1;
    } else {
      alongCut += 1;
    }
  }
  return { edgeOn, alongCut };
}
