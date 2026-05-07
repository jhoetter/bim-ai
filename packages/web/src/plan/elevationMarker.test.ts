import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import { elevationMarkerAnchorMm, modelXyBoundsMm } from './symbology';

const wall: Extract<Element, { kind: 'wall' }> = {
  kind: 'wall',
  id: 'w-1',
  name: 'W',
  levelId: 'lvl-1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 8000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 2800,
};

const wall2: Extract<Element, { kind: 'wall' }> = {
  ...wall,
  id: 'w-2',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 0, yMm: 6000 },
};

describe('VIE-03 — modelXyBoundsMm', () => {
  it('returns null on an empty model', () => {
    expect(modelXyBoundsMm({})).toBeNull();
  });

  it('envelopes wall endpoints', () => {
    const els: Record<string, Element> = { 'w-1': wall, 'w-2': wall2 };
    expect(modelXyBoundsMm(els)).toEqual({
      minXmm: 0,
      minYmm: 0,
      maxXmm: 8000,
      maxYmm: 6000,
    });
  });
});

describe('VIE-03 — elevationMarkerAnchorMm', () => {
  const bounds = { minXmm: 0, minYmm: 0, maxXmm: 8000, maxYmm: 6000 };

  it('north marker sits above the model and looks south', () => {
    const ev: Extract<Element, { kind: 'elevation_view' }> = {
      kind: 'elevation_view',
      id: 'ev',
      name: 'N',
      direction: 'north',
    };
    const a = elevationMarkerAnchorMm(ev, bounds, 1500);
    expect(a.anchorYmm).toBe(6000 + 1500);
    expect(a.anchorXmm).toBe(4000);
    expect(a.viewX).toBe(0);
    expect(a.viewY).toBe(-1);
  });

  it('east marker sits to the right and looks west', () => {
    const ev: Extract<Element, { kind: 'elevation_view' }> = {
      kind: 'elevation_view',
      id: 'ev',
      name: 'E',
      direction: 'east',
    };
    const a = elevationMarkerAnchorMm(ev, bounds, 1500);
    expect(a.anchorXmm).toBe(8000 + 1500);
    expect(a.anchorYmm).toBe(3000);
    expect(a.viewX).toBe(-1);
    expect(a.viewY).toBe(0);
  });

  it('custom direction uses the supplied angle', () => {
    const ev: Extract<Element, { kind: 'elevation_view' }> = {
      kind: 'elevation_view',
      id: 'ev',
      name: 'C',
      direction: 'custom',
      customAngleDeg: 45,
    };
    const a = elevationMarkerAnchorMm(ev, bounds, 0);
    // Anchor sits in the +x +y half-plane (cos 45 > 0, sin 45 > 0).
    expect(a.anchorXmm).toBeGreaterThan(4000);
    expect(a.anchorYmm).toBeGreaterThan(3000);
    // View direction points back toward the centroid.
    expect(a.viewX).toBeLessThan(0);
    expect(a.viewY).toBeLessThan(0);
  });
});
