/** Pure helpers for SheetDocumentationManifest (WP-E05/E06/V01/X01 readout slice). */

export type CropExtentsMm = { widthMm: number; heightMm: number };

export function viewportCropExtentsMm(
  min: { xMm: number; yMm: number } | null | undefined,
  max: { xMm: number; yMm: number } | null | undefined,
): CropExtentsMm | null {
  if (!min || !max) return null;
  const widthMm = Math.abs(max.xMm - min.xMm);
  const heightMm = Math.abs(max.yMm - min.yMm);
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)) return null;
  return { widthMm, heightMm };
}

export type SheetExportHrefTriple = {
  svgHref: string;
  pdfHref: string;
  printRasterPngHref: string;
};

/** Mirrors `deterministic_sheet_evidence_manifest` href stems (`urllib.parse.quote(..., safe="")`-compatible ids use encodeURIComponent). */

export function sheetExportHrefTriple(modelId: string, sheetId: string): SheetExportHrefTriple {
  const mid = encodeURIComponent(modelId);
  const qid = encodeURIComponent(sheetId);
  const base = `/api/models/${mid}/exports`;
  return {
    svgHref: `${base}/sheet-preview.svg?sheetId=${qid}`,
    pdfHref: `${base}/sheet-preview.pdf?sheetId=${qid}`,
    printRasterPngHref: `${base}/sheet-print-raster.png?sheetId=${qid}`,
  };
}

export type ViewportEvidenceHintRow = {
  viewportId?: unknown;
  geom?: unknown;
  crop?: unknown;
  planProjectionSegment?: unknown;
  sectionDocumentationSegment?: unknown;
  scheduleDocumentationSegment?: unknown;
  schedulePaginationPlacementEvidence_v0?: unknown;
  roomProgrammeLegendDocumentationSegment?: unknown;
  detailCalloutDocumentationSegment?: unknown;
};

export function indexViewportEvidenceHints(
  hintsRaw: unknown,
): Map<string, ViewportEvidenceHintRow> {
  const m = new Map<string, ViewportEvidenceHintRow>();
  if (!Array.isArray(hintsRaw)) return m;
  for (const row of hintsRaw) {
    if (!row || typeof row !== 'object') continue;
    const vid = String((row as ViewportEvidenceHintRow).viewportId ?? '').trim();
    if (vid) m.set(vid, row as ViewportEvidenceHintRow);
  }
  return m;
}

/** One row from planSheetViewportPlacementEvidence_v1 on a deterministic sheet evidence manifest row. */
export type PlanSheetViewportPlacementEvidenceRow = {
  format: string;
  viewportId: string;
  planViewId: string;
  sheetViewportMmBox: { xMm: number; yMm: number; widthMm: number; heightMm: number };
  resolvedPlanCropMmBox: { xMinMm: number; yMinMm: number; xMaxMm: number; yMaxMm: number } | null;
  intersectClampToken: string;
  primitiveCounts: { inBox: Record<string, number>; clipped: Record<string, number> };
  planOnSheetSegmentDigestSha256: string;
};

/** Extract and validate plan-on-sheet placement evidence rows from a raw evidence payload field. */
export function extractPlanSheetViewportPlacementEvidence(
  raw: unknown,
): PlanSheetViewportPlacementEvidenceRow[] {
  if (!Array.isArray(raw)) return [];
  const out: PlanSheetViewportPlacementEvidenceRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (r['format'] !== 'planSheetViewportPlacementEvidence_v1') continue;
    const viewportId = String(r['viewportId'] ?? '').trim();
    const planViewId = String(r['planViewId'] ?? '').trim();
    const token = String(r['intersectClampToken'] ?? '').trim();
    const digest = String(r['planOnSheetSegmentDigestSha256'] ?? '').trim();
    if (!viewportId || !planViewId || !token) continue;

    const boxRaw = r['sheetViewportMmBox'];
    if (!boxRaw || typeof boxRaw !== 'object') continue;
    const box = boxRaw as Record<string, unknown>;
    const sheetBox = {
      xMm: Number(box['xMm'] ?? 0),
      yMm: Number(box['yMm'] ?? 0),
      widthMm: Number(box['widthMm'] ?? 0),
      heightMm: Number(box['heightMm'] ?? 0),
    };

    const cropRaw = r['resolvedPlanCropMmBox'];
    let planCrop: PlanSheetViewportPlacementEvidenceRow['resolvedPlanCropMmBox'] = null;
    if (cropRaw && typeof cropRaw === 'object') {
      const c = cropRaw as Record<string, unknown>;
      planCrop = {
        xMinMm: Number(c['xMinMm'] ?? 0),
        yMinMm: Number(c['yMinMm'] ?? 0),
        xMaxMm: Number(c['xMaxMm'] ?? 0),
        yMaxMm: Number(c['yMaxMm'] ?? 0),
      };
    }

    const countsRaw = r['primitiveCounts'];
    const inBox: Record<string, number> = {};
    const clipped: Record<string, number> = {};
    if (countsRaw && typeof countsRaw === 'object') {
      const c = countsRaw as Record<string, unknown>;
      const inRaw = c['inBox'];
      const clRaw = c['clipped'];
      if (inRaw && typeof inRaw === 'object') {
        for (const [k, v] of Object.entries(inRaw as Record<string, unknown>)) {
          inBox[k] = Number(v);
        }
      }
      if (clRaw && typeof clRaw === 'object') {
        for (const [k, v] of Object.entries(clRaw as Record<string, unknown>)) {
          clipped[k] = Number(v);
        }
      }
    }

    out.push({
      format: 'planSheetViewportPlacementEvidence_v1',
      viewportId,
      planViewId,
      sheetViewportMmBox: sheetBox,
      resolvedPlanCropMmBox: planCrop,
      intersectClampToken: token,
      primitiveCounts: { inBox, clipped },
      planOnSheetSegmentDigestSha256: digest,
    });
  }
  return out.sort((a, b) => a.viewportId.localeCompare(b.viewportId));
}

/** Label for intersect/clamp token, used in UI display. */
export function planOnSheetTokenLabel(token: string): string {
  switch (token) {
    case 'inside':
      return 'inside';
    case 'clamped':
      return 'clamped';
    case 'crop_missing':
      return 'crop missing';
    case 'viewport_zero_extent':
      return 'viewport zero extent';
    case 'crop_inverted':
      return 'crop inverted';
    default:
      return token;
  }
}
