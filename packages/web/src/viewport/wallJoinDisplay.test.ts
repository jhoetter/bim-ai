import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import { wall3dDisallowedJoinEndpoints, wallWith3dJoinDisallowGaps } from './wallJoinDisplay';

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
});
