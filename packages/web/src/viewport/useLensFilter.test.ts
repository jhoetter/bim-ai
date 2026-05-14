import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import { lensFilterFromMode, resolveLensFilter } from './useLensFilter';

const baseWall: Extract<Element, { kind: 'wall' }> = {
  kind: 'wall',
  id: 'wall-1',
  name: 'Wall',
  levelId: 'level-1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 4000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 2800,
  discipline: 'arch',
};

describe('Structure lens filtering', () => {
  it('foregrounds load-bearing shared architectural walls', () => {
    const filter = lensFilterFromMode('structure');
    expect(filter({ ...baseWall, loadBearing: true })).toBe('foreground');
    expect(filter({ ...baseWall, structuralRole: 'shear_wall' })).toBe('foreground');
    expect(filter(baseWall)).toBe('ghost');
  });

  it('foregrounds structural slabs and datum helpers for saved structure views', () => {
    const filter = resolveLensFilter({ defaultLens: 'show_struct' });
    const floor: Extract<Element, { kind: 'floor' }> = {
      kind: 'floor',
      id: 'floor-1',
      name: 'Floor',
      levelId: 'level-1',
      boundaryMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 4000, yMm: 0 },
        { xMm: 4000, yMm: 4000 },
      ],
      thicknessMm: 220,
      structuralRole: 'slab',
      discipline: 'arch',
    };
    const grid: Extract<Element, { kind: 'grid_line' }> = {
      kind: 'grid_line',
      id: 'grid-a',
      name: 'Grid A',
      label: 'A',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 4000, yMm: 0 },
    };
    expect(filter(floor)).toBe('foreground');
    expect(filter(grid)).toBe('foreground');
  });
});
