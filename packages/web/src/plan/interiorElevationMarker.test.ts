/**
 * D2 — interior_elevation_marker element type + plan symbol tests.
 */
import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

// Type-level check: interior_elevation_marker must satisfy the Element union.
const marker: Extract<Element, { kind: 'interior_elevation_marker' }> = {
  kind: 'interior_elevation_marker',
  id: 'iem-1',
  positionMm: { xMm: 3000, yMm: 4000 },
  levelId: 'lvl-0',
  radiusMm: 3000,
  elevationViewIds: {
    north: 'ev-iem-1-n',
    south: 'ev-iem-1-s',
    east: 'ev-iem-1-e',
    west: 'ev-iem-1-w',
  },
};

describe('D2 — interior_elevation_marker element type', () => {
  it('has the correct kind discriminant', () => {
    expect(marker.kind).toBe('interior_elevation_marker');
  });

  it('carries positionMm with xMm and yMm', () => {
    expect(marker.positionMm).toEqual({ xMm: 3000, yMm: 4000 });
  });

  it('carries four elevation view IDs (N/S/E/W)', () => {
    expect(marker.elevationViewIds.north).toBe('ev-iem-1-n');
    expect(marker.elevationViewIds.south).toBe('ev-iem-1-s');
    expect(marker.elevationViewIds.east).toBe('ev-iem-1-e');
    expect(marker.elevationViewIds.west).toBe('ev-iem-1-w');
  });

  it('radiusMm is optional and defaults to undefined when omitted', () => {
    const minimal: Extract<Element, { kind: 'interior_elevation_marker' }> = {
      kind: 'interior_elevation_marker',
      id: 'iem-min',
      positionMm: { xMm: 0, yMm: 0 },
      levelId: 'lvl-0',
      elevationViewIds: { north: 'n', south: 's', east: 'e', west: 'w' },
    };
    expect(minimal.radiusMm).toBeUndefined();
  });
});
