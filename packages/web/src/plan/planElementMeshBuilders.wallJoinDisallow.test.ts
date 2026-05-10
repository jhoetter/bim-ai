import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import { computeWallSectionPolygon, type WallJoinRecord } from './planElementMeshBuilders';

type Wall = Extract<Element, { kind: 'wall' }>;

function wall(id: string, start: Wall['start'], end: Wall['end'], extra: Partial<Wall> = {}): Wall {
  return {
    kind: 'wall',
    id,
    name: id,
    levelId: 'lvl-1',
    start,
    end,
    thicknessMm: 200,
    heightMm: 2800,
    ...extra,
  };
}

function join(joinKind: WallJoinRecord['joinKind'], wallIds: [string, string]): WallJoinRecord {
  return {
    joinId: `${wallIds.join('-')}-${joinKind}`,
    wallIds,
    vertexMm: { xMm: 0, yMm: 0 },
    levelId: 'lvl-1',
    joinKind,
    planDisplayToken: 'wall_join',
    affectedOpeningIds: [],
    skipReason: null,
  };
}

function maxY(outline: Array<{ yMm: number }>): number {
  return Math.max(...outline.map((pt) => pt.yMm));
}

function maxAbsYAtX(outline: Array<{ xMm: number; yMm: number }>, xMm: number): number {
  return Math.max(
    ...outline.filter((pt) => Math.abs(pt.xMm - xMm) < 1e-6).map((pt) => Math.abs(pt.yMm)),
  );
}

describe('F-040 wall join rendered cleanup gating', () => {
  it('keeps allowed butt cleanup clipping the butt wall by host thickness', () => {
    const butt = wall('w-butt', { xMm: 0, yMm: -1000 }, { xMm: 0, yMm: 0 });
    const host = wall('w-host', { xMm: -1000, yMm: 0 }, { xMm: 1000, yMm: 0 });
    const outline = computeWallSectionPolygon(butt, [join('butt', ['w-butt', 'w-host'])], {
      [butt.id]: butt,
      [host.id]: host,
    });

    expect(maxY(outline)).toBeCloseTo(-100, 6);
  });

  it('does not butt-clean an endpoint whose join is disallowed', () => {
    const butt = wall(
      'w-butt',
      { xMm: 0, yMm: -1000 },
      { xMm: 0, yMm: 0 },
      {
        joinDisallowEnd: true,
      },
    );
    const host = wall('w-host', { xMm: -1000, yMm: 0 }, { xMm: 1000, yMm: 0 });
    const outline = computeWallSectionPolygon(butt, [join('butt', ['w-butt', 'w-host'])], {
      [butt.id]: butt,
      [host.id]: host,
    });

    expect(maxY(outline)).toBeCloseTo(0, 6);
  });

  it('keeps allowed miter cleanup widening the joined wall end', () => {
    const first = wall('w-first', { xMm: -1000, yMm: 0 }, { xMm: 0, yMm: 0 });
    const second = wall('w-second', { xMm: 0, yMm: 0 }, { xMm: 0, yMm: 1000 });
    const outline = computeWallSectionPolygon(
      first,
      [join('miter_candidate', ['w-first', 'w-second'])],
      {
        [first.id]: first,
        [second.id]: second,
      },
    );

    expect(maxAbsYAtX(outline, 0)).toBeCloseTo(200, 6);
  });

  it('does not miter-clean when the paired wall endpoint disallows joining', () => {
    const first = wall('w-first', { xMm: -1000, yMm: 0 }, { xMm: 0, yMm: 0 });
    const second = wall(
      'w-second',
      { xMm: 0, yMm: 0 },
      { xMm: 0, yMm: 1000 },
      {
        joinDisallowStart: true,
      },
    );
    const outline = computeWallSectionPolygon(
      first,
      [join('miter_candidate', ['w-first', 'w-second'])],
      {
        [first.id]: first,
        [second.id]: second,
      },
    );

    expect(maxAbsYAtX(outline, 0)).toBeCloseTo(100, 6);
  });
});
