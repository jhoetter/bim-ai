import { describe, expect, it } from 'vitest';

import { normalizeSheetPaperMm } from './sheetPaper';

describe('normalizeSheetPaperMm', () => {
  it('keeps existing large drawing-space sheet dimensions', () => {
    expect(normalizeSheetPaperMm(84_100, 59_400)).toEqual({
      widthMm: 84_100,
      heightMm: 59_400,
    });
  });

  it('upscales true paper millimeters from seed/templates', () => {
    expect(normalizeSheetPaperMm(594, 420)).toEqual({ widthMm: 59_400, heightMm: 42_000 });
  });

  it('falls back to A3-ish legacy defaults for invalid dimensions', () => {
    expect(normalizeSheetPaperMm(null, undefined)).toEqual({ widthMm: 42_000, heightMm: 29_700 });
  });
});
