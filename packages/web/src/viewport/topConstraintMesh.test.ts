import { describe, expect, it } from 'vitest';
import { wallVerticalSpanM } from './meshBuilders';
import type { Element } from '@bim-ai/core';

type WallElem = Extract<Element, { kind: 'wall' }>;
type LevelElem = Extract<Element, { kind: 'level' }>;

function makeWall(overrides?: Partial<WallElem>): WallElem {
  return {
    kind: 'wall',
    id: 'w1',
    name: 'Wall 1',
    start: { xMm: 0, yMm: 0 },
    end: { xMm: 5000, yMm: 0 },
    heightMm: 3000,
    thicknessMm: 200,
    levelId: 'lvl-ground',
    ...overrides,
  } as WallElem;
}

function makeLevel(id: string, elevationMm: number): LevelElem {
  return { kind: 'level', id, name: id, elevationMm } as LevelElem;
}

describe('top constraint height resolution — §2.6.2', () => {
  it('wall with topConstraintLevelId uses level elevation as mesh height', () => {
    const wall = makeWall({ topConstraintLevelId: 'lvl-upper' });
    const eb = { 'lvl-upper': makeLevel('lvl-upper', 4000) } as Record<string, Element>;
    const { height } = wallVerticalSpanM(wall, 0, eb);
    // level at 4 m above base at 0 m → height 4 m
    expect(height).toBeCloseTo(4.0);
  });

  it('wall with topConstraintOffsetMm adds offset to level elevation', () => {
    const wall = makeWall({ topConstraintLevelId: 'lvl-upper', topConstraintOffsetMm: 500 });
    const eb = { 'lvl-upper': makeLevel('lvl-upper', 4000) } as Record<string, Element>;
    const { height } = wallVerticalSpanM(wall, 0, eb);
    // level 4 m + offset 0.5 m = 4.5 m
    expect(height).toBeCloseTo(4.5);
  });

  it('topConstraintLevelId=null falls back to wall heightMm', () => {
    const wall = makeWall({ topConstraintLevelId: null, heightMm: 3000 });
    const { height } = wallVerticalSpanM(wall, 0, {});
    expect(height).toBeCloseTo(3.0);
  });

  it('level below wall base is ignored (fallback to heightMm)', () => {
    // Wall base sits at elevM=3 m; level is at 1000 mm (1 m) — below base
    const wall = makeWall({ topConstraintLevelId: 'lvl-low', heightMm: 3000 });
    const eb = { 'lvl-low': makeLevel('lvl-low', 1000) } as Record<string, Element>;
    const { height } = wallVerticalSpanM(wall, 3, eb);
    // raw height = 1 m - 3 m = -2 m (below base) → fall back to heightMm = 3 m
    expect(height).toBeCloseTo(3.0);
  });
});
