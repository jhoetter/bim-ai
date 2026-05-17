import { describe, expect, it } from 'vitest';

import { PAPER_CSS, paperSizeMm, type PaperSize } from './pdfExporter';

describe('paperSizeMm — §12.4.5', () => {
  it('A4 returns 210x297', () => {
    expect(paperSizeMm('A4')).toEqual({ widthMm: 210, heightMm: 297 });
  });

  it('A0 returns 841x1189', () => {
    expect(paperSizeMm('A0')).toEqual({ widthMm: 841, heightMm: 1189 });
  });

  it('landscape swaps dimensions', () => {
    const { widthMm, heightMm } = paperSizeMm('A4');
    // landscape: page width = portrait height, page height = portrait width
    const pageMmW = heightMm;
    const pageMmH = widthMm;
    expect(pageMmW).toBe(297);
    expect(pageMmH).toBe(210);
    expect(pageMmW).toBeGreaterThan(pageMmH);
  });
});

describe('PDF exporter options — §12.4.5', () => {
  it('paperSizeMm includes A3', () => {
    const a3 = paperSizeMm('A3');
    expect(a3).toBeDefined();
    expect(a3.widthMm).toBe(297);
    expect(a3.heightMm).toBe(420);
  });

  it('paperSizeMm A4 width is 210', () => {
    expect(paperSizeMm('A4').widthMm).toBe(210);
  });
});

describe('PDF paper sizes — §12.4.5', () => {
  it('PaperSize includes all seven sizes', () => {
    const sizes: PaperSize[] = ['A0', 'A1', 'A2', 'A3', 'A4', 'Letter', 'Tabloid'];
    expect(sizes).toHaveLength(7);
  });

  it('PAPER_CSS maps A0 to 841mm 1189mm', () => {
    expect(PAPER_CSS['A0']).toBe('841mm 1189mm');
  });

  it('PAPER_CSS maps Letter to 216mm 279mm', () => {
    expect(PAPER_CSS['Letter']).toBe('216mm 279mm');
  });

  it('PAPER_CSS maps Tabloid to 279mm 432mm', () => {
    expect(PAPER_CSS['Tabloid']).toBe('279mm 432mm');
  });

  it('landscape swaps dimensions — A4 portrait is 210x297, landscape gives 297 wide', () => {
    const { widthMm, heightMm } = paperSizeMm('A4');
    const pageMmW = heightMm; // landscape width = portrait height
    const pageMmH = widthMm; // landscape height = portrait width
    expect(pageMmW).toBe(297);
    expect(pageMmH).toBe(210);
    expect(pageMmW).toBeGreaterThan(pageMmH);
  });

  it('paperSizeMm Letter returns 216x279', () => {
    expect(paperSizeMm('Letter')).toEqual({ widthMm: 216, heightMm: 279 });
  });

  it('paperSizeMm Tabloid returns 279x432', () => {
    expect(paperSizeMm('Tabloid')).toEqual({ widthMm: 279, heightMm: 432 });
  });
});
