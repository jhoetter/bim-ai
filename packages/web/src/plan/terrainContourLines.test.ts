import { describe, it, expect } from 'vitest';
import { terrainContourLinesMm } from './terrainContourLines';

const squareBoundary = [
  { xMm: 0, yMm: 0 },
  { xMm: 10000, yMm: 0 },
  { xMm: 10000, yMm: 10000 },
  { xMm: 0, yMm: 10000 },
];

describe('terrainContourLinesMm — §5.1.3', () => {
  it('returns empty array when no height samples', () => {
    const result = terrainContourLinesMm([], squareBoundary, 1000);
    expect(result).toEqual([]);
  });

  it('returns empty array when fewer than 3 height samples', () => {
    const result = terrainContourLinesMm(
      [
        { xMm: 0, yMm: 0, zMm: 0 },
        { xMm: 5000, yMm: 0, zMm: 500 },
      ],
      squareBoundary,
      1000,
    );
    expect(result).toEqual([]);
  });

  it('returns empty array when contourIntervalMm <= 0', () => {
    const samples = [
      { xMm: 0, yMm: 0, zMm: 0 },
      { xMm: 10000, yMm: 0, zMm: 2000 },
      { xMm: 5000, yMm: 10000, zMm: 1000 },
    ];
    expect(terrainContourLinesMm(samples, squareBoundary, 0)).toEqual([]);
    expect(terrainContourLinesMm(samples, squareBoundary, -500)).toEqual([]);
  });

  it('returns at least one polyline for a sloped surface with 4 corner samples', () => {
    const samples = [
      { xMm: 0, yMm: 0, zMm: 0 },
      { xMm: 10000, yMm: 0, zMm: 3000 },
      { xMm: 10000, yMm: 10000, zMm: 3000 },
      { xMm: 0, yMm: 10000, zMm: 0 },
    ];
    const result = terrainContourLinesMm(samples, squareBoundary, 1000);
    expect(result.length).toBeGreaterThan(0);
    for (const poly of result) {
      expect(poly.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('all returned points are within boundary AABB', () => {
    const samples = [
      { xMm: 0, yMm: 0, zMm: 0 },
      { xMm: 10000, yMm: 0, zMm: 4000 },
      { xMm: 10000, yMm: 10000, zMm: 4000 },
      { xMm: 0, yMm: 10000, zMm: 0 },
    ];
    const result = terrainContourLinesMm(samples, squareBoundary, 1000);
    for (const poly of result) {
      for (const pt of poly) {
        expect(pt.xMm).toBeGreaterThanOrEqual(-1);
        expect(pt.xMm).toBeLessThanOrEqual(10001);
        expect(pt.yMm).toBeGreaterThanOrEqual(-1);
        expect(pt.yMm).toBeLessThanOrEqual(10001);
      }
    }
  });

  it('flat surface (all samples at same z) returns no contour lines', () => {
    const samples = [
      { xMm: 0, yMm: 0, zMm: 1000 },
      { xMm: 10000, yMm: 0, zMm: 1000 },
      { xMm: 10000, yMm: 10000, zMm: 1000 },
      { xMm: 0, yMm: 10000, zMm: 1000 },
    ];
    const result = terrainContourLinesMm(samples, squareBoundary, 500);
    expect(result).toEqual([]);
  });
});
