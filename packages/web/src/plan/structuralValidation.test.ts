import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import {
  findDuplicateWalls,
  findJoinCleanupFailures,
  findOrphanedHostedElements,
  runStructuralValidation,
  validateBoundary,
  validateHostedElementSpans,
} from './structuralValidation';

type WallElem = Extract<Element, { kind: 'wall' }>;

function makeWall(id: string, sx: number, sy: number, ex: number, ey: number): WallElem {
  return {
    kind: 'wall',
    id,
    levelId: 'lvl-1',
    start: { xMm: sx, yMm: sy },
    end: { xMm: ex, yMm: ey },
    heightMm: 3000,
  } as WallElem;
}

// ---------------------------------------------------------------------------
// WP-NEXT-49 — Live Structural Validation
// ---------------------------------------------------------------------------

describe('WP-NEXT-49 structuralValidation', () => {
  describe('validateBoundary', () => {
    const square = [
      { xMm: 0, yMm: 0 },
      { xMm: 4000, yMm: 0 },
      { xMm: 4000, yMm: 3000 },
      { xMm: 0, yMm: 3000 },
    ];

    it('returns no issues for a valid closed square boundary', () => {
      const issues = validateBoundary('f1', square);
      expect(issues).toHaveLength(0);
    });

    it('flags an open loop when boundary has fewer than 3 vertices', () => {
      const open = [
        { xMm: 0, yMm: 0 },
        { xMm: 4000, yMm: 0 },
      ];
      const issues = validateBoundary('f2', open);
      expect(issues.some((i) => i.code === 'open_loop')).toBe(true);
    });

    it('flags a self-intersecting boundary', () => {
      // Bowtie — edges cross
      const bowtie = [
        { xMm: 0, yMm: 0 },
        { xMm: 4000, yMm: 3000 },
        { xMm: 4000, yMm: 0 },
        { xMm: 0, yMm: 3000 },
      ];
      const issues = validateBoundary('f3', bowtie);
      expect(issues.some((i) => i.code === 'self_intersecting')).toBe(true);
    });

    it('flags a too-small edge (< 10 mm)', () => {
      const tinyEdge = [
        { xMm: 0, yMm: 0 },
        { xMm: 4000, yMm: 0 },
        { xMm: 4001, yMm: 0 },
        { xMm: 4001, yMm: 3000 },
        { xMm: 0, yMm: 3000 },
      ];
      const issues = validateBoundary('f4', tinyEdge);
      expect(issues.some((i) => i.code === 'too_small_edge')).toBe(true);
    });

    it('treats a single-point boundary as an open loop', () => {
      const issues = validateBoundary('f5', [{ xMm: 0, yMm: 0 }]);
      expect(issues.some((i) => i.code === 'open_loop')).toBe(true);
    });
  });

  describe('findDuplicateWalls', () => {
    it('returns no issues when all walls are unique', () => {
      const walls = [makeWall('w1', 0, 0, 4000, 0), makeWall('w2', 4000, 0, 4000, 3000)];
      expect(findDuplicateWalls(walls)).toHaveLength(0);
    });

    it('detects exact forward-duplicate walls', () => {
      const walls = [makeWall('w1', 0, 0, 4000, 0), makeWall('w2', 0, 0, 4000, 0)];
      const issues = findDuplicateWalls(walls);
      expect(issues).toHaveLength(1);
      expect(issues[0]!.code).toBe('duplicate_wall');
      expect(issues[0]!.elementIds).toContain('w1');
      expect(issues[0]!.elementIds).toContain('w2');
    });

    it('detects reversed-duplicate walls', () => {
      const walls = [makeWall('w1', 0, 0, 4000, 0), makeWall('w2', 4000, 0, 0, 0)];
      const issues = findDuplicateWalls(walls);
      expect(issues).toHaveLength(1);
      expect(issues[0]!.code).toBe('duplicate_wall');
    });

    it('uses tolerance — walls within 5 mm are duplicates', () => {
      const walls = [makeWall('w1', 0, 0, 4000, 0), makeWall('w2', 3, 2, 4002, 1)];
      expect(findDuplicateWalls(walls, 5)).toHaveLength(1);
    });
  });

  describe('findOrphanedHostedElements', () => {
    it('returns no issues when all hosted elements have valid hosts', () => {
      const wall = makeWall('w1', 0, 0, 4000, 0);
      const door = {
        kind: 'door',
        id: 'd1',
        levelId: 'lvl-1',
        hostId: 'w1',
        offsetAlongHostMm: 1000,
      } as unknown as Element;
      const issues = findOrphanedHostedElements({ w1: wall as unknown as Element, d1: door });
      expect(issues).toHaveLength(0);
    });

    it('flags a door with no hostId', () => {
      const door = { kind: 'door', id: 'd1', levelId: 'lvl-1' } as unknown as Element;
      const issues = findOrphanedHostedElements({ d1: door });
      expect(issues).toHaveLength(1);
      expect(issues[0]!.code).toBe('orphaned_no_host_ref');
    });

    it('flags a window whose host wall is missing', () => {
      const window = {
        kind: 'window',
        id: 'win1',
        levelId: 'lvl-1',
        hostId: 'w-missing',
      } as unknown as Element;
      const issues = findOrphanedHostedElements({ win1: window });
      expect(issues).toHaveLength(1);
      expect(issues[0]!.code).toBe('orphaned_host_missing');
    });

    it('ignores non-hosted element kinds', () => {
      const wall = makeWall('w1', 0, 0, 4000, 0);
      const issues = findOrphanedHostedElements({ w1: wall as unknown as Element });
      expect(issues).toHaveLength(0);
    });
  });

  describe('findJoinCleanupFailures', () => {
    it('returns no issues for a clean L-corner (two perpendicular walls sharing an endpoint)', () => {
      const walls = [makeWall('w1', 0, 0, 4000, 0), makeWall('w2', 4000, 0, 4000, 3000)];
      expect(findJoinCleanupFailures(walls)).toHaveLength(0);
    });

    it('returns no issues for a T-join (wall endpoint meets wall interior)', () => {
      const walls = [makeWall('w1', 0, 0, 8000, 0), makeWall('w2', 4000, 0, 4000, 3000)];
      expect(findJoinCleanupFailures(walls)).toHaveLength(0);
    });

    it('flags parallel walls that share an endpoint', () => {
      const walls = [makeWall('w1', 0, 0, 4000, 0), makeWall('w2', 4000, 0, 8000, 0)];
      const issues = findJoinCleanupFailures(walls);
      expect(issues.some((i) => i.code === 'join_cleanup_failure')).toBe(true);
    });

    it('runStructuralValidation includes join_cleanup_failure codes', () => {
      const wall1 = makeWall('w1', 0, 0, 4000, 0);
      const wall2 = makeWall('w2', 4000, 0, 8000, 0);
      const issues = runStructuralValidation({
        w1: wall1 as unknown as Element,
        w2: wall2 as unknown as Element,
      });
      expect(issues.some((i) => i.code === 'join_cleanup_failure')).toBe(true);
    });
  });

  describe('validateHostedElementSpans', () => {
    it('returns no issues when offset is inside wall span', () => {
      const wall = makeWall('w1', 0, 0, 4000, 0);
      const door = {
        kind: 'door',
        id: 'd1',
        levelId: 'lvl-1',
        hostId: 'w1',
        offsetAlongHostMm: 1500,
      } as unknown as Element;
      const issues = validateHostedElementSpans({
        w1: wall as unknown as Element,
        d1: door,
      });
      expect(issues).toHaveLength(0);
    });

    it('flags a door offset beyond the wall length', () => {
      const wall = makeWall('w1', 0, 0, 4000, 0);
      const door = {
        kind: 'door',
        id: 'd1',
        levelId: 'lvl-1',
        hostId: 'w1',
        offsetAlongHostMm: 5000,
      } as unknown as Element;
      const issues = validateHostedElementSpans({
        w1: wall as unknown as Element,
        d1: door,
      });
      expect(issues).toHaveLength(1);
      expect(issues[0]!.code).toBe('hosted_outside_wall_span');
    });
  });

  describe('runStructuralValidation', () => {
    it('returns no issues for a clean model', () => {
      const wall = makeWall('w1', 0, 0, 4000, 0);
      const door = {
        kind: 'door',
        id: 'd1',
        levelId: 'lvl-1',
        hostId: 'w1',
        offsetAlongHostMm: 1500,
      } as unknown as Element;
      const floor = {
        kind: 'floor',
        id: 'f1',
        levelId: 'lvl-1',
        boundaryMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 4000, yMm: 0 },
          { xMm: 4000, yMm: 3000 },
          { xMm: 0, yMm: 3000 },
        ],
      } as unknown as Element;
      const issues = runStructuralValidation({
        w1: wall as unknown as Element,
        d1: door,
        f1: floor,
      });
      expect(issues).toHaveLength(0);
    });

    it('aggregates issues from multiple checks in one pass', () => {
      const wall = makeWall('w1', 0, 0, 4000, 0);
      const dupWall = makeWall('w2', 0, 0, 4000, 0);
      const orphanDoor = {
        kind: 'door',
        id: 'd1',
        levelId: 'lvl-1',
        hostId: 'w-missing',
      } as unknown as Element;
      const badFloor = {
        kind: 'floor',
        id: 'f1',
        levelId: 'lvl-1',
        boundaryMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 4000, yMm: 3000 },
          { xMm: 4000, yMm: 0 },
          { xMm: 0, yMm: 3000 },
        ],
      } as unknown as Element;
      const issues = runStructuralValidation({
        w1: wall as unknown as Element,
        w2: dupWall as unknown as Element,
        d1: orphanDoor,
        f1: badFloor,
      });
      const codes = issues.map((i) => i.code);
      expect(codes).toContain('duplicate_wall');
      expect(codes).toContain('orphaned_host_missing');
      expect(codes).toContain('self_intersecting');
    });
  });
});
