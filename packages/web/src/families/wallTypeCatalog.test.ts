import { describe, expect, it } from 'vitest';

import {
  BUILT_IN_WALL_TYPES,
  getBuiltInWallType,
  totalThicknessMm,
  visibleLayerCount,
} from './wallTypeCatalog';

describe('BUILT_IN_WALL_TYPES — FL-08', () => {
  it('contains the four spec entries', () => {
    expect(BUILT_IN_WALL_TYPES.map((w) => w.id).sort()).toEqual([
      'wall.ext-masonry',
      'wall.ext-timber',
      'wall.int-blockwork',
      'wall.int-partition',
    ]);
  });

  it.each([
    ['wall.ext-timber', 198.5],
    ['wall.ext-masonry', 290],
    ['wall.int-partition', 114],
    ['wall.int-blockwork', 126],
  ])('total thickness for %s matches spec', (id, expectedMm) => {
    const w = getBuiltInWallType(id);
    expect(w).toBeDefined();
    if (!w) return;
    expect(totalThicknessMm(w)).toBeCloseTo(expectedMm, 3);
  });

  it('ext-timber has 5 layers including the air gap', () => {
    const w = getBuiltInWallType('wall.ext-timber')!;
    expect(w.layers.length).toBe(5);
    expect(visibleLayerCount(w)).toBe(4);
    expect(w.layers.find((l) => l.function === 'air')).toBeDefined();
  });

  it('the exterior-most finish layer is flagged exterior on the external assemblies', () => {
    const t = getBuiltInWallType('wall.ext-timber')!;
    expect(t.layers[0]?.exterior).toBe(true);
    const m = getBuiltInWallType('wall.ext-masonry')!;
    expect(m.layers[0]?.exterior).toBe(true);
  });
});
