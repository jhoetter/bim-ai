import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { buildLevelAreaReport } from './scheduleLevelDatumEvidenceReadout';

function makeFloor(
  id: string,
  levelId: string,
  boundary: { xMm: number; yMm: number }[],
): Extract<Element, { kind: 'floor' }> {
  return { kind: 'floor', id, name: id, levelId, boundaryMm: boundary, thicknessMm: 200 };
}

function makeLevel(
  id: string,
  name: string,
  elevationMm: number,
): Extract<Element, { kind: 'level' }> {
  return { kind: 'level', id, name, elevationMm };
}

function makeColumn(
  id: string,
  levelId: string,
  xMm: number,
  yMm: number,
  bMm: number,
  hMm: number,
): Extract<Element, { kind: 'column' }> {
  return {
    kind: 'column',
    id,
    name: id,
    levelId,
    positionMm: { xMm, yMm },
    bMm,
    hMm,
    heightMm: 3000,
  };
}

const SQUARE_10M = [
  { xMm: 0, yMm: 0 },
  { xMm: 10000, yMm: 0 },
  { xMm: 10000, yMm: 10000 },
  { xMm: 0, yMm: 10000 },
];

describe('buildLevelAreaReport', () => {
  it('returns [] for empty project', () => {
    expect(buildLevelAreaReport({})).toEqual([]);
  });

  it('computes grossAreaM2 for two floors on different levels', () => {
    const elementsById: Record<string, Element> = {
      lv1: makeLevel('lv1', 'Level 1', 0),
      lv2: makeLevel('lv2', 'Level 2', 3000),
      f1: makeFloor('f1', 'lv1', SQUARE_10M),
      f2: makeFloor('f2', 'lv2', [
        { xMm: 0, yMm: 0 },
        { xMm: 8000, yMm: 0 },
        { xMm: 8000, yMm: 8000 },
        { xMm: 0, yMm: 8000 },
      ]),
    };
    const rows = buildLevelAreaReport(elementsById);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.levelId).toBe('lv1');
    expect(rows[0]!.grossAreaM2).toBeCloseTo(100, 1);
    expect(rows[1]!.levelId).toBe('lv2');
    expect(rows[1]!.grossAreaM2).toBeCloseTo(64, 1);
  });

  it('subtracts column footprint when column center is inside floor boundary', () => {
    const colB = 400;
    const colH = 400;
    const elementsById: Record<string, Element> = {
      lv1: makeLevel('lv1', 'Level 1', 0),
      f1: makeFloor('f1', 'lv1', SQUARE_10M),
      c1: makeColumn('c1', 'lv1', 5000, 5000, colB, colH),
    };
    const rows = buildLevelAreaReport(elementsById);
    expect(rows).toHaveLength(1);
    const grossM2 = 100;
    const colM2 = (colB / 1000) * (colH / 1000);
    expect(rows[0]!.grossAreaM2).toBeCloseTo(grossM2, 1);
    expect(rows[0]!.netAreaM2).toBeCloseTo(grossM2 - colM2, 2);
    expect(rows[0]!.netAreaM2).toBeLessThan(rows[0]!.grossAreaM2);
  });

  it('sorts rows ascending by level name when elevations are equal', () => {
    const smallSquare = [
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
      { xMm: 1000, yMm: 1000 },
      { xMm: 0, yMm: 1000 },
    ];
    const elementsById: Record<string, Element> = {
      lv_b: makeLevel('lv_b', 'B Level', 0),
      lv_a: makeLevel('lv_a', 'A Level', 0),
      f1: makeFloor('f1', 'lv_a', smallSquare),
      f2: makeFloor('f2', 'lv_b', smallSquare),
    };
    const rows = buildLevelAreaReport(elementsById);
    expect(rows[0]!.levelName).toBe('A Level');
    expect(rows[1]!.levelName).toBe('B Level');
  });
});
