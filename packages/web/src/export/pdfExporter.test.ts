import { describe, expect, it } from 'vitest';

import { paperSizeMm, type PaperSize } from './pdfExporter';

describe('paperSizeMm', () => {
  it('returns correct dimensions for A4', () => {
    expect(paperSizeMm('A4')).toEqual({ widthMm: 210, heightMm: 297 });
  });

  it('returns correct dimensions for A3', () => {
    expect(paperSizeMm('A3')).toEqual({ widthMm: 297, heightMm: 420 });
  });

  it('returns non-zero dimensions for all paper sizes', () => {
    const sizes: PaperSize[] = ['A0', 'A1', 'A2', 'A3', 'A4'];
    for (const size of sizes) {
      const { widthMm, heightMm } = paperSizeMm(size);
      expect(widthMm, `${size} widthMm should be > 0`).toBeGreaterThan(0);
      expect(heightMm, `${size} heightMm should be > 0`).toBeGreaterThan(0);
    }
  });

  it('returns correct dimensions for A2', () => {
    expect(paperSizeMm('A2')).toEqual({ widthMm: 420, heightMm: 594 });
  });

  it('returns correct dimensions for A1', () => {
    expect(paperSizeMm('A1')).toEqual({ widthMm: 594, heightMm: 841 });
  });

  it('returns correct dimensions for A0', () => {
    expect(paperSizeMm('A0')).toEqual({ widthMm: 841, heightMm: 1189 });
  });
});
