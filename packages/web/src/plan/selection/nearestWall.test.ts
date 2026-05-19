import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import { nearestWallAt } from './nearestWall';

function wall(
  id: string,
  levelId: string,
  start: { xMm: number; yMm: number },
  end: { xMm: number; yMm: number },
): Extract<Element, { kind: 'wall' }> {
  return {
    id,
    kind: 'wall',
    name: id,
    levelId,
    start,
    end,
    baseOffsetMm: 0,
    heightMm: 3000,
    thicknessMm: 200,
    structural: false,
  } as Extract<Element, { kind: 'wall' }>;
}

describe('nearestWallAt', () => {
  it('returns the nearest wall with projected along-wall position', () => {
    const elementsById: Record<string, Element> = {
      close: wall('close', 'level-1', { xMm: 0, yMm: 0 }, { xMm: 10000, yMm: 0 }),
      far: wall('far', 'level-1', { xMm: 0, yMm: 5000 }, { xMm: 10000, yMm: 5000 }),
    };

    const hit = nearestWallAt(elementsById, 'level-1', 2500, 120);

    expect(hit?.wall.id).toBe('close');
    expect(hit?.alongT).toBeCloseTo(0.25);
    expect(hit?.distMm).toBeCloseTo(120);
  });

  it('filters walls by active level', () => {
    const elementsById: Record<string, Element> = {
      level1: wall('level1', 'level-1', { xMm: 0, yMm: 0 }, { xMm: 10000, yMm: 0 }),
      level2: wall('level2', 'level-2', { xMm: 0, yMm: 100 }, { xMm: 10000, yMm: 100 }),
    };

    const hit = nearestWallAt(elementsById, 'level-2', 2500, 0);

    expect(hit?.wall.id).toBe('level2');
  });
});
