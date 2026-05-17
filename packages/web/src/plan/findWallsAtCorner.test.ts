import { describe, expect, it } from 'vitest';
import { findWallsAtCorner } from './findWallsAtCorner';

const elementsById: any = {
  w1: { id: 'w1', kind: 'wall', start: { xMm: 0, yMm: 0 }, end: { xMm: 5000, yMm: 0 } },
  w2: { id: 'w2', kind: 'wall', start: { xMm: 5000, yMm: 0 }, end: { xMm: 5000, yMm: 3000 } },
  w3: { id: 'w3', kind: 'wall', start: { xMm: 0, yMm: 0 }, end: { xMm: 0, yMm: 3000 } },
  f1: { id: 'f1', kind: 'floor', boundaryMm: [] },
};

describe('findWallsAtCorner — §3.5.5', () => {
  it('finds walls at the origin corner', () => {
    const ids = findWallsAtCorner({ xMm: 0, yMm: 0 }, elementsById);
    expect(ids).toContain('w1');
    expect(ids).toContain('w3');
  });

  it('finds walls at a non-origin corner', () => {
    const ids = findWallsAtCorner({ xMm: 5000, yMm: 0 }, elementsById);
    expect(ids).toContain('w1');
    expect(ids).toContain('w2');
  });

  it('excludes non-wall elements', () => {
    const ids = findWallsAtCorner({ xMm: 0, yMm: 0 }, elementsById);
    expect(ids).not.toContain('f1');
  });

  it('returns empty array when no walls at corner', () => {
    const ids = findWallsAtCorner({ xMm: 9999, yMm: 9999 }, elementsById);
    expect(ids).toHaveLength(0);
  });

  it('respects toleranceMm parameter', () => {
    // Point 50mm away from corner — within default 100mm tolerance
    const ids = findWallsAtCorner({ xMm: 50, yMm: 0 }, elementsById);
    expect(ids).toContain('w1');
  });

  it('excludes wall just outside tolerance', () => {
    // Point 200mm away from w2's start — outside default 100mm tolerance
    const ids = findWallsAtCorner({ xMm: 5200, yMm: 0 }, elementsById, 100);
    expect(ids).not.toContain('w2');
  });
});
