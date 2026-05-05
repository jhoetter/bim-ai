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
};

export function indexViewportEvidenceHints(hintsRaw: unknown): Map<string, ViewportEvidenceHintRow> {
  const m = new Map<string, ViewportEvidenceHintRow>();
  if (!Array.isArray(hintsRaw)) return m;
  for (const row of hintsRaw) {
    if (!row || typeof row !== 'object') continue;
    const vid = String((row as ViewportEvidenceHintRow).viewportId ?? '').trim();
    if (vid) m.set(vid, row as ViewportEvidenceHintRow);
  }
  return m;
}
