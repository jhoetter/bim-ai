import { describe, expect, it } from 'vitest';

import { autoDimensionWalls } from './autoDimensionWalls';

describe('autoDimensionWalls wiring — §4.1', () => {
  it('returns empty array for no walls', () => {
    const result = autoDimensionWalls([]);
    expect(result).toHaveLength(0);
  });

  it('generates a dimension for one horizontal wall', () => {
    const wall: any = {
      kind: 'wall',
      id: 'w1',
      levelId: 'L1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 5000, yMm: 0 },
    };
    const dims = autoDimensionWalls([wall]);
    expect(dims.length).toBeGreaterThan(0);
    expect(dims[0]!.kind).toBe('permanent_dimension');
  });

  it('generates a dimension for one vertical wall', () => {
    const wall: any = {
      kind: 'wall',
      id: 'w2',
      levelId: 'L1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 0, yMm: 4000 },
    };
    const dims = autoDimensionWalls([wall]);
    expect(dims.length).toBeGreaterThan(0);
  });

  it('uses offsetMm parameter', () => {
    const wall: any = {
      kind: 'wall',
      id: 'w3',
      levelId: 'L1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 5000, yMm: 0 },
    };
    const dims = autoDimensionWalls([wall], 2000);
    expect(dims[0]!.offsetMm.yMm).toBe(-2000);
  });

  it('generated dimensions have valid witnessPointsMm', () => {
    const wall: any = {
      kind: 'wall',
      id: 'w4',
      levelId: 'L1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 5000, yMm: 0 },
    };
    const dims = autoDimensionWalls([wall]);
    for (const dim of dims) {
      expect(dim.witnessPointsMm.length).toBeGreaterThanOrEqual(2);
    }
  });
});
