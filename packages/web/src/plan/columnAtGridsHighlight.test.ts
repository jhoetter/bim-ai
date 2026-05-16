import { describe, expect, it } from 'vitest';
import { columnPositionsAtGridIntersections } from './columnAtGrids';
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

describe('column at grids — §9.1.2', () => {
  it('columnPositionsAtGridIntersections returns intersection for two perpendicular grids', () => {
    const h = makeGrid('H', 0, 3000, 10000, 3000);
    const v = makeGrid('V', 5000, 0, 5000, 10000);
    const pts = columnPositionsAtGridIntersections([h, v]);
    expect(pts.length).toBe(1);
    expect(pts[0]!.xMm).toBeCloseTo(5000, 3);
    expect(pts[0]!.yMm).toBeCloseTo(3000, 3);
  });

  it('returns empty array when only one grid selected', () => {
    const h = makeGrid('H', 0, 3000, 10000, 3000);
    const pts = columnPositionsAtGridIntersections([h]);
    expect(pts.length).toBe(0);
  });

  it('returns multiple intersections for 3+ grids', () => {
    const grids: GridLineElem[] = [
      makeGrid('H1', 0, 0, 10000, 0),
      makeGrid('H2', 0, 5000, 10000, 5000),
      makeGrid('V1', 3000, 0, 3000, 10000),
      makeGrid('V2', 7000, 0, 7000, 10000),
    ];
    const pts = columnPositionsAtGridIntersections(grids);
    expect(pts.length).toBe(4);
  });
});
