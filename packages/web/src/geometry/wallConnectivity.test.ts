import { describe, expect, it } from 'vitest';

import {
  collectWallConnectivity,
  flipWallLocationLineSide,
  snapWallPointToConnectivity,
  type WallConnectivityWall,
} from './wallConnectivity';

function wall(
  id: string,
  start: WallConnectivityWall['start'],
  end: WallConnectivityWall['end'],
  extra: Partial<WallConnectivityWall> = {},
): WallConnectivityWall {
  return {
    id,
    levelId: 'lvl-ground',
    start,
    end,
    thicknessMm: 200,
    ...extra,
  };
}

describe('WP-NEXT-42 wall connectivity kernel', () => {
  it('classifies endpoint joins and carries endpoint disallow flags', () => {
    const walls = [
      wall('west', { xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 0 }, { joinDisallowEnd: true }),
      wall('north', { xMm: 4000, yMm: 0 }, { xMm: 4000, yMm: 3000 }),
    ];

    const joins = collectWallConnectivity(walls, { toleranceMm: 5 });

    expect(joins).toHaveLength(1);
    expect(joins[0]).toMatchObject({
      kind: 'endpoint',
      point: { xMm: 4000, yMm: 0 },
      wallIds: ['north', 'west'],
      endpointByWallId: { west: 'end', north: 'start' },
      disallowedByWallId: { west: true, north: false },
    });
  });

  it('classifies a T join when one endpoint lands on another wall segment', () => {
    const joins = collectWallConnectivity(
      [
        wall('host', { xMm: 0, yMm: 0 }, { xMm: 5000, yMm: 0 }),
        wall('branch', { xMm: 2500, yMm: 0 }, { xMm: 2500, yMm: 2000 }),
      ],
      { toleranceMm: 5 },
    );

    expect(joins).toHaveLength(1);
    expect(joins[0]?.kind).toBe('t');
    expect(joins[0]?.endpointByWallId).toEqual({ branch: 'start', host: null });
  });

  it('classifies an X join when two wall interiors cross', () => {
    const joins = collectWallConnectivity(
      [
        wall('east-west', { xMm: 0, yMm: 0 }, { xMm: 5000, yMm: 0 }),
        wall('north-south', { xMm: 2500, yMm: -1500 }, { xMm: 2500, yMm: 1500 }),
      ],
      { toleranceMm: 5 },
    );

    expect(joins).toHaveLength(1);
    expect(joins[0]).toMatchObject({
      kind: 'x',
      point: { xMm: 2500, yMm: 0 },
      endpointByWallId: { 'east-west': null, 'north-south': null },
    });
  });

  it('snaps authored points to endpoints before segment/intersection fallbacks', () => {
    const walls = [
      wall('west', { xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 0 }),
      wall('north', { xMm: 4000, yMm: 0 }, { xMm: 4000, yMm: 3000 }),
    ];

    const snap = snapWallPointToConnectivity({ xMm: 3987, yMm: 13 }, walls, {
      toleranceMm: 40,
      levelId: 'lvl-ground',
    });

    expect(snap).toEqual({
      point: { xMm: 4000, yMm: 0 },
      kind: 'endpoint',
      wallIds: ['west'],
      distanceMm: expect.any(Number),
    });
  });

  it('snaps to a wall segment for T-join authoring before the second wall exists', () => {
    const snap = snapWallPointToConnectivity(
      { xMm: 2512, yMm: 18 },
      [wall('host', { xMm: 0, yMm: 0 }, { xMm: 5000, yMm: 0 })],
      { toleranceMm: 40 },
    );

    expect(snap).toMatchObject({
      point: { xMm: 2512, yMm: 0 },
      kind: 'segment',
      wallIds: ['host'],
    });
  });

  it('flips wall side without implying endpoint reversal', () => {
    expect(flipWallLocationLineSide('finish-face-exterior')).toBe('finish-face-interior');
    expect(flipWallLocationLineSide('finish-face-interior')).toBe('finish-face-exterior');
    expect(flipWallLocationLineSide('core-face-exterior')).toBe('core-face-interior');
    expect(flipWallLocationLineSide('wall-centerline')).toBe('wall-centerline');
  });
});
