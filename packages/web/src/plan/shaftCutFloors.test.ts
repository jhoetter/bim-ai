import { describe, it, expect } from 'vitest';
import { computeShaftCutFloors, pointInPolygon } from './shaftCutFloors';
import type { Element } from '@bim-ai/core';

// Helper to build a minimal ShaftElement
function makeShaft(
  boundary: { xMm: number; yMm: number }[],
  baseLevelId: string,
  topLevelId: string,
): Extract<Element, { kind: 'shaft' }> {
  return {
    kind: 'shaft',
    id: 'shaft-1',
    boundaryMm: boundary,
    baseLevelId,
    topLevelId,
  };
}

// A square shaft from (0,0) to (10000,10000) mm
const SQUARE_SHAFT = makeShaft(
  [
    { xMm: 0, yMm: 0 },
    { xMm: 10000, yMm: 0 },
    { xMm: 10000, yMm: 10000 },
    { xMm: 0, yMm: 10000 },
  ],
  'level-0',
  'level-2',
);

// A floor element whose centroid is inside the shaft
function makeFloor(id: string, levelId: string, boundary: { xMm: number; yMm: number }[]): Element {
  return {
    kind: 'floor',
    id,
    levelId,
    boundaryMm: boundary,
    thicknessMm: 200,
    structureThicknessMm: 150,
    finishThicknessMm: 50,
    roomBounded: true,
  } as unknown as Element;
}

const FLOOR_INSIDE = makeFloor('floor-inside', 'level-1', [
  { xMm: 1000, yMm: 1000 },
  { xMm: 5000, yMm: 1000 },
  { xMm: 5000, yMm: 5000 },
  { xMm: 1000, yMm: 5000 },
]);

const FLOOR_OUTSIDE = makeFloor('floor-outside', 'level-1', [
  { xMm: 20000, yMm: 20000 },
  { xMm: 25000, yMm: 20000 },
  { xMm: 25000, yMm: 25000 },
  { xMm: 20000, yMm: 25000 },
]);

function makeLevel(id: string, elevationMm: number): Element {
  return {
    kind: 'level',
    id,
    name: id,
    elevationMm,
  } as unknown as Element;
}

const LEVEL_0 = makeLevel('level-0', 0);
const LEVEL_1 = makeLevel('level-1', 3000);
const LEVEL_2 = makeLevel('level-2', 6000);
const LEVEL_3 = makeLevel('level-3', 9000);

describe('computeShaftCutFloors — §2.5.1', () => {
  it('returns empty array when no floors exist', () => {
    const elementsById: Record<string, Element | undefined> = {
      'level-0': LEVEL_0,
      'level-1': LEVEL_1,
      'level-2': LEVEL_2,
    };
    const result = computeShaftCutFloors(SQUARE_SHAFT, elementsById);
    expect(result).toEqual([]);
  });

  it('returns floor IDs that are within vertical extent', () => {
    const elementsById: Record<string, Element | undefined> = {
      'level-0': LEVEL_0,
      'level-1': LEVEL_1,
      'level-2': LEVEL_2,
      'floor-inside': FLOOR_INSIDE,
    };
    const result = computeShaftCutFloors(SQUARE_SHAFT, elementsById);
    expect(result).toContain('floor-inside');
  });

  it('excludes floors outside vertical extent', () => {
    const floorAbove = makeFloor('floor-above', 'level-3', [
      { xMm: 1000, yMm: 1000 },
      { xMm: 5000, yMm: 1000 },
      { xMm: 5000, yMm: 5000 },
      { xMm: 1000, yMm: 5000 },
    ]);
    const elementsById: Record<string, Element | undefined> = {
      'level-0': LEVEL_0,
      'level-1': LEVEL_1,
      'level-2': LEVEL_2,
      'level-3': LEVEL_3,
      'floor-above': floorAbove,
    };
    const result = computeShaftCutFloors(SQUARE_SHAFT, elementsById);
    expect(result).not.toContain('floor-above');
  });

  it('excludes floors whose centroid is outside the shaft perimeter', () => {
    const elementsById: Record<string, Element | undefined> = {
      'level-0': LEVEL_0,
      'level-1': LEVEL_1,
      'level-2': LEVEL_2,
      'floor-outside': FLOOR_OUTSIDE,
    };
    const result = computeShaftCutFloors(SQUARE_SHAFT, elementsById);
    expect(result).not.toContain('floor-outside');
  });

  it('returns empty array for shaft with no perimeter', () => {
    const emptyShaft = makeShaft([], 'level-0', 'level-2');
    const elementsById: Record<string, Element | undefined> = {
      'level-0': LEVEL_0,
      'level-1': LEVEL_1,
      'level-2': LEVEL_2,
      'floor-inside': FLOOR_INSIDE,
    };
    const result = computeShaftCutFloors(emptyShaft, elementsById);
    expect(result).toEqual([]);
  });
});

describe('pointInPolygon — §2.5.1', () => {
  const square = [
    { xMm: 0, yMm: 0 },
    { xMm: 1000, yMm: 0 },
    { xMm: 1000, yMm: 1000 },
    { xMm: 0, yMm: 1000 },
  ];

  it('returns true for point inside square', () => {
    expect(pointInPolygon({ xMm: 500, yMm: 500 }, square)).toBe(true);
  });

  it('returns false for point outside square', () => {
    expect(pointInPolygon({ xMm: 2000, yMm: 2000 }, square)).toBe(false);
  });
});
