// FE-CQ-03 — jsPDF is dynamically imported at call sites (see
// `exportSheetToPdf` / `exportSheetsToPdf`). A top-level `import { jsPDF }
// from 'jspdf'` would pull ~200 KB into the main bundle, but PDF export is
// low-frequency (sheet/schedule export only), so we defer the load until
// the user actually triggers an export.
//
// `JsPDFInstance` is the type-only handle used by the synchronous helper
// `addPageToPdf`. It mirrors the public surface of `jsPDF` we touch
// (`addPage`, `addImage`, `setFontSize`, `setTextColor`, `text`, `save`).
// We re-derive it from `typeof import('jspdf')` so the type stays in lock-
// step with the runtime module without forcing a static import.
type JsPDFInstance = InstanceType<(typeof import('jspdf'))['jsPDF']>;

export type PaperSize = 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'Letter' | 'Tabloid';
export type DpiSetting = 72 | 150 | 300;

export interface PdfExportOptions {
  paperSize?: PaperSize;
  dpi?: DpiSetting;
  orientation?: 'portrait' | 'landscape';
  filename?: string;
  marginMm?: number;
}

/** CSS page dimensions (portrait) for each paper size. */
export const PAPER_CSS: Record<PaperSize, string> = {
  A0: '841mm 1189mm',
  A1: '594mm 841mm',
  A2: '420mm 594mm',
  A3: '297mm 420mm',
  A4: '210mm 297mm',
  Letter: '216mm 279mm',
  Tabloid: '279mm 432mm',
};

/** Return paper dimensions in mm for a given size (always portrait dimensions; landscape swaps). */
export function paperSizeMm(size: PaperSize): { widthMm: number; heightMm: number } {
  switch (size) {
    case 'A4':
      return { widthMm: 210, heightMm: 297 };
    case 'A3':
      return { widthMm: 297, heightMm: 420 };
    case 'A2':
      return { widthMm: 420, heightMm: 594 };
    case 'A1':
      return { widthMm: 594, heightMm: 841 };
    case 'A0':
      return { widthMm: 841, heightMm: 1189 };
    case 'Letter':
      return { widthMm: 216, heightMm: 279 };
    case 'Tabloid':
      return { widthMm: 279, heightMm: 432 };
  }
}

/**
 * Capture an element to a PNG data URL.
 * Handles both HTMLCanvasElement (via toDataURL) and generic HTMLElement
 * (via html2canvas if available, otherwise throws a helpful error).
 */
async function captureElementToPng(element: HTMLCanvasElement | HTMLElement): Promise<string> {
  if (element instanceof HTMLCanvasElement) {
    return element.toDataURL('image/png');
  }

  // Try html2canvas if available in the environment. The specifier is built at runtime
  // to avoid Vite's static import-analysis failing when html2canvas is not installed.
  try {
    const specifier = 'html2canvas';
    const html2canvasModule = (await import(/* @vite-ignore */ specifier)) as {
      default: (el: HTMLElement, opts?: Record<string, unknown>) => Promise<HTMLCanvasElement>;
    };
    const canvas = await html2canvasModule.default(element as HTMLElement);
    return canvas.toDataURL('image/png');
  } catch {
    throw new Error(
      'pdfExporter: element is not an HTMLCanvasElement and html2canvas is not available. ' +
        'Either pass an HTMLCanvasElement or install html2canvas.',
    );
  }
}

/**
 * Add a single element as a page to a jsPDF document.
 * Scales the captured image to fit within the paper size while preserving aspect ratio.
 */
async function addPageToPdf(
  doc: JsPDFInstance,
  element: HTMLCanvasElement | HTMLElement,
  paperSize: PaperSize,
  orientation: 'portrait' | 'landscape',
  isFirstPage: boolean,
  marginMm = 10,
  pageIndex = 0,
  totalPages = 1,
): Promise<void> {
  const pngDataUrl = await captureElementToPng(element);

  const { widthMm, heightMm } = paperSizeMm(paperSize);
  const pageMmW = orientation === 'landscape' ? heightMm : widthMm;
  const pageMmH = orientation === 'landscape' ? widthMm : heightMm;

  if (!isFirstPage) {
    doc.addPage([pageMmW, pageMmH], orientation);
  }

  // Get image natural dimensions to compute aspect ratio
  const img = new Image();
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve(); // resolve anyway; we'll use 1:1 fallback
    img.src = pngDataUrl;
  });

  const printW = pageMmW - marginMm * 2;
  const printH = pageMmH - marginMm * 2;
  const imgW = img.naturalWidth || printW;
  const imgH = img.naturalHeight || printH;
  const imgAspect = imgW / imgH;
  const pageAspect = printW / printH;

  let drawW: number;
  let drawH: number;

  if (imgAspect > pageAspect) {
    // Image is wider relative to page — fit to full width
    drawW = printW;
    drawH = printW / imgAspect;
  } else {
    // Image is taller relative to page — fit to full height
    drawH = printH;
    drawW = printH * imgAspect;
  }

  const offsetX = marginMm + (printW - drawW) / 2;
  const offsetY = marginMm + (printH - drawH) / 2;

  doc.addImage(pngDataUrl, 'PNG', offsetX, offsetY, drawW, drawH);

  // Page number in the bottom margin area (§12.4.5)
  const pageNum = pageIndex + 1;
  doc.setFontSize(7);
  doc.setTextColor(102, 102, 102);
  doc.text(`${pageNum} / ${totalPages}`, pageMmW / 2, pageMmH - 5, { align: 'center' });
}

/**
 * Export a sheet canvas element to PDF and trigger browser download.
 * The canvas element should be the rendered sheet canvas.
 */
export async function exportSheetToPdf(
  canvasElement: HTMLCanvasElement | HTMLElement,
  opts?: PdfExportOptions,
): Promise<void> {
  const paperSize = opts?.paperSize ?? 'A4';
  const orientation = opts?.orientation ?? 'landscape';
  const filename = opts?.filename ?? 'sheet-export.pdf';
  const marginMm = opts?.marginMm ?? 10;

  const { widthMm, heightMm } = paperSizeMm(paperSize);
  const pageMmW = orientation === 'landscape' ? heightMm : widthMm;
  const pageMmH = orientation === 'landscape' ? widthMm : heightMm;

  // FE-CQ-03 — defer the ~200 KB jspdf bundle until export is triggered.
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: [pageMmW, pageMmH],
  });

  await addPageToPdf(doc, canvasElement, paperSize, orientation, true, marginMm, 0, 1);

  doc.save(filename);
}

/**
 * Export multiple sheets to a multi-page PDF.
 */
export async function exportSheetsToPdf(
  sheetCanvases: Array<{ element: HTMLCanvasElement | HTMLElement; paperSize?: PaperSize }>,
  opts?: PdfExportOptions,
): Promise<void> {
  if (sheetCanvases.length === 0) return;

  const defaultPaperSize = opts?.paperSize ?? 'A4';
  const orientation = opts?.orientation ?? 'landscape';
  const filename = opts?.filename ?? 'sheets-export.pdf';
  const marginMm = opts?.marginMm ?? 10;

  const firstSheet = sheetCanvases[0];
  const firstPaperSize = firstSheet.paperSize ?? defaultPaperSize;
  const { widthMm, heightMm } = paperSizeMm(firstPaperSize);
  const pageMmW = orientation === 'landscape' ? heightMm : widthMm;
  const pageMmH = orientation === 'landscape' ? widthMm : heightMm;

  // FE-CQ-03 — defer the ~200 KB jspdf bundle until export is triggered.
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: [pageMmW, pageMmH],
  });

  for (let i = 0; i < sheetCanvases.length; i++) {
    const sheet = sheetCanvases[i];
    const size = sheet.paperSize ?? defaultPaperSize;
    await addPageToPdf(
      doc,
      sheet.element,
      size,
      orientation,
      i === 0,
      marginMm,
      i,
      sheetCanvases.length,
    );
  }

  doc.save(filename);
}
