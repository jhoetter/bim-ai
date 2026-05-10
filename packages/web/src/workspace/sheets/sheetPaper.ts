export type SheetPaperMm = { widthMm: number; heightMm: number };

const DEFAULT_PAPER: SheetPaperMm = { widthMm: 42_000, heightMm: 29_700 };

function finitePositive(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/**
 * Legacy sheet preview surfaces use deci-millimeter-like paper space
 * (A1 ~= 84100 x 59400). Some seed/template data stores true paper
 * millimeters (A2 = 594 x 420). Normalize the latter so the title block,
 * viewports, and empty states render in the visible SVG viewBox.
 */
export function normalizeSheetPaperMm(width: unknown, height: unknown): SheetPaperMm {
  const rawW = finitePositive(width) ? width : DEFAULT_PAPER.widthMm;
  const rawH = finitePositive(height) ? height : DEFAULT_PAPER.heightMm;
  if (rawW <= 2000 && rawH <= 2000) {
    return { widthMm: rawW * 100, heightMm: rawH * 100 };
  }
  return { widthMm: rawW, heightMm: rawH };
}
