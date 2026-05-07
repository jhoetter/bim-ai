import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { tempDimensionsFor, wallNeighbours, wallTempDimensions, type Wall } from './tempDimensions';

const SOURCE: Wall = {
  kind: 'wall',
  id: 'src',
  name: 'Wall',
  levelId: 'L1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 4000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 2700,
};

function wall(id: string, sx: number, sy: number, ex: number, ey: number, levelId = 'L1'): Wall {
  return {
    kind: 'wall',
    id,
    name: id,
    levelId,
    start: { xMm: sx, yMm: sy },
    end: { xMm: ex, yMm: ey },
    thicknessMm: 200,
    heightMm: 2700,
  };
}

describe('EDT-01 — wallNeighbours direction detection', () => {
  it('detects neighbours in each cardinal direction relative to source midpoint', () => {
    // Source midpoint: (2000, 0).
    const elements: Record<string, Element> = {
      src: SOURCE,
      r: wall('r', 6000, -100, 6000, 100), // right (mid 6000,0)
      l: wall('l', -3000, -100, -3000, 100), // left (mid -3000,0)
      below: wall('below', 1000, 5000, 3000, 5000), // mid 2000,5000 — below (yMm > ref)
      above: wall('above', 1000, -3000, 3000, -3000), // mid 2000,-3000 — above
    };
    const n = wallNeighbours(SOURCE, elements);
    expect(n.right?.wall.id).toBe('r');
    expect(n.left?.wall.id).toBe('l');
    expect(n.above?.wall.id).toBe('above');
    expect(n.below?.wall.id).toBe('below');
  });

  it('chooses the closest neighbour when multiple lie in the same direction', () => {
    const elements: Record<string, Element> = {
      src: SOURCE,
      far: wall('far', 9000, -100, 9000, 100),
      near: wall('near', 5000, -100, 5000, 100),
    };
    const n = wallNeighbours(SOURCE, elements);
    expect(n.right?.wall.id).toBe('near');
  });

  it('skips walls on a different level when levelId is set', () => {
    const elements: Record<string, Element> = {
      src: SOURCE,
      l2: wall('l2', 6000, -100, 6000, 100, 'L2'),
    };
    const n = wallNeighbours(SOURCE, elements, { levelId: 'L1' });
    expect(n.right).toBeUndefined();
  });

  it('respects maxDistanceMm', () => {
    const elements: Record<string, Element> = {
      src: SOURCE,
      r: wall('r', 99000, -100, 99000, 100),
    };
    const n = wallNeighbours(SOURCE, elements, { maxDistanceMm: 10000 });
    expect(n.right).toBeUndefined();
  });

  it('skips the source wall itself', () => {
    const n = wallNeighbours(SOURCE, { src: SOURCE });
    expect(n.left).toBeUndefined();
    expect(n.right).toBeUndefined();
    expect(n.above).toBeUndefined();
    expect(n.below).toBeUndefined();
  });
});

describe('EDT-01 — wallTempDimensions targets', () => {
  it('emits one target per direction with correct from/to/direction', () => {
    const elements: Record<string, Element> = {
      src: SOURCE,
      r: wall('r', 6000, -100, 6000, 100),
      l: wall('l', -3000, -100, -3000, 100),
    };
    const targets = wallTempDimensions(SOURCE, elements);
    expect(targets).toHaveLength(2);
    const right = targets.find((t) => t.id.endsWith(':right'))!;
    expect(right.direction).toBe('x');
    expect(right.fromMm).toEqual({ xMm: 2000, yMm: 0 });
    expect(right.toMm).toEqual({ xMm: 6000, yMm: 0 });
    expect(right.distanceMm).toBe(4000);
  });

  it('onClick produces a createDimension command anchored at the active level', () => {
    const elements: Record<string, Element> = {
      src: SOURCE,
      r: wall('r', 6000, -100, 6000, 100),
    };
    const [target] = wallTempDimensions(SOURCE, elements);
    const cmd = target!.onClick();
    expect(cmd).toMatchObject({
      type: 'createDimension',
      levelId: 'L1',
      aMm: { xMm: 2000, yMm: 0 },
      bMm: { xMm: 6000, yMm: 0 },
    });
  });

  it('onLockToggle returns the EDT-02 placeholder marker (no-op)', () => {
    const elements: Record<string, Element> = {
      src: SOURCE,
      r: wall('r', 6000, -100, 6000, 100),
    };
    const [target] = wallTempDimensions(SOURCE, elements);
    const cmd = target!.onLockToggle();
    expect(cmd).toMatchObject({ type: 'tempDimLockToggleNoop' });
  });
});

describe('EDT-01 — tempDimensionsFor dispatch', () => {
  it('returns wall targets for a wall', () => {
    const elements: Record<string, Element> = {
      src: SOURCE,
      r: wall('r', 6000, -100, 6000, 100),
    };
    const targets = tempDimensionsFor(SOURCE, elements);
    expect(targets.length).toBeGreaterThan(0);
  });

  it('returns empty for kinds not yet wired', () => {
    const door: Element = {
      kind: 'door',
      id: 'd',
      name: 'd',
      wallId: 'src',
      alongT: 0.5,
      widthMm: 900,
    };
    expect(tempDimensionsFor(door, {})).toEqual([]);
  });
});
