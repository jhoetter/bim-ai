import type { SiteContextObjectRow } from '@bim-ai/core';

export type XY = { xMm: number; yMm: number };

export type UpsertSiteCmdPayload = Record<string, unknown> & {
  type: 'upsertSite';
  id: string;
  name: string;
  referenceLevelId: string;
  boundaryMm: XY[];
  padThicknessMm: number;
  baseOffsetMm: number;
  contextObjects: SiteContextObjectRow[];
  northDegCwFromPlanX?: number;
  uniformSetbackMm?: number;
};

/** Axis-aligned CCW rectangle vertices (matches engine `_canonical_site_boundary_mm` for rectangles). */
export function defaultSiteRectangleBoundaryMm(widthMm: number, depthMm: number): XY[] {
  const w = Math.max(1, widthMm);
  const d = Math.max(1, depthMm);
  return [
    { xMm: 0, yMm: 0 },
    { xMm: w, yMm: 0 },
    { xMm: w, yMm: d },
    { xMm: 0, yMm: d },
  ];
}

export function boundaryMmFromAnchorSize(anchor: XY, widthMm: number, depthMm: number): XY[] {
  const ax = anchor.xMm;
  const ay = anchor.yMm;
  const w = Math.max(1, widthMm);
  const d = Math.max(1, depthMm);
  return [
    { xMm: ax, yMm: ay },
    { xMm: ax + w, yMm: ay },
    { xMm: ax + w, yMm: ay + d },
    { xMm: ax, yMm: ay + d },
  ];
}

export function boundaryAxisAlignedBoxMm(
  boundary: XY[],
): { anchor: XY; widthMm: number; depthMm: number } | null {
  if (boundary.length < 3) return null;
  let minX = boundary[0]!.xMm;
  let minY = boundary[0]!.yMm;
  let maxX = minX;
  let maxY = minY;
  for (const p of boundary) {
    minX = Math.min(minX, p.xMm);
    minY = Math.min(minY, p.yMm);
    maxX = Math.max(maxX, p.xMm);
    maxY = Math.max(maxY, p.yMm);
  }
  const widthMm = maxX - minX;
  const depthMm = maxY - minY;
  if (widthMm <= 0 || depthMm <= 0) return null;
  return { anchor: { xMm: minX, yMm: minY }, widthMm, depthMm };
}

/** Mirrors engine `_canonical_site_context_rows` sort order (`sorted(by_id)`). */
export function sortSiteContextObjectsById(rows: SiteContextObjectRow[]): SiteContextObjectRow[] {
  return [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export type BuildUpsertSiteInput = {
  id: string;
  name: string;
  referenceLevelId: string;
  boundaryMm: XY[];
  padThicknessMm: number;
  baseOffsetMm: number;
  northDegCwFromPlanX: number | null;
  uniformSetbackMm: number | null;
  contextObjects: SiteContextObjectRow[];
};

export function buildUpsertSiteCmdPayload(input: BuildUpsertSiteInput): UpsertSiteCmdPayload {
  const ctx = sortSiteContextObjectsById(
    input.contextObjects.filter((r) => typeof r.id === 'string' && r.id.trim().length > 0),
  ).map(normalizeSiteContextRow);

  const payload: UpsertSiteCmdPayload = {
    type: 'upsertSite',
    id: input.id.trim(),
    name: input.name.trim() || 'Site',
    referenceLevelId: input.referenceLevelId.trim(),
    boundaryMm: input.boundaryMm.map((p) => ({ xMm: p.xMm, yMm: p.yMm })),
    padThicknessMm: input.padThicknessMm,
    baseOffsetMm: input.baseOffsetMm,
    contextObjects: ctx,
  };

  if (input.northDegCwFromPlanX != null && Number.isFinite(input.northDegCwFromPlanX)) {
    payload.northDegCwFromPlanX = input.northDegCwFromPlanX;
  }

  if (input.uniformSetbackMm != null && Number.isFinite(input.uniformSetbackMm)) {
    payload.uniformSetbackMm = input.uniformSetbackMm;
  }

  return payload;
}

function normalizeSiteContextRow(row: SiteContextObjectRow): SiteContextObjectRow {
  const label = typeof row.label === 'string' ? row.label.trim() : '';
  const scale =
    typeof row.scale === 'number' && Number.isFinite(row.scale) && row.scale > 0 ? row.scale : 1;
  const category =
    typeof row.category === 'string' && row.category.trim().length > 0
      ? row.category.trim()
      : 'site_entourage';
  const out: SiteContextObjectRow = {
    id: row.id.trim(),
    contextType: row.contextType,
    positionMm: {
      xMm: row.positionMm.xMm,
      yMm: row.positionMm.yMm,
    },
    scale,
    category,
  };
  if (label.length > 0) out.label = label;
  return out;
}
