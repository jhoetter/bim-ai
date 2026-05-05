import { describe, expect, it } from 'vitest';

import type { SiteContextObjectRow } from '@bim-ai/core';

import {
  boundaryAxisAlignedBoxMm,
  boundaryMmFromAnchorSize,
  buildUpsertSiteCmdPayload,
  defaultSiteRectangleBoundaryMm,
  sortSiteContextObjectsById,
} from './siteAuthoringPayload';

describe('defaultSiteRectangleBoundaryMm', () => {
  it('returns a strictly convex CCW axis-aligned rectangle from the origin', () => {
    const b = defaultSiteRectangleBoundaryMm(1000, 2000);
    expect(b).toEqual([
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
      { xMm: 1000, yMm: 2000 },
      { xMm: 0, yMm: 2000 },
    ]);
    const areaTwice =
      b[0]!.xMm * b[1]!.yMm -
      b[0]!.yMm * b[1]!.xMm +
      (b[1]!.xMm * b[2]!.yMm - b[1]!.yMm * b[2]!.xMm) +
      (b[2]!.xMm * b[3]!.yMm - b[2]!.yMm * b[3]!.xMm) +
      (b[3]!.xMm * b[0]!.yMm - b[3]!.yMm * b[0]!.xMm);
    expect(areaTwice).toBeGreaterThan(0);
  });
});

describe('boundaryMmFromAnchorSize', () => {
  it('anchors the rectangle CCW starting at anchor', () => {
    expect(boundaryMmFromAnchorSize({ xMm: -5000, yMm: 200 }, 8000, 4000)).toEqual([
      { xMm: -5000, yMm: 200 },
      { xMm: 3000, yMm: 200 },
      { xMm: 3000, yMm: 4200 },
      { xMm: -5000, yMm: 4200 },
    ]);
  });

  it('clamps width/depth to at least 1mm', () => {
    expect(boundaryMmFromAnchorSize({ xMm: 0, yMm: 0 }, 0, -10)).toEqual([
      { xMm: 0, yMm: 0 },
      { xMm: 1, yMm: 0 },
      { xMm: 1, yMm: 1 },
      { xMm: 0, yMm: 1 },
    ]);
  });
});

describe('boundaryAxisAlignedBoxMm', () => {
  it('computes bbox from convex boundary points', () => {
    expect(
      boundaryAxisAlignedBoxMm([
        { xMm: 0, yMm: 0 },
        { xMm: 10, yMm: 0 },
        { xMm: 10, yMm: 5 },
        { xMm: 0, yMm: 5 },
      ]),
    ).toEqual({ anchor: { xMm: 0, yMm: 0 }, widthMm: 10, depthMm: 5 });
  });

  it('handles offset rectangles', () => {
    expect(
      boundaryAxisAlignedBoxMm([
        { xMm: -1000, yMm: -2000 },
        { xMm: 9000, yMm: -2000 },
        { xMm: 9000, yMm: 3000 },
        { xMm: -1000, yMm: 3000 },
      ]),
    ).toEqual({ anchor: { xMm: -1000, yMm: -2000 }, widthMm: 10_000, depthMm: 5000 });
  });
});

describe('sortSiteContextObjectsById', () => {
  it('sorts deterministically', () => {
    const rows: SiteContextObjectRow[] = [
      { id: 'b', contextType: 'tree', positionMm: { xMm: 0, yMm: 1 } },
      { id: 'a', contextType: 'shrub', positionMm: { xMm: 2, yMm: 3 } },
    ];
    expect(sortSiteContextObjectsById(rows)).toEqual([
      { id: 'a', contextType: 'shrub', positionMm: { xMm: 2, yMm: 3 } },
      { id: 'b', contextType: 'tree', positionMm: { xMm: 0, yMm: 1 } },
    ]);
  });
});

describe('buildUpsertSiteCmdPayload', () => {
  it('filters empty ids and omits optional north/setback when null', () => {
    const base = sortSiteContextObjectsById([
      { id: '  x1 ', contextType: 'tree', label: '', positionMm: { xMm: 0, yMm: 0 }, scale: 2 },
      { id: '   ', contextType: 'entourage', positionMm: { xMm: 1, yMm: 2 } },
    ]);
    const p = buildUpsertSiteCmdPayload({
      id: ' site ',
      name: ' Lot ',
      referenceLevelId: ' lvl ',
      boundaryMm: defaultSiteRectangleBoundaryMm(1000, 1000),
      padThicknessMm: 120,
      baseOffsetMm: -10,
      northDegCwFromPlanX: null,
      uniformSetbackMm: null,
      contextObjects: base,
    });
    expect(p.type).toBe('upsertSite');
    expect(p.id).toBe('site');
    expect(p.name).toBe('Lot');
    expect(p.referenceLevelId).toBe('lvl');
    expect(p.contextObjects.map((x) => x.id)).toEqual(['x1']);
    expect('northDegCwFromPlanX' in p).toBe(false);
    expect('uniformSetbackMm' in p).toBe(false);
  });

  it('includes north and setback when finite', () => {
    const p = buildUpsertSiteCmdPayload({
      id: 's',
      name: 'S',
      referenceLevelId: 'l',
      boundaryMm: defaultSiteRectangleBoundaryMm(100, 200),
      padThicknessMm: 90,
      baseOffsetMm: 0,
      northDegCwFromPlanX: 45,
      uniformSetbackMm: 600,
      contextObjects: [],
    });
    expect(p.northDegCwFromPlanX).toBe(45);
    expect(p.uniformSetbackMm).toBe(600);
  });

  it('drops empty labels and restores default category on context rows', () => {
    const p = buildUpsertSiteCmdPayload({
      id: 's',
      name: 'S',
      referenceLevelId: 'l',
      boundaryMm: defaultSiteRectangleBoundaryMm(1000, 2000),
      padThicknessMm: 88,
      baseOffsetMm: 0,
      northDegCwFromPlanX: null,
      uniformSetbackMm: null,
      contextObjects: [
        { id: 'm1', contextType: 'entourage', label: '  ', positionMm: { xMm: -1, yMm: 2 } },
      ],
    });
    expect(p.contextObjects[0]).toMatchObject({
      id: 'm1',
      scale: 1,
      category: 'site_entourage',
    });
    expect(Object.prototype.hasOwnProperty.call(p.contextObjects[0], 'label')).toBe(false);
  });
});
