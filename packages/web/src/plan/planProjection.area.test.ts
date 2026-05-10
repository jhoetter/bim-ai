import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import { extractAreaPrimitives, polygonCentroidMm } from './areaRender';

const porch: Extract<Element, { kind: 'area' }> = {
  kind: 'area',
  id: 'a-porch',
  name: 'Porch',
  levelId: 'lvl_g',
  boundaryMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 4000, yMm: 0 },
    { xMm: 4000, yMm: 5000 },
    { xMm: 0, yMm: 5000 },
  ],
  ruleSet: 'gross',
  areaScheme: 'gross_building',
  computedAreaSqMm: 20_000_000,
};

const otherLevel: Extract<Element, { kind: 'area' }> = {
  ...porch,
  id: 'a-other',
  levelId: 'lvl_1',
};

describe('KRN-08 — extractAreaPrimitives', () => {
  it('returns one primitive per area on the active level', () => {
    const prims = extractAreaPrimitives(
      { [porch.id]: porch, [otherLevel.id]: otherLevel },
      'lvl_g',
      'gross_building',
    );
    expect(prims).toHaveLength(1);
    expect(prims[0]!.id).toBe('a-porch');
  });

  it('formats the tag label as "<name> · <area> m²" — KRN-08 acceptance', () => {
    const prims = extractAreaPrimitives({ [porch.id]: porch }, 'lvl_g', 'gross_building');
    expect(prims[0]!.tagLabel).toBe('Porch · 20.00 m²');
  });

  it('falls back to polygon area when computedAreaSqMm is omitted', () => {
    const naked: Extract<Element, { kind: 'area' }> = {
      ...porch,
      computedAreaSqMm: undefined,
    };
    const prims = extractAreaPrimitives({ [naked.id]: naked }, 'lvl_g', 'gross_building');
    expect(prims[0]!.computedAreaSqMm).toBeCloseTo(20_000_000, 0);
    expect(prims[0]!.tagLabel).toBe('Porch · 20.00 m²');
  });

  it('places the centroid tag at the polygon centroid', () => {
    const prims = extractAreaPrimitives({ [porch.id]: porch }, 'lvl_g', 'gross_building');
    expect(prims[0]!.centroidMm.xMm).toBeCloseTo(2000, 6);
    expect(prims[0]!.centroidMm.yMm).toBeCloseTo(2500, 6);
  });

  it('returns an empty list when no level is active', () => {
    expect(extractAreaPrimitives({ [porch.id]: porch }, undefined, 'gross_building')).toEqual([]);
  });

  it('filters areas by active Area Plan scheme', () => {
    const rentable: Extract<Element, { kind: 'area' }> = {
      ...porch,
      id: 'a-rentable',
      areaScheme: 'rentable',
    };
    const prims = extractAreaPrimitives(
      { [porch.id]: porch, [rentable.id]: rentable },
      'lvl_g',
      'rentable',
    );
    expect(prims.map((p) => p.id)).toEqual(['a-rentable']);
  });

  it('supports arbitrary non-rectangular area boundaries', () => {
    const lShape: Extract<Element, { kind: 'area' }> = {
      ...porch,
      id: 'a-l',
      boundaryMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 4000, yMm: 0 },
        { xMm: 4000, yMm: 1000 },
        { xMm: 1500, yMm: 1000 },
        { xMm: 1500, yMm: 3000 },
        { xMm: 0, yMm: 3000 },
      ],
      computedAreaSqMm: undefined,
    };
    const prims = extractAreaPrimitives({ [lShape.id]: lShape }, 'lvl_g', 'gross_building');
    expect(prims[0]!.boundaryMm).toHaveLength(6);
    expect(prims[0]!.computedAreaSqMm).toBeCloseTo(7_000_000, 0);
    expect(prims[0]!.tagLabel).toBe('Porch · 7.00 m²');
  });

  it('polygonCentroidMm degenerates to the mean for collinear vertices', () => {
    const c = polygonCentroidMm([
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
      { xMm: 2000, yMm: 0 },
    ]);
    expect(c.xMm).toBeCloseTo(1000, 6);
    expect(c.yMm).toBeCloseTo(0, 6);
  });
});
