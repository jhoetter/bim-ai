import { describe, expect, it } from 'vitest';

import { elementsInCrossingBox } from './crossingSelection';
import type { Element } from '@bim-ai/core';

// Minimal wall element factories for testing.
function makeWall(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Extract<Element, { kind: 'wall' }> {
  return {
    kind: 'wall',
    id,
    start: { xMm: x1, yMm: y1 },
    end: { xMm: x2, yMm: y2 },
    levelId: 'lvl-1',
    heightMm: 3000,
    thicknessMm: 200,
    locationLine: 'wall-centerline',
  } as Extract<Element, { kind: 'wall' }>;
}

describe('crossing window selection — §1.8.1', () => {
  // Selection rectangle: (0,0) to (1000,1000) mm.
  const rect = { x1: 0, y1: 0, x2: 1000, y2: 1000 };

  // Fully inside the rect.
  const inside = makeWall('inside', 100, 100, 900, 900);
  // Partially overlapping (crosses the right edge).
  const partial = makeWall('partial', 800, 200, 1500, 800);
  // Entirely outside.
  const outside = makeWall('outside', 2000, 2000, 3000, 3000);
  // Crosses only one side (left edge of rect).
  const crossLeft = makeWall('cross-left', -500, 400, 200, 600);

  const elements: Element[] = [inside, partial, outside, crossLeft];

  it('window select returns only fully contained elements', () => {
    const result = elementsInCrossingBox(elements, rect, false);
    expect(result).toContain('inside');
    expect(result).not.toContain('partial');
    expect(result).not.toContain('outside');
    expect(result).not.toContain('cross-left');
  });

  it('crossing select returns elements that partially overlap', () => {
    const result = elementsInCrossingBox(elements, rect, true);
    expect(result).toContain('partial');
    expect(result).toContain('cross-left');
    expect(result).not.toContain('outside');
  });

  it('crossing select includes fully contained elements too', () => {
    const result = elementsInCrossingBox(elements, rect, true);
    expect(result).toContain('inside');
  });

  it('returns empty array when nothing overlaps', () => {
    const farRect = { x1: 5000, y1: 5000, x2: 6000, y2: 6000 };
    const result = elementsInCrossingBox(elements, farRect, true);
    expect(result).toHaveLength(0);
  });
});
