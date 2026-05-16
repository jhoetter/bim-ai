import { describe, expect, it } from 'vitest';
import { detectCeilingBoundary } from './ceilingAutoDetect';
import type { Element } from '@bim-ai/core';

type WallElem = Extract<Element, { kind: 'wall' }>;

function makeWall(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  levelId = 'lvl-1',
): WallElem {
  return {
    kind: 'wall',
    id: `wall-${Math.random()}`,
    name: 'Wall',
    levelId,
    start: { xMm: startX, yMm: startY },
    end: { xMm: endX, yMm: endY },
    thicknessMm: 200,
    heightMm: 2800,
  } as WallElem;
}

/** A simple 6000×6000 box made of 4 walls. */
function makeBoxWalls(levelId = 'lvl-1'): WallElem[] {
  return [
    makeWall(0, 0, 6000, 0, levelId),
    makeWall(6000, 0, 6000, 6000, levelId),
    makeWall(6000, 6000, 0, 6000, levelId),
    makeWall(0, 6000, 0, 0, levelId),
  ];
}

describe('ceilingAutoDetect — §8.2', () => {
  it('returns null when no walls exist on the level', () => {
    const result = detectCeilingBoundary({ xMm: 3000, yMm: 3000 }, [], 'lvl-1');
    expect(result).toBeNull();
  });

  it('returns null when no walls enclose the click point', () => {
    const walls = makeBoxWalls('lvl-1');
    // Click outside the bounding box
    const result = detectCeilingBoundary({ xMm: 10000, yMm: 10000 }, walls, 'lvl-1');
    expect(result).toBeNull();
  });

  it('returns a boundary polygon when walls enclose the click point', () => {
    const walls = makeBoxWalls('lvl-1');
    const result = detectCeilingBoundary({ xMm: 3000, yMm: 3000 }, walls, 'lvl-1');
    expect(result).not.toBeNull();
    expect(result!.length).toBe(4);
  });

  it('returned polygon vertices span the wall AABB', () => {
    const walls = makeBoxWalls('lvl-1');
    const result = detectCeilingBoundary({ xMm: 3000, yMm: 3000 }, walls, 'lvl-1')!;
    const xs = result.map((p) => p.xMm);
    const ys = result.map((p) => p.yMm);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(6000);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(6000);
  });

  it('filters walls by levelId', () => {
    const lvl1Walls = makeBoxWalls('lvl-1');
    const lvl2Walls = makeBoxWalls('lvl-2');
    const all = [...lvl1Walls, ...lvl2Walls];

    // Click inside the lvl-1 box but ask for lvl-2 boundary
    const r1 = detectCeilingBoundary({ xMm: 3000, yMm: 3000 }, all, 'lvl-1');
    expect(r1).not.toBeNull();

    // Ask for a level with no walls
    const r2 = detectCeilingBoundary({ xMm: 3000, yMm: 3000 }, all, 'lvl-99');
    expect(r2).toBeNull();
  });
});
