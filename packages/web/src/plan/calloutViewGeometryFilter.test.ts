/**
 * §6.4.1 — Callout view geometry filter tests.
 */
import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { computeCalloutScale, elementOverlapsBoundary } from './calloutViewGeometryFilter';

const boundary = { xMm: 1000, yMm: 2000, widthMm: 2500, heightMm: 1500 };

function makeEl(overrides: Record<string, unknown>): Element {
  return { kind: 'wall', id: 'el-1', ...overrides } as unknown as Element;
}

describe('elementOverlapsBoundary — §6.4.1', () => {
  it('element with positionMm inside boundary returns true', () => {
    const el = makeEl({ positionMm: { xMm: 1500, yMm: 2500 } });
    expect(elementOverlapsBoundary(el, boundary)).toBe(true);
  });

  it('element with positionMm outside boundary returns false', () => {
    const el = makeEl({ positionMm: { xMm: 5000, yMm: 8000 } });
    expect(elementOverlapsBoundary(el, boundary)).toBe(false);
  });

  it('wall with startMm inside and endMm outside returns true', () => {
    const el = makeEl({
      startMm: { xMm: 1200, yMm: 2200 }, // inside
      endMm: { xMm: 9000, yMm: 9000 }, // outside
    });
    expect(elementOverlapsBoundary(el, boundary)).toBe(true);
  });

  it('element with no spatial info returns true (inclusive)', () => {
    const el = makeEl({});
    expect(elementOverlapsBoundary(el, boundary)).toBe(true);
  });
});

describe('computeCalloutScale — §6.4.1', () => {
  it('returns a standard scale value', () => {
    const standards = [5, 10, 20, 25, 50, 100, 200, 500, 1000];
    const result = computeCalloutScale(boundary, 800);
    expect(standards).toContain(result);
  });

  it('small boundary returns small scale (e.g. 20)', () => {
    // small boundary: 1000mm wide, 800px canvas → scale ≈ 1000/(800*0.264) ≈ 4.7 → rounds to 5
    const smallBoundary = { xMm: 0, yMm: 0, widthMm: 1000, heightMm: 500 };
    const result = computeCalloutScale(smallBoundary, 800);
    expect(result).toBeLessThanOrEqual(20);
  });

  it('large boundary returns large scale (e.g. 200)', () => {
    // large boundary: 100000mm wide, 800px canvas → scale ≈ 100000/(800*0.264) ≈ 473 → rounds to 500
    const largeBoundary = { xMm: 0, yMm: 0, widthMm: 100000, heightMm: 50000 };
    const result = computeCalloutScale(largeBoundary, 800);
    expect(result).toBeGreaterThanOrEqual(200);
  });
});
