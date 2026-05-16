import { describe, it, expect } from 'vitest';
import { angleBetweenVectors, fitCircleThrough3, arcLengthThrough3 } from './measureGeometry';

describe('measureGeometry — §3.3.8', () => {
  it('angleBetweenVectors returns 90° for perpendicular vectors', () => {
    const a = { xMm: 1000, yMm: 0 };
    const b = { xMm: 0, yMm: 1000 };
    expect(angleBetweenVectors(a, b)).toBeCloseTo(90, 5);
  });

  it('angleBetweenVectors returns 0° for parallel vectors', () => {
    const a = { xMm: 1000, yMm: 0 };
    const b = { xMm: 500, yMm: 0 };
    expect(angleBetweenVectors(a, b)).toBeCloseTo(0, 5);
  });

  it('angleBetweenVectors returns 180° for antiparallel vectors', () => {
    const a = { xMm: 1000, yMm: 0 };
    const b = { xMm: -1000, yMm: 0 };
    expect(angleBetweenVectors(a, b)).toBeCloseTo(180, 5);
  });

  it('angleBetweenVectors returns 45° for 45-degree vectors', () => {
    const a = { xMm: 1000, yMm: 0 };
    const b = { xMm: 1000, yMm: 1000 };
    expect(angleBetweenVectors(a, b)).toBeCloseTo(45, 4);
  });

  it('fitCircleThrough3 returns correct radius for known circle', () => {
    // Points on a circle of radius 1000mm centred at origin
    const p1 = { xMm: 1000, yMm: 0 };
    const p2 = { xMm: 0, yMm: 1000 };
    const p3 = { xMm: -1000, yMm: 0 };
    const result = fitCircleThrough3(p1, p2, p3);
    expect(result).not.toBeNull();
    expect(result!.radiusMm).toBeCloseTo(1000, 0);
    expect(result!.centerMm.xMm).toBeCloseTo(0, 0);
    expect(result!.centerMm.yMm).toBeCloseTo(0, 0);
  });

  it('fitCircleThrough3 returns null for collinear points', () => {
    const p1 = { xMm: 0, yMm: 0 };
    const p2 = { xMm: 500, yMm: 500 };
    const p3 = { xMm: 1000, yMm: 1000 };
    expect(fitCircleThrough3(p1, p2, p3)).toBeNull();
  });

  it('arcLengthThrough3 returns correct arc length for semicircle', () => {
    // Semicircle: start at (1000,0), end at (-1000,0), through (0,1000) — radius 1000mm
    const p1 = { xMm: 1000, yMm: 0 };
    const p2 = { xMm: -1000, yMm: 0 };
    const p3 = { xMm: 0, yMm: 1000 };
    const arc = arcLengthThrough3(p1, p2, p3);
    expect(arc).not.toBeNull();
    // Semicircle arc = π * r = π * 1000 ≈ 3141.59mm
    expect(arc!).toBeCloseTo(Math.PI * 1000, 0);
  });

  it('arcLengthThrough3 returns null for collinear points', () => {
    const p1 = { xMm: 0, yMm: 0 };
    const p2 = { xMm: 500, yMm: 0 };
    const p3 = { xMm: 1000, yMm: 0 };
    expect(arcLengthThrough3(p1, p2, p3)).toBeNull();
  });
});
