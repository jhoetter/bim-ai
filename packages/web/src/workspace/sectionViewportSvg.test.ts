import { describe, expect, it } from 'vitest';

import {
  formatSectionAlongCutSpanMmLabel,
  formatSectionDocMaterialHintCaption,
  formatSectionElevationSpanMmLabel,
  formatSectionSheetCalloutsLabel,
  summarizeWallCutHatchKinds,
} from './sectionViewportDoc';

describe('Section viewport documentation helpers', () => {
  it('summarizes wall cutHatchKind rows like secDoc wh=E…A…', () => {
    expect(
      summarizeWallCutHatchKinds([
        { cutHatchKind: 'edgeOn' },
        { cutHatchKind: 'alongCut' },
        { cutHatchKind: 'edgeOn' },
      ]),
    ).toEqual({ edgeOn: 2, alongCut: 1 });
  });

  it('treats missing cutHatchKind as alongCut for legacy payloads', () => {
    expect(summarizeWallCutHatchKinds([{}, { cutHatchKind: 'edgeOn' }])).toEqual({
      edgeOn: 1,
      alongCut: 1,
    });
  });

  it('formats elevation span metres with two decimals', () => {
    expect(formatSectionElevationSpanMmLabel(0, 3200)).toBe('Δz 3.20 m');
    expect(formatSectionElevationSpanMmLabel(300, 9700)).toBe('Δz 9.40 m');
  });

  it('uses absolute separation when min and max reversed', () => {
    expect(formatSectionElevationSpanMmLabel(9700, 300)).toBe('Δz 9.40 m');
  });

  it('formats along-cut span metres with two decimals', () => {
    expect(formatSectionAlongCutSpanMmLabel(0, 7000)).toBe('Δu 7.00 m');
    expect(formatSectionAlongCutSpanMmLabel(1000, 8000)).toBe('Δu 7.00 m');
  });

  it('uses absolute u separation when min and max reversed', () => {
    expect(formatSectionAlongCutSpanMmLabel(9700, 300)).toBe('Δu 9.40 m');
  });

  it('formats callout rows sorted by id with name when distinct from id', () => {
    expect(
      formatSectionSheetCalloutsLabel([
        { id: 'z-co', name: 'Zeta' },
        { id: 'a-co', name: 'Alpha' },
      ]),
    ).toBe('Callouts · Alpha (a-co), Zeta (z-co)');
  });

  it('uses id-only token when name matches id', () => {
    expect(formatSectionSheetCalloutsLabel([{ id: 'co-1', name: 'co-1' }])).toBe('Callouts · co-1');
  });

  it('formats material doc hint captions from server fields', () => {
    expect(
      formatSectionDocMaterialHintCaption({
        materialLabel: 'Concrete structure',
        cutPatternHint: 'edgeOn',
      }),
    ).toBe('Concrete structure · edge-on');
    expect(
      formatSectionDocMaterialHintCaption({
        materialLabel: 'structure',
        cutPatternHint: 'alongCut',
      }),
    ).toBe('structure · along-cut');
  });
});
