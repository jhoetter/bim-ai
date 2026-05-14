/** Pure helpers for section viewport documentation labels (deterministic UX copy). */

/** Deterministic stair documentation line from `sectionProjectionPrimitives_v1.stairs`. */
export function formatSectionStairDocumentationCaption(
  stairs: ReadonlyArray<Record<string, unknown>>,
): string | null {
  if (stairs.length === 0) return null;
  const ordered = [...stairs].sort((a, b) => {
    const ea = String(a.elementId ?? a.id ?? '');
    const eb = String(b.elementId ?? b.id ?? '');
    return ea.localeCompare(eb);
  });
  const parts: string[] = [];
  for (const w of ordered) {
    const eid = String(w.elementId ?? w.id ?? '').trim();
    if (!eid) continue;
    const rc = Number(w.riserCountPlanProxy);
    const tc = Number(w.treadCountPlanProxy);
    const rise = Number(w.storyRiseMm);
    const ud = typeof w.planUpDownLabel === 'string' ? w.planUpDownLabel.trim() : '';
    const docLab =
      typeof w.stairPlanSectionDocumentationLabel === 'string'
        ? w.stairPlanSectionDocumentationLabel.trim()
        : '';
    const segs: string[] = [eid];
    if (docLab) {
      segs.push(docLab);
    } else {
      if (Number.isFinite(rc)) segs.push(`R=${Math.round(rc)}`);
      if (Number.isFinite(tc)) segs.push(`T=${Math.round(tc)}`);
      if (Number.isFinite(rise) && rise > 0) segs.push(`rise=${Math.round(rise)}mm`);
      if (ud) segs.push(ud);
    }
    parts.push(segs.join(' '));
  }
  if (parts.length === 0) return null;
  return `Stair doc · ${parts.join(' · ')}`;
}

export type SectionWallCutHatchKind = 'edgeOn' | 'alongCut';

export type SectionSheetCalloutRow = { id: string; name: string };

/** Parse server `cutHatchKind`; legacy payloads default to along-cut. */
export function parseSectionWallCutHatchKind(raw: unknown): SectionWallCutHatchKind {
  return raw === 'edgeOn' ? 'edgeOn' : 'alongCut';
}

/** One row from server `sectionDocMaterialHints` (WP-E04 / prompt-5). */

export type SectionDocMaterialHint = {
  tokenId: string;
  wallElementId: string;
  materialLabel: string;
  materialSurfacePatternId?: string | null;
  materialCutPatternId?: string | null;
  cutPatternHint: SectionWallCutHatchKind;
  uAnchorMm: number;
  zAnchorMm: number;
};

function cutPatternDocSuffix(kind: SectionWallCutHatchKind): string {
  switch (kind) {
    case 'edgeOn':
      return 'edge-on';
    case 'alongCut':
      return 'along-cut';
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/** Single-line caption: server `materialLabel` + hatch kind (deterministic; no client-side registry). */

export function formatSectionDocMaterialHintCaption(hint: {
  materialLabel: string;
  materialCutPatternId?: string | null;
  cutPatternHint: SectionWallCutHatchKind;
}): string {
  const pattern = hint.materialCutPatternId ? ` · cut ${hint.materialCutPatternId}` : '';
  return `${hint.materialLabel}${pattern} · ${cutPatternDocSuffix(hint.cutPatternHint)}`;
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

export type SectionWallHatchSummary = {
  edgeOn: number;
  alongCut: number;
};

/** Single readout line for wall hatch categories (matches sheet `secDoc` wh=E…A… semantics). */
export function formatSectionWallHatchReadout(summary: SectionWallHatchSummary): string {
  const total = summary.edgeOn + summary.alongCut;
  if (total === 0) return 'Wall hatch · none';
  return `Wall hatch · edge-on ${summary.edgeOn} · along-cut ${summary.alongCut}`;
}

export function formatSectionCutIdentityLine(part: { name: string; id: string }): string {
  return `Section · ${part.name} · ${part.id}`;
}

/** Plan-space segment; same fields as `section_cut.lineStartMm` / `lineEndMm`. */
export type SectionCutPlanSegmentMm = {
  lineStartMm: { xMm: number; yMm: number };
  lineEndMm: { xMm: number; yMm: number };
};

const EIGHT_WAY_COMPASS = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'] as const;

function compassLabel8(angDeg: number): string {
  const x = ((angDeg % 360) + 360) % 360;
  const idx = Math.floor((x + 22.5) / 45) % 8;
  return EIGHT_WAY_COMPASS[idx] ?? '—';
}

/**
 * Cut line run in plan (mm) and a deterministic 8-way view heading from the perpendicular
 * to the cut segment (+Y is “north” in plan mm).
 */
export function formatSectionCutPlaneContext(seg: SectionCutPlanSegmentMm): string {
  const dx = seg.lineEndMm.xMm - seg.lineStartMm.xMm;
  const dy = seg.lineEndMm.yMm - seg.lineStartMm.yMm;
  const run = Math.round(Math.hypot(dx, dy));
  if (run === 0) {
    return 'Cut line 0 mm · view toward —';
  }
  const nx = -dy / run;
  const ny = dx / run;
  const angDeg = (Math.atan2(ny, nx) * 180) / Math.PI;
  const toward = compassLabel8(angDeg);
  return `Cut line ${run} mm · view toward ${toward}`;
}

export function formatSectionLevelDatumCaption(part: {
  inViewCount: number;
  totalFromServer: number;
}): string {
  if (part.totalFromServer === 0) {
    return 'Level datums: none in snapshot';
  }
  if (part.inViewCount === 0) {
    return 'Level datums: markers outside current z-span';
  }
  return '';
}
