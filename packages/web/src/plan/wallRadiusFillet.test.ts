import { describe, expect, it } from 'vitest';

import { buildWallRadiusFillet } from './wallRadiusFillet';

describe('buildWallRadiusFillet', () => {
  it('builds tangent arc segments for a right-angle chained wall corner', () => {
    const fillet = buildWallRadiusFillet(
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
      { xMm: 1000, yMm: 1000 },
      500,
    );

    expect(fillet).not.toBeNull();
    expect(fillet!.previousEnd.xMm).toBeCloseTo(500, 6);
    expect(fillet!.previousEnd.yMm).toBeCloseTo(0, 6);
    expect(fillet!.currentStart.xMm).toBeCloseTo(1000, 6);
    expect(fillet!.currentStart.yMm).toBeCloseTo(500, 6);
    expect(fillet!.wallCurve.kind).toBe('arc');
    expect(fillet!.wallCurve.radiusMm).toBeCloseTo(500, 6);
    expect(fillet!.wallCurve.center.xMm).toBeCloseTo(500, 6);
    expect(fillet!.wallCurve.center.yMm).toBeCloseTo(500, 6);
    expect(fillet!.wallCurve.startAngleDeg).toBeCloseTo(-90, 6);
    expect(fillet!.wallCurve.endAngleDeg).toBeCloseTo(0, 6);
    expect(fillet!.wallCurve.sweepDeg).toBeCloseTo(90, 6);
    expect(fillet!.arcSegments.length).toBeGreaterThanOrEqual(3);
    expect(fillet!.arcSegments[0]!.start).toEqual(fillet!.previousEnd);
    expect(fillet!.arcSegments.at(-1)!.end).toEqual(fillet!.currentStart);
  });

  it('clamps the radius when adjacent wall legs are too short', () => {
    const fillet = buildWallRadiusFillet(
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
      { xMm: 1000, yMm: 300 },
      900,
    );

    expect(fillet).not.toBeNull();
    expect(fillet!.effectiveRadiusMm).toBeLessThan(900);
    expect(fillet!.currentStart.yMm).toBeLessThan(300);
  });

  it('returns null for straight or zero-length corner input', () => {
    expect(
      buildWallRadiusFillet({ xMm: 0, yMm: 0 }, { xMm: 1000, yMm: 0 }, { xMm: 2000, yMm: 0 }, 500),
    ).toBeNull();
    expect(
      buildWallRadiusFillet({ xMm: 0, yMm: 0 }, { xMm: 0, yMm: 0 }, { xMm: 500, yMm: 0 }, 500),
    ).toBeNull();
  });
});
