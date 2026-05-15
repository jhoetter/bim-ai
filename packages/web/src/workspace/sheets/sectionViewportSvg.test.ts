import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import {
  formatSectionAlongCutSpanMmLabel,
  formatSectionCutIdentityLine,
  formatSectionCutPlaneContext,
  formatSectionDocMaterialHintCaption,
  formatSectionElevationSpanMmLabel,
  formatSectionLevelDatumCaption,
  formatSectionSheetCalloutsLabel,
  formatSectionStairDocumentationCaption,
  formatSectionWallHatchReadout,
  summarizeWallCutHatchKinds,
} from './sectionViewportDoc';
import { sectionLensPrimitiveStyle } from './sectionViewportSvg';

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
        materialCutPatternId: 'concrete',
        cutPatternHint: 'edgeOn',
      }),
    ).toBe('Concrete structure · cut concrete · edge-on');
    expect(
      formatSectionDocMaterialHintCaption({
        materialLabel: 'structure',
        cutPatternHint: 'alongCut',
      }),
    ).toBe('structure · along-cut');
  });

  it('formats wall hatch readout', () => {
    expect(formatSectionWallHatchReadout({ edgeOn: 0, alongCut: 0 })).toBe('Wall hatch · none');
    expect(formatSectionWallHatchReadout({ edgeOn: 2, alongCut: 1 })).toBe(
      'Wall hatch · edge-on 2 · along-cut 1',
    );
  });

  it('formats section cut identity line', () => {
    expect(formatSectionCutIdentityLine({ name: 'A', id: 'sc-1' })).toBe('Section · A · sc-1');
  });

  it('formats level datum captions for empty vs out-of-span markers', () => {
    expect(formatSectionLevelDatumCaption({ inViewCount: 0, totalFromServer: 0 })).toBe(
      'Level datums: none in snapshot',
    );
    expect(formatSectionLevelDatumCaption({ inViewCount: 0, totalFromServer: 3 })).toBe(
      'Level datums: markers outside current z-span',
    );
    expect(formatSectionLevelDatumCaption({ inViewCount: 2, totalFromServer: 3 })).toBe('');
  });

  it('formats stair documentation caption from section stair primitives', () => {
    expect(
      formatSectionStairDocumentationCaption([
        {
          elementId: 'st-b',
          riserCountPlanProxy: 16,
          treadCountPlanProxy: 15,
          storyRiseMm: 2800,
          planUpDownLabel: 'UP',
        },
        {
          elementId: 'st-a',
          riserCountPlanProxy: 10,
          treadCountPlanProxy: 9,
          storyRiseMm: 1600,
          planUpDownLabel: 'UP',
        },
      ]),
    ).toBe('Stair doc · st-a R=10 T=9 rise=1600mm UP · st-b R=16 T=15 rise=2800mm UP');
  });

  it('prefers stairPlanSectionDocumentationLabel in section stair caption when present', () => {
    expect(
      formatSectionStairDocumentationCaption([
        {
          elementId: 's1',
          riserCountPlanProxy: 20,
          treadCountPlanProxy: 19,
          storyRiseMm: 3200,
          planUpDownLabel: 'UP',
          stairPlanSectionDocumentationLabel: 'UP·R20·T19·W1100',
        },
      ]),
    ).toBe('Stair doc · s1 UP·R20·T19·W1100');
  });

  it('formats cut plane context with run and 8-way view heading', () => {
    expect(
      formatSectionCutPlaneContext({
        lineStartMm: { xMm: 0, yMm: 0 },
        lineEndMm: { xMm: 0, yMm: 0 },
      }),
    ).toBe('Cut line 0 mm · view toward —');
    expect(
      formatSectionCutPlaneContext({
        lineStartMm: { xMm: 0, yMm: 0 },
        lineEndMm: { xMm: 3000, yMm: 0 },
      }),
    ).toBe('Cut line 3000 mm · view toward N');
    expect(
      formatSectionCutPlaneContext({
        lineStartMm: { xMm: 0, yMm: 0 },
        lineEndMm: { xMm: 0, yMm: 3000 },
      }),
    ).toBe('Cut line 3000 mm · view toward W');
  });
});

describe('section lens primitive styling', () => {
  it('ghosts non-structural section primitives in Structure lens', () => {
    const wall = {
      kind: 'wall',
      id: 'w1',
      name: 'Partition',
      discipline: 'arch',
    } as Element;

    expect(sectionLensPrimitiveStyle('structure', wall, 'wall')).toMatchObject({
      pass: 'ghost',
      opacity: 0.2,
    });
  });

  it('adds Energy lens U-value badges for section cut elements', () => {
    const wall = {
      kind: 'wall',
      id: 'w2',
      name: 'Exterior wall',
      props: { uValueWPerM2K: 0.24 },
    } as unknown as Element;

    expect(sectionLensPrimitiveStyle('energy', wall, 'wall')).toMatchObject({
      pass: 'foreground',
      stroke: '#d97706',
      badge: 'U 0.24',
    });
  });
});
