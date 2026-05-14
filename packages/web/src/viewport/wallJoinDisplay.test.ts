import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import {
  wall3dCleanupFootprintMm,
  wall3dDisallowedJoinEndpoints,
  wall3dXJoinCleanupFootprintsMm,
  wallWith3dJoinDisallowGaps,
} from './wallJoinDisplay';

type WallElem = Extract<Element, { kind: 'wall' }>;

function wall(
  id: string,
  start: WallElem['start'],
  end: WallElem['end'],
  extra: Partial<WallElem> = {},
): WallElem {
  return {
    kind: 'wall',
    id,
    name: id,
    levelId: 'lvl-ground',
    start,
    end,
    thicknessMm: 200,
    heightMm: 2800,
    ...extra,
  };
}

describe('WP-NEXT-42 3D wall join display gaps', () => {
  it('keeps allowed joined endpoints visually unchanged', () => {
    const south = wall('south', { xMm: 0, yMm: 0 }, { xMm: 1000, yMm: 0 });
    const east = wall('east', { xMm: 1000, yMm: 0 }, { xMm: 1000, yMm: 1000 });
    const elementsById: Record<string, Element> = { south, east };

    expect(wall3dDisallowedJoinEndpoints(south, elementsById)).toEqual({
      start: false,
      end: false,
    });
    expect(wallWith3dJoinDisallowGaps(south, elementsById)).toBe(south);
  });

  it('shortens only the disallowed joined endpoint for 3D rendering', () => {
    const south = wall(
      'south',
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
      { joinDisallowEnd: true },
    );
    const east = wall('east', { xMm: 1000, yMm: 0 }, { xMm: 1000, yMm: 1000 });
    const elementsById: Record<string, Element> = { south, east };

    const displayWall = wallWith3dJoinDisallowGaps(south, elementsById, 120);

    expect(displayWall).not.toBe(south);
    expect(displayWall.start).toEqual(south.start);
    expect(displayWall.end.xMm).toBeCloseTo(880, 6);
    expect(displayWall.end.yMm).toBeCloseTo(0, 6);
  });

  it('caps opposing gaps so a very short wall remains renderable', () => {
    const center = wall(
      'center',
      { xMm: 0, yMm: 0 },
      { xMm: 100, yMm: 0 },
      { joinDisallowStart: true, joinDisallowEnd: true },
    );
    const west = wall('west', { xMm: -100, yMm: 0 }, { xMm: 0, yMm: 0 });
    const east = wall('east', { xMm: 100, yMm: 0 }, { xMm: 200, yMm: 0 });
    const displayWall = wallWith3dJoinDisallowGaps(center, { center, west, east }, 120);

    expect(displayWall.end.xMm - displayWall.start.xMm).toBeCloseTo(1, 6);
  });

  it('miter-cleans 3D endpoint L joins into a shared diagonal footprint', () => {
    const south = wall('south', { xMm: 0, yMm: 0 }, { xMm: 1000, yMm: 0 });
    const east = wall('east', { xMm: 1000, yMm: 0 }, { xMm: 1000, yMm: 1000 });
    const elementsById: Record<string, Element> = { south, east };

    const southFootprint = wall3dCleanupFootprintMm(south, elementsById, 5);
    const eastFootprint = wall3dCleanupFootprintMm(east, elementsById, 5);

    expect(southFootprint).toEqual([
      { xMm: 0, yMm: 100 },
      { xMm: 900, yMm: 100 },
      { xMm: 1100, yMm: -100 },
      { xMm: 0, yMm: -100 },
    ]);
    expect(eastFootprint?.[0]).toEqual({ xMm: 900, yMm: 100 });
    expect(eastFootprint?.[3]).toEqual({ xMm: 1100, yMm: -100 });
  });

  it('butt-cleans a T branch to the host wall face instead of the host centerline', () => {
    const host = wall('host', { xMm: 0, yMm: 0 }, { xMm: 1000, yMm: 0 });
    const branch = wall('branch', { xMm: 500, yMm: 0 }, { xMm: 500, yMm: 1000 });
    const elementsById: Record<string, Element> = { host, branch };

    const branchFootprint = wall3dCleanupFootprintMm(branch, elementsById, 5);

    expect(branchFootprint).toEqual([
      { xMm: 400, yMm: 100 },
      { xMm: 400, yMm: 1000 },
      { xMm: 600, yMm: 1000 },
      { xMm: 600, yMm: 100 },
    ]);
    expect(wall3dCleanupFootprintMm(host, elementsById, 5)).toBeNull();
  });

  it('splits X-intersection walls around the shared crossing and assigns one cleanup cap', () => {
    const eastWest = wall('east-west', { xMm: 0, yMm: 0 }, { xMm: 1000, yMm: 0 });
    const northSouth = wall('north-south', { xMm: 500, yMm: -500 }, { xMm: 500, yMm: 500 });
    const elementsById: Record<string, Element> = {
      'east-west': eastWest,
      'north-south': northSouth,
    };

    const eastWestFootprints = wall3dXJoinCleanupFootprintsMm(eastWest, elementsById, 5);
    const northSouthFootprints = wall3dXJoinCleanupFootprintsMm(northSouth, elementsById, 5);

    expect(eastWestFootprints).toHaveLength(3);
    expect(eastWestFootprints?.[0]).toEqual([
      { xMm: 0, yMm: 100 },
      { xMm: 400, yMm: 100 },
      { xMm: 400, yMm: -100 },
      { xMm: 0, yMm: -100 },
    ]);
    expect(eastWestFootprints?.[1]).toEqual([
      { xMm: 600, yMm: 100 },
      { xMm: 1000, yMm: 100 },
      { xMm: 1000, yMm: -100 },
      { xMm: 600, yMm: -100 },
    ]);
    expect(eastWestFootprints?.[2]).toEqual([
      { xMm: 400, yMm: -100 },
      { xMm: 600, yMm: -100 },
      { xMm: 600, yMm: 100 },
      { xMm: 400, yMm: 100 },
    ]);
    expect(northSouthFootprints).toHaveLength(2);
  });
});
