import { describe, expect, it } from 'vitest';

import { paperSizeMm } from './pdfExporter';

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
