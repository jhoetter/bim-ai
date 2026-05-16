import { describe, expect, it } from 'vitest';
import { gridLineIntersection, columnPositionsAtGridIntersections } from './columnAtGrids';
import type { Element } from '@bim-ai/core';

type GridLineElem = Extract<Element, { kind: 'grid_line' }>;

function makeGrid(id: string, x1: number, y1: number, x2: number, y2: number): GridLineElem {
  return {
    kind: 'grid_line',
    id,
    name: id,
    label: id,
    start: { xMm: x1, yMm: y1 },
    end: { xMm: x2, yMm: y2 },
  };
}

describe('gridLineIntersection', () => {
  it('finds intersection of horizontal and vertical grid lines', () => {
    const h = makeGrid('H', 0, 3000, 10000, 3000);
    const v = makeGrid('V', 5000, 0, 5000, 10000);
    const pt = gridLineIntersection(h, v);
    expect(pt).not.toBeNull();
    expect(pt!.xMm).toBeCloseTo(5000, 3);
    expect(pt!.yMm).toBeCloseTo(3000, 3);
  });

  it('returns null for parallel grid lines', () => {
    const h1 = makeGrid('H1', 0, 0, 10000, 0);
    const h2 = makeGrid('H2', 0, 3000, 10000, 3000);
    expect(gridLineIntersection(h1, h2)).toBeNull();
  });
});

describe('columnPositionsAtGridIntersections', () => {
  it('3×3 grid produces 9 intersection points', () => {
    const grids: GridLineElem[] = [
      makeGrid('H1', 0, 0, 12000, 0),
      makeGrid('H2', 0, 4000, 12000, 4000),
      makeGrid('H3', 0, 8000, 12000, 8000),
      makeGrid('V1', 0, 0, 0, 12000),
      makeGrid('V2', 4000, 0, 4000, 12000),
      makeGrid('V3', 8000, 0, 8000, 12000),
    ];
    const pts = columnPositionsAtGridIntersections(grids);
    expect(pts.length).toBe(9);
  });

  it('2 lines produce exactly 1 intersection', () => {
    const grids: GridLineElem[] = [
      makeGrid('H', 0, 5000, 10000, 5000),
      makeGrid('V', 5000, 0, 5000, 10000),
    ];
    const pts = columnPositionsAtGridIntersections(grids);
    expect(pts.length).toBe(1);
    expect(pts[0]!.xMm).toBeCloseTo(5000, 3);
  });

  it('deduplicates near-coincident intersections', () => {
    // Three lines meeting at a single point
    const grids: GridLineElem[] = [
      makeGrid('A', 0, 5000, 10000, 5000),
      makeGrid('B', 5000, 0, 5000, 10000),
      makeGrid('C', 0, 0, 10000, 10000),
    ];
    const pts = columnPositionsAtGridIntersections(grids);
    expect(pts.length).toBeLessThanOrEqual(2);
  });
});
