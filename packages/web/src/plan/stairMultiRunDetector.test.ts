/**
 * §8.6.3 — stairMultiRunDetector tests
 */

import { describe, expect, it } from 'vitest';

import { buildMultiRunStairConfig, classifyStairShape } from './stairMultiRunDetector';

describe('classifyStairShape — §8.6.3', () => {
  it('classifies collinear 3 points as straight', () => {
    // When v1=(start-corner) and v2=(end-corner) point in nearly the same direction,
    // angle < 45° → straight. Example: corner is far from both start and end, which
    // are both below and slightly offset from each other.
    // v1 = (0,0)-(1000,0) = (-1000,0); v2 = (0,10)-(1000,0) = (-1000,10)
    // dot = 1000000, |v1|=1000, |v2|=√(1000100)≈1000.05 → cos≈0.999995 → angle≈0.3°
    const start = { xMm: 0, yMm: 0 };
    const corner = { xMm: 1000, yMm: 0 };
    const end = { xMm: 0, yMm: 10 };
    expect(classifyStairShape(start, corner, end)).toBe('straight');
  });

  it('classifies 90° turn as l_shape', () => {
    const start = { xMm: 0, yMm: 0 };
    const corner = { xMm: 1000, yMm: 0 };
    const end = { xMm: 1000, yMm: 1000 };
    // v1 = start - corner = (-1000, 0)
    // v2 = end - corner = (0, 1000)
    // dot = 0 → angle = 90°
    expect(classifyStairShape(start, corner, end)).toBe('l_shape');
  });

  it('classifies 180° turn as u_shape', () => {
    // A U-shape occurs when start and end are on the same side of the corner,
    // so v1=(start-corner) and v2=(end-corner) are nearly antiparallel (angle > 150°).
    // Collinear A→B→C: v1=(-1,0), v2=(1,0) → dot=-1 → angle=180° > 150 → u_shape.
    const start = { xMm: 0, yMm: 0 };
    const corner = { xMm: 1000, yMm: 0 };
    const end = { xMm: 2000, yMm: 0 }; // collinear: v1=(-1000,0), v2=(1000,0) → angle=180°
    expect(classifyStairShape(start, corner, end)).toBe('u_shape');
  });
});

describe('buildMultiRunStairConfig — §8.6.3', () => {
  it('straight shape has one run', () => {
    // Near-zero angle between v1 and v2 → straight
    const start = { xMm: 0, yMm: 0 };
    const corner = { xMm: 1000, yMm: 0 };
    const end = { xMm: 0, yMm: 10 }; // angle ≈ 0.3° → straight
    const cfg = buildMultiRunStairConfig(start, corner, end, 16);
    expect(cfg.shape).toBe('straight');
    expect(cfg.runs).toHaveLength(1);
    expect(cfg.runs[0]!.riserCount).toBe(16);
    expect(cfg.landingMm).toBeUndefined();
  });

  it('l_shape has two runs with landing at corner', () => {
    const start = { xMm: 0, yMm: 0 };
    const corner = { xMm: 1000, yMm: 0 };
    const end = { xMm: 1000, yMm: 1000 };
    const cfg = buildMultiRunStairConfig(start, corner, end, 16);
    expect(cfg.shape).toBe('l_shape');
    expect(cfg.runs).toHaveLength(2);
    expect(cfg.landingMm).toBeDefined();
    expect(cfg.landingMm).toHaveLength(1);
    expect(cfg.landingMm![0]).toEqual(corner);
  });

  it('u_shape has two runs', () => {
    const start = { xMm: 0, yMm: 0 };
    const corner = { xMm: 1000, yMm: 0 };
    const end = { xMm: 2000, yMm: 0 }; // collinear → u_shape
    const cfg = buildMultiRunStairConfig(start, corner, end, 16);
    expect(cfg.shape).toBe('u_shape');
    expect(cfg.runs).toHaveLength(2);
  });

  it('total riser count is distributed across runs', () => {
    const start = { xMm: 0, yMm: 0 };
    const corner = { xMm: 1000, yMm: 0 };
    const end = { xMm: 1000, yMm: 1000 }; // l_shape, 90°
    const totalRisers = 18;
    const cfg = buildMultiRunStairConfig(start, corner, end, totalRisers);
    const sum = cfg.runs.reduce((acc, r) => acc + r.riserCount, 0);
    expect(sum).toBe(totalRisers);
    // Each run should have at least 1 riser
    for (const run of cfg.runs) {
      expect(run.riserCount).toBeGreaterThanOrEqual(1);
    }
  });
});
