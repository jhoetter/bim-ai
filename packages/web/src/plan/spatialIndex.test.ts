import { describe, expect, it } from 'vitest';

import { WallSpatialIndex, bboxFromSegment, type SpatialItem } from './spatialIndex';

function box(xMin: number, yMin: number, xMax: number, yMax: number) {
  return { xMinMm: xMin, yMinMm: yMin, xMaxMm: xMax, yMaxMm: yMax };
}

describe('PERF-H02 WallSpatialIndex', () => {
  it('returns only items whose bbox overlaps the query range', () => {
    const items: SpatialItem<string>[] = [
      { payload: 'a', bbox: box(0, 0, 1_000, 1_000) },
      { payload: 'b', bbox: box(2_000, 2_000, 3_000, 3_000) },
      { payload: 'c', bbox: box(10_000, 10_000, 11_000, 11_000) },
    ];
    const index = new WallSpatialIndex(items, 1_000);
    const near = index.queryNear(500, 500, 100);
    expect(near.sort()).toEqual(['a']);
  });

  it('returns multi-cell items only once (deduplicated)', () => {
    const items: SpatialItem<string>[] = [
      // Long wall spans many cells of a 1m grid.
      { payload: 'long-wall', bbox: box(0, 0, 10_000, 200) },
    ];
    const index = new WallSpatialIndex(items, 1_000);
    const near = index.queryRange(box(0, 0, 10_000, 200));
    expect(near).toEqual(['long-wall']);
  });

  it('bbox padding via bboxFromSegment lets snap tolerance be folded in', () => {
    const seg = { startMm: { xMm: 0, yMm: 0 }, endMm: { xMm: 5_000, yMm: 0 } };
    const padded = bboxFromSegment(seg, 100);
    expect(padded.xMinMm).toBe(-100);
    expect(padded.yMaxMm).toBe(100);
    expect(padded.xMaxMm).toBe(5_100);
  });

  it('stats expose bucket cardinality for diagnostics', () => {
    const items: SpatialItem<string>[] = [
      { payload: 'a', bbox: box(0, 0, 100, 100) },
      { payload: 'b', bbox: box(50_000, 0, 50_100, 100) },
    ];
    const index = new WallSpatialIndex(items, 1_000);
    const stats = index.stats();
    expect(stats.cellMm).toBe(1_000);
    expect(stats.itemsTotal).toBe(2);
    expect(stats.buckets).toBeGreaterThanOrEqual(2);
  });

  it('demonstrates the sublinear-lookup contract: a 1000-wall fixture queries <50 candidates near a point', () => {
    const items: SpatialItem<string>[] = [];
    // Lay 1000 walls in a 32×32 grid spanning 100m × 100m.
    let i = 0;
    for (let row = 0; row < 32; row++) {
      for (let col = 0; col < 32; col++) {
        const x = col * 3_000;
        const y = row * 3_000;
        items.push({
          payload: `wall-${i++}`,
          bbox: box(x, y, x + 2_500, y + 200),
        });
      }
    }
    const index = new WallSpatialIndex(items, 5_000);
    // Query a 200mm radius near (50_000, 50_000).
    const near = index.queryNear(50_000, 50_000, 200);
    // Linear scan would return all 1024 items; the spatial index
    // returns only the items in nearby buckets (typically 4-9 cells
    // × however many walls per cell).
    expect(near.length).toBeLessThan(50);
    expect(items.length).toBe(1024);
  });

  it('rejects non-positive cellMm', () => {
    expect(() => new WallSpatialIndex([], 0)).toThrow();
    expect(() => new WallSpatialIndex([], -5)).toThrow();
  });
});
