import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';
import { buildShaftSideWalls } from './buildShaftSideWalls';

type ShaftFixture = Extract<Element, { kind: 'shaft' }> & {
  perimeterMm?: Array<{ xMm: number; yMm: number }>;
};
type ShaftSideWallOutput = ReturnType<typeof buildShaftSideWalls>[number] & {
  startMm?: { xMm: number; yMm: number };
  endMm?: { xMm: number; yMm: number };
};

const wideShaft: ShaftFixture = {
  id: 's1',
  kind: 'shaft',
  baseLevelId: 'L1',
  topLevelId: 'L2',
  boundaryMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 6000, yMm: 0 },
    { xMm: 6000, yMm: 2000 },
    { xMm: 0, yMm: 2000 },
  ],
};

const tallShaft: ShaftFixture = {
  id: 's2',
  kind: 'shaft',
  baseLevelId: 'L1',
  topLevelId: 'L2',
  boundaryMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 2000, yMm: 0 },
    { xMm: 2000, yMm: 6000 },
    { xMm: 0, yMm: 6000 },
  ],
};

describe('buildShaftSideWalls — §2.5.1', () => {
  it('returns empty array for shaft with no perimeter', () => {
    const shaft = { id: 's0', kind: 'shaft', boundaryMm: [] } as unknown as ShaftFixture;
    expect(buildShaftSideWalls(shaft, 'L1')).toHaveLength(0);
  });

  it('generates 2 walls for a valid shaft', () => {
    const walls = buildShaftSideWalls(wideShaft, 'L1') as ShaftSideWallOutput[];
    expect(walls).toHaveLength(2);
  });

  it('generated walls have kind wall', () => {
    const walls = buildShaftSideWalls(wideShaft, 'L1') as ShaftSideWallOutput[];
    expect(walls.every((w) => w.kind === 'wall')).toBe(true);
  });

  it('walls use the provided levelId', () => {
    const walls = buildShaftSideWalls(wideShaft, 'L2');
    expect(walls.every((w) => w.levelId === 'L2')).toBe(true);
  });

  it('wide shaft generates walls along Y axis (top/bottom sides)', () => {
    const walls = buildShaftSideWalls(wideShaft, 'L1') as ShaftSideWallOutput[];
    // Both walls should span x from 0 to 6000
    expect(walls.some((w) => w.startMm?.xMm === 0 && w.endMm?.xMm === 6000)).toBe(true);
  });

  it('tall shaft generates walls along X axis (left/right sides)', () => {
    const walls = buildShaftSideWalls(tallShaft, 'L1') as ShaftSideWallOutput[];
    // Both walls should span y from 0 to 6000
    expect(walls.some((w) => w.startMm?.yMm === 0 && w.endMm?.yMm === 6000)).toBe(true);
  });
});
