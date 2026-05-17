import { describe, expect, it } from 'vitest';
import { buildShaftSideWalls } from './buildShaftSideWalls';

const wideShaft: any = {
  id: 's1',
  kind: 'shaft',
  baseLevelId: 'L1',
  topLevelId: 'L2',
  perimeterMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 6000, yMm: 0 },
    { xMm: 6000, yMm: 2000 },
    { xMm: 0, yMm: 2000 },
  ],
};

const tallShaft: any = {
  id: 's2',
  kind: 'shaft',
  baseLevelId: 'L1',
  topLevelId: 'L2',
  perimeterMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 2000, yMm: 0 },
    { xMm: 2000, yMm: 6000 },
    { xMm: 0, yMm: 6000 },
  ],
};

describe('buildShaftSideWalls — §2.5.1', () => {
  it('returns empty array for shaft with no perimeter', () => {
    const shaft: any = { id: 's0', kind: 'shaft', perimeterMm: [] };
    expect(buildShaftSideWalls(shaft, 'L1')).toHaveLength(0);
  });

  it('generates 2 walls for a valid shaft', () => {
    const walls = buildShaftSideWalls(wideShaft, 'L1');
    expect(walls).toHaveLength(2);
  });

  it('generated walls have kind wall', () => {
    const walls = buildShaftSideWalls(wideShaft, 'L1');
    expect(walls.every((w) => w.kind === 'wall')).toBe(true);
  });

  it('walls use the provided levelId', () => {
    const walls = buildShaftSideWalls(wideShaft, 'L2');
    expect(walls.every((w) => (w as any).levelId === 'L2')).toBe(true);
  });

  it('wide shaft generates walls along Y axis (top/bottom sides)', () => {
    const walls = buildShaftSideWalls(wideShaft, 'L1');
    // Both walls should span x from 0 to 6000
    expect(walls.some((w) => (w as any).startMm?.xMm === 0 && (w as any).endMm?.xMm === 6000)).toBe(
      true,
    );
  });

  it('tall shaft generates walls along X axis (left/right sides)', () => {
    const walls = buildShaftSideWalls(tallShaft, 'L1');
    // Both walls should span y from 0 to 6000
    expect(walls.some((w) => (w as any).startMm?.yMm === 0 && (w as any).endMm?.yMm === 6000)).toBe(
      true,
    );
  });
});
