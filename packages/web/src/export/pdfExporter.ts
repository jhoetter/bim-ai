import { jsPDF } from 'jspdf';

export type PaperSize = 'A4' | 'A3' | 'A2' | 'A1' | 'A0';
export type DpiSetting = 72 | 150 | 300;

export interface PdfExportOptions {
  paperSize?: PaperSize;
  dpi?: DpiSetting;
  orientation?: 'portrait' | 'landscape';
  filename?: string;
}

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
  doc: jsPDF,
  element: HTMLCanvasElement | HTMLElement,
  paperSize: PaperSize,
  orientation: 'portrait' | 'landscape',
  isFirstPage: boolean,
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

  const imgW = img.naturalWidth || pageMmW;
  const imgH = img.naturalHeight || pageMmH;
  const imgAspect = imgW / imgH;
  const pageAspect = pageMmW / pageMmH;

  let drawW: number;
  let drawH: number;

  if (imgAspect > pageAspect) {
    // Image is wider relative to page — fit to full width
    drawW = pageMmW;
    drawH = pageMmW / imgAspect;
  } else {
    // Image is taller relative to page — fit to full height
    drawH = pageMmH;
    drawW = pageMmH * imgAspect;
  }

  const offsetX = (pageMmW - drawW) / 2;
  const offsetY = (pageMmH - drawH) / 2;

  doc.addImage(pngDataUrl, 'PNG', offsetX, offsetY, drawW, drawH);
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

  const { widthMm, heightMm } = paperSizeMm(paperSize);
  const pageMmW = orientation === 'landscape' ? heightMm : widthMm;
  const pageMmH = orientation === 'landscape' ? widthMm : heightMm;

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: [pageMmW, pageMmH],
  });

  await addPageToPdf(doc, canvasElement, paperSize, orientation, true);

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

  const firstSheet = sheetCanvases[0];
  const firstPaperSize = firstSheet.paperSize ?? defaultPaperSize;
  const { widthMm, heightMm } = paperSizeMm(firstPaperSize);
  const pageMmW = orientation === 'landscape' ? heightMm : widthMm;
  const pageMmH = orientation === 'landscape' ? widthMm : heightMm;

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: [pageMmW, pageMmH],
  });

  for (let i = 0; i < sheetCanvases.length; i++) {
    const sheet = sheetCanvases[i];
    const size = sheet.paperSize ?? defaultPaperSize;
    await addPageToPdf(doc, sheet.element, size, orientation, i === 0);
  }

  doc.save(filename);
}
