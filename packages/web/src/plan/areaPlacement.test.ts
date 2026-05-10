import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import {
  areaPlanPlacementContext,
  findAreaPlacementBoundary,
  pointInPolygonMm,
} from './areaPlacement';

const grossArea: Extract<Element, { kind: 'area' }> = {
  kind: 'area',
  id: 'area-gross',
  name: 'Gross Area',
  levelId: 'lvl-1',
  ruleSet: 'gross',
  areaScheme: 'gross_building',
  boundaryMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 8000, yMm: 0 },
    { xMm: 8000, yMm: 6000 },
    { xMm: 0, yMm: 6000 },
  ],
};

const rentableArea: Extract<Element, { kind: 'area' }> = {
  ...grossArea,
  id: 'area-rentable',
  name: 'Rentable Area',
  areaScheme: 'rentable',
};

const otherLevelArea: Extract<Element, { kind: 'area' }> = {
  ...grossArea,
  id: 'area-level-2',
  levelId: 'lvl-2',
};

const grossPlan: Extract<Element, { kind: 'plan_view' }> = {
  kind: 'plan_view',
  id: 'pv-gross',
  name: 'Gross Area Plan',
  levelId: 'lvl-1',
  planViewSubtype: 'area_plan',
  areaScheme: 'gross_building',
};

const rentablePlan: Extract<Element, { kind: 'plan_view' }> = {
  ...grossPlan,
  id: 'pv-rentable',
  name: 'Rentable Area Plan',
  areaScheme: 'rentable',
};

const floorPlan: Extract<Element, { kind: 'plan_view' }> = {
  ...grossPlan,
  id: 'pv-floor',
  name: 'Floor Plan',
  planViewSubtype: 'floor_plan',
};

describe('F-095 area placement from existing Area Plan boundaries', () => {
  it('resolves a click inside an existing closed boundary to that area', () => {
    const ctx = areaPlanPlacementContext({ [grossPlan.id]: grossPlan }, grossPlan.id, undefined);
    expect(ctx).toEqual({ levelId: 'lvl-1', areaScheme: 'gross_building', ruleSet: 'gross' });

    const hit = findAreaPlacementBoundary({ [grossArea.id]: grossArea }, ctx!, {
      xMm: 2000,
      yMm: 1500,
    });
    expect(hit?.existingAreaId).toBe('area-gross');
    expect(hit?.boundaryMm).toEqual(grossArea.boundaryMm);
  });

  it('rejects clicks outside all active Area Plan boundaries', () => {
    const hit = findAreaPlacementBoundary(
      { [grossArea.id]: grossArea },
      { levelId: 'lvl-1', areaScheme: 'gross_building' },
      { xMm: 9000, yMm: 1500 },
    );
    expect(hit).toBeNull();
  });

  it('respects active Area Plan scheme and level filtering', () => {
    const elements = {
      [grossArea.id]: grossArea,
      [rentableArea.id]: rentableArea,
      [otherLevelArea.id]: otherLevelArea,
      [rentablePlan.id]: rentablePlan,
    };
    const ctx = areaPlanPlacementContext(elements, rentablePlan.id, undefined);
    expect(ctx).toEqual({ levelId: 'lvl-1', areaScheme: 'rentable', ruleSet: 'net' });

    const hit = findAreaPlacementBoundary(elements, ctx!, { xMm: 2000, yMm: 1500 });
    expect(hit?.existingAreaId).toBe('area-rentable');
  });

  it('does not place areas from regular floor plan views', () => {
    expect(
      areaPlanPlacementContext({ [floorPlan.id]: floorPlan }, floorPlan.id, 'lvl-1'),
    ).toBeNull();
  });

  it('chooses the smallest containing boundary for nested boundaries', () => {
    const inner: Extract<Element, { kind: 'area' }> = {
      ...grossArea,
      id: 'area-inner',
      boundaryMm: [
        { xMm: 1000, yMm: 1000 },
        { xMm: 3000, yMm: 1000 },
        { xMm: 3000, yMm: 3000 },
        { xMm: 1000, yMm: 3000 },
      ],
    };
    const hit = findAreaPlacementBoundary(
      { [grossArea.id]: grossArea, [inner.id]: inner },
      { levelId: 'lvl-1', areaScheme: 'gross_building' },
      { xMm: 2000, yMm: 2000 },
    );
    expect(hit?.existingAreaId).toBe('area-inner');
  });

  it('treats clicks directly on the boundary as inside', () => {
    expect(pointInPolygonMm({ xMm: 0, yMm: 2500 }, grossArea.boundaryMm)).toBe(true);
  });
});
