import { describe, it, expect } from 'vitest';
import { splitToposolid } from './terrainSplit';
import type { Element } from '@bim-ai/core';

type ToposolidEl = Extract<Element, { kind: 'toposolid' }>;

function makeTopo(overrides?: Partial<ToposolidEl>): ToposolidEl {
  return {
    kind: 'toposolid',
    id: 'topo-1',
    perimeterMm: [
      { xMm: 0, yMm: 0 },
      { xMm: 10000, yMm: 0 },
      { xMm: 10000, yMm: 10000 },
      { xMm: 0, yMm: 10000 },
    ],
    heightSamples: [
      { xMm: 1000, yMm: 1000, zMm: 0 },
      { xMm: 1000, yMm: 9000, zMm: 100 },
      { xMm: 9000, yMm: 1000, zMm: 200 },
      { xMm: 9000, yMm: 9000, zMm: 300 },
    ],
    thicknessMm: 300,
    ...overrides,
  } as ToposolidEl;
}

// Vertical split line at x=5000 (separates left from right)
const splitLine = [
  { xMm: 5000, yMm: -1000 },
  { xMm: 5000, yMm: 11000 },
];

describe('splitToposolid — §5.1.6', () => {
  it('returns two toposolids', () => {
    const topo = makeTopo();
    const result = splitToposolid(topo, splitLine);
    expect(result).toHaveLength(2);
    expect(result[0].kind).toBe('toposolid');
    expect(result[1].kind).toBe('toposolid');
  });

  it('combined sample count equals original', () => {
    const topo = makeTopo();
    const [left, right] = splitToposolid(topo, splitLine);
    const total = (left.heightSamples?.length ?? 0) + (right.heightSamples?.length ?? 0);
    expect(total).toBe(topo.heightSamples!.length);
  });

  it('each result has a new unique ID', () => {
    const topo = makeTopo();
    const [left, right] = splitToposolid(topo, splitLine);
    expect(left.id).not.toBe(topo.id);
    expect(right.id).not.toBe(topo.id);
    expect(left.id).not.toBe(right.id);
  });

  it('samples are partitioned by split line', () => {
    const topo = makeTopo();
    const [left, right] = splitToposolid(topo, splitLine);
    // All samples on the left side have xMm < 5000
    for (const s of left.heightSamples ?? []) {
      expect(s.xMm).toBeLessThan(5000);
    }
    // All samples on the right side have xMm > 5000
    for (const s of right.heightSamples ?? []) {
      expect(s.xMm).toBeGreaterThan(5000);
    }
  });
});
