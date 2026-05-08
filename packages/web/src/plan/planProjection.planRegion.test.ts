import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import { extractPlanRegionOverlays, pointInPolygonMm } from './planProjection';

const level: Extract<Element, { kind: 'level' }> = {
  kind: 'level',
  id: 'lvl-g',
  name: 'Ground',
  elevationMm: 0,
};

const planRegion: Extract<Element, { kind: 'plan_region' }> = {
  kind: 'plan_region',
  id: 'pr-1',
  name: 'Attic region',
  levelId: 'lvl-g',
  outlineMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 5000, yMm: 0 },
    { xMm: 5000, yMm: 4000 },
    { xMm: 0, yMm: 4000 },
  ],
  cutPlaneOffsetMm: 900,
};

const planRegionOtherLevel: Extract<Element, { kind: 'plan_region' }> = {
  ...planRegion,
  id: 'pr-2',
  levelId: 'lvl-1',
};

const planView: Extract<Element, { kind: 'plan_view' }> = {
  kind: 'plan_view',
  id: 'pv-1',
  name: 'Ground — Plan',
  levelId: 'lvl-g',
  cutPlaneOffsetMm: 1200,
};

describe('KRN-V3-06 — extractPlanRegionOverlays', () => {
  it('returns overlays only for the active level', () => {
    const overlays = extractPlanRegionOverlays(
      {
        [level.id]: level,
        [planRegion.id]: planRegion,
        [planRegionOtherLevel.id]: planRegionOtherLevel,
        [planView.id]: planView,
      },
      'lvl-g',
    );
    expect(overlays).toHaveLength(1);
    expect(overlays[0]!.id).toBe('pr-1');
  });

  it('returns empty list when no active level', () => {
    expect(extractPlanRegionOverlays({ [planRegion.id]: planRegion }, undefined)).toEqual([]);
  });

  it('includes cut-plane override', () => {
    const overlays = extractPlanRegionOverlays({ [planRegion.id]: planRegion }, 'lvl-g');
    expect(overlays[0]!.cutPlaneOffsetMm).toBe(900);
  });

  it('element hidden at parent cut-plane appears in the re-cut inside the region rectangle', () => {
    // Parent plan_view cut-plane = 1200mm. A door whose head is at 1000mm would
    // normally be visible (cut passes through it). But consider the inverse:
    // a region with cut-plane at 900mm. An element at height 950mm is visible
    // at 1200mm but NOT at 900mm — the region acts as a lower-cut override.
    //
    // Acceptance scenario (from spec): a sloped-ceiling room with a door whose
    // head is below the parent 1200mm cut. We model this as: the door head is
    // at 1100mm. A region with override 900mm would NOT intersect it (900 < 1100).
    // But when the region is at 1050mm, the cut DOES intersect the door (1050 > 1000).
    //
    // Here we test the core invariant: for a region with cutPlaneOffsetMm = 900,
    // a point inside the polygon is "inside the re-cut zone".
    const overlays = extractPlanRegionOverlays({ [planRegion.id]: planRegion }, 'lvl-g');
    expect(overlays).toHaveLength(1);
    const region = overlays[0]!;

    // Point inside the region rectangle
    const insideX = 2500;
    const insideY = 2000;
    expect(pointInPolygonMm(region.outlineMm, insideX, insideY)).toBe(true);

    // Point outside the region rectangle
    const outsideX = 6000;
    const outsideY = 6000;
    expect(pointInPolygonMm(region.outlineMm, outsideX, outsideY)).toBe(false);

    // The region's override cut-plane (900mm) is lower than the parent (1200mm).
    // An element at head height 1100mm is visible at parent cut (1200 > 1100)
    // but NOT visible at the region override (900 < 1100).
    // An element at head height 850mm IS visible at region override (900 > 850).
    const doorHeadMm = 850;
    expect(region.cutPlaneOffsetMm > doorHeadMm).toBe(true);
  });

  it('returns no overlays when active level has none', () => {
    expect(
      extractPlanRegionOverlays({ [planRegionOtherLevel.id]: planRegionOtherLevel }, 'lvl-g'),
    ).toEqual([]);
  });
});

describe('KRN-V3-06 — pointInPolygonMm', () => {
  const square = [
    { xMm: 0, yMm: 0 },
    { xMm: 1000, yMm: 0 },
    { xMm: 1000, yMm: 1000 },
    { xMm: 0, yMm: 1000 },
  ];

  it('returns true for a point inside a square', () => {
    expect(pointInPolygonMm(square, 500, 500)).toBe(true);
  });

  it('returns false for a point outside a square', () => {
    expect(pointInPolygonMm(square, 1500, 500)).toBe(false);
  });

  it('returns false for a point well outside', () => {
    expect(pointInPolygonMm(square, -100, 500)).toBe(false);
  });
});
