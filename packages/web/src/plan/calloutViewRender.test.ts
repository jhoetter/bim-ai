/**
 * §6.4.1 — Callout view rendering tests.
 */
import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { elementOverlapsBoundary, computeCalloutScale } from './calloutViewGeometryFilter';

const boundary = { xMm: 1000, yMm: 2000, widthMm: 2500, heightMm: 1500 };

function makeEl(overrides: Record<string, unknown>): Element {
  return { kind: 'wall', id: 'el-test', ...overrides } as unknown as Element;
}

describe('callout view rendering — §6.4.1', () => {
  it('elementOverlapsBoundary includes element with positionMm inside boundary', () => {
    const el = makeEl({ positionMm: { xMm: 1500, yMm: 2500 } });
    expect(elementOverlapsBoundary(el, boundary)).toBe(true);
  });

  it('elementOverlapsBoundary excludes element outside boundary', () => {
    const el = makeEl({ positionMm: { xMm: 9000, yMm: 9000 } });
    expect(elementOverlapsBoundary(el, boundary)).toBe(false);
  });

  it('computeCalloutScale returns a number', () => {
    const result = computeCalloutScale(boundary, 800);
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThan(0);
  });

  it('computeCalloutScale returns one of the standard scale values', () => {
    const result = computeCalloutScale({ xMm: 0, yMm: 0, widthMm: 5000, heightMm: 5000 }, 800);
    expect([5, 10, 20, 25, 50, 100, 200, 500, 1000]).toContain(result);
  });
});
